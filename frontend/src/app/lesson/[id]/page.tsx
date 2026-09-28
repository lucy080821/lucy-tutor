"use client";
import { useState, useEffect } from "react";
import { getSessionUserId } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import confetti from "canvas-confetti";
import DOMPurify from 'dompurify';

export default function LessonPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [learnedIndices, setLearnedIndices] = useState<Set<number>>(new Set());
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    const uid = getSessionUserId();
    setUserId(uid);
    if (!uid) {
      router.push('/');
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${id}`)
      .then(res => res.json())
      .then(data => {
        setLesson(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id, router]);

  const handleSpeak = (text: string, lang: string = 'en-US') => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    } else {
      Swal.fire('Lỗi', 'Trình duyệt không hỗ trợ phát âm', 'error');
    }
  };

  const totalVocabs = lesson?.vocabularies?.length || 0;
  const learnedCount = learnedIndices.size;
  const percent = totalVocabs > 0 ? Math.round((learnedCount / totalVocabs) * 100) : 100;

  const handleComplete = async () => {
    if (!userId || completing) return;
    if (percent < 60) {
      Swal.fire('Chưa hoàn thành', `Bạn mới học ${percent}% từ vựng. Cần tối thiểu 60% để hoàn thành bài học này!`, 'warning');
      return;
    }
    setCompleting(true);
    try {
      // Add flipped vocabs to SRS and mark the lesson completed in parallel — the two
      // requests are independent, so there's no reason to wait on one before the other.
      const flippedVocabIds = Array.from(learnedIndices).map(idx => lesson.vocabularies[idx].id);
      const srsRequest = flippedVocabIds.length > 0
        ? fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/srs/add-from-lesson`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, vocabIds: flippedVocabIds })
          }).catch(err => console.error("SRS Add Error:", err))
        : Promise.resolve();

      const [res] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${id}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, status: 'COMPLETED' })
        }),
        srsRequest,
      ]);
      if (res.ok) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        Swal.fire({
          title: 'Hoàn thành xuất sắc!',
          text: 'Bạn đã hoàn thành bài học và được cộng 5 XP!',
          icon: 'success',
          confirmButtonText: 'Quay lại Dashboard'
        }).then(() => {
          router.push('/dashboard');
        });
      } else {
        Swal.fire('Lỗi', 'Không thể lưu tiến độ', 'error');
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không thể lưu tiến độ', 'error');
    } finally {
      setCompleting(false);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl animate-pulse text-primary">Đang tải bài học...</div>;
  }

  if (!lesson) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-red-600">Không tìm thấy bài học!</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-white border-b border-line sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 shrink-0 rounded-full border border-line-strong text-primary flex items-center justify-center hover:bg-primary-soft hover:border-primary transition-colors">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-primary">{lesson.title}</h1>
            {lesson.description && <p className="text-sm text-muted">{lesson.description}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
        
        {/* Vocabulary Section */}
        {lesson.vocabularies?.length > 0 && (
          <section>
            <h2 className="ui-section-title text-2xl mb-6">
              Từ Vựng Mới
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {lesson.vocabularies.map((vocab: any, i: number) => (
                <Flashcard 
                  key={i} 
                  vocab={vocab} 
                  onSpeak={(lang) => handleSpeak(vocab.word, lang)} 
                  onFlip={() => {
                    setLearnedIndices(prev => {
                      const next = new Set(prev);
                      next.add(i);
                      return next;
                    });
                  }}
                  isLearned={learnedIndices.has(i)}
                />
              ))}
            </div>
          </section>
        )}

        {/* Grammar Section */}
        {lesson.grammars?.length > 0 && (
          <section>
            <h2 className="ui-section-title text-2xl mb-6">
              Ngữ Pháp Trọng Tâm
            </h2>
            <div className="space-y-6">
              {lesson.grammars.map((grammar: any, i: number) => (
                <div key={i} className="ui-card p-6">
                  <h3 className="text-xl font-bold text-primary mb-3">{grammar.title}</h3>
                  {grammar.structure && (
                    <div className="bg-primary-soft border border-primary/15 p-4 rounded-xl font-mono text-primary font-bold mb-4">
                      {grammar.structure}
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none quill-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(grammar.explanation) }}>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action Button */}
        <div className="flex flex-col items-center pt-8 border-t border-line gap-6">
          {totalVocabs > 0 && (
            <div className="w-full max-w-md">
              <div className="flex justify-between text-sm font-bold text-muted mb-2">
                <span>Tiến độ từ vựng: {learnedCount}/{totalVocabs}</span>
                <span className={percent >= 60 ? 'text-emerald-600' : 'text-amber-600'}>{percent}%</span>
              </div>
              <div className="w-full h-3 bg-primary-soft rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${percent >= 60 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              {percent < 60 && (
                <p className="text-xs text-amber-600 font-medium text-center mt-2">
                  * Lật thẻ để học. Cần học ít nhất 60% từ vựng để hoàn thành bài học
                </p>
              )}
            </div>
          )}

          <button 
            onClick={handleComplete}
            disabled={completing}
            className={`px-8 py-3.5 font-bold text-lg rounded-full transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-wait ${
              percent >= 60 
                ? 'bg-primary text-white hover:bg-[#172e6e] shadow-card-hover' 
                : 'bg-line text-muted'
            }`}
          >
            {completing && <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            {completing ? 'Đang lưu...' : 'Đã hiểu & Hoàn thành'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Flashcard Component
function Flashcard({ vocab, onSpeak, onFlip, isLearned }: { vocab: any, onSpeak: (lang: string) => void, onFlip: () => void, isLearned: boolean }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div 
      className="relative h-72 w-full perspective-1000 cursor-pointer group"
      onClick={() => {
        setFlipped(!flipped);
        if (!flipped) onFlip();
      }}
    >
      <div className={`w-full h-full absolute transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
        
        {/* Front */}
        <div className={`absolute w-full h-full backface-hidden bg-white border ${isLearned ? 'border-emerald-400' : 'border-line'} hover:border-primary/50 rounded-2xl p-6 flex flex-col items-center justify-center shadow-card text-center transition-colors`}>
          <div className="absolute top-4 right-4 flex gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); onSpeak('en-GB'); }}
              className="w-9 h-9 bg-primary-soft text-primary font-bold text-xs rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
              title="Phát âm giọng Anh (UK)"
            >
              UK
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onSpeak('en-US'); }}
              className="w-9 h-9 bg-primary-soft text-primary font-bold text-xs rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
              title="Phát âm giọng Mỹ (US)"
            >
              US
            </button>
          </div>
          {vocab.imageUrl && (
            <div className="w-24 h-24 mb-3 rounded-2xl overflow-hidden border border-line shrink-0">
              <img src={vocab.imageUrl} alt={vocab.word} className="w-full h-full object-cover" />
            </div>
          )}
          <h3 className="text-3xl font-black text-primary mb-1">{vocab.word}</h3>
          <p className="text-muted font-medium italic text-sm">{vocab.pos}</p>
          <p className="text-muted font-mono mt-1 text-sm">{vocab.phonetic}</p>
          <div className="absolute bottom-4 text-xs font-bold text-muted/60 uppercase tracking-widest">
            Nhấn để lật
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden bg-primary-soft border border-primary/20 rounded-2xl p-6 flex flex-col items-center justify-center shadow-card text-center rotate-y-180">
          <h3 className="text-2xl font-bold text-primary mb-3">{vocab.meaning}</h3>
          {vocab.example && (
            <p className="text-foreground italic text-sm mt-2">"{vocab.example}"</p>
          )}
          <div className="absolute bottom-4 text-xs font-bold text-primary/50 uppercase tracking-widest">
            Nhấn để lật
          </div>
        </div>
        
      </div>
    </div>
  );
}
