"use client";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { FILL_TYPES, QUESTION_TYPE_META, QuestionType, ReadingQuestion, isReadingAnswerCorrect, readingCorrectAnswerLabel } from "@/lib/readingGrading";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type IeltsSkill = "LISTENING" | "READING" | "WRITING" | "SPEAKING";
const SKILL_LABEL: Record<IeltsSkill, string> = { LISTENING: "Listening", READING: "Reading", WRITING: "Writing", SPEAKING: "Speaking" };

type Vocab = { word: string; ipa?: string; partOfSpeech?: string; meaning: string; example?: string };
type Structure = { structure: string; meaning?: string; example?: string };
type StudySection = {
  title: string;
  overview?: string;
  questions?: { questionNumber: number; type: string; promptText: string; userAnswer: string; correctAnswer: string; whyCorrect: string; whyWrong: string; evidence: string; paraphrase: string; tip: string }[];
  errors?: { original: string; corrected: string; explanation: string }[];
  vocabularyUpgrades?: { original: string; better: string; explanation: string }[];
  outline?: string[];
  modelAnswer?: string;
  modelAnswerLabel?: string;
  vocabulary?: Vocab[];
  structures?: Structure[];
  tips?: string[];
};
type Analysis = { skill: IeltsSkill; band?: number; correct?: number; total?: number; wrongCount?: number; sections: StudySection[] };
type PracticeSet = {
  id: string; title: string; instructions?: string; passage?: string; script?: string;
  questions: ReadingQuestion[]; answers?: Record<number, number | string>; score?: number; total?: number; completedAt?: string;
};

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB";
  u.rate = 0.95;
  const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en-GB")) || window.speechSynthesis.getVoices().find((v) => v.lang.startsWith("en"));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

