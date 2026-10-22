const prisma = require('../../lib/prisma');
const { DAY_MS, ymd, toDate, num, chunk, env, getJson } = require('./common');

// Facebook Page (Reels + bài viết) → SocialItem + SocialDaily. Cấu hình (backend/.env, KHÔNG commit):
//   FB_PAGE_ID       — id của Fanpage (Reels phải đăng trên Fanpage, không lấy được từ trang cá nhân)
//   FB_PAGE_TOKEN    — Page access token dài hạn (quyền pages_show_list, pages_read_engagement, read_insights)
//   FB_GRAPH_VERSION — tuỳ chọn, mặc định v23.0
// Meta đổi/bỏ chỉ số insights khá thường xuyên → mỗi chỉ số có danh sách tên ứng viên, thử lần lượt và lấy tên đầu tiên trả được số;
// chỉ số nào không có thì để null (UI hiện "—"). Kết quả mỗi lần đồng bộ ghi vào `notes` để biết chỉ số nào đang dùng được.

const BACKFILL_DAYS = 89; // insights theo ngày tối đa 93 ngày/lần gọi
const RESYNC_DAYS = 6;
const POST_LIMIT = 50;
const RECENT_DAYS = 14; // đồng bộ nhanh (mỗi 20 phút) chỉ làm mới insights của mục đăng trong 14 ngày gần nhất

// Tên chỉ số theo từng loại mục. views: lượt xem/phát; reach: số người tiếp cận; follows: follow mới từ mục này; watchMs: tổng thời gian xem
const ITEM_METRICS = {
  FB_REEL: {
    views: ['blue_reels_play_count', 'post_video_views', 'post_media_view'],
    reach: ['post_impressions_unique'],
    follows: ['post_video_followers'],
    watchMs: ['post_video_view_time'],
  },
  FB_POST: {
    views: ['post_media_view', 'post_impressions'],
    reach: ['post_impressions_unique'],
    follows: [],
    watchMs: [],
  },
};
const PAGE_METRICS = {
  views: ['page_media_view', 'page_impressions'],
  engagements: ['page_post_engagements'],
  gained: ['page_daily_follows_unique', 'page_daily_follows'],
  lost: ['page_daily_unfollows_unique', 'page_daily_unfollows'],
};

const config = () => {
  const c = { page: env('FB_PAGE_ID'), token: env('FB_PAGE_TOKEN'), version: env('FB_GRAPH_VERSION') || 'v23.0' };
  return c.page && c.token ? c : null;
};
const isConfigured = () => !!config();

async function graph(c, path, params = {}) {
  const { ok, status, data } = await getJson(`https://graph.facebook.com/${c.version}/${path}?${new URLSearchParams({ ...params, access_token: c.token })}`);
  if (!ok) {
    const e = data.error || {};
    const err = new Error(`Facebook API lỗi ${status}: ${e.message || ''}`.trim());
    err.fbCode = e.code;
    throw err;
  }
  return data;
}

// Gọi gộp tối đa 50 yêu cầu GET trong 1 lần (Batch API); mỗi phần tử trả { code, body } riêng nên 1 chỉ số lỗi không kéo cả lô
async function batchGet(c, relativeUrls) {
  const out = [];
  for (const part of chunk(relativeUrls, 50)) {
    const { ok, data } = await getJson(`https://graph.facebook.com/${c.version}/`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ access_token: c.token, batch: JSON.stringify(part.map((relative_url) => ({ method: 'GET', relative_url }))) }),
    });
    if (!ok || !Array.isArray(data)) throw new Error(`Facebook batch lỗi: ${data?.error?.message || 'không rõ'}`);
    out.push(...data.map((r) => {
      let body = null;
      try { body = r && r.body ? JSON.parse(r.body) : null; } catch { /* body không phải JSON */ }
      return r && r.code === 200 ? body : null;
    }));
  }
  return out;
}

const metricValue = (body) => {
  const v = body?.data?.[0]?.values?.[0]?.value;
  return typeof v === 'number' ? v : null;
};

