const prisma = require('../../lib/prisma');
const { DAY_MS } = require('./common');
const youtube = require('./youtube');
const facebook = require('./facebook');

// Bình luận YouTube + Facebook → SocialComment (tab "Mạng xã hội" > Bình luận). Chạy sau mỗi lần đồng bộ số liệu của nền tảng.
// TikTok không có ở đây: Display API không trả bình luận (chỉ có số lượng bình luận mỗi video trong SocialItem.comments).
//  - YouTube: commentThreads.list theo kênh (mới nhất trước, tối đa 3 trang × 100 luồng), dùng scope youtube.readonly sẵn có của YT_REFRESH_TOKEN.
//  - Facebook: bình luận của các Reels/bài viết đăng trong 30 ngày gần nhất. Facebook chỉ trả nội dung + tên người bình luận khi token có quyền
//    pages_read_user_content (cần App Review); thiếu quyền thì không có gì để lưu và `notes` báo rõ.
// Cột `handled` do admin đánh dấu nên đồng bộ chỉ thêm bình luận mới và cập nhật like/số trả lời/nội dung, không động tới `handled`.

const YT_PAGES = 3;
const FB_ITEM_DAYS = 30;
const FB_ITEM_LIMIT = 40;
const FB_COMMENTS_PER_ITEM = 50;
const MAX_TEXT = 2000;

async function save(platform, rows) {
  if (!rows.length) return 0;
  const existing = await prisma.socialComment.findMany({
    where: { platform, externalId: { in: rows.map((r) => r.externalId) } },
    select: { externalId: true, text: true, likes: true, replyCount: true },
  });
  const have = new Map(existing.map((e) => [e.externalId, e]));
  const fresh = rows.filter((r) => !have.has(r.externalId));
  const changed = rows.filter((r) => {
    const e = have.get(r.externalId);
    return e && (e.text !== r.text || e.likes !== r.likes || e.replyCount !== r.replyCount);
  });
  await prisma.$transaction([
    prisma.socialComment.createMany({ data: fresh, skipDuplicates: true }),
    ...changed.map((r) => prisma.socialComment.update({
      where: { platform_externalId: { platform, externalId: r.externalId } },
      data: { text: r.text, likes: r.likes, replyCount: r.replyCount, itemTitle: r.itemTitle, itemUrl: r.itemUrl, fetchedAt: new Date() },
    })),
  ]);
  return fresh.length;
}

async function itemLookup(platform) {
  const items = await prisma.socialItem.findMany({ where: { platform }, select: { externalId: true, title: true, url: true } });
  return new Map(items.map((i) => [i.externalId, i]));
}

async function syncYoutube() {
  const c = youtube.config();
  if (!c) return { added: 0, notes: [] };
  const D = 'https://www.googleapis.com/youtube/v3';
  const channelId = (await youtube.api(c, `${D}/channels`, { part: 'id', mine: 'true' })).items?.[0]?.id;
  if (!channelId) return { added: 0, notes: [] };
  const items = await itemLookup('YOUTUBE');

  const rows = [];
  let pageToken;
  for (let page = 0; page < YT_PAGES; page++) {
    let data;
    try {
      data = await youtube.api(c, `${D}/commentThreads`, {
        part: 'snippet,replies', allThreadsRelatedToChannelId: channelId, order: 'time', maxResults: '100', textFormat: 'plainText',
        ...(pageToken ? { pageToken } : {}),
      });
    } catch (err) {
      // Video tắt bình luận / kênh chưa có bình luận nào → bỏ qua; lỗi khác thì báo
      if (/commentsDisabled|403|404/.test(err.message) && rows.length) break;
      throw err;
    }
    for (const t of data.items || []) {
      const top = t.snippet.topLevelComment;
      const videoId = t.snippet.videoId;
      const meta = items.get(videoId);
      const base = { platform: 'YOUTUBE', itemExternalId: videoId, itemTitle: (meta?.title || '').slice(0, 300), itemUrl: meta?.url || `https://www.youtube.com/watch?v=${videoId}` };
      const make = (cm, extra) => ({
        ...base, externalId: cm.id, authorName: (cm.snippet.authorDisplayName || '').slice(0, 120),
        authorAvatar: cm.snippet.authorProfileImageUrl || '', text: (cm.snippet.textOriginal || cm.snippet.textDisplay || '').slice(0, MAX_TEXT),
        likes: cm.snippet.likeCount || 0, isOwner: cm.snippet.authorChannelId?.value === channelId, publishedAt: new Date(cm.snippet.publishedAt), ...extra,
      });
      rows.push(make(top, { parentExternalId: null, replyCount: t.snippet.totalReplyCount || 0 }));
      for (const r of t.replies?.comments || []) rows.push(make(r, { parentExternalId: top.id, replyCount: 0 }));
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  const notes = [];
  if (!rows.length) notes.push('YouTube chưa có bình luận nào (hoặc token thiếu quyền youtube.readonly)');
  return { added: await save('YOUTUBE', rows), notes };
}

async function syncFacebook() {
  const c = facebook.config();
  if (!c) return { added: 0, notes: [] };
  const since = new Date(Date.now() - FB_ITEM_DAYS * DAY_MS);
  const recent = await prisma.socialItem.findMany({
    where: { platform: 'FACEBOOK', publishedAt: { gte: since } }, orderBy: { publishedAt: 'desc' }, take: FB_ITEM_LIMIT,
    select: { externalId: true, title: true, url: true },
  });
  if (!recent.length) return { added: 0, notes: [] };

  const fields = encodeURIComponent('id,message,created_time,from{id,name},like_count,comment_count,parent{id}');
  const urls = recent.map((i) => `${i.externalId}/comments?fields=${fields}&filter=stream&order=reverse_chronological&limit=${FB_COMMENTS_PER_ITEM}`);
  const bodies = await facebook.batchGet(c, urls);

  const rows = [];
  let failed = 0;
  let anonymous = 0;
  recent.forEach((item, i) => {
    const body = bodies[i];
    if (!body) { failed++; return; }
    for (const cm of body.data || []) {
      if (!cm.message && !cm.from) { anonymous++; continue; } // thiếu pages_read_user_content → không có nội dung
      rows.push({
        platform: 'FACEBOOK', externalId: cm.id, itemExternalId: item.externalId, itemTitle: (item.title || '').slice(0, 300), itemUrl: item.url,
        parentExternalId: cm.parent?.id || null, authorName: (cm.from?.name || 'Người dùng Facebook').slice(0, 120), authorAvatar: '',
        text: (cm.message || '').slice(0, MAX_TEXT), likes: cm.like_count || 0, replyCount: cm.comment_count || 0,
        isOwner: cm.from?.id === c.page, publishedAt: new Date(cm.created_time),
      });
    }
  });
  const notes = [];
  if (failed === recent.length) notes.push('Facebook từ chối đọc bình luận — token cần quyền pages_read_engagement + pages_read_user_content (cần App Review)');
  else if (anonymous && !rows.length) notes.push('Facebook chỉ trả số bình luận, không trả nội dung — token cần quyền pages_read_user_content (cần App Review)');
  return { added: await save('FACEBOOK', rows), notes };
}

const RUNNERS = { YOUTUBE: syncYoutube, FACEBOOK: syncFacebook };
const supports = (platform) => !!RUNNERS[platform];
const syncComments = (platform) => RUNNERS[platform]();

module.exports = { syncComments, supports };
