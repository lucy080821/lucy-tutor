export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";

export const CEFR_LEVELS: { value: CefrLevel; label: string }[] = [
  { value: "A1", label: "A1 — Mới bắt đầu" },
  { value: "A2", label: "A2 — Sơ cấp" },
  { value: "B1", label: "B1 — Trung cấp" },
  { value: "B2", label: "B2 — Trung cao cấp" },
  { value: "C1", label: "C1 — Cao cấp" },
];

export type PracticePurpose = "IELTS" | "GENERAL";

export const PRACTICE_PURPOSES: { value: PracticePurpose; label: string }[] = [
  { value: "GENERAL", label: "💬 Giao tiếp hàng ngày" },
  { value: "IELTS", label: "🎓 Luyện thi IELTS" },
];

export function formatPracticedAt(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.toLocaleDateString("vi-VN")} lúc ${d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}