// Làm mới insights cho danh sách mục: trả Map externalId → { views, reach, follows, watchMs } (giá trị null = không có)
async function itemInsights(c, items, used) {
  const requests = [];
  for (const it of items) {
    const edge = it.kind === 'FB_POST' ? 'insights' : 'video_insights';
    for (const [field, names] of Object.entries(ITEM_METRICS[it.kind])) {
      for (const name of names) requests.push({ id: it.externalId, field, name, url: `${it.externalId}/${edge}?metric=${name}` });
    }
  }
  const bodies = await batchGet(c, requests.map((r) => r.url));
  const result = new Map(items.map((it) => [it.externalId, {}]));
  requests.forEach((r, i) => {
    const value = metricValue(bodies[i]);
    const cur = result.get(r.id);
    if (value !== null && cur[r.field] === undefined) { cur[r.field] = value; used.add(r.name); } // tên ứng viên đầu tiên trả được số thì thắng
  });
  return result;
}

async function pageDaily(c, since, until, used) {
  const series = {};
  for (const [field, names] of Object.entries(PAGE_METRICS)) {
    for (const name of names) {
      try {
        const data = await graph(c, `${c.page}/insights`, { metric: name, period: 'day', since: String(since), until: String(until) });
        const values = data.data?.[0]?.values;
        if (!values) continue;
        series[field] = new Map(values.map((v) => [ymd(new Date(new Date(v.end_time).getTime() - DAY_MS)), num(v.value)]));
        used.add(name);
        break;
      } catch { /* tên chỉ số không còn dùng được → thử tên kế tiếp */ }
    }
  }
  return series;
}

// Danh sách Reels/bài viết: thử kèm số react + bình luận trước; Facebook đòi quyền pages_read_user_content (cần App Review) hoặc node không
// hỗ trợ trường này thì lấy trường cơ bản (likes/comments để 0, không ảnh hưởng tỷ lệ chuyển đổi)
async function listWithFallback(c, edge, baseFields, extraFields, extra = {}) {
  const params = { limit: String(POST_LIMIT), ...extra };
  try { return await graph(c, `${c.page}/${edge}`, { ...params, fields: `${baseFields},${extraFields}` }); }
  catch { return graph(c, `${c.page}/${edge}`, { ...params, fields: baseFields }); }
}

