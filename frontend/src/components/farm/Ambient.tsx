"use client";
import { memo } from "react";

// Không khí của nông trại theo GIỜ THẬT Ở VIỆT NAM (GMT+7), bất kể máy người chơi đang ở múi giờ nào:
// bình minh → sáng → trưa → chiều → hoàng hôn → đêm. Mặt trời/mặt trăng di chuyển liên tục theo giờ, mưa rơi theo khung giờ
// cố định trong ngày (~1/7 số ngày). Hoàn toàn là hiệu ứng thị giác, không ảnh hưởng luật chơi.
export type Phase = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";
export const VN_OFFSET_HOURS = 7;

const pad = (n: number) => String(n).padStart(2, "0");

// Giờ Việt Nam từ mốc thời gian UTC (ms). `forced` = "HH:mm" để xem thử một giờ bất kỳ (?time=21:30 trên URL).
export function vnClock(nowMs: number, forced?: string | null) {
  const d = new Date(nowMs + VN_OFFSET_HOURS * 3600e3);
  let hour = d.getUTCHours(), minute = d.getUTCMinutes();
  let preview = false;
  if (forced && /^\d{1,2}:\d{2}$/.test(forced)) {
    const [h, m] = forced.split(":").map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) { hour = h; minute = m; preview = true; }
  }
  return { hour, minute, frac: hour + minute / 60, dayKey: d.toISOString().slice(0, 10), label: `${pad(hour)}:${pad(minute)}`, preview };
}

export function phaseOf(frac: number): Phase {
  if (frac >= 5 && frac < 7) return "dawn";
  if (frac >= 7 && frac < 11) return "morning";
  if (frac >= 11 && frac < 14) return "noon";
  if (frac >= 14 && frac < 17) return "afternoon";
  if (frac >= 17 && frac < 19) return "dusk";
  return "night";
}

// Mưa: ~1/7 số ngày, mỗi ngày mưa kéo dài 3 tiếng bắt đầu từ 8–16 giờ (cùng 1 ngày ai cũng thấy giống nhau)
function dayHash(dayKey: string) { let n = 0; for (const c of dayKey) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; }
export function rainWindow(dayKey: string): [number, number] | null {
  const n = dayHash(dayKey);
  if (n % 7 !== 3) return null;
  const start = 8 + ((n >>> 3) % 9);
  return [start, start + 3];
}

// Tất cả những gì cảnh cần biết về bầu trời lúc này
export function skyNow(nowMs: number, forced?: string | null) {
  const c = vnClock(nowMs, forced);
  const w = rainWindow(c.dayKey);
  return { ...c, phase: phaseOf(c.frac), raining: !!w && c.frac >= w[0] && c.frac < w[1], sleeping: c.frac >= 22 || c.frac < 5 };
}

export const SKY: Record<Phase, string> = {
  dawn: "linear-gradient(180deg,#c7d2fe 0%,#fbcfe8 40%,#fde68a 75%,#dcfce7 100%)",
  morning: "linear-gradient(180deg,#7dd3fc 0%,#bae6fd 40%,#e0f2fe 75%,#ecfccb 100%)",
  noon: "linear-gradient(180deg,#38bdf8 0%,#7dd3fc 38%,#bae6fd 78%,#dcfce7 100%)",
  afternoon: "linear-gradient(180deg,#93c5fd 0%,#bae6fd 38%,#fef3c7 82%,#fde68a 100%)",
  dusk: "linear-gradient(180deg,#6366f1 0%,#f472b6 42%,#fdba74 78%,#fde68a 100%)",
  night: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 45%,#312e81 100%)",
};
const TINT: Record<Phase, string> = {
  dawn: "rgba(253,186,116,.12)", morning: "rgba(255,255,255,0)", noon: "rgba(255,255,255,0)", afternoon: "rgba(251,191,36,.07)",
  dusk: "rgba(244,114,182,.16)", night: "rgba(30,27,75,.40)",
};
export const PHASE_LABEL: Record<Phase, string> = { dawn: "Bình minh", morning: "Buổi sáng", noon: "Buổi trưa", afternoon: "Buổi chiều", dusk: "Hoàng hôn", night: "Ban đêm" };

