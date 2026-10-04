// Gọi API trang quản trị /administrator. Token admin (có chữ ký, hết hạn 12 giờ — xem backend/src/utils/adminAuth.js)
// lưu sessionStorage: đóng tab là phải đăng nhập lại, không dùng chung với phiên học viên/giáo viên ở lib/session.ts.

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TOKEN_KEY = "lucy_admin_token";

export function getAdminToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
export function setAdminToken(token: string) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* bị chặn */ }
}
export function clearAdminToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* bị chặn */ }
}

export class AdminAuthError extends Error {}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/admin${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getAdminToken() || ""}`,
      ...init.headers,
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    const data = await res.json().catch(() => null);
    throw new AdminAuthError(data?.error || "Phiên quản trị đã hết hạn");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Lỗi ${res.status}`);
  return data as T;
}

// ===== Kiểu dữ liệu =====

export type TxType = "INCOME" | "EXPENSE";
export type Transaction = {
  id: string; type: TxType; category: string; amount: number; date: string;
  note: string | null; recurring: boolean; createdByEmail: string | null;
};
export type MonthSummary = {
  month: number; income: number; expense: number; profit: number; appTuition: number; appFreeStudent: number;
};
export type FinanceSummary = { year: number; months: MonthSummary[]; total: Omit<MonthSummary, "month"> };
export type FreeStatus = "TRIAL" | "ACTIVE" | "LOCKED" | "EXEMPT";
export type Overview = {
  counts: { students: number; teachers: number; classrooms: number; freeStudents: number; active7: number; active30: number; publishedPosts: number };
  freeStatus: Record<FreeStatus, number>;
  signups: { ym: string; label: string; students: number; teachers: number }[];
  finance: { year: number; month: number; income: number; expense: number; profit: number; prev: { income: number; expense: number; profit: number } };
};
export type AdminUser = {
  id: string; name: string; email: string; phone: string | null; role: string; createdAt: string; lastActive: string;
  totalXP: number; accessExpiresAt: string | null; classroomsJoined: number; classroomsOwned: number;
  managerTeacherName: string | null; freeStatus: FreeStatus | null;
};

// ===== Định dạng =====

export const formatVND = (n: number) => `${n.toLocaleString("vi-VN")} đ`;
// Rút gọn cho trục biểu đồ: 1.500.000 -> "1,5tr"
export const formatShortVND = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tỷ`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}tr`;
  if (abs >= 1e3) return `${(n / 1e3).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}k`;
  return String(n);
};
// Ngày lưu ở backend là 12:00 giờ VN -> lấy phần ngày theo giờ VN
export const vnDateKey = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
export const formatVNDate = (iso: string) => {
  const [y, m, d] = vnDateKey(iso).split("-");
  return `${d}/${m}/${y}`;
};
export const pctChange = (current: number, previous: number) => (previous ? ((current - previous) / Math.abs(previous)) * 100 : null);

export const ROLE_LABEL: Record<string, string> = { STUDENT: "Học viên", TEACHER: "Giáo viên", ADMIN: "Quản trị" };

export const FREE_STATUS_LABEL: Record<FreeStatus, string> = {
  TRIAL: "Đang dùng thử",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khoá",
  EXEMPT: "Miễn trừ",
};
