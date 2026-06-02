"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from 'dompurify';
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import Swal from 'sweetalert2';

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

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const u = localStorage.getItem('user');
        let currentUserId = null;
        if (u) {
          const parsed = JSON.parse(u);
          currentUserId = parsed.id;
          setUserId(parsed.id);
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
    // If user is not logged in, prompt to login or continue as guest
    if (!userId && !isAutoSubmit) {
      const resp = await Swal.fire({
        title: 'Bạn chưa đăng nhập',
        text: 'Bạn cần đăng nhập để lưu kết quả và nhận XP. Đăng nhập ngay?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đăng nhập',
        cancelButtonText: 'Nộp tạm (không lưu tài khoản)'
      });
      if (resp.isConfirmed) {
        setSubmitting(false);
        router.push('/auth');
        return;
      }
      // else proceed as guest (backend will handle guest fallback)
    }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'anonymous',
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
        // store returned userId (guest/fallback) so further requests use the same id
        setUserId(data.userId);
        try { localStorage.setItem('user', JSON.stringify({ id: data.userId })); } catch(e) {}
        // refresh exam info (attempts count / canAttempt)
        try {
          const refreshRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/${examId}?userId=${data.userId}`);
          const refreshed = await refreshRes.json();
          if (refreshRes.ok) setExam(refreshed);
        } catch (e) {
          console.warn('Failed to refresh exam after submit', e);
        }
      }

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

    const preventCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      Swal.fire({ title: 'Cảnh báo', text: 'Không được phép sao chép/dán trong lúc làm bài!', icon: 'warning', timer: 2000, toast: true, position: 'top-end' });
    };

    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const preventShortcuts = (e: KeyboardEvent) => {
      // Prevent F12, Ctrl+Shift+I, Ctrl+C, Ctrl+V, PrintScreen, Ctrl+P, Ctrl+S
      if (
        e.key === 'F12' ||
        e.key === 'PrintScreen' ||
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && (e.key === 'c' || e.key === 'C')) ||
        (e.ctrlKey && (e.key === 'v' || e.key === 'V')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
        (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S'))
      ) {
        e.preventDefault();
        Swal.fire({ title: 'Cảnh báo', text: 'Thao tác này bị cấm trong lúc làm bài!', icon: 'warning', timer: 2000, toast: true, position: 'top-end' });
      }
    };

    const registerCheat = () => {
      const now = Date.now();
      if (now - lastCheatTimeRef.current < 2000) return; // Debounce 2s
      lastCheatTimeRef.current = now;
      
      setCheatCount(c => {
        const newCount = c + 1;
        setCheatLogs(prev => {
          const newLogs = [...prev, { time: now }];
          
          // Send live cheat log to backend
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/cheat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: userId || 'anonymous',
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
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6']
        });
      }
    }
  }, [submitted, result, isReviewMode]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-foreground/60 font-medium">Đang tải đề thi...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-rose-500 text-xl font-bold">⚠️ {error}</p>
        <Link href="/dashboard" className="text-primary underline">← Về trang học sinh</Link>
      </div>
    </div>
  );

  if (!isTabFocused && !submitted && !isReviewMode && !loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/95 p-6 z-[9999] fixed inset-0">
        <div className="text-center space-y-6 max-w-lg w-full bg-surface/10 p-10 rounded-3xl border border-rose-500/30 backdrop-blur-md">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto text-4xl mb-2 animate-pulse">⚠️</div>
          <h2 className="text-rose-500 text-2xl font-black uppercase tracking-widest">Cảnh báo gian lận ({cheatCount}/2)</h2>
          <p className="text-white/80 text-lg leading-relaxed">
            Hệ thống phát hiện bạn vừa rời khỏi màn hình bài thi (có thể là chuyển ứng dụng hoặc chụp ảnh màn hình).
          </p>
          <p className="text-rose-400 font-bold">Nếu vi phạm lần thứ 3, bài thi sẽ bị tự động thu lại ngay lập tức!</p>
          <button onClick={() => setIsTabFocused(true)} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(225,29,72,0.4)]">
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
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-background to-surface">
        <div className="w-full max-w-lg bg-surface border border-foreground/10 rounded-3xl p-10 text-center shadow-2xl">
          <div className={`w-28 h-28 rounded-full mx-auto mb-6 flex items-center justify-center text-5xl font-black border-8 ${isPassed ? 'border-primary text-primary bg-primary/10' : 'border-rose-500 text-rose-500 bg-rose-500/10'}`}>
            {score.toFixed(1)}
          </div>
          <h1 className="text-3xl font-black mb-2">{isPassed ? '🎉 Xuất sắc!' : '😅 Cố lên!'}</h1>
          <p className="text-foreground/60 mb-6">Bạn đạt <strong className="text-foreground">{percent}%</strong> số câu đúng trong bài thi này</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-foreground/5 rounded-2xl p-4">
              <p className="text-sm text-foreground/50">Điểm số</p>
              <p className="text-2xl font-black text-primary">{score.toFixed(1)}/10</p>
            </div>
            <div className="bg-foreground/5 rounded-2xl p-4">
              <p className="text-sm text-foreground/50">XP nhận được</p>
              <p className="text-2xl font-black text-amber-500">+{result.earnedXP} XP</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button onClick={() => setIsReviewMode(true)} className="flex-1 py-4 bg-foreground/10 text-foreground font-bold rounded-2xl hover:bg-foreground/20 transition-colors">
              👀 Xem Lại Bài Làm
            </button>
            <Link href="/dashboard" className="flex-1 py-4 bg-primary text-white font-bold rounded-2xl hover:bg-primary/90 transition-colors text-center">
              Về Trang Học Sinh
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const totalQ = questions.length;

  if (totalQ === 0) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-2xl font-bold">📄 Đề thi chưa có câu hỏi</p>
        <p className="text-foreground/50">Giáo viên chưa nhập nội dung câu hỏi cho bài thi này.</p>
        <Link href="/dashboard" className="text-primary underline">← Quay lại</Link>
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
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-foreground/10 px-4 md:px-8 py-3 md:py-4 flex flex-wrap items-center justify-between shadow-sm gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <Link href="/dashboard" className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            ←
          </Link>
          <div>
            <h1 className="font-bold text-lg md:text-xl">{exam?.title}</h1>
            <p className="text-xs md:text-sm text-foreground/50">{isReviewMode ? 'Chế độ xem lại' : 'Đang làm bài'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-4 w-full sm:w-auto justify-between sm:justify-end">
          {isReviewMode ? (
            <button onClick={() => setIsReviewMode(false)} className="w-full sm:w-auto px-5 py-2 bg-amber-500/10 text-amber-600 font-bold rounded-xl hover:bg-amber-500/20 transition-colors cursor-pointer text-sm md:text-base">
              ← Thoát Xem Lại
            </button>
          ) : (
            <>
              <div className={`font-mono text-lg md:text-xl font-black px-3 py-1.5 md:px-4 md:py-2 rounded-xl ${isTimeWarning ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'bg-foreground/10 text-foreground'}`}>
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
                className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
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
          <div className="bg-surface border border-foreground/10 rounded-3xl p-6 md:p-8 h-full">
            <p className="text-sm text-foreground/50 font-bold mb-3">Câu {currentQ + 1}/{totalQ}</p>
            {/* Progress bar */}
            <div className="w-full bg-foreground/10 h-1.5 rounded-full mb-8">
              <div className="bg-primary h-1.5 rounded-full transition-all" style={{width: `${((currentQ+1)/totalQ)*100}%`}}></div>
            </div>

            {question?.heading && (
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700/90 font-bold whitespace-pre-wrap leading-relaxed break-words quill-content [&>p]:m-0" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(question.heading) }}>
              </div>
            )}
            
            {question?.imageUrl && (
              <div className="mb-6">
                <img src={question.imageUrl} alt="Question" className="max-h-64 rounded-xl border border-foreground/10" />
              </div>
            )}

            <div className="text-xl leading-relaxed mb-8 break-words min-w-0">
              {question?.content ? (
                <div className="quill-content" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(question.content)}}></div>
              ) : (
                <div className="text-foreground/40 italic text-base">Nội dung trống</div>
              )}
            </div>

            <div className="space-y-3">
              {isEssay ? (
                <div>
                  <p className="text-sm text-foreground/50 mb-3 flex items-center gap-2">
                    <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-xs font-bold">✍️ Tự luận</span>
                    Nhập câu trả lời của bạn
                  </p>
                  <textarea
                    rows={8}
                    className="w-full p-4 rounded-2xl border-2 border-foreground/15 bg-transparent resize-none focus:border-secondary outline-none transition-colors text-base leading-relaxed"
                    placeholder="Viết câu trả lời của bạn tại đây..."
                    value={(essayAnswers[question?.id] || '').toLowerCase()}
                    onChange={e => setEssayAnswers({ ...essayAnswers, [question.id]: e.target.value.toLowerCase() })}
                    readOnly={isReviewMode}
                  />
                </div>
              ) : (
                opts.map((opt, idx) => {
                  const letter = String.fromCharCode(65 + idx);
                  const isSelected = answers[question?.id] === letter;
                  const isCorrectOpt = isReviewMode && question?.correctOption === letter;
                  const isWrongOpt = isReviewMode && isSelected && question?.correctOption !== letter;

                  let borderClass = isSelected ? 'border-primary bg-primary/10 text-primary font-bold' : 'border-foreground/10 hover:border-primary/40 hover:bg-primary/5';
                  let iconClass = isSelected ? 'bg-primary text-white' : 'bg-foreground/10';
                  let iconText = letter;

                  if (isReviewMode) {
                    if (isCorrectOpt) {
                      borderClass = 'border-green-500 bg-green-500/10 text-green-700 font-bold';
                      iconClass = 'bg-green-500 text-white';
                      iconText = '✓';
                    } else if (isWrongOpt) {
                      borderClass = 'border-rose-500 bg-rose-500/10 text-rose-700 font-bold';
                      iconClass = 'bg-rose-500 text-white';
                      iconText = '✗';
                    } else {
                      borderClass = 'border-foreground/10 opacity-50';
                      iconClass = 'bg-foreground/10';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => !isReviewMode && setAnswers({ ...answers, [question.id]: letter })}
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-[inherit] font-medium flex items-start ${borderClass}`}
                      disabled={isReviewMode}
                    >
                      <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center font-bold text-sm mr-3 shrink-0 ${iconClass}`}>
                        {iconText}
                      </span>
                      <div className="flex-1 min-w-0 break-words quill-content [&>p]:m-0" dangerouslySetInnerHTML={{ __html: opt }}></div>
                    </button>
                  );
                })
              )}
            </div>

            {isReviewMode && question?.explanation && (
              <div className="mt-6 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-fade-in">
                <p className="font-bold text-blue-700 mb-2 flex items-center gap-2">💡 Giải thích / Hướng dẫn</p>
                <div className="text-blue-900/80 leading-relaxed text-sm whitespace-pre-wrap quill-content" dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(question.explanation)}}></div>
              </div>
            )}
            
            {isReviewMode && isEssay && (
              <div className="mt-6 p-5 bg-purple-500/10 border border-purple-500/20 rounded-2xl animate-fade-in">
                <p className="font-bold text-purple-700 mb-2 flex items-center gap-2">📝 Kết quả chấm điểm</p>
                {gradingDetails.find(g => g.questionId === question?.id) ? (
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-purple-900/80">
                      Điểm: {gradingDetails.find(g => g.questionId === question?.id)?.pointsEarned?.toFixed(1)} / {gradingDetails.find(g => g.questionId === question?.id)?.maxPoints}
                    </p>
                    <div className="text-purple-900/80 leading-relaxed text-sm whitespace-pre-wrap">
                      {gradingDetails.find(g => g.questionId === question?.id)?.feedback}
                    </div>
                  </div>
                ) : (
                  <p className="text-purple-900/60 italic text-sm">Không có dữ liệu chấm điểm cho câu này.</p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                disabled={currentQ === 0}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold bg-foreground/5 hover:bg-foreground/10 disabled:opacity-30 transition-colors"
              >
                ← Câu trước
              </button>
              <button
                onClick={() => setCurrentQ(Math.min(totalQ - 1, currentQ + 1))}
                disabled={currentQ === totalQ - 1}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl font-bold bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30 transition-colors"
              >
                Câu tiếp →
              </button>
            </div>
          </div>
        </main>

        {/* Navigator Panel */}
        <aside className="w-full lg:w-64 shrink-0">
          <div className="bg-surface border border-foreground/10 rounded-3xl p-6 sticky top-24">
            <h3 className="font-bold mb-4 text-sm text-foreground/60 uppercase tracking-wide">Bảng câu hỏi</h3>
            <div className="flex flex-wrap gap-2">
              {questions.map((_: any, i: number) => {
                const qObj = questions[i]?.question;
                const qId = qObj?.id;
                const isDone = !!answers[qId] || !!essayAnswers[qId];
                const isCurrent = i === currentQ;
                
                let btnClass = isCurrent ? 'bg-primary text-white scale-110 shadow-lg' :
                               isDone ? 'bg-primary/20 text-primary' :
                               'bg-foreground/10 hover:bg-foreground/20';

                if (isReviewMode && qObj?.type === 'MULTIPLE_CHOICE') {
                  const isCorrect = answers[qId] === qObj?.correctOption;
                  if (isCurrent) {
                    btnClass = isCorrect ? 'bg-green-500 text-white scale-110 shadow-lg' : 'bg-rose-500 text-white scale-110 shadow-lg';
                  } else {
                    btnClass = isCorrect ? 'bg-green-500/20 text-green-700' : 'bg-rose-500/20 text-rose-700';
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentQ(i)}
                    className={`w-10 h-10 rounded-xl text-sm font-bold transition-all cursor-pointer ${btnClass}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-2 text-sm text-foreground/60">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-primary/20"></div>
                    <span>Đã trả lời ({answered})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-foreground/10"></div>
                    <span>Chưa trả lời ({totalQ - answered})</span>
                  </div>
            </div>

            {exam.notes && (
              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <p className="text-xs font-bold text-amber-600">📌 Ghi chú</p>
                <p className="text-xs text-amber-700 mt-1">{exam.notes}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
