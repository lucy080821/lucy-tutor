"use client";
import { useState } from "react";
import AskAIButton from "@/components/AskAIButton";
import Swal from 'sweetalert2';

const MOCK_QUESTION = {
  id: 1,
  content: "Neither the teacher nor the students ______ present at the meeting yesterday.",
  options: ["was", "were", "is", "are"],
  correctAnswer: "were",
};

export default function ExamSimulator() {
  const [mode, setMode] = useState<"PRACTICE" | "EXAM">("PRACTICE");
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSelect = (ans: string) => {
    if (mode === "PRACTICE" && selectedAnswer) return; // Practice doesn't allow changing after picking once
    if (mode === "EXAM" && isSubmitted) return;
    setSelectedAnswer(ans);
  };

  const handleSubmitExam = () => {
    if (!selectedAnswer) return Swal.fire("Vui lòng chọn đáp án trước khi nộp!");
    setIsSubmitted(true);
  };

  const reset = () => {
    setSelectedAnswer(null);
    setIsSubmitted(false);
  };

  const isWrong = selectedAnswer && selectedAnswer !== MOCK_QUESTION.correctAnswer;
  const isCorrect = selectedAnswer === MOCK_QUESTION.correctAnswer;

  // Logic hiển thị AI
  // Practice: hiện ngay khi chọn sai
  // Exam: chỉ hiện khi đã nộp bài và sai
  const showAIButton = 
    (mode === "PRACTICE" && selectedAnswer && isWrong) ||
    (mode === "EXAM" && isSubmitted && isWrong);

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-center bg-surface p-4 rounded-2xl border border-foreground/10">
        <div>
          <h1 className="text-2xl font-bold">Mô phỏng Làm bài</h1>
          <p className="text-sm text-foreground/60">Kiểm tra tính năng AI hỗ trợ học tập</p>
        </div>
        
        <div className="flex bg-foreground/5 p-1 rounded-xl">
          <button 
            onClick={() => { setMode("PRACTICE"); reset(); }}
            className={`px-4 py-2 text-sm font-bold rounded-lg cursor-pointer transition-colors ${mode === "PRACTICE" ? "bg-white text-primary shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
          >
            Luyện tập (Practice)
          </button>
          <button 
            onClick={() => { setMode("EXAM"); reset(); }}
            className={`px-4 py-2 text-sm font-bold rounded-lg cursor-pointer transition-colors ${mode === "EXAM" ? "bg-white text-secondary shadow-sm" : "text-foreground/60 hover:text-foreground"}`}
          >
            Thi thử (Exam)
          </button>
        </div>
      </div>

      <div className="glass p-8 rounded-3xl">
        <div className="mb-6 flex justify-between items-start">
          <span className="bg-foreground/10 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            Câu 1 / 50
          </span>
          {mode === "EXAM" && !isSubmitted && (
            <span className="text-red-500 font-mono font-bold">⏱ 45:00</span>
          )}
        </div>

        <h2 className="text-xl font-medium leading-relaxed mb-8">
          {MOCK_QUESTION.content}
        </h2>

        <div className="space-y-3">
          {MOCK_QUESTION.options.map((opt, idx) => {
            let stateClass = "border-foreground/10 hover:border-primary/50 hover:bg-primary/5 bg-surface";
            
            if (mode === "PRACTICE" && selectedAnswer) {
              if (opt === MOCK_QUESTION.correctAnswer) stateClass = "border-green-500 bg-green-500/10 text-green-700";
              else if (opt === selectedAnswer && isWrong) stateClass = "border-red-500 bg-red-500/10 text-red-700";
              else stateClass = "border-foreground/5 bg-foreground/5 opacity-50";
            }
            
            if (mode === "EXAM") {
              if (!isSubmitted && selectedAnswer === opt) {
                stateClass = "border-primary bg-primary/10 text-primary font-bold";
              }
              if (isSubmitted) {
                if (opt === MOCK_QUESTION.correctAnswer) stateClass = "border-green-500 bg-green-500/10 text-green-700 font-bold";
                else if (opt === selectedAnswer && isWrong) stateClass = "border-red-500 bg-red-500/10 text-red-700 font-bold";
                else stateClass = "border-foreground/5 bg-foreground/5 opacity-50";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(opt)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${stateClass}`}
              >
                <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span> {opt}
              </button>
            );
          })}
        </div>

        {mode === "EXAM" && !isSubmitted && (
          <div className="mt-8 pt-6 border-t border-foreground/10 flex justify-end">
            <button 
              onClick={handleSubmitExam}
              className="px-8 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors shadow-lg cursor-pointer"
            >
              Nộp Bài (Submit)
            </button>
          </div>
        )}

        {/* AI INTEGRATION */}
        {showAIButton && (
          <div className="mt-8 pt-6 border-t border-foreground/10">
            <div className="flex gap-4 items-start">
              <div className="text-4xl">🤖</div>
              <div>
                <h3 className="font-bold text-red-500 mb-1">Rất tiếc, bạn chọn chưa chính xác!</h3>
                <p className="text-sm text-foreground/70">Không sao cả, hãy để gia sư AI giải thích cho bạn hiểu rõ bản chất nhé.</p>
                
                <AskAIButton 
                  questionContent={MOCK_QUESTION.content}
                  options={MOCK_QUESTION.options}
                  studentAnswer={selectedAnswer!}
                  correctAnswer={MOCK_QUESTION.correctAnswer}
                />
              </div>
            </div>
          </div>
        )}

        {/* Success message */}
        {((mode === "PRACTICE" && selectedAnswer && isCorrect) || (mode === "EXAM" && isSubmitted && isCorrect)) && (
          <div className="mt-8 pt-6 border-t border-foreground/10">
            <div className="flex gap-4 items-center p-4 bg-green-500/10 text-green-700 rounded-xl border border-green-500/20">
              <div className="text-2xl">🎉</div>
              <div>
                <h3 className="font-bold">Chính xác hoàn toàn!</h3>
                <p className="text-sm opacity-90">Bạn nắm ngữ pháp rất vững. Tiếp tục phát huy nhé!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
