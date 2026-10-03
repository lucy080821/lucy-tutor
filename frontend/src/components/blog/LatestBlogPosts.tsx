"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL, formatBlogDate, type BlogPostSummary } from "@/lib/blog";

// 3 bài blog mới nhất, hiện trong tab Tổng Quan của dashboard học viên. Chưa có bài nào -> không hiện gì.
export default function LatestBlogPosts() {
  const [posts, setPosts] = useState<BlogPostSummary[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/blog/posts?limit=3`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.posts && setPosts(d.posts))
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  return (
    <div className="ui-card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="ui-section-title text-lg">Bài Viết Mới Từ Blog</h3>
          <p className="text-sm text-muted mt-2">Kinh nghiệm luyện thi và phương pháp học từ giáo viên Lucy Tutor</p>
        </div>
        <Link href="/blog" className="btn-outline text-sm shrink-0">Xem tất cả</Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {posts.map((p) => (
          <Link key={p.id} href={`/blog/${p.slug}`} className="group rounded-xl border border-line overflow-hidden hover:border-primary transition-colors flex flex-col">
            <img
              src={p.coverImage || "/images/thumbs/lesson.svg"}
              alt={p.title}
              width={640}
              height={360}
              loading="lazy"
              className="w-full aspect-video object-cover bg-primary-soft"
            />
            <div className="p-3 flex flex-col gap-1 flex-1">
              {p.category && <span className="text-[11px] font-semibold text-primary uppercase tracking-wide">{p.category.name}</span>}
              <p className="font-bold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary">{p.title}</p>
              <p className="text-xs text-muted mt-auto pt-1">{formatBlogDate(p.publishedAt)} · {p.readingMinutes} phút đọc</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