async function sync({ full = true } = {}) {
  const c = config();
  if (!c) throw new Error('Chưa cấu hình FB_PAGE_ID / FB_PAGE_TOKEN');
  const used = new Set();
  const notes = [];

  const page = await graph(c, c.page, { fields: 'name,followers_count,fan_count' });
  const followers = num(page.followers_count ?? page.fan_count);

  const reactions = 'reactions.summary(true).limit(0),comments.summary(true).limit(0)';
  const [reelRes, postRes] = await Promise.all([
    listWithFallback(c, 'video_reels', 'id,description,created_time,permalink_url,picture', reactions).catch((e) => { notes.push(`Không đọc được danh sách Reels: ${e.message}`); return { data: [] }; }),
    listWithFallback(c, 'published_posts', 'id,message,created_time,permalink_url,full_picture,shares', reactions),
  ]);

  const now = new Date();
  const reelIds = new Set((reelRes.data || []).map((r) => r.id));
  const items = [
    ...(reelRes.data || []).map((r) => ({
      kind: 'FB_REEL', externalId: r.id, title: r.description || '', url: r.permalink_url ? (r.permalink_url.startsWith('http') ? r.permalink_url : `https://www.facebook.com${r.permalink_url}`) : `https://www.facebook.com/reel/${r.id}`,
      thumbnail: r.picture || '', publishedAt: new Date(r.created_time),
      likes: num(r.reactions?.summary?.total_count), comments: num(r.comments?.summary?.total_count), shares: 0,
    })),
    ...(postRes.data || []).filter((p) => !reelIds.has(String(p.id).split('_')[1])).map((p) => {
      return {
        kind: 'FB_POST', externalId: p.id,
        title: p.message || '', url: p.permalink_url ? (p.permalink_url.startsWith('http') ? p.permalink_url : `https://www.facebook.com${p.permalink_url}`) : '',
        thumbnail: p.full_picture || '', publishedAt: new Date(p.created_time),
        likes: num(p.reactions?.summary?.total_count), comments: num(p.comments?.summary?.total_count), shares: num(p.shares?.count),
      };
    }),
  ];

  const recentCutoff = Date.now() - RECENT_DAYS * DAY_MS;
  const targets = items.filter((it) => full || it.publishedAt.getTime() >= recentCutoff);
  const insights = await itemInsights(c, targets, used);

  // Mục không được làm mới (đồng bộ nhanh) giữ nguyên số insights đang lưu
  const old = full ? [] : await prisma.socialItem.findMany({ where: { platform: 'FACEBOOK', externalId: { in: items.map((i) => i.externalId) } } });
  const oldMap = new Map(old.map((o) => [o.externalId, o]));
  const rows = items.map((it) => {
    const ins = insights.get(it.externalId);
    const prev = oldMap.get(it.externalId);
    const base = { platform: 'FACEBOOK', externalId: it.externalId, kind: it.kind, title: it.title.slice(0, 300), url: it.url, thumbnail: it.thumbnail, publishedAt: it.publishedAt, likes: it.likes, comments: it.comments, shares: it.shares, metricsAt: now };
    if (!ins) {
      return prev ? { ...base, views: prev.views, reach: prev.reach, watchMinutes: prev.watchMinutes, followsGained: prev.followsGained, followsLost: null, convViews: prev.convViews } : { ...base, views: 0, reach: null, watchMinutes: null, followsGained: null, followsLost: null, convViews: null };
    }
    const hasFollows = typeof ins.follows === 'number' && typeof ins.views === 'number';
    return {
      ...base, views: num(ins.views), reach: typeof ins.reach === 'number' ? num(ins.reach) : null,
      watchMinutes: typeof ins.watchMs === 'number' ? ins.watchMs / 60000 : null,
      followsGained: hasFollows ? num(ins.follows) : null, followsLost: null, convViews: hasFollows ? num(ins.views) : null,
    };
  });

  // Số liệu cả Page theo ngày
  const first = !(await prisma.socialDaily.findFirst({ where: { platform: 'FACEBOOK' }, select: { id: true } }));
  const days = first ? BACKFILL_DAYS : RESYNC_DAYS;
  const today = ymd(now);
  const series = await pageDaily(c, Math.floor((now.getTime() - days * DAY_MS) / 1000), Math.floor(now.getTime() / 1000), used);
  if (!series.gained) notes.push('Page không trả được số follow theo ngày — chỉ số chuyển đổi cấp Page sẽ trống');
  if (!series.views) notes.push('Page không trả được lượt xem theo ngày');

  const prevF = await prisma.socialDaily.findMany({ where: { platform: 'FACEBOOK', followers: { not: null } }, select: { date: true, followers: true } });
  const keep = new Map(prevF.map((r) => [ymd(r.date), r.followers]));
  keep.set(today, followers);
  const dates = new Set([today, ...Object.values(series).flatMap((m) => [...m.keys()])]);
  const get = (field, d) => series[field]?.get(d) ?? 0;
  const daily = [...dates].sort().map((d) => ({
    platform: 'FACEBOOK', date: toDate(d), views: get('views', d), watchMinutes: 0, engagements: get('engagements', d),
    gained: get('gained', d), lost: get('lost', d), followers: keep.get(d) ?? null,
  }));
  const from = daily[0].date;

  await prisma.$transaction([
    prisma.socialItem.deleteMany({ where: { platform: 'FACEBOOK', externalId: { in: rows.map((r) => r.externalId) } } }),
    prisma.socialItem.createMany({ data: rows, skipDuplicates: true }),
    prisma.socialDaily.deleteMany({ where: { platform: 'FACEBOOK', date: { gte: from } } }),
    prisma.socialDaily.createMany({ data: daily, skipDuplicates: true }),
  ]);
  if (!rows.some((r) => r.followsGained !== null)) notes.push('Chưa có chỉ số follow theo từng Reel/video — bảng hiện "—" ở cột chuyển đổi');
  return { items: rows.length, days: daily.length, notes: [...notes, `Chỉ số đang dùng: ${[...used].join(', ') || 'không có'}`] };
}

module.exports = { sync, isConfigured };
