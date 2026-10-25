"use client";
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminFetch, AdminAuthError, type SocialComment, type SocialCommentPlatform, type SocialCommentsPage } from "@/lib/adminApi";
import Pagination from "@/components/Pagination";
import { ErrorBlock, LoadingBlock, SectionCard } from "./ui";

// Theo dõi bình luận YouTube + Facebook (đồng bộ cùng số liệu mỗi 20 phút — backend/src/utils/social/comments.js).
// TikTok không có: Display API không trả nội dung bình luận.

const REFRESH_MS = 30_000;
const nf = (n: number) => n.toLocaleString("vi-VN");

type PlatformFilter = SocialCommentPlatform | "ALL";
type StatusFilter = "open" | "handled" | "all";
const PLATFORM_LABEL: Record<SocialCommentPlatform, string> = { YOUTUBE: "YouTube", FACEBOOK: "Facebook" };
const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: "open", label: "Cần phản hồi" }, { id: "handled", label: "Đã xử lý" }, { id: "all", label: "Tất cả" },
];

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins || 1} phút trước`;
  if (mins < 1440) return `${Math.floor(mins / 60)} giờ trước`;
  if (mins < 43_200) return `${Math.floor(mins / 1440)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

export default function SocialComments({ onAuthLost }: { onAuthLost: () => void }) {
  const [platform, setPlatform] = useState<PlatformFilter>("ALL");
  const [status, setStatus] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SocialCommentsPage | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else setError((err as Error).message);
  }, [onAuthLost]);

  // Gõ tìm kiếm: chờ 400ms rồi mới gọi, và về trang 1
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ status, page: String(page) });
    if (platform !== "ALL") params.set("platform", platform);
    if (q) params.set("q", q);
    adminFetch<SocialCommentsPage>(`/social/comments?${params}`)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) fail(err); });
    return () => { cancelled = true; };
  }, [platform, status, q, page, tick, fail]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const timer = setInterval(() => { if (document.visibilityState === "visible") bump(); }, REFRESH_MS);
    document.addEventListener("visibilitychange", bump);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", bump); };
  }, []);

  const mark = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await adminFetch("/social/comments/handled", { method: "POST", body: JSON.stringify(body) });
      setTick((t) => t + 1);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không cập nhật được", (err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };

  const markAll = async () => {
    const r = await Swal.fire({
      title: "Đánh dấu đã xử lý?",
      text: `Tất cả bình luận đang chờ${platform === "ALL" ? "" : ` trên ${PLATFORM_LABEL[platform]}`} sẽ chuyển sang "Đã xử lý".`,
      icon: "question", showCancelButton: true, confirmButtonText: "Đánh dấu", cancelButtonText: "Huỷ",
    });
    if (r.isConfirmed) mark({ all: true, ...(platform !== "ALL" ? { platform } : {}) });
  };

  const openTotal = data ? data.open.YOUTUBE + data.open.FACEBOOK : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-6">
      <SectionCard title="Bình luận" subtitle="YouTube và Facebook. TikTok không cho đọc nội dung bình luận qua API nên không có ở đây."
        actions={status === "open" && openTotal > 0 ? <button onClick={markAll} disabled={busy} className="btn-outline px-4 py-2 text-sm cursor-pointer">Đánh dấu tất cả đã xử lý</button> : undefined}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Nền tảng">
            {(["ALL", "YOUTUBE", "FACEBOOK"] as PlatformFilter[]).map((p) => (
              <button key={p} onClick={() => { setPlatform(p); setPage(1); }} aria-pressed={p === platform}
                className={`ui-chip cursor-pointer ${p === platform ? "ui-chip-active" : ""}`}>
                {p === "ALL" ? "Tất cả" : PLATFORM_LABEL[p]}
                {data && status === "open" && <span className="ml-1.5 opacity-70">{nf(p === "ALL" ? openTotal : data.open[p])}</span>}
              </button>
            ))}
          </div>
          <span className="w-px h-6 bg-line mx-1 hidden sm:block" aria-hidden="true" />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Trạng thái">
            {STATUS_OPTIONS.map((s) => (
              <button key={s.id} onClick={() => { setStatus(s.id); setPage(1); }} aria-pressed={s.id === status}
                className={`ui-chip cursor-pointer ${s.id === status ? "ui-chip-active" : ""}`}>{s.label}</button>
            ))}
          </div>
          <label className="sr-only" htmlFor="social-comment-search">Tìm bình luận</label>
          <input id="social-comment-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo nội dung, người viết, video..."
            className="ui-input !w-full sm:!w-72 sm:ml-auto !py-2 text-sm" />
        </div>
      </SectionCard>

      {error ? <ErrorBlock message={error} onRetry={() => { setError(""); setTick((t) => t + 1); }} />
        : !data ? <LoadingBlock />
        : !data.items.length ? (
          <SectionCard title={status === "open" ? "Không có bình luận cần phản hồi" : "Không có bình luận phù hợp"}>
            <p className="text-sm text-muted">Bình luận mới được đồng bộ cùng số liệu mỗi 20 phút. Nếu mới kết nối, vào tab số liệu của nền tảng và bấm &ldquo;Đồng bộ ngay&rdquo;; khung vàng ở đó sẽ cho biết nền tảng có đang từ chối đọc bình luận hay không (Facebook cần quyền <code>pages_read_user_content</code>).</p>
          </SectionCard>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-3">
              {data.items.map((c) => <CommentRow key={c.id} c={c} busy={busy} onToggle={() => mark({ ids: [c.id], handled: !c.handled })} />)}
            </ul>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} totalItems={data.total} pageSize={data.pageSize} />
          </div>
        )}
    </div>
  );
}

