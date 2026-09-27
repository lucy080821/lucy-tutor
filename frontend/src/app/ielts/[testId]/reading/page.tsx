"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import DOMPurify from "dompurify";
import { QUESTION_TYPE_META, FILL_TYPES, QuestionType } from "@/lib/readingGrading";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DURATION_SEC = 60 * 60; // real IELTS Reading is 60 minutes

// Student Reading test-taking page — timed (60 min, auto-submit at 0), passages shown with
// their question groups, graded deterministically against the book's own answer key
// (backend-side, via ieltsAttempts.routes.js's /reading/submit) — the raw score → band
// conversion depends on test.testType (Academic vs GT use different concordance tables).
export default function IeltsReadingTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<{ testType: string | null; passages: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);
  const startedAtRef = useRef(Date.now());
  const submitRef = useRef<() => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => setUserName(u.name || "Học viên")).catch(() => {});
    fetch(`${API}/api/ielts-attempts/tests/${testId}/reading?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { Swal.fire("Lỗi", d.error, "error"); router.push("/ielts"); return; } setData(d); })
      .finally(() => setLoading(false));
  }, [testId, router]);

  const handleSubmit = useCallback(async () => {
    if (!userId || submitting) return;
    setSubmitting(true);
    try {
      const timeSpentSec = Math.round((Date.now() - startedAtRef.current) / 1000);
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/reading/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, answers, timeSpentSec })
      });
      const resData = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", resData.error || "Không thể nộp bài", "error"); return; }
      setResult(resData);
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể nộp bài", "error"); } finally { setSubmitting(false); }
  }, [userId, testId, answers, submitting]);
  submitRef.current = handleSubmit;

  useEffect(() => {
    if (!data || result) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); submitRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [data, result]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!data) return null;

  const totalQuestions = data.passages.reduce((s, p) => s + p.questions.length, 0);
  const answeredCount = Object.keys(answers).length;
  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

  if (result) {
    const reviewByNumber: Record<number, any> = {};
    (result.review || []).forEach((r: any) => { reviewByNumber[r.questionNumber] = r; });
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-6">
          <div className="ui-hero px-6 py-10 shadow-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Kết quả Reading</p>
              <p className="text-6xl sm:text-7xl font-black text-white mt-2">{result.band?.toFixed(1)}</p>
              <p className="text-sm text-white/80 mt-2">Đúng {result.rawScore}/{totalQuestions} câu</p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả IELTS Reading" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ielts" className="btn-primary px-5 py-2.5">← Về trang IELTS</Link>
            <button
              onClick={async () => { if (!pdfRef.current) return; setExportingPdf(true); try { await exportNodeToPDF(pdfRef.current, `ielts-reading-${Date.now()}.pdf`); } catch { Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error"); } finally { setExportingPdf(false); } }}
              disabled={exportingPdf}
              className="btn-outline px-5 py-2.5 cursor-pointer"
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-16 space-y-6">
          {data.passages.map((p) => (
            <div key={p.id} className="ui-card p-5 space-y-3">
              <h3 className="font-bold text-primary">Section {p.sectionNumber}{p.passageIndex > 1 ? `.${p.passageIndex}` : ""}</h3>
              {p.questions.map((q: any) => {
                const r = reviewByNumber[q.questionNumber];
                return (
                  <div key={q.id} className={`p-3 rounded-xl border text-sm ${r?.correct ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"}`}>
                    <p className="font-bold">{r?.correct ? "✓" : "✗"} Câu {q.questionNumber}: {q.promptText}</p>
                    <p className="text-muted mt-0.5">Đáp án đúng: {r?.options ? r.options[r.correctIndex] : r?.correctAnswer}</p>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
          <SkillReportPDF
            ref={pdfRef}
            skillLabel="IELTS Reading"
            skillIcon="📖"
            studentName={userName}
            practicedAt={new Date()}
            score={result.band}
            scoreScale="9"
            contextTitle={`Đúng ${result.rawScore}/${totalQuestions} câu`}
            overallComment={`Học viên đạt band ${result.band?.toFixed(1)} cho phần Reading, đúng ${result.rawScore}/${totalQuestions} câu.`}
            rubric={data.passages.map((p): SkillReportRubricItem => {
              const qs = p.questions.map((q: any) => reviewByNumber[q.questionNumber]);
              const correct = qs.filter((r: any) => r?.correct).length;
              return { label: `Section ${p.sectionNumber}${p.passageIndex > 1 ? `.${p.passageIndex}` : ""}`, note: `Đúng ${correct}/${qs.length} câu` };
            })}
            suggestions={[]}
            transcriptTitle="Đề bài"
            transcriptBody={data.passages.map((p) => p.bodyText).join("\n\n---\n\n")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-20 bg-surface border-b border-line px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap shadow-[0_2px_10px_rgba(30,58,138,0.06)]">
        <h1 className="font-bold text-primary text-sm sm:text-base">IELTS Reading</h1>
        <span className="text-xs font-semibold text-muted">{answeredCount}/{totalQuestions} câu đã trả lời</span>
        <span className={`ml-auto font-mono font-black text-base sm:text-lg px-4 py-1.5 rounded-full ${timeLeft < 300 ? "bg-red-50 text-red-600 ring-1 ring-red-200 animate-pulse" : "bg-primary text-white shadow-[0_4px_12px_rgba(30,58,138,0.25)]"}`}>{mm}:{ss}</span>
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-5 py-2 text-sm cursor-pointer">
          {submitting ? "Đang nộp..." : "Nộp bài"}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {data.passages.map((passage: any) => (
          <div key={passage.id} className="ui-card p-5 sm:p-6 space-y-4">
            <h2 className="ui-section-title text-lg">Section {passage.sectionNumber}{passage.passageIndex > 1 ? `.${passage.passageIndex}` : ""}{passage.title ? ` — ${passage.title}` : ""}</h2>
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start space-y-4 lg:space-y-0">
            <div className="space-y-3 lg:sticky lg:top-20">
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap max-h-96 lg:max-h-[calc(100vh-8rem)] overflow-y-auto p-4 sm:p-5 bg-background rounded-xl border border-line text-foreground" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(passage.bodyText) }} />
            {passage.imageUrl && <img src={passage.imageUrl} alt="" className="max-h-72 rounded-lg border border-line" />}
            </div>

            <div className="space-y-3">
              {passage.questions.map((q: any) => (
                <QuestionAnswerForm key={q.id} question={q} value={answers[q.questionNumber]} onChange={(v) => setAnswers((prev) => ({ ...prev, [q.questionNumber]: v }))} />
              ))}
            </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
