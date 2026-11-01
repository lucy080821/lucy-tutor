"use client";
import { useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Modal } from "@/app/administrator/_components/ui";
import {
  categoryLabel, fullDayLabel, parseMoney, signedVnd, START_DATE, vnd,
  type PfCategory, type PfData, type PfTx, type PfType, type TxInput,
} from "@/lib/personalFinance";
import { isTemp, type PfStore } from "./usePfData";

const SELECT = "ui-input !py-2";

/** Chọn danh mục lớn › danh mục nhỏ; gõ tên mới + Enter là thêm ngay (hiện tức thì, lưu server ngầm). */
function CategoryPicker({ store, categories, type, bigId, subId, onChange }: {
  store: PfStore; categories: PfCategory[]; type: PfType; bigId: string; subId: string;
  onChange: (bigId: string, subId: string) => void;
}) {
  const [adding, setAdding] = useState<"big" | "sub" | null>(null);
  const [name, setName] = useState("");
  const bigs = categories.filter((c) => c.type === type && !c.parentId);
  const subs = categories.filter((c) => c.parentId === bigId);

  const submitNew = async () => {
    const value = name.trim();
    if (!value || !adding) return;
    const kind = adding;
    setName("");
    setAdding(null);
    const res = await store.addCategory(kind === "big" ? { name: value, type } : { name: value, parentId: bigId });
    if (!res) return;
    const { category, ready } = res;
    if (kind === "big") onChange(category.id, ""); else onChange(bigId, category.id);
    ready.then((real) => {
      if (real.id === category.id) return;
      // id tạm -> id thật: đổi lựa chọn đang giữ
      if (kind === "big") onChange(real.id, ""); else onChange(bigId, real.id);
    }).catch(() => undefined);
  };

  const addBox = (placeholder: string) => (
    <div className="flex gap-2 mt-1.5">
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={60}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitNew(); } if (e.key === "Escape") setAdding(null); }}
        className={`${SELECT} flex-1 min-w-0`} />
      <button type="button" onClick={submitNew} className="btn-primary px-4 cursor-pointer">Thêm</button>
    </div>
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <div className="flex items-center justify-between">
          <label className="ui-label">Danh mục lớn</label>
          <button type="button" onClick={() => { setAdding(adding === "big" ? null : "big"); setName(""); }} className="text-xs font-bold text-primary px-1 py-1 cursor-pointer">+ Thêm mới</button>
        </div>
        <select value={bigId} onChange={(e) => onChange(e.target.value, "")} className={SELECT}>
          <option value="">— Chọn danh mục lớn —</option>
          {bigs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {adding === "big" && addBox("Tên danh mục lớn, Enter để thêm")}
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="ui-label">Danh mục nhỏ</label>
          <button type="button" disabled={!bigId || isTemp(bigId)} onClick={() => { setAdding(adding === "sub" ? null : "sub"); setName(""); }}
            className="text-xs font-bold text-primary px-1 py-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">+ Thêm mới</button>
        </div>
        <select value={subId} onChange={(e) => onChange(bigId, e.target.value)} disabled={!bigId} className={SELECT}>
          <option value="">{subs.length ? "— Không chia nhỏ —" : "— Chưa có danh mục nhỏ —"}</option>
          {subs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {adding === "sub" && addBox("Tên danh mục nhỏ, Enter để thêm")}
      </div>
    </div>
  );
}

type Initial = { type: PfType; date: string; amount: string; bigId: string; subId: string; detail: string };

