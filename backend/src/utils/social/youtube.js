const prisma = require('../../lib/prisma');
const { DAY_MS, ymd, toDate, num, chunk, env, getJson } = require('./common');

// YouTube → SocialItem + SocialDaily. Cấu hình (backend/.env, KHÔNG commit):
//   YT_CLIENT_ID, YT_CLIENT_SECRET   — OAuth client loại "Desktop app" (project Google Cloud đã bật YouTube Data API v3 + YouTube Analytics API)
//   YT_REFRESH_TOKEN                 — lấy 1 lần bằng `node scripts/youtubeAuth.js` (đăng nhập bằng tài khoản chủ kênh)
// Service account (như Search Console) KHÔNG đọc được số liệu kênh YouTube nên bắt buộc dùng OAuth. OAuth app phải ở trạng thái
// "In production", để "Testing" thì refresh token hết hạn sau 7 ngày.
// Lượt xem hiện tại lấy từ Data API (gần real-time); số follow (subscribersGained) từ Analytics API, trễ 1–2 ngày.

const MAX_VIDEOS = 200; // Analytics báo cáo theo video tối đa 200 dòng/lần
const BACKFILL_DAYS = 120;
const RESYNC_DAYS = 5;
const SHORT_MAX_SECONDS = 180; // Shorts hiện dài tới 3 phút

const config = () => {
  const c = { id: env('YT_CLIENT_ID'), secret: env('YT_CLIENT_SECRET'), refresh: env('YT_REFRESH_TOKEN') };
  return c.id && c.secret && c.refresh ? c : null;
};
const isConfigured = () => !!config();

let tokenCache = null;
async function accessToken(c) {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const { data } = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, refresh_token: c.refresh, grant_type: 'refresh_token' }),
  });
  if (!data.access_token) {
    throw new Error(`Không làm mới được token YouTube: ${data.error_description || data.error || 'lỗi không rõ'} (chạy lại scripts/youtubeAuth.js nếu token bị thu hồi/hết hạn)`);
  }
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

async function api(c, url, params) {
  const token = await accessToken(c);
  // Google thỉnh thoảng trả 5xx tạm thời ("Internal error encountered") → thử lại tối đa 3 lần
  for (let attempt = 1; ; attempt++) {
    const { ok, status, data } = await getJson(`${url}?${new URLSearchParams(params)}`, { headers: { authorization: `Bearer ${token}` } });
    if (ok) return data;
    if (status < 500 || attempt >= 3) throw new Error(`YouTube API lỗi ${status}: ${data.error?.message || ''}`);
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
}

// "PT1H2M3S" → giây
function isoSeconds(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  return m ? Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0) : 0;
}

async function sync() {
  const c = config();
  if (!c) throw new Error('Chưa cấu hình YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN');
  const D = 'https://www.googleapis.com/youtube/v3';
  const A = 'https://youtubeanalytics.googleapis.com/v2/reports';

  const ch = (await api(c, `${D}/channels`, { part: 'statistics,contentDetails,snippet', mine: 'true' })).items?.[0];
  if (!ch) throw new Error('Tài khoản đã đăng nhập không có kênh YouTube');
  const uploads = ch.contentDetails.relatedPlaylists.uploads;
  const channelStart = (ch.snippet.publishedAt || '2010-01-01').slice(0, 10);
  const subscribers = num(ch.statistics.subscriberCount);

  const ids = [];
  let pageToken;
  do {
    const page = await api(c, `${D}/playlistItems`, { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
    ids.push(...(page.items || []).map((i) => i.contentDetails.videoId));
    pageToken = page.nextPageToken;
  } while (pageToken && ids.length < MAX_VIDEOS);

  const first = !(await prisma.socialDaily.findFirst({ where: { platform: 'YOUTUBE' }, select: { id: true } }));
  const today = ymd(new Date());
  const [videoPages, perVideo, perDay] = await Promise.all([
    Promise.all(chunk(ids.slice(0, MAX_VIDEOS), 50).map((part) => api(c, `${D}/videos`, { part: 'snippet,statistics,contentDetails', id: part.join(',') }))),
    api(c, A, {
      ids: 'channel==MINE', startDate: channelStart, endDate: today, dimensions: 'video', sort: '-views', maxResults: String(MAX_VIDEOS),
      metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
    }),
    api(c, A, {
      ids: 'channel==MINE', dimensions: 'day', sort: 'day',
      startDate: ymd(new Date(Date.now() - (first ? BACKFILL_DAYS : RESYNC_DAYS) * DAY_MS)), endDate: today,
      metrics: 'views,estimatedMinutesWatched,likes,comments,shares,subscribersGained,subscribersLost',
    }),
  ]);
  const videos = videoPages.flatMap((r) => r.items || []);

  const stats = new Map((perVideo.rows || []).map((r) => [r[0], { views: r[1], minutes: r[2], gained: r[3], lost: r[4] }]));
  const now = new Date();
  const items = videos.map((v) => {
    const a = stats.get(v.id);
    const short = isoSeconds(v.contentDetails.duration) <= SHORT_MAX_SECONDS;
    return {
      platform: 'YOUTUBE', externalId: v.id, kind: short ? 'YT_SHORT' : 'YT_VIDEO',
      title: (v.snippet.title || '').slice(0, 300),
      url: short ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
      thumbnail: v.snippet.thumbnails?.medium?.url || v.snippet.thumbnails?.default?.url || '',
      publishedAt: new Date(v.snippet.publishedAt),
      views: num(v.statistics.viewCount), likes: num(v.statistics.likeCount), comments: num(v.statistics.commentCount),
      watchMinutes: a ? a.minutes : null,
      followsGained: a ? num(a.gained) : null, followsLost: a ? num(a.lost) : null, convViews: a ? num(a.views) : null,
      metricsAt: now,
    };
  });

  // Số người đăng ký tổng chỉ có "hôm nay" từ Data API → giữ lại các ngày đã ghi trước đó
  const prev = await prisma.socialDaily.findMany({ where: { platform: 'YOUTUBE', followers: { not: null } }, select: { date: true, followers: true } });
  const followers = new Map(prev.map((r) => [ymd(r.date), r.followers]));
  followers.set(today, subscribers);
  const daily = (perDay.rows || []).map((r) => ({
    platform: 'YOUTUBE', date: toDate(r[0]), views: num(r[1]), watchMinutes: r[2] || 0, engagements: num(r[3]) + num(r[4]) + num(r[5]),
    gained: num(r[6]), lost: num(r[7]), followers: followers.get(r[0]) ?? null,
  }));
  if (!daily.some((d) => ymd(d.date) === today)) {
    daily.push({ platform: 'YOUTUBE', date: toDate(today), views: 0, watchMinutes: 0, engagements: 0, gained: 0, lost: 0, followers: subscribers });
  }

  const from = daily.reduce((m, d) => (d.date < m ? d.date : m), daily[0].date);
  await prisma.$transaction([
    prisma.socialItem.deleteMany({ where: { platform: 'YOUTUBE', externalId: { in: items.map((i) => i.externalId) } } }),
    prisma.socialItem.createMany({ data: items, skipDuplicates: true }),
    prisma.socialDaily.deleteMany({ where: { platform: 'YOUTUBE', date: { gte: from } } }),
    prisma.socialDaily.createMany({ data: daily, skipDuplicates: true }),
  ]);
  return { items: items.length, days: daily.length, notes: ids.length >= MAX_VIDEOS ? [`Chỉ lấy ${MAX_VIDEOS} video mới nhất`] : [] };
}

module.exports = { sync, isConfigured, config, api };
