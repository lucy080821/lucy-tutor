const express = require('express');
const prisma = require('../lib/prisma');
const { flushPageViews } = require('./track.routes');
const { FREE_TRIAL_CUTOFF, TRIAL_DAYS } = require('../utils/freeTrial');

// Tab "Lượt truy cập" + "Sức khoẻ kinh doanh" ở /administrator (mount /api/admin/analytics, sau requireAdmin
// của admin.routes.js). Mọi gom nhóm theo ngày/tháng dùng giờ Việt Nam (server + DB lưu UTC).
// Mỗi truy vấn ~340ms nên các truy vấn độc lập chạy Promise.all và kết quả được cache 60 giây.

const router = express.Router();
const DAY_MS = 24 * 60 * 60 * 1000;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const VN = (col) => `((${col} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')`;
const pad = (n) => String(n).padStart(2, '0');

// Đầu ngày (giờ VN) của n ngày trước — n = 0 là hôm nay
function vnDayStart(daysAgo = 0) {
  const d = new Date(Date.now() + VN_OFFSET_MS);
  const ymd = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return new Date(new Date(`${ymd}T00:00:00+07:00`).getTime() - daysAgo * DAY_MS);
}
function vnMonthStartAgo(monthsAgo) {
  const d = new Date(Date.now() + VN_OFFSET_MS);
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth() + 1 - monthsAgo;
  while (m <= 0) { m += 12; y--; }
  return new Date(`${y}-${pad(m)}-01T00:00:00+07:00`);
}
const vnKey = (date) => new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
const num = (v) => Number(v || 0); // COUNT/SUM của Postgres có thể là BigInt

// Cache kết quả theo khoá (60 giây) — trang admin tự làm mới định kỳ, không cần truy vấn lại mỗi lần
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const sendError = (res, err) => {
  console.error('[admin-analytics]', err);
  res.status(500).json({ error: 'Không tải được số liệu, vui lòng thử lại' });
};

// ===== Kênh truy cập =====
const SEARCH_RE = /(^|\.)(google|bing|coccoc|yahoo|duckduckgo|yandex|baidu|ecosia|naver|search\.brave)\./;
const SOCIAL_RE = /(^|\.)(facebook|fb|messenger|zalo|tiktok|youtube|youtu|instagram|t\.co|twitter|x\.com|linkedin|pinterest|reddit|threads|discord|telegram)/;
const PAID_MEDIUM = ['cpc', 'ppc', 'paid', 'ads', 'paidsocial', 'paid_social', 'display'];
function channelOf({ referrerHost, utmSource, utmMedium, browser }) {
  if (utmSource || utmMedium) {
    if (PAID_MEDIUM.includes(utmMedium || '')) return 'Quảng cáo';
    if ((utmMedium || '') === 'email' || /mail/.test(utmSource || '')) return 'Email';
    if (SOCIAL_RE.test(`${utmSource || ''}.`) || (utmMedium || '').includes('social')) return 'Mạng xã hội';
    return 'Chiến dịch (UTM)';
  }
  if (referrerHost) {
    if (SEARCH_RE.test(referrerHost)) return 'Tìm kiếm tự nhiên';
    if (SOCIAL_RE.test(referrerHost)) return 'Mạng xã hội';
    return 'Website khác';
  }
  // Trình duyệt trong app Zalo/Facebook thường không gửi referrer
  if (browser === 'Zalo' || browser === 'Facebook') return 'Mạng xã hội';
  return 'Trực tiếp';
}

// ================= LƯỢT TRUY CẬP =================

const ALLOWED_DAYS = [7, 30, 90];

