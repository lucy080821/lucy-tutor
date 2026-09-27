"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { isReadingAnswerCorrect, type ReadingQuestion } from "@/lib/readingGrading";
import { formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface MockQuestion extends ReadingQuestion {
  section: string;
}

interface MockSection {
  section: string;
  passage?: string;
  questions: MockQuestion[];
}

interface MockAnalysis {
  overall: string;
  bySection: { section: string; note: string }[];
  suggestions: string[];
}

const SECTION_LABELS: Record<string, string> = {
  PHONETICS: "Ngữ Âm",
  GRAMMAR_VOCAB: "Ngữ Pháp & Từ Vựng",
  COMMUNICATION: "Giao Tiếp",
  CLOZE: "Đọc Điền Từ",
  READING: "Đọc Hiểu"
};

const VARIANTS = [
  { value: "SHORT", label: "Đề Ngắn", desc: "~20 câu · 25 phút" },
  { value: "FULL", label: "Đề Đầy Đủ", desc: "~40 câu · 50 phút" }
];

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <div className="w-24 h-24 rounded-full flex items-center justify-center shrink-0" style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #eef2fb 0deg)` }}>
      <div className="w-[76px] h-[76px] rounded-full bg-surface flex flex-col items-center justify-center">
        <span className="text-xl font-black text-foreground">{pct}%</span>
        <span className="text-[10px] text-muted font-semibold">{score}/{total}</span>
      </div>
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function MockTestPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Học viên");
  const [viewMode, setViewMode] = useState<"PRACTICE" | "HISTORY">("PRACTICE");
  const [stage, setStage] = useState<"SELECT" | "TAKING" | "RESULT">("SELECT");

  const [variant, setVariant] = useState<"SHORT" | "FULL">("SHORT");
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<MockSection[] | null>(null);
  const [durationSec, setDurationSec] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);

  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [practicedAt, setPracticedAt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<MockAnalysis | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const historyPagination = usePagination(history, 10);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);

  const pdfRef = useRef<HTMLDivElement>(null);
  const historyPdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then(r => r.json()).then(u => setUserName(u.name || "Học viên")).catch(() => {});
    fetchHistory(uid);
  }, [router]);

  const fetchHistory = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/mock-test/attempts/${uid}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  const flatQuestions: MockQuestion[] = sections ? sections.flatMap(s => s.questions) : [];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/api/mock-test/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSections(data.sections);
      setDurationSec(data.durationSec);
      setTimeLeft(data.durationSec);
      setAnswers({});
      setSubmitted(false);
      setAnalysis(null);
      setAttemptId(null);
      setStage("TAKING");
    } catch {
      Swal.fire("Lỗi", "Không thể tạo đề thi thử lúc này. Vui lòng thử lại.", "error");
    } finally {
      setGenerating(false);
    }
  };

  const selectAnswer = (qIndex: number, value: number) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [qIndex]: value }));
  };

  const handleSubmit = useCallback(async () => {
    if (!sections || submitted) return;
    setSubmitted(true);
    const now = new Date().toISOString();
    setPracticedAt(now);
    setStage("RESULT");

    const correctCount = flatQuestions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0);
    const score = (correctCount / Math.max(flatQuestions.length, 1)) * 10;
    const timeSpentSec = durationSec - timeLeft;

    if (userId) {
      try {
        const res = await fetch(`${API}/api/mock-test/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, variant, sections, answers, score, timeSpentSec })
        });
        const saved = await res.json();
        setAttemptId(saved.id);
        // POST returns the same row shape as the history GET — prepend it instead of re-downloading
        // the whole history list.
        if (saved?.id) setHistory(prev => [saved, ...prev.filter((h: any) => h.id !== saved.id)]);
        else fetchHistory(userId);
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections, submitted, flatQuestions, answers, durationSec, timeLeft, userId, variant]);

  // Countdown timer — auto-submits at 0, no anti-cheat tracking (personal self-practice tool)
  useEffect(() => {
    if (stage !== "TAKING" || submitted) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [stage, submitted, timeLeft, handleSubmit]);

  const runAnalysis = async () => {
    if (!sections) return;
    setAnalyzing(true);
    try {
      const results = flatQuestions.map((q, i) => ({ correct: isReadingAnswerCorrect(q, answers[i]) }));
      const res = await fetch(`${API}/api/mock-test/analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: flatQuestions, results, level: "THPT" })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnalysis(data);
      if (attemptId) {
        fetch(`${API}/api/mock-test/attempts/${attemptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis: data })
        }).catch(() => {});
      }
    } catch {
      Swal.fire("Lỗi", "Không thể phân tích lúc này. Vui lòng thử lại.", "error");
    } finally {
      setAnalyzing(false);
    }
  };

  const downloadPdf = async (node: HTMLDivElement | null, filename: string) => {
    if (!node) return;
    setExportingPdf(true);
    try {
      await exportNodeToPDF(node, filename);
    } catch {
      Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const buildRubric = (a: MockAnalysis): SkillReportRubricItem[] =>
    a.bySection.map(s => ({ label: SECTION_LABELS[s.section] || s.section, note: s.note }));

  const backToSelect = () => {
    setStage("SELECT");
    setSections(null);
    setSubmitted(false);
    setAnalysis(null);
    setAnswers({});
  };

  if (!userId) return null;

  const score = flatQuestions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0);

  const historySections: MockSection[] = viewingHistoryItem ? JSON.parse(viewingHistoryItem.sections) : [];
  const historyFlatQuestions: MockQuestion[] = historySections.flatMap(s => s.questions);
  const historyAnswers: Record<number, number> = viewingHistoryItem ? JSON.parse(viewingHistoryItem.answers) : {};
  const historyScore = historyFlatQuestions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, historyAnswers[i]) ? 1 : 0), 0);
  const historyAnalysis: MockAnalysis | null = viewingHistoryItem?.analysis ? JSON.parse(viewingHistoryItem.analysis) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className={`mx-auto px-4 flex items-center justify-between flex-wrap gap-3 ${stage === "TAKING" ? "sticky top-0 z-20 bg-surface border-b border-line py-2.5 shadow-[0_2px_10px_rgba(30,58,138,0.06)] sm:px-8" : "max-w-3xl pt-6 pb-3"}`}>
        <Link href="/dashboard" className="text-sm font-semibold text-muted hover:text-primary transition-colors inline-flex items-center gap-1 py-2">
          ← Quay lại Dashboard
        </Link>
        {stage !== "TAKING" && (
          <div className="flex flex-wrap gap-2">
            {[
              { key: "PRACTICE", label: "Luyện Tập" },
              { key: "HISTORY", label: `Lịch Sử (${history.length})` }
            ].map(v => (
              <button
                key={v.key}
                onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); if (v.key === "PRACTICE") backToSelect(); }}
                className={`ui-chip ${viewMode === v.key ? "ui-chip-active" : ""}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        {stage === "TAKING" && (
          <div className={`px-5 py-2 rounded-full font-mono font-black text-lg ${timeLeft < 300 ? "bg-red-50 text-red-600 ring-1 ring-red-200 animate-pulse" : "bg-primary text-white shadow-[0_4px_12px_rgba(30,58,138,0.25)]"}`}>
            ⏱ {formatTime(timeLeft)}
          </div>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-10 pt-4 space-y-6">
        {viewMode === "PRACTICE" && stage === "SELECT" && (
          <>
            <section className="rounded-2xl bg-primary-soft border border-line px-5 py-6 sm:px-7 sm:py-7 flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm text-muted mb-2">Trang chủ / Đề Thi Thử</p>
                <h1 className="ui-page-title text-2xl sm:text-3xl mb-2">Đề Thi Thử THPT Quốc Gia</h1>
                <p className="ui-page-subtitle max-w-lg leading-relaxed text-sm sm:text-base">
                  AI tự sinh 1 đề trắc nghiệm theo đúng cấu trúc đề Tiếng Anh THPT Quốc Gia: Ngữ âm, Ngữ pháp & Từ vựng, Giao tiếp, Đọc điền từ, Đọc hiểu — làm trong 1 phiên có tính giờ.
                </p>
              </div>
              <div className="hidden md:block w-full max-w-[260px] shrink-0">
                <img src="/images/thumbs/mock-test.svg" alt="Minh hoạ đề thi thử THPT Quốc Gia" width={640} height={360} loading="eager" className="w-full h-auto rounded-2xl" />
              </div>
            </section>

            <div className="ui-card p-5 sm:p-6 space-y-5">
              <h2 className="ui-section-title">Chọn Độ Dài Đề Thi</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VARIANTS.map(v => (
                  <button
                    key={v.value}
                    onClick={() => setVariant(v.value as "SHORT" | "FULL")}
                    className={`text-left p-5 rounded-xl border transition-colors ${variant === v.value ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-line-strong bg-surface hover:border-primary"}`}
                  >
                    <h3 className="font-bold text-lg text-primary">{v.label}</h3>
                    <p className="text-sm text-muted mt-1">{v.desc}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="btn-primary w-full py-3.5"
              >
                {generating ? (<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo đề...</>) : ("Bắt Đầu Làm Bài →")}
              </button>
            </div>
          </>
        )}

        {viewMode === "PRACTICE" && stage === "TAKING" && sections && (
          <div className="space-y-6">
            {(() => {
              let runningIndex = 0;
              return sections.map((sec, si) => {
                const startIndex = runningIndex;
                runningIndex += sec.questions.length;
                return (
                  <div key={si} className="ui-card p-5 space-y-4">
                    <h2 className="font-black text-primary">{SECTION_LABELS[sec.section] || sec.section}</h2>
                    {sec.passage && (
                      <p className="text-foreground leading-relaxed whitespace-pre-line bg-background border border-line border-l-4 border-l-primary rounded-lg p-4 text-sm">{sec.passage}</p>
                    )}
                    <div className="space-y-4">
                      {sec.questions.map((q, qi) => {
                        const flatIndex = startIndex + qi;
                        return (
                          <div key={qi} className="border border-line rounded-xl p-4">
                            <div className="flex items-start gap-3 mb-3">
                              <span className="w-7 h-7 rounded-lg bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
                                {flatIndex + 1}
                              </span>
                              <p className="font-semibold flex-1 text-sm text-foreground pt-1">{q.question}</p>
                            </div>
                            <div className="space-y-2 sm:pl-10">
                              {(q.options || []).map((opt, oi) => (
                                <button
                                  key={oi}
                                  onClick={() => selectAnswer(flatIndex, oi)}
                                  className={`w-full text-left px-4 py-3 border rounded-lg text-sm transition-colors ${answers[flatIndex] === oi ? "border-primary bg-primary-soft text-primary font-semibold" : "border-line-strong bg-surface hover:border-primary hover:bg-primary-soft/50"}`}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              });
            })()}
            <button onClick={handleSubmit} className="btn-primary w-full py-3.5">
              Nộp Bài
            </button>
          </div>
        )}

        {viewMode === "PRACTICE" && stage === "RESULT" && sections && (
          <div className="space-y-6">
            <div className="ui-card p-5 sm:p-6 flex flex-wrap items-center gap-5">
              <ScoreRing score={score} total={flatQuestions.length} />
              <div className="flex-1 min-w-[180px]">
                <p className="text-xl font-black text-primary">Kết quả: {score}/{flatQuestions.length} câu đúng</p>
                {practicedAt && <p className="text-xs text-muted mt-1">{formatPracticedAt(practicedAt)}</p>}
              </div>
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả đề thi thử" width={800} height={600} loading="lazy" className="hidden sm:block w-full max-w-[180px] h-auto" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sections.map((sec, si) => {
                const secCorrect = sec.questions.reduce((s, q) => {
                  const flatIdx = flatQuestions.indexOf(q);
                  return s + (isReadingAnswerCorrect(q, answers[flatIdx]) ? 1 : 0);
                }, 0);
                return (
                  <div key={si} className="bg-surface border border-line rounded-xl p-4 shadow-card">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">{SECTION_LABELS[sec.section] || sec.section}</p>
                    <p className="text-lg font-bold text-primary mt-1">{secCorrect}/{sec.questions.length}</p>
                  </div>
                );
              })}
            </div>

            {!analysis ? (
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className="btn-outline w-full py-3"
              >
                {analyzing ? (<><span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Đang phân tích...</>) : (<>Phân Tích Chi Tiết (AI)</>)}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-foreground">Phân Tích Chi Tiết</h3>
                  <button
                    onClick={() => downloadPdf(pdfRef.current, `bao-cao-thi-thu-${Date.now()}.pdf`)}
                    disabled={exportingPdf}
                    className="btn-outline text-xs px-4 py-2"
                  >
                    {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                <div className="bg-primary-soft border border-primary/15 rounded-xl p-4 text-sm text-foreground leading-relaxed">{analysis.overall}</div>
                {analysis.bySection.map((s, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">{SECTION_LABELS[s.section] || s.section}</p>
                    <p className="text-sm text-foreground leading-relaxed">{s.note}</p>
                  </div>
                ))}
                {analysis.suggestions?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Gợi ý ôn tập</p>
                    <ul className="space-y-1">
                      {analysis.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2"><span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={pdfRef}
                    skillLabel="Đề Thi Thử THPT"
                    skillIcon="🏁"
                    studentName={userName}
                    practicedAt={practicedAt || new Date()}
                    score={(score / Math.max(flatQuestions.length, 1)) * 10}
                    contextTitle={`Đề ${variant === "FULL" ? "Đầy Đủ" : "Ngắn"}`}
                    overallComment={analysis.overall}
                    rubric={buildRubric(analysis)}
                    suggestions={analysis.suggestions || []}
                    transcriptTitle="Đề Thi"
                    transcriptBody={sections.map(s => `${SECTION_LABELS[s.section] || s.section}${s.passage ? `\n${s.passage}` : ""}`).join("\n\n")}
                  />
                </div>
              </div>
            )}

            <button onClick={backToSelect} className="btn-outline w-full py-3">
              Làm Đề Khác
            </button>
          </div>
        )}

        {viewMode === "HISTORY" && !viewingHistoryItem && (
          <div className="space-y-3">
            <h1 className="ui-page-title">Lịch Sử Đề Thi Thử</h1>
            {history.length === 0 ? (
              <div className="ui-card p-6 text-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử đề thi thử" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-3" />
                <p className="text-muted text-sm">Bạn chưa làm đề thi thử nào. Đề sau khi nộp sẽ tự động lưu tại đây.</p>
              </div>
            ) : (
              <>
                {historyPagination.pageItems.map((h) => {
                  const secs: MockSection[] = JSON.parse(h.sections);
                  const total = secs.flatMap(s => s.questions).length;
                  return (
                    <button
                      key={h.id}
                      onClick={() => setViewingHistoryItem(h)}
                      className="w-full text-left ui-card ui-card-hover p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-primary">Đề {h.variant === "FULL" ? "Đầy Đủ" : "Ngắn"} ({total} câu)</p>
                        <p className="text-xs text-muted mt-1">{formatPracticedAt(h.practicedAt)}</p>
                      </div>
                      <span className="ui-badge shrink-0">{h.score.toFixed(1)}/10</span>
                    </button>
                  );
                })}
                <Pagination page={historyPagination.page} totalPages={historyPagination.totalPages} totalItems={historyPagination.totalItems} pageSize={10} onPageChange={historyPagination.setPage} />
              </>
            )}
          </div>
        )}

        {viewMode === "HISTORY" && viewingHistoryItem && (
          <div className="space-y-4">
            <button onClick={() => setViewingHistoryItem(null)} className="text-sm font-semibold text-muted hover:text-primary transition-colors inline-flex items-center gap-1 py-2">
              ← Quay lại danh sách
            </button>
            <h2 className="ui-section-title">Đề {viewingHistoryItem.variant === "FULL" ? "Đầy Đủ" : "Ngắn"}</h2>
            <div className="ui-card p-5 sm:p-6 flex flex-wrap items-center gap-5">
              <ScoreRing score={historyScore} total={historyFlatQuestions.length} />
              <div className="flex-1 min-w-[180px]">
                <p className="text-xl font-black text-primary">Kết quả: {historyScore}/{historyFlatQuestions.length} câu đúng</p>
                <p className="text-xs text-muted mt-1">{formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
              </div>
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả đề thi thử" width={800} height={600} loading="lazy" className="hidden sm:block w-full max-w-[180px] h-auto" />
            </div>
            {historyAnalysis && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-foreground">Phân Tích Chi Tiết</h3>
                  <button
                    onClick={() => downloadPdf(historyPdfRef.current, `bao-cao-thi-thu-${Date.now()}.pdf`)}
                    disabled={exportingPdf}
                    className="btn-outline text-xs px-4 py-2"
                  >
                    {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                <div className="bg-primary-soft border border-primary/15 rounded-xl p-4 text-sm text-foreground leading-relaxed">{historyAnalysis.overall}</div>
                {historyAnalysis.bySection.map((s, i) => (
                  <div key={i} className="bg-surface border border-line rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary mb-2">{SECTION_LABELS[s.section] || s.section}</p>
                    <p className="text-sm text-foreground leading-relaxed">{s.note}</p>
                  </div>
                ))}

                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={historyPdfRef}
                    skillLabel="Đề Thi Thử THPT"
                    skillIcon="🏁"
                    studentName={userName}
                    practicedAt={viewingHistoryItem.practicedAt}
                    score={(historyScore / Math.max(historyFlatQuestions.length, 1)) * 10}
                    contextTitle={`Đề ${viewingHistoryItem.variant === "FULL" ? "Đầy Đủ" : "Ngắn"}`}
                    overallComment={historyAnalysis.overall}
                    rubric={buildRubric(historyAnalysis)}
                    suggestions={historyAnalysis.suggestions || []}
                    transcriptTitle="Đề Thi"
                    transcriptBody={historySections.map(s => `${SECTION_LABELS[s.section] || s.section}${s.passage ? `\n${s.passage}` : ""}`).join("\n\n")}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
