"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { getSessionUserId } from "@/lib/session";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";
import { API_URL, authorHref, formatBlogDate, slugify, type BlogCategory, type BlogPostSummary } from "@/lib/blog";

type ManagedPost = BlogPostSummary & { status: "DRAFT" | "PENDING" | "PUBLISHED"; updatedAt: string };
type StatusFilter = "ALL" | "PENDING" | "PUBLISHED" | "SCHEDULED" | "DRAFT";
type BlogMe = {
  isAdmin: boolean;
  pendingCount: number;
  profile: { id: string; name: string; authorSlug: string | null; authorTitle: string | null; authorBio: string | null };
};

const PAGE_SIZE = 10;

function postState(p: ManagedPost): Exclude<StatusFilter, "ALL"> {
  if (p.status === "PENDING") return "PENDING";
  if (p.status !== "PUBLISHED") return "DRAFT";
  return p.publishedAt && new Date(p.publishedAt) > new Date() ? "SCHEDULED" : "PUBLISHED";
}

const STATE_BADGE: Record<Exclude<StatusFilter, "ALL">, { label: string; cls: string }> = {
  PENDING: { label: "Chờ duyệt", cls: "bg-blue-50 text-blue-700" },
  PUBLISHED: { label: "Đã đăng", cls: "bg-emerald-50 text-emerald-700" },
  SCHEDULED: { label: "Hẹn giờ", cls: "bg-amber-50 text-amber-700" },
  DRAFT: { label: "Bản nháp", cls: "bg-slate-100 text-slate-600" },
};

