const crypto = require('crypto');
const prisma = require('../lib/prisma');

// Google Search Console API → bảng SeoMetric (tab "SEO Performance" ở /administrator + routine phân tích tuần).
// Cấu hình (backend/.env, KHÔNG commit):
//   GSC_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'  — khoá JSON của service account, viết trên 1 dòng
//   GSC_SITE_URL=https://lucytutor.online/                     — đúng tên property trong Search Console
// Service account phải được thêm vào Search Console (Cài đặt → Người dùng và quyền) với quyền "Hạn chế".
// Không dùng thư viện googleapis: chỉ cần ký 1 JWT RS256 bằng crypto có sẵn của Node để đổi lấy access token.

const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_LIMIT = 25000; // tối đa của API cho 1 lần gọi
const BACKFILL_DAYS = 480; // lần đầu lấy hết lịch sử Google còn giữ (~16 tháng)
const RESYNC_DAYS = 10; // các lần sau ghi đè lại 10 ngày cuối (Google còn cập nhật số liệu gần đây)
const SYNC_HOUR_VN = 6;

// Chiều dữ liệu → tham số API. QUERY_PAGE: truy vấn nào đang đưa người dùng tới trang nào
const DIMENSIONS = {
  TOTAL: [],
  QUERY: ['query'],
  PAGE: ['page'],
  COUNTRY: ['country'],
  DEVICE: ['device'],
  QUERY_PAGE: ['query', 'page'],
};
// searchAppearance không ghép được với chiều "date" (API báo 400) → lấy riêng từng ngày, chỉ RESYNC_DAYS ngày gần nhất
const APPEARANCE = ['searchAppearance'];

