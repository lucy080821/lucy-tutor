// Toàn bộ "số liệu game" của Nông Trại Qilin ở 1 chỗ: giá cả, cấp độ, cây, đơn hàng, vòng quay.
// Frontend KHÔNG tự tính giá/thưởng — luôn lấy từ GET /api/farm/state (field `catalog`) để
// server là nguồn sự thật duy nhất (chống sửa client để nhận thưởng).

// ── Cây trồng (hình ảnh theo chủ đề hạt giống) ────────────────────────────────
const CROPS = {
  sunflower:  { name: 'Hoa hướng dương', emoji: '🌻' },
  wheat:      { name: 'Lúa mì',          emoji: '🌾' },
  tomato:     { name: 'Cà chua',         emoji: '🍅' },
  corn:       { name: 'Ngô',             emoji: '🌽' },
  carrot:     { name: 'Cà rốt',          emoji: '🥕' },
  strawberry: { name: 'Dâu tây',         emoji: '🍓' },
  pumpkin:    { name: 'Bí ngô',          emoji: '🎃' },
  grape:      { name: 'Nho',             emoji: '🍇' },
};
const TOPIC_CROP = {
  family: 'sunflower', school: 'wheat', food: 'tomato', travel: 'corn',
  work: 'carrot', health: 'strawberry', environment: 'pumpkin', tech: 'grape',
};
const CROP_KEYS = Object.keys(CROPS);
function cropForTopic(topicId) {
  return TOPIC_CROP[topicId] || CROP_KEYS[Math.floor(Math.random() * CROP_KEYS.length)];
}

// ── Thời gian lớn ─────────────────────────────────────────────────────────────
// Lần ôn đầu (repetitions === 0) chín sau 10 phút kể từ lúc trồng: nhớ lại lần đầu sau vài phút
// là khoảng cách hiệu quả, và cho học sinh có thứ để quay lại ngay trong phiên chơi.
// Các lần sau: chín đúng theo nextReviewDate của SM-2 (1 ngày → 6 ngày → ...).
const FIRST_GROW_MINUTES = 10;

// ── Cấp nông trại theo tổng lần thu hoạch đúng ────────────────────────────────
// Cấp n cần harvestCount >= 3n(n-1): 0, 6, 18, 36, 60, 90, 126, 168, 216, 270 ...
function levelFor(harvestCount) {
  let n = 1;
  while (harvestCount >= 3 * (n + 1) * n) n++;
  return Math.min(n, 30);
}
function harvestsForLevel(n) { return 3 * n * (n - 1); }

// ── Thửa đất & mở rộng ────────────────────────────────────────────────────────
const START_PLOTS = 6;
const MAX_PLOTS = 40;
function plotPrice(currentCount) {
  // ô thứ 7: 150, mỗi ô sau +80 (và tăng dần nhẹ)
  const n = Math.max(0, currentCount - START_PLOTS);
  return 150 + n * 80 + Math.floor(n * n * 6);
}
const EXPANSIONS = [
  { w: 8,  h: 6,  price: 0,    minLevel: 1 },
  { w: 10, h: 7,  price: 700,  minLevel: 3 },
  { w: 12, h: 8,  price: 2200, minLevel: 6 },
  { w: 14, h: 9,  price: 6000, minLevel: 10 },
];

