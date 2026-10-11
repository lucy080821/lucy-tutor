"use client";
import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";

// Bảng màu highlight — màu nhạt để chữ vẫn đọc rõ
export const HIGHLIGHT_COLORS = [
  { name: "Vàng", value: "#fde68a" },
  { name: "Xanh lá", value: "#bbf7d0" },
  { name: "Xanh dương", value: "#bfdbfe" },
  { name: "Hồng", value: "#fbcfe8" },
  { name: "Cam", value: "#fed7aa" },
  { name: "Tím", value: "#ddd6fe" },
  { name: "Xanh ngọc", value: "#99f6e4" },
  { name: "Đỏ", value: "#fecaca" },
];

const COLOR_KEY = "lucy_highlight_color";
const MARK_SELECTOR = "mark.user-hl";

type Menu = { top: number; left: number; markId?: string };
type NoteEditor = { markId: string; top: number; left: number; text: string };
// Dạng lưu trữ (server): vị trí ký tự [start, end) trong textContent của khối văn bản + đoạn chữ để
// đối chiếu — nếu bài đọc bị sửa làm lệch vị trí thì tự dò lại theo `text`.
export type StoredHighlight = { id: string; start: number; end: number; text: string; color: string; note?: string };

// id duy nhất cho mỗi lần highlight (kèm thời điểm để không trùng id đã lưu từ lần tải trang trước)
let hlSeq = 0;
function nextHighlightId() {
  return `hl-${Date.now().toString(36)}-${hlSeq++}`;
}

function markTitle(note?: string) {
  return note ? `📝 ${note}\n\n(Chuột phải để sửa ghi chú / đổi màu / xoá)` : "Chuột phải để đổi màu, ghi chú hoặc xoá";
}

// Bọc từng text node giao với vùng chọn trong 1 <mark> riêng (an toàn hơn surroundContents trên
// cả range — sẽ throw khi vùng chọn cắt qua nhiều thẻ HTML). Mọi mảnh cùng 1 lần bôi đen dùng
// chung data-hl-id để đổi màu / ghi chú / xoá tác động lên cả highlight.
function wrapRange(range: Range, color: string, hlId: string) {
  if (range.collapsed) return false;
  let root: Node = range.commonAncestorContainer;
  if (root.nodeType === Node.TEXT_NODE) root = root.parentNode as Node;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => (range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  });
  const nodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) nodes.push(n as Text);
  let wrapped = false;
  nodes.forEach((textNode) => {
    const start = textNode === range.startContainer ? range.startOffset : 0;
    const end = textNode === range.endContainer ? range.endOffset : textNode.length;
    if (start >= end || !textNode.parentNode || !textNode.data.slice(start, end).trim()) return;
    const sub = document.createRange();
    sub.setStart(textNode, start);
    sub.setEnd(textNode, end);
    const mark = document.createElement("mark");
    mark.className = "user-hl";
    mark.dataset.hlId = hlId;
    mark.dataset.color = color;
    mark.style.backgroundColor = color;
    mark.title = markTitle();
    try { sub.surroundContents(mark); wrapped = true; } catch {}
  });
  return wrapped;
}

// Đọc toàn bộ highlight đang có trong DOM ra dạng lưu trữ (gộp các mảnh cùng id)
function serializeHighlights(root: HTMLElement, notes: Record<string, string>): StoredHighlight[] {
  const fullText = root.textContent || "";
  const byId = new Map<string, StoredHighlight>();
  root.querySelectorAll<HTMLElement>(MARK_SELECTOR).forEach((mark) => {
    const id = mark.dataset.hlId;
    if (!id) return;
    const r = document.createRange();
    r.setStart(root, 0);
    r.setEndBefore(mark);
    const start = r.toString().length;
    const end = start + (mark.textContent || "").length;
    const cur = byId.get(id);
    if (cur) { cur.start = Math.min(cur.start, start); cur.end = Math.max(cur.end, end); }
    else byId.set(id, { id, start, end, text: "", color: mark.dataset.color || HIGHLIGHT_COLORS[0].value });
  });
  return [...byId.values()].map((h) => ({ ...h, text: fullText.slice(h.start, h.end), ...(notes[h.id] ? { note: notes[h.id] } : {}) }));
}

// Đổi vị trí ký tự → (text node, offset) để dựng Range
function locate(root: HTMLElement, offset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let n: Node | null;
  let last: Text | null = null;
  while ((n = walker.nextNode())) {
    const t = n as Text;
    if (offset <= pos + t.length) return { node: t, offset: offset - pos };
    pos += t.length;
    last = t;
  }
  return last ? { node: last, offset: last.length } : null;
}

