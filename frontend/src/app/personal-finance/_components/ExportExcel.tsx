"use client";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { Modal } from "@/app/administrator/_components/ui";
import { daysInMonth, shiftMonth, START_DATE, vnd, type PfData } from "@/lib/personalFinance";
import { exportTransactionsXlsx, filterForExport, KIND_LABEL, totalsOf, type ExportKind, type ExportOpts } from "@/lib/personalFinanceExport";

const SELECT = "ui-input !py-2";
const KINDS: ExportKind[] = ["ALL", "INCOME", "EXPENSE"];
const toast = (icon: "success" | "warning" | "error", title: string) =>
  Swal.fire({ toast: true, position: "top-end", icon, title, showConfirmButton: false, timer: 3000 });

const monthRange = (m: string, today: string) => {
  const end = `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
  return { from: m < START_DATE.slice(0, 7) ? START_DATE : `${m}-01`, to: end > today ? today : end };
};

export default function ExportExcel({ data, month, className = "" }: { data: PfData; month: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={`btn-outline px-4 py-2 cursor-pointer ${className}`}>Xuất Excel</button>
      {open && <ExportModal data={data} month={month} onClose={() => setOpen(false)} />}
    </>
  );
}

function ExportModal({ data, month, onClose }: { data: PfData; month: string; onClose: () => void }) {
  const today = data.today;
  const init = monthRange(month, today);
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [kind, setKind] = useState<ExportKind>("ALL");
  const [bigId, setBigId] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<"ASC" | "DESC">("ASC");
  const [summary, setSummary] = useState(true);
  const [busy, setBusy] = useState(false);

  const bigs = useMemo(() => data.categories.filter((c) => !c.parentId && (kind === "ALL" || c.type === kind)), [data.categories, kind]);
  const curBig = bigs.some((c) => c.id === bigId) ? bigId : ""; // đổi loại → danh mục không hợp thì coi như "tất cả"
  const opts: ExportOpts = { from, to, kind, bigId: curBig, search, order, summary };
  const rangeOk = !!from && !!to && from <= to;
  const rows = useMemo(() => (rangeOk ? filterForExport(data, opts) : []), [data, from, to, kind, curBig, search, order, rangeOk]); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = totalsOf(rows);

  const presets: [string, () => void][] = [
    ["Tháng này", () => { const r = monthRange(today.slice(0, 7), today); setFrom(r.from); setTo(r.to); }],
    ["Tháng trước", () => { const m = shiftMonth(today.slice(0, 7), -1); const r = monthRange(m, today); setFrom(r.from); setTo(r.to); }],
    ["Đang xem (" + month.slice(5) + "/" + month.slice(0, 4) + ")", () => { const r = monthRange(month, today); setFrom(r.from); setTo(r.to); }],
    ["Năm nay", () => { setFrom(today.slice(0, 4) >= START_DATE.slice(0, 4) && `${today.slice(0, 4)}-01-01` > START_DATE ? `${today.slice(0, 4)}-01-01` : START_DATE); setTo(today); }],
    ["Toàn bộ sổ", () => { setFrom(START_DATE); setTo(today); }],
  ];

  const run = async () => {
    if (!rangeOk) return toast("warning", "Khoảng ngày chưa hợp lệ (từ ngày phải ≤ đến ngày)");
    if (!rows.length) return toast("warning", "Không có giao dịch nào khớp bộ lọc");
    setBusy(true);
    try {
      const r = await exportTransactionsXlsx(data, opts);
      toast("success", `Đã xuất ${r.rows} giao dịch: ${r.fileName}`);
      onClose();
    } catch (e: any) { toast("error", e?.message || "Không xuất được file"); } finally { setBusy(false); }
  };

  return (
    <Modal title="Xuất giao dịch ra Excel" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="ui-label">Khoảng thời gian</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">Từ ngày
              <input type="date" value={from} min={START_DATE} max={to || today} onChange={(e) => setFrom(e.target.value)} className={`${SELECT} w-full mt-1`} />
            </label>
            <label className="text-xs text-muted">Đến ngày
              <input type="date" value={to} min={from || START_DATE} onChange={(e) => setTo(e.target.value)} className={`${SELECT} w-full mt-1`} />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {presets.map(([l, fn]) => <button key={l} type="button" onClick={fn} className="ui-chip text-xs cursor-pointer">{l}</button>)}
          </div>
        </div>

        <div>
          <p className="ui-label">Loại giao dịch</p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => <button key={k} type="button" onClick={() => setKind(k)} className={`ui-chip cursor-pointer ${kind === k ? "ui-chip-active" : ""}`}>{KIND_LABEL[k]}</button>)}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-muted">Danh mục lớn
            <select value={curBig} onChange={(e) => setBigId(e.target.value)} className={`${SELECT} w-full mt-1`}>
              <option value="">Tất cả danh mục</option>
              {bigs.map((c) => <option key={c.id} value={c.id}>{c.type === "INCOME" ? "Thu" : "Chi"} · {c.name}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted">Tìm theo chi tiết / danh mục
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Để trống = lấy hết" className={`${SELECT} w-full mt-1`} />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={order === "DESC"} onChange={(e) => setOrder(e.target.checked ? "DESC" : "ASC")} /> Mới nhất lên đầu</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={summary} onChange={(e) => setSummary(e.target.checked)} /> Thêm sheet tổng hợp (theo danh mục, theo ngày)</label>
        </div>

        <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm">
          {!rangeOk ? <p className="text-red-700 font-semibold">Khoảng ngày chưa hợp lệ.</p> : (
            <>
              <p><b>{rows.length}</b> giao dịch sẽ được xuất{rows.length === 0 && " — hãy nới bộ lọc"}.</p>
              {rows.length > 0 && (
                <p className="mt-1 text-xs flex flex-wrap gap-x-4">
                  {kind !== "EXPENSE" && <span className="text-emerald-700">Thu: <b>{vnd(tot.income)}</b></span>}
                  {kind !== "INCOME" && <span className="text-red-700">Chi: <b>{vnd(tot.expense)}</b></span>}
                  {kind === "ALL" && <span className={tot.net >= 0 ? "text-emerald-700" : "text-red-700"}>Chênh lệch: <b>{vnd(tot.net)}</b></span>}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-outline px-5 py-2 cursor-pointer">Huỷ</button>
          <button onClick={run} disabled={busy || !rangeOk || rows.length === 0} className="btn-primary px-6 py-2 cursor-pointer disabled:opacity-40">{busy ? "Đang xuất..." : "Tải file .xlsx"}</button>
        </div>
      </div>
    </Modal>
  );
}
