"use client";
import { QUESTION_TYPE_META, FILL_TYPES, QuestionType } from "@/lib/readingGrading";

export function QuestionAnswerForm({ question, value, onChange }: { question: any; value: any; onChange: (v: any) => void }) {
  const isFillType = FILL_TYPES.includes(question.type as QuestionType);
  const meta = QUESTION_TYPE_META[question.type as QuestionType];

  return (
    <div className="p-4 rounded-xl border border-line bg-surface">
      <p className="text-xs font-bold text-primary mb-1">Câu {question.questionNumber} — {meta?.label}</p>
      {question.groupInstruction && <p className="text-xs italic text-muted mb-1">{question.groupInstruction}</p>}
      <p className="text-sm mb-3 text-foreground">{question.promptText}</p>
      {question.wordLimit && <p className="text-xs text-muted mb-2">({question.wordLimit})</p>}
      {question.imageUrl && <img src={question.imageUrl} alt="" className="max-h-48 rounded-lg border border-line mb-2" />}

      {isFillType ? (
        <input
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="ui-input text-sm"
          placeholder="Nhập câu trả lời..."
        />
      ) : (
        <div className="space-y-1.5">
          {(question.options || []).map((opt: string, i: number) => (
            <label key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-colors ${value === i ? "border-primary bg-primary-soft text-primary font-bold" : "border-line-strong bg-surface hover:border-primary hover:bg-primary-soft/50"}`}>
              <input type="radio" className="accent-primary w-4 h-4 shrink-0" name={`q-${question.id}`} checked={value === i} onChange={() => onChange(i)} />
              {opt}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
