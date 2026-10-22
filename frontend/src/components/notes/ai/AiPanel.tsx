"use client";
// Bảng AI bên phải trang ghi chú. Mọi kết quả AI ở dạng xem trước — người dùng bấm "Chèn/Thay thế" mới đổi trang.
import { useState } from "react";
import Swal from "sweetalert2";
import type { Editor } from "@tiptap/react";
import { aiApi, errMsg } from "../api";
import { Spinner, safeHtml } from "../ui";
import type { Bootstrap, FullPage } from "../types";
import { rid } from "../editor/extensions";
import { FlashcardTool, QuizTool, FeynmanTool } from "./LearnTools";
import { JournalTool, UnknownWordsTool, ParallelTool } from "./EnglishTools";
import TeacherTools from "./TeacherTools";

const WRITE_ACTIONS: [string, string][] = [
  ["summarize", "Tóm tắt 5 ý chính"], ["outline", "Lập dàn ý"], ["rewrite_concise", "Viết lại gọn, rõ"], ["rewrite_formal", "Văn phong trang trọng"],
  ["rewrite_simple", "Viết dễ hiểu cho học sinh"], ["expand", "Viết dài hơn, thêm ví dụ"], ["shorten", "Rút gọn một nửa"],
  ["translate_en", "Dịch sang tiếng Anh"], ["translate_vi", "Dịch sang tiếng Việt"], ["checklist", "Tách thành việc cần làm"], ["table", "Chuyển thành bảng"],
];

type Tab = "write" | "learn" | "english" | "links" | "class";

