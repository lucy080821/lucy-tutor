import Link from "next/link";
import { type BlogPostSummary, authorHref, categoryHref, formatBlogDate } from "@/lib/blog";

// Thẻ bài viết trong lưới /blog và mục "Bài viết liên quan" — server component, không có JS phía client.
export default function PostCard({ post, large = false }: { post: BlogPostSummary; large?: boolean }) {
  return (
    <article className={`group ui-card ui-card-hover overflow-hidden flex flex-col ${large ? "lg:flex-row lg:col-span-full" : ""}`}>
      <Link href={`/blog/${post.slug}`} className={`block bg-primary-soft shrink-0 ${large ? "lg:w-1/2" : ""}`}>
        <img
          src={post.coverImage || "/images/thumbs/lesson.svg"}
          alt={post.title}
          width={640}
          height={360}
          loading="lazy"
          className="w-full aspect-video object-cover"
        />
      </Link>
      <div className={`p-5 flex flex-col gap-2 flex-1 ${large ? "lg:p-8 lg:justify-center" : ""}`}>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {post.featured && <span className="ui-badge ui-badge-new">Nổi bật</span>}
          {post.category && (
            <Link href={categoryHref(post.category.slug)} className="ui-badge hover:text-primary">
              {post.category.name}
            </Link>
          )}
        </div>
        <h2 className={`font-bold text-foreground leading-snug ${large ? "text-2xl md:text-3xl" : "text-lg"}`}>
          <Link href={`/blog/${post.slug}`} className="hover:text-primary transition-colors">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className={`text-muted text-sm leading-relaxed ${large ? "line-clamp-4" : "line-clamp-3"}`}>{post.excerpt}</p>
        )}
        {/* Nút đọc tiếp: thẻ nổi bật dùng nút cam (CTA nổi bật duy nhất), thẻ thường dùng link chữ.
            Mũi tên trượt sang phải khi rê chuột vào cả thẻ để kéo mắt người đọc về nút. */}
        {large ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link href={`/blog/${post.slug}`} aria-label={`Đọc tiếp: ${post.title}`} className="btn-highlight shadow-sm">
              Đọc tiếp bài viết
              <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>
            <span className="text-xs text-muted">Chỉ mất khoảng {post.readingMinutes} phút</span>
          </div>
        ) : (
          <Link
            href={`/blog/${post.slug}`}
            aria-label={`Đọc tiếp: ${post.title}`}
            className="mt-1 self-start inline-flex items-center gap-1.5 py-2 text-sm font-bold text-primary hover:underline underline-offset-4"
          >
            Đọc tiếp
            <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1">→</span>
          </Link>
        )}
        <p className="mt-auto pt-2 text-xs text-muted">
          {post.author.authorSlug
            ? <Link href={authorHref(post.author.authorSlug)} className="hover:text-primary">{post.author.name}</Link>
            : post.author.name}{" "}
          · {formatBlogDate(post.publishedAt)} · {post.readingMinutes} phút đọc
        </p>
      </div>
    </article>
  );
}
