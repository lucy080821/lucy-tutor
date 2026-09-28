"use client";
import { useState, useEffect } from "react";
import { getSessionUserId } from "@/lib/session";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Swal from 'sweetalert2';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { cleanString, levenshteinDistance, getHintMask } from '@/lib/textGrading';

export default function GymPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'STATS' | 'PRACTICE' | 'MY_WORDS'>('STATS');

  // Data state
  const [stats, setStats] = useState<any>(null);
  const [dueVocabs, setDueVocabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Self-added vocab state (the only way a classless student gets words into their deck)
  const [customVocab, setCustomVocab] = useState<any[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newPhonetic, setNewPhonetic] = useState('');
  const [newExample, setNewExample] = useState('');
  const [savingWord, setSavingWord] = useState(false);

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
    const uid = getSessionUserId();
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

  // `silent` refreshes (after add/delete/finishing a session) keep the page on screen instead of
  // swapping the whole view for the full-page loader while the 3 requests round-trip.
  const fetchData = async (uid: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [statsRes, dueRes, customRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/stats/${uid}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/due/${uid}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/vocab/custom/${uid}`)
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (dueRes.ok) setDueVocabs(await dueRes.json());
      if (customRes.ok) setCustomVocab(await customRes.json());
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể tải dữ liệu SRS', 'error');
    }
    setLoading(false);
  };

  const handleAddCustomVocab = async () => {
    if (!userId || !newWord.trim() || !newMeaning.trim()) {
      Swal.fire('Thiếu thông tin', 'Vui lòng nhập từ và nghĩa của từ.', 'warning');
      return;
    }
    setSavingWord(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/vocab/custom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, word: newWord.trim(), meaning: newMeaning.trim(),
          phonetic: newPhonetic.trim() || undefined, example: newExample.trim() || undefined
        })
      });
      if (res.ok) {
        setNewWord(''); setNewMeaning(''); setNewPhonetic(''); setNewExample('');
        setShowAddForm(false);
        Swal.fire({ title: 'Đã thêm từ mới!', icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
        fetchData(userId, true);
      } else {
        Swal.fire('Lỗi', 'Không thể thêm từ này', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể thêm từ này', 'error');
    }
    setSavingWord(false);
  };

  const handleDeleteCustomVocab = async (id: string) => {
    if (!userId) return;
    const confirm = await Swal.fire({
      title: 'Xóa từ này?', text: 'Tiến độ ôn tập của từ này cũng sẽ bị xóa.', icon: 'warning',
      showCancelButton: true, confirmButtonText: 'Xóa', cancelButtonText: 'Hủy', confirmButtonColor: '#e11d48'
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/vocab/custom/${id}?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) {
        setCustomVocab(prev => prev.filter(v => v.id !== id));
        fetchData(userId, true);
      } else {
        Swal.fire('Lỗi', 'Không thể xóa từ này', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể xóa từ này', 'error');
    }
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
            fetchData(userId, true); // Refresh stats
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
      
      {/* Page banner (IOT style) */}
      <div className="w-full bg-surface border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 text-sm text-muted">
              <Link href="/dashboard" className="w-9 h-9 shrink-0 rounded-full border border-line-strong text-muted flex items-center justify-center hover:border-primary hover:text-primary hover:bg-primary-soft transition-colors" aria-label="Quay lại">
                ←
              </Link>
              <span>Trang chủ / Phòng Gym Từ Vựng</span>
            </div>
            <h1 className="ui-page-title mt-3 text-2xl sm:text-3xl">
              Phòng Gym Từ Vựng
            </h1>
            <p className="ui-page-subtitle">Ôn từ vựng bằng thẻ ghi nhớ theo lịch lặp lại ngắt quãng (SRS).</p>
          </div>
          <img src="/images/thumbs/vocabulary.svg" alt="Minh hoạ luyện từ vựng" width={640} height={360} loading="eager" className="hidden md:block w-60 h-auto rounded-2xl border border-line shadow-card shrink-0" />
        </div>
      </div>

      {/* Pill tabs */}
      <div className="w-full bg-background">
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('STATS')}
              className={`ui-chip px-3 sm:px-5 cursor-pointer ${activeTab === 'STATS' ? 'ui-chip-active' : ''}`}
            >
              Thống Kê
            </button>
            <button
              onClick={() => setActiveTab('PRACTICE')}
              className={`ui-chip px-3 sm:px-5 cursor-pointer ${activeTab === 'PRACTICE' ? 'ui-chip-active' : ''}`}
            >
              Ôn Tập
              {dueVocabs.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'PRACTICE' ? 'bg-white text-primary' : 'bg-highlight text-foreground'}`}>
                  {dueVocabs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('MY_WORDS')}
              className={`ui-chip px-3 sm:px-5 cursor-pointer ${activeTab === 'MY_WORDS' ? 'ui-chip-active' : ''}`}
            >
              Từ Của Tôi
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto px-4 py-8">
        
        {/* STATS TAB */}
        {activeTab === 'STATS' && stats && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            
            {dueVocabs.length > 0 ? (
              <div className="ui-hero p-6 sm:p-8 flex flex-wrap gap-4 justify-between items-center shadow-card">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Đã đến giờ luyện tập!</h2>
                  <p className="text-white/80 font-medium mt-1">Bạn có {dueVocabs.length} thẻ cần ôn ngay hôm nay để không bị quên.</p>
                </div>
                <button onClick={() => setActiveTab('PRACTICE')} className="btn-highlight px-6 py-3">
                  Vào Tập Ngay →
                </button>
              </div>
            ) : (
              <div className="ui-card p-6 flex items-center gap-4 border-l-4 border-l-emerald-500">
                <div className="w-12 h-12 shrink-0 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center text-2xl font-bold">✓</div>
                <div>
                  <h2 className="text-xl font-bold text-emerald-700">Tuyệt vời! Bạn đã hoàn thành mục tiêu hôm nay.</h2>
                  <p className="text-muted font-medium">Hãy nghỉ ngơi và quay lại vào ngày mai nhé.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Pie Chart */}
              <div className="ui-card p-6 flex flex-col items-center">
                <h3 className="ui-section-title text-lg mb-5 w-full text-left">Phân Bổ Trạng Thái</h3>
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
                        contentStyle={{ borderRadius: '12px', border: '1px solid #eaecef', boxShadow: '0 8px 20px rgba(30,58,138,0.08)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Bar Chart */}
              <div className="ui-card p-6 flex flex-col items-center">
                <h3 className="ui-section-title text-lg mb-5 w-full text-left">Dự Báo Khối Lượng 7 Ngày Tới</h3>
                <div className="w-full h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.workloads} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, opacity: 0.6 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, opacity: 0.6 }} />
                      <RechartsTooltip 
                        cursor={{ fill: 'rgba(30,58,138,0.06)' }}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #eaecef', boxShadow: '0 8px 20px rgba(30,58,138,0.08)' }}
                      />
                      <Bar dataKey="count" name="Số từ cần ôn" fill="var(--color-primary)" radius={[8, 8, 0, 0]} barSize={28} />
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
                <img src="/images/illustrations/empty-state.svg" alt="Không còn thẻ cần ôn" width={800} height={600} loading="lazy" className="w-full max-w-[220px] h-auto mb-4" />
                <h2 className="text-2xl font-extrabold text-primary mb-2">Hết từ vựng cần ôn rồi!</h2>
                <p className="text-muted">Bạn đã hoàn thành toàn bộ khối lượng của hôm nay.</p>
                <button onClick={() => setActiveTab('STATS')} className="btn-outline mt-8">Quay lại Thống kê</button>
              </div>
            ) : (() => {
              const currentProgress = dueVocabs[currentCardIndex];
              const currentVocab = currentProgress.vocab;
              const isTypedMode = currentProgress.status !== 'LEARNING' && currentProgress.repetitions >= 2;

              return (
              <div className="w-full max-w-md flex flex-col h-full py-4">

                {/* Progress bar */}
                <div className="w-full mb-8">
                  <div className="flex justify-between gap-2 text-xs font-bold text-muted mb-2">
                    <span>Tiến độ</span>
                    <span>Thẻ {Math.min(sessionTotal - dueVocabs.length + 1, sessionTotal)}/{sessionTotal} · Còn lại {dueVocabs.length} thẻ</span>
                  </div>
                  <div className="h-1.5 w-full bg-primary-soft rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{ width: `${sessionTotal > 0 ? Math.max(0, Math.min(100, ((sessionTotal - dueVocabs.length) / sessionTotal) * 100)) : 0}%` }}
                    />
                  </div>
                </div>

                {isTypedMode ? (
                  <div className="w-full flex-1 min-h-[400px] flex flex-col">
                    <div className="relative flex-1 bg-surface border border-line rounded-2xl p-8 flex flex-col items-center justify-center shadow-card-hover text-center">
                      {currentVocab.imageUrl && (
                        <div className="w-28 h-28 mb-6 rounded-2xl overflow-hidden shadow-card shrink-0 border border-line">
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
                            className="w-full max-w-xs text-center text-xl font-bold border border-line-strong focus:border-primary focus:ring-3 focus:ring-primary/15 rounded-xl px-4 py-3 outline-none transition bg-white text-foreground"
                          />
                          {usedHint && (
                            <p className="mt-4 font-mono text-lg tracking-widest text-muted">{getHintMask(currentVocab.word)}</p>
                          )}
                          <div className="mt-6 flex flex-wrap justify-center gap-3">
                            <button
                              onClick={() => setUsedHint(true)}
                              disabled={usedHint}
                              className="px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-full hover:bg-amber-100 transition-colors disabled:opacity-50"
                            >
                              Gợi Ý
                            </button>
                            <button
                              onClick={submitTypedAnswer}
                              className="btn-primary px-6 py-2.5"
                            >
                              Kiểm Tra
                            </button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="absolute top-6 right-6 flex gap-2">
                            <button onClick={() => handleSpeak(currentVocab.word, 'en-GB')} className="w-10 h-10 bg-primary-soft text-primary border border-primary/15 font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors">UK</button>
                            <button onClick={() => handleSpeak(currentVocab.word, 'en-US')} className="w-10 h-10 bg-primary-soft text-primary border border-primary/15 font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors">US</button>
                          </div>
                          <div className={`mb-4 px-4 py-1.5 rounded-full text-sm font-bold ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                            {isCorrect ? (computedQuality === 3 ? 'Gần đúng!' : 'Chính xác!') : 'Chưa đúng'}
                          </div>
                          <h3 className="text-4xl font-black text-primary mb-2">{currentVocab.word}</h3>
                          <p className="text-muted font-medium italic text-lg">{currentVocab.pos}</p>
                          <p className="text-muted font-mono mt-2">{currentVocab.phonetic}</p>
                          {!isCorrect && typedAnswer && (
                            <p className="text-muted mt-3">Bạn đã gõ: <span className="line-through">{typedAnswer}</span></p>
                          )}
                          {currentVocab.example && (
                            <p className="text-foreground/80 italic text-lg mt-4 bg-primary-soft p-4 rounded-xl">&quot;{currentVocab.example}&quot;</p>
                          )}
                        </>
                      )}
                    </div>

                    <div className={`mt-8 transition-opacity duration-300 ${submitted ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      <button
                        onClick={() => computedQuality !== null && handleReview(computedQuality)}
                        className="btn-primary w-full py-4"
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
                    <div className="absolute w-full h-full backface-hidden bg-surface border border-line rounded-2xl p-8 flex flex-col items-center justify-center shadow-card-hover text-center">
                      {dueVocabs[currentCardIndex].vocab.imageUrl && (
                        <div className="w-32 h-32 mb-6 rounded-2xl overflow-hidden shadow-card shrink-0 border border-line">
                          <img src={dueVocabs[currentCardIndex].vocab.imageUrl} className="w-full h-full object-cover" alt="vocab" />
                        </div>
                      )}
                      
                      <h3 className="text-3xl font-bold text-primary mb-4">{dueVocabs[currentCardIndex].vocab.meaning}</h3>
                      
                      <div className="absolute bottom-6 text-xs font-bold text-muted/70 uppercase tracking-widest animate-pulse">
                        Nhấn để xem đáp án
                      </div>
                    </div>

                    {/* Back */}
                    <div className="absolute w-full h-full backface-hidden bg-surface border border-primary/20 rounded-2xl p-8 flex flex-col items-center justify-center shadow-card-hover text-center rotate-y-180">
                      <div className="absolute top-6 right-6 flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSpeak(dueVocabs[currentCardIndex].vocab.word, 'en-GB'); }}
                          className="w-10 h-10 bg-primary-soft text-primary border border-primary/15 font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                        >UK</button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSpeak(dueVocabs[currentCardIndex].vocab.word, 'en-US'); }}
                          className="w-10 h-10 bg-primary-soft text-primary border border-primary/15 font-bold text-sm rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                        >US</button>
                      </div>
                      
                      <h3 className="text-4xl font-black text-primary mb-2">{dueVocabs[currentCardIndex].vocab.word}</h3>
                      <p className="text-muted font-medium italic text-lg">{dueVocabs[currentCardIndex].vocab.pos}</p>
                      <p className="text-muted font-mono mt-2">{dueVocabs[currentCardIndex].vocab.phonetic}</p>
                      
                      {dueVocabs[currentCardIndex].vocab.example && (
                        <p className="text-foreground/80 italic text-lg mt-4 bg-primary-soft p-4 rounded-xl">"{dueVocabs[currentCardIndex].vocab.example}"</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons (Only visible when flipped) */}
                <div className={`mt-8 grid grid-cols-4 gap-2 transition-opacity duration-300 ${flipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(1); }} className="flex flex-col items-center justify-center py-2.5 bg-red-50 border border-red-100 hover:bg-red-100 text-red-700 rounded-full font-bold transition-colors">
                    <span className="text-base leading-tight">Lại</span>
                    <span className="text-[10px] opacity-70">&lt; 10 phút</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(3); }} className="flex flex-col items-center justify-center py-2.5 bg-amber-50 border border-amber-100 hover:bg-amber-100 text-amber-700 rounded-full font-bold transition-colors">
                    <span className="text-base leading-tight">Khó</span>
                    <span className="text-[10px] opacity-70">1 ngày</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(4); }} className="flex flex-col items-center justify-center py-2.5 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 text-emerald-700 rounded-full font-bold transition-colors">
                    <span className="text-base leading-tight">Tốt</span>
                    <span className="text-[10px] opacity-70">~ 3 ngày</span>
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleReview(5); }} className="flex flex-col items-center justify-center py-2.5 bg-primary-soft border border-primary/10 hover:bg-primary/10 text-primary rounded-full font-bold transition-colors">
                    <span className="text-base leading-tight">Dễ</span>
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

        {/* MY_WORDS TAB — self-add vocab (no lesson/classroom required) */}
        {activeTab === 'MY_WORDS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                <h2 className="ui-section-title">Từ Vựng Tự Thêm</h2>
                <p className="text-sm text-muted mt-2">Tự thêm từ mới để luyện tập — không cần chờ giáo viên giao bài.</p>
              </div>
              <button
                onClick={() => setShowAddForm(v => !v)}
                className="btn-primary px-5 py-2.5"
              >
                {showAddForm ? 'Đóng' : '+ Thêm Từ Mới'}
              </button>
            </div>

            {showAddForm && (
              <div className="ui-card p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="ui-label">Từ tiếng Anh *</label>
                    <input type="text" value={newWord} onChange={e => setNewWord(e.target.value)} placeholder="vd: resilient"
                      className="ui-input" />
                  </div>
                  <div>
                    <label className="ui-label">Nghĩa tiếng Việt *</label>
                    <input type="text" value={newMeaning} onChange={e => setNewMeaning(e.target.value)} placeholder="vd: kiên cường, dễ phục hồi"
                      className="ui-input" />
                  </div>
                  <div>
                    <label className="ui-label">Phiên âm — tuỳ chọn</label>
                    <input type="text" value={newPhonetic} onChange={e => setNewPhonetic(e.target.value)} placeholder="vd: /rɪˈzɪl.i.ənt/"
                      className="ui-input" />
                  </div>
                  <div>
                    <label className="ui-label">Câu ví dụ — tuỳ chọn</label>
                    <input type="text" value={newExample} onChange={e => setNewExample(e.target.value)} placeholder="vd: She stayed resilient through hardship."
                      className="ui-input" />
                  </div>
                </div>
                <button
                  onClick={handleAddCustomVocab}
                  disabled={savingWord}
                  className="btn-primary px-6 py-2.5"
                >
                  {savingWord ? 'Đang lưu...' : 'Lưu Từ Mới'}
                </button>
              </div>
            )}

            {customVocab.length === 0 ? (
              <div className="ui-card text-center py-10 px-6 flex flex-col items-center">
                <img src="/images/illustrations/empty-state.svg" alt="Chưa có từ vựng tự thêm" width={800} height={600} loading="lazy" className="w-full max-w-[220px] h-auto mb-4" />
                <p className="text-muted">Bạn chưa tự thêm từ nào. Bấm &quot;+ Thêm Từ Mới&quot; để bắt đầu.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {customVocab.map((v: any) => (
                  <div key={v.id} className="ui-card ui-card-hover p-5 flex justify-between items-start gap-3">
                    <div>
                      <h3 className="font-bold text-lg text-primary">{v.word}</h3>
                      {v.phonetic && <p className="text-muted font-mono text-sm">{v.phonetic}</p>}
                      <p className="text-foreground/80 mt-1">{v.meaning}</p>
                      {v.example && <p className="text-muted italic text-sm mt-2">&quot;{v.example}&quot;</p>}
                    </div>
                    <button
                      onClick={() => handleDeleteCustomVocab(v.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-full text-foreground/30 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      title="Xóa từ"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
