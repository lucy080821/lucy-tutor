"use client";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { dayLabel, daysInMonth, monthLabel, parseMoney, signedVnd, START_DATE, vnd, type MonthRow, type PfData } from "@/lib/personalFinance";
import { isTemp, type PfStore } from "./usePfData";

// Tiết kiệm: nhập tay (gửi vào / rút ra) + câu hỏi cuối tháng "cộng số dư còn lại vào tiết kiệm không?".
// Khoản "lấy từ số dư tháng" bị trừ khỏi số dư cuối kỳ (và vì vậy không chuyển sang đầu kỳ tháng sau); khoản tiết kiệm có sẵn
// từ trước thì bỏ tick, không đụng số dư tháng. Backend: PfSaving trong personalFinance.routes.js.

const INPUT = "ui-input !py-2";
const skipKey = (month: string) => `pf_savings_skip_${month}`;
const readSkip = (month: string) => {
  try { return localStorage.getItem(skipKey(month)) === "1"; } catch { return false; }
};

/** Đã hết tháng (hoặc hôm nay là ngày cuối tháng) */
export const monthEnded = (month: string, today: string) => month < today.slice(0, 7) || (month === today.slice(0, 7) && Number(today.slice(8)) === daysInMonth(month));

/** Banner cuối tháng: còn dư thì hỏi có cộng vào tiết kiệm không (số tiền cộng nhập tay, mặc định = toàn bộ số dư). */
export function MonthEndPrompt({ store, data, month, cur }: { store: PfStore; data: PfData; month: string; cur?: MonthRow }) {
  const [skipped, setSkipped] = useState(() => readSkip(month));
  const [text, setText] = useState(() => (cur && cur.closing > 0 ? String(Math.round(cur.closing)) : ""));
  const [saving, setSaving] = useState(false);

  const already = data.savings.some((s) => s.source === "ROLLOVER" && s.date.startsWith(month));
  if (!cur || cur.closing <= 0 || !monthEnded(month, data.today) || already || skipped) return null;

  const amount = parseMoney(text);
  const valid = Number.isFinite(amount) && amount > 0 && amount <= cur.closing;

  const agree = async () => {
    if (!valid) return;
    setSaving(true);
    const ok = await store.addSaving({
      date: `${month}-${String(daysInMonth(month)).padStart(2, "0")}`, amount, fromCash: true, source: "ROLLOVER",
      note: `Cộng số dư cuối ${monthLabel(month).toLowerCase()}`,
    });
    setSaving(false);
    if (ok) Swal.fire({ toast: true, position: "top-end", icon: "success", title: `Đã cộng ${vnd(amount)} vào tiết kiệm`, showConfirmButton: false, timer: 2500 });
  };
  const skip = () => {
    try { localStorage.setItem(skipKey(month), "1"); } catch { /* bị chặn */ }
    setSkipped(true);
  };

  return (
    <section className="ui-card p-4 sm:p-5 ring-2 ring-emerald-300">
      <h2 className="font-bold text-primary">Cuối {monthLabel(month).toLowerCase()} bạn còn dư {vnd(cur.closing)}</h2>
      <p className="text-sm text-muted mt-0.5">Bạn có muốn cộng vào tiết kiệm không? Số tiền cộng tự nhập (đã điền sẵn toàn bộ số dư); phần còn lại chuyển sang đầu tháng sau.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" aria-label="Số tiền cộng vào tiết kiệm" className={`${INPUT} w-44 ${text && !valid ? "!border-red-400" : ""}`} />
        <button onClick={agree} disabled={!valid || saving} className="btn-primary px-5 py-2 cursor-pointer disabled:opacity-50">{saving ? "Đang lưu…" : "Đồng ý cộng vào tiết kiệm"}</button>
        <button onClick={skip} disabled={saving} className="btn-outline px-4 py-2 cursor-pointer">Không, giữ lại</button>
      </div>
      {text && <p className={`mt-2 text-xs ${valid ? "text-muted" : "text-red-600"}`}>{valid ? `= ${vnd(amount)}` : `Nhập số tiền lớn hơn 0 và không vượt quá ${vnd(cur.closing)}`}</p>}
    </section>
  );
}

