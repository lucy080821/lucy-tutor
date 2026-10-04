"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import DOMPurify from "dompurify";
import { getSessionUserId, redirectToOwnArea } from "@/lib/session";
import { SITE_URL } from "@/lib/seo";
import { API_URL, slugify, stripHtml, type BlogCategory, type BlogReadStats } from "@/lib/blog";
import { PostStatsDetail } from "../BlogStatsWidgets";
import AiAssistant from "./AiAssistant";
import RevisionsModal from "./RevisionsModal";
import RelatedPostsPicker from "./RelatedPostsPicker";
import type { BlogEditorApi } from "@/components/blog/BlogQuillEditor";

const BlogQuillEditor = dynamic(() => import("@/components/blog/BlogQuillEditor"), {
  ssr: false,
  loading: () => <div className="skeleton h-[520px] w-full rounded-xl" />,
});

const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
const AUTOSAVE_MS = 30 * 1000;

type Teacher = { id: string; name: string };
type PostStatus = "DRAFT" | "PENDING" | "PUBLISHED";

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  categoryId: string;
  tags: string[];
  authorId: string;
  publishedAt: string; // giá trị <input type="datetime-local">, giờ địa phương
  metaTitle: string;
  metaDescription: string;
  featured: boolean;
  relatedPostIds: string[]; // bài liên quan tự chọn, đúng thứ tự hiển thị
};

const EMPTY_FORM: FormState = {
  title: "", slug: "", excerpt: "", content: "", coverImage: "", categoryId: "", tags: [],
  authorId: "", publishedAt: "", metaTitle: "", metaDescription: "", featured: false,
  relatedPostIds: [],
};

// ISO (UTC) -> "YYYY-MM-DDTHH:mm" theo giờ máy, dùng cho datetime-local
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const nowLocalInput = () => toLocalInput(new Date().toISOString());

function countWords(html: string) {
  return stripHtml(html).split(" ").filter(Boolean).length;
}

function lengthHint(len: number, min: number, max: number) {
  if (len === 0) return "text-muted";
  return len >= min && len <= max ? "text-emerald-600" : "text-amber-600";
}

// ── Bản sao lưu cục bộ (localStorage) — cứu bài khi lỡ đóng tab / mất mạng / trình duyệt treo ──
type Backup = { form: FormState; savedAt: number };
const backupKey = (postId: string | null) => `blog_backup_${postId || "new"}`;
function readBackup(postId: string | null): Backup | null {
  try {
    const raw = localStorage.getItem(backupKey(postId));
    return raw ? (JSON.parse(raw) as Backup) : null;
  } catch { return null; }
}
function writeBackup(postId: string | null, form: FormState) {
  try { localStorage.setItem(backupKey(postId), JSON.stringify({ form, savedAt: Date.now() })); } catch { /* đầy/bị chặn */ }
}
function clearBackup(postId: string | null) {
  try { localStorage.removeItem(backupKey(postId)); } catch { /* bị chặn */ }
}

export default function BlogEditorPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto p-8"><div className="skeleton h-96 w-full rounded-2xl" /></div>}>
      <BlogEditor />
    </Suspense>
  );
}

function BlogEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");

  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [savedStatus, setSavedStatus] = useState<PostStatus | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugCheck, setSlugCheck] = useState<{ slug: string; available: boolean; suggestion?: string } | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  // Thống kê người đọc (lượt xem/click, thời gian đọc, mức cuộn) — chỉ hiện với bài đã đăng
  const [stats, setStats] = useState<BlogReadStats | null>(null);
  // id bài vừa được tạo ngay trong trang này — đổi URL sang ?id=... không cần tải lại bài từ server
  const createdHereRef = useRef<string | null>(null);
  // Điều khiển editor nội dung từ sidebar (chèn link bài liên quan tại vị trí con trỏ)
  const editorApiRef = useRef<BlogEditorApi | null>(null);
  // Lần lưu đang chạy — lưu tay phải đợi lần tự lưu đang dở xong (tránh tạo 2 bài trùng khi bài còn mới)
  const inFlightRef = useRef<Promise<void> | null>(null);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; });

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setDirty(true);
  }, []);

  // ── Khởi tạo: kiểm tra vai trò + quyền blog, nạp danh mục / giáo viên ──
  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/auth?role=TEACHER"); return; }
    (async () => {
      try {
        const [meRes, blogMeRes, catRes, teacherRes] = await Promise.all([
          fetch(`${API_URL}/api/auth/me?userId=${uid}`),
          fetch(`${API_URL}/api/blog/manage/me?userId=${uid}`),
          fetch(`${API_URL}/api/blog/categories`),
          fetch(`${API_URL}/api/auth/teachers`),
        ]);
        const me = meRes.ok ? await meRes.json() : null;
        if (me?.id && me.role !== "TEACHER") { redirectToOwnArea(me.role, router); return; }
        if (blogMeRes.ok) setIsAdmin(!!(await blogMeRes.json()).isAdmin);
        if (catRes.ok) setCategories(await catRes.json());
        if (teacherRes.ok) setTeachers(await teacherRes.json());
      } catch { /* mạng lỗi — vẫn cho soạn, lưu sẽ báo lỗi */ }
      setUserId(uid);
    })();
  }, [router]);

  // ── Nạp bài (hoặc form trống) khi đã biết userId / đổi ?id= ──
  useEffect(() => {
    if (!userId) return;
    if (postId && postId === createdHereRef.current) return; // vừa tạo ở đây, form đang là bản mới nhất
    let cancelled = false;
    (async () => {
      let base: FormState = { ...EMPTY_FORM, authorId: userId };
      let serverUpdatedAt = 0;
      if (postId) {
        const res = await fetch(`${API_URL}/api/blog/manage/posts/${postId}?userId=${userId}`).catch(() => null);
        if (cancelled) return;
        if (!res?.ok) {
          await Swal.fire("Không tìm thấy bài viết", "Bài viết có thể đã bị xoá hoặc bạn không có quyền sửa.", "error");
          router.replace("/teacher/blog");
          return;
        }
        const p = await res.json();
        base = {
          title: p.title, slug: p.slug, excerpt: p.excerpt || "", content: p.content || "",
          coverImage: p.coverImage || "", categoryId: p.categoryId || "", tags: p.tags || [],
          authorId: p.authorId, publishedAt: toLocalInput(p.publishedAt), metaTitle: p.metaTitle || "",
          metaDescription: p.metaDescription || "", featured: !!p.featured,
          relatedPostIds: p.relatedPostIds || [],
        };
        serverUpdatedAt = new Date(p.updatedAt).getTime();
        setSavedStatus(p.status);
        setStats({
          views: p.views || 0, clicks: p.clicks || 0, readingMinutes: p.readingMinutes || 1,
          readSeconds: p.readSeconds || 0, readSessions: p.readSessions || 0,
          scroll25: p.scroll25 || 0, scroll50: p.scroll50 || 0, scroll75: p.scroll75 || 0, scroll100: p.scroll100 || 0,
        });
        setLastSavedAt(new Date(p.updatedAt));
        setSlugTouched(true); // bài đã có link — không tự đổi link theo tiêu đề nữa (tránh gãy link đã chia sẻ)
      }

      // Có bản soạn dở trong máy mới hơn bản trên server -> hỏi khôi phục
      const backup = readBackup(postId);
      let restored = false;
      if (backup && backup.savedAt > serverUpdatedAt && (backup.form.title || stripHtml(backup.form.content))) {
        const r = await Swal.fire({
          title: "Khôi phục bản đang soạn dở?",
          html: `Máy này còn lưu bản bạn soạn lúc <b>${new Date(backup.savedAt).toLocaleString("vi-VN")}</b> nhưng chưa được lưu lên hệ thống.`,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Khôi phục",
          cancelButtonText: "Bỏ bản này",
        });
        if (cancelled) return;
        if (r.isConfirmed) {
          base = { ...EMPTY_FORM, ...backup.form, authorId: backup.form.authorId || base.authorId };
          restored = true;
          if (!postId) setSlugTouched(!!backup.form.slug && backup.form.slug !== slugify(backup.form.title));
        } else {
          clearBackup(postId);
        }
      }
      setForm(base);
      setDirty(restored);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [userId, postId, router]);

  // ── Link SEO tự sinh theo tên bài cho tới khi người dùng tự sửa link ──
  const onTitleChange = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
    setDirty(true);
  };

  // Kiểm tra trùng link (debounce)
  useEffect(() => {
    if (!userId || !form.slug) return;
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ userId, slug: form.slug, ...(postId ? { excludeId: postId } : {}) });
        const res = await fetch(`${API_URL}/api/blog/manage/slug-check?${qs}`);
        if (res.ok) setSlugCheck(await res.json());
      } catch { /* bỏ qua — server vẫn kiểm tra lại lúc lưu */ }
    }, 400);
    return () => clearTimeout(t);
  }, [form.slug, userId, postId]);

  // Sao lưu cục bộ 1 giây sau mỗi lần sửa
  useEffect(() => {
    if (!dirty || !loaded) return;
    const t = setTimeout(() => writeBackup(postId, form), 1000);
    return () => clearTimeout(t);
  }, [form, dirty, loaded, postId]);

  // Cảnh báo khi rời trang mà chưa lưu
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Upload ảnh (ảnh bìa + ảnh trong bài) ──
  const uploadImage = useCallback(async (file: File | Blob, name = "image.png"): Promise<string | null> => {
    if (!userId) return null;
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire("Ảnh quá lớn", "Vui lòng chọn ảnh dưới 5MB.", "warning");
      return null;
    }
    const fd = new FormData();
    fd.append("image", file, file instanceof File ? file.name : name);
    fd.append("userId", userId);
    try {
      const res = await fetch(`${API_URL}/api/blog/manage/upload-image`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data.url as string;
    } catch (err) {
      Swal.fire("Upload ảnh thất bại", (err instanceof Error && err.message) || "Vui lòng thử lại", "error");
      return null;
    }
  }, [userId]);

  const onCoverFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingCover(true);
    const url = await uploadImage(file);
    setUploadingCover(false);
    if (url) update("coverImage", url);
  };

  // Ảnh dán thẳng vào editor (Ctrl+V) bị Quill nhúng dạng base64 — backend sẽ loại bỏ,
  // nên trước khi lưu tự upload các ảnh này lên Storage và thay bằng URL.
  const uploadInlineImages = async (html: string): Promise<string> => {
    const matches = [...new Set(html.match(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g) || [])];
    let out = html;
    for (const dataUrl of matches) {
      const blob = await (await fetch(dataUrl)).blob();
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const url = await uploadImage(blob, `pasted.${ext}`);
      if (url) out = out.split(dataUrl).join(url);
    }
    return out;
  };

  // ── Danh mục: thêm ngay lúc soạn ──
  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name || !userId) return;
    const res = await fetch(`${API_URL}/api/blog/manage/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name }),
    });
    const data = await res.json();
    if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thêm được danh mục", "error"); return; }
    setCategories((prev) => (prev.some((c) => c.id === data.id) ? prev : [...prev, data].sort((a, b) => a.name.localeCompare(b.name, "vi"))));
    update("categoryId", data.id);
    setNewCategory("");
    setShowNewCategory(false);
  };

  // ── Thẻ (tags) ──
  const addTags = (raw: string[]) => {
    setForm((f) => {
      const next = [...f.tags];
      raw.map((t) => t.trim().replace(/^#/, "")).forEach((t) => {
        if (t && !next.includes(t) && next.length < 10) next.push(t);
      });
      return { ...f, tags: next };
    });
    setDirty(true);
  };

  // ── Lưu ──
  // autosave: lưu ngầm bản nháp / bản chờ duyệt, không đổi trạng thái, không hiện thông báo
  const save = async (status: PostStatus, { autosave = false } = {}) => {
    if (!userId || saving) return;
    if (inFlightRef.current) {
      if (autosave) return;
      await inFlightRef.current;
    }
    let done: () => void = () => {};
    inFlightRef.current = new Promise<void>((r) => { done = r; });
    // postId trên URL chưa kịp đổi nếu bài vừa được tạo ở lần lưu trước
    const currentId = postId || createdHereRef.current;
    const release = () => { inFlightRef.current = null; done(); };
    if (!formRef.current.title.trim()) {
      release();
      if (!autosave) Swal.fire("Thiếu tên bài", "Vui lòng nhập tên bài viết.", "warning");
      return;
    }
    if (!autosave && status !== "DRAFT" && countWords(formRef.current.content) === 0 && !/<img|<iframe/.test(formRef.current.content)) {
      release();
      Swal.fire("Chưa có nội dung", "Bài viết cần có nội dung trước khi đăng.", "warning");
      return;
    }

    const snapshot = formRef.current;
    if (autosave) setAutosaving(true); else setSaving(true);
    try {
      const content = await uploadInlineImages(snapshot.content);
      // Đăng bài mà chưa chọn ngày -> đăng ngay
      const publishedAtLocal = status === "PUBLISHED" && !snapshot.publishedAt ? nowLocalInput() : snapshot.publishedAt;
      const body = {
        ...snapshot,
        content,
        userId,
        status,
        autosave: autosave && !!currentId,
        publishedAt: publishedAtLocal ? new Date(publishedAtLocal).toISOString() : null,
      };
      const res = await fetch(`${API_URL}/api/blog/manage/posts${currentId ? `/${currentId}` : ""}`, {
        method: currentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 409 && data.suggestion) {
        if (autosave) return;
        const r = await Swal.fire({
          title: "Link SEO đã tồn tại",
          html: `${data.error}.<br/>Dùng link <b>/blog/${data.suggestion}</b> thay thế?`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Dùng link này",
          cancelButtonText: "Tự sửa",
        });
        if (r.isConfirmed) { setForm((f) => ({ ...f, slug: data.suggestion })); setSlugTouched(true); }
        return;
      }
      if (!res.ok) throw new Error(data.error || "Lưu thất bại");

      // Chỉ ghi đè những trường server chuẩn hoá; nội dung gõ thêm trong lúc đang lưu được giữ nguyên
      setForm((f) => ({
        ...f,
        slug: data.slug,
        publishedAt: toLocalInput(data.publishedAt),
        content: f.content === snapshot.content ? data.content : f.content,
      }));
      setSavedStatus(data.status);
      setSlugTouched(true);
      setLastSavedAt(new Date());
      // Còn "chưa lưu" nếu người dùng gõ thêm trong lúc request đang chạy
      const strip = (f: FormState) => JSON.stringify({ ...f, slug: "", publishedAt: "" });
      const editedMeanwhile = strip(formRef.current) !== strip(snapshot);
      setDirty(editedMeanwhile);
      if (!editedMeanwhile) clearBackup(currentId);

      if (!currentId) {
        clearBackup(null);
        createdHereRef.current = data.id;
        router.replace(`/teacher/blog/editor?id=${data.id}`);
      }
      if (autosave) return;

      const scheduled = data.status === "PUBLISHED" && data.publishedAt && new Date(data.publishedAt) > new Date();
      if (data.status === "PUBLISHED") {
        const r = await Swal.fire({
          title: scheduled ? "Đã hẹn giờ đăng bài" : "Đã đăng bài viết",
          html: scheduled
            ? `Bài sẽ tự hiện công khai lúc <b>${new Date(data.publishedAt).toLocaleString("vi-VN")}</b>.`
            : `Bài viết đã có tại <b>${SITE_HOST}/blog/${data.slug}</b><br/><span style="font-size:13px;color:#5b6b82">(có thể mất tới 1 phút để trang công khai cập nhật)</span>`,
          icon: "success",
          showCancelButton: !scheduled,
          confirmButtonText: scheduled ? "OK" : "Xem bài viết",
          cancelButtonText: "Tiếp tục sửa",
        });
        if (r.isConfirmed && !scheduled) window.open(`/blog/${data.slug}`, "_blank");
      } else if (data.status === "PENDING") {
        Swal.fire({
          title: "Đã gửi duyệt",
          text: "Bài viết sẽ được đăng sau khi admin blog duyệt. Bạn vẫn có thể tiếp tục chỉnh sửa trong lúc chờ.",
          icon: "success",
        });
      } else {
        Swal.fire({ title: "Đã lưu bản nháp", icon: "success", timer: 1200, showConfirmButton: false });
      }
    } catch (err) {
      if (!autosave) Swal.fire("Lỗi", (err instanceof Error && err.message) || "Không lưu được bài viết", "error");
    } finally {
      if (autosave) setAutosaving(false); else setSaving(false);
      release();
    }
  };

  // Trạng thái giữ nguyên khi lưu nhanh (Ctrl+S / tự lưu)
  const keepStatus: PostStatus = savedStatus ?? "DRAFT";

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });

  // Ctrl/Cmd + S = lưu với trạng thái hiện tại
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveRef.current(keepStatus);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keepStatus]);

  // Tự lưu lên server mỗi 30 giây — chỉ với bản nháp / chờ duyệt (bài đã đăng phải bấm Cập Nhật,
  // tránh việc sửa dở hiện ra công khai). Bài mới có tên sẽ được tự tạo thành bản nháp.
  useEffect(() => {
    if (!dirty || !form.title.trim() || savedStatus === "PUBLISHED") return;
    const t = setTimeout(() => saveRef.current(keepStatus, { autosave: true }), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [dirty, form, savedStatus, keepStatus]);

  // ── Số liệu + checklist SEO ──
  const wordCount = useMemo(() => countWords(form.content), [form.content]);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 200));
  const seoTitle = form.metaTitle || form.title;
  const seoDescription = form.metaDescription || form.excerpt || stripHtml(form.content).slice(0, 160);
  const isFuture = !!form.publishedAt && new Date(form.publishedAt) > new Date();

  const checklist = [
    { ok: seoTitle.length >= 30 && seoTitle.length <= 60, label: "Tiêu đề SEO dài 30–60 ký tự" },
    { ok: seoDescription.length >= 120 && seoDescription.length <= 160, label: "Mô tả SEO dài 120–160 ký tự" },
    { ok: !!form.slug && form.slug.length <= 75, label: "Link SEO ngắn gọn (≤ 75 ký tự)" },
    { ok: /<h2/.test(form.content), label: "Có ít nhất 1 mục Tiêu đề 2 (H2)" },
    { ok: wordCount >= 300, label: "Nội dung ≥ 300 từ" },
    { ok: !!form.coverImage, label: "Có ảnh bìa (hiện khi chia sẻ Facebook/Zalo)" },
    { ok: !!form.categoryId, label: "Đã chọn danh mục" },
    { ok: form.tags.length > 0, label: "Có ít nhất 1 thẻ" },
  ];
  const checklistScore = checklist.filter((c) => c.ok).length;

  const authorName = teachers.find((t) => t.id === form.authorId)?.name || "";
  const categoryName = categories.find((c) => c.id === form.categoryId)?.name || "";

  if (!loaded || !userId) {
    return <div className="max-w-6xl mx-auto p-8"><div className="skeleton h-96 w-full rounded-2xl" /></div>;
  }

  // Nút chính theo quyền: admin đăng thẳng / duyệt bài; giáo viên thường gửi duyệt
  const primary: { label: string; status: PostStatus } =
    savedStatus === "PUBLISHED" ? { label: "Cập Nhật", status: "PUBLISHED" }
      : isAdmin ? { label: savedStatus === "PENDING" ? "Duyệt & Đăng" : isFuture ? "Hẹn Giờ Đăng" : "Đăng Bài", status: "PUBLISHED" }
        : { label: savedStatus === "PENDING" ? "Cập Nhật Bản Gửi Duyệt" : "Gửi Duyệt", status: "PENDING" };

  const statusBadge = savedStatus === "PUBLISHED"
    ? <span className="ui-badge bg-emerald-50 text-emerald-700">{isFuture ? "Hẹn giờ" : "Đã đăng"}</span>
    : savedStatus === "PENDING"
      ? <span className="ui-badge bg-blue-50 text-blue-700">Chờ duyệt</span>
      : <span className="ui-badge bg-slate-100 text-slate-600">{savedStatus ? "Bản nháp" : "Chưa lưu"}</span>;

  return (
    <div className="flex-1 pb-16">
      {/* Thanh công cụ trên cùng */}
      <div className="sticky top-14 md:top-16 z-30 bg-white border-b border-line">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <nav className="text-xs text-muted">
              <Link href="/teacher" className="hover:text-primary">Bảng điều khiển</Link> /{" "}
              <Link href="/teacher/blog" className="hover:text-primary">Blog</Link> / <span>{postId ? "Sửa bài" : "Bài mới"}</span>
            </nav>
            <p className="text-sm font-semibold text-foreground flex flex-wrap items-center gap-2">
              {statusBadge}
              {autosaving ? <span className="text-xs text-muted font-normal">Đang tự lưu...</span>
                : dirty ? <span className="text-xs text-amber-600 font-normal">● Có thay đổi chưa lưu</span>
                  : lastSavedAt && <span className="text-xs text-muted font-normal">Đã lưu lúc {lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {postId && (
              <button onClick={() => setShowRevisions(true)} className="btn-ghost cursor-pointer">Lịch Sử</button>
            )}
            <button onClick={() => setPreview((p) => !p)} className="btn-outline cursor-pointer">
              {preview ? "Quay lại soạn" : "Xem trước"}
            </button>
            {savedStatus === "PUBLISHED" || savedStatus === "PENDING" ? (
              <button onClick={() => save("DRAFT")} disabled={saving} className="btn-ghost cursor-pointer disabled:opacity-50"
                title={savedStatus === "PUBLISHED" ? "Gỡ bài khỏi trang công khai" : "Rút bài khỏi hàng chờ duyệt"}>
                {savedStatus === "PUBLISHED" ? "Chuyển Về Nháp" : isAdmin ? "Trả Về Nháp" : "Rút Về Nháp"}
              </button>
            ) : (
              <button onClick={() => save("DRAFT")} disabled={saving} className="btn-outline cursor-pointer disabled:opacity-50">
                Lưu Nháp
              </button>
            )}
            <button onClick={() => save(primary.status)} disabled={saving} className="btn-primary cursor-pointer disabled:opacity-50">
              {saving ? "Đang lưu..." : primary.label}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ── Cột chính ── */}
        <div className="min-w-0 space-y-5">
          {!isAdmin && savedStatus !== "PUBLISHED" && (
            <p className="text-sm rounded-xl bg-blue-50 text-blue-800 px-4 py-3">
              Bài của bạn sẽ được admin blog duyệt trước khi hiện công khai. Bấm <b>Gửi Duyệt</b> khi đã viết xong.
            </p>
          )}

          {preview && (
            <article className="ui-card p-6 md:p-10">
              <p className="text-xs text-muted mb-2">{categoryName || "Chưa phân loại"}</p>
              <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">{form.title || "(Chưa có tên bài)"}</h1>
              {form.excerpt && <p className="mt-3 text-lg text-muted">{form.excerpt}</p>}
              <p className="mt-3 text-sm text-muted">
                {authorName} · {form.publishedAt ? new Date(form.publishedAt).toLocaleDateString("vi-VN") : "Chưa đặt ngày"} · {readingMinutes} phút đọc
              </p>
              {form.coverImage && <img src={form.coverImage} alt="" className="mt-6 w-full aspect-video object-cover rounded-2xl" />}
              <div className="blog-content quill-content mt-6" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.content) }} />
            </article>
          )}

          {/* Ẩn bằng CSS thay vì unmount — tránh mount lại ReactQuill (xem lưu ý react-quill-new trong CLAUDE.md) */}
          <div className={preview ? "hidden" : "space-y-5"}>
            <div className="ui-card p-5 md:p-6 space-y-4">
              <div>
                <label htmlFor="blog-title" className="ui-label">Tên bài viết *</label>
                <textarea
                  id="blog-title"
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value.replace(/\n/g, " "))}
                  rows={2}
                  placeholder="VD: 5 bí quyết đạt 9+ môn Tiếng Anh THPT Quốc Gia"
                  className="w-full text-2xl md:text-3xl font-black text-foreground placeholder:text-slate-300 outline-none resize-none bg-transparent leading-tight"
                />
                <p className={`text-xs ${lengthHint(form.title.length, 30, 60)}`}>{form.title.length} ký tự · lý tưởng 30–60 ký tự để không bị Google cắt</p>
              </div>

              <div>
                <label htmlFor="blog-slug" className="ui-label">Link SEO</label>
                <div className="flex items-stretch rounded-xl border border-line-strong overflow-hidden focus-within:border-primary">
                  <span className="hidden sm:flex items-center px-3 bg-slate-50 text-sm text-muted border-r border-line-strong whitespace-nowrap">
                    {SITE_HOST}/blog/
                  </span>
                  <input
                    id="blog-slug"
                    value={form.slug}
                    onChange={(e) => { setSlugTouched(true); update("slug", slugify(e.target.value) + (e.target.value.endsWith("-") || e.target.value.endsWith(" ") ? "-" : "")); }}
                    onBlur={() => update("slug", slugify(form.slug))}
                    placeholder="ten-bai-viet"
                    className="flex-1 min-w-0 px-3 py-2.5 text-sm outline-none"
                  />
                  {slugTouched && savedStatus !== "PUBLISHED" && (
                    <button
                      type="button"
                      onClick={() => { setSlugTouched(false); update("slug", slugify(form.title)); }}
                      className="px-3 text-xs font-semibold text-primary hover:bg-primary-soft cursor-pointer whitespace-nowrap"
                      title="Tạo lại link theo tên bài"
                    >
                      Tự động
                    </button>
                  )}
                </div>
                <div className="text-xs mt-1 flex flex-wrap gap-x-3">
                  <span className="sm:hidden text-muted break-all">{SITE_HOST}/blog/{form.slug}</span>
                  {slugCheck && form.slug && slugCheck.slug === slugify(form.slug) && (slugCheck.available
                    ? <span className="text-emerald-600">✓ Link khả dụng</span>
                    : (
                      <span className="text-red-600">
                        ✗ Link đã được dùng{slugCheck.suggestion && (
                          <> — <button type="button" className="underline cursor-pointer" onClick={() => update("slug", slugCheck.suggestion!)}>dùng “{slugCheck.suggestion}”</button></>
                        )}
                      </span>
                    ))}
                  {savedStatus === "PUBLISHED" && (
                    <span className="text-amber-600">⚠️ Đổi link của bài đã đăng sẽ làm hỏng các link đã chia sẻ trước đó</span>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="blog-excerpt" className="ui-label">Tóm tắt (sapo)</label>
                <textarea
                  id="blog-excerpt"
                  value={form.excerpt}
                  onChange={(e) => update("excerpt", e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="1–2 câu giới thiệu nội dung bài — hiện ở danh sách blog và làm mô tả khi chia sẻ"
                  className="ui-input w-full resize-y"
                />
                <p className={`text-xs ${lengthHint(form.excerpt.length, 120, 160)}`}>{form.excerpt.length}/300 ký tự</p>
              </div>
            </div>

            <div>
              <BlogQuillEditor value={form.content} onChange={(html) => update("content", html)} onUploadImage={(f) => uploadImage(f)} apiRef={editorApiRef} />
              <p className="text-xs text-muted mt-2">
                {wordCount.toLocaleString("vi-VN")} từ · khoảng {readingMinutes} phút đọc · Ctrl+S để lưu nhanh
                {savedStatus !== "PUBLISHED" && " · Bản nháp tự lưu 30 giây sau khi bạn ngừng gõ"}
              </p>
            </div>
          </div>
        </div>

        {/* ── Cột phải ── */}
        <aside className="space-y-5">
          <section className="ui-card p-5 space-y-4">
            <h2 className="font-bold text-foreground">Đăng bài</h2>
            <div>
              <label htmlFor="blog-date" className="ui-label">Ngày giờ đăng</label>
              <input
                id="blog-date"
                type="datetime-local"
                value={form.publishedAt}
                onChange={(e) => update("publishedAt", e.target.value)}
                className="ui-input w-full"
              />
              <p className="text-xs text-muted mt-1">
                {isFuture ? "⏰ Ngày trong tương lai — bài sẽ tự hiện lúc đó (hẹn giờ đăng)." : "Để trống = lấy thời điểm bài được đăng."}
              </p>
            </div>
            <div>
              <label htmlFor="blog-author" className="ui-label">Tác giả</label>
              {isAdmin ? (
                <select id="blog-author" value={form.authorId} onChange={(e) => update("authorId", e.target.value)} className="ui-input w-full">
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.id === userId ? " (bạn)" : ""}</option>)}
                </select>
              ) : (
                <p id="blog-author" className="ui-input w-full bg-slate-50">{authorName || "Bạn"}</p>
              )}
              <Link href="/teacher/blog#ho-so-tac-gia" className="text-xs text-primary hover:underline inline-block mt-1">Sửa hồ sơ tác giả</Link>
            </div>
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.featured} onChange={(e) => update("featured", e.target.checked)} className="w-4 h-4 accent-[#1e3a8a]" />
                Ghim làm bài nổi bật (lên đầu trang Blog)
              </label>
            )}
            {postId && savedStatus === "PUBLISHED" && stats && (
              <div className="border-t border-line pt-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-foreground">Thống kê người đọc</p>
                  <Link href={`/blog/${form.slug}`} target="_blank" className="text-xs text-primary hover:underline">Mở bài viết</Link>
                </div>
                <PostStatsDetail stats={stats} />
              </div>
            )}
          </section>

          <AiAssistant
            userId={userId}
            title={form.title}
            content={form.content}
            onApply={(field, value) => {
              if (field === "title") onTitleChange(value as string);
              else if (field === "tags") addTags(value as string[]);
              else update(field, value as string);
            }}
          />

          <section className="ui-card p-5 space-y-3">
            <h2 className="font-bold text-foreground">Danh mục</h2>
            <select value={form.categoryId} onChange={(e) => update("categoryId", e.target.value)} className="ui-input w-full" aria-label="Danh mục">
              <option value="">— Chưa phân loại —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {showNewCategory ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategory(); } if (e.key === "Escape") setShowNewCategory(false); }}
                  placeholder="Tên danh mục mới"
                  className="ui-input flex-1 min-w-0"
                />
                <button onClick={addCategory} className="btn-primary text-sm cursor-pointer shrink-0">Thêm</button>
              </div>
            ) : (
              <button onClick={() => setShowNewCategory(true)} className="text-sm font-semibold text-primary hover:underline cursor-pointer py-1">
                + Thêm danh mục mới
              </button>
            )}
          </section>

          <RelatedPostsPicker
            userId={userId}
            postId={postId}
            value={form.relatedPostIds}
            onChange={(ids) => update("relatedPostIds", ids)}
            onInsertLink={(p) => {
              if (preview) setPreview(false);
              editorApiRef.current?.insertLink(p.title, `/blog/${p.slug}`);
            }}
          />

          <section className="ui-card p-5 space-y-3">
            <h2 className="font-bold text-foreground">Thẻ (tags)</h2>
            <div className="flex flex-wrap gap-1.5">
              {form.tags.map((t) => (
                <span key={t} className="ui-badge flex items-center gap-1">
                  #{t}
                  <button onClick={() => update("tags", form.tags.filter((x) => x !== t))} aria-label={`Bỏ thẻ ${t}`} className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-red-50 hover:text-red-600 cursor-pointer">×</button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTags([tagInput]); setTagInput(""); }
                if (e.key === "Backspace" && !tagInput && form.tags.length) update("tags", form.tags.slice(0, -1));
              }}
              onBlur={() => { if (tagInput.trim()) { addTags([tagInput]); setTagInput(""); } }}
              placeholder={form.tags.length >= 10 ? "Tối đa 10 thẻ" : "Gõ thẻ rồi Enter (VD: ielts, tu-vung)"}
              disabled={form.tags.length >= 10}
              className="ui-input w-full"
            />
          </section>

          <section className="ui-card p-5 space-y-3">
            <h2 className="font-bold text-foreground">Ảnh bìa</h2>
            {form.coverImage ? (
              <div className="relative">
                <img src={form.coverImage} alt="Ảnh bìa" className="w-full aspect-video object-cover rounded-xl" />
                <button onClick={() => update("coverImage", "")} aria-label="Bỏ ảnh bìa" className="absolute top-2 right-2 w-9 h-9 rounded-full bg-white/90 shadow flex items-center justify-center hover:text-red-600 cursor-pointer">×</button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center aspect-video rounded-xl border-2 border-dashed border-line-strong text-sm text-muted cursor-pointer hover:border-primary hover:text-primary ${uploadingCover ? "opacity-60 pointer-events-none" : ""}`}>
                {uploadingCover ? "Đang tải ảnh lên..." : "Bấm để chọn ảnh (≤ 5MB)"}
                <span className="text-xs mt-1">Khuyến nghị 1200×630px</span>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => onCoverFile(e.target.files?.[0])} />
              </label>
            )}
            <input
              value={form.coverImage}
              onChange={(e) => update("coverImage", e.target.value.trim())}
              placeholder="hoặc dán link ảnh https://..."
              className="ui-input w-full text-sm"
            />
          </section>

          <section className="ui-card p-5 space-y-3">
            <h2 className="font-bold text-foreground">SEO</h2>
            <div>
              <label htmlFor="blog-meta-title" className="ui-label">Tiêu đề SEO</label>
              <input id="blog-meta-title" value={form.metaTitle} onChange={(e) => update("metaTitle", e.target.value)} placeholder={form.title || "Mặc định = tên bài"} className="ui-input w-full" />
              <p className={`text-xs ${lengthHint(seoTitle.length, 30, 60)}`}>{seoTitle.length}/60 ký tự</p>
            </div>
            <div>
              <label htmlFor="blog-meta-desc" className="ui-label">Mô tả SEO</label>
              <textarea id="blog-meta-desc" value={form.metaDescription} onChange={(e) => update("metaDescription", e.target.value)} rows={3} placeholder="Mặc định = tóm tắt" className="ui-input w-full resize-y" />
              <p className={`text-xs ${lengthHint(seoDescription.length, 120, 160)}`}>{seoDescription.length}/160 ký tự</p>
            </div>

            {/* Mô phỏng kết quả tìm kiếm Google */}
            <div className="rounded-xl border border-line p-3 bg-white">
              <p className="text-[11px] text-muted mb-1">Xem trước trên Google</p>
              <p className="text-xs text-slate-600 truncate">{SITE_HOST} › blog › {form.slug || "ten-bai-viet"}</p>
              <p className="text-[#1a0dab] text-base leading-snug line-clamp-1">{(seoTitle || "Tên bài viết") + " | Lucy Tutor"}</p>
              <p className="text-xs text-slate-600 line-clamp-2">{seoDescription || "Mô tả bài viết sẽ hiện ở đây..."}</p>
            </div>

            <div>
              <p className="text-sm font-semibold text-foreground mb-1.5">Kiểm tra SEO: {checklistScore}/{checklist.length}</p>
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li key={c.label} className={`text-xs flex gap-1.5 ${c.ok ? "text-emerald-700" : "text-muted"}`}>
                    <span className="shrink-0">{c.ok ? "✓" : "○"}</span>{c.label}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </aside>
      </div>

      {showRevisions && postId && (
        <RevisionsModal
          userId={userId}
          postId={postId}
          onClose={() => setShowRevisions(false)}
          onRestore={(rev) => {
            setForm((f) => ({ ...f, title: rev.title, excerpt: rev.excerpt, content: rev.content }));
            setDirty(true);
            setShowRevisions(false);
            setPreview(false);
            Swal.fire({
              title: "Đã nạp phiên bản cũ",
              text: "Bấm Lưu / Cập Nhật để áp dụng. Bản hiện tại sẽ được giữ lại trong Lịch Sử.",
              icon: "info",
            });
          }}
        />
      )}
    </div>
  );
}
