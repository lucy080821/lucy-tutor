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

// ── Nông sản (thu hoạch đúng → +1 nông sản của cây đó vào kho; quality 5 → +2) ───
// price = giá bán 1 nông sản ở kho; đơn hàng nông sản thưởng cao hơn bán lẻ
const PRODUCE_PRICE = { wheat: 4, carrot: 5, tomato: 6, corn: 6, sunflower: 7, strawberry: 8, pumpkin: 9, grape: 10 };
const PRODUCE_PER_HARVEST = { 5: 2, 4: 1, 3: 1 };
// Sức chứa kho theo bậc (Hay Day: nâng cấp kho) — bậc 1 miễn phí
const BARN_TIERS = [
  { capacity: 30,  price: 0 },
  { capacity: 60,  price: 300 },
  { capacity: 100, price: 800 },
  { capacity: 150, price: 1800 },
  { capacity: 220, price: 3500 },
  { capacity: 300, price: 6000 },
  { capacity: 400, price: 9000 },
];
const BARN_FULL_SELL_RATE = 0.5; // kho đầy → nông sản dư bán tự động nửa giá
// Ôn kho từ: trả lời từ đã thuộc (MASTERED), thưởng xu, tối đa N lượt thưởng/ngày
const BARN_QUIZ = { size: 5, coinsPerCorrect: 6, dailyRewarded: 15 };

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
  fence:      { name: 'Hàng rào gỗ',     emoji: '🚧', price: 40,  currency: 'coins', minLevel: 1 },
  rock:       { name: 'Tảng đá',         emoji: '🪨', price: 25,  currency: 'coins', minLevel: 1 },
  bush:       { name: 'Bụi cây',         emoji: '🌿', price: 50,  currency: 'coins', minLevel: 1 },
  haystack:   { name: 'Đụn rơm',         emoji: '🌾', price: 60,  currency: 'coins', minLevel: 2 },
  signpost:   { name: 'Bảng chỉ đường',  emoji: '🪧', price: 60,  currency: 'coins', minLevel: 2 },
  tree:       { name: 'Cây xanh',        emoji: '🌳', price: 90,  currency: 'coins', minLevel: 2 },
  mailbox:    { name: 'Hộp thư',         emoji: '📮', price: 80,  currency: 'coins', minLevel: 2 },
  bench:      { name: 'Ghế gỗ',          emoji: '🪑', price: 100, currency: 'coins', minLevel: 3 },
  lamp:       { name: 'Đèn vườn',        emoji: '🏮', price: 120, currency: 'coins', minLevel: 3 },
  scarecrow:  { name: 'Bù nhìn',         emoji: '🧑‍🌾', price: 140, currency: 'coins', minLevel: 3 },
  pine:       { name: 'Cây thông',       emoji: '🌲', price: 150, currency: 'coins', minLevel: 4 },
  well:       { name: 'Giếng nước',      emoji: '🪣', price: 220, currency: 'coins', minLevel: 4 },
  pond:       { name: 'Ao cá',           emoji: '🏞️', price: 300, currency: 'coins', minLevel: 5 },
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
// Bán lại đồ đã mua: CỐ Ý RẤT LỖ để không ai mua rồi bán qua lại kiếm lời (chỉ lấy lại 25% giá xu).
// Đồ mua bằng kim cương hoàn lại bằng XU (kim cương là tiền hiếm, không đổi ngược được): mỗi kim cương = GEM_SELL_COINS xu.
const DECOR_SELL_RATE = 0.25;
const GEM_SELL_COINS = 5;
function sellValue(item) {
  if (!item) return 0;
  return item.currency === 'gems' ? Math.max(1, Math.floor(item.price * GEM_SELL_COINS)) : Math.max(1, Math.floor(item.price * DECOR_SELL_RATE));
}
// Nhóm hiển thị trong cửa hàng (frontend lọc theo `cat`)
const DECOR_EXTRA = {
  // Vật nuôi trang trí (giải trí thuần, không cần cho ăn)
  chicken:   { name: 'Gà mái',          emoji: '🐔', price: 120,  currency: 'coins', minLevel: 2, cat: 'animal' },
  duck:      { name: 'Vịt bầu',         emoji: '🦆', price: 150,  currency: 'coins', minLevel: 2, cat: 'animal' },
  rabbit:    { name: 'Thỏ con',         emoji: '🐇', price: 180,  currency: 'coins', minLevel: 3, cat: 'animal' },
  pig:       { name: 'Heo hồng',        emoji: '🐖', price: 280,  currency: 'coins', minLevel: 3, cat: 'animal' },
  sheep:     { name: 'Cừu bông',        emoji: '🐑', price: 300,  currency: 'coins', minLevel: 4, cat: 'animal' },
  cow:       { name: 'Bò sữa',          emoji: '🐄', price: 350,  currency: 'coins', minLevel: 4, cat: 'animal' },
  horse:     { name: 'Ngựa nâu',        emoji: '🐎', price: 600,  currency: 'coins', minLevel: 6, cat: 'animal' },
  cat:       { name: 'Mèo lười',        emoji: '🐈', price: 2,    currency: 'gems',  minLevel: 3, cat: 'animal' },
  dog:       { name: 'Cún giữ nhà',     emoji: '🐕', price: 2,    currency: 'gems',  minLevel: 3, cat: 'animal' },
  peacock:   { name: 'Công xoè đuôi',   emoji: '🦚', price: 8,    currency: 'gems',  minLevel: 7, cat: 'animal' },
  // Cây cảnh & hoa
  rose:      { name: 'Hoa hồng',        emoji: '🌹', price: 40,   currency: 'coins', minLevel: 1, cat: 'plant' },
  hibiscus:  { name: 'Hoa dâm bụt',     emoji: '🌺', price: 45,   currency: 'coins', minLevel: 1, cat: 'plant' },
  daisy:     { name: 'Cúc hoạ mi',      emoji: '🌼', price: 35,   currency: 'coins', minLevel: 1, cat: 'plant' },
  mushroom:  { name: 'Nấm đỏ',          emoji: '🍄', price: 55,   currency: 'coins', minLevel: 2, cat: 'plant' },
  cactus:    { name: 'Xương rồng',      emoji: '🌵', price: 70,   currency: 'coins', minLevel: 2, cat: 'plant' },
  bamboo:    { name: 'Khóm tre',        emoji: '🎋', price: 110,  currency: 'coins', minLevel: 3, cat: 'plant' },
  palm:      { name: 'Cây dừa',         emoji: '🌴', price: 160,  currency: 'coins', minLevel: 4, cat: 'plant' },
  potted:    { name: 'Chậu cây',        emoji: '🪴', price: 60,   currency: 'coins', minLevel: 1, cat: 'plant' },
  bonsai:    { name: 'Bonsai',          emoji: '🪾', price: 3,    currency: 'gems',  minLevel: 5, cat: 'plant' },
  // Công trình & xe
  hut:       { name: 'Lều tranh',       emoji: '🛖', price: 400,  currency: 'coins', minLevel: 4, cat: 'building' },
  barnhouse: { name: 'Chuồng trại',     emoji: '🏚️', price: 650,  currency: 'coins', minLevel: 5, cat: 'building' },
  tractor:   { name: 'Máy cày',         emoji: '🚜', price: 900,  currency: 'coins', minLevel: 6, cat: 'building' },
  bridge:    { name: 'Cầu gỗ',          emoji: '🌉', price: 700,  currency: 'coins', minLevel: 6, cat: 'building' },
  boat:      { name: 'Thuyền nhỏ',      emoji: '🛶', price: 250,  currency: 'coins', minLevel: 4, cat: 'building' },
  torii:     { name: 'Cổng đỏ',         emoji: '⛩️', price: 3,    currency: 'gems',  minLevel: 5, cat: 'building' },
  pagoda:    { name: 'Chùa nhỏ',        emoji: '🏯', price: 9,    currency: 'gems',  minLevel: 9, cat: 'building' },
  wall:      { name: 'Tường gạch',      emoji: '🧱', price: 20,   currency: 'coins', minLevel: 1, cat: 'building' },
  // Khu vui chơi & sự kiện
  slide:     { name: 'Cầu trượt',       emoji: '🛝', price: 350,  currency: 'coins', minLevel: 4, cat: 'fun' },
  circus:    { name: 'Lều xiếc',        emoji: '🎪', price: 800,  currency: 'coins', minLevel: 7, cat: 'fun' },
  carousel:  { name: 'Đu quay ngựa',    emoji: '🎠', price: 10,   currency: 'gems',  minLevel: 8, cat: 'fun' },
  ferris:    { name: 'Vòng quay khổng lồ', emoji: '🎡', price: 15, currency: 'gems', minLevel: 10, cat: 'fun' },
  xmas:      { name: 'Cây thông Noel',  emoji: '🎄', price: 500,  currency: 'coins', minLevel: 3, cat: 'fun' },
  fireworks: { name: 'Pháo hoa',        emoji: '🎆', price: 5,    currency: 'gems',  minLevel: 6, cat: 'fun' },
  moai:      { name: 'Tượng đá Moai',   emoji: '🗿', price: 4,    currency: 'gems',  minLevel: 5, cat: 'fun' },
  snowman:   { name: 'Người tuyết',     emoji: '⛄', price: 220,  currency: 'coins', minLevel: 3, cat: 'fun' },
  balloon:   { name: 'Chùm bóng bay',   emoji: '🎈', price: 90,   currency: 'coins', minLevel: 2, cat: 'fun' },
};
for (const [k, v] of Object.entries(DECOR_EXTRA)) DECOR[k] = v;
// Gán nhóm cho món cũ
const DECOR_CAT_OLD = { path: 'build', fence: 'build', rock: 'build', wall: 'build', bench: 'build', lamp: 'build', signpost: 'build', mailbox: 'build', well: 'build', haystack: 'build', scarecrow: 'build',
  flower: 'plant', bush: 'plant', tree: 'plant', pine: 'plant', cherry: 'plant', pond: 'building', beehive: 'building', house: 'building', windmill: 'building', tent: 'building', fountain: 'fun', rainbow: 'fun', statue: 'fun', castle: 'building' };
