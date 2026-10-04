"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import {
  adminFetch, AdminAuthError, formatVND, formatVNDate, pctChange, vnDateKey,
  type FinanceSummary, type Transaction, type TxType,
} from "@/lib/adminApi";
import { ErrorBlock, KpiCard, LoadingBlock, Modal, SectionCard } from "./ui";

const FinanceYearChart = dynamic(() => import("./AdminCharts").then((m) => m.FinanceYearChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

// Gợi ý danh mục khi chưa nhập lần nào; danh mục đã dùng lấy từ /finance/categories, xếp trước
const DEFAULT_CATEGORIES: Record<TxType, string[]> = {
  INCOME: ["Học phí", "Khoá học online", "Dạy kèm", "Tài trợ / hợp tác", "Khác"],
  EXPENSE: ["Server / hosting", "Tên miền", "Supabase", "AI (Groq...)", "Marketing / quảng cáo", "Lương / cộng tác viên", "Thuê phòng", "Tài liệu / sách", "Khác"],
};
const TYPE_LABEL: Record<TxType, string> = { INCOME: "Thu nhập", EXPENSE: "Chi phí" };

const todayVN = () => vnDateKey(new Date().toISOString());
const pad = (n: number) => String(n).padStart(2, "0");

type FormState = { id?: string; type: TxType; category: string; amount: string; date: string; note: string; recurring: boolean };

export default function FinanceTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [nowYear, nowMonth] = todayVN().split("-").map(Number);
  const [year, setYear] = useState(nowYear);
  const [month, setMonth] = useState(nowMonth);
  // Gắn kèm năm/tháng đã tải: đổi tháng thì dữ liệu cũ tự thành "đang tải" (null) cho tới khi dữ liệu mới về
  const [summaryState, setSummaryState] = useState<{ year: number; data: FinanceSummary } | null>(null);
  const [txState, setTxState] = useState<{ key: string; list: Transaction[] } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [categories, setCategories] = useState<Record<TxType, string[]>>({ INCOME: [], EXPENSE: [] });
  const [filter, setFilter] = useState<"ALL" | TxType>("ALL");
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else setError((err as Error).message);
  }, [onAuthLost]);

  const txKey = `${year}-${month}`;
  const summary = summaryState?.year === year ? summaryState.data : null;
  const transactions = txState?.key === txKey ? txState.list : null;
  const reload = () => setReloadTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;
    adminFetch<FinanceSummary>(`/finance/summary?year=${year}`)
      .then((data) => { if (!cancelled) setSummaryState({ year, data }); })
      .catch((err) => { if (!cancelled) handleError(err); });
    return () => { cancelled = true; };
  }, [year, reloadTick, handleError]);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ transactions: Transaction[] }>(`/finance/transactions?year=${year}&month=${month}`)
      .then((data) => { if (!cancelled) setTxState({ key: `${year}-${month}`, list: data.transactions }); })
      .catch((err) => { if (!cancelled) handleError(err); });
    return () => { cancelled = true; };
  }, [year, month, reloadTick, handleError]);

  useEffect(() => {
    let cancelled = false;
    adminFetch<Record<TxType, string[]>>("/finance/categories")
      .then((data) => { if (!cancelled) setCategories(data); })
      .catch((err) => { if (!cancelled) handleError(err); });
    return () => { cancelled = true; };
  }, [reloadTick, handleError]);

  const reloadAll = () => { setError(""); reload(); };

  const current = summary?.months[month - 1];
  const prev = summary && month > 1 ? summary.months[month - 2] : null;
  const margin = current && current.income > 0 ? (current.profit / current.income) * 100 : null;

  const filtered = useMemo(
    () => (transactions || []).filter((t) => filter === "ALL" || t.type === filter),
    [transactions, filter],
  );

  // Cơ cấu thu/chi theo danh mục của tháng đang xem
  const breakdown = useMemo(() => {
    const out: Record<TxType, { category: string; amount: number }[]> = { INCOME: [], EXPENSE: [] };
    for (const type of ["INCOME", "EXPENSE"] as TxType[]) {
      const map = new Map<string, number>();
      (transactions || []).filter((t) => t.type === type).forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
      out[type] = [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
    }
    return out;
  }, [transactions]);

  const chartData = useMemo(
    () => (summary?.months || []).map((m) => ({ name: `T${m.month}`, income: m.income, expense: m.expense, profit: m.profit })),
    [summary],
  );

  // Ngày mặc định khi thêm khoản: hôm nay nếu đang xem tháng hiện tại, không thì ngày 1 của tháng đang xem
  const defaultDate = () => (year === nowYear && month === nowMonth ? todayVN() : `${year}-${pad(month)}-01`);

  const openNew = (type: TxType) => setForm({ type, category: "", amount: "", date: defaultDate(), note: "", recurring: false });
  const openEdit = (t: Transaction) => setForm({
    id: t.id, type: t.type, category: t.category, amount: t.amount.toLocaleString("vi-VN"),
    date: vnDateKey(t.date), note: t.note || "", recurring: t.recurring,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const amount = Number(form.amount.replace(/\D/g, ""));
    if (!amount) { Swal.fire("Thiếu số tiền", "Vui lòng nhập số tiền lớn hơn 0.", "warning"); return; }
    setSaving(true);
    try {
      const body = JSON.stringify({ type: form.type, category: form.category, amount, date: form.date, note: form.note, recurring: form.recurring });
      if (form.id) await adminFetch(`/finance/transactions/${form.id}`, { method: "PUT", body });
      else await adminFetch("/finance/transactions", { method: "POST", body });
      // Khoản vừa lưu thuộc tháng khác -> chuyển sang tháng đó để thấy ngay
      const [y, m] = form.date.split("-").map(Number);
      setForm(null);
      if (y !== year || m !== month) { setYear(y); setMonth(m); }
      reload();
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không lưu được", (err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t: Transaction) => {
    const ok = await Swal.fire({
      title: "Xoá khoản này?",
      text: `${TYPE_LABEL[t.type]} · ${t.category} · ${formatVND(t.amount)}`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    try {
      await adminFetch(`/finance/transactions/${t.id}`, { method: "DELETE" });
      setTxState((s) => (s ? { ...s, list: s.list.filter((x) => x.id !== t.id) } : s));
      reload();
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không xoá được", (err as Error).message, "error");
    }
  };

  const copyRecurring = async () => {
    const prevLabel = month === 1 ? `12/${year - 1}` : `${month - 1}/${year}`;
    const ok = await Swal.fire({
      title: "Chép khoản cố định?",
      text: `Chép các khoản được đánh dấu "cố định hàng tháng" của tháng ${prevLabel} sang tháng ${month}/${year}. Khoản đã có rồi sẽ được bỏ qua.`,
      icon: "question", showCancelButton: true, confirmButtonText: "Chép", cancelButtonText: "Huỷ",
    });
    if (!ok.isConfirmed) return;
    try {
      const r = await adminFetch<{ created: number; skipped: number }>("/finance/copy-recurring", {
        method: "POST", body: JSON.stringify({ year, month }),
      });
      Swal.fire(
        r.created ? "Đã chép" : "Không có gì để chép",
        r.created
          ? `Đã thêm ${r.created} khoản${r.skipped ? `, bỏ qua ${r.skipped} khoản đã có` : ""}.`
          : r.skipped ? "Các khoản cố định đã có sẵn trong tháng này." : `Tháng ${prevLabel} chưa có khoản nào được đánh dấu cố định hàng tháng.`,
        r.created ? "success" : "info",
      );
      if (r.created) reload();
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không chép được", (err as Error).message, "error");
    }
  };

  const categoryOptions = form
    ? [...new Set([...categories[form.type], ...DEFAULT_CATEGORIES[form.type]])]
    : [];

  return (
    <div className="space-y-6">
      {error && <ErrorBlock message={error} onRetry={reloadAll} />}

      {/* Chọn năm + tháng */}
      <div className="ui-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setYear((y) => y - 1)} aria-label="Năm trước" className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary cursor-pointer">‹</button>
            <span className="font-extrabold text-primary text-lg w-16 text-center">{year}</span>
            <button onClick={() => setYear((y) => y + 1)} aria-label="Năm sau" className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary cursor-pointer">›</button>
          </div>
          {(year !== nowYear || month !== nowMonth) && (
            <button onClick={() => { setYear(nowYear); setMonth(nowMonth); }} className="btn-ghost px-3 py-2 text-sm cursor-pointer">Về tháng này</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <button key={m} onClick={() => setMonth(m)} className={`ui-chip ${m === month ? "ui-chip-active" : ""}`}>Tháng {m}</button>
          ))}
        </div>
      </div>

      {/* KPI tháng đang xem */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label={`Thu nhập T${month}`} value={current ? formatVND(current.income) : "…"}
          delta={current && prev ? pctChange(current.income, prev.income) : null} hint={prev ? "so với tháng trước" : undefined} />
        <KpiCard label={`Chi phí T${month}`} value={current ? formatVND(current.expense) : "…"} invertDelta
          delta={current && prev ? pctChange(current.expense, prev.expense) : null} hint={prev ? "so với tháng trước" : undefined} />
        <KpiCard label={`Lợi nhuận T${month}`} value={current ? formatVND(current.profit) : "…"}
          tone={!current ? "default" : current.profit >= 0 ? "good" : "bad"}
          delta={current && prev ? pctChange(current.profit, prev.profit) : null} hint={prev ? "so với tháng trước" : undefined} />
        <KpiCard label="Biên lợi nhuận" value={margin === null ? "—" : `${margin.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`}
          tone={margin === null ? "default" : margin >= 0 ? "good" : "bad"} hint="Lợi nhuận / thu nhập" />
      </div>

      {/* Khoản thu chi trong tháng + cơ cấu */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SectionCard title={`Sổ thu chi tháng ${month}/${year}`} className="xl:col-span-2"
          actions={(
            <>
              <button onClick={() => openNew("INCOME")} className="btn-primary px-4 py-2 text-sm cursor-pointer">+ Khoản thu</button>
              <button onClick={() => openNew("EXPENSE")} className="btn-outline px-4 py-2 text-sm cursor-pointer">+ Khoản chi</button>
              <button onClick={copyRecurring} className="btn-ghost px-3 py-2 text-sm cursor-pointer">Chép khoản cố định tháng trước</button>
            </>
          )}>
          <div className="flex flex-wrap gap-2 mb-4">
            {(["ALL", "INCOME", "EXPENSE"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`ui-chip ${filter === f ? "ui-chip-active" : ""}`}>
                {f === "ALL" ? "Tất cả" : TYPE_LABEL[f]}
              </button>
            ))}
          </div>
          {transactions === null ? <LoadingBlock /> : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">Chưa có khoản nào trong tháng này. Bấm &quot;+ Khoản thu&quot; hoặc &quot;+ Khoản chi&quot; để thêm.</p>
          ) : (
            <ul className="divide-y divide-line">
              {filtered.map((t) => (
                <li key={t.id} className="py-3 flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 text-[11px] font-bold rounded-full px-2 py-0.5 ${t.type === "INCOME" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {t.type === "INCOME" ? "Thu" : "Chi"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground break-words">
                      {t.category}
                      {t.recurring && <span className="ui-badge ml-2 align-middle">Cố định hàng tháng</span>}
                    </p>
                    <p className="text-xs text-muted mt-0.5 break-words">{formatVNDate(t.date)}{t.note ? ` · ${t.note}` : ""}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold ${t.type === "INCOME" ? "text-emerald-700" : "text-red-700"}`}>
                      {t.type === "INCOME" ? "+" : "−"}{formatVND(t.amount)}
                    </p>
                    <div className="flex justify-end gap-1 mt-1">
                      <button onClick={() => openEdit(t)} className="text-xs font-semibold text-primary hover:underline px-2 py-1.5 cursor-pointer">Sửa</button>
                      <button onClick={() => remove(t)} className="text-xs font-semibold text-red-600 hover:underline px-2 py-1.5 cursor-pointer">Xoá</button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Cơ cấu theo danh mục" subtitle={`Tháng ${month}/${year}`}>
          {(["EXPENSE", "INCOME"] as TxType[]).map((type) => {
            const rows = breakdown[type];
            const total = rows.reduce((s, r) => s + r.amount, 0);
            return (
              <div key={type} className="mb-5 last:mb-0">
                <p className="text-sm font-bold text-foreground mb-2">{TYPE_LABEL[type]} <span className="text-muted font-normal">· {formatVND(total)}</span></p>
                {rows.length === 0 ? <p className="text-xs text-muted">Chưa có</p> : (
                  <ul className="space-y-2">
                    {rows.map((r) => (
                      <li key={r.category}>
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="text-foreground truncate">{r.category}</span>
                          <span className="text-muted shrink-0">{formatVND(r.amount)} · {Math.round((r.amount / total) * 100)}%</span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-primary-soft overflow-hidden">
                          <div className={`h-full ${type === "INCOME" ? "bg-primary" : "bg-[#3b82f6]"}`} style={{ width: `${(r.amount / total) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </SectionCard>
      </div>

      {/* Cả năm */}
      <SectionCard title={`Thu chi & lợi nhuận năm ${year}`} subtitle="Bấm vào 1 tháng trên biểu đồ hoặc trong bảng để xem chi tiết">
        <div className="h-72 mb-6"><FinanceYearChart data={chartData} onSelect={(i) => setMonth(i + 1)} /></div>
        {!summary ? <LoadingBlock /> : (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="ui-table min-w-[640px] text-sm">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th className="!text-right">Thu nhập</th>
                  <th className="!text-right">Chi phí</th>
                  <th className="!text-right">Lợi nhuận</th>
                  <th className="!text-right" title="Học phí theo lớp + học viên tự do ghi nhận trong app — không cộng vào lợi nhuận">Học phí trong app*</th>
                </tr>
              </thead>
              <tbody>
                {summary.months.map((m) => (
                  <tr key={m.month} onClick={() => setMonth(m.month)} className={`cursor-pointer ${m.month === month ? "[&>td]:!bg-primary-soft" : ""}`}>
                    <td className="font-semibold">Tháng {m.month}</td>
                    <td className="text-right">{formatVND(m.income)}</td>
                    <td className="text-right">{formatVND(m.expense)}</td>
                    <td className={`text-right font-bold ${m.profit > 0 ? "text-emerald-700" : m.profit < 0 ? "text-red-700" : ""}`}>{formatVND(m.profit)}</td>
                    <td className="text-right text-muted">{formatVND(m.appTuition + m.appFreeStudent)}</td>
                  </tr>
                ))}
                <tr className="[&>td]:font-extrabold [&>td]:bg-[#f7f9fc]">
                  <td>Cả năm</td>
                  <td className="text-right">{formatVND(summary.total.income)}</td>
                  <td className="text-right">{formatVND(summary.total.expense)}</td>
                  <td className={`text-right ${summary.total.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>{formatVND(summary.total.profit)}</td>
                  <td className="text-right text-muted">{formatVND(summary.total.appTuition + summary.total.appFreeStudent)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted mt-3">
          * Học phí giáo viên đã xác nhận thu trong app (học phí theo lớp + học viên tự do), chỉ để tham khảo — <b>không</b> cộng vào thu nhập/lợi nhuận.
          Muốn tính vào lợi nhuận thì nhập thành 1 khoản thu.
        </p>
      </SectionCard>

      {form && (
        <Modal title={`${form.id ? "Sửa" : "Thêm"} ${TYPE_LABEL[form.type].toLowerCase()}`} onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4">
            <div className="flex gap-2">
              {(["INCOME", "EXPENSE"] as TxType[]).map((type) => (
                <button type="button" key={type} onClick={() => setForm({ ...form, type })}
                  className={`ui-chip flex-1 justify-center ${form.type === type ? "ui-chip-active" : ""}`}>{TYPE_LABEL[type]}</button>
              ))}
            </div>
            <div>
              <label htmlFor="tx-category" className="ui-label">Danh mục</label>
              <input id="tx-category" list="tx-category-options" required maxLength={60} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })} className="ui-input"
                placeholder={form.type === "INCOME" ? "Vd: Học phí, Dạy kèm..." : "Vd: Server / hosting, Marketing..."} />
              <datalist id="tx-category-options">
                {categoryOptions.map((c) => <option key={c} value={c} />)}
              </datalist>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {categoryOptions.slice(0, 8).map((c) => (
                  <button type="button" key={c} onClick={() => setForm({ ...form, category: c })}
                    className="text-xs rounded-full border border-line px-2.5 py-1.5 text-muted hover:border-primary hover:text-primary cursor-pointer">{c}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="tx-amount" className="ui-label">Số tiền (VND)</label>
                <input id="tx-amount" inputMode="numeric" required value={form.amount} className="ui-input text-right font-bold"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
                    setForm({ ...form, amount: digits ? Number(digits).toLocaleString("vi-VN") : "" });
                  }} placeholder="0" />
              </div>
              <div>
                <label htmlFor="tx-date" className="ui-label">Ngày</label>
                <input id="tx-date" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="ui-input" />
              </div>
            </div>
            <div>
              <label htmlFor="tx-note" className="ui-label">Ghi chú <span className="text-muted font-normal">(tuỳ chọn)</span></label>
              <textarea id="tx-note" rows={2} maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="ui-input" />
            </div>
            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.recurring} onChange={(e) => setForm({ ...form, recurring: e.target.checked })} className="w-4 h-4 mt-0.5 accent-[#1e3a8a]" />
              <span>Khoản cố định hàng tháng <span className="block text-xs text-muted">Dùng nút &quot;Chép khoản cố định tháng trước&quot; để thêm lại vào tháng sau</span></span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setForm(null)} className="btn-ghost px-4 py-2 cursor-pointer">Huỷ</button>
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 cursor-pointer">{saving ? "Đang lưu..." : "Lưu"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
