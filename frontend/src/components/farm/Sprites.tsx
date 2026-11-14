"use client";
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

// ── Trang trí (emoji trên bóng đổ; "path" là ô lát đá) ───────────────────────
export function DecorSprite({ emoji, cx, cy, isPath }: { emoji: string; cx: number; cy: number; isPath?: boolean }) {
  if (isPath) return <polygon points={diamondPoints(cx, cy, TILE_W - 6, TILE_H - 3)} fill="#d6c3a5" stroke="#b9a47f" strokeWidth={1.5} />;
  return (
    <g>
      <ellipse cx={cx} cy={cy + 6} rx={18} ry={7} fill="rgba(31,45,61,.18)" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={40} style={{ fontFamily: "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif" }}>{emoji}</text>
    </g>
  );
}

// ── Qilin con ────────────────────────────────────────────────────────────────
// level 1..6 → to dần, màu đậm hơn, mọc thêm phụ kiện (bờm, cánh, vương miện)
export function PetSprite({ level = 1, size = 1, blink = false }: { level?: number; size?: number; blink?: boolean }) {
  const s = size * (0.85 + Math.min(level, 6) * 0.07);
  const body = level >= 4 ? "#2563eb" : "#3b82f6";
  const belly = "#bfdbfe";
  return (
    <g transform={`scale(${s})`}>
      <ellipse cx={0} cy={2} rx={24} ry={7} fill="rgba(31,45,61,.18)" />
      {/* đuôi */}
      <path d="M-18 -14 C -34 -16, -36 -34, -24 -34 C -30 -30, -28 -22, -16 -20" fill="#60a5fa" />
      <circle cx={-25} cy={-35} r={4} fill="#fbbf24" />
      {/* thân */}
      <ellipse cx={0} cy={-16} rx={22} ry={16} fill={body} />
      <ellipse cx={0} cy={-11} rx={13} ry={9} fill={belly} />
      {/* vảy */}
      <circle cx={-10} cy={-24} r={3} fill="#93c5fd" opacity={.8} /><circle cx={-2} cy={-28} r={3} fill="#93c5fd" opacity={.8} /><circle cx={7} cy={-25} r={3} fill="#93c5fd" opacity={.8} />
      {/* chân */}
      <ellipse cx={-12} cy={-2} rx={6} ry={4} fill="#1d4ed8" /><ellipse cx={12} cy={-2} rx={6} ry={4} fill="#1d4ed8" />
      {/* cánh (cấp 3+) */}
      {level >= 3 && <path d="M8 -26 C 20 -44, 36 -40, 30 -24 C 24 -30, 16 -28, 8 -22 Z" fill="#a5b4fc" opacity={.9} />}
      {/* đầu */}
      <circle cx={14} cy={-36} r={14} fill={body} />
      <ellipse cx={22} cy={-32} rx={8} ry={5.5} fill={belly} />
      {/* sừng vàng */}
      <path d="M8 -47 L 5 -60 L 12 -49 Z" fill="#fbbf24" /><path d="M18 -48 L 20 -61 L 24 -48 Z" fill="#fbbf24" />
      {/* bờm (cấp 2+) */}
      {level >= 2 && <path d="M2 -44 C -6 -46, -10 -38, -4 -34 C -8 -30, -2 -26, 2 -30" fill="#f472b6" />}
      {/* vương miện (cấp 6) */}
      {level >= 6 && <path d="M6 -58 L 9 -66 L 13 -60 L 17 -68 L 20 -60 L 24 -66 L 26 -58 Z" fill="#f59e0b" stroke="#b45309" strokeWidth={.8} />}
      {/* mắt */}
      {blink ? <path d="M9 -38 L 15 -38 M 19 -38 L 25 -38" stroke="#1e3a8a" strokeWidth={2} strokeLinecap="round" /> : (
        <g><circle cx={12} cy={-38} r={3.2} fill="#fff" /><circle cx={13} cy={-38} r={1.8} fill="#1e3a8a" /><circle cx={22} cy={-38} r={3.2} fill="#fff" /><circle cx={23} cy={-38} r={1.8} fill="#1e3a8a" /><circle cx={13.6} cy={-38.8} r={.6} fill="#fff" /><circle cx={23.6} cy={-38.8} r={.6} fill="#fff" /></g>
      )}
      {/* miệng + má */}
      <path d="M17 -30 Q 21 -27 25 -30" stroke="#1e3a8a" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <circle cx={9} cy={-31} r={2.2} fill="#f9a8d4" opacity={.8} /><circle cx={27} cy={-31} r={2.2} fill="#f9a8d4" opacity={.8} />
    </g>
  );
}

export function Cloud({ x, y, scale = 1, duration = 60, delay = 0 }: { x: number; y: number; scale?: number; duration?: number; delay?: number }) {
  return (
    <g className="farm-cloud" style={{ animationDuration: `${duration}s`, animationDelay: `-${delay}s` }}>
      <g transform={`translate(${x} ${y}) scale(${scale})`} opacity={.9}>
        <ellipse cx={0} cy={0} rx={28} ry={12} fill="#fff" /><ellipse cx={-16} cy={4} rx={16} ry={9} fill="#fff" /><ellipse cx={14} cy={3} rx={18} ry={10} fill="#fff" /><circle cx={4} cy={-8} r={12} fill="#fff" />
      </g>
    </g>
  );
}
