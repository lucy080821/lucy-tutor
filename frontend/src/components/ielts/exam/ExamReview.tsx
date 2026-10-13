"use client";
import { useState } from "react";
import DOMPurify from "dompurify";
import { isTextQuestion, type ExamQuestion } from "./ExamQuestions";

// Xem lại sau khi nộp: mỗi câu hiện "Bạn trả lời" cạnh "Đáp án đúng", lọc câu sai,
// mở lại bài đọc ngay trong từng Part để đối chiếu.

type ReviewRow = { questionNumber: number; userAnswer: any; correct: boolean; correctIndex: number | null; correctAnswer: string | null; options: string[] | null };
export type ReviewPart = { key: string; label: string; questions: ExamQuestion[]; sourceHtml?: string; sourceLabel?: string };

function optionLabel(options: string[] | null, i: any) {
  if (i === null || i === undefined || i === "") return null;
  const idx = Number(i);
  return options && Number.isInteger(idx) && options[idx] !== undefined ? options[idx] : String(i);
}

export function ExamReview({ parts, review }: { parts: ReviewPart[]; review: ReviewRow[] }) {
  const [filter, setFilter] = useState<"ALL" | "WRONG" | "RIGHT">("ALL");
  const byNumber = new Map(review.map((r) => [r.questionNumber, r]));
  const wrongCount = review.filter((r) => !r.correct).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="ui-section-title text-lg mr-auto">Xem lại đáp án</h2>
        {([["ALL", `Tất cả (${review.length})`], ["WRONG", `Câu sai (${wrongCount})`], ["RIGHT", `Câu đúng (${review.length - wrongCount})`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={`ui-chip cursor-pointer ${filter === k ? "ui-chip-active" : ""}`}>{label}</button>
        ))}
      </div>

      {parts.map((p) => {
        const rows = p.questions.filter((q) => {
          const r = byNumber.get(q.questionNumber);
          return filter === "ALL" || (filter === "WRONG" ? !r?.correct : !!r?.correct);
        });
        const correct = p.questions.filter((q) => byNumber.get(q.questionNumber)?.correct).length;
        return (
          <div key={p.key} className="ui-card p-4 sm:p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold text-primary">{p.label}</h3>
              <span className="ui-badge">Đúng {correct}/{p.questions.length}</span>
            </div>

            {p.sourceHtml && (
              <details className="rounded-xl border border-line bg-background">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-primary">{p.sourceLabel || "Xem lại bài đọc"}</summary>
                <div className="px-4 pb-4 text-[15px] leading-relaxed whitespace-pre-wrap max-h-[60vh] overflow-y-auto" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(p.sourceHtml) }} />
              </details>
            )}

            {rows.length === 0 && <p className="text-sm text-muted italic">Không có câu nào trong mục này.</p>}
            <div className="space-y-2">
              {rows.map((q) => {
                const r = byNumber.get(q.questionNumber);
                const text = isTextQuestion(q);
                const mine = text ? (r?.userAnswer ? String(r.userAnswer) : null) : optionLabel(r?.options ?? q.options ?? null, r?.userAnswer);
                const right = r ? (!text && r.correctIndex != null ? optionLabel(r.options, r.correctIndex) : r.correctAnswer) : null;
                return (
                  <div key={q.id} className={`flex gap-3 p-3 rounded-xl border text-sm ${r?.correct ? "border-emerald-200 bg-emerald-50/60" : "border-red-200 bg-red-50/60"}`}>
                    <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${r?.correct ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>{q.questionNumber}</span>
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="text-foreground leading-snug whitespace-pre-line">{q.promptText}</p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1">
                        <p>
                          <span className="text-muted">Bạn trả lời: </span>
                          {mine
                            ? <b className={r?.correct ? "text-emerald-700" : "text-red-700 line-through decoration-1"}>{mine}</b>
                            : <i className="text-red-700">bỏ trống</i>}
                          <span className="ml-1">{r?.correct ? "✓" : "✗"}</span>
                        </p>
                        {!r?.correct && right && <p><span className="text-muted">Đáp án đúng: </span><b className="text-emerald-700">{right}</b></p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
