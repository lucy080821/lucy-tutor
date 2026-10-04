// Kiểu dữ liệu + helper dùng chung cho Blog (trang công khai /blog và editor /teacher/blog).

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type BlogAuthorRef = { id: string; name: string; authorSlug: string | null };

export type BlogAuthor = BlogAuthorRef & { authorTitle: string | null; authorBio: string | null; hasAvatar?: boolean };

export type BlogCategory = { id: string; name: string; slug: string; description?: string | null; postCount?: number };

export type BlogPostSummary = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  publishedAt: string | null;
  readingMinutes: number;
  featured: boolean;
  tags: string[];
  views: number;
  clicks: number;
  author: BlogAuthorRef;
  category: { id: string; name: string; slug: string } | null;
};

export type BlogPost = Omit<BlogPostSummary, "author"> & {
  author: BlogAuthor;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  updatedAt: string;
};

// Bản sao của backend/src/utils/slugify.js — giữ 2 bản khớp nhau.
export function slugify(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function formatBlogDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh",
  });
}

// Số liệu giữ chân người đọc (chỉ trả về ở API quản lý /manage/*, không hiện công khai).
export type BlogReadStats = {
  views: number;
  clicks: number;
  readingMinutes: number;
  readSeconds: number;
  readSessions: number;
  scroll25: number;
  scroll50: number;
  scroll75: number;
  scroll100: number;
};

export const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

const pct = (part: number, total: number) => (total > 0 ? Math.min(100, Math.round((part / total) * 100)) : 0);

// Dẫn xuất từ số cộng dồn: thời gian đọc TB, % bài đã đọc so với thời gian đọc dự kiến, % lượt đọc cuộn tới từng mốc.
export function deriveReadStats(s: BlogReadStats) {
  const avgSeconds = s.readSessions > 0 ? Math.round(s.readSeconds / s.readSessions) : 0;
  return {
    avgSeconds,
    readPercent: pct(avgSeconds, s.readingMinutes * 60),
    scroll: {
      25: pct(s.scroll25, s.readSessions),
      50: pct(s.scroll50, s.readSessions),
      75: pct(s.scroll75, s.readSessions),
      100: pct(s.scroll100, s.readSessions),
    } as Record<(typeof SCROLL_MILESTONES)[number], number>,
  };
}

// 165 → "2 phút 45 giây"
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (!m) return `${s} giây`;
  return s ? `${m} phút ${s} giây` : `${m} phút`;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Fetch phía server cho trang công khai — cache 60s (ISR) để bài mới/bài sửa hiện lên sau tối đa 1 phút
// mà không phải gọi backend ở mỗi lượt xem. Lỗi mạng (backend tắt lúc build) trả null thay vì làm hỏng trang.
export async function blogFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_URL}/api/blog${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const categoryHref = (slug: string) => `/blog/danh-muc/${slug}`;
export const authorHref = (slug: string) => `/blog/tac-gia/${slug}`;
// Avatar tác giả phục vụ dạng ảnh (không nhúng base64 vào HTML/JSON)
export const authorAvatarUrl = (slug: string) => `${API_URL}/api/blog/authors/${encodeURIComponent(slug)}/avatar`;
