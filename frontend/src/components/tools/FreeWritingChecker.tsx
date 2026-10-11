"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Khớp giới hạn ở backend/src/routes/freeTools.routes.js
const MIN_WORDS = 50;
const MAX_WORDS = 350;
const MAX_CHARS = 2500;
const MAX_PROMPT_CHARS = 600;

type TaskType = "IELTS_TASK2" | "IELTS_TASK1" | "GENERAL";
const TASKS: { id: TaskType; label: string; hint: string }[] = [
  { id: "IELTS_TASK2", label: "IELTS Task 2", hint: "Bài luận nghị luận, chuẩn 250 từ trở lên" },
  { id: "IELTS_TASK1", label: "IELTS Task 1", hint: "Mô tả biểu đồ (Academic) hoặc viết thư (General)" },
  { id: "GENERAL", label: "Đoạn văn / bài luận", hint: "Bài viết THPT, đoạn văn tự do — ước tính trình độ CEFR" },
];

type Result = {
  taskType: TaskType;
  words: number;
  overallBand: number;
  cefr: string | null;
  criteria: { key: string; name: string; band: number; comment: string }[];
  overall: string;
  strengths: string[];
  improvements: string[];
  mistakes: { original: string; corrected: string; explanation: string }[];
  remaining: number;
};

