// Bố cục LÀNG QUÊ bao quanh nông trại — thuần dữ liệu, tính theo kích thước đất (W×H), không lưu server.
// Toạ độ ô giống nông trại: đất của bạn là [0,W)×[0,H); làng nằm ở toạ độ âm / lớn hơn W,H.
// Nhìn từ góc nhìn isometric: "phía sau" (trên màn hình) là y<0 và x<0, "phía trước" là x>W, y>H.
//
//  Đường Làng A (nhựa) chạy dọc y=-3, đường B (nhựa) chạy dọc x=-3 — nhà cửa/cửa hàng nằm PHÍA SAU hai đường này nên xe và dân làng
//  luôn đi ở phía trước các toà nhà (không bị che sai thứ tự). Đường đất C (y=H+2) và D (x=W+2) khép thành vòng quanh nông trại.
export const WORLD_M = 9; // số ô làng mở rộng ra mỗi phía quanh đất nông trại

export type VenueId = "post" | "market" | "store" | "school" | "diner" | "hall" | "depot" | "library" | "vet" | "fair" | "gate" | "board";
export type BKind = "post" | "market" | "store" | "school" | "diner" | "hall" | "depot" | "library" | "vet" | "fair" | "house" | "cottage" | "barn" | "silo" | "windmill";
export type Zone = "back" | "mid" | "near" | "far";

export type VBuilding = { id: string; kind: BKind; venue?: VenueId; x: number; y: number; name: string; en: string; hint: string; zone: Zone };
export type VProp = { id: string; kind: "tree" | "pine" | "bush" | "lamp" | "hay" | "rock" | "board" | "gatepost" | "bench" | "fountain" | "flowers" | "stall" | "crate"; x: number; y: number; venue?: VenueId; zone: Zone; s: number; name?: string; en?: string; hint?: string };
export type VPatch = { id: string; kind: "road" | "dirt" | "walk" | "plaza" | "field" | "pond" | "orchard" | "yard"; x: number; y: number; w: number; h: number; variant?: number; dir?: "x" | "y" };
export type VLane = { id: string; axis: "x" | "y"; at: number; from: number; to: number; zone: Zone; surface: "road" | "dirt" };
export type VVehicle = { id: string; kind: "car" | "pickup" | "truck" | "tractor" | "bus" | "van"; lane: string; sign: 1 | -1; dur: number; delay: number; color: string };
export type VPerson = { id: string; name: string; role: string; look: string; kind: "walk" | "sit"; lane: string; dur: number; delay: number; shirt: string; hat?: string; zone: Zone };

