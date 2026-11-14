"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Catalog, DecorPlaced, FarmView, PlotView } from "@/lib/farm/api";
import { formatCountdown } from "@/lib/farm/api";
import { Cloud, CropSprite, DecorSprite, PetSprite, SoilTile, TILE_H, TILE_W, diamondPoints } from "./Sprites";

export type SceneMode =
  | { type: "normal" }
  | { type: "edit"; selected: { kind: "plot" | "decor"; id: string } | null }
  | { type: "place"; itemKey: string; label: string };

type Props = {
  farm: FarmView; plots: PlotView[]; catalog: Catalog; now: number; mode: SceneMode; readOnly?: boolean;
  pet: { name: string; level: number }; petJumping?: boolean; hearts?: number[];
  onTileClick?: (x: number, y: number) => void; onPlotClick?: (plot: PlotView) => void;
  onDecorClick?: (d: DecorPlaced) => void; onPetClick?: () => void;
};

const TOP_PAD = 110;

// LƯU Ý SVG: CSS animation có transform sẽ GHI ĐÈ thuộc tính transform của phần tử → luôn tách
// <g transform=...> (vị trí) và <g className="farm-..."> (hoạt ảnh) thành 2 lớp lồng nhau.
// Trạng thái cây theo giờ client (server trả readyAt; client tự đếm để không phải gọi lại API)
export function liveStatus(plot: PlotView, now: number) {
  if (plot.status === "EMPTY" || !plot.readyAt || !plot.plantedAt) return { status: plot.status, growth: 0, msLeft: 0 };
  const ready = new Date(plot.readyAt).getTime(); const planted = new Date(plot.plantedAt).getTime();
  const growth = Math.max(0, Math.min(1, (now - planted) / Math.max(1, ready - planted)));
  return { status: now >= ready ? ("READY" as const) : ("GROWING" as const), growth, msLeft: ready - now };
}

