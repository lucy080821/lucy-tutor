"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { HighlightedText } from "@/lib/highlightText";
import { exportReadingToWord } from "@/lib/wordExport";
import { isReadingAnswerCorrect, type ReadingQuestion } from "@/lib/readingGrading";
import { logSkillProgress } from "@/lib/skillProgress";

interface Passage {
  title: string;
  passage: string;
  questions: ReadingQuestion[];
}

const LEVELS = [
  { value: "beginner", label: "Cơ bản" },
  { value: "intermediate", label: "Trung cấp" },
  { value: "advanced", label: "Nâng cao" }
];

const LENGTHS = [
  { value: "SHORT", label: "Ngắn (~100-150 từ)" },
  { value: "MEDIUM", label: "Trung bình (~200-250 từ)" },
  { value: "LONG", label: "Dài (~300-380 từ)" }
];

const QUESTION_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Trắc nghiệm" },
  { value: "TRUE_FALSE", label: "Đúng/Sai" },
  { value: "FILL_BLANK", label: "Điền từ" },
  { value: "MIXED", label: "Hỗn hợp" }
];

const TYPE_TAG_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Trắc nghiệm",
  TRUE_FALSE: "Đúng/Sai",
  FILL_BLANK: "Điền từ"
};

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

  const [topic, setTopic] = useState("");
  const [level, setLevel] = useState("intermediate");
  const [length, setLength] = useState("MEDIUM");
  const [questionType, setQuestionType] = useState("MULTIPLE_CHOICE");
  const [numQuestions, setNumQuestions] = useState(4);
  const [loading, setLoading] = useState(false);

  const [passage, setPassage] = useState<Passage | null>(null);
  const [answers, setAnswers] = useState<Record<number, number | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
  }, [router]);

  const generatePassage = async () => {
    setLoading(true);
    setPassage(null);
    setAnswers({});
    setSubmitted(false);
    try {
      const count = Math.min(15, Math.max(1, numQuestions || 4));
      const res = await fetch(`${API}/api/ai/generate-reading-passage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), level, length, questionType, numQuestions: count })
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

  const submitAnswers = () => {
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

    const correctCount = passage.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0);
    const score = (correctCount / passage.questions.length) * 10;
    logSkillProgress(userId, "READING", score, "READING_PRACTICE");
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

  const score = passage
    ? passage.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, answers[i]) ? 1 : 0), 0)
    : 0;
  const scorePct = passage && passage.questions.length > 0 ? Math.round((score / passage.questions.length) * 100) : 0;

  if (!userId) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <Link href="/dashboard" className="text-sm text-foreground/50 hover:text-primary transition-colors inline-flex items-center gap-1">
          ← Quay lại Dashboard
        </Link>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-10 pt-4 space-y-6">
        {/* Hero */}
        <div className="bg-gradient-to-r from-primary to-secondary rounded-3xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div aria-hidden className="absolute -right-4 -top-6 text-[130px] leading-none opacity-10 select-none">📖</div>
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1.5">Kỹ Năng Đọc Hiểu</p>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">Luyện Đọc Hiểu</h1>
            <p className="text-white/80 max-w-lg leading-relaxed text-sm sm:text-base">
              AI tạo bài đọc riêng theo chủ đề và độ khó bạn chọn, kèm câu hỏi đa dạng và giải thích chi tiết cho từng đáp án.
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
              <label className={fieldLabelClass}>Độ khó</label>
              <select value={level} onChange={(e) => setLevel(e.target.value)} className={fieldInputClass}>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
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
            <div className="flex-1 min-w-[150px]">
              <label className={fieldLabelClass}>Loại câu hỏi</label>
              <select value={questionType} onChange={(e) => setQuestionType(e.target.value)} className={fieldInputClass}>
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
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
                className="text-xs font-bold px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
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
                    </p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/10 text-secondary uppercase tracking-wide shrink-0 whitespace-nowrap">
                      {TYPE_TAG_LABELS[q.type] || q.type}
                    </span>
                  </div>

                  {q.type === "FILL_BLANK" ? (
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
              <div className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex items-center gap-5">
                <ScoreRing score={score} total={passage.questions.length} />
                <div>
                  <p className="text-lg font-bold text-primary">
                    Kết quả: {score}/{passage.questions.length} câu đúng
                  </p>
                  <p className="text-sm text-foreground/60 mt-1">{scoreMessage(scorePct)}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
