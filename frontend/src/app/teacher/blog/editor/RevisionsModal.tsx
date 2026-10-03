"use client";

import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { API_URL } from "@/lib/blog";

type RevisionSummary = { id: string; title: string; createdAt: string; editedBy: { name: string } | null };
type Revision = RevisionSummary & { excerpt: string | null; content: string };

// Lịch sử chỉnh sửa: mỗi lần lưu đè (hoặc tự lưu cách nhau ≥10 phút) backend chụp lại bản cũ.
// Khôi phục chỉ nạp bản cũ vào editor — phải bấm Lưu mới ghi đè, và bản hiện tại lại được chụp lại,
// nên khôi phục nhầm vẫn quay lại được.
export default function RevisionsModal({
  userId, postId, onClose, onRestore,
}: {
  userId: string;
  postId: string;
  onClose: () => void;
  onRestore: (rev: { title: string; excerpt: string; content: string }) => void;
}) {
  const [list, setList] = useState<RevisionSummary[] | null>(null);
  const [selected, setSelected] = useState<Revision | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/blog/manage/posts/${postId}/revisions?userId=${userId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setList)
      .catch(() => setList([]));
  }, [postId, userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const open = async (id: string) => {
    setLoadingId(id);
    try {
      const res = await fetch(`${API_URL}/api/blog/manage/revisions/${id}?userId=${userId}`);
      if (res.ok) setSelected(await res.json());
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Lịch sử chỉnh sửa"
        className="bg-white rounded-2xl shadow-card w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <div>
            <h2 className="font-bold text-foreground text-lg">Lịch sử chỉnh sửa</h2>
            <p className="text-xs text-muted">Lưu tối đa 30 phiên bản gần nhất của bài.</p>
          </div>
          <button onClick={onClose} aria-label="Đóng" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer text-xl">×</button>
        </div>

        <div className="flex-1 min-h-0 grid md:grid-cols-[260px_1fr]">
          <ul className="overflow-y-auto border-b md:border-b-0 md:border-r border-line max-h-48 md:max-h-none">
            {list === null && <li className="p-4 text-sm text-muted">Đang tải...</li>}
            {list?.length === 0 && <li className="p-4 text-sm text-muted">Chưa có phiên bản cũ nào. Lịch sử bắt đầu được ghi từ lần lưu tiếp theo.</li>}
            {list?.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => open(r.id)}
                  className={`w-full text-left px-4 py-3 border-b border-line hover:bg-primary-soft cursor-pointer ${selected?.id === r.id ? "bg-primary-soft" : ""}`}
                >
                  <p className="text-sm font-semibold text-foreground">{new Date(r.createdAt).toLocaleString("vi-VN")}</p>
                  <p className="text-xs text-muted truncate">{r.title}</p>
                  {r.editedBy && <p className="text-[11px] text-muted">bởi {r.editedBy.name}</p>}
                  {loadingId === r.id && <p className="text-[11px] text-primary">Đang mở...</p>}
                </button>
              </li>
            ))}
          </ul>

          <div className="overflow-y-auto p-5 min-h-[240px]">
            {selected ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <p className="text-xs text-muted">Phiên bản lúc {new Date(selected.createdAt).toLocaleString("vi-VN")}</p>
                  <button
                    onClick={() => onRestore({ title: selected.title, excerpt: selected.excerpt || "", content: selected.content })}
                    className="btn-primary text-sm cursor-pointer"
                  >
                    Khôi phục phiên bản này
                  </button>
                </div>
                <h3 className="text-2xl font-black text-foreground">{selected.title}</h3>
                {selected.excerpt && <p className="text-muted mt-2">{selected.excerpt}</p>}
                <div className="blog-content quill-content mt-4" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(selected.content) }} />
              </>
            ) : (
              <p className="text-sm text-muted">Chọn 1 phiên bản bên trái để xem lại.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