// ── Cửa hàng trang trí (giải trí thuần) ───────────────────────────────────────
// currency: 'coins' | 'gems'. w/h: số ô chiếm. minLevel: cấp mở khoá.
const DECOR = {
  path:       { name: 'Lối đi đá',       emoji: '🟫', price: 15,  currency: 'coins', minLevel: 1 },
  flower:     { name: 'Khóm hoa',        emoji: '🌷', price: 30,  currency: 'coins', minLevel: 1 },
  fence:      { name: 'Hàng rào gỗ',     emoji: '🪵', price: 40,  currency: 'coins', minLevel: 1 },
  rock:       { name: 'Tảng đá',         emoji: '🪨', price: 25,  currency: 'coins', minLevel: 1 },
  bush:       { name: 'Bụi cây',         emoji: '🌿', price: 50,  currency: 'coins', minLevel: 1 },
  haystack:   { name: 'Đụn rơm',         emoji: '🧺', price: 60,  currency: 'coins', minLevel: 2 },
  signpost:   { name: 'Bảng chỉ đường',  emoji: '🪧', price: 60,  currency: 'coins', minLevel: 2 },
  tree:       { name: 'Cây xanh',        emoji: '🌳', price: 90,  currency: 'coins', minLevel: 2 },
  mailbox:    { name: 'Hộp thư',         emoji: '📮', price: 80,  currency: 'coins', minLevel: 2 },
  bench:      { name: 'Ghế gỗ',          emoji: '🪑', price: 100, currency: 'coins', minLevel: 3 },
  lamp:       { name: 'Đèn vườn',        emoji: '🏮', price: 120, currency: 'coins', minLevel: 3 },
  scarecrow:  { name: 'Bù nhìn',         emoji: '🎎', price: 140, currency: 'coins', minLevel: 3 },
  pine:       { name: 'Cây thông',       emoji: '🌲', price: 150, currency: 'coins', minLevel: 4 },
  well:       { name: 'Giếng nước',      emoji: '🪣', price: 220, currency: 'coins', minLevel: 4 },
  pond:       { name: 'Ao cá',           emoji: '🐟', price: 300, currency: 'coins', minLevel: 5 },
  cherry:     { name: 'Cây anh đào',     emoji: '🌸', price: 350, currency: 'coins', minLevel: 5 },
  beehive:    { name: 'Tổ ong',          emoji: '🍯', price: 400, currency: 'coins', minLevel: 6 },
  house:      { name: 'Nhà gỗ',          emoji: '🏠', price: 800, currency: 'coins', minLevel: 6 },
  windmill:   { name: 'Cối xay gió',     emoji: '🌬️', price: 1200, currency: 'coins', minLevel: 8 },
  tent:       { name: 'Lều cắm trại',    emoji: '⛺', price: 500, currency: 'coins', minLevel: 7 },
  fountain:   { name: 'Đài phun nước',   emoji: '⛲', price: 4,   currency: 'gems',  minLevel: 4 },
  rainbow:    { name: 'Cầu vồng',        emoji: '🌈', price: 6,   currency: 'gems',  minLevel: 5 },
  statue:     { name: 'Tượng Qilin vàng', emoji: '🐉', price: 12, currency: 'gems',  minLevel: 8 },
  castle:     { name: 'Lâu đài nhỏ',     emoji: '🏰', price: 20,  currency: 'gems',  minLevel: 12 },
};
const DECOR_SELL_RATE = 0.5;

// ── Thưởng thu hoạch ──────────────────────────────────────────────────────────
const HARVEST_COINS = { 5: 15, 4: 12, 3: 8, 1: 0 };
const HARVEST_XP = 3;             // cộng vào User.totalXP (bảng xếp hạng chung của app)
const MASTERED_BONUS = { coins: 40, gems: 1 }; // khi từ chuyển sang MASTERED
const BARN_BONUS = { coins: 20 };            // cất từ MASTERED vào kho, giải phóng ô đất
const WITHER_PENALTY_COINS = 0;

// ── Đơn hàng (khách ghé nông trại) ────────────────────────────────────────────
const CUSTOMERS = ['🐰 Thỏ Bông', '🐻 Gấu Mật', '🦊 Cáo Lém', '🐸 Ếch Xanh', '🐱 Mèo Mun', '🐶 Cún Vàng', '🦉 Cú Thông Thái', '🐢 Rùa Chậm', '🐼 Gấu Trúc', '🦄 Kỳ Lân'];
const ORDER_SLOTS = 3;
// Sinh đơn theo cấp: mức cần (need) và thưởng tăng theo cấp
function makeOrderTemplate(kind, level, ctx = {}) {
  const lv = Math.max(1, level);
  const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  switch (kind) {
    case 'HARVEST': {
      const need = Math.min(12, 2 + Math.floor(lv / 2) + Math.floor(Math.random() * 3));
      return { kind, customer, title: `Thu hoạch ${need} cây bất kỳ`, requirement: { need }, rewardCoins: need * 14, rewardGems: 0, rewardXp: need * 2 };
    }
    case 'HARVEST_CROP': {
      const cropKey = ctx.cropKey || CROP_KEYS[Math.floor(Math.random() * CROP_KEYS.length)];
      const need = Math.min(8, 1 + Math.floor(lv / 3) + Math.floor(Math.random() * 2));
      return { kind, customer, title: `Thu hoạch ${need} ${CROPS[cropKey].name.toLowerCase()} ${CROPS[cropKey].emoji}`, requirement: { need, cropKey }, rewardCoins: need * 22, rewardGems: 0, rewardXp: need * 3 };
    }
    case 'PLANT': {
      const need = Math.min(6, 1 + Math.floor(lv / 3) + Math.floor(Math.random() * 2));
      return { kind, customer, title: `Trồng ${need} từ mới`, requirement: { need }, rewardCoins: need * 18, rewardGems: 0, rewardXp: need * 2 };
    }
    case 'SENTENCE': {
      const words = ctx.words || [];
      const title = words.length > 1 ? `Viết 1 câu dùng cả "${words[0]}" và "${words[1]}"` : `Viết 1 câu dùng từ "${words[0]}"`;
      return { kind, customer, title, requirement: { words }, rewardCoins: 60 + 30 * words.length + lv * 5, rewardGems: words.length > 1 ? 1 : 0, rewardXp: 10 };
    }
    default:
      return makeOrderTemplate('HARVEST', level);
  }
}
const ORDER_TRASH_COST = 10; // xu để bỏ 1 đơn không thích

