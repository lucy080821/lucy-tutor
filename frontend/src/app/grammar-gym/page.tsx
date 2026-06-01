"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import confetti from "canvas-confetti";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

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
    const uid = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
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

  const cleanString = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

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
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
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
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 12 }} />
          <PolarRadiusAxis />
          <Radar name="Đúng" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.5} />
          <Radar name="Sai" dataKey="B" stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.5} />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-primary animate-pulse">Đang nạp dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      {/* Header */}
      <div className="w-full bg-surface border-b border-foreground/10 p-4 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-foreground/5 rounded-full transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center gap-2">
              🏋️ Grammar Gym
            </h1>
          </div>
          
          <div className="flex bg-foreground/5 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('STATS')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'STATS' ? 'bg-background shadow text-blue-600' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Phân Tích
            </button>
            <button 
              onClick={() => setActiveTab('PRACTICE')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeTab === 'PRACTICE' ? 'bg-background shadow text-blue-600' : 'text-foreground/60 hover:text-foreground'}`}
            >
              Luyện Tập
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-4xl p-6">
        {activeTab === 'STATS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-2">Trung Tâm Thể Lực Ngữ Pháp</h2>
                <p className="text-blue-100 max-w-lg">
                  Lucy AI đã phân tích Sổ Tay Lỗi Sai của bạn và tạo ra các bài tập chuyên biệt giúp bạn khắc phục triệt để các lỗ hổng ngữ pháp.
                </p>
              </div>
              <div className="absolute right-0 top-0 opacity-10 pointer-events-none">
                <svg width="200" height="200" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V12M12 4L12 14M12 4C10.8954 4 10 4.89543 10 6C10 7.10457 10.8954 8 12 8C13.1046 8 14 7.10457 14 6C14 4.89543 13.1046 4 12 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-1 md:col-span-2 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🕸️ Radar Kiến Thức</h3>
                {notebooks.length > 0 ? (
                  renderRadarChart()
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-foreground/40 font-medium">
                    Chưa có đủ dữ liệu để vẽ biểu đồ
                  </div>
                )}
              </div>

              <div className="col-span-1 bg-surface p-6 rounded-3xl border border-foreground/10 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">🎯 Gợi Ý Hôm Nay</h3>
                {notebooks.length === 0 ? (
                  <p className="text-foreground/50 text-sm">Bạn chưa có lỗi sai ngữ pháp nào trong sổ tay. Hãy làm thêm bài tập nhé!</p>
                ) : (
                  <div className="space-y-4">
                    {notebooks.slice(0, 3).map((nb) => (
                      <div key={nb.id} className="p-4 bg-foreground/5 rounded-2xl hover:bg-blue-500/5 transition-colors group cursor-pointer border border-transparent hover:border-blue-500/20" onClick={() => startSession(nb)}>
                        <h4 className="font-bold text-blue-600 line-clamp-2 text-sm">{nb.topic}</h4>
                        <div className="flex justify-between text-xs text-foreground/50 mt-2">
                          <span>❌ {nb.mistakeCount} lỗi</span>
                          <span>✅ {nb.correctCount} khắc phục</span>
                        </div>
                        <button className="w-full mt-3 py-2 bg-blue-500 text-white rounded-xl font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="text-6xl mb-6">🤖</div>
            <h2 className="text-2xl font-bold mb-2">AI Lucy đang tạo bài tập...</h2>
            <p className="text-foreground/50">Đang thiết kế giáo án dành riêng cho bạn dựa trên lịch sử lỗi sai</p>
          </div>
        )}

        {activeTab === 'PRACTICE' && !generating && questions.length > 0 && (
          <div className="max-w-2xl mx-auto mt-8">
            <div className="mb-6 flex justify-between items-center text-sm font-bold text-foreground/50">
              <span>Bài tập {currentQIndex + 1} / {questions.length}</span>
              <span className="px-3 py-1 bg-foreground/10 rounded-full">
                {questions[currentQIndex].type === 'FIND_FIX' && 'Sửa Lỗi Sai'}
                {questions[currentQIndex].type === 'BUILDING' && 'Lắp Ráp Câu'}
                {questions[currentQIndex].type === 'TRANSFORM' && 'Biến Hình Câu'}
              </span>
            </div>
            
            <div className="bg-surface p-8 rounded-3xl border border-foreground/10 shadow-lg relative">
              {/* Question UI based on Type */}
              
              {questions[currentQIndex].type === 'FIND_FIX' && (
                <div className="space-y-6">
                  <div className="bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20">
                    <p className="text-sm font-bold text-rose-500 mb-1">Câu có lỗi sai:</p>
                    <p className="text-xl font-medium">{questions[currentQIndex].incorrectSentence}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-2">Hãy viết lại câu đúng:</label>
                    <textarea 
                      className="w-full bg-background border-2 border-foreground/10 rounded-2xl p-4 focus:border-blue-500 outline-none resize-none font-medium text-lg"
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
                  <p className="text-lg font-bold text-center mb-6">Hãy sắp xếp các từ sau thành câu hoàn chỉnh:</p>
                  
                  {/* Selected words (Drop zone) */}
                  <div className="min-h-[60px] p-4 bg-background border-2 border-dashed border-foreground/20 rounded-2xl flex flex-wrap gap-2 items-center justify-center">
                    {selectedWords.length === 0 && <span className="text-foreground/30 font-medium">Bấm vào các từ bên dưới</span>}
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
                        className="px-4 py-2 bg-blue-500 text-white font-bold rounded-xl hover:scale-105 transition-transform"
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
                      className="text-sm text-foreground/50 hover:text-foreground font-medium"
                    >
                      ↺ Làm lại
                    </button>
                  </div>

                  {/* Available words */}
                  <div className="p-4 bg-foreground/5 rounded-2xl flex flex-wrap gap-2 items-center justify-center">
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
                        className="px-4 py-2 bg-surface border border-foreground/10 text-foreground font-bold rounded-xl shadow-sm hover:border-blue-500 transition-colors"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {questions[currentQIndex].type === 'TRANSFORM' && (
                <div className="space-y-6">
                  <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                    <p className="text-sm font-bold text-blue-600 mb-1">Câu gốc:</p>
                    <p className="text-xl font-medium">{questions[currentQIndex].originalSentence}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-foreground/70 mb-2">Viết lại câu giữ nguyên nghĩa:</label>
                    <div className="relative">
                      {questions[currentQIndex].hint && (
                        <div className="absolute top-4 left-4 font-medium text-foreground/50 pointer-events-none">
                          {questions[currentQIndex].hint}
                        </div>
                      )}
                      <textarea 
                        className={`w-full bg-background border-2 border-foreground/10 rounded-2xl p-4 focus:border-blue-500 outline-none resize-none font-medium text-lg ${questions[currentQIndex].hint ? 'pl-24' : ''}`}
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
                    className="w-full py-4 bg-foreground text-background font-black text-lg rounded-2xl hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:hover:scale-100"
                  >
                    Kiểm Tra
                  </button>
                ) : (
                  <div className="animate-in slide-in-from-bottom-4 duration-300">
                    <div className={`p-6 rounded-2xl mb-6 flex items-start gap-4 ${isCorrect ? 'bg-green-500/10 border-2 border-green-500/30 text-green-700' : 'bg-rose-500/10 border-2 border-rose-500/30 text-rose-700'}`}>
                      <div className="text-4xl">{isCorrect ? '🎉' : '💡'}</div>
                      <div>
                        <h3 className="font-black text-xl mb-1">{isCorrect ? 'Chính xác!' : 'Sai rồi!'}</h3>
                        <p className="font-medium mb-3">{questions[currentQIndex].explanation}</p>
                        {!isCorrect && (
                          <div className="mt-2 p-3 bg-background rounded-xl border border-current/20">
                            <span className="text-sm opacity-70 block mb-1">Đáp án chuẩn:</span>
                            <span className="font-bold">{questions[currentQIndex].correctSentence}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      onClick={nextQuestion}
                      className={`w-full py-4 font-black text-lg rounded-2xl hover:scale-[1.02] transition-transform text-white shadow-lg ${isCorrect ? 'bg-green-500 hover:bg-green-600' : 'bg-rose-500 hover:bg-rose-600'}`}
                    >
                      {currentQIndex < questions.length - 1 ? 'Tiếp Tục ➔' : 'Hoàn Thành Cuổi Tập 🎉'}
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
