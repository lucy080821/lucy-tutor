const crypto = require('crypto');
const express = require('express');
const prisma = require('../lib/prisma');
const { ensureFresh } = require('../utils/searchConsole');
const { buildSeoSummary } = require('../utils/seoSummary');

// API cho routine Claude chạy trên cloud mỗi sáng thứ Hai (mount /api/seo-report): đọc số liệu SEO rồi gửi bài
// phân tích Markdown lên — bài hiện ở tab "SEO Performance" của /administrator.
// Xác thực bằng token riêng SEO_REPORT_TOKEN (header "Authorization: Bearer <token>"), KHÔNG dùng token admin
// (hết hạn 12 giờ) — token này chỉ đọc được số liệu Search Console + ghi bài phân tích, không chạm dữ liệu khác.
// Không đặt biến môi trường = tắt hẳn 2 route này (503).

const router = express.Router();
const MAX_CONTENT = 60_000;

function requireReportToken(req, res, next) {
  const expected = process.env.SEO_REPORT_TOKEN;
  if (!expected || expected.length < 24) return res.status(503).json({ error: 'Chưa cấu hình SEO_REPORT_TOKEN' });
  const got = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(got).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  if (!got || !crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Sai token' });
  next();
}
router.use(requireReportToken);

// Số liệu kỳ này + kỳ trước (mặc định 7 ngày) và bài phân tích gần nhất (để viết tiếp mạch theo dõi)
router.get('/data', async (req, res) => {
  const days = [7, 28, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  try {
    await ensureFresh();
    const [summary, lastReport] = await Promise.all([
      buildSeoSummary(days),
      prisma.seoReport.findFirst({ orderBy: { createdAt: 'desc' }, select: { periodStart: true, periodEnd: true, content: true, createdAt: true } }),
    ]);
    res.json({ site: process.env.GSC_SITE_URL || null, summary, lastReport });
  } catch (err) {
    console.error('[seo-report]', err);
    res.status(500).json({ error: 'Không tải được số liệu' });
  }
});

router.post('/reports', async (req, res) => {
  const { periodStart, periodEnd, content } = req.body || {};
  const isDay = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (!isDay(periodStart) || !isDay(periodEnd)) return res.status(400).json({ error: 'periodStart/periodEnd dạng YYYY-MM-DD' });
  if (typeof content !== 'string' || content.trim().length < 200) return res.status(400).json({ error: 'Nội dung quá ngắn' });
  if (content.length > MAX_CONTENT) return res.status(400).json({ error: `Nội dung tối đa ${MAX_CONTENT} ký tự` });
  try {
    const start = new Date(`${periodStart}T00:00:00Z`);
    const end = new Date(`${periodEnd}T00:00:00Z`);
    const data = { periodStart: start, periodEnd: end, content: content.trim(), author: 'Claude' };
    // Cùng 1 kỳ mà routine chạy lại (chạy thử, lỗi mạng rồi gửi lại...) thì ghi đè bài cũ, không tạo thêm dòng trùng trong danh sách
    const existing = await prisma.seoReport.findFirst({ where: { periodStart: start, periodEnd: end }, select: { id: true } });
    const report = existing
      ? await prisma.seoReport.update({ where: { id: existing.id }, data: { ...data, createdAt: new Date() }, select: { id: true, createdAt: true } })
      : await prisma.seoReport.create({ data, select: { id: true, createdAt: true } });
    res.status(existing ? 200 : 201).json({ report });
  } catch (err) {
    console.error('[seo-report]', err);
    res.status(500).json({ error: 'Không lưu được bài phân tích' });
  }
});

module.exports = router;
