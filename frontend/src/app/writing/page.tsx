"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { HighlightedText } from "@/lib/highlightText";
import { exportWritingToWord } from "@/lib/wordExport";
import { logSkillProgress } from "@/lib/skillProgress";
import { CEFR_LEVELS, PRACTICE_PURPOSES, CefrLevel, PracticePurpose, formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

interface Feedback {
  overall: string;
  grammar: string;
  vocabulary: string;
  organization: string;
  clarity?: string;
  suggestions: string[];
  internalScore?: number; // never rendered — only used to silently feed the dashboard radar chart
}

const FORMATS = [
  { value: "PARAGRAPH", label: "Đoạn văn ngắn" },
  { value: "EMAIL", label: "Email/Thư" },
  { value: "ESSAY", label: "Bài luận ngắn" }
];

const TOPIC_SUGGESTIONS = ["Sở thích cá nhân", "Kỳ nghỉ đáng nhớ", "Công việc mơ ước", "Bảo vệ môi trường", "Bạn thân"];

const FEEDBACK_SECTIONS = [
  { key: "grammar", label: "Ngữ pháp", icon: "📐", badge: "bg-primary-soft text-primary" },
  { key: "vocabulary", label: "Từ vựng", icon: "📚", badge: "bg-primary-soft text-primary" },
  { key: "organization", label: "Bố cục", icon: "🧱", badge: "bg-primary-soft text-primary" },
  { key: "clarity", label: "Độ dễ đọc", icon: "👀", badge: "bg-primary-soft text-primary" }
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const fieldLabelClass = "ui-label";
const fieldInputClass = "ui-input font-semibold";

function parsePromptPair(raw: string): { promptEn: string; promptVi: string } {
  try {
    const p = JSON.parse(raw);
    return { promptEn: p.promptEn || raw, promptVi: p.promptVi || "" };
  } catch {
    return { promptEn: raw, promptVi: "" };
  }
}

export default function WritingPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("Học viên");
  const [viewMode, setViewMode] = useState<"PRACTICE" | "HISTORY" | "SAVED">("PRACTICE");

  const [topic, setTopic] = useState("");
  const [format, setFormat] = useState("PARAGRAPH");
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [purpose, setPurpose] = useState<PracticePurpose>("GENERAL");
  const [loadingPrompt, setLoadingPrompt] = useState(false);

  const [promptEn, setPromptEn] = useState<string | null>(null);
  const [promptVi, setPromptVi] = useState<string | null>(null);
  const [submission, setSubmission] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [practicedAt, setPracticedAt] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  const [savedPrompts, setSavedPrompts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const savedPromptsPagination = usePagination(savedPrompts, 10);
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
  }, [router]);

  const refreshLibrary = (uid: string) => {
    fetch(`${API}/api/ai/writing-saved-prompts/${uid}`).then(r => r.json()).then(setSavedPrompts).catch(() => {});
    fetch(`${API}/api/ai/writing-submissions/${uid}`).then(r => r.json()).then(setHistory).catch(() => {});
  };

  useEffect(() => {
    if (userId) refreshLibrary(userId);
  }, [userId]);

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
        body: JSON.stringify({ topic: topic.trim(), format, level, purpose })
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

  const savePromptForLater = async () => {
    if (!userId || !promptEn) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/ai/writing-saved-prompts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, prompt: JSON.stringify({ promptEn, promptVi }), format, level, purpose })
      });
      refreshLibrary(userId);
      Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Đã lưu đề để luyện lại sau", showConfirmButton: false, timer: 2000 });
    } catch {
      Swal.fire("Lỗi", "Không thể lưu đề lúc này.", "error");
    } finally {
      setSaving(false);
    }
  };

  const loadSavedPrompt = (saved: any) => {
    const { promptEn: en, promptVi: vi } = parsePromptPair(saved.prompt);
    setPromptEn(en);
    setPromptVi(vi);
    setFormat(saved.format);
    setLevel(saved.level);
    setPurpose(saved.purpose);
    setSubmission("");
    setFeedback(null);
    setViewMode("PRACTICE");
  };

  const deleteSavedPrompt = async (id: string) => {
    try {
      await fetch(`${API}/api/ai/writing-saved-prompts/${id}`, { method: "DELETE" });
      setSavedPrompts(prev => prev.filter(p => p.id !== id));
    } catch {
      Swal.fire("Lỗi", "Không thể xóa đề đã lưu.", "error");
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
        body: JSON.stringify({ promptEn, promptVi, submission, level, purpose })
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setFeedback(data);
      const now = new Date().toISOString();
      setPracticedAt(now);
      if (typeof data.internalScore === "number") {
        logSkillProgress(userId, "WRITING", data.internalScore, "WRITING_PRACTICE");
      }
      if (userId) {
        fetch(`${API}/api/ai/writing-submissions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, prompt: JSON.stringify({ promptEn, promptVi }), format, level, purpose, essay: submission, feedback: data })
        }).then(() => refreshLibrary(userId)).catch(() => {});
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

  const downloadPdf = async (node: HTMLDivElement | null, filenamePrefix: string) => {
    if (!node) return;
    setExportingPdf(true);
    try {
      await exportNodeToPDF(node, `${filenamePrefix}-${Date.now()}.pdf`);
    } catch {
      Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const reset = () => {
    setPromptEn(null);
    setPromptVi(null);
    setSubmission("");
    setFeedback(null);
    setPracticedAt(null);
  };

  const buildRubric = (fb: Feedback): SkillReportRubricItem[] =>
    FEEDBACK_SECTIONS.filter(s => (fb as any)[s.key]).map(s => ({ label: s.label, note: (fb as any)[s.key] }));

  if (!userId) return null;

  const historyFeedback: Feedback | null = viewingHistoryItem?.feedback ? JSON.parse(viewingHistoryItem.feedback) : null;
  const historyPrompt = viewingHistoryItem ? parsePromptPair(viewingHistoryItem.prompt) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Page banner */}
      <div className="bg-primary-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <nav aria-label="Breadcrumb" className="text-xs text-muted mb-2 flex flex-wrap items-center gap-1.5">
              <Link href="/dashboard" className="hover:text-primary">Trang chủ</Link>
              <span aria-hidden>/</span>
              <span className="text-foreground font-semibold">Luyện Viết</span>
            </nav>
            <h1 className="ui-page-title">Luyện Viết</h1>
            <p className="ui-page-subtitle max-w-2xl leading-relaxed">
              Chọn cấp độ A1-C1 và mục đích luyện tập, nhận đề bài song ngữ, AI phân tích chi tiết ngữ pháp, từ vựng, bố cục và độ dễ đọc sau khi bạn nộp bài.
            </p>
            <Link href="/dashboard" className="btn-ghost px-3 py-2 text-sm mt-3 -ml-3">
              ← Quay lại Dashboard
            </Link>
          </div>
          <img
            src="/images/thumbs/writing.svg"
            alt="Minh hoạ luyện viết tiếng Anh"
            width={640}
            height={360}
            loading="eager"
            className="hidden md:block w-60 lg:w-72 h-auto rounded-2xl shrink-0"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 flex flex-wrap gap-2">
        {[
          { key: "PRACTICE", label: "Luyện Tập" },
          { key: "SAVED", label: `Đề Đã Lưu (${savedPrompts.length})` },
          { key: "HISTORY", label: `Lịch Sử (${history.length})` }
        ].map(v => (
          <button
            key={v.key}
            onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); }}
            className={`ui-chip ${viewMode === v.key ? "ui-chip-active" : ""}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12 pt-5 space-y-6">
        {viewMode === "PRACTICE" && (!promptEn ? (
          <div className="ui-card p-5 sm:p-6 space-y-5">
            <h2 className="ui-section-title">Tùy Chỉnh Đề Bài</h2>
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
                      className="ui-chip px-3 py-1.5 text-xs font-medium"
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
                <label className={fieldLabelClass}>Cấp độ (CEFR)</label>
                <select value={level} onChange={(e) => setLevel(e.target.value as CefrLevel)} className={fieldInputClass}>
                  {CEFR_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-[190px]">
                <label className={fieldLabelClass}>Mục đích luyện tập</label>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value as PracticePurpose)} className={fieldInputClass}>
                  {PRACTICE_PURPOSES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={generatePrompt}
              disabled={loadingPrompt}
              className="btn-primary w-full py-3"
            >
              {loadingPrompt ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo đề bài...
                </>
              ) : (
                <>Nhận đề bài</>
              )}
            </button>
          </div>
        ) : (
          <div className="ui-card p-5 sm:p-6 space-y-5">
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              <div className="p-4">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Đề bài (English)</p>
                <p className="text-foreground leading-relaxed">{promptEn}</p>
              </div>
              <div className="border-t border-line p-4 bg-primary-soft/60">
                <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Đề bài (Tiếng Việt)</p>
                <p className="text-foreground leading-relaxed">{promptVi}</p>
              </div>
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button onClick={reset} className="btn-ghost px-3 py-2 text-xs">
                ↺ Đổi đề bài khác
              </button>
              {!feedback && (
                <button onClick={savePromptForLater} disabled={saving} className="btn-outline px-4 py-2 text-xs">
                  {saving ? "Đang lưu..." : "Lưu đề để luyện lại sau"}
                </button>
              )}
            </div>

            {!feedback ? (
              <>
                <textarea
                  value={submission}
                  onChange={(e) => setSubmission(e.target.value)}
                  rows={10}
                  placeholder="Viết bài của bạn vào đây..."
                  className="ui-input p-4 leading-relaxed"
                />
                <button
                  onClick={submitWriting}
                  disabled={submitting}
                  className="btn-primary w-full py-3"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang phân tích...
                    </>
                  ) : (
                    <>Nộp bài & Nhận góp ý</>
                  )}
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-[#f7f9fc] border border-line rounded-xl text-sm leading-relaxed text-foreground italic whitespace-pre-line">
                  {submission}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="ui-section-title">Nhận Xét</h2>
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={downloadWord}
                      disabled={downloading}
                      className="btn-outline px-4 py-2 text-xs"
                    >
                      {downloading ? "Đang tạo file..." : "Tải Word"}
                    </button>
                    <button
                      onClick={() => downloadPdf(pdfRef.current, "bao-cao-luyen-viet")}
                      disabled={exportingPdf}
                      className="btn-outline px-4 py-2 text-xs"
                    >
                      {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                    </button>
                  </div>
                </div>
                {practicedAt && <p className="text-xs text-muted">Thực hành lúc: {formatPracticedAt(practicedAt)}</p>}
                <div className="bg-primary-soft border border-line rounded-xl p-4 text-sm text-foreground leading-relaxed">
                  {feedback.overall}
                </div>
                <div className="space-y-3">
                  {FEEDBACK_SECTIONS.map(({ key, label }) => (feedback as any)[key] && (
                    <div key={key} className="bg-surface border border-line rounded-xl p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-2">
                        {label}
                      </p>
                      <p className="text-sm text-foreground leading-relaxed">
                        <HighlightedText text={(feedback as any)[key]} />
                      </p>
                    </div>
                  ))}
                </div>
                {feedback.suggestions?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Gợi ý cải thiện</p>
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
                  className="btn-outline w-full py-3"
                >
                  Viết Đề Khác
                </button>

                {/* Hidden off-screen render target for PDF export */}
                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={pdfRef}
                    skillLabel="Luyện Viết (Writing)"
                    skillIcon="✍️"
                    studentName={userName}
                    practicedAt={practicedAt || new Date()}
                    level={level}
                    purpose={purpose}
                    contextTitle={promptEn || ""}
                    overallComment={feedback.overall}
                    rubric={buildRubric(feedback)}
                    suggestions={feedback.suggestions || []}
                    transcriptTitle="Bài Viết Của Học Viên"
                    transcriptBody={submission}
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {viewMode === "SAVED" && (
          <div className="space-y-3">
            <h2 className="ui-section-title mb-2">Đề Đã Lưu</h2>
            {savedPrompts.length === 0 ? (
              <div className="ui-card p-8 text-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có đề viết đã lưu" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-4" />
                <p className="text-muted text-sm">Chưa có đề nào được lưu. Khi luyện tập, bấm "Lưu đề để luyện lại sau" để thêm vào đây.</p>
              </div>
            ) : (
              <>
                {savedPromptsPagination.pageItems.map((sp) => {
                  const { promptEn: en } = parsePromptPair(sp.prompt);
                  return (
                    <div key={sp.id} className="ui-card ui-card-hover p-3 sm:p-4 flex items-start justify-between gap-4">
                      <img src="/images/thumbs/writing.svg" alt="" aria-hidden width={640} height={360} loading="lazy" className="hidden sm:block w-28 h-auto rounded-xl shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground line-clamp-2">{en}</p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="ui-badge text-[11px]">{sp.level}</span>
                          <span className="ui-badge text-[11px] bg-[#f7f9fc] text-muted">{sp.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}</span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button onClick={() => loadSavedPrompt(sp)} className="btn-primary px-4 py-2 text-xs">Luyện ngay</button>
                        <button onClick={() => deleteSavedPrompt(sp.id)} className="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-bold bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-colors">Xóa</button>
                      </div>
                    </div>
                  );
                })}
                <Pagination page={savedPromptsPagination.page} totalPages={savedPromptsPagination.totalPages} totalItems={savedPromptsPagination.totalItems} pageSize={10} onPageChange={savedPromptsPagination.setPage} />
              </>
            )}
          </div>
        )}

        {viewMode === "HISTORY" && !viewingHistoryItem && (
          <div className="space-y-3">
            <h2 className="ui-section-title mb-2">Lịch Sử Bài Viết</h2>
            {history.length === 0 ? (
              <div className="ui-card p-8 text-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử bài viết" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-4" />
                <p className="text-muted text-sm">Bạn chưa nộp bài viết nào. Bài viết sau khi nhận nhận xét sẽ tự động lưu tại đây.</p>
              </div>
            ) : (
              <>
                {historyPagination.pageItems.map((h) => {
                  const { promptEn: en } = parsePromptPair(h.prompt);
                  return (
                    <button
                      key={h.id}
                      onClick={() => setViewingHistoryItem(h)}
                      className="ui-card ui-card-hover w-full text-left p-3 sm:p-4 flex items-center gap-4"
                    >
                      <img src="/images/thumbs/writing.svg" alt="" aria-hidden width={640} height={360} loading="lazy" className="hidden sm:block w-28 h-auto rounded-xl shrink-0" />
                      <span className="min-w-0 flex-1 block">
                        <span className="block text-sm font-bold text-primary line-clamp-1">{en}</span>
                        <span className="block text-xs text-muted mt-1">{formatPracticedAt(h.practicedAt)} · {h.level} · {h.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}</span>
                      </span>
                    </button>
                  );
                })}
                <Pagination page={historyPagination.page} totalPages={historyPagination.totalPages} totalItems={historyPagination.totalItems} pageSize={10} onPageChange={historyPagination.setPage} />
              </>
            )}
          </div>
        )}

        {viewMode === "HISTORY" && viewingHistoryItem && historyFeedback && historyPrompt && (
          <div className="space-y-4">
            <button onClick={() => setViewingHistoryItem(null)} className="btn-ghost px-3 py-2 text-sm">
              ← Quay lại danh sách
            </button>
            <div className="ui-card p-5">
              <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">Đề bài</p>
              <p className="text-foreground leading-relaxed">{historyPrompt.promptEn}</p>
            </div>
            <div className="p-4 bg-[#f7f9fc] border border-line rounded-xl text-sm leading-relaxed text-foreground italic whitespace-pre-line">
              {viewingHistoryItem.essay}
            </div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted">Thực hành lúc: {formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
              <button
                onClick={() => downloadPdf(historyPdfRef.current, "bao-cao-luyen-viet")}
                disabled={exportingPdf}
                className="btn-outline px-4 py-2 text-xs"
              >
                {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
            <div className="bg-primary-soft border border-line rounded-xl p-4 text-sm text-foreground leading-relaxed">
              {historyFeedback.overall}
            </div>
            <div className="space-y-3">
              {FEEDBACK_SECTIONS.map(({ key, label }) => (historyFeedback as any)[key] && (
                <div key={key} className="bg-surface border border-line rounded-xl p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2 flex items-center gap-2">
                    {label}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    <HighlightedText text={(historyFeedback as any)[key]} />
                  </p>
                </div>
              ))}
            </div>

            <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
              <SkillReportPDF
                ref={historyPdfRef}
                skillLabel="Luyện Viết (Writing)"
                skillIcon="✍️"
                studentName={userName}
                practicedAt={viewingHistoryItem.practicedAt}
                level={viewingHistoryItem.level}
                purpose={viewingHistoryItem.purpose}
                contextTitle={historyPrompt.promptEn}
                overallComment={historyFeedback.overall}
                rubric={buildRubric(historyFeedback)}
                suggestions={historyFeedback.suggestions || []}
                transcriptTitle="Bài Viết Của Học Viên"
                transcriptBody={viewingHistoryItem.essay}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
