"use client";
// Vẽ LÀNG QUÊ quanh nông trại (xem lib/farm/village.ts cho bố cục): nền đất + đường, nhà/cây tĩnh theo vùng che, xe cộ và dân làng chuyển động.
// Xe/người chạy bằng SMIL <animateMotion> (trình duyệt tự chạy, không tốn React render) trên các làn định sẵn.
import { memo, useMemo } from "react";
import { TILE_H, TILE_W } from "./Sprites";
import { BUILDING_INFO, rand01, zoneOf, type BKind, type VBuilding, type VLane, type VPatch, type VPerson, type VProp, type VVehicle, type Village, type VenueId, type Zone } from "@/lib/farm/village";

export type Proj = { ox: number; top: number; M: number };
export const scr = (p: Proj, gx: number, gy: number) => ({ cx: p.ox + ((gx - gy) * TILE_W) / 2, cy: p.top + ((gx + gy + 2 * p.M) * TILE_H) / 2 + TILE_H / 2 });
const TW2 = TILE_W / 2, TH2 = TILE_H / 2;
// điểm cục bộ (u,v tính theo ô, z tính theo px) quanh gốc (0,0,0)
const P = (u: number, v: number, z: number) => `${((u - v) * TW2).toFixed(1)},${((u + v) * TH2 - z).toFixed(1)}`;
const pt = (u: number, v: number, z: number) => ({ x: (u - v) * TW2, y: (u + v) * TH2 - z });
const EMOJI = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
const shade = (hex: string, k: number) => { // k<1 tối hơn, k>1 sáng hơn
  const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
};

// ── Khối hộp isometric: mặt trái (v lớn), mặt phải (u lớn), nắp ─────────────────
function IsoBox({ u0, v0, u1, v1, z0 = 0, z1, c, stroke = "rgba(0,0,0,.12)" }: { u0: number; v0: number; u1: number; v1: number; z0?: number; z1: number; c: string; stroke?: string }) {
  return (
    <g stroke={stroke} strokeWidth={0.6} strokeLinejoin="round">
      <polygon points={[P(u0, v1, z0), P(u1, v1, z0), P(u1, v1, z1), P(u0, v1, z1)].join(" ")} fill={shade(c, 0.9)} />
      <polygon points={[P(u1, v0, z0), P(u1, v1, z0), P(u1, v1, z1), P(u1, v0, z1)].join(" ")} fill={shade(c, 0.72)} />
      <polygon points={[P(u0, v0, z1), P(u1, v0, z1), P(u1, v1, z1), P(u0, v1, z1)].join(" ")} fill={shade(c, 1.08)} />
    </g>
  );
}
const poly = (pts: string[], fill: string, stroke = "rgba(0,0,0,.14)") => <polygon points={pts.join(" ")} fill={fill} stroke={stroke} strokeWidth={0.6} strokeLinejoin="round" />;

// Mái đầu hồi (sống mái chạy theo trục u), mái chóp (kim tự tháp), mái bằng
function Gable({ u0 = -1, u1 = 1, v0 = -1, v1 = 1, z, rh, o = 0.12, roof, wall }: { u0?: number; u1?: number; v0?: number; v1?: number; z: number; rh: number; o?: number; roof: string; wall: string }) {
  const vm = (v0 + v1) / 2;
  return (
    <g>
      {poly([P(u0 - o, v0 - o, z), P(u1 + o, v0 - o, z), P(u1 + o, vm, z + rh), P(u0 - o, vm, z + rh)], shade(roof, 0.8))}
      {poly([P(u1, v0, z), P(u1, v1, z), P(u1, vm, z + rh)], shade(wall, 0.72))}
      {poly([P(u0 - o, v1 + o, z), P(u1 + o, v1 + o, z), P(u1 + o, vm, z + rh), P(u0 - o, vm, z + rh)], roof)}
      <line x1={pt(u0 - o, vm, z + rh).x} y1={pt(u0 - o, vm, z + rh).y} x2={pt(u1 + o, vm, z + rh).x} y2={pt(u1 + o, vm, z + rh).y} stroke={shade(roof, 1.25)} strokeWidth={1.6} />
    </g>
  );
}
function Hip({ u0 = -1, u1 = 1, v0 = -1, v1 = 1, z, rh, o = 0.1, roof, stripe }: { u0?: number; u1?: number; v0?: number; v1?: number; z: number; rh: number; o?: number; roof: string; stripe?: string }) {
  const um = (u0 + u1) / 2, vm = (v0 + v1) / 2, A = `${P(um, vm, z + rh)}`;
  const a = [u0 - o, v0 - o], b = [u1 + o, v0 - o], c = [u1 + o, v1 + o], d = [u0 - o, v1 + o];
  const front = (p: number[], q: number[], col: string) => {
    if (!stripe) return poly([P(p[0], p[1], z), P(q[0], q[1], z), A], col);
    const n = 6; const out = [];
    for (let i = 0; i < n; i++) { const t0 = i / n, t1 = (i + 1) / n; out.push(poly([P(p[0] + (q[0] - p[0]) * t0, p[1] + (q[1] - p[1]) * t0, z), P(p[0] + (q[0] - p[0]) * t1, p[1] + (q[1] - p[1]) * t1, z), A], i % 2 ? stripe : col, "rgba(0,0,0,.08)")); }
    return <g>{out}</g>;
  };
  return (
    <g>
      {poly([P(a[0], a[1], z), P(b[0], b[1], z), A], shade(roof, 0.7))}
      {poly([P(a[0], a[1], z), P(d[0], d[1], z), A], shade(roof, 0.75))}
      <g>{front(d, c, shade(roof, 0.95))}</g>
      <g>{front(c, b, shade(roof, 0.8))}</g>
    </g>
  );
}
function Awning({ u0, u1, v, z, depth = 0.4, c1, c2, n = 6 }: { u0: number; u1: number; v: number; z: number; depth?: number; c1: string; c2: string; n?: number }) {
  return <g>{Array.from({ length: n }, (_, i) => { const a = u0 + ((u1 - u0) * i) / n, b = u0 + ((u1 - u0) * (i + 1)) / n; return <g key={i}>{poly([P(a, v, z), P(b, v, z), P(b, v + depth, z - 9), P(a, v + depth, z - 9)], i % 2 ? c2 : c1, "rgba(0,0,0,.1)")}</g>; })}</g>;
}
const faceV = (u0: number, u1: number, v: number, z0: number, z1: number, fill: string) => poly([P(u0, v, z0), P(u1, v, z0), P(u1, v, z1), P(u0, v, z1)], fill, "rgba(0,0,0,.25)");
const faceU = (v0: number, v1: number, u: number, z0: number, z1: number, fill: string) => poly([P(u, v0, z0), P(u, v1, z0), P(u, v1, z1), P(u, v0, z1)], fill, "rgba(0,0,0,.25)");
const GLASS = "#cfe9ff";

