import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogBanner from "@/components/blog/BlogBanner";
import BlogListView from "@/components/blog/BlogListView";
import { baseOpenGraph, SITE_URL } from "@/lib/seo";
import { blogFetch, categoryHref, type BlogCategory } from "@/lib/blog";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ q?: string; page?: string }>;

const getCategory = async (slug: string) =>
  (await blogFetch<BlogCategory[]>("/categories"))?.find((c) => c.slug === slug) ?? null;

const describe = (c: BlogCategory) =>
  c.description || `Các bài viết chuyên mục ${c.name} trên Blog Lucy Tutor — kinh nghiệm luyện thi và học Tiếng Anh.`;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params;
  const { q, page } = await searchParams;
  const category = await getCategory(slug);
  if (!category) return { title: "Không tìm thấy danh mục", robots: { index: false } };
  return {
    title: `${category.name} — Blog`,
    description: describe(category),
    robots: q || (page && page !== "1") ? { index: false, follow: true } : undefined,
    alternates: { canonical: categoryHref(slug) },
    openGraph: { ...baseOpenGraph, title: `${category.name} | Blog Lucy Tutor`, description: describe(category), url: categoryHref(slug) },
  };
}

export default async function BlogCategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { q = "", page = "1" } = await searchParams;
  const category = await getCategory(slug);
  if (!category) notFound();

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
      { "@type": "ListItem", position: 3, name: category.name, item: `${SITE_URL}${categoryHref(slug)}` },
    ],
  };

  return (
    <div className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <BlogBanner
        crumbs={[{ label: "Blog", href: "/blog" }, { label: category.name }]}
        title={category.name}
        subtitle={describe(category)}
        searchAction={categoryHref(slug)}
        defaultQuery={q}
      />
      <BlogListView
        basePath={categoryHref(slug)}
        filter={{ category: slug }}
        activeCategorySlug={slug}
        page={Math.max(1, parseInt(page) || 1)}
        q={q}
        emptyText="Danh mục này chưa có bài viết nào."
      />
    </div>
  );
}
