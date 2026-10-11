"use client";
import { useState } from "react";
import { classifyEd, classifyS, makePracticeQuestion, splitEnding, type PracticeQuestion } from "@/lib/tools/endingSounds";

type Kind = "ed" | "s";
const LETTERS = ["A", "B", "C", "D"];
const PRACTICE_LEN = 10;

function speak(word: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(word);
  u.lang = "en-US";
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

const SOUND_STYLE: Record<string, string> = {
  "/t/": "bg-sky-50 text-sky-700 border-sky-200",
  "/s/": "bg-sky-50 text-sky-700 border-sky-200",
  "/d/": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "/z/": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "/ɪd/": "bg-orange-50 text-orange-700 border-orange-200",
  "/ɪz/": "bg-orange-50 text-orange-700 border-orange-200",
};

export default function EndingSoundsTool() {
  const [kind, setKind] = useState<Kind>("ed");
  const [text, setText] = useState("");
  const [checked, setChecked] = useState<{ word: string; sound: string; reason: string; exception: boolean }[] | null>(null);

  const [quiz, setQuiz] = useState<PracticeQuestion[] | null>(null);
  const [qIdx, setQIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const check = () => {
    const words = text.split(/[\s,;]+/).map((w) => w.trim()).filter(Boolean).slice(0, 30);
    const out = words.flatMap((w) => {
      const r = kind === "ed" ? classifyEd(w) : classifyS(w);
      return r ? [{ word: w, ...r }] : [];
    });
    setChecked(out);
  };

  const switchKind = (k: Kind) => { setKind(k); setChecked(null); setText(""); };

  const startQuiz = () => {
    setQuiz(Array.from({ length: PRACTICE_LEN }, (_, i) => makePracticeQuestion(i % 2 === 0 ? "ed" : "s")));
    setQIdx(0); setPicked(null); setScore(0);
  };
  const answer = (i: number) => {
    if (picked !== null || !quiz) return;
    setPicked(i);
    if (i === quiz[qIdx].answer) setScore((s) => s + 1);
  };
  const nextQ = () => { setQIdx((i) => i + 1); setPicked(null); };

  const examples = kind === "ed" ? "watched, played, wanted, laughed, raised, naked" : "books, dogs, watches, laughs, clothes, houses";

  return (
    <div className="space-y-8">
      {/* ── Tra cứu ── */}
      <div className="ui-card p-5 sm:p-8">
        <div className="flex flex-wrap gap-2" role="tablist">
          <button role="tab" aria-selected={kind === "ed"} onClick={() => switchKind("ed")} className={`ui-chip cursor-pointer ${kind === "ed" ? "ui-chip-active" : ""}`}>Đuôi -ed</button>
          <button role="tab" aria-selected={kind === "s"} onClick={() => switchKind("s")} className={`ui-chip cursor-pointer ${kind === "s" ? "ui-chip-active" : ""}`}>Đuôi -s / -es</button>
        </div>
        <label htmlFor="ending-input" className="ui-label mt-5 block">
          Nhập 1 hoặc nhiều từ (cách nhau bằng dấu phẩy hoặc khoảng trắng)
        </label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <input id="ending-input" value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") check(); }}
            placeholder={`Ví dụ: ${examples}`} className="ui-input flex-1" autoComplete="off" spellCheck={false} />
          <button onClick={check} disabled={!text.trim()} className="btn-primary px-6 py-3 disabled:opacity-50">Kiểm tra</button>
        </div>
        <button onClick={() => { setText(examples); }} className="mt-2 text-sm text-muted underline hover:text-primary">Dùng từ ví dụ</button>

        {checked && (
          checked.length === 0 ? (
            <p className="mt-5 text-sm text-red-700">Không nhận ra từ nào. Hãy nhập từ tiếng Anh không dấu, ví dụ: {examples}.</p>
          ) : (
            <ul className="mt-5 space-y-3">
              {checked.map((c, i) => (
                <li key={`${c.word}-${i}`} className="rounded-xl border border-line p-4 flex items-start gap-3">
                  <button onClick={() => speak(c.word)} aria-label={`Nghe phát âm ${c.word}`} title="Nghe phát âm"
                    className="w-10 h-10 shrink-0 rounded-full bg-primary-soft text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <b className="text-lg">{c.word}</b>
                      <span className={`px-2.5 py-0.5 rounded-full border text-sm font-bold ${SOUND_STYLE[c.sound]}`}>{c.sound}</span>
                      {c.exception && <span className="ui-badge">Ngoại lệ</span>}
                    </p>
                    <p className="text-sm text-muted mt-1">{c.reason}</p>
                  </div>
                </li>
              ))}
            </ul>
          )
        )}
        <p className="mt-4 text-xs text-muted">
          Kết quả dựa trên quy tắc chính tả và danh sách ngoại lệ thường gặp trong đề thi. Với từ hiếm, hãy tra thêm phiên âm trong từ điển để chắc chắn.
        </p>
      </div>

      {/* ── Luyện tập kiểu đề THPT ── */}
      <div className="ui-card p-5 sm:p-8">
        <h2 className="ui-section-title text-xl">Luyện tập: chọn từ có phần gạch chân phát âm khác</h2>
        <p className="text-sm text-muted mt-3">10 câu ngẫu nhiên đúng dạng câu Ngữ âm trong đề thi tốt nghiệp THPT. Mỗi lần bấm là một bộ câu mới.</p>

        {!quiz ? (
          <button onClick={startQuiz} className="btn-primary mt-5 px-6 py-3">Bắt đầu luyện 10 câu</button>
        ) : qIdx >= quiz.length ? (
          <div className="mt-5 text-center">
            <p className="text-3xl font-extrabold text-primary">{score}/{quiz.length}</p>
            <p className="text-muted mt-1">{score >= 9 ? "Xuất sắc! Bạn đã nắm chắc quy tắc." : score >= 6 ? "Khá tốt, ôn lại các ngoại lệ là đủ." : "Hãy đọc lại quy tắc bên dưới rồi luyện thêm nhé."}</p>
            <button onClick={startQuiz} className="btn-primary mt-4 px-6 py-3">Luyện bộ mới</button>
          </div>
        ) : (
          <div className="mt-5">
            <p className="text-sm text-muted">Câu {qIdx + 1}/{quiz.length} · Điểm: {score}</p>
            <p className="mt-2 font-semibold">Chọn từ có phần gạch chân phát âm khác các từ còn lại:</p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {quiz[qIdx].words.map((w, i) => {
                const [head, tail] = splitEnding(w, quiz[qIdx].kind);
                const isAns = i === quiz[qIdx].answer;
                const state = picked === null ? "border-line hover:border-primary/50" : isAns ? "border-emerald-500 bg-emerald-50" : i === picked ? "border-red-400 bg-red-50" : "border-line opacity-70";
                return (
                  <button key={w} onClick={() => answer(i)} disabled={picked !== null}
                    className={`text-left rounded-xl border-2 px-4 py-3 transition-colors ${state} ${picked === null ? "cursor-pointer" : ""}`}>
                    <b className="text-primary mr-2">{LETTERS[i]}.</b>
                    {head}<u className="font-bold decoration-2">{tail}</u>
                    {picked !== null && <span className="ml-2 text-sm text-muted">{quiz[qIdx].sounds[i]}</span>}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${picked === quiz[qIdx].answer ? "text-emerald-700" : "text-red-700"}`}>
                  {picked === quiz[qIdx].answer ? "✓ Chính xác!" : `✗ Đáp án đúng: ${LETTERS[quiz[qIdx].answer]}. ${quiz[qIdx].words[quiz[qIdx].answer]}`}
                </p>
                <button onClick={nextQ} className="btn-primary px-6 py-2.5">{qIdx + 1 < quiz.length ? "Câu tiếp →" : "Xem kết quả"}</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
