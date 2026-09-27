import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/teacher",
        "/exam/", // /exam/[id] — bài thi theo tài khoản (trang demo /exam vẫn được phép)
        "/lesson/",
        "/ielts/", // /ielts/[testId]/... — trang làm bài (danh sách /ielts vẫn được phép)
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
