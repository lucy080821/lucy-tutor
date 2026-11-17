"use client";
// Các mảnh giao diện của dashboard tối /personal-finance: icon, thẻ KPI, thẻ số dư, danh sách giao dịch gần đây, ô ghi nhanh.
import { useMemo } from "react";
import { categoryLabel, bigOf, dayLabel, monthLabel, SERIES_COLORS, START_DATE, vnd, type MonthRow, type PfData, type PfTx } from "@/lib/personalFinance";
import { isTemp, type PfStore } from "./usePfData";
import { TxForm } from "./Transactions";

export type IconName = "grid" | "swap" | "wallet" | "tag" | "spark" | "chat" | "plus" | "up" | "down" | "piggy" | "chevL" | "chevR" | "shield" | "logout";

const PATHS: Record<IconName, React.ReactNode> = {
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.8" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.8" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.8" /></>,
  swap: <><path d="M7 4v14M7 4 3.5 7.5M7 4l3.5 3.5" /><path d="M17 20V6M17 20l-3.5-3.5M17 20l3.5-3.5" /></>,
  wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="3.5" y="8" width="17" height="11.5" rx="2.5" /><circle cx="16.5" cy="13.8" r="1.2" fill="currentColor" stroke="none" /></>,
  tag: <><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-6 6a1.5 1.5 0 0 1-2.1 0z" /><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" /></>,
  spark: <path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z" />,
  chat: <path d="M4 5.5h16v11H9.5L5 20v-3.5H4z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  up: <path d="M7 17 17 7M9 7h8v8" />,
  down: <path d="M7 7l10 10M17 9v8H9" />,
  piggy: <><path d="M5 11.5C5 8.5 8 6.5 11.5 6.5c1.6 0 3 .4 4.2 1.1L19 6.5v3.2c.7.7 1 1.5 1 2.3v2.2h-2l-.8 2.3H14l-.5-1.2h-3l-.5 1.2H7l-.8-2.6C5.4 13.2 5 12.4 5 11.5z" /><circle cx="14.8" cy="10.6" r=".9" fill="currentColor" stroke="none" /></>,
  chevL: <path d="M14.5 6 8.5 12l6 6" />,
  chevR: <path d="M9.5 6l6 6-6 6" />,
  shield: <path d="M12 3.5 5 6.2v5.3c0 4.2 2.9 7.4 7 9 4.1-1.6 7-4.8 7-9V6.2z" />,
  logout: <><path d="M10 4.5H6.5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1H10" /><path d="M14.5 8l4 4-4 4M18.5 12H9.5" /></>,
};

export function Icon({ name, className = "w-5 h-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{PATHS[name]}</svg>
  );
}

const fmtPct = (n: number) => `${Math.abs(n).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

/** Thẻ KPI: ô nổi bật (nền gradient xanh) hoặc ô thường, có icon + so sánh với tháng trước */
export function StatCard({ label, value, hint, icon, featured = false, delta, invertDelta = false, tone = "default" }: {
  label: string; value: string; hint?: string; icon: IconName; featured?: boolean;
  delta?: number | null; invertDelta?: boolean; tone?: "default" | "good" | "bad";
}) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const good = hasDelta ? (invertDelta ? (delta as number) <= 0 : (delta as number) >= 0) : true;
  return (
    <div className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-4 min-w-0 ${featured ? "bg-gradient-to-br from-[#3d6bff] to-[#2442c2] text-white shadow-[0_12px_30px_rgba(61,107,255,.35)]" : "ui-card"}`}>
      {featured && <span aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />}
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${featured ? "bg-white/20 text-white" : "bg-primary-soft text-primary"}`}><Icon name={icon} className="w-[18px] h-[18px]" /></span>
        <p className={`text-xs sm:text-sm font-semibold truncate ${featured ? "text-white/85" : "text-muted"}`}>{label}</p>
      </div>
      <p className={`mt-3 text-[1.05rem] sm:text-2xl font-extrabold leading-tight break-words ${featured ? "text-white" : tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-700" : "text-foreground"}`}>{value}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-h-[1.25rem]">
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${featured ? "bg-white/20 text-white" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
            <Icon name={(delta as number) >= 0 ? "up" : "down"} className="w-3 h-3" />{fmtPct(delta as number)}
          </span>
        )}
        {hint && <span className={`text-[11px] sm:text-xs ${featured ? "text-white/75" : "text-muted"}`}>{hint}</span>}
      </div>
    </div>
  );
}

/** Thẻ "ngân hàng" số dư (cột phải / đầu trang trên điện thoại) */
export function BalanceCard({ cur, month, name }: { cur?: MonthRow; month: string; name: string }) {
  const closing = cur?.closing ?? 0;
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white bg-gradient-to-br from-[#3d6bff] via-[#3158e6] to-[#1f3aa8] shadow-[0_14px_34px_rgba(61,107,255,.35)]">
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -left-10 -bottom-16 h-36 w-36 rounded-full bg-black/10" />
      <div className="relative flex items-start justify-between">
        <span className="flex h-8 w-11 items-center justify-center rounded-md bg-gradient-to-br from-amber-200 to-amber-400" aria-hidden>
          <span className="h-4 w-6 rounded-sm border border-amber-600/50" />
        </span>
        <span className="text-xs font-bold tracking-[.2em] text-white/80">VND</span>
      </div>
      <p className="relative mt-5 text-xs font-semibold uppercase tracking-wider text-white/75">Số dư cuối kỳ</p>
      <p className={`relative text-2xl sm:text-[1.75rem] font-extrabold leading-tight break-words ${closing < 0 ? "text-rose-200" : ""}`}>{vnd(closing)}</p>
      <div className="relative mt-5 flex items-end justify-between gap-3 text-xs">
        <div className="min-w-0"><p className="text-white/60">Chủ sổ</p><p className="font-bold text-sm truncate">{name}</p></div>
        <div className="text-right shrink-0"><p className="text-white/60">Kỳ</p><p className="font-bold text-sm">{monthLabel(month).replace("Tháng ", "")}</p></div>
      </div>
    </div>
  );
}

