"use client";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Catalog, DecorPlaced, FarmView, PlotView } from "@/lib/farm/api";
import { formatCountdown } from "@/lib/farm/api";
import { CONNECT_FAMILY, Cloud, CropSprite, DecorSprite, SoilTile, TILE_H, TILE_W, diamondPoints, emojiSizeOf, type Outfit } from "./Sprites";
import Roamers from "./Roamers";
import { AmbientLife, SkyBackdrop, cloudsFor, skyBackground, skyNow, type SkyInfo } from "./Ambient";
import { isWetWeather, type WeatherKind } from "@/lib/farm/weather";

export type SceneMode =
  | { type: "normal" }
  | { type: "edit"; selected: { kind: "plot" | "decor"; id: string } | null }
  | { type: "place"; itemKey: string; label: string };

// Chữ thưởng nổi lên trên 1 ô đất (x,y là toạ độ lưới)
export type FloatText = { id: number; x: number; y: number; text: string; tone: "coin" | "xp" | "gem" | "bad" | "item" };
const FLOAT_COLOR: Record<FloatText["tone"], string> = { coin: "#b45309", xp: "#1e3a8a", gem: "#0369a1", bad: "#b91c1c", item: "#047857" };

type Props = {
  farm: FarmView; plots: PlotView[]; catalog: Catalog; now: number; mode: SceneMode; readOnly?: boolean;
  pet: { name: string; level: number }; outfit?: Outfit; petJumping?: boolean; hearts?: number[]; floats?: FloatText[];
  sky?: SkyInfo; weather?: WeatherKind; // giờ + thời tiết của VỊ TRÍ người chơi (không truyền = giờ máy + trời quang)
  onTileClick?: (x: number, y: number) => void; onPlotClick?: (plot: PlotView) => void;
  onDecorClick?: (d: DecorPlaced) => void; onPetClick?: () => void;
};

const TOP_PAD = 90;
const LAMP_KEYS = new Set(["lamp", "xmas", "lantern"]);

// Băm vị trí ô → số cố định (cụm cỏ/hoa mọc cùng chỗ mỗi lần vẽ lại)
const hashXY = (x: number, y: number) => { let h = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return (h ^ (h >>> 16)) >>> 0; };
const FLOWER_COLORS = ["#ffffff", "#fda4af", "#fde047", "#c4b5fd", "#fdba74"];

// LƯU Ý SVG: CSS animation có transform sẽ GHI ĐÈ thuộc tính transform của phần tử → luôn tách
// <g transform=...> (vị trí) và <g className="farm-..."> (hoạt ảnh) thành 2 lớp lồng nhau.
// Trạng thái cây theo giờ client (server trả readyAt; client tự đếm để không phải gọi lại API)
export function liveStatus(plot: PlotView, now: number) {
  if (plot.status === "EMPTY" || !plot.readyAt || !plot.plantedAt) return { status: plot.status, growth: 0, msLeft: 0 };
  const ready = new Date(plot.readyAt).getTime(); const planted = new Date(plot.plantedAt).getTime();
  const growth = Math.max(0, Math.min(1, (now - planted) / Math.max(1, ready - planted)));
  return { status: now >= ready ? ("READY" as const) : ("GROWING" as const), growth, msLeft: ready - now };
}