export default function Savings({ store, data, month, rows }: { store: PfStore; data: PfData; month: string; rows: MonthRow[] }) {
  const cur = rows.find((r) => r.month === month);
  const defaultDate = useMemo(() => {
    const d = data.today.startsWith(month) ? data.today : `${month}-01`;
    return d < START_DATE ? START_DATE : d;
  }, [data.today, month]);
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [date, setDate] = useState(defaultDate);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [fromCash, setFromCash] = useState(true);
  const [busy, setBusy] = useState(false);

  const entries = useMemo(
    () => data.savings.filter((s) => s.date.startsWith(month)).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [data.savings, month],
  );
  const amount = parseMoney(text);
  const valid = Number.isFinite(amount) && amount > 0;
  const total = cur?.savingsTotal ?? rows[rows.length - 1]?.savingsTotal ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || date < START_DATE) return;
    setBusy(true);
    const ok = await store.addSaving({ date, amount: direction === "IN" ? amount : -amount, note: note.trim(), fromCash, source: "MANUAL" });
    setBusy(false);
    if (ok) { setText(""); setNote(""); }
  };

  const remove = async (id: string, label: string) => {
    const r = await Swal.fire({ title: "Xoá khoản tiết kiệm này?", text: label, icon: "warning", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Giữ lại", confirmButtonColor: "#dc2626" });
    if (r.isConfirmed) store.deleteSaving(id);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="ui-card p-4 sm:p-6 min-w-0">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">Quỹ tiết kiệm hiện có</p>
        <p className="mt-1 text-3xl font-extrabold text-primary break-words">{vnd(total)}</p>
        <p className="text-sm text-muted mt-1">Tháng này: {signedVnd(cur?.savedAll ?? 0)}</p>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <h2 className="text-lg font-bold text-primary">Ghi khoản tiết kiệm</h2>
          <div className="flex gap-2">
            {([["IN", "Gửi vào"], ["OUT", "Rút ra"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setDirection(k)} className={`ui-chip cursor-pointer ${direction === k ? "ui-chip-active" : ""}`}>{label}</button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="ui-label" htmlFor="sv-date">Ngày</label>
              <input id="sv-date" type="date" required min={START_DATE} value={date} onChange={(e) => setDate(e.target.value)} className={INPUT} />
            </div>
            <div>
              <label className="ui-label" htmlFor="sv-amount">Số tiền (50k, 2tr…)</label>
              <input id="sv-amount" inputMode="decimal" autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} className={INPUT} />
              {text && <p className={`mt-1 text-xs ${valid ? "text-muted" : "text-red-600"}`}>{valid ? `= ${vnd(amount)}` : "Chưa hiểu số tiền này"}</p>}
            </div>
          </div>
          <div>
            <label className="ui-label" htmlFor="sv-note">Ghi chú</label>
            <input id="sv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="vd: Gửi sổ tiết kiệm, quỹ dự phòng…" className={INPUT} />
          </div>
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={fromCash} onChange={(e) => setFromCash(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              {direction === "IN" ? "Lấy từ số dư tháng này" : "Trả về số dư tháng này"}
              <span className="block text-xs text-muted">{fromCash ? "Số dư cuối kỳ của tháng sẽ " + (direction === "IN" ? "giảm" : "tăng") + " đúng số tiền này." : "Bỏ tick nếu đây là tiền tiết kiệm có sẵn — không ảnh hưởng số dư tháng."}</span>
            </span>
          </label>
          <button type="submit" disabled={busy || !valid} className="btn-primary px-6 py-2.5 cursor-pointer disabled:opacity-60">{busy ? "Đang lưu…" : "Lưu"}</button>
        </form>
      </section>

      <section className="ui-card p-4 sm:p-6 min-w-0">
        <h2 className="text-lg font-bold text-primary mb-3">Lịch sử tiết kiệm — {monthLabel(month)}</h2>
        {entries.length === 0 ? <p className="py-10 text-center text-sm text-muted">Tháng này chưa có khoản tiết kiệm nào.</p> : (
          <ul className="divide-y divide-line">
            {entries.map((s) => (
              <li key={s.id} className={`py-2.5 flex items-start gap-3 ${isTemp(s.id) ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{dayLabel(s.date)} · {s.amount > 0 ? "Gửi vào" : "Rút ra"}
                    {s.source === "ROLLOVER" && <span className="ui-badge ml-2">Cuối tháng</span>}
                    {!s.fromCash && <span className="ui-badge ml-2">Có sẵn</span>}
                  </p>
                  {s.note && <p className="text-sm text-muted break-words">{s.note}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-bold text-sm ${s.amount > 0 ? "text-emerald-700" : "text-red-700"}`}>{signedVnd(s.amount)}</p>
                  {!isTemp(s.id) && <button onClick={() => remove(s.id, `${signedVnd(s.amount)} · ${dayLabel(s.date)}`)} className="text-xs font-bold text-red-600 px-2 py-1.5 cursor-pointer">Xoá</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
