const prisma = require('../lib/prisma');
const { getSyncStatus } = require('./searchConsole');

// Tổng hợp số liệu Search Console (bảng SeoMetric) cho N ngày gần nhất có dữ liệu, so với N ngày liền trước.
// Dùng chung cho tab "SEO Performance" (GET /api/admin/seo/summary) và routine phân tích tuần
// (GET /api/seo-report/data). Mốc cuối = ngày mới nhất có dữ liệu (Google trễ 2–3 ngày), không phải hôm nay,
// để 2 kỳ so sánh luôn đủ ngày. CTR = click / hiển thị; vị trí = trung bình có trọng số theo lượt hiển thị.

const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);
const num = (v) => Number(v || 0);

const LIST_LIMIT = { QUERY: 100, PAGE: 50, COUNTRY: 20, DEVICE: 5, APPEARANCE: 10, QUERY_PAGE: 100 };

function metrics(clicks, impressions, posWeighted) {
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? posWeighted / impressions : null,
  };
}

// Gộp 1 chiều trong cả 2 kỳ bằng 1 truy vấn (SUM có điều kiện theo kỳ)
async function aggregate(dimension, prevStart, curStart, end) {
  const rows = await prisma.$queryRaw`
    SELECT "key",
      SUM(CASE WHEN "date" >= ${curStart} THEN "clicks" ELSE 0 END) AS c,
      SUM(CASE WHEN "date" >= ${curStart} THEN "impressions" ELSE 0 END) AS i,
      SUM(CASE WHEN "date" >= ${curStart} THEN "position" * "impressions" ELSE 0 END) AS pw,
      SUM(CASE WHEN "date" < ${curStart} THEN "clicks" ELSE 0 END) AS pc,
      SUM(CASE WHEN "date" < ${curStart} THEN "impressions" ELSE 0 END) AS pi,
      SUM(CASE WHEN "date" < ${curStart} THEN "position" * "impressions" ELSE 0 END) AS ppw
    FROM "SeoMetric"
    WHERE "dimension" = ${dimension} AND "date" >= ${prevStart} AND "date" <= ${end}
    GROUP BY "key"`;
  return rows.map((r) => ({
    key: r.key,
    ...metrics(num(r.c), num(r.i), num(r.pw)),
    prev: metrics(num(r.pc), num(r.pi), num(r.ppw)),
  }));
}

// endDate (YYYY-MM-DD, tuỳ chọn): kết thúc kỳ sớm hơn — dùng để vẽ lại đúng kỳ của 1 bài phân tích cũ
async function buildSeoSummary(days, endDate) {
  const latest = await prisma.seoMetric.findFirst({ where: { dimension: 'TOTAL' }, orderBy: { date: 'desc' }, select: { date: true } });
  const sync = getSyncStatus();
  if (!latest) return { configured: sync.configured, sync, hasData: false, days };

  const wanted = endDate ? new Date(`${endDate}T00:00:00Z`) : null;
  const end = wanted && wanted < latest.date ? wanted : latest.date;
  const curStart = addDays(end, -(days - 1));
  const prevStart = addDays(curStart, -days);
  const prevEnd = addDays(curStart, -1);

  const [series, ...dims] = await Promise.all([
    prisma.seoMetric.findMany({
      where: { dimension: 'TOTAL', date: { gte: prevStart, lte: end } },
      orderBy: { date: 'asc' },
      select: { date: true, clicks: true, impressions: true, position: true },
    }),
    ...Object.keys(LIST_LIMIT).map((d) => aggregate(d, prevStart, curStart, end)),
  ]);
  const [queries, pages, countries, devices, appearances, queryPages] = dims;

  const sum = (rows) => metrics(
    rows.reduce((s, r) => s + r.clicks, 0),
    rows.reduce((s, r) => s + r.impressions, 0),
    rows.reduce((s, r) => s + r.position * r.impressions, 0),
  );
  const curSeries = series.filter((r) => r.date >= curStart);
  const prevSeries = series.filter((r) => r.date < curStart);

  const byImpressions = (a, b) => b.impressions - a.impressions || b.clicks - a.clicks;
  const top = (rows, dim) => rows.filter((r) => r.impressions > 0).sort(byImpressions).slice(0, LIST_LIMIT[dim]);

  // Cơ hội: đang ở trang 1–2 (vị trí 4–20), có người thấy nhưng CTR thấp — đẩy lên top 3 là có click
  const minImpr = Math.max(2, Math.round(days / 7));
  const opportunities = queries
    .filter((q) => q.position && q.position >= 4 && q.position <= 20 && q.impressions >= minImpr)
    .sort(byImpressions).slice(0, 20);
  // Truy vấn mới xuất hiện / biến mất so với kỳ trước
  const newQueries = queries.filter((q) => q.impressions > 0 && q.prev.impressions === 0).sort(byImpressions).slice(0, 20);
  const lostQueries = queries.filter((q) => q.impressions === 0 && q.prev.impressions > 0)
    .sort((a, b) => b.prev.impressions - a.prev.impressions).slice(0, 20)
    .map((q) => ({ key: q.key, prev: q.prev }));
  // Thay đổi vị trí lớn nhất (cả 2 kỳ đều có ≥ minImpr lượt hiển thị)
  const movers = queries
    .filter((q) => q.position && q.prev.position && q.impressions >= minImpr && q.prev.impressions >= minImpr)
    .map((q) => ({ ...q, positionChange: q.prev.position - q.position })) // dương = tốt lên
    .sort((a, b) => Math.abs(b.positionChange) - Math.abs(a.positionChange)).slice(0, 20);

  return {
    configured: sync.configured,
    sync,
    hasData: true,
    days,
    period: { start: ymd(curStart), end: ymd(end) },
    previousPeriod: { start: ymd(prevStart), end: ymd(prevEnd) },
    totals: { current: sum(curSeries), previous: sum(prevSeries) },
    series: curSeries.map((r) => ({ date: ymd(r.date), ...metrics(r.clicks, r.impressions, r.position * r.impressions) })),
    previousSeries: prevSeries.map((r) => ({ date: ymd(r.date), ...metrics(r.clicks, r.impressions, r.position * r.impressions) })),
    // Tổng lượt hiển thị của các truy vấn Google cho xem; phần còn lại là truy vấn ẩn danh (quá hiếm)
    namedQueryImpressions: queries.reduce((s, q) => s + q.impressions, 0),
    queries: top(queries, 'QUERY'),
    pages: top(pages, 'PAGE'),
    countries: top(countries, 'COUNTRY'),
    devices: top(devices, 'DEVICE'),
    appearances: top(appearances, 'APPEARANCE'),
    queryPages: top(queryPages, 'QUERY_PAGE').map((r) => {
      const [query, page] = r.key.split('\t');
      return { ...r, query, page };
    }),
    opportunities,
    newQueries,
    lostQueries,
    movers,
  };
}

module.exports = { buildSeoSummary };
