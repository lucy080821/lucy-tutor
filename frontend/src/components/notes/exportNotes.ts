// Xuất ghi chú: Markdown (1 trang hoặc cả kho dạng ZIP kèm JSON gốc) — để người dùng không bị khoá dữ liệu trong app.
import type { JSONContent } from "@tiptap/react";
import { notesApi } from "./api";
import { linesCss, sheetCss, type PageStyle } from "./pageStyle";

function inline(nodes: JSONContent[] = []): string {
  return nodes.map((n) => {
    if (n.type === "hardBreak") return "  \n";
    if (n.type !== "text") return inline(n.content);
    let s = n.text || "";
    for (const m of n.marks || []) {
      if (m.type === "bold") s = `**${s}**`;
      else if (m.type === "italic") s = `*${s}*`;
      else if (m.type === "strike") s = `~~${s}~~`;
      else if (m.type === "code") s = `\`${s}\``;
      else if (m.type === "highlight") s = `==${s}==`;
      else if (m.type === "link") s = `[${s}](${m.attrs?.href || ""})`;
    }
    return s;
  }).join("");
}

function block(n: JSONContent, indent = ""): string {
  switch (n.type) {
    case "heading": return `${"#".repeat(n.attrs?.level || 2)} ${inline(n.content)}`;
    case "paragraph": return `${indent}${inline(n.content)}`;
    case "bulletList": return (n.content || []).map((li) => listItem(li, `${indent}- `, indent)).join("\n");
    case "orderedList": return (n.content || []).map((li, i) => listItem(li, `${indent}${i + 1}. `, indent)).join("\n");
    case "taskList": return (n.content || []).map((li) => listItem(li, `${indent}- [${li.attrs?.checked ? "x" : " "}] `, indent, li.attrs?.due)).join("\n");
    case "blockquote": return (n.content || []).map((c) => `> ${block(c)}`).join("\n");
    case "callout": return (n.content || []).map((c) => `> **${({ info: "Lưu ý", tip: "Mẹo", warning: "Cảnh báo", error: "Lỗi hay gặp" } as Record<string, string>)[n.attrs?.kind] || "Lưu ý"}:** ${block(c)}`).join("\n");
    case "codeBlock": return `\`\`\`\n${inline(n.content)}\n\`\`\``;
    case "horizontalRule": return "---";
    case "image": return `![${n.attrs?.alt || ""}](${n.attrs?.src})`;
    case "audioNote": return `[Ghi âm: ${n.attrs?.name || ""}](${n.attrs?.url || ""})`;
    case "mindmap": {
      try {
        const lines: string[] = [];
        const walk = (x: { label: string; children?: unknown[] }, d: number) => { lines.push(`${"  ".repeat(d)}- ${x.label}`); (x.children as typeof x[] || []).forEach((c) => walk(c, d + 1)); };
        walk(JSON.parse(n.attrs?.data || "{}"), 0);
        return lines.join("\n");
      } catch { return ""; }
    }
    case "table": {
      const rows = (n.content || []).map((r) => (r.content || []).map((c) => (c.content || []).map((x) => inline(x.content)).join(" ").replace(/\|/g, "\\|")));
      if (!rows.length) return "";
      const head = `| ${rows[0].join(" | ")} |`;
      const sep = `| ${rows[0].map(() => "---").join(" | ")} |`;
      return [head, sep, ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`)].join("\n");
    }
    default: return (n.content || []).map((c) => block(c, indent)).join("\n\n");
  }
}

function listItem(li: JSONContent, prefix: string, indent: string, due?: string | null) {
  const [first, ...rest] = li.content || [];
  const dueText = due ? ` (hạn ${new Date(due).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })})` : "";
  const head = `${prefix}${first ? inline(first.content) : ""}${dueText}`;
  const nested = rest.map((c) => block(c, `${indent}  `)).join("\n");
  return nested ? `${head}\n${nested}` : head;
}

export function docToMarkdown(title: string, doc: JSONContent | null, tags: string[] = []) {
  const body = (doc?.content || []).map((n) => block(n)).filter((s) => s !== undefined).join("\n\n");
  return `# ${title || "Không tiêu đề"}\n\n${tags.length ? `${tags.map((t) => `#${t}`).join(" ")}\n\n` : ""}${body}\n`;
}

const fileSafe = (s: string) => (s || "khong-tieu-de").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "trang";

export async function downloadMarkdown(title: string, doc: JSONContent | null, tags: string[]) {
  const { saveAs } = await import("file-saver");
  saveAs(new Blob([docToMarkdown(title, doc, tags)], { type: "text/markdown;charset=utf-8" }), `${fileSafe(title)}.md`);
}

/** Xuất toàn bộ ghi chú: mỗi trang 1 file .md theo thư mục Sổ/Mục + notes.json (dữ liệu gốc để nhập lại). */
export async function exportAll(onProgress?: (n: number, total: number) => void) {
  const [{ default: JSZip }, { saveAs }] = await Promise.all([import("jszip"), import("file-saver")]);
  const zip = new JSZip();
  const all: unknown[] = [];
  let cursor = "";
  let total = 0;
  for (let i = 0; i < 100; i += 1) {
    const r = await notesApi<{ pages: any[]; next: string | null; total: number }>(`/export?cursor=${encodeURIComponent(cursor)}`);
    if (r.total !== undefined) total = r.total;
    for (const pg of r.pages) {
      all.push(pg);
      const folder = pg.section ? `${fileSafe(pg.section.notebook.name)}/${fileSafe(pg.section.name)}` : "Hop-thu-ghi-nhanh";
      zip.file(`${folder}/${fileSafe(pg.title)}-${pg.id.slice(0, 6)}.md`, docToMarkdown(pg.title, pg.contentJson, pg.tags));
    }
    onProgress?.(all.length, total);
    if (!r.next) break;
    cursor = r.next;
  }
  zip.file("notes.json", JSON.stringify(all, null, 1));
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `lucy-notes-${new Date().toISOString().slice(0, 10)}.zip`);
  return all.length;
}

