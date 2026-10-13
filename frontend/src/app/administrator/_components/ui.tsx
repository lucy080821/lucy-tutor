"use client";
import { useEffect } from "react";

type Tone = "default" | "good" | "bad";

const TONE_CLASS: Record<Tone, string> = {
  default: "text-foreground",
  good: "text-emerald-700",
  bad: "text-red-700",
};

// Thẻ KPI: nhãn, giá trị lớn, dòng phụ (so với kỳ trước...)
export function KpiCard({ label, value, hint, tone = "default", delta, invertDelta = false }: {
  label: string; value: string; hint?: string; tone?: Tone;
  delta?: number | null; // % thay đổi so với kỳ trước
  invertDelta?: boolean; // chi phí: tăng là xấu
}) {
  const up = (delta ?? 0) > 0;
  const good = invertDelta ? !up : up;
  return (
    <div className="ui-card p-4 sm:p-5 min-w-0">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-xl sm:text-2xl font-extrabold break-words ${TONE_CLASS[tone]}`}>{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
        {delta !== undefined && delta !== null && Number.isFinite(delta) && (
          <span className={`font-bold rounded-full px-2 py-0.5 ${delta === 0 ? "bg-slate-100 text-slate-600" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            {up ? "▲" : delta === 0 ? "" : "▼"} {Math.abs(delta).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}

export function SectionCard({ title, subtitle, actions, children, className = "" }: {
  title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <section className={`ui-card p-4 sm:p-6 min-w-0 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-primary">{title}</h2>
          {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

// Hộp thoại đơn giản (form thêm/sửa) — đóng bằng Esc, bấm nền hoặc nút ×
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-line sticky top-0 bg-white">
          <h3 className="font-bold text-primary text-lg">{title}</h3>
          <button onClick={onClose} aria-label="Đóng" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center text-xl cursor-pointer">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function LoadingBlock({ label = "Đang tải..." }: { label?: string }) {
  return <div className="py-10 text-center text-sm text-muted">{label}</div>;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-red-50 text-red-700 text-sm px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="font-bold underline cursor-pointer px-2 py-1">Thử lại</button>}
    </div>
  );
}

// Danh sách xếp hạng có thanh tỉ lệ (nguồn truy cập, trang phổ biến...) — gọn hơn biểu đồ tròn, đọc được số ngay
export function BarList({ items, valueLabel, empty = "Chưa có dữ liệu", format = (n: number) => n.toLocaleString("vi-VN") }: {
  items: { name: string; value: number; hint?: string }[]; valueLabel?: string; empty?: string; format?: (n: number) => string;
}) {
  if (!items.length) return <p className="text-sm text-muted py-4 text-center">{empty}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <div>
      {valueLabel && <p className="text-xs text-muted text-right mb-1">{valueLabel}</p>}
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.name} className="relative rounded-lg overflow-hidden" title={`${i.name}: ${format(i.value)}`}>
            <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary-soft" style={{ width: `${(i.value / max) * 100}%` }} />
            <span className="relative flex items-center justify-between gap-3 px-3 py-1.5 text-sm">
              <span className="min-w-0 truncate text-foreground">{i.name}{i.hint && <span className="text-muted"> · {i.hint}</span>}</span>
              <span className="shrink-0 font-bold text-foreground">
                {format(i.value)}
                <span className="font-normal text-muted text-xs ml-1.5">{total ? `${Math.round((i.value / total) * 100)}%` : ""}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Chọn khoảng thời gian (7/30/90 ngày) dạng chip
export function RangeChips<T extends number>({ value, options, onChange }: {
  value: T; options: T[]; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Khoảng thời gian">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} aria-pressed={o === value}
          className={`ui-chip cursor-pointer ${o === value ? "ui-chip-active" : ""}`}>{o} ngày</button>
      ))}
    </div>
  );
}
