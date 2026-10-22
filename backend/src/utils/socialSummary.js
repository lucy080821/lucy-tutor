const prisma = require('../lib/prisma');
const { getStatus } = require('./social');

// Báo cáo cho tab "Mạng xã hội": kỳ N ngày kết thúc ở ngày mới nhất có dữ liệu, so với N ngày liền trước.
// Tỷ lệ chuyển đổi = follow/subscribe mới ÷ lượt xem (hiện theo 1.000 lượt xem); tỷ lệ cả kỳ = tổng ÷ tổng, KHÔNG lấy trung bình các tỷ lệ.
// Follow/subscribe trễ 1–2 ngày so với lượt xem nên 2–3 ngày cuối của kỳ có thể còn thấp → UI ghi chú "tạm tính".

const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (d) => d.toISOString().slice(0, 10);
const per1000 = (gained, views) => (views > 0 ? (gained / views) * 1000 : null);

function sum(rows) {
  const t = rows.reduce((a, r) => ({
    views: a.views + r.views, watchMinutes: a.watchMinutes + r.watchMinutes, engagements: a.engagements + r.engagements,
    gained: a.gained + r.gained, lost: a.lost + r.lost,
  }), { views: 0, watchMinutes: 0, engagements: 0, gained: 0, lost: 0 });
  return { ...t, watchHours: t.watchMinutes / 60, net: t.gained - t.lost, per1000: per1000(t.gained, t.views) };
}

async function buildPlatform(platform, days, status) {
  const latest = await prisma.socialDaily.findFirst({ where: { platform }, orderBy: { date: 'desc' }, select: { date: true } });
  const items = await prisma.socialItem.findMany({ where: { platform }, orderBy: { publishedAt: 'desc' }, take: 150 });
  const base = { platform, configured: status.configured, sync: status, hasData: !!latest || items.length > 0 };
  if (!latest) return { ...base, items: [] };

  // Số liệu theo ngày của nền tảng trễ vài ngày; dòng "hôm nay" chỉ để giữ số người theo dõi (view = 0) → kỳ kết thúc ở ngày mới nhất thật sự có số
  const real = await prisma.socialDaily.findFirst({ where: { platform, OR: [{ views: { gt: 0 } }, { gained: { gt: 0 } }, { lost: { gt: 0 } }] }, orderBy: { date: 'desc' }, select: { date: true } });
  const end = real ? real.date : latest.date;
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  const prevStart = new Date(start.getTime() - days * DAY_MS);
  const rows = await prisma.socialDaily.findMany({ where: { platform, date: { gte: prevStart, lte: end } }, orderBy: { date: 'asc' } });
  const cur = rows.filter((r) => r.date >= start);
  const prev = rows.filter((r) => r.date < start);
  const withFollowers = [...rows].reverse().find((r) => r.followers !== null);

  return {
    ...base,
    followers: withFollowers ? withFollowers.followers : null,
    lifetimeViews: items.reduce((a, i) => a + i.views, 0), // tổng lượt xem mọi nội dung từ lúc đăng (khác với lượt xem trong kỳ)
    period: { start: ymd(start), end: ymd(end) },
    totals: { current: sum(cur), previous: sum(prev) },
    series: cur.map((r) => ({ date: ymd(r.date), views: r.views, gained: r.gained, lost: r.lost, net: r.gained - r.lost, per1000: per1000(r.gained, r.views) })),
    items: items.map((i) => ({
      id: i.id, kind: i.kind, title: i.title, url: i.url, thumbnail: i.thumbnail, publishedAt: i.publishedAt.toISOString(),
      views: i.views, reach: i.reach, likes: i.likes, comments: i.comments, shares: i.shares, watchMinutes: i.watchMinutes,
      followsGained: i.followsGained, followsLost: i.followsLost, convViews: i.convViews,
      per1000: i.followsGained !== null && i.convViews ? per1000(i.followsGained, i.convViews) : null,
      metricsAt: i.metricsAt.toISOString(),
    })),
  };
}

async function buildSocialSummary(days) {
  const status = getStatus();
  const [youtube, facebook] = await Promise.all(['YOUTUBE', 'FACEBOOK'].map((p) => buildPlatform(p, days, status[p])));
  return { days, youtube, facebook };
}

module.exports = { buildSocialSummary };
