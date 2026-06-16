"use client";
import { useState, useRef } from "react";
import Link from "next/link";
import Swal from "sweetalert2";

type QType = "gap-fill" | "multiple-choice" | "matching";

interface Question {
  id: number;
  type: QType;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
}

interface Track {
  id: string;
  title: string;
  section: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  audioUrl: string | null; // null = demo mode (no actual audio)
  transcript: string;
  questions: Question[];
}

const DEMO_TRACKS: Track[] = [
  {
    id: "sec1-form",
    title: "Section 1 — Booking a Hotel",
    section: "IELTS Section 1",
    difficulty: "Beginner",
    duration: "~3 phút",
    audioUrl: null,
    transcript: `Receptionist: Good morning, Sunrise Hotel. How can I help you?\nCaller: Hi, I'd like to book a room for three nights, starting from the 15th of July.\nReceptionist: Certainly. Would you prefer a single or double room?\nCaller: A double room, please. Oh, and does it have a sea view?\nReceptionist: Yes, our sea view doubles are available. The rate is 120 pounds per night.\nCaller: That sounds perfect. My name is James Watson.\nReceptionist: Could you spell your surname for me?\nCaller: W-A-T-S-O-N. And my phone number is 07789 452 310.`,
    questions: [
      {
        id: 1,
        type: "gap-fill",
        question: "The caller wants to stay for ______ nights.",
        answer: "three",
        explanation: "The caller says 'I'd like to book a room for three nights'.",
      },
      {
        id: 2,
        type: "multiple-choice",
        question: "What type of room does the caller request?",
        options: ["A. Single room", "B. Double room with garden view", "C. Double room with sea view", "D. Suite"],
        answer: "C",
        explanation: "The caller asks for a double room with a sea view.",
      },
      {
        id: 3,
        type: "gap-fill",
        question: "The nightly rate for the sea view room is ______ pounds.",
        answer: "120",
        explanation: "The receptionist says 'The rate is 120 pounds per night'.",
      },
      {
        id: 4,
        type: "gap-fill",
        question: "The caller's surname is ______.",
        answer: "Watson",
        explanation: "The caller spells out W-A-T-S-O-N.",
      },
      {
        id: 5,
        type: "multiple-choice",
        question: "When does the booking start?",
        options: ["A. 5th July", "B. 15th June", "C. 15th July", "D. 25th July"],
        answer: "C",
        explanation: "The caller says 'starting from the 15th of July'.",
      },
    ],
  },
  {
    id: "sec2-tour",
    title: "Section 2 — Museum Tour",
    section: "IELTS Section 2",
    difficulty: "Intermediate",
    duration: "~4 phút",
    audioUrl: null,
    transcript: `Guide: Welcome to the National History Museum. My name is Sarah and I'll be your guide today. The museum has four floors. On the ground floor, you'll find the ancient civilisations gallery and the gift shop. The café is located on the first floor, next to the modern history exhibition. On the second floor, we have the interactive science zone, which is very popular with children. The museum opens at nine in the morning and closes at six in the evening on weekdays. On weekends, it stays open until eight o'clock. Adult tickets cost twelve pounds, and children under twelve enter free of charge.`,
    questions: [
      {
        id: 1,
        type: "multiple-choice",
        question: "Where is the café located?",
        options: ["A. Ground floor", "B. First floor", "C. Second floor", "D. Third floor"],
        answer: "B",
        explanation: "The guide says 'The café is located on the first floor'.",
      },
      {
        id: 2,
        type: "gap-fill",
        question: "The interactive science zone is on the ______ floor.",
        answer: "second",
        explanation: "The guide mentions 'On the second floor, we have the interactive science zone'.",
      },
      {
        id: 3,
        type: "multiple-choice",
        question: "What time does the museum close on weekdays?",
        options: ["A. 5pm", "B. 6pm", "C. 7pm", "D. 8pm"],
        answer: "B",
        explanation: "The guide says 'closes at six in the evening on weekdays'.",
      },
      {
        id: 4,
        type: "gap-fill",
        question: "Adult tickets cost ______ pounds.",
        answer: "twelve",
        explanation: "The guide says 'Adult tickets cost twelve pounds'.",
      },
      {
        id: 5,
        type: "gap-fill",
        question: "Children under ______ enter free of charge.",
        answer: "twelve",
        explanation: "The guide says 'children under twelve enter free of charge'.",
      },
    ],
  },
  {
    id: "sec3-academic",
    title: "Section 3 — University Project Discussion",
    section: "IELTS Section 3",
    difficulty: "Advanced",
    duration: "~5 phút",
    audioUrl: null,
    transcript: `Professor: So, how are you getting on with your research proposal, Emma?\nEmma: I've been reading a lot about renewable energy, but I'm having trouble narrowing down the topic.\nProfessor: What aspects interest you most?\nEmma: I'm particularly drawn to solar energy's potential in developing countries, but I'm also curious about wind power's economic viability.\nProfessor: Both are rich areas. For a postgraduate thesis, you'll need a more specific focus. I'd suggest looking at comparative policy analysis rather than the technology itself.\nEmma: That's a good point. So, comparing how different governments have implemented incentives?\nProfessor: Exactly. And consider using a case study approach — perhaps three countries with contrasting outcomes. That would give you solid empirical data while keeping the scope manageable.`,
    questions: [
      {
        id: 1,
        type: "multiple-choice",
        question: "What is Emma's main research interest?",
        options: ["A. Wind power economics", "B. Solar energy in developing countries", "C. Nuclear energy policy", "D. Hydroelectric power"],
        answer: "B",
        explanation: "Emma says 'I'm particularly drawn to solar energy's potential in developing countries'.",
      },
      {
        id: 2,
        type: "multiple-choice",
        question: "What approach does the professor recommend?",
        options: ["A. Technology analysis", "B. Laboratory experiments", "C. Comparative policy analysis", "D. Surveys"],
        answer: "C",
        explanation: "The professor says 'I'd suggest looking at comparative policy analysis'.",
      },
      {
        id: 3,
        type: "gap-fill",
        question: "The professor suggests using a ______ approach.",
        answer: "case study",
        explanation: "The professor says 'consider using a case study approach'.",
      },
      {
        id: 4,
        type: "gap-fill",
        question: "The professor suggests looking at ______ countries with contrasting outcomes.",
        answer: "three",
        explanation: "The professor says 'perhaps three countries with contrasting outcomes'.",
      },
      {
        id: 5,
        type: "multiple-choice",
        question: "Why does the professor suggest this scope?",
        options: ["A. It is simpler", "B. It gives empirical data while remaining manageable", "C. It has more funding available", "D. It covers more technology"],
        answer: "B",
        explanation: "The professor says 'That would give you solid empirical data while keeping the scope manageable'.",
      },
    ],
  },
];

