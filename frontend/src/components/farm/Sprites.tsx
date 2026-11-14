"use client";
import type { ReactNode } from "react";
// Sprite SVG cho Nông Trại Qilin: cây trồng theo giai đoạn, trang trí, thú cưng Qilin con.
// Mọi sprite vẽ quanh gốc (0,0) = chân cây/đáy vật, hướng lên trên (y âm).

export const TILE_W = 100;
export const TILE_H = 50;

// ── Cây trồng ────────────────────────────────────────────────────────────────
type CropProps = { cropKey: string | null; growth: number; ready: boolean; wilted?: boolean };

const CROP_COLOR: Record<string, { a: string; b: string }> = {
  sunflower: { a: "#fbbf24", b: "#78350f" }, wheat: { a: "#eab308", b: "#a16207" }, tomato: { a: "#ef4444", b: "#b91c1c" },
  corn: { a: "#facc15", b: "#65a30d" }, carrot: { a: "#f97316", b: "#16a34a" }, strawberry: { a: "#e11d48", b: "#fda4af" },
  pumpkin: { a: "#f97316", b: "#9a3412" }, grape: { a: "#7c3aed", b: "#4c1d95" },
};

function Leaf({ x, y, r, flip = false, color = "#22c55e" }: { x: number; y: number; r: number; flip?: boolean; color?: string }) {
  return <ellipse cx={x} cy={y} rx={r} ry={r * 0.45} fill={color} transform={`rotate(${flip ? 35 : -35} ${x} ${y})`} />;
}

function Sprout({ scale }: { scale: number }) {
  return (
    <g transform={`scale(${scale})`}>
      <path d="M0 0 C -1 -8, 1 -14, 0 -22" stroke="#15803d" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Leaf x={-7} y={-13} r={8} />
      <Leaf x={7} y={-17} r={8} flip />
    </g>
  );
}

