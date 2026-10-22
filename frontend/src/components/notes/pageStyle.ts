// Giao diện trang ghi chú: màu nền, kiểu giấy (kẻ dòng/ô/chấm/lề), font, cỡ chữ, màu chữ. Lưu ở NotePage.style
// (backend lọc lại bằng cleanStyle). Font chỉ dùng font có sẵn trên máy (không tải Google Fonts — quy ước dự án).
import type { CSSProperties } from "react";

export type Paper = "plain" | "lines" | "grid" | "dots" | "margin";
export type FontKey = "default" | "sans" | "serif" | "mono" | "hand" | "rounded";
export type SizeKey = "sm" | "md" | "lg" | "xl";
export type PageStyle = { bg?: string; paper?: Paper; font?: FontKey; size?: SizeKey; text?: string };

export const BG_COLORS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Trắng" }, { value: "#fffdf5", label: "Giấy kem" }, { value: "#fef9c3", label: "Vàng nhạt" },
  { value: "#ecfdf5", label: "Xanh bạc hà" }, { value: "#eff6ff", label: "Xanh trời" }, { value: "#f5f3ff", label: "Tím nhạt" },
  { value: "#fdf2f8", label: "Hồng nhạt" }, { value: "#fff7ed", label: "Cam nhạt" }, { value: "#f1f5f9", label: "Xám nhạt" },
  { value: "#1f2937", label: "Bảng đen" }, { value: "#14532d", label: "Bảng xanh" }, { value: "#0f1c3f", label: "Navy đêm" },
];

export const TEXT_COLORS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Mặc định" }, { value: "#111827", label: "Đen" }, { value: "#1E3A8A", label: "Navy" },
  { value: "#2563eb", label: "Xanh dương" }, { value: "#047857", label: "Xanh lá" }, { value: "#b91c1c", label: "Đỏ" },
  { value: "#c2410c", label: "Cam" }, { value: "#7c3aed", label: "Tím" }, { value: "#6b7280", label: "Xám" }, { value: "#f8fafc", label: "Trắng (nền tối)" },
];

/** Màu chữ cho đoạn đang chọn (thanh công cụ + menu khi bôi đen) */
export const INLINE_TEXT_COLORS = ["#111827", "#1E3A8A", "#2563eb", "#0891b2", "#047857", "#65a30d", "#ca8a04", "#c2410c", "#b91c1c", "#db2777", "#7c3aed", "#6b7280"];
export const INLINE_HIGHLIGHTS = ["#fef08a", "#fde68a", "#bbf7d0", "#a7f3d0", "#bfdbfe", "#c7d2fe", "#fecaca", "#fbcfe8", "#e9d5ff", "#e5e7eb"];

export const PAPERS: { value: Paper; label: string }[] = [
  { value: "plain", label: "Trơn" }, { value: "lines", label: "Kẻ dòng" }, { value: "margin", label: "Kẻ dòng + lề" },
  { value: "grid", label: "Kẻ ô" }, { value: "dots", label: "Chấm" },
];

export const FONTS: { value: FontKey; label: string; stack: string }[] = [
  { value: "default", label: "Calibri", stack: "Calibri, Carlito, 'Segoe UI', Arial, sans-serif" },
  { value: "sans", label: "Arial / Segoe", stack: "'Segoe UI', Arial, Helvetica, sans-serif" },
  // Georgia thiếu ký tự tiếng Việt dựng sẵn (dấu bị tách rời) → dùng Times New Roman, có đủ dấu
  { value: "serif", label: "Có chân (Times)", stack: "'Times New Roman', Times, 'Noto Serif', 'Liberation Serif', serif" },
  { value: "rounded", label: "Tròn (Trebuchet)", stack: "'Trebuchet MS', 'Segoe UI', Tahoma, sans-serif" },
  { value: "hand", label: "Viết tay", stack: "'Segoe Print', 'Comic Sans MS', 'Chalkboard SE', 'Bradley Hand', cursive" },
  { value: "mono", label: "Đơn cách (code)", stack: "Consolas, 'Cascadia Mono', 'Courier New', monospace" },
];

export const SIZES: { value: SizeKey; label: string; font: number; line: number }[] = [
  { value: "sm", label: "Nhỏ", font: 15, line: 26 }, { value: "md", label: "Vừa", font: 16, line: 28 },
  { value: "lg", label: "Lớn", font: 18, line: 31 }, { value: "xl", label: "Rất lớn", font: 20, line: 34 },
];

/** Nền tối → kẻ dòng màu sáng, chữ mặc định trắng */
export function isDark(hex?: string) {
  if (!hex || !/^#[0-9a-f]{6}$/i.test(hex)) return false;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

export function hasStyle(st?: PageStyle | null) {
  return !!st && !!(st.bg || (st.paper && st.paper !== "plain") || (st.font && st.font !== "default") || (st.size && st.size !== "md") || st.text);
}

type Css = CSSProperties & Record<string, string | number>;

/** Tờ giấy (cả cột trang): màu nền, font, cỡ chữ, màu chữ — qua biến CSS --note-* (globals.css khối "Lucy Notes") */
export function sheetCss(st?: PageStyle | null): Css {
  const s = st || {};
  const dark = isDark(s.bg);
  const size = SIZES.find((x) => x.value === (s.size || "md"))!;
  const css: Css = { "--note-font-size": `${size.font}px`, "--note-line": `${size.line}px` };
  if (s.bg) css.backgroundColor = s.bg;
  const text = s.text || (dark ? "#f1f5f9" : undefined);
  if (text) css["--note-text"] = text;
  const font = FONTS.find((f) => f.value === s.font);
  if (font && font.value !== "default") css["--note-font"] = font.stack;
  return css;
}

/** Hoạ tiết giấy cho vùng nội dung: đường kẻ cách đúng 1 dòng chữ đoạn văn nên chữ nằm trên dòng kẻ */
export function linesCss(st?: PageStyle | null): Css {
  const s = st || {};
  if (!s.paper || s.paper === "plain") return {};
  const dark = isDark(s.bg);
  const line = SIZES.find((x) => x.value === (s.size || "md"))!.line;
  const ink = dark ? "rgba(255,255,255,0.16)" : "rgba(30,58,138,0.14)";
  const layers: string[] = [];
  const sizes: string[] = [];
  if (s.paper === "lines" || s.paper === "margin") {
    if (s.paper === "margin") { layers.push("linear-gradient(to right, transparent 40px, rgba(239,68,68,0.5) 40px, rgba(239,68,68,0.5) 42px, transparent 42px)"); sizes.push("100% 100%"); }
    layers.push(`linear-gradient(to bottom, transparent ${line - 1}px, ${ink} ${line - 1}px)`);
    sizes.push(`100% ${line}px`);
  } else if (s.paper === "grid") {
    layers.push(`linear-gradient(to bottom, transparent ${line - 1}px, ${ink} ${line - 1}px)`, `linear-gradient(to right, transparent ${line - 1}px, ${ink} ${line - 1}px)`);
    sizes.push(`${line}px ${line}px`, `${line}px ${line}px`);
  } else if (s.paper === "dots") {
    layers.push(`radial-gradient(circle at ${line / 2}px ${line - 1}px, ${dark ? "rgba(255,255,255,0.32)" : "rgba(30,58,138,0.3)"} 1.3px, transparent 1.7px)`);
    sizes.push(`${line}px ${line}px`);
  }
  return { backgroundImage: layers.join(", "), backgroundSize: sizes.join(", "), backgroundRepeat: "repeat", ...(s.paper === "margin" ? { paddingLeft: "56px" } : {}) };
}
