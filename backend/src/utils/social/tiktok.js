const prisma = require('../../lib/prisma');
const { ymd, toDate, num, env, getJson } = require('./common');

// TikTok (Display API v2) → SocialItem + SocialDaily. Cấu hình (backend/.env, KHÔNG commit):
//   TT_CLIENT_KEY, TT_CLIENT_SECRET — app tạo ở developers.tiktok.com, bật product "Login Kit" + "Display API"
//                                     với scope user.info.stats, video.list (không cần user.info.basic)
//   TT_REFRESH_TOKEN                — lấy 1 lần bằng `node scripts/tiktokAuth.js` (đăng nhập bằng tài khoản chủ kênh)
// Refresh token của TikTok XOAY VÒNG (mỗi lần làm mới có thể trả token mới) nên bản mới nhất được giữ trong bảng SocialToken;
// TT_REFRESH_TOKEN chỉ là giá trị khởi đầu.
//
// Giới hạn của Display API (khác YouTube/Facebook):
//  - Không có số liệu theo ngày và không có follow theo từng video → lượt xem/tương tác theo ngày được suy ra từ chênh lệch
//    tổng giữa các lần đồng bộ (20 phút/lần), số follow theo ngày = chênh lệch số người theo dõi (chỉ có tăng/giảm ròng).
//  - Cột "Follow mới" của từng video để trống ("—"); chuyển đổi cấp kênh = tăng ròng ÷ lượt xem.
//  - Không có thời gian xem.

const MAX_VIDEOS = 200;
const PAGE_SIZE = 20; // giới hạn của /video/list/
const API = 'https://open.tiktokapis.com/v2';

const config = () => {
  const c = { key: env('TT_CLIENT_KEY'), secret: env('TT_CLIENT_SECRET'), refresh: env('TT_REFRESH_TOKEN') };
  return c.key && c.secret && c.refresh ? c : null;
};
const isConfigured = () => !!config();

let tokenCache = null;
async function accessToken(c) {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const saved = await prisma.socialToken.findUnique({ where: { platform: 'TIKTOK' } });
  const refresh = saved?.refreshToken || c.refresh;
  const { data } = await getJson(`${API}/oauth/token/`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: c.key, client_secret: c.secret, grant_type: 'refresh_token', refresh_token: refresh }),
  });
  if (!data.access_token) {
    throw new Error(`Không làm mới được token TikTok: ${data.error_description || data.error || 'lỗi không rõ'} (chạy lại scripts/tiktokAuth.js nếu token hết hạn sau 365 ngày hoặc bị thu hồi)`);
  }
  if (data.refresh_token && data.refresh_token !== refresh) {
    await prisma.socialToken.upsert({
      where: { platform: 'TIKTOK' }, create: { platform: 'TIKTOK', refreshToken: data.refresh_token }, update: { refreshToken: data.refresh_token },
    });
  }
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 86400) * 1000 };
  return tokenCache.token;
}

async function api(c, path, { query, body } = {}) {
  const token = await accessToken(c);
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ''}`;
  const headers = { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) };
  for (let attempt = 1; ; attempt++) {
    const { ok, status, data } = await getJson(url, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}) });
    const code = data.error?.code;
    if (ok && (!code || code === 'ok')) return data.data || {};
    if (status < 500 || attempt >= 3) throw new Error(`TikTok API lỗi ${status}${code ? ` (${code})` : ''}: ${data.error?.message || ''}`.trim());
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
}

async function sync() {
  const c = config();
  if (!c) throw new Error('Chưa cấu hình TT_CLIENT_KEY / TT_CLIENT_SECRET / TT_REFRESH_TOKEN');
  const notes = [];

  const user = (await api(c, '/user/info/', { query: { fields: 'follower_count,likes_count,video_count' } })).user || {};
  const followers = num(user.follower_count);

  const videos = [];
  let cursor;
  do {
    const page = await api(c, '/video/list/', {
      query: { fields: 'id,title,video_description,cover_image_url,share_url,view_count,like_count,comment_count,share_count,create_time' },
      body: { max_count: PAGE_SIZE, ...(cursor !== undefined ? { cursor } : {}) },
    });
    videos.push(...(page.videos || []));
    cursor = page.has_more ? page.cursor : undefined;
  } while (cursor !== undefined && videos.length < MAX_VIDEOS);
  if (cursor !== undefined) notes.push(`Chỉ lấy ${MAX_VIDEOS} video mới nhất`);

  const now = new Date();
  const items = videos.map((v) => ({
    platform: 'TIKTOK', externalId: String(v.id), kind: 'TT_VIDEO',
    title: (v.title || v.video_description || '').slice(0, 300),
    url: v.share_url || '', thumbnail: v.cover_image_url || '',
    publishedAt: new Date(num(v.create_time) * 1000),
    views: num(v.view_count), likes: num(v.like_count), comments: num(v.comment_count), shares: num(v.share_count),
    reach: null, watchMinutes: null, followsGained: null, followsLost: null, convViews: null, metricsAt: now,
  }));

  // Số liệu theo ngày: chênh lệch tổng so với lần đồng bộ trước cộng dồn vào dòng "hôm nay"
  const old = await prisma.socialItem.findMany({ where: { platform: 'TIKTOK' }, select: { externalId: true, views: true, likes: true, comments: true, shares: true } });
  const today = ymd(now);
  const todayDate = toDate(today);
  const [todayRow, prevDay] = await Promise.all([
    prisma.socialDaily.findUnique({ where: { platform_date: { platform: 'TIKTOK', date: todayDate } } }),
    prisma.socialDaily.findFirst({ where: { platform: 'TIKTOK', date: { lt: todayDate }, followers: { not: null } }, orderBy: { date: 'desc' }, select: { followers: true } }),
  ]);
  let viewsDelta = 0;
  let engDelta = 0;
  if (old.length) {
    // Chỉ so các video có ở cả 2 lần (video bị xoá/ẩn không kéo số lùi)
    const oldMap = new Map(old.map((o) => [o.externalId, o]));
    for (const it of items) {
      const o = oldMap.get(it.externalId);
      if (!o) { viewsDelta += it.views; engDelta += it.likes + it.comments + it.shares; continue; }
      viewsDelta += Math.max(0, it.views - o.views);
      engDelta += Math.max(0, it.likes + it.comments + it.shares - (o.likes + o.comments + o.shares));
    }
  }
  const net = prevDay ? followers - prevDay.followers : 0;
  const daily = {
    platform: 'TIKTOK', date: todayDate,
    views: (todayRow?.views || 0) + viewsDelta, watchMinutes: 0, engagements: (todayRow?.engagements || 0) + engDelta,
    gained: Math.max(0, net), lost: Math.max(0, -net), followers,
  };
  if (!old.length) notes.push('Lần đầu đồng bộ: số liệu theo ngày bắt đầu tích luỹ từ hôm nay (TikTok không trả lịch sử theo ngày)');
  notes.push('TikTok chỉ trả tăng/giảm ròng người theo dõi và không có follow theo từng video — cột "Follow mới" của video để trống');

  await prisma.$transaction([
    prisma.socialItem.deleteMany({ where: { platform: 'TIKTOK', externalId: { in: items.map((i) => i.externalId) } } }),
    prisma.socialItem.createMany({ data: items, skipDuplicates: true }),
    prisma.socialDaily.deleteMany({ where: { platform: 'TIKTOK', date: todayDate } }),
    prisma.socialDaily.create({ data: daily }),
  ]);
  return { items: items.length, days: 1, notes };
}

module.exports = { sync, isConfigured };