function ReadyCrop({ cropKey }: { cropKey: string }) {
  const c = CROP_COLOR[cropKey] || CROP_COLOR.tomato;
  switch (cropKey) {
    case "sunflower":
      return (
        <g>
          <path d="M0 0 C -2 -14, 2 -28, 0 -44" stroke="#15803d" strokeWidth={3.5} fill="none" />
          <Leaf x={-9} y={-20} r={10} /><Leaf x={9} y={-28} r={10} flip />
          {Array.from({ length: 10 }).map((_, i) => <ellipse key={i} cx={0} cy={-55} rx={5} ry={11} fill={c.a} transform={`rotate(${i * 36} 0 -44)`} />)}
          <circle cx={0} cy={-44} r={8} fill={c.b} /><circle cx={-2} cy={-46} r={2} fill="#b45309" opacity={.7} />
        </g>
      );
    case "wheat":
      return (
        <g>
          {[-10, -3, 4, 11].map((x, i) => (
            <g key={i}>
              <path d={`M${x} 0 C ${x - 1} -12, ${x + 1} -24, ${x} -36`} stroke="#a16207" strokeWidth={2} fill="none" />
              {[0, 1, 2, 3].map((k) => <ellipse key={k} cx={x + (k % 2 ? 3 : -3)} cy={-38 + k * 4} rx={3} ry={5} fill={c.a} />)}
            </g>
          ))}
        </g>
      );
    case "tomato":
      return (
        <g>
          <path d="M0 0 C -2 -12, 2 -22, 0 -34" stroke="#15803d" strokeWidth={3} fill="none" />
          <Leaf x={-11} y={-14} r={11} /><Leaf x={11} y={-20} r={11} flip /><Leaf x={-8} y={-30} r={9} /><Leaf x={9} y={-33} r={9} flip />
          {[[-9, -10], [8, -16], [0, -26]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r={6.5} fill={c.a} /><circle cx={x - 2} cy={y - 2} r={2} fill="#fecaca" opacity={.7} /></g>)}
        </g>
      );
    case "corn":
      return (
        <g>
          <path d="M0 0 L0 -50" stroke="#15803d" strokeWidth={3.5} />
          <path d="M0 -14 C -14 -16, -18 -30, -12 -40" stroke="#16a34a" strokeWidth={4} fill="none" strokeLinecap="round" />
          <path d="M0 -20 C 14 -24, 18 -38, 12 -46" stroke="#16a34a" strokeWidth={4} fill="none" strokeLinecap="round" />
          <ellipse cx={7} cy={-32} rx={6} ry={13} fill={c.a} /><ellipse cx={7} cy={-32} rx={6} ry={13} fill="none" stroke={c.b} strokeWidth={1.5} />
          <path d="M3 -44 C 6 -50, 9 -50, 12 -44" stroke="#4d7c0f" strokeWidth={2} fill="none" />
        </g>
      );
    case "carrot":
      return (
        <g>
          <path d="M-7 -2 L0 -18 L7 -2 Z" fill={c.a} /><rect x={-7} y={-4} width={14} height={4} fill="#92400e" opacity={.6} />
          <path d="M0 -16 C -4 -26, -10 -30, -12 -36" stroke="#15803d" strokeWidth={2.5} fill="none" />
          <path d="M0 -16 C 0 -28, 2 -32, 1 -40" stroke="#15803d" strokeWidth={2.5} fill="none" />
          <path d="M0 -16 C 4 -26, 10 -30, 12 -36" stroke="#15803d" strokeWidth={2.5} fill="none" />
          <Leaf x={-10} y={-34} r={6} /><Leaf x={10} y={-34} r={6} flip /><Leaf x={1} y={-39} r={6} />
        </g>
      );
    case "strawberry":
      return (
        <g>
          <Leaf x={-12} y={-10} r={12} /><Leaf x={12} y={-10} r={12} flip /><Leaf x={0} y={-18} r={11} />
          {[[-10, -4], [9, -6], [0, -2]].map(([x, y], i) => (
            <g key={i}><path d={`M${x} ${y - 7} C ${x - 6} ${y - 6}, ${x - 6} ${y + 4}, ${x} ${y + 6} C ${x + 6} ${y + 4}, ${x + 6} ${y - 6}, ${x} ${y - 7} Z`} fill={c.a} /><circle cx={x - 2} cy={y - 1} r={.9} fill={c.b} /><circle cx={x + 2} cy={y + 2} r={.9} fill={c.b} /></g>
          ))}
        </g>
      );
    case "pumpkin":
      return (
        <g>
          <path d="M-20 -6 C -10 -16, 14 -4, 22 -14" stroke="#15803d" strokeWidth={2.5} fill="none" />
          <Leaf x={-18} y={-12} r={9} /><Leaf x={20} y={-18} r={9} flip />
          <ellipse cx={0} cy={-11} rx={17} ry={12} fill={c.a} /><ellipse cx={-7} cy={-11} rx={6} ry={11} fill="none" stroke={c.b} strokeWidth={1.4} opacity={.6} /><ellipse cx={7} cy={-11} rx={6} ry={11} fill="none" stroke={c.b} strokeWidth={1.4} opacity={.6} />
          <rect x={-2.5} y={-27} width={5} height={7} rx={1.5} fill="#4d7c0f" />
        </g>
      );
    case "grape":
    default:
      return (
        <g>
          <path d="M-14 0 L-14 -40 M14 0 L14 -40 M-16 -40 L16 -40" stroke="#92400e" strokeWidth={2.5} />
          <path d="M-14 -38 C -6 -34, 6 -44, 14 -38" stroke="#15803d" strokeWidth={2.5} fill="none" />
          <Leaf x={-8} y={-30} r={9} /><Leaf x={10} y={-34} r={9} flip />
          {[[0, -12], [-5, -19], [5, -19], [-9, -26], [0, -26], [9, -26]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.6} fill={c.a} stroke={c.b} strokeWidth={.8} />)}
        </g>
      );
  }
}