function readConfig() {
  // Ô biến môi trường của hosting (Hostinger...) giữ nguyên ký tự → bỏ cặp nháy bọc ngoài nếu lỡ chép cả từ .env
  const unquote = (v) => (v || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
  const raw = unquote(process.env.GSC_SERVICE_ACCOUNT_JSON);
  const siteUrl = unquote(process.env.GSC_SITE_URL);
  if (!raw || !siteUrl) return null;
  try {
    const sa = JSON.parse(raw);
    if (!sa.client_email || !sa.private_key) return null;
    return { sa, siteUrl };
  } catch {
    console.error('[seo] GSC_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ');
    return null;
  }
}
const isConfigured = () => !!readConfig();

let tokenCache = null; // { token, exp }
async function getAccessToken(sa) {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tokenUri = sa.token_uri || 'https://oauth2.googleapis.com/token';
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 })}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(unsigned), sa.private_key).toString('base64url');
  const res = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.access_token) throw new Error(`Không lấy được access token Google: ${data.error_description || data.error || res.status}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function querySearchAnalytics(cfg, body) {
  const token = await getAccessToken(cfg.sa);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/searchAnalytics/query`;
  const rows = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, rowLimit: ROW_LIMIT, startRow }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Search Console API lỗi ${res.status}: ${data.error?.message || ''}`);
    rows.push(...(data.rows || []));
    if (!data.rows || data.rows.length < ROW_LIMIT) return rows;
  }
}

const ymd = (d) => d.toISOString().slice(0, 10);
// Ngày hôm nay theo giờ VN (Search Console tính ngày theo giờ Thái Bình Dương, nhưng chỉ dùng làm mốc trên của khoảng lấy)
const vnToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

let syncing = null; // promise của lần đồng bộ đang chạy — gọi chồng thì dùng chung
let lastSync = { at: null, error: null, rows: 0, from: null, to: null };

async function syncSearchConsole() {
  if (syncing) return syncing;
  syncing = (async () => {
    const cfg = readConfig();
    if (!cfg) throw new Error('Chưa cấu hình GSC_SERVICE_ACCOUNT_JSON / GSC_SITE_URL');
    const latest = await prisma.seoMetric.findFirst({ where: { dimension: 'TOTAL' }, orderBy: { date: 'desc' }, select: { date: true } });
    const end = vnToday();
    const start = ymd(new Date(new Date(`${end}T00:00:00Z`).getTime() - (latest ? RESYNC_DAYS : BACKFILL_DAYS) * DAY_MS));

    const toRow = (date, dimension, keys, r) => ({
      date: new Date(`${date}T00:00:00Z`),
      dimension,
      key: keys.join('\t').slice(0, 2000),
      clicks: Math.round(r.clicks),
      impressions: Math.round(r.impressions),
      position: r.position,
    });
    // Mỗi chiều 1 lần gọi (kèm chiều "date") + chiều giao diện tìm kiếm từng ngày — tất cả song song
    const endMs = new Date(`${end}T00:00:00Z`).getTime();
    const appearanceDays = Array.from({ length: RESYNC_DAYS + 1 }, (_, i) => ymd(new Date(endMs - i * DAY_MS)));
    const results = await Promise.all([
      ...Object.entries(DIMENSIONS).map(async ([dimension, dims]) => {
        const rows = await querySearchAnalytics(cfg, { startDate: start, endDate: end, dimensions: ['date', ...dims] });
        return rows.map((r) => toRow(r.keys[0], dimension, r.keys.slice(1), r));
      }),
      ...appearanceDays.map(async (day) => {
        const rows = await querySearchAnalytics(cfg, { startDate: day, endDate: day, dimensions: APPEARANCE });
        return rows.map((r) => toRow(day, 'APPEARANCE', r.keys, r));
      }),
    ]);
    const data = results.flat();

    // Ghi đè trọn khoảng ngày vừa lấy (dòng không còn trong API — vd truy vấn bị ẩn danh lại — cũng được xoá)
    const range = { gte: new Date(`${start}T00:00:00Z`), lte: new Date(`${end}T00:00:00Z`) };
    await prisma.$transaction([
      prisma.seoMetric.deleteMany({ where: { date: range } }),
      ...chunk(data, 5000).map((part) => prisma.seoMetric.createMany({ data: part, skipDuplicates: true })),
    ]);
    lastSync = { at: new Date().toISOString(), error: null, rows: data.length, from: start, to: end };
    console.log(`[seo] Đồng bộ Search Console ${start} → ${end}: ${data.length} dòng`);
    return lastSync;
  })()
    .catch((err) => {
      lastSync = { ...lastSync, error: err.message };
      console.error('[seo] Đồng bộ thất bại:', err.message);
      throw err;
    })
    .finally(() => { syncing = null; });
  return syncing;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const getSyncStatus = () => ({ configured: isConfigured(), syncing: !!syncing, ...lastSync });

// Đồng bộ nếu lần gần nhất đã cũ hơn maxAgeMs (route dữ liệu cho routine gọi trước khi đọc)
async function ensureFresh(maxAgeMs = 6 * 3600 * 1000) {
  if (!isConfigured()) return;
  if (lastSync.at && Date.now() - new Date(lastSync.at).getTime() < maxAgeMs) return;
  await syncSearchConsole().catch(() => {}); // lỗi đã ghi vào lastSync, vẫn trả số liệu cũ
}

// Lịch: 30 giây sau khi khởi động (để server nhận request trước) rồi mỗi ngày 06:00 giờ VN
let timer = null;
function msUntilNextSync() {
  const now = Date.now();
  const vn = new Date(now + 7 * 3600 * 1000);
  const target = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), SYNC_HOUR_VN, 0) - 7 * 3600 * 1000;
  return target > now ? target - now : target + DAY_MS - now;
}
function scheduleNext() {
  clearTimeout(timer);
  timer = setTimeout(async () => { await syncSearchConsole().catch(() => {}); scheduleNext(); }, msUntilNextSync());
  timer.unref?.();
}
function startSearchConsoleSync() {
  if (!isConfigured()) {
    console.log('[seo] Chưa cấu hình Search Console API — bỏ qua đồng bộ');
    return;
  }
  setTimeout(() => syncSearchConsole().catch(() => {}), 30_000).unref?.();
  scheduleNext();
}

module.exports = { syncSearchConsole, startSearchConsoleSync, getSyncStatus, ensureFresh, isConfigured };