// ── Vòng quay may mắn (1 lần/ngày) ────────────────────────────────────────────
// weight = tỉ lệ; kind: coins | gems | boost | decor | nothing
const WHEEL = [
  { id: 0, label: '20 xu',        kind: 'coins', value: 20,  weight: 22 },
  { id: 1, label: '1 kim cương',  kind: 'gems',  value: 1,   weight: 12 },
  { id: 2, label: '50 xu',        kind: 'coins', value: 50,  weight: 16 },
  { id: 3, label: 'x2 xu 5 lần',  kind: 'boost', value: 5,   weight: 12 },
  { id: 4, label: 'Hụt rồi!',     kind: 'nothing', value: 0, weight: 10 },
  { id: 5, label: '100 xu',       kind: 'coins', value: 100, weight: 9 },
  { id: 6, label: 'Quà trang trí', kind: 'decor', value: 0,  weight: 12 },
  { id: 7, label: '3 kim cương',  kind: 'gems',  value: 3,   weight: 7 },
];
const WHEEL_DECOR_POOL = ['flower', 'bush', 'rock', 'fence', 'haystack', 'tree', 'lamp'];

// ── Thú cưng Qilin con ────────────────────────────────────────────────────────
const PET_FEED_REWARD = { coins: 10, petXp: 12 };
const PET_PAT_XP = 1;              // mỗi lần vuốt ve (giới hạn 30 lần/ngày tính xp)
const PET_LEVELS = [0, 40, 120, 260, 480, 800]; // petXp cần cho cấp 1..6
function petLevelFor(petXp) {
  let n = 1;
  for (let i = 1; i < PET_LEVELS.length; i++) if (petXp >= PET_LEVELS[i]) n = i + 1;
  return n;
}

// ── Thăm bạn ──────────────────────────────────────────────────────────────────
const VISIT_LIKE_REWARD = 5;      // xu cho chủ nông trại được thích
const VISIT_GIFT_REWARD = 15;     // xu người được tặng nhận
const VISIT_GIFT_COST = 5;        // xu người tặng bỏ ra
const VISIT_GIFTS_PER_DAY = 3;

// Ngày theo giờ Việt Nam "YYYY-MM-DD" — mọi giới hạn "1 lần/ngày" dùng chung hàm này
function vnDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Gói gửi về frontend (chỉ phần cần hiển thị giá/tên)
function publicCatalog() {
  return {
    crops: CROPS, decor: DECOR, expansions: EXPANSIONS, wheel: WHEEL.map(({ id, label, kind }) => ({ id, label, kind })),
    startPlots: START_PLOTS, maxPlots: MAX_PLOTS, firstGrowMinutes: FIRST_GROW_MINUTES,
    harvestCoins: HARVEST_COINS, harvestXp: HARVEST_XP, masteredBonus: MASTERED_BONUS, barnBonus: BARN_BONUS,
    orderTrashCost: ORDER_TRASH_COST, decorSellRate: DECOR_SELL_RATE,
    petLevels: PET_LEVELS, petFeedReward: PET_FEED_REWARD,
    visit: { likeReward: VISIT_LIKE_REWARD, giftReward: VISIT_GIFT_REWARD, giftCost: VISIT_GIFT_COST, giftsPerDay: VISIT_GIFTS_PER_DAY },
  };
}

module.exports = {
  CROPS, CROP_KEYS, TOPIC_CROP, cropForTopic, FIRST_GROW_MINUTES,
  levelFor, harvestsForLevel, START_PLOTS, MAX_PLOTS, plotPrice, EXPANSIONS,
  DECOR, DECOR_SELL_RATE, HARVEST_COINS, HARVEST_XP, MASTERED_BONUS, BARN_BONUS, WITHER_PENALTY_COINS,
  CUSTOMERS, ORDER_SLOTS, makeOrderTemplate, ORDER_TRASH_COST,
  WHEEL, WHEEL_DECOR_POOL, PET_FEED_REWARD, PET_PAT_XP, PET_LEVELS, petLevelFor,
  VISIT_LIKE_REWARD, VISIT_GIFT_REWARD, VISIT_GIFT_COST, VISIT_GIFTS_PER_DAY, vnDay, publicCatalog,
};
