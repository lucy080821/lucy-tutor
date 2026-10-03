// Cấu hình SEO dùng chung (metadata, sitemap, robots, JSON-LD).
// Domain thật: lucytutor.online. NEXT_PUBLIC_SITE_URL (nếu set) sẽ ghi đè giá trị này.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lucytutor.online").replace(/\/+$/, "");
export const SITE_NAME = "Lucy Tutor";
export const SITE_DESCRIPTION =
  "Lucy Tutor – nền tảng luyện thi Tiếng Anh THPT Quốc Gia và IELTS cho học sinh Việt Nam: luyện nghe, đọc, viết, nói cùng AI, đề thi thử, từ vựng SRS và công cụ quản lý lớp học cho giáo viên.";

// openGraph của layout con sẽ ghi đè toàn bộ openGraph của layout cha (merge nông),
// nên các layout con spread object này để giữ siteName/locale/type.
export const baseOpenGraph = {
  siteName: SITE_NAME,
  locale: "vi_VN",
  type: "website" as const,
};