const hash = (x: number, y: number, k = 0) => { let h = (Math.imul(x + 101, 374761393) + Math.imul(y + 211, 668265263) + Math.imul(k + 7, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
export const rand01 = (x: number, y: number, k = 0) => (hash(x, y, k) % 10000) / 10000;

/** Vùng vẽ (thứ tự che nhau) của 1 vật cố định tại ô (x,y) — xem ghi chú đầu file */
export function zoneOf(x: number, y: number, W: number, H: number): Zone {
  if (y < -3 || x < -3) return "back";
  if (y > H + 2 || x > W + 2) return "far";
  if (y < 0 || x < 0) return "mid";
  return "near";
}

export const BUILDING_INFO: Record<VenueId, { name: string; en: string; hint: string; icon: string }> = {
  post: { name: "Bưu điện", en: "Post Office", hint: "Viết thư tiếng Anh cho bạn cùng lớp", icon: "✉️" },
  market: { name: "Chợ làng", en: "Village Market", hint: "Bán nông sản theo giá chợ mỗi ngày", icon: "🧺" },
  store: { name: "Tạp hóa", en: "General Store", hint: "Mua đồ trang trí, trang phục", icon: "🛍️" },
  school: { name: "Trường làng", en: "Village School", hint: "Học nói tiếng Anh với cô giáo Mai", icon: "🏫" },
  diner: { name: "Quán ăn", en: "Country Diner", hint: "Luyện gọi món bằng tiếng Anh", icon: "🍜" },
  hall: { name: "Đình làng", en: "Town Hall", hint: "Nhiệm vụ, thành tựu, bảng vàng", icon: "🏛️" },
  depot: { name: "Kho vận", en: "Freight Depot", hint: "Kho nông sản và nâng cấp kho", icon: "🚚" },
  library: { name: "Thư viện", en: "Library", hint: "Ôn lại các từ đã thuộc", icon: "📚" },
  vet: { name: "Trạm thú y", en: "Pet Clinic", hint: "Chăm sóc Qilin", icon: "🐾" },
  fair: { name: "Lều hội chợ", en: "Fair Tent", hint: "Vòng quay may mắn mỗi ngày", icon: "🎪" },
  gate: { name: "Cổng làng", en: "Village Gate", hint: "Thăm nông trại của bạn bè", icon: "🚪" },
  board: { name: "Bảng tin", en: "Notice Board", hint: "Đơn hàng của dân làng", icon: "📌" },
};

const A_SLOTS = [-1, 2, 5, 8, 11, 14, 17];       // x0 của nhà dọc đường A (hàng y0 = -6)
const B_SLOTS = [0, 3, 6, 9, 12, 15];            // y0 của nhà dọc đường B (cột x0 = -6)
const A_KINDS: (VenueId | BKind)[] = ["post", "market", "store", "school", "depot", "barn", "cottage"];
const B_KINDS: (VenueId | BKind)[] = ["diner", "library", "vet", "fair", "house", "cottage"];

export type Village = {
  W: number; H: number; M: number;
  buildings: VBuilding[]; props: VProp[]; patches: VPatch[]; lanes: VLane[]; vehicles: VVehicle[]; people: VPerson[];
  ymid: number; xmid: number; // hàng/cột có lối vào nông trại
};

export function buildVillage(W: number, H: number): Village {
  const M = WORLD_M; const minX = -M, maxX = W + M - 1, minY = -M, maxY = H + M - 1;
  const xmid = Math.floor(W / 2), ymid = Math.floor(H / 2);
  const buildings: VBuilding[] = []; const props: VProp[] = []; const patches: VPatch[] = [];
  const taken = new Set<string>(); // ô đã có vật lớn (nhà, ruộng, ao, đường)
  const mark = (x: number, y: number, w = 1, h = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) taken.add(`${x + i},${y + j}`); };
  const free = (x: number, y: number, w = 1, h = 1) => { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) if (taken.has(`${x + i},${y + j}`)) return false; return x >= minX && y >= minY && x + w - 1 <= maxX && y + h - 1 <= maxY; };

  // Đất nông trại + sân trước + lối vào đều giữ trống
  mark(-2, -2, W + 4, H + 4);

  // ── Đường ───────────────────────────────────────────────────────────────────
  patches.push({ id: "roadA", kind: "road", x: minX, y: -3, w: maxX - minX + 1, h: 1, dir: "x" });
  patches.push({ id: "roadB", kind: "road", x: -3, y: minY, w: 1, h: maxY - minY + 1, dir: "y" });
  patches.push({ id: "roadC", kind: "dirt", x: -2, y: H + 2, w: maxX - -2 + 1, h: 1, dir: "x" });
  patches.push({ id: "roadD", kind: "dirt", x: W + 2, y: -2, w: 1, h: maxY - -2 + 1, dir: "y" });
  mark(minX, -3, maxX - minX + 1, 1); mark(-3, minY, 1, maxY - minY + 1); mark(-2, H + 2, maxX + 3, 1); mark(W + 2, -2, 1, maxY + 3);
  // vỉa hè phía nhà
  patches.push({ id: "walkA", kind: "walk", x: -4, y: -4, w: maxX + 5, h: 1, dir: "x" });
  patches.push({ id: "walkB", kind: "walk", x: -4, y: -3, w: 1, h: maxY + 4, dir: "y" });
  mark(-4, -4, maxX + 5, 1); mark(-4, -3, 1, maxY + 4);
  // vỉa hè phía trước (đường đất) + lối vào nông trại: từ đường A xuống cổng bắc, từ đường D vào cổng đông
  patches.push({ id: "walkC", kind: "walk", x: -2, y: H + 3, w: maxX + 3, h: 1, dir: "x" });
  patches.push({ id: "walkD", kind: "walk", x: W + 3, y: -2, w: 1, h: maxY + 3, dir: "y" });
  mark(-2, H + 3, maxX + 3, 1); mark(W + 3, -2, 1, maxY + 3);
  patches.push({ id: "gateN", kind: "dirt", x: xmid, y: -2, w: 1, h: 2, dir: "y" });
  patches.push({ id: "gateE", kind: "dirt", x: W, y: ymid, w: 2, h: 1, dir: "x" });
  patches.push({ id: "yard", kind: "yard", x: -2, y: -2, w: W + 4, h: H + 4 });

  // ── Quảng trường góc (đình làng + đài phun nước) ─────────────────────────────
  patches.push({ id: "plaza", kind: "plaza", x: -8, y: -8, w: 4, h: 4 });
  mark(-8, -8, 4, 4);
  buildings.push({ id: "hall", kind: "hall", venue: "hall", x: -7, y: -7, ...pick("hall"), zone: "back" });
  props.push({ id: "fountain", kind: "fountain", x: -5, y: -5, zone: "back", s: 1 });

  // ── Nhà dọc đường A (phía bắc) và đường B (phía tây) ─────────────────────────
  A_SLOTS.forEach((x0, i) => { if (x0 + 1 > maxX) return; place(A_KINDS[i % A_KINDS.length], x0, -6); });
  B_SLOTS.forEach((y0, i) => { if (y0 + 1 > maxY) return; place(B_KINDS[i % B_KINDS.length], -6, y0); });
  function place(k: VenueId | BKind, x: number, y: number) {
    const venue = (k in BUILDING_INFO ? (k as VenueId) : undefined);
    const kind = (venue ?? k) as BKind;
    const info = venue ? BUILDING_INFO[venue] : DECOR_INFO[kind as "house" | "cottage" | "barn"];
    buildings.push({ id: `b-${x}-${y}`, kind, venue, x, y, name: info.name, en: info.en, hint: info.hint, zone: "back" });
    mark(x, y, 2, 2);
  }
  function pick(v: VenueId) { const i = BUILDING_INFO[v]; return { name: i.name, en: i.en, hint: i.hint }; }

  // ── Vật chức năng 1 ô: bảng tin + cổng làng (sân phía sau nông trại) ──────────
  props.push({ id: "board", kind: "board", venue: "board", x: xmid - 2, y: -2, zone: zoneOf(xmid - 2, -2, W, H), s: 1, ...BUILDING_INFO.board });
  props.push({ id: "gate", kind: "gatepost", venue: "gate", x: W, y: -2, zone: zoneOf(W, -2, W, H), s: 1, ...BUILDING_INFO.gate });

  // ── Đường phố: đèn, ghế, cây ven đường ──────────────────────────────────────
  for (let x = -2; x <= maxX; x += 4) if (free(x, -4)) { props.push({ id: `lampA${x}`, kind: "lamp", x, y: -4, zone: "back", s: 1 }); }
  for (let y = -1; y <= maxY; y += 4) props.push({ id: `lampB${y}`, kind: "lamp", x: -4, y, zone: "back", s: 1 });
  for (let x = 0; x <= maxX; x += 4) props.push({ id: `lampC${x}`, kind: "lamp", x, y: H + 3, zone: "far", s: 1 });
  for (let y = 1; y <= maxY; y += 4) props.push({ id: `lampD${y}`, kind: "lamp", x: W + 3, y, zone: "far", s: 1 });
  props.push({ id: "benchA", kind: "bench", x: 3, y: -4, zone: "back", s: 1 }, { id: "benchB", kind: "bench", x: -4, y: 4, zone: "back", s: 1 });
  // cây ven sân trước (trừ lối vào)
  for (let x = -1; x <= W; x++) if (x !== xmid && x !== xmid - 2 && x !== W && hash(x, 0, 3) % 3 === 0) props.push({ id: `ty${x}`, kind: "bush", x, y: -2, zone: "mid", s: 0.8 + rand01(x, 1) * 0.5 });

  // ── Ruộng, vườn cây, ao, rừng: phía đông (sau đường D), phía nam (sau đường C) và phía bắc xa ──
  const fieldAt = (x: number, y: number, w: number, h: number, variant: number) => { if (!free(x, y, w, h)) return; patches.push({ id: `f${x},${y}`, kind: "field", x, y, w, h, variant }); mark(x, y, w, h); };
  fieldAt(W + 4, -1, 4, 3, 0); fieldAt(W + 4, 3, 4, 3, 1); fieldAt(W + 4, 7, 4, 3, 2);
  fieldAt(-1, H + 4, 4, 3, 3); fieldAt(4, H + 4, 4, 3, 1); fieldAt(9, H + 4, 3, 3, 0);
  const pond = (x: number, y: number, w: number, h: number) => { if (!free(x, y, w, h)) return; patches.push({ id: `p${x},${y}`, kind: "pond", x, y, w, h }); mark(x, y, w, h); };
  pond(W + 4, H + 4, 3, 2); pond(-8, H + 2, 3, 3);
  const orchard = (x: number, y: number, w: number, h: number) => { if (!free(x, y, w, h)) return; patches.push({ id: `o${x},${y}`, kind: "orchard", x, y, w, h }); mark(x, y, w, h); };
  orchard(W + 4, -8, 4, 5);
  // công trình nông thôn phía sau ruộng
  const rural = (k: "barn" | "silo" | "windmill" | "cottage", x: number, y: number, w: number) => {
    if (!free(x, y, w, w)) return; const info = DECOR_INFO[k as "barn"] ?? DECOR_INFO.house;
    buildings.push({ id: `r-${x}-${y}`, kind: k, x, y, name: info.name, en: info.en, hint: info.hint, zone: zoneOf(x, y, W, H) }); mark(x, y, w, w);
  };
  rural("barn", W + 5, H + 7, 2); rural("windmill", W + 7, -4, 2); rural("silo", W + 4, H + 1, 1); rural("cottage", -8, H + 6, 2); rural("cottage", 7, H + 8, 2);

  // rừng + cây rải rác: mọi ô còn trống ngoài đường/nhà/ruộng (không đụng nông trại); mật độ cao ở rìa
  for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) {
    if (!free(x, y)) continue;
    const edge = Math.min(x - minX, maxX - x, y - minY, maxY - y);
    const r = rand01(x, y, 5); const dens = edge < 2 ? 0.7 : edge < 4 ? 0.35 : 0.13;
    if (r > dens) continue;
    const z = zoneOf(x, y, W, H);
    const t = rand01(x, y, 9);
    props.push({ id: `t${x},${y}`, kind: t < 0.55 ? "tree" : t < 0.8 ? "pine" : t < 0.9 ? "bush" : t < 0.96 ? "rock" : "hay", x, y, zone: z, s: 0.85 + rand01(x, y, 11) * 0.45 });
  }

  // ── Làn xe & dân làng ───────────────────────────────────────────────────────
  const lanes: VLane[] = [
    { id: "A", axis: "x", at: -3, from: minX - 0.5, to: maxX + 0.5, zone: "back", surface: "road" },
    { id: "B", axis: "y", at: -3, from: minY - 0.5, to: maxY + 0.5, zone: "back", surface: "road" },
    { id: "C", axis: "x", at: H + 2, from: -2.5, to: maxX + 0.5, zone: "far", surface: "dirt" },
    { id: "D", axis: "y", at: W + 2, from: -2.5, to: maxY + 0.5, zone: "far", surface: "dirt" },
    { id: "wA", axis: "x", at: -4, from: -3.5, to: maxX - 0.5, zone: "back", surface: "road" },
    { id: "wB", axis: "y", at: -4, from: -3.5, to: maxY - 0.5, zone: "back", surface: "road" },
    { id: "wC", axis: "x", at: H + 3, from: -1.5, to: maxX - 0.5, zone: "far", surface: "dirt" },
    { id: "wD", axis: "y", at: W + 3, from: -1.5, to: maxY - 0.5, zone: "far", surface: "dirt" },
    { id: "wY", axis: "x", at: -1, from: -1.5, to: W + 1.5, zone: "mid", surface: "dirt" },
  ];
  const vehicles: VVehicle[] = [
    { id: "vA1", kind: "car", lane: "A", sign: 1, dur: 26, delay: 0, color: "#ef4444" },
    { id: "vA2", kind: "tractor", lane: "A", sign: -1, dur: 62, delay: 14, color: "#16a34a" },
    { id: "vA3", kind: "truck", lane: "A", sign: 1, dur: 38, delay: 17, color: "#2563eb" },
    { id: "vA4", kind: "bus", lane: "A", sign: -1, dur: 44, delay: 5, color: "#f59e0b" },
    { id: "vB1", kind: "van", lane: "B", sign: 1, dur: 32, delay: 6, color: "#f8fafc" },
    { id: "vB2", kind: "pickup", lane: "B", sign: -1, dur: 36, delay: 20, color: "#0ea5e9" },
    { id: "vB3", kind: "car", lane: "B", sign: 1, dur: 28, delay: 24, color: "#a855f7" },
    { id: "vC1", kind: "tractor", lane: "C", sign: 1, dur: 58, delay: 3, color: "#dc2626" },
    { id: "vC2", kind: "pickup", lane: "C", sign: -1, dur: 40, delay: 22, color: "#65a30d" },
    { id: "vD1", kind: "truck", lane: "D", sign: -1, dur: 46, delay: 9, color: "#ea580c" },
    { id: "vD2", kind: "car", lane: "D", sign: 1, dur: 30, delay: 18, color: "#14b8a6" },
  ];
  const people: VPerson[] = [
    { id: "p1", name: "Bác Hưng", role: "farmer", look: "nông dân", kind: "walk", lane: "wA", dur: 70, delay: 0, shirt: "#65a30d", hat: "straw", zone: "back" },
    { id: "p2", name: "Cô Mai", role: "teacher", look: "cô giáo", kind: "walk", lane: "wA", dur: 56, delay: 24, shirt: "#ec4899", zone: "back" },
    { id: "p3", name: "Bé Nam", role: "kid", look: "cậu bé", kind: "walk", lane: "wB", dur: 44, delay: 8, shirt: "#0ea5e9", zone: "back" },
    { id: "p4", name: "Bà Tư", role: "grandma", look: "bà cụ", kind: "walk", lane: "wB", dur: 90, delay: 30, shirt: "#a78bfa", hat: "scarf", zone: "back" },
    { id: "p5", name: "Chú Tâm", role: "postman", look: "người đưa thư", kind: "walk", lane: "wA", dur: 62, delay: 40, shirt: "#2563eb", hat: "cap", zone: "back" },
    { id: "p6", name: "Anh Long", role: "fisher", look: "người câu cá", kind: "walk", lane: "wC", dur: 80, delay: 12, shirt: "#f59e0b", hat: "straw", zone: "far" },
    { id: "p7", name: "Chị Lan", role: "merchant", look: "người bán hàng", kind: "walk", lane: "wD", dur: 66, delay: 18, shirt: "#ef4444", hat: "scarf", zone: "far" },
    { id: "p8", name: "Bé Mia", role: "kid", look: "cô bé", kind: "walk", lane: "wD", dur: 50, delay: 33, shirt: "#f472b6", zone: "far" },
    { id: "p9", name: "Ông Sáu", role: "farmer", look: "ông lão", kind: "walk", lane: "wY", dur: 52, delay: 6, shirt: "#a16207", hat: "straw", zone: "mid" },
  ];
  return { W, H, M, buildings, props, patches, lanes, vehicles, people, ymid, xmid };
}

