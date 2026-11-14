// Lớp gọi API cho Nông Trại Qilin (/farm). Mọi endpoint ghi đều trả về FarmState đầy đủ
// (kèm field phụ như `result`, `spin`...) để UI thay thế toàn bộ trạng thái, không tự tính thưởng.
export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type PlotStatus = "EMPTY" | "GROWING" | "READY";
export type PlotView = {
  id: string; x: number; y: number; cropKey: string | null; plantedAt: string | null;
  status: PlotStatus; growth?: number; readyAt?: string; wilted?: boolean;
  progressId?: string; word?: string; meaning?: string; phonetic?: string | null; example?: string | null; pos?: string | null;
  srs?: { status: string; repetitions: number; interval: number };
};
export type OrderView = {
  id: string; kind: "HARVEST" | "HARVEST_CROP" | "PLANT" | "SENTENCE" | "PRODUCE"; customer: string; title: string;
  requirement: { need?: number; cropKey?: string; words?: string[]; minWords?: number; items?: Record<string, number> };
  progress: number; need: number; ready: boolean; have?: Record<string, number>;
  rewardCoins: number; rewardGems: number; rewardXp: number; createdAt: string;
};
export type DecorPlaced = { uid: string; key: string; x: number; y: number };
export type FarmView = {
  coins: number; gems: number; gridW: number; gridH: number; layout: DecorPlaced[];
  harvestCount: number; witherCount: number; barnCount: number;
  level: number; levelStart: number; nextLevelAt: number;
  plotCount: number; plotPrice: number | null; nextExpansion: { w: number; h: number; price: number; minLevel: number } | null;
  pet: { name: string; xp: number; level: number; fedToday: boolean; pats: number };
  canSpin: boolean; boostHarvests: number;
  inventory: Record<string, number>; barnCapacity: number; barnUsed: number; barnTier: number; nextBarnTier: { capacity: number; price: number } | null;
  wardrobe: { owned: string[]; equipped: Record<string, string> };
  ordersDone: number; orderDifficulty: number; barnQuizLeft: number;
};
export type OutfitItem = { name: string; emoji: string; slot: string; price: number; currency: "coins" | "gems"; minLevel: number };
export type DecorItem = { name: string; emoji: string; price: number; currency: "coins" | "gems"; minLevel: number; cat?: string };
export type Catalog = {
  crops: Record<string, { name: string; emoji: string }>;
  decor: Record<string, DecorItem>;
  decorCats: { id: string; name: string }[];
  outfits: Record<string, OutfitItem>;
  outfitSlots: { id: string; name: string }[];
  producePrice: Record<string, number>;
  barnTiers: { capacity: number; price: number }[];
  barnQuiz: { size: number; coinsPerCorrect: number; dailyRewarded: number };
  expansions: { w: number; h: number; price: number; minLevel: number }[];
  wheel: { id: number; label: string; kind: string }[];
  startPlots: number; maxPlots: number; firstGrowMinutes: number;
  harvestCoins: Record<string, number>; harvestXp: number; masteredBonus: { coins: number; gems: number }; barnBonus: { coins: number };
  orderTrashCost: number; decorSellRate: number; petLevels: number[]; petFeedReward: { coins: number; petXp: number };
  visit: { likeReward: number; giftReward: number; giftCost: number; giftsPerDay: number };
};
export type HarvestResult = {
  correct: boolean; quality: number; mode: string; word: string; meaning: string; example: string | null;
  coins: number; gems: number; xp: number; produce: number; produceKey: string | null; overflowSold: number; boosted: boolean; becameMastered: boolean; levelUp: number | null;
  srs: { status: string; interval: number };
};
export type Reward = { coins: number; gems: number; xp: number };
export type QuestItem = { id: string; stat: string; icon: string; label: string; target: number; progress: number; done: boolean; claimed: boolean; reward: Reward };
export type QuestsView = { day: string; items: QuestItem[]; chest: { reward: Reward; ready: boolean; claimed: boolean; progress: number; total: number }; claimable: number; resetAt: string };
export type AchTier = { target: number; reward: { coins: number; gems: number }; reached: boolean; claimed: boolean };
export type AchGroup = { id: string; icon: string; name: string; desc: string; value: number; tiers: AchTier[]; claimable: number; complete: boolean };
export type AchievementsView = { groups: AchGroup[]; claimable: number; completed: number; total: number };
export type LeaderRow = { rank: number; id: string; name: string; level: number; harvestCount: number; orders: number; barnCount: number; petName: string; petLevel: number; streak: number; equipped: Record<string, string>; isMe: boolean };
export type FarmState = {
  now: string; farm: FarmView; plots: PlotView[]; orders: OrderView[];
  user: { id: string; name: string; totalXP: number; streakCount: number }; catalog: Catalog;
  result?: HarvestResult;
  spin?: { segmentId: number; label: string; kind: string; value: number; decorKey: string | null };
  delivered?: { ok: boolean; title: string; customer: string; coins: number; gems: number; xp: number; feedback?: string; corrected?: string; ai?: boolean };
  bought?: { itemKey: string; price?: number; currency?: string };
  sold?: { key: string; refund: number; currency: string; qty?: number };
  stored?: { word: string; coins: number };
  fed?: { coins: number; petXp: number };
  planted?: { plotId: string; cropKey: string };
  quests: QuestsView; achievements: AchievementsView;
  claimedReward?: { kind: "QUEST" | "CHEST" | "ACHIEVEMENT"; name: string; coins: number; gems: number; xp: number; tiers?: number };
};
export type Question = {
  plotId: string; mode: "CHOICE" | "LISTEN" | "TYPE" | "FILL";
  meaning: string | null; hint: string | null; options: string[] | null; speak: string | null; sentence: string | null;
};
export type SeedDeckItem = { progressId: string; word: string; meaning: string; phonetic: string | null; example: string | null; pos: string | null; srs: { status: string; repetitions: number }; fromLesson: boolean };
export type SeedTopic = { id: string; name: string; desc: string; count: number; cropKey: string };
export type SeedTopicItem = { word: string; meaning: string; cefr: string; example: string; tier: string; inDeck: boolean; planted: boolean; progressId: string | null };
export type Neighbor = { id: string; name: string; level: number; harvestCount: number; barnCount: number; petName?: string; petLevel: number; streak: number; equipped: Record<string, string>; lastActive: string; likedToday: boolean; giftedToday: boolean };
export type NeighborGroup = { id: string; name: string; mine: boolean; members: Neighbor[] };
export type VisitView = { now: string; owner: { id: string; name: string; totalXP: number; streakCount: number }; farm: FarmView; plots: PlotView[]; likes: number; catalog: Catalog };
export type BarnQuizItem = { progressId: string; meaning: string; hint: string; example: string | null };
export type BarnItem = { progressId: string; word: string; meaning: string; phonetic: string | null; example: string | null; interval: number; onPlot: boolean };