export function CropSprite({ cropKey, growth, ready, wilted }: CropProps) {
  if (wilted) {
    return (
      <g>
        <path d="M0 0 C -2 -8, 6 -12, 10 -14" stroke="#a16207" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Leaf x={8} y={-13} r={6} color="#ca8a04" flip /><Leaf x={-5} y={-7} r={5} color="#a16207" />
      </g>
    );
  }
  if (ready) return <g className="farm-sway"><ReadyCrop cropKey={cropKey || "tomato"} /></g>;
  if (growth < 0.3) return <g><ellipse cx={0} cy={-2} rx={7} ry={3} fill="#78350f" /><circle cx={0} cy={-5} r={2.2} fill="#fef3c7" /></g>;
  if (growth < 0.65) return <g className="farm-sway"><Sprout scale={0.75} /></g>;
  return <g className="farm-sway"><Sprout scale={1.25} /></g>;
}

// ── Ô đất / cỏ ───────────────────────────────────────────────────────────────
export function diamondPoints(cx: number, cy: number, w = TILE_W, h = TILE_H) {
  return `${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}`;
}

export function SoilTile({ cx, cy, ready }: { cx: number; cy: number; ready?: boolean }) {
  return (
    <g>
      <polygon points={diamondPoints(cx, cy, TILE_W - 8, TILE_H - 4)} fill="#8b5a2b" stroke="#6b4423" strokeWidth={1.5} />
      {[-10, 0, 10].map((o) => <line key={o} x1={cx - 30 + o * 1.2} y1={cy + o * 0.6} x2={cx + 30 + o * 1.2} y2={cy + o * 0.6 - 0} stroke="#6b4423" strokeWidth={1.2} opacity={.55} transform={`rotate(-26.5 ${cx} ${cy})`} />)}
      {ready && <polygon points={diamondPoints(cx, cy, TILE_W - 8, TILE_H - 4)} fill="#fde68a" className="farm-glow" />}
    </g>
  );
}

// ── Trang trí ────────────────────────────────────────────────────────────────
// Tường / rào / hàng cây là khối 3D vẽ theo hình học isometric và TỰ NỐI LIỀN với ô cùng loại bên cạnh
// (đặt nhiều ô liên tiếp thành 1 bức tường/hàng rào/hàng cây rào dài). Đồ thông dụng (ghế, đèn, giếng...) vẽ riêng;
// còn lại dùng emoji với cỡ riêng cho từng món (cây to, hoa nhỏ) trên bóng đổ.
type Pt = [number, number];
const pts = (a: Pt[]) => a.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
const raise = (p: Pt, h: number): Pt => [p[0], p[1] - h];
const lerp = (a: Pt, b: Pt, f: number): Pt => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];

export type Neighbors = { xp: boolean; xm: boolean; yp: boolean; ym: boolean };
export const CONNECT_FAMILY: Record<string, string> = { wall: "wall", fence: "fence", bush: "hedge" };
const HX = TILE_W / 4, HY = TILE_H / 4; // từ tâm ô tới giữa cạnh ô kề
// hướng 4 ô kề trong màn hình + véc-tơ độ dày (luôn hướng về phía người xem để thấy mặt trước)
const DIRS: { k: keyof Neighbors; d: Pt; t: Pt }[] = [
  { k: "xm", d: [-HX, -HY], t: [-6, 3] }, { k: "ym", d: [HX, -HY], t: [6, 3] },
  { k: "xp", d: [HX, HY], t: [-6, 3] }, { k: "yp", d: [-HX, HY], t: [6, 3] },
];