async function trafficReport(days) {
  const from = vnDayStart(days - 1);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);

  const [totals, sessions, daily, pages, landing, sources, newVisitors, hours, roles] = await Promise.all([
    prisma.$queryRaw`
      SELECT ("createdAt" >= ${from}) AS cur, COUNT(*)::int AS views,
             COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "PageView" WHERE "createdAt" >= ${prevFrom} GROUP BY 1`,
    // Theo phiên: tỉ lệ thoát (phiên chỉ 1 trang), số trang/phiên, thời gian/phiên
    prisma.$queryRaw`
      SELECT cur, COUNT(*)::int AS sessions, SUM(CASE WHEN n = 1 THEN 1 ELSE 0 END)::int AS bounces,
             AVG(n)::float AS pages, AVG(sec)::float AS seconds
      FROM (SELECT MIN("createdAt") >= ${from} AS cur, COUNT(*) AS n, COALESCE(SUM("durationSec"), 0) AS sec
            FROM "PageView" WHERE "createdAt" >= ${prevFrom} GROUP BY "sessionId") s
      GROUP BY cur`,
    prisma.$queryRawUnsafe(`
      SELECT to_char(${VN('"createdAt"')}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS views,
             COUNT(DISTINCT "visitorId")::int AS visitors, COUNT(DISTINCT "sessionId")::int AS sessions
      FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1 ORDER BY 1`, from),
    prisma.$queryRaw`
      SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT "visitorId")::int AS visitors,
             AVG("durationSec")::float AS seconds
      FROM "PageView" WHERE "createdAt" >= ${from} GROUP BY path ORDER BY views DESC LIMIT 20`,
    prisma.$queryRaw`
      SELECT e.path, COUNT(*)::int AS sessions, SUM(CASE WHEN s.n = 1 THEN 1 ELSE 0 END)::int AS bounces
      FROM "PageView" e
      JOIN (SELECT "sessionId", COUNT(*) AS n FROM "PageView" WHERE "createdAt" >= ${from} GROUP BY 1) s
        ON s."sessionId" = e."sessionId"
      WHERE e."isEntry" AND e."createdAt" >= ${from}
      GROUP BY e.path ORDER BY sessions DESC LIMIT 12`,
    // Nguồn + thiết bị lấy theo trang vào đầu tiên của mỗi phiên
    prisma.$queryRaw`
      SELECT "referrerHost", "utmSource", "utmMedium", "utmCampaign", device, browser,
             COUNT(*)::int AS sessions, COUNT(DISTINCT "visitorId")::int AS visitors
      FROM "PageView" WHERE "isEntry" AND "createdAt" >= ${from}
      GROUP BY 1, 2, 3, 4, 5, 6`,
    // Khách mới = lần đầu xuất hiện trong kỳ này
    prisma.$queryRaw`
      SELECT COUNT(*) FILTER (WHERE first_seen >= ${from})::int AS new_visitors, COUNT(*)::int AS total
      FROM (SELECT "visitorId", MIN("createdAt") AS first_seen FROM "PageView"
            WHERE "visitorId" IN (SELECT DISTINCT "visitorId" FROM "PageView" WHERE "createdAt" >= ${from})
            GROUP BY 1) t`,
    prisma.$queryRawUnsafe(`
      SELECT EXTRACT(HOUR FROM ${VN('"createdAt"')})::int AS hour, COUNT(*)::int AS views
      FROM "PageView" WHERE "createdAt" >= $1 GROUP BY 1`, from),
    prisma.$queryRaw`
      SELECT role, COUNT(DISTINCT "sessionId")::int AS sessions, COUNT(DISTINCT "userId")::int AS users
      FROM "PageView" WHERE "createdAt" >= ${from} GROUP BY role`,
  ]);

  const pick = (rows, cur) => rows.find((r) => r.cur === cur) || {};
  const summarize = (cur) => {
    const t = pick(totals, cur);
    const s = pick(sessions, cur);
    const sessionCount = num(s.sessions);
    return {
      views: num(t.views), visitors: num(t.visitors), sessions: num(t.sessions),
      bounceRate: sessionCount ? num(s.bounces) / sessionCount : 0,
      pagesPerSession: num(s.pages), avgSessionSec: num(s.seconds),
    };
  };

  // Đủ mọi ngày trong kỳ (ngày không có lượt nào = 0)
  const dailyMap = new Map(daily.map((d) => [d.day, d]));
  const series = Array.from({ length: days }, (_, i) => {
    const key = vnKey(new Date(from.getTime() + i * DAY_MS + 12 * 3600 * 1000));
    const d = dailyMap.get(key);
    return { day: key, views: num(d?.views), visitors: num(d?.visitors), sessions: num(d?.sessions) };
  });

  const channels = new Map();
  const referrers = new Map();
  const campaigns = new Map();
  const devices = new Map();
  const browsers = new Map();
  const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);
  sources.forEach((r) => {
    const n = num(r.sessions);
    add(channels, channelOf(r), n);
    if (r.referrerHost) add(referrers, r.referrerHost, n);
    if (r.utmSource || r.utmCampaign) add(campaigns, [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(' / '), n);
    add(devices, r.device, n);
    add(browsers, r.browser || 'Khác', n);
  });
  const toList = (map, limit = 10) => [...map.entries()].map(([name, sessions]) => ({ name, sessions }))
    .sort((a, b) => b.sessions - a.sessions).slice(0, limit);

  const nv = newVisitors[0] || {};
  return {
    days,
    current: summarize(true),
    previous: summarize(false),
    series,
    topPages: pages.map((p) => ({ path: p.path, views: num(p.views), visitors: num(p.visitors), avgSec: p.seconds === null ? null : num(p.seconds) })),
    landingPages: landing.map((p) => ({ path: p.path, sessions: num(p.sessions), bounceRate: num(p.sessions) ? num(p.bounces) / num(p.sessions) : 0 })),
    channels: toList(channels),
    referrers: toList(referrers),
    campaigns: toList(campaigns),
    devices: toList(devices),
    browsers: toList(browsers),
    visitorsNew: num(nv.new_visitors),
    visitorsReturning: num(nv.total) - num(nv.new_visitors),
    hours: Array.from({ length: 24 }, (_, h) => ({ hour: h, views: num(hours.find((r) => num(r.hour) === h)?.views) })),
    roles: roles.map((r) => ({ role: r.role, sessions: num(r.sessions), users: num(r.users) })),
  };
}