// Vẽ lại highlight đã lưu lên DOM; trả về map ghi chú của các highlight vẽ được
function restoreHighlights(root: HTMLElement, list: StoredHighlight[]) {
  const notes: Record<string, string> = {};
  const fullText = root.textContent || "";
  for (const h of list) {
    let start = h.start;
    if (h.text && fullText.slice(h.start, h.end) !== h.text) {
      // Bài đọc đã bị sửa → tìm lần xuất hiện của đoạn chữ gần vị trí cũ nhất
      let best = -1;
      for (let i = fullText.indexOf(h.text); i !== -1; i = fullText.indexOf(h.text, i + 1)) {
        if (best === -1 || Math.abs(i - h.start) < Math.abs(best - h.start)) best = i;
      }
      if (best === -1) continue;
      start = best;
    }
    const end = start + (h.text ? h.text.length : h.end - h.start);
    if (end > fullText.length) continue;
    const a = locate(root, start);
    const b = locate(root, end);
    if (!a || !b) continue;
    const range = document.createRange();
    range.setStart(a.node, a.offset);
    range.setEnd(b.node, b.offset);
    if (!wrapRange(range, h.color, h.id)) continue;
    if (h.note) {
      notes[h.id] = h.note;
      root.querySelectorAll<HTMLElement>(`${MARK_SELECTOR}[data-hl-id="${h.id}"]`).forEach((m) => {
        m.classList.add("user-hl-noted");
        m.title = markTitle(h.note);
      });
    }
  }
  return notes;
}

/**
 * Khối văn bản (HTML) cho phép học viên highlight nhiều màu + ghi chú gắn theo từng highlight.
 * Mọi thao tác qua chuột phải: bôi đen → chuột phải → chọn màu / ghi chú; chuột phải vào chỗ đã
 * highlight → đổi màu, sửa ghi chú, xoá. Điện thoại: ấn giữ ~0,45s thay cho chuột phải.
 * Nội dung được gắn vào DOM 1 lần (không qua dangerouslySetInnerHTML) nên trang re-render (vd đồng
 * hồ đếm giờ mỗi giây) không xoá mất highlight. Lưu trữ do trang cha lo: `initialHighlights` vẽ
 * lại lúc mở, `onChange` nhận toàn bộ danh sách mới sau mỗi thao tác (để gửi lên server).
 */
