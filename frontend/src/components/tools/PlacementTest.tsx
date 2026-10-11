"use client";
import { useState } from "react";
import Link from "next/link";
import { PLACEMENT_QUESTIONS, LEVEL_INFO, LEVEL_ORDER, gradePlacement, type PlacementResult } from "@/lib/tools/placementTest";

const LETTERS = ["A", "B", "C", "D"];

export default function PlacementTest() {
  const [stage, setStage] = useState<"INTRO" | "TAKING" | "RESULT">("INTRO");
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => PLACEMENT_QUESTIONS.map(() => null));
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  const q = PLACEMENT_QUESTIONS[idx];
  const answeredCount = answers.filter((a) => a !== null).length;

  const start = () => {
    setAnswers(PLACEMENT_QUESTIONS.map(() => null));
    setIdx(0);
    setResult(null);
    setShowReview(false);
    setStage("TAKING");
  };

  const choose = (opt: number) => {
    setAnswers((prev) => prev.map((a, i) => (i === idx ? opt : a)));
  };

  const submit = () => {
    const r = gradePlacement(answers);
    setResult(r);
    setStage("RESULT");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (stage === "INTRO") {
    return (
      <div className="ui-card p-6 sm:p-8">
        <h2 className="text-xl font-bold text-primary">Bắt đầu bài kiểm tra</h2>
        <ul className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <li className="rounded-xl bg-primary-soft p-4"><b className="block text-primary text-lg">30 câu</b>Ngữ pháp, từ vựng, đọc hiểu</li>
          <li className="rounded-xl bg-primary-soft p-4"><b className="block text-primary text-lg">~15 phút</b>Không giới hạn thời gian</li>
          <li className="rounded-xl bg-primary-soft p-4"><b className="block text-primary text-lg">A1 → C1</b>Độ khó tăng dần theo CEFR</li>
        </ul>
        <p className="text-sm text-muted mt-4">Câu nào không biết, hãy bỏ trống thay vì đoán — kết quả sẽ sát trình độ thật hơn.</p>
        <button onClick={start} className="btn-primary mt-5 px-8 py-3 text-base">Làm bài ngay</button>
      </div>
    );
  }

  if (stage === "TAKING") {
    return (
      <div className="ui-card p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-primary">Câu {idx + 1}/{PLACEMENT_QUESTIONS.length}</span>
          <span className="text-muted">Đã trả lời {answeredCount}/{PLACEMENT_QUESTIONS.length}</span>
        </div>
        <div className="h-2 rounded-full bg-line mt-2 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${((idx + 1) / PLACEMENT_QUESTIONS.length) * 100}%` }} />
        </div>

        <p className="mt-5 text-xs font-semibold text-muted uppercase tracking-wide">{q.skill}</p>
        {q.passage && <p className="mt-2 rounded-xl bg-primary-soft p-4 text-sm leading-relaxed">{q.passage}</p>}
        <p className="mt-3 text-lg sm:text-xl font-semibold text-foreground">{q.question}</p>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {q.options.map((opt, i) => {
            const active = answers[idx] === i;
            return (
              <button key={opt} onClick={() => choose(i)}
                className={`text-left rounded-xl border-2 px-4 py-3 transition-colors cursor-pointer ${active ? "border-primary bg-primary-soft" : "border-line hover:border-primary/50"}`}>
                <b className="text-primary mr-2">{LETTERS[i]}.</b>{opt}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="btn-ghost px-5 py-2.5 disabled:opacity-40">← Câu trước</button>
          {idx < PLACEMENT_QUESTIONS.length - 1 ? (
            <button onClick={() => setIdx((i) => i + 1)} className="btn-primary px-6 py-2.5">
              {answers[idx] === null ? "Bỏ qua →" : "Câu tiếp →"}
            </button>
          ) : (
            <button onClick={submit} className="btn-primary px-6 py-2.5">Nộp bài & xem kết quả</button>
          )}
        </div>
        {idx < PLACEMENT_QUESTIONS.length - 1 && answeredCount >= 10 && (
          <button onClick={submit} className="mt-4 text-sm text-muted underline hover:text-primary">Nộp bài sớm</button>
        )}
      </div>
    );
  }

  if (!result) return null;
  const info = LEVEL_INFO[result.level];
  return (
    <div className="space-y-6">
      <div className="ui-card p-6 sm:p-8 text-center">
        <p className="text-sm text-muted">Trình độ ước tính của bạn</p>
        <p className="mt-2 text-4xl sm:text-5xl font-extrabold text-primary">{result.level === "PRE_A1" ? "Dưới A1" : result.level}</p>
        <p className="mt-1 font-semibold text-foreground">{info.name}</p>
        <p className="mt-3 text-muted max-w-xl mx-auto">{info.desc}</p>
        <p className="mt-3 text-sm">Đúng <b className="text-primary">{result.total}/{PLACEMENT_QUESTIONS.length}</b> câu · IELTS tương đương: <b>{info.ielts}</b></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="ui-card p-5 sm:p-6">
          <h3 className="font-bold text-primary mb-4">Kết quả theo cấp độ</h3>
          <ul className="space-y-3">
            {LEVEL_ORDER.map((l) => {
              const s = result.perLevel[l];
              const pct = (s.correct / s.total) * 100;
              return (
                <li key={l} className="flex items-center gap-3 text-sm">
                  <span className="w-8 font-bold text-primary">{l}</span>
                  <span className="flex-1 h-2.5 rounded-full bg-line overflow-hidden">
                    <span className={`block h-full ${s.correct >= 4 ? "bg-emerald-500" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 text-right text-muted">{s.correct}/{s.total}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted mt-3">Đạt 1 cấp khi đúng từ 4/6 câu của cấp đó và đã đạt mọi cấp thấp hơn.</p>
        </div>
        <div className="ui-card p-5 sm:p-6">
          <h3 className="font-bold text-primary mb-4">Bạn nên ôn tiếp</h3>
          <ul className="space-y-2 text-sm">
            {info.next.map((n) => (
              <li key={n} className="flex gap-2"><span className="text-primary font-bold">→</span>{n}</li>
            ))}
          </ul>
          <div className="mt-4 text-sm space-y-1">
            {Object.entries(result.perSkill).map(([k, s]) => (
              <p key={k} className="text-muted">{k}: <b className="text-foreground">{s.correct}/{s.total}</b></p>
            ))}
          </div>
        </div>
      </div>

      <div className="ui-card p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary-soft">
        <p className="text-sm sm:text-base">Luyện 4 kỹ năng theo đúng cấp độ <b>{result.level === "PRE_A1" ? "A1" : result.level}</b> cùng AI — dùng thử miễn phí 3 ngày, không cần thẻ.</p>
        <Link href="/auth?role=STUDENT" className="btn-primary px-6 py-3 shrink-0 text-center">Đăng ký luyện tập</Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={() => setShowReview((v) => !v)} className="btn-outline px-5 py-2.5">{showReview ? "Ẩn đáp án" : "Xem đáp án & giải thích"}</button>
        <button onClick={start} className="btn-ghost px-5 py-2.5">Làm lại</button>
      </div>

      {showReview && (
        <ol className="space-y-3">
          {PLACEMENT_QUESTIONS.map((pq, i) => {
            const a = answers[i];
            const ok = a === pq.answer;
            return (
              <li key={i} className="ui-card p-4 sm:p-5">
                <p className="text-xs text-muted">Câu {i + 1} · {pq.level} · {pq.skill}</p>
                {pq.passage && <p className="mt-1 text-sm text-muted italic">{pq.passage}</p>}
                <p className="mt-1 font-semibold">{pq.question}</p>
                <p className={`mt-2 text-sm ${ok ? "text-emerald-700" : "text-red-700"}`}>
                  {ok ? "✓ Đúng" : a === null ? "✗ Bỏ trống" : `✗ Bạn chọn: ${pq.options[a]}`}
                  {!ok && <> · Đáp án: <b>{pq.options[pq.answer]}</b></>}
                </p>
                <p className="mt-1 text-sm text-muted">{pq.why}</p>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