export class FarmApiError extends Error {
  payload: any;
  constructor(message: string, payload?: any) { super(message); this.payload = payload; }
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new FarmApiError(data?.error || `Lỗi ${res.status}`, data);
  return data as T;
}
const post = <T,>(path: string, body: any) =>
  fetch(`${API}/api/farm${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => handle<T>(r));
const get = <T,>(path: string) => fetch(`${API}/api/farm${path}`).then((r) => handle<T>(r));

export const farmApi = {
  state: (userId: string) => get<FarmState>(`/state/${userId}`),
  seedsDeck: (userId: string) => get<{ items: SeedDeckItem[] }>(`/seeds/${userId}?source=deck`),
  seedTopics: (userId: string) => get<{ topics: SeedTopic[] }>(`/seeds/${userId}`),
  seedTopic: (userId: string, topic: string) => get<{ topic: { id: string; name: string; cropKey: string }; items: SeedTopicItem[] }>(`/seeds/${userId}?topic=${encodeURIComponent(topic)}`),
  plant: (userId: string, plotId: string, src: { progressId?: string; seed?: { topicId: string; word: string } }) => post<FarmState>("/plant", { userId, plotId, ...src }),
  question: (userId: string, plotId: string) => get<Question>(`/plots/${plotId}/question?userId=${userId}`),
  harvest: (userId: string, plotId: string, answer: string, usedHint: boolean) => post<FarmState>(`/plots/${plotId}/harvest`, { userId, answer, usedHint }),
  dig: (userId: string, plotId: string) => post<FarmState>(`/plots/${plotId}/dig`, { userId }),
  store: (userId: string, plotId: string) => post<FarmState>(`/plots/${plotId}/store`, { userId }),
  barn: (userId: string) => get<BarnItem[]>(`/barn/${userId}`),
  buy: (userId: string, itemKey: string, x?: number, y?: number) => post<FarmState>("/buy", { userId, itemKey, x, y }),
  move: (userId: string, kind: "plot" | "decor", id: string, x: number, y: number) => post<FarmState>("/move", { userId, kind, id, x, y }),
  sell: (userId: string, uid: string) => post<FarmState>("/sell", { userId, uid }),
  completeOrder: (userId: string, id: string, sentence?: string) => post<FarmState & { ok?: boolean; feedback?: string; corrected?: string }>(`/orders/${id}/complete`, { userId, sentence }),
  trashOrder: (userId: string, id: string) => post<FarmState>(`/orders/${id}/trash`, { userId }),
  feedPet: (userId: string) => post<FarmState>("/pet/feed", { userId }),
  patPet: (userId: string) => post<{ ok: boolean; petXp: number; petPats: number; petLevel: number }>("/pet/pat", { userId }),
  renamePet: (userId: string, name: string) => post<FarmState>("/pet/rename", { userId, name }),
  spin: (userId: string) => post<FarmState>("/spin", { userId }),
  neighbors: (userId: string) => get<{ groups: NeighborGroup[]; total: number; giftsLeft: number; hasClassroom: boolean }>(`/neighbors/${userId}`),
  barnSell: (userId: string, cropKey: string, qty: number) => post<FarmState>("/barn/sell", { userId, cropKey, qty }),
  barnUpgrade: (userId: string) => post<FarmState>("/barn/upgrade", { userId }),
  barnQuiz: (userId: string) => get<{ items: BarnQuizItem[]; total: number }>(`/barn/quiz/${userId}`),
  barnQuizAnswer: (userId: string, progressId: string, answer: string) => post<{ correct: boolean; coins: number; word: string; meaning: string; example: string | null; left: number }>("/barn/quiz/answer", { userId, progressId, answer }),
  claimQuest: (userId: string, id: string) => post<FarmState>("/quests/claim", { userId, id }),
  claimAchievement: (userId: string, groupId: string) => post<FarmState>("/achievements/claim", { userId, groupId }),
  leaderboard: (userId: string, scope: "all" | "class") => get<{ scope: string; total: number; top: LeaderRow[]; myRank: number | null; hasClassroom: boolean }>(`/leaderboard/${userId}?scope=${scope}`),
  wardrobeBuy: (userId: string, key: string) => post<FarmState>("/wardrobe/buy", { userId, key }),
  wardrobeEquip: (userId: string, slot: string, key: string | null) => post<FarmState>("/wardrobe/equip", { userId, slot, key }),
  visit: (userId: string, targetId: string) => get<VisitView>(`/visit/${userId}/${targetId}`),
  react: (userId: string, targetId: string, type: "LIKE" | "GIFT") => post<{ ok: boolean; type: string; reward: number }>("/visit/react", { userId, targetId, type }),
};

// Phát âm bằng giọng trình duyệt (cùng cách /phonetics, /pronunciation)
export function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window) || !text) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB"; u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === "en-GB") || voices.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch { /* trình duyệt không hỗ trợ — bỏ qua */ }
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "Chín rồi!";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} phút`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}g ${m % 60}p`;
  const d = Math.floor(h / 24);
  return `${d} ngày ${h % 24}g`;
}