function TxForm({ store, data, initial, submitLabel, resetAfter, onSubmit }: {
  store: PfStore; data: PfData; initial: Initial; submitLabel: string; resetAfter: boolean;
  onSubmit: (input: TxInput) => Promise<boolean>;
}) {
  const [type, setType] = useState<PfType>(initial.type);
  const [date, setDate] = useState(initial.date);
  const [amountText, setAmountText] = useState(initial.amount);
  const [bigId, setBigId] = useState(initial.bigId);
  const [subId, setSubId] = useState(initial.subId);
  const [detail, setDetail] = useState(initial.detail);
  const [busy, setBusy] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const amount = parseMoney(amountText);
  const leafId = subId || bigId;
  const pending = isTemp(leafId); // danh mục vừa tạo, chưa có id thật từ server (chỉ mất vài trăm ms)
  const amountOk = Number.isFinite(amount) && amount > 0;

  const switchType = (t: PfType) => {
    if (t === type) return;
    setType(t);
    setBigId("");
    setSubId("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leafId) return Swal.fire({ toast: true, position: "top-end", icon: "warning", title: "Vui lòng chọn danh mục", showConfirmButton: false, timer: 2500 });
    if (!amountOk) return Swal.fire({ toast: true, position: "top-end", icon: "warning", title: "Số tiền chưa hợp lệ", showConfirmButton: false, timer: 2500 });
    if (date < START_DATE) return Swal.fire({ toast: true, position: "top-end", icon: "warning", title: "Sổ chỉ tính từ 01/11/2026", showConfirmButton: false, timer: 2500 });
    setBusy(true);
    const ok = await onSubmit({ categoryId: leafId, amount, date, detail: detail.trim() });
    setBusy(false);
    if (ok && resetAfter) {
      setAmountText("");
      setDetail("");
      amountRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <button key={t} type="button" onClick={() => switchType(t)}
            className={`ui-chip cursor-pointer ${type === t ? "ui-chip-active" : ""}`}>{t === "EXPENSE" ? "Khoản chi" : "Khoản thu"}</button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="ui-label" htmlFor="pf-date">Ngày</label>
          <input id="pf-date" type="date" required min={START_DATE} value={date} onChange={(e) => setDate(e.target.value)} className={SELECT} />
        </div>
        <div>
          <label className="ui-label" htmlFor="pf-amount">Số tiền (gõ 50k, 1,5tr, 1.250.000…)</label>
          <input id="pf-amount" ref={amountRef} inputMode="decimal" autoComplete="off" value={amountText} onChange={(e) => setAmountText(e.target.value)}
            placeholder="vd: 45k" className={SELECT} />
          {amountText && <p className={`mt-1 text-xs ${amountOk ? "text-muted" : "text-red-600"}`}>{amountOk ? `= ${vnd(amount)}` : "Chưa hiểu số tiền này"}</p>}
        </div>
      </div>
      <CategoryPicker store={store} categories={data.categories} type={type} bigId={bigId} subId={subId}
        onChange={(b, s) => { setBigId(b); setSubId(s); }} />
      <div>
        <label className="ui-label" htmlFor="pf-detail">Chi tiết sử dụng</label>
        <input id="pf-detail" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={200} placeholder="vd: Cơm trưa với team, đổ xăng, tiền điện tháng 11…" className={SELECT} />
      </div>
      <button type="submit" disabled={busy || pending} className="btn-primary px-6 py-2.5 cursor-pointer disabled:opacity-60">
        {pending ? "Đang lưu danh mục…" : busy ? "Đang lưu…" : submitLabel}
      </button>
    </form>
  );
}

/** Tách id lá thành (lớn, nhỏ) cho form */
function splitCategory(categories: PfCategory[], leafId: string) {
  const leaf = categories.find((c) => c.id === leafId);
  return leaf?.parentId ? { bigId: leaf.parentId, subId: leaf.id } : { bigId: leaf?.id ?? "", subId: "" };
}

export default function Transactions({ store, data, month }: { store: PfStore; data: PfData; month: string }) {
  const { categories } = data;
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const [typeFilter, setTypeFilter] = useState<"ALL" | PfType>("ALL");
  const [bigFilter, setBigFilter] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<PfTx | null>(null);
  // Ngày mặc định = hôm nay (nếu đang xem tháng này) hoặc ngày 1 của tháng đang xem
  const defaultDate = useMemo(() => {
    const d = data.today.startsWith(month) ? data.today : `${month}-01`;
    return d < START_DATE ? START_DATE : d;
  }, [data.today, month]);

  const monthTx = useMemo(() => data.transactions.filter((t) => t.date.startsWith(month)), [data.transactions, month]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monthTx.filter((t) => {
      if (typeFilter !== "ALL" && t.type !== typeFilter) return false;
      const c = byId.get(t.categoryId);
      if (bigFilter && (c?.parentId ?? c?.id) !== bigFilter) return false;
      if (q && !`${t.detail ?? ""} ${categoryLabel(c, byId)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [monthTx, typeFilter, bigFilter, search, byId]);

  const groups = useMemo(() => {
    const map = new Map<string, PfTx[]>();
    for (const t of filtered) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const bigs = categories.filter((c) => !c.parentId && (typeFilter === "ALL" || c.type === typeFilter));

  const remove = async (t: PfTx) => {
    const c = byId.get(t.categoryId);
    const r = await Swal.fire({
      title: "Xoá giao dịch này?", text: `${categoryLabel(c, byId)} · ${vnd(t.amount)}`, icon: "warning",
      showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Giữ lại", confirmButtonColor: "#dc2626",
    });
    if (r.isConfirmed) store.deleteTx(t.id);
  };

  return (
    <div className="space-y-6">
      <section className="ui-card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-primary mb-4">Ghi giao dịch mới</h2>
        <TxForm key={data.categories.length === 0 ? "empty" : "form"} store={store} data={data} resetAfter submitLabel="Lưu giao dịch"
          initial={{ type: "EXPENSE", date: defaultDate, amount: "", bigId: "", subId: "", detail: "" }}
          onSubmit={(input) => store.addTx(input)} />
      </section>

      <section className="ui-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 mb-4">
          <h2 className="text-lg font-bold text-primary">Giao dịch trong tháng <span className="text-muted font-normal text-sm">({filtered.length}/{monthTx.length})</span></h2>
          <div className="flex flex-wrap items-center gap-2">
            {([["ALL", "Tất cả"], ["EXPENSE", "Chi"], ["INCOME", "Thu"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => { setTypeFilter(k); setBigFilter(""); }} className={`ui-chip cursor-pointer ${typeFilter === k ? "ui-chip-active" : ""}`}>{label}</button>
            ))}
            <select value={bigFilter} onChange={(e) => setBigFilter(e.target.value)} className={`${SELECT} !w-auto`} aria-label="Lọc theo danh mục">
              <option value="">Mọi danh mục</option>
              {bigs.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm theo chi tiết…" className={`${SELECT} !w-full sm:!w-56`} />
          </div>
        </div>

        {groups.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">{monthTx.length ? "Không có giao dịch khớp bộ lọc." : "Tháng này chưa có giao dịch nào."}</p>
        ) : (
          <div className="space-y-5">
            {groups.map(([date, list]) => {
              const net = list.reduce((s, t) => s + (t.type === "INCOME" ? t.amount : -t.amount), 0);
              return (
                <div key={date}>
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted pb-1.5 border-b border-line">
                    <span>{fullDayLabel(date)}</span>
                    <span className={net >= 0 ? "text-emerald-700" : "text-red-700"}>{signedVnd(net)}</span>
                  </div>
                  <ul className="divide-y divide-line">
                    {list.map((t) => {
                      const c = byId.get(t.categoryId);
                      const temp = isTemp(t.id);
                      return (
                        <li key={t.id} className={`py-2.5 flex items-start gap-3 ${temp ? "opacity-60" : ""}`}>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-foreground break-words">{categoryLabel(c, byId)}</p>
                            {t.detail && <p className="text-sm text-muted break-words">{t.detail}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className={`font-bold text-sm ${t.type === "INCOME" ? "text-emerald-700" : "text-foreground"}`}>{t.type === "INCOME" ? "+" : "−"}{vnd(t.amount)}</p>
                            {!temp && (
                              <div className="mt-0.5 flex justify-end gap-1">
                                <button onClick={() => setEditing(t)} className="text-xs font-bold text-primary px-2 py-1.5 cursor-pointer">Sửa</button>
                                <button onClick={() => remove(t)} className="text-xs font-bold text-red-600 px-2 py-1.5 cursor-pointer">Xoá</button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {editing && (
        <Modal title="Sửa giao dịch" onClose={() => setEditing(null)}>
          <TxForm store={store} data={data} resetAfter={false} submitLabel="Lưu thay đổi"
            initial={{
              type: editing.type, date: editing.date, amount: String(editing.amount), detail: editing.detail ?? "",
              ...splitCategory(categories, editing.categoryId),
            }}
            onSubmit={async (input) => {
              const ok = await store.updateTx(editing.id, input);
              if (ok) setEditing(null);
              return ok;
            }} />
        </Modal>
      )}
    </div>
  );
}
