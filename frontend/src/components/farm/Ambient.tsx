"use client";
import { memo } from "react";
import type { WeatherKind } from "@/lib/farm/weather";

// Không khí của nông trại theo GIỜ VÀ THỜI TIẾT THẬT TẠI VỊ TRÍ CỦA NGƯỜI CHƠI:
//  - Múi giờ: của VỊ TRÍ thiết bị (lấy từ dịch vụ dự báo khi đã bật thời tiết), chưa bật thì theo múi giờ cài trên thiết bị.
//  - Bình minh / hoàng hôn bám theo giờ mặt trời mọc/lặn THẬT của nơi đó (chưa bật thì ước ~6h và ~18h).
//  - Thời tiết (nắng, mây, âm u, sương mù, mưa phùn, mưa, giông, tuyết) lấy từ dự báo; chưa bật thì trời quang.
// Hoàn toàn là hiệu ứng thị giác, không ảnh hưởng luật chơi.
export type Phase = "dawn" | "morning" | "noon" | "afternoon" | "dusk" | "night";

const pad = (n: number) => String(n).padStart(2, "0");
export function gmtLabel(offsetMin: number) {
  const sign = offsetMin < 0 ? "-" : "+"; const a = Math.abs(offsetMin); const h = Math.floor(a / 60); const m = a % 60;
  return `GMT${sign}${h}${m ? ":" + pad(m) : ""}`;
}
export const fracOf = (ms: number, offsetMin: number) => (((ms + offsetMin * 60e3) % 864e5) + 864e5) % 864e5 / 3600e3;
export const fmtHM = (ms: number, offsetMin: number) => { const f = fracOf(ms, offsetMin); const h = Math.floor(f); return `${pad(h)}:${pad(Math.floor((f - h) * 60))}`; };

export type SkyOpts = { offsetMin?: number; sunrise?: number | null; sunset?: number | null };
// Tất cả những gì cảnh cần biết về bầu trời lúc này. `forced` = "HH:mm" để xem thử một giờ bất kỳ (?time=21:30 trên URL).
export function skyNow(nowMs: number, forced?: string | null, opt: SkyOpts = {}) {
  const offsetMin = opt.offsetMin ?? -new Date(nowMs).getTimezoneOffset();
  const d = new Date(nowMs + offsetMin * 60e3);
  let hour = d.getUTCHours(), minute = d.getUTCMinutes(), preview = false;
  if (forced && /^\d{1,2}:\d{2}$/.test(forced)) {
    const [h, m] = forced.split(":").map(Number);
    if (h >= 0 && h < 24 && m >= 0 && m < 60) { hour = h; minute = m; preview = true; }
  }
  const frac = hour + minute / 60;
  // Giờ mặt trời mọc/lặn (số giờ trong ngày, tại múi giờ của vị trí); không có dữ liệu thì ước lượng
  const real = opt.sunrise != null && opt.sunset != null;
  let sr = real ? fracOf(opt.sunrise!, offsetMin) : 6;
  let ss = real ? fracOf(opt.sunset!, offsetMin) : 18;
  if (!(ss > sr + 4)) { sr = 6; ss = 18; } // ngày/đêm địa cực hoặc dữ liệu lạ: dùng ước lượng
  return { hour, minute, frac, label: `${pad(hour)}:${pad(minute)}`, preview, offsetMin, gmt: gmtLabel(offsetMin), sr, ss, realSun: real && ss > sr + 4, phase: phaseOf(frac, sr, ss), sleeping: frac >= 22 || frac < 5 };
}
export type SkyInfo = ReturnType<typeof skyNow>;

export function phaseOf(frac: number, sr = 6, ss = 18): Phase {
  const dawnStart = sr - 0.75;
  const morningStart = Math.min(sr + 1, 10.5);
  const afternoonEnd = Math.max(ss - 1, 15.5);
  const duskEnd = ss + 0.75;
  if (frac >= dawnStart && frac < morningStart) return "dawn";
  if (frac >= morningStart && frac < 11) return "morning";
  if (frac >= 11 && frac < 14) return "noon";
  if (frac >= 14 && frac < afternoonEnd) return "afternoon";
  if (frac >= afternoonEnd && frac < duskEnd) return "dusk";
  return "night";
}