for (const [k, c] of Object.entries(DECOR_CAT_OLD)) if (DECOR[k] && !DECOR[k].cat) DECOR[k].cat = c;
const DECOR_CATS = [
  { id: 'all', name: 'Tất cả' }, { id: 'plant', name: 'Cây & hoa' }, { id: 'animal', name: 'Vật nuôi' },
  { id: 'build', name: 'Đường & rào' }, { id: 'building', name: 'Công trình' }, { id: 'fun', name: 'Vui chơi' },
];

// ── Trang phục Qilin (đeo lên ảnh linh vật theo slot; emoji, không vẽ tay) ──────
// slot: hat (đầu) | face (mắt) | neck (cổ) | back (lưng) | hand (tay)
const OUTFITS = {
  hat_straw:   { name: 'Nón rơm',         emoji: '👒', slot: 'hat',  price: 80,  currency: 'coins', minLevel: 1 },
  hat_cap:     { name: 'Mũ lưỡi trai',    emoji: '🧢', slot: 'hat',  price: 90,  currency: 'coins', minLevel: 1 },
  hat_top:     { name: 'Mũ quý ông',      emoji: '🎩', slot: 'hat',  price: 180, currency: 'coins', minLevel: 3 },
  hat_party:   { name: 'Nón sinh nhật',   emoji: '🥳', slot: 'hat',  price: 150, currency: 'coins', minLevel: 2 },
  hat_crown:   { name: 'Vương miện',      emoji: '👑', slot: 'hat',  price: 6,   currency: 'gems',  minLevel: 5 },
  hat_helmet:  { name: 'Mũ phi hành gia', emoji: '🪖', slot: 'hat',  price: 350, currency: 'coins', minLevel: 6 },
  face_sun:    { name: 'Kính râm',        emoji: '🕶️', slot: 'face', price: 120, currency: 'coins', minLevel: 2 },
  face_nerd:   { name: 'Kính học bá',     emoji: '👓', slot: 'face', price: 100, currency: 'coins', minLevel: 1 },
  face_mask:   { name: 'Mặt nạ hoá trang', emoji: '🎭', slot: 'face', price: 3,  currency: 'gems',  minLevel: 4 },
  neck_scarf:  { name: 'Khăn len',        emoji: '🧣', slot: 'neck', price: 100, currency: 'coins', minLevel: 1 },
  neck_bow:    { name: 'Nơ hồng',         emoji: '🎀', slot: 'neck', price: 90,  currency: 'coins', minLevel: 1 },
  neck_flower: { name: 'Vòng hoa',        emoji: '🌸', slot: 'neck', price: 70,  currency: 'coins', minLevel: 1 },
  neck_medal:  { name: 'Huy chương vàng', emoji: '🏅', slot: 'neck', price: 4,   currency: 'gems',  minLevel: 4 },
  neck_tie:    { name: 'Cà vạt',          emoji: '👔', slot: 'neck', price: 140, currency: 'coins', minLevel: 3 },
  back_wings:  { name: 'Đôi cánh',        emoji: '🪽', slot: 'back', price: 7,   currency: 'gems',  minLevel: 5 },
  back_balloon:{ name: 'Bóng bay',        emoji: '🎈', slot: 'back', price: 150, currency: 'coins', minLevel: 2 },
  back_pack:   { name: 'Ba lô đi học',    emoji: '🎒', slot: 'back', price: 160, currency: 'coins', minLevel: 2 },
  back_cape:   { name: 'Áo choàng siêu nhân', emoji: '🦸', slot: 'back', price: 5, currency: 'gems', minLevel: 6 },
  hand_flag:   { name: 'Cờ Việt Nam',     emoji: '🇻🇳', slot: 'hand', price: 60,  currency: 'coins', minLevel: 1 },
  hand_umbrella:{ name: 'Ô che mưa',      emoji: '☂️', slot: 'hand', price: 130, currency: 'coins', minLevel: 2 },
  hand_guitar: { name: 'Đàn guitar',      emoji: '🎸', slot: 'hand', price: 400, currency: 'coins', minLevel: 5 },
  hand_wand:   { name: 'Đũa phép',        emoji: '🪄', slot: 'hand', price: 5,   currency: 'gems',  minLevel: 4 },
  hand_book:   { name: 'Từ điển',         emoji: '📘', slot: 'hand', price: 120, currency: 'coins', minLevel: 1 },
  hand_icecream:{ name: 'Kem ốc quế',     emoji: '🍦', slot: 'hand', price: 80,  currency: 'coins', minLevel: 1 },
};
const OUTFIT_SLOTS = [
  { id: 'hat', name: 'Đầu' }, { id: 'face', name: 'Mắt' }, { id: 'neck', name: 'Cổ' }, { id: 'back', name: 'Lưng' }, { id: 'hand', name: 'Tay' },
];

