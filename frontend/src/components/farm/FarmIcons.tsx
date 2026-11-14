"use client";
import type { SVGProps } from "react";

// Bộ icon SVG của Nông Trại: nét 2px bo tròn (kiểu Lucide), dùng chung cho thanh điều hướng, thanh công cụ, HUD, panel.
// Thay emoji ở các nút để đồng bộ hình trên mọi hệ điều hành (emoji mỗi máy một kiểu, dễ bị cắt/lệch).
type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 24): SVGProps<SVGSVGElement> => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true });

export const IconShop = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>;
export const IconPaw = ({ size, ...r }: P) => <svg {...base(size)} {...r}><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></svg>;
export const IconTarget = ({ size, ...r }: P) => <svg {...base(size)} {...r}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
export const IconTrophy = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg>;
export const IconUsers = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
export const IconWheel = ({ size, ...r }: P) => <svg {...base(size)} {...r}><circle cx="12" cy="12" r="2" /><path d="M12 2v4" /><path d="m6.8 15-3.5 2" /><path d="m20.7 7-3.5 2" /><path d="M6.8 9 3.3 7" /><path d="m20.7 17-3.5-2" /><path d="m9 22 3-8 3 8" /><path d="M8 22h8" /><path d="M18 18.7a9 9 0 1 0-12 0" /></svg>;
export const IconBarn = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z" /><path d="M6 18h12" /><path d="M6 14h12" /><rect width="12" height="12" x="6" y="10" /></svg>;
export const IconMove = ({ size, ...r }: P) => <svg {...base(size)} {...r}><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" x2="22" y1="12" y2="12" /><line x1="12" x2="12" y1="2" y2="22" /></svg>;
export const IconMaximize = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></svg>;
export const IconMinimize = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M8 3v3a2 2 0 0 1-2 2H3" /><path d="M21 8h-3a2 2 0 0 1-2-2V3" /><path d="M3 16h3a2 2 0 0 1 2 2v3" /><path d="M16 21v-3a2 2 0 0 1 2-2h3" /></svg>;
export const IconVolume = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /></svg>;
export const IconVolumeOff = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M11 5 6 9H2v6h4l5 4V5Z" /><line x1="22" x2="16" y1="9" y2="15" /><line x1="16" x2="22" y1="9" y2="15" /></svg>;
export const IconHelp = ({ size, ...r }: P) => <svg {...base(size)} {...r}><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>;
export const IconRefresh = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>;
export const IconSprout = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z" /></svg>;
export const IconTruck = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></svg>;
export const IconStar = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>;
export const IconBrain = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" /><path d="M12 18V5" /></svg>;
export const IconPen = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>;
export const IconMedal = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /><path d="M11 12 5.12 2.2" /><path d="m13 12 5.88-9.8" /><path d="M8 7h8" /><circle cx="12" cy="17" r="5" /><path d="M12 18v-2h-.5" /></svg>;
export const IconPalette = ({ size, ...r }: P) => <svg {...base(size)} {...r}><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg>;
export const IconShirt = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z" /></svg>;
export const IconFlame = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>;
export const IconBolt = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" /></svg>;
export const IconGift = ({ size, ...r }: P) => <svg {...base(size)} {...r}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" /></svg>;
export const IconCheck = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M20 6 9 17l-5-5" /></svg>;
export const IconWeather = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M12 2v2" /><path d="m4.93 4.93 1.41 1.41" /><path d="M20 12h2" /><path d="m19.07 4.93-1.41 1.41" /><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128" /><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z" /></svg>;
export const IconPin = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>;
export const IconCrown = ({ size, ...r }: P) => <svg {...base(size)} {...r}><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M5 20h14" /></svg>;

// Icon tô màu (không phải nét) cho HUD
export function CoinIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><circle cx="12" cy="12" r="10.5" fill="#fbbf24" stroke="#d97706" strokeWidth="1.5" /><circle cx="12" cy="12" r="7" fill="none" stroke="#f59e0b" strokeWidth="1.5" /><path d="M12 7.5v9M9.6 9.6c0-1 1-1.7 2.4-1.7s2.4.6 2.4 1.6c0 2.1-4.8 1-4.8 3.2 0 1 1 1.7 2.4 1.7s2.4-.7 2.4-1.7" fill="none" stroke="#b45309" strokeWidth="1.3" strokeLinecap="round" /></svg>;
}
export function GemIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M6 3h12l4 6-10 12L2 9z" fill="#38bdf8" stroke="#0369a1" strokeWidth="1.5" strokeLinejoin="round" /><path d="M2 9h20M9 3l-2 6 5 12 5-12-2-6" fill="none" stroke="#e0f2fe" strokeWidth="1.2" strokeLinejoin="round" opacity=".85" /></svg>;
}
export function BasketIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden><path d="M4 10h16l-1.6 9a2 2 0 0 1-2 1.6H7.6a2 2 0 0 1-2-1.6z" fill="#d97706" stroke="#92400e" strokeWidth="1.4" strokeLinejoin="round" /><path d="M8 10a4 4 0 0 1 8 0" fill="none" stroke="#92400e" strokeWidth="1.6" strokeLinecap="round" /><path d="M8 13v5M12 13v5M16 13v5" stroke="#fde68a" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}

// Tra icon theo tên (server gửi `icon` cho nhiệm vụ/thành tựu)
export const ICONS: Record<string, (p: P) => React.ReactElement> = {
  sprout: IconSprout, seed: IconSprout, truck: IconTruck, coin: (p) => <CoinIcon size={p.size ?? 24} />, paw: IconPaw, wheel: IconWheel, star: IconStar, brain: IconBrain,
  pen: IconPen, medal: IconMedal, palette: IconPalette, shirt: IconShirt, users: IconUsers, flame: IconFlame, barn: IconBarn, gift: IconGift, trophy: IconTrophy,
};
export function NamedIcon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  const I = ICONS[name] || IconStar;
  return <span className={className} style={{ display: "inline-flex" }}><I size={size} /></span>;
}