export default function AiPanel({ page, editor, boot, flush, onUsed, onOpenPage, onClose, onTitleTags }: {
  page: FullPage; editor: Editor | null; boot: Bootstrap; flush: () => Promise<void>; onUsed: () => void;
  onOpenPage: (id: string) => void; onClose: () => void; onTitleTags: (title: string, tags: string[]) => void;
}) {
  const [tab, setTab] = useState<Tab>("write");
  const [learn, setLearn] = useState<"cards" | "quiz" | "feynman">("cards");
  const [eng, setEng] = useState<"journal" | "words" | "parallel">("journal");
  const [loading, setLoading] = useState("");
  const [result, setResult] = useState<{ html: string; preview: string; label: string } | null>(null);
  const [tasks, setTasks] = useState<{ text: string; due: string | null }[] | null>(null);
  const [links, setLinks] = useState<{ pageId: string; title: string; reason: string }[] | null>(null);
  const isStudent = boot.user.role === "STUDENT";
  const disabled = page.section?.notebook.aiDisabled;
  const usage = boot.usage.TEXT;

  const runWrite = async (action: string, label: string, custom?: string) => {
    setLoading(label); setResult(null);
    try {
      await flush();
      const sel = editor && !editor.state.selection.empty ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "";
      const r = await aiApi<{ html: string }>("/command", { body: { pageId: page.id, action, prompt: custom, text: sel || undefined } });
      setResult({ html: r.html, preview: await safeHtml(r.html), label: sel ? `${label} (đoạn đã chọn)` : label });
      onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };

  const custom = async () => {
    const { value } = await Swal.fire({ title: "Yêu cầu AI", input: "textarea", inputPlaceholder: "Ví dụ: Viết 5 câu ví dụ dùng các từ trong trang này", showCancelButton: true, confirmButtonText: "Gửi", cancelButtonText: "Huỷ" });
    if (value && String(value).trim()) runWrite("custom", "Yêu cầu riêng", String(value));
  };

  const insert = (mode: "end" | "replace") => {
    if (!editor || !result) return;
    if (mode === "replace") {
      if (!editor.state.selection.empty) editor.chain().focus().insertContentAt({ from: editor.state.selection.from, to: editor.state.selection.to }, result.html).run();
      else editor.chain().focus().setContent(result.html).run();
    } else editor.chain().focus("end").insertContent(result.html).run();
    setResult(null);
  };

  const titleTags = async () => {
    setLoading("title");
    try {
      await flush();
      const r = await aiApi<{ title: string; tags: string[] }>("/title-tags", { body: { pageId: page.id } });
      onUsed();
      const ok = await Swal.fire({ title: "Gợi ý của AI", html: `<p><b>${r.title.replace(/</g, "&lt;")}</b></p><p style="color:#64748b">${r.tags.map((t) => `#${t}`).join(" ")}</p>`, showCancelButton: true, confirmButtonText: "Dùng", cancelButtonText: "Bỏ qua" });
      if (ok.isConfirmed) onTitleTags(r.title, r.tags);
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };

  const extractTasks = async () => {
    setLoading("tasks"); setTasks(null);
    try {
      await flush();
      const sel = editor && !editor.state.selection.empty ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "";
      const r = await aiApi<{ tasks: { text: string; due: string | null }[] }>("/extract-tasks", { body: { pageId: page.id, text: sel || undefined } });
      setTasks(r.tasks); onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const insertTasks = () => {
    if (!editor || !tasks?.length) return;
    editor.chain().focus("end").insertContent({
      type: "taskList",
      content: tasks.map((t) => ({ type: "taskItem", attrs: { checked: false, tid: rid(), due: t.due }, content: [{ type: "paragraph", content: [{ type: "text", text: t.text }] }] })),
    }).run();
    setTasks(null);
  };

  const suggest = async () => {
    setLoading("links");
    try { await flush(); const r = await aiApi<{ suggestions: any[] }>("/suggest-links", { body: { pageId: page.id } }); setLinks(r.suggestions); onUsed(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const addLink = (l: { pageId: string; title: string }) => {
    editor?.chain().focus("end").insertContent([{ type: "paragraph", content: [{ type: "text", text: "Xem thêm: " }, { type: "text", text: l.title, marks: [{ type: "link", attrs: { href: `/notes?p=${l.pageId}` } }] }] }]).run();
    setLinks((ls) => ls?.filter((x) => x.pageId !== l.pageId) || null);
  };

  const tabs: [Tab, string][] = [["write", "Viết"], ["learn", "Học"], ["english", "Tiếng Anh"], ["links", "Liên kết"], ...(boot.user.role === "TEACHER" ? [["class", "Lớp học"] as [Tab, string]] : [])];
  const common = { pageId: page.id, flush, onUsed };

  return (
    <aside className="flex flex-col h-full bg-white" aria-label="Trợ lý AI">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <h2 className="font-bold text-primary">Trợ lý AI</h2>
        <span className="text-xs text-muted" title="Lượt AI hôm nay">Còn {usage.left}/{usage.limit} lượt</span>
        <button type="button" onClick={onClose} className="ml-auto btn-ghost w-9 h-9 p-0 text-xl" aria-label="Đóng trợ lý AI">×</button>
      </div>
      {disabled || boot.user.accessLocked ? (
        <p className="p-4 text-sm text-muted">{boot.user.accessLocked ? "Tài khoản đang bị khoá nên AI tạm ngưng. Ghi chú vẫn xem và sửa bình thường." : "Sổ tay này đang tắt AI — nội dung không được gửi cho AI. Bật lại trong menu của sổ tay ở cột trái."}</p>
      ) : (
        <>
          <div className="flex gap-1 px-3 pt-3 flex-wrap">
            {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={`ui-chip text-xs ${tab === id ? "ui-chip-active" : ""}`}>{label}</button>)}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "write" && (
              <div className="space-y-3">
                <p className="text-xs text-muted">Bôi đen 1 đoạn để AI chỉ xử lý đoạn đó; không bôi đen thì xử lý cả trang.</p>
                {loading && loading !== "title" && loading !== "tasks" ? <Spinner label={`AI: ${loading}…`} /> : result ? (
                  <div className="space-y-2">
                    <p className="ui-label">{result.label}</p>
                    <div className="rounded-xl border border-line p-3 max-h-80 overflow-y-auto note-content text-sm" dangerouslySetInnerHTML={{ __html: result.preview }} />
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" onClick={() => insert("end")} className="btn-primary py-2 text-sm">Chèn vào cuối</button>
                      <button type="button" onClick={async () => { const ok = await Swal.fire({ icon: "question", text: editor?.state.selection.empty ? "Thay toàn bộ nội dung trang bằng kết quả này? (Hoàn tác được bằng Ctrl+Z)" : "Thay đoạn đang chọn bằng kết quả này?", showCancelButton: true, confirmButtonText: "Thay", cancelButtonText: "Huỷ" }); if (ok.isConfirmed) insert("replace"); }} className="btn-outline py-2 text-sm">Thay thế</button>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(result.preview.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()); }} className="btn-ghost py-2 text-sm">Sao chép chữ</button>
                      <button type="button" onClick={() => setResult(null)} className="btn-ghost py-2 text-sm">Bỏ</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5">
                    {WRITE_ACTIONS.map(([id, label]) => <button key={id} type="button" onClick={() => runWrite(id, label)} className="btn-outline justify-start px-3 py-2 text-sm text-left">{label}</button>)}
                    <button type="button" onClick={custom} className="btn-outline justify-start px-3 py-2 text-sm">Yêu cầu khác…</button>
                    <button type="button" onClick={titleTags} disabled={loading === "title"} className="btn-ghost justify-start px-3 py-2 text-sm">{loading === "title" ? "Đang gợi ý…" : "Đặt tiêu đề & thẻ"}</button>
                  </div>
                )}
                <div className="pt-3 border-t border-line">
                  <p className="ui-label">Rút việc cần làm + ngày hạn</p>
                  <p className="text-xs text-muted mb-2">Hiểu cách nói tự nhiên: "thứ 6 tuần sau", "mai 8h tối", "cuối tháng".</p>
                  {loading === "tasks" ? <Spinner /> : tasks ? (
                    <div className="space-y-1.5">
                      {!tasks.length && <p className="text-sm text-muted">Không thấy việc cần làm nào.</p>}
                      {tasks.map((t, i) => <p key={i} className="text-sm rounded-lg border border-line px-3 py-2">{t.text}{t.due && <span className="block text-xs text-primary">Hạn {new Date(t.due).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}</span>}</p>)}
                      {tasks.length > 0 && <button type="button" onClick={insertTasks} className="btn-primary w-full py-2 text-sm">Chèn {tasks.length} việc vào trang</button>}
                    </div>
                  ) : <button type="button" onClick={extractTasks} className="btn-outline w-full py-2 text-sm">Rút việc cần làm</button>}
                </div>
              </div>
            )}
            {tab === "learn" && (
              <div>
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {([["cards", "Flashcard"], ["quiz", "Quiz"], ["feynman", "Ôn kiểu Feynman"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setLearn(id)} className={`ui-chip text-xs ${learn === id ? "ui-chip-active" : ""}`}>{l}</button>)}
                </div>
                {learn === "cards" && <FlashcardTool {...common} editor={editor} isStudent={isStudent} />}
                {learn === "quiz" && <QuizTool {...common} />}
                {learn === "feynman" && <FeynmanTool {...common} />}
              </div>
            )}
            {tab === "english" && (
              <div>
                <div className="flex gap-1.5 mb-3 flex-wrap">
                  {([["journal", "Sửa lỗi bài viết"], ["words", "Từ có thể chưa biết"], ["parallel", "Song ngữ"]] as const).map(([id, l]) => <button key={id} type="button" onClick={() => setEng(id)} className={`ui-chip text-xs ${eng === id ? "ui-chip-active" : ""}`}>{l}</button>)}
                </div>
                {eng === "journal" && <JournalTool {...common} editor={editor} />}
                {eng === "words" && <UnknownWordsTool {...common} editor={editor} isStudent={isStudent} />}
                {eng === "parallel" && <ParallelTool {...common} />}
              </div>
            )}
            {tab === "links" && (
              <div className="space-y-3">
                <p className="text-sm text-muted">AI tìm các trang khác trong sổ của bạn thực sự liên quan tới trang này để gắn liên kết "Xem thêm".</p>
                {loading === "links" ? <Spinner /> : <button type="button" onClick={suggest} className="btn-primary w-full py-2.5">Gợi ý liên kết</button>}
                {links && !links.length && <p className="text-sm text-muted">Chưa thấy trang nào liên quan.</p>}
                {links?.map((l) => (
                  <div key={l.pageId} className="rounded-xl border border-line p-3 text-sm">
                    <button type="button" onClick={() => onOpenPage(l.pageId)} className="font-bold text-primary hover:underline text-left">{l.title}</button>
                    <p className="text-muted">{l.reason}</p>
                    <button type="button" onClick={() => addLink(l)} className="btn-outline mt-2 px-3 py-1.5 text-xs">Chèn liên kết vào trang</button>
                  </div>
                ))}
              </div>
            )}
            {tab === "class" && <TeacherTools {...common} classrooms={boot.user.classrooms} />}
          </div>
        </>
      )}
    </aside>
  );
}
