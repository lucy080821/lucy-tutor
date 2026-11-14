"use client";
import { useEffect, type ReactNode } from "react";

// Hộp thoại dùng chung cho các panel của Nông Trại: bottom sheet trên mobile, hộp giữa màn hình trên desktop.
// (SweetAlert2 vẫn dùng cho xác nhận/thông báo đơn giản theo quy ước của app.)
export default function Modal({ title, subtitle, onClose, children, wide = false, footer }: {
  title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="farm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`farm-modal ${wide ? "farm-modal-wide" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-none border-b border-line px-5 py-3 flex items-start justify-between gap-3 z-10 rounded-t-[20px]">
          <div className="min-w-0">
            <h3 className="text-lg font-extrabold text-primary leading-tight">{title}</h3>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Đóng" className="w-10 h-10 shrink-0 rounded-full hover:bg-primary-soft text-muted hover:text-primary text-xl font-bold flex items-center justify-center">×</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 bg-white border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
