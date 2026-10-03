import Link from "next/link";
import PostCard from "@/components/blog/PostCard";
import { blogFetch, categoryHref, type BlogCategory, type BlogPostSummary } from "@/lib/blog";

type ListResponse = { posts: BlogPostSummary[]; total: number; totalPages: number };

// Phần thân dùng chung của /blog, /blog/danh-muc/[slug], /blog/tac-gia/[slug]:
// chip danh mục → lưới bài → phân trang. Server component.
export default async function BlogListView({
  basePath,
  filter = {},
  page,
  q = "",
  tag = "",
  activeCategorySlug = "",
  showCategoryChips = true,
  emptyText = "Hãy quay lại sau — các bài chia sẻ mới sẽ sớm được đăng.",
}: {
  basePath: string;
  filter?: { category?: string; author?: string };
  page: number;
  q?: string;
  tag?: string;
  activeCategorySlug?: string;
  showCategoryChips?: boolean;
  emptyText?: string;
}) {
  const query = new URLSearchParams({ page: String(page), limit: "9" });
  if (filter.category) query.set("category", filter.category);
  if (filter.author) query.set("author", filter.author);
  if (tag) query.set("tag", tag);
  if (q) query.set("q", q);

  const [data, categories] = await Promise.all([
    blogFetch<ListResponse>(`/posts?${query}`),
    showCategoryChips ? blogFetch<BlogCategory[]>("/categories") : Promise.resolve(null),
  ]);
  const posts = data?.posts ?? [];
  const totalPages = data?.totalPages ?? 1;
  const visibleCategories = (categories ?? []).filter((c) => (c.postCount ?? 0) > 0);
  const highlightFirst = basePath === "/blog" && !q && !tag && page === 1;

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      {visibleCategories.length > 0 && (
        <nav aria-label="Danh mục" className="flex flex-wrap gap-2 mb-6">
          <Link href="/blog" className={`ui-chip ${!activeCategorySlug ? "ui-chip-active" : ""}`}>Tất cả</Link>
          {visibleCategories.map((c) => (
            <Link key={c.id} href={categoryHref(c.slug)} className={`ui-chip ${activeCategorySlug === c.slug ? "ui-chip-active" : ""}`}>
              {c.name} <span className="opacity-60">({c.postCount})</span>
            </Link>
          ))}
        </nav>
      )}

      {(q || tag) && (
        <p className="text-sm text-muted mb-4">
          {data?.total ?? 0} bài viết {q && <>cho từ khoá “<strong className="text-foreground">{q}</strong>”</>}
          {tag && <> gắn thẻ <strong className="text-foreground">#{tag}</strong></>} ·{" "}
          <Link href={basePath} className="text-primary font-semibold hover:underline">Xoá bộ lọc</Link>
        </p>
      )}

      {posts.length === 0 ? (
        <div className="ui-card p-10 text-center">
          <img src="/images/illustrations/empty-state.svg" alt="Chưa có bài viết" width={240} height={180} loading="lazy" className="mx-auto w-48 h-auto mb-4" />
          <p className="font-bold text-foreground">Chưa có bài viết nào</p>
          <p className="text-sm text-muted mt-1">
            {data ? emptyText : "Không tải được danh sách bài viết, vui lòng thử lại sau."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {posts.map((post, i) => (
            <PostCard key={post.id} post={post} large={highlightFirst && i === 0} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Phân trang" className="flex flex-wrap justify-center items-center gap-2 mt-8">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-outline">← Trước</Link>}
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={pageHref(p)}
              aria-current={p === page ? "page" : undefined}
              className={`ui-chip min-w-10 justify-center ${p === page ? "ui-chip-active" : ""}`}
            >
              {p}
            </Link>
          ))}
          {page < totalPages && <Link href={pageHref(page + 1)} className="btn-outline">Sau →</Link>}
        </nav>
      )}
    </div>
  );
}
