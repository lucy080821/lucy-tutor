"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { HighlightedText } from "@/lib/highlightText";
import { exportReadingToWord } from "@/lib/wordExport";
import { isReadingAnswerCorrect, FILL_TYPES, QUESTION_TYPE_META, type ReadingQuestion, type QuestionType } from "@/lib/readingGrading";
import { logSkillProgress } from "@/lib/skillProgress";
import { CEFR_LEVELS, PRACTICE_PURPOSES, CefrLevel, PracticePurpose, formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

interface Passage {
  title: string;
  passage: string;
  questions: ReadingQuestion[];
}

interface ReadingAnalysis {
  overall: string;
  byType: { type: string; note: string }[];
  suggestions: string[];
}

const LENGTHS = [
  { value: "SHORT", label: "Ngắn (~100-150 từ)" },
  { value: "MEDIUM", label: "Trung bình (~200-250 từ)" },
  { value: "LONG", label: "Dài (~300-380 từ)" }
];

const ALL_QUESTION_TYPES = Object.keys(QUESTION_TYPE_META) as QuestionType[];

const TOPIC_SUGGESTIONS = ["Du lịch", "Công nghệ", "Môi trường", "Sức khỏe", "Văn hóa", "Công việc"];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const fieldLabelClass = "block text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2";
const fieldInputClass = "w-full p-3 border border-foreground/15 bg-background rounded-xl font-semibold text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors";

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;
  const color = pct >= 80 ? "#10b981" : pct >= 50 ? "#3b82f6" : "#f59e0b";
  return (
    <div
      className="w-24 h-24 rounded-full flex items-center justify-center shrink-0"
      style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(15,23,42,0.08) 0deg)` }}
    >
      <div className="w-[76px] h-[76px] rounded-full bg-surface flex flex-col items-center justify-center">
        <span className="text-xl font-black text-foreground">{pct}%</span>
        <span className="text-[10px] text-foreground/50 font-semibold">{score}/{total}</span>
      </div>
    </div>
  );
}

function scoreMessage(pct: number) {
  if (pct >= 80) return "Xuất sắc! Bạn đọc hiểu rất tốt 🎉";
  if (pct >= 50) return "Khá tốt! Cố gắng thêm chút nữa nhé 💪";
  return "Cần luyện tập thêm — đừng nản, hãy thử lại 📚";
}

export default function ReadingPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Học viên");
  const [viewMode, setViewMode] = useState<"PRACTICE" | "HISTORY">("PRACTICE");

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [purpose, setPurpose] = useState<PracticePurpose>("GENERAL");
  const [length, setLength] = useState("MEDIUM");
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(["MULTIPLE_CHOICE", "FILL_BLANK"]);
  const [numQuestions, setNumQuestions] = useState(4);
  const [loading, setLoading] = useState(false);

  const [passage, setPassage] = useState<Passage | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [practicedAt, setPracticedAt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<ReadingAnalysis | null>(null);

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
      const res = await fetch(`${API}/api/ai/reading-attempts/${uid}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  const toggleType = (t: QuestionType) => {
    setQuestionTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const generatePassage = async () => {
    if (questionTypes.length === 0) {
      Swal.fire("Chưa chọn dạng câu hỏi", "Vui lòng chọn ít nhất 1 dạng câu hỏi.", "warning");
      return;
    }
    setLoading(true);
    setPassage(null);
    setAnswers({});
    setSubmitted(false);
    setAnalysis(null);
    setAttemptId(null);
    try {
      const count = Math.min(15, Math.max(1, numQuestions || 4));
      const res = await fetch(`${API}/api/ai/generate-reading-passage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), level, purpose, length, questionTypes, numQuestions: count })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPassage(data);
    } catch {
      Swal.fire("Lỗi", "Không thể tạo bài đọc lúc này. Vui lòng thử lại.", "error");
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (qIndex: number, value: number | string) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: value }));
  };

  const submitAnswers = async () => {
    if (!passage) return;
    const unanswered = passage.questions.some((q, i) => {
      const a = answers[i];
      return a === undefined || (typeof a === "string" && !a.trim());
    });
    if (unanswered) {
      Swal.fire("Chưa xong", "Vui lòng trả lời hết các câu hỏi trước khi nộp.", "warning");
      return;
    }
    setSubmitted(true);
    const now = new Date().toISOString();
    setPracticedAt(now);

    const correctCount = passage.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0);
    const score = (correctCount / passage.questions.length) * 10;
    logSkillProgress(userId, "READING", score, "READING_PRACTICE");

    if (userId) {
      try {
        const res = await fetch(`${API}/api/ai/reading-attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, topic: topic.trim() || passage.title, passage: passage.passage, level, purpose, questions: passage.questions, answers, score })
        });
        const saved = await res.json();
        setAttemptId(saved.id);
        fetchHistory(userId);
      } catch {}
    }
  };

  const runAnalysis = async () => {
    if (!passage) return;
    setAnalyzing(true);
    try {
      const results = passage.questions.map((q, i) => ({ correct: isReadingAnswerCorrect(q, answers[i]) }));
      const res = await fetch(`${API}/api/ai/reading-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage: passage.passage, questions: passage.questions, results, level })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAnalysis(data);
      if (attemptId) {
        fetch(`${API}/api/ai/reading-attempts/${attemptId}`, {
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

  const downloadWord = async () => {
    if (!passage) return;
    setDownloading(true);
    try {
      await exportReadingToWord({ title: passage.title, passage: passage.passage, questions: passage.questions, answers });
    } catch {
      Swal.fire("Lỗi", "Không thể tạo file Word lúc này.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const downloadPdf = async (node: HTMLDivElement | null) => {
    if (!node) return;
    setExportingPdf(true);
    try {
      await exportNodeToPDF(node, `bao-cao-luyen-doc-${Date.now()}.pdf`);
    } catch {
      Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const buildRubric = (a: ReadingAnalysis): SkillReportRubricItem[] =>
    a.byType.map((t) => ({ label: QUESTION_TYPE_META[t.type as QuestionType]?.label || t.type, note: t.note }));

  const score = passage
    ? passage.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0)
    : 0;
  const scorePct = passage && passage.questions.length > 0 ? Math.round((score / passage.questions.length) * 100) : 0;

  if (!userId) return null;

  const historyQuestions: ReadingQuestion[] = viewingHistoryItem ? JSON.parse(viewingHistoryItem.questions) : [];
  const historyAnswers: Record<number, number | string> = viewingHistoryItem ? JSON.parse(viewingHistoryItem.answers) : {};
  const historyAnalysis: ReadingAnalysis | null = viewingHistoryItem?.analysis ? JSON.parse(viewingHistoryItem.analysis) : null;
  const historyScore = historyQuestions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, historyAnswers[i]) ? 1 : 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 pt-6 flex items-center justify-between flex-wrap gap-3">
        <Link href="/dashboard" className="text-sm text-foreground/50 hover:text-primary transition-colors inline-flex items-center gap-1">
          ← Quay lại Dashboard
        </Link>
        <div className="flex bg-foreground/5 p-1 rounded-xl">
          {[
            { key: "PRACTICE", label: "📖 Luyện Tập" },
            { key: "HISTORY", label: `📜 Lịch Sử (${history.length})` }
          ].map(v => (
            <button
              key={v.key}
              onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); }}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${viewMode === v.key ? "bg-primary text-white shadow-sm" : "text-foreground/50 hover:text-foreground"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-10 pt-4 space-y-6">
        {viewMode === "PRACTICE" && (
          <>
            {/* Hero */}
            <div className="bg-gradient-to-r from-primary to-secondary rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
              <div aria-hidden className="absolute -right-4 -top-6 text-[130px] leading-none opacity-10 select-none">📖</div>
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1.5">Kỹ Năng Đọc Hiểu</p>
                <h1 className="text-2xl sm:text-3xl font-black mb-2">Luyện Đọc Hiểu</h1>
                <p className="text-white/80 max-w-lg leading-relaxed text-sm sm:text-base">
                  Chọn cấp độ A1-C1, mục đích luyện tập và tối đa {ALL_QUESTION_TYPES.length} dạng câu hỏi kiểu đề thi thật — AI phân tích kỹ theo từng dạng sau khi bạn nộp bài.
                </p>
              </div>
            </div>

            {/* Options form */}
            <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-5 shadow-sm">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">⚙️</span>
                Tùy Chỉnh Bài Đọc
              </h2>

              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className={fieldLabelClass}>Chủ đề (tùy chọn)</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="VD: Du lịch, công nghệ..."
                    className={fieldInputClass + " font-normal"}
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {TOPIC_SUGGESTIONS.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTopic(t)}
                        className="px-2.5 py-1 text-xs font-medium bg-foreground/5 hover:bg-primary/10 hover:text-primary text-foreground/60 rounded-full transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="min-w-[150px]">
                  <label className={fieldLabelClass}>Cấp độ (CEFR)</label>
                  <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)} className={fieldInputClass}>
                    {CEFR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div className="min-w-[190px]">
                  <label className={fieldLabelClass}>Mục đích luyện tập</label>
                  <select value={purpose} onChange={(e) => setPurpose(e.target.value as PracticePurpose)} className={fieldInputClass}>
                    {PRACTICE_PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[150px]">
                  <label className={fieldLabelClass}>Độ dài văn bản</label>
                  <select value={length} onChange={(e) => setLength(e.target.value)} className={fieldInputClass}>
                    {LENGTHS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                <div className="min-w-[130px]">
                  <label className={fieldLabelClass}>Số câu hỏi</label>
                  <input
                    type="number"
                    min={1}
                    max={15}
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(e.target.value === "" ? 0 : Number(e.target.value))}
                    className={fieldInputClass}
                  />
                </div>
              </div>

              <div>
                <label className={fieldLabelClass}>Dạng câu hỏi (chọn 1 hoặc nhiều, tối đa {ALL_QUESTION_TYPES.length} dạng)</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_QUESTION_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`px-3 py-2 text-xs font-bold rounded-full border transition-colors ${
                        questionTypes.includes(t)
                          ? "bg-primary text-white border-primary"
                          : "bg-background border-foreground/15 text-foreground/60 hover:border-primary/40"
                      }`}
                      title={QUESTION_TYPE_META[t].instruction}
                    >
                      {QUESTION_TYPE_META[t].label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={generatePassage}
                disabled={loading}
                className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo bài đọc...
                  </>
                ) : (
                  <>📖 {passage ? "Tạo bài đọc khác" : "Tạo bài đọc"}</>
                )}
              </button>
            </div>

            {passage && (
              <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-xl font-bold text-foreground">{passage.title}</h2>
                  <button
                    onClick={downloadWord}
                    disabled={downloading}
                    className="text-xs font-bold px-3 py-2 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                  >
                    📄 {downloading ? "Đang tạo file..." : "Tải Word"}
                  </button>
                </div>
                <p className="text-foreground/80 leading-relaxed whitespace-pre-line -mt-3 border-l-4 border-primary/20 pl-4">
                  {passage.passage}
                </p>

                <div className="space-y-4">
                  {passage.questions.map((q, qi) => (
                    <div key={qi} className="bg-background/50 border border-foreground/5 rounded-xl p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {qi + 1}
                        </span>
                        <p className="font-semibold flex-1">
                          <HighlightedText text={q.question} />
                          {q.wordLimit && <span className="block text-xs text-foreground/40 font-normal mt-1">({q.wordLimit})</span>}
                        </p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase tracking-wide shrink-0 whitespace-nowrap">
                          {QUESTION_TYPE_META[q.type]?.label || q.type}
                        </span>
                      </div>

                      {FILL_TYPES.includes(q.type) ? (
                        <div className="pl-9">
                          <input
                            type="text"
                            value={(answers[qi] as string) || ""}
                            onChange={(e) => selectAnswer(qi, e.target.value)}
                            disabled={submitted}
                            placeholder="Gõ từ/cụm từ cần điền..."
                            className={`w-full p-3 border rounded-xl text-sm transition-colors ${
                              submitted
                                ? isReadingAnswerCorrect(q, answers[qi])
                                  ? "border-green-400 bg-green-50 text-green-800"
                                  : "border-red-400 bg-red-50 text-red-800"
                                : "border-foreground/15 bg-surface focus:border-primary/50 focus:ring-2 focus:ring-primary/10 outline-none"
                            }`}
                          />
                          {submitted && !isReadingAnswerCorrect(q, answers[qi]) && (
                            <p className="text-xs text-green-700 mt-1.5">Đáp án đúng: <strong>{q.correctAnswer}</strong></p>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pl-9">
                          {(q.options || []).map((opt, oi) => {
                            const isSelected = answers[qi] === oi;
                            const isCorrect = oi === q.correctIndex;
                            let stateClass = "border-foreground/15 bg-surface hover:border-primary/40";
                            if (submitted) {
                              if (isCorrect) stateClass = "border-green-400 bg-green-50 text-green-800";
                              else if (isSelected && !isCorrect) stateClass = "border-red-400 bg-red-50 text-red-800";
                            } else if (isSelected) {
                              stateClass = "border-primary bg-primary/5";
                            }
                            return (
                              <button
                                key={oi}
                                onClick={() => selectAnswer(qi, oi)}
                                disabled={submitted}
                                className={`w-full text-left p-3 border rounded-xl text-sm transition-colors ${stateClass}`}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {submitted && (
                        <p className="text-xs text-foreground/60 mt-3 ml-9 bg-foreground/5 p-2.5 rounded-lg leading-relaxed">
                          💡 <HighlightedText text={q.explanation} />
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {!submitted ? (
                  <button
                    onClick={submitAnswers}
                    className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Nộp bài
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex items-center gap-5">
                      <ScoreRing score={score} total={passage.questions.length} />
                      <div>
                        <p className="text-lg font-bold text-primary">
                          Kết quả: {score}/{passage.questions.length} câu đúng
                        </p>
                        <p className="text-sm text-foreground/60 mt-1">{scoreMessage(scorePct)}</p>
                        {practicedAt && <p className="text-xs text-foreground/40 mt-1">🕓 {formatPracticedAt(practicedAt)}</p>}
                      </div>
                    </div>

                    {!analysis ? (
                      <button
                        onClick={runAnalysis}
                        disabled={analyzing}
                        className="w-full py-3 bg-secondary/10 text-secondary font-bold rounded-xl hover:bg-secondary/20 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {analyzing ? (
                          <><span className="w-4 h-4 border-2 border-secondary/30 border-t-secondary rounded-full animate-spin" /> Đang phân tích...</>
                        ) : (
                          <>🤖 Đánh Giá Chi Tiết (AI)</>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="font-bold text-foreground">📊 Phân Tích Chi Tiết</h3>
                          <button
                            onClick={() => downloadPdf(pdfRef.current)}
                            disabled={exportingPdf}
                            className="text-xs font-bold px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            🖨️ {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                          </button>
                        </div>
                        <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">
                          {analysis.overall}
                        </div>
                        {analysis.byType.map((t, i) => (
                          <div key={i} className="bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">{QUESTION_TYPE_META[t.type as QuestionType]?.label || t.type}</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{t.note}</p>
                          </div>
                        ))}
                        {analysis.suggestions?.length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">💡 Gợi ý luyện tập tiếp theo</p>
                            <ul className="space-y-1">
                              {analysis.suggestions.map((s, i) => (
                                <li key={i} className="text-sm text-amber-800 flex gap-2">
                                  <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                          <SkillReportPDF
                            ref={pdfRef}
                            skillLabel="Luyện Đọc Hiểu (Reading)"
                            skillIcon="📖"
                            studentName={userName}
                            practicedAt={practicedAt || new Date()}
                            level={level}
                            purpose={purpose}
                            score={scorePct / 10}
                            contextTitle={passage.title}
                            overallComment={analysis.overall}
                            rubric={buildRubric(analysis)}
                            suggestions={analysis.suggestions || []}
                            transcriptTitle="Bài Đọc"
                            transcriptBody={passage.passage}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {viewMode === "HISTORY" && !viewingHistoryItem && (
          <div className="space-y-3">
            <h1 className="text-2xl font-black">📜 Lịch Sử Luyện Đọc</h1>
            {history.length === 0 ? (
              <p className="text-foreground/50 text-sm">Bạn chưa làm bài đọc nào. Bài đọc sau khi nộp sẽ tự động lưu tại đây.</p>
            ) : (
              <>
                {historyPagination.pageItems.map((h) => {
                  const qs: ReadingQuestion[] = JSON.parse(h.questions);
                  const ans: Record<number, number | string> = JSON.parse(h.answers);
                  const correct = qs.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, ans[i]) ? 1 : 0), 0);
                  return (
                    <button
                      key={h.id}
                      onClick={() => setViewingHistoryItem(h)}
                      className="w-full text-left bg-surface border border-foreground/10 rounded-xl p-4 hover:border-primary/30 hover:shadow-sm transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground/80 line-clamp-1">{h.topic || "Bài đọc"}</p>
                        <p className="text-xs text-foreground/50 mt-1">🕓 {formatPracticedAt(h.practicedAt)} · {h.level} · {h.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-primary/10 text-primary shrink-0">{correct}/{qs.length}</span>
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
            <button onClick={() => setViewingHistoryItem(null)} className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors inline-flex items-center gap-1">
              ← Quay lại danh sách
            </button>
            <h2 className="text-xl font-bold text-foreground">{viewingHistoryItem.topic || "Bài đọc"}</h2>
            <p className="text-foreground/80 leading-relaxed whitespace-pre-line border-l-4 border-primary/20 pl-4">{viewingHistoryItem.passage}</p>
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex items-center gap-5">
              <ScoreRing score={historyScore} total={historyQuestions.length} />
              <div>
                <p className="text-lg font-bold text-primary">Kết quả: {historyScore}/{historyQuestions.length} câu đúng</p>
                <p className="text-xs text-foreground/40 mt-1">🕓 {formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
              </div>
            </div>
            {historyAnalysis && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-foreground">📊 Phân Tích Chi Tiết</h3>
                  <button
                    onClick={() => downloadPdf(historyPdfRef.current)}
                    disabled={exportingPdf}
                    className="text-xs font-bold px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    🖨️ {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">{historyAnalysis.overall}</div>
                {historyAnalysis.byType.map((t, i) => (
                  <div key={i} className="bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2">{QUESTION_TYPE_META[t.type as QuestionType]?.label || t.type}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{t.note}</p>
                  </div>
                ))}

                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={historyPdfRef}
                    skillLabel="Luyện Đọc Hiểu (Reading)"
                    skillIcon="📖"
                    studentName={userName}
                    practicedAt={viewingHistoryItem.practicedAt}
                    level={viewingHistoryItem.level}
                    purpose={viewingHistoryItem.purpose}
                    score={(historyScore / historyQuestions.length) * 10}
                    contextTitle={viewingHistoryItem.topic || "Bài đọc"}
                    overallComment={historyAnalysis.overall}
                    rubric={buildRubric(historyAnalysis)}
                    suggestions={historyAnalysis.suggestions || []}
                    transcriptTitle="Bài Đọc"
                    transcriptBody={viewingHistoryItem.passage}
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
