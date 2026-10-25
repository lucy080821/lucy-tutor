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
  // Mật khẩu tạm đã cấp mà chủ tài khoản chưa đổi (đổi xong thì null)
  tempPassword: string | null; tempPasswordIssuedAt: string | null;
};
export type PasswordRequest = {
  id: string; contact: string | null; note: string | null; createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null; role: string };
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

export const ROLE_LABEL: Record<string, string> = { STUDENT: "Học viên", TEACHER: "Giáo viên", NOTES: "Tài khoản Ghi chú", ADMIN: "Quản trị" };

export const FREE_STATUS_LABEL: Record<FreeStatus, string> = {
  TRIAL: "Đang dùng thử",
  ACTIVE: "Đang hoạt động",
  LOCKED: "Đã khoá",
  EXEMPT: "Miễn trừ",
};

// ===== Lượt truy cập & sức khoẻ kinh doanh (backend: routes/adminAnalytics.routes.js) =====

export type RangeDays = 7 | 30 | 90;
export type NamedCount = { name: string; sessions: number };
export type TrafficTotals = {
  views: number; visitors: number; sessions: number; bounceRate: number; pagesPerSession: number; avgSessionSec: number;
};
export type Traffic = {
  days: number;
  current: TrafficTotals;
  previous: TrafficTotals;
  series: { day: string; views: number; visitors: number; sessions: number }[];
  topPages: { path: string; views: number; visitors: number; avgSec: number | null }[];
  landingPages: { path: string; sessions: number; bounceRate: number }[];
  channels: NamedCount[]; referrers: NamedCount[]; campaigns: NamedCount[]; devices: NamedCount[]; browsers: NamedCount[];
  visitorsNew: number; visitorsReturning: number;
  hours: { hour: number; views: number }[];
  roles: { role: string; sessions: number; users: number }[];
};
export type Realtime = {
  activeVisitors: number; activeUsers: number; mobile: number;
  pages: { path: string; visitors: number }[];
  perMinute: { ago: number; views: number }[];
};
export type FeatureUsage = { name: string; uses: number; users: number; prevUses: number; prevUsers: number };
export type Business = {
  days: number;
  revenue: {
    ym: string; label: string; classTuition: number; freeStudent: number; total: number; payers: number; arppu: number;
    manualIncome: number; manualExpense: number; activeStudents: number; activeTeachers: number;
  }[];
  active: { dau: number; wau: number; mau: number; prevMau: number; avgDau: number; stickiness: number; series: { day: string; dau: number; wau: number }[] };
  features: FeatureUsage[];
  signups: { students: number; teachers: number; prevStudents: number; prevTeachers: number };
  funnel: { visitors: number; authVisitors: number; signups: number; activated: number; paid: number; joinedClass: number };
  cohorts: { cohort: string; label: string; size: number; retention: (number | null)[] }[];
  trial: { started: number; inTrial: number; ended: number; paid: number; joinedClass: number; lockedNeverPaid: number };
  subscriptions: { everPaid: number; active: number; lapsed: number; expiringIn7: number };
  teachers: { total: number; active30: number; withStudents: number; classStudents: number; emptyClassrooms: number };
};