// Số giả ngẫu nhiên có hạt giống: vị trí bướm/sao/đom đóm không nhảy lung tung mỗi lần vẽ lại
function rnd(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Vị trí mặt trời: mọc ~5:30, lặn ~18:30, cao nhất lúc trưa (đường vòng cung)
function sunPos(frac: number, vbW: number) {
  const p = Math.max(0, Math.min(1, (frac - 5.5) / 13));
  return { x: vbW * (0.1 + 0.8 * p), y: 112 - 70 * Math.sin(Math.PI * p) };
}
// Mặt trăng: mọc ~18:30, lặn ~5:30 hôm sau
function moonPos(frac: number, vbW: number) {
  const t = (((frac - 18.5) % 24) + 24) % 24;
  const p = Math.max(0, Math.min(1, t / 11));
  return { x: vbW * (0.12 + 0.76 * p), y: 104 - 56 * Math.sin(Math.PI * p) };
}
const SUN_COLOR: Record<string, { core: string; ring: string }> = {
  dawn: { core: "#fdba74", ring: "#fb923c" }, morning: { core: "#fde047", ring: "#facc15" }, noon: { core: "#fef9c3", ring: "#fde047" },
  afternoon: { core: "#fbbf24", ring: "#f59e0b" }, dusk: { core: "#fb923c", ring: "#ea580c" },
};

type SkyProps = { vbW: number; vbH: number; phase: Phase; frac: number };
// Lớp NỀN: mặt trời / trăng / sao (vẽ trước mây và đất)
export const SkyBackdrop = memo(function SkyBackdrop({ vbW, phase, frac }: SkyProps) {
  const r = rnd(7);
  const stars = Array.from({ length: 44 }, (_, i) => ({ x: -vbW * 0.3 + r() * vbW * 1.6, y: 8 + r() * 110, s: 0.8 + r() * 1.6, d: r() * 4, k: i }));
  const sun = sunPos(frac, vbW); const moon = moonPos(frac, vbW);
  const sc = SUN_COLOR[phase];
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="farmSunGlow"><stop offset="0%" stopColor="#fff7ae" stopOpacity=".95" /><stop offset="100%" stopColor="#fde047" stopOpacity="0" /></radialGradient>
      </defs>
      {phase === "night" ? (
        <g>
          {stars.map((st) => <circle key={st.k} cx={st.x} cy={st.y} r={st.s} fill="#fff" className="farm-twinkle" style={{ animationDelay: `${st.d}s` }} />)}
          <g transform={`translate(${moon.x} ${moon.y})`}>
            <circle r={44} fill="url(#farmSunGlow)" opacity=".35" />
            <circle r={22} fill="#fefce8" />
            <circle cx={9} cy={-5} r={19} fill="#1e1b4b" opacity=".92" />
          </g>
        </g>
      ) : (
        <g transform={`translate(${sun.x} ${sun.y})`}>
          <circle r={phase === "noon" ? 72 : 62} fill="url(#farmSunGlow)" opacity={phase === "dusk" || phase === "dawn" ? 0.85 : 1} />
          <circle r={phase === "noon" ? 27 : 24} fill={sc.core} stroke={sc.ring} strokeWidth={3} />
        </g>
      )}
    </g>
  );
});

type LifeProps = { vbW: number; vbH: number; phase: Phase; rain: boolean; lamps: { cx: number; cy: number }[]; seed: number };
// Lớp PHỦ: sinh vật nhỏ + màu trời + mưa + đèn vườn phát sáng (vẽ sau mọi vật thể, không chặn thao tác bấm)
export const AmbientLife = memo(function AmbientLife({ vbW, vbH, phase, rain, lamps, seed }: LifeProps) {
  const r = rnd(seed * 97 + 13);
  const lit = phase === "night" || phase === "dusk";
  const daytime = phase === "dawn" || phase === "morning" || phase === "noon" || phase === "afternoon";
  const butterflies = daytime && !rain ? Array.from({ length: 3 }, (_, i) => ({ x: vbW * (0.25 + r() * 0.5), y: vbH * (0.35 + r() * 0.3), dx: 40 + r() * 50, dy: -(18 + r() * 28), d: r() * 6, t: 11 + r() * 8, k: i })) : [];
  const flies = phase === "night" && !rain ? Array.from({ length: 11 }, (_, i) => ({ x: vbW * (0.12 + r() * 0.76), y: vbH * (0.3 + r() * 0.5), dx: 20 + r() * 40, dy: -(10 + r() * 24), d: r() * 5, t: 6 + r() * 6, k: i })) : [];
  const drops = rain ? Array.from({ length: 56 }, (_, i) => ({ x: -vbW * 0.3 + r() * vbW * 1.6, y: -20 - r() * 60, d: r() * 1.2, k: i })) : [];
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="farmLampGlow"><stop offset="0%" stopColor="#fde68a" stopOpacity=".9" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
      </defs>
      <rect x={-vbW} y={-vbH} width={vbW * 3} height={vbH * 3} fill={rain && phase !== "night" ? "rgba(71,85,105,.14)" : TINT[phase]} style={{ transition: "fill 2s ease" }} />
      {lit && lamps.map((l, i) => <circle key={i} cx={l.cx} cy={l.cy - 14} r={46} fill="url(#farmLampGlow)" className="farm-lamp-pulse" />)}
      {butterflies.map((b) => (
        <g key={b.k} transform={`translate(${b.x} ${b.y})`}>
          <g className="farm-flutter" style={{ ["--dx" as any]: `${b.dx}px`, ["--dy" as any]: `${b.dy}px`, animationDuration: `${b.t}s`, animationDelay: `-${b.d}s` }}>
            <text fontSize={16} textAnchor="middle">🦋</text>
          </g>
        </g>
      ))}
      {flies.map((f) => (
        <g key={f.k} transform={`translate(${f.x} ${f.y})`}>
          <g className="farm-flutter" style={{ ["--dx" as any]: `${f.dx}px`, ["--dy" as any]: `${f.dy}px`, animationDuration: `${f.t}s`, animationDelay: `-${f.d}s` }}>
            <circle r={7} fill="url(#farmLampGlow)" className="farm-firefly" style={{ animationDelay: `${f.d}s` }} /><circle r={1.8} fill="#fef08a" />
          </g>
        </g>
      ))}
      {(phase === "morning" || phase === "afternoon") && !rain && (
        <>
          <g className="farm-cloud" style={{ animationDuration: "52s", animationDelay: "-14s" }}><g transform="translate(0 38)"><text fontSize={15}>🐦</text></g></g>
          <g className="farm-cloud" style={{ animationDuration: "74s", animationDelay: "-40s" }}><g transform="translate(0 70)"><text fontSize={13}>🐦</text></g></g>
        </>
      )}
      {drops.map((d) => <line key={d.k} x1={d.x} y1={d.y} x2={d.x - 6} y2={d.y + 18} stroke="rgba(255,255,255,.6)" strokeWidth={1.4} strokeLinecap="round" className="farm-rain" style={{ animationDelay: `${d.d}s`, ["--h" as any]: `${vbH + 90}px` }} />)}
    </g>
  );
});
