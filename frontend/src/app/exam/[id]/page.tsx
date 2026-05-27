"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = params.id as string;

  const [exam, setExam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

  useEffect(() => {
    const uid = localStorage.getItem('userId');
    setUserId(uid);
    const url = `${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/exams/${examId}${uid ? `?userId=${uid}` : ''}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        if (data.canAttempt === false) { setError("Bạn đã hết lượt làm bài thi này!"); setLoading(false); return; }
        setExam(data);
        setTimeLeft((data.duration || 45) * 60);
        setLoading(false);
      })
      .catch(() => { setError("Không thể tải đề thi"); setLoading(false); });
  }, [examId]);

  const handleSubmit = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || 'anonymous',
          examId,
          selectedAnswers: answers,
          essayAnswers,
          timeSpent: (exam?.duration * 60 || 2700) - timeLeft
        })
      });
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      alert("Lỗi khi nộp bài");
    }
    setSubmitting(false);
  }, [submitting, submitted, userId, examId, answers, exam, timeLeft]);

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
    <div className="min-h-screen bg-background flex flex-col">
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
                onClick={() => { if (confirm('Bạn có chắc muốn nộp bài không?')) handleSubmit(); }}
                disabled={submitting}
                className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Đang nộp...' : 'Nộp Bài'}
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
              <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-700/90 font-medium whitespace-pre-wrap leading-relaxed">
                {question.heading}
              </div>
            )}
            
            {question?.imageUrl && (
              <div className="mb-6">
                <img src={question.imageUrl} alt="Question" className="max-h-64 rounded-xl border border-foreground/10" />
              </div>
            )}

            <p className="text-xl font-semibold leading-relaxed mb-8">
              {question?.content ? (
                <span dangerouslySetInnerHTML={{__html: question.content.replace(/\n/g, '<br/>')}}></span>
              ) : (
                <span className="text-foreground/40 italic text-base">Nội dung trống</span>
              )}
            </p>

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
                      className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-[inherit] font-medium ${borderClass}`}
                      disabled={isReviewMode}
                    >
                      <span className={`inline-flex w-8 h-8 rounded-full items-center justify-center font-bold text-sm mr-3 ${iconClass}`}>
                        {iconText}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: opt }}></span>
                    </button>
                  );
                })
              )}
            </div>

            {isReviewMode && question?.explanation && (
              <div className="mt-6 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-fade-in">
                <p className="font-bold text-blue-700 mb-2 flex items-center gap-2">💡 Giải thích / Hướng dẫn</p>
                <div className="text-blue-900/80 leading-relaxed text-sm whitespace-pre-wrap">{question.explanation}</div>
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
