"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/blog";
import { getSessionUserId } from "@/lib/session";

// Bình luận dưới bài blog (backend: /api/blog-comments, xem blogComments.routes.js).
// - Đã đăng nhập: gửi kèm userId, bình luận hiện ngay dưới tên tài khoản.
// - Khách: nhập tên (+ email tuỳ chọn), mặc định chờ duyệt. Trình duyệt giữ 1 mã khách ngẫu nhiên (VISITOR_KEY)
//   để khách tự xoá bình luận của mình, thấy bình luận đang chờ duyệt, và thả emoji.
// Trả lời 1 cấp (kiểu Facebook); emoji thả kiểu GitHub (mỗi người bật/tắt từng emoji).
// Làm mới định kỳ 30s khi tab đang mở (polling như BlogStats, không WebSocket).

type Role = "STUDENT" | "TEACHER" | "GUEST";
type Reaction = { emoji: string; count: number; mine: boolean };
type CommentItem = {
  id: string;
  parentId: string | null;
  replyToName: string | null;
  status: "APPROVED" | "PENDING" | "DELETED";
  createdAt: string;
  content: string;
  author: { name: string; role: Role; isPostAuthor: boolean; hasAvatar: boolean } | null;
  reactions: Reaction[];
  mine: boolean;
  guestEmail?: string;
  replies?: CommentItem[];
};
type CommentsResponse = {
  comments: CommentItem[];
  total: number;
  canModerate: boolean;
  guestMode: "open" | "moderate" | "off";
  emojis: string[];
  viewer: { name: string; role: Role; hasAvatar: boolean } | null;
  invalidSession: boolean;
};

const VISITOR_KEY = "lucy_blog_visitor";
const GUEST_KEY = "lucy_blog_guest";
const REFRESH_MS = 30_000;
const ROOTS_STEP = 10;
const REPLIES_PREVIEW = 3;
const MAX_CONTENT = 2000;
// Emoji chèn vào nội dung bình luận (khác bộ emoji "thả" do server quy định)
const INSERT_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "🥰", "😎", "🤔", "😅", "😢", "😭",
  "😮", "😡", "👍", "👏", "🙏", "💪", "❤️", "🔥", "🎉", "✨", "💯", "📚",
];

let memoryVisitorId: string | null = null;
function getVisitorId(): string {
  const make = () => (typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9-]{16,64}$/.test(id)) {
      id = make();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Storage bị chặn (ẩn danh / chặn cookie) — mã chỉ sống tới khi tải lại trang
    if (!memoryVisitorId) memoryVisitorId = make();
    return memoryVisitorId;
  }
}

function loadGuest(): { name: string; email: string } {
  try {
    const v = JSON.parse(localStorage.getItem(GUEST_KEY) || "{}");
    return { name: String(v.name || ""), email: String(v.email || "") };
  } catch {
    return { name: "", email: "" };
  }
}

function saveGuest(g: { name: string; email: string }) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(g)); } catch { /* bỏ qua */ }
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
}

const ROLE_BADGE: Record<Role, { label: string; cls: string } | null> = {
  TEACHER: { label: "Giáo viên", cls: "bg-primary-soft text-primary" },
  STUDENT: { label: "Học viên", cls: "bg-emerald-50 text-emerald-700" },
  GUEST: null,
};

function SmileIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c.9 1.2 2.1 1.8 3.5 1.8s2.6-.6 3.5-1.8" />
      <circle cx="9" cy="10" r=".6" fill="currentColor" />
      <circle cx="15" cy="10" r=".6" fill="currentColor" />
    </svg>
  );
}