router.get('/traffic', async (req, res) => {
  try {
    const days = ALLOWED_DAYS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await cached(`traffic:${days}`, 60 * 1000, () => trafficReport(days)));
  } catch (err) {
    sendError(res, err);
  }
});

// Đang online: khách có lượt xem trong 5 phút gần nhất (ghi bộ đệm xuống DB trước để không trễ 10 giây)
router.get('/realtime', async (req, res) => {
  try {
    await flushPageViews();
    const since = new Date(Date.now() - 5 * 60 * 1000);
    const since30 = new Date(Date.now() - 30 * 60 * 1000);
    const [current, perMinute] = await Promise.all([
      prisma.$queryRaw`
        SELECT DISTINCT ON ("visitorId") "visitorId", path, role, device, "createdAt"
        FROM "PageView" WHERE "createdAt" >= ${since} ORDER BY "visitorId", "createdAt" DESC`,
      prisma.$queryRaw`
        SELECT FLOOR(EXTRACT(EPOCH FROM (now() - "createdAt")) / 60)::int AS ago, COUNT(*)::int AS views
        FROM "PageView" WHERE "createdAt" >= ${since30} GROUP BY 1`,
    ]);
    const pages = new Map();
    current.forEach((r) => pages.set(r.path, (pages.get(r.path) || 0) + 1));
    res.json({
      activeVisitors: current.length,
      activeUsers: current.filter((r) => r.role !== 'ANON').length,
      mobile: current.filter((r) => r.device !== 'desktop').length,
      pages: [...pages.entries()].map(([path, visitors]) => ({ path, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 10),
      // 30 phút gần nhất, cũ -> mới
      perMinute: Array.from({ length: 30 }, (_, i) => {
        const ago = 29 - i;
        return { ago, views: num(perMinute.find((r) => num(r.ago) === ago)?.views) };
      }),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ================= SỨC KHOẺ KINH DOANH =================

// Hoạt động học tập có thật (bảng, cột thời gian, nhãn tính năng). Chỉ hằng số — được ghép vào SQL.
const FEATURES = [
  { table: 'ExamResult', col: 'createdAt', label: 'Đề thi giáo viên giao' },
  { table: 'MockTestAttempt', col: 'createdAt', label: 'Đề thi thử THPT' },
  { table: 'IeltsListeningAttempt', col: 'createdAt', label: 'IELTS' },
  { table: 'IeltsReadingAttempt', col: 'createdAt', label: 'IELTS' },
  { table: 'IeltsWritingAttempt', col: 'createdAt', label: 'IELTS' },
  { table: 'IeltsSpeakingAttempt', col: 'createdAt', label: 'IELTS' },
  { table: 'ReadingAttempt', col: 'createdAt', label: 'Luyện đọc' },
  { table: 'WritingSubmission', col: 'createdAt', label: 'Luyện viết' },
  { table: 'SpeakingSession', col: 'createdAt', label: 'Luyện nói cùng AI' },
  { table: 'ListeningExamAttempt', col: 'createdAt', label: 'Đề luyện nghe' },
  { table: 'SkillPracticeResult', col: 'createdAt', label: 'Luyện nghe từ vựng', where: `source LIKE 'LISTENING_%' AND source <> 'LISTENING_EXAM'` },
  { table: 'PronunciationAttempt', col: 'createdAt', label: 'Luyện phát âm' },
  { table: 'LessonProgress', col: 'createdAt', label: 'Bài học đã học' },
  { table: 'UserVocabProgress', col: 'lastReviewedAt', label: 'Ôn từ vựng SRS' },
];
// Hoạt động = mọi bài luyện tập + lượt xem trang khi đã đăng nhập. $1 = mốc thời gian bắt đầu.
const ACTIVITY_SQL = [
  ...FEATURES.map((f) => `SELECT "userId" AS uid, "${f.col}" AS t, '${f.label}' AS feature FROM "${f.table}" WHERE "${f.col}" >= $1${f.where ? ` AND ${f.where}` : ''}`),
  `SELECT "userId" AS uid, "createdAt" AS t, NULL AS feature FROM "PageView" WHERE "userId" IS NOT NULL AND "createdAt" >= $1`,
].join('\n UNION ALL ');

async function businessReport(days) {
  const now = new Date();
  const from = vnDayStart(days - 1);
  const prevFrom = new Date(from.getTime() - days * DAY_MS);
  const month12 = vnMonthStartAgo(11);
  const cohortFrom = vnMonthStartAgo(5);

  const [revenueRows, manualRows, mauRows, dailyActive, featureRows, signupRows, funnelRows, cohortRows, cohortSizes,
    trialStudents, teachers, emptyClassrooms] = await Promise.all([
    // Doanh thu ghi nhận qua app: học phí lớp (PAID) + học viên tự do, theo tháng; payers đếm không trùng giữa 2 nguồn
    prisma.$queryRawUnsafe(`
      SELECT ym, src, SUM(amount)::bigint AS amount, COUNT(DISTINCT uid)::int AS payers FROM (
        SELECT to_char(${VN('COALESCE("paidAt", "createdAt")')}, 'YYYY-MM') AS ym, 'CLASS' AS src, "totalAmount" AS amount, "userId" AS uid
        FROM "TuitionPayment" WHERE status = 'PAID' AND COALESCE("paidAt", "createdAt") >= $1
        UNION ALL
        SELECT to_char(${VN('"paidAt"')}, 'YYYY-MM'), 'FREE', amount, "userId" FROM "FreeStudentPayment" WHERE "paidAt" >= $1
      ) t GROUP BY GROUPING SETS ((ym, src), (ym))`, month12),
    prisma.$queryRawUnsafe(`
      SELECT to_char(${VN('"date"')}, 'YYYY-MM') AS ym, type, SUM(amount)::bigint AS amount
      FROM "AdminTransaction" WHERE "date" >= $1 GROUP BY 1, 2`, month12),
    // Học viên hoạt động theo tháng (MAU)
    prisma.$queryRawUnsafe(`
      WITH act AS (${ACTIVITY_SQL})
      SELECT to_char(${VN('act.t')}, 'YYYY-MM') AS ym, u.role, COUNT(DISTINCT act.uid)::int AS users
      FROM act JOIN "User" u ON u.id = act.uid GROUP BY 1, 2`, month12),
    // Học viên hoạt động từng ngày trong 2 kỳ (tính DAU, WAU, MAU, độ gắn bó)
    prisma.$queryRawUnsafe(`
      WITH act AS (${ACTIVITY_SQL})
      SELECT to_char(${VN('act.t')}, 'YYYY-MM-DD') AS day, act.uid
      FROM act JOIN "User" u ON u.id = act.uid AND u.role = 'STUDENT'
      GROUP BY 1, 2`, vnDayStart(59)),
    prisma.$queryRawUnsafe(`
      WITH act AS (${ACTIVITY_SQL})
      SELECT feature, (t >= $2) AS cur, COUNT(*)::int AS uses, COUNT(DISTINCT uid)::int AS users
      FROM act WHERE feature IS NOT NULL GROUP BY 1, 2`, prevFrom, from),
    prisma.$queryRaw`
      SELECT ("createdAt" >= ${from}) AS cur, role, COUNT(*)::int AS n
      FROM "User" WHERE "createdAt" >= ${prevFrom} AND role IN ('STUDENT', 'TEACHER') GROUP BY 1, 2`,
    // Phễu kỳ hiện tại: khách → vào trang đăng nhập/đăng ký → đăng ký → học thử trong 7 ngày → trả phí / vào lớp
    prisma.$queryRawUnsafe(`
      WITH su AS (SELECT id, "createdAt" FROM "User" WHERE role = 'STUDENT' AND "createdAt" >= $1),
      act AS (${ACTIVITY_SQL})
      SELECT
        (SELECT COUNT(DISTINCT "visitorId") FROM "PageView" WHERE "createdAt" >= $1)::int AS visitors,
        (SELECT COUNT(DISTINCT "visitorId") FROM "PageView" WHERE "createdAt" >= $1 AND path = '/auth')::int AS auth_visitors,
        (SELECT COUNT(*) FROM su)::int AS signups,
        (SELECT COUNT(DISTINCT su.id) FROM su JOIN act ON act.uid = su.id AND act.feature IS NOT NULL
           AND act.t < su."createdAt" + interval '7 days')::int AS activated,
        (SELECT COUNT(*) FROM su WHERE EXISTS (SELECT 1 FROM "FreeStudentPayment" f WHERE f."userId" = su.id)
           OR EXISTS (SELECT 1 FROM "TuitionPayment" p WHERE p."userId" = su.id AND p.status = 'PAID'))::int AS paid,
        (SELECT COUNT(*) FROM su WHERE EXISTS (SELECT 1 FROM "_StudentClassrooms" c WHERE c."B" = su.id))::int AS joined_class`, from),
    // Giữ chân theo nhóm đăng ký (6 tháng): % học viên còn hoạt động ở tháng thứ k sau khi đăng ký
    prisma.$queryRawUnsafe(`
      WITH c AS (SELECT id, date_trunc('month', ${VN('"createdAt"')}) AS cm FROM "User" WHERE role = 'STUDENT' AND "createdAt" >= $1),
      act AS (${ACTIVITY_SQL}),
      am AS (SELECT DISTINCT uid, date_trunc('month', ${VN('t')}) AS m FROM act)
      SELECT to_char(c.cm, 'YYYY-MM') AS cohort,
             ((EXTRACT(YEAR FROM am.m) - EXTRACT(YEAR FROM c.cm)) * 12 + EXTRACT(MONTH FROM am.m) - EXTRACT(MONTH FROM c.cm))::int AS k,
             COUNT(DISTINCT c.id)::int AS users
      FROM c JOIN am ON am.uid = c.id AND am.m >= c.cm GROUP BY 1, 2`, cohortFrom),
    prisma.$queryRawUnsafe(`
      SELECT to_char(date_trunc('month', ${VN('"createdAt"')}), 'YYYY-MM') AS cohort, COUNT(*)::int AS size
      FROM "User" WHERE role = 'STUDENT' AND "createdAt" >= $1 GROUP BY 1`, cohortFrom),
    // Học viên đăng ký từ mốc dùng thử (để tính tỉ lệ chuyển đổi dùng thử → trả phí)
    prisma.user.findMany({
      where: { role: 'STUDENT', createdAt: { gte: FREE_TRIAL_CUTOFF } },
      select: {
        createdAt: true, accessExpiresAt: true, managerTeacherId: true,
        _count: { select: { freeStudentPaymentsMade: true, classroomsJoined: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: 'TEACHER' },
      select: {
        lastActive: true,
        classroomsOwned: { select: { _count: { select: { students: true } } } },
        _count: { select: { managedFreeStudents: true } },
      },
    }),
    prisma.classroom.count({ where: { students: { none: {} } } }),
  ]);

  // ----- Doanh thu 12 tháng -----
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(vnMonthStartAgo(11 - i).getTime() + VN_OFFSET_MS);
    return { ym: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`, label: `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}` };
  });
  const revenue = months.map(({ ym, label }) => {
    const row = (src) => revenueRows.find((r) => r.ym === ym && r.src === src);
    const manual = (type) => num(manualRows.find((r) => r.ym === ym && r.type === type)?.amount);
    const mau = (role) => num(mauRows.find((r) => r.ym === ym && r.role === role)?.users);
    const total = num(row(null)?.amount);
    const payers = num(row(null)?.payers);
    return {
      ym, label,
      classTuition: num(row('CLASS')?.amount), freeStudent: num(row('FREE')?.amount), total, payers,
      arppu: payers ? Math.round(total / payers) : 0,
      manualIncome: manual('INCOME'), manualExpense: manual('EXPENSE'),
      activeStudents: mau('STUDENT'), activeTeachers: mau('TEACHER'),
    };
  });

  // ----- DAU / WAU / MAU (học viên) -----
  const byDay = new Map();
  dailyActive.forEach((r) => { if (!byDay.has(r.day)) byDay.set(r.day, new Set()); byDay.get(r.day).add(r.uid); });
  const usersInWindow = (fromDaysAgo, toDaysAgo) => {
    const set = new Set();
    for (let i = toDaysAgo; i <= fromDaysAgo; i++) (byDay.get(vnKey(vnDayStart(i))) || new Set()).forEach((u) => set.add(u));
    return set.size;
  };
  const activeSeries = Array.from({ length: 30 }, (_, i) => {
    const ago = 29 - i;
    const day = vnKey(vnDayStart(ago));
    return { day, dau: byDay.get(day)?.size || 0, wau: usersInWindow(ago + 6, ago) };
  });
  const avgDau = activeSeries.reduce((s, d) => s + d.dau, 0) / activeSeries.length;
  const mau = usersInWindow(29, 0);
  const prevMau = usersInWindow(59, 30);
  const active = {
    dau: byDay.get(vnKey(vnDayStart(0)))?.size || 0,
    wau: usersInWindow(6, 0), mau, prevMau,
    avgDau,
    stickiness: mau ? avgDau / mau : 0,
    series: activeSeries,
  };

  // ----- Mức dùng tính năng (kỳ hiện tại so với kỳ trước) -----
  const featureMap = new Map();
  featureRows.forEach((r) => {
    const f = featureMap.get(r.feature) || { name: r.feature, uses: 0, users: 0, prevUses: 0, prevUsers: 0 };
    if (r.cur) { f.uses += num(r.uses); f.users += num(r.users); } else { f.prevUses += num(r.uses); f.prevUsers += num(r.users); }
    featureMap.set(r.feature, f);
  });
  // IELTS gộp 4 bảng nên "users" có thể đếm trùng 1 người làm nhiều kỹ năng — chấp nhận, nhãn ghi rõ "lượt"
  const features = [...new Set(FEATURES.map((f) => f.label))].map((name) =>
    featureMap.get(name) || { name, uses: 0, users: 0, prevUses: 0, prevUsers: 0 });

  // ----- Đăng ký mới -----
  const signups = (cur, role) => num(signupRows.find((r) => r.cur === cur && r.role === role)?.n);

  // ----- Phễu -----
  const f = funnelRows[0] || {};
  const funnel = {
    visitors: num(f.visitors), authVisitors: num(f.auth_visitors), signups: num(f.signups),
    activated: num(f.activated), paid: num(f.paid), joinedClass: num(f.joined_class),
  };

  // ----- Cohort -----
  const cohorts = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(vnMonthStartAgo(5 - i).getTime() + VN_OFFSET_MS);
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    const size = num(cohortSizes.find((r) => r.cohort === key)?.size);
    const maxK = 5 - i; // tháng chưa tới thì không có số liệu
    return {
      cohort: key, label: `T${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`, size,
      retention: Array.from({ length: maxK + 1 }, (_, k) => {
        const users = num(cohortRows.find((r) => r.cohort === key && num(r.k) === k)?.users);
        return size ? users / size : null;
      }),
    };
  });

  // ----- Dùng thử → trả phí (học viên tự do đăng ký từ mốc dùng thử) -----
  const trialEndedBefore = now.getTime() - TRIAL_DAYS * DAY_MS;
  const trial = { started: 0, inTrial: 0, ended: 0, paid: 0, joinedClass: 0, lockedNeverPaid: 0 };
  const subs = { everPaid: 0, active: 0, lapsed: 0, expiringIn7: 0 };
  trialStudents.forEach((u) => {
    const paid = u._count.freeStudentPaymentsMade > 0;
    const joined = u._count.classroomsJoined > 0;
    const exp = u.accessExpiresAt ? new Date(u.accessExpiresAt).getTime() : null;
    // Chỉ học viên tự do đã chọn giáo viên phụ trách (hoặc đã từng đóng phí) mới vào luồng dùng thử
    if (!u.managerTeacherId && !paid) return;
    trial.started++;
    if (new Date(u.createdAt).getTime() > trialEndedBefore) { trial.inTrial++; return; }
    trial.ended++;
    if (paid) trial.paid++;
    else if (joined) trial.joinedClass++;
    else if (exp !== null && exp <= now.getTime()) trial.lockedNeverPaid++;
  });
  // Thuê bao học viên tự do (đã từng đóng phí): còn hạn / đã hết hạn chưa gia hạn
  trialStudents.forEach((u) => {
    if (!u._count.freeStudentPaymentsMade || u._count.classroomsJoined) return;
    subs.everPaid++;
    const exp = u.accessExpiresAt ? new Date(u.accessExpiresAt).getTime() : 0;
    if (exp > now.getTime()) {
      subs.active++;
      if (exp - now.getTime() <= 7 * DAY_MS) subs.expiringIn7++;
    } else subs.lapsed++;
  });

  // ----- Giáo viên -----
  const teacherStats = {
    total: teachers.length,
    active30: teachers.filter((t) => now.getTime() - new Date(t.lastActive).getTime() <= 30 * DAY_MS).length,
    withStudents: teachers.filter((t) => t.classroomsOwned.some((c) => c._count.students > 0) || t._count.managedFreeStudents > 0).length,
    classStudents: teachers.reduce((s, t) => s + t.classroomsOwned.reduce((a, c) => a + c._count.students, 0), 0),
    emptyClassrooms,
  };

  return {
    days,
    revenue,
    active,
    features,
    signups: {
      students: signups(true, 'STUDENT'), teachers: signups(true, 'TEACHER'),
      prevStudents: signups(false, 'STUDENT'), prevTeachers: signups(false, 'TEACHER'),
    },
    funnel,
    cohorts,
    trial,
    subscriptions: subs,
    teachers: teacherStats,
  };
}

router.get('/business', async (req, res) => {
  try {
    const days = ALLOWED_DAYS.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
    res.json(await cached(`business:${days}`, 60 * 1000, () => businessReport(days)));
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
