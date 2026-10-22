// Bộ extension Tiptap của Lucy Notes. Chỉ các node/mark ở đây được backend chấp nhận (NODE_TYPES/MARK_TYPES trong
// backend/src/utils/notesCore.js) — thêm node mới phải thêm ở cả 2 nơi.
import { Extension, Node, mergeAttributes, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { TableKit } from "@tiptap/extension-table";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { TextAlign } from "@tiptap/extension-text-align";
import { TextStyle, Color } from "@tiptap/extension-text-style";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import AudioNoteView from "./AudioNoteView";
import MindmapView from "./MindmapView";

export const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function formatDue(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Hôm nay ${time}` : `${d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** Việc cần làm: thêm tid (id ổn định để tick ở view "Việc cần làm") + due (hạn chót). */
const NoteTaskItem = TaskItem.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tid: { default: null, parseHTML: (el) => el.getAttribute("data-tid"), renderHTML: (a) => (a.tid ? { "data-tid": a.tid } : {}) },
      due: { default: null, parseHTML: (el) => el.getAttribute("data-due"), renderHTML: (a) => (a.due ? { "data-due": a.due } : {}) },
    };
  },
}).configure({ nested: true });

/** Gán tid cho taskItem mới / bị trùng (dán lại), và hiện nhãn hạn chót cuối mỗi việc bằng decoration. */
export const TaskMeta = Extension.create<{ onDueClick?: (pos: number) => void }>({
  name: "taskMeta",
  addOptions() { return { onDueClick: undefined }; },
  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin({
        key: new PluginKey("taskMetaIds"),
        appendTransaction(trs, _old, state) {
          if (!trs.some((t) => t.docChanged)) return null;
          const seen = new Set<string>();
          let tr = null as ReturnType<typeof state.tr.setNodeMarkup> | null;
          state.doc.descendants((node, pos) => {
            if (node.type.name !== "taskItem") return;
            const tid = node.attrs.tid as string | null;
            if (!tid || seen.has(tid)) {
              tr = (tr || state.tr).setNodeMarkup(pos, undefined, { ...node.attrs, tid: rid() });
            } else seen.add(tid);
          });
          return tr;
        },
      }),
      new Plugin({
        key: new PluginKey("taskMetaDue"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            const now = Date.now();
            state.doc.descendants((node, pos) => {
              if (node.type.name !== "taskItem" || !node.attrs.due) return;
              const first = node.firstChild;
              if (!first) return;
              const at = pos + 1 + first.nodeSize - 1;
              const overdue = !node.attrs.checked && new Date(node.attrs.due).getTime() < now;
              decos.push(Decoration.widget(at, () => {
                const el = document.createElement("button");
                el.type = "button";
                el.contentEditable = "false";
                el.className = `note-due${overdue ? " note-due-overdue" : ""}${node.attrs.checked ? " note-due-done" : ""}`;
                el.textContent = `Hạn ${formatDue(node.attrs.due)}`;
                el.title = "Bấm để đổi hạn";
                el.addEventListener("mousedown", (e) => { e.preventDefault(); options.onDueClick?.(pos); });
                return el;
              }, { side: 1, key: `due-${pos}-${node.attrs.due}-${node.attrs.checked}-${overdue}` }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes() {
    return { kind: { default: "info", parseHTML: (el) => el.getAttribute("data-callout") || "info", renderHTML: (a) => ({ "data-callout": a.kind }) } };
  },
  parseHTML() { return [{ tag: "div[data-callout]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { class: "note-callout" }), 0]; },
});

export const AudioNote = Node.create({
  name: "audioNote",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return { attachmentId: { default: null }, url: { default: null }, name: { default: "Ghi âm" } };
  },
  parseHTML() { return [{ tag: "div[data-audio-note]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-audio-note": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(AudioNoteView); },
});

export const Mindmap = Node.create({
  name: "mindmap",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() { return { data: { default: '{"label":"Chủ đề","children":[]}' } }; },
  parseHTML() { return [{ tag: "div[data-mindmap]", getAttrs: (el) => ({ data: (el as HTMLElement).getAttribute("data-mindmap") }) }]; },
  renderHTML({ HTMLAttributes }) { return ["div", { "data-mindmap": HTMLAttributes.data }]; },
  addNodeView() { return ReactNodeViewRenderer(MindmapView); },
});

export function buildExtensions({ placeholder = "Gõ / để chèn khối, [[ để liên kết trang khác…", onDueClick, editable = true }: {
  placeholder?: string; onDueClick?: (pos: number) => void; editable?: boolean;
} = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null } },
    }),
    TaskList,
    NoteTaskItem,
    TableKit.configure({ table: { resizable: editable } }),
    Highlight.configure({ multicolor: true }),
    Image.configure({ allowBase64: false }),
    TextStyle,
    Color,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder, includeChildren: false }),
    Callout,
    AudioNote,
    Mindmap,
    TaskMeta.configure({ onDueClick }),
  ];
}
