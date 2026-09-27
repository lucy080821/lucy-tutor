"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { cleanString } from "@/lib/textGrading";
import { logSkillProgress } from "@/lib/skillProgress";
import { formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface PracticeWord {
  vocabId: string;
  word: string;
  phonetic: string | null;
  example: string | null;
  meaning: string;
}

interface CoachFeedback {
  overall: string;
  likelyIssues: { word: string; tip: string }[];
  suggestions: string[];
}

interface WordMatch {
  word: string;
  matched: boolean;
}

function computeMatch(target: string, transcript: string) {
  const targetWords = target.trim().split(/\s+/).filter(Boolean);
  const transcriptWords = transcript.trim().split(/\s+/).filter(Boolean);
  const maxLen = Math.max(targetWords.length, transcriptWords.length, 1);
  let matched = 0;
  const results: WordMatch[] = targetWords.map((w, i) => {
    const tw = transcriptWords[i];
    const ok = !!tw && cleanString(tw) === cleanString(w);
    if (ok) matched++;
    return { word: w, matched: ok };
  });
  const mismatchedWords = results.filter(r => !r.matched).map(r => r.word);
  return { results, matchScore: (matched / maxLen) * 10, mismatchedWords };
}

export default function PronunciationPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Học viên");
  const [viewMode, setViewMode] = useState<"PRACTICE" | "HISTORY">("PRACTICE");

  const [practiceSet, setPracticeSet] = useState<PracticeWord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingSet, setLoadingSet] = useState(true);

  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [coaching, setCoaching] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState<CoachFeedback | null>(null);
  const [saving, setSaving] = useState(false);
  const [practicedAt, setPracticedAt] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const historyPagination = usePagination(history, 10);
  const [viewingHistoryItem, setViewingHistoryItem] = useState<any | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
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
    fetchPracticeSet(uid);
    fetchHistory(uid);
  }, [router]);

  const fetchPracticeSet = async (uid: string) => {
    setLoadingSet(true);
    try {
      const res = await fetch(`${API}/api/pronunciation/practice-set/${uid}`);
      const data = await res.json();
      setPracticeSet(Array.isArray(data) ? data : []);
    } catch {
      setPracticeSet([]);
    }
    setLoadingSet(false);
  };

  const fetchHistory = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/pronunciation/attempts/${uid}`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  };

  const currentWord = practiceSet[currentIndex] || null;
  const targetText = currentWord ? (currentWord.example || currentWord.word) : "";

  const resetAttemptState = () => {
    setTranscript(null);
    setCoachFeedback(null);
    setPracticedAt(null);
  };

  const handleSpeak = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        handleTranscribe(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      Swal.fire("Không thể truy cập micro", "Vui lòng cấp quyền micro cho trình duyệt rồi thử lại.", "error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const handleTranscribe = async (blob: Blob) => {
    setTranscribing(true);
    setTranscript(null);
    setCoachFeedback(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const res = await fetch(`${API}/api/pronunciation/transcribe`, { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTranscript(data.transcript || "");
      setPracticedAt(new Date().toISOString());
    } catch {
      Swal.fire("Lỗi", "Không thể xử lý bản ghi âm. Vui lòng thử lại.", "error");
    } finally {
      setTranscribing(false);
    }
  };

  const { results: wordResults, matchScore, mismatchedWords } = transcript !== null
    ? computeMatch(targetText, transcript)
    : { results: [] as WordMatch[], matchScore: 0, mismatchedWords: [] as string[] };

  const runCoach = async () => {
    if (transcript === null) return;
    setCoaching(true);
    try {
      const res = await fetch(`${API}/api/pronunciation/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetText, transcript, mismatchedWords })
      });
      if (!res.ok) throw new Error();
      setCoachFeedback(await res.json());
    } catch {
      Swal.fire("Lỗi", "Không thể phân tích lúc này. Vui lòng thử lại.", "error");
    } finally {
      setCoaching(false);
    }
  };

  const saveAndNext = async () => {
    if (!userId || !currentWord || transcript === null) return;
    setSaving(true);
    try {
      await fetch(`${API}/api/pronunciation/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId, vocabId: currentWord.vocabId, targetText, transcript,
          matchScore, feedback: coachFeedback
        })
      });
      logSkillProgress(userId, "SPEAKING", matchScore, "PRONUNCIATION_PRACTICE");
      fetchHistory(userId);
    } catch {
      Swal.fire("Lỗi", "Không thể lưu kết quả lần này.", "error");
    } finally {
      setSaving(false);
      resetAttemptState();
      setCurrentIndex(i => (i + 1 < practiceSet.length ? i + 1 : 0));
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

  const buildRubric = (fb: CoachFeedback): SkillReportRubricItem[] =>
    (fb.likelyIssues || []).map(i => ({ label: i.word, note: i.tip }));

  if (!userId) return null;

  const historyFeedback: CoachFeedback | null = viewingHistoryItem?.feedback ? JSON.parse(viewingHistoryItem.feedback) : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Page banner (IOT style) */}
      <div className="w-full bg-surface border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <Link href="/dashboard" className="font-semibold text-muted hover:text-primary transition-colors inline-flex items-center gap-1 py-2">
                ← Quay lại Dashboard
              </Link>
              <span aria-hidden>·</span>
              <span>Trang chủ / Luyện Phát Âm</span>
            </div>
            <h1 className="ui-page-title mt-2 text-2xl sm:text-3xl">Luyện Phát Âm Cùng AI</h1>
            <p className="ui-page-subtitle">Đọc theo từ vựng của bạn, ghi âm và nhận góp ý phát âm từ AI.</p>
          </div>
          <img src="/images/thumbs/pronunciation.svg" alt="Minh hoạ luyện phát âm" width={640} height={360} loading="eager" className="hidden md:block w-60 h-auto rounded-2xl border border-line shadow-card shrink-0" />
        </div>
      </div>

      {/* Pill tabs */}
      <div className="max-w-5xl mx-auto px-4 pt-6">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "PRACTICE", label: "Luyện Tập" },
            { key: "HISTORY", label: `Lịch Sử (${history.length})` }
          ].map(v => (
            <button
              key={v.key}
              onClick={() => { setViewMode(v.key as any); setViewingHistoryItem(null); }}
              className={`ui-chip cursor-pointer ${viewMode === v.key ? "ui-chip-active" : ""}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pb-12 pt-6 space-y-6">
        {viewMode === "PRACTICE" && (
          <>
            <div className="ui-card p-6 sm:p-8">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted mb-1.5">Luyện Phát Âm</p>
                <h2 className="ui-section-title mb-3">Đọc Theo & Ghi Âm</h2>
                <p className="text-muted max-w-2xl leading-relaxed text-sm sm:text-base">
                  Luyện đọc từ vựng bạn đã học, ghi âm giọng nói và so khớp với hệ thống nhận dạng giọng nói — kèm góp ý từ AI. Đây là ước lượng dựa trên nhận dạng giọng nói, không phải chấm âm vị học tuyệt đối.
                </p>
              </div>
            </div>

            {loadingSet ? (
              <div className="ui-card text-center py-12 text-muted">Đang tải danh sách từ...</div>
            ) : practiceSet.length === 0 ? (
              <div className="ui-card p-8 text-center space-y-3">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có từ vựng để luyện" width={800} height={600} loading="lazy" className="w-full max-w-[220px] h-auto mx-auto" />
                <h2 className="font-bold text-lg text-primary">Bạn chưa có từ vựng nào để luyện</h2>
                <p className="text-muted text-sm max-w-md mx-auto">Hãy sang Phòng Gym Từ Vựng để tự thêm vài từ mới (hoặc ôn tập từ giáo viên đã giao), rồi quay lại đây luyện phát âm.</p>
                <Link href="/gym" className="btn-primary mt-2 px-6 py-2.5">
                  Đến Phòng Gym Từ Vựng →
                </Link>
              </div>
            ) : currentWord && (
              <div className="ui-card p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="ui-badge">Từ {currentIndex + 1}/{practiceSet.length}</span>
                  <button onClick={() => handleSpeak(targetText)} className="btn-outline text-xs px-4 py-2">
                    🔊 Nghe Mẫu
                  </button>
                </div>

                <div className="text-center space-y-2">
                  <h2 className="text-4xl font-extrabold text-primary">{currentWord.word}</h2>
                  {currentWord.phonetic && <p className="text-muted font-mono">{currentWord.phonetic}</p>}
                  <p className="text-foreground/80">{currentWord.meaning}</p>
                  {currentWord.example && (
                    <p className="text-foreground/80 italic bg-primary-soft rounded-xl p-4 mt-3">&quot;{currentWord.example}&quot;</p>
                  )}
                </div>

                <div className="flex justify-center">
                  {!isRecording ? (
                    <button
                      onClick={startRecording}
                      disabled={transcribing}
                      className="w-20 h-20 rounded-full bg-primary hover:bg-[#172e6e] text-white text-3xl shadow-[0_10px_24px_rgba(30,58,138,0.35)] ring-8 ring-primary-soft flex items-center justify-center transition-colors disabled:opacity-50"
                      title="Bắt đầu ghi âm"
                    >
                      🎙️
                    </button>
                  ) : (
                    <button
                      onClick={stopRecording}
                      className="w-20 h-20 rounded-full bg-red-600 text-white text-3xl shadow-[0_10px_24px_rgba(220,38,38,0.35)] ring-8 ring-red-100 flex items-center justify-center animate-pulse"
                      title="Dừng ghi âm"
                    >
                      ⏹
                    </button>
                  )}
                </div>
                <p className="text-center text-xs font-medium text-muted -mt-3">
                  {isRecording ? "Đang ghi âm — bấm để dừng" : transcribing ? "Đang xử lý bản ghi âm..." : "Bấm để đọc theo câu/từ mẫu ở trên"}
                </p>

                {transcript !== null && (
                  <div className="space-y-4 border-t border-line pt-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Hệ thống nghe được</p>
                      <p className="text-foreground/80 italic">&quot;{transcript || "(không nghe rõ)"}&quot;</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">So khớp từng từ — {Math.round(matchScore * 10)}% khớp</p>
                      <div className="flex flex-wrap gap-1.5">
                        {wordResults.map((r, i) => (
                          <span key={i} className={`px-3 py-1 rounded-full text-sm font-semibold ${r.matched ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-red-50 text-red-700 border border-red-100"}`}>
                            {r.word}
                          </span>
                        ))}
                      </div>
                    </div>

                    {!coachFeedback ? (
                      <button
                        onClick={runCoach}
                        disabled={coaching}
                        className="btn-outline w-full py-3"
                      >
                        {coaching ? (<><span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> Đang phân tích...</>) : (<>Xin AI Góp Ý</>)}
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-primary-soft border border-primary/15 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">{coachFeedback.overall}</div>
                        {coachFeedback.likelyIssues?.map((issue, i) => (
                          <div key={i} className="bg-white border border-line rounded-xl p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">{issue.word}</p>
                            <p className="text-sm text-foreground/80 leading-relaxed">{issue.tip}</p>
                          </div>
                        ))}
                        {coachFeedback.suggestions?.length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-2">Gợi ý luyện tập</p>
                            <ul className="space-y-1">
                              {coachFeedback.suggestions.map((s, i) => (
                                <li key={i} className="text-sm text-amber-800 flex gap-2">
                                  <span className="text-amber-500 font-bold shrink-0">{i + 1}.</span>{s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                          <SkillReportPDF
                            ref={pdfRef}
                            skillLabel="Luyện Phát Âm (Pronunciation)"
                            skillIcon="🗣️"
                            studentName={userName}
                            practicedAt={practicedAt || new Date()}
                            score={matchScore}
                            contextTitle={currentWord.word}
                            overallComment={coachFeedback.overall}
                            rubric={buildRubric(coachFeedback)}
                            suggestions={coachFeedback.suggestions || []}
                            transcriptTitle="Câu Mẫu & Bản Ghi"
                            transcriptBody={`Câu mẫu: ${targetText}\nHệ thống nghe được: ${transcript}`}
                          />
                        </div>
                        <button
                          onClick={() => downloadPdf(pdfRef.current, `bao-cao-phat-am-${Date.now()}.pdf`)}
                          disabled={exportingPdf}
                          className="btn-outline text-xs px-4 py-2"
                        >
                          {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={saveAndNext}
                      disabled={saving}
                      className="btn-primary w-full py-4"
                    >
                      {saving ? "Đang lưu..." : "Lưu & Từ Tiếp Theo →"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {viewMode === "HISTORY" && !viewingHistoryItem && (
          <div className="space-y-3">
            <h2 className="ui-section-title mb-4">Lịch Sử Luyện Phát Âm</h2>
            {history.length === 0 ? (
              <div className="ui-card p-8 text-center flex flex-col items-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử luyện phát âm" width={800} height={600} loading="lazy" className="w-full max-w-[220px] h-auto mb-4" />
                <p className="text-muted text-sm">Bạn chưa luyện phát âm lần nào. Kết quả sẽ tự động lưu tại đây sau mỗi lần ghi âm.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {historyPagination.pageItems.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => setViewingHistoryItem(h)}
                    className="w-full text-left ui-card ui-card-hover p-5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary line-clamp-1">{h.targetText}</p>
                      <p className="text-xs text-muted mt-1">{formatPracticedAt(h.practicedAt)}</p>
                    </div>
                    <span className="ui-badge shrink-0">{h.matchScore.toFixed(1)}/10</span>
                  </button>
                ))}
                </div>
                <Pagination page={historyPagination.page} totalPages={historyPagination.totalPages} totalItems={historyPagination.totalItems} pageSize={10} onPageChange={historyPagination.setPage} />
              </>
            )}
          </div>
        )}

        {viewMode === "HISTORY" && viewingHistoryItem && (
          <div className="space-y-4">
            <button onClick={() => setViewingHistoryItem(null)} className="text-xs font-bold text-muted hover:text-primary transition-colors inline-flex items-center gap-1 py-2">
              ← Quay lại danh sách
            </button>
            <h2 className="text-xl font-extrabold text-primary">{viewingHistoryItem.targetText}</h2>
            <p className="text-xs text-muted">{formatPracticedAt(viewingHistoryItem.practicedAt)}</p>
            <div className="ui-card p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-muted mb-1">Hệ thống nghe được</p>
              <p className="italic text-foreground/80">&quot;{viewingHistoryItem.transcript}&quot;</p>
              <p className="text-lg font-bold text-primary mt-3">Độ khớp: {viewingHistoryItem.matchScore.toFixed(1)}/10</p>
            </div>
            {historyFeedback && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-primary">Góp Ý AI</h3>
                  <button
                    onClick={() => downloadPdf(historyPdfRef.current, `bao-cao-phat-am-${Date.now()}.pdf`)}
                    disabled={exportingPdf}
                    className="btn-outline text-xs px-4 py-2"
                  >
                    {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                  </button>
                </div>
                <div className="bg-primary-soft border border-primary/15 rounded-xl p-4 text-sm text-foreground/80 leading-relaxed">{historyFeedback.overall}</div>
                {historyFeedback.likelyIssues?.map((issue, i) => (
                  <div key={i} className="bg-white border border-line rounded-xl p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-primary mb-1">{issue.word}</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{issue.tip}</p>
                  </div>
                ))}

                <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                  <SkillReportPDF
                    ref={historyPdfRef}
                    skillLabel="Luyện Phát Âm (Pronunciation)"
                    skillIcon="🗣️"
                    studentName={userName}
                    practicedAt={viewingHistoryItem.practicedAt}
                    score={viewingHistoryItem.matchScore}
                    contextTitle={viewingHistoryItem.targetText}
                    overallComment={historyFeedback.overall}
                    rubric={buildRubric(historyFeedback)}
                    suggestions={historyFeedback.suggestions || []}
                    transcriptTitle="Câu Mẫu & Bản Ghi"
                    transcriptBody={`Câu mẫu: ${viewingHistoryItem.targetText}\nHệ thống nghe được: ${viewingHistoryItem.transcript}`}
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
