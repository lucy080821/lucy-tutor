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

// Một đoạn tường/rào/hàng cây xuất phát từ điểm `start`, dài/hướng `d`, dày `t`
function segFrom(kind: "wall" | "fence" | "hedge", key: string, start: Pt, d: Pt, t: Pt) {
  const a: Pt = [start[0] - t[0] / 2, start[1] - t[1] / 2];
  if (kind === "wall") return <Box key={key} a={a} d={d} t={t} h={26} c={WALL} courses={4} />;
  if (kind === "hedge") return (
    <g key={key}>
      <Box a={a} d={d} t={[t[0] * 1.5, t[1] * 1.5]} h={20} c={HEDGE} />
      {[0.35, 0.8].map((f) => { const p = lerp([start[0], start[1] - 20], [start[0] + d[0], start[1] + d[1] - 20], f); return <circle key={f} cx={p[0]} cy={p[1]} r={4.5} fill="#86d96a" opacity={0.85} />; })}
    </g>
  );
  // hàng rào gỗ: 2 thanh ngang + 1 song đứng giữa đoạn
  const mid = lerp(start, [start[0] + d[0], start[1] + d[1]], 0.5);
  return (
    <g key={key}>
      <line x1={mid[0] + t[0] / 2} y1={mid[1] + t[1] / 2} x2={mid[0] + t[0] / 2} y2={mid[1] + t[1] / 2 - 20} stroke={WOOD.cap} strokeWidth={3.4} strokeLinecap="round" />
      <Box a={a} d={d} t={[t[0] / 3, t[1] / 3]} h={3.5} lift={7} c={WOOD} />
      <Box a={a} d={d} t={[t[0] / 3, t[1] / 3]} h={3.5} lift={15} c={WOOD} />
    </g>
  );
}

