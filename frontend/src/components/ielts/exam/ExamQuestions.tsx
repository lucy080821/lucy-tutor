"use client";
import { memo } from "react";
import { FILL_TYPES, type QuestionType } from "@/lib/readingGrading";

// Hiển thị câu hỏi IELTS theo NHÓM như đề thật: "Questions 1–6" + hướng dẫn chỉ 1 lần cho cả nhóm,
// ô điền từ nằm ngay trong câu (thay cho chỗ trống "____"), True/False/Not Given là 3 nút ngang,
// danh sách lựa chọn dùng chung (vd List of Headings) hiện 1 lần ở đầu nhóm.

export type ExamQuestion = {
  id: string;
  questionNumber: number;
  type: string;
  groupInstruction?: string | null;
  promptText: string;
  options?: string[] | null;
  answerMode?: "TEXT" | "CHOICE";
  wordLimit?: string | null;
  imageUrl?: string | null;
};

export type AnswerValue = number | string;

const BLANK_RE = /_{3,}|…+|\.{4,}/;
const RANGE_PREFIX_RE = /^\s*Questions?\s+\d+\s*(?:[-–—]|to|and)\s*\d+\s*[:.]?\s*/i;

export function isTextQuestion(q: ExamQuestion) {
  if (q.answerMode) return q.answerMode === "TEXT";
  return FILL_TYPES.includes(q.type as QuestionType) || !(q.options && q.options.length);
}

type Group = { key: string; instruction: string; questions: ExamQuestion[] };

function groupQuestions(questions: ExamQuestion[]): Group[] {
  const groups: Group[] = [];
  for (const q of questions) {
    const instr = (q.groupInstruction || "").trim();
    const last = groups[groups.length - 1];
    const sameInstr = last && last.instruction === instr;
    const sameKind = last && isTextQuestion(last.questions[0]) === isTextQuestion(q);
    if (last && sameInstr && (instr || sameKind)) last.questions.push(q);
    else groups.push({ key: q.id, instruction: instr, questions: [q] });
  }
  return groups;
}

// Nhãn có sẵn trong lựa chọn ("A. ...", "iv) ...") → tách ra; không có thì tự đánh A, B, C…
function splitLabel(opt: string, i: number) {
  // "A. …", "iv) …", "B  …" — hoặc số La Mã thường + 1 dấu cách ("iv The cost…", kiểu List of Headings)
  const m = opt.match(/^\s*([A-Z]|[ivxlc]{1,5})(?:[.)]\s+|\s{2,}|\t)([\s\S]*)$/) || opt.match(/^\s*([ivxl]{1,5})\s+(\S[\s\S]*)$/);
  if (m) return { label: m[1], text: m[2] };
  return { label: String.fromCharCode(65 + i), text: opt };
}

const isShortOptions = (opts: string[]) => opts.every((o) => o.trim().length <= 3);
const isTFNG = (q: ExamQuestion) => q.type === "TRUE_FALSE" || q.type === "YES_NO_NOTGIVEN";

function sharedOptionList(g: Group): string[] | null {
  if (g.questions.length < 2) return null;
  const first = g.questions[0];
  if (isTextQuestion(first) || isTFNG(first) || !first.options || first.options.length < 3) return null;
  if (isShortOptions(first.options)) return null;
  const sig = JSON.stringify(first.options);
  return g.questions.every((q) => !isTextQuestion(q) && JSON.stringify(q.options) === sig) ? first.options : null;
}