export default function FarmScene({ farm, plots, catalog, now, mode, readOnly, pet, petJumping, hearts = [], onTileClick, onPlotClick, onDecorClick, onPetClick }: Props) {
  const W = farm.gridW, H = farm.gridH;
  const originX = (H * TILE_W) / 2;
  const vbW = ((W + H) * TILE_W) / 2;
  const vbH = TOP_PAD + ((W + H) * TILE_H) / 2 + 48;
  const toScreen = (gx: number, gy: number) => ({ cx: originX + ((gx - gy) * TILE_W) / 2, cy: TOP_PAD + ((gx + gy) * TILE_H) / 2 + TILE_H / 2 });

  const occupied = useMemo(() => {
    const s = new Set<string>();
    plots.forEach((p) => s.add(`${p.x},${p.y}`));
    farm.layout.forEach((d) => s.add(`${d.x},${d.y}`));
    return s;
  }, [plots, farm.layout]);

  // Thú cưng đi dạo: đổi chỗ ngẫu nhiên vài giây một lần giữa các ô trống
  const [petPos, setPetPos] = useState({ x: W - 1, y: H - 1 });
  useEffect(() => {
    const pick = () => {
      const free: { x: number; y: number }[] = [];
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!occupied.has(`${x},${y}`)) free.push({ x, y });
      if (free.length) setPetPos(free[Math.floor(Math.random() * free.length)]);
    };
    pick();
    const t = setInterval(pick, 7000);
    return () => clearInterval(t);
  }, [W, H, occupied]);
  const [blink, setBlink] = useState(false);
  useEffect(() => { const t = setInterval(() => { setBlink(true); setTimeout(() => setBlink(false), 160); }, 3200); return () => clearInterval(t); }, []);

  // Điện thoại: khung cuộn ngang → mở ra ở giữa đất thay vì mép trái
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, [W, H]);

  const plotAt = useMemo(() => new Map(plots.map((p) => [`${p.x},${p.y}`, p])), [plots]);
  const decorAt = useMemo(() => new Map(farm.layout.map((d) => [`${d.x},${d.y}`, d])), [farm.layout]);

  const selectedId = mode.type === "edit" ? mode.selected?.id : null;
  const placing = mode.type === "place";

  // Vẽ theo thứ tự chiều sâu để vật phía trước che vật phía sau
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push({ x, y });
  cells.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);

  // Bệ đất 3D
  const corners = { top: toScreen(0, 0), right: toScreen(W - 1, 0), bottom: toScreen(W - 1, H - 1), left: toScreen(0, H - 1) };
  const thick = 16;

  return (
    <div ref={scrollRef} className="farm-scene relative rounded-2xl overflow-x-auto overflow-y-hidden border border-line" style={{ background: "linear-gradient(180deg,#bae6fd 0%,#e0f2fe 45%,#dcfce7 100%)" }}>
      {/* Trên điện thoại khung đất rộng tối thiểu ~640px (cuộn ngang) để ô đất đủ lớn mà bấm; desktop tự co theo cột */}
      <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" aria-label="Nông trại" style={{ minWidth: Math.min(vbW, 640) }}>
        <Cloud x={-80} y={30} scale={0.8} duration={70} delay={10} />
        <Cloud x={-120} y={60} scale={1.1} duration={95} delay={40} />
        <Cloud x={-60} y={16} scale={0.6} duration={55} delay={25} />
        {/* bệ đất */}
        <polygon points={`${corners.left.cx - TILE_W / 2},${corners.left.cy} ${corners.bottom.cx},${corners.bottom.cy + TILE_H / 2} ${corners.bottom.cx},${corners.bottom.cy + TILE_H / 2 + thick} ${corners.left.cx - TILE_W / 2},${corners.left.cy + thick}`} fill="#8b5a2b" />
        <polygon points={`${corners.bottom.cx},${corners.bottom.cy + TILE_H / 2} ${corners.right.cx + TILE_W / 2},${corners.right.cy} ${corners.right.cx + TILE_W / 2},${corners.right.cy + thick} ${corners.bottom.cx},${corners.bottom.cy + TILE_H / 2 + thick}`} fill="#6b4423" />
        {/* cỏ */}
        {cells.map(({ x, y }) => {
          const { cx, cy } = toScreen(x, y);
          const key = `${x},${y}`;
          const free = !occupied.has(key);
          const d = decorAt.get(key);
          const isPath = d && d.key === "path";
          const clickable = !readOnly && free && (placing || (mode.type === "edit" && mode.selected) || false);
          return (
            <g key={`t${key}`} onClick={() => { if (!readOnly && free && onTileClick) onTileClick(x, y); }} className={clickable ? "farm-tile farm-tile-selectable" : ""}>
              <polygon points={diamondPoints(cx, cy)} fill={(x + y) % 2 ? "#86c75b" : "#7fbf52"} stroke="#6aa845" strokeWidth={1} />
              {isPath && <DecorSprite emoji="" cx={cx} cy={cy} isPath />}
              {clickable && <polygon points={diamondPoints(cx, cy, TILE_W - 10, TILE_H - 5)} fill="rgba(253,224,71,.45)" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />}
            </g>
          );
        })}
        {/* vật thể */}
        {cells.map(({ x, y }) => {
          const { cx, cy } = toScreen(x, y);
          const key = `${x},${y}`;
          const plot = plotAt.get(key);
          const d = decorAt.get(key);
          if (plot) {
            const live = liveStatus(plot, now);
            const isReady = live.status === "READY";
            const sel = selectedId === plot.id;
            const canClick = !readOnly && !placing && (mode.type === "normal" || mode.type === "edit");
            return (
              <g key={`p${plot.id}`} data-plot-status={plot.status === "EMPTY" ? "EMPTY" : live.status} className={`${canClick ? "farm-tile" : ""} ${sel ? "farm-tile-selected" : ""}`} onClick={(e) => { e.stopPropagation(); if (canClick && onPlotClick) onPlotClick(plot); }}>
                <SoilTile cx={cx} cy={cy} ready={isReady && !plot.wilted} />
                {plot.status === "EMPTY" ? (
                  !readOnly && mode.type === "normal" && (
                    <g opacity={.9}><circle cx={cx} cy={cy} r={11} fill="#fff" stroke="#1e3a8a" strokeWidth={1.5} /><path d={`M${cx - 5} ${cy} H${cx + 5} M${cx} ${cy - 5} V${cy + 5}`} stroke="#1e3a8a" strokeWidth={2.2} strokeLinecap="round" /></g>
                  )
                ) : (
                  <g transform={`translate(${cx} ${cy + 6})`}>
                    <g className="farm-pop"><CropSprite cropKey={plot.cropKey} growth={live.growth} ready={isReady} wilted={plot.wilted && live.status !== "READY"} /></g>
                    {isReady && (
                      <g transform="translate(0 -74)"><g className="farm-ready-marker">
                        <circle cx={0} cy={0} r={11} fill="#f9a95a" stroke="#fff" strokeWidth={2} />
                        <text x={0} y={5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#1f2d3d">!</text>
                      </g></g>
                    )}
                    {plot.srs?.status === "MASTERED" && <text x={18} y={-8} fontSize={14}>⭐</text>}
                  </g>
                )}
              </g>
            );
          }
          if (d && d.key !== "path") {
            const item = catalog.decor[d.key];
            const sel = selectedId === d.uid;
            const canClick = !readOnly && mode.type === "edit";
            return (
              <g key={`d${d.uid}`} className={`${canClick ? "farm-tile" : ""} ${sel ? "farm-tile-selected" : ""}`} onClick={(e) => { e.stopPropagation(); if (canClick && onDecorClick) onDecorClick(d); }}>
                <DecorSprite emoji={item?.emoji || "❔"} cx={cx} cy={cy} />
              </g>
            );
          }
          return null;
        })}
        {/* lớp phủ: thanh lớn + đếm ngược — vẽ sau mọi vật thể để không bị ô đất hàng dưới che */}
        {plots.map((plot) => {
          if (plot.status === "EMPTY") return null;
          const live = liveStatus(plot, now);
          if (live.status === "READY") return null;
          const { cx, cy } = toScreen(plot.x, plot.y);
          return (
            <g key={`o${plot.id}`} transform={`translate(${cx} ${cy + 9})`} pointerEvents="none">
              <rect x={-22} y={0} width={44} height={6} rx={3} className="farm-growth-bg" />
              <rect x={-22} y={0} width={44 * live.growth} height={6} rx={3} className="farm-growth-fg" />
              <text x={0} y={17} textAnchor="middle" fontSize={11} fontWeight={700} fill="#1f2d3d" style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{plot.wilted ? "héo · " : ""}{formatCountdown(live.msLeft)}</text>
            </g>
          );
        })}
        {/* thú cưng */}
        {(() => {
          const { cx, cy } = toScreen(petPos.x, petPos.y);
          return (
            <g className="farm-pet-move" style={{ transform: `translate(${cx}px, ${cy + 8}px)` }} onClick={(e) => { e.stopPropagation(); onPetClick?.(); }} role="button" aria-label={pet.name}>
              <g className={petJumping ? "farm-pet-jump" : "farm-pet-idle"} style={{ cursor: onPetClick ? "pointer" : "default" }}>
                <PetSprite level={pet.level} size={0.9} blink={blink} />
              </g>
              {hearts.map((h) => <text key={h} x={(h % 3) * 12 - 12} y={-60} textAnchor="middle" fontSize={16} className="farm-heart">💖</text>)}
              <text x={0} y={22} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1e3a8a" style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{pet.name}</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}