export const PHASE_LABEL: Record<Phase, string> = { dawn: "Bình minh", morning: "Buổi sáng", noon: "Buổi trưa", afternoon: "Buổi chiều", dusk: "Hoàng hôn", night: "Ban đêm" };

const SKY: Record<Phase, string> = {
  dawn: "linear-gradient(180deg,#c7d2fe 0%,#fbcfe8 40%,#fde68a 75%,#dcfce7 100%)",
  morning: "linear-gradient(180deg,#7dd3fc 0%,#bae6fd 40%,#e0f2fe 75%,#ecfccb 100%)",
  noon: "linear-gradient(180deg,#38bdf8 0%,#7dd3fc 38%,#bae6fd 78%,#dcfce7 100%)",
  afternoon: "linear-gradient(180deg,#93c5fd 0%,#bae6fd 38%,#fef3c7 82%,#fde68a 100%)",
  dusk: "linear-gradient(180deg,#6366f1 0%,#f472b6 42%,#fdba74 78%,#fde68a 100%)",
  night: "linear-gradient(180deg,#0f172a 0%,#1e1b4b 45%,#312e81 100%)",
};
// Trời xám (mặt trời bị che): sáng/tối theo buổi
const GRAY = "linear-gradient(180deg,#94a3b8 0%,#cbd5e1 48%,#e2e8f0 100%)";
const GRAY_WARM_DAWN = "linear-gradient(180deg,#94a3b8 0%,#d6d3d1 55%,#fde68a 100%)";
const GRAY_WARM_DUSK = "linear-gradient(180deg,#64748b 0%,#a8a29e 55%,#fdba74 100%)";
const STORM = "linear-gradient(180deg,#334155 0%,#64748b 50%,#94a3b8 100%)";
const FOG = "linear-gradient(180deg,#cbd5e1 0%,#e2e8f0 50%,#f1f5f9 100%)";
const SNOW = "linear-gradient(180deg,#cbd5e1 0%,#e2e8f0 50%,#f8fafc 100%)";
export function skyBackground(phase: Phase, weather: WeatherKind): string {
  if (phase === "night") return weather === "storm" ? "linear-gradient(180deg,#020617 0%,#0f172a 50%,#1e293b 100%)" : SKY.night;
  if (weather === "storm") return STORM;
  if (weather === "fog") return FOG;
  if (weather === "snow") return SNOW;
  if (weather === "overcast" || weather === "rain" || weather === "drizzle") return phase === "dawn" ? GRAY_WARM_DAWN : phase === "dusk" ? GRAY_WARM_DUSK : GRAY;
  return SKY[phase];
}
const TINT: Record<Phase, string> = {
  dawn: "rgba(253,186,116,.12)", morning: "rgba(255,255,255,0)", noon: "rgba(255,255,255,0)", afternoon: "rgba(251,191,36,.07)",
  dusk: "rgba(244,114,182,.16)", night: "rgba(30,27,75,.40)",
};
const WEATHER_TINT: Partial<Record<WeatherKind, string>> = { overcast: "rgba(71,85,105,.10)", drizzle: "rgba(71,85,105,.12)", rain: "rgba(71,85,105,.16)", storm: "rgba(30,41,59,.30)", fog: "rgba(226,232,240,.35)", snow: "rgba(255,255,255,.18)" };
// Mặt trời bị che theo thời tiết
const SUN_VISIBLE: Record<WeatherKind, number> = { clear: 1, cloudy: 0.75, overcast: 0.25, fog: 0.25, drizzle: 0.2, rain: 0.15, storm: 0, snow: 0.15 };
// Mây: số lượng + màu theo thời tiết
export function cloudsFor(w: WeatherKind): { n: number; fill: string } {
  switch (w) {
    case "clear": return { n: 3, fill: "#ffffff" };
    case "cloudy": return { n: 5, fill: "#ffffff" };
    case "fog": return { n: 2, fill: "#f1f5f9" };
    case "storm": return { n: 7, fill: "#64748b" };
    case "overcast": case "drizzle": case "rain": case "snow": return { n: 6, fill: "#cbd5e1" };
  }
}