// Một ô tường/rào/hàng cây: các đoạn nối tới ô kề cùng loại (không có ô kề nào → 1 đoạn dọc theo trục, trục 0 = x, 1 = y)
function ConnectedPiece({ kind, cx, cy, n, axis }: { kind: "wall" | "fence" | "hedge"; cx: number; cy: number; n: Neighbors; axis: 0 | 1 }) {
  const any = n.xp || n.xm || n.yp || n.ym;
  const on = (k: keyof Neighbors) => (any ? n[k] : axis === 0 ? k === "xp" || k === "xm" : k === "yp" || k === "ym");
  const seg = (k: keyof Neighbors, d: Pt, t: Pt) => (on(k) ? segFrom(kind, k, [cx, cy], d, t) : null);
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

// ── Cổng: 2 trụ + cánh/vòm ở giữa ô, 2 đầu nối với tường/rào cùng họ ──────────────────────────────
const WHITE: Colors = { front: "#f8f8f4", cap: "#dcdcd2", top: "#ffffff", line: "#9a9a8e" };
const BAMBOO: Colors = { front: "#b8c46a", cap: "#8fa04a", top: "#d9e28f", line: "#5f6f2c" };
const IRON: Colors = { front: "#4b5563", cap: "#374151", top: "#6b7280", line: "#1f2937" };
const STONE: Colors = { front: "#a9afb9", cap: "#8a909b", top: "#d0d5dc", line: "#59606b" };
const RED: Colors = { front: "#d9453b", cap: "#b3322a", top: "#f0766c", line: "#7a1d18" };
const GOLD: Colors = { front: "#f2c230", cap: "#c99a12", top: "#ffe27a", line: "#8a6508" };
type GateStyle = { post: Colors; postH: number; rw: number; leaf?: "boards" | "lattice" | "pickets" | "bars"; leafC?: Colors; leafH?: number; arch?: { c: string; edge: string; h: number; w: number }; top?: "merlon" | "lantern" | "flowers" | "crown" | "spears" };
const GATE_STYLES: Record<string, GateStyle> = {
  wood: { post: WOOD, postH: 32, rw: 4.5, leaf: "boards", leafC: WOOD, leafH: 24 },
  picket: { post: WHITE, postH: 30, rw: 4, leaf: "pickets", leafC: WHITE, leafH: 22 },
  bamboo: { post: BAMBOO, postH: 36, rw: 3.5, leaf: "lattice", leafC: BAMBOO, leafH: 25 },
  brick: { post: WALL, postH: 40, rw: 6.5, arch: { c: "#c8704a", edge: "#7a3f22", h: 11, w: 7 } },
  iron: { post: IRON, postH: 36, rw: 3.5, leaf: "bars", leafC: IRON, leafH: 28, top: "spears" },
  flower: { post: HEDGE, postH: 36, rw: 6, arch: { c: "#3f9d3e", edge: "#256a2a", h: 14, w: 8 }, top: "flowers" },
  stone: { post: STONE, postH: 42, rw: 6.5, arch: { c: "#b6bcc6", edge: "#6b7280", h: 13, w: 8 } },
  lantern: { post: RED, postH: 44, rw: 3.8, top: "lantern" },
  golden: { post: GOLD, postH: 40, rw: 4, leaf: "bars", leafC: GOLD, leafH: 26, arch: { c: "#fbbf24", edge: "#b45309", h: 10, w: 5 }, top: "crown" },
  castle: { post: STONE, postH: 56, rw: 8, arch: { c: "#9aa1ac", edge: "#4b5563", h: 14, w: 9 }, leaf: "bars", leafC: IRON, leafH: 30, top: "merlon" },
};

function GatePiece({ style, fam, cx, cy, axis, n }: { style: string; fam: "wall" | "fence" | "hedge"; cx: number; cy: number; axis: 0 | 1; n: Neighbors }) {
  const g = GATE_STYLES[style] || GATE_STYLES.wood;
  const L: Pt = axis ? [-TILE_W / 2, TILE_H / 2] : [TILE_W / 2, TILE_H / 2];
  const t: Pt = axis ? [6, 3] : [-6, 3];
  const P1: Pt = [cx - L[0] * 0.3, cy - L[1] * 0.3], P2: Pt = [cx + L[0] * 0.3, cy + L[1] * 0.3]; // P1 phía sau, P2 phía trước
  const backNb = axis ? n.ym : n.xm, frontNb = axis ? n.yp : n.xp;
  const mid = lerp(P1, P2, 0.5);
  const a = lerp(P1, P2, 0.1), b = lerp(P1, P2, 0.9);
  const lc = g.leafC || WOOD; const lh = g.leafH || 24;
  const leaf: ReactNode[] = [];
  if (g.leaf === "boards") {
    leaf.push(<polygon key="l" points={pts([a, b, raise(b, lh), raise(a, lh)])} fill={lc.front} stroke={lc.line} strokeWidth={0.9} />);
    for (let i = 1; i < 5; i++) { const p = lerp(a, b, i / 5); leaf.push(<line key={`v${i}`} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] - lh} stroke={lc.line} strokeWidth={0.8} />); }
    leaf.push(<line key="d1" x1={a[0]} y1={a[1] - 3} x2={b[0]} y2={b[1] - lh + 3} stroke={lc.cap} strokeWidth={2.4} />, <line key="d2" x1={a[0]} y1={a[1] - lh + 3} x2={b[0]} y2={b[1] - 3} stroke={lc.cap} strokeWidth={2.4} />);
  } else if (g.leaf === "pickets") {
    leaf.push(<line key="r1" x1={a[0]} y1={a[1] - 7} x2={b[0]} y2={b[1] - 7} stroke={lc.line} strokeWidth={2.4} />, <line key="r2" x1={a[0]} y1={a[1] - 16} x2={b[0]} y2={b[1] - 16} stroke={lc.line} strokeWidth={2.4} />);
    for (let i = 0; i < 6; i++) { const p = lerp(a, b, (i + 0.5) / 6); leaf.push(<polygon key={`p${i}`} points={pts([[p[0] - 2.4, p[1]], [p[0] + 2.4, p[1]], [p[0] + 2.4, p[1] - lh], [p[0], p[1] - lh - 4], [p[0] - 2.4, p[1] - lh]])} fill={lc.front} stroke={lc.line} strokeWidth={0.8} />); }
  } else if (g.leaf === "lattice") {
    for (let i = 0; i < 6; i++) { const p = lerp(a, b, (i + 0.5) / 6); leaf.push(<line key={`s${i}`} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] - lh} stroke={lc.cap} strokeWidth={3} strokeLinecap="round" />); }
    leaf.push(<line key="h1" x1={a[0]} y1={a[1] - 8} x2={b[0]} y2={b[1] - 8} stroke={lc.line} strokeWidth={1.8} />, <line key="h2" x1={a[0]} y1={a[1] - 17} x2={b[0]} y2={b[1] - 17} stroke={lc.line} strokeWidth={1.8} />);
  } else if (g.leaf === "bars") {
    leaf.push(<line key="b0" x1={a[0]} y1={a[1] - 3} x2={b[0]} y2={b[1] - 3} stroke={lc.line} strokeWidth={2.4} />, <line key="b1" x1={a[0]} y1={a[1] - lh} x2={b[0]} y2={b[1] - lh} stroke={lc.line} strokeWidth={2.4} />);
    for (let i = 0; i < 7; i++) { const p = lerp(a, b, (i + 0.5) / 7); leaf.push(<line key={`r${i}`} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1] - lh} stroke={lc.front} strokeWidth={1.8} />, <polygon key={`t${i}`} points={pts([[p[0] - 2, p[1] - lh], [p[0], p[1] - lh - 5], [p[0] + 2, p[1] - lh]])} fill={lc.front} />); }
  }
  // vòm / dầm trên
  const peak = (g.arch?.h || 0) * 2;
  const top0 = raise(P1, g.postH), top2 = raise(P2, g.postH), ctrl = raise(mid, g.postH + peak);
  const bez = (f: number): Pt => [(1 - f) * (1 - f) * top0[0] + 2 * (1 - f) * f * ctrl[0] + f * f * top2[0], (1 - f) * (1 - f) * top0[1] + 2 * (1 - f) * f * ctrl[1] + f * f * top2[1]];
  const deco: ReactNode[] = [];
  if (g.top === "flowers") [0.12, 0.28, 0.5, 0.72, 0.88].forEach((f, i) => { const p = bez(f); deco.push(<circle key={`f${i}`} cx={p[0]} cy={p[1] - 1} r={3.4} fill={["#fb7185", "#fde68a", "#f9a8d4", "#fde68a", "#fb7185"][i]} stroke="#9f1239" strokeWidth={0.5} />); });
  if (g.top === "crown") { const p = bez(0.5); deco.push(<polygon key="cr" points={pts([[p[0] - 7, p[1]], [p[0] - 7, p[1] - 8], [p[0] - 3.5, p[1] - 3.5], [p[0], p[1] - 10], [p[0] + 3.5, p[1] - 3.5], [p[0] + 7, p[1] - 8], [p[0] + 7, p[1]]])} fill="#ffd84d" stroke="#8a6508" strokeWidth={1} />); }
  if (g.top === "lantern") {
    const e1 = [P1[0] - L[0] * 0.16, P1[1] - L[1] * 0.16] as Pt, e2 = [P2[0] + L[0] * 0.16, P2[1] + L[1] * 0.16] as Pt;
    deco.push(<line key="k1" x1={e1[0]} y1={e1[1] - g.postH - 3} x2={e2[0]} y2={e2[1] - g.postH - 3} stroke="#7a1d18" strokeWidth={6} strokeLinecap="round" />, <line key="k2" x1={P1[0]} y1={P1[1] - g.postH + 8} x2={P2[0]} y2={P2[1] - g.postH + 8} stroke="#b3322a" strokeWidth={3.4} />);
    deco.push(<g key="ln"><line x1={mid[0]} y1={mid[1] - g.postH + 8} x2={mid[0]} y2={mid[1] - g.postH + 14} stroke="#7a1d18" strokeWidth={1} /><ellipse cx={mid[0]} cy={mid[1] - g.postH + 20} rx={5.5} ry={6.5} fill="#ef4444" stroke="#7f1d1d" strokeWidth={1} /><ellipse cx={mid[0]} cy={mid[1] - g.postH + 20} rx={2.4} ry={3.4} fill="#fde68a" opacity={0.9} /></g>);
  }
  const finial = (p: Pt, k: string) => g.top === "spears" ? <polygon key={k} points={pts([[p[0] - 3.2, p[1] - g.postH], [p[0], p[1] - g.postH - 8], [p[0] + 3.2, p[1] - g.postH]])} fill={IRON.front} stroke={IRON.line} strokeWidth={0.8} /> : g.top === "merlon" ? <Prism key={k} cx={p[0]} cy={p[1]} rw={g.rw + 2} rh={(g.rw + 2) / 2} h={5} lift={g.postH} c={{ ...STONE, front: "#8a909b" }} /> : null;
  const post = (p: Pt, k: string) => <Prism key={k} cx={p[0]} cy={p[1]} rw={g.rw} rh={g.rw / 2} h={g.postH} c={g.post} />;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 3} rx={36} ry={10} fill="rgba(31,45,61,.15)" />
      {backNb && segFrom(fam, "sb", P1, [-L[0] * 0.2, -L[1] * 0.2], t)}
      {post(P1, "p1")}{finial(P1, "f1")}
      {leaf}
      {post(P2, "p2")}{finial(P2, "f2")}
      {frontNb && segFrom(fam, "sf", P2, [L[0] * 0.2, L[1] * 0.2], t)}
      {g.arch && (
        <g>
          <path d={`M${top0[0]} ${top0[1]} Q${ctrl[0]} ${ctrl[1]} ${top2[0]} ${top2[1]}`} fill="none" stroke={g.arch.edge} strokeWidth={g.arch.w + 2.4} strokeLinecap="round" />
          <path d={`M${top0[0]} ${top0[1]} Q${ctrl[0]} ${ctrl[1]} ${top2[0]} ${top2[1]}`} fill="none" stroke={g.arch.c} strokeWidth={g.arch.w} strokeLinecap="round" />
        </g>
      )}
      {deco}
    </g>
  );
}