function CommentRow({ c, busy, onToggle }: { c: SocialComment; busy: boolean; onToggle: () => void }) {
  return (
    <li className={`ui-card p-4 min-w-0 ${c.handled ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        {c.authorAvatar
          ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={c.authorAvatar} alt="" width={36} height={36} loading="lazy" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover bg-primary-soft shrink-0" />
          : <span aria-hidden="true" className="w-9 h-9 rounded-full bg-primary-soft text-primary font-bold flex items-center justify-center shrink-0">{(c.authorName || "?").charAt(0).toUpperCase()}</span>}
        <div className="min-w-0 flex-1">
          <p className="text-sm flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-foreground break-words">{c.authorName || "Ẩn danh"}</b>
            <span className="ui-badge">{PLATFORM_LABEL[c.platform]}</span>
            {c.isReply && <span className="ui-badge">Trả lời</span>}
            {c.isOwner && <span className="ui-badge-new">Kênh của bạn</span>}
            <span className="text-xs text-muted">{timeAgo(c.publishedAt)}</span>
          </p>
          <p className="mt-1.5 text-sm text-foreground whitespace-pre-line break-words">{c.text || "(Không có nội dung — Facebook chưa cấp quyền đọc)"}</p>
          <p className="mt-2 text-xs text-muted flex flex-wrap items-center gap-x-3 gap-y-1">
            {c.likes > 0 && <span>{nf(c.likes)} thích</span>}
            {c.replyCount > 0 && <span>{nf(c.replyCount)} trả lời</span>}
            {c.itemUrl
              ? <a href={c.itemUrl} target="_blank" rel="noopener noreferrer" className="hover:text-primary underline-offset-2 hover:underline min-w-0 truncate max-w-full">Trên: {c.itemTitle || "nội dung gốc"}</a>
              : <span className="truncate">Trên: {c.itemTitle || "nội dung gốc"}</span>}
          </p>
        </div>
        {!c.isOwner && (
          <button onClick={onToggle} disabled={busy} className="btn-outline px-3 py-2 text-xs cursor-pointer shrink-0 whitespace-nowrap">
            {c.handled ? "Bỏ đánh dấu" : "Đã xử lý"}
          </button>
        )}
      </div>
    </li>
  );
}
