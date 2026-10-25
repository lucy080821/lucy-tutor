const express = require('express');
const { syncPlatform } = require('../utils/social');
const { buildSocialSummary } = require('../utils/socialSummary');

// Tab "Mạng xã hội" ở /administrator (mount /api/admin/social, sau requireAdmin của admin.routes.js).
// Số liệu từ bảng SocialItem/SocialDaily (đồng bộ YouTube + Facebook — utils/social/*).

const router = express.Router();
const RANGES = [7, 28, 90];

// Cache 30 giây theo số ngày; xoá khi vừa đồng bộ xong
const cache = new Map();

router.get('/summary', async (req, res) => {
  const days = RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 28;
  try {
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < 30_000) return res.json(hit.value);
    const value = await buildSocialSummary(days);
    cache.set(days, { at: Date.now(), value });
    res.json(value);
  } catch (err) {
    console.error('[admin-social]', err);
    res.status(500).json({ error: 'Không tải được số liệu mạng xã hội, vui lòng thử lại' });
  }
});

router.post('/sync', async (req, res) => {
  const platform = String(req.body?.platform || '').toUpperCase();
  try {
    const result = await syncPlatform(platform, { full: true });
    cache.clear();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ===== Bình luận (YouTube + Facebook; TikTok không có API bình luận) =====
const prisma = require('../lib/prisma');

const COMMENT_PLATFORMS = ['YOUTUBE', 'FACEBOOK'];
const COMMENT_PAGE = 20;

router.get('/comments', async (req, res) => {
  const platform = COMMENT_PLATFORMS.includes(String(req.query.platform)) ? String(req.query.platform) : null;
  const status = ['open', 'handled', 'all'].includes(String(req.query.status)) ? String(req.query.status) : 'open';
  const q = String(req.query.q || '').trim().slice(0, 100);
  const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);

  // "Cần phản hồi" = chưa đánh dấu xử lý và không phải bình luận do chính kênh viết
  const where = {
    ...(platform ? { platform } : {}),
    ...(status === 'open' ? { handled: false, isOwner: false } : status === 'handled' ? { handled: true } : {}),
    ...(q ? { OR: [{ text: { contains: q, mode: 'insensitive' } }, { authorName: { contains: q, mode: 'insensitive' } }, { itemTitle: { contains: q, mode: 'insensitive' } }] } : {}),
  };
  try {
    const [total, rows, openByPlatform] = await Promise.all([
      prisma.socialComment.count({ where }),
      prisma.socialComment.findMany({ where, orderBy: { publishedAt: 'desc' }, skip: (page - 1) * COMMENT_PAGE, take: COMMENT_PAGE }),
      prisma.socialComment.groupBy({ by: ['platform'], where: { handled: false, isOwner: false }, _count: { _all: true } }),
    ]);
    res.json({
      total, page, pageSize: COMMENT_PAGE,
      open: Object.fromEntries(COMMENT_PLATFORMS.map((p) => [p, openByPlatform.find((g) => g.platform === p)?._count._all || 0])),
      items: rows.map((c) => ({
        id: c.id, platform: c.platform, itemTitle: c.itemTitle, itemUrl: c.itemUrl, isReply: !!c.parentExternalId, authorName: c.authorName,
        authorAvatar: c.authorAvatar, text: c.text, likes: c.likes, replyCount: c.replyCount, isOwner: c.isOwner, handled: c.handled,
        publishedAt: c.publishedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error('[admin-social] comments', err);
    res.status(500).json({ error: 'Không tải được bình luận, vui lòng thử lại' });
  }
});

router.post('/comments/handled', async (req, res) => {
  const { ids, handled, platform } = req.body || {};
  const flag = handled !== false;
  try {
    let count;
    if (Array.isArray(ids) && ids.length) {
      count = (await prisma.socialComment.updateMany({ where: { id: { in: ids.filter((i) => typeof i === 'string').slice(0, 200) } }, data: { handled: flag } })).count;
    } else if (req.body?.all === true) {
      // Đánh dấu tất cả bình luận đang chờ (theo nền tảng nếu có)
      const p = COMMENT_PLATFORMS.includes(platform) ? { platform } : {};
      count = (await prisma.socialComment.updateMany({ where: { ...p, handled: false, isOwner: false }, data: { handled: true } })).count;
    } else {
      return res.status(400).json({ error: 'Thiếu danh sách bình luận' });
    }
    res.json({ updated: count });
  } catch (err) {
    console.error('[admin-social] comments/handled', err);
    res.status(500).json({ error: 'Không cập nhật được bình luận' });
  }
});

module.exports = router;