const DIFFICULTY_STYLES: Record<string, string> = {
  Beginner: "bg-green-50 text-green-700 border-green-200",
  Intermediate: "bg-amber-50 text-amber-700 border-amber-200",
  Advanced: "bg-red-50 text-red-700 border-red-200",
};

export default function ListeningPracticePage() {
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const selectTrack = (track: Track) => {
    setSelectedTrack(track);
    setShowTranscript(false);
    setAnswers({});
    setSubmitted(false);
    setScore(null);
  };

  const handleAnswer = (questionId: number, value: string) => {
    if (submitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitAnswers = () => {
    if (!selectedTrack) return;
    const unanswered = selectedTrack.questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
      Swal.fire("Chưa điền đủ", `Còn ${unanswered.length} câu chưa trả lời.`, "warning");
      return;
    }
    let correct = 0;
    selectedTrack.questions.forEach(q => {
      const userAns = (answers[q.id] || "").trim().toLowerCase();
      const correctAns = q.answer.toLowerCase();
      if (q.type === "gap-fill") {
        if (userAns === correctAns || userAns.includes(correctAns) || correctAns.includes(userAns)) correct++;
      } else {
        if (userAns === correctAns) correct++;
      }
    });
    setScore({ correct, total: selectedTrack.questions.length });
    setSubmitted(true);
    setShowTranscript(true);
  };

  const isCorrect = (q: Question) => {
    if (!submitted) return null;
    const userAns = (answers[q.id] || "").trim().toLowerCase();
    const correctAns = q.answer.toLowerCase();
    if (q.type === "gap-fill") return userAns === correctAns || userAns.includes(correctAns) || correctAns.includes(userAns);
    return userAns === correctAns;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-foreground/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-foreground/20">/</span>
        <h1 className="font-bold">Listening Practice</h1>
        <span className="ml-auto px-3 py-1 bg-green-50 text-green-700 text-xs font-bold border border-green-200">IELTS Listening</span>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {!selectedTrack ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Chọn bài nghe</h2>
              <p className="text-foreground/60">Hiện tại đang ở chế độ Demo — đọc transcript và luyện trả lời câu hỏi. Audio thật sẽ được thêm vào khi giáo viên upload.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {DEMO_TRACKS.map(track => (
                <button key={track.id} onClick={() => selectTrack(track)} className="p-5 bg-surface border border-foreground/10 hover:border-primary/30 text-left transition-all group">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="font-bold group-hover:text-primary transition-colors">{track.title}</span>
                    <span className={`text-xs px-2 py-0.5 font-bold border shrink-0 ${DIFFICULTY_STYLES[track.difficulty]}`}>{track.difficulty}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-foreground/50">
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 border border-green-200 font-medium">{track.section}</span>
                    <span>{track.duration}</span>
                    <span>{track.questions.length} câu hỏi</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="bg-blue-50 border border-blue-200 p-5">
              <p className="text-sm font-bold text-blue-700 mb-1">📢 Giáo viên muốn thêm audio thật?</p>
              <p className="text-sm text-blue-600">Upload file audio MP3/M4A trong phần Lessons hoặc Documents. Học sinh sẽ có thể nghe và luyện tập trực tiếp.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Track Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <button onClick={() => setSelectedTrack(null)} className="text-sm text-foreground/50 hover:text-foreground transition-colors mb-2 flex items-center gap-1">
                  ← Danh sách bài nghe
                </button>
                <h2 className="text-2xl font-bold">{selectedTrack.title}</h2>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 font-bold border ${DIFFICULTY_STYLES[selectedTrack.difficulty]}`}>{selectedTrack.difficulty}</span>
                  <span className="text-xs text-foreground/50">{selectedTrack.duration}</span>
                  <span className="text-xs text-foreground/50">{selectedTrack.questions.length} câu hỏi</span>
                </div>
              </div>
              {score && (
                <div className={`text-center px-6 py-3 border ${score.correct / score.total >= 0.8 ? "bg-green-50 border-green-200 text-green-700" : score.correct / score.total >= 0.5 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <div className="text-3xl font-black">{score.correct}/{score.total}</div>
                  <div className="text-xs font-bold">Điểm số</div>
                </div>
              )}
            </div>

            {/* Audio Player or Demo Notice */}
            {selectedTrack.audioUrl ? (
              <div className="bg-surface border border-foreground/10 p-4 flex items-center gap-4">
                <svg className="w-8 h-8 text-green-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
                <audio ref={audioRef} controls src={selectedTrack.audioUrl} className="flex-1" />
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 p-5 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                <div>
                  <p className="text-sm font-bold text-amber-700">Chế độ Demo</p>
                  <p className="text-sm text-amber-600 mt-1">Bài này chưa có file audio. Đọc transcript trước, sau đó ẩn transcript và thử trả lời câu hỏi để kiểm tra khả năng hiểu bài.</p>
                </div>
              </div>
            )}

            {/* Transcript Toggle */}
            <div className="bg-surface border border-foreground/10">
              <button
                onClick={() => setShowTranscript(v => !v)}
                className="w-full p-4 flex items-center justify-between font-bold text-sm hover:bg-foreground/5 transition-colors"
              >
                <span>{showTranscript ? "Ẩn transcript" : "Xem transcript"}</span>
                <span className="text-foreground/40">{showTranscript ? "▲" : "▼"}</span>
              </button>
              {showTranscript && (
                <div className="p-5 border-t border-foreground/10 bg-foreground/[0.02]">
                  <pre className="text-sm text-foreground/75 leading-relaxed whitespace-pre-wrap font-sans">{selectedTrack.transcript}</pre>
                </div>
              )}
            </div>

            {/* Questions */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg">Câu hỏi ({selectedTrack.questions.length} câu)</h3>
              {selectedTrack.questions.map((q, idx) => {
                const correct = isCorrect(q);
                return (
                  <div key={q.id} className={`bg-surface border p-5 transition-colors ${submitted ? (correct ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50") : "border-foreground/10"}`}>
                    <div className="flex items-start gap-3 mb-3">
                      <span className={`shrink-0 w-7 h-7 flex items-center justify-center text-sm font-black ${submitted ? (correct ? "bg-green-500 text-white" : "bg-red-500 text-white") : "bg-foreground/10 text-foreground/60"}`}>
                        {submitted ? (correct ? "✓" : "✗") : idx + 1}
                      </span>
                      <p className="font-medium text-sm leading-relaxed">{q.question}</p>
                    </div>

                    {q.type === "gap-fill" ? (
                      <input
                        type="text"
                        disabled={submitted}
                        value={answers[q.id] || ""}
                        onChange={e => handleAnswer(q.id, e.target.value)}
                        placeholder="Nhập câu trả lời..."
                        className={`w-full max-w-sm px-3 py-2 border text-sm focus:outline-none focus:border-primary bg-transparent ${submitted ? "opacity-60 cursor-not-allowed" : ""}`}
                      />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.options?.map(opt => {
                          const optLetter = opt.charAt(0);
                          const isSelected = answers[q.id] === optLetter;
                          const isCorrectOpt = q.answer === optLetter;
                          return (
                            <button
                              key={opt}
                              disabled={submitted}
                              onClick={() => handleAnswer(q.id, optLetter)}
                              className={`px-3 py-2 text-left text-sm border transition-all ${
                                submitted
                                  ? isCorrectOpt
                                    ? "bg-green-100 border-green-300 text-green-800"
                                    : isSelected
                                    ? "bg-red-100 border-red-300 text-red-800"
                                    : "border-foreground/10 text-foreground/50"
                                  : isSelected
                                  ? "bg-primary/10 border-primary text-primary"
                                  : "border-foreground/15 hover:border-primary/40 hover:bg-primary/5"
                              }`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {submitted && (
                      <div className={`mt-3 pt-3 border-t ${correct ? "border-green-200" : "border-red-200"}`}>
                        {!correct && (
                          <p className="text-sm font-bold text-red-700 mb-1">Đáp án đúng: <span className="font-black">{q.answer}</span></p>
                        )}
                        <p className="text-xs text-foreground/60 italic">{q.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {!submitted ? (
              <button
                onClick={submitAnswers}
                className="w-full py-4 bg-green-600 text-white font-bold hover:bg-green-700 transition-colors text-lg"
              >
                Nộp bài — Xem kết quả
              </button>
            ) : (
              <div className="space-y-3">
                <div className={`p-5 text-center border ${score!.correct / score!.total >= 0.8 ? "bg-green-50 border-green-200 text-green-700" : score!.correct / score!.total >= 0.5 ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <div className="text-2xl font-black mb-1">
                    {score!.correct}/{score!.total} câu đúng
                  </div>
                  <div className="text-sm font-medium">
                    {score!.correct / score!.total >= 0.8 ? "Xuất sắc! Kỹ năng nghe của bạn rất tốt." : score!.correct / score!.total >= 0.5 ? "Khá! Tiếp tục luyện tập để cải thiện nhé." : "Cần cải thiện thêm. Hãy đọc kỹ transcript và thử lại."}
                  </div>
                </div>
                <button onClick={() => selectTrack(selectedTrack)} className="w-full py-3 bg-surface border border-foreground/20 text-foreground font-bold hover:bg-foreground/5 transition-colors">
                  Làm lại bài này
                </button>
                <button onClick={() => setSelectedTrack(null)} className="w-full py-3 bg-green-100 border border-green-200 text-green-700 font-bold hover:bg-green-200 transition-colors">
                  Chọn bài nghe khác
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
