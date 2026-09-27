import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

// Chỉ liệt kê các trang công khai. Khu vực riêng tư (dashboard, teacher, trang theo id)
// được chặn ở robots.ts và gắn noindex trong layout tương ứng.
const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
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

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
