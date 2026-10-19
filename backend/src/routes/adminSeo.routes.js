const express = require('express');
const prisma = require('../lib/prisma');
const { syncSearchConsole, getSyncStatus } = require('../utils/searchConsole');
const { buildSeoSummary } = require('../utils/seoSummary');

// Tab "SEO Performance" ở /administrator (mount /api/admin/seo, sau requireAdmin của admin.routes.js).
// Số liệu từ bảng SeoMetric (đồng bộ Search Console — utils/searchConsole.js), bài phân tích từ bảng SeoReport.

const router = express.Router();
const RANGES = [7, 28, 90];

// Cache 60 giây theo số ngày; xoá khi vừa đồng bộ xong
const cache = new Map();
const sendError = (res, err) => {
  console.error('[admin-seo]', err);
  res.status(500).json({ error: 'Không tải được số liệu SEO, vui lòng thử lại' });
};

router.get('/summary', async (req, res) => {
  const days = RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : 28;
  try {
    const hit = cache.get(days);
    if (hit && Date.now() - hit.at < 60_000) return res.json(hit.value);
    const value = await buildSeoSummary(days);
    cache.set(days, { at: Date.now(), value });
    res.json(value);
  } catch (err) { sendError(res, err); }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await syncSearchConsole();
    cache.clear();
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err.message, sync: getSyncStatus() });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const reports = await prisma.seoReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 60,
      select: { id: true, periodStart: true, periodEnd: true, author: true, createdAt: true },
    });
    res.json({ reports });
  } catch (err) { sendError(res, err); }
});

router.get('/reports/:id', async (req, res) => {
  try {
    const report = await prisma.seoReport.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'Không tìm thấy bài phân tích' });
    res.json({ report });
  } catch (err) { sendError(res, err); }
});

router.delete('/reports/:id', async (req, res) => {
  try {
    await prisma.seoReport.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy bài phân tích' });
    sendError(res, err);
  }
});

module.exports = router;
