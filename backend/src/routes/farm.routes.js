// Nông Trại Qilin (/farm) — game kiểu Hay Day chạy trên deck SRS của học viên.
// Xem CLAUDE.md mục `/farm`. Mọi phần thưởng tính ở server; frontend chỉ hiển thị.
const express = require('express');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { calculateSM2, statusAfterReview } = require('../lib/sm2');
const C = require('../lib/farmCatalog');
const SEEDS = require('../data/farmSeeds.json');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');

const router = express.Router();

// Groq chỉ dùng cho đơn hàng "Viết câu"; không có khoá thì chấm theo quy tắc.
let groq = null;
if (process.env.GROQ_API_KEY) {
  try { const Groq = require('groq-sdk'); groq = new Groq({ apiKey: process.env.GROQ_API_KEY }); } catch { groq = null; }
}

// ─── Tiện ích ────────────────────────────────────────────────────────────────
const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return dp[m][n];
}
const hintMask = (word) => word.split(' ').map((w) => (w.length ? w[0] + ' _'.repeat(w.length - 1) : '')).join('   ');
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const parseJSON = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const ALL_SEED_WORDS = SEEDS.flatMap((t) => t.words.map((w) => ({ ...w, topicId: t.id })));

const PROGRESS_INCLUDE = { progress: { include: { vocab: true } } };

// Vị trí 6 ô đất khởi điểm trên lưới 8×6 (hai hàng giữa)
const START_POSITIONS = [[2, 2], [3, 2], [4, 2], [2, 3], [3, 3], [4, 3]];

async function getOrCreateFarm(userId) {
  let farm = await prisma.farmState.findUnique({ where: { userId } });
  if (farm) return farm;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return null;
  farm = await prisma.farmState.create({ data: { userId } });
  await prisma.farmPlot.createMany({ data: START_POSITIONS.map(([x, y]) => ({ userId, x, y })), skipDuplicates: true });
  return farm;
}

// Thời điểm cây chín: lần ôn đầu 10 phút sau khi trồng, các lần sau theo SM-2
function readyAtFor(plot) {
  const p = plot.progress;
  if (!p || !plot.plantedAt) return null;
  const planted = new Date(plot.plantedAt).getTime();
  if (p.repetitions === 0) return new Date(planted + C.FIRST_GROW_MINUTES * 60000);
  return new Date(Math.max(new Date(p.nextReviewDate).getTime(), planted + 60000));
}

function plotView(plot, now = new Date()) {
  const base = { id: plot.id, x: plot.x, y: plot.y, cropKey: plot.cropKey, plantedAt: plot.plantedAt };
  if (!plot.progress) return { ...base, status: 'EMPTY' };
  const p = plot.progress; const v = p.vocab;
  const readyAt = readyAtFor(plot);
  const planted = new Date(plot.plantedAt).getTime();
  const frac = Math.max(0, Math.min(1, (now.getTime() - planted) / Math.max(1, readyAt.getTime() - planted)));
  const wilted = p.repetitions === 0 && p.lastReviewedAt && new Date(p.lastReviewedAt).getTime() >= planted - 1000;
  return {
    ...base,
    status: now >= readyAt ? 'READY' : 'GROWING',
    growth: frac, readyAt, wilted: !!wilted,
    progressId: p.id, word: v.word, meaning: v.meaning, phonetic: v.phonetic, example: v.example, pos: v.pos,
    srs: { status: p.status, repetitions: p.repetitions, interval: p.interval },
  };
}

function orderView(o, inventory = {}) {
  const req = parseJSON(o.requirement, {});
  if (o.kind === 'PRODUCE') {
    const items = req.items || {};
    const have = Object.fromEntries(Object.keys(items).map((k) => [k, inventory[k] || 0]));
    const ready = Object.entries(items).every(([k, n]) => (inventory[k] || 0) >= n);
    const total = Object.values(items).reduce((a, b) => a + b, 0);
    const got = Object.entries(items).reduce((a, [k, n]) => a + Math.min(n, inventory[k] || 0), 0);
    return { id: o.id, kind: o.kind, customer: o.customer, title: o.title, requirement: req, progress: got, need: total, have, ready,
      rewardCoins: o.rewardCoins, rewardGems: o.rewardGems, rewardXp: o.rewardXp, createdAt: o.createdAt };
  }
  const need = o.kind === 'SENTENCE' ? 1 : (req.need || 1);
  return { id: o.id, kind: o.kind, customer: o.customer, title: o.title, requirement: req, progress: o.progress, need,
    ready: o.kind !== 'SENTENCE' && o.progress >= need, rewardCoins: o.rewardCoins, rewardGems: o.rewardGems, rewardXp: o.rewardXp, createdAt: o.createdAt };
}

function farmView(farm, plotCount) {
  const level = C.levelFor(farm.harvestCount);
  const expIdx = Math.max(0, C.EXPANSIONS.findIndex((e) => e.w === farm.gridW && e.h === farm.gridH));
  const nextExpansion = C.EXPANSIONS[expIdx + 1] || null;
  const today = C.vnDay();
  const inventory = parseJSON(farm.inventory, {});
  const barnTierIdx = Math.max(0, C.BARN_TIERS.findIndex((t) => t.capacity === farm.barnCapacity));
  const wardrobe = parseJSON(farm.wardrobe, {});
  return {
    coins: farm.coins, gems: farm.gems, gridW: farm.gridW, gridH: farm.gridH,
    layout: parseJSON(farm.layout, []),
    inventory, barnCapacity: farm.barnCapacity, barnUsed: Object.values(inventory).reduce((a, b) => a + b, 0),
    barnTier: barnTierIdx + 1, nextBarnTier: C.BARN_TIERS[barnTierIdx + 1] || null,
    wardrobe: { owned: wardrobe.owned || [], equipped: wardrobe.equipped || {} },
    ordersDone: farm.ordersDone, orderDifficulty: C.orderDifficulty(level, farm.ordersDone),
    barnQuizLeft: Math.max(0, C.BARN_QUIZ.dailyRewarded - (farm.barnQuizOn === today ? farm.barnQuizCount : 0)),
    harvestCount: farm.harvestCount, witherCount: farm.witherCount, barnCount: farm.barnCount,
    level, levelStart: C.harvestsForLevel(level), nextLevelAt: C.harvestsForLevel(level + 1),
    plotCount, plotPrice: plotCount < C.MAX_PLOTS ? C.plotPrice(plotCount) : null, nextExpansion,
    pet: { name: farm.petName, xp: farm.petXp, level: C.petLevelFor(farm.petXp), fedToday: farm.petFedOn === today, pats: farm.petPats, trip: jsonObj(farm.petTrip).active || null, buffs: C.petBuffs(farm.petXp, farm.petFedOn === today) },
    canSpin: farm.spunOn !== today, boostHarvests: farm.boostHarvests,
  };
}

// Bảo đảm luôn có đủ ORDER_SLOTS đơn đang mở (sinh thêm theo cấp + cây đang trồng)
async function ensureOrders(userId, farm, plots) {
  const open = await prisma.farmOrder.findMany({ where: { userId, status: 'OPEN' }, orderBy: { createdAt: 'asc' } });
  const missing = C.ORDER_SLOTS - open.length;
  if (missing <= 0) return open;
  const level = C.levelFor(farm.harvestCount);
  const difficulty = C.orderDifficulty(level, farm.ordersDone);
  const planted = plots.filter((p) => p.progress);
  const cropKeys = [...new Set(planted.map((p) => p.cropKey).filter(Boolean))];
  const inventory = parseJSON(farm.inventory, {});
  const produceKeys = [...new Set([...cropKeys, ...Object.keys(inventory).filter((k) => inventory[k] > 0 && C.CROPS[k])])];
  const sentenceWords = planted.filter((p) => p.progress.repetitions >= 1).map((p) => p.progress.vocab.word);
  const kindsOpen = new Set(open.map((o) => o.kind));
  const data = [];
  for (let i = 0; i < missing; i++) {
    const r = Math.random();
    let kind = r < 0.25 ? 'HARVEST' : r < 0.45 ? 'HARVEST_CROP' : r < 0.6 ? 'PLANT' : r < 0.85 ? 'PRODUCE' : 'SENTENCE';
    if (kind === 'PRODUCE' && (!produceKeys.length || kindsOpen.has('PRODUCE'))) kind = 'HARVEST';
    if (kind === 'HARVEST_CROP' && !cropKeys.length) kind = 'HARVEST';
    if (kind === 'SENTENCE' && (!sentenceWords.length || kindsOpen.has('SENTENCE'))) kind = kindsOpen.has('PLANT') ? 'HARVEST' : 'PLANT';
    if (kind === 'PLANT' && kindsOpen.has('PLANT')) kind = 'HARVEST'; // không để 2-3 đơn "Trồng" giống nhau
    kindsOpen.add(kind);
    const ctx = {};
    if (kind === 'HARVEST_CROP') ctx.cropKey = cropKeys[Math.floor(Math.random() * cropKeys.length)];
    if (kind === 'PRODUCE') ctx.cropKeys = produceKeys;
    if (kind === 'SENTENCE') { ctx.words = shuffle(sentenceWords).slice(0, difficulty >= 3 && sentenceWords.length > 1 && Math.random() < 0.5 ? 2 : 1); kindsOpen.add('SENTENCE'); }
    const t = C.makeOrderTemplate(kind, difficulty, ctx);
    data.push({ userId, kind: t.kind, customer: t.customer, title: t.title, requirement: JSON.stringify(t.requirement), rewardCoins: t.rewardCoins, rewardGems: t.rewardGems, rewardXp: t.rewardXp });
  }
  await prisma.farmOrder.createMany({ data });
  return prisma.farmOrder.findMany({ where: { userId, status: 'OPEN' }, orderBy: { createdAt: 'asc' } });
}