type Colors = { front: string; cap: string; top: string; line: string };
// Khối chữ nhật isometric: từ a theo d (dọc), t (dày), cao h, nhấc lên lift. courses>0 → vạch gạch trên mặt trước.
function Box({ a, d, t, h, lift = 0, c, courses = 0 }: { a: Pt; d: Pt; t: Pt; h: number; lift?: number; c: Colors; courses?: number }) {
  const b0: Pt = raise(a, lift), b1: Pt = [b0[0] + d[0], b0[1] + d[1]], b2: Pt = [b1[0] + t[0], b1[1] + t[1]], b3: Pt = [b0[0] + t[0], b0[1] + t[1]];
  const marks: ReactNode[] = [];
  for (let i = 0; i < courses; i++) {
    if (i > 0) { const p = raise(b3, (h * i) / courses), q = raise(b2, (h * i) / courses); marks.push(<line key={`c${i}`} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} stroke={c.line} strokeWidth={1} />); }
    for (const f of i % 2 ? [0.25, 0.75] : [0.5]) {
      const p = lerp(b3, b2, f); const y0 = (h * i) / courses, y1 = (h * (i + 1)) / courses;
      marks.push(<line key={`j${i}-${f}`} x1={p[0]} y1={p[1] - y0} x2={p[0]} y2={p[1] - y1} stroke={c.line} strokeWidth={1} />);
    }
  }
  return (
    <g strokeLinejoin="round">
      <polygon points={pts([b3, b2, raise(b2, h), raise(b3, h)])} fill={c.front} stroke={c.line} strokeWidth={0.8} />
      {marks}
      {d[1] > 0 && <polygon points={pts([b1, b2, raise(b2, h), raise(b1, h)])} fill={c.cap} stroke={c.line} strokeWidth={0.8} />}
      <polygon points={pts([raise(b0, h), raise(b1, h), raise(b2, h), raise(b3, h)])} fill={c.top} stroke={c.line} strokeWidth={0.8} />
    </g>
  );
}
// Lăng trụ đáy hình thoi quanh (cx,cy)
function Prism({ cx, cy, rw, rh, h, lift = 0, c }: { cx: number; cy: number; rw: number; rh: number; h: number; lift?: number; c: Colors }) {
  const y = cy - lift; const L: Pt = [cx - rw, y], B: Pt = [cx, y + rh], R: Pt = [cx + rw, y], T: Pt = [cx, y - rh];
  return (
    <g strokeLinejoin="round">
      <polygon points={pts([L, B, raise(B, h), raise(L, h)])} fill={c.front} stroke={c.line} strokeWidth={0.8} />
      <polygon points={pts([B, R, raise(R, h), raise(B, h)])} fill={c.cap} stroke={c.line} strokeWidth={0.8} />
      <polygon points={pts([raise(T, h), raise(R, h), raise(B, h), raise(L, h)])} fill={c.top} stroke={c.line} strokeWidth={0.8} />
    </g>
  );
}

const WALL: Colors = { front: "#c8704a", cap: "#a95a38", top: "#ebb892", line: "#7a3f22" };
const WOOD: Colors = { front: "#c68b50", cap: "#a9703b", top: "#e3b57c", line: "#7a4f26" };
const HEDGE: Colors = { front: "#3f9d3e", cap: "#2f7f31", top: "#68c455", line: "#256a2a" };

// Một ô tường/rào/hàng cây: các đoạn nối tới ô kề cùng loại (không có ô kề nào → 1 đoạn dọc theo trục x)
function ConnectedPiece({ kind, cx, cy, n }: { kind: "wall" | "fence" | "hedge"; cx: number; cy: number; n: Neighbors }) {
  const any = n.xp || n.xm || n.yp || n.ym;
  const on = (k: keyof Neighbors) => (any ? n[k] : k === "xp" || k === "xm");
  const seg = (k: keyof Neighbors, d: Pt, t: Pt) => {
    if (!on(k)) return null;
    const a: Pt = [cx - t[0] / 2, cy - t[1] / 2];
    if (kind === "wall") return <Box key={k} a={a} d={d} t={t} h={26} c={WALL} courses={4} />;
    if (kind === "hedge") return (
      <g key={k}>
        <Box a={a} d={d} t={[t[0] * 1.5, t[1] * 1.5]} h={20} c={HEDGE} />
        {[0.35, 0.8].map((f) => { const p = lerp([cx, cy - 20], [cx + d[0], cy + d[1] - 20], f); return <circle key={f} cx={p[0]} cy={p[1]} r={4.5} fill="#86d96a" opacity={0.85} />; })}
      </g>
    );
    // hàng rào gỗ: 2 thanh ngang + 1 song đứng giữa đoạn
    const mid = lerp([cx, cy], [cx + d[0], cy + d[1]], 0.5);
    return (
      <g key={k}>
        <line x1={mid[0] + t[0] / 2} y1={mid[1] + t[1] / 2} x2={mid[0] + t[0] / 2} y2={mid[1] + t[1] / 2 - 20} stroke={WOOD.cap} strokeWidth={3.4} strokeLinecap="round" />
        <Box a={a} d={d} t={[t[0] / 3, t[1] / 3]} h={3.5} lift={7} c={WOOD} />
        <Box a={a} d={d} t={[t[0] / 3, t[1] / 3]} h={3.5} lift={15} c={WOOD} />
      </g>
    );
  };
  const post = () => {
    if (kind === "wall") return <Prism cx={cx} cy={cy} rw={9} rh={4.5} h={31} c={{ ...WALL, top: "#f4cdb0" }} />;
    if (kind === "fence") return <Prism cx={cx} cy={cy} rw={3.8} rh={1.9} h={25} c={WOOD} />;
    return (
      <g>
        <ellipse cx={cx} cy={cy - 12} rx={13} ry={11} fill="#3f9d3e" stroke={HEDGE.line} strokeWidth={0.8} />
        <ellipse cx={cx - 4} cy={cy - 16} rx={7} ry={5} fill="#7bd05f" opacity={0.85} />
      </g>
    );
  };
  return (
    <g>
      <ellipse cx={cx} cy={cy + 3} rx={any ? 30 : 24} ry={9} fill="rgba(31,45,61,.15)" />
      {DIRS.filter((x) => x.d[1] < 0).map((x) => seg(x.k, x.d, x.t))}
      {post()}
      {DIRS.filter((x) => x.d[1] > 0).map((x) => seg(x.k, x.d, x.t))}
    </g>
  );
}

