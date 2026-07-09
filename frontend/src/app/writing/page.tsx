"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { HighlightedText } from "@/lib/highlightText";
import { exportWritingToWord } from "@/lib/wordExport";
import { logSkillProgress } from "@/lib/skillProgress";

interface Feedback {
  overall: string;
  grammar: string;
  vocabulary: string;
  organization: string;
  suggestions: string[];
  internalScore?: number; // never rendered — only used to silently feed the dashboard radar chart
}

const FORMATS = [
  { value: "PARAGRAPH", label: "Đoạn văn ngắn" },
  { value: "EMAIL", label: "Email/Thư" },
  { value: "ESSAY", label: "Bài luận ngắn" }
];

const LEVELS = [
  { value: "beginner", label: "Cơ bản" },
  { value: "intermediate", label: "Trung cấp" },
  { value: "advanced", label: "Nâng cao" }
];

const TOPIC_SUGGESTIONS = ["Sở thích cá nhân", "Kỳ nghỉ đáng nhớ", "Công việc mơ ước", "Bảo vệ môi trường", "Bạn thân"];

const FEEDBACK_SECTIONS = [
  { key: "grammar", label: "Ngữ pháp", icon: "📐", badge: "bg-blue-500/10 text-blue-600" },
  { key: "vocabulary", label: "Từ vựng", icon: "📚", badge: "bg-violet-500/10 text-violet-600" },
  { key: "organization", label: "Bố cục", icon: "🧱", badge: "bg-cyan-500/10 text-cyan-600" }
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const fieldLabelClass = "block text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2";
const fieldInputClass = "w-full p-3 border border-foreground/15 bg-background rounded-xl font-semibold text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors";

export default function WritingPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("PARAGRAPH");
  const [level, setLevel] = useState("intermediate");
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const [promptEn, setPromptEn] = useState<string | null>(null);
  const [promptVi, setPromptVi] = useState<string | null>(null);
  const [submission, setSubmission] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
  }, [router]);

  const generatePrompt = async () => {
    setLoadingPrompt(true);
    setPromptEn(null);
    setPromptVi(null);
    setSubmission("");
    setFeedback(null);
    try {
      const res = await fetch(`${API}/api/ai/generate-writing-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topic.trim(), format, level })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPromptEn(data.promptEn);
      setPromptVi(data.promptVi);
    } catch {
      Swal.fire("Lỗi", "Không thể tạo đề bài lúc này. Vui lòng thử lại.", "error");
    } finally {
      setLoadingPrompt(false);
    }
  };

  const submitWriting = async () => {
    if (!submission.trim()) {
      Swal.fire("Chưa có bài viết", "Vui lòng viết bài trước khi nộp.", "warning");
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(`${API}/api/ai/writing-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptEn, promptVi, submission })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data);
      if (typeof data.internalScore === "number") {
        logSkillProgress(userId, "WRITING", data.internalScore, "WRITING_PRACTICE");
      }
    } catch {
      Swal.fire("Lỗi", "Không thể nhận xét bài viết lúc này. Vui lòng thử lại.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadWord = async () => {
    if (!feedback || !promptEn || !promptVi) return;
    setDownloading(true);
    try {
      await exportWritingToWord({ promptEn, promptVi, submission, feedback });
    } catch {
      Swal.fire("Lỗi", "Không thể tạo file Word lúc này.", "error");
    } finally {
      setDownloading(false);
    }
  };

  const reset = () => {
    setPromptEn(null);
    setPromptVi(null);
    setSubmission("");
    setFeedback(null);
  };

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
          <div aria-hidden className="absolute -right-4 -top-6 text-[130px] leading-none opacity-10 select-none">✍️</div>
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1.5">Kỹ Năng Viết</p>
            <h1 className="text-2xl sm:text-3xl font-black mb-2">Luyện Viết</h1>
            <p className="text-white/80 max-w-lg leading-relaxed text-sm sm:text-base">
              Nhận đề bài song ngữ theo chủ đề và độ khó bạn chọn, AI phân tích chi tiết ngữ pháp, từ vựng và bố cục sau khi bạn nộp bài.
            </p>
          </div>
        </div>

        {!promptEn ? (
          <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-5 shadow-sm">
            <h2 className="font-bold text-foreground flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">⚙️</span>
              Tùy Chỉnh Đề Bài
            </h2>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className={fieldLabelClass}>Chủ đề (tùy chọn)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="VD: Kỳ nghỉ đáng nhớ..."
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
                <label className={fieldLabelClass}>Dạng bài</label>
                <select value={format} onChange={(e) => setFormat(e.target.value)} className={fieldInputClass}>
                  {FORMATS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
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
            <button
              onClick={generatePrompt}
              disabled={loadingPrompt}
              className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loadingPrompt ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo đề bài...
                </>
              ) : (
                <>✍️ Nhận đề bài</>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="bg-primary/5 border border-primary/15 rounded-xl overflow-hidden">
              <div className="p-4">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Đề bài (English)</p>
                <p className="text-foreground/80 leading-relaxed">{promptEn}</p>
              </div>
              <div className="border-t border-primary/10 p-4 bg-primary/[0.03]">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Đề bài (Tiếng Việt)</p>
                <p className="text-foreground/80 leading-relaxed">{promptVi}</p>
              </div>
            </div>
            <button onClick={reset} className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors inline-flex items-center gap-1">
              ↺ Đổi đề bài khác
            </button>

            {!feedback ? (
              <>
                <textarea
                  value={submission}
                  onChange={(e) => setSubmission(e.target.value)}
                  rows={10}
                  placeholder="Viết bài của bạn vào đây..."
                  className="w-full p-4 border border-foreground/15 bg-background rounded-xl leading-relaxed focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-colors"
                />
                <button
                  onClick={submitWriting}
                  disabled={submitting}
                  className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang phân tích...
                    </>
                  ) : (
                    <>🤖 Nộp bài & Nhận góp ý</>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-foreground/5 border border-foreground/10 rounded-xl text-sm leading-relaxed text-foreground/70 italic whitespace-pre-line">
                  {submission}
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-base">✓</span>
                    Nhận Xét
                  </h2>
                  <button
                    onClick={downloadWord}
                    disabled={downloading}
                    className="text-xs font-bold px-3 py-1.5 bg-foreground/5 hover:bg-foreground/10 text-foreground/70 rounded-full transition-colors disabled:opacity-50 flex items-center gap-1.5"
                  >
                    📄 {downloading ? "Đang tạo file..." : "Tải Word"}
                  </button>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">
                  {feedback.overall}
                </div>
                <div className="space-y-3">
                  {FEEDBACK_SECTIONS.map(({ key, label, icon, badge }) => (feedback as any)[key] && (
                    <div key={key} className="bg-foreground/[0.03] border border-foreground/10 rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-foreground/50 mb-2 flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-md flex items-center justify-center text-sm ${badge}`}>{icon}</span>
                        {label}
                      </p>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <HighlightedText text={(feedback as any)[key]} />
                      </p>
                    </div>
                  ))}
                </div>
                {feedback.suggestions?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">💡 Gợi ý cải thiện</p>
                    <ul className="space-y-1">
                      {feedback.suggestions.map((s, i) => (
                        <li key={i} className="text-sm text-amber-800 flex gap-2">
                          <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={reset}
                  className="w-full py-3 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/15 transition-colors"
                >
                  Viết Đề Khác
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
