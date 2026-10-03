"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/lib/blog";

export type PickerPost = {
  id: string;
  title: string;
  slug: string;
  status: "DRAFT" | "PENDING" | "PUBLISHED";
  publishedAt: string | null;
  coverImage: string | null;
  author: { name: string };
};

const MAX_RELATED = 6;

// "Bài viết liên quan" trong editor: tìm bài đã đăng của mọi tác giả để gắn vào cuối bài đang soạn
// (giới thiệu bài cho nhau), xếp thứ tự, và chèn link bài đó thẳng vào nội dung tại vị trí con trỏ.
// Để trống -> trang bài viết tự gợi ý bài cùng danh mục như trước.
export default function RelatedPostsPicker({
  userId, postId, value, onChange, onInsertLink,
}: {
  userId: string;
  postId: string | null;
  value: string[];
  onChange: (ids: string[]) => void;
  onInsertLink: (post: PickerPost) => void;
}) {
  // Thông tin các bài đã chọn (id -> bài). Bài mới chọn từ kết quả tìm kiếm được thêm thẳng vào đây.
  const [known, setKnown] = useState<Record<string, PickerPost>>({});
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerPost[] | null>(null);
  const [open, setOpen] = useState(false);

  // Nạp thông tin những bài đã chọn sẵn (mở lại bài cũ) mà chưa có trong `known`
  const missingKey = value.filter((id) => !known[id]).join(",");
  useEffect(() => {
    if (!missingKey) return;
    fetch(`${API_URL}/api/blog/manage/post-picker?userId=${userId}&ids=${missingKey}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: PickerPost[]) => setKnown((k) => ({ ...k, ...Object.fromEntries(rows.map((p) => [p.id, p])) })))
      .catch(() => {});
  }, [missingKey, userId]);

  // Tìm bài (debounce 300ms). Mở ô tìm mà chưa gõ gì -> hiện các bài mới đăng gần nhất
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ userId, q: query.trim(), ...(postId ? { excludeId: postId } : {}) });
      fetch(`${API_URL}/api/blog/manage/post-picker?${qs}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, userId, postId]);

  const add = (p: PickerPost) => {
    if (value.includes(p.id) || value.length >= MAX_RELATED) return;
    setKnown((k) => ({ ...k, [p.id]: p }));
    onChange([...value, p.id]);
  };
  const remove = (id: string) => onChange(value.filter((x) => x !== id));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  const isPublic = (p: PickerPost) => p.status === "PUBLISHED" && (!p.publishedAt || new Date(p.publishedAt) <= new Date());

  return (
    <section className="ui-card p-5 space-y-3">
      <div>
        <h2 className="font-bold text-foreground">Bài viết liên quan</h2>
        <p className="text-xs text-muted mt-0.5">
          Tuỳ chọn, tối đa {MAX_RELATED} bài, hiện ở cuối bài theo đúng thứ tự bên dưới. Để trống = tự gợi ý bài cùng danh mục.
        </p>
      </div>

      {value.length > 0 && (
        <ol className="space-y-2">
          {value.map((id, i) => {
            const p = known[id];
            return (
              <li key={id} className="rounded-xl border border-line p-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-xs font-bold text-muted w-4 pt-0.5 shrink-0">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{p ? p.title : "Đang tải..."}</p>
                    {p && (
                      <p className="text-[11px] text-muted mt-0.5">
                        {p.author.name}
                        {!isPublic(p) && <span className="text-amber-700"> · chưa hiện công khai, sẽ tạm ẩn</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 mt-1.5 pl-6">
                  {p && (
                    <button type="button" onClick={() => onInsertLink(p)} title="Chèn link bài này vào nội dung, tại vị trí con trỏ (hoặc gắn vào chữ đang bôi đen)"
                      className="text-xs font-semibold text-primary hover:bg-primary-soft rounded-full px-2.5 py-2 cursor-pointer">
                      Chèn link vào bài
                    </button>
                  )}
                  <span className="flex-1" />
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Đưa lên"
                    className="w-8 h-8 rounded-full hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default">↑</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} aria-label="Đưa xuống"
                    className="w-8 h-8 rounded-full hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default">↓</button>
                  <button type="button" onClick={() => remove(id)} aria-label="Bỏ bài này"
                    className="w-8 h-8 rounded-full hover:bg-red-50 hover:text-red-600 text-muted flex items-center justify-center cursor-pointer">×</button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {value.length < MAX_RELATED && (
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
            placeholder="Tìm bài đã đăng theo tên..."
            aria-label="Tìm bài viết liên quan"
            className="ui-input w-full"
          />
          {open && (
            <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-line rounded-xl shadow-card max-h-72 overflow-y-auto">
              {results === null && <li className="px-3 py-2.5 text-sm text-muted">Đang tìm...</li>}
              {results?.length === 0 && <li className="px-3 py-2.5 text-sm text-muted">Không có bài đã đăng nào phù hợp.</li>}
              {results?.map((p) => {
                const chosen = value.includes(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={chosen}
                      // onMouseDown thay vì onClick: chạy trước onBlur của ô tìm kiếm nên danh sách không bị đóng trước khi chọn
                      onMouseDown={(e) => { e.preventDefault(); add(p); }}
                      className="w-full text-left px-3 py-2.5 hover:bg-primary-soft cursor-pointer disabled:opacity-50 disabled:cursor-default border-b border-line last:border-0"
                    >
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{chosen && "✓ "}{p.title}</p>
                      <p className="text-[11px] text-muted">{p.author.name}{!isPublic(p) && " · hẹn giờ đăng"}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