// Số giả ngẫu nhiên có hạt giống: vị trí bướm/sao/đom đóm không nhảy lung tung mỗi lần vẽ lại
function rnd(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// Mặt trời đi vòng cung từ lúc mọc đến lúc lặn; trăng từ lúc lặn đến lúc mọc hôm sau
function sunPos(frac: number, vbW: number, sr: number, ss: number) {
  const p = Math.max(0, Math.min(1, (frac - sr) / (ss - sr)));
  return { x: vbW * (0.1 + 0.8 * p), y: 112 - 70 * Math.sin(Math.PI * p) };
}
function moonPos(frac: number, vbW: number, sr: number, ss: number) {
  const len = ((sr + 24 - ss) % 24) || 12;
  const p = Math.max(0, Math.min(1, ((((frac - ss) % 24) + 24) % 24) / len));
  return { x: vbW * (0.12 + 0.76 * p), y: 104 - 56 * Math.sin(Math.PI * p) };
}
const SUN_COLOR: Record<string, { core: string; ring: string }> = {
  dawn: { core: "#fdba74", ring: "#fb923c" }, morning: { core: "#fde047", ring: "#facc15" }, noon: { core: "#fef9c3", ring: "#fde047" },
  afternoon: { core: "#fbbf24", ring: "#f59e0b" }, dusk: { core: "#fb923c", ring: "#ea580c" },
};

type SkyProps = { vbW: number; vbH: number; phase: Phase; frac: number; sr: number; ss: number; weather: WeatherKind };
// Lớp NỀN: mặt trời / trăng / sao (vẽ trước mây và đất)
export const SkyBackdrop = memo(function SkyBackdrop({ vbW, phase, frac, sr, ss, weather }: SkyProps) {
  const r = rnd(7);
  const stars = Array.from({ length: 44 }, (_, i) => ({ x: -vbW * 0.3 + r() * vbW * 1.6, y: 8 + r() * 110, s: 0.8 + r() * 1.6, d: r() * 4, k: i }));
  const sun = sunPos(frac, vbW, sr, ss); const moon = moonPos(frac, vbW, sr, ss);
  const sc = SUN_COLOR[phase];
  const vis = SUN_VISIBLE[weather];
  const starVis = weather === "clear" ? 1 : weather === "cloudy" ? 0.55 : weather === "fog" || weather === "storm" ? 0 : 0.2;
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="farmSunGlow"><stop offset="0%" stopColor="#fff7ae" stopOpacity=".95" /><stop offset="100%" stopColor="#fde047" stopOpacity="0" /></radialGradient>
      </defs>
      {phase === "night" ? (
        <g>
          <g opacity={starVis}>{stars.map((st) => <circle key={st.k} cx={st.x} cy={st.y} r={st.s} fill="#fff" className="farm-twinkle" style={{ animationDelay: `${st.d}s` }} />)}</g>
          <g transform={`translate(${moon.x} ${moon.y})`} opacity={Math.max(vis, starVis * 0.9)}>
            <circle r={44} fill="url(#farmSunGlow)" opacity=".35" />
            <circle r={22} fill="#fefce8" />
            <circle cx={9} cy={-5} r={19} fill="#1e1b4b" opacity=".92" />
          </g>
        </g>
      ) : (
        <g transform={`translate(${sun.x} ${sun.y})`} opacity={vis}>
          <circle r={phase === "noon" ? 72 : 62} fill="url(#farmSunGlow)" opacity={phase === "dusk" || phase === "dawn" ? 0.85 : 1} />
          <circle r={phase === "noon" ? 27 : 24} fill={sc.core} stroke={sc.ring} strokeWidth={3} />
        </g>
      )}
    </g>
  );
});