export default function HighlightableHtml({ html, initialHighlights, onChange, className }: {
  html: string;
  initialHighlights?: StoredHighlight[];
  onChange?: (highlights: StoredHighlight[]) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [noteEditor, setNoteEditor] = useState<NoteEditor | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  // Màu chỉ hiện trong menu (không render lúc SSR) nên đọc localStorage ngay khi khởi tạo được
  const [color, setColor] = useState(() => {
    try { return (typeof window !== "undefined" && localStorage.getItem(COLOR_KEY)) || HIGHLIGHT_COLORS[0].value; } catch { return HIGHLIGHT_COLORS[0].value; }
  });

  // Gắn nội dung vào DOM rồi vẽ lại highlight đã lưu
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = DOMPurify.sanitize(html);
    const restoredNotes = initialHighlights?.length ? restoreHighlights(ref.current, initialHighlights) : {};
    setNotes(restoredNotes);
  }, [html, initialHighlights]);

  const persist = (nextNotes: Record<string, string>) => {
    if (!onChange || !ref.current) return;
    onChange(serializeHighlights(ref.current, nextNotes));
  };

  const marksOf = (id: string) => ref.current?.querySelectorAll<HTMLElement>(`${MARK_SELECTOR}[data-hl-id="${id}"]`) ?? [];

  const selectionInside = () => {
    const sel = window.getSelection();
    return !!sel && !sel.isCollapsed && sel.rangeCount > 0 && !!ref.current?.contains(sel.getRangeAt(0).commonAncestorContainer);
  };

  const openMenu = (x: number, y: number, markId?: string) => {
    const left = Math.min(Math.max(x, 190), window.innerWidth - 190);
    setNoteEditor(null);
    setMenu({ top: Math.max(y - 56, 8), left, markId });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    const mark = (e.target as HTMLElement).closest(MARK_SELECTOR) as HTMLElement | null;
    if (!mark && !selectionInside()) return; // để menu chuột phải mặc định
    e.preventDefault();
    openMenu(e.clientX, e.clientY, mark?.dataset.hlId);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10 || Date.now() - start.time < 450) return;
    const mark = (e.target as HTMLElement).closest(MARK_SELECTOR) as HTMLElement | null;
    if (!mark && !selectionInside()) return;
    e.preventDefault();
    openMenu(t.clientX, t.clientY, mark?.dataset.hlId);
  };

  // Bấm ra ngoài thì đóng menu / ô ghi chú
  useEffect(() => {
    if (!menu && !noteEditor) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menu && !menuRef.current?.contains(target)) setMenu(null);
      if (noteEditor && !noteRef.current?.contains(target)) setNoteEditor(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setMenu(null); setNoteEditor(null); } };
    const onScroll = () => setMenu(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [menu, noteEditor]);

  const createFromSelection = (c: string) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const id = nextHighlightId();
    const ok = wrapRange(sel.getRangeAt(0), c, id);
    sel.removeAllRanges();
    return ok ? id : null;
  };

  const pickColor = (c: string) => {
    if (menu?.markId) marksOf(menu.markId).forEach((m) => { m.style.backgroundColor = c; m.dataset.color = c; });
    else createFromSelection(c);
    setColor(c);
    try { localStorage.setItem(COLOR_KEY, c); } catch {}
    setMenu(null);
    persist(notes);
  };

  const openNote = () => {
    if (!menu) return;
    const id = menu.markId || createFromSelection(color);
    setMenu(null);
    if (!id) return;
    if (!menu.markId) persist(notes); // highlight mới tạo được lưu ngay, kể cả khi bấm Huỷ ghi chú
    setNoteEditor({ markId: id, top: menu.top, left: menu.left, text: notes[id] || "" });
  };

  const saveNote = () => {
    if (!noteEditor) return;
    const text = noteEditor.text.trim();
    const next = { ...notes };
    if (text) next[noteEditor.markId] = text; else delete next[noteEditor.markId];
    marksOf(noteEditor.markId).forEach((m) => {
      m.classList.toggle("user-hl-noted", !!text);
      m.title = markTitle(text);
    });
    setNotes(next);
    setNoteEditor(null);
    persist(next);
  };

  const removeHighlight = () => {
    const id = menu?.markId;
    setMenu(null);
    if (!id) return;
    marksOf(id).forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
    const next = { ...notes };
    delete next[id];
    setNotes(next);
    persist(next);
  };

  const menuNote = menu?.markId ? notes[menu.markId] : undefined;

  return (
    <>
      <div ref={ref} className={className} onContextMenu={onContextMenu} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} />

      {menu && (
        <div
          ref={menuRef}
          role="menu"
          style={{ position: "fixed", top: menu.top, left: menu.left, transform: "translateX(-50%)", zIndex: 300 }}
          className="bg-surface border border-line rounded-2xl shadow-card-hover p-2 w-[min(360px,calc(100vw-24px))]"
        >
          <div className="flex items-center gap-1.5 flex-wrap justify-center">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => pickColor(c.value)}
                title={c.name}
                aria-label={`Highlight màu ${c.name}`}
                style={{ backgroundColor: c.value }}
                className={`w-8 h-8 rounded-full border border-black/10 cursor-pointer transition-transform hover:scale-110 ${color === c.value ? "ring-2 ring-primary ring-offset-2" : ""}`}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line">
            <button onClick={openNote} className="flex-1 px-3 py-2 rounded-full text-xs font-bold text-primary hover:bg-primary-soft cursor-pointer">
              {menuNote ? "Sửa ghi chú" : "Thêm ghi chú"}
            </button>
            {menu.markId && (
              <button onClick={removeHighlight} className="flex-1 px-3 py-2 rounded-full text-xs font-bold text-red-700 hover:bg-red-50 cursor-pointer">
                Xoá highlight
              </button>
            )}
          </div>
          {menuNote && <p className="mt-2 px-2 text-xs text-muted line-clamp-3 whitespace-pre-wrap">📝 {menuNote}</p>}
        </div>
      )}

      {noteEditor && (
        <div
          ref={noteRef}
          style={{ position: "fixed", top: noteEditor.top, left: noteEditor.left, transform: "translateX(-50%)", zIndex: 301 }}
          className="w-[min(288px,calc(100vw-24px))] bg-surface border border-line rounded-2xl shadow-card-hover p-3"
        >
          <p className="text-xs font-bold text-primary mb-2">Ghi chú cho đoạn đã highlight</p>
          <textarea
            autoFocus
            value={noteEditor.text}
            onChange={(e) => setNoteEditor((p) => (p ? { ...p, text: e.target.value } : p))}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveNote(); }}
            rows={3}
            placeholder="Gõ ghi chú... (Ctrl+Enter để lưu)"
            className="w-full p-2 ui-input text-sm resize-none"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => setNoteEditor(null)} className="btn-ghost px-3 py-2 text-xs cursor-pointer">Huỷ</button>
            <button onClick={saveNote} className="btn-primary px-4 py-2 text-xs cursor-pointer">Lưu</button>
          </div>
        </div>
      )}
    </>
  );
}