/** Tóm tắt nhanh trong tháng (dưới thẻ số dư) */
export function QuickBalance({ cur }: { cur?: MonthRow }) {
  const net = (cur?.income ?? 0) - (cur?.expense ?? 0);
  const rows: [string, string, string][] = [
    ["Đầu kỳ", vnd(cur?.opening ?? 0), "text-foreground"],
    ["Thu nhập", `+${vnd(cur?.income ?? 0)}`, "text-emerald-700"],
    ["Chi tiêu", `−${vnd(cur?.expense ?? 0)}`, "text-red-600"],
    ["Quỹ tiết kiệm", vnd(cur?.savingsTotal ?? 0), "text-amber-800"],
  ];
  return (
    <div className="ui-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Tóm tắt tháng</h3>
        <span className={`ui-badge ${net >= 0 ? "!bg-emerald-50 !text-emerald-700" : "!bg-red-50 !text-red-700"}`}>{net >= 0 ? "Đang dư" : "Đang âm"}</span>
      </div>
      <p className={`mt-2 text-xl font-extrabold ${net >= 0 ? "text-emerald-700" : "text-red-600"}`}>{net > 0 ? "+" : net < 0 ? "−" : ""}{vnd(Math.abs(net))}</p>
      <p className="text-xs text-muted">Thu − chi trong tháng</p>
      <dl className="mt-3 divide-y divide-line text-sm">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2"><dt className="text-muted">{k}</dt><dd className={`font-bold ${c}`}>{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

/** Ghi nhanh giao dịch (cột phải trên máy tính; hộp thoại trên điện thoại) */
export function QuickAdd({ store, data, uid, onDone }: { store: PfStore; data: PfData; uid: string; onDone?: () => void }) {
  const date = data.today < START_DATE ? START_DATE : data.today;
  return (
    <TxForm key={data.categories.length === 0 ? "empty" : "form"} compact uid={uid} store={store} data={data} resetAfter submitLabel="Lưu giao dịch"
      initial={{ type: "EXPENSE", date, amount: "", bigId: "", subId: "", detail: "" }}
      onSubmit={async (input) => { const ok = await store.addTx(input); if (ok) onDone?.(); return ok; }} />
  );
}

/** Giao dịch gần đây: bảng trên máy tính, danh sách thẻ trên điện thoại */
export function RecentTransactions({ data, month, limit = 8, onSeeAll }: { data: PfData; month: string; limit?: number; onSeeAll: () => void }) {
  const byId = useMemo(() => new Map(data.categories.map((c) => [c.id, c])), [data.categories]);
  const bigIndex = useMemo(() => new Map(data.categories.filter((c) => !c.parentId).map((c, i) => [c.id, i])), [data.categories]);
  const list = useMemo(() => {
    const all = data.transactions.filter((t) => t.date.startsWith(month));
    return all.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1)).slice(0, limit);
  }, [data.transactions, month, limit]);
  const total = useMemo(() => data.transactions.filter((t) => t.date.startsWith(month)).length, [data.transactions, month]);

  const row = (t: PfTx) => {
    const c = byId.get(t.categoryId);
    const big = c ? bigOf(c, byId) : undefined;
    const color = SERIES_COLORS[(big ? bigIndex.get(big.id) ?? 0 : 0) % SERIES_COLORS.length];
    const income = t.type === "INCOME";
    return (
      <li key={t.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_90px_130px_70px] items-center gap-x-3 gap-y-0.5 py-2.5 ${isTemp(t.id) ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3 min-w-0 md:col-span-1 col-span-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: `${color}26`, color }}>{(big?.name ?? "?").charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{categoryLabel(c, byId)}</p>
            <p className="md:hidden text-xs text-muted truncate">{t.detail || "—"} · {dayLabel(t.date)}</p>
          </div>
        </div>
        <p className="hidden md:block text-sm text-muted truncate">{t.detail || "—"}</p>
        <p className="hidden md:block text-sm text-muted">{dayLabel(t.date)}</p>
        <p className={`text-sm font-bold text-right md:text-left ${income ? "text-emerald-700" : "text-foreground"}`}>{income ? "+" : "−"}{vnd(t.amount)}</p>
        <span className={`hidden md:inline-flex justify-center rounded-full px-2 py-0.5 text-[11px] font-bold ${income ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{income ? "Thu" : "Chi"}</span>
      </li>
    );
  };

  return (
    <section className="ui-card p-4 sm:p-5 min-w-0">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold text-foreground text-base sm:text-lg">Giao dịch gần đây <span className="text-muted font-normal text-sm">({list.length}/{total})</span></h2>
        <button onClick={onSeeAll} className="text-sm font-bold text-primary cursor-pointer px-2 py-1 hover:underline">Xem tất cả</button>
      </div>
      {list.length === 0 ? <p className="py-8 text-center text-sm text-muted">Tháng này chưa có giao dịch nào.</p> : (
        <>
          <div className="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_90px_130px_70px] gap-x-3 mt-3 pb-2 border-b border-line text-[11px] font-bold uppercase tracking-wide text-muted">
            <span>Danh mục</span><span>Chi tiết</span><span>Ngày</span><span>Số tiền</span><span className="text-center">Loại</span>
          </div>
          <ul className="divide-y divide-line mt-1 md:mt-0">{list.map(row)}</ul>
        </>
      )}
    </section>
  );
}
