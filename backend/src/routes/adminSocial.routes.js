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

module.exports = router;
