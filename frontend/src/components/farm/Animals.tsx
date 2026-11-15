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
    case "cat": return ( // mèo mướp cam nhìn nghiêng (giống emoji 🐈): đuôi cong dựng lên, sọc, tai nhọn, râu
      <g>
        <path d="M15 -14 C25 -14 28 -25 22 -33" stroke="#e98a3c" strokeWidth={4.2} fill="none" strokeLinecap="round" />
        <path d="M24.2 -22 l3.2 -1.2 M25.6 -27 l3 -1.8 M22.6 -31.2 l2.6 -2.2" stroke="#b9561b" strokeWidth={1.4} strokeLinecap="round" />
        <Leg x={9} y={-9.5} len={9.5} w={3.8} c="#f2a24f" foot="#fff3df" ph={0} /><Leg x={-8} y={-9.5} len={9.5} w={3.6} c="#f2a24f" foot="#fff3df" ph={0} />
        <g>
          <path d="M-12 -13 C-12 -22.5 -3 -23.5 5 -22.5 C14 -22 18 -18 17.5 -12.5 C17 -8 11 -8 5 -8 L-6 -8 C-10 -8 -12 -10 -12 -13 Z" fill="#f4a64f" stroke="#d97c2a" strokeWidth={0.9} />
          <path d="M-5 -21.6 q-1 4 0 6.6 M1 -22.4 q-1 4.4 0 7.2 M7 -22 q-1 4.2 0 7 M12.6 -19.4 q-1 3.4 0 5.8" stroke="#c9631b" strokeWidth={1.5} fill="none" strokeLinecap="round" />
          <path d="M-8 -11 Q2 -6.8 13 -10.4 Q8 -8 0 -8 Q-6 -8 -8 -11 Z" fill="#fde2bc" />
        </g>
        <Leg x={12.5} y={-9.5} len={9.5} w={3.8} c="#f7b469" foot="#fff3df" ph={1} /><Leg x={-11.5} y={-9.5} len={9.5} w={3.6} c="#f7b469" foot="#fff3df" ph={1} />
        <g>
          <path d="M-21.4 -26 L-20.6 -35.6 L-14.6 -29.6 Z" fill="#f4a64f" stroke="#d97c2a" strokeWidth={0.9} strokeLinejoin="round" /><path d="M-20 -28 L-19.8 -32.6 L-17 -29.6 Z" fill="#f9b6c1" />
          <path d="M-14.4 -29.6 L-9.4 -36 L-8.2 -26.4 Z" fill="#f4a64f" stroke="#d97c2a" strokeWidth={0.9} strokeLinejoin="round" /><path d="M-13 -29 L-9.8 -33 L-9.4 -28 Z" fill="#f9b6c1" />
          <circle cx={-15.4} cy={-21.6} r={7.6} fill="#f4a64f" stroke="#d97c2a" strokeWidth={0.9} />
          <path d="M-17 -28.4 v3.4 M-14 -29 v3.6 M-11.4 -28 v3" stroke="#c9631b" strokeWidth={1.3} strokeLinecap="round" />
          <ellipse cx={-20.2} cy={-19.4} rx={3.6} ry={2.8} fill="#fff1dc" /><path d="M-22.8 -21.2 l2.4 0 l-1.2 1.6 z" fill="#ef7f9a" />
          <ellipse cx={-18.4} cy={-23.8} rx={1.3} ry={1.7} fill="#1f2937" /><ellipse cx={-12.4} cy={-23.8} rx={1.2} ry={1.6} fill="#1f2937" /><circle cx={-18} cy={-24.5} r={0.5} fill="#fff" /><circle cx={-12} cy={-24.4} r={0.45} fill="#fff" />
          <path d="M-22 -19.6 l-5.2 -1.2 M-22 -18.8 l-5.4 0.8 M-10 -19.6 l1 -.2" stroke="#8a4a1c" strokeWidth={0.55} strokeLinecap="round" />
        </g>
      </g>
    );
    case "dog": return ( // chó vàng tai cụp nhìn nghiêng (giống emoji 🐕): mõm dài, tai nâu cụp, vòng cổ đỏ, đuôi cong dựng
      <g>
        <path d="M16 -21 C25 -23 27 -31 23 -36" stroke="#c98d4a" strokeWidth={4.2} fill="none" strokeLinecap="round" />
        <Leg x={10} y={-10.5} len={10.5} w={4} c="#d9a35f" foot="#f6dcb2" ph={0} /><Leg x={-8.5} y={-10.5} len={10.5} w={4} c="#d9a35f" foot="#f6dcb2" ph={0} />
        <g>
          <path d="M-14 -16 C-14 -24.5 -6 -25 4 -24.6 C14 -24.4 18.4 -22 18.2 -16 C18 -10 14 -9.6 8 -9.6 L-6 -9.6 C-11 -9.6 -14 -11 -14 -16 Z" fill="#dcA561" stroke="#b9792f" strokeWidth={0.9} />
          <path d="M-4 -24.6 C2 -24.6 9 -24.4 13 -22.4 C9 -17 3 -17.5 -1 -18.5 C-5 -19.6 -6 -22.4 -4 -24.6 Z" fill="#c98a45" />
          <path d="M-9 -12 Q2 -8.6 14 -11.6 Q9 -9.6 1 -9.6 Q-6 -9.6 -9 -12 Z" fill="#f6dcb2" />
        </g>
        <Leg x={13.6} y={-10.5} len={10.5} w={4} c="#e6b574" foot="#f6dcb2" ph={1} /><Leg x={-12} y={-10.5} len={10.5} w={4} c="#e6b574" foot="#f6dcb2" ph={1} />
        <g>
          <path d="M-14.5 -25 L-10.5 -19.4 L-15 -17.4 Z" fill="#a8672b" />
          <rect x={-22.4} y={-34.6} width={15.6} height={14} rx={6.4} fill="#dcA561" stroke="#b9792f" strokeWidth={0.9} />
          <path d="M-30.6 -28.4 C-30.6 -31 -26.4 -31.4 -21.6 -30.6 L-21 -22.6 C-26 -21.6 -30.6 -22.6 -30.6 -25.4 Z" fill="#f6dcb2" stroke="#b9792f" strokeWidth={0.9} strokeLinejoin="round" />
          <ellipse cx={-30.4} cy={-28.4} rx={2.1} ry={1.7} fill="#2b1d12" /><path d="M-29 -24.6 q3 1.6 6 .4" stroke="#8a5326" strokeWidth={0.7} fill="none" strokeLinecap="round" />
          <circle cx={-17.4} cy={-29.4} r={1.35} fill="#1f1308" /><circle cx={-17} cy={-29.9} r={0.45} fill="#fff" />
          <path d="M-11.4 -33.4 C-6 -35.2 -4.4 -26.6 -6.8 -20.4 C-10.8 -20.2 -13.4 -26.2 -11.4 -33.4 Z" fill="#8a5326" stroke="#6b3f1a" strokeWidth={0.7} />
          <path d="M-14 -21 L-7.6 -19.6 L-7.8 -15.6 L-14 -17 Z" fill="#dc2626" /><circle cx={-10.4} cy={-14.8} r={1.9} fill="#facc15" stroke="#ca8a04" strokeWidth={0.5} />
        </g>
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
