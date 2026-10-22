"use client";
import { useEffect, type ReactNode } from "react";

export function Modal({ open, onClose, title, children, wide, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#0f1c3f]/40 p-0 sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title}
        className={`bg-white w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl shadow-card-hover`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <h2 className="font-bold text-primary text-lg leading-tight">{title}</h2>
          <button type="button" onClick={onClose} className="ml-auto btn-ghost w-9 h-9 p-0 text-xl" aria-label="Đóng">×</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export const Spinner = ({ label = "Đang xử lý…" }: { label?: string }) => (
  <div className="flex items-center gap-3 text-sm text-muted py-6 justify-center" role="status">
    <span className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    {label}
  </div>
);

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString("vi-VN");
}

/** HTML do AI trả về (đã lọc ở server) — lọc lại bằng DOMPurify trước khi hiển thị xem trước. */
export async function safeHtml(html: string) {
  const DOMPurify = (await import("dompurify")).default;
  return DOMPurify.sanitize(html);
}