type Look = { wall: string; roof: string; hgt: number; rh: number; door?: string; awning?: [string, string]; tower?: { roof: string; h: number }; chimney?: boolean; roofKind?: "gable" | "hip"; stripe?: string; extra?: string };
const LOOK: Record<BKind, Look> = {
  post: { wall: "#f3e2bd", roof: "#dc2626", hgt: 34, rh: 26, door: "#7c2d12", chimney: true },
  market: { wall: "#e8c27a", roof: "#f8fafc", hgt: 24, rh: 22, awning: ["#ef4444", "#fff7ed"], roofKind: "gable" },
  store: { wall: "#bcd8fb", roof: "#1d4ed8", hgt: 36, rh: 24, door: "#1e3a8a", awning: ["#2563eb", "#eff6ff"] },
  school: { wall: "#fde68a", roof: "#b45309", hgt: 36, rh: 26, door: "#78350f", tower: { roof: "#7c2d12", h: 34 } },
  diner: { wall: "#fecdd3", roof: "#9f1239", hgt: 32, rh: 24, door: "#4c0519", awning: ["#e11d48", "#fff1f2"], chimney: true },
  hall: { wall: "#e5e7eb", roof: "#7c2d12", hgt: 46, rh: 30, door: "#451a03", tower: { roof: "#78350f", h: 52 } },
  depot: { wall: "#a8b0bd", roof: "#475569", hgt: 38, rh: 16, door: "#334155" },
  library: { wall: "#ddd6fe", roof: "#5b21b6", hgt: 40, rh: 24, door: "#3b0764" },
  vet: { wall: "#bbf7d0", roof: "#15803d", hgt: 32, rh: 24, door: "#14532d" },
  fair: { wall: "#fef3c7", roof: "#dc2626", hgt: 22, rh: 52, stripe: "#fffbeb", roofKind: "hip" },
  house: { wall: "#fef0c7", roof: "#c2410c", hgt: 32, rh: 26, door: "#7c2d12", chimney: true },
  cottage: { wall: "#d9bd8c", roof: "#a16207", hgt: 28, rh: 26, door: "#5b3a1a", chimney: true },
  barn: { wall: "#b91c1c", roof: "#7c2d12", hgt: 34, rh: 26, door: "#fff7ed" },
  silo: { wall: "#cbd5e1", roof: "#64748b", hgt: 60, rh: 0 },
  windmill: { wall: "#f1e4c7", roof: "#7c2d12", hgt: 64, rh: 26 },
};