// "Học đề" — the study step shown after a student finishes one skill of an IELTS test (and
// reachable later from the IELTS history tab). Flow: ask → AI deep analysis of the attempt
// (cached server-side, see ieltsStudy.routes.js) → ask whether they want extra practice on
// what they got wrong → generate/take/grade practice sets (graded client-side with the same
// readingGrading.ts rules as /reading and /mock-test).
export default function IeltsStudyPanel({ skill, attemptId, userId, autoStart = false }: { skill: IeltsSkill; attemptId: string; userId: string; autoStart?: boolean }) {
  const [status, setStatus] = useState<"CHECKING" | "ASK" | "DECLINED" | "ANALYZING" | "READY" | "ERROR">("CHECKING");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [practice, setPractice] = useState<PracticeSet[]>([]);
  const [practiceChoice, setPracticeChoice] = useState<"ASK" | "NO" | "YES">("ASK");
  const [generating, setGenerating] = useState(false);

  const applySession = (data: any) => {
    setAnalysis(data.analysis || null);
    setPractice(Array.isArray(data.practice) ? data.practice : []);
    if (Array.isArray(data.practice) && data.practice.length) setPracticeChoice("YES");
  };

  const startAnalysis = async () => {
    setStatus("ANALYZING");
    try {
      const res = await fetch(`${API}/api/ielts-study/${skill}/${attemptId}/analysis`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể phân tích bài làm");
      applySession(data);
      setStatus("READY");
    } catch (err: any) {
      Swal.fire("Lỗi", err.message || "Không thể phân tích bài làm lúc này", "error");
      setStatus("ERROR");
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/api/ielts-study/${skill}/${attemptId}?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.analysis) { applySession(data); setStatus("READY"); }
        else if (autoStart) startAnalysis();
        else setStatus("ASK");
      })
      .catch(() => { if (!cancelled) setStatus("ASK"); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skill, attemptId, userId]);

  const generatePractice = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/ielts-study/${skill}/${attemptId}/practice`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể tạo bài tập");
      setPractice(data.practice || []);
      setPracticeChoice("YES");
    } catch (err: any) {
      Swal.fire("Lỗi", err.message || "Không thể tạo bài tập lúc này", "error");
    } finally {
      setGenerating(false);
    }
  };

  const saveResult = async (setId: string, answers: Record<number, number | string>, score: number, total: number) => {
    setPractice((prev) => prev.map((p) => (p.id === setId ? { ...p, answers, score, total, completedAt: new Date().toISOString() } : p)));
    fetch(`${API}/api/ielts-study/${skill}/${attemptId}/practice/${setId}/result`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, answers, score, total })
    }).catch(() => {});
  };

  if (status === "CHECKING") return null;

  if (status === "ASK" || status === "ERROR") {
    return (
      <div className="ui-card p-5 sm:p-6 text-left border-l-4 border-l-primary">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Bước 2 · Học đề</p>
        <h3 className="text-lg font-extrabold text-primary mt-1">Bạn có muốn phân tích kỹ hơn cách làm bài để hiểu rõ đề thi hơn?</h3>
        <p className="text-sm text-muted mt-1">
          {skill === "READING" || skill === "LISTENING"
            ? "AI sẽ giải thích vì sao bạn làm sai từng câu, vì sao đáp án đúng là đáp án đó chứ không phải đáp án khác, kèm từ vựng và cấu trúc đáng học trong đề."
            : "AI sẽ chỉ ra lỗi cụ thể trong bài của bạn, gợi ý từ vựng/cấu trúc band cao hơn và đưa bài mẫu để bạn tham khảo."}
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <button onClick={startAnalysis} className="btn-primary px-5 py-2.5 cursor-pointer">Có, học đề ngay</button>
          <button onClick={() => setStatus("DECLINED")} className="btn-ghost px-5 py-2.5 cursor-pointer">Để sau</button>
        </div>
      </div>
    );
  }

  if (status === "DECLINED") {
    return (
      <div className="ui-card p-4 text-sm text-muted text-left flex flex-wrap items-center justify-between gap-3">
        <span>Bạn có thể học đề bất cứ lúc nào trong mục <b>Lịch Sử</b> ở trang IELTS.</span>
        <button onClick={startAnalysis} className="btn-outline px-4 py-2 text-sm cursor-pointer">Học đề ngay</button>
      </div>
    );
  }

  if (status === "ANALYZING") {
    return (
      <div className="ui-card p-6 text-left space-y-3">
        <p className="font-bold text-primary flex items-center gap-2">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          AI đang phân tích bài làm của bạn... (khoảng 10-40 giây)
        </p>
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }

  if (!analysis) return null;
  const isObjective = skill === "READING" || skill === "LISTENING";
  const wrongCount = isObjective ? (analysis.wrongCount ?? analysis.sections.reduce((s, x) => s + (x.questions?.length || 0), 0)) : null;

  return (
    <div className="space-y-5 text-left">
      <div className="ui-card p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Bước 2 · Học đề</p>
        <h3 className="ui-section-title mt-1">Phân tích bài làm {SKILL_LABEL[skill]}</h3>
        {isObjective && (
          <p className="text-sm text-muted mt-3">
            Bạn làm đúng {analysis.correct}/{analysis.total} câu. {wrongCount ? `Dưới đây là giải thích chi tiết ${wrongCount} câu sai, cùng từ vựng và cấu trúc trong đề.` : "Bạn không sai câu nào — hãy xem lại từ vựng và cấu trúc đáng học trong đề."}
          </p>
        )}
      </div>

      {analysis.sections.map((section, i) => (
        <StudySectionCard key={i} section={section} skill={skill} userId={userId} defaultOpen={i === 0} />
      ))}

      <div className="ui-card p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-muted">Luyện thêm</p>
        {isObjective && wrongCount === 0 ? (
          <p className="text-sm text-foreground mt-2">Bạn đã làm đúng tất cả các câu — không cần bài tập thêm cho đề này.</p>
        ) : practiceChoice === "ASK" ? (
          <>
            <h3 className="text-lg font-extrabold text-primary mt-1">
              Bạn có cần bài tập thêm về {isObjective ? "các câu bị sai" : "các lỗi sai trong bài"} không?
            </h3>
            <p className="text-sm text-muted mt-1">
              {isObjective
                ? `AI sẽ tạo ${skill === "LISTENING" ? "một đoạn nghe ngắn" : "một đoạn đọc ngắn"} kèm câu hỏi cùng dạng với các câu bạn vừa sai, có chấm điểm và giải thích.`
                : "AI sẽ tạo bài tập sửa lỗi, điền từ và hoàn thành câu dựa đúng trên các lỗi trong bài của bạn."}
            </p>
            <div className="flex flex-wrap gap-3 mt-4">
              <button onClick={generatePractice} disabled={generating} className="btn-primary px-5 py-2.5 cursor-pointer disabled:cursor-wait">
                {generating ? "Đang tạo bài tập..." : "Có, tạo bài tập"}
              </button>
              <button onClick={() => setPracticeChoice("NO")} className="btn-ghost px-5 py-2.5 cursor-pointer">Không cần</button>
            </div>
          </>
        ) : practiceChoice === "NO" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <p className="text-sm text-muted">Bạn có thể tạo bài tập thêm bất cứ lúc nào.</p>
            <button onClick={generatePractice} disabled={generating} className="btn-outline px-4 py-2 text-sm cursor-pointer">
              {generating ? "Đang tạo..." : "Tạo bài tập"}
            </button>
          </div>
        ) : (
          <div className="space-y-5 mt-3">
            {practice.map((set, i) => (
              <PracticeSetCard key={set.id} set={set} index={i + 1} skill={skill} onFinish={(answers, score, total) => saveResult(set.id, answers, score, total)} />
            ))}
            <button onClick={generatePractice} disabled={generating} className="btn-outline px-5 py-2.5 cursor-pointer disabled:cursor-wait">
              {generating ? "Đang tạo bài tập..." : "Tạo thêm bộ bài tập khác"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StudySectionCard({ section, skill, userId, defaultOpen }: { section: StudySection; skill: IeltsSkill; userId: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showModel, setShowModel] = useState(false);
  const wrong = section.questions || [];

  return (
    <div className="ui-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 p-5 cursor-pointer text-left">
        <div>
          <h4 className="font-bold text-primary">{section.title}</h4>
          {(skill === "READING" || skill === "LISTENING") && (
            <p className="text-xs text-muted mt-0.5">{wrong.length ? `${wrong.length} câu sai cần xem lại` : "Không có câu sai"}</p>
          )}
        </div>
        <span className={`text-primary transition-transform ${open ? "rotate-180" : ""}`} aria-hidden>▾</span>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-5 border-t border-line pt-4">
          {section.overview && <p className="text-sm text-foreground leading-relaxed">{section.overview}</p>}

          {wrong.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-bold text-primary">Giải thích câu sai</h5>
              {wrong.map((q) => (
                <div key={q.questionNumber} className="rounded-xl border border-line p-4 space-y-2 text-sm">
                  <p className="font-bold text-foreground">Câu {q.questionNumber}: {q.promptText}</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 font-semibold">Bạn chọn: {q.userAnswer}</span>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold">Đáp án: {q.correctAnswer}</span>
                  </div>
                  {q.evidence && <blockquote className="border-l-4 border-primary/40 bg-primary-soft/60 rounded-r-lg px-3 py-2 italic text-foreground">&ldquo;{q.evidence}&rdquo;</blockquote>}
                  {q.whyCorrect && <p><b className="text-emerald-700">Vì sao đáp án đúng:</b> {q.whyCorrect}</p>}
                  {q.whyWrong && <p><b className="text-red-700">Vì sao bạn sai:</b> {q.whyWrong}</p>}
                  {q.paraphrase && <p><b className="text-primary">Paraphrase:</b> {q.paraphrase}</p>}
                  {q.tip && <p className="text-muted"><b>Mẹo:</b> {q.tip}</p>}
                </div>
              ))}
            </div>
          )}

          {(section.errors || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-primary">Lỗi cần sửa</h5>
              {section.errors!.map((e, i) => (
                <div key={i} className="rounded-xl border border-line p-3 text-sm space-y-1">
                  <p className="text-red-700 line-through decoration-red-300">{e.original}</p>
                  <p className="text-emerald-700 font-semibold">{e.corrected}</p>
                  <p className="text-muted">{e.explanation}</p>
                </div>
              ))}
            </div>
          )}

          {(section.vocabularyUpgrades || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-primary">Nâng cấp từ vựng</h5>
              <div className="overflow-x-auto">
                <table className="ui-table text-sm">
                  <thead><tr><th>Bạn dùng</th><th>Nên dùng</th><th>Ghi chú</th></tr></thead>
                  <tbody>
                    {section.vocabularyUpgrades!.map((u, i) => (
                      <tr key={i}><td className="text-muted">{u.original}</td><td className="font-semibold text-primary">{u.better}</td><td>{u.explanation}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(section.vocabulary || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-primary">Từ vựng đáng học</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.vocabulary!.map((v, i) => <VocabCard key={i} vocab={v} userId={userId} />)}
              </div>
            </div>
          )}

          {(section.structures || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-primary">Cấu trúc</h5>
              {section.structures!.map((s, i) => (
                <div key={i} className="rounded-xl bg-background border border-line p-3 text-sm">
                  <p className="font-bold text-foreground">{s.structure}</p>
                  {s.meaning && <p className="text-muted mt-0.5">{s.meaning}</p>}
                  {s.example && <p className="italic text-foreground mt-1">{s.example}</p>}
                </div>
              ))}
            </div>
          )}

          {(section.outline || []).length > 0 && (
            <div className="space-y-2">
              <h5 className="text-sm font-bold text-primary">Dàn ý nên có</h5>
              <ul className="list-disc pl-5 text-sm space-y-1">{section.outline!.map((o, i) => <li key={i}>{o}</li>)}</ul>
            </div>
          )}

          {section.modelAnswer && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setShowModel(!showModel)} className="btn-outline px-4 py-2 text-sm cursor-pointer">
                  {showModel ? "Ẩn" : "Xem"} {section.modelAnswerLabel || "bài mẫu"}
                </button>
                {skill === "SPEAKING" && showModel && (
                  <button onClick={() => speak(section.modelAnswer!)} className="btn-ghost px-4 py-2 text-sm cursor-pointer">▶ Nghe mẫu</button>
                )}
              </div>
              {showModel && <div className="rounded-xl bg-background border border-line p-4 text-sm leading-relaxed whitespace-pre-wrap">{section.modelAnswer}</div>}
            </div>
          )}

          {(section.tips || []).length > 0 && (
            <div className="rounded-xl bg-primary-soft p-4 text-sm">
              <p className="font-bold text-primary mb-1">Mẹo làm bài</p>
              <ul className="list-disc pl-5 space-y-1">{section.tips!.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VocabCard({ vocab, userId }: { vocab: Vocab; userId: string }) {
  const [saved, setSaved] = useState<"IDLE" | "SAVING" | "DONE">("IDLE");
  const save = async () => {
    setSaved("SAVING");
    try {
      const res = await fetch(`${API}/api/srs/vocab/custom`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, word: vocab.word, meaning: vocab.meaning, phonetic: vocab.ipa || undefined, pos: vocab.partOfSpeech || undefined, example: vocab.example || undefined })
      });
      if (!res.ok) throw new Error();
      setSaved("DONE");
    } catch {
      setSaved("IDLE");
      Swal.fire("Lỗi", "Không thể lưu từ này", "error");
    }
  };
  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-primary">
            {vocab.word} {vocab.partOfSpeech && <span className="text-xs text-muted font-normal">({vocab.partOfSpeech})</span>}
          </p>
          {vocab.ipa && <p className="text-xs text-muted">{vocab.ipa}</p>}
        </div>
        <button onClick={() => speak(vocab.word)} className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full bg-primary-soft text-primary cursor-pointer" aria-label={`Nghe phát âm ${vocab.word}`}>▶</button>
      </div>
      <p className="text-foreground mt-1">{vocab.meaning}</p>
      {vocab.example && <p className="italic text-muted mt-1">{vocab.example}</p>}
      <button onClick={save} disabled={saved !== "IDLE"} className="mt-2 text-xs font-bold text-primary hover:underline disabled:no-underline disabled:text-emerald-700 cursor-pointer py-1">
        {saved === "DONE" ? "✓ Đã thêm vào Từ Của Tôi" : saved === "SAVING" ? "Đang lưu..." : "+ Thêm vào Từ Của Tôi"}
      </button>
    </div>
  );
}

function PracticeSetCard({ set, index, skill, onFinish }: { set: PracticeSet; index: number; skill: IeltsSkill; onFinish: (answers: Record<number, number | string>, score: number, total: number) => void }) {
  const [answers, setAnswers] = useState<Record<number, number | string>>(set.answers || {});
  const done = !!set.completedAt;
  const [open, setOpen] = useState(!done);

  const submit = () => {
    const unanswered = set.questions.length - Object.keys(answers).length;
    const finish = () => {
      const score = set.questions.filter((q, i) => isReadingAnswerCorrect(q, answers[i])).length;
      onFinish(answers, score, set.questions.length);
    };
    if (unanswered > 0) {
      Swal.fire({ title: "Nộp bài?", text: `Bạn còn ${unanswered} câu chưa trả lời.`, icon: "question", showCancelButton: true, confirmButtonText: "Nộp", cancelButtonText: "Làm tiếp" })
        .then((r) => { if (r.isConfirmed) finish(); });
    } else finish();
  };

  return (
    <div className="rounded-2xl border border-line bg-surface">
      <button onClick={() => setOpen(!open)} className="w-full flex flex-wrap items-center justify-between gap-2 p-4 cursor-pointer text-left">
        <div>
          <p className="text-xs text-muted">Bộ bài tập {index}</p>
          <p className="font-bold text-primary">{set.title}</p>
        </div>
        {done
          ? <span className="ui-badge bg-emerald-50 text-emerald-700">Đúng {set.score}/{set.total}</span>
          : <span className="ui-badge">Chưa làm</span>}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-line pt-4">
          {set.instructions && <p className="text-sm text-muted">{set.instructions}</p>}

          {set.passage && <div className="rounded-xl bg-background border border-line p-4 text-[15px] leading-relaxed whitespace-pre-wrap">{set.passage}</div>}

          {set.script && (
            <div className="rounded-xl bg-background border border-line p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => speak(set.script!)} className="btn-primary px-4 py-2 text-sm cursor-pointer">▶ Nghe đoạn hội thoại</button>
                <button onClick={() => typeof window !== "undefined" && window.speechSynthesis?.cancel()} className="btn-ghost px-4 py-2 text-sm cursor-pointer">Dừng</button>
              </div>
              {done
                ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{set.script}</p>
                : <p className="text-xs text-muted">Giọng đọc máy của trình duyệt — script sẽ hiện sau khi nộp bài.</p>}
            </div>
          )}

          <div className="space-y-3">
            {set.questions.map((q, i) => {
              const isFill = FILL_TYPES.includes(q.type as QuestionType);
              const correct = done ? isReadingAnswerCorrect(q, answers[i]) : null;
              return (
                <div key={i} className={`p-4 rounded-xl border text-sm ${done ? (correct ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50") : "border-line"}`}>
                  <p className="text-xs font-bold text-primary mb-1">Câu {i + 1} — {QUESTION_TYPE_META[q.type as QuestionType]?.label || q.type}</p>
                  <p className="text-foreground mb-2 whitespace-pre-wrap">{q.question}</p>
                  {q.wordLimit && <p className="text-xs text-muted mb-2">({q.wordLimit})</p>}
                  {isFill ? (
                    <input value={answers[i] ?? ""} disabled={done} onChange={(e) => setAnswers((p) => ({ ...p, [i]: e.target.value }))} className="ui-input text-sm" placeholder="Nhập câu trả lời..." />
                  ) : (
                    <div className="space-y-1.5">
                      {(q.options || []).map((opt, oi) => (
                        <label key={oi} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${done ? "cursor-default" : "cursor-pointer hover:border-primary"} ${answers[i] === oi ? "border-primary bg-primary-soft text-primary font-bold" : "border-line-strong bg-surface"}`}>
                          <input type="radio" className="accent-primary w-4 h-4 shrink-0" disabled={done} name={`p-${set.id}-${i}`} checked={answers[i] === oi} onChange={() => setAnswers((p) => ({ ...p, [i]: oi }))} />
                          {opt}
                        </label>
                      ))}
                    </div>
                  )}
                  {done && (
                    <div className="mt-2 space-y-1">
                      <p className={correct ? "text-emerald-700 font-semibold" : "text-red-700 font-semibold"}>{correct ? "✓ Đúng" : `✗ Sai — đáp án: ${readingCorrectAnswerLabel(q)}`}</p>
                      {q.explanation && <p className="text-muted">{q.explanation}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!done && <button onClick={submit} className="btn-primary px-6 py-2.5 cursor-pointer">Nộp bài tập</button>}
          {done && skill && <p className="text-sm font-bold text-primary">Kết quả: đúng {set.score}/{set.total} câu</p>}
        </div>
      )}
    </div>
  );
}
