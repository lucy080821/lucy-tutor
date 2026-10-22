"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, useEditor, useEditorState, type Editor, type JSONContent } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import Swal from "sweetalert2";
import { buildExtensions } from "./extensions";
import { NoteEditorContext, seekAudio } from "./context";
import type { Attachment } from "../types";
import { API_URL } from "../api";
import { getSessionUserId } from "@/lib/session";
import { INLINE_HIGHLIGHTS, INLINE_TEXT_COLORS, linesCss, type PageStyle } from "../pageStyle";

export type AiSelectionAction = "summarize" | "rewrite_concise" | "rewrite_formal" | "rewrite_simple" | "expand" | "shorten" | "translate_en" | "translate_vi" | "checklist" | "table" | "explain" | "continue" | "custom";

type Props = {
  content: JSONContent | null;
  editable?: boolean;
  attachments?: Attachment[];
  onChange?: (doc: JSONContent) => void;
  onReady?: (editor: Editor) => void;
  onUploadFile?: (file: File) => Promise<{ url: string; kind: string; name: string; id: string } | null>;
  onOpenPage?: (id: string) => void;
  searchPages?: (q: string) => Promise<{ id: string; title: string }[]>;
  onAi?: (action: AiSelectionAction, text: string) => void;
  onRecord?: () => void;
  onOcr?: () => void;
  onMindmap?: () => void;
  isStudent?: boolean;
  aiEnabled?: boolean;
  /** Giao diện trang — kiểu giấy kẻ áp vào vùng nội dung */
  paperStyle?: PageStyle | null;
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();

type SlashItem = { id: string; label: string; hint: string; keywords: string; run: (e: Editor) => void };

function TB({ on, active, title, children, disabled }: { on: () => void; active?: boolean; title: string; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" title={title} aria-label={title} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={on}
      className={`h-9 min-w-9 px-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-40 ${active ? "bg-primary-soft text-primary" : "text-foreground/70 hover:bg-[#f3f6fb] hover:text-primary"}`}>
      {children}
    </button>
  );
}

const Ico = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] inline-block" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const I = {
  bullet: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ordered: "M10 6h10M10 12h10M10 18h10M4 5h1v4M4 9h2M4 14.5a1 1 0 0 1 2 0c0 1-2 1.5-2 3h2",
  task: "M4 5h4v4H4zM4 15h4v4H4zM5 17l1 1 2-2M12 7h8M12 17h8",
  quote: "M7 7h4v4H7c0 3 1 4 3 5M14 7h4v4h-4c0 3 1 4 3 5",
  code: "M8 8l-4 4 4 4M16 8l4 4-4 4M13.5 5l-3 14",
  table: "M3 5h18v14H3zM3 10h18M3 15h18M9 5v14M15 5v14",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15 9.5h.01",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  mic: "M9 4a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 10a7 7 0 0 0 14 0M12 17v3",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  undo: "M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  redo: "M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3",
  callout: "M12 8v5M12 16h.01M4 4h16v16H4z",
  hr: "M4 12h16",
  mind: "M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M5 5m-1.8 0a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M19 5m-1.8 0a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M5 19m-1.8 0a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M19 19m-1.8 0a1.8 1.8 0 1 0 3.6 0 1.8 1.8 0 1 0-3.6 0M10.2 10.2L6.3 6.3M13.8 10.2l3.9-3.9M10.2 13.8l-3.9 3.9M13.8 13.8l3.9 3.9",
};