// Cỡ chữ emoji theo món (cây/nhà to, hoa/nấm nhỏ)
const EMOJI_SIZE: Record<string, number> = {
  tree: 58, pine: 58, cherry: 58, palm: 60, bamboo: 48, house: 62, windmill: 66, tent: 50, castle: 70, pagoda: 64, hut: 56, barnhouse: 58, tractor: 52, bridge: 56, boat: 44,
  torii: 56, slide: 50, circus: 62, carousel: 56, ferris: 72, xmas: 62, fountain: 54, statue: 52, moai: 46, snowman: 46, rainbow: 74, pond: 50, beehive: 38, fireworks: 54, balloon: 46,
  mushroom: 28, flower: 32, rose: 32, hibiscus: 32, daisy: 30, cactus: 38, potted: 34, bonsai: 36,
  chicken: 32, duck: 32, rabbit: 32, cat: 32, dog: 34, pig: 36, sheep: 38, cow: 42, horse: 46, peacock: 40,
};
export const emojiSizeOf = (key: string) => EMOJI_SIZE[key] || 40;
const EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
export function EmojiDecor({ emoji, size = 40, cx, cy }: { emoji: string; size?: number; cx: number; cy: number }) {
  return (
    <g>
      <ellipse cx={cx} cy={cy + 6} rx={size * 0.42} ry={size * 0.15} fill="rgba(31,45,61,.2)" />
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize={size} style={{ fontFamily: EMOJI_FONT }}>{emoji}</text>
    </g>
  );
}