export const formatPct = (ratio: number, digits = 1) => `${(ratio * 100).toLocaleString("vi-VN", { maximumFractionDigits: digits })}%`;
export const formatDuration = (sec: number | null | undefined) => {
  if (sec === null || sec === undefined || !Number.isFinite(sec)) return "—";
  const s = Math.round(sec);
  if (s < 60) return `${s} giây`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m} phút ${s % 60 ? `${s % 60} giây` : ""}`.trim() : `${Math.floor(m / 60)} giờ ${m % 60} phút`;
};
// Gọn cho thẻ KPI: 154 -> "2:34" (phút:giây), 3725 -> "1:02:05"
export const formatClock = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return hh ? `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}` : `${mm}:${String(ss).padStart(2, "0")}`;
};
// "2026-10-13" -> "13/10"
export const shortDay = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

// ===== SEO Performance (backend: routes/adminSeo.routes.js, utils/seoSummary.js) =====

export type SeoRange = 7 | 28 | 90;
export type SeoMetrics = { clicks: number; impressions: number; ctr: number; position: number | null };
export type SeoRow = SeoMetrics & { key: string; prev: SeoMetrics };
export type SeoSync = { configured: boolean; syncing: boolean; at: string | null; error: string | null; rows: number; from: string | null; to: string | null };
export type SeoSummary = {
  configured: boolean; sync: SeoSync; hasData: boolean; days: number;
  period?: { start: string; end: string }; previousPeriod?: { start: string; end: string };
  totals?: { current: SeoMetrics; previous: SeoMetrics };
  series?: (SeoMetrics & { date: string })[];
  namedQueryImpressions?: number;
  queries?: SeoRow[]; pages?: SeoRow[]; countries?: SeoRow[]; devices?: SeoRow[]; appearances?: SeoRow[];
  queryPages?: (SeoRow & { query: string; page: string })[];
  opportunities?: SeoRow[]; newQueries?: SeoRow[];
  lostQueries?: { key: string; prev: SeoMetrics }[];
  movers?: (SeoRow & { positionChange: number })[];
};
export type SeoReportMeta = { id: string; periodStart: string; periodEnd: string; author: string; createdAt: string };
export type SeoReport = SeoReportMeta & { content: string };

// Vị trí TB: 1 chữ số thập phân; null = không có lượt hiển thị
export const formatPosition = (p: number | null | undefined) =>
  p === null || p === undefined ? "—" : p.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// ===== Mạng xã hội: YouTube + Facebook + TikTok (backend: routes/adminSocial.routes.js, utils/socialSummary.js) =====

export type SocialRange = 7 | 28 | 90;
export type SocialKind = "YT_VIDEO" | "YT_SHORT" | "FB_REEL" | "FB_POST" | "TT_VIDEO";
export type SocialTotals = { views: number; watchHours: number; engagements: number; gained: number; lost: number; net: number; per1000: number | null };
export type SocialItem = {
  id: string; kind: SocialKind; title: string; url: string; thumbnail: string; publishedAt: string;
  views: number; reach: number | null; likes: number; comments: number; shares: number; watchMinutes: number | null;
  followsGained: number | null; followsLost: number | null; convViews: number | null; per1000: number | null; metricsAt: string;
};
export type SocialSync = { configured: boolean; syncing: boolean; at: string | null; error: string | null; items: number; notes: string[] };
export type SocialPlatform = {
  platform: "YOUTUBE" | "FACEBOOK" | "TIKTOK"; configured: boolean; sync: SocialSync; hasData: boolean;
  followers?: number | null; lifetimeViews?: number; period?: { start: string; end: string };
  totals?: { current: SocialTotals; previous: SocialTotals };
  series?: { date: string; views: number; gained: number; lost: number; net: number; per1000: number | null }[];
  items: SocialItem[];
};
export type SocialSummary = { days: number; youtube: SocialPlatform; facebook: SocialPlatform; tiktok: SocialPlatform };

export type SocialCommentPlatform = "YOUTUBE" | "FACEBOOK";
export type SocialComment = {
  id: string; platform: SocialCommentPlatform; itemTitle: string; itemUrl: string; isReply: boolean; authorName: string; authorAvatar: string;
  text: string; likes: number; replyCount: number; isOwner: boolean; handled: boolean; publishedAt: string;
};
export type SocialCommentsPage = {
  total: number; page: number; pageSize: number; open: Record<SocialCommentPlatform, number>; items: SocialComment[];
};

// Chuyển đổi: hiện theo 1.000 lượt xem (tỷ lệ thật thường 0,1–1%, đọc phần trăm khó so sánh)
export const formatPer1000 = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
