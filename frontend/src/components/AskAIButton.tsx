"use client";
import { useState, useEffect } from "react";

interface AskAIButtonProps {
  questionContent: string;
  options: string[];
  studentAnswer: string;
  correctAnswer: string;
}

export default function AskAIButton({
  questionContent,
  options,
  studentAnswer,
  correctAnswer,
}: AskAIButtonProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchExplanation = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // In a real app, this hits the backend: 
        // const res = await fetch('http://localhost:5000/api/ai/explain', ...)
        
        // Simulating API call for MVP since backend might not have the API KEY yet
        setTimeout(() => {
          if (!isMounted) return;
          setExplanation(`Chào bạn, mình là Lucy đây! 👋\n\nBạn đã chọn đáp án "${studentAnswer}", tuy nhiên đáp án đúng là "${correctAnswer}".\n\nTrong câu hỏi này, chúng ta cần để ý đến cấu trúc ngữ pháp đặc biệt liên quan đến cụm từ "Neither... nor...". Động từ sẽ được chia theo chủ ngữ gần nhất với nó, trong trường hợp này là "the students" (số nhiều). Vì câu có chữ "yesterday" (quá khứ), nên đáp án chính xác phải là "were".\n\n💡 Mẹo nhỏ: Cứ thấy Neither A nor B thì động từ chia theo B nhé!`);
          setIsLoading(false);
        }, 1500);

      } catch (err: any) {
        if (!isMounted) return;
        setError("Không thể kết nối tới Lucy lúc này. Vui lòng thử lại sau.");
        setIsLoading(false);
      }
    };

    fetchExplanation();

    return () => {
      isMounted = false;
    };
  }, [questionContent, options, studentAnswer, correctAnswer]);

  return (
    <div className="mt-4">
      {isLoading && (
        <div className="flex items-center gap-3 px-5 py-4 bg-primary/5 border border-primary/20 rounded-2xl text-primary font-medium w-fit shadow-inner">
          <span className="text-2xl animate-bounce">👩‍🏫</span> Lucy đang xem xét câu trả lời của bạn...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 text-sm">
          {error}
        </div>
      )}

      {explanation && (
        <div className="relative p-6 bg-surface border border-primary/20 rounded-3xl shadow-lg mt-4 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute -top-4 left-6 bg-primary text-white text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_4px_10px_rgba(99,102,241,0.4)]">
            👩‍🏫 Gia sư Lucy (Groq AI)
          </div>
          <div className="text-foreground/90 leading-relaxed whitespace-pre-wrap text-[15px] pt-3 font-medium">
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
}