function FlagButton({ flagged, onClick, n }: { flagged: boolean; onClick: () => void; n: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={flagged}
      aria-label={flagged ? `Bỏ đánh dấu câu ${n}` : `Đánh dấu xem lại câu ${n}`}
      title={flagged ? "Bỏ đánh dấu" : "Đánh dấu để xem lại"}
      className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors ${flagged ? "bg-amber-100 text-amber-600" : "text-muted/60 hover:bg-primary-soft hover:text-primary"}`}
    >
      <svg viewBox="0 0 20 20" width="16" height="16" fill={flagged ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M4.5 18V3m0 1h9.5l-2 3.5 2 3.5H4.5" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function NumberBadge({ n, done }: { n: number; done: boolean }) {
  return (
    <span className={`shrink-0 inline-flex items-center justify-center min-w-[2em] h-[2em] px-1 rounded-lg text-[0.85em] font-bold tabular-nums ${done ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>
      {n}
    </span>
  );
}

function TextAnswer({ q, value, onChange }: { q: ExamQuestion; value: AnswerValue | undefined; onChange: (v: string) => void }) {
  const parts = q.promptText.split(BLANK_RE);
  const letters = q.options && q.options.length && isShortOptions(q.options) ? q.options : null;

  // Điền bằng chữ cái từ ngân hàng từ (A–I…): bấm nút chữ cái, chỗ trống hiện chữ đã chọn
  if (letters) {
    const cur = value === undefined ? "" : String(value).trim().toUpperCase();
    const slot = (
      <span className={`inline-flex items-center justify-center align-baseline min-w-[3em] mx-1 px-2 rounded-md border-2 font-bold ${cur ? "border-primary text-primary bg-primary-soft" : "border-dashed border-line-strong text-muted/70"}`}>
        {cur || q.questionNumber}
      </span>
    );
    return (
      <div>
        {parts.length > 1
          ? <p className="whitespace-pre-line leading-[2.1]">{parts[0]}{slot}{parts.slice(1).join("______")}</p>
          : <p className="whitespace-pre-line leading-relaxed">{q.promptText}</p>}
        <div className="flex flex-wrap gap-2 mt-2.5">
          {letters.map((l) => {
            const on = cur === l.trim().toUpperCase();
            return (
              <button
                key={l}
                type="button"
                data-answer
                aria-pressed={on}
                onClick={() => onChange(on ? "" : l.trim())}
                className={`min-w-[2.75em] h-[2.5em] px-3 rounded-full border-2 text-[0.9em] font-bold cursor-pointer transition-colors ${on ? "bg-primary border-primary text-white" : "bg-surface border-line-strong text-foreground hover:border-primary hover:text-primary"}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const input = (inline: boolean) => (
    <input
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={inline ? String(q.questionNumber) : "Nhập câu trả lời"}
      aria-label={`Câu ${q.questionNumber}`}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      className={inline
        ? "inline-block align-baseline w-[9.5em] max-w-full mx-1 px-2 py-0.5 rounded-md border-2 border-line-strong bg-surface text-center font-semibold text-primary placeholder:text-muted/70 placeholder:font-bold focus:border-primary focus:outline-none"
        : "ui-input mt-2 max-w-sm font-semibold text-primary"}
    />
  );
  if (parts.length > 1) {
    const [before, ...rest] = parts;
    return (
      <p className="whitespace-pre-line leading-[2.1]">
        {before}{input(true)}{rest.join("______")}
      </p>
    );
  }
  return (
    <div>
      <p className="whitespace-pre-line leading-relaxed">{q.promptText}</p>
      {input(false)}
    </div>
  );
}

function ChoiceAnswer({ q, value, onChange, sharedList }: { q: ExamQuestion; value: AnswerValue | undefined; onChange: (v: number | undefined) => void; sharedList: boolean }) {
  const opts = q.options || [];
  const selected = typeof value === "number" ? value : value === undefined ? undefined : Number(value);
  const toggle = (i: number) => onChange(selected === i ? undefined : i);

  // Danh sách chung đã in ở đầu nhóm → mỗi câu chỉ còn dropdown chọn nhãn
  if (sharedList) {
    return (
      <div>
        <p className="whitespace-pre-line leading-relaxed">{q.promptText}</p>
        <select
          value={selected ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
          aria-label={`Câu ${q.questionNumber}`}
          className="ui-input mt-2 max-w-md font-semibold text-primary cursor-pointer"
        >
          <option value="">— Chọn —</option>
          {opts.map((o, i) => {
            const { label, text } = splitLabel(o, i);
            return <option key={i} value={i}>{label}. {text.length > 70 ? `${text.slice(0, 70)}…` : text}</option>;
          })}
        </select>
      </div>
    );
  }

  // True/False/Not Given, chữ cái A–G… → nút ngang
  if (isTFNG(q) || isShortOptions(opts)) {
    return (
      <div>
        <p className="whitespace-pre-line leading-relaxed">{q.promptText}</p>
        <div className="flex flex-wrap gap-2 mt-2.5">
          {opts.map((o, i) => (
            <button
              key={i}
              type="button"
              data-answer
              aria-pressed={selected === i}
              onClick={() => toggle(i)}
              className={`min-w-[2.75em] h-[2.5em] px-3.5 rounded-full border-2 text-[0.9em] font-bold cursor-pointer transition-colors ${selected === i ? "bg-primary border-primary text-white" : "bg-surface border-line-strong text-foreground hover:border-primary hover:text-primary"}`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Trắc nghiệm có nội dung lựa chọn → danh sách dọc, nhãn chữ cái
  return (
    <div>
      <p className="whitespace-pre-line leading-relaxed">{q.promptText}</p>
      <div className="space-y-2 mt-2.5">
        {opts.map((o, i) => {
          const { label, text } = splitLabel(o, i);
          const on = selected === i;
          return (
            <button
              key={i}
              type="button"
              data-answer
              aria-pressed={on}
              onClick={() => toggle(i)}
              className={`w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-colors ${on ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/60"}`}
            >
              <span className={`shrink-0 w-[1.9em] h-[1.9em] rounded-full flex items-center justify-center text-[0.85em] font-bold ${on ? "bg-primary text-white" : "bg-primary-soft text-primary"}`}>{label}</span>
              <span className={`pt-0.5 leading-snug ${on ? "font-semibold text-primary" : ""}`}>{text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  questions: ExamQuestion[];
  answers: Record<number, AnswerValue>;
  onAnswer: (n: number, v: AnswerValue | undefined) => void;
  flags: number[];
  onToggleFlag: (n: number) => void;
  current: number | null;
  onCurrent: (n: number) => void;
};

export const ExamQuestionGroups = memo(function ExamQuestionGroups({ questions, answers, onAnswer, flags, onToggleFlag, current, onCurrent }: Props) {
  const groups = groupQuestions(questions);
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const first = g.questions[0].questionNumber;
        const last = g.questions[g.questions.length - 1].questionNumber;
        const instruction = g.instruction.replace(RANGE_PREFIX_RE, "");
        const shared = sharedOptionList(g);
        const groupImage = g.questions.every((q) => q.imageUrl && q.imageUrl === g.questions[0].imageUrl) ? g.questions[0].imageUrl : null;
        const wordLimit = g.questions.every((q) => q.wordLimit === g.questions[0].wordLimit) ? g.questions[0].wordLimit : null;

        return (
          <section key={g.key} aria-label={`Questions ${first}–${last}`}>
            <div className="mb-3">
              <h3 className="font-bold text-primary text-[1.05em]">{first === last ? `Question ${first}` : `Questions ${first}–${last}`}</h3>
              {instruction && <p className="mt-1 text-[0.95em] text-foreground/80 whitespace-pre-line">{instruction}</p>}
              {wordLimit && !instruction.toLowerCase().includes(wordLimit.toLowerCase()) && (
                <p className="mt-1 text-[0.85em] font-bold uppercase tracking-wide text-amber-700">{wordLimit}</p>
              )}
            </div>

            {groupImage && <img src={groupImage} alt={`Hình minh hoạ câu ${first}–${last}`} className="max-h-80 rounded-xl border border-line mb-3 bg-white" />}

            {shared && (
              <div className="mb-4 rounded-xl border border-line bg-background p-3.5">
                <p className="text-[0.8em] font-bold uppercase tracking-wide text-muted mb-2">Danh sách lựa chọn</p>
                <ol className="space-y-1.5">
                  {shared.map((o, i) => {
                    const { label, text } = splitLabel(o, i);
                    return (
                      <li key={i} className="flex gap-2.5 leading-snug">
                        <span className="shrink-0 min-w-[1.8em] font-bold text-primary">{label}</span>
                        <span>{text}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            <div className="space-y-2">
              {g.questions.map((q) => {
                const n = q.questionNumber;
                const v = answers[n];
                const done = v !== undefined && String(v).trim() !== "";
                const flagged = flags.includes(n);
                return (
                    <div
                      key={q.id}
                      id={`q-${n}`}
                      onFocusCapture={() => onCurrent(n)}
                      onPointerDown={() => onCurrent(n)}
                      className={`scroll-mt-4 flex gap-3 rounded-xl px-2.5 py-3 -mx-2.5 transition-colors ${current === n ? "bg-primary-soft/70" : ""} ${flagged ? "ring-1 ring-amber-300" : ""}`}
                    >
                      <NumberBadge n={n} done={done} />
                      <div className="flex-1 min-w-0 pt-[0.15em]">
                        {isTextQuestion(q)
                          ? <TextAnswer q={q} value={v} onChange={(s) => onAnswer(n, s)} />
                          : <ChoiceAnswer q={q} value={v} sharedList={!!shared} onChange={(i) => onAnswer(n, i)} />}
                        {q.imageUrl && !groupImage && <img src={q.imageUrl} alt={`Hình minh hoạ câu ${n}`} className="max-h-56 rounded-lg border border-line mt-2 bg-white" />}
                      </div>
                      <FlagButton flagged={flagged} n={n} onClick={() => onToggleFlag(n)} />
                    </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
});
