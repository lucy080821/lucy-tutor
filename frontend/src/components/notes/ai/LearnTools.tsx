"use client";
// Đợt 1 — biến trang thành học liệu: flashcard → deck SRS, quiz (chấm bằng isReadingAnswerCorrect), ôn kiểu Feynman.
import { useState } from "react";
import Swal from "sweetalert2";
import type { Editor } from "@tiptap/react";
import { aiApi, errMsg } from "../api";
import { Spinner } from "../ui";
import { isReadingAnswerCorrect, readingCorrectAnswerLabel, FILL_TYPES, type ReadingQuestion } from "@/lib/readingGrading";

type Card = { word: string; meaning: string; phonetic: string; pos: string; example: string; inDeck: boolean };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function FlashcardTool({ pageId, editor, isStudent, flush, onUsed }: { pageId: string; editor: Editor | null; isStudent: boolean; flush: () => Promise<void>; onUsed: () => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flip, setFlip] = useState<{ i: number; back: boolean } | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      await flush();
      const r = await aiApi<{ cards: Card[] }>("/flashcards", { body: { pageId } });
      setCards(r.cards);
      setPicked(new Set(r.cards.map((c, i) => (c.inDeck ? -1 : i)).filter((i) => i >= 0)));
      onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };

  const save = async () => {
    if (!cards) return;
    setSaving(true);
    try {
      const r = await aiApi<{ added: number }>("/flashcards/save", { body: { cards: cards.filter((_, i) => picked.has(i)) } });
      setCards(cards.map((c, i) => (picked.has(i) ? { ...c, inDeck: true } : c)));
      setPicked(new Set());
      Swal.fire({ icon: "success", title: `Đã thêm ${r.added} thẻ`, text: "Thẻ mới nằm trong hàng đợi ôn tập ở Phòng Gym Từ Vựng (/gym).", confirmButtonText: "OK" });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setSaving(false); }
  };

  const insertTable = () => {
    if (!cards || !editor) return;
    const rows = cards.filter((_, i) => picked.has(i) || !picked.size).map((c) => `<tr><td>${esc(c.word)}</td><td>${esc(c.phonetic)}</td><td>${esc(c.meaning)}</td><td>${esc(c.example)}</td></tr>`).join("");
    editor.chain().focus("end").insertContent(`<h3>Thẻ từ vựng</h3><table><tr><th>Từ</th><th>Phiên âm</th><th>Nghĩa</th><th>Ví dụ</th></tr>${rows}</table>`).run();
  };

  if (loading) return <Spinner label="AI đang rút thẻ từ trang…" />;
  if (!cards) return (
    <div>
      <p className="text-sm text-muted">AI đọc trang này và rút ra từ vựng/khái niệm đáng học thành thẻ. {isStudent ? "Bạn chọn thẻ để đưa vào deck ôn tập SRS (lịch ôn tự động ở Phòng Gym Từ Vựng)." : "Bạn có thể chèn thành bảng từ vựng trong trang."}</p>
      <button type="button" onClick={run} className="btn-primary w-full mt-3 py-2.5">Tạo flashcard từ trang</button>
    </div>
  );
  return (
    <div>
      {flip && cards[flip.i] && (
        <button type="button" onClick={() => setFlip({ ...flip, back: !flip.back })}
          className="w-full min-h-36 rounded-2xl border-2 border-primary/20 bg-primary-soft p-5 text-center mb-3">
          {!flip.back ? (
            <span className="block text-2xl font-extrabold text-primary">{cards[flip.i].word}</span>
          ) : (
            <span className="block">
              <span className="block text-lg font-bold">{cards[flip.i].meaning}</span>
              <span className="block text-sm text-muted mt-1">{cards[flip.i].phonetic} {cards[flip.i].pos}</span>
              {cards[flip.i].example && <span className="block text-sm italic mt-2">{cards[flip.i].example}</span>}
            </span>
          )}
          <span className="block text-xs text-muted mt-3">Bấm để lật · thẻ {flip.i + 1}/{cards.length}</span>
        </button>
      )}
      <div className="flex gap-2 mb-2">
        <button type="button" className="ui-chip text-xs" onClick={() => setFlip({ i: flip ? (flip.i + 1) % cards.length : 0, back: false })}>{flip ? "Thẻ tiếp →" : "Lật thử thẻ"}</button>
        <button type="button" className="ui-chip text-xs" onClick={() => setPicked(picked.size === cards.length ? new Set() : new Set(cards.map((_, i) => i)))}>{picked.size === cards.length ? "Bỏ chọn hết" : "Chọn hết"}</button>
      </div>
      <ul className="space-y-1.5 max-h-80 overflow-y-auto">
        {cards.map((c, i) => (
          <li key={c.word}>
            <label className={`flex gap-2 rounded-xl border p-2.5 text-sm cursor-pointer ${picked.has(i) ? "border-primary bg-primary-soft/50" : "border-line"}`}>
              <input type="checkbox" className="mt-1" checked={picked.has(i)} disabled={isStudent && c.inDeck}
                onChange={() => { const n = new Set(picked); if (n.has(i)) n.delete(i); else n.add(i); setPicked(n); }} />
              <span className="min-w-0">
                <span className="font-bold text-foreground">{c.word}</span> <span className="text-muted">{c.phonetic}</span>
                {c.inDeck && <span className="ui-badge ml-1 bg-emerald-50 text-emerald-700">Đã có trong deck</span>}
                <span className="block text-muted">{c.meaning}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid grid-cols-1 gap-2 mt-3">
        {isStudent && <button type="button" disabled={!picked.size || saving} onClick={save} className="btn-primary py-2.5">{saving ? "Đang lưu…" : `Đưa ${picked.size} thẻ vào deck ôn tập`}</button>}
        <button type="button" onClick={insertTable} className="btn-outline py-2.5">Chèn bảng từ vựng vào trang</button>
        <button type="button" onClick={run} className="btn-ghost py-2 text-sm">Tạo lại</button>
      </div>
    </div>
  );
}

export function QuizRunner({ questions, onDone }: { questions: ReadingQuestion[]; onDone?: (score: number, total: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const score = questions.filter((q, i) => isReadingAnswerCorrect(q, answers[i])).length;
  return (
    <div className="space-y-4">
      {questions.map((q, i) => {
        const correct = submitted && isReadingAnswerCorrect(q, answers[i]);
        return (
          <div key={i} className={`rounded-xl border p-3 ${submitted ? (correct ? "border-emerald-300 bg-emerald-50/40" : "border-red-300 bg-red-50/40") : "border-line"}`}>
            <p className="text-sm font-bold">{i + 1}. {q.question}</p>
            {FILL_TYPES.includes(q.type) ? (
              <input className="ui-input mt-2 w-full" disabled={submitted} value={String(answers[i] ?? "")} placeholder="Câu trả lời của bạn"
                onChange={(e) => setAnswers({ ...answers, [i]: e.target.value })} />
            ) : (
              <div className="mt-2 grid gap-1.5">
                {(q.options || []).map((o, oi) => (
                  <label key={oi} className={`flex gap-2 items-start text-sm rounded-lg border px-3 py-2 cursor-pointer ${answers[i] === oi ? "border-primary bg-primary-soft/50" : "border-line"}`}>
                    <input type="radio" name={`q${i}`} disabled={submitted} checked={answers[i] === oi} onChange={() => setAnswers({ ...answers, [i]: oi })} className="mt-0.5" />
                    <span>{o}</span>
                  </label>
                ))}
              </div>
            )}
            {submitted && (
              <p className="text-sm mt-2">
                <span className={correct ? "text-emerald-700 font-bold" : "text-red-700 font-bold"}>{correct ? "✓ Đúng" : `✗ Đáp án: ${readingCorrectAnswerLabel(q)}`}</span>
                {q.explanation && <span className="block text-muted mt-1">{q.explanation}</span>}
              </p>
            )}
          </div>
        );
      })}
      {!submitted ? (
        <button type="button" className="btn-primary w-full py-2.5" onClick={() => { setSubmitted(true); onDone?.(score, questions.length); }}>Nộp bài</button>
      ) : (
        <p className="text-center font-bold text-primary text-lg">Đúng {score}/{questions.length} câu</p>
      )}
    </div>
  );
}

export function QuizTool({ pageId, flush, onUsed }: { pageId: string; flush: () => Promise<void>; onUsed: () => void }) {
  const [qs, setQs] = useState<ReadingQuestion[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [round, setRound] = useState(0);
  const run = async (fresh = false) => {
    setLoading(true);
    try {
      await flush();
      const r = await aiApi<{ questions: ReadingQuestion[]; cached?: boolean }>("/quiz", { body: { pageId, fresh } });
      setQs(r.questions); setRound((n) => n + 1);
      if (!r.cached) onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  if (loading) return <Spinner label="AI đang soạn câu hỏi từ ghi chú của bạn…" />;
  if (!qs) return (
    <div>
      <p className="text-sm text-muted">8 câu hỏi ôn tập chỉ dựa trên nội dung trang (trắc nghiệm, đúng/sai, điền từ, trả lời ngắn). Trang chưa đổi thì lần sau làm lại không tốn lượt AI.</p>
      <button type="button" onClick={() => run()} className="btn-primary w-full mt-3 py-2.5">Tạo quiz từ trang</button>
    </div>
  );
  return (
    <div>
      <QuizRunner key={round} questions={qs} />
      <button type="button" onClick={() => run(true)} className="btn-ghost w-full mt-2 py-2 text-sm">Tạo bộ câu hỏi khác</button>
    </div>
  );
}

type Grade = { verdict: "GOOD" | "PARTIAL" | "WRONG"; score: number; correct: string[]; misconceptions: string[]; missing: string[]; betterAnswer: string };
export function FeynmanTool({ pageId, flush, onUsed }: { pageId: string; flush: () => Promise<void>; onUsed: () => void }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [loading, setLoading] = useState<"" | "ask" | "grade">("");
  const ask = async () => {
    setLoading("ask"); setGrade(null); setAnswer("");
    try {
      await flush();
      const r = await aiApi<{ question: string }>("/feynman", { body: { pageId, asked } });
      setQuestion(r.question); setAsked([...asked, r.question]); onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const check = async () => {
    setLoading("grade");
    try {
      setGrade(await aiApi<Grade>("/feynman", { body: { pageId, mode: "grade", question, answer } })); onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const V = { GOOD: ["Hiểu đúng", "text-emerald-700 bg-emerald-50"], PARTIAL: ["Hiểu một phần", "text-amber-700 bg-amber-50"], WRONG: ["Còn hiểu sai", "text-red-700 bg-red-50"] } as const;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Kỹ thuật Feynman: AI hỏi bạn giải thích lại một ý bằng lời của mình, rồi chỉ ra chỗ hiểu sai hoặc còn thiếu so với ghi chú.</p>
      {loading === "ask" ? <Spinner label="AI đang đặt câu hỏi…" /> : question ? (
        <>
          <p className="rounded-xl bg-primary-soft p-3 text-sm font-bold text-primary">{question}</p>
          <textarea className="ui-input w-full min-h-28" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Giải thích bằng lời của bạn, như đang giảng cho bạn cùng lớp…" disabled={!!grade} />
          {!grade && <button type="button" disabled={answer.trim().length < 5 || loading === "grade"} onClick={check} className="btn-primary w-full py-2.5">{loading === "grade" ? "Đang chấm…" : "Kiểm tra"}</button>}
        </>
      ) : null}
      {grade && (
        <div className="space-y-2 text-sm">
          <p className={`inline-block rounded-full px-3 py-1 font-bold ${V[grade.verdict][1]}`}>{V[grade.verdict][0]} · {grade.score}/10</p>
          {grade.correct.length > 0 && <div><p className="font-bold text-emerald-700">Bạn hiểu đúng</p><ul className="list-disc pl-5">{grade.correct.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          {grade.misconceptions.length > 0 && <div><p className="font-bold text-red-700">Chỗ hiểu sai</p><ul className="list-disc pl-5">{grade.misconceptions.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          {grade.missing.length > 0 && <div><p className="font-bold text-amber-700">Còn thiếu</p><ul className="list-disc pl-5">{grade.missing.map((s) => <li key={s}>{s}</li>)}</ul></div>}
          {grade.betterAnswer && <div className="rounded-xl border border-line p-3 whitespace-pre-line"><p className="font-bold mb-1">Câu trả lời mẫu</p>{grade.betterAnswer}</div>}
        </div>
      )}
      {loading !== "ask" && <button type="button" onClick={ask} className={question ? "btn-outline w-full py-2.5" : "btn-primary w-full py-2.5"}>{question ? "Hỏi câu khác" : "Bắt đầu ôn"}</button>}
    </div>
  );
}