export default function FarmScene({ farm, plots, catalog, now, mode, readOnly, pet, outfit, petJumping, hearts = [], floats = [], sky: skyProp, weather = "clear", onTileClick, onPlotClick, onDecorClick, onPetClick }: Props) {
  const W = farm.gridW, H = farm.gridH;
  const originX = (H * TILE_W) / 2;
  const vbW = ((W + H) * TILE_W) / 2;
  const vbH = TOP_PAD + ((W + H) * TILE_H) / 2 + 48;
  const toScreen = useCallback((gx: number, gy: number) => ({ cx: originX + ((gx - gy) * TILE_W) / 2, cy: TOP_PAD + ((gx + gy) * TILE_H) / 2 + TILE_H / 2 }), [originX]);

  // Giờ + thời tiết THẬT tại vị trí người chơi: bình minh / sáng / trưa / chiều / hoàng hôn / đêm
  const sky = skyProp ?? skyNow(now);
  const phase = sky.phase;
  const clouds = cloudsFor(weather);
  const wet = isWetWeather(weather);

  const placing = mode.type === "place";
  const isAnimal = (key: string) => catalog.decor[key]?.cat === "animal";
  // Ô đặt được đồ = ô chưa có ô đất/đồ nào; ô đi dạo được = không có ô đất / đồ trang trí (lối đi và vật nuôi không cản đường)
  const occupied = useMemo(() => {
    const s = new Set<string>();
    plots.forEach((p) => s.add(`${p.x},${p.y}`));
    farm.layout.forEach((d) => s.add(`${d.x},${d.y}`));
    return s;
  }, [plots, farm.layout]);
  const blocked = useMemo(() => {
    const s = new Set<string>();
    plots.forEach((p) => s.add(`${p.x},${p.y}`));
    farm.layout.forEach((d) => { if (d.key !== "path" && catalog.decor[d.key]?.cat !== "animal") s.add(`${d.x},${d.y}`); });
    return s;
  }, [plots, farm.layout, catalog.decor]);
  // Vật nuôi đi dạo khi chơi bình thường / thăm bạn; đang sắp xếp hay đặt đồ thì đứng yên ở ô nhà để còn chọn/dời được
  const roam = !placing && (!!readOnly || mode.type === "normal");
  const animals = useMemo(() => (roam ? farm.layout.filter((d) => catalog.decor[d.key]?.cat === "animal").map((d) => ({ uid: d.uid, key: d.key, x: d.x, y: d.y, emoji: catalog.decor[d.key].emoji, size: emojiSizeOf(d.key) })) : []), [roam, farm.layout, catalog.decor]);

  // Điện thoại: khung cuộn ngang → mở ra ở giữa đất thay vì mép trái
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scrollRef.current; if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, [W, H]);

  const plotAt = useMemo(() => new Map(plots.map((p) => [`${p.x},${p.y}`, p])), [plots]);
  const decorAt = useMemo(() => new Map(farm.layout.map((d) => [`${d.x},${d.y}`, d])), [farm.layout]);
  const lamps = useMemo(() => farm.layout.filter((d) => LAMP_KEYS.has(d.key)).map((d) => ({ cx: originX + ((d.x - d.y) * TILE_W) / 2, cy: TOP_PAD + ((d.x + d.y) * TILE_H) / 2 + TILE_H / 2 })), [farm.layout, originX]);

  const selectedId = mode.type === "edit" ? mode.selected?.id : null;

  // Vẽ theo thứ tự chiều sâu để vật phía trước che vật phía sau
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push({ x, y });
  cells.sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);

  // Bệ đất 3D
  const corners = { top: toScreen(0, 0), right: toScreen(W - 1, 0), bottom: toScreen(W - 1, H - 1), left: toScreen(0, H - 1) };
  const thick = 16;
  const bx = corners.bottom.cx, by = corners.bottom.cy + TILE_H / 2 + thick;

  return (
    <div ref={scrollRef} className="farm-scene relative rounded-2xl overflow-x-auto overflow-y-hidden border border-line" style={{ background: skyBackground(phase, weather), transition: "background 2s ease" }}>
      {/* Trên điện thoại khung đất rộng tối thiểu ~640px (cuộn ngang) để ô đất đủ lớn mà bấm; desktop tự co theo cột */}
      <svg viewBox={`0 0 ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" aria-label="Nông trại" data-phase={phase} style={{ minWidth: Math.min(vbW, 640) }}>
        <SkyBackdrop vbW={vbW} vbH={vbH} phase={phase} frac={sky.frac} sr={sky.sr} ss={sky.ss} weather={weather} />
        <g opacity={phase === "night" ? (weather === "clear" ? 0.35 : 0.5) : phase === "noon" && weather === "clear" ? 0.8 : 1}>
          {[[-80, 30, 0.8, 70, 10], [-120, 60, 1.1, 95, 40], [-60, 16, 0.6, 55, 25], [-200, 44, 0.9, 80, 55], [-30, 72, 1.0, 105, 5], [-150, 22, 0.7, 62, 33], [-100, 84, 1.2, 120, 70]].slice(0, clouds.n).map(([cx, cy, sc, du, de], i) => (
            <Cloud key={i} x={cx} y={cy} scale={sc} duration={du} delay={de} fill={clouds.fill} />
          ))}
        </g>
        {/* bóng đổ + đá treo dưới hòn đảo */}
        <ellipse cx={bx} cy={by + 26} rx={vbW * 0.3} ry={9} fill="rgba(15,23,42,.14)" />
        <polygon points={`${bx - 34},${by - 2} ${bx - 6},${by - 2} ${bx - 20},${by + 20}`} fill="#7c4a22" />
        <polygon points={`${bx + 8},${by - 3} ${bx + 36},${by - 3} ${bx + 24},${by + 14}`} fill="#6b3f1d" />
        <polygon points={`${bx - 8},${by} ${bx + 4},${by} ${bx - 2},${by + 10}`} fill="#5a3418" />
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
          const h = hashXY(x, y);
          const showTuft = free && h % 4 === 0;
          const showFlower = free && h % 9 === 0;
          return (
            <g key={`t${key}`} onClick={() => { if (!readOnly && free && onTileClick) onTileClick(x, y); }} className={clickable ? "farm-tile farm-tile-selectable" : ""}>
              <polygon points={diamondPoints(cx, cy)} fill={(x + y) % 2 ? "#86c75b" : "#7fbf52"} stroke="#6aa845" strokeWidth={1} />
              {showTuft && <path d={`M${cx + ((h >> 3) % 24) - 12} ${cy + ((h >> 7) % 8) - 3} l-3 -7 m3 7 l0 -9 m0 9 l3 -7`} stroke="#5f9f3b" strokeWidth={1.6} strokeLinecap="round" fill="none" opacity={0.85} />}
              {showFlower && (
                <g transform={`translate(${cx + ((h >> 5) % 30) - 15} ${cy + ((h >> 9) % 10) - 4})`}>
                  <circle r={2.6} fill={FLOWER_COLORS[h % FLOWER_COLORS.length]} stroke="rgba(0,0,0,.15)" strokeWidth={0.5} /><circle r={0.9} fill="#f59e0b" />
                </g>
              )}
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
                      <>
                        <g transform="translate(0 -74)"><g className="farm-ready-marker">
                          <circle cx={0} cy={0} r={11} fill="#f9a95a" stroke="#fff" strokeWidth={2} />
                          <text x={0} y={5} textAnchor="middle" fontSize={15} fontWeight={800} fill="#1f2d3d">!</text>
                        </g></g>
                        <g transform="translate(-17 -44)"><g className="farm-sparkle"><text fontSize={11}>✨</text></g></g>
                        <g transform="translate(11 -52)"><g className="farm-sparkle" style={{ animationDelay: ".7s" }}><text fontSize={9}>✨</text></g></g>
                      </>
                    )}
                    {plot.srs?.status === "MASTERED" && <text x={18} y={-8} fontSize={14}>⭐</text>}
                  </g>
                )}
              </g>
            );
          }
          if (d && d.key !== "path") {
            if (roam && isAnimal(d.key)) return null; // vật nuôi vẽ ở lớp đi dạo
            const item = catalog.decor[d.key];
            const sel = selectedId === d.uid;
            const canClick = !readOnly && mode.type === "edit";
            const fam = CONNECT_FAMILY[d.key];
            const famAt = (gx: number, gy: number) => { const o = decorAt.get(`${gx},${gy}`); return !!o && CONNECT_FAMILY[o.key] === fam; };
            const n = fam ? { xp: famAt(x + 1, y), xm: famAt(x - 1, y), yp: famAt(x, y + 1), ym: famAt(x, y - 1) } : undefined;
            return (
              <g key={`d${d.uid}`} className={`${canClick ? "farm-tile" : ""} ${sel ? "farm-tile-selected" : ""}`} onClick={(e) => { e.stopPropagation(); if (canClick && onDecorClick) onDecorClick(d); }}>
                <DecorSprite itemKey={d.key} emoji={item?.emoji || "❔"} cx={cx} cy={cy} n={n} />
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
        {/* thú cưng + vật nuôi đi dạo */}
        <Roamers W={W} H={H} toScreen={toScreen} blocked={blocked} animals={animals} sleeping={!!sky.sleeping} pet={pet} outfit={outfit} petJumping={petJumping} hearts={hearts} wet={wet} onPetClick={onPetClick} />
        {/* chữ thưởng nổi lên (+xu, +XP...) */}
        {floats.map((f) => {
          const { cx, cy } = toScreen(f.x, f.y);
          return (
            <g key={f.id} transform={`translate(${cx} ${cy - 54})`} pointerEvents="none">
              <g className="farm-float"><text textAnchor="middle" fontSize={17} fontWeight={900} fill={FLOAT_COLOR[f.tone]} style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 4, strokeLinejoin: "round" }}>{f.text}</text></g>
            </g>
          );
        })}
        {/* màu trời, đèn vườn, bướm/đom đóm/chim, mưa */}
        <AmbientLife vbW={vbW} vbH={vbH} phase={phase} weather={weather} lamps={lamps} seed={W * 31 + H} />
      </svg>
    </div>
  );
}
