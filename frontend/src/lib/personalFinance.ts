// Thu chi cá nhân (/personal-finance): kiểu dữ liệu, tính toán số dư/thống kê và gọi API.
// Backend: backend/src/routes/personalFinance.routes.js (mount /api/admin/personal-finance, chỉ tài khoản ADMIN).
// Phần tính số dư (computeMonths) có bản chép ở backend để AI đọc cùng số liệu — sửa thì sửa cả 2 nơi.
import { adminFetch } from "@/lib/adminApi";

export const START_MONTH = "2026-11";
export const START_DATE = "2026-11-01";

export type PfType = "INCOME" | "EXPENSE";
export type PfCategory = { id: string; type: PfType; name: string; parentId: string | null; budget: number | null };
export type PfTx = { id: string; type: PfType; categoryId: string; amount: number; date: string; detail: string | null };
export type PfBalance = { month: string; opening: number };
// Quỹ tiết kiệm: amount > 0 gửi vào, < 0 rút ra; fromCash = trừ vào / hoàn về số dư tiền mặt của tháng
export type PfSaving = { id: string; date: string; amount: number; note: string | null; fromCash: boolean; source: "MANUAL" | "ROLLOVER" };
export type SavingInput = { date: string; amount: number; note: string; fromCash: boolean; source: "MANUAL" | "ROLLOVER" };
export type PfData = { startMonth: string; today: string; categories: PfCategory[]; transactions: PfTx[]; balances: PfBalance[]; savings: PfSaving[] };
export type TxInput = { categoryId: string; amount: number; date: string; detail: string };

// ===== API =====
const json = (body: unknown) => JSON.stringify(body);
export const pfApi = {
  load: () => adminFetch<PfData>("/personal-finance/data"),
  addCategory: (b: { type?: PfType; name: string; parentId?: string | null }) =>
    adminFetch<PfCategory>("/personal-finance/categories", { method: "POST", body: json(b) }),
  seedCategories: () => adminFetch<{ categories: PfCategory[] }>("/personal-finance/categories/seed", { method: "POST" }),
  updateCategory: (id: string, b: { name?: string; budget?: number | null }) =>
    adminFetch<PfCategory>(`/personal-finance/categories/${id}`, { method: "PUT", body: json(b) }),
  deleteCategory: (id: string) => adminFetch<void>(`/personal-finance/categories/${id}`, { method: "DELETE" }),
  addTx: (b: TxInput) => adminFetch<PfTx>("/personal-finance/transactions", { method: "POST", body: json(b) }),
  updateTx: (id: string, b: TxInput) => adminFetch<PfTx>(`/personal-finance/transactions/${id}`, { method: "PUT", body: json(b) }),
  deleteTx: (id: string) => adminFetch<void>(`/personal-finance/transactions/${id}`, { method: "DELETE" }),
  addSaving: (b: SavingInput) => adminFetch<PfSaving>("/personal-finance/savings", { method: "POST", body: json(b) }),
  deleteSaving: (id: string) => adminFetch<void>(`/personal-finance/savings/${id}`, { method: "DELETE" }),
  setOpening: (month: string, opening: number | null) =>
    adminFetch<{ month: string; opening: number | null }>("/personal-finance/balance", { method: "PUT", body: json({ month, opening }) }),
  analyze: (month: string) => adminFetch<{ answer: string }>("/personal-finance/ai/analyze", { method: "POST", body: json({ month }) }),
  chat: (month: string, messages: { role: "user" | "assistant"; content: string }[]) =>
    adminFetch<{ answer: string }>("/personal-finance/ai/chat", { method: "POST", body: json({ month, messages }) }),
};

// ===== Tháng / ngày =====
export const shiftMonth = (m: string, delta: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const daysInMonth = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
export const monthLabel = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;
export const monthShort = (m: string) => `T${Number(m.slice(5))}/${m.slice(2, 4)}`;
export const dayLabel = (iso: string) => `${iso.slice(8)}/${iso.slice(5, 7)}`;
export const WEEKDAYS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
export const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
export const fullDayLabel = (iso: string) => `${WEEKDAYS[weekdayOf(iso)]}, ${dayLabel(iso)}/${iso.slice(0, 4)}`;

// ===== Tiền =====
export const vnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")} đ`;
export const signedVnd = (n: number) => `${n > 0 ? "+" : ""}${vnd(n)}`;

/** Đọc số tiền gõ tay: "50k", "1,5tr", "2 triệu", "1.250.000", "-300k". Trả NaN nếu không hiểu. */
export function parseMoney(input: string): number {
  const s = input.toLowerCase().replace(/\s+/g, "").replace(/(vnd|vnđ|đ|d)$/, "");
  const m = s.match(/^(-?)([\d.,]+)(k|nghìn|nghin|ngàn|ngan|tr|triệu|trieu|m|củ|cu|tỷ|ty|tỉ|ti|b)?$/);
  if (!m) return NaN;
  const [, neg, num, unit] = m;
  const mult = !unit ? 1 : /^(k|nghìn|nghin|ngàn|ngan)$/.test(unit) ? 1e3 : /^(tr|triệu|trieu|m|củ|cu)$/.test(unit) ? 1e6 : 1e9;
  // Có đơn vị: "1.5tr" / "1,5tr" là số thập phân. Không đơn vị: dấu . , chỉ là phân cách hàng nghìn.
  const value = unit ? parseFloat(num.replace(",", ".")) : parseInt(num.replace(/[.,]/g, ""), 10);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * mult) * (neg ? -1 : 1);
}