// ── Thưởng thu hoạch ──────────────────────────────────────────────────────────
const HARVEST_COINS = { 5: 15, 4: 12, 3: 8, 1: 0 };
const HARVEST_XP = 3;             // cộng vào User.totalXP (bảng xếp hạng chung của app)
const MASTERED_BONUS = { coins: 40, gems: 1 }; // khi từ chuyển sang MASTERED
const BARN_BONUS = { coins: 20 };            // cất từ MASTERED vào kho, giải phóng ô đất
const WITHER_PENALTY_COINS = 0;

// ── Đơn hàng (khách ghé nông trại) ────────────────────────────────────────────
const CUSTOMERS = ['🐰 Thỏ Bông', '🐻 Gấu Mật', '🦊 Cáo Lém', '🐸 Ếch Xanh', '🐱 Mèo Mun', '🐶 Cún Vàng', '🦉 Cú Thông Thái', '🐢 Rùa Chậm', '🐼 Gấu Trúc', '🦄 Kỳ Lân'];
const ORDER_SLOTS = 3;
// Độ khó đơn = cấp nông trại + số đơn đã giao (cứ 4 đơn tăng 1 bậc) — mỗi lúc một khó hơn
function orderDifficulty(level, ordersDone) { return Math.max(1, level) + Math.floor((ordersDone || 0) / 4); }
// Sinh đơn theo độ khó: mức cần (need) và thưởng tăng theo độ khó
function makeOrderTemplate(kind, difficulty, ctx = {}) {
  const lv = Math.max(1, difficulty);
  const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  switch (kind) {
    case 'HARVEST': {
      const need = Math.min(20, 2 + Math.floor(lv / 2) + Math.floor(Math.random() * 3));
      return { kind, customer, title: `Thu hoạch ${need} cây bất kỳ`, requirement: { need }, rewardCoins: need * (14 + lv), rewardGems: lv >= 8 ? 1 : 0, rewardXp: need * 2 };
    }
    case 'HARVEST_CROP': {
      const cropKey = ctx.cropKey || CROP_KEYS[Math.floor(Math.random() * CROP_KEYS.length)];
      const need = Math.min(12, 1 + Math.floor(lv / 3) + Math.floor(Math.random() * 2));
      return { kind, customer, title: `Thu hoạch ${need} ${CROPS[cropKey].name.toLowerCase()} ${CROPS[cropKey].emoji}`, requirement: { need, cropKey }, rewardCoins: need * (22 + lv), rewardGems: lv >= 6 ? 1 : 0, rewardXp: need * 3 };
    }
    case 'PLANT': {
      const need = Math.min(8, 1 + Math.floor(lv / 3) + Math.floor(Math.random() * 2));
      return { kind, customer, title: `Trồng ${need} từ mới`, requirement: { need }, rewardCoins: need * (18 + lv), rewardGems: 0, rewardXp: need * 2 };
    }
    case 'PRODUCE': {
      // Giao nông sản từ kho: số loại tăng theo độ khó (1 → 3), mỗi loại 2..(3+lv/2)
      const kinds = Math.min(3, 1 + Math.floor(lv / 4));
      const keys = [...(ctx.cropKeys && ctx.cropKeys.length ? ctx.cropKeys : CROP_KEYS)].sort(() => Math.random() - 0.5).slice(0, kinds);
      const items = {}; let value = 0;
      for (const k of keys) { const n = Math.min(15, 2 + Math.floor(Math.random() * (2 + Math.floor(lv / 2)))); items[k] = n; value += n * PRODUCE_PRICE[k]; }
      const title = `Giao ${Object.entries(items).map(([k, n]) => `${n} ${CROPS[k].name.toLowerCase()} ${CROPS[k].emoji}`).join(', ')}`;
      // Thưởng ≈ 1,8–2,2× giá bán lẻ để giao đơn luôn lời hơn bán ở kho
      return { kind, customer, title, requirement: { items }, rewardCoins: Math.round(value * (1.8 + Math.min(0.4, lv * 0.03))), rewardGems: kinds >= 2 && Math.random() < 0.35 ? 1 : 0, rewardXp: 6 + kinds * 3 };
    }
    case 'SENTENCE': {
      const words = ctx.words || [];
      const title = words.length > 1 ? `Viết 1 câu dùng cả "${words[0]}" và "${words[1]}"` : `Viết 1 câu dùng từ "${words[0]}"`;
      return { kind, customer, title, requirement: { words, minWords: Math.min(12, 4 + Math.floor(lv / 2)) }, rewardCoins: 60 + 30 * words.length + lv * 8, rewardGems: words.length > 1 ? 1 : 0, rewardXp: 10 + lv };
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

// ── Nhiệm vụ hằng ngày + Thành tựu ────────────────────────────────────────────
// Nhiệm vụ: 4 việc/ngày, luôn làm được (thu hoạch, trồng, 1 trong [giao đơn | bán nông sản], 1 trong [cho ăn | quay vòng]),
// mục tiêu theo cấp CHỐT lúc đầu ngày (daily.level) để không đổi giữa chừng. Làm đủ 4 → mở rương thưởng.
// Tiến độ = giá trị bộ đếm hiện tại − mốc chụp đầu ngày (daily.base), nên không cần ghi từng sự kiện theo ngày.
const dayNumber = (day) => parseInt(String(day).replace(/-/g, ''), 10) || 0;
function dailyQuestDefs(day, level) {
  const n = dayNumber(day); const lv = Math.max(1, level);
  const r = (coins, gems = 0, xp = 5) => ({ coins: Math.round(coins), gems, xp });
  const t1 = Math.min(12, 3 + Math.floor(lv / 2));
  const t2 = Math.min(6, 2 + Math.floor(lv / 5));
  const defs = [
    { id: 'harvest', stat: 'harvests', icon: 'sprout', label: `Thu hoạch ${t1} cây`, target: t1, reward: r(30 + lv * 5, 0, 6) },
    { id: 'plant', stat: 'plants', icon: 'seed', label: `Trồng ${t2} từ mới`, target: t2, reward: r(24 + lv * 4, 0, 5) },
  ];
  if (n % 2 === 0) { const t = Math.min(4, 1 + Math.floor(lv / 6)); defs.push({ id: 'orders', stat: 'orders', icon: 'truck', label: `Giao ${t} đơn hàng`, target: t, reward: r(50 + lv * 6, lv >= 5 ? 1 : 0, 8) }); }
  else { const t = Math.min(30, 6 + lv * 2); defs.push({ id: 'sell', stat: 'sold', icon: 'coin', label: `Bán ${t} nông sản`, target: t, reward: r(36 + lv * 4, 0, 5) }); }
  if (Math.floor(n / 2) % 2 === 0) defs.push({ id: 'feed', stat: 'feeds', icon: 'paw', label: 'Cho Qilin ăn', target: 1, reward: r(20, 0, 3) });
  else defs.push({ id: 'spin', stat: 'spins', icon: 'wheel', label: 'Quay vòng may mắn', target: 1, reward: r(20, 0, 3) });
  return defs;
}
const questChest = (lv) => ({ coins: 80 + Math.max(1, lv) * 10, gems: 2, xp: 15 });
// Bộ đếm cần chụp mốc đầu ngày
const QUEST_STAT_KEYS = ['harvests', 'orders', 'plants', 'sold', 'feeds', 'spins'];
// Bộ đếm ghi bằng SQL nguyên tử (bumpStats trong farm.routes.js) — danh sách trắng
const TRACKED_STATS = ['plants', 'sold', 'feeds', 'spins', 'sentences', 'quizCorrect', 'likes', 'gifts', 'mastered'];

const safeJson = (v, fb) => { try { return typeof v === 'string' ? JSON.parse(v) : (v ?? fb); } catch { return fb; } };
// Giá trị hiện tại của 1 bộ đếm (nguồn có sẵn trong FarmState/User hoặc bộ đếm stats)
function statValue(stat, { farm, user }) {
  const st = (farm.stats && typeof farm.stats === 'object') ? farm.stats : {};
  switch (stat) {
    case 'harvests': return farm.harvestCount;
    case 'orders': return farm.ordersDone;
    case 'level': return levelFor(farm.harvestCount);
    case 'petLevel': return petLevelFor(farm.petXp);
    case 'decor': return safeJson(farm.layout, []).length;
    case 'outfits': return (safeJson(farm.wardrobe, {}).owned || []).length;
    case 'barnTier': return Math.max(1, BARN_TIERS.findIndex((t) => t.capacity === farm.barnCapacity) + 1);
    case 'streak': return (user && user.streakCount) || 0;
    case 'friends': return (st.likes || 0) + (st.gifts || 0);
    default: return st[stat] || 0;
  }
}
// tiers: [mục tiêu, xu, kim cương]
const ACHIEVEMENTS = [
  { id: 'harvest', icon: 'sprout', name: 'Nông dân chăm chỉ', desc: 'Thu hoạch đúng nhiều cây', stat: 'harvests', tiers: [[10, 50, 0], [50, 150, 1], [200, 400, 2], [600, 1000, 4], [1500, 2500, 8]] },
  { id: 'plant', icon: 'seed', name: 'Người gieo hạt', desc: 'Trồng nhiều từ mới', stat: 'plants', tiers: [[5, 40, 0], [25, 120, 1], [100, 350, 2], [400, 1000, 5]] },
  { id: 'mastered', icon: 'star', name: 'Bộ nhớ thép', desc: 'Đưa từ lên mức thuộc lòng', stat: 'mastered', tiers: [[3, 80, 1], [10, 200, 2], [30, 600, 4], [80, 1500, 8], [200, 4000, 15]] },
  { id: 'quiz', icon: 'brain', name: 'Siêu sao ôn kho', desc: 'Trả lời đúng ở mục Ôn kho từ', stat: 'quizCorrect', tiers: [[10, 60, 0], [50, 200, 1], [200, 600, 3], [600, 1500, 6]] },
  { id: 'orders', icon: 'truck', name: 'Thương nhân', desc: 'Giao đơn hàng cho khách', stat: 'orders', tiers: [[5, 60, 0], [25, 200, 1], [100, 700, 3], [300, 2000, 8]] },
  { id: 'sentences', icon: 'pen', name: 'Nhà văn nhí', desc: 'Viết câu tiếng Anh được khách khen', stat: 'sentences', tiers: [[3, 80, 1], [15, 250, 2], [50, 800, 4], [150, 2500, 10]] },
  { id: 'level', icon: 'medal', name: 'Cấp nông trại', desc: 'Nâng cấp nông trại', stat: 'level', tiers: [[3, 80, 0], [5, 200, 1], [10, 600, 3], [15, 1200, 6], [20, 2500, 12]] },
  { id: 'decor', icon: 'palette', name: 'Kiến trúc sư vườn', desc: 'Đặt vật trang trí lên đất', stat: 'decor', tiers: [[5, 50, 0], [15, 150, 1], [30, 400, 2], [60, 1000, 5]] },
  { id: 'outfits', icon: 'shirt', name: 'Tín đồ thời trang', desc: 'Sưu tập trang phục cho Qilin', stat: 'outfits', tiers: [[3, 60, 0], [8, 200, 1], [15, 600, 3], [24, 1500, 8]] },
  { id: 'pet', icon: 'paw', name: 'Bạn thân của Qilin', desc: 'Nuôi Qilin lên cấp', stat: 'petLevel', tiers: [[2, 40, 0], [4, 150, 1], [6, 500, 4]] },
  { id: 'friends', icon: 'users', name: 'Người thân thiện', desc: 'Thích và tặng quà nông trại bạn bè', stat: 'friends', tiers: [[5, 40, 0], [25, 150, 1], [100, 500, 3]] },
  { id: 'streak', icon: 'flame', name: 'Chuỗi ngày học', desc: 'Giữ chuỗi học liên tiếp', stat: 'streak', tiers: [[3, 60, 0], [7, 200, 2], [14, 500, 4], [30, 1500, 10]] },
  { id: 'barn', icon: 'barn', name: 'Chủ kho', desc: 'Nâng cấp sức chứa kho', stat: 'barnTier', tiers: [[2, 100, 0], [4, 300, 2], [7, 1000, 6]] },
];

// Ngày theo giờ Việt Nam "YYYY-MM-DD" — mọi giới hạn "1 lần/ngày" dùng chung hàm này
function vnDay(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Gói gửi về frontend (chỉ phần cần hiển thị giá/tên)
function publicCatalog() {
  return {
    crops: CROPS, decor: DECOR, decorCats: DECOR_CATS, outfits: OUTFITS, outfitSlots: OUTFIT_SLOTS, producePrice: PRODUCE_PRICE, barnTiers: BARN_TIERS, barnQuiz: BARN_QUIZ, expansions: EXPANSIONS, wheel: WHEEL.map(({ id, label, kind }) => ({ id, label, kind })),
    startPlots: START_PLOTS, maxPlots: MAX_PLOTS, firstGrowMinutes: FIRST_GROW_MINUTES,
    harvestCoins: HARVEST_COINS, harvestXp: HARVEST_XP, masteredBonus: MASTERED_BONUS, barnBonus: BARN_BONUS,
    orderTrashCost: ORDER_TRASH_COST, decorSellRate: DECOR_SELL_RATE, gemSellCoins: GEM_SELL_COINS,
    petLevels: PET_LEVELS, petFeedReward: PET_FEED_REWARD,
    visit: { likeReward: VISIT_LIKE_REWARD, giftReward: VISIT_GIFT_REWARD, giftCost: VISIT_GIFT_COST, giftsPerDay: VISIT_GIFTS_PER_DAY },
  };
}

module.exports = {
  CROPS, CROP_KEYS, TOPIC_CROP, cropForTopic, FIRST_GROW_MINUTES,
  levelFor, harvestsForLevel, START_PLOTS, MAX_PLOTS, plotPrice, EXPANSIONS,
  DECOR, DECOR_SELL_RATE, GEM_SELL_COINS, sellValue, HARVEST_COINS, HARVEST_XP, MASTERED_BONUS, BARN_BONUS, WITHER_PENALTY_COINS,
  CUSTOMERS, ORDER_SLOTS, makeOrderTemplate, orderDifficulty, ORDER_TRASH_COST,
  PRODUCE_PRICE, PRODUCE_PER_HARVEST, BARN_TIERS, BARN_FULL_SELL_RATE, BARN_QUIZ, OUTFITS, OUTFIT_SLOTS, DECOR_CATS,
  WHEEL, WHEEL_DECOR_POOL, PET_FEED_REWARD, PET_PAT_XP, PET_LEVELS, petLevelFor,
  VISIT_LIKE_REWARD, VISIT_GIFT_REWARD, VISIT_GIFT_COST, VISIT_GIFTS_PER_DAY, vnDay, publicCatalog,
  dailyQuestDefs, questChest, QUEST_STAT_KEYS, TRACKED_STATS, ACHIEVEMENTS, statValue,
};
