"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionUserId } from "@/lib/session";
import DOMPurify from 'dompurify';
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from 'sweetalert2';
import HighlightableHtml, { type StoredHighlight } from "@/components/highlight/HighlightableHtml";

// Mỗi khối đề bài (heading / content của 1 câu) — chụp highlight đã lưu 1 lần lúc mount để
// HighlightableHtml không vẽ lại DOM (mất vùng đang bôi đen) mỗi khi đồng hồ re-render.
function ExamHighlightBlock({ blockKey, html, store, onSave, className }: {
  blockKey: string; html: string; className?: string;
  store: React.MutableRefObject<Record<string, StoredHighlight[]>>;
  onSave: (blockKey: string, list: StoredHighlight[]) => void;
}) {
  const [initial] = useState(() => store.current[blockKey] || []);
  return <HighlightableHtml html={html} initialHighlights={initial} onChange={(list) => onSave(blockKey, list)} className={className} />;
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gradingDetails, setGradingDetails] = useState<any[]>([]);

  // Exam state
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isTabFocused, setIsTabFocused] = useState(true);
  
  const [cheatCount, setCheatCount] = useState(0);
  const [cheatLogs, setCheatLogs] = useState<{time: number}[]>([]);
  const lastCheatTimeRef = useRef(0);
  const handleSubmitRef = useRef<any>(null);

  // ── Highlight đề bài + ghi chú (dùng chung HighlightableHtml với IELTS Reading) ──
  // Bôi đen → chuột phải (điện thoại: ấn giữ) → chọn màu / ghi chú; chuột phải vào highlight → đổi màu,
  // sửa ghi chú, xoá. Không tính điểm. Lưu theo từng khối đề bài vào localStorage của máy này
  // (key lucy_exam_hl_<examId>_<userId>) nên chuyển câu / tải lại trang / chế độ xem lại vẫn còn.
  const hlStoreRef = useRef<Record<string, StoredHighlight[]>>({});
  const hlStoreKey = userId ? `lucy_exam_hl_${examId}_${userId}` : null;
  const [hlLoaded, setHlLoaded] = useState(false);

  useEffect(() => {
    if (!hlStoreKey) return;
    try { hlStoreRef.current = JSON.parse(localStorage.getItem(hlStoreKey) || '{}') || {}; } catch { hlStoreRef.current = {}; }
    setHlLoaded(true);
  }, [hlStoreKey]);

  const saveBlockHighlights = useCallback((blockKey: string, list: StoredHighlight[]) => {
    const next = { ...hlStoreRef.current };
    if (list.length) next[blockKey] = list; else delete next[blockKey];
    hlStoreRef.current = next;
    if (hlStoreKey) { try { localStorage.setItem(hlStoreKey, JSON.stringify(next)); } catch {} }
  }, [hlStoreKey]);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const storedUserId = getSessionUserId();
        let currentUserId = null;
        if (storedUserId) {
          currentUserId = storedUserId;
          setUserId(storedUserId);
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/${examId}${currentUserId ? `?userId=${currentUserId}` : ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi khi tải đề thi');
        
        if (data.canAttempt === false) {
           setError(`Bạn đã hết lượt làm bài (Đã làm ${data.attemptsCount}/${data.maxAttempts} lần)`);
           setLoading(false);
           return;
        }

        setExam(data);
        setTimeLeft(data.duration * 60 || 2700);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (examId) fetchExam();
  }, [examId]);

  const handleSubmit = useCallback(async (isAutoSubmit = false, forceCheatLogs: any[] | null = null) => {
    if (submitting || submitted) return;
    setSubmitting(true);

    const storedUserId = getSessionUserId();
    if (!storedUserId && !isAutoSubmit) {
      await Swal.fire({
        title: 'Bạn chưa đăng nhập',
        text: 'Bạn phải đăng nhập để lưu kết quả và nhận XP. Vui lòng đăng nhập lại.',
        icon: 'warning',
        confirmButtonText: 'Đăng nhập'
      });
      setSubmitting(false);
      router.push('/auth');
      return;
    }

    const actualUserId = storedUserId || userId;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: actualUserId,
          examId,
          selectedAnswers: { ...answers, ...essayAnswers },
          timeSpent: (exam?.duration * 60 || 2700) - timeLeft,
          cheatLogs: forceCheatLogs || cheatLogs
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi khi nộp bài');
      }
      setResult(data);
      if (data.userId) {
        setUserId(data.userId);
      }
      const refreshUserId = data.userId || actualUserId;
      // Refresh attempt counters in the background — the result screen only needs `data`, so
      // don't hold it back behind another full round trip.
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/${examId}?userId=${refreshUserId}`)
        .then(async refreshRes => {
          const refreshed = await refreshRes.json();
          if (refreshRes.ok) setExam(refreshed);
        })
        .catch(e => console.warn('Failed to refresh exam after submit', e));

      if (data.result?.gradingDetails) {
        try {
          setGradingDetails(JSON.parse(data.result.gradingDetails));
        } catch(e) {}
      }
      setSubmitted(true);
      if (isAutoSubmit) {
        Swal.fire({ title: 'Đã thu bài', text: 'Bài thi của bạn đã bị thu tự động do vi phạm quy chế quá 2 lần!', icon: 'error' });
      }
    } catch (err: any) {
      console.error(err);
      Swal.fire('Lỗi', err.message || 'Lỗi khi nộp bài', 'error');
    }
    setSubmitting(false);
  }, [submitting, submitted, userId, examId, answers, essayAnswers, exam, timeLeft, cheatLogs]);

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Anti-cheat measures
  useEffect(() => {
    if (submitted || isReviewMode || loading) return;

    const registerCheat = () => {
      const now = Date.now();
      if (now - lastCheatTimeRef.current < 2000) return; // Debounce 2s
      lastCheatTimeRef.current = now;
      
      const storedUserId = getSessionUserId();
      if (!storedUserId) {
        console.warn('Cheat event ignored because user is not authenticated');
        return;
      }

      setCheatCount(c => {
        const newCount = c + 1;
        setCheatLogs(prev => {
          const newLogs = [...prev, { time: now }];
          
          // Send live cheat log to backend
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/cheat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: storedUserId,
              examId,
              cheatCount: newCount,
              isAutoSubmitted: newCount >= 3
            })
          }).catch(console.error);

          if (newCount >= 3) {
            setTimeout(() => {
              if (handleSubmitRef.current) handleSubmitRef.current(true, newLogs);
            }, 100);
          }
          return newLogs;
        });
        return newCount;
      });
      setIsTabFocused(false);
    };

    const preventCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      registerCheat();
      Swal.fire({ title: 'Cảnh báo', text: 'Không được phép sao chép/dán trong lúc làm bài!', icon: 'warning', timer: 2000, toast: true, position: 'top-end' });
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventShortcuts = (e: KeyboardEvent) => {
      const isCopyPaste = (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.key === 'v' || e.key === 'V' || e.key === 'x' || e.key === 'X'));
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        isCopyPaste ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        if (isCopyPaste) registerCheat();
        else Swal.fire({ title: 'Cảnh báo', text: 'Thao tác này bị cấm trong lúc làm bài!', icon: 'warning', timer: 2000, toast: true, position: 'top-end' });
      }
    };

    const handleBlur = () => registerCheat();
    const handleVisibility = () => { if (document.hidden) registerCheat(); };

    document.addEventListener('copy', preventCopyPaste);
    document.addEventListener('cut', preventCopyPaste);
    document.addEventListener('paste', preventCopyPaste);
    document.addEventListener('contextmenu', preventContextMenu);
    document.addEventListener('keydown', preventShortcuts);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('copy', preventCopyPaste);
      document.removeEventListener('cut', preventCopyPaste);
      document.removeEventListener('paste', preventCopyPaste);
      document.removeEventListener('contextmenu', preventContextMenu);
      document.removeEventListener('keydown', preventShortcuts);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [submitted, isReviewMode, loading]);

  // Countdown timer
  useEffect(() => {
    if (!exam || submitted || loading) return;
    if (timeLeft <= 0) { handleSubmit(); return; }
    const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
    return () => clearInterval(timer);
  }, [exam, submitted, loading, timeLeft, handleSubmit]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Result Screen Confetti Effect
  useEffect(() => {
    if (submitted && result && !isReviewMode) {
      const score = result.result?.score ?? 0;
      if (score >= 8) {
        import("canvas-confetti").then(({ default: confetti }) => confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
        })).catch(() => {});
      }
    }
  }, [submitted, result, isReviewMode]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted font-medium">Đang tải đề thi...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-red-600 text-xl font-bold">{error}</p>
        <Link href="/dashboard" className="btn-outline">← Về trang học viên</Link>
      </div>
    </div>
  );

  if (!isTabFocused && !submitted && !isReviewMode && !loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/95 p-6 z-[9999] fixed inset-0">
        <div className="text-center space-y-6 max-w-lg w-full bg-slate-900 p-6 sm:p-10 rounded-2xl border border-rose-500/40 shadow-2xl">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto text-4xl mb-2 animate-pulse">⚠️</div>
          <h2 className="text-rose-500 text-2xl font-black uppercase tracking-widest">Cảnh báo gian lận ({cheatCount}/2)</h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Hệ thống phát hiện bạn vừa rời khỏi màn hình bài thi (có thể là chuyển ứng dụng hoặc chụp ảnh màn hình).
          </p>
          <p className="text-rose-400 font-bold">Nếu vi phạm lần thứ 3, bài thi sẽ bị tự động thu lại ngay lập tức!</p>
          <button onClick={() => setIsTabFocused(true)} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-full transition-all">
            Tôi hiểu, Quay lại bài thi
          </button>
        </div>
      </div>
    );
  }

  if (submitted && result && !isReviewMode) {
    const score = result.result?.score ?? 0;
    const percent = Math.round((score / 10) * 100);
    const isPassed = score >= 5;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background">
        <div className="w-full max-w-2xl ui-card overflow-hidden text-center">
          <div className="ui-hero rounded-none px-6 pt-10 pb-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 min-w-0">
          <div className={`w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-5xl font-black border-8 bg-white ${isPassed ? 'border-white/40 text-primary' : 'border-rose-300 text-rose-600'}`}>
            {score.toFixed(1)}
          </div>
          <h1 className="text-3xl font-black mb-2 text-white">{isPassed ? 'Xuất sắc!' : 'Cố lên!'}</h1>
          <p className="text-white/80">Bạn đạt <strong className="text-white">{percent}%</strong> số câu đúng trong bài thi này</p>
          </div>
          <div className="w-full max-w-[220px] shrink-0">
            <img src="/images/photos/app/illus/exam-result.webp" alt="Minh hoạ kết quả bài thi" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
          </div>
          </div>
          <div className="p-6 sm:p-8">

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-primary-soft rounded-xl p-4">
              <p className="text-sm text-muted">Điểm số</p>
              <p className="text-2xl font-black text-primary">{score.toFixed(1)}/10</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-sm text-muted">XP nhận được</p>
              <p className="text-2xl font-black text-amber-600">+{result.earnedXP} XP</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => setIsReviewMode(true)} className="btn-outline flex-1 py-3.5">
              Xem Lại Bài Làm
            </button>
            <Link href="/dashboard" className="btn-primary flex-1 py-3.5 text-center">
              Về Trang Học Viên
            </Link>
          </div>
          </div>
        </div>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const totalQ = questions.length;

  if (totalQ === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4 px-4">
        <img src="/images/photos/app/illus/empty-state.webp" alt="Đề thi chưa có câu hỏi" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto" />
        <p className="text-2xl font-bold text-primary">Đề thi chưa có câu hỏi</p>
        <p className="text-muted">Giáo viên chưa nhập nội dung câu hỏi cho bài thi này.</p>
        <Link href="/dashboard" className="btn-outline">← Quay lại</Link>
      </div>
    </div>
  );

  const q = questions[currentQ];
  const question = q?.question;
  const isEssay = question?.type === 'ESSAY';
  const opts: string[] = (() => {
    try {
      const parsed = JSON.parse(question?.options || '[]');
      return parsed.map((o: string) => String(o).replace(/\s+/g, ' ').trim());
    } catch { return []; }
  })();
  const answered = Object.keys(answers).length + Object.keys(essayAnswers).filter(k => essayAnswers[k]?.trim()).length;
  const isTimeWarning = timeLeft < 300;

  return (
    <div className={`min-h-screen bg-background flex flex-col ${!isReviewMode && !submitted ? 'select-none' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface border-b border-line px-4 md:px-8 py-2.5 md:py-3 flex flex-wrap items-center justify-between shadow-[0_2px_10px_rgba(30,58,138,0.06)] gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/dashboard" className="w-10 h-10 rounded-full border border-line-strong text-primary flex items-center justify-center hover:bg-primary-soft hover:border-primary transition-colors">
            ←
          </Link>
          <div>
            <h1 className="font-bold text-base md:text-lg text-primary leading-tight">{exam?.title}</h1>
            <p className="text-xs md:text-sm text-muted">{isReviewMode ? 'Chế độ xem lại' : 'Đang làm bài'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {isReviewMode ? (
            <button onClick={() => setIsReviewMode(false)} className="w-full sm:w-auto px-5 py-2 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-full hover:bg-amber-100 transition-colors cursor-pointer text-sm md:text-base">
              ← Thoát Xem Lại
            </button>
          ) : (
            <>
              <div className={`font-mono text-base md:text-lg font-black px-4 py-1.5 md:px-5 md:py-2 rounded-full ${isTimeWarning ? 'bg-red-50 text-red-600 ring-1 ring-red-200 animate-pulse' : 'bg-primary text-white shadow-[0_4px_12px_rgba(30,58,138,0.25)]'}`}>
                ⏱ {formatTime(timeLeft)}
              </div>
              <button
                onClick={() => {
                  Swal.fire({
                    title: 'Xác nhận nộp bài',
                    text: 'Bạn có chắc muốn nộp bài không?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Nộp bài',
                    cancelButtonText: 'Kiểm tra lại'
                  }).then((result) => {
                    if (result.isConfirmed) handleSubmit();
                  });
                }}
                disabled={submitting}
                className="btn-primary px-5 py-2 cursor-pointer"
              >
                {submitting ? 'Đang chấm điểm bằng AI...' : 'Nộp Bài'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 gap-6">
        {/* Question Panel */}
        <main className="flex-1 w-full">
          <div className="ui-card p-5 md:p-8 h-full">
            <div className="flex items-center justify-between gap-3 mb-3">
              <p className="ui-badge text-sm">Câu {currentQ + 1}/{totalQ}</p>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-primary-soft h-1.5 rounded-full mb-8">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{width: `${((currentQ+1)/totalQ)*100}%`}}></div>
            </div>

            <p className="text-xs text-muted mb-2">Bôi đen đề bài rồi bấm chuột phải (hoặc ấn giữ trên điện thoại) để chọn màu highlight hoặc thêm ghi chú riêng cho đoạn đó</p>
            <div className="select-text">
              {question?.heading && hlLoaded && (
                <ExamHighlightBlock
                  key={`${question.id}-heading`}
                  blockKey={`${question.id}:heading`}
                  html={question.heading}
                  store={hlStoreRef}
                  onSave={saveBlockHighlights}
                  className="mb-6 p-4 bg-primary-soft border-l-4 border-primary rounded-xl text-primary font-bold whitespace-pre-wrap leading-relaxed break-words quill-content [&>p]:m-0"
                />
              )}

              {question?.imageUrl && (
                <div className="mb-6">
                  <img src={question.imageUrl} alt="Question" className="max-h-64 max-w-full object-contain rounded-xl border border-line" />
                </div>
              )}

              <div className="text-xl leading-relaxed mb-8 break-words min-w-0 text-foreground">
                {question?.content ? (
                  hlLoaded && (
                    <ExamHighlightBlock
                      key={`${question.id}-content`}
                      blockKey={`${question.id}:content`}
                      html={question.content}
                      store={hlStoreRef}
                      onSave={saveBlockHighlights}
                      className="quill-content"
                    />
                  )
                ) : (
                  <div className="text-muted italic text-base">Nội dung trống</div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {isEssay ? (
                <div>
                  <p className="text-sm text-muted mb-3 flex items-center gap-2">
                    <span className="ui-badge">Tự luận</span>
                    Nhập câu trả lời của bạn
                  </p>
                  <textarea
                    rows={8}
                    className="ui-input p-4 resize-none text-base leading-relaxed"
                    placeholder="Viết câu trả lời của bạn tại đây..."
                    value={essayAnswers[question?.id] || ''}
                    onChange={e => setEssayAnswers({ ...essayAnswers, [question.id]: e.target.value })}
                    readOnly={isReviewMode}
                  />
                </div>
              ) : (
                opts.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = answers[question?.id] === letter;
                  const isCorrectOpt = isReviewMode && question?.correctOption === letter;
                  const isWrongOpt = isReviewMode && isSelected && question?.correctOption !== letter;

                  let borderClass = isSelected ? 'border-primary bg-primary-soft text-primary font-bold' : 'border-line-strong bg-surface hover:border-primary hover:bg-primary-soft';
                  let iconClass = isSelected ? 'bg-primary text-white' : 'bg-white border border-line-strong text-muted';
                  let iconText = letter;

                  if (isReviewMode) {
                    if (isCorrectOpt) {
                      borderClass = 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold';
                      iconClass = 'bg-emerald-500 text-white';
                      iconText = '✓';
                    } else if (isWrongOpt) {
                      borderClass = 'border-red-400 bg-red-50 text-red-700 font-bold';
                      iconClass = 'bg-red-500 text-white';
                      iconText = '✗';
                    } else {
                      borderClass = 'border-line bg-surface opacity-60';
                      iconClass = 'bg-white border border-line-strong text-muted';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !isReviewMode && setAnswers({ ...answers, [question.id]: letter })}
                      className={`w-full text-left p-4 rounded-xl border transition-all cursor-[inherit] font-medium flex items-start ${borderClass}`}
                      disabled={isReviewMode}
                    >
                      <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center font-bold text-sm mr-3 shrink-0 ${iconClass}`}>
                        {iconText}
                      </span>
                      <div className="flex-1 min-w-0 break-words quill-content [&>p]:m-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(opt) }}></div>
                    </button>
                  );
                })
              )}
            </div>

            {isReviewMode && question?.explanation && (
              <div className="mt-6 p-5 bg-primary-soft border border-primary/15 rounded-xl animate-fade-in">
                <p className="font-bold text-primary mb-2">Giải thích / Hướng dẫn</p>
                <div className="text-foreground leading-relaxed text-sm whitespace-pre-wrap quill-content" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(question.explanation)}}></div>
              </div>
            )}
            
            {isReviewMode && isEssay && (
              <div className="mt-6 p-5 bg-surface border border-line rounded-xl animate-fade-in">
                <p className="font-bold text-primary mb-2">Kết quả chấm điểm</p>
                {gradingDetails.find(g => g.questionId === question?.id) ? (
                  <div className="space-y-3">
                    {gradingDetails.find(g => g.questionId === question?.id)?.pointsEarned !== null && (
                      <p className="text-sm font-bold text-primary">
                        Điểm: {gradingDetails.find(g => g.questionId === question?.id)?.pointsEarned?.toFixed(1)} / {gradingDetails.find(g => g.questionId === question?.id)?.maxPoints}
                      </p>
                    )}
                    <div className="text-foreground leading-relaxed text-sm whitespace-pre-wrap">
                      {gradingDetails.find(g => g.questionId === question?.id)?.feedback}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted italic text-sm">Không có dữ liệu chấm điểm cho câu này.</p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 pt-6 border-t border-line flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="btn-outline w-full sm:w-auto px-6 py-3"
              >
                ← Câu trước
              </button>
              <button
                onClick={() => setCurrentQ(Math.min(totalQ - 1, currentQ + 1))}
                disabled={currentQ === totalQ - 1}
                className="btn-primary w-full sm:w-auto px-6 py-3"
              >
                Câu tiếp →
              </button>
            </div>
          </div>
        </main>

        {/* Navigator Panel */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="ui-card p-5 lg:sticky lg:top-24">
            <h3 className="font-bold mb-4 text-sm text-primary uppercase tracking-wide">Bảng câu hỏi</h3>
            <div className="flex flex-wrap gap-2">
              {questions.map((_: any, i: number) => {
                const qObj = questions[i]?.question;
                const qId = qObj?.id;
                const isDone = !!answers[qId] || !!essayAnswers[qId];
                const isCurrent = i === currentQ;
                
                let btnClass = isCurrent ? (isDone ? 'bg-primary text-white border border-primary ring-2 ring-primary/40 ring-offset-2' : 'bg-white text-primary border border-primary ring-2 ring-primary/40 ring-offset-2') :
                               isDone ? 'bg-primary text-white border border-primary' :
                               'bg-white text-foreground border border-line-strong hover:border-primary hover:text-primary';

                if (isReviewMode && qObj?.type === 'MULTIPLE_CHOICE') {
                  const isCorrect = answers[qId] === qObj?.correctOption;
                  if (isCurrent) {
                    btnClass = isCorrect ? 'bg-emerald-500 text-white border border-emerald-500 ring-2 ring-emerald-300 ring-offset-2' : 'bg-red-500 text-white border border-red-500 ring-2 ring-red-300 ring-offset-2';
                  } else {
                    btnClass = isCorrect ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-red-50 text-red-700 border border-red-300';
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`w-10 h-10 rounded-lg text-sm font-bold transition-all cursor-pointer ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-line space-y-2 text-sm text-muted">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary"></div>
                    <span>Đã trả lời ({answered})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-white border border-line-strong"></div>
                    <span>Chưa trả lời ({totalQ - answered})</span>
                  </div>
            </div>

            {exam.notes && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-bold text-amber-700">📌 Ghi chú</p>
                <p className="text-xs text-amber-700 mt-1">{exam.notes}</p>
              </div>
            )}
          </div>
        </aside>
      </div>

    </div>
  );
}
