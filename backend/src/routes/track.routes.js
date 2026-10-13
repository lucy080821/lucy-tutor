const express = require('express');
const prisma = require('../lib/prisma');

// Ghi lượt xem trang cho tab "Lượt truy cập" ở /administrator (mount /api/track, công khai).
// Frontend (components/analytics/AnalyticsTracker.tsx, chỉ chạy ở production) gửi bằng navigator.sendBeacon dạng
// text/plain (tránh CORS preflight) nên body tự parse JSON.
//   POST /          { id, path, visitorId, sessionId, isEntry, userId?, referrer?, utm?: {source, medium, campaign} }
//   POST /leave     { id, seconds }  — thời gian xem thật của 1 lượt xem
// Không lưu IP. Mỗi truy vấn DB ~340ms nên KHÔNG ghi từng dòng: gom vào bộ đệm RAM, 10 giây ghi 1 lần (createMany +
// 1 lệnh UPDATE gộp). Server khởi động lại thì mất tối đa ~10 giây dữ liệu — chấp nhận được cho thống kê.

const router = express.Router();

const FLUSH_MS = 10 * 1000;
const MAX_BUFFER = 2000; // quá mức này (bị spam) thì bỏ bớt, không để RAM phình
const RETENTION_DAYS = 400;
const SITE_HOSTS = ['lucytutor.online', 'www.lucytutor.online', 'localhost'];

const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|zalo.*crawler|curl|wget|python|axios|node-fetch|java\/|go-http|monitor|uptime/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
// Khu vực quản trị không đếm
const EXCLUDED_PATH_RE = /^\/(administrator|api)(\/|$)/;

// ===== Giới hạn theo IP (RAM) =====
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 400; // lượt/10 phút/IP — người thật khó vượt
const rateMap = new Map();
const clientIp = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
function rateLimited(ip) {
  const now = Date.now();
  const e = rateMap.get(ip);
  if (!e || now - e.start > RATE_WINDOW_MS) { rateMap.set(ip, { start: now, n: 1 }); return false; }
  e.n++;
  return e.n > RATE_MAX;
}

// ===== Phân loại thiết bị/trình duyệt từ User-Agent =====
function deviceOf(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'tablet';
  if (/mobi|iphone|ipod|android/i.test(ua)) return 'mobile';
  return 'desktop';
}
function browserOf(ua) {
  if (/zalo/i.test(ua)) return 'Zalo';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/coc_coc|coccoc/i.test(ua)) return 'Cốc Cốc';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/opr\/|opera/i.test(ua)) return 'Opera';
  if (/samsungbrowser/i.test(ua)) return 'Samsung';
  if (/firefox|fxios/i.test(ua)) return 'Firefox';
  if (/chrome|crios/i.test(ua)) return 'Chrome';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Khác';
}

const clip = (v, n) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().slice(0, n);
  return s || null;
};
function referrerHostOf(ref) {
  if (!ref) return null;
  try {
    const host = new URL(String(ref)).hostname.toLowerCase().replace(/^www\./, '');
    if (!host || SITE_HOSTS.includes(host) || SITE_HOSTS.includes(`www.${host}`)) return null;
    return host.slice(0, 120);
  } catch { return null; }
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(String(req.body || '')); } catch { return null; }
}

// ===== Vai trò người dùng (cache 10 phút, chỉ nhận STUDENT/TEACHER) =====
const roleCache = new Map();
const ROLE_TTL_MS = 10 * 60 * 1000;
async function resolveRoles(ids) {
  const now = Date.now();
  const missing = ids.filter((id) => { const c = roleCache.get(id); return !c || now - c.at > ROLE_TTL_MS; });
  if (missing.length) {
    const users = await prisma.user.findMany({ where: { id: { in: missing } }, select: { id: true, role: true } });
    const found = new Map(users.map((u) => [u.id, u.role]));
    missing.forEach((id) => roleCache.set(id, { role: found.get(id) || null, at: now }));
  }
  if (roleCache.size > 20000) roleCache.clear();
}

