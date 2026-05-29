"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";

export default function LessonPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const uid = localStorage.getItem('userId');
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

  const handleSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      Swal.fire('Lỗi', 'Trình duyệt không hỗ trợ phát âm', 'error');
    }
  };

  const handleComplete = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'COMPLETED' })
      });
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
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không thể lưu tiến độ', 'error');
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl animate-pulse text-primary">Đang tải bài học...</div>;
  }

  if (!lesson) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-rose-500">Không tìm thấy bài học!</div>;
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-surface border-b border-foreground/10 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => router.back()} className="w-10 h-10 rounded-full bg-foreground/5 flex items-center justify-center hover:bg-foreground/10 transition-colors">
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold">{lesson.title}</h1>
            {lesson.description && <p className="text-sm text-foreground/60">{lesson.description}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-12">
        
        {/* Vocabulary Section */}
        {lesson.vocabularies?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-xl flex items-center justify-center text-xl">📝</span>
              Từ Vựng Mới
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {lesson.vocabularies.map((vocab: any, i: number) => (
                <Flashcard key={i} vocab={vocab} onSpeak={() => handleSpeak(vocab.word)} />
              ))}
            </div>
          </section>
        )}

        {/* Grammar Section */}
        {lesson.grammars?.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              <span className="w-10 h-10 bg-purple-500/10 text-purple-500 rounded-xl flex items-center justify-center text-xl">📖</span>
              Ngữ Pháp Trọng Tâm
            </h2>
            <div className="space-y-6">
              {lesson.grammars.map((grammar: any, i: number) => (
                <div key={i} className="bg-surface border border-foreground/10 p-6 rounded-3xl shadow-sm">
                  <h3 className="text-xl font-bold text-primary mb-3">{grammar.title}</h3>
                  {grammar.structure && (
                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl font-mono text-primary font-bold mb-4">
                      {grammar.structure}
                    </div>
                  )}
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{grammar.explanation}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Action Button */}
        <div className="flex justify-center pt-8 border-t border-foreground/10">
          <button 
            onClick={handleComplete}
            className="px-8 py-4 bg-primary text-white font-black text-lg rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-primary/30 flex items-center gap-3"
          >
            ✅ Đã hiểu & Hoàn thành
          </button>
        </div>
      </div>
    </div>
  );
}

// Flashcard Component
function Flashcard({ vocab, onSpeak }: { vocab: any, onSpeak: () => void }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div 
      className="relative h-64 w-full perspective-1000 cursor-pointer group"
      onClick={() => setFlipped(!flipped)}
    >
      <div className={`w-full h-full absolute transition-transform duration-500 transform-style-3d ${flipped ? 'rotate-y-180' : ''}`}>
        
        {/* Front */}
        <div className="absolute w-full h-full backface-hidden bg-surface border-2 border-foreground/10 hover:border-primary/50 rounded-3xl p-6 flex flex-col items-center justify-center shadow-sm text-center">
          <button 
            onClick={(e) => { e.stopPropagation(); onSpeak(); }}
            className="absolute top-4 right-4 w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
            title="Nghe phát âm"
          >
            🔊
          </button>
          <h3 className="text-3xl font-black text-primary mb-2">{vocab.word}</h3>
          <p className="text-foreground/50 font-medium italic">{vocab.pos}</p>
          <p className="text-foreground/70 font-mono mt-1">{vocab.phonetic}</p>
          <div className="absolute bottom-4 text-xs font-bold text-foreground/30 uppercase tracking-widest">
            Nhấn để lật
          </div>
        </div>

        {/* Back */}
        <div className="absolute w-full h-full backface-hidden bg-primary/5 border-2 border-primary/20 rounded-3xl p-6 flex flex-col items-center justify-center shadow-sm text-center rotate-y-180">
          <h3 className="text-2xl font-bold mb-3">{vocab.meaning}</h3>
          {vocab.example && (
            <p className="text-foreground/80 italic text-sm mt-2">"{vocab.example}"</p>
          )}
          <div className="absolute bottom-4 text-xs font-bold text-primary/50 uppercase tracking-widest">
            Nhấn để lật
          </div>
        </div>
        
      </div>
    </div>
  );
}
