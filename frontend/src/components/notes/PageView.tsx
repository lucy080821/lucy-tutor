"use client";
// Một trang ghi chú: tiêu đề, thẻ, trình soạn, lưu tự động 2 lớp (localStorage 1 giây + server 1,5 giây sau khi
// ngừng gõ, kèm version để phát hiện sửa ở thiết bị/tab khác → 409), lịch sử phiên bản, ghi âm, chụp vở, AI.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import type { Editor, JSONContent } from "@tiptap/react";
import NoteEditor, { type AiSelectionAction } from "./editor/NoteEditor";
import { notesApi, aiApi, errMsg, ApiError } from "./api";
import { Modal, Spinner, safeHtml, timeAgo } from "./ui";
import AiPanel from "./ai/AiPanel";
import LinksPanel from "./LinksPanel";
import Recorder, { type RecordResult } from "./Recorder";
import OcrCapture, { compressImage } from "./OcrCapture";
import { downloadMarkdown, exportPagePdf, exportPagePng } from "./exportNotes";
import StylePanel from "./StylePanel";
import { onPageChange, onPageCommand } from "./notesBus";
import { sheetCss, type PageStyle } from "./pageStyle";
import { PAGE_COLORS, type Attachment, type Bootstrap, type FullPage, type PageItem } from "./types";

type SaveState = "saved" | "dirty" | "saving" | "offline" | "error";
const backupKey = (id: string) => `lucy_note_backup_${id}`;
// So sánh tài liệu theo nội dung (khoá sắp xếp): JSONB của Postgres tự đổi thứ tự khoá nên JSON trả về khác chuỗi
// với JSON trình soạn tạo ra dù nội dung y hệt — không có bước này trang vừa mở đã bị coi là "chưa lưu"
const stableKey = (v: unknown): string => {
  if (Array.isArray(v)) return `[${v.map(stableKey).join(",")}]`;
  // Bỏ qua thuộc tính null/rỗng: trình soạn tự thêm attrs mặc định (vd textAlign: null) vào nội dung chưa có
  if (v && typeof v === "object") return `{${Object.keys(v as object).sort().map((k) => [k, stableKey((v as Record<string, unknown>)[k])] as const).filter(([, x]) => x !== "null" && x !== "{}").map(([k, x]) => `${JSON.stringify(k)}:${x}`).join(",")}}`;
  return JSON.stringify(v ?? null);
};
const readBackup = (id: string) => { try { return JSON.parse(localStorage.getItem(backupKey(id)) || "null"); } catch { return null; } };

