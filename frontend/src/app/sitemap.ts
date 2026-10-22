import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { authorHref, blogFetch, categoryHref } from "@/lib/blog";
import { FREE_TOOLS } from "@/lib/freeTools";
import { getFlashGrades, gradeWordCount } from "@/lib/tools/flashcards";
import { PHOTOS } from "@/lib/photos";

// Chỉ liệt kê trang có nội dung thật khi chưa đăng nhập. Các trang luyện tập cần đăng nhập
// (gym, reading, writing, listening, conversation, pronunciation, mock-test, ielts, grammar-gym,
// study-plan, mistakes, exam) gắn noindex trong layout và không đưa vào đây; khu vực riêng tư
// (dashboard, teacher, trang theo id) còn bị chặn thêm ở robots.ts.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/auth", priority: 0.5, changeFrequency: "monthly" },
];

// Công cụ miễn phí (không cần đăng nhập) — ưu tiên cao vì là trang đích từ Google; gồm cả /phonetics và /games/lop-3
const TOOL_ROUTES = [
  ...FREE_TOOLS.map((t) => ({ path: t.href, priority: 0.9, changeFrequency: "monthly" as const })),
];

// Ảnh chụp thật trên từng trang (sitemap ảnh giúp Google Images lập chỉ mục)
const PAGE_IMAGES: Record<string, string[]> = {
  "": [PHOTOS.homeCta.src, PHOTOS.homeFaq.src, "/images/photos/home/hoc-tieng-anh-online-cung-ai.webp", "/images/photos/home/giao-vien-day-hoc-bang-tuong-tac.webp"],
  "/kiem-tra-trinh-do-tieng-anh": [PHOTOS.placement.src],
  "/cham-writing-mien-phi": [PHOTOS.writing.src],
  "/ielts-band-calculator": [PHOTOS.ielts.src],
  "/cach-phat-am-ed-s-es": [PHOTOS.pronunciation.src],
  "/flashcard-tieng-anh": [PHOTOS.flashcard.src],
  "/bang-dong-tu-bat-quy-tac": [PHOTOS.irregularVerbs.src],
  "/blog": [PHOTOS.blog.src],
  "/ghi-chu-ai": ["/images/photos/home/ghi-chu-ai-ghi-am-flashcard.webp"],
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries: MetadataRoute.Sitemap = [...PUBLIC_ROUTES, ...TOOL_ROUTES].map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
    ...(PAGE_IMAGES[path] ? { images: PAGE_IMAGES[path].map((src) => `${SITE_URL}${src}`) } : {}),
  }));
  // Bài blog + trang danh mục + trang tác giả (blogFetch cache 60s; backend lỗi thì vẫn trả sitemap tĩnh)
  const blog = await blogFetch<{ posts: { slug: string; updatedAt: string }[]; categories: string[]; authors: string[] }>("/sitemap");
  const postEntries: MetadataRoute.Sitemap = [
    ...(blog?.posts ?? []).map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...(blog?.categories ?? []).map((slug) => ({
      url: `${SITE_URL}${categoryHref(slug)}`, lastModified, changeFrequency: "weekly" as const, priority: 0.6,
    })),
    ...(blog?.authors ?? []).map((slug) => ({
      url: `${SITE_URL}${authorHref(slug)}`, lastModified, changeFrequency: "monthly" as const, priority: 0.4,
    })),
  ];
  // Trang flashcard theo lớp: chỉ lớp đã có từ vựng (lớp đang cập nhật để noindex)
  const flashEntries: MetadataRoute.Sitemap = (await getFlashGrades()).filter((g) => gradeWordCount(g) > 0).map((g) => ({
    url: `${SITE_URL}/flashcard-tieng-anh/${g.slug}`,
    lastModified,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...staticEntries, ...flashEntries, ...postEntries];
}