// Toàn bộ trạng thái trong 1 gói — mọi endpoint ghi đều trả lại gói này để client thay thế.
// ── Bộ đếm sự kiện / nhiệm vụ ngày / thành tựu ───────────────────────────────
const jsonObj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
// Tăng bộ đếm trọn đời bằng 1 lệnh SQL nguyên tử (an toàn khi nhiều request song song). Chỉ nhận khoá trong danh sách trắng.
async function bumpStats(userId, delta) {
  const clean = {};
  for (const [k, n] of Object.entries(delta || {})) if (C.TRACKED_STATS.includes(k) && Number.isFinite(n) && n > 0) clean[k] = Math.floor(n);
  if (!Object.keys(clean).length) return;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "FarmState" SET "stats" = COALESCE("stats", '{}'::jsonb) || (SELECT jsonb_object_agg(e.key, COALESCE(("FarmState"."stats"->>e.key)::int, 0) + e.value::int) FROM jsonb_each_text($2::jsonb) e) WHERE "userId" = $1`,
      userId, JSON.stringify(clean));
  } catch (e) { console.error('[farm] bumpStats', e.message); }
}
const baseStats = (farm) => {
  const st = jsonObj(farm.stats);
  return { harvests: farm.harvestCount, orders: farm.ordersDone, plants: st.plants || 0, sold: st.sold || 0, feeds: st.feeds || 0, spins: st.spins || 0, trips: st.trips || 0 };
};
// Sang ngày mới (giờ VN) → chụp mốc đầu ngày + chốt cấp để mục tiêu không đổi giữa chừng
async function ensureDaily(farm) {
  const today = C.vnDay();
  let daily = jsonObj(farm.daily);
  if (daily.day === today && daily.base) return { farm, daily };
  daily = { day: today, level: C.levelFor(farm.harvestCount), base: baseStats(farm), claimed: [] };
  const updated = await prisma.farmState.update({ where: { userId: farm.userId }, data: { daily } });
  return { farm: updated, daily };
}
function nextMidnightVN() {
  const vn = new Date(Date.now() + 7 * 3600e3); vn.setUTCHours(24, 0, 0, 0);
  return new Date(vn.getTime() - 7 * 3600e3).toISOString();
}
function questsView(farm, daily) {
  const level = daily.level || C.levelFor(farm.harvestCount);
  const base = jsonObj(daily.base); const claimed = new Set(daily.claimed || []);
  const items = C.dailyQuestDefs(daily.day, level).map((d) => {
    const raw = Math.max(0, C.statValue(d.stat, { farm }) - (base[d.stat] || 0));
    return { ...d, progress: Math.min(raw, d.target), done: raw >= d.target, claimed: claimed.has(d.id) };
  });
  const allClaimed = items.every((i) => i.claimed);
  const chest = { reward: C.questChest(level), ready: allClaimed && !claimed.has('CHEST'), claimed: claimed.has('CHEST'), progress: items.filter((i) => i.claimed).length, total: items.length };
  return { day: daily.day, items, chest, claimable: items.filter((i) => i.done && !i.claimed).length + (chest.ready ? 1 : 0), resetAt: nextMidnightVN() };
}
function achievementsView(farm, user) {
  const claimedMap = jsonObj(jsonObj(farm.achievements).claimed);
  let claimable = 0, completed = 0, total = 0;
  const groups = C.ACHIEVEMENTS.map((g) => {
    const value = C.statValue(g.stat, { farm, user }); const got = claimedMap[g.id] || 0;
    const tiers = g.tiers.map(([target, coins, gems], i) => ({ target, reward: { coins, gems }, reached: value >= target, claimed: i < got }));
    const can = tiers.filter((t) => t.reached && !t.claimed).length;
    claimable += can; completed += tiers.filter((t) => t.claimed).length; total += tiers.length;
    return { id: g.id, icon: g.icon, name: g.name, desc: g.desc, value, tiers, claimable: can, complete: got >= g.tiers.length };
  });
  return { groups, claimable, completed, total };
}

async function buildState(userId, extra = {}) {
  let farm = await getOrCreateFarm(userId);
  if (!farm) return null;
  let daily;
  ({ farm, daily } = await ensureDaily(farm));
  const [plots, user] = await Promise.all([
    prisma.farmPlot.findMany({ where: { userId }, include: PROGRESS_INCLUDE, orderBy: [{ y: 'asc' }, { x: 'asc' }] }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, totalXP: true, streakCount: true } }),
  ]);
  const orders = await ensureOrders(userId, farm, plots);
  const now = new Date();
  const inventory = parseJSON(farm.inventory, {});
  return { now, farm: farmView(farm, plots.length), plots: plots.map((p) => plotView(p, now)), orders: orders.map((o) => orderView(o, inventory)), user, catalog: C.publicCatalog(),
    quests: questsView(farm, daily), achievements: achievementsView(farm, user), ...extra };
}

const occupiedSet = (farm, plots) => {
  const s = new Set(plots.map((p) => `${p.x},${p.y}`));
  for (const d of parseJSON(farm.layout, [])) s.add(`${d.x},${d.y}`);
  return s;
};
const inGrid = (farm, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < farm.gridW && y < farm.gridH;

// Cộng tiến độ cho đơn đang mở (không tự hoàn thành — học sinh bấm "Giao hàng")
async function bumpOrders(userId, kind, amount = 1, cropKey = null) {
  const open = await prisma.farmOrder.findMany({ where: { userId, status: 'OPEN', kind: { in: kind === 'HARVEST' ? ['HARVEST', 'HARVEST_CROP'] : [kind] } } });
  const ids = open.filter((o) => {
    if (o.kind !== 'HARVEST_CROP') return true;
    return parseJSON(o.requirement, {}).cropKey === cropKey;
  }).map((o) => o.id);
  if (!ids.length) return;
  await prisma.farmOrder.updateMany({ where: { id: { in: ids } }, data: { progress: { increment: amount } } });
}

// Dạng câu hỏi thu hoạch theo số lần đã nhớ đúng: 0 → chọn từ, 1 → nghe chọn nghĩa,
// ≥2 → gõ từ (xen kẽ điền vào câu ví dụ). Server và client cùng suy ra từ `repetitions`.
function modeFor(progress) {
  const r = progress.repetitions;
  if (r === 0) return 'CHOICE';
  if (r === 1) return 'LISTEN';
  return progress.vocab.example && r % 2 === 0 ? 'FILL' : 'TYPE';
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/state/:userId', async (req, res) => {
  try {
    const state = await buildState(req.params.userId);
    if (!state) return res.status(404).json({ error: 'User not found' });
    res.json(state);
  } catch (e) { console.error('[farm] state', e); res.status(500).json({ error: 'Không tải được nông trại' }); }
});

// Kho hạt giống: ?source=deck (từ trong deck SRS chưa trồng) | ?topic=<id> (kho 8 chủ đề)
router.get('/seeds/:userId', async (req, res) => {
  try {
    const { userId } = req.params; const { source, topic } = req.query;
    if (source === 'deck') {
      const rows = await prisma.userVocabProgress.findMany({
        where: { userId, farmPlot: null }, include: { vocab: { select: { word: true, meaning: true, phonetic: true, example: true, pos: true, lessonId: true } } },
        orderBy: { nextReviewDate: 'asc' }, take: 300,
      });
      return res.json({ source: 'deck', items: rows.map((r) => ({ progressId: r.id, word: r.vocab.word, meaning: r.vocab.meaning, phonetic: r.vocab.phonetic, example: r.vocab.example, pos: r.vocab.pos, srs: { status: r.status, repetitions: r.repetitions }, fromLesson: !!r.vocab.lessonId })) });
    }
    const topics = SEEDS.map((t) => ({ id: t.id, name: t.name, desc: t.desc, count: t.words.length, cropKey: C.TOPIC_CROP[t.id] }));
    if (!topic) return res.json({ source: 'topics', topics });
    const t = SEEDS.find((x) => x.id === topic);
    if (!t) return res.status(404).json({ error: 'Chủ đề không tồn tại' });
    // Từ nào đã có trong deck của học viên (để đánh dấu "đã có"/"đang trồng")
    const words = t.words.map((w) => w.word.toLowerCase());
    const have = await prisma.userVocabProgress.findMany({ where: { userId, vocab: { word: { in: words, mode: 'insensitive' } } }, select: { id: true, vocab: { select: { word: true } }, farmPlot: { select: { id: true } } } });
    const map = new Map(have.map((h) => [h.vocab.word.toLowerCase(), h]));
    res.json({ source: 'topic', topic: { id: t.id, name: t.name, cropKey: C.TOPIC_CROP[t.id] }, items: t.words.map((w) => { const h = map.get(w.word.toLowerCase()); return { ...w, inDeck: !!h, planted: !!(h && h.farmPlot), progressId: h ? h.id : null }; }) });
  } catch (e) { console.error('[farm] seeds', e); res.status(500).json({ error: 'Không tải được hạt giống' }); }
});

// Trồng: { userId, plotId, progressId } hoặc { userId, plotId, seed: { topicId, word } }
router.post('/plant', async (req, res) => {
  try {
    const { userId, plotId, progressId, seed } = req.body;
    const plot = await prisma.farmPlot.findFirst({ where: { id: plotId, userId } });
    if (!plot) return res.status(404).json({ error: 'Ô đất không tồn tại' });
    if (plot.progressId) return res.status(400).json({ error: 'Ô đất này đang có cây' });

    let pid = progressId; let cropKey = null;
    if (!pid && seed) {
      const t = SEEDS.find((x) => x.id === seed.topicId);
      const w = t && t.words.find((x) => x.word.toLowerCase() === String(seed.word || '').toLowerCase());
      if (!w) return res.status(400).json({ error: 'Hạt giống không hợp lệ' });
      cropKey = C.cropForTopic(t.id);
      const existing = await prisma.userVocabProgress.findFirst({ where: { userId, vocab: { word: { equals: w.word, mode: 'insensitive' } } }, select: { id: true } });
      if (existing) pid = existing.id;
      else {
        const vocab = await prisma.vocabItem.create({ data: { word: w.word, meaning: w.meaning, example: w.example || null, addedByUserId: userId, progress: { create: { userId } } }, select: { progress: { select: { id: true } } } });
        pid = vocab.progress[0].id;
      }
    }
    if (!pid) return res.status(400).json({ error: 'Thiếu từ để trồng' });
    const progress = await prisma.userVocabProgress.findFirst({ where: { id: pid, userId }, select: { id: true } });
    if (!progress) return res.status(404).json({ error: 'Từ không thuộc deck của bạn' });
    if (!cropKey) cropKey = C.cropForTopic(null);

    try {
      await prisma.farmPlot.update({ where: { id: plotId }, data: { progressId: pid, cropKey, plantedAt: new Date() } });
    } catch (e) {
      if (e.code === 'P2002') return res.status(400).json({ error: 'Từ này đã được trồng ở ô khác' });
      throw e;
    }
    await Promise.all([bumpOrders(userId, 'PLANT', 1), bumpStats(userId, { plants: 1 })]);
    res.json(await buildState(userId, { planted: { plotId, cropKey } }));
  } catch (e) { console.error('[farm] plant', e); res.status(500).json({ error: 'Không trồng được' }); }
});

// Câu hỏi thu hoạch cho 1 ô (chỉ khi cây đã chín)
router.get('/plots/:plotId/question', async (req, res) => {
  try {
    const { userId } = req.query;
    const plot = await prisma.farmPlot.findFirst({ where: { id: req.params.plotId, userId: String(userId) }, include: PROGRESS_INCLUDE });
    if (!plot || !plot.progress) return res.status(404).json({ error: 'Ô đất trống' });
    const view = plotView(plot);
    if (view.status !== 'READY') return res.status(400).json({ error: 'Cây chưa chín', readyAt: view.readyAt });
    const v = plot.progress.vocab; const mode = modeFor(plot.progress);
    const q = { plotId: plot.id, mode, word: null, meaning: null, hint: null, options: null, speak: null, sentence: null };
    if (mode === 'CHOICE' || mode === 'LISTEN') {
      // Nhiễu: lấy từ các cây khác của học viên trước, thiếu thì lấy từ kho hạt giống
      const others = await prisma.farmPlot.findMany({ where: { userId: String(userId), progressId: { not: null }, id: { not: plot.id } }, include: PROGRESS_INCLUDE, take: 40 });
      const pool = shuffle([...others.map((o) => ({ word: o.progress.vocab.word, meaning: o.progress.vocab.meaning })), ...shuffle(ALL_SEED_WORDS).slice(0, 30)])
        .filter((o) => clean(o.word) !== clean(v.word) && clean(o.meaning) !== clean(v.meaning));
      const seen = new Set(); const distract = [];
      for (const o of pool) { const k = mode === 'CHOICE' ? clean(o.word) : clean(o.meaning); if (!seen.has(k)) { seen.add(k); distract.push(o); } if (distract.length === 3) break; }
      if (mode === 'CHOICE') { q.meaning = v.meaning; q.options = shuffle([v.word, ...distract.map((d) => d.word)]); }
      else { q.speak = v.word; q.options = shuffle([v.meaning, ...distract.map((d) => d.meaning)]); }
    } else if (mode === 'FILL') {
      const re = new RegExp(v.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      q.sentence = re.test(v.example) ? v.example.replace(re, '_____') : null;
      if (!q.sentence) { q.mode = 'TYPE'; }
      q.meaning = v.meaning; q.hint = hintMask(v.word);
    } else { q.meaning = v.meaning; q.hint = hintMask(v.word); }
    res.json(q);
  } catch (e) { console.error('[farm] question', e); res.status(500).json({ error: 'Không tạo được câu hỏi' }); }
});

// Thu hoạch = trả lời. { userId, answer, usedHint } → chấm, SM-2, thưởng. Sai → cây héo, học lại sau 10 phút.
router.post('/plots/:plotId/harvest', async (req, res) => {
  try {
    const { userId, answer, usedHint } = req.body;
    const [plot, farm] = await Promise.all([
      prisma.farmPlot.findFirst({ where: { id: req.params.plotId, userId }, include: PROGRESS_INCLUDE }),
      prisma.farmState.findUnique({ where: { userId } }),
    ]);
    if (!plot || !plot.progress || !farm) return res.status(404).json({ error: 'Ô đất trống' });
    const view = plotView(plot);
    if (view.status !== 'READY') return res.status(400).json({ error: 'Cây chưa chín' });

    const p = plot.progress; const v = p.vocab; const mode = modeFor(p);
    let quality;
    const a = String(answer || '');
    if (mode === 'CHOICE') quality = clean(a) === clean(v.word) ? 4 : 1;
    else if (mode === 'LISTEN') quality = clean(a) === clean(v.meaning) ? 4 : 1;
    else {
      const ca = clean(a), cw = clean(v.word);
      if (!ca) quality = 1;
      else if (ca === cw) quality = usedHint ? 4 : 5;
      else if (levenshtein(ca, cw) <= 2) quality = 3;
      else quality = 1;
    }
    const correct = quality >= 3;
    const sm2 = calculateSM2(quality, p.repetitions, p.easeFactor, p.interval);
    const newStatus = statusAfterReview(quality, sm2.interval, p.status);
    const becameMastered = correct && newStatus === 'MASTERED' && p.status !== 'MASTERED';

    let coins = 0, gems = 0, xp = 0, produce = 0, overflowSold = 0;
    const inventory = parseJSON(farm.inventory, {});
    if (correct) {
      const buffs = C.petBuffs(farm.petXp, farm.petFedOn === C.vnDay());
      coins = Math.round((C.HARVEST_COINS[quality] || 0) * (1 + buffs.coinPct));
      if (farm.boostHarvests > 0) coins *= 2;
      xp = Math.round(C.HARVEST_XP * (1 + buffs.xpPct));
      if (becameMastered) { coins += C.MASTERED_BONUS.coins; gems += C.MASTERED_BONUS.gems; }
      // Nông sản vào kho; kho đầy → phần dư bán tự động nửa giá
      produce = C.PRODUCE_PER_HARVEST[quality] || 1;
      const used = Object.values(inventory).reduce((a, b) => a + b, 0);
      const room = Math.max(0, farm.barnCapacity - used);
      const stored = Math.min(room, produce);
      if (plot.cropKey) inventory[plot.cropKey] = (inventory[plot.cropKey] || 0) + stored;
      overflowSold = produce - stored;
      if (overflowSold > 0) coins += Math.floor(overflowSold * (C.PRODUCE_PRICE[plot.cropKey] || 4) * C.BARN_FULL_SELL_RATE);
    }
    const now = new Date();
    const ops = [
      prisma.userVocabProgress.update({ where: { id: p.id }, data: { ...sm2, status: newStatus, lastReviewedAt: now } }),
      prisma.farmPlot.update({ where: { id: plot.id }, data: { plantedAt: now } }),
      prisma.farmState.update({ where: { userId }, data: correct
        ? { coins: { increment: coins }, gems: { increment: gems }, harvestCount: { increment: 1 }, inventory: JSON.stringify(inventory), boostHarvests: farm.boostHarvests > 0 ? { decrement: 1 } : undefined }
        : { witherCount: { increment: 1 } } }),
    ];
    if (correct) {
      ops.push(prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: xp } }, select: { id: true } }));
      ops.push(bumpOrders(userId, 'HARVEST', 1, plot.cropKey));
      if (becameMastered) ops.push(bumpStats(userId, { mastered: 1 }));
    }
    await Promise.all(ops);
    const prevLevel = C.levelFor(farm.harvestCount);
    const newLevel = C.levelFor(farm.harvestCount + (correct ? 1 : 0));
    res.json(await buildState(userId, { result: { correct, quality, mode, word: v.word, meaning: v.meaning, example: v.example, coins, gems, xp, produce: produce - overflowSold, produceKey: plot.cropKey, overflowSold, boosted: correct && farm.boostHarvests > 0, becameMastered, levelUp: newLevel > prevLevel ? newLevel : null, srs: { status: newStatus, interval: sm2.interval } } }));
  } catch (e) { console.error('[farm] harvest', e); res.status(500).json({ error: 'Không thu hoạch được' }); }
});

// Nhổ cây (từ vẫn còn trong deck SRS)
router.post('/plots/:plotId/dig', async (req, res) => {
  try {
    const { userId } = req.body;
    const plot = await prisma.farmPlot.findFirst({ where: { id: req.params.plotId, userId } });
    if (!plot) return res.status(404).json({ error: 'Ô đất không tồn tại' });
    await prisma.farmPlot.update({ where: { id: plot.id }, data: { progressId: null, cropKey: null, plantedAt: null } });
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] dig', e); res.status(500).json({ error: 'Không nhổ được cây' }); }
});

// Cất từ đã MASTERED vào kho → giải phóng ô đất + thưởng
router.post('/plots/:plotId/store', async (req, res) => {
  try {
    const { userId } = req.body;
    const plot = await prisma.farmPlot.findFirst({ where: { id: req.params.plotId, userId }, include: PROGRESS_INCLUDE });
    if (!plot || !plot.progress) return res.status(404).json({ error: 'Ô đất trống' });
    if (plot.progress.status !== 'MASTERED') return res.status(400).json({ error: 'Từ chưa thuộc lòng (MASTERED), chưa cất kho được' });
    await Promise.all([
      prisma.farmPlot.update({ where: { id: plot.id }, data: { progressId: null, cropKey: null, plantedAt: null } }),
      prisma.farmState.update({ where: { userId }, data: { barnCount: { increment: 1 }, coins: { increment: C.BARN_BONUS.coins } } }),
    ]);
    res.json(await buildState(userId, { stored: { word: plot.progress.vocab.word, coins: C.BARN_BONUS.coins } }));
  } catch (e) { console.error('[farm] store', e); res.status(500).json({ error: 'Không cất kho được' }); }
});

// Kho từ đã thuộc (MASTERED) của học viên — cả từ đang trồng lẫn đã cất
router.get('/barn/:userId', async (req, res) => {
  try {
    const rows = await prisma.userVocabProgress.findMany({ where: { userId: req.params.userId, status: 'MASTERED' }, include: { vocab: { select: { word: true, meaning: true, phonetic: true, example: true } }, farmPlot: { select: { id: true } } }, orderBy: { lastReviewedAt: 'desc' } });
    res.json(rows.map((r) => ({ progressId: r.id, ...r.vocab, interval: r.interval, onPlot: !!r.farmPlot })));
  } catch (e) { res.status(500).json({ error: 'Không tải được kho' }); }
});

// Mua: { userId, itemKey: 'plot' | 'expand' | <decorKey>, x, y }
router.post('/buy', async (req, res) => {
  try {
    const { userId, itemKey, x, y } = req.body;
    const [farm, plots] = await Promise.all([getOrCreateFarm(userId), prisma.farmPlot.findMany({ where: { userId }, select: { x: true, y: true } })]);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const level = C.levelFor(farm.harvestCount);
    const occ = occupiedSet(farm, plots);

    if (itemKey === 'expand') {
      const idx = C.EXPANSIONS.findIndex((e) => e.w === farm.gridW && e.h === farm.gridH);
      const next = C.EXPANSIONS[idx + 1];
      if (!next) return res.status(400).json({ error: 'Đất đã rộng tối đa' });
      if (level < next.minLevel) return res.status(400).json({ error: `Cần cấp ${next.minLevel} để mở rộng` });
      if (farm.coins < next.price) return res.status(400).json({ error: 'Không đủ xu' });
      await prisma.farmState.update({ where: { userId }, data: { coins: { decrement: next.price }, gridW: next.w, gridH: next.h } });
      return res.json(await buildState(userId, { bought: { itemKey } }));
    }
    if (!inGrid(farm, x, y)) return res.status(400).json({ error: 'Vị trí ngoài lưới' });
    if (occ.has(`${x},${y}`)) return res.status(400).json({ error: 'Ô này đã có đồ' });

    if (itemKey === 'plot') {
      if (plots.length >= C.MAX_PLOTS) return res.status(400).json({ error: 'Đã đạt số ô đất tối đa' });
      const price = C.plotPrice(plots.length);
      if (farm.coins < price) return res.status(400).json({ error: 'Không đủ xu' });
      await Promise.all([
        prisma.farmPlot.create({ data: { userId, x, y } }),
        prisma.farmState.update({ where: { userId }, data: { coins: { decrement: price } } }),
      ]);
      return res.json(await buildState(userId, { bought: { itemKey, price } }));
    }
    const item = C.DECOR[itemKey];
    if (!item) return res.status(400).json({ error: 'Vật phẩm không tồn tại' });
    if (level < item.minLevel) return res.status(400).json({ error: `Cần cấp ${item.minLevel}` });
    if (farm[item.currency] < item.price) return res.status(400).json({ error: item.currency === 'gems' ? 'Không đủ kim cương' : 'Không đủ xu' });
    const layout = parseJSON(farm.layout, []);
    if (item.factory && layout.some((l) => l.key === itemKey)) return res.status(400).json({ error: `Bạn đã có ${item.name} rồi (mỗi loại chỉ mua 1 cái)` });
    layout.push({ uid: crypto.randomUUID(), key: itemKey, x, y });
    await prisma.farmState.update({ where: { userId }, data: { [item.currency]: { decrement: item.price }, layout: JSON.stringify(layout) } });
    res.json(await buildState(userId, { bought: { itemKey, price: item.price, currency: item.currency } }));
  } catch (e) { console.error('[farm] buy', e); res.status(500).json({ error: 'Không mua được' }); }
});

// Dời đồ/ô đất: { userId, kind: 'plot'|'decor', id, x, y }
router.post('/move', async (req, res) => {
  try {
    const { userId, kind, id, x, y } = req.body;
    const [farm, plots] = await Promise.all([getOrCreateFarm(userId), prisma.farmPlot.findMany({ where: { userId }, select: { id: true, x: true, y: true } })]);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    if (!inGrid(farm, x, y)) return res.status(400).json({ error: 'Vị trí ngoài lưới' });
    const layout = parseJSON(farm.layout, []);
    const occ = occupiedSet(farm, plots);
    if (occ.has(`${x},${y}`)) return res.status(400).json({ error: 'Ô này đã có đồ' });
    if (kind === 'plot') {
      if (!plots.some((p) => p.id === id)) return res.status(404).json({ error: 'Ô đất không tồn tại' });
      await prisma.farmPlot.update({ where: { id }, data: { x, y } });
    } else {
      const d = layout.find((l) => l.uid === id);
      if (!d) return res.status(404).json({ error: 'Vật phẩm không tồn tại' });
      d.x = x; d.y = y;
      await prisma.farmState.update({ where: { userId }, data: { layout: JSON.stringify(layout) } });
    }
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] move', e); res.status(500).json({ error: 'Không dời được' }); }
});

// Bán trang trí — rất lỗ (xem sellValue trong farmCatalog): luôn hoàn bằng XU
router.post('/sell', async (req, res) => {
  try {
    const { userId, uid } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const layout = parseJSON(farm.layout, []);
    const d = layout.find((l) => l.uid === uid);
    if (!d) return res.status(404).json({ error: 'Vật phẩm không tồn tại' });
    if (d.job) return res.status(400).json({ error: 'Máy đang chế biến — hãy thu thành phẩm trước khi bán' });
    const refund = C.sellValue(C.DECOR[d.key]);
    await prisma.farmState.update({ where: { userId }, data: { layout: JSON.stringify(layout.filter((l) => l.uid !== uid)), coins: { increment: refund } } });
    res.json(await buildState(userId, { sold: { key: d.key, refund, currency: 'coins' } }));
  } catch (e) { console.error('[farm] sell', e); res.status(500).json({ error: 'Không bán được' }); }
});

// ── Xoay đồ trang trí (2 hướng nhìn: tường/rào/cổng đổi trục, đồ khác lật ngang) ─────────────────
router.post('/rotate', async (req, res) => {
  try {
    const { userId, uid } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const layout = parseJSON(farm.layout, []);
    const d = layout.find((l) => l.uid === uid);
    if (!d) return res.status(404).json({ error: 'Vật phẩm không tồn tại' });
    d.r = d.r ? 0 : 1;
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { layout: JSON.stringify(layout) } });
    if (r.count === 0) return res.status(409).json({ error: 'Vừa có thay đổi khác, bấm lại nhé' });
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] rotate', e); res.status(500).json({ error: 'Không xoay được' }); }
});

// ── Nhà máy chế biến: bỏ nguyên liệu (nông sản trong kho) → chờ → thu thành phẩm giá cao ─────────
// Công việc lưu ngay trong phần tử layout (d.job = { recipe, startedAt, readyAt }) nên không cần cột mới.
// Khoá lạc quan theo updatedAt để bấm/gọi song song không nhân đôi thành phẩm.
router.post('/factory/start', async (req, res) => {
  try {
    const { userId, uid, recipeId } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const layout = parseJSON(farm.layout, []);
    const d = layout.find((l) => l.uid === uid);
    const fac = d && C.FACTORIES[d.key];
    if (!fac) return res.status(404).json({ error: 'Nhà máy không tồn tại' });
    const recipe = fac.recipes.find((x) => x.id === recipeId);
    if (!recipe) return res.status(400).json({ error: 'Công thức không hợp lệ' });
    if (d.job) return res.status(400).json({ error: 'Máy đang chạy rồi' });
    const inventory = parseJSON(farm.inventory, {});
    const missing = Object.entries(recipe.inputs).filter(([k, n]) => (inventory[k] || 0) < n);
    if (missing.length) return res.status(400).json({ error: `Thiếu nguyên liệu: ${missing.map(([k, n]) => `${C.CROPS[k]?.name || k} ${inventory[k] || 0}/${n}`).join(', ')}` });
    for (const [k, n] of Object.entries(recipe.inputs)) { inventory[k] -= n; if (inventory[k] <= 0) delete inventory[k]; }
    const nowMs = Date.now();
    const mins = recipe.minutes * (1 - C.petBuffs(farm.petXp, farm.petFedOn === C.vnDay()).factoryTimePct);
    d.job = { recipe: recipe.id, startedAt: new Date(nowMs).toISOString(), readyAt: new Date(nowMs + mins * 60000).toISOString() };
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { layout: JSON.stringify(layout), inventory: JSON.stringify(inventory) } });
    if (r.count === 0) return res.status(409).json({ error: 'Vừa có thay đổi khác, bấm lại nhé' });
    res.json(await buildState(userId, { crafted: { started: recipe.id, product: recipe.product } }));
  } catch (e) { console.error('[farm] factory start', e); res.status(500).json({ error: 'Không bắt đầu được' }); }
});

router.post('/factory/collect', async (req, res) => {
  try {
    const { userId, uid } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const layout = parseJSON(farm.layout, []);
    const d = layout.find((l) => l.uid === uid);
    const fac = d && C.FACTORIES[d.key];
    if (!fac || !d.job) return res.status(400).json({ error: 'Không có gì để thu' });
    if (Date.now() < new Date(d.job.readyAt).getTime()) return res.status(400).json({ error: 'Chưa chế biến xong' });
    const recipe = fac.recipes.find((x) => x.id === d.job.recipe);
    if (!recipe) { delete d.job; await prisma.farmState.update({ where: { userId }, data: { layout: JSON.stringify(layout) } }); return res.json(await buildState(userId)); }
    const inventory = parseJSON(farm.inventory, {});
    const used = Object.values(inventory).reduce((a, b) => a + b, 0);
    if (used + 1 > farm.barnCapacity) return res.status(400).json({ error: 'Kho đầy — hãy bán bớt hoặc nâng cấp kho rồi thu thành phẩm' });
    inventory[recipe.product] = (inventory[recipe.product] || 0) + 1;
    delete d.job;
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { layout: JSON.stringify(layout), inventory: JSON.stringify(inventory) } });
    if (r.count === 0) return res.status(409).json({ error: 'Vừa có thay đổi khác, bấm lại nhé' });
    res.json(await buildState(userId, { crafted: { collected: recipe.product, qty: 1, price: C.PRODUCTS[recipe.product].price } }));
  } catch (e) { console.error('[farm] factory collect', e); res.status(500).json({ error: 'Không thu được' }); }
});

// Chấm câu cho đơn "Viết câu": quy tắc trước, có Groq thì nhờ AI nhận xét thêm
async function gradeSentence(sentence, words, minWords = 4) {
  const s = String(sentence || '').trim();
  const lower = s.toLowerCase();
  const missing = words.filter((w) => { const lw = w.toLowerCase(); return !(lower.includes(lw) || (lw.length > 4 && lower.includes(lw.slice(0, -1)))); });
  const tokens = s.split(/\s+/).filter(Boolean);
  if (missing.length) return { ok: false, feedback: `Câu chưa dùng từ: ${missing.map((m) => `"${m}"`).join(', ')}.` };
  if (tokens.length < minWords) return { ok: false, feedback: `Câu quá ngắn — khách này muốn ít nhất ${minWords} từ nhé.` };
  if (!groq) return { ok: true, feedback: 'Khách hài lòng! (chấm theo quy tắc, chưa có AI nhận xét)', ai: false };
  try {
    const r = await groq.chat.completions.create({
      model: GROQ_TEXT_MODEL, temperature: 0.2, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You grade one English sentence written by a Vietnamese high-school student in a farm game. Respond with JSON only.' },
        { role: 'user', content: `Required words: ${words.join(', ')}.\nSentence: "${s}"\nReturn {"ok": boolean, "feedback": string, "corrected": string}. ok=true if the sentence is grammatical (minor punctuation/capitalisation slips are fine), meaningful, and uses every required word (any inflection) with its correct meaning. "feedback": 1-2 short sentences in Vietnamese, friendly, point out the main error if any. "corrected": the corrected sentence (same as input if ok).` },
      ],
    });
    const out = parseJSON(r.choices?.[0]?.message?.content || '{}', {});
    if (typeof out.ok !== 'boolean') return { ok: true, feedback: 'Khách hài lòng!', ai: false };
    return { ok: out.ok, feedback: String(out.feedback || ''), corrected: out.corrected ? String(out.corrected) : undefined, ai: true };
  } catch (e) {
    console.error('[farm] groq sentence', e.message);
    return { ok: true, feedback: 'Khách hài lòng! (AI đang bận, chấm theo quy tắc)', ai: false };
  }
}

// Giao hàng: { userId, sentence? }
router.post('/orders/:id/complete', async (req, res) => {
  try {
    const { userId, sentence } = req.body;
    const order = await prisma.farmOrder.findFirst({ where: { id: req.params.id, userId, status: 'OPEN' } });
    if (!order) return res.status(404).json({ error: 'Đơn không tồn tại' });
    const reqm = parseJSON(order.requirement, {});
    let graded = null;
    const farm = await prisma.farmState.findUnique({ where: { userId } });
    const inventory = parseJSON(farm.inventory, {});
    if (order.kind === 'SENTENCE') {
      graded = await gradeSentence(sentence, reqm.words || [], reqm.minWords || 4);
      if (!graded.ok) return res.json({ ok: false, feedback: graded.feedback, corrected: graded.corrected });
    } else if (order.kind === 'PRODUCE') {
      const items = reqm.items || {};
      const missing = Object.entries(items).filter(([k, n]) => (inventory[k] || 0) < n);
      if (missing.length) return res.status(400).json({ error: `Kho chưa đủ: ${missing.map(([k, n]) => `${C.CROPS[k]?.name || k} ${inventory[k] || 0}/${n}`).join(', ')}` });
      for (const [k, n] of Object.entries(items)) { inventory[k] -= n; if (inventory[k] <= 0) delete inventory[k]; }
    } else if (order.progress < (reqm.need || 1)) return res.status(400).json({ error: 'Đơn chưa đủ hàng' });
    const prevLevel = C.levelFor(farm.harvestCount);
    const rewardCoins = Math.round(order.rewardCoins * (1 + C.petBuffs(farm.petXp, farm.petFedOn === C.vnDay()).orderPct));
    await Promise.all([
      prisma.farmOrder.update({ where: { id: order.id }, data: { status: 'DONE', doneAt: new Date() } }),
      prisma.farmState.update({ where: { userId }, data: { coins: { increment: rewardCoins }, gems: { increment: order.rewardGems }, ordersDone: { increment: 1 }, inventory: JSON.stringify(inventory) } }),
      order.rewardXp ? prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: order.rewardXp } }, select: { id: true } }) : null,
      order.kind === 'SENTENCE' ? bumpStats(userId, { sentences: 1 }) : null,
    ]);
    res.json(await buildState(userId, { delivered: { ok: true, title: order.title, customer: order.customer, coins: rewardCoins, gems: order.rewardGems, xp: order.rewardXp, feedback: graded?.feedback, corrected: graded?.corrected, ai: graded?.ai, levelUp: null, prevLevel } }));
  } catch (e) { console.error('[farm] complete', e); res.status(500).json({ error: 'Không giao được hàng' }); }
});

// Bỏ đơn (tốn xu nhỏ) — đơn mới xuất hiện ngay
router.post('/orders/:id/trash', async (req, res) => {
  try {
    const { userId } = req.body;
    const [order, farm] = await Promise.all([prisma.farmOrder.findFirst({ where: { id: req.params.id, userId, status: 'OPEN' } }), prisma.farmState.findUnique({ where: { userId } })]);
    if (!order || !farm) return res.status(404).json({ error: 'Đơn không tồn tại' });
    if (farm.coins < C.ORDER_TRASH_COST) return res.status(400).json({ error: 'Không đủ xu để bỏ đơn' });
    await Promise.all([
      prisma.farmOrder.delete({ where: { id: order.id } }),
      prisma.farmState.update({ where: { userId }, data: { coins: { decrement: C.ORDER_TRASH_COST } } }),
    ]);
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] trash', e); res.status(500).json({ error: 'Không bỏ được đơn' }); }
});

// Thú cưng
router.post('/pet/feed', async (req, res) => {
  try {
    const { userId } = req.body; const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const today = C.vnDay();
    if (farm.petFedOn === today) return res.status(400).json({ error: `${farm.petName} đã ăn no hôm nay rồi!` });
    await prisma.farmState.update({ where: { userId }, data: { petFedOn: today, petXp: { increment: C.PET_FEED_REWARD.petXp }, coins: { increment: C.PET_FEED_REWARD.coins } } });
    await bumpStats(userId, { feeds: 1 });
    res.json(await buildState(userId, { fed: { ...C.PET_FEED_REWARD } }));
  } catch (e) { res.status(500).json({ error: 'Không cho ăn được' }); }
});

// ── Qilin thám hiểm: đi vắng theo giờ thật → mang về xu, nông sản, kim cương và TỪ VỰNG MỚI vào deck ─────────────
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
router.post('/pet/trip/start', async (req, res) => {
  try {
    const { userId, tier } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const def = C.PET_TRIPS.find((t) => t.tier === Number(tier));
    if (!def) return res.status(400).json({ error: 'Chuyến đi không hợp lệ' });
    const lv = C.petLevelFor(farm.petXp);
    if (lv < def.minLevel) return res.status(400).json({ error: `${farm.petName} cần cấp ${def.minLevel} mới đi được chuyến này` });
    const st = jsonObj(farm.petTrip);
    if (st.active) return res.status(400).json({ error: `${farm.petName} đang đi thám hiểm rồi` });
    const mins = def.minutes * (1 - C.petBuffs(farm.petXp, farm.petFedOn === C.vnDay()).tripTimePct);
    const nowMs = Date.now();
    st.active = { tier: def.tier, startedAt: new Date(nowMs).toISOString(), readyAt: new Date(nowMs + mins * 60000).toISOString() };
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { petTrip: st } });
    if (r.count === 0) return res.status(409).json({ error: 'Vừa có thay đổi khác, bấm lại nhé' });
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] trip start', e); res.status(500).json({ error: 'Không đi được' }); }
});

router.post('/pet/trip/collect', async (req, res) => {
  try {
    const { userId } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const st = jsonObj(farm.petTrip);
    const act = st.active;
    if (!act) return res.status(400).json({ error: 'Qilin không đi thám hiểm' });
    if (Date.now() < new Date(act.readyAt).getTime()) return res.status(400).json({ error: 'Qilin chưa về tới nơi' });
    const def = C.PET_TRIPS.find((t) => t.tier === act.tier) || C.PET_TRIPS[0];
    const mult = 1 + C.PET_TRIP_LEVEL_BONUS * (C.petLevelFor(farm.petXp) - 1);
    let coins = Math.round(rnd(def.coins[0], def.coins[1]) * mult);
    const gems = Math.random() < def.gemChance ? rnd(1, def.gemMax || 1) : 0;
    // nông sản ngẫu nhiên vào kho (kho đầy → bán nửa giá)
    const inventory = parseJSON(farm.inventory, {});
    const n = Math.round(rnd(def.produce[0], def.produce[1]) * mult);
    const room = Math.max(0, farm.barnCapacity - Object.values(inventory).reduce((a, b) => a + b, 0));
    const got = {}; let overflow = 0;
    for (let i = 0; i < n; i++) {
      const k = C.CROP_KEYS[Math.floor(Math.random() * C.CROP_KEYS.length)];
      if (i < room) { inventory[k] = (inventory[k] || 0) + 1; got[k] = (got[k] || 0) + 1; }
      else overflow += Math.floor((C.PRODUCE_PRICE[k] || 4) * C.BARN_FULL_SELL_RATE);
    }
    coins += overflow;
    // từ mới: chọn từ trong kho hạt giống mà học viên chưa có
    const today = C.vnDay();
    if (st.day !== today) { st.day = today; st.words = 0; }
    const allowed = Math.max(0, Math.min(def.words, C.PET_TRIP_WORDS_PER_DAY - (st.words || 0)));
    let picks = [];
    if (allowed > 0) {
      const have = await prisma.userVocabProgress.findMany({ where: { userId }, select: { vocab: { select: { word: true } } } });
      const owned = new Set(have.map((h) => String(h.vocab.word).toLowerCase()));
      const pool = ALL_SEED_WORDS.filter((w) => !owned.has(w.word.toLowerCase()));
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      picks = pool.slice(0, allowed);
    }
    st.active = null; st.words = (st.words || 0) + picks.length;
    // khoá lạc quan: gọi song song chỉ 1 lần thành công (không nhân đôi thưởng)
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { coins: { increment: coins }, gems: { increment: gems }, inventory: JSON.stringify(inventory), petXp: { increment: def.petXp }, petTrip: st } });
    if (r.count === 0) return res.status(409).json({ error: 'Vừa có thay đổi khác, bấm lại nhé' });
    const words = [];
    for (const w of picks) {
      try { await prisma.vocabItem.create({ data: { word: w.word, meaning: w.meaning, example: w.example || null, addedByUserId: userId, progress: { create: { userId } } } }); words.push({ word: w.word, meaning: w.meaning, example: w.example || null }); }
      catch (e) { console.error('[farm] trip word', e.message); }
    }
    await bumpStats(userId, { trips: 1 });
    res.json(await buildState(userId, { tripResult: { tier: def.tier, name: def.name, coins, gems, produce: got, overflowCoins: overflow, words, petXp: def.petXp } }));
  } catch (e) { console.error('[farm] trip collect', e); res.status(500).json({ error: 'Không nhận được quà' }); }
});

router.post('/pet/pat', async (req, res) => {
  try {
    const { userId } = req.body; const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    await prisma.farmState.update({ where: { userId }, data: { petPats: { increment: 1 }, petXp: { increment: C.PET_PAT_XP } } });
    res.json({ ok: true, petXp: farm.petXp + C.PET_PAT_XP, petPats: farm.petPats + 1, petLevel: C.petLevelFor(farm.petXp + C.PET_PAT_XP) });
  } catch (e) { res.status(500).json({ error: 'Lỗi' }); }
});
router.post('/pet/rename', async (req, res) => {
  try {
    const { userId, name } = req.body; const n = String(name || '').trim().slice(0, 16);
    if (!n) return res.status(400).json({ error: 'Tên không hợp lệ' });
    await prisma.farmState.update({ where: { userId }, data: { petName: n } });
    res.json(await buildState(userId));
  } catch (e) { res.status(500).json({ error: 'Không đổi tên được' }); }
});

// Vòng quay may mắn (1 lần/ngày) — server chọn kết quả theo tỉ lệ, client chỉ quay tới ô đó
router.post('/spin', async (req, res) => {
  try {
    const { userId } = req.body; const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const today = C.vnDay();
    if (farm.spunOn === today) return res.status(400).json({ error: 'Hôm nay bạn đã quay rồi, mai quay tiếp nhé!' });
    const total = C.WHEEL.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * total; let seg = C.WHEEL[0];
    for (const w of C.WHEEL) { r -= w.weight; if (r <= 0) { seg = w; break; } }
    const data = { spunOn: today };
    let decorKey = null;
    if (seg.kind === 'coins') data.coins = { increment: seg.value };
    if (seg.kind === 'gems') data.gems = { increment: seg.value };
    if (seg.kind === 'boost') data.boostHarvests = { increment: seg.value };
    if (seg.kind === 'decor') {
      // Đặt quà vào ô trống đầu tiên; hết chỗ thì quy ra xu
      const plots = await prisma.farmPlot.findMany({ where: { userId }, select: { x: true, y: true } });
      const occ = occupiedSet(farm, plots); let spot = null;
      outer: for (let y = 0; y < farm.gridH; y++) for (let x = 0; x < farm.gridW; x++) if (!occ.has(`${x},${y}`)) { spot = { x, y }; break outer; }
      decorKey = C.WHEEL_DECOR_POOL[Math.floor(Math.random() * C.WHEEL_DECOR_POOL.length)];
      if (spot) { const layout = parseJSON(farm.layout, []); layout.push({ uid: crypto.randomUUID(), key: decorKey, ...spot }); data.layout = JSON.stringify(layout); }
      else data.coins = { increment: C.DECOR[decorKey].price };
    }
    await prisma.farmState.update({ where: { userId }, data });
    await bumpStats(userId, { spins: 1 });
    res.json(await buildState(userId, { spin: { segmentId: seg.id, label: seg.label, kind: seg.kind, value: seg.value, decorKey } }));
  } catch (e) { console.error('[farm] spin', e); res.status(500).json({ error: 'Không quay được' }); }
});

// Bạn bè toàn app (mọi học viên đã mở nông trại), nhóm theo lớp: lớp của tôi trước, rồi lớp khác, rồi học viên tự do.
// Không cần tham gia lớp vẫn chơi/thăm được.
router.get('/neighbors/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const today = C.vnDay();
    const [me, farms, visits] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { classroomsJoined: { select: { id: true } } } }),
      prisma.farmState.findMany({
        where: { userId: { not: userId }, user: { role: 'STUDENT' } },
        select: { userId: true, harvestCount: true, petName: true, petXp: true, barnCount: true, wardrobe: true, updatedAt: true,
          user: { select: { name: true, streakCount: true, classroomsJoined: { select: { id: true, name: true } } } } },
        orderBy: { harvestCount: 'desc' }, take: 300,
      }),
      prisma.farmVisit.findMany({ where: { fromId: userId, day: today }, select: { toId: true, type: true } }),
    ]);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const myClasses = new Set(me.classroomsJoined.map((c) => c.id));
    const groups = new Map(); // classroomId|FREE → { id, name, mine, members[] }
    for (const f of farms) {
      const entry = {
        id: f.userId, name: f.user.name, level: C.levelFor(f.harvestCount), harvestCount: f.harvestCount, barnCount: f.barnCount, petName: f.petName,
        petLevel: C.petLevelFor(f.petXp), streak: f.user.streakCount, equipped: (parseJSON(f.wardrobe, {}).equipped) || {}, lastActive: f.updatedAt,
        likedToday: visits.some((v) => v.toId === f.userId && v.type === 'LIKE'), giftedToday: visits.some((v) => v.toId === f.userId && v.type === 'GIFT'),
      };
      const cls = f.user.classroomsJoined.length ? f.user.classroomsJoined : [{ id: 'FREE', name: 'Học viên tự do' }];
      for (const c of cls) {
        if (!groups.has(c.id)) groups.set(c.id, { id: c.id, name: c.name, mine: myClasses.has(c.id), members: [] });
        groups.get(c.id).members.push(entry);
      }
    }
    const list = [...groups.values()].sort((a, b) => (b.mine ? 1 : 0) - (a.mine ? 1 : 0) || (a.id === 'FREE' ? 1 : 0) - (b.id === 'FREE' ? 1 : 0) || a.name.localeCompare(b.name));
    const giftsLeft = C.VISIT_GIFTS_PER_DAY - visits.filter((v) => v.type === 'GIFT').length;
    res.json({ groups: list, total: farms.length, giftsLeft: Math.max(0, giftsLeft), hasClassroom: myClasses.size > 0 });
  } catch (e) { console.error('[farm] neighbors', e); res.status(500).json({ error: 'Không tải được danh sách bạn' }); }
});

// Xem nông trại của bạn (chỉ đọc)
router.get('/visit/:userId/:targetId', async (req, res) => {
  try {
    const { userId, targetId } = req.params;
    const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, name: true, totalXP: true, streakCount: true, role: true } });
    if (!target || target.role !== 'STUDENT') return res.status(404).json({ error: 'Không tìm thấy' });
    const [farm, plots, likes] = await Promise.all([
      prisma.farmState.findUnique({ where: { userId: targetId } }),
      prisma.farmPlot.findMany({ where: { userId: targetId }, include: PROGRESS_INCLUDE }),
      prisma.farmVisit.count({ where: { toId: targetId, type: 'LIKE' } }),
    ]);
    if (!farm) return res.status(404).json({ error: 'Bạn này chưa mở nông trại' });
    const now = new Date();
    res.json({ now, owner: { id: target.id, name: target.name, totalXP: target.totalXP, streakCount: target.streakCount }, farm: farmView(farm, plots.length), plots: plots.map((p) => plotView(p, now)), likes, catalog: C.publicCatalog() });
  } catch (e) { console.error('[farm] visit', e); res.status(500).json({ error: 'Không thăm được' }); }
});

// Thích / tặng quà: { userId, targetId, type: 'LIKE'|'GIFT' } — mỗi loại 1 lần/ngày/bạn
router.post('/visit/react', async (req, res) => {
  try {
    const { userId, targetId, type } = req.body;
    if (!['LIKE', 'GIFT'].includes(type) || userId === targetId) return res.status(400).json({ error: 'Không hợp lệ' });
    const today = C.vnDay();
    const [farm, targetFarm, giftsToday] = await Promise.all([
      prisma.farmState.findUnique({ where: { userId } }), prisma.farmState.findUnique({ where: { userId: targetId } }),
      prisma.farmVisit.count({ where: { fromId: userId, day: today, type: 'GIFT' } }),
    ]);
    if (!farm || !targetFarm) return res.status(404).json({ error: 'Chưa có nông trại' });
    if (type === 'GIFT') {
      if (giftsToday >= C.VISIT_GIFTS_PER_DAY) return res.status(400).json({ error: 'Hôm nay bạn đã tặng đủ 3 món quà' });
      if (farm.coins < C.VISIT_GIFT_COST) return res.status(400).json({ error: 'Không đủ xu để tặng' });
    }
    try { await prisma.farmVisit.create({ data: { fromId: userId, toId: targetId, day: today, type } }); }
    catch (e) { if (e.code === 'P2002') return res.status(400).json({ error: type === 'LIKE' ? 'Bạn đã thích hôm nay rồi' : 'Bạn đã tặng quà cho bạn này hôm nay' }); throw e; }
    const reward = type === 'LIKE' ? C.VISIT_LIKE_REWARD : C.VISIT_GIFT_REWARD;
    await Promise.all([
      prisma.farmState.update({ where: { userId: targetId }, data: { coins: { increment: reward } } }),
      type === 'GIFT' ? prisma.farmState.update({ where: { userId }, data: { coins: { decrement: C.VISIT_GIFT_COST } } }) : null,
      bumpStats(userId, type === 'LIKE' ? { likes: 1 } : { gifts: 1 }),
    ]);
    res.json({ ok: true, type, reward });
  } catch (e) { console.error('[farm] react', e); res.status(500).json({ error: 'Lỗi' }); }
});

// ── Kho nông sản ─────────────────────────────────────────────────────────────
// Bán nông sản: { userId, cropKey, qty }
router.post('/barn/sell', async (req, res) => {
  try {
    const { userId, cropKey } = req.body; const qty = Math.max(1, parseInt(req.body.qty, 10) || 1);
    const farm = await getOrCreateFarm(userId);
    if (!farm || !C.PRODUCE_PRICE[cropKey]) return res.status(400).json({ error: 'Nông sản không hợp lệ' });
    const inventory = parseJSON(farm.inventory, {});
    if ((inventory[cropKey] || 0) < qty) return res.status(400).json({ error: 'Kho không đủ số lượng' });
    inventory[cropKey] -= qty; if (inventory[cropKey] <= 0) delete inventory[cropKey];
    const coins = qty * C.PRODUCE_PRICE[cropKey];
    await Promise.all([prisma.farmState.update({ where: { userId }, data: { inventory: JSON.stringify(inventory), coins: { increment: coins } } }), bumpStats(userId, { sold: qty })]);
    res.json(await buildState(userId, { sold: { key: cropKey, qty, refund: coins, currency: 'coins' } }));
  } catch (e) { console.error('[farm] barn sell', e); res.status(500).json({ error: 'Không bán được' }); }
});
// Nâng cấp sức chứa kho
router.post('/barn/upgrade', async (req, res) => {
  try {
    const { userId } = req.body; const farm = await getOrCreateFarm(userId);
    if (!farm) return res.status(404).json({ error: 'User not found' });
    const idx = Math.max(0, C.BARN_TIERS.findIndex((t) => t.capacity === farm.barnCapacity));
    const next = C.BARN_TIERS[idx + 1];
    if (!next) return res.status(400).json({ error: 'Kho đã lớn tối đa' });
    if (farm.coins < next.price) return res.status(400).json({ error: 'Không đủ xu' });
    await prisma.farmState.update({ where: { userId }, data: { coins: { decrement: next.price }, barnCapacity: next.capacity } });
    res.json(await buildState(userId, { bought: { itemKey: 'barn', price: next.price, currency: 'coins' } }));
  } catch (e) { console.error('[farm] barn upgrade', e); res.status(500).json({ error: 'Không nâng cấp được' }); }
});
// Ôn kho từ: 5 từ MASTERED ngẫu nhiên (gõ từ theo nghĩa) — không đổi lịch SRS, chỉ thưởng xu (giới hạn/ngày)
router.get('/barn/quiz/:userId', async (req, res) => {
  try {
    const rows = await prisma.userVocabProgress.findMany({ where: { userId: req.params.userId, status: 'MASTERED' }, select: { id: true, vocab: { select: { word: true, meaning: true, example: true } } } });
    const pick = shuffle(rows).slice(0, C.BARN_QUIZ.size);
    res.json({ items: pick.map((r) => ({ progressId: r.id, meaning: r.vocab.meaning, hint: hintMask(r.vocab.word), example: r.vocab.example && new RegExp(r.vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(r.vocab.example) ? r.vocab.example.replace(new RegExp(r.vocab.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____') : null })), total: rows.length });
  } catch (e) { console.error('[farm] barn quiz', e); res.status(500).json({ error: 'Không tạo được bài ôn' }); }
});
router.post('/barn/quiz/answer', async (req, res) => {
  try {
    const { userId, progressId, answer } = req.body;
    const [row, farm] = await Promise.all([
      prisma.userVocabProgress.findFirst({ where: { id: progressId, userId }, select: { vocab: { select: { word: true, meaning: true, example: true } } } }),
      prisma.farmState.findUnique({ where: { userId } }),
    ]);
    if (!row || !farm) return res.status(404).json({ error: 'Không tìm thấy từ' });
    const correct = clean(answer) === clean(row.vocab.word) || (clean(answer) && levenshtein(clean(answer), clean(row.vocab.word)) <= 1);
    const today = C.vnDay();
    const used = farm.barnQuizOn === today ? farm.barnQuizCount : 0;
    const rewarded = correct && used < C.BARN_QUIZ.dailyRewarded;
    const coins = rewarded ? C.BARN_QUIZ.coinsPerCorrect : 0;
    if (correct) await Promise.all([prisma.farmState.update({ where: { userId }, data: { barnQuizOn: today, barnQuizCount: used + (rewarded ? 1 : 0), coins: { increment: coins } } }), bumpStats(userId, { quizCorrect: 1 })]);
    res.json({ correct, coins, word: row.vocab.word, meaning: row.vocab.meaning, example: row.vocab.example, left: Math.max(0, C.BARN_QUIZ.dailyRewarded - used - (rewarded ? 1 : 0)) });
  } catch (e) { console.error('[farm] barn quiz answer', e); res.status(500).json({ error: 'Lỗi' }); }
});

// ── Trang phục Qilin ─────────────────────────────────────────────────────────
router.post('/wardrobe/buy', async (req, res) => {
  try {
    const { userId, key } = req.body; const item = C.OUTFITS[key];
    const farm = await getOrCreateFarm(userId);
    if (!farm || !item) return res.status(400).json({ error: 'Trang phục không tồn tại' });
    const w = parseJSON(farm.wardrobe, {}); w.owned = w.owned || []; w.equipped = w.equipped || {};
    if (w.owned.includes(key)) return res.status(400).json({ error: 'Bạn đã có món này rồi' });
    if (C.levelFor(farm.harvestCount) < item.minLevel) return res.status(400).json({ error: `Cần cấp ${item.minLevel}` });
    if (farm[item.currency] < item.price) return res.status(400).json({ error: item.currency === 'gems' ? 'Không đủ kim cương' : 'Không đủ xu' });
    w.owned.push(key); w.equipped[item.slot] = key; // mua xong mặc luôn
    await prisma.farmState.update({ where: { userId }, data: { [item.currency]: { decrement: item.price }, wardrobe: JSON.stringify(w) } });
    res.json(await buildState(userId, { bought: { itemKey: key, price: item.price, currency: item.currency } }));
  } catch (e) { console.error('[farm] wardrobe buy', e); res.status(500).json({ error: 'Không mua được' }); }
});
// Bán lại trang phục (rất lỗ, hoàn bằng xu); đang mặc thì tự cởi ra
router.post('/wardrobe/sell', async (req, res) => {
  try {
    const { userId, key } = req.body; const item = C.OUTFITS[key];
    const farm = await getOrCreateFarm(userId);
    if (!farm || !item) return res.status(400).json({ error: 'Trang phục không tồn tại' });
    const w = parseJSON(farm.wardrobe, {}); w.owned = w.owned || []; w.equipped = w.equipped || {};
    if (!w.owned.includes(key)) return res.status(400).json({ error: 'Bạn chưa có món này' });
    w.owned = w.owned.filter((k) => k !== key);
    if (w.equipped[item.slot] === key) delete w.equipped[item.slot];
    const refund = C.sellValue(item);
    await prisma.farmState.update({ where: { userId }, data: { coins: { increment: refund }, wardrobe: JSON.stringify(w) } });
    res.json(await buildState(userId, { sold: { key, refund, currency: 'coins' } }));
  } catch (e) { console.error('[farm] wardrobe sell', e); res.status(500).json({ error: 'Không bán được' }); }
});
// Mặc/cởi: { userId, slot, key | null }
router.post('/wardrobe/equip', async (req, res) => {
  try {
    const { userId, slot, key } = req.body;
    const farm = await getOrCreateFarm(userId);
    if (!farm || !C.OUTFIT_SLOTS.some((s) => s.id === slot)) return res.status(400).json({ error: 'Không hợp lệ' });
    const w = parseJSON(farm.wardrobe, {}); w.owned = w.owned || []; w.equipped = w.equipped || {};
    if (key) { if (!w.owned.includes(key) || C.OUTFITS[key]?.slot !== slot) return res.status(400).json({ error: 'Bạn chưa có món này' }); w.equipped[slot] = key; }
    else delete w.equipped[slot];
    await prisma.farmState.update({ where: { userId }, data: { wardrobe: JSON.stringify(w) } });
    res.json(await buildState(userId));
  } catch (e) { console.error('[farm] wardrobe equip', e); res.status(500).json({ error: 'Không đổi được' }); }
});

// ── Nhiệm vụ hằng ngày & thành tựu ───────────────────────────────────────────
// Khoá lạc quan theo updatedAt: 2 yêu cầu nhận thưởng song song chỉ 1 cái thành công (không nhận đúp).
router.post('/quests/claim', async (req, res) => {
  try {
    const { userId, id } = req.body;
    const base = await getOrCreateFarm(userId);
    if (!base) return res.status(404).json({ error: 'User not found' });
    const { farm, daily } = await ensureDaily(base);
    const view = questsView(farm, daily);
    let reward;
    if (id === 'CHEST') { if (!view.chest.ready) return res.status(400).json({ error: 'Cần nhận đủ 4 nhiệm vụ trước' }); reward = view.chest.reward; }
    else {
      const q = view.items.find((x) => x.id === id);
      if (!q) return res.status(404).json({ error: 'Nhiệm vụ không tồn tại' });
      if (q.claimed) return res.status(400).json({ error: 'Bạn đã nhận thưởng nhiệm vụ này' });
      if (!q.done) return res.status(400).json({ error: 'Nhiệm vụ chưa hoàn thành' });
      reward = q.reward;
    }
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { coins: { increment: reward.coins }, gems: { increment: reward.gems }, daily: { ...daily, claimed: [...(daily.claimed || []), id] } } });
    if (r.count !== 1) return res.status(409).json({ error: 'Đang xử lý, thử lại nhé' });
    if (reward.xp) await prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: reward.xp } }, select: { id: true } });
    res.json(await buildState(userId, { claimedReward: { kind: id === 'CHEST' ? 'CHEST' : 'QUEST', name: id === 'CHEST' ? 'Rương nhiệm vụ' : view.items.find((x) => x.id === id).label, ...reward } }));
  } catch (e) { console.error('[farm] quest claim', e); res.status(500).json({ error: 'Không nhận được thưởng' }); }
});
router.post('/achievements/claim', async (req, res) => {
  try {
    const { userId, groupId } = req.body;
    const [farm, user] = await Promise.all([getOrCreateFarm(userId), prisma.user.findUnique({ where: { id: userId }, select: { id: true, streakCount: true } })]);
    const g = C.ACHIEVEMENTS.find((x) => x.id === groupId);
    if (!farm || !g) return res.status(400).json({ error: 'Thành tựu không tồn tại' });
    const claimedMap = jsonObj(jsonObj(farm.achievements).claimed); const got = claimedMap[g.id] || 0;
    const value = C.statValue(g.stat, { farm, user });
    let n = got, coins = 0, gems = 0;
    while (n < g.tiers.length && value >= g.tiers[n][0]) { coins += g.tiers[n][1]; gems += g.tiers[n][2]; n++; }
    if (n === got) return res.status(400).json({ error: 'Chưa đạt mốc nào để nhận' });
    const r = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm.updatedAt }, data: { coins: { increment: coins }, gems: { increment: gems }, achievements: { claimed: { ...claimedMap, [g.id]: n } } } });
    if (r.count !== 1) return res.status(409).json({ error: 'Đang xử lý, thử lại nhé' });
    res.json(await buildState(userId, { claimedReward: { kind: 'ACHIEVEMENT', name: g.name, coins, gems, xp: 0, tiers: n - got } }));
  } catch (e) { console.error('[farm] achievement claim', e); res.status(500).json({ error: 'Không nhận được thưởng' }); }
});

// Bảng vàng nông dân: top 20 theo số lần thu hoạch đúng (scope=all | class), kèm hạng của mình
router.get('/leaderboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params; const scope = req.query.scope === 'class' ? 'class' : 'all';
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { classroomsJoined: { select: { id: true } } } });
    if (!me) return res.status(404).json({ error: 'User not found' });
    const classIds = me.classroomsJoined.map((c) => c.id);
    const userWhere = scope === 'class' ? { role: 'STUDENT', classroomsJoined: { some: { id: { in: classIds } } } } : { role: 'STUDENT' };
    const where = { user: userWhere };
    const myFarm = await prisma.farmState.findUnique({ where: { userId }, select: { harvestCount: true, ordersDone: true, barnCount: true, petName: true, petXp: true, wardrobe: true } });
    const [rows, total, ahead] = await Promise.all([
      prisma.farmState.findMany({ where, orderBy: [{ harvestCount: 'desc' }, { ordersDone: 'desc' }], take: 20,
        select: { userId: true, harvestCount: true, ordersDone: true, barnCount: true, petName: true, petXp: true, wardrobe: true, user: { select: { name: true, streakCount: true } } } }),
      prisma.farmState.count({ where }),
      myFarm ? prisma.farmState.count({ where: { ...where, harvestCount: { gt: myFarm.harvestCount } } }) : Promise.resolve(0),
    ]);
    const row = (f, i) => ({ rank: i, id: f.userId, name: f.user.name, level: C.levelFor(f.harvestCount), harvestCount: f.harvestCount, orders: f.ordersDone, barnCount: f.barnCount, petName: f.petName, petLevel: C.petLevelFor(f.petXp), streak: f.user.streakCount, equipped: parseJSON(f.wardrobe, {}).equipped || {}, isMe: f.userId === userId });
    res.json({ scope, total, top: rows.map((f, i) => row(f, i + 1)), myRank: myFarm ? ahead + 1 : null, hasClassroom: classIds.length > 0 });
  } catch (e) { console.error('[farm] leaderboard', e); res.status(500).json({ error: 'Không tải được bảng vàng' }); }
});

module.exports = router;