export default function TeacherBlogPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<ManagedPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [me, setMe] = useState<BlogMe | null>(null);
  const [profile, setProfile] = useState({ authorSlug: "", authorTitle: "", authorBio: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async (uid: string) => {
    setLoading(true);
    try {
      const [postsRes, catsRes, meRes] = await Promise.all([
        fetch(`${API_URL}/api/blog/manage/posts?userId=${uid}`),
        fetch(`${API_URL}/api/blog/categories`),
        fetch(`${API_URL}/api/blog/manage/me?userId=${uid}`),
      ]);
      if (postsRes.ok) setPosts(await postsRes.json());
      if (catsRes.ok) setCategories(await catsRes.json());
      if (meRes.ok) {
        const m: BlogMe = await meRes.json();
        setMe(m);
        setProfile({
          authorSlug: m.profile.authorSlug || slugify(m.profile.name),
          authorTitle: m.profile.authorTitle || "",
          authorBio: m.profile.authorBio || "",
        });
        // Admin có bài chờ duyệt -> mở sẵn bộ lọc Chờ duyệt
        if (m.isAdmin && m.pendingCount > 0) setStatusFilter("PENDING");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/auth?role=TEACHER"); return; }
    fetch(`${API_URL}/api/auth/me?userId=${uid}`)
      .then((r) => r.json())
      .then((u) => {
        if (u?.id && u.role !== "TEACHER") { router.replace("/dashboard"); return; }
        setUserId(uid);
        load(uid);
      })
      .catch(() => setLoading(false));
  }, [router, load]);

  const counts = useMemo(() => {
    const c = { ALL: posts.length, PENDING: 0, PUBLISHED: 0, SCHEDULED: 0, DRAFT: 0 };
    posts.forEach((p) => { c[postState(p)]++; });
    return c;
  }, [posts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter((p) =>
      (statusFilter === "ALL" || postState(p) === statusFilter) &&
      (!q || p.title.toLowerCase().includes(q) || p.slug.includes(q))
    );
  }, [posts, search, statusFilter]);
  const pagination = usePagination(filtered, PAGE_SIZE, `${search}|${statusFilter}`);

  const deletePost = async (post: ManagedPost) => {
    const ok = await Swal.fire({
      title: "Xoá bài viết?",
      html: `Bài <b>${post.title.replace(/</g, "&lt;")}</b> sẽ bị xoá vĩnh viễn, link <code>/blog/${post.slug}</code> sẽ không còn truy cập được.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xoá",
      cancelButtonText: "Huỷ",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed || !userId) return;
    const res = await fetch(`${API_URL}/api/blog/manage/posts/${post.id}?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
    } else {
      Swal.fire("Lỗi", (await res.json().catch(() => ({}))).error || "Không xoá được bài viết", "error");
    }
  };

  const deleteCategory = async (cat: BlogCategory) => {
    const ok = await Swal.fire({
      title: `Xoá danh mục "${cat.name}"?`,
      text: "Các bài trong danh mục này sẽ chuyển về \"Chưa phân loại\" (không bị xoá).",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xoá",
      cancelButtonText: "Huỷ",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed || !userId) return;
    const res = await fetch(`${API_URL}/api/blog/manage/categories/${cat.id}?userId=${userId}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setPosts((prev) => prev.map((p) => (p.category?.id === cat.id ? { ...p, category: null } : p)));
    }
  };

  const saveProfile = async () => {
    if (!userId) return;
    setSavingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/blog/manage/author-profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, ...profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không lưu được hồ sơ");
      setMe((m) => (m ? { ...m, profile: data } : m));
      setProfile({ authorSlug: data.authorSlug, authorTitle: data.authorTitle || "", authorBio: data.authorBio || "" });
      Swal.fire({ title: "Đã lưu hồ sơ tác giả", icon: "success", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire("Lỗi", err instanceof Error ? err.message : "Không lưu được hồ sơ", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  const visibleFilters: StatusFilter[] = me?.isAdmin || counts.PENDING > 0
    ? ["ALL", "PENDING", "PUBLISHED", "SCHEDULED", "DRAFT"]
    : ["ALL", "PUBLISHED", "SCHEDULED", "DRAFT"];

  return (
    <div className="flex-1">
      <section className="bg-primary-soft">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <nav className="text-xs text-muted mb-2">
              <Link href="/teacher" className="hover:text-primary">Bảng điều khiển</Link> / <span>Blog</span>
            </nav>
            <h1 className="ui-page-title">Quản Lý Blog</h1>
            <p className="ui-page-subtitle mt-1">
              {me && !me.isAdmin
                ? "Viết bài chia sẻ — bài sẽ được admin blog duyệt trước khi hiện công khai."
                : "Viết, chỉnh sửa, duyệt và đăng bài chia sẻ lên trang Blog công khai."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/blog" target="_blank" className="btn-outline">Xem trang Blog</Link>
            <Link href="/teacher/blog/editor" className="btn-primary">+ Viết Bài Mới</Link>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="ui-card p-4 md:p-6 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {visibleFilters.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`ui-chip cursor-pointer ${statusFilter === s ? "ui-chip-active" : ""}`}
                >
                  {s === "ALL" ? "Tất cả" : STATE_BADGE[s].label} ({counts[s]})
                </button>
              ))}
            </div>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên bài / link..."
              className="ui-input md:w-64"
            />
          </div>

          {loading ? (
            <p className="text-muted text-sm py-10 text-center">Đang tải...</p>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-bold text-foreground">{posts.length === 0 ? "Bạn chưa có bài viết nào" : "Không có bài viết phù hợp"}</p>
              {posts.length === 0 && (
                <Link href="/teacher/blog/editor" className="btn-primary inline-flex mt-4">Viết bài đầu tiên</Link>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="ui-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Bài viết</th>
                      <th className="text-left hidden md:table-cell">Danh mục</th>
                      <th className="text-left">Trạng thái</th>
                      <th className="text-right hidden sm:table-cell">Lượt xem</th>
                      <th className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagination.pageItems.map((p) => {
                      const state = postState(p);
                      return (
                        <tr key={p.id}>
                          <td className="min-w-[220px]">
                            <Link href={`/teacher/blog/editor?id=${p.id}`} className="font-semibold text-foreground hover:text-primary">
                              {p.featured && <span className="ui-badge ui-badge-new mr-1.5 align-middle">Nổi bật</span>}
                              {p.title}
                            </Link>
                            <p className="text-xs text-muted mt-0.5 break-all">/blog/{p.slug}</p>
                            <p className="text-xs text-muted">{p.author.name}</p>
                          </td>
                          <td className="hidden md:table-cell text-muted">{p.category?.name || "—"}</td>
                          <td>
                            <span className={`ui-badge ${STATE_BADGE[state].cls}`}>{STATE_BADGE[state].label}</span>
                            {p.publishedAt && state !== "DRAFT" && (
                              <p className="text-xs text-muted mt-1">{formatBlogDate(p.publishedAt)}</p>
                            )}
                          </td>
                          <td className="text-right hidden sm:table-cell">{p.views.toLocaleString("vi-VN")}</td>
                          <td className="text-right whitespace-nowrap">
                            <Link href={`/teacher/blog/editor?id=${p.id}`} className="btn-ghost text-sm">Sửa</Link>
                            {state === "PUBLISHED" && (
                              <Link href={`/blog/${p.slug}`} target="_blank" className="btn-ghost text-sm">Xem</Link>
                            )}
                            <button onClick={() => deletePost(p)} className="btn-ghost text-sm text-red-600 cursor-pointer">Xoá</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Pagination
                  page={pagination.page}
                  totalPages={pagination.totalPages}
                  onPageChange={pagination.setPage}
                  totalItems={pagination.totalItems}
                  pageSize={PAGE_SIZE}
                />
              </div>
            </>
          )}
        </div>

        <div className="space-y-6">
        <section id="ho-so-tac-gia" className="ui-card p-5 space-y-3 scroll-mt-24">
          <h2 className="font-bold text-foreground">Hồ sơ tác giả</h2>
          <p className="text-xs text-muted">Hiện ở cuối mỗi bài viết và trang tác giả riêng. Ảnh đại diện lấy theo avatar tài khoản.</p>
          <div>
            <label htmlFor="author-title" className="ui-label">Chức danh</label>
            <input id="author-title" value={profile.authorTitle} onChange={(e) => setProfile((p) => ({ ...p, authorTitle: e.target.value }))}
              maxLength={100} placeholder="VD: Giáo viên Tiếng Anh" className="ui-input w-full" />
          </div>
          <div>
            <label htmlFor="author-bio" className="ui-label">Giới thiệu ngắn</label>
            <textarea id="author-bio" value={profile.authorBio} onChange={(e) => setProfile((p) => ({ ...p, authorBio: e.target.value }))}
              rows={4} maxLength={1000} placeholder="Kinh nghiệm giảng dạy, chứng chỉ, lĩnh vực chia sẻ..." className="ui-input w-full resize-y" />
          </div>
          <div>
            <label htmlFor="author-slug" className="ui-label">Link trang tác giả</label>
            <div className="flex items-center rounded-xl border border-line-strong overflow-hidden focus-within:border-primary">
              <span className="px-2 text-xs text-muted bg-slate-50 self-stretch flex items-center border-r border-line-strong">/blog/tac-gia/</span>
              <input id="author-slug" value={profile.authorSlug} onChange={(e) => setProfile((p) => ({ ...p, authorSlug: e.target.value }))}
                onBlur={() => setProfile((p) => ({ ...p, authorSlug: slugify(p.authorSlug) }))} className="flex-1 min-w-0 px-2 py-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={saveProfile} disabled={savingProfile} className="btn-primary text-sm cursor-pointer disabled:opacity-60">
              {savingProfile ? "Đang lưu..." : "Lưu hồ sơ"}
            </button>
            {me?.profile.authorSlug && (
              <Link href={authorHref(me.profile.authorSlug)} target="_blank" className="btn-ghost text-sm">Xem trang tác giả</Link>
            )}
          </div>
        </section>

        <aside className="ui-card p-5 h-fit">
          <h2 className="font-bold text-foreground mb-1">Danh mục</h2>
          <p className="text-xs text-muted mb-3">Thêm danh mục mới ngay trong lúc soạn bài.</p>
          {categories.length === 0 ? (
            <p className="text-sm text-muted">Chưa có danh mục nào.</p>
          ) : (
            <ul className="space-y-1">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm py-1">
                  <span className="truncate">
                    {c.name} <span className="text-muted">({c.postCount ?? 0})</span>
                  </span>
                  {me?.isAdmin && <button
                    onClick={() => deleteCategory(c)}
                    aria-label={`Xoá danh mục ${c.name}`}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-600 cursor-pointer shrink-0"
                  >
                    ×
                  </button>}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-muted mt-3">Số trong ngoặc = số bài đã đăng công khai.</p>
        </aside>
        </div>
      </div>
    </div>
  );
}
