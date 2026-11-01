"use client";
import { useEffect, useRef, useState } from "react";
import MiniMarkdown from "@/app/administrator/_components/MiniMarkdown";
import { AdminAuthError } from "@/lib/adminApi";
import { monthLabel, pfApi } from "@/lib/personalFinance";

type Msg = { role: "user" | "assistant"; content: string };
const SUGGESTIONS = [
  "Tháng này tôi tiêu nhiều nhất vào đâu?",
  "Tôi có đang chi vượt hạn mức nào không?",
  "So với tháng trước, khoản nào tăng bất thường?",
  "Làm sao để tiết kiệm thêm 10% mỗi tháng?",
  "Dự kiến cuối tháng tôi còn lại bao nhiêu?",
];

export default function AiPanel({ month, onAuthLost, hasData }: { month: string; onAuthLost: () => void; hasData: boolean }) {
  // Kết quả phân tích giữ theo tháng trong phiên để đổi tab/tháng không mất và không tốn lượt gọi AI
  const [analyses, setAnalyses] = useState<Record<string, string>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, asking]);

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

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || asking) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setAsking(true);
    setChatError("");
    try {
      const { answer } = await pfApi.chat(month, next);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (err) {
      handle(err, setChatError);
    } finally {
      setAsking(false);
    }
  };

  const analysis = analyses[month];

  return (
    <div className="grid gap-6 xl:grid-cols-2">
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
        {analysis && <div className="text-sm"><MiniMarkdown source={analysis} /></div>}
        {!analysis && !analyzing && hasData && !analyzeError && <p className="py-8 text-center text-sm text-muted">Bấm “Phân tích tháng này” để nhận nhận định từ AI.</p>}
        <p className="mt-4 text-xs text-muted">AI chỉ dựa trên số liệu bạn nhập và có thể sai sót; đây là gợi ý quản lý chi tiêu, không phải tư vấn tài chính chuyên nghiệp.</p>
      </section>

      <section className="ui-card p-4 sm:p-6 min-w-0 flex flex-col">
        <h2 className="text-lg font-bold text-primary">Hỏi đáp về chi tiêu</h2>
        <p className="text-sm text-muted mb-3">Hỏi bất cứ điều gì về thu chi của bạn — AI trả lời từ dữ liệu thật trong sổ.</p>
        <div className="flex-1 min-h-[16rem] max-h-[32rem] overflow-y-auto rounded-xl bg-background p-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted">Gợi ý câu hỏi:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)} className="ui-chip cursor-pointer text-left">{s}</button>)}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-white" : "bg-white border border-line"}`}>
                {m.role === "user" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <MiniMarkdown source={m.content} />}
              </div>
            </div>
          ))}
          {asking && <div className="flex justify-start"><div className="rounded-2xl bg-white border border-line px-3.5 py-2.5 text-sm text-muted">AI đang trả lời…</div></div>}
          <div ref={endRef} />
        </div>
        {chatError && <p className="mt-2 rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{chatError}</p>}
        <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-3 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="vd: Tuần này tôi chi ăn ngoài bao nhiêu?" className="ui-input !py-2 flex-1 min-w-0" />
          <button type="submit" disabled={asking || !input.trim()} className="btn-primary px-5 cursor-pointer disabled:opacity-60">Gửi</button>
        </form>
        {messages.length > 0 && <button onClick={() => { setMessages([]); setChatError(""); }} className="mt-2 self-start text-xs font-bold text-muted px-1 py-1.5 cursor-pointer">Xoá cuộc trò chuyện</button>}
      </section>
    </div>
  );
}