type LifeProps = { vbW: number; vbH: number; phase: Phase; weather: WeatherKind; lamps: { cx: number; cy: number }[]; seed: number };
// Lớp PHỦ: sinh vật nhỏ + màu trời + mưa/tuyết/sương/sét + đèn vườn phát sáng (vẽ sau mọi vật thể, không chặn thao tác bấm)
export const AmbientLife = memo(function AmbientLife({ vbW, vbH, phase, weather, lamps, seed }: LifeProps) {
  const r = rnd(seed * 97 + 13);
  const lit = phase === "night" || phase === "dusk" || weather === "storm";
  const daytime = phase === "dawn" || phase === "morning" || phase === "noon" || phase === "afternoon";
  const nice = weather === "clear" || weather === "cloudy";
  const butterflies = daytime && nice ? Array.from({ length: 3 }, (_, i) => ({ x: vbW * (0.25 + r() * 0.5), y: vbH * (0.35 + r() * 0.3), dx: 40 + r() * 50, dy: -(18 + r() * 28), d: r() * 6, t: 11 + r() * 8, k: i })) : [];
  const flies = phase === "night" && (nice || weather === "overcast") ? Array.from({ length: 11 }, (_, i) => ({ x: vbW * (0.12 + r() * 0.76), y: vbH * (0.3 + r() * 0.5), dx: 20 + r() * 40, dy: -(10 + r() * 24), d: r() * 5, t: 6 + r() * 6, k: i })) : [];
  const dropN = weather === "storm" ? 84 : weather === "rain" ? 56 : weather === "drizzle" ? 24 : 0;
  const dropDur = weather === "storm" ? 0.65 : weather === "drizzle" ? 1.3 : 0.9;
  const drops = Array.from({ length: dropN }, (_, i) => ({ x: -vbW * 0.3 + r() * vbW * 1.6, y: -20 - r() * 60, d: r() * 1.2, k: i }));
  const flakes = weather === "snow" ? Array.from({ length: 54 }, (_, i) => ({ x: -vbW * 0.1 + r() * vbW * 1.2, s: 1.4 + r() * 2, d: r() * 8, t: 6 + r() * 6, sway: (r() - 0.5) * 60, k: i })) : [];
  const tint = weather !== "clear" && weather !== "cloudy" && phase !== "night" ? (WEATHER_TINT[weather] ?? TINT[phase]) : phase === "night" && weather === "storm" ? "rgba(2,6,23,.5)" : TINT[phase];
  return (
    <g pointerEvents="none">
      <defs>
        <radialGradient id="farmLampGlow"><stop offset="0%" stopColor="#fde68a" stopOpacity=".9" /><stop offset="100%" stopColor="#fbbf24" stopOpacity="0" /></radialGradient>
        <linearGradient id="farmFog" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fff" stopOpacity="0" /><stop offset="55%" stopColor="#fff" stopOpacity=".5" /><stop offset="100%" stopColor="#fff" stopOpacity=".7" /></linearGradient>
      </defs>
      <rect x={-vbW} y={-vbH} width={vbW * 3} height={vbH * 3} fill={tint} style={{ transition: "fill 2s ease" }} />
      {weather === "fog" && <rect x={-vbW} y={vbH * 0.25} width={vbW * 3} height={vbH} fill="url(#farmFog)" className="farm-fog" />}
      {lit && lamps.map((l, i) => <circle key={i} cx={l.cx} cy={l.cy - 34} r={50} fill="url(#farmLampGlow)" className="farm-lamp-pulse" />)}
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
      {(phase === "morning" || phase === "afternoon") && nice && (
        <>
          <g className="farm-cloud" style={{ animationDuration: "52s", animationDelay: "-14s" }}><g transform="translate(0 38)"><text fontSize={15}>🐦</text></g></g>
          <g className="farm-cloud" style={{ animationDuration: "74s", animationDelay: "-40s" }}><g transform="translate(0 70)"><text fontSize={13}>🐦</text></g></g>
        </>
      )}
      {drops.map((d) => <line key={d.k} x1={d.x} y1={d.y} x2={d.x - (weather === "storm" ? 9 : 6)} y2={d.y + (weather === "drizzle" ? 12 : weather === "storm" ? 24 : 18)} stroke={weather === "drizzle" ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.62)"} strokeWidth={weather === "drizzle" ? 1 : 1.4} strokeLinecap="round" className="farm-rain" style={{ animationDelay: `${d.d}s`, animationDuration: `${dropDur}s`, ["--h" as any]: `${vbH + 90}px`, ["--w" as any]: weather === "storm" ? "-52px" : "-34px" }} />)}
      {flakes.map((f) => <circle key={f.k} cx={f.x} cy={-10} r={f.s} fill="#fff" opacity={0.9} className="farm-snow" style={{ animationDelay: `-${f.d}s`, animationDuration: `${f.t}s`, ["--h" as any]: `${vbH + 30}px`, ["--sway" as any]: `${f.sway}px` }} />)}
      {weather === "storm" && <rect x={-vbW} y={-vbH} width={vbW * 3} height={vbH * 3} fill="#fff" className="farm-lightning" />}
    </g>
  );
});
