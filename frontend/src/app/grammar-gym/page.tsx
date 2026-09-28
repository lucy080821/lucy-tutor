"use client";
import { useState, useEffect } from "react";
import { getSessionUserId } from "@/lib/session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from 'sweetalert2';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import { cleanString } from '@/lib/textGrading';

export default function GrammarGymPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STATS' | 'PRACTICE'>('STATS');
  
  // Data state
  const [notebooks, setNotebooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Practice state
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  
  // Building state
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [availableWords, setAvailableWords] = useState<string[]>([]);

  // Current Notebook ID for progress
  const [currentNotebookId, setCurrentNotebookId] = useState<string | null>(null);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) {
      router.push('/');
      return;
    }
    setUserId(uid);
    fetchNotebooks(uid);
  }, [router]);

  const fetchNotebooks = async (uid: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me?userId=${uid}`);
      if (res.ok) {
        const user = await res.json();
        // Fallback to all if category isn't properly seeded yet, but prioritize GRAMMAR
        let grammarNotebooks = user.notebooks?.filter((n: any) => n.category === 'GRAMMAR') || [];
        if (grammarNotebooks.length === 0 && user.notebooks?.length > 0) {
            grammarNotebooks = user.notebooks; // fallback for older data
        }
        setNotebooks(grammarNotebooks);
      }
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const setupQuestion = (q: any) => {
    setUserAnswer("");
    setShowExplanation(false);
    setIsCorrect(null);
    if (q.type === 'BUILDING' && q.scrambledWords) {
      setAvailableWords([...q.scrambledWords]);
      setSelectedWords([]);
    }
  };

  const startSession = async (notebook: any) => {
    setCurrentNotebookId(notebook.id);
    setGenerating(true);
    setActiveTab('PRACTICE');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/ai/generate-grammar-exercise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: notebook.topic })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.questions && data.questions.length > 0) {
          setQuestions(data.questions);
          setCurrentQIndex(0);
          setupQuestion(data.questions[0]);
        } else {
          Swal.fire('Lỗi', 'AI không tạo được bài tập. Vui lòng thử lại.', 'error');
          setActiveTab('STATS');
        }
      } else {
        Swal.fire('Lỗi', 'Không thể kết nối với AI (Quá tải)', 'error');
        setActiveTab('STATS');
      }
    } catch (err) {
      Swal.fire('Lỗi', 'Lỗi kết nối', 'error');
      setActiveTab('STATS');
    }
    setGenerating(false);
  };

  const checkAnswer = () => {
    const q = questions[currentQIndex];
    let finalUserAns = userAnswer;
    
    if (q.type === 'BUILDING') {
      finalUserAns = selectedWords.join(" ");
    }
    
    const correctAns = q.correctSentence || "";
    
    const isAnsCorrect = cleanString(finalUserAns) === cleanString(correctAns);
    setIsCorrect(isAnsCorrect);
    setShowExplanation(true);
    
    // Update progress in background
    if (currentNotebookId) {
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/analytics/notebook/${currentNotebookId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: isAnsCorrect ? 'CORRECT' : 'MISTAKE' })
        }).catch(console.error);
    }
  };

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(currentQIndex + 1);
      setupQuestion(questions[currentQIndex + 1]);
    } else {
      import("canvas-confetti").then(m => m.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } })).catch(() => {});
      Swal.fire('Tuyệt vời!', 'Bạn đã hoàn thành phiên tập luyện!', 'success').then(() => {
        setActiveTab('STATS');
        fetchNotebooks(userId!);
      });
    }
  };

  const renderRadarChart = () => {
    if (notebooks.length === 0) return null;
    const data = notebooks.slice(0, 6).map(n => ({
      subject: n.topic.substring(0, 15) + (n.topic.length > 15 ? '...' : ''),
      A: n.correctCount,
      B: n.mistakeCount,
      fullMark: Math.max(n.correctCount + n.mistakeCount, 10)
    }));

    return (
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#eaecef" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#5b6b82', fontSize: 12 }} />
          <PolarRadiusAxis />
          <Radar name="Đúng" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
          <Radar name="Sai" dataKey="B" stroke="#ef4444" fill="#ef4444" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-primary animate-pulse">Đang nạp dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Page banner (IOT style) */}
      <div className="w-full bg-surface border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 text-sm text-muted">
              <Link href="/dashboard" className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-line-strong text-muted hover:border-primary hover:text-primary hover:bg-primary-soft transition-colors" aria-label="Quay lại">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <span>Trang chủ / Grammar Gym</span>
            </div>
            <h1 className="ui-page-title mt-3 text-2xl sm:text-3xl">
              Grammar Gym
            </h1>
            <p className="ui-page-subtitle">Luyện ngữ pháp theo đúng những chuyên đề bạn hay làm sai.</p>
          </div>
          <img src="/images/thumbs/grammar.svg" alt="Minh hoạ luyện ngữ pháp" width={640} height={360} loading="eager" className="hidden md:block w-60 h-auto rounded-2xl border border-line shadow-card shrink-0" />
        </div>
      </div>

      {/* Pill tabs */}
      <div className="w-full">
        <div className="max-w-5xl mx-auto px-4 pt-6 flex flex-wrap gap-2">
            <button 
              onClick={() => setActiveTab('STATS')}
              className={`ui-chip cursor-pointer ${activeTab === 'STATS' ? 'ui-chip-active' : ''}`}
            >
              Phân Tích
            </button>
            <button 
              onClick={() => setActiveTab('PRACTICE')}
              className={`ui-chip cursor-pointer ${activeTab === 'PRACTICE' ? 'ui-chip-active' : ''}`}
            >
              Luyện Tập
            </button>
        </div>
      </div>

      <div className="flex-1 w-full max-w-5xl px-4 py-8">
        {activeTab === 'STATS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="ui-hero p-8 shadow-card relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Trung Tâm Thể Lực Ngữ Pháp</h2>
                <p className="text-white/80 max-w-lg">
                  Lucy AI đã phân tích Sổ Tay Lỗi Sai của bạn và tạo ra các bài tập chuyên biệt giúp bạn khắc phục triệt để các lỗ hổng ngữ pháp.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 md:col-span-2 ui-card p-6">
                <h3 className="ui-section-title text-lg mb-5">Radar Kiến Thức</h3>
                {notebooks.length > 0 ? (
                  renderRadarChart()
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted font-medium">
                    Chưa có đủ dữ liệu để vẽ biểu đồ
                  </div>
                )}
              </div>

              <div className="col-span-1 ui-card p-6">
                <h3 className="ui-section-title text-lg mb-5">Gợi Ý Hôm Nay</h3>
                {notebooks.length === 0 ? (
                  <p className="text-muted text-sm">Bạn chưa có lỗi sai ngữ pháp nào trong sổ tay. Hãy làm thêm bài tập nhé!</p>
                ) : (
                  <div className="space-y-4">
                    {notebooks.slice(0, 3).map((nb) => (
                      <div key={nb.id} className="p-4 bg-white rounded-xl border border-line hover:border-primary/40 hover:bg-primary-soft transition-colors group cursor-pointer" onClick={() => startSession(nb)}>
                        <h4 className="font-bold text-primary line-clamp-2 text-sm">{nb.topic}</h4>
                        <div className="flex justify-between text-xs text-muted mt-2">
                          <span>❌ {nb.mistakeCount} lỗi</span>
                          <span>✅ {nb.correctCount} khắc phục</span>
                        </div>
                        <button className="w-full mt-3 py-2 bg-primary text-white rounded-full font-bold text-sm sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          Tập ngay →
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'PRACTICE' && generating && (
          <div className="flex flex-col items-center justify-center h-[50vh] animate-pulse">
            <div className="w-12 h-12 mb-6 rounded-full border-4 border-primary-soft border-t-primary animate-spin" aria-hidden="true" />
            <h2 className="text-2xl font-extrabold text-primary mb-2">AI Lucy đang tạo bài tập...</h2>
            <p className="text-muted">Đang thiết kế giáo án dành riêng cho bạn dựa trên lịch sử lỗi sai</p>
          </div>
        )}

        {activeTab === 'PRACTICE' && !generating && questions.length > 0 && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="mb-6 flex flex-wrap gap-2 justify-between items-center text-sm font-bold text-muted">
              <span>Bài tập {currentQIndex + 1} / {questions.length}</span>
              <span className="ui-badge px-3 py-1">
                {questions[currentQIndex].type === 'FIND_FIX' && 'Sửa Lỗi Sai'}
                {questions[currentQIndex].type === 'BUILDING' && 'Lắp Ráp Câu'}
                {questions[currentQIndex].type === 'TRANSFORM' && 'Biến Hình Câu'}
              </span>
            </div>
            
            <div className="ui-card p-6 sm:p-8 relative">
              {/* Question UI based on Type */}
              
              {questions[currentQIndex].type === 'FIND_FIX' && (
                <div className="space-y-6">
                  <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                    <p className="text-sm font-bold text-red-700 mb-1">Câu có lỗi sai:</p>
                    <p className="text-xl font-medium">{questions[currentQIndex].incorrectSentence}</p>
                  </div>
                  <div>
                    <label className="ui-label">Hãy viết lại câu đúng:</label>
                    <textarea 
                      className="w-full bg-white border border-line-strong rounded-xl p-4 focus:border-primary focus:ring-3 focus:ring-primary/15 outline-none transition resize-none font-medium text-lg"
                      rows={3}
                      value={userAnswer}
                      onChange={e => setUserAnswer(e.target.value)}
                      placeholder="Gõ đáp án của bạn vào đây..."
                      disabled={showExplanation}
                    />
                  </div>
                </div>
              )}

              {questions[currentQIndex].type === 'BUILDING' && (
                <div className="space-y-6">
                  <p className="text-lg font-bold text-primary text-center mb-6">Hãy sắp xếp các từ sau thành câu hoàn chỉnh:</p>
                  
                  {/* Selected words (Drop zone) */}
                  <div className="min-h-[60px] p-4 bg-primary-soft/50 border-2 border-dashed border-primary/20 rounded-xl flex flex-wrap gap-2 items-center justify-center">
                    {selectedWords.length === 0 && <span className="text-muted/70 font-medium">Bấm vào các từ bên dưới</span>}
                    {selectedWords.map((word, idx) => (
                      <button 
                        key={`sel-${idx}`} 
                        onClick={() => {
                          if(showExplanation) return;
                          const newSel = [...selectedWords];
                          newSel.splice(idx, 1);
                          setSelectedWords(newSel);
                          setAvailableWords([...availableWords, word]);
                        }}
                        disabled={showExplanation}
                        className="px-4 py-2 bg-primary text-white font-bold rounded-full hover:bg-[#172e6e] transition-colors"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => {
                        if(showExplanation) return;
                        setAvailableWords([...availableWords, ...selectedWords]);
                        setSelectedWords([]);
                      }} 
                      className="btn-ghost px-4 py-2 text-sm"
                    >
                      ↺ Làm lại
                    </button>
                  </div>

                  {/* Available words */}
                  <div className="p-4 bg-[#f7f9fc] border border-line rounded-xl flex flex-wrap gap-2 items-center justify-center">
                    {availableWords.map((word, idx) => (
                      <button 
                        key={`avail-${idx}`} 
                        onClick={() => {
                          if(showExplanation) return;
                          const newAvail = [...availableWords];
                          newAvail.splice(idx, 1);
                          setAvailableWords(newAvail);
                          setSelectedWords([...selectedWords, word]);
                        }}
                        disabled={showExplanation}
                        className="px-4 py-2 bg-white border border-line-strong text-foreground font-bold rounded-full hover:border-primary hover:text-primary transition-colors"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {questions[currentQIndex].type === 'TRANSFORM' && (
                <div className="space-y-6">
                  <div className="bg-primary-soft p-4 rounded-xl border border-primary/15">
                    <p className="text-sm font-bold text-primary mb-1">Câu gốc:</p>
                    <p className="text-xl font-medium">{questions[currentQIndex].originalSentence}</p>
                  </div>
                  <div>
                    <label className="ui-label">Viết lại câu giữ nguyên nghĩa:</label>
                    <div className="relative">
                      {questions[currentQIndex].hint && (
                        <div className="absolute top-4 left-4 font-medium text-muted pointer-events-none">
                          {questions[currentQIndex].hint}
                        </div>
                      )}
                      <textarea 
                        className={`w-full bg-white border border-line-strong rounded-xl p-4 focus:border-primary focus:ring-3 focus:ring-primary/15 outline-none transition resize-none font-medium text-lg ${questions[currentQIndex].hint ? 'pl-24' : ''}`}
                        rows={3}
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        placeholder="..."
                        disabled={showExplanation}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-8">
                {!showExplanation ? (
                  <button 
                    onClick={checkAnswer}
                    disabled={
                      (questions[currentQIndex].type !== 'BUILDING' && userAnswer.trim().length === 0) ||
                      (questions[currentQIndex].type === 'BUILDING' && selectedWords.length === 0)
                    }
                    className="btn-primary w-full py-4 text-lg"
                  >
                    Kiểm Tra
                  </button>
                ) : (
                  <div className="animate-in slide-in-from-bottom-4 duration-300">
                    <div className={`p-5 sm:p-6 rounded-xl mb-6 flex items-start gap-4 ${isCorrect ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                      <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-xl font-black ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{isCorrect ? '✓' : '✗'}</div>
                      <div>
                        <h3 className="font-black text-xl mb-1">{isCorrect ? 'Chính xác!' : 'Sai rồi!'}</h3>
                        <p className="font-medium mb-3">{questions[currentQIndex].explanation}</p>
                        {!isCorrect && (
                          <div className="mt-2 p-3 bg-white rounded-lg border border-current/20">
                            <span className="text-sm opacity-70 block mb-1">Đáp án chuẩn:</span>
                            <span className="font-bold">{questions[currentQIndex].correctSentence}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={nextQuestion}
                      className={`btn-primary w-full py-4 text-lg`}
                    >
                      {currentQIndex < questions.length - 1 ? 'Tiếp Tục ➔' : 'Hoàn Thành Cuổi Tập'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
