"use client";
// Công cụ tiếng Anh trong trang: sửa lỗi nhật ký (ghi vào hồ sơ lỗi cá nhân), từ có thể chưa biết, xem song ngữ.
import { useState } from "react";
import Swal from "sweetalert2";
import type { Editor } from "@tiptap/react";
import { aiApi, API_URL, errMsg } from "../api";
import { Spinner } from "../ui";
import { getSessionUserId } from "@/lib/session";

/** Thay đúng nguyên văn `original` trong trang bằng `corrected` (lần xuất hiện đầu tiên nằm trong 1 đoạn chữ). */
export function replaceInDoc(editor: Editor, original: string, corrected: string) {
  let target: { from: number; to: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (target || !node.isTextblock) return !target;
    const text = node.textContent;
    const idx = text.indexOf(original);
    if (idx < 0) return true;
    // Đổi chỉ số ký tự trong đoạn → vị trí ProseMirror (bỏ qua node không phải chữ)
    let offset = 0;
    let from = -1; let to = -1;
    node.forEach((child, childOffset) => {
      if (!child.isText) { offset += child.isLeaf ? 1 : child.textContent.length; return; }
      const len = child.text!.length;
      if (from < 0 && idx >= offset && idx <= offset + len) from = pos + 1 + childOffset + (idx - offset);
      const end = idx + original.length;
      if (to < 0 && end >= offset && end <= offset + len) to = pos + 1 + childOffset + (end - offset);
      offset += len;
    });
    if (from >= 0 && to >= 0) target = { from, to };
    return false;
  });
  if (!target) return false;
  const { from, to } = target;
  editor.chain().focus().insertContentAt({ from, to }, corrected).run();
  return true;
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
type Correction = { original: string; corrected: string; explanation: string; category: string; applied?: boolean };