// ── Xuất ảnh PNG / PDF đúng giao diện trang (nền, giấy kẻ, font, màu chữ) ──

/** Dựng 1 bản sao tĩnh của trang (ngoài màn hình) theo giao diện đã chọn để chụp thành ảnh. Nhớ remove() sau khi dùng. */
function buildSnapshot(title: string, editorDom: HTMLElement, style: PageStyle | null) {
  const box = document.createElement("div");
  box.className = "note-sheet";
  const sheet = sheetCss(style);
  if (sheet["--note-text"]) box.setAttribute("data-text", "");
  Object.entries(sheet).forEach(([k, v]) => { if (k.startsWith("--")) box.style.setProperty(k, String(v)); });
  box.style.cssText += `;position:relative;width:794px;padding:44px 48px 56px;box-sizing:border-box;background-color:${style?.bg || "#ffffff"};color:var(--note-text, #1f2d3d);`;
  const head = document.createElement("div");
  head.innerHTML = `<h1 class="note-title" style="font-size:28px;font-weight:800;line-height:1.25;margin:0 0 4px">${(title || "Không tiêu đề").replace(/[<&]/g, (c) => (c === "<" ? "&lt;" : "&amp;"))}</h1><p style="font-size:12px;margin:0 0 20px;opacity:.6">Lucy Notes · ${new Date().toLocaleDateString("vi-VN")}</p>`;
  box.appendChild(head);
  const body = document.createElement("div");
  const lines = linesCss(style);
  if (style?.paper && style.paper !== "plain") body.className = "note-lined";
  Object.assign(body.style, lines);
  const clone = editorDom.cloneNode(true) as HTMLElement;
  clone.removeAttribute("contenteditable");
  clone.style.minHeight = "0";
  clone.querySelectorAll("button, audio, .ProseMirror-gapcursor").forEach((n) => n.remove());
  body.appendChild(clone);
  box.appendChild(body);
  // Lớp ngoài nằm ngoài màn hình; chụp lớp trong (vị trí bình thường) — chụp thẳng phần tử fixed/left âm ra ảnh trống
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;pointer-events:none";
  host.appendChild(box);
  document.body.appendChild(host);
  return { box, remove: () => host.remove() };
}

const safeName = (title: string) => (title || "ghi-chu").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "ghi-chu";

export async function exportPagePng(title: string, editorDom: HTMLElement, style: PageStyle | null) {
  const { box, remove } = buildSnapshot(title, editorDom, style);
  try {
    const { toPng } = await import("html-to-image");
    // Canvas trình duyệt giới hạn khoảng 16.000px mỗi chiều → trang rất dài thì giảm độ phân giải
    const pixelRatio = Math.max(0.6, Math.min(2, 15000 / Math.max(1, box.scrollHeight)));
    const url = await toPng(box, { pixelRatio, cacheBust: true, backgroundColor: style?.bg || "#ffffff" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName(title)}.png`;
    a.click();
  } finally { remove(); }
}

export async function exportPagePdf(title: string, editorDom: HTMLElement, style: PageStyle | null) {
  const { box, remove } = buildSnapshot(title, editorDom, style);
  try {
    const { exportNodeToPDF } = await import("@/lib/pdfExport");
    await exportNodeToPDF(box, `${safeName(title)}.pdf`);
  } finally { remove(); }
}
