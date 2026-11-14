"use client";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { EmojiDecor, PetSprite, type Outfit } from "./Sprites";

// Thú cưng + vật nuôi đi dạo quanh vườn: mỗi nhịp bước sang 1 ô kề còn trống (không đi xuyên ô đất/đồ trang trí),
// vật nuôi chỉ quanh ô nhà của nó (≤ 3 ô), Qilin đi cả vườn. Có nhún nhảy mỗi bước, vật nuôi quay mặt theo hướng đi.
// Chỉ component này render lại theo nhịp bước (cả cảnh không phải vẽ lại).
export type Roamer = { uid: string; key: string; x: number; y: number; emoji: string; size: number };
type Walker = { id: string; hx: number; hy: number; x: number; y: number; face: 1 | -1; dir: number; nextAt: number; hop: number };

const NB: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const STEP_MS = 1150; // khớp transition trong .farm-walker
const RADIUS = 3;

type Props = {
  W: number; H: number; toScreen: (x: number, y: number) => { cx: number; cy: number };
  blocked: Set<string>; animals: Roamer[]; sleeping: boolean;
  pet: { name: string; level: number }; outfit?: Outfit; petJumping?: boolean; hearts: number[]; wet: boolean;
  onPetClick?: () => void;
};

export default memo(function Roamers({ W, H, toScreen, blocked, animals, sleeping, pet, outfit, petJumping, hearts, wet, onPetClick }: Props) {
  const walkers = useRef<Map<string, Walker>>(new Map());
  const [, setTick] = useState(0);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const blockedRef = useRef(blocked); blockedRef.current = blocked;
  const sleepRef = useRef(sleeping); sleepRef.current = sleeping;

  // đồng bộ danh sách walker với props (thêm/bớt/dời vật nuôi, Qilin luôn có)
  const sig = animals.map((a) => `${a.uid}:${a.x}:${a.y}`).join("|") + `#${W}x${H}`;
  useEffect(() => {
    const m = walkers.current; const keep = new Set<string>(["pet"]);
    const free: [number, number][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!blocked.has(`${x},${y}`)) free.push([x, y]);
    if (!m.has("pet") || m.get("pet")!.x >= W || m.get("pet")!.y >= H) { const f = free.length ? free[Math.floor(Math.random() * free.length)] : [W - 1, H - 1]; m.set("pet", { id: "pet", hx: f[0], hy: f[1], x: f[0], y: f[1], face: 1, dir: 0, nextAt: 0, hop: 0 }); }
    for (const a of animals) {
      keep.add(a.uid); const w = m.get(a.uid);
      if (!w || w.hx !== a.x || w.hy !== a.y) m.set(a.uid, { id: a.uid, hx: a.x, hy: a.y, x: a.x, y: a.y, face: 1, dir: Math.floor(Math.random() * 4), nextAt: Date.now() + Math.random() * 1500, hop: 0 });
    }
    for (const id of [...m.keys()]) if (!keep.has(id)) m.delete(id);
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now(); const m = walkers.current; let moved = false;
      for (const w of m.values()) {
        if (now < w.nextAt) continue;
        w.nextAt = now + STEP_MS + Math.random() * (w.id === "pet" ? 1400 : 2200);
        if (sleepRef.current || Math.random() < (w.id === "pet" ? 0.2 : 0.35)) continue; // nghỉ chân
        const taken = new Set([...m.values()].filter((o) => o !== w).map((o) => `${o.x},${o.y}`));
        const opts = NB.map(([dx, dy], i) => ({ i, x: w.x + dx, y: w.y + dy })).filter((o) => o.x >= 0 && o.y >= 0 && o.x < W && o.y < H && !blockedRef.current.has(`${o.x},${o.y}`) && !taken.has(`${o.x},${o.y}`) && (w.id === "pet" || Math.abs(o.x - w.hx) + Math.abs(o.y - w.hy) <= RADIUS));
        if (!opts.length) continue;
        // ưu tiên đi tiếp theo hướng cũ cho tự nhiên
        const pick = opts.find((o) => o.i === w.dir && Math.random() < 0.6) || opts[Math.floor(Math.random() * opts.length)];
        const sdx = (pick.x - w.x) - (pick.y - w.y); // dịch chuyển ngang trên màn hình
        if (sdx !== 0) w.face = sdx > 0 ? -1 : 1; // emoji vật nuôi mặc định nhìn sang trái
        w.dir = pick.i; w.x = pick.x; w.y = pick.y; w.hop++; moved = true;
      }
      if (moved) setTick((n) => n + 1);
    }, 400);
    return () => clearInterval(t);
  }, [W, H, reduced]);

  const list = [...walkers.current.values()].sort((a, b) => a.x + a.y - (b.x + b.y) || a.x - b.x);
  const byUid = new Map(animals.map((a) => [a.uid, a]));
  const nudge = (w: Walker) => { w.hop++; setTick((n) => n + 1); };

  return (
    <g>
      {list.map((w) => {
        const { cx, cy } = toScreen(w.x, w.y);
        const style = { transform: `translate(${cx}px, ${cy + 8}px)` } as const;
        if (w.id === "pet") {
          return (
            <g key="pet" className="farm-walker" style={style} onClick={(e) => { e.stopPropagation(); onPetClick?.(); }} role="button" aria-label={pet.name}>
              <g key={w.hop} className={w.hop ? "farm-hop-pet" : ""}>
                <g className={petJumping ? "farm-pet-jump" : "farm-pet-idle"} style={{ cursor: onPetClick ? "pointer" : "default" }}>
                  <PetSprite level={pet.level} size={0.9} outfit={outfit} />
                </g>
              </g>
              {hearts.map((h) => <text key={h} x={(h % 3) * 12 - 12} y={-60} textAnchor="middle" fontSize={16} className="farm-heart">💖</text>)}
              {sleeping && <g transform="translate(16 -70)"><g className="farm-zzz"><text fontSize={15}>💤</text></g></g>}
              {wet && !sleeping && !outfit?.hand && <text x={22} y={-34} fontSize={20} textAnchor="middle">☂️</text>}
              <text x={0} y={22} textAnchor="middle" fontSize={12} fontWeight={800} fill="#1e3a8a" style={{ paintOrder: "stroke", stroke: "#fff", strokeWidth: 3 }}>{pet.name}</text>
            </g>
          );
        }
        const a = byUid.get(w.id); if (!a) return null;
        return (
          <g key={w.id} className="farm-walker" style={style} onClick={(e) => { e.stopPropagation(); nudge(w); }} role="img" aria-label={a.key}>
            <g key={w.hop} className={w.hop ? "farm-hop" : ""}>
              <g transform={`scale(${w.face} 1)`} style={{ cursor: "pointer" }}><EmojiDecor emoji={a.emoji} size={a.size} cx={0} cy={0} /></g>
            </g>
          </g>
        );
      })}
    </g>
  );
});

