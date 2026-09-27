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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/ai/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ questionContent, options, studentAnswer, correctAnswer })
        });
        const data = await res.json();
        if (!isMounted) return;
        if (!res.ok || !data.explanation) throw new Error(data.error || 'No explanation returned');
        setExplanation(data.explanation);
        setIsLoading(false);
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
        <div className="flex items-center gap-3 px-5 py-3.5 bg-primary-soft border border-primary/15 rounded-full text-primary font-semibold w-fit">
          <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin shrink-0" aria-hidden="true" /> Lucy đang xem xét câu trả lời của bạn...
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-100 text-sm">
          {error}
        </div>
      )}

      {explanation && (
        <div className="relative p-6 pt-7 bg-surface border border-line rounded-2xl shadow-card mt-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="absolute -top-4 left-6 bg-primary text-white text-sm font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-[0_4px_12px_rgba(30,58,138,0.25)]">
            Gia sư Lucy (Groq AI)
          </div>
          <div className="text-foreground leading-relaxed whitespace-pre-wrap text-[15px] pt-3 font-medium">
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
}