export function JournalTool({ pageId, editor, flush, onUsed }: { pageId: string; editor: Editor | null; flush: () => Promise<void>; onUsed: () => void }) {
  const [level, setLevel] = useState("B1");
  const [res, setRes] = useState<{ corrections: Correction[]; upgrades: { from: string; to: string; level: string; example: string }[]; summary: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await flush();
      const sel = editor && !editor.state.selection.empty ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "";
      setRes(await aiApi("/journal/correct", { body: { pageId, text: sel || undefined, level } }));
      onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  const apply = (i: number) => {
    if (!editor || !res) return;
    const c = res.corrections[i];
    if (!replaceInDoc(editor, c.original, c.corrected)) {
      Swal.fire({ icon: "info", text: "Không tìm thấy nguyên văn câu này trong trang (có thể bạn đã sửa). Hãy sửa tay nhé." });
      return;
    }
    setRes({ ...res, corrections: res.corrections.map((x, j) => (j === i ? { ...x, applied: true } : x)) });
  };
  if (loading) return <Spinner label="AI đang đọc bài viết…" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Viết nhật ký hay bài luyện bằng tiếng Anh rồi bấm sửa. Bôi đen 1 đoạn để chỉ sửa đoạn đó. Lỗi được lưu vào <b>hồ sơ lỗi của bạn</b> để theo dõi lỗi lặp lại qua nhiều tuần.</p>
      <label className="flex items-center gap-2 text-sm">
        <span className="ui-label m-0">Trình độ để gợi ý từ</span>
        <select className="ui-input py-1.5 w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
      </label>
      <button type="button" onClick={run} className="btn-primary w-full py-2.5">{res ? "Sửa lại" : "Sửa lỗi tiếng Anh"}</button>
      {res && (
        <div className="space-y-3">
          {res.summary && <p className="text-sm rounded-xl bg-primary-soft p-3">{res.summary}</p>}
          {!res.corrections.length && <p className="text-sm text-emerald-700 font-bold">Không thấy lỗi nào. Tốt lắm!</p>}
          {res.corrections.map((c, i) => (
            <div key={i} className="rounded-xl border border-line p-3 text-sm">
              <span className="ui-badge bg-red-50 text-red-700">{c.category}</span>
              <p className="mt-2 line-through text-red-700/80">{c.original}</p>
              <p className="text-emerald-700 font-semibold">{c.corrected}</p>
              <p className="text-muted mt-1">{c.explanation}</p>
              <button type="button" disabled={c.applied} onClick={() => apply(i)} className="btn-outline mt-2 px-3 py-1.5 text-xs">{c.applied ? "✓ Đã áp dụng" : "Áp dụng vào trang"}</button>
            </div>
          ))}
          {res.upgrades.length > 0 && (
            <div>
              <p className="ui-label">Nâng cấp từ vựng</p>
              <ul className="space-y-1.5">
                {res.upgrades.map((u, i) => (
                  <li key={i} className="text-sm rounded-xl border border-line p-2.5">
                    <span className="text-muted">{u.from}</span> → <b className="text-primary">{u.to}</b> <span className="ui-badge">{u.level}</span>
                    {u.example && <span className="block italic text-muted mt-0.5">{u.example}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Word = { surface: string; word: string; level: string; meaning: string; phonetic: string; pos: string; added?: boolean };
export function UnknownWordsTool({ pageId, editor, isStudent, flush, onUsed }: { pageId: string; editor: Editor | null; isStudent: boolean; flush: () => Promise<void>; onUsed: () => void }) {
  const [level, setLevel] = useState("B1");
  const [words, setWords] = useState<Word[] | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await flush();
      const sel = editor && !editor.state.selection.empty ? editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, "\n") : "";
      const r = await aiApi<{ words: Word[] }>("/unknown-words", { body: { pageId, text: sel || undefined, level } });
      setWords(r.words); onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  // Tô vàng các từ tìm được ngay trong trang (chỉ khi người dùng bấm — AI không tự sửa trang)
  const highlightAll = () => {
    if (!editor || !words) return;
    const { from, to } = editor.state.selection;
    for (const w of words) {
      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return;
        const idx = node.text.toLowerCase().indexOf((w.surface || w.word).toLowerCase());
        if (idx >= 0) editor.chain().setTextSelection({ from: pos + idx, to: pos + idx + (w.surface || w.word).length }).setHighlight({ color: "#fef08a" }).run();
      });
    }
    editor.chain().setTextSelection({ from, to }).run();
  };
  const add = async (i: number) => {
    const w = words![i];
    try {
      const r = await fetch(`${API_URL}/api/srs/vocab/custom`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: getSessionUserId(), word: w.word, meaning: w.meaning, phonetic: w.phonetic, pos: w.pos }) });
      if (!r.ok) throw new Error();
      setWords(words!.map((x, j) => (j === i ? { ...x, added: true } : x)));
    } catch { Swal.fire({ icon: "error", text: "Không thêm được từ" }); }
  };
  if (loading) return <Spinner label="AI đang tìm từ khó…" />;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Dán bài báo, bài đọc tiếng Anh vào trang. AI tìm các từ có thể cao hơn trình độ của bạn{isStudent ? " và chưa có trong deck SRS" : ""}.</p>
      <label className="flex items-center gap-2 text-sm">
        <span className="ui-label m-0">Trình độ của bạn</span>
        <select className="ui-input py-1.5 w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
      </label>
      <button type="button" onClick={run} className="btn-primary w-full py-2.5">Tìm từ có thể chưa biết</button>
      {words && !words.length && <p className="text-sm text-muted">Không thấy từ nào vượt trình độ {level}.</p>}
      {words && words.length > 0 && <button type="button" onClick={highlightAll} className="btn-outline w-full py-2 text-sm">Tô vàng các từ này trong trang</button>}
      {words && words.length > 0 && (
        <ul className="space-y-1.5">
          {words.map((w, i) => (
            <li key={w.word} className="rounded-xl border border-line p-2.5 text-sm flex gap-2 items-start">
              <span className="min-w-0 flex-1"><b>{w.word}</b> <span className="text-muted">{w.phonetic} {w.pos}</span> <span className="ui-badge">{w.level}</span><span className="block text-muted">{w.meaning}</span></span>
              {isStudent && <button type="button" disabled={w.added} onClick={() => add(i)} className="btn-outline px-2.5 py-1.5 text-xs shrink-0">{w.added ? "✓" : "+ SRS"}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ParallelTool({ pageId, flush, onUsed }: { pageId: string; flush: () => Promise<void>; onUsed: () => void }) {
  const [pairs, setPairs] = useState<{ src: string; dst: string }[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await flush();
      const r = await aiApi<{ pairs: { src: string; dst: string }[]; truncated: boolean; cached?: boolean }>("/parallel", { body: { pageId } });
      setPairs(r.pairs); setTruncated(r.truncated);
      if (!r.cached) onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  if (loading) return <Spinner label="AI đang dịch từng đoạn…" />;
  if (!pairs) return (
    <div>
      <p className="text-sm text-muted">Hiện bản dịch Anh ↔ Việt ngay cạnh từng đoạn để đối chiếu khi học bài đọc. Trang chưa đổi thì mở lại không tốn lượt AI.</p>
      <button type="button" onClick={run} className="btn-primary w-full mt-3 py-2.5">Xem song ngữ</button>
    </div>
  );
  return (
    <div className="space-y-2">
      {pairs.map((p, i) => (
        <div key={i} className="rounded-xl border border-line p-3 text-sm">
          <p>{p.src}</p>
          <p className="mt-1.5 pt-1.5 border-t border-dashed border-line text-primary">{p.dst}</p>
        </div>
      ))}
      {truncated && <p className="text-xs text-muted">Trang dài nên chỉ dịch phần đầu (khoảng 9.000 ký tự).</p>}
    </div>
  );
}