// ── Nhà máy chế biến: nhà nhỏ mái màu + biển emoji; chạy thì ống khói nhả khói ─────────────────────
function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16); const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}
export function FactorySprite({ cx, cy, wall, roof, emoji, busy, mirror }: { cx: number; cy: number; wall: string; roof: string; emoji: string; busy?: boolean; mirror?: boolean }) {
  const W = 30, Hh = 15, wallH = 30, roofH = 26;
  const Lp: Pt = [cx - W, cy], Bp: Pt = [cx, cy + Hh], Rp: Pt = [cx + W, cy];
  const A: Pt = [cx, cy - wallH - roofH];
  const eave = (p: Pt, ox: number, oy: number): Pt => [p[0] + ox, p[1] - wallH + oy];
  const L2 = eave(Lp, -6, 2), B2 = eave(Bp, 0, 4), R2 = eave(Rp, 6, 2);
  const door0 = lerp(Lp, Bp, 0.42), door1 = lerp(Lp, Bp, 0.66);
  const win0 = lerp(Bp, Rp, 0.3), win1 = lerp(Bp, Rp, 0.62);
  const flip = mirror ? `translate(${cx} 0) scale(-1 1) translate(${-cx} 0)` : undefined;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 5} rx={W + 10} ry={Hh + 4} fill="rgba(31,45,61,.2)" />
      <g transform={flip} strokeLinejoin="round">
        <polygon points={pts([Lp, Bp, raise(Bp, wallH), raise(Lp, wallH)])} fill={wall} stroke="#6b5232" strokeWidth={1} />
        <polygon points={pts([Bp, Rp, raise(Rp, wallH), raise(Bp, wallH)])} fill={shade(wall, 0.86)} stroke="#6b5232" strokeWidth={1} />
        <polygon points={pts([door0, door1, raise(door1, 17), raise(door0, 17)])} fill="#7a4f26" stroke="#4e3217" strokeWidth={0.9} />
        <polygon points={pts([raise(win0, 10), raise(win1, 10), raise(win1, 22), raise(win0, 22)])} fill="#cfeaff" stroke="#4e3217" strokeWidth={0.9} />
        <polygon points={pts([L2, B2, A])} fill={roof} stroke={shade(roof, 0.6)} strokeWidth={1} />
        <polygon points={pts([B2, R2, A])} fill={shade(roof, 0.8)} stroke={shade(roof, 0.6)} strokeWidth={1} />
        <Prism cx={cx + 13} cy={cy - wallH - 9} rw={4.5} rh={2.2} h={14} c={{ front: "#b45a3c", cap: "#8f4429", top: "#d98264", line: "#5b2a18" }} />
        {busy && [0, 1, 2].map((i) => (
          <circle key={i} cx={cx + 13} cy={cy - wallH - 25} r={4 + i} fill="#e5e7eb" stroke="#cbd5e1" strokeWidth={0.6} className="farm-smoke" style={{ animationDelay: `${i * 0.8}s` }} />
        ))}
      </g>
      <circle cx={cx} cy={cy + Hh - 14} r={11.5} fill="#fff" stroke={shade(roof, 0.7)} strokeWidth={1.6} />
      <text x={cx} y={cy + Hh - 8.5} textAnchor="middle" fontSize={15} style={{ fontFamily: EMOJI_FONT }}>{emoji}</text>
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

