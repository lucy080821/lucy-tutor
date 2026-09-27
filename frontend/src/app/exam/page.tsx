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
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex flex-wrap justify-between items-center gap-3 ui-card p-5">
        <div>
          <h1 className="ui-page-title">Mô phỏng Làm bài</h1>
          <p className="ui-page-subtitle">Kiểm tra tính năng AI hỗ trợ học tập</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => { setMode("PRACTICE"); reset(); }}
            className={`ui-chip cursor-pointer ${mode === "PRACTICE" ? "ui-chip-active" : ""}`}
          >
            Luyện tập (Practice)
          </button>
          <button 
            onClick={() => { setMode("EXAM"); reset(); }}
            className={`ui-chip cursor-pointer ${mode === "EXAM" ? "ui-chip-active" : ""}`}
          >
            Thi thử (Exam)
          </button>
        </div>
      </div>

      <div className="ui-card p-5 sm:p-8">
        <div className="mb-6 flex flex-wrap justify-between items-start gap-2">
          <span className="ui-badge uppercase tracking-wider">
            Câu 1 / 50
          </span>
          {mode === "EXAM" && !isSubmitted && (
            <span className="inline-flex items-center rounded-full bg-primary text-white px-4 py-1.5 font-mono font-bold text-sm">⏱ 45:00</span>
          )}
        </div>

        <h2 className="text-xl font-medium leading-relaxed mb-8 text-foreground">
          {MOCK_QUESTION.content}
        </h2>

        <div className="space-y-3">
          {MOCK_QUESTION.options.map((opt, idx) => {
            let stateClass = "border-line-strong hover:border-primary hover:bg-primary-soft bg-surface";
            
            if (mode === "PRACTICE" && selectedAnswer) {
              if (opt === MOCK_QUESTION.correctAnswer) stateClass = "border-emerald-400 bg-emerald-50 text-emerald-700";
              else if (opt === selectedAnswer && isWrong) stateClass = "border-red-400 bg-red-50 text-red-700";
              else stateClass = "border-line bg-background opacity-60";
            }
            
            if (mode === "EXAM") {
              if (!isSubmitted && selectedAnswer === opt) {
                stateClass = "border-primary bg-primary-soft text-primary font-bold";
              }
              if (isSubmitted) {
                if (opt === MOCK_QUESTION.correctAnswer) stateClass = "border-emerald-400 bg-emerald-50 text-emerald-700 font-bold";
                else if (opt === selectedAnswer && isWrong) stateClass = "border-red-400 bg-red-50 text-red-700 font-bold";
                else stateClass = "border-line bg-background opacity-60";
              }
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelect(opt)}
                className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer ${stateClass}`}
              >
                <span className="font-bold mr-3">{String.fromCharCode(65 + idx)}.</span> {opt}
              </button>
            );
          })}
        </div>

        {mode === "EXAM" && !isSubmitted && (
          <div className="mt-8 pt-6 border-t border-line flex justify-end">
            <button 
              onClick={handleSubmitExam}
              className="btn-primary px-8 py-3 cursor-pointer"
            >
              Nộp Bài (Submit)
            </button>
          </div>
        )}

        {/* AI INTEGRATION */}
        {showAIButton && (
          <div className="mt-8 pt-6 border-t border-line">
            <div className="flex gap-4 items-start border-l-4 border-red-400 pl-4">
              <div>
                <h3 className="font-bold text-red-600 mb-1">Rất tiếc, bạn chọn chưa chính xác!</h3>
                <p className="text-sm text-muted">Không sao cả, hãy để gia sư AI giải thích cho bạn hiểu rõ bản chất nhé.</p>
                
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
          <div className="mt-8 pt-6 border-t border-line">
            <div className="flex gap-4 items-center p-4 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
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
