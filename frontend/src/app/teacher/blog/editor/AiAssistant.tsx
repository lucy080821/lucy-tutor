"use client";

import { useState } from "react";
import { API_URL } from "@/lib/blog";

type Suggestion = { titles: string[]; excerpt: string; metaTitle: string; metaDescription: string; tags: string[] };

type TextField = "excerpt" | "metaTitle" | "metaDescription";

function SuggestionRow({ label, value, onUse }: { label: string; value: string; onUse: () => void }) {
  if (!value) return null;
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-muted">{label} · {value.length} ký tự</span>
        <button onClick={onUse} className="text-xs font-bold text-primary hover:underline cursor-pointer px-2 py-1">Dùng</button>
      </div>
      <p className="text-sm text-foreground">{value}</p>
    </div>
  );
}

// Trợ lý AI trong editor: đọc tên bài + nội dung, gợi ý tên bài / tóm tắt / SEO / thẻ.
// Không tự ghi đè gì — giáo viên bấm "Dùng" cho từng mục muốn áp dụng.
export default function AiAssistant({
  userId, title, content, onApply,
}: {
  userId: string;
  title: string;
  content: string;
  onApply: (field: "title" | "excerpt" | "metaTitle" | "metaDescription" | "tags", value: string | string[]) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Suggestion | null>(null);
  const [error, setError] = useState("");

  const run = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/blog/manage/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, title, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI chưa gợi ý được");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI chưa gợi ý được");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ui-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-foreground">Trợ lý AI</h2>
        <button onClick={run} disabled={loading} className="btn-outline text-sm cursor-pointer disabled:opacity-60">
          {loading ? "Đang nghĩ..." : result ? "Gợi ý lại" : "Gợi ý bằng AI"}
        </button>
      </div>
      {!result && !error && (
        <p className="text-xs text-muted">AI đọc tên bài và nội dung để gợi ý tên bài, tóm tắt, tiêu đề/mô tả SEO và thẻ. Bạn chọn mục nào muốn dùng.</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {result && (
        <div className="space-y-3">
          {result.titles.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-1">Tên bài gợi ý</p>
              <ul className="space-y-1">
                {result.titles.map((t) => (
                  <li key={t}>
                    <button onClick={() => onApply("title", t)} className="w-full text-left text-sm rounded-lg px-3 py-2 hover:bg-primary-soft hover:text-primary cursor-pointer">
                      {t}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SuggestionRow label="Tóm tắt" value={result.excerpt} onUse={() => onApply("excerpt" as TextField, result.excerpt)} />
          <SuggestionRow label="Tiêu đề SEO" value={result.metaTitle} onUse={() => onApply("metaTitle" as TextField, result.metaTitle)} />
          <SuggestionRow label="Mô tả SEO" value={result.metaDescription} onUse={() => onApply("metaDescription" as TextField, result.metaDescription)} />
          {result.tags.length > 0 && (
            <div className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-muted">Thẻ</span>
                <button onClick={() => onApply("tags", result.tags)} className="text-xs font-bold text-primary hover:underline cursor-pointer px-2 py-1">Thêm tất cả</button>
              </div>
              <p className="text-sm text-foreground">{result.tags.map((t) => `#${t}`).join("  ")}</p>
            </div>
          )}
          <p className="text-[11px] text-muted">Gợi ý do AI tạo — hãy đọc lại trước khi dùng.</p>
        </div>
      )}
    </section>
  );
}
