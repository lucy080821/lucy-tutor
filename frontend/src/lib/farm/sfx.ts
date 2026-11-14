// Âm thanh nhỏ cho Nông Trại, tổng hợp bằng Web Audio (không tải file nào). Mặc định bật, tắt bằng nút loa
// (nhớ ở localStorage `lucy_farm_sound`). AudioContext chỉ tạo sau thao tác đầu tiên của người dùng (luật autoplay).
let ctx: AudioContext | null = null;
let enabled = true;
const KEY = "lucy_farm_sound";

export function loadSfxPref(): boolean {
  try { enabled = localStorage.getItem(KEY) !== "off"; } catch { enabled = true; }
  return enabled;
}
export function setSfxEnabled(v: boolean) { enabled = v; try { localStorage.setItem(KEY, v ? "on" : "off"); } catch { /* bỏ qua */ } }
export function isSfxEnabled() { return enabled; }

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) { const AC = window.AudioContext || (window as any).webkitAudioContext; if (!AC) return null; ctx = new AC(); }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, at: number, dur: number, type: OscillatorType = "sine", vol = 0.07, slideTo?: number) {
  const c = audio(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + at + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + at);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + at + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.02);
}
const play = (fn: () => void) => { if (!enabled) return; try { fn(); } catch { /* âm thanh lỗi không được làm hỏng game */ } };

export const sfx = {
  click: () => play(() => tone(520, 0, 0.05, "triangle", 0.04)),
  pop: () => play(() => tone(380, 0, 0.09, "sine", 0.06, 760)),
  plant: () => play(() => { tone(300, 0, 0.1, "sine", 0.06, 520); tone(520, 0.08, 0.1, "sine", 0.05); }),
  coin: () => play(() => { tone(988, 0, 0.07, "square", 0.04); tone(1319, 0.07, 0.14, "square", 0.04); }),
  harvest: () => play(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, "triangle", 0.07)); }),
  wrong: () => play(() => { tone(220, 0, 0.18, "sawtooth", 0.05, 150); tone(165, 0.14, 0.22, "sawtooth", 0.04, 110); }),
  claim: () => play(() => { [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.06, 0.18, "triangle", 0.07)); tone(1568, 0.28, 0.3, "sine", 0.05); }),
  levelUp: () => play(() => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.09, 0.22, "triangle", 0.08)); }),
};