// ===== Danh mục =====
export const bigOf = (c: PfCategory, byId: Map<string, PfCategory>) => (c.parentId ? byId.get(c.parentId) ?? c : c);
export function categoryLabel(c: PfCategory | undefined, byId: Map<string, PfCategory>) {
  if (!c) return "(đã xoá)";
  const parent = c.parentId ? byId.get(c.parentId) : undefined;
  return parent ? `${parent.name} › ${c.name}` : c.name;
}

// ===== Số dư theo tháng =====
export type MonthRow = {
  month: string; opening: number; manual: boolean; income: number; expense: number;
  saved: number; // tiết kiệm lấy từ số dư tháng (trừ vào closing)
  savedAll: number; // tổng gửi/rút tiết kiệm trong tháng (kể cả khoản có sẵn)
  savingsTotal: number; // quỹ tiết kiệm lũy kế đến hết tháng
  closing: number;
};

/** Mỗi tháng từ 11/2026: đầu kỳ = số nhập tay, không có thì lấy cuối kỳ tháng trước (tháng đầu không nhập = 0).
 *  Cuối kỳ = đầu kỳ + thu − chi − tiết kiệm lấy từ số dư tháng. */
export function computeMonths(txs: PfTx[], balances: PfBalance[], savings: PfSaving[], untilMonth: string): MonthRow[] {
  const manual = new Map(balances.map((b) => [b.month, b.opening]));
  const sums = new Map<string, { income: number; expense: number }>();
  let last = untilMonth;
  for (const t of txs) {
    const m = t.date.slice(0, 7);
    const s = sums.get(m) ?? { income: 0, expense: 0 };
    if (t.type === "INCOME") s.income += t.amount; else s.expense += t.amount;
    sums.set(m, s);
    if (m > last) last = m;
  }
  const savedFromCash = new Map<string, number>();
  const savedAll = new Map<string, number>();
  for (const v of savings) {
    const m = v.date.slice(0, 7);
    savedAll.set(m, (savedAll.get(m) ?? 0) + v.amount);
    if (v.fromCash) savedFromCash.set(m, (savedFromCash.get(m) ?? 0) + v.amount);
    if (m > last) last = m;
  }
  const rows: MonthRow[] = [];
  let carry = 0;
  let savingsTotal = 0;
  for (let m = START_MONTH; m <= last; m = shiftMonth(m, 1)) {
    const s = sums.get(m) ?? { income: 0, expense: 0 };
    const opening = manual.has(m) ? manual.get(m)! : carry;
    const saved = savedFromCash.get(m) ?? 0;
    const closing = opening + s.income - s.expense - saved;
    savingsTotal += savedAll.get(m) ?? 0;
    rows.push({ month: m, opening, manual: manual.has(m), ...s, saved, savedAll: savedAll.get(m) ?? 0, savingsTotal, closing });
    carry = closing;
  }
  return rows;
}

// ===== Thống kê cho biểu đồ =====
export type CatTotal = { id: string; name: string; total: number; budget: number | null; subs: { id: string; name: string; total: number }[] };

/** Tổng theo danh mục lớn (kèm chi tiết danh mục nhỏ) của một loại, giảm dần. */
export function totalsByBig(txs: PfTx[], categories: PfCategory[], type: PfType): CatTotal[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const map = new Map<string, CatTotal>();
  for (const t of txs) {
    if (t.type !== type) continue;
    const c = byId.get(t.categoryId);
    if (!c) continue;
    const big = bigOf(c, byId);
    const e = map.get(big.id) ?? { id: big.id, name: big.name, total: 0, budget: big.budget, subs: [] };
    e.total += t.amount;
    const sub = e.subs.find((s) => s.id === c.id);
    if (sub) sub.total += t.amount; else e.subs.push({ id: c.id, name: c.id === big.id ? "Chưa chia nhỏ" : c.name, total: t.amount });
    map.set(big.id, e);
  }
  const list = [...map.values()].sort((a, b) => b.total - a.total);
  list.forEach((e) => e.subs.sort((a, b) => b.total - a.total));
  return list;
}

// Bảng màu phân loại: navy dẫn đầu (theo phong cách app), các màu còn lại tách biệt rõ trên nền trắng
export const SERIES_COLORS = ["#1E3A8A", "#3b82f6", "#f9a95a", "#0d9488", "#e11d48", "#64748b", "#ca8a04", "#0ea5e9"];
export const OTHER_COLOR = "#cbd5e1";
