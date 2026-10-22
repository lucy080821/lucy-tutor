const youtube = require('./youtube');
const facebook = require('./facebook');

// Điều phối đồng bộ mạng xã hội (tab "Mạng xã hội" ở /administrator): mỗi 20 phút làm mới lượt xem + số follow gần nhất,
// mỗi ngày 06:00 giờ VN làm mới đầy đủ (kể cả insights của các mục Facebook cũ hơn 14 ngày).
// Nền tảng chưa cấu hình biến môi trường thì bỏ qua. Lần đồng bộ lỗi chỉ ghi vào trạng thái, không làm sập server.

const PLATFORMS = {
  YOUTUBE: { run: () => youtube.sync(), configured: youtube.isConfigured },
  FACEBOOK: { run: (opts) => facebook.sync(opts), configured: facebook.isConfigured },
};
const QUICK_MS = 20 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const FULL_HOUR_VN = 6;

const status = Object.fromEntries(Object.keys(PLATFORMS).map((p) => [p, { at: null, error: null, items: 0, notes: [] }]));
const running = {};

async function syncPlatform(platform, { full = true } = {}) {
  const p = PLATFORMS[platform];
  if (!p) throw new Error('Nền tảng không hợp lệ');
  if (running[platform]) return running[platform];
  running[platform] = (async () => {
    if (!p.configured()) throw new Error('Chưa cấu hình biến môi trường cho nền tảng này');
    const r = await p.run({ full });
    status[platform] = { at: new Date().toISOString(), error: null, items: r.items, notes: r.notes || [] };
    console.log(`[social] ${platform}: ${r.items} mục, ${r.days} ngày`);
    return status[platform];
  })()
    .catch((err) => {
      const dbError = /^Prisma/.test(err.name || '') || /database server/i.test(err.message);
      status[platform] = { ...status[platform], error: dbError ? 'Không kết nối được database, sẽ thử lại ở lần đồng bộ sau' : String(err.message).slice(0, 300) };
      console.error(`[social] ${platform} thất bại:`, err.message);
      throw err;
    })
    .finally(() => { running[platform] = null; });
  return running[platform];
}

const getStatus = () => Object.fromEntries(Object.entries(PLATFORMS).map(([k, p]) => [k, { configured: p.configured(), syncing: !!running[k], ...status[k] }]));

async function syncAll(opts) {
  await Promise.all(Object.entries(PLATFORMS).filter(([, p]) => p.configured()).map(([k]) => syncPlatform(k, opts).catch(() => {})));
}

function msUntilNextFull() {
  const now = Date.now();
  const vn = new Date(now + 7 * 3600 * 1000);
  const target = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), FULL_HOUR_VN, 0) - 7 * 3600 * 1000;
  return target > now ? target - now : target + DAY_MS - now;
}

function startSocialSync() {
  if (!Object.values(PLATFORMS).some((p) => p.configured())) {
    console.log('[social] Chưa cấu hình YouTube/Facebook — bỏ qua đồng bộ mạng xã hội');
    return;
  }
  setTimeout(() => syncAll({ full: true }), 45_000).unref?.();
  setInterval(() => syncAll({ full: false }), QUICK_MS).unref?.();
  const scheduleFull = () => {
    const t = setTimeout(async () => { await syncAll({ full: true }); scheduleFull(); }, msUntilNextFull());
    t.unref?.();
  };
  scheduleFull();
}

module.exports = { syncPlatform, getStatus, startSocialSync };
