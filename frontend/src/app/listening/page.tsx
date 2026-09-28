"use client";
import { useState, useEffect, useRef } from "react";
import { getSessionUserId } from "@/lib/session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { cleanString, levenshteinDistance, getHintMask } from "@/lib/textGrading";
import { logSkillProgress } from "@/lib/skillProgress";
import { isReadingAnswerCorrect, FILL_TYPES, type ReadingQuestion } from "@/lib/readingGrading";
import { CEFR_LEVELS, PRACTICE_PURPOSES, CefrLevel, PracticePurpose, formatPracticedAt } from "@/lib/skillPractice";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Maps the existing SM-2 review quality scale (1/3/4/5 — see textGrading-based
// grading below) to a plain 0-10 score, purely to feed the dashboard's 4-skill
// radar chart with a rolling "recent listening accuracy" estimate.
const QUALITY_TO_SCORE: Record<number, number> = { 1: 2, 3: 6.5, 4: 8, 5: 10 };

interface ClipMatch {
  clipId: string;
  title: string;
  audioUrl: string;
  accent: string;
  start: number;
  end: number;
  tokens: string[];
  targetTokenIndex: number;
  fullScript: string;
}

function highlightWords(text: string, words: string[]) {
  if (words.length === 0) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(\\b(?:${escaped.join("|")})\\b)`, "gi");
  const cleanWords = new Set(words.map((w) => w.toLowerCase()));
  return text.split(pattern).map((part, i) =>
    cleanWords.has(part.toLowerCase()) ? (
      <mark key={i} className="bg-primary/15 text-primary font-bold rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "UK", label: "🇬🇧 UK" },
  { value: "US", label: "🇺🇸 US" },
  { value: "AUS", label: "🇦🇺 AUS" }
];

interface QueueItem {
  progressId: string | null;
  vocab: {
    id: string | null;
    word: string;
    meaning: string;
    pos?: string;
    phonetic?: string;
  };
  clips: ClipMatch[];
  free?: boolean;
}

export default function ListeningPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [accentFilter, setAccentFilter] = useState("ALL");
  const [phase, setPhase] = useState<"EXPLORE" | "TEST">("EXPLORE");
  const [loadingMore, setLoadingMore] = useState(false);

  const [typedAnswer, setTypedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [computedQuality, setComputedQuality] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingFullRef = useRef(false);
  // "Free listen" clips (progressId === null) never change server-side state — nothing marks
  // them as "already served", so without tracking this client-side, refilling the queue would
  // return the exact same deterministic clips forever whenever the queue is mostly/entirely
  // free-listen content. Persists for the whole session (not reset per accent change).
  const seenFreeClipIdsRef = useRef<Set<string>>(new Set());

  // ── Đề Luyện Nghe (exam-style listening practice) ──
  const [pageMode, setPageMode] = useState<"VOCAB" | "EXAM" | "HISTORY">("VOCAB");
  const [userName, setUserName] = useState("Học viên");
  const [examClips, setExamClips] = useState<{ id: string; title: string; audioUrl: string; accent: string }[]>([]);
  const [examClipId, setExamClipId] = useState("");
  const [examLevel, setExamLevel] = useState<CefrLevel>("B1");
  const [examPurpose, setExamPurpose] = useState<PracticePurpose>("GENERAL");
  const [examNumQuestions, setExamNumQuestions] = useState(5);
  const [generatingExam, setGeneratingExam] = useState(false);
  const [examData, setExamData] = useState<{ clip: any; questions: ReadingQuestion[] } | null>(null);
  const [examAnswers, setExamAnswers] = useState<Record<number, number | string>>({});
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examPracticedAt, setExamPracticedAt] = useState<string | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const examHistoryPagination = usePagination(examHistory, 10);
  const [viewingExamHistoryItem, setViewingExamHistoryItem] = useState<any | null>(null);
  const examPdfRef = useRef<HTMLDivElement>(null);
  const examHistoryPdfRef = useRef<HTMLDivElement>(null);

  const fetchExamClips = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/listening/exam/clips/${uid}`);
      setExamClips(await res.json());
    } catch {
      setExamClips([]);
    }
  };

  const fetchExamHistory = async (uid: string) => {
    try {
      const res = await fetch(`${API}/api/listening/exam/attempts/${uid}`);
      const data = await res.json();
      setExamHistory(Array.isArray(data) ? data : []);
    } catch {
      setExamHistory([]);
    }
  };

  const generateExam = async () => {
    if (!examClipId || !userId) {
      Swal.fire("Chưa chọn audio", "Vui lòng chọn 1 audio để tạo đề luyện nghe.", "warning");
      return;
    }
    setGeneratingExam(true);
    setExamData(null);
    setExamAnswers({});
    setExamSubmitted(false);
    try {
      const res = await fetch(`${API}/api/listening/exam/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, clipId: examClipId, level: examLevel, purpose: examPurpose, numQuestions: examNumQuestions })
      });
      if (!res.ok) throw new Error();
      setExamData(await res.json());
    } catch {
      Swal.fire("Lỗi", "Không thể tạo đề luyện nghe lúc này. Vui lòng thử lại.", "error");
    } finally {
      setGeneratingExam(false);
    }
  };

  const selectExamAnswer = (qi: number, value: number | string) => {
    if (examSubmitted) return;
    setExamAnswers((prev) => ({ ...prev, [qi]: value }));
  };

  const submitExam = async () => {
    if (!examData) return;
    const unanswered = examData.questions.some((q, i) => {
      const a = examAnswers[i];
      return a === undefined || (typeof a === "string" && !a.trim());
    });
    if (unanswered) {
      Swal.fire("Chưa xong", "Vui lòng trả lời hết các câu hỏi trước khi nộp.", "warning");
      return;
    }
    setExamSubmitted(true);
    const now = new Date().toISOString();
    setExamPracticedAt(now);

    const correctCount = examData.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, examAnswers[i]) ? 1 : 0), 0);
    const score = (correctCount / examData.questions.length) * 10;
    logSkillProgress(userId, "LISTENING", score, "LISTENING_EXAM");

    if (userId) {
      try {
        await fetch(`${API}/api/listening/exam/attempts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, clipId: examData.clip.id, title: examData.clip.title, level: examLevel, purpose: examPurpose, questions: examData.questions, answers: examAnswers, score })
        });
        fetchExamHistory(userId);
      } catch {}
    }
  };

  const downloadExamPdf = async (node: HTMLDivElement | null) => {
    if (!node) return;
    setExportingPdf(true);
    try {
      await exportNodeToPDF(node, `bao-cao-luyen-nghe-${Date.now()}.pdf`);
    } catch {
      Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error");
    } finally {
      setExportingPdf(false);
    }
  };

  const buildExamRubric = (questions: ReadingQuestion[], answers: Record<number, number | string>): SkillReportRubricItem[] =>
    questions.map((q, i) => ({
      label: `Câu ${i + 1}`,
      note: `${isReadingAnswerCorrect(q, answers[i]) ? "✅ Đúng" : "❌ Sai"} — ${q.explanation}`
    }));

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then(r => r.json()).then(u => setUserName(u.name || "Học viên")).catch(() => {});
    fetchExamClips(uid);
    fetchExamHistory(uid);
    fetchQueue(uid, accentFilter);
  }, [router]);

  // `useLocalSpinner` picks which loading flag gates the fetch: the page-gating `loading`
  // state (used on first mount, before the entire page below it can even render) vs the
  // localized `loadingMore` flag (used when the page is already showing content and only the
  // vocab card itself should show a spinner — an accent-filter change shouldn't blank out the
  // header/tabs along with it).
  const fetchQueue = async (uid: string, accent: string, useLocalSpinner = false) => {
    const setSpinner = useLocalSpinner ? setLoadingMore : setLoading;
    setSpinner(true);
    try {
      const params = new URLSearchParams();
      if (accent !== "ALL") params.set("accent", accent);
      if (seenFreeClipIdsRef.current.size > 0) params.set("excludeClipIds", [...seenFreeClipIdsRef.current].join(","));
      const qs = params.toString();
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/listening/queue/${uid}${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data: QueueItem[] = await res.json();
        data.forEach((item) => { if (item.free && item.clips[0]) seenFreeClipIdsRef.current.add(item.clips[0].clipId); });
        setQueue(data);
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải dữ liệu luyện nghe", "error");
    }
    setSpinner(false);
  };

  const changeAccentFilter = (accent: string) => {
    if (accent === accentFilter || !userId) return;
    setAccentFilter(accent);
    setCurrentIndex(0);
    resetCardState();
    fetchQueue(userId, accent, true);
  };

  const currentItem = queue[currentIndex];
  const currentClip = currentItem?.clips[selectedClipIndex];

  // Seek to the start of the sentence containing the matched word whenever the active clip
  // changes, and auto-pause once playback passes the end of that sentence.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentClip) return;

    const seekToStart = () => {
      playingFullRef.current = false;
      audio.currentTime = currentClip.start;
      audio.play().catch(() => {});
    };
    const pauseAtEnd = () => {
      if (playingFullRef.current) return;
      if (audio.currentTime >= currentClip.end) audio.pause();
    };

    audio.addEventListener("loadedmetadata", seekToStart);
    audio.addEventListener("timeupdate", pauseAtEnd);
    if (audio.readyState >= 1) seekToStart();

    return () => {
      audio.removeEventListener("loadedmetadata", seekToStart);
      audio.removeEventListener("timeupdate", pauseAtEnd);
    };
  }, [currentClip]);

  const replay = () => {
    const audio = audioRef.current;
    if (!audio || !currentClip) return;
    playingFullRef.current = false;
    audio.currentTime = currentClip.start;
    audio.play().catch(() => {});
  };

  const playFullTranscript = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playingFullRef.current = true;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const resetCardState = () => {
    setSelectedClipIndex(0);
    setPhase("EXPLORE");
    setTypedAnswer("");
    setSubmitted(false);
    setUsedHint(false);
    setIsCorrect(null);
    setComputedQuality(null);
  };

  const submitTypedAnswer = () => {
    if (submitted || !currentItem || !currentClip) return;
    const targetWord = currentClip.tokens[currentClip.targetTokenIndex];
    const cleanUser = cleanString(typedAnswer);
    const cleanCorrect = cleanString(targetWord);

    if (!cleanUser) {
      setIsCorrect(false);
      setComputedQuality(1);
      setSubmitted(true);
      return;
    }

    const maxTypoDistance = cleanCorrect.length <= 4 ? 1 : 2;

    if (cleanUser === cleanCorrect) {
      setIsCorrect(true);
      setComputedQuality(usedHint ? 4 : 5);
    } else if (levenshteinDistance(cleanUser, cleanCorrect) <= maxTypoDistance) {
      setIsCorrect(true);
      setComputedQuality(3);
    } else {
      setIsCorrect(false);
      setComputedQuality(1);
    }
    setSubmitted(true);
  };

  const goNext = async () => {
    if (!currentItem || !currentClip || computedQuality === null || !userId) return;
    try {
      // Free-listen items (audio the SRS deck doesn't have a matching due word for) have no
      // progressId to update — just log them for the dashboard's skill chart, same as the
      // Đề Luyện Nghe exam mode does for its own non-SRS attempts.
      if (currentItem.progressId) {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/srs/review/${currentItem.progressId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quality: computedQuality })
        });
        logSkillProgress(userId, "LISTENING", QUALITY_TO_SCORE[computedQuality] ?? 2, "LISTENING_SRS");
      } else {
        logSkillProgress(userId, "LISTENING", QUALITY_TO_SCORE[computedQuality] ?? 2, "LISTENING_FREE");
      }
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể lưu kết quả", "error");
      return;
    }

    resetCardState();

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    // Ran through the current batch — silently pull in the next batch of due words
    // and keep going rather than interrupting with a "session complete" screen. Routed through
    // fetchQueue (not a duplicate inline fetch) so the excludeClipIds rotation for free-listen
    // items applies here too, not just on the initial load/accent-filter change.
    await fetchQueue(userId, accentFilter, true);
    setCurrentIndex(0);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-primary animate-pulse">Đang nạp dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page banner */}
      <div className="bg-primary-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <nav aria-label="Breadcrumb" className="text-xs text-muted mb-2 flex flex-wrap items-center gap-1.5">
              <Link href="/dashboard" className="hover:text-primary">Trang chủ</Link>
              <span aria-hidden>/</span>
              <span className="text-foreground font-semibold">Luyện Nghe</span>
            </nav>
            <h1 className="ui-page-title">Studio Luyện Nghe</h1>
            <p className="ui-page-subtitle max-w-2xl leading-relaxed">
              Nghe từ vựng trong ngữ cảnh audio thật do giáo viên giao, luyện chép chính tả và làm đề luyện nghe do AI tạo từ script gốc.
            </p>
            <Link href="/dashboard" className="btn-ghost px-3 py-2 text-sm mt-3 -ml-3">
              ← Dashboard
            </Link>
          </div>
          <img
            src="/images/thumbs/listening.svg"
            alt="Minh hoạ luyện nghe tiếng Anh"
            width={640}
            height={360}
            loading="eager"
            className="hidden md:block w-60 lg:w-72 h-auto rounded-2xl shrink-0"
          />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 flex flex-wrap gap-2">
        {[
          { key: "VOCAB", label: "Tra Từ Vựng" },
          { key: "EXAM", label: "Đề Luyện Nghe" },
          { key: "HISTORY", label: `Lịch Sử (${examHistory.length})` }
        ].map(v => (
          <button
            key={v.key}
            onClick={() => { setPageMode(v.key as any); setViewingExamHistoryItem(null); }}
            className={`ui-chip ${pageMode === v.key ? "ui-chip-active" : ""}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {pageMode === "VOCAB" && (
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeAccentFilter(opt.value)}
              className={`ui-chip font-bold ${
                accentFilter === opt.value
                  ? "ui-chip-active"
                  : ""
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loadingMore ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <span className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" aria-hidden />
            <p className="text-muted font-bold">Đang nạp thêm từ vựng...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="ui-card flex flex-col items-center justify-center text-center py-16 px-6">
            <img src="/images/illustrations/empty-state.svg" alt="Chưa có audio luyện nghe" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mb-4" />
            <h2 className="text-2xl font-bold text-primary mb-2">Chưa có audio để luyện nghe</h2>
            <p className="text-muted">
              Giáo viên chưa gán audio nào cho bạn hoặc lớp của bạn. Hãy quay lại sau khi giáo viên cập nhật thêm nội dung ở Studio Luyện Nghe.
            </p>
          </div>
        ) : currentItem && currentClip ? (
          <div className="space-y-6">
            <div className="w-full mb-2">
              <div className="flex justify-between text-xs font-bold text-muted mb-2">
                <span>Tiến độ</span>
                <span>Còn lại {queue.length - currentIndex} từ</span>
              </div>
              <div className="h-2 w-full bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(currentIndex / queue.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="ui-card p-5 sm:p-8 text-center">
              <p className="text-xs sm:text-sm font-bold text-muted uppercase tracking-widest mb-1">
                {phase === "EXPLORE" ? "Xem & Nghe Từ Trong Câu" : "Nghe Và Điền Từ"}
              </p>
              {currentItem.free && (
                <span className="inline-block mb-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wide">
                  Nghe tự do
                </span>
              )}
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-1 break-words">{currentItem.vocab.meaning}</h2>
              {currentItem.vocab.phonetic && <p className="text-muted font-mono">{currentItem.vocab.phonetic}</p>}
              {currentItem.clips.length === 1 && (
                <p className="ui-badge mt-2">
                  {ACCENT_OPTIONS.find((o) => o.value === currentClip.accent)?.label || currentClip.accent}
                </p>
              )}

              {phase === "EXPLORE" && currentItem.clips.length > 1 && (
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {currentItem.clips.map((clip, idx) => (
                    <button
                      key={clip.clipId}
                      onClick={() => setSelectedClipIndex(idx)}
                      className={`ui-chip px-3.5 py-2 text-xs font-bold max-w-[70vw] sm:max-w-[220px] truncate block ${
                        idx === selectedClipIndex
                          ? "ui-chip-active"
                          : ""
                      }`}
                    >
                      {ACCENT_OPTIONS.find((o) => o.value === clip.accent)?.label || clip.accent} · Ví dụ {idx + 1}: {clip.title}
                    </button>
                  ))}
                </div>
              )}

              <audio ref={audioRef} src={currentClip.audioUrl} className="hidden" />

              <button
                onClick={replay}
                className="mt-6 w-16 h-16 mx-auto rounded-full bg-primary text-white flex items-center justify-center text-2xl shadow-card hover:bg-[#172e6e] hover:shadow-card-hover transition-all"
                aria-label="Nghe lại"
              >
                ▶
              </button>

              {phase === "EXPLORE" ? (
                <div className="mt-6">
                  <p className="text-lg leading-relaxed">
                    {currentClip.tokens.map((token, idx) =>
                      idx === currentClip.targetTokenIndex ? (
                        <button
                          key={idx}
                          onClick={replay}
                          className="font-black text-primary underline decoration-dotted decoration-2 underline-offset-4 hover:bg-primary-soft rounded px-0.5 cursor-pointer"
                          title="Bấm để nghe lại từ này"
                        >
                          {token}{" "}
                        </button>
                      ) : (
                        <span key={idx}>{token} </span>
                      )
                    )}
                  </p>
                  <p className="text-xs text-muted mt-2">Bấm vào từ được bôi đậm để nghe lại</p>
                  <button
                    onClick={() => setPhase("TEST")}
                    className="btn-primary mt-6 w-full py-3.5"
                  >
                    Bắt Đầu Kiểm Tra →
                  </button>
                </div>
              ) : !submitted ? (
                <div className="mt-6 flex flex-col items-center w-full">
                  <p className="text-lg leading-relaxed mb-4">
                    {currentClip.tokens.map((token, idx) =>
                      idx === currentClip.targetTokenIndex ? (
                        <span key={idx} className="inline-block border-b-2 border-primary min-w-[3rem] px-1">&nbsp;</span>
                      ) : (
                        <span key={idx}>{token} </span>
                      )
                    )}
                  </p>
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitTypedAnswer(); }}
                    placeholder="Gõ từ bạn nghe được..."
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full max-w-xs text-center text-xl font-bold border border-line-strong focus:border-primary focus:ring-[3px] focus:ring-primary/10 rounded-xl px-4 py-3 outline-none transition-colors bg-surface text-foreground"
                  />
                  {usedHint && (
                    <p className="mt-4 font-mono text-lg tracking-widest text-muted">
                      {getHintMask(currentClip.tokens[currentClip.targetTokenIndex])}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap justify-center gap-3 w-full max-w-xs">
                    <button
                      onClick={() => setUsedHint(true)}
                      disabled={usedHint}
                      className="flex-1 min-w-[120px] px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-full hover:bg-amber-100 transition-colors disabled:opacity-50"
                    >
                      Gợi Ý
                    </button>
                    <button
                      onClick={submitTypedAnswer}
                      className="btn-primary flex-1 min-w-[120px] px-4 py-2.5"
                    >
                      Kiểm Tra
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <div className={`inline-block mb-4 px-5 py-2 rounded-full font-bold border ${isCorrect ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                    {isCorrect ? (computedQuality === 3 ? "Gần đúng!" : "Chính xác!") : "Chưa đúng"}
                  </div>
                  <p className="text-lg leading-relaxed">
                    {currentClip.tokens.map((token, idx) => (
                      <span key={idx} className={idx === currentClip.targetTokenIndex ? "font-black text-primary underline" : ""}>
                        {token}{" "}
                      </span>
                    ))}
                  </p>
                  {!isCorrect && typedAnswer && (
                    <p className="text-muted mt-3 text-sm">Bạn đã gõ: <span className="line-through">{typedAnswer}</span></p>
                  )}

                  <div className="mt-6 pt-6 border-t border-line text-left">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2 text-center">Toàn Bộ Transcript</p>
                    <p className="text-sm text-foreground leading-7 whitespace-pre-wrap bg-[#f7f9fc] border border-line rounded-xl p-4">
                      {highlightWords(currentClip.fullScript, [currentClip.tokens[currentClip.targetTokenIndex]])}
                    </p>
                    <button
                      onClick={playFullTranscript}
                      className="btn-outline mt-4 mx-auto flex px-5 py-2"
                    >
                      ▶ Nghe Toàn Bộ
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`transition-opacity duration-300 ${submitted ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <button
                onClick={goNext}
                className="btn-primary w-full py-3.5"
              >
                Tiếp Tục →
              </button>
            </div>
          </div>
        ) : null}
      </div>
      )}

      {pageMode === "EXAM" && (
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
          {!examData ? (
            <div className="ui-card p-5 sm:p-6 space-y-5">
              <h2 className="ui-section-title">Tạo Đề Luyện Nghe</h2>
              {examClips.length === 0 ? (
                <div className="text-center py-4">
                  <img src="/images/illustrations/empty-state.svg" alt="Chưa có audio để tạo đề" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-4" />
                  <p className="text-sm text-muted">Chưa có audio nào khả dụng để tạo đề. Hãy đợi giáo viên giao thêm audio luyện nghe cho bạn.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="ui-label">Chọn audio</label>
                    <select value={examClipId} onChange={(e) => setExamClipId(e.target.value)} className="ui-input font-semibold">
                      <option value="">-- Chọn audio --</option>
                      {examClips.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.accent})</option>)}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    <div className="min-w-[150px]">
                      <label className="ui-label">Cấp độ (CEFR)</label>
                      <select value={examLevel} onChange={(e) => setExamLevel(e.target.value as CefrLevel)} className="ui-input font-semibold">
                        {CEFR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[190px]">
                      <label className="ui-label">Mục đích luyện tập</label>
                      <select value={examPurpose} onChange={(e) => setExamPurpose(e.target.value as PracticePurpose)} className="ui-input font-semibold">
                        {PRACTICE_PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                    </div>
                    <div className="min-w-[130px]">
                      <label className="ui-label">Số câu hỏi</label>
                      <input type="number" min={3} max={10} value={examNumQuestions} onChange={(e) => setExamNumQuestions(Number(e.target.value) || 5)} className="ui-input font-semibold" />
                    </div>
                  </div>
                  <button
                    onClick={generateExam}
                    disabled={generatingExam}
                    className="btn-primary w-full py-3"
                  >
                    {generatingExam ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang tạo đề...</>
                    ) : (
                      <>Tạo Đề Luyện Nghe</>
                    )}
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="ui-card p-5 sm:p-7 space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="ui-section-title">{examData.clip.title}</h2>
                <button onClick={() => setExamData(null)} className="btn-outline px-4 py-2 text-xs">↺ Tạo đề khác</button>
              </div>
              <audio controls src={examData.clip.audioUrl} className="w-full rounded-full bg-[#f7f9fc]" />

              <div className="space-y-4">
                {examData.questions.map((q, qi) => (
                  <div key={qi} className="border border-line rounded-xl p-4 sm:p-5 bg-surface">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{qi + 1}</span>
                      <p className="font-semibold flex-1">{q.question}</p>
                    </div>
                    {FILL_TYPES.includes(q.type) ? (
                      <div className="pl-9">
                        <input
                          type="text"
                          value={(examAnswers[qi] as string) || ""}
                          onChange={(e) => selectExamAnswer(qi, e.target.value)}
                          disabled={examSubmitted}
                          placeholder="Gõ từ/cụm từ cần điền..."
                          className={`w-full p-3 border rounded-lg text-sm transition-colors ${
                            examSubmitted
                              ? isReadingAnswerCorrect(q, examAnswers[qi]) ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800"
                              : "border-line-strong bg-surface focus:border-primary focus:ring-[3px] focus:ring-primary/10 outline-none"
                          }`}
                        />
                        {examSubmitted && !isReadingAnswerCorrect(q, examAnswers[qi]) && (
                          <p className="text-xs text-emerald-700 mt-1.5">Đáp án đúng: <strong>{q.correctAnswer}</strong></p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2 pl-9">
                        {(q.options || []).map((opt, oi) => {
                          const isSelected = examAnswers[qi] === oi;
                          const isCorrectOpt = oi === q.correctIndex;
                          let stateClass = "border-line-strong bg-surface hover:border-primary hover:bg-primary-soft/50";
                          if (examSubmitted) {
                            if (isCorrectOpt) stateClass = "border-emerald-300 bg-emerald-50 text-emerald-800";
                            else if (isSelected) stateClass = "border-red-300 bg-red-50 text-red-800";
                          } else if (isSelected) {
                            stateClass = "border-primary bg-primary-soft text-primary font-semibold";
                          }
                          return (
                            <button key={oi} onClick={() => selectExamAnswer(qi, oi)} disabled={examSubmitted} className={`w-full text-left p-3 border rounded-lg text-sm transition-colors ${stateClass}`}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {examSubmitted && (
                      <p className="text-xs text-muted mt-3 ml-9 bg-primary-soft/60 border border-line p-3 rounded-lg leading-relaxed">{q.explanation}</p>
                    )}
                  </div>
                ))}
              </div>

              {!examSubmitted ? (
                <button onClick={submitExam} className="btn-primary w-full py-3">Nộp bài</button>
              ) : (
                <div className="space-y-4">
                  <div className="ui-card p-5 flex items-center justify-between flex-wrap gap-3">
                    <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả bài làm" width={800} height={600} loading="lazy" className="hidden sm:block w-24 h-auto shrink-0" />
                    <div className="flex-1 min-w-[180px]">
                      <p className="text-xl font-extrabold text-primary">
                        Kết quả: {examData.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, examAnswers[i]) ? 1 : 0), 0)}/{examData.questions.length} câu đúng
                      </p>
                      {examPracticedAt && <p className="text-xs text-muted mt-1">{formatPracticedAt(examPracticedAt)}</p>}
                    </div>
                    <button
                      onClick={() => downloadExamPdf(examPdfRef.current)}
                      disabled={exportingPdf}
                      className="btn-outline px-4 py-2 text-xs"
                    >
                      {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
                    </button>
                  </div>

                  <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
                    <SkillReportPDF
                      ref={examPdfRef}
                      skillLabel="Luyện Nghe (Listening)"
                      skillIcon="🎧"
                      studentName={userName}
                      practicedAt={examPracticedAt || new Date()}
                      level={examLevel}
                      purpose={examPurpose}
                      score={(examData.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, examAnswers[i]) ? 1 : 0), 0) / examData.questions.length) * 10}
                      contextTitle={examData.clip.title}
                      overallComment={`Học viên trả lời đúng ${examData.questions.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, examAnswers[i]) ? 1 : 0), 0)}/${examData.questions.length} câu hỏi luyện nghe.`}
                      rubric={buildExamRubric(examData.questions, examAnswers)}
                      suggestions={[]}
                      transcriptTitle="Chi Tiết Từng Câu"
                      transcriptBody=""
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {pageMode === "HISTORY" && !viewingExamHistoryItem && (
        <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-3">
          <h2 className="ui-section-title mb-2">Lịch Sử Luyện Nghe</h2>
          {examHistory.length === 0 ? (
            <div className="ui-card p-8 text-center">
              <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử luyện nghe" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-4" />
              <p className="text-muted text-sm">Bạn chưa làm đề luyện nghe nào. Đề sau khi nộp sẽ tự động lưu tại đây.</p>
            </div>
          ) : (
            <>
              {examHistoryPagination.pageItems.map((h) => {
                const qs: ReadingQuestion[] = JSON.parse(h.questions);
                const ans: Record<number, number | string> = JSON.parse(h.answers);
                const correct = qs.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, ans[i]) ? 1 : 0), 0);
                return (
                  <button
                    key={h.id}
                    onClick={() => setViewingExamHistoryItem(h)}
                    className="ui-card ui-card-hover w-full text-left p-3 sm:p-4 flex items-center justify-between gap-4"
                  >
                    <img src="/images/thumbs/listening.svg" alt="" aria-hidden width={640} height={360} loading="lazy" className="hidden sm:block w-28 h-auto rounded-xl shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-primary line-clamp-1">{h.title}</p>
                      <p className="text-xs text-muted mt-1">{formatPracticedAt(h.practicedAt)} · {h.level} · {h.purpose === "IELTS" ? "IELTS" : "Giao tiếp"}</p>
                    </div>
                    <span className="ui-badge px-3 py-1 shrink-0">{correct}/{qs.length}</span>
                  </button>
                );
              })}
              <Pagination page={examHistoryPagination.page} totalPages={examHistoryPagination.totalPages} totalItems={examHistoryPagination.totalItems} pageSize={10} onPageChange={examHistoryPagination.setPage} />
            </>
          )}
        </div>
      )}

      {pageMode === "HISTORY" && viewingExamHistoryItem && (() => {
        const qs: ReadingQuestion[] = JSON.parse(viewingExamHistoryItem.questions);
        const ans: Record<number, number | string> = JSON.parse(viewingExamHistoryItem.answers);
        const correct = qs.reduce((s, q, i) => s + (isReadingAnswerCorrect(q, ans[i]) ? 1 : 0), 0);
        return (
          <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-4">
            <button onClick={() => setViewingExamHistoryItem(null)} className="btn-ghost px-3 py-2 text-sm">← Quay lại danh sách</button>
            <h2 className="ui-section-title">{viewingExamHistoryItem.title}</h2>
            <div className="ui-card p-5 flex items-center justify-between flex-wrap gap-3">
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả bài làm" width={800} height={600} loading="lazy" className="hidden sm:block w-24 h-auto shrink-0" />
              <div className="flex-1 min-w-[180px]">
                <p className="text-xl font-extrabold text-primary">Kết quả: {correct}/{qs.length} câu đúng</p>
                <p className="text-xs text-muted mt-1">{formatPracticedAt(viewingExamHistoryItem.practicedAt)}</p>
              </div>
              <button
                onClick={() => downloadExamPdf(examHistoryPdfRef.current)}
                disabled={exportingPdf}
                className="btn-outline px-4 py-2 text-xs"
              >
                {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
              </button>
            </div>
            <div className="space-y-3">
              {qs.map((q, i) => (
                <div key={i} className="bg-surface border border-line rounded-xl p-4">
                  <p className="text-sm font-semibold text-foreground">{i + 1}. {q.question}</p>
                  <p className="text-xs text-muted mt-2">{isReadingAnswerCorrect(q, ans[i]) ? "✅ Đúng" : "❌ Sai"} — {q.explanation}</p>
                </div>
              ))}
            </div>

            <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
              <SkillReportPDF
                ref={examHistoryPdfRef}
                skillLabel="Luyện Nghe (Listening)"
                skillIcon="🎧"
                studentName={userName}
                practicedAt={viewingExamHistoryItem.practicedAt}
                level={viewingExamHistoryItem.level}
                purpose={viewingExamHistoryItem.purpose}
                score={(correct / qs.length) * 10}
                contextTitle={viewingExamHistoryItem.title}
                overallComment={`Học viên trả lời đúng ${correct}/${qs.length} câu hỏi luyện nghe.`}
                rubric={buildExamRubric(qs, ans)}
                suggestions={[]}
                transcriptTitle="Chi Tiết Từng Câu"
                transcriptBody=""
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
