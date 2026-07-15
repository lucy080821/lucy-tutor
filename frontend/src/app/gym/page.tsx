"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { cleanString, levenshteinDistance, getHintMask } from '@/lib/textGrading';

export default function GymPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STATS' | 'PRACTICE'>('STATS');
  
  // Data state
  const [stats, setStats] = useState<any>(null);
  const [dueVocabs, setDueVocabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Practice state
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionTotal, setSessionTotal] = useState(0);

  // Typed-answer mode state
  const [typedAnswer, setTypedAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [computedQuality, setComputedQuality] = useState<number | null>(null);

  useEffect(() => {
    const uid = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
    if (!uid) {
      router.push('/');
      return;
    }
    setUserId(uid);
    fetchData(uid);
  }, [router]);

  // Capture the queue size at the moment the student enters a practice session, so the
  // progress bar can track completion against a fixed total instead of the shrinking queue.
  useEffect(() => {
    if (activeTab === 'PRACTICE') {
      setSessionTotal(dueVocabs.length);
    }
  }, [activeTab]);

  const fetchData = async (uid: string) => {
    setLoading(true);
    try {
      const [statsRes, dueRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/stats/${uid}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/due/${uid}`)
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (dueRes.ok) setDueVocabs(await dueRes.json());
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể tải dữ liệu SRS', 'error');
    }
    setLoading(false);
  };

  const resetCardState = () => {
    setFlipped(false);
    setTypedAnswer('');
    setSubmitted(false);
    setUsedHint(false);
    setIsCorrect(null);
    setComputedQuality(null);
  };

  const handleReview = async (quality: number) => {
    if (!userId || dueVocabs.length === 0) return;

    const progressId = dueVocabs[currentCardIndex].id;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/review/${progressId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality })
      });

      if (res.ok) {
        // Remove current card from queue or move to next
        const newQueue = [...dueVocabs];
        if (quality < 3) {
          // If Failed, push to end of queue to review again today
          const failedCard = newQueue.splice(currentCardIndex, 1)[0];
          newQueue.push(failedCard);
          setDueVocabs(newQueue);
          resetCardState();
        } else {
          // Passed, remove from queue
          newQueue.splice(currentCardIndex, 1);
          setDueVocabs(newQueue);
          resetCardState();
          // If finished all
          if (newQueue.length === 0) {
            Swal.fire('Chúc mừng!', 'Bạn đã hoàn thành mục tiêu ôn tập hôm nay.', 'success');
            setActiveTab('STATS');
            fetchData(userId); // Refresh stats
          }
        }
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể lưu kết quả', 'error');
    }
  };

  // Type the word given its meaning; auto-grade -> SM-2 quality (5 exact, 4 exact+hint, 3 close typo, 1 wrong)
  const submitTypedAnswer = () => {
    if (submitted) return;
    const vocab = dueVocabs[currentCardIndex].vocab;
    const cleanUser = cleanString(typedAnswer);
    const cleanCorrect = cleanString(vocab.word);

    if (!cleanUser) {
      setIsCorrect(false);
      setComputedQuality(1);
      setSubmitted(true);
      return;
    }

    // Scale the "close enough" tolerance to word length so short words
    // (e.g. "pen" vs "ten", distance 1) aren't credited as typos of each other.
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

  const handleSpeak = (text: string, lang: string = 'en-US') => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-primary animate-pulse">Đang nạp dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center">
      
      {/* Header */}
      <div className="w-full bg-surface border-b border-foreground/10 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/dashboard')} className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-colors">
              ←
            </button>
            <div>
              <h1 className="text-xl font-black text-primary flex items-center gap-2">
                🏋️‍♀️ Phòng Gym Từ Vựng
              </h1>
            </div>
          </div>
          <div className="flex bg-foreground/5 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('STATS')} 
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'STATS' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}
            >
              Thống Kê
            </button>
            <button 
              onClick={() => setActiveTab('PRACTICE')} 
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ${activeTab === 'PRACTICE' ? 'bg-primary text-white shadow-sm' : 'text-foreground/50 hover:text-foreground'}`}
            >
              Ôn Tập
              {dueVocabs.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'PRACTICE' ? 'bg-white text-primary' : 'bg-rose-500 text-white'}`}>
                  {dueVocabs.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 py-8">
        
        {/* STATS TAB */}
        {activeTab === 'STATS' && stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {dueVocabs.length > 0 ? (
              <div className="bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20 p-6 rounded-3xl flex justify-between items-center shadow-sm">
                <div>
                  <h2 className="text-2xl font-bold text-amber-700">Đã đến giờ luyện tập!</h2>
                  <p className="text-amber-600/80 font-medium">Bạn có {dueVocabs.length} thẻ cần ôn ngay hôm nay để không bị quên.</p>
                </div>
                <button onClick={() => setActiveTab('PRACTICE')} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-md transition-all hover:scale-105">
                  Vào Tập Ngay →
                </button>
              </div>
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 p-6 rounded-3xl flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center text-2xl font-bold">✓</div>
                <div>
                  <h2 className="text-xl font-bold text-green-700">Tuyệt vời! Bạn đã hoàn thành mục tiêu hôm nay.</h2>
                  <p className="text-green-600/80 font-medium">Hãy nghỉ ngơi và quay lại vào ngày mai nhé.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Pie Chart */}
              <div className="bg-surface border border-foreground/10 p-6 rounded-3xl shadow-sm flex flex-col items-center">
                <h3 className="font-bold text-lg mb-4 w-full text-left">Phân Bổ Trạng Thái</h3>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusCounts}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {stats.statusCounts.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="bg-surface border border-foreground/10 p-6 rounded-3xl shadow-sm flex flex-col items-center">
                <h3 className="font-bold text-lg mb-4 w-full text-left">Dự Báo Khối Lượng 7 Ngày Tới</h3>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.workloads} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, opacity: 0.6 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, opacity: 0.6 }} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                      <Bar dataKey="count" name="Số từ cần ôn" fill="var(--color-primary)" radius={[6, 6, 0, 0]} barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* PRACTICE TAB */}
        {activeTab === 'PRACTICE' && (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 h-[calc(100vh-140px)]">
            {dueVocabs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <div className="text-6xl mb-4">🎉</div>
                <h2 className="text-2xl font-bold mb-2">Hết từ vựng cần ôn rồi!</h2>
                <p className="text-foreground/50">Bạn đã hoàn thành toàn bộ khối lượng của hôm nay.</p>
                <button onClick={() => setActiveTab('STATS')} className="mt-8 px-6 py-2 bg-foreground/10 font-bold rounded-xl hover:bg-foreground/20">Quay lại Thống kê</button>
              </div>
            ) : (() => {
              const currentProgress = dueVocabs[currentCardIndex];
              const currentVocab = currentProgress.vocab;
              const isTypedMode = currentProgress.status !== 'LEARNING' && currentProgress.repetitions >= 2;

              return (
              <div className="w-full max-w-md flex flex-col h-full py-4">

                {/* Progress bar */}
                <div className="w-full mb-8">
                  <div className="flex justify-between text-xs font-bold text-foreground/50 mb-2">
                    <span>Tiến độ</span>
                    <span>Thẻ {Math.min(sessionTotal - dueVocabs.length + 1, sessionTotal)}/{sessionTotal} · Còn lại {dueVocabs.length} thẻ</span>
                  </div>
                  <div className="h-2 w-full bg-foreground/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${sessionTotal > 0 ? Math.max(0, Math.min(100, ((sessionTotal - dueVocabs.length) / sessionTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>

                {isTypedMode ? (
                  <div className="w-full flex-1 min-h-[400px] flex flex-col">
                    <div className="relative flex-1 bg-surface border-2 border-foreground/10 rounded-[2rem] p-8 flex flex-col items-center justify-center shadow-xl text-center">
                      {currentVocab.imageUrl && (
                        <div className="w-28 h-28 mb-6 rounded-3xl overflow-hidden shadow-md shrink-0 border border-foreground/10">
                          <img src={currentVocab.imageUrl} className="w-full h-full object-cover" alt="vocab" />
                        </div>
                      )}
                      <h3 className="text-3xl font-bold text-primary mb-6">{currentVocab.meaning}</h3>

                      {!submitted ? (
                        <>
                          <input
                            type="text"
                            value={typedAnswer}
                            onChange={(e) => setTypedAnswer(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') submitTypedAnswer(); }}
                            placeholder="Gõ từ tiếng Anh..."
                            autoFocus
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                            spellCheck={false}
                            className="w-full max-w-xs text-center text-xl font-bold border-2 border-foreground/10 focus:border-primary rounded-2xl px-4 py-3 outline-none transition-colors bg-background text-foreground"
                          />
                          {usedHint && (
                            <p className="mt-4 font-mono text-lg tracking-widest text-foreground/50">{getHintMask(currentVocab.word)}</p>
                          )}
                          <div className="mt-6 flex gap-3">
                            <button
                              onClick={() => setUsedHint(true)}
                              disabled={usedHint}
                              className="px-5 py-2 bg-amber-500/10 text-amber-600 font-bold rounded-xl hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50"
                            >
                              💡 Gợi Ý
                            </button>
                            <button
                              onClick={submitTypedAnswer}
                              className="px-6 py-2 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                            >
                              Kiểm Tra
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute top-6 right-6 flex gap-2">
                            <button onClick={() => handleSpeak(currentVocab.word, 'en-GB')} className="w-10 h-10 bg-primary/10 text-primary font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors">UK</button>
                            <button onClick={() => handleSpeak(currentVocab.word, 'en-US')} className="w-10 h-10 bg-primary/10 text-primary font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors">US</button>
                          </div>
                          <div className={`mb-4 px-4 py-2 rounded-xl font-bold ${isCorrect ? 'bg-green-500/10 text-green-600' : 'bg-rose-500/10 text-rose-600'}`}>
                            {isCorrect ? (computedQuality === 3 ? 'Gần đúng!' : 'Chính xác!') : 'Chưa đúng'}
                          </div>
                          <h3 className="text-4xl font-black text-primary mb-2">{currentVocab.word}</h3>
                          <p className="text-foreground/50 font-medium italic text-lg">{currentVocab.pos}</p>
                          <p className="text-foreground/70 font-mono mt-2">{currentVocab.phonetic}</p>
                          {!isCorrect && typedAnswer && (
                            <p className="text-foreground/50 mt-3">Bạn đã gõ: <span className="line-through">{typedAnswer}</span></p>
                          )}
                          {currentVocab.example && (
                            <p className="text-foreground/70 italic text-lg mt-4 bg-primary/5 p-4 rounded-xl">&quot;{currentVocab.example}&quot;</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className={`mt-8 transition-opacity duration-300 ${submitted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <button
                        onClick={() => computedQuality !== null && handleReview(computedQuality)}
                        className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-md hover:opacity-90 transition-opacity"
                      >
                        Tiếp Tục →
                      </button>
                    </div>
                  </div>
                ) : (
                <>
                {/* Flashcard */}
                <div
                  className="relative w-full aspect-[3/4] perspective-1000 cursor-pointer flex-1 min-h-[400px]"
                  onClick={() => setFlipped(!flipped)}
                >
                  <div className={`w-full h-full absolute transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
                    
                    {/* Front */}
                    <div className="absolute w-full h-full backface-hidden bg-surface border-2 border-foreground/10 rounded-[2rem] p-8 flex flex-col items-center justify-center shadow-xl text-center">
                      {dueVocabs[currentCardIndex].vocab.imageUrl && (
                        <div className="w-32 h-32 mb-6 rounded-3xl overflow-hidden shadow-md shrink-0 border border-foreground/10">
                          <img src={dueVocabs[currentCardIndex].vocab.imageUrl} className="w-full h-full object-cover" alt="vocab" />
                        </div>
                      )}
                      
                      <h3 className="text-3xl font-bold text-primary mb-4">{dueVocabs[currentCardIndex].vocab.meaning}</h3>
                      
                      <div className="absolute bottom-6 text-sm font-bold text-foreground/30 uppercase tracking-widest animate-pulse">
                        Nhấn để xem đáp án
                      </div>
                    </div>

                    {/* Back */}
                    <div className="absolute w-full h-full backface-hidden bg-primary/5 border-2 border-primary/20 rounded-[2rem] p-8 flex flex-col items-center justify-center shadow-xl text-center rotate-y-180">
                      <div className="absolute top-6 right-6 flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSpeak(dueVocabs[currentCardIndex].vocab.word, 'en-GB'); }}
                          className="w-10 h-10 bg-primary/10 text-primary font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                        >UK</button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSpeak(dueVocabs[currentCardIndex].vocab.word, 'en-US'); }}
                          className="w-10 h-10 bg-primary/10 text-primary font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                        >US</button>
                      </div>
                      
                      <h3 className="text-4xl font-black text-primary mb-2">{dueVocabs[currentCardIndex].vocab.word}</h3>
                      <p className="text-foreground/50 font-medium italic text-lg">{dueVocabs[currentCardIndex].vocab.pos}</p>
                      <p className="text-foreground/70 font-mono mt-2">{dueVocabs[currentCardIndex].vocab.phonetic}</p>
                      
                      {dueVocabs[currentCardIndex].vocab.example && (
                        <p className="text-foreground/70 italic text-lg mt-4 bg-white/50 p-4 rounded-xl">"{dueVocabs[currentCardIndex].vocab.example}"</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons (Only visible when flipped) */}
                <div className={`mt-8 grid grid-cols-4 gap-2 transition-opacity duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(1); }} className="flex flex-col items-center justify-center py-3 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 rounded-xl font-bold transition-colors">
                    <span className="text-lg">Lại</span>
                    <span className="text-[10px] opacity-70">&lt; 10 phút</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(3); }} className="flex flex-col items-center justify-center py-3 bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-600 rounded-xl font-bold transition-colors">
                    <span className="text-lg">Khó</span>
                    <span className="text-[10px] opacity-70">1 ngày</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(4); }} className="flex flex-col items-center justify-center py-3 bg-green-500/10 hover:bg-green-500 hover:text-white text-green-600 rounded-xl font-bold transition-colors">
                    <span className="text-lg">Tốt</span>
                    <span className="text-[10px] opacity-70">~ 3 ngày</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(5); }} className="flex flex-col items-center justify-center py-3 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-600 rounded-xl font-bold transition-colors">
                    <span className="text-lg">Dễ</span>
                    <span className="text-[10px] opacity-70">~ 7 ngày</span>
                  </button>
                </div>
                </>
                )}

              </div>
              );
            })()}
          </div>
        )}

      </div>
    </div>
  );
}
