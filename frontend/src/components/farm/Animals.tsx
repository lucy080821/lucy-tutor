"use client";
import { createContext, useContext } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Vật nuôi vẽ bằng SVG nguyên con (nhìn nghiêng, mặt quay TRÁI, chân đặt ở y=0), không dùng emoji — emoji trên nhiều thiết bị
// chỉ ra cái đầu hoặc mỗi máy một kiểu. Chân đung đưa + thân nhún khi `walking`, đứng yên thì tư thế nghỉ.
// Roamers quay mặt bằng scaleX(-1) như với emoji cũ.

export type AnimalKind = "chicken" | "duck" | "rabbit" | "pig" | "sheep" | "cow" | "horse" | "cat" | "dog" | "peacock";
export const ANIMAL_KINDS: AnimalKind[] = ["chicken", "duck", "rabbit", "pig", "sheep", "cow", "horse", "cat", "dog", "peacock"];
export const isAnimalKind = (k: string): k is AnimalKind => (ANIMAL_KINDS as string[]).includes(k);
// emoji của chuồng trại (catalog.pens[..].animal) → loài
export const KIND_BY_EMOJI: Record<string, AnimalKind> = { "🐔": "chicken", "🦆": "duck", "🐄": "cow", "🐖": "pig", "🐑": "sheep" };

