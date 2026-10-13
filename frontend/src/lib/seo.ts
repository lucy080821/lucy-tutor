// Cấu hình SEO dùng chung (metadata, sitemap, robots, JSON-LD).
// Domain thật: lucytutor.online. NEXT_PUBLIC_SITE_URL (nếu set) sẽ ghi đè giá trị này.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://lucytutor.online").replace(/\/+$/, "");
export const SITE_NAME = "Lucy Tutor";
// < 160 ký tự (meta description trang chủ)
export const SITE_DESCRIPTION =
  "Học tiếng Anh online miễn phí cùng AI: kiểm tra trình độ, chấm IELTS Writing, flashcard Global Success, luyện thi THPT & IELTS 4 kỹ năng. Dùng thử 3 ngày.";

// openGraph của layout con sẽ ghi đè toàn bộ openGraph của layout cha (merge nông),
// nên các layout con spread object này để giữ siteName/locale/type.
export const baseOpenGraph = {
  siteName: SITE_NAME,
  locale: "vi_VN",
  type: "website" as const,
};

/** Metadata đầy đủ cho 1 trang công khai: title, description, keywords, canonical, OpenGraph, Twitter. */
export function pageMetadata({ title, description, path, keywords, ogTitle, image }: {
  title: string; description: string; path: string; keywords: string[]; ogTitle?: string;
  /** Ảnh chia sẻ mạng xã hội — bỏ trống thì dùng ảnh OG chung (app/opengraph-image.tsx) */
  image?: { src: string; alt: string; width: number; height: number };
}) {
  // Title trên Google nên < 60 ký tự: thêm hậu tố " | Lucy Tutor" (template ở layout gốc) chỉ khi còn đủ chỗ,
  // ngược lại dùng title tuyệt đối để không bị cắt cụt giữa từ khoá.
  const withSuffix = `${title} | ${SITE_NAME}`;
  const fitsSuffix = withSuffix.length < 60;
  const fullTitle = ogTitle || (fitsSuffix ? withSuffix : title);
  const images = image ? [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] : undefined;
  return {
    title: fitsSuffix ? title : { absolute: title },
    description,
    keywords,
    alternates: { canonical: path },
    openGraph: { ...baseOpenGraph, title: fullTitle, description, url: path, ...(images ? { images } : {}) },
    twitter: { card: "summary_large_image" as const, title: fullTitle, description, ...(images ? { images: images.map((i) => i.url) } : {}) },
  };
}
