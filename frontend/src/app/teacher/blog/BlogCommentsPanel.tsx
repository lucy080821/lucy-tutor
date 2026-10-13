"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import Pagination from "@/components/Pagination";
import { API_URL } from "@/lib/blog";

// Duyệt bình luận ở /teacher/blog: bình luận trên bài của mình (admin blog: mọi bài).
// Bình luận của khách mặc định chờ duyệt — xem backend/src/routes/blogComments.routes.js.

type ManagedComment = {
  id: string;
  content: string;
  status: "APPROVED" | "PENDING";
  createdAt: string;
  isReply: boolean;
  replyToName: string | null;
  author: { name: string; role: "STUDENT" | "TEACHER" | "GUEST"; guestEmail: string | null };
  post: { title: string; slug: string };
};
type Filter = "PENDING" | "ALL";

const PAGE_SIZE = 20;
const REFRESH_MS = 30_000;
const ROLE_LABEL = { STUDENT: "Học viên", TEACHER: "Giáo viên", GUEST: "Khách" } as const;

export default function BlogCommentsPanel({ userId }: { userId: string }) {
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [page, setPage] = useState(1);
  const [comments, setComments] = useState<ManagedComment[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.hidden) return;
      const qs = new URLSearchParams({ userId, status: filter === "ALL" ? "ALL" : "PENDING", page: String(page) });
      fetch(`${API_URL}/api/blog-comments/manage/list?${qs}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!alive || !data) return;
          setComments(data.comments);
          setTotal(data.total);
          setTotalPages(data.totalPages);
          setPendingCount(data.pendingCount);
        })
        .catch(() => { /* mất mạng — giữ danh sách cũ */ })
        .finally(() => { if (alive) setLoading(false); });
    };
    refresh();
    // Tự làm mới định kỳ + khi tab lấy lại focus (polling, không WebSocket)
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [userId, filter, page]);

  const changeFilter = (f: Filter) => { setFilter(f); setPage(1); };

  const approve = async (c: ManagedComment) => {
    const res = await fetch(`${API_URL}/api/blog-comments/${c.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) { Swal.fire({ icon: "error", title: "Không duyệt được", text: (await res.json().catch(() => ({}))).error }); return; }
    setPendingCount((n) => Math.max(0, n - 1));
    if (filter === "PENDING") {
      setComments((list) => list.filter((x) => x.id !== c.id));
      setTotal((n) => Math.max(0, n - 1));
    } else {
      setComments((list) => list.map((x) => (x.id === c.id ? { ...x, status: "APPROVED" } : x)));
    }
  };

  const remove = async (c: ManagedComment) => {
    const ok = await Swal.fire({
      title: "Xoá bình luận?",
      text: c.status === "PENDING" ? "Bình luận chờ duyệt sẽ bị xoá, không hiện công khai." : "Bình luận sẽ bị gỡ khỏi bài viết.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xoá",
      cancelButtonText: "Huỷ",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`${API_URL}/api/blog-comments/${c.id}?userId=${userId}`, { method: "DELETE" });
    if (!res.ok) { Swal.fire({ icon: "error", title: "Không xoá được", text: (await res.json().catch(() => ({}))).error }); return; }
    setComments((list) => list.filter((x) => x.id !== c.id));
    setTotal((n) => Math.max(0, n - 1));
    if (c.status === "PENDING") setPendingCount((n) => Math.max(0, n - 1));
  };

  return (
    <section className="ui-card p-4 md:p-6 mt-6" aria-labelledby="blog-comments-title">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 id="blog-comments-title" className="ui-section-title text-lg">Bình Luận</h2>
          <p className="text-xs text-muted mt-2">
            Bình luận của khách (chưa đăng nhập) và bình luận có link của học viên cần được duyệt trước khi hiện công khai.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => changeFilter("PENDING")} className={`ui-chip text-sm cursor-pointer ${filter === "PENDING" ? "ui-chip-active" : ""}`}>
            Chờ duyệt{pendingCount > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-red-600 text-white text-[11px] font-bold">{pendingCount}</span>}
          </button>
          <button type="button" onClick={() => changeFilter("ALL")} className={`ui-chip text-sm cursor-pointer ${filter === "ALL" ? "ui-chip-active" : ""}`}>
            Tất cả
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Đang tải...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted py-4 text-center">
          {filter === "PENDING" ? "Không có bình luận nào đang chờ duyệt." : "Chưa có bình luận nào."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {comments.map((c) => (
            <li key={c.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold text-foreground">{c.author.name}</span>
                  <span className="ui-badge text-[11px] bg-slate-100 text-slate-600">{ROLE_LABEL[c.author.role]}</span>
                  {c.status === "PENDING" && <span className="ui-badge text-[11px] bg-amber-50 text-amber-700">Chờ duyệt</span>}
                  {c.author.guestEmail && <span className="text-xs text-muted break-all">{c.author.guestEmail}</span>}
                  <span className="text-xs text-muted">· {new Date(c.createdAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</span>
                </div>
                <p className="mt-1 text-sm text-foreground whitespace-pre-wrap break-words line-clamp-4">
                  {c.replyToName && <span className="font-semibold text-primary">@{c.replyToName} </span>}
                  {c.content}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {c.isReply ? "Trả lời trong bài " : "Trong bài "}
                  <Link href={`/blog/${c.post.slug}#binh-luan`} target="_blank" className="text-primary hover:underline">{c.post.title}</Link>
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {c.status === "PENDING" && (
                  <button type="button" onClick={() => approve(c)} className="btn-primary text-sm cursor-pointer">Duyệt</button>
                )}
                <button type="button" onClick={() => remove(c)} className="btn-outline text-sm cursor-pointer hover:!text-red-600 hover:!border-red-300">Xoá</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-4">
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={total} pageSize={PAGE_SIZE} />
        </div>
      )}
    </section>
  );
}
