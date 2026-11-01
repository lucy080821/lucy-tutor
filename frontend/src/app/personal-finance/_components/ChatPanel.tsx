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
// AI hay chèn <br> trong ô bảng Markdown; MiniMarkdown không hiểu HTML nên đổi thành dấu phân cách
const clean = (s: string) =>
  s.replace(/<br\s*\/?>/gi, " · ")
    // LaTeX còn sót: bỏ khung \[ \] \( \), \text{...} -> chữ thường, \approx -> ≈
    .replace(/\\[[()\]]/g, "").replace(/\\text\{([^}]*)\}/g, "$1").replace(/\\approx/g, "≈").replace(/\\times/g, "×").replace(/\\cdot/g, "·");

export default function ChatPanel({ month, onAuthLost }: { month: string; onAuthLost: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, asking]);

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || asking) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setAsking(true);
    setError("");
    try {
      const { answer } = await pfApi.chat(month, next);
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else setError((err as Error).message || "Có lỗi xảy ra");
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="ui-card p-4 sm:p-6 min-w-0 flex flex-col mx-auto w-full max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-primary">Hỏi đáp về chi tiêu</h2>
          <p className="text-sm text-muted mb-3">Hỏi bất cứ điều gì về thu chi của bạn ({monthLabel(month).toLowerCase()}) — AI trả lời từ dữ liệu thật trong sổ.</p>
        </div>
        {messages.length > 0 && <button onClick={() => { setMessages([]); setError(""); }} className="text-xs font-bold text-muted px-2 py-2 cursor-pointer">Xoá cuộc trò chuyện</button>}
      </div>
      <div className="min-h-[22rem] max-h-[65vh] overflow-y-auto rounded-xl bg-background p-3 space-y-3">
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
            <div className={`max-w-[94%] min-w-0 rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "bg-primary text-white" : "bg-white border border-line"}`}>
              {m.role === "user" ? <p className="whitespace-pre-wrap break-words">{m.content}</p> : <MiniMarkdown source={clean(m.content)} />}
            </div>
          </div>
        ))}
        {asking && <div className="flex justify-start"><div className="rounded-2xl bg-white border border-line px-3.5 py-2.5 text-sm text-muted">AI đang trả lời…</div></div>}
        <div ref={endRef} />
      </div>
      {error && <p className="mt-2 rounded-xl bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>}
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="vd: Tuần này tôi chi ăn ngoài bao nhiêu?" className="ui-input !py-2 flex-1 min-w-0" />
        <button type="submit" disabled={asking || !input.trim()} className="btn-primary px-5 cursor-pointer disabled:opacity-60">Gửi</button>
      </form>
      <p className="mt-3 text-xs text-muted">AI chỉ dựa trên số liệu bạn nhập và có thể sai sót; đây là gợi ý quản lý chi tiêu, không phải tư vấn tài chính chuyên nghiệp.</p>
    </section>
  );
}