function Avatar({ comment, size = 36 }: { comment: CommentItem; size?: number }) {
  const name = comment.author?.name || "?";
  if (comment.author?.hasAvatar) {
    return (
      <img
        src={`${API_URL}/api/blog-comments/${comment.id}/avatar`}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover shrink-0 bg-primary-soft"
        style={{ width: size, height: size }}
      />
    );
  }
  const guest = !comment.author || comment.author.role === "GUEST";
  return (
    <span
      aria-hidden
      className={`rounded-full font-bold flex items-center justify-center shrink-0 ${guest ? "bg-slate-200 text-slate-600" : "bg-primary text-white"}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

// Ô soạn bình luận / trả lời — dùng chung cho cả 2
function Composer({
  data, slug, userId, parentId, replyTo, autoFocus, onPosted, onCancel,
}: {
  data: CommentsResponse;
  slug: string;
  userId: string | null;
  parentId?: string;
  replyTo?: string;
  autoFocus?: boolean;
  onPosted: (c: CommentItem, pending: boolean) => void;
  onCancel?: () => void;
}) {
  const [text, setText] = useState("");
  // Composer chỉ render phía client (sau khi tải xong bình luận) nên đọc localStorage ngay lúc khởi tạo được
  const [guest, setGuest] = useState(loadGuest);
  const [website, setWebsite] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const isGuest = !data.viewer;

  useEffect(() => { if (autoFocus) areaRef.current?.focus(); }, [autoFocus]);

  const insertEmoji = (e: string) => {
    const el = areaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + e + text.slice(end)).slice(0, MAX_CONTENT);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + e.length, start + e.length);
    });
  };

  const submit = async () => {
    if (sending) return;
    setError("");
    setNotice("");
    if (text.trim().length < 2) { setError("Bình luận quá ngắn."); return; }
    if (isGuest && guest.name.trim().length < 2) { setError("Vui lòng nhập tên của bạn."); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/blog-comments/post/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          parentId,
          userId: userId || undefined,
          visitorId: getVisitorId(),
          ...(isGuest ? { guestName: guest.name.trim(), guestEmail: guest.email.trim(), website } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || "Không gửi được bình luận, vui lòng thử lại."); return; }
      if (isGuest) saveGuest({ name: guest.name.trim(), email: guest.email.trim() });
      setText("");
      setShowEmoji(false);
      if (body.comment) onPosted(body.comment, body.pending);
      if (body.pending) setNotice("Cảm ơn bạn! Bình luận sẽ hiện công khai sau khi được giáo viên duyệt.");
    } catch {
      setError("Mất kết nối, vui lòng thử lại.");
    } finally {
      setSending(false);
    }
  };

  if (isGuest && data.guestMode === "off") {
    return (
      <div className="rounded-xl border border-line bg-slate-50 p-4 text-sm text-muted">
        Vui lòng{" "}
        <Link href={`/auth?role=STUDENT&next=${encodeURIComponent(`/blog/${slug}#binh-luan`)}`} className="font-semibold text-primary hover:underline">
          đăng nhập
        </Link>{" "}
        để bình luận.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isGuest && !parentId && (
        <p className="text-xs text-muted">
          Bạn đang bình luận với tư cách khách
          {data.guestMode === "moderate" ? " — bình luận sẽ hiện sau khi được duyệt" : ""}.{" "}
          <Link href={`/auth?role=STUDENT&next=${encodeURIComponent(`/blog/${slug}#binh-luan`)}`} className="font-semibold text-primary hover:underline">
            Đăng nhập
          </Link>{" "}
          để bình luận ngay bằng tài khoản Lucy Tutor.
        </p>
      )}
      {isGuest && (
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={guest.name}
            onChange={(e) => setGuest((g) => ({ ...g, name: e.target.value }))}
            maxLength={50}
            placeholder="Tên của bạn *"
            aria-label="Tên của bạn"
            className="ui-input w-full"
          />
          <input
            type="email"
            value={guest.email}
            onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
            maxLength={100}
            placeholder="Email (không hiển thị công khai)"
            aria-label="Email, không bắt buộc"
            className="ui-input w-full"
          />
        </div>
      )}
      {/* Ô ẩn chống bot — người thật không thấy */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="absolute -left-[9999px] w-px h-px opacity-0"
      />
      <div className="relative">
        <textarea
          ref={areaRef}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX_CONTENT))}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); } }}
          rows={parentId ? 2 : 3}
          placeholder={replyTo ? `Trả lời ${replyTo}...` : data.viewer ? `Bình luận với tên ${data.viewer.name}...` : "Chia sẻ suy nghĩ của bạn..."}
          aria-label={replyTo ? `Trả lời ${replyTo}` : "Nội dung bình luận"}
          className="ui-input w-full resize-y pr-12 min-h-[72px]"
        />
        <button
          type="button"
          onClick={() => setShowEmoji((v) => !v)}
          aria-label="Chèn emoji"
          aria-expanded={showEmoji}
          className="absolute right-2 bottom-3 w-9 h-9 flex items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-primary cursor-pointer"
        >
          <SmileIcon className="w-5 h-5" />
        </button>
        {showEmoji && (
          <>
            <button type="button" aria-label="Đóng bảng emoji" className="fixed inset-0 z-10 cursor-default" onClick={() => setShowEmoji(false)} />
            <div className="absolute right-0 bottom-full mb-2 z-20 ui-card p-2 grid grid-cols-8 gap-1 w-[296px] max-w-[calc(100vw-48px)]">
              {INSERT_EMOJIS.map((e) => (
                <button key={e} type="button" onClick={() => insertEmoji(e)} className="w-8 h-8 text-xl rounded-lg hover:bg-primary-soft cursor-pointer">
                  {e}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      {notice && <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2" role="status">{notice}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{text.length}/{MAX_CONTENT} · Ctrl+Enter để gửi</span>
        <div className="flex gap-2">
          {onCancel && <button type="button" onClick={onCancel} className="btn-ghost text-sm cursor-pointer">Huỷ</button>}
          <button type="button" onClick={submit} disabled={sending} className="btn-primary text-sm cursor-pointer disabled:opacity-60">
            {sending ? "Đang gửi..." : parentId ? "Trả lời" : "Gửi bình luận"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReactionBar({
  comment, emojis, onToggle,
}: { comment: CommentItem; emojis: string[]; onToggle: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  if (comment.status !== "APPROVED") return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {comment.reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={() => onToggle(r.emoji)}
          aria-pressed={r.mine}
          aria-label={`${r.emoji} ${r.count}${r.mine ? ", bấm để bỏ" : ""}`}
          className={`h-8 px-2.5 rounded-full border text-sm flex items-center gap-1 cursor-pointer transition-colors ${
            r.mine ? "border-primary bg-primary-soft text-primary font-semibold" : "border-line bg-white hover:border-line-strong"
          }`}
        >
          <span>{r.emoji}</span>
          <span className="tabular-nums">{r.count}</span>
        </button>
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Thả cảm xúc"
          aria-expanded={open}
          className="h-8 w-9 rounded-full border border-line bg-white text-muted hover:text-primary hover:border-primary flex items-center justify-center cursor-pointer"
        >
          <SmileIcon />
          <span className="text-[10px] font-bold -ml-0.5">+</span>
        </button>
        {open && (
          <>
            <button type="button" aria-label="Đóng" className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
            <div className="absolute left-0 bottom-full mb-2 z-20 ui-card px-2 py-1.5 flex gap-1 rounded-full">
              {emojis.map((e) => {
                const mine = comment.reactions.some((r) => r.emoji === e && r.mine);
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { onToggle(e); setOpen(false); }}
                    aria-label={`Thả ${e}`}
                    className={`w-9 h-9 text-xl rounded-full cursor-pointer transition-transform hover:scale-125 ${mine ? "bg-primary-soft" : ""}`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

async function fetchComments(slug: string, userId: string | null): Promise<CommentsResponse | null> {
  try {
    const qs = new URLSearchParams({ visitorId: getVisitorId() });
    if (userId) qs.set("userId", userId);
    const res = await fetch(`${API_URL}/api/blog-comments/post/${encodeURIComponent(slug)}?${qs}`, { cache: "no-store" });
    return res.ok ? ((await res.json()) as CommentsResponse) : null;
  } catch {
    return null;
  }
}

export default function BlogComments({ slug }: { slug: string }) {
  const [data, setData] = useState<CommentsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  // Khối bình luận chỉ hiện nội dung phụ thuộc phiên sau khi tải xong dữ liệu → đọc phiên ngay lúc khởi tạo không lệch hydration
  const [userId, setUserId] = useState<string | null>(() => (typeof window === "undefined" ? null : getSessionUserId()));
  const [replyingTo, setReplyingTo] = useState<{ rootId: string; targetId: string; name: string } | null>(null);
  const [visibleRoots, setVisibleRoots] = useState(ROOTS_STEP);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const loadedOnce = useRef(false);

  // Tải lần đầu + làm mới định kỳ khi tab đang mở
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (document.hidden) return;
      fetchComments(slug, userId).then((body) => {
        if (!alive) return;
        if (!body) {
          if (!loadedOnce.current) setFailed(true);
          return;
        }
        loadedOnce.current = true;
        // Phiên cũ không còn hợp lệ → coi như khách (không tự xoá phiên — việc đó để các trang dashboard xử lý)
        if (body.invalidSession) setUserId(null);
        setData(body);
        setFailed(false);
      });
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", refresh); };
  }, [slug, userId]);

  // Cuộn tới khối bình luận khi quay lại từ trang đăng nhập (#binh-luan) — khối này render sau khi tải dữ liệu
  useEffect(() => {
    if (data && window.location.hash === "#binh-luan") {
      document.getElementById("binh-luan")?.scrollIntoView({ block: "start" });
    }
  }, [data !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchComment = (id: string, fn: (c: CommentItem) => CommentItem | null) => {
    setData((d) => {
      if (!d) return d;
      const comments: CommentItem[] = [];
      for (const root of d.comments) {
        if (root.id === id) {
          const next = fn(root);
          if (next) comments.push(next);
          continue;
        }
        const replies = (root.replies || []).flatMap((r) => {
          if (r.id !== id) return [r];
          const next = fn(r);
          return next ? [next] : [];
        });
        comments.push({ ...root, replies });
      }
      return { ...d, comments };
    });
  };

  const onPosted = (c: CommentItem, pending: boolean) => {
    setData((d) => {
      if (!d) return d;
      const total = d.total + (pending ? 0 : 1);
      if (!c.parentId) return { ...d, total, comments: [c, ...d.comments] };
      return {
        ...d,
        total,
        comments: d.comments.map((root) => (root.id === c.parentId ? { ...root, replies: [...(root.replies || []), c] } : root)),
      };
    });
    if (c.parentId) {
      setExpanded((s) => new Set(s).add(c.parentId as string));
      setReplyingTo(null);
    }
  };

  const toggleReaction = async (comment: CommentItem, emoji: string) => {
    // Cập nhật lạc quan, sau đó lấy số chính xác từ server
    patchComment(comment.id, (c) => {
      const existing = c.reactions.find((r) => r.emoji === emoji);
      let reactions: Reaction[];
      if (existing?.mine) reactions = c.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0);
      else if (existing) reactions = c.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r));
      else reactions = [...c.reactions, { emoji, count: 1, mine: true }];
      return { ...c, reactions };
    });
    try {
      const res = await fetch(`${API_URL}/api/blog-comments/${comment.id}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId: userId || undefined, visitorId: getVisitorId() }),
      });
      if (!res.ok) throw new Error();
      const { reactions } = await res.json();
      patchComment(comment.id, (c) => ({ ...c, reactions }));
    } catch {
      patchComment(comment.id, (c) => ({ ...c, reactions: comment.reactions }));
    }
  };

  const remove = async (comment: CommentItem) => {
    const Swal = (await import("sweetalert2")).default;
    const ok = await Swal.fire({
      title: "Xoá bình luận?",
      text: "Bình luận sẽ bị xoá vĩnh viễn.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Xoá",
      cancelButtonText: "Huỷ",
      confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    const qs = new URLSearchParams({ visitorId: getVisitorId() });
    if (userId) qs.set("userId", userId);
    const res = await fetch(`${API_URL}/api/blog-comments/${comment.id}?${qs}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { Swal.fire({ icon: "error", title: "Không xoá được", text: body.error || "Vui lòng thử lại." }); return; }
    const wasCounted = comment.status === "APPROVED";
    if (body.mode === "soft") {
      patchComment(comment.id, (c) => ({ ...c, status: "DELETED", content: "", author: null, reactions: [], mine: false }));
    } else {
      patchComment(comment.id, () => null);
    }
    if (wasCounted) setData((d) => (d ? { ...d, total: Math.max(0, d.total - 1) } : d));
  };

  const approve = async (comment: CommentItem) => {
    const res = await fetch(`${API_URL}/api/blog-comments/${comment.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) return;
    patchComment(comment.id, (c) => ({ ...c, status: "APPROVED" }));
    setData((d) => (d ? { ...d, total: d.total + 1 } : d));
  };

  const renderComment = (c: CommentItem, rootId: string, isReply: boolean) => {
    const deleted = c.status === "DELETED";
    const badge = c.author?.isPostAuthor ? { label: "Tác giả", cls: "bg-amber-50 text-amber-700" } : c.author ? ROLE_BADGE[c.author.role] : null;
    return (
      <div key={c.id} className="flex gap-3">
        <Avatar comment={c} size={isReply ? 30 : 38} />
        <div className="min-w-0 flex-1">
          <div className={`rounded-2xl px-4 py-2.5 ${deleted ? "bg-slate-50" : c.status === "PENDING" ? "bg-amber-50/60 border border-amber-200" : "bg-slate-50"}`}>
            {deleted ? (
              <p className="text-sm italic text-muted">Bình luận đã bị xoá.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-foreground text-sm">{c.author?.name}</span>
                  {badge && <span className={`ui-badge text-[11px] ${badge.cls}`}>{badge.label}</span>}
                  {c.status === "PENDING" && <span className="ui-badge text-[11px] bg-amber-100 text-amber-800">Đang chờ duyệt</span>}
                  {c.guestEmail && <span className="text-[11px] text-muted break-all">{c.guestEmail}</span>}
                </div>
                <p className="mt-1 text-[15px] text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {c.replyToName && <span className="font-semibold text-primary">@{c.replyToName} </span>}
                  {c.content}
                </p>
              </>
            )}
          </div>
          {!deleted && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 pl-1">
              <time dateTime={c.createdAt} title={new Date(c.createdAt).toLocaleString("vi-VN")} className="text-xs text-muted">
                {timeAgo(c.createdAt)}
              </time>
              {c.status === "APPROVED" && (
                <button
                  type="button"
                  onClick={() => setReplyingTo({ rootId, targetId: c.id, name: c.author?.name || "" })}
                  className="text-xs font-semibold text-muted hover:text-primary cursor-pointer py-1"
                >
                  Trả lời
                </button>
              )}
              {data?.canModerate && c.status === "PENDING" && (
                <button type="button" onClick={() => approve(c)} className="text-xs font-semibold text-emerald-700 hover:underline cursor-pointer py-1">
                  Duyệt
                </button>
              )}
              {(c.mine || data?.canModerate) && (
                <button type="button" onClick={() => remove(c)} className="text-xs font-semibold text-muted hover:text-red-600 cursor-pointer py-1">
                  Xoá
                </button>
              )}
              <ReactionBar comment={c} emojis={data?.emojis || []} onToggle={(e) => toggleReaction(c, e)} />
            </div>
          )}
        </div>
      </div>
    );
  };

  if (failed && !data) {
    return (
      <section id="binh-luan" className="mt-10 scroll-mt-24">
        <h2 className="ui-section-title mb-4">Bình luận</h2>
        <p className="text-sm text-muted">Chưa tải được bình luận. Vui lòng tải lại trang sau.</p>
      </section>
    );
  }

  return (
    <section id="binh-luan" className="mt-10 scroll-mt-24" aria-labelledby="binh-luan-title">
      <h2 id="binh-luan-title" className="ui-section-title mb-5">
        Bình luận{data ? ` (${data.total})` : ""}
      </h2>

      {!data ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-24 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="ui-card p-4 md:p-5">
            <Composer data={data} slug={slug} userId={userId} onPosted={onPosted} />
          </div>

          {data.comments.length === 0 ? (
            <p className="mt-6 text-sm text-muted text-center">Chưa có bình luận nào. Hãy là người đầu tiên chia sẻ!</p>
          ) : (
            <ul className="mt-6 space-y-5">
              {data.comments.slice(0, visibleRoots).map((root) => {
                const replies = root.replies || [];
                const showAll = expanded.has(root.id) || replies.length <= REPLIES_PREVIEW;
                const shown = showAll ? replies : replies.slice(0, REPLIES_PREVIEW);
                return (
                  <li key={root.id}>
                    {renderComment(root, root.id, false)}
                    {(replies.length > 0 || replyingTo?.rootId === root.id) && (
                      <div className="mt-3 ml-6 sm:ml-12 pl-3 border-l-2 border-line space-y-3">
                        {shown.map((r) => renderComment(r, root.id, true))}
                        {!showAll && (
                          <button
                            type="button"
                            onClick={() => setExpanded((s) => new Set(s).add(root.id))}
                            className="text-sm font-semibold text-primary hover:underline cursor-pointer py-1"
                          >
                            Xem thêm {replies.length - REPLIES_PREVIEW} trả lời
                          </button>
                        )}
                        {replyingTo?.rootId === root.id && (
                          <Composer
                            key={replyingTo.targetId}
                            data={data}
                            slug={slug}
                            userId={userId}
                            parentId={replyingTo.targetId}
                            replyTo={replyingTo.name}
                            autoFocus
                            onPosted={onPosted}
                            onCancel={() => setReplyingTo(null)}
                          />
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {data.comments.length > visibleRoots && (
            <div className="mt-6 text-center">
              <button type="button" onClick={() => setVisibleRoots((n) => n + ROOTS_STEP)} className="btn-outline text-sm cursor-pointer">
                Xem thêm bình luận ({data.comments.length - visibleRoots})
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