const DECOR_INFO = {
  house: { name: "Nhà dân", en: "Village House", hint: "Nhà của dân làng" },
  cottage: { name: "Nhà tranh", en: "Cottage", hint: "Nhà của dân làng" },
  barn: { name: "Kho rơm", en: "Barn", hint: "Kho rơm của làng" },
  silo: { name: "Tháp ngũ cốc", en: "Silo", hint: "Chứa lúa mì và ngô" },
  windmill: { name: "Cối xay gió", en: "Windmill", hint: "Xay bột cho cả làng" },
};

// ── Câu chào của dân làng (bấm vào để nghe + học) ──────────────────────────────
export const PHRASES: Record<string, [string, string][]> = {
  farmer: [["Good morning! The weather is nice today.", "Chào buổi sáng! Hôm nay trời đẹp quá."], ["My corn is ready to harvest.", "Ngô của tôi sắp thu hoạch được rồi."], ["Do you need any help with your farm?", "Bạn có cần giúp gì ở nông trại không?"]],
  teacher: [["Hello! Are you ready for the English class?", "Chào em! Em đã sẵn sàng cho giờ tiếng Anh chưa?"], ["Practice a little every day, and you will improve.", "Luyện tập một chút mỗi ngày là em sẽ tiến bộ."], ["Please speak slowly and clearly.", "Hãy nói chậm và rõ ràng nhé."]],
  kid: [["Hi! Can I play with your dragon?", "Chào bạn! Mình chơi với rồng của bạn được không?"], ["I am going to school.", "Mình đang đi học."], ["Look! A big red truck!", "Nhìn kìa! Một chiếc xe tải đỏ to!"]],
  grandma: [["Good afternoon, dear. How are you today?", "Chào cháu. Hôm nay cháu khỏe không?"], ["I am going to the market to buy some eggs.", "Bà đi chợ mua ít trứng."], ["Take care of your plants, dear.", "Nhớ chăm cây cho tốt nhé cháu."]],
  postman: [["I have a letter for you!", "Tôi có thư cho bạn đây!"], ["Please write back to your friends.", "Hãy viết thư trả lời bạn bè nhé."], ["The post office is over there.", "Bưu điện ở đằng kia."]],
  fisher: [["I caught three fish today.", "Hôm nay tôi câu được ba con cá."], ["The pond is very quiet.", "Cái ao rất yên tĩnh."], ["Would you like to try fishing?", "Bạn có muốn thử câu cá không?"]],
  merchant: [["Fresh vegetables! Come and buy!", "Rau tươi đây! Lại mua nào!"], ["How much is this? It is five coins.", "Cái này bao nhiêu? Năm đồng."], ["Do you want a bag?", "Bạn có cần túi không?"]],
};
