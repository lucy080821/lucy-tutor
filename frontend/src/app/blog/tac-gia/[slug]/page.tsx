import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BlogBanner from "@/components/blog/BlogBanner";
import BlogListView from "@/components/blog/BlogListView";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import { baseOpenGraph, SITE_NAME, SITE_URL } from "@/lib/seo";
import { authorAvatarUrl, authorHref, blogFetch, type BlogAuthor } from "@/lib/blog";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ page?: string }>;

const getAuthor = (slug: string) => blogFetch<BlogAuthor>(`/authors/${encodeURIComponent(slug)}`);

const describe = (a: BlogAuthor) =>
  a.authorBio?.slice(0, 160) || `Các bài viết của ${a.name}${a.authorTitle ? ` — ${a.authorTitle}` : ""} trên Blog Lucy Tutor.`;

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const author = await getAuthor(slug);
  if (!author) return { title: "Không tìm thấy tác giả", robots: { index: false } };
  return {
    title: `${author.name} — Tác giả`,
    description: describe(author),
    robots: page && page !== "1" ? { index: false, follow: true } : undefined,
    alternates: { canonical: authorHref(slug) },
    openGraph: {
      ...baseOpenGraph,
      type: "profile",
      title: `${author.name} | Blog Lucy Tutor`,
      description: describe(author),
      url: authorHref(slug),
      ...(author.hasAvatar ? { images: [{ url: authorAvatarUrl(slug), alt: author.name }] } : {}),
    },
  };
}

export default async function BlogAuthorPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { slug } = await params;
  const { page = "1" } = await searchParams;
  const author = await getAuthor(slug);
  if (!author) notFound();

  const personLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    jobTitle: author.authorTitle || undefined,
    description: author.authorBio || undefined,
    url: `${SITE_URL}${authorHref(slug)}`,
    image: author.hasAvatar ? authorAvatarUrl(slug) : undefined,
    worksFor: { "@type": "EducationalOrganization", name: SITE_NAME, url: SITE_URL },
  };

  return (
    <div className="flex-1">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd).replace(/</g, "\\u003c") }} />
      <BlogBanner
        crumbs={[{ label: "Blog", href: "/blog" }, { label: "Tác giả" }, { label: author.name }]}
        title={author.name}
        subtitle={author.authorTitle}
        aside={
          <div className="hidden md:block">
            <AuthorAvatar name={author.name} authorSlug={author.authorSlug} hasAvatar={author.hasAvatar} size={128} />
          </div>
        }
      />
      {author.authorBio && (
        <div className="max-w-6xl mx-auto px-4 md:px-8 pt-8">
          <div className="ui-card p-6 flex gap-4 items-start">
            <div className="md:hidden">
              <AuthorAvatar name={author.name} authorSlug={author.authorSlug} hasAvatar={author.hasAvatar} size={56} />
            </div>
            <p className="text-foreground leading-relaxed whitespace-pre-line">{author.authorBio}</p>
          </div>
        </div>
      )}
      <BlogListView
        basePath={authorHref(slug)}
        filter={{ author: slug }}
        page={Math.max(1, parseInt(page) || 1)}
        showCategoryChips={false}
        emptyText="Tác giả này chưa có bài viết nào được đăng."
      />
    </div>
  );
}