export function DecorSprite({ itemKey, emoji, cx, cy, isPath, n }: { itemKey?: string; emoji: string; cx: number; cy: number; isPath?: boolean; n?: Neighbors }) {
  if (isPath) return <polygon points={diamondPoints(cx, cy, TILE_W - 6, TILE_H - 3)} fill="#d6c3a5" stroke="#b9a47f" strokeWidth={1.5} />;
  const fam = itemKey ? CONNECT_FAMILY[itemKey] : undefined;
  if (fam) return <ConnectedPiece kind={fam as "wall" | "fence" | "hedge"} cx={cx} cy={cy} n={n || { xp: false, xm: false, yp: false, ym: false }} />;
  const shadow = (rx: number, ry: number) => <ellipse cx={cx} cy={cy + 4} rx={rx} ry={ry} fill="rgba(31,45,61,.2)" />;
  switch (itemKey) {
    case "rock": return (
      <g>{shadow(24, 8)}
        <path d={`M${cx - 20} ${cy + 3} Q${cx - 19} ${cy - 13} ${cx - 3} ${cy - 17} Q${cx + 15} ${cy - 18} ${cx + 21} ${cy + 2} Q${cx} ${cy + 10} ${cx - 20} ${cy + 3}Z`} fill="#a3a9b3" stroke="#6b7280" strokeWidth={1.2} />
        <path d={`M${cx - 11} ${cy - 8} Q${cx - 4} ${cy - 15} ${cx + 4} ${cy - 13}`} stroke="#d1d5db" strokeWidth={2.4} strokeLinecap="round" fill="none" />
        <path d={`M${cx + 14} ${cy + 3} Q${cx + 20} ${cy - 4} ${cx + 27} ${cy + 2} Q${cx + 21} ${cy + 7} ${cx + 14} ${cy + 3}Z`} fill="#9097a3" stroke="#6b7280" strokeWidth={1} />
      </g>);
    case "pond": return (
      <g>
        <ellipse cx={cx} cy={cy + 2} rx={37} ry={18} fill="#9a7b4f" stroke="#6b5232" strokeWidth={1.2} />
        <ellipse cx={cx} cy={cy} rx={32} ry={15} fill="#3f9fe0" stroke="#2a74b5" strokeWidth={1.2} />
        <ellipse cx={cx - 5} cy={cy - 3} rx={19} ry={7} fill="#7cc6f2" opacity={0.7} />
        <ellipse cx={cx + 8} cy={cy + 2} rx={11} ry={4} fill="none" stroke="#d6efff" strokeWidth={1.2} opacity={0.8} />
        {[[-14, 3], [12, -3]].map(([dx, dy], i) => (
          <g key={i}><ellipse cx={cx + dx} cy={cy + dy} rx={7} ry={3.2} fill="#4caf50" stroke="#2e7d32" strokeWidth={0.8} />{i === 0 && <circle cx={cx + dx} cy={cy + dy - 2} r={2.4} fill="#f9a8d4" />}</g>
        ))}
        <path d={`M${cx + 17} ${cy + 3} q4 -4 8 0 q-4 4 -8 0Z M${cx + 25} ${cy + 3} l3 -2.5 v5Z`} fill="#fb923c" />
        <path d={`M${cx - 33} ${cy + 4} v-14 M${cx - 29} ${cy + 6} v-18 M${cx - 36} ${cy + 3} v-10`} stroke="#5b8c2a" strokeWidth={2} strokeLinecap="round" />
      </g>);
    case "bench": return (
      <g>{shadow(28, 9)}
        {[[-14, -6], [12, 6]].map(([dx, dy], i) => <line key={i} x1={cx + dx} y1={cy + dy} x2={cx + dx} y2={cy + dy - 10} stroke={WOOD.line} strokeWidth={3} />)}
        <Box a={[cx - 17 + 2, cy - 8.5 - 2]} d={[34, 17]} t={[-6, 3]} h={3.5} lift={9} c={WOOD} />
        <Box a={[cx - 17 + 6, cy - 8.5 - 4]} d={[34, 17]} t={[-2, 1]} h={13} lift={14} c={{ ...WOOD, front: "#b87a40" }} />
      </g>);
    case "lamp": return (
      <g>{shadow(14, 5)}
        <rect x={cx - 2} y={cy - 40} width={4} height={42} rx={2} fill="#4b5563" />
        <rect x={cx - 7} y={cy + 0} width={14} height={4} rx={2} fill="#374151" />
        <rect x={cx - 8} y={cy - 56} width={16} height={18} rx={4} fill="#fcd34d" stroke="#b45309" strokeWidth={1.4} />
        <rect x={cx - 11} y={cy - 60} width={22} height={5} rx={2.5} fill="#4b5563" />
        <rect x={cx - 4} y={cy - 52} width={8} height={10} rx={3} fill="#fff7ae" />
      </g>);
    case "signpost": return (
      <g>{shadow(13, 5)}
        <rect x={cx - 2.5} y={cy - 50} width={5} height={53} rx={2} fill="#8a5a2b" />
        <polygon points={`${cx - 2},${cy - 46} ${cx + 24},${cy - 46} ${cx + 31},${cy - 40} ${cx + 24},${cy - 34} ${cx - 2},${cy - 34}`} fill="#e0b078" stroke="#7a4f26" strokeWidth={1.2} />
        <polygon points={`${cx + 2},${cy - 30} ${cx - 22},${cy - 30} ${cx - 29},${cy - 24} ${cx - 22},${cy - 18} ${cx + 2},${cy - 18}`} fill="#d99a5b" stroke="#7a4f26" strokeWidth={1.2} />
      </g>);
    case "mailbox": return (
      <g>{shadow(13, 5)}
        <rect x={cx - 2.5} y={cy - 26} width={5} height={29} rx={2} fill="#6b7280" />
        <path d={`M${cx - 13} ${cy - 24} V${cy - 40} Q${cx - 13} ${cy - 50} ${cx} ${cy - 50} Q${cx + 13} ${cy - 50} ${cx + 13} ${cy - 40} V${cy - 24}Z`} fill="#3b82f6" stroke="#1e3a8a" strokeWidth={1.3} />
        <rect x={cx - 6} y={cy - 38} width={12} height={3} rx={1.5} fill="#1e3a8a" />
        <rect x={cx + 13} y={cy - 46} width={3} height={16} fill="#6b7280" /><rect x={cx + 13} y={cy - 47} width={10} height={6} rx={1.5} fill="#ef4444" />
      </g>);
    case "well": return (
      <g>{shadow(24, 9)}
        <ellipse cx={cx} cy={cy - 6} rx={19} ry={9.5} fill="#8b929c" stroke="#5b616b" strokeWidth={1.2} />
        <path d={`M${cx - 19} ${cy - 6} V${cy + 2} A19 9.5 0 0 0 ${cx + 19} ${cy + 2} V${cy - 6}Z`} fill="#a8aeb7" stroke="#5b616b" strokeWidth={1.2} />
        <ellipse cx={cx} cy={cy - 8} rx={14} ry={6.5} fill="#2f6fb3" /><ellipse cx={cx} cy={cy - 9} rx={9} ry={3.5} fill="#5fa3e0" opacity={0.8} />
        <rect x={cx - 17} y={cy - 40} width={4} height={34} fill="#8a5a2b" /><rect x={cx + 13} y={cy - 40} width={4} height={34} fill="#8a5a2b" />
        <polygon points={`${cx - 24},${cy - 38} ${cx},${cy - 54} ${cx + 24},${cy - 38}`} fill="#c0392b" stroke="#7b241c" strokeWidth={1.2} />
        <line x1={cx} y1={cy - 38} x2={cx} y2={cy - 22} stroke="#6b4423" strokeWidth={1.5} /><rect x={cx - 4} y={cy - 22} width={8} height={6} rx={2} fill="#9a6b3a" />
      </g>);
    case "haystack": return (
      <g>{shadow(26, 9)}
        <path d={`M${cx - 24} ${cy + 3} Q${cx - 24} ${cy - 30} ${cx} ${cy - 32} Q${cx + 24} ${cy - 30} ${cx + 24} ${cy + 3} Q${cx} ${cy + 11} ${cx - 24} ${cy + 3}Z`} fill="#e8c14f" stroke="#a67c1c" strokeWidth={1.3} />
        {[-12, -4, 5, 13].map((dx, i) => <path key={i} d={`M${cx + dx} ${cy + 4} Q${cx + dx * 0.5} ${cy - 14} ${cx + dx * 0.25} ${cy - 28}`} stroke="#b88a22" strokeWidth={1.3} fill="none" />)}
        <path d={`M${cx - 22} ${cy - 10} Q${cx} ${cy - 4} ${cx + 22} ${cy - 10}`} stroke="#8a6a1c" strokeWidth={2} fill="none" />
      </g>);
    case "scarecrow": return (
      <g>{shadow(14, 5)}
        <rect x={cx - 2} y={cy - 44} width={4} height={47} fill="#8a5a2b" />
        <rect x={cx - 24} y={cy - 33} width={48} height={4} rx={2} fill="#8a5a2b" />
        <path d={`M${cx - 10} ${cy - 30} L${cx - 14} ${cy - 8} H${cx + 14} L${cx + 10} ${cy - 30}Z`} fill="#3b82f6" stroke="#1e3a8a" strokeWidth={1} />
        <path d={`M${cx - 24} ${cy - 29} l-6 9 M${cx + 24} ${cy - 29} l6 9`} stroke="#e8c14f" strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={cx} cy={cy - 40} r={8.5} fill="#f5d6a0" stroke="#a67c1c" strokeWidth={1} /><circle cx={cx - 3} cy={cy - 41} r={1.2} fill="#374151" /><circle cx={cx + 3} cy={cy - 41} r={1.2} fill="#374151" />
        <path d={`M${cx - 15} ${cy - 46} Q${cx} ${cy - 52} ${cx + 15} ${cy - 46}`} stroke="#8a5a2b" strokeWidth={4} strokeLinecap="round" fill="none" /><path d={`M${cx - 8} ${cy - 47} Q${cx} ${cy - 60} ${cx + 8} ${cy - 47}Z`} fill="#c68b50" stroke="#7a4f26" strokeWidth={1} />
      </g>);
  }
  return <EmojiDecor emoji={emoji} size={(itemKey && EMOJI_SIZE[itemKey]) || 40} cx={cx} cy={cy} />;
}