export default function PageView({ pageId, boot, onOpenPage, onChanged, onRemoved, onCreateChild, searchPages, refreshBoot, onBack, autoTool, onAutoToolUsed }: {
  pageId: string; boot: Bootstrap;
  /** Mở ngay ghi âm / chụp vở khi trang vừa được tạo từ nút nhanh */
  autoTool?: "record" | "ocr"; onAutoToolUsed?: () => void;
  onOpenPage: (id: string) => void;
  onChanged: (item: Partial<PageItem> & { id: string }) => void;
  onRemoved: (id: string) => void;
  onCreateChild: (parentId: string) => void;
  searchPages: (q: string) => Promise<{ id: string; title: string }[]>;
  refreshBoot: () => void;
  onBack?: () => void;
}) {
  const [page, setPage] = useState<FullPage | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [panel, setPanel] = useState<"ai" | "links" | "style" | null>(null);
  const [recOpen, setRecOpen] = useState(false);
  const [ocrOpen, setOcrOpen] = useState(false);
  const [history, setHistory] = useState<{ id: string; title: string; createdAt: string }[] | null>(null);
  const [preview, setPreview] = useState<{ title: string; contentJson: JSONContent } | null>(null);
  const [aiResult, setAiResult] = useState<{ html: string; preview: string; label: string } | null>(null);
  const [aiBusy, setAiBusy] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<Editor | null>(null);
  const [editorInst, setEditorInst] = useState<Editor | null>(null);
  // Trạng thái lưu nằm trong ref để hàm save (gọi từ timer/sự kiện) luôn đọc giá trị mới nhất
  const s = useRef({ version: 0, title: "", doc: null as JSONContent | null, savedKey: "", savedTitle: "", dirty: false, inflight: null as Promise<void> | null, timer: 0 as unknown as ReturnType<typeof setTimeout>, backupTimer: 0 as unknown as ReturnType<typeof setTimeout> });
  const readOnly = !!page?.deletedAt;

  // ── Tải trang ──
  useEffect(() => {
    let alive = true;
    setPage(null); setError(""); setPanel((p) => (p === "links" ? null : p)); setAiResult(null);
    notesApi<FullPage>(`/pages/${pageId}`).then(async (p) => {
      if (!alive) return;
      let doc = p.contentJson; let t = p.title;
      const bk = readBackup(p.id);
      if (bk && bk.baseVersion === p.version && (JSON.stringify(bk.doc) !== JSON.stringify(p.contentJson) || bk.title !== p.title)) {
        const r = await Swal.fire({ icon: "question", title: "Có bản chưa lưu trong máy", text: `Bản sửa lúc ${new Date(bk.at).toLocaleString("vi-VN")} chưa kịp lưu lên máy chủ. Khôi phục?`, showCancelButton: true, confirmButtonText: "Khôi phục", cancelButtonText: "Bỏ bản này" });
        if (r.isConfirmed) { doc = bk.doc; t = bk.title; s.current.dirty = true; } else localStorage.removeItem(backupKey(p.id));
      } else if (bk) localStorage.removeItem(backupKey(p.id));
      if (!alive) return;
      s.current = { ...s.current, version: p.version, title: t, doc, savedKey: stableKey(p.contentJson), savedTitle: p.title, dirty: s.current.dirty };
      setPage({ ...p, contentJson: doc });
      setTitle(t);
      setSaveState(s.current.dirty ? "dirty" : "saved");
      setEditorKey((k) => k + 1);
      if (s.current.dirty) schedule(300);
    }).catch((err) => { if (alive) setError(errMsg(err)); });
    return () => { alive = false; flush(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  useEffect(() => {
    if (!page || !autoTool) return;
    if (autoTool === "record") setRecOpen(true); else setOcrOpen(true);
    onAutoToolUsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, autoTool]);

  // ── Lưu ──
  const save = useCallback(async (opts: { keepalive?: boolean } = {}): Promise<void> => {
    const st = s.current;
    if (st.inflight) { await st.inflight; if (!s.current.dirty) return; }
    if (!st.dirty) return;
    const snapshot = { title: st.title, doc: st.doc };
    st.dirty = false;
    setSaveState("saving");
    const id = pageId;
    const run = (async () => {
      try {
        const r = await notesApi<PageItem & { version: number }>(`/pages/${id}`, { method: "PATCH", body: { baseVersion: st.version, title: snapshot.title, contentJson: snapshot.doc }, keepalive: opts.keepalive });
        st.version = r.version;
        st.savedKey = stableKey(snapshot.doc); st.savedTitle = snapshot.title;
        if (!s.current.dirty) localStorage.removeItem(backupKey(id));
        setSaveState(s.current.dirty ? "dirty" : "saved");
        onChanged({ id, title: r.title, excerpt: r.excerpt, updatedAt: r.updatedAt, wordCount: r.wordCount });
      } catch (err) {
        st.dirty = true;
        if (err instanceof ApiError && err.status === 409) { setSaveState("error"); await resolveConflict(); return; }
        setSaveState(err instanceof ApiError && err.status === 0 ? "offline" : "error");
        // Mất mạng: thử lại sau 8 giây, bản sửa vẫn còn trong localStorage
        st.timer = setTimeout(() => save(), 8000);
      }
    })();
    st.inflight = run;
    await run;
    st.inflight = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  const schedule = (ms = 1500) => {
    clearTimeout(s.current.timer);
    s.current.timer = setTimeout(() => save(), ms);
  };
  const flush = useCallback(async () => { clearTimeout(s.current.timer); await save(); }, [save]);

  const backup = () => {
    clearTimeout(s.current.backupTimer);
    s.current.backupTimer = setTimeout(() => {
      try { localStorage.setItem(backupKey(pageId), JSON.stringify({ title: s.current.title, doc: s.current.doc, at: Date.now(), baseVersion: s.current.version })); } catch { /* đầy bộ nhớ — bỏ qua */ }
    }, 1000);
  };

  const markDirty = () => { s.current.dirty = true; setSaveState("dirty"); backup(); schedule(); };

  // Rời trang / ẩn tab → lưu ngay (keepalive để request vẫn đi khi đóng tab)
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && s.current.dirty) { clearTimeout(s.current.timer); save({ keepalive: true }); } };
    // Lưu bằng keepalive là đủ; chỉ hỏi "rời trang?" khi mất mạng (bản sửa lúc đó chỉ còn trong localStorage)
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!s.current.dirty) return;
      save({ keepalive: true });
      if (!navigator.onLine) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("beforeunload", onUnload); };
  }, [save]);

  const resolveConflict = async () => {
    const r = await Swal.fire({
      icon: "warning", title: "Trang vừa được sửa ở nơi khác",
      text: "Trang này đã được sửa ở thiết bị hoặc tab khác trong lúc bạn đang gõ. Bạn muốn giữ bản nào?",
      showDenyButton: true, showCancelButton: true, confirmButtonText: "Giữ bản của tôi", denyButtonText: "Lưu bản của tôi thành trang mới", cancelButtonText: "Dùng bản mới nhất",
      allowOutsideClick: false,
    });
    const fresh = await notesApi<FullPage>(`/pages/${pageId}`);
    if (r.isConfirmed) {
      s.current.version = fresh.version; s.current.dirty = true; save();
    } else if (r.isDenied) {
      const copy = await notesApi<PageItem>("/pages", { body: { sectionId: fresh.sectionId, title: `${s.current.title || "Không tiêu đề"} (bản của tôi)`, contentJson: s.current.doc, tags: fresh.tags } });
      s.current = { ...s.current, version: fresh.version, title: fresh.title, doc: fresh.contentJson, savedKey: stableKey(fresh.contentJson), savedTitle: fresh.title, dirty: false };
      localStorage.removeItem(backupKey(pageId));
      setPage(fresh); setTitle(fresh.title); setEditorKey((k) => k + 1); setSaveState("saved");
      refreshBoot();
      Swal.fire({ icon: "success", text: "Đã lưu bản của bạn thành trang mới.", timer: 1600, showConfirmButton: false });
      onChanged(copy);
    } else {
      s.current = { ...s.current, version: fresh.version, title: fresh.title, doc: fresh.contentJson, savedKey: stableKey(fresh.contentJson), savedTitle: fresh.title, dirty: false };
      localStorage.removeItem(backupKey(pageId));
      setPage(fresh); setTitle(fresh.title); setEditorKey((k) => k + 1); setSaveState("saved");
    }
  };

  // Đổi tên = sửa ô tiêu đề rồi lưu theo đường lưu tự động bình thường
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const renameViaDialog = async () => {
    const { value } = await Swal.fire({ title: "Đổi tên trang", input: "text", inputValue: s.current.title, inputPlaceholder: "Tên trang", showCancelButton: true, confirmButtonText: "Lưu", cancelButtonText: "Huỷ", inputAttributes: { maxlength: "300" } });
    if (value === undefined) return;
    const t = String(value).trim().slice(0, 300);
    if (t === s.current.title) return;
    setTitle(t); s.current.title = t; markDirty();
    await flush();
  };

  // Danh sách bên cạnh ghim/chuyển/lưu trữ trang này → cập nhật theo; đổi tên/xoá → giao cho trang làm
  useEffect(() => {
    const offChange = onPageChange((d) => {
      if (d.id !== pageId) return;
      setPage((p) => (p ? { ...p, ...("pinned" in d ? { pinned: !!d.pinned } : {}), ...("archivedAt" in d ? { archivedAt: d.archivedAt ?? null } : {}), ...("sectionId" in d ? { sectionId: d.sectionId ?? null } : {}), ...("parentId" in d ? { parentId: d.parentId ?? null } : {}) } : p));
    });
    const offCmd = onPageCommand((d) => {
      if (d.id !== pageId) return;
      if (d.action === "rename") renameViaDialog();
      if (d.action === "delete") remove();
    });
    return () => { offChange(); offCmd(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  // ── Sửa thuộc tính (không đụng version nội dung) ──
  const patchMeta = async (body: Record<string, unknown>, local: Partial<FullPage>) => {
    if (!page) return;
    setPage({ ...page, ...local });
    try {
      const r = await notesApi<PageItem>(`/pages/${page.id}`, { method: "PATCH", body });
      onChanged(r);
      if ("sectionId" in body || "archived" in body || "pinned" in body || "tags" in body || "study" in body) refreshBoot();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "").toLowerCase().replace(/\s+/g, "-");
    if (!page || !tag || page.tags.includes(tag)) { setTagInput(""); return; }
    patchMeta({ tags: [...page.tags, tag] }, { tags: [...page.tags, tag] });
    setTagInput("");
  };

  // ── Upload file trong trang ──
  const upload = useCallback(async (file: File): Promise<Attachment | null> => {
    try {
      const f = file.type.startsWith("image/") ? await compressImage(file) : file;
      if (f.size > 30 * 1024 * 1024) throw new Error("File tối đa 30MB");
      const form = new FormData();
      form.append("file", f);
      form.append("pageId", pageId);
      const att = await notesApi<Attachment>("/attachments", { form });
      setPage((p) => (p ? { ...p, attachments: [...p.attachments, att] } : p));
      return att;
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); return null; }
  }, [pageId]);

  // ── AI trên đoạn đang chọn (menu khi bôi đen / lệnh /) ──
  const onAi = async (action: AiSelectionAction, text: string) => {
    let prompt: string | undefined;
    if (action === "custom") {
      const r = await Swal.fire({ title: "Yêu cầu AI", input: "textarea", inputPlaceholder: "Ví dụ: Viết 3 câu ví dụ cho cấu trúc này", showCancelButton: true, confirmButtonText: "Gửi", cancelButtonText: "Huỷ" });
      if (!r.value || !String(r.value).trim()) return;
      prompt = String(r.value);
    }
    const label = { summarize: "Tóm tắt", rewrite_concise: "Viết lại", rewrite_formal: "Viết lại trang trọng", rewrite_simple: "Viết dễ hiểu", expand: "Viết dài hơn", shorten: "Rút gọn", translate_en: "Dịch sang tiếng Anh", translate_vi: "Dịch sang tiếng Việt", checklist: "Việc cần làm", table: "Bảng", explain: "Giải thích", continue: "Viết tiếp", custom: "Kết quả" }[action];
    setAiBusy(label);
    try {
      const r = await aiApi<{ html: string }>("/command", { body: { action, prompt, text: text || s.current.title, pageId } });
      setAiResult({ html: r.html, preview: await safeHtml(r.html), label });
      refreshBoot();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setAiBusy(""); }
  };
  const applyAi = (mode: "replace" | "below") => {
    const ed = editorRef.current;
    if (!ed || !aiResult) return;
    const { from, to, empty } = ed.state.selection;
    if (mode === "replace" && !empty) ed.chain().focus().insertContentAt({ from, to }, aiResult.html).run();
    else {
      const $to = ed.state.doc.resolve(to);
      const after = $to.depth > 0 ? $to.after(1) : to;
      ed.chain().focus().insertContentAt(after, aiResult.html).run();
    }
    setAiResult(null);
  };

  const insertMindmap = async () => {
    const ed = editorRef.current;
    if (!ed) return;
    setAiBusy("Sơ đồ tư duy");
    try {
      await flush();
      const sel = !ed.state.selection.empty ? ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to, "\n") : "";
      const r = await aiApi<{ root: unknown }>("/mindmap", { body: { pageId, text: sel || undefined } });
      ed.chain().focus().insertContentAt(ed.state.selection.to, { type: "mindmap", attrs: { data: JSON.stringify(r.root) } }).run();
      refreshBoot();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setAiBusy(""); }
  };

  const onRecorded = (r: RecordResult) => {
    const ed = editorRef.current;
    const att = r.attachment;
    if (att) setPage((p) => (p ? { ...p, attachments: [...p.attachments.filter((a) => a.id !== att.id), { ...att, transcript: r.transcript }] } : p));
    if (ed) {
      const chain = ed.chain().focus("end");
      if (att) chain.insertContent([{ type: "audioNote", attrs: { attachmentId: att.id, url: att.url, name: att.name } }]);
      chain.insertContent(r.html).run();
    }
    if (r.warning) Swal.fire({ icon: "warning", text: r.warning });
    if (!s.current.title.trim() && r.title) { setTitle(r.title); s.current.title = r.title; markDirty(); }
    refreshBoot();
  };

  const onOcrInsert = ({ image, html, title: t }: { image: Attachment | null; html: string; title?: string }) => {
    const ed = editorRef.current;
    if (!ed) return;
    const chain = ed.chain().focus("end");
    if (image) chain.insertContent({ type: "image", attrs: { src: image.url, alt: "Ảnh chụp vở/bảng" } });
    chain.insertContent(html).run();
    if (!s.current.title.trim() && t) { setTitle(t); s.current.title = t; markDirty(); }
    refreshBoot();
  };

  // ── Menu trang ──
  const moveTo = async () => {
    if (!page) return;
    const opts: Record<string, string> = { "": "Hộp thư ghi nhanh" };
    boot.notebooks.forEach((nb) => nb.sections.forEach((sec) => { opts[sec.id] = `${nb.name} / ${sec.name}`; }));
    const { value, isConfirmed } = await Swal.fire({ title: "Chuyển trang tới", input: "select", inputOptions: opts, inputValue: page.sectionId || "", showCancelButton: true, confirmButtonText: "Chuyển", cancelButtonText: "Huỷ" });
    if (!isConfirmed) return;
    await patchMeta({ sectionId: value || null, parentId: null }, { sectionId: value || null, parentId: null });
  };

  const remove = async () => {
    if (!page) return;
    const r = await Swal.fire({ icon: "warning", title: "Đưa trang vào thùng rác?", text: page.children.length ? `Kèm ${page.children.length} trang con. Khôi phục được trong 30 ngày.` : "Khôi phục được trong 30 ngày.", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
    if (!r.isConfirmed) return;
    clearTimeout(s.current.timer); s.current.dirty = false;
    try { await notesApi(`/pages/${page.id}`, { method: "DELETE" }); localStorage.removeItem(backupKey(page.id)); onRemoved(page.id); refreshBoot(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const restore = async () => {
    if (!page) return;
    try { await notesApi(`/pages/${page.id}/restore`, { body: {} }); setPage({ ...page, deletedAt: null }); refreshBoot(); onChanged({ id: page.id, deletedAt: null }); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const duplicate = async () => {
    if (!page) return;
    await flush();
    try { const r = await notesApi<PageItem>(`/pages/${page.id}/duplicate`, { body: {} }); onChanged(r); refreshBoot(); onOpenPage(r.id); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const remind = async () => {
    if (!page) return;
    const cur = page.remindAt ? new Date(page.remindAt) : null;
    const local = cur ? new Date(cur.getTime() - cur.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
    const r = await Swal.fire({ title: "Nhắc tôi xem lại trang này", input: "datetime-local", inputValue: local, showCancelButton: true, showDenyButton: !!cur, confirmButtonText: "Đặt nhắc", denyButtonText: "Bỏ nhắc", cancelButtonText: "Huỷ" });
    if (r.isDismissed) return;
    const remindAt = r.isDenied || !r.value ? null : new Date(String(r.value)).toISOString();
    patchMeta({ remindAt }, { remindAt });
  };
  const openHistory = async () => {
    await flush();
    try { setHistory(await notesApi(`/pages/${pageId}/revisions`)); } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const showRevision = async (id: string) => {
    try {
      const r = await notesApi<{ title: string; contentJson: JSONContent }>(`/revisions/${id}`);
      setPreview({ title: r.title, contentJson: r.contentJson });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const restoreRevision = () => {
    if (!preview || !editorRef.current) return;
    editorRef.current.commands.setContent(preview.contentJson);
    setTitle(preview.title); s.current.title = preview.title;
    s.current.doc = editorRef.current.getJSON(); markDirty();
    setPreview(null); setHistory(null);
  };
  const exportPdf = async () => {
    const ed = editorRef.current;
    if (!ed || !page) return;
    await exportPagePdf(s.current.title, ed.view.dom as HTMLElement, page.style);
  };
  const exportPng = async () => {
    const ed = editorRef.current;
    if (!ed || !page) return;
    await exportPagePng(s.current.title, ed.view.dom as HTMLElement, page.style);
  };
  const setStyle = (style: PageStyle | null) => { if (page) patchMeta({ style }, { style }); };
  const saveAsTemplate = async () => {
    if (!page) return;
    await flush();
    const { value } = await Swal.fire({
      title: "Lưu trang thành mẫu", html: '<p style="font-size:13px;color:#64748b;margin:0">Mẫu giữ nội dung, giao diện và thẻ hiện tại của trang. Dùng lại ở "+ Trang mới" › Mẫu của tôi.</p>',
      input: "text", inputValue: s.current.title || "", inputPlaceholder: "Tên mẫu", showCancelButton: true, confirmButtonText: "Lưu mẫu", cancelButtonText: "Huỷ",
    });
    if (!value?.trim()) return;
    try { await notesApi("/templates", { body: { pageId: page.id, name: value } }); Swal.fire({ icon: "success", text: "Đã lưu vào Mẫu của tôi.", timer: 1500, showConfirmButton: false }); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const studyReview = async (grade: "again" | "good" | "easy") => {
    if (!page) return;
    try {
      const r = await aiApi<{ studyDueAt: string | null; days: number; done: boolean }>(`/study/${page.id}/review`, { body: { grade } });
      setPage({ ...page, studyDueAt: r.studyDueAt });
      onChanged({ id: page.id, studyDueAt: r.studyDueAt });
      refreshBoot();
      Swal.fire({ icon: "success", text: r.done ? "Bạn đã ôn đủ các mốc — trang này thôi nhắc ôn." : `Hẹn ôn lại sau ${r.days} ngày.`, timer: 1500, showConfirmButton: false });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const sheet = useMemo(() => sheetCss(page?.style), [page?.style]);
  const attachmentsForEditor = useMemo(() => page?.attachments || [], [page?.attachments]);
  const files = (page?.attachments || []).filter((a) => a.kind === "FILE");

  if (error) return <div className="p-8 text-center"><p className="text-red-700">{error}</p>{onBack && <button type="button" onClick={onBack} className="btn-outline mt-4 px-5 py-2">Quay lại</button>}</div>;
  if (!page) return <Spinner label="Đang mở trang…" />;

  const SAVE_LABEL: Record<SaveState, string> = { saved: "Đã lưu", dirty: "Chưa lưu…", saving: "Đang lưu…", offline: "Mất mạng — đã lưu trong máy", error: "Lỗi lưu — đang thử lại" };
  const studyDue = page.studyDueAt && new Date(page.studyDueAt) <= new Date();

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto note-sheet" {...(sheet["--note-text"] ? { "data-text": "" } : {})} style={sheet}>
        <div className="max-w-3xl mx-auto px-4 sm:px-8 py-4 sm:py-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-3">
            {onBack && <button type="button" onClick={onBack} className="btn-ghost h-9 px-2 -ml-2 lg:hidden" aria-label="Quay lại danh sách">← Danh sách</button>}
            <span className="truncate">{page.section ? `${page.section.notebook.name} / ${page.section.name}` : "Hộp thư ghi nhanh"}</span>
            <span aria-live="polite" className={`ml-auto font-semibold ${saveState === "error" || saveState === "offline" ? "text-red-700" : ""}`}>{SAVE_LABEL[saveState]}</span>
          </div>

          {readOnly && (
            <div className="rounded-xl bg-red-50 text-red-800 p-3 mb-4 flex flex-wrap items-center gap-3 text-sm">
              Trang này đang ở thùng rác (chỉ xem).
              <button type="button" onClick={restore} className="btn-outline px-3 py-1.5 text-xs ml-auto">Khôi phục</button>
            </div>
          )}
          {studyDue && !readOnly && (
            <div className="rounded-xl bg-primary-soft p-3 mb-4 flex flex-wrap items-center gap-2 text-sm">
              <b className="text-primary">Đến hạn ôn trang này.</b> Đọc lại rồi tự đánh giá:
              <span className="flex gap-1.5 ml-auto">
                <button type="button" onClick={() => studyReview("again")} className="btn-outline px-3 py-1.5 text-xs">Chưa nhớ</button>
                <button type="button" onClick={() => studyReview("good")} className="btn-primary px-3 py-1.5 text-xs">Nhớ</button>
                <button type="button" onClick={() => studyReview("easy")} className="btn-outline px-3 py-1.5 text-xs">Rất dễ</button>
              </span>
            </div>
          )}

          <textarea ref={titleRef} value={title} readOnly={readOnly} rows={1} placeholder="Tiêu đề trang"
            onChange={(e) => { setTitle(e.target.value); s.current.title = e.target.value; markDirty(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); editorRef.current?.commands.focus("start"); } }}
            onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = `${t.scrollHeight}px`; }}
            className="note-title w-full resize-none overflow-hidden bg-transparent text-2xl sm:text-3xl font-extrabold placeholder:opacity-40 focus:outline-none leading-tight"
            aria-label="Tiêu đề trang" />

          <div className="flex flex-wrap items-center gap-1.5 mt-2 mb-4">
            {page.tags.map((t) => (
              <span key={t} className="ui-badge gap-1">#{t}{!readOnly && <button type="button" aria-label={`Bỏ thẻ ${t}`} className="ml-0.5 hover:text-red-700" onClick={() => patchMeta({ tags: page.tags.filter((x) => x !== t) }, { tags: page.tags.filter((x) => x !== t) })}>×</button>}</span>
            ))}
            {!readOnly && (
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="+ thẻ" list="note-tag-list"
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }} onBlur={() => tagInput && addTag(tagInput)}
                className="text-xs bg-transparent px-2 py-1 w-24 focus:outline-none focus:ring-1 focus:ring-primary rounded-full" aria-label="Thêm thẻ" />
            )}
            <datalist id="note-tag-list">{boot.tags.map((t) => <option key={t.tag} value={t.tag} />)}</datalist>
            {page.links.filter((l) => l.targetType !== "STUDENT").slice(0, 3).map((l) => <span key={l.id} className="ui-badge bg-primary-soft text-primary">{l.label}</span>)}
            {page.links.some((l) => l.targetType === "STUDENT") && <span className="ui-badge bg-amber-50 text-amber-800">Ghi chú về học viên · riêng tư</span>}
            {page.shares.length > 0 && <span className="ui-badge bg-emerald-50 text-emerald-700">Đang chia sẻ</span>}
            {page.remindAt && <span className="ui-badge bg-amber-50 text-amber-800">Nhắc {new Date(page.remindAt).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>}
          </div>

          {!readOnly && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button type="button" onClick={() => setPanel(panel === "ai" ? null : "ai")} className={`ui-chip text-xs ${panel === "ai" ? "ui-chip-active" : ""}`}>Trợ lý AI</button>
              <button type="button" onClick={() => setPanel(panel === "style" ? null : "style")} className={`ui-chip text-xs ${panel === "style" ? "ui-chip-active" : ""}`}>Giao diện</button>
              <button type="button" onClick={() => setPanel(panel === "links" ? null : "links")} className={`ui-chip text-xs ${panel === "links" ? "ui-chip-active" : ""}`}>Liên kết & chia sẻ{page.links.length + page.shares.length ? ` (${page.links.length + page.shares.length})` : ""}</button>
              <button type="button" onClick={() => patchMeta({ pinned: !page.pinned }, { pinned: !page.pinned })} className={`ui-chip text-xs ${page.pinned ? "ui-chip-active" : ""}`}>{page.pinned ? "Đã ghim" : "Ghim"}</button>
              <button type="button" onClick={remind} className="ui-chip text-xs">Nhắc tôi</button>
              <button type="button" onClick={() => patchMeta({ study: !page.studyDueAt }, { studyDueAt: page.studyDueAt ? null : new Date(Date.now() + 86400000).toISOString() })} className={`ui-chip text-xs ${page.studyDueAt ? "ui-chip-active" : ""}`} title="Nhắc ôn lại sau 1, 3, 7, 14, 30 ngày">{page.studyDueAt ? "Đang ôn lại" : "Ôn lại trang này"}</button>
              <details className="relative">
                <summary className="ui-chip text-xs list-none cursor-pointer [&::-webkit-details-marker]:hidden">Thêm ▾</summary>
                <div className="absolute z-30 mt-1 w-56 rounded-xl border border-line bg-white p-1 shadow-card-hover" onClick={(e) => (e.currentTarget.parentElement as HTMLDetailsElement).open = false}>
                  <p className="px-3 pt-2 pb-1 text-xs text-muted">Màu nhãn (chấm màu ở danh sách)</p>
                  <div className="flex gap-1 px-3 pb-2">{PAGE_COLORS.map((c) => <button key={String(c)} type="button" aria-label={c ? `Màu ${c}` : "Không màu"} onClick={() => patchMeta({ color: c }, { color: c })} className={`w-6 h-6 rounded-full border ${page.color === c ? "ring-2 ring-primary" : "border-line"}`} style={{ background: c || "#fff" }} />)}</div>
                  {[
                    ["Đổi tên", renameViaDialog], ["Trang con mới", () => onCreateChild(page.id)], ["Nhân bản", duplicate], ["Chuyển tới…", moveTo], ["Lịch sử phiên bản", openHistory],
                    ["Giao diện trang…", () => setPanel("style")], ["Lưu thành mẫu", saveAsTemplate],
                    ["Tải Markdown (.md)", async () => { await flush(); downloadMarkdown(s.current.title, editorRef.current?.getJSON() || null, page.tags); }], ["Tải ảnh PNG", exportPng], ["Tải PDF", exportPdf],
                    [page.archivedAt ? "Bỏ lưu trữ" : "Lưu trữ", () => patchMeta({ archived: !page.archivedAt }, { archivedAt: page.archivedAt ? null : new Date().toISOString() })],
                  ].map(([label, fn]) => <button key={label as string} type="button" onClick={fn as () => void} className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-primary-soft">{label as string}</button>)}
                  <button type="button" onClick={remove} className="w-full text-left rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50">Xoá trang</button>
                </div>
              </details>
            </div>
          )}

          {aiBusy && <div className="mb-3"><Spinner label={`AI: ${aiBusy}…`} /></div>}

          <NoteEditor key={editorKey} content={page.contentJson} editable={!readOnly} attachments={attachmentsForEditor}
            onReady={(ed) => { editorRef.current = ed; setEditorInst(ed); }}
            onChange={(doc) => { s.current.doc = doc; if (s.current.dirty || s.current.title !== s.current.savedTitle || stableKey(doc) !== s.current.savedKey) markDirty(); }}
            onUploadFile={upload} onOpenPage={onOpenPage} searchPages={searchPages}
            onAi={onAi} onRecord={() => setRecOpen(true)} onOcr={() => setOcrOpen(true)} onMindmap={insertMindmap}
            isStudent={boot.user.role === "STUDENT"} aiEnabled={!page.section?.notebook.aiDisabled && !boot.user.accessLocked} paperStyle={page.style} />

          {(page.children.length > 0 || files.length > 0) && (
            <div className="mt-10 pt-4 border-t border-line grid sm:grid-cols-2 gap-6">
              {page.children.length > 0 && (
                <div>
                  <p className="ui-label">Trang con</p>
                  <ul className="space-y-1">{page.children.map((c) => <li key={c.id}><button type="button" onClick={() => onOpenPage(c.id)} className="text-sm font-semibold text-primary hover:underline text-left">{c.title || "Không tiêu đề"}</button></li>)}</ul>
                </div>
              )}
              {files.length > 0 && (
                <div>
                  <p className="ui-label">File đính kèm</p>
                  <ul className="space-y-1">{files.map((f) => <li key={f.id}><a href={f.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">{f.name}</a></li>)}</ul>
                </div>
              )}
            </div>
          )}
          <p className="mt-8 text-xs text-muted">Tạo {timeAgo(page.createdAt)} · sửa {timeAgo(page.updatedAt)}</p>
        </div>
      </div>

      {panel && (
        <div className="fixed inset-0 z-[60] lg:static lg:z-auto lg:w-[360px] lg:border-l lg:border-line shrink-0 bg-white">
          {panel === "ai"
            ? <AiPanel page={page} editor={editorInst} boot={boot} flush={flush} onUsed={refreshBoot} onOpenPage={onOpenPage} onClose={() => setPanel(null)}
                onTitleTags={(t, tags) => { setTitle(t); s.current.title = t; markDirty(); const merged = [...new Set([...page.tags, ...tags])]; patchMeta({ tags: merged }, { tags: merged }); }} />
            : panel === "style" ? <StylePanel style={page.style} onChange={setStyle} onClose={() => setPanel(null)} onExportPng={exportPng} onExportPdf={exportPdf} />
            : <LinksPanel page={page} boot={boot} onChange={(patch) => setPage({ ...page, ...patch })} onOpenPage={onOpenPage} onClose={() => setPanel(null)} />}
        </div>
      )}

      <Recorder open={recOpen} onClose={() => setRecOpen(false)} pageId={page.id} usage={boot.usage} onDone={onRecorded} />
      <OcrCapture open={ocrOpen} onClose={() => setOcrOpen(false)} upload={upload} onInsert={onOcrInsert} aiLeft={boot.usage.TEXT.left} />

      <Modal open={!!aiResult} onClose={() => setAiResult(null)} title={aiResult?.label || ""} footer={
        <>
          <button type="button" className="btn-ghost px-4 py-2" onClick={() => setAiResult(null)}>Bỏ</button>
          <button type="button" className="btn-outline px-4 py-2" onClick={() => applyAi("below")}>Chèn bên dưới</button>
          {editorInst && !editorInst.state.selection.empty && <button type="button" className="btn-primary px-4 py-2" onClick={() => applyAi("replace")}>Thay đoạn đã chọn</button>}
        </>
      }>
        <div className="note-content text-sm" dangerouslySetInnerHTML={{ __html: aiResult?.preview || "" }} />
      </Modal>

      <Modal open={!!history} onClose={() => { setHistory(null); setPreview(null); }} title="Lịch sử phiên bản" wide footer={preview ? (
        <><button type="button" className="btn-ghost px-4 py-2" onClick={() => setPreview(null)}>Quay lại</button><button type="button" className="btn-primary px-4 py-2" onClick={restoreRevision}>Khôi phục bản này</button></>
      ) : undefined}>
        {preview ? (
          <div><p className="font-bold text-primary text-lg mb-2">{preview.title || "Không tiêu đề"}</p><NoteEditor content={preview.contentJson} editable={false} attachments={attachmentsForEditor} /></div>
        ) : history && !history.length ? <p className="text-sm text-muted">Chưa có bản cũ. Hệ thống tự chụp lại trang tối đa mỗi 10 phút khi bạn sửa (giữ 30 bản gần nhất).</p> : (
          <ul className="space-y-1">{history?.map((h) => <li key={h.id}><button type="button" onClick={() => showRevision(h.id)} className="w-full text-left rounded-xl border border-line px-3 py-2 hover:border-primary text-sm"><b>{new Date(h.createdAt).toLocaleString("vi-VN")}</b> · {h.title || "Không tiêu đề"}</button></li>)}</ul>
        )}
      </Modal>
    </div>
  );
}