// ===== Bộ đệm ghi theo lô =====
let pending = new Map(); // id -> row chưa ghi
let pendingDurations = new Map(); // id -> seconds (dòng đã ghi ở lô trước)
let flushing = false;

async function flush() {
  if (flushing || (!pending.size && !pendingDurations.size)) return;
  flushing = true;
  const rows = [...pending.values()];
  const durations = [...pendingDurations.entries()];
  pending = new Map();
  pendingDurations = new Map();
  try {
    if (rows.length) {
      const ids = [...new Set(rows.map((r) => r.userId).filter(Boolean))];
      if (ids.length) await resolveRoles(ids);
      rows.forEach((r) => {
        const role = r.userId ? roleCache.get(r.userId)?.role : null;
        if (role === 'STUDENT' || role === 'TEACHER') r.role = role;
        else { r.userId = null; r.role = 'ANON'; } // userId không hợp lệ / tài khoản ADMIN → coi là khách
      });
      await prisma.pageView.createMany({ data: rows, skipDuplicates: true });
    }
    if (durations.length) {
      // 1 lệnh UPDATE cho cả lô: UPDATE ... FROM (VALUES (id, sec), ...)
      const values = durations.map(([id, sec]) => `('${id}', ${sec})`).join(','); // id đã qua UUID_RE, sec là số nguyên
      await prisma.$executeRawUnsafe(
        `UPDATE "PageView" AS p SET "durationSec" = v.sec FROM (VALUES ${values}) AS v(id, sec) WHERE p.id = v.id`,
      );
    }
  } catch (err) {
    console.error('[track] flush failed:', err.message);
  } finally {
    flushing = false;
  }
}

let purgeAt = 0;
async function purgeOld() {
  if (Date.now() < purgeAt) return;
  purgeAt = Date.now() + 24 * 60 * 60 * 1000;
  try {
    await prisma.pageView.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86400000) } } });
  } catch (err) {
    console.error('[track] purge failed:', err.message);
  }
}

setInterval(() => { flush(); purgeOld(); }, FLUSH_MS).unref();

const textBody = express.text({ type: '*/*', limit: '4kb' });

router.post('/', textBody, (req, res) => {
  res.status(204).end(); // trả lời ngay, xử lý sau
  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT_RE.test(ua) || rateLimited(clientIp(req))) return;
  const b = parseBody(req);
  if (!b || !UUID_RE.test(String(b.id || ''))) return;
  if (!TOKEN_RE.test(String(b.visitorId || '')) || !TOKEN_RE.test(String(b.sessionId || ''))) return;
  const path = String(b.path || '').split(/[?#]/)[0].slice(0, 200);
  if (!path.startsWith('/') || EXCLUDED_PATH_RE.test(path)) return;
  if (pending.size >= MAX_BUFFER) return;
  const utm = b.utm && typeof b.utm === 'object' ? b.utm : {};
  pending.set(b.id, {
    id: b.id,
    path,
    visitorId: b.visitorId,
    sessionId: b.sessionId,
    isEntry: !!b.isEntry,
    userId: UUID_RE.test(String(b.userId || '')) ? b.userId : null,
    role: 'ANON',
    referrerHost: referrerHostOf(b.referrer),
    utmSource: clip(utm.source, 60)?.toLowerCase() || null,
    utmMedium: clip(utm.medium, 60)?.toLowerCase() || null,
    utmCampaign: clip(utm.campaign, 100),
    device: deviceOf(ua),
    browser: browserOf(ua),
  });
});

router.post('/leave', textBody, (req, res) => {
  res.status(204).end();
  const b = parseBody(req);
  const id = String(b?.id || '');
  const seconds = Math.round(Number(b?.seconds));
  if (!UUID_RE.test(id) || !Number.isFinite(seconds) || seconds < 0) return;
  const sec = Math.min(seconds, 1800); // tối đa 30 phút/lượt xem
  const row = pending.get(id);
  if (row) row.durationSec = sec; // chưa ghi → sửa thẳng trong bộ đệm
  else if (pendingDurations.size < MAX_BUFFER) pendingDurations.set(id, sec);
});

module.exports = router;
module.exports.flushPageViews = flush;