// ── Qilin con ────────────────────────────────────────────────────────────────
// Dùng đúng ảnh linh vật Lucy Tutor (public/images/farm/qilin.webp, đã tách nền) — không vẽ tay.
// Cấp cao hơn → to hơn một chút + phụ kiện emoji (✨ từ cấp 3, 👑 cấp 6).
export const PET_IMAGE = "/images/farm/qilin.webp";
// Vị trí đeo trang phục (tỉ lệ theo w/h của ảnh): đầu, mắt, cổ, lưng, tay
const OUTFIT_POS: Record<string, { x: number; y: number; size: number }> = {
  hat:  { x: 0.08, y: -0.98, size: 0.42 },
  face: { x: 0.1,  y: -0.6,  size: 0.3 },
  neck: { x: 0.02, y: -0.4,  size: 0.3 },
  back: { x: -0.42, y: -0.62, size: 0.42 },
  hand: { x: 0.38, y: -0.22, size: 0.34 },
};
export type Outfit = Record<string, string>; // slot → emoji
export function PetSprite({ level = 1, size = 1, outfit }: { level?: number; size?: number; blink?: boolean; outfit?: Outfit }) {
  const s = size * (0.85 + Math.min(level, 6) * 0.07);
  const w = 72 * s, h = 84 * s; // tỉ lệ ảnh gốc 360×420
  const wear = (slot: string) => {
    const e = outfit?.[slot]; if (!e) return null; const p = OUTFIT_POS[slot];
    return <text key={slot} x={p.x * w} y={p.y * h} textAnchor="middle" dominantBaseline="middle" fontSize={p.size * w} style={{ fontFamily: "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif" }}>{e}</text>;
  };
  return (
    <g>
      <ellipse cx={0} cy={2} rx={w * 0.38} ry={7 * s} fill="rgba(31,45,61,.18)" />
      {wear("back")}
      <image href={PET_IMAGE} x={-w / 2} y={-h} width={w} height={h} preserveAspectRatio="xMidYMax meet" />
      {wear("neck")}{wear("face")}{wear("hat")}{wear("hand")}
      {!outfit?.hat && level >= 3 && <text x={w * 0.42} y={-h * 0.82} fontSize={14 * s} textAnchor="middle">✨</text>}
      {!outfit?.hat && level >= 6 && <text x={0} y={-h - 2} fontSize={16 * s} textAnchor="middle">👑</text>}
    </g>
  );
}

export function Cloud({ x, y, scale = 1, duration = 60, delay = 0, fill = "#fff" }: { x: number; y: number; scale?: number; duration?: number; delay?: number; fill?: string }) {
  return (
    <g className="farm-cloud" style={{ animationDuration: `${duration}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={.9}>
        <ellipse cx={0} cy={0} rx={28} ry={12} fill={fill} /><ellipse cx={-16} cy={4} rx={16} ry={9} fill={fill} /><ellipse cx={14} cy={3} rx={18} ry={10} fill={fill} /><circle cx={4} cy={-8} r={12} fill={fill} />
      </g>
    </g>
  );
}