// Mỗi con được dựng sẵn thành ảnh SVG nhỏ (data URI, 3 tư thế chân: nghỉ / bước A / bước B) rồi chỉ đặt <image> trong cảnh — trình duyệt
// cache bitmap nên mỗi khung hình chỉ dời ảnh, không phải vẽ lại ~25 hình vector/con (điện thoại yếu bị giật). Khi đi thì 2 ảnh bước A/B
// đổi nhau theo nhịp (CSS steps) + thân nhún nhẹ.
const PoseCtx = createContext(0);
function Leg({ x, y, len, w = 3.4, c, ph = 0, foot }: { x: number; y: number; len: number; w?: number; c: string; ph?: 0 | 1; foot?: string }) {
  const pose = useContext(PoseCtx);
  const ang = pose * (ph ? -1 : 1) * 24;
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang})`}>
      <rect x={-w / 2} y={0} width={w} height={len} rx={w / 2} fill={c} />
      {foot && <rect x={-w / 2 - 0.3} y={len - 2.4} width={w + 0.6} height={2.6} rx={1.2} fill={foot} />}
    </g>
  );
}

function Body({ kind }: { kind: AnimalKind }) {
  switch (kind) {
    case "cow": return (
      <g>
        <Leg x={-9} y={-11} len={11} c="#f5f5f4" foot="#3f3f46" ph={0} /><Leg x={10} y={-11} len={11} c="#f5f5f4" foot="#3f3f46" ph={0} />
        <path d="M13 -22 Q19 -22 20 -14" stroke="#e5e5e5" strokeWidth={2.2} fill="none" strokeLinecap="round" /><circle cx={20} cy={-12.5} r={2.4} fill="#3f3f46" />
        <g>
          <rect x={-16} y={-26} width={34} height={17} rx={8.5} fill="#fafaf9" stroke="#d6d3d1" strokeWidth={0.9} />
          <ellipse cx={-6} cy={-20} rx={5} ry={4} fill="#3f3f46" /><ellipse cx={8} cy={-16} rx={4.2} ry={3.4} fill="#3f3f46" />
          <ellipse cx={4} cy={-9.5} rx={4} ry={2.4} fill="#fbcfe8" />
          <rect x={-24} y={-31} width={14} height={13} rx={5.5} fill="#fafaf9" stroke="#d6d3d1" strokeWidth={0.9} />
          <rect x={-26.5} y={-24} width={8} height={7.5} rx={3.6} fill="#fbcfe8" /><circle cx={-24} cy={-20.3} r={0.8} fill="#9d174d" /><circle cx={-21} cy={-20.3} r={0.8} fill="#9d174d" />
          <path d="M-18 -31 l-1.6 -4.4 M-12 -31 l1.6 -4.4" stroke="#e7e5e4" strokeWidth={2.2} strokeLinecap="round" />
          <ellipse cx={-9.5} cy={-29} rx={3.4} ry={1.8} fill="#3f3f46" transform="rotate(25 -9.5 -29)" /><circle cx={-19} cy={-27} r={1.1} fill="#111" />
        </g>
        <Leg x={-12.5} y={-11} len={11} c="#fafaf9" foot="#3f3f46" ph={1} /><Leg x={6.5} y={-11} len={11} c="#fafaf9" foot="#3f3f46" ph={1} />
      </g>
    );
    case "pig": return (
      <g>
        <Leg x={-8} y={-8} len={8} w={3.6} c="#f9a8c0" foot="#be185d" ph={0} /><Leg x={9} y={-8} len={8} w={3.6} c="#f9a8c0" foot="#be185d" ph={0} />
        <path d="M17 -18 q5 -3 3 -7 q-3 -3 -5 1" stroke="#ec7fa3" strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <g>
          <ellipse cx={1} cy={-16} rx={18} ry={11.5} fill="#fbb6cc" stroke="#ec7fa3" strokeWidth={0.9} />
          <circle cx={-14} cy={-19} r={9.5} fill="#fbb6cc" stroke="#ec7fa3" strokeWidth={0.9} />
          <path d="M-12 -27 l4 -5 l2 6 z" fill="#f08bb0" stroke="#ec7fa3" strokeWidth={0.8} />
          <ellipse cx={-22.5} cy={-17.5} rx={4.4} ry={3.6} fill="#f58aab" stroke="#d6578a" strokeWidth={0.8} /><circle cx={-23.5} cy={-17.5} r={0.9} fill="#9d174d" /><circle cx={-21.2} cy={-17.5} r={0.9} fill="#9d174d" />
          <circle cx={-16} cy={-22} r={1.3} fill="#111" />
        </g>
        <Leg x={-11.5} y={-8} len={8} w={3.6} c="#fbb6cc" foot="#be185d" ph={1} /><Leg x={5.5} y={-8} len={8} w={3.6} c="#fbb6cc" foot="#be185d" ph={1} />
      </g>
    );
    case "sheep": return (
      <g>
        <Leg x={-8} y={-9} len={9} w={3} c="#52525b" ph={0} /><Leg x={9} y={-9} len={9} w={3} c="#52525b" ph={0} />
        <g>
          {[[-10, -20, 8], [0, -24, 9], [10, -21, 8.5], [-5, -15, 8], [6, -14, 8.5], [14, -16, 6.5], [-14, -15, 6]].map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="#fafaf9" stroke="#e7e5e4" strokeWidth={0.8} />)}
          <ellipse cx={-17.5} cy={-19} rx={6.5} ry={7.5} fill="#52525b" /><ellipse cx={-21.5} cy={-21.5} rx={3} ry={1.7} fill="#3f3f46" transform="rotate(30 -21.5 -21.5)" />
          <circle cx={-19} cy={-22} r={1.1} fill="#fff" /><circle cx={-19} cy={-22} r={0.5} fill="#111" />
          <circle cx={-14.5} cy={-26} r={4.6} fill="#fafaf9" stroke="#e7e5e4" strokeWidth={0.8} />
        </g>
        <Leg x={-11.5} y={-9} len={9} w={3} c="#3f3f46" ph={1} /><Leg x={5.5} y={-9} len={9} w={3} c="#3f3f46" ph={1} />
      </g>
    );
    case "chicken": return (
      <g>
        <Leg x={-2} y={-6.5} len={6.5} w={1.8} c="#f59e0b" ph={0} /><Leg x={3} y={-6.5} len={6.5} w={1.8} c="#f59e0b" ph={1} />
        <g>
          <path d="M9 -13 q8 -7 9 -15 q-6 3 -9 6 q-2 -5 -4 -7 q0 8 4 16 z" fill="#fde68a" stroke="#f5c542" strokeWidth={0.8} />
          <ellipse cx={1} cy={-12} rx={10.5} ry={8} fill="#fff7e0" stroke="#f1d9a0" strokeWidth={0.9} />
          <path d="M-2 -12 q6 -4 11 1 q-4 6 -11 -1 z" fill="#fde9b0" stroke="#e8c97a" strokeWidth={0.7} />
          <circle cx={-9} cy={-19} r={5.6} fill="#fff7e0" stroke="#f1d9a0" strokeWidth={0.9} />
          <path d="M-11 -24 q1.5 -4 3 -1 q1.5 -3 3 0 q1 .5 0 2 z" fill="#ef4444" />
          <path d="M-14 -19.5 l-5 1.6 l5 1.8 z" fill="#fb923c" /><path d="M-12 -15.5 q1.2 3 2.4 0 z" fill="#ef4444" />
          <circle cx={-10.5} cy={-20} r={1} fill="#111" />
        </g>
      </g>
    );
    case "duck": return (
      <g>
        <Leg x={-2} y={-5.5} len={5.5} w={1.8} c="#fb923c" ph={0} foot="#fb923c" /><Leg x={3.5} y={-5.5} len={5.5} w={1.8} c="#fb923c" ph={1} foot="#fb923c" />
        <g>
          <path d="M8 -14 q9 -2 11 -8 q-7 0 -11 4 z" fill="#fde68a" />
          <ellipse cx={1} cy={-12} rx={11} ry={7.5} fill="#fef3c7" stroke="#f1d97a" strokeWidth={0.9} />
          <path d="M-3 -12.5 q6 -4 11 1 q-4 5.5 -11 -1 z" fill="#fcd34d" stroke="#e8b923" strokeWidth={0.7} />
          <circle cx={-9} cy={-19.5} r={5.4} fill="#fff4b8" stroke="#f1d97a" strokeWidth={0.9} />
          <path d="M-13.5 -19 q-5.5 -.4 -6.5 2 q1 2 6 1 z" fill="#fb923c" /><circle cx={-10.5} cy={-20.5} r={1} fill="#111" />
        </g>
      </g>
    );
    case "rabbit": return (
      <g>
        <Leg x={-7} y={-7} len={7} w={3.4} c="#e7e0d8" ph={0} /><Leg x={8} y={-7} len={7} w={4} c="#e7e0d8" ph={0} />
        <g>
          <circle cx={17} cy={-13} r={4.6} fill="#fff" stroke="#e5e0d8" strokeWidth={0.8} />
          <ellipse cx={3} cy={-12} rx={14} ry={9} fill="#e9e3da" stroke="#d1c9bd" strokeWidth={0.9} />
          <circle cx={-10} cy={-17} r={6.6} fill="#e9e3da" stroke="#d1c9bd" strokeWidth={0.9} />
          <ellipse cx={-9} cy={-29} rx={2.6} ry={7.6} fill="#e9e3da" stroke="#d1c9bd" strokeWidth={0.8} transform="rotate(-8 -9 -29)" /><ellipse cx={-9} cy={-28.5} rx={1.2} ry={5.2} fill="#f9b8c8" transform="rotate(-8 -9 -28.5)" />
          <ellipse cx={-4.5} cy={-28.4} rx={2.6} ry={7.2} fill="#ddd6cb" stroke="#d1c9bd" strokeWidth={0.8} transform="rotate(14 -4.5 -28.4)" />
          <circle cx={-15.8} cy={-16} r={1.3} fill="#f48fb1" /><circle cx={-12} cy={-18.4} r={1.1} fill="#111" />
        </g>
        <Leg x={-3.5} y={-7} len={7} w={3.4} c="#f2ede6" ph={1} /><Leg x={11.5} y={-7} len={7} w={4} c="#f2ede6" ph={1} />
      </g>
    );
    case "horse": return (
      <g>
        <Leg x={-10} y={-14} len={14} w={3.2} c="#8b5a2b" foot="#2b1d12" ph={0} /><Leg x={11} y={-14} len={14} w={3.2} c="#8b5a2b" foot="#2b1d12" ph={0} />
        <path d="M17 -27 q8 4 6 16 q-1 5 -4 8" stroke="#2b1d12" strokeWidth={3.4} fill="none" strokeLinecap="round" />
        <g>
          <rect x={-17} y={-31} width={37} height={17} rx={8.5} fill="#a16a35" stroke="#7a4d24" strokeWidth={0.9} />
          <path d="M-14 -30 l-4 -12 q6 -4 10 -1 l4 12 z" fill="#a16a35" stroke="#7a4d24" strokeWidth={0.9} />
          <path d="M-22 -43 q-5 3 -8 12 q3 3 9 -1 z" fill="#a16a35" stroke="#7a4d24" strokeWidth={0.9} transform="translate(8 -3)" />
          <path d="M-16 -41 q-2 3 -1 6 q4 2 6 7 q1 -5 3 -9 q-3 -3 -8 -4 z" fill="#2b1d12" transform="translate(2 2)" /><path d="M-13 -46 l-1 -5 l3 3 z" fill="#8b5a2b" />
          <circle cx={-26.5} cy={-38.5} r={1.1} fill="#111" /><circle cx={-31} cy={-33.5} r={0.7} fill="#2b1d12" />
        </g>
        <Leg x={-14} y={-14} len={14} w={3.2} c="#a16a35" foot="#2b1d12" ph={1} /><Leg x={7} y={-14} len={14} w={3.2} c="#a16a35" foot="#2b1d12" ph={1} />
      </g>
    );
    case "cat": return (
      <g>
        <Leg x={-6} y={-6} len={6} w={3} c="#f59e5b" ph={0} /><Leg x={8} y={-6} len={6} w={3} c="#f59e5b" ph={0} />
        <path d="M14 -10 q10 -2 9 -12 q-1 -5 -4 -4" stroke="#ea8a3f" strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <g>
          <ellipse cx={2} cy={-11} rx={13} ry={7.6} fill="#fbab63" stroke="#ea8a3f" strokeWidth={0.9} />
          <path d="M-2 -17 v5 M3 -18 v6 M8 -17 v5" stroke="#e07a2c" strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={-11} cy={-16.5} r={6.4} fill="#fbab63" stroke="#ea8a3f" strokeWidth={0.9} />
          <path d="M-16 -21 l1 -6 l4.4 3.4 z M-7.5 -22 l3.4 -5 l1.8 5.6 z" fill="#fbab63" stroke="#ea8a3f" strokeWidth={0.8} />
          <circle cx={-13.6} cy={-17.4} r={1.1} fill="#111" /><circle cx={-9} cy={-17.4} r={1.1} fill="#111" /><path d="M-12 -14.6 l1 1 l1 -1 z" fill="#f48fb1" />
          <path d="M-15 -15 l-5 -.6 M-15 -14 l-5 1.4" stroke="#b45309" strokeWidth={0.6} />
        </g>
        <Leg x={-9} y={-6} len={6} w={3} c="#fbab63" ph={1} /><Leg x={5} y={-6} len={6} w={3} c="#fbab63" ph={1} />
      </g>
    );
    case "dog": return (
      <g>
        <Leg x={-8} y={-9} len={9} w={3.4} c="#c28a4a" ph={0} /><Leg x={9} y={-9} len={9} w={3.4} c="#c28a4a" ph={0} />
        <path d="M15 -17 q8 -6 8 -14" stroke="#b07434" strokeWidth={3.2} fill="none" strokeLinecap="round" />
        <g>
          <rect x={-14} y={-22} width={32} height={13.5} rx={6.8} fill="#d7a063" stroke="#b07434" strokeWidth={0.9} />
          <rect x={-18} y={-30} width={14} height={13} rx={5.5} fill="#d7a063" stroke="#b07434" strokeWidth={0.9} />
          <rect x={-24} y={-24} width={10} height={7} rx={3.4} fill="#f1d3a5" stroke="#b07434" strokeWidth={0.8} /><circle cx={-24} cy={-22.5} r={1.6} fill="#111" />
          <path d="M-9 -31 q4 -1 4 6 q-4 1 -5 -2 z" fill="#8a5a2b" /><circle cx={-12.5} cy={-26} r={1.1} fill="#111" />
          <path d="M-20 -17 q1.5 4 3.4 0" fill="#f87171" />
        </g>
        <Leg x={-11.5} y={-9} len={9} w={3.4} c="#d7a063" ph={1} /><Leg x={5.5} y={-9} len={9} w={3.4} c="#d7a063" ph={1} />
      </g>
    );
    case "peacock": return (
      <g>
        <g transform="translate(12 -12)">
          {[-48, -30, -12, 6, 24].map((a, i) => (
            <g key={a} transform={`rotate(${a + 20})`}><rect x={-1.6} y={-22} width={3.2} height={22} rx={1.6} fill="#1d8f7a" /><ellipse cx={0} cy={-23} rx={4.6} ry={5.4} fill="#3b82c4" stroke="#1d6a9a" strokeWidth={0.6} /><ellipse cx={0} cy={-23} rx={2.2} ry={2.8} fill="#34d399" /><circle cx={0} cy={-23} r={1} fill="#1e3a8a" /></g>
          )).reverse()}
        </g>
        <Leg x={-2} y={-8} len={8} w={1.8} c="#78716c" ph={0} /><Leg x={4} y={-8} len={8} w={1.8} c="#78716c" ph={1} />
        <g>
          <ellipse cx={2} cy={-15} rx={11} ry={8} fill="#2f7fc1" stroke="#1d5f93" strokeWidth={0.9} />
          <path d="M-8 -17 q-3 -6 -3 -12" stroke="#2f7fc1" strokeWidth={4.6} fill="none" strokeLinecap="round" />
          <circle cx={-11.4} cy={-30} r={4.4} fill="#2f7fc1" stroke="#1d5f93" strokeWidth={0.8} />
          <path d="M-12 -34.5 v-4 M-10 -34.5 l1 -3.6 M-14 -34 l-1.2 -3.4" stroke="#1d5f93" strokeWidth={0.9} /><circle cx={-12} cy={-39} r={1} fill="#34d399" />
          <path d="M-15.6 -29.6 l-4.4 1.4 l4.4 1.6 z" fill="#f59e0b" /><circle cx={-12.4} cy={-30.6} r={0.9} fill="#fff" /><circle cx={-12.4} cy={-30.6} r={0.45} fill="#111" />
        </g>
      </g>
    );
  }
}

const VB = { x: -36, y: -58, w: 72, h: 66 };
const uriCache = new Map<string, string>();
function spriteUri(kind: AnimalKind, pose: number): string {
  const key = `${kind}:${pose}`; let u = uriCache.get(key);
  if (!u) {
    const inner = renderToStaticMarkup(<PoseCtx.Provider value={pose}><Body kind={kind} /></PoseCtx.Provider>);
    u = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="${VB.w * 4}" height="${VB.h * 4}">${inner}</svg>`);
    uriCache.set(key, u);
  }
  return u;
}

// size = cỡ chữ emoji cũ (để giữ nguyên bố cục); sprite vẽ trong ô ~38 đơn vị nên scale = size / 38
export default function AnimalSprite({ kind, size = 36, walking = false }: { kind: AnimalKind; size?: number; walking?: boolean }) {
  const k = (size / 38) * (kind === "horse" ? 0.85 : kind === "peacock" ? 0.95 : 1);
  const img = (pose: number, cls?: string) => <image key={`${pose}${cls || ""}`} className={cls} href={spriteUri(kind, pose)} x={VB.x * k} y={VB.y * k} width={VB.w * k} height={VB.h * k} />;
  return (
    <g>
      <ellipse cx={0} cy={1} rx={19 * k} ry={4.6 * k} fill="rgba(31,45,61,.2)" />
      {walking ? <g className="farm-bob">{img(1, "farm-pose-a")}{img(-1, "farm-pose-b")}</g> : img(0)}
    </g>
  );
}
