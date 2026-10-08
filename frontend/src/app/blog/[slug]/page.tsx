import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PostCard from "@/components/blog/PostCard";
import AuthorAvatar from "@/components/blog/AuthorAvatar";
import BlogAudioPlayer from "@/components/blog/BlogAudioPlayer";
import { baseOpenGraph, SITE_NAME, SITE_URL } from "@/lib/seo";
import { authorHref, blogFetch, categoryHref, formatBlogDate, slugify, stripHtml, type BlogPost, type BlogPostSummary } from "@/lib/blog";
import { ShareButtons } from "./BlogClientBits";
import { BlogPostStats, BlogReadTracker, BlogViewTracker } from "@/components/blog/BlogStats";

type Params = Promise<{ slug: string }>;
type PostResponse = { post: BlogPost; related: BlogPostSummary[] };

// fetch() cùng URL trong generateMetadata và page được Next gộp lại, chỉ gọi backend 1 lần.
const getPost = (slug: string) => blogFetch<PostResponse>(`/posts/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPost(slug);
  if (!data) return { title: "Không tìm thấy bài viết", robots: { index: false } };
  const { post } = data;
  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || stripHtml(post.content).slice(0, 160);
  return {
    title,
    description,
    keywords: post.tags,
    authors: [{ name: post.author.name }],
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      ...baseOpenGraph,
      type: "article",
      title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [post.author.name],
      section: post.category?.name,
      tags: post.tags,
      ...(post.coverImage ? { images: [{ url: post.coverImage, alt: post.title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    },
  };
}

// Gắn id cho các thẻ h2/h3 để làm mục lục + link neo (#muc-1). Nội dung đã được backend sanitize lúc lưu.
function addHeadingIds(html: string) {
  const toc: { id: string; text: string; level: number }[] = [];
  const used = new Set<string>();
  const out = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/g, (_, level, attrs, inner) => {
    const text = stripHtml(inner);
    if (!text) return `<h${level}${attrs}>${inner}</h${level}>`;
    let id = slugify(text) || "muc";
    let n = 2;
    while (used.has(id)) id = `${slugify(text) || "muc"}-${n++}`;
    used.add(id);
    toc.push({ id, text, level: Number(level) });
    return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, toc };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const data = await getPost(slug);
  if (!data) notFound();
  const { post, related } = data;
  const { html, toc } = addHeadingIds(post.content);
  const url = `${SITE_URL}/blog/${post.slug}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        headline: post.title,
        description: post.metaDescription || post.excerpt || undefined,
        // JSON-LD cần link tuyệt đối; ảnh đặt trong frontend/public lưu dạng /images/...
        image: post.coverImage ? (post.coverImage.startsWith('/') ? `${SITE_URL}${post.coverImage}` : post.coverImage) : undefined,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        author: {
          "@type": "Person",
          name: post.author.name,
          ...(post.author.authorSlug ? { url: `${SITE_URL}${authorHref(post.author.authorSlug)}` } : {}),
        },
        publisher: { "@type": "Organization", name: SITE_NAME, logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` } },
        mainEntityOfPage: url,
        inLanguage: "vi-VN",
        keywords: post.tags.join(", ") || undefined,
        articleSection: post.category?.name,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Trang chủ", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
          ...(post.category
            ? [{ "@type": "ListItem", position: 3, name: post.category.name, item: `${SITE_URL}${categoryHref(post.category.slug)}` }]
            : []),
          { "@type": "ListItem", position: post.category ? 4 : 3, name: post.title, item: url },
        ],
      },
    ],
  };

  return (
    <div className="flex-1">
      <BlogViewTracker slug={post.slug} />
      <BlogReadTracker slug={post.slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      <article className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <header className="max-w-3xl mx-auto">
          <nav aria-label="Breadcrumb" className="text-xs text-muted mb-3">
            <Link href="/" className="hover:text-primary">Trang chủ</Link> /{" "}
            <Link href="/blog" className="hover:text-primary">Blog</Link>
            {post.category && (
              <> / <Link href={categoryHref(post.category.slug)} className="hover:text-primary">{post.category.name}</Link></>
            )}
          </nav>
          <h1 data-blog-title className="text-3xl md:text-4xl font-black text-foreground leading-tight">{post.title}</h1>
          {post.excerpt && <p data-blog-excerpt className="mt-4 text-lg text-muted leading-relaxed">{post.excerpt}</p>}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-2">
              <AuthorAvatar name={post.author.name} authorSlug={post.author.authorSlug} hasAvatar={post.author.hasAvatar} />
              {post.author.authorSlug
                ? <Link href={authorHref(post.author.authorSlug)} className="font-semibold text-foreground hover:text-primary">{post.author.name}</Link>
                : <span className="font-semibold text-foreground">{post.author.name}</span>}
            </span>
            <span>·</span>
            <time dateTime={post.publishedAt ?? undefined}>{formatBlogDate(post.publishedAt)}</time>
            <span>·</span>
            <span>{post.readingMinutes} phút đọc</span>
            <span>·</span>
            <BlogPostStats slug={post.slug} views={post.views} clicks={post.clicks} />
          </div>
          {/* Nghe bài viết bằng giọng ElevenLabs (lỗi thì giọng trình duyệt) — đọc tiêu đề, tóm tắt rồi nội dung */}
          <BlogAudioPlayer slug={post.slug} wordCount={stripHtml(`${post.title} ${post.excerpt || ""} ${post.content}`).split(" ").length} />
        </header>

        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            width={1200}
            height={675}
            className="mt-8 w-full max-w-4xl mx-auto aspect-video object-cover rounded-2xl shadow-card"
          />
        )}

        <div className="mt-8 max-w-3xl mx-auto">
          {toc.length >= 3 && (
            <nav aria-label="Mục lục" className="ui-card p-5 mb-8">
              <p className="font-bold text-foreground mb-2">Mục lục</p>
              <ol className="space-y-1.5 text-sm">
                {toc.map((h) => (
                  <li key={h.id} className={h.level === 3 ? "pl-4" : ""}>
                    <a href={`#${h.id}`} className="text-primary hover:underline">{h.text}</a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div data-blog-content className="blog-content quill-content" dangerouslySetInnerHTML={{ __html: html }} />

          {post.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <Link key={t} href={`/blog?tag=${encodeURIComponent(t)}`} className="ui-chip text-sm">#{t}</Link>
              ))}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-line">
            <ShareButtons url={url} title={post.title} />
          </div>

          {/* Hộp giới thiệu tác giả — chỉ hiện thông tin giáo viên tự khai trong hồ sơ tác giả */}
          <div className="ui-card p-5 mt-8 flex gap-4 items-start">
            <AuthorAvatar name={post.author.name} authorSlug={post.author.authorSlug} hasAvatar={post.author.hasAvatar} size={56} />
            <div className="min-w-0">
              <p className="text-xs text-muted uppercase tracking-wide font-semibold">Tác giả</p>
              <p className="font-bold text-foreground text-lg leading-snug">{post.author.name}</p>
              {post.author.authorTitle && <p className="text-sm text-muted">{post.author.authorTitle}</p>}
              {post.author.authorBio && <p className="text-sm text-foreground mt-2 leading-relaxed line-clamp-4">{post.author.authorBio}</p>}
              {post.author.authorSlug && (
                <Link href={authorHref(post.author.authorSlug)} className="text-sm font-semibold text-primary hover:underline inline-block mt-2">
                  Xem tất cả bài viết →
                </Link>
              )}
            </div>
          </div>

          {/* CTA cuối bài — chỉ nhắc tính năng có thật (dùng thử 3 ngày), không số liệu/testimonial */}
          <div className="ui-hero mt-10 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xl font-bold">Luyện thi Tiếng Anh cùng Lucy Tutor</p>
              <p className="text-sm opacity-90 mt-1">Dùng thử miễn phí 3 ngày · Không cần thẻ tín dụng</p>
            </div>
            <Link href="/auth?role=STUDENT" className="btn-highlight shrink-0 text-center">Đăng ký miễn phí</Link>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 md:px-8 pb-12">
          <h2 className="ui-section-title mb-6">Bài viết liên quan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {related.map((p) => <PostCard key={p.id} post={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
