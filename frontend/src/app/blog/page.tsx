import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import BlogBanner from "@/components/blog/BlogBanner";
import BlogListView from "@/components/blog/BlogListView";
import { baseOpenGraph } from "@/lib/seo";
import { categoryHref } from "@/lib/blog";

type SearchParams = Promise<{ category?: string; tag?: string; q?: string; page?: string }>;

const DESCRIPTION =
  "Blog Lucy Tutor: chia sẻ kinh nghiệm luyện thi Tiếng Anh THPT Quốc Gia, IELTS, phương pháp học từ vựng, ngữ pháp và 4 kỹ năng.";

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const { tag, q, page } = await searchParams;
  const title = tag ? `#${tag} — Blog` : "Blog";
  return {
    title,
    description: DESCRIPTION,
    // Trang tìm kiếm / thẻ / phân trang không cần index riêng — tránh nội dung trùng lặp
    robots: q || tag || (page && page !== "1") ? { index: false, follow: true } : undefined,
    alternates: { canonical: "/blog" },
    openGraph: { ...baseOpenGraph, title: `${title} | Lucy Tutor`, description: DESCRIPTION, url: "/blog" },
  };
}

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const { category, tag = "", q = "", page = "1" } = await searchParams;
  // Link cũ dạng /blog?category=x -> trang danh mục riêng (tốt hơn cho SEO)
  if (category) permanentRedirect(categoryHref(category));

  return (
    <div className="flex-1">
      <BlogBanner
        crumbs={[{ label: "Blog" }]}
        title={tag ? `#${tag}` : "Blog Lucy Tutor"}
        subtitle="Kinh nghiệm luyện thi, phương pháp học Tiếng Anh và chia sẻ từ giáo viên Lucy Tutor."
        searchAction="/blog"
        defaultQuery={q}
      />
      <BlogListView basePath="/blog" page={Math.max(1, parseInt(page) || 1)} q={q} tag={tag} />
    </div>
  );
}