export type DecorMeta = { fam?: "wall" | "fence" | "hedge"; gate?: boolean; style?: string; factory?: { wall: string; roof: string; emoji: string; busy?: boolean } };
// r: hướng (0/1). Tường/rào/cổng đổi trục x ↔ y; đồ khác lật ngang. meta lấy từ catalog (gate/fam/style) + nhà máy.
export function DecorSprite({ itemKey, emoji, cx, cy, isPath, n, r = 0, meta }: { itemKey?: string; emoji: string; cx: number; cy: number; isPath?: boolean; n?: Neighbors; r?: 0 | 1; meta?: DecorMeta }) {
  if (isPath) return <polygon points={diamondPoints(cx, cy, TILE_W - 6, TILE_H - 3)} fill="#d6c3a5" stroke="#b9a47f" strokeWidth={1.5} />;
  const nb = n || { xp: false, xm: false, yp: false, ym: false };
  if (meta?.gate && meta.fam) return <GatePiece style={meta.style || "wood"} fam={meta.fam} cx={cx} cy={cy} axis={r ? 1 : 0} n={nb} />;
  if (meta?.fam) return <ConnectedPiece kind={meta.fam} cx={cx} cy={cy} n={nb} axis={r ? 1 : 0} />;
  if (meta?.factory) return <FactorySprite cx={cx} cy={cy} wall={meta.factory.wall} roof={meta.factory.roof} emoji={meta.factory.emoji} busy={meta.factory.busy} mirror={!!r} />;
  if (r) return <g transform={`translate(${cx} 0) scale(-1 1) translate(${-cx} 0)`}><DecorBody itemKey={itemKey} emoji={emoji} cx={cx} cy={cy} /></g>;
  return <DecorBody itemKey={itemKey} emoji={emoji} cx={cx} cy={cy} />;
}
function DecorBody({ itemKey, emoji, cx, cy }: { itemKey?: string; emoji: string; cx: number; cy: number }) {
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