/** Bảng chọn màu chữ / màu tô cho đoạn đang chọn (giữ vùng chọn nhờ onMouseDown preventDefault) */
function ColorPicker({ editor, kind, onDone }: { editor: Editor; kind: "text" | "hl"; onDone: () => void }) {
  const colors = kind === "text" ? INLINE_TEXT_COLORS : INLINE_HIGHLIGHTS;
  const apply = (c: string | null) => {
    const chain = editor.chain().focus();
    if (kind === "text") { if (c) chain.setColor(c).run(); else chain.unsetColor().run(); }
    else if (c) chain.setHighlight({ color: c }).run(); else chain.unsetHighlight().run();
    onDone();
  };
  return (
    <div className="fixed left-4 right-4 bottom-4 z-[75] sm:absolute sm:z-40 sm:top-full sm:mt-1 sm:left-0 sm:right-auto sm:bottom-auto sm:w-[212px] rounded-xl border border-line bg-white p-2 shadow-card-hover" onMouseDown={(e) => e.preventDefault()}>
      <p className="text-[11px] font-bold text-muted mb-1.5">{kind === "text" ? "Màu chữ" : "Màu tô nền chữ"}</p>
      <div className="grid grid-cols-6 gap-1.5">
        {colors.map((c) => (
          <button key={c} type="button" onClick={() => apply(c)} aria-label={`Chọn màu ${c}`} title={c}
            className="w-7 h-7 rounded-lg border border-line flex items-center justify-center font-bold text-sm" style={kind === "text" ? { color: c } : { background: c }}>
            {kind === "text" ? "A" : ""}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
          <input type="color" className="w-7 h-7 rounded border border-line p-0" onChange={(e) => apply(e.target.value)} aria-label="Màu tuỳ chọn" />Tuỳ chọn
        </label>
        <button type="button" onClick={() => apply(null)} className="ml-auto text-xs font-bold text-primary hover:underline">Bỏ màu</button>
      </div>
    </div>
  );
}

async function setDue(editor: Editor, pos: number) {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "taskItem") return;
  const cur = node.attrs.due ? new Date(node.attrs.due) : null;
  const local = cur ? new Date(cur.getTime() - cur.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const res = await Swal.fire({
    title: "Hạn chót của việc này", input: "datetime-local", inputValue: local,
    showCancelButton: true, showDenyButton: !!cur, confirmButtonText: "Lưu", denyButtonText: "Bỏ hạn", cancelButtonText: "Huỷ",
  });
  if (res.isDismissed) return;
  const due = res.isDenied || !res.value ? null : new Date(String(res.value)).toISOString();
  editor.chain().command(({ tr }) => { tr.setNodeMarkup(pos, undefined, { ...node.attrs, due }); return true; }).run();
}

/** Tìm taskItem chứa con trỏ (để đặt hạn từ thanh công cụ/lệnh /). */
function currentTaskPos(editor: Editor): number | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d -= 1) {
    if ($from.node(d).type.name === "taskItem") return $from.before(d);
  }
  return null;
}

export default function NoteEditor({
  content, editable = true, attachments = [], onChange, onReady, onUploadFile, onOpenPage, searchPages, onAi, onRecord, onOcr, onMindmap, isStudent, aiEnabled = true, paperStyle,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const uploadRef = useRef(onUploadFile);
  uploadRef.current = onUploadFile;
  const createdAtRef = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  // Menu "/" và "[[": vị trí, truy vấn, mục đang chọn — lưu trong ref để handleKeyDown (tạo 1 lần) đọc được
  const [menu, setMenu] = useState<{ kind: "slash" | "page"; query: string; from: number; top: number; left: number } | null>(null);
  const [menuIndex, setMenuIndex] = useState(0);
  const [pageHits, setPageHits] = useState<{ id: string; title: string }[]>([]);
  const menuRef = useRef<{ open: boolean; onKey: (e: KeyboardEvent) => boolean }>({ open: false, onKey: () => false });
  const [colorMenu, setColorMenu] = useState<"" | "text" | "hl" | "btext" | "bhl">("");
  const [lookup, setLookup] = useState<{ word: string; top: number; left: number; loading: boolean; data?: any; error?: string; added?: boolean } | null>(null);

  const uploadAndInsert = async (files: File[], pos?: number) => {
    const ed = editorRef.current;
    if (!ed || !uploadRef.current) return;
    for (const file of files.slice(0, 10)) {
      const att = await uploadRef.current(file);
      if (!att) continue;
      const node = att.kind === "IMAGE"
        ? { type: "image", attrs: { src: att.url, alt: att.name } }
        : att.kind === "AUDIO"
          ? { type: "audioNote", attrs: { attachmentId: att.id, url: att.url, name: att.name } }
          : { type: "paragraph", content: [{ type: "text", text: att.name, marks: [{ type: "link", attrs: { href: att.url } }] }] };
      if (pos !== undefined) ed.chain().focus().insertContentAt(pos, node).run();
      else ed.chain().focus().insertContent(node).run();
    }
  };

  // extensions/editorProps/content phải giữ nguyên tham chiếu giữa các lần render: useEditor so sánh option mỗi lần
  // render và gọi setOptions nếu khác → object mới mỗi lần làm trình soạn cập nhật liên tục (vòng lặp cập nhật)
  const editableRef = useRef(editable);
  editableRef.current = editable;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const extensions = useMemo(() => buildExtensions({ editable, onDueClick: (pos) => { if (editorRef.current && editableRef.current) setDue(editorRef.current, pos); } }), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialContent = useMemo(() => content || { type: "doc", content: [{ type: "paragraph" }] }, []);
  const editorProps = useMemo(() => ({
      attributes: { class: "note-content focus:outline-none", spellcheck: "true" },
      handleKeyDown: (_view: unknown, event: KeyboardEvent) => (menuRef.current.open ? menuRef.current.onKey(event) : false),
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const files = Array.from(event.clipboardData?.files || []);
        if (!files.length || !uploadRef.current) return false;
        event.preventDefault();
        uploadAndInsert(files);
        return true;
      },
      handleDrop: (view: import("@tiptap/pm/view").EditorView, event: DragEvent, _slice: unknown, moved: boolean) => {
        const files = Array.from(event.dataTransfer?.files || []);
        if (moved || !files.length || !uploadRef.current) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        uploadAndInsert(files, pos);
        return true;
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions,
    content: initialContent,
    editorProps,
    onCreate: () => { createdAtRef.current = Date.now(); },
    // Ngay sau khi tải, các plugin tự chuẩn hoá tài liệu (sửa bảng, gán tid cho việc cần làm…) và phát ra thay đổi —
    // không coi đó là người dùng sửa, tránh trang vừa mở đã "Đang lưu…" và tăng version vô ích
    onUpdate: ({ editor: ed }) => { if (Date.now() - createdAtRef.current > 600) changeRef.current?.(ed.getJSON()); },
  });

  useEffect(() => {
    if (!editor) return;
    editorRef.current = editor;
    onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => { editor?.setEditable(editable); }, [editor, editable]);

  // Phát hiện "/lệnh" hoặc "[[tên trang" ngay trước con trỏ. Gom về 1 lần mỗi khung hình (requestAnimationFrame) và chỉ
  // setState khi giá trị đổi: sự kiện transaction có thể bắn đồng bộ trong lúc Tiptap flushSync vẽ node view — setState
  // ngay tại đó gây lỗi "Maximum update depth exceeded".
  useEffect(() => {
    if (!editor || !editable) return;
    let frame = 0;
    const check = () => {
      frame = 0;
      if (editor.isDestroyed) return;
      const { state, view } = editor;
      const { $from, empty } = state.selection;
      let next: typeof menu = null;
      if (empty && $from.parent.isTextblock && $from.parent.type.name !== "codeBlock") {
        const before = $from.parent.textBetween(0, $from.parentOffset, undefined, "￼");
        const slash = /(?:^|\s)\/([\p{L}\d]{0,20})$/u.exec(before);
        const page = /\[\[([^\]\n]{0,40})$/.exec(before);
        const hit = page ? { kind: "page" as const, query: page[1], len: page[0].length } : slash ? { kind: "slash" as const, query: slash[1], len: slash[1].length + 1 } : null;
        const box = wrapRef.current?.getBoundingClientRect();
        if (hit && box) {
          const coords = view.coordsAtPos($from.pos);
          next = { kind: hit.kind, query: hit.query, from: $from.pos - hit.len, top: Math.round(coords.bottom - box.top + 6), left: Math.round(Math.min(coords.left - box.left, box.width - 280)) };
        }
      }
      setMenu((prev) => {
        if (!prev && !next) return prev;
        if (prev && next && prev.kind === next.kind && prev.query === next.query && prev.from === next.from && prev.top === next.top && prev.left === next.left) return prev;
        return next;
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(check); };
    editor.on("transaction", schedule);
    return () => { editor.off("transaction", schedule); if (frame) cancelAnimationFrame(frame); };
  }, [editor, editable]);

  // Di chuyển con trỏ sang chỗ khác → đóng bảng chọn màu
  useEffect(() => {
    if (!editor) return;
    const close = () => setColorMenu("");
    editor.on("selectionUpdate", close);
    return () => { editor.off("selectionUpdate", close); };
  }, [editor]);

  // Đổi truy vấn → về mục đầu tiên
  useEffect(() => { setMenuIndex(0); }, [menu?.kind, menu?.query]);

  const slashItems: SlashItem[] = useMemo(() => {
    const items: SlashItem[] = [
      { id: "p", label: "Văn bản", hint: "Đoạn văn thường", keywords: "text van ban doan", run: (e) => e.chain().focus().setParagraph().run() },
      { id: "h1", label: "Tiêu đề lớn", hint: "Heading 1", keywords: "h1 tieu de heading", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
      { id: "h2", label: "Tiêu đề vừa", hint: "Heading 2", keywords: "h2 tieu de heading", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
      { id: "h3", label: "Tiêu đề nhỏ", hint: "Heading 3", keywords: "h3 tieu de heading", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
      { id: "ul", label: "Danh sách", hint: "Gạch đầu dòng", keywords: "list danh sach bullet", run: (e) => e.chain().focus().toggleBulletList().run() },
      { id: "ol", label: "Danh sách số", hint: "1, 2, 3", keywords: "so number ordered", run: (e) => e.chain().focus().toggleOrderedList().run() },
      { id: "todo", label: "Việc cần làm", hint: "Checklist có hạn chót", keywords: "todo viec checklist task", run: (e) => e.chain().focus().toggleTaskList().run() },
      { id: "due", label: "Đặt hạn cho việc này", hint: "Hạn chót + nhắc việc", keywords: "han deadline nhac", run: (e) => { const p = currentTaskPos(e); if (p !== null) setDue(e, p); else Swal.fire({ icon: "info", text: "Đặt con trỏ vào 1 việc cần làm trước." }); } },
      { id: "quote", label: "Trích dẫn", hint: "Blockquote", keywords: "quote trich dan", run: (e) => e.chain().focus().toggleBlockquote().run() },
      { id: "callout", label: "Ghi chú nổi bật", hint: "Lưu ý / mẹo / cảnh báo", keywords: "callout luu y meo canh bao", run: (e) => e.chain().focus().wrapIn("callout", { kind: "info" }).run() },
      { id: "warn", label: "Lỗi hay gặp", hint: "Khối cảnh báo màu đỏ", keywords: "loi canh bao warning", run: (e) => e.chain().focus().wrapIn("callout", { kind: "error" }).run() },
      { id: "code", label: "Khối code", hint: "Code block", keywords: "code ma", run: (e) => e.chain().focus().toggleCodeBlock().run() },
      { id: "table", label: "Bảng", hint: "3 × 3", keywords: "table bang", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { id: "vocab", label: "Bảng từ vựng", hint: "Từ · Phiên âm · Nghĩa · Ví dụ", keywords: "tu vung vocab bang", run: (e) => e.chain().focus().insertContent('<table><tr><th>Từ</th><th>Phiên âm</th><th>Nghĩa</th><th>Ví dụ</th></tr><tr><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td></tr></table>').run() },
      { id: "hr", label: "Đường kẻ", hint: "Ngăn cách", keywords: "hr ke ngang divider", run: (e) => e.chain().focus().setHorizontalRule().run() },
      { id: "pagelink", label: "Liên kết trang", hint: "Gõ [[ để tìm trang", keywords: "lien ket link trang", run: (e) => e.chain().focus().insertContent("[[").run() },
    ];
    if (onUploadFile) items.push({ id: "image", label: "Ảnh / file", hint: "Tải lên từ máy", keywords: "anh image file tai len", run: () => pickFiles() });
    if (onRecord) items.push({ id: "rec", label: "Ghi âm thành ghi chú", hint: "AI chép lời + có mốc thời gian", keywords: "ghi am record audio", run: () => onRecord() });
    if (onOcr) items.push({ id: "ocr", label: "Chụp vở / bảng", hint: "Ảnh → chữ → trang sạch", keywords: "chup vo ocr anh bang", run: () => onOcr() });
    if (onMindmap && aiEnabled) items.push({ id: "mind", label: "Sơ đồ tư duy (AI)", hint: "Từ nội dung trang", keywords: "so do tu duy mindmap", run: () => onMindmap() });
    if (onAi && aiEnabled) {
      items.push({ id: "aicont", label: "AI viết tiếp", hint: "Dựa trên phần đã viết", keywords: "ai viet tiep continue", run: (e) => onAi("continue", e.state.doc.textBetween(Math.max(0, e.state.selection.from - 4000), e.state.selection.from, "\n")) });
      items.push({ id: "aiask", label: "Hỏi AI…", hint: "Yêu cầu tự do, chèn tại đây", keywords: "ai hoi yeu cau", run: (e) => onAi("custom", e.state.doc.textBetween(Math.max(0, e.state.selection.from - 4000), e.state.selection.from, "\n")) });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRecord, onOcr, onMindmap, onAi, onUploadFile, aiEnabled]);

  const filtered = useMemo(() => {
    if (!menu || menu.kind !== "slash") return [];
    const q = norm(menu.query);
    return slashItems.filter((it) => !q || norm(it.label).includes(q) || it.keywords.includes(q)).slice(0, 12);
  }, [menu, slashItems]);

  // Tìm trang cho "[["
  useEffect(() => {
    if (menu?.kind !== "page" || !searchPages) return;
    let alive = true;
    const t = setTimeout(() => { searchPages(menu.query).then((r) => { if (alive) setPageHits(r.slice(0, 8)); }).catch(() => {}); }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [menu?.kind, menu?.query, searchPages]);

  const choose = (index: number) => {
    const ed = editorRef.current;
    if (!ed || !menu) return;
    const to = ed.state.selection.from;
    if (menu.kind === "slash") {
      const item = filtered[index];
      if (!item) return;
      ed.chain().focus().deleteRange({ from: menu.from, to }).run();
      setMenu(null);
      item.run(ed);
    } else {
      const hit = pageHits[index];
      if (!hit) return;
      ed.chain().focus().deleteRange({ from: menu.from, to })
        .insertContent([{ type: "text", text: hit.title || "Không tiêu đề", marks: [{ type: "link", attrs: { href: `/notes?p=${hit.id}` } }] }, { type: "text", text: " " }]).run();
      setMenu(null);
    }
  };

  const count = menu?.kind === "slash" ? filtered.length : pageHits.length;
  menuRef.current = {
    open: !!menu && count > 0,
    onKey: (e) => {
      if (e.key === "ArrowDown") { setMenuIndex((i) => (i + 1) % count); return true; }
      if (e.key === "ArrowUp") { setMenuIndex((i) => (i - 1 + count) % count); return true; }
      if (e.key === "Enter" || e.key === "Tab") { choose(menuIndex); return true; }
      if (e.key === "Escape") { setMenu(null); return true; }
      return false;
    },
  };

  const pickFiles = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = "image/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
    input.onchange = () => uploadAndInsert(Array.from(input.files || []));
    input.click();
  };

  // Bấm link: "#t=" → phát ghi âm đúng đoạn, "/notes?p=" → mở trang trong app, còn lại mở tab mới
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    if (!a || !wrapRef.current?.contains(a)) return;
    const href = a.getAttribute("href") || "";
    if (href.startsWith("#t=")) {
      e.preventDefault();
      const params = new URLSearchParams(href.slice(1));
      seekAudio(wrapRef.current, params.get("a"), Number(params.get("t")) || 0);
      return;
    }
    const m = /^\/notes\?p=([0-9a-f-]{36})/i.exec(href);
    if (m) { e.preventDefault(); onOpenPage?.(m[1]); return; }
    if (/^https?:\/\//.test(href) && (!editable || e.ctrlKey || e.metaKey)) { e.preventDefault(); window.open(href, "_blank", "noopener"); }
  };

  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) => ed ? {
      bold: ed.isActive("bold"), italic: ed.isActive("italic"), underline: ed.isActive("underline"), strike: ed.isActive("strike"),
      h1: ed.isActive("heading", { level: 1 }), h2: ed.isActive("heading", { level: 2 }), h3: ed.isActive("heading", { level: 3 }),
      bullet: ed.isActive("bulletList"), ordered: ed.isActive("orderedList"), task: ed.isActive("taskList"), quote: ed.isActive("blockquote"),
      code: ed.isActive("codeBlock"), table: ed.isActive("table"), link: ed.isActive("link"), canUndo: ed.can().undo(), canRedo: ed.can().redo(),
    } : null,
  });

  const setLink = async () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href || "";
    const { value, isDenied, isDismissed } = await Swal.fire({
      title: "Gắn liên kết", input: "url", inputValue: prev, inputPlaceholder: "https://…",
      showCancelButton: true, showDenyButton: !!prev, confirmButtonText: "Lưu", denyButtonText: "Bỏ liên kết", cancelButtonText: "Huỷ",
    });
    if (isDismissed) return;
    if (isDenied || !value) editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: String(value) }).run();
  };

  const selectedText = () => (editor ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "");

  const doLookup = async () => {
    if (!editor) return;
    const word = selectedText().trim();
    if (!word || word.split(/\s+/).length > 6) { Swal.fire({ icon: "info", text: "Hãy bôi đen 1 từ hoặc cụm từ ngắn (tối đa 6 từ)." }); return; }
    const { $from, to } = editor.state.selection;
    const sentence = $from.parent.textContent.slice(0, 600) || word;
    const coords = editor.view.coordsAtPos(to);
    const box = wrapRef.current!.getBoundingClientRect();
    const pos = { top: coords.bottom - box.top + 8, left: Math.max(0, Math.min(coords.left - box.left - 120, box.width - 300)) };
    setLookup({ word, ...pos, loading: true });
    try {
      const r = await fetch(`${API_URL}/api/ai/lookup-word`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ word, sentence }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "Không tra được từ này");
      setLookup({ word, ...pos, loading: false, data });
    } catch (err) {
      setLookup({ word, ...pos, loading: false, error: (err as Error).message });
    }
  };

  const addLookupToSrs = async () => {
    if (!lookup?.data) return;
    try {
      const r = await fetch(`${API_URL}/api/srs/vocab/custom`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: getSessionUserId(), word: lookup.data.word || lookup.word, meaning: lookup.data.meaning, phonetic: lookup.data.phonetic, pos: lookup.data.pos, example: editor?.state.selection.$from.parent.textContent.slice(0, 300) }),
      });
      if (!r.ok) throw new Error();
      setLookup({ ...lookup, added: true });
    } catch {
      Swal.fire({ icon: "error", text: "Không thêm được từ vào Từ Của Tôi" });
    }
  };

  const speak = () => {
    const text = selectedText().trim();
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i.test(text) ? "vi-VN" : "en-US";
    u.rate = 0.95;
    window.speechSynthesis.speak(u);
  };

  const ctx = useMemo(() => ({ attachments: Object.fromEntries(attachments.map((a) => [a.id, a])), editable }), [attachments, editable]);

  if (!editor) return <div className="min-h-[300px] animate-pulse rounded-xl bg-background" />;

  return (
    <NoteEditorContext.Provider value={ctx}>
      {editable && state && (
        <div className="sticky top-0 z-20 -mx-1 mb-3 flex flex-nowrap sm:flex-wrap items-center gap-0.5 overflow-x-auto sm:overflow-visible rounded-xl border border-line bg-white/95 px-1 py-1 shadow-card [&>*]:shrink-0">
          <TB title="Hoàn tác (Ctrl+Z)" on={() => editor.chain().focus().undo().run()} disabled={!state.canUndo}><Ico d={I.undo} /></TB>
          <TB title="Làm lại (Ctrl+Y)" on={() => editor.chain().focus().redo().run()} disabled={!state.canRedo}><Ico d={I.redo} /></TB>
          <span className="w-px h-6 bg-line mx-1" />
          <TB title="Tiêu đề lớn" active={state.h1} on={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</TB>
          <TB title="Tiêu đề vừa" active={state.h2} on={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</TB>
          <TB title="Tiêu đề nhỏ" active={state.h3} on={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</TB>
          <span className="w-px h-6 bg-line mx-1" />
          <TB title="In đậm (Ctrl+B)" active={state.bold} on={() => editor.chain().focus().toggleBold().run()}><b>B</b></TB>
          <TB title="In nghiêng (Ctrl+I)" active={state.italic} on={() => editor.chain().focus().toggleItalic().run()}><i>I</i></TB>
          <TB title="Gạch chân (Ctrl+U)" active={state.underline} on={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></TB>
          <TB title="Gạch ngang" active={state.strike} on={() => editor.chain().focus().toggleStrike().run()}><s>S</s></TB>
          <span className="relative">
            <TB title="Màu chữ" active={colorMenu === "text"} on={() => setColorMenu(colorMenu === "text" ? "" : "text")}>
              <span className="inline-flex flex-col items-center leading-none">A<span className="block w-4 h-1 rounded mt-0.5" style={{ background: editor.getAttributes("textStyle").color || "#111827" }} /></span>
            </TB>
            {colorMenu === "text" && <ColorPicker editor={editor} kind="text" onDone={() => setColorMenu("")} />}
          </span>
          <span className="relative">
            <TB title="Màu tô nền chữ" active={colorMenu === "hl"} on={() => setColorMenu(colorMenu === "hl" ? "" : "hl")}><span className="px-1 rounded" style={{ background: editor.getAttributes("highlight").color || "#fef08a" }}>A</span></TB>
            {colorMenu === "hl" && <ColorPicker editor={editor} kind="hl" onDone={() => setColorMenu("")} />}
          </span>
          <TB title="Gắn liên kết" active={state.link} on={setLink}><Ico d={I.link} /></TB>
          <span className="w-px h-6 bg-line mx-1" />
          <TB title="Danh sách" active={state.bullet} on={() => editor.chain().focus().toggleBulletList().run()}><Ico d={I.bullet} /></TB>
          <TB title="Danh sách số" active={state.ordered} on={() => editor.chain().focus().toggleOrderedList().run()}><Ico d={I.ordered} /></TB>
          <TB title="Việc cần làm" active={state.task} on={() => editor.chain().focus().toggleTaskList().run()}><Ico d={I.task} /></TB>
          <TB title="Trích dẫn" active={state.quote} on={() => editor.chain().focus().toggleBlockquote().run()}><Ico d={I.quote} /></TB>
          <TB title="Ghi chú nổi bật" on={() => editor.chain().focus().wrapIn("callout", { kind: "info" }).run()}><Ico d={I.callout} /></TB>
          <TB title="Khối code" active={state.code} on={() => editor.chain().focus().toggleCodeBlock().run()}><Ico d={I.code} /></TB>
          <TB title="Chèn bảng" active={state.table} on={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Ico d={I.table} /></TB>
          {onUploadFile && <TB title="Chèn ảnh / file" on={pickFiles}><Ico d={I.image} /></TB>}
          {onRecord && <TB title="Ghi âm thành ghi chú" on={onRecord}><Ico d={I.mic} /></TB>}
          {onOcr && <TB title="Chụp vở / bảng thành chữ" on={onOcr}><Ico d={I.camera} /></TB>}
          {onMindmap && aiEnabled && <TB title="Sơ đồ tư duy (AI)" on={onMindmap}><Ico d={I.mind} /></TB>}
          {state.table && (
            <span className="flex flex-wrap gap-0.5 ml-1 pl-1 border-l border-line">
              <TB title="Thêm hàng" on={() => editor.chain().focus().addRowAfter().run()}>+Hàng</TB>
              <TB title="Thêm cột" on={() => editor.chain().focus().addColumnAfter().run()}>+Cột</TB>
              <TB title="Xoá hàng" on={() => editor.chain().focus().deleteRow().run()}>−Hàng</TB>
              <TB title="Xoá cột" on={() => editor.chain().focus().deleteColumn().run()}>−Cột</TB>
              <TB title="Xoá bảng" on={() => editor.chain().focus().deleteTable().run()}>Xoá bảng</TB>
            </span>
          )}
        </div>
      )}

      <div ref={wrapRef} className={`relative ${paperStyle?.paper && paperStyle.paper !== "plain" ? "note-lined" : ""}`} style={linesCss(paperStyle)} onClick={onClick}>
        {editable && (
          <BubbleMenu editor={editor} options={{ placement: "top", flip: true, shift: { padding: 8 } }}
            shouldShow={({ editor: ed, state: st }) => !st.selection.empty && !ed.isActive("image") && !ed.isActive("audioNote") && !ed.isActive("mindmap")}>
            <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-line bg-white p-1 shadow-card-hover max-w-[min(92vw,560px)]">
              <TB title="In đậm" active={editor.isActive("bold")} on={() => editor.chain().focus().toggleBold().run()}><b>B</b></TB>
              <TB title="In nghiêng" active={editor.isActive("italic")} on={() => editor.chain().focus().toggleItalic().run()}><i>I</i></TB>
              <TB title="Gạch chân" active={editor.isActive("underline")} on={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></TB>
              <span className="relative">
                <TB title="Màu chữ" active={colorMenu === "btext"} on={() => setColorMenu(colorMenu === "btext" ? "" : "btext")}><span style={{ color: editor.getAttributes("textStyle").color || "#1E3A8A" }}>A</span>▾</TB>
                {colorMenu === "btext" && <ColorPicker editor={editor} kind="text" onDone={() => setColorMenu("")} />}
              </span>
              <span className="relative">
                <TB title="Tô nền chữ" active={colorMenu === "bhl"} on={() => setColorMenu(colorMenu === "bhl" ? "" : "bhl")}><span className="px-1 rounded bg-[#fef08a]">A</span>▾</TB>
                {colorMenu === "bhl" && <ColorPicker editor={editor} kind="hl" onDone={() => setColorMenu("")} />}
              </span>
              <TB title="Gắn liên kết" active={editor.isActive("link")} on={setLink}><Ico d={I.link} /></TB>
              <span className="w-px h-6 bg-line mx-0.5" />
              <TB title="Tra nghĩa theo ngữ cảnh" on={doLookup}>Tra nghĩa</TB>
              <TB title="Nghe đọc" on={speak}>Nghe</TB>
              {onAi && aiEnabled && (
                <>
                  <span className="w-px h-6 bg-line mx-0.5" />
                  <TB title="AI tóm tắt đoạn này" on={() => onAi("summarize", selectedText())}>Tóm tắt</TB>
                  <TB title="AI viết lại gọn hơn" on={() => onAi("rewrite_concise", selectedText())}>Viết lại</TB>
                  <TB title="AI dịch Anh ↔ Việt" on={() => onAi(/[ăâđêôơư]/i.test(selectedText()) ? "translate_en" : "translate_vi", selectedText())}>Dịch</TB>
                  <TB title="AI giải thích" on={() => onAi("explain", selectedText())}>Giải thích</TB>
                  <TB title="AI tách thành việc cần làm" on={() => onAi("checklist", selectedText())}>Thành việc</TB>
                </>
              )}
            </div>
          </BubbleMenu>
        )}

        <EditorContent editor={editor} />

        {menu && count > 0 && (
          <div className="absolute z-30 w-[280px] max-h-80 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-card-hover" style={{ top: menu.top, left: Math.max(0, menu.left) }} role="listbox">
            {menu.kind === "slash" ? filtered.map((it, i) => (
              <button key={it.id} type="button" role="option" aria-selected={i === menuIndex} onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setMenuIndex(i)}
                className={`w-full text-left rounded-lg px-3 py-2 ${i === menuIndex ? "bg-primary-soft" : ""}`}>
                <span className="block text-sm font-bold text-foreground">{it.label}</span>
                <span className="block text-xs text-muted">{it.hint}</span>
              </button>
            )) : pageHits.map((p, i) => (
              <button key={p.id} type="button" role="option" aria-selected={i === menuIndex} onMouseDown={(e) => { e.preventDefault(); choose(i); }} onMouseEnter={() => setMenuIndex(i)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm font-semibold truncate ${i === menuIndex ? "bg-primary-soft text-primary" : ""}`}>
                {p.title || "Không tiêu đề"}
              </button>
            ))}
          </div>
        )}

        {lookup && (
          <div className="absolute z-30 w-[300px] rounded-xl border border-line bg-white p-4 shadow-card-hover" style={{ top: lookup.top, left: lookup.left }}>
            <div className="flex items-start gap-2">
              <p className="font-bold text-primary text-lg leading-tight break-words">{lookup.data?.word || lookup.word}</p>
              <button type="button" className="ml-auto btn-ghost w-8 h-8 p-0 text-lg" aria-label="Đóng" onClick={() => setLookup(null)}>×</button>
            </div>
            {lookup.loading && <p className="text-sm text-muted mt-2">Đang tra theo ngữ cảnh…</p>}
            {lookup.error && <p className="text-sm text-red-700 mt-2">{lookup.error}</p>}
            {lookup.data && (
              <>
                <p className="text-sm text-muted mt-1">{[lookup.data.phonetic, lookup.data.pos].filter(Boolean).join(" · ")}</p>
                <p className="text-sm mt-2">{lookup.data.meaning}</p>
                {isStudent && (
                  <button type="button" disabled={lookup.added} onClick={addLookupToSrs} className="btn-outline w-full mt-3 py-2 text-sm">
                    {lookup.added ? "✓ Đã thêm vào Từ Của Tôi" : "+ Thêm vào Từ Của Tôi"}
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </NoteEditorContext.Provider>
  );
}