function Building({ b }: { b: VBuilding }) {
  const L = LOOK[b.kind]; const k = b.kind; const info = b.venue ? BUILDING_INFO[b.venue] : null;
  const small = k === "silo" || k === "windmill";
  if (k === "silo") {
    return (
      <g>
        <ellipse cx={0} cy={0} rx={26} ry={13} fill="rgba(0,0,0,.18)" />
        <path d="M-22 0 v-58 a22 11 0 0 1 44 0 v58 a22 11 0 0 1 -44 0z" fill="#cbd5e1" stroke="rgba(0,0,0,.2)" />
        <path d="M0 -58 a22 11 0 0 1 22 0 v58 a22 11 0 0 1 -22 11z" fill="rgba(0,0,0,.12)" />
        <ellipse cx={0} cy={-58} rx={22} ry={11} fill="#94a3b8" /><path d="M-22 -40h44M-22 -22h44" stroke="rgba(0,0,0,.18)" />
        <path d="M-22 -58 a22 11 0 0 1 44 0z" fill="#ef4444" transform="translate(0 -2)" />
      </g>
    );
  }
  if (k === "windmill") {
    return (
      <g>
        <ellipse cx={0} cy={4} rx={44} ry={22} fill="rgba(0,0,0,.16)" />
        <polygon points={`${P(-0.7, 0.7, 0)} ${P(0.7, 0.7, 0)} ${P(0.4, 0.4, 70)} ${P(-0.4, 0.4, 70)}`} fill="#efe1c0" stroke="rgba(0,0,0,.18)" />
        <polygon points={`${P(0.7, -0.7, 0)} ${P(0.7, 0.7, 0)} ${P(0.4, 0.4, 70)} ${P(0.4, -0.4, 70)}`} fill="#cdbb93" stroke="rgba(0,0,0,.18)" />
        <Hip u0={-0.45} u1={0.45} v0={-0.45} v1={0.45} z={70} rh={20} roof="#7c2d12" o={0.05} />
        <g transform={`translate(${pt(0, 0.5, 60).x} ${pt(0, 0.5, 60).y})`}>
          <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="16s" repeatCount="indefinite" />
            {[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a})`}><rect x={-3} y={-48} width={6} height={48} fill="#a16207" /><rect x={-14} y={-48} width={14} height={30} fill="#fff7ed" stroke="#a16207" strokeWidth={1.2} opacity={0.95} /></g>)}
            <circle r={5} fill="#7c2d12" /></g>
        </g>
      </g>
    );
  }
  const hgt = L.hgt, rh = L.rh;
  const roofZ = hgt;
  const twr = L.tower;
  return (
    <g>
      <polygon points={[P(-1.15, -1.15, 0), P(1.15, -1.15, 0), P(1.15, 1.15, 0), P(-1.15, 1.15, 0)].join(" ")} fill="rgba(0,0,0,.14)" />
      <IsoBox u0={-1} u1={1} v0={-1} v1={1} z1={hgt} c={L.wall} />
      {/* cửa + cửa sổ trên mặt trước-trái (v=1) và trước-phải (u=1) */}
      {L.door && faceV(-0.28, 0.28, 1, 0, 24, L.door)}
      {k === "depot" && <><g>{faceV(-0.7, 0.7, 1, 0, 28, "#334155")}{[8, 14, 20].map((z) => <g key={z}>{faceV(-0.7, 0.7, 1, z, z + 0.01, "#1f2937")}</g>)}</g></>}
      {k === "market" && <>{faceV(-0.85, 0.85, 1, 0, 14, "#7c4a22")}<text x={pt(-0.45, 1.15, 18).x} y={pt(-0.45, 1.15, 18).y} fontSize={13} fontFamily={EMOJI}>🍎</text><text x={pt(0, 1.15, 18).x} y={pt(0, 1.15, 18).y} fontSize={13} fontFamily={EMOJI}>🥕</text><text x={pt(0.45, 1.15, 18).x} y={pt(0.45, 1.15, 18).y} fontSize={13} fontFamily={EMOJI}>🌽</text></>}
      {k !== "depot" && k !== "market" && k !== "fair" && <>{faceV(-0.8, -0.45, 1, 16, 30, GLASS)}{faceV(0.45, 0.8, 1, 16, 30, GLASS)}{faceU(-0.7, -0.3, 1, 14, 28, GLASS)}{faceU(0.3, 0.7, 1, 14, 28, GLASS)}</>}
      {k === "library" && [-0.62, 0.62].map((u) => <g key={u}>{faceV(u - 0.08, u + 0.08, 1.02, 0, hgt - 2, "#f5f3ff")}</g>)}
      {k === "vet" && <g transform={`translate(${pt(0, 1, hgt + 10).x} ${pt(0, 1, hgt + 10).y})`}><circle r={9} fill="#fff" stroke="#dc2626" strokeWidth={1.5} /><path d="M-5 0h10M0 -5v10" stroke="#dc2626" strokeWidth={3} /></g>}
      {k === "barn" && <g>{faceV(-0.5, 0.5, 1, 0, 26, "#fff7ed")}<path d={`M${pt(-0.5, 1, 0).x} ${pt(-0.5, 1, 0).y}L${pt(0.5, 1, 26).x} ${pt(0.5, 1, 26).y}M${pt(0.5, 1, 0).x} ${pt(0.5, 1, 0).y}L${pt(-0.5, 1, 26).x} ${pt(-0.5, 1, 26).y}`} stroke="#b91c1c" strokeWidth={2} /></g>}
      {L.awning && <Awning u0={-0.95} u1={0.95} v={1} z={k === "market" ? 36 : 32} depth={0.45} c1={L.awning[0]} c2={L.awning[1]} />}
      {L.roofKind === "hip" ? <Hip z={roofZ} rh={rh} roof={L.roof} stripe={L.stripe} o={0.18} /> : <Gable z={roofZ} rh={rh} roof={L.roof} wall={L.wall} />}
      {k === "fair" && [-0.9, 0.9].map((u) => <g key={u} transform={`translate(${pt(u, 0.9, 0).x} ${pt(u, 0.9, 0).y})`}><rect x={-1.5} y={-56} width={3} height={56} fill="#7c2d12" /><path d="M1.5 -56l16 5-16 5z" fill="#facc15"><animate attributeName="d" dur="1.4s" repeatCount="indefinite" values="M1.5 -56l16 5-16 5z;M1.5 -56l16 7-16 3z;M1.5 -56l16 5-16 5z" /></path></g>)}
      {L.chimney && <><IsoBox u0={-0.6} u1={-0.35} v0={-0.4} v1={-0.15} z0={hgt + 6} z1={hgt + rh + 14} c="#8b5a3c" /><g transform={`translate(${pt(-0.48, -0.28, hgt + rh + 16).x} ${pt(-0.48, -0.28, hgt + rh + 16).y})`}><circle r={4} fill="#fff" className="vg-smoke" /><circle r={3} fill="#fff" className="vg-smoke" style={{ animationDelay: "-1.4s" }} /></g></>}
      {twr && (
        <g>
          <IsoBox u0={-0.9} u1={-0.35} v0={-0.9} v1={-0.35} z0={hgt - 4} z1={hgt + twr.h} c={shade(L.wall, 0.95)} />
          <Hip u0={-0.9} u1={-0.35} v0={-0.9} v1={-0.35} z={hgt + twr.h} rh={20} roof={twr.roof} o={0.08} />
          {k === "hall" && <g transform={`translate(${pt(-0.62, -0.35, hgt + twr.h - 14).x} ${pt(-0.62, -0.35, hgt + twr.h - 14).y})`}><circle r={7} fill="#fff" stroke="#78350f" strokeWidth={1.4} /><path d="M0 0v-4M0 0l3 2" stroke="#1f2937" strokeWidth={1.2} /></g>}
          {k === "school" && <text x={pt(-0.62, -0.35, hgt + twr.h - 8).x - 5} y={pt(-0.62, -0.35, hgt + twr.h - 8).y} fontSize={11} fontFamily={EMOJI}>🔔</text>}
        </g>
      )}
      {info && <Label x={0} y={-(hgt + rh + (twr ? twr.h * 0.55 : 0)) - 12} icon={info.icon} text={info.name} />}
      {!info && small && null}
    </g>
  );
}

export function Label({ x, y, icon, text }: { x: number; y: number; icon: string; text: string }) {
  const w = text.length * 6.4 + 34;
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={22} rx={11} fill="#fff" stroke="#1e3a8a" strokeWidth={1.4} opacity={0.96} />
      <text x={-w / 2 + 9} y={5} fontSize={12} fontFamily={EMOJI}>{icon}</text>
      <text x={-w / 2 + 25} y={4.5} fontSize={11.5} fontWeight={800} fill="#1e3a8a">{text}</text>
    </g>
  );
}

// ── Cây cối, đồ vật ───────────────────────────────────────────────────────────
const GREENS = ["#4d9a3a", "#58a845", "#3f8a30", "#6ab04c"];
function Prop({ p }: { p: VProp }) {
  const s = p.s; const g = GREENS[Math.floor(rand01(p.x, p.y, 2) * GREENS.length)];
  switch (p.kind) {
    case "tree": return (
      <g transform={`scale(${s})`}>
        <ellipse cx={0} cy={2} rx={20} ry={9} fill="rgba(0,0,0,.16)" /><rect x={-3.5} y={-22} width={7} height={24} rx={2} fill="#7c4a22" />
        <circle cx={0} cy={-40} r={21} fill={shade(g, 0.88)} /><circle cx={-12} cy={-31} r={15} fill={g} /><circle cx={12} cy={-32} r={15} fill={shade(g, 1.08)} /><circle cx={2} cy={-50} r={14} fill={shade(g, 1.15)} />
      </g>);
    case "pine": return (
      <g transform={`scale(${s})`}>
        <ellipse cx={0} cy={2} rx={16} ry={7} fill="rgba(0,0,0,.16)" /><rect x={-3} y={-14} width={6} height={16} fill="#6b3f1d" />
        {[[-12, 24], [-28, 19], [-44, 14]].map(([y, w], i) => <polygon key={i} points={`${-w},${y} ${w},${y} 0,${y - 26}`} fill={shade("#2f7d4a", 1 + i * 0.1)} />)}
      </g>);
    case "bush": return (
      <g transform={`scale(${s})`}><ellipse cx={0} cy={2} rx={15} ry={6} fill="rgba(0,0,0,.14)" /><ellipse cx={-7} cy={-6} rx={11} ry={9} fill={shade(g, 0.9)} /><ellipse cx={7} cy={-6} rx={11} ry={9} fill={g} /><ellipse cx={0} cy={-11} rx={10} ry={8} fill={shade(g, 1.12)} />
        <circle cx={-6} cy={-9} r={1.8} fill="#fda4af" /><circle cx={7} cy={-5} r={1.8} fill="#fde047" /></g>);
    case "rock": return <g transform={`scale(${s})`}><ellipse cx={0} cy={2} rx={14} ry={5} fill="rgba(0,0,0,.14)" /><polygon points="-14,0 -9,-12 3,-15 13,-7 14,0" fill="#9ca3af" stroke="rgba(0,0,0,.2)" /><polygon points="-9,-12 3,-15 0,-6" fill="#cbd5e1" /></g>;
    case "hay": return <g transform={`scale(${s})`}><ellipse cx={0} cy={2} rx={17} ry={7} fill="rgba(0,0,0,.14)" /><path d="M-15 0v-14a15 8 0 0 1 30 0v14a15 8 0 0 1-30 0z" fill="#e5c158" stroke="#a16207" strokeWidth={0.8} /><ellipse cx={0} cy={-14} rx={15} ry={8} fill="#f1d576" /><path d="M-9 -14h18M-6 -10h12" stroke="#b7791f" strokeWidth={0.8} /></g>;
    case "lamp": return <g><ellipse cx={0} cy={1} rx={6} ry={3} fill="rgba(0,0,0,.18)" /><rect x={-1.6} y={-44} width={3.2} height={45} fill="#334155" /><path d="M-8 -44h16l-3 -9h-10z" fill="#475569" /><circle cx={0} cy={-49} r={4.5} fill="#fde68a" stroke="#f59e0b" strokeWidth={1} /></g>;
    case "bench": return <g><ellipse cx={0} cy={3} rx={20} ry={6} fill="rgba(0,0,0,.14)" /><rect x={-17} y={-14} width={34} height={5} fill="#a16207" /><rect x={-17} y={-22} width={34} height={5} fill="#b7791f" /><rect x={-15} y={-9} width={3} height={10} fill="#78350f" /><rect x={12} y={-9} width={3} height={10} fill="#78350f" /></g>;
    case "fountain": return (
      <g><ellipse cx={0} cy={4} rx={44} ry={22} fill="#e5e7eb" stroke="#9ca3af" /><ellipse cx={0} cy={2} rx={36} ry={17} fill="#7dd3fc" /><ellipse cx={0} cy={0} rx={30} ry={13} fill="#bae6fd" opacity={0.8} />
        <rect x={-4} y={-30} width={8} height={30} fill="#d1d5db" /><ellipse cx={0} cy={-30} rx={13} ry={6} fill="#e5e7eb" stroke="#9ca3af" />
        <path d="M0 -34 q-14 -4 -16 14 M0 -34 q14 -4 16 14 M0 -34 v-8" stroke="#e0f2fe" strokeWidth={2.4} fill="none" strokeLinecap="round" className="vg-jet" /></g>);
    case "board": return (
      <g><ellipse cx={0} cy={2} rx={22} ry={8} fill="rgba(0,0,0,.16)" /><rect x={-16} y={-36} width={4} height={38} fill="#6b3f1d" /><rect x={12} y={-36} width={4} height={38} fill="#6b3f1d" />
        <rect x={-22} y={-62} width={44} height={32} rx={3} fill="#a16207" stroke="#78350f" strokeWidth={1.5} /><rect x={-18} y={-58} width={36} height={24} fill="#fef3c7" />
        <rect x={-14} y={-55} width={11} height={9} fill="#fff" stroke="#d6d3d1" /><rect x={-1} y={-55} width={11} height={7} fill="#fecaca" stroke="#d6d3d1" /><rect x={-10} y={-44} width={12} height={8} fill="#bfdbfe" stroke="#d6d3d1" /><rect x={5} y={-45} width={10} height={9} fill="#bbf7d0" stroke="#d6d3d1" /></g>);
    case "gatepost": return (
      <g><ellipse cx={0} cy={2} rx={32} ry={10} fill="rgba(0,0,0,.16)" />{[-24, 24].map((x) => <g key={x}><rect x={x - 6} y={-50} width={12} height={52} fill="#a8a29e" stroke="#78716c" /><rect x={x - 8} y={-56} width={16} height={7} fill="#d6d3d1" stroke="#78716c" /></g>)}
        <path d="M-24 -48 Q0 -70 24 -48" fill="none" stroke="#7c2d12" strokeWidth={5} /><rect x={-20} y={-72} width={40} height={14} rx={3} fill="#7c2d12" /><text x={0} y={-62} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fde68a">WELCOME</text></g>);
    default: return null;
  }
}

// ── Xe cộ: ghép từ các khối hộp, trục chạy = x hoặc y, sign = chiều chạy ─────────
type Part = [number, number, number, number, number, number, string]; // a0,a1,b0,b1,z0,z1,màu
function vehicleParts(kind: VVehicle["kind"], c: string): { parts: Part[]; wheels: { a: number; r: number }[]; w: number } {
  switch (kind) {
    case "car": return { w: 0.2, wheels: [{ a: -0.26, r: 5 }, { a: 0.26, r: 5 }], parts: [[-0.4, 0.4, -0.2, 0.2, 3, 12, c], [-0.18, 0.12, -0.18, 0.18, 12, 21, shade(c, 1.15)]] };
    case "pickup": return { w: 0.22, wheels: [{ a: -0.28, r: 5.5 }, { a: 0.3, r: 5.5 }], parts: [[-0.45, 0.45, -0.22, 0.22, 3, 11, c], [0.02, 0.32, -0.2, 0.2, 11, 23, shade(c, 1.1)], [-0.45, -0.02, -0.22, 0.22, 11, 14, shade(c, 0.8)]] };
    case "truck": return { w: 0.26, wheels: [{ a: -0.4, r: 6 }, { a: -0.1, r: 6 }, { a: 0.38, r: 6 }], parts: [[-0.62, 0.12, -0.26, 0.26, 6, 36, "#f1f5f9"], [0.14, 0.52, -0.25, 0.25, 6, 24, c], [-0.62, 0.12, -0.27, 0.27, 6, 12, c]] };
    case "tractor": return { w: 0.18, wheels: [{ a: -0.28, r: 11 }, { a: 0.3, r: 6.5 }], parts: [[0.05, 0.42, -0.14, 0.14, 8, 18, c], [-0.38, 0.0, -0.2, 0.2, 10, 20, shade(c, 0.85)], [-0.36, -0.04, -0.2, 0.2, 20, 36, "#fef9c3"]] };
    case "bus": return { w: 0.27, wheels: [{ a: -0.45, r: 6 }, { a: 0.45, r: 6 }], parts: [[-0.72, 0.72, -0.27, 0.27, 5, 32, c], [-0.7, 0.7, -0.28, 0.28, 16, 26, "#bfdbfe"]] };
    default: return { w: 0.24, wheels: [{ a: -0.3, r: 5.5 }, { a: 0.3, r: 5.5 }], parts: [[-0.5, 0.5, -0.24, 0.24, 5, 28, c], [-0.5, 0.5, -0.25, 0.25, 12, 17, "#ef4444"]] };
  }
}
export function VehicleSprite({ kind, color, axis, sign }: { kind: VVehicle["kind"]; color: string; axis: "x" | "y"; sign: 1 | -1 }) {
  const { parts, wheels, w } = vehicleParts(kind, color);
  const map = (a: number, b: number) => (axis === "x" ? { u: a * sign, v: b } : { u: b, v: a * sign });
  const boxes = parts.map(([a0, a1, b0, b1, z0, z1, c], i) => {
    const A0 = Math.min(a0 * sign, a1 * sign), A1 = Math.max(a0 * sign, a1 * sign);
    const [u0, u1, v0, v1] = axis === "x" ? [A0, A1, b0, b1] : [b0, b1, A0, A1];
    return { u0, u1, v0, v1, z0, z1, c, k: u0 + u1 + v0 + v1 + z1 * 0.001, i };
  }).sort((a, b) => a.k - b.k);
  return (
    <g>
      <ellipse cx={0} cy={4} rx={34} ry={13} fill="rgba(0,0,0,.2)" />
      {boxes.map((b) => <IsoBox key={b.i} u0={b.u0} u1={b.u1} v0={b.v0} v1={b.v1} z0={b.z0} z1={b.z1} c={b.c} />)}
      {wheels.map((wh, i) => { const { u, v } = axis === "x" ? map(wh.a, w) : map(wh.a, w); const p = pt(u, v, wh.r); return <g key={i}><circle cx={p.x} cy={p.y} r={wh.r} fill="#1f2937" /><circle cx={p.x} cy={p.y} r={wh.r * 0.42} fill="#9ca3af" /></g>; })}
      {kind === "tractor" && (() => { const q = map(-0.3, 0.2); const p = pt(q.u, q.v, 12); return <circle cx={p.x} cy={p.y} r={11} fill="#1f2937" stroke="#4b5563" strokeWidth={2} />; })()}
    </g>
  );
}

// ── Người ───────────────────────────────────────────────────────────────────
export function PersonSprite({ shirt, hat, kid, walk = true, skin = "#f3c9a0" }: { shirt: string; hat?: string; kid?: boolean; walk?: boolean; skin?: string }) {
  const k = kid ? 0.78 : 1;
  return (
    <g transform={`scale(${k})`}>
      <ellipse cx={0} cy={2} rx={9} ry={3.4} fill="rgba(0,0,0,.2)" />
      <g className={walk ? "vg-bob" : undefined}>
        <g className={walk ? "vg-leg" : undefined}><rect x={-4.2} y={-13} width={3.6} height={13} rx={1.4} fill="#374151" /></g>
        <g className={walk ? "vg-leg2" : undefined}><rect x={0.6} y={-13} width={3.6} height={13} rx={1.4} fill="#4b5563" /></g>
        <rect x={-6} y={-27} width={12} height={16} rx={4} fill={shirt} stroke="rgba(0,0,0,.18)" strokeWidth={0.6} />
        <rect x={-8.4} y={-26} width={3} height={11} rx={1.5} fill={shade(shirt, 0.85)} /><rect x={5.4} y={-26} width={3} height={11} rx={1.5} fill={shade(shirt, 0.85)} />
        <circle cx={0} cy={-33} r={6.4} fill={skin} stroke="rgba(0,0,0,.15)" strokeWidth={0.6} />
        {hat === "straw" ? <><ellipse cx={0} cy={-37} rx={10} ry={3} fill="#e5c158" /><path d="M-5 -37 a5 5 0 0 1 10 0z" fill="#d4a93a" /></>
          : hat === "cap" ? <path d="M-6.5 -36 a6.5 6 0 0 1 13 0z M5 -36h6" fill="#2563eb" stroke="#1e3a8a" strokeWidth={0.8} />
          : hat === "scarf" ? <path d="M-6.5 -34 a6.5 7 0 0 1 13 0 q-6.5 -3 -13 0z" fill="#ef4444" />
          : <path d="M-6.4 -34 a6.4 6.6 0 0 1 12.8 0 q-6.4 -4 -12.8 0z" fill="#5b3a1a" />}
        <circle cx={2.2} cy={-33} r={0.9} fill="#1f2937" />
      </g>
    </g>
  );
}

// ── Nền đất, đường, ruộng, ao ─────────────────────────────────────────────────
const FIELD_COLORS = [["#c9a227", "#e5c548"], ["#4d9a3a", "#6ab04c"], ["#7c5aa6", "#a78bd1"], ["#d6a23a", "#f2c94c"]];
function diamond(p: Proj, x: number, y: number, w: number, h: number) {
  const T = scr(p, x - 0.5, y - 0.5), R = scr(p, x + w - 0.5, y - 0.5), B = scr(p, x + w - 0.5, y + h - 0.5), L = scr(p, x - 0.5, y + h - 0.5);
  const f = (q: { cx: number; cy: number }) => `${q.cx.toFixed(1)},${(q.cy - TH2).toFixed(1)}`;
  return { pts: [f(T), f(R), f(B), f(L)].join(" "), T, R, B, L };
}
function Patch({ p, v }: { p: Proj; v: VPatch }) {
  const d = diamond(p, v.x, v.y, v.w, v.h);
  const cy = (a: { cy: number }) => a.cy - TH2;
  if (v.kind === "yard") return null;
  if (v.kind === "road") {
    const A = v.dir === "x" ? scr(p, v.x - 0.5, v.y) : scr(p, v.x, v.y - 0.5), B = v.dir === "x" ? scr(p, v.x + v.w - 0.5, v.y) : scr(p, v.x, v.y + v.h - 0.5);
    return <g><polygon points={d.pts} fill="#767b86" /><polygon points={d.pts} fill="none" stroke="#e5e7eb" strokeWidth={2.2} opacity={0.55} strokeDasharray="0" />
      <line x1={A.cx} y1={cy(A)} x2={B.cx} y2={cy(B)} stroke="#fde68a" strokeWidth={2.4} strokeDasharray="16 14" /></g>;
  }
  if (v.kind === "dirt") return <g><polygon points={d.pts} fill="#c9a36d" /><polygon points={d.pts} fill="none" stroke="#a98250" strokeWidth={1.4} opacity={0.6} /></g>;
  if (v.kind === "walk") return <g><polygon points={d.pts} fill="#d8d3c4" /><polygon points={d.pts} fill="none" stroke="#b9b3a2" strokeWidth={1.2} /></g>;
  if (v.kind === "plaza") {
    const cells = []; for (let i = 0; i < v.w; i++) for (let j = 0; j < v.h; j++) { const q = diamond(p, v.x + i, v.y + j, 1, 1); cells.push(<polygon key={`${i},${j}`} points={q.pts} fill={(i + j) % 2 ? "#e9dfc8" : "#dfd3b7"} stroke="#c9bb9a" strokeWidth={0.8} />); }
    return <g>{cells}</g>;
  }
  if (v.kind === "pond") {
    const c = scr(p, v.x + (v.w - 1) / 2, v.y + (v.h - 1) / 2); const rx = ((v.w + v.h) / 2) * TW2 * 0.95, ry = rx * 0.5;
    return <g><ellipse cx={c.cx} cy={c.cy} rx={rx + 6} ry={ry + 3} fill="#9ccf6a" /><ellipse cx={c.cx} cy={c.cy} rx={rx} ry={ry} fill="#5fb3e6" stroke="#3b82b8" strokeWidth={1.4} /><ellipse cx={c.cx - rx * 0.2} cy={c.cy - ry * 0.2} rx={rx * 0.55} ry={ry * 0.5} fill="#8fd0f2" opacity={0.8} />
      <path d={`M${c.cx - rx * 0.4} ${c.cy} q8 -4 16 0 M${c.cx + rx * 0.2} ${c.cy + ry * 0.3} q8 -4 16 0`} stroke="#e0f2fe" strokeWidth={1.4} fill="none" /></g>;
  }
  if (v.kind === "field") {
    const [c1, c2] = FIELD_COLORS[(v.variant ?? 0) % FIELD_COLORS.length]; const rows = [];
    const alongX = (v.variant ?? 0) % 2 === 0; const n = alongX ? v.h * 2 : v.w * 2;
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n;
      const q = alongX ? diamond(p, v.x, v.y + v.h * t0 + 0.0, v.w, v.h * (t1 - t0)) : diamond(p, v.x + v.w * t0, v.y, v.w * (t1 - t0), v.h);
      rows.push(<polygon key={i} points={q.pts} fill={i % 2 ? c1 : c2} stroke="#7c5a2a" strokeWidth={0.6} opacity={0.96} />);
    }
    return <g><polygon points={d.pts} fill="#8a6a3c" />{rows}</g>;
  }
  return null; // orchard: vẽ bằng cây ở VillageLayer
}

const mountain = (x: number, w: number, h: number, y: number, c: string) => <path key={`${x}-${w}`} d={`M${x - w / 2} ${y} L${x - w * 0.12} ${y - h} L${x + w * 0.05} ${y - h * 0.82} L${x + w * 0.2} ${y - h * 0.97} L${x + w / 2} ${y}z`} fill={c} />;

export const WorldGround = memo(function WorldGround({ village, proj, vbW, vbH }: { village: Village; proj: Proj; vbW: number; vbH: number }) {
  const { W, H, M } = village;
  const world = diamond(proj, -M, -M, W + 2 * M, H + 2 * M);
  const hz = proj.top - 8;
  const mountains = useMemo(() => {
    const out = []; let x = -vbW * 0.2; let i = 0;
    while (x < vbW * 1.25) { const w = 260 + rand01(i, 3, 1) * 220; out.push(mountain(x, w, 40 + rand01(i, 4, 2) * 44, hz + 2, i % 2 ? "#a7c4cf" : "#93b4c2")); x += w * 0.55; i++; }
    return out;
  }, [vbW, hz]);
  const trees = useMemo(() => Array.from({ length: Math.round(vbW / 26) }, (_, i) => { const x = -vbW * 0.2 + (i / Math.round(vbW / 26)) * vbW * 1.4; const s = 0.5 + rand01(i, 1, 4) * 0.4; return <g key={i} transform={`translate(${x} ${hz + 1}) scale(${s})`}><circle cx={0} cy={-18} r={15} fill="#4f9a4a" /><circle cx={10} cy={-13} r={11} fill="#5aa84f" /></g>; }), [vbW, hz]);
  return (
    <g pointerEvents="none">
      <g opacity={0.9}>{mountains}</g>
      <rect x={-vbW} y={hz} width={vbW * 3} height={vbH * 2} fill="#82c156" />
      <g opacity={0.95}>{trees}</g>
      <polygon points={world.pts} fill="#8ccb62" stroke="#79b54f" strokeWidth={2} />
      {village.patches.map((v) => <Patch key={v.id} p={proj} v={v} />)}
    </g>
  );
});

// ── Lớp vật tĩnh theo vùng che ────────────────────────────────────────────────
type Item = { d: number; x: number; node: React.ReactNode };
export const VillageLayer = memo(function VillageLayer({ village, proj, zone, onVenue }: { village: Village; proj: Proj; zone: Zone; onVenue?: (v: VenueId) => void }) {
  const items = useMemo(() => {
    const out: Item[] = [];
    for (const b of village.buildings) {
      if (b.zone !== zone) continue;
      const { cx, cy } = scr(proj, b.x + (b.kind === "silo" ? 0 : 0.5), b.y + (b.kind === "silo" ? 0 : 0.5));
      const click = b.venue && onVenue ? () => onVenue(b.venue!) : undefined;
      out.push({ d: b.x + b.y + (b.kind === "silo" ? 0 : 1), x: b.x, node: (
        <g key={b.id} transform={`translate(${cx} ${cy})`} className={click ? "farm-tile" : undefined} onClick={click ? (e) => { e.stopPropagation(); click(); } : undefined} role={click ? "button" : undefined} aria-label={click ? b.name : undefined}><Building b={b} /></g>
      ) });
    }
    for (const p of village.props) {
      if (p.zone !== zone) continue;
      const { cx, cy } = scr(proj, p.x, p.y);
      const click = p.venue && onVenue ? () => onVenue(p.venue!) : undefined;
      const info = p.venue ? BUILDING_INFO[p.venue] : null;
      out.push({ d: p.x + p.y, x: p.x, node: (
        <g key={p.id} transform={`translate(${cx} ${cy + 6})`} className={click ? "farm-tile" : undefined} onClick={click ? (e) => { e.stopPropagation(); click(); } : undefined} role={click ? "button" : undefined} aria-label={click && info ? info.name : undefined}>
          <Prop p={p} />{info && <Label x={0} y={p.kind === "gatepost" ? -88 : -78} icon={info.icon} text={info.name} />}
        </g>
      ) });
    }
    for (const v of village.patches) {
      if (v.kind !== "orchard") continue;
      for (let i = 0; i < v.w; i += 2) for (let j = 0; j < v.h; j += 2) {
        const x = v.x + i, y = v.y + j; if (zoneOf2(village, x, y) !== zone) continue;
        const { cx, cy } = scr(proj, x, y);
        out.push({ d: x + y, x, node: <g key={`or${x},${y}`} transform={`translate(${cx} ${cy + 6})`}><Prop p={{ id: "o", kind: "tree", x, y, zone, s: 0.9 }} /><circle cx={-9} cy={-34} r={2.6} fill="#ef4444" /><circle cx={8} cy={-40} r={2.6} fill="#ef4444" /><circle cx={0} cy={-27} r={2.6} fill="#f97316" /></g> });
      }
    }
    return out.sort((a, b) => a.d - b.d || a.x - b.x).map((i) => i.node);
  }, [village, proj, zone, onVenue]);
  return <g>{items}</g>;
});
const zoneOf2 = (v: Village, x: number, y: number) => zoneOf(x, y, v.W, v.H);

// ── Xe + dân làng chuyển động ─────────────────────────────────────────────────
const laneXY = (l: VLane, t: number, off: number) => (l.axis === "x" ? { gx: t, gy: l.at + off } : { gx: l.at + off, gy: t });
export const TrafficLayer = memo(function TrafficLayer({ village, proj, zone, what, onPerson }: { village: Village; proj: Proj; zone: Zone; what: "vehicles" | "people"; onPerson?: (p: VPerson) => void }) {
  const lanes = useMemo(() => new Map(village.lanes.map((l) => [l.id, l])), [village]);
  const nodes = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (what === "vehicles") {
      for (const v of village.vehicles) {
        const l = lanes.get(v.lane); if (!l || l.zone !== zone) continue;
        const off = v.sign > 0 ? -0.2 : 0.2; const a = l.from, b = l.to; const s = v.sign > 0 ? a : b, e = v.sign > 0 ? b : a;
        const S = laneXY(l, s, off), E = laneXY(l, e, off); const S1 = scr(proj, S.gx, S.gy), E1 = scr(proj, E.gx, E.gy);
        out.push(
          <g key={v.id} pointerEvents="none">
            <g opacity={0}>
              <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.03;0.97;1" dur={`${v.dur}s`} begin={`-${v.delay}s`} repeatCount="indefinite" />
              <animateMotion path={`M${S1.cx.toFixed(1)} ${S1.cy.toFixed(1)} L${E1.cx.toFixed(1)} ${E1.cy.toFixed(1)}`} dur={`${v.dur}s`} begin={`-${v.delay}s`} repeatCount="indefinite" />
              <VehicleSprite kind={v.kind} color={v.color} axis={l.axis} sign={v.sign} />
            </g>
          </g>
        );
      }
    } else {
      for (const p of village.people) {
        const l = lanes.get(p.lane); if (!l || p.zone !== zone) continue;
        const A = laneXY(l, l.from, 0), B = laneXY(l, l.to, 0); const a = scr(proj, A.gx, A.gy), b = scr(proj, B.gx, B.gy);
        const first = l.axis === "x" ? "1 1" : "-1 1", second = l.axis === "x" ? "-1 1" : "1 1";
        out.push(
          <g key={p.id} className="farm-tile" onClick={(e) => { e.stopPropagation(); onPerson?.(p); }} role="button" aria-label={p.name}>
            <animateMotion path={`M${a.cx.toFixed(1)} ${a.cy.toFixed(1)} L${b.cx.toFixed(1)} ${b.cy.toFixed(1)} L${a.cx.toFixed(1)} ${a.cy.toFixed(1)}`} dur={`${p.dur}s`} begin={`-${p.delay}s`} repeatCount="indefinite" />
            <g><animateTransform attributeName="transform" type="scale" calcMode="discrete" keyTimes="0;0.5" values={`${first};${second}`} dur={`${p.dur}s`} begin={`-${p.delay}s`} repeatCount="indefinite" />
              <PersonSprite shirt={p.shirt} hat={p.hat} kid={p.role === "kid"} />
            </g>
          </g>
        );
      }
    }
    return out;
  }, [village, proj, zone, what, lanes, onPerson]);
  return <g>{nodes}</g>;
});