const countWords = (t: string) => (t.trim().match(/[A-Za-z0-9'’-]+/g) || []).length;

export default function FreeWritingChecker() {
  const [task, setTask] = useState<TaskType>("IELTS_TASK2");
  const [prompt, setPrompt] = useState("");
  const [essay, setEssay] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/free-tools/writing-check/quota`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && typeof d.remaining === "number") setRemaining(d.remaining); })
      .catch(() => { /* backend tạm lỗi: vẫn cho nhập bài */ });
  }, []);

  const words = countWords(essay);
  const tooShort = words < MIN_WORDS;
  const tooLong = words > MAX_WORDS || essay.length > MAX_CHARS;
  const disabled = loading || tooShort || tooLong || remaining === 0;

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_URL}/api/free-tools/writing-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: task, prompt, essay, website: honeypot }),
      });
      const data = await res.json().catch(() => ({}));
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (!res.ok) { setError(data.error || "Không chấm được bài lúc này, vui lòng thử lại."); return; }
      setResult(data as Result);
      setTimeout(() => document.getElementById("writing-result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch {
      setError("Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const scaleLabel = result?.taskType === "GENERAL" ? "Điểm ước tính (thang 0–9)" : "Band ước tính";

  return (
    <div className="space-y-6">
      <div className="ui-card p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-primary">1. Chọn dạng bài</h2>
          {remaining !== null && (
            <span className={`text-sm font-semibold ${remaining === 0 ? "text-red-700" : "text-muted"}`}>Còn {remaining} lượt chấm miễn phí hôm nay</span>
          )}
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TASKS.map((t) => (
            <button key={t.id} onClick={() => setTask(t.id)}
              className={`text-left rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${task === t.id ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"}`}>
              <b className="block text-primary">{t.label}</b>
              <span className="text-xs text-muted">{t.hint}</span>
            </button>
          ))}
        </div>

        <label htmlFor="wc-prompt" className="ui-label block mt-6">2. Đề bài (tuỳ chọn, giúp AI chấm tiêu chí đáp ứng đề chính xác hơn)</label>
        <textarea id="wc-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_CHARS))} rows={2}
          className="ui-input w-full mt-2" placeholder={task === "IELTS_TASK1" ? "Dán đề và mô tả ngắn biểu đồ (AI không xem được hình ảnh)..." : "Ví dụ: Some people think that university education should be free for everyone. To what extent do you agree or disagree?"} />

        <label htmlFor="wc-essay" className="ui-label block mt-5">3. Bài viết của bạn (tiếng Anh, {MIN_WORDS}–{MAX_WORDS} từ)</label>
        <textarea id="wc-essay" value={essay} onChange={(e) => setEssay(e.target.value)} rows={12}
          className="ui-input w-full mt-2 font-normal leading-relaxed" placeholder="Dán bài viết vào đây..." spellCheck={false} />
        {/* Honeypot chống bot — người dùng thật không thấy ô này */}
        <input type="text" name="website" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm">
          <span className={tooShort && essay ? "text-red-700" : tooLong ? "text-red-700" : "text-muted"}>
            {words} từ{tooShort && essay ? ` · cần ít nhất ${MIN_WORDS} từ` : ""}{words > MAX_WORDS ? ` · tối đa ${MAX_WORDS} từ` : ""}
          </span>
          <span className={essay.length > MAX_CHARS ? "text-red-700" : "text-muted"}>{essay.length}/{MAX_CHARS} ký tự</span>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</p>}
        {remaining === 0 && (
          <p className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm">
            Bạn đã dùng hết lượt chấm miễn phí hôm nay. <Link href="/auth?role=STUDENT" className="font-bold text-primary underline">Đăng ký dùng thử 3 ngày</Link> để luyện viết và được AI chấm chi tiết không giới hạn lượt.
          </p>
        )}
        <button onClick={submit} disabled={disabled} className="btn-primary mt-5 px-8 py-3 text-base disabled:opacity-50">
          {loading ? "AI đang chấm bài (khoảng 10–30 giây)..." : "Chấm bài miễn phí"}
        </button>
      </div>

      {result && (
        <div id="writing-result" className="space-y-6 scroll-mt-20">
          <div className="ui-card p-6 sm:p-8 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
            <div className="text-center md:pr-6 md:border-r border-line">
              <p className="text-sm text-muted">{scaleLabel}</p>
              <p className="text-5xl font-extrabold text-primary mt-1">{result.overallBand.toFixed(1)}</p>
              {result.cefr && <p className="mt-1 font-semibold">Trình độ ~ {result.cefr}</p>}
              <p className="text-xs text-muted mt-1">{result.words} từ</p>
            </div>
            <div>
              <p className="leading-relaxed">{result.overall}</p>
              {result.strengths.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {result.strengths.map((s) => <li key={s} className="text-emerald-700">✓ {s}</li>)}
                </ul>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {result.criteria.map((c) => (
              <div key={c.key} className="ui-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-primary">{c.name}</h3>
                  <span className="text-2xl font-extrabold text-primary">{c.band.toFixed(1)}</span>
                </div>
                <p className="text-sm text-muted mt-2 leading-relaxed">{c.comment}</p>
              </div>
            ))}
          </div>

          {result.mistakes.length > 0 && (
            <div className="ui-card p-5 sm:p-6">
              <h3 className="font-bold text-primary mb-4">Lỗi cần sửa</h3>
              <ol className="space-y-4">
                {result.mistakes.map((m, i) => (
                  <li key={i} className="text-sm">
                    <p><span className="line-through text-red-700 bg-red-50 px-1 rounded">{m.original}</span> <span aria-hidden="true">→</span> <span className="text-emerald-700 bg-emerald-50 px-1 rounded font-semibold">{m.corrected}</span></p>
                    {m.explanation && <p className="text-muted mt-1">{m.explanation}</p>}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {result.improvements.length > 0 && (
            <div className="ui-card p-5 sm:p-6">
              <h3 className="font-bold text-primary mb-3">Gợi ý để tăng điểm</h3>
              <ul className="space-y-2 text-sm">
                {result.improvements.map((s) => <li key={s} className="flex gap-2"><span className="text-primary font-bold">→</span>{s}</li>)}
              </ul>
            </div>
          )}

          <p className="text-xs text-muted">
            Điểm do AI ước tính dựa trên tiêu chí chấm công khai của IELTS, chỉ dùng để tự luyện — không thay thế điểm của giám khảo trong kỳ thi thật.
          </p>
        </div>
      )}
    </div>
  );
}
