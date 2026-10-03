import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { authorHref, blogFetch, categoryHref } from "@/lib/blog";

// Chỉ liệt kê các trang công khai. Khu vực riêng tư (dashboard, teacher, trang theo id)
// được chặn ở robots.ts và gắn noindex trong layout tương ứng.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly" },
  { path: "/auth", priority: 0.8, changeFrequency: "monthly" },
  { path: "/mock-test", priority: 0.8, changeFrequency: "monthly" },
  { path: "/ielts", priority: 0.8, changeFrequency: "monthly" },
  { path: "/reading", priority: 0.7, changeFrequency: "monthly" },
  { path: "/writing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/listening", priority: 0.7, changeFrequency: "monthly" },
  { path: "/conversation", priority: 0.7, changeFrequency: "monthly" },
  { path: "/pronunciation", priority: 0.7, changeFrequency: "monthly" },
  { path: "/gym", priority: 0.6, changeFrequency: "monthly" },
  { path: "/grammar-gym", priority: 0.6, changeFrequency: "monthly" },
  { path: "/phonetics", priority: 0.6, changeFrequency: "monthly" },
  { path: "/study-plan", priority: 0.5, changeFrequency: "monthly" },
  { path: "/mistakes", priority: 0.4, changeFrequency: "monthly" },
  { path: "/exam", priority: 0.4, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();
  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
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
  return [...staticEntries, ...postEntries];
}
