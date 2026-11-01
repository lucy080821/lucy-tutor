"use client";
import { useState } from "react";
import MiniMarkdown from "@/app/administrator/_components/MiniMarkdown";
import { AdminAuthError } from "@/lib/adminApi";
import { monthLabel, pfApi } from "@/lib/personalFinance";

export default function AiPanel({ month, onAuthLost, hasData }: { month: string; onAuthLost: () => void; hasData: boolean }) {
  // Kết quả phân tích giữ theo tháng trong phiên để đổi tab/tháng không mất và không tốn lượt gọi AI
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const handle = (err: unknown, set: (m: string) => void) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else set((err as Error).message || "Có lỗi xảy ra");
  };

  const analyze = async () => {
    setAnalyzing(true);
    setAnalyzeError("");
    try {
      const { answer } = await pfApi.analyze(month);
      setAnalyses((a) => ({ ...a, [month]: answer }));
    } catch (err) {
      handle(err, setAnalyzeError);
    } finally {
      setAnalyzing(false);
    }
  };

  const analysis = analyses[month];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <section className="ui-card p-4 sm:p-6 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-primary">AI phân tích &amp; kiểm soát</h2>
            <p className="text-sm text-muted">Đọc số liệu {monthLabel(month).toLowerCase()} và chỉ ra điểm cần chú ý, cảnh báo, dự báo cuối tháng.</p>
          </div>
          <button onClick={analyze} disabled={analyzing || !hasData} className="btn-primary px-5 py-2.5 cursor-pointer disabled:opacity-60">
            {analyzing ? "AI đang phân tích…" : analysis ? "Phân tích lại" : "Phân tích tháng này"}
          </button>
        </div>
        {!hasData && <p className="rounded-xl bg-amber-50 text-amber-800 text-sm px-3 py-2">Hãy ghi vài giao dịch trước để AI có số liệu phân tích.</p>}
        {analyzeError && <p className="rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{analyzeError}</p>}
        {analysis && <div className="text-sm"><MiniMarkdown source={analysis.replace(/<br\s*\/?>/gi, " · ")} /></div>}
        {!analysis && !analyzing && hasData && !analyzeError && <p className="py-8 text-center text-sm text-muted">Bấm “Phân tích tháng này” để nhận nhận định từ AI.</p>}
        <p className="mt-4 text-xs text-muted">AI chỉ dựa trên số liệu bạn nhập và có thể sai sót; đây là gợi ý quản lý chi tiêu, không phải tư vấn tài chính chuyên nghiệp.</p>
      </section>
    </div>
  );
}
