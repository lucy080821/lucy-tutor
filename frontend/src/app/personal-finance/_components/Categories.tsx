"use client";
import { useMemo, useState } from "react";
import Swal from "sweetalert2";
import { parseMoney, totalsByBig, vnd, type PfCategory, type PfData, type PfType } from "@/lib/personalFinance";
import { isTemp, type PfStore } from "./usePfData";

const INPUT = "ui-input !py-2";

function AddInline({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = () => {
    if (!name.trim()) return;
    onAdd(name);
    setName(""); // thêm xong xoá ô ngay, danh mục hiện tức thì trong danh sách
  };
  return (
    <div className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder} maxLength={60}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }} className={`${INPUT} flex-1 min-w-0`} />
      <button onClick={submit} className="btn-primary px-4 cursor-pointer">Thêm</button>
    </div>
  );
}

function Column({ type, store, data, monthTotals }: { type: PfType; store: PfStore; data: PfData; monthTotals: Map<string, number> }) {
  const bigs = data.categories.filter((c) => c.type === type && !c.parentId);
  const expense = type === "EXPENSE";

  const rename = async (c: PfCategory) => {
    const r = await Swal.fire({ title: "Đổi tên danh mục", input: "text", inputValue: c.name, showCancelButton: true, confirmButtonText: "Lưu", cancelButtonText: "Huỷ", inputValidator: (v) => (v.trim() ? null : "Tên không được để trống") });
    if (r.isConfirmed && r.value.trim() !== c.name) store.updateCategory(c.id, { name: r.value.trim() });
  };
  const setBudget = async (c: PfCategory) => {
    const r = await Swal.fire({
      title: `Hạn mức chi / tháng — ${c.name}`, input: "text", inputValue: c.budget ? String(c.budget) : "",
      inputPlaceholder: "vd: 3tr, 500k (để trống = bỏ hạn mức)", showCancelButton: true, confirmButtonText: "Lưu", cancelButtonText: "Huỷ",
      inputValidator: (v) => (!v.trim() || (Number.isFinite(parseMoney(v)) && parseMoney(v) > 0) ? null : "Số tiền chưa hợp lệ"),
    });
    if (!r.isConfirmed) return;
    store.updateCategory(c.id, { budget: r.value.trim() ? parseMoney(r.value) : null });
  };
  const remove = async (c: PfCategory) => {
    const r = await Swal.fire({
      title: `Xoá “${c.name}”?`, text: c.parentId ? "" : "Các danh mục nhỏ bên trong cũng bị xoá.", icon: "warning",
      showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Giữ lại", confirmButtonColor: "#dc2626",
    });
    if (r.isConfirmed) store.deleteCategory(c.id);
  };

  return (
    <section className="ui-card p-4 sm:p-6 min-w-0">
      <h2 className="text-lg font-bold text-primary">{expense ? "Danh mục chi" : "Danh mục thu"}</h2>
      <p className="text-sm text-muted mb-3">{bigs.length} danh mục lớn</p>
      <AddInline placeholder="Thêm danh mục lớn mới…" onAdd={(name) => store.addCategory({ name, type })} />
      <ul className="mt-4 space-y-3">
        {bigs.length === 0 && <li className="text-sm text-muted py-4 text-center">Chưa có danh mục nào.</li>}
        {bigs.map((big) => {
          const subs = data.categories.filter((c) => c.parentId === big.id);
          const temp = isTemp(big.id);
          return (
            <li key={big.id} className={`rounded-xl border border-line p-3 ${temp ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-bold text-foreground break-words">{big.name}</span>
                <span className="text-xs text-muted">{vnd(monthTotals.get(big.id) || 0)} tháng này</span>
                {expense && big.budget && <span className="ui-badge">Hạn mức {vnd(big.budget)}</span>}
                <span className="ml-auto flex flex-wrap gap-0.5">
                  {expense && <button disabled={temp} onClick={() => setBudget(big)} className="text-xs font-bold text-primary px-2 py-1.5 cursor-pointer">Hạn mức</button>}
                  <button disabled={temp} onClick={() => rename(big)} className="text-xs font-bold text-primary px-2 py-1.5 cursor-pointer">Đổi tên</button>
                  <button disabled={temp} onClick={() => remove(big)} className="text-xs font-bold text-red-600 px-2 py-1.5 cursor-pointer">Xoá</button>
                </span>
              </div>
              {subs.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {subs.map((s) => (
                    <li key={s.id} className={`inline-flex items-center gap-1 rounded-full bg-primary-soft pl-3 pr-1 py-1 text-sm ${isTemp(s.id) ? "opacity-60" : ""}`}>
                      <button disabled={isTemp(s.id)} onClick={() => rename(s)} className="cursor-pointer" title="Bấm để đổi tên">{s.name}</button>
                      <button disabled={isTemp(s.id)} onClick={() => remove(s)} aria-label={`Xoá ${s.name}`} className="w-7 h-7 rounded-full text-muted hover:bg-white hover:text-red-600 cursor-pointer">×</button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                {temp ? <p className="text-xs text-muted">Đang lưu…</p> : <AddInline placeholder="Thêm danh mục nhỏ…" onAdd={(name) => store.addCategory({ name, parentId: big.id })} />}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Categories({ store, data, month }: { store: PfStore; data: PfData; month: string }) {
  const monthTotals = useMemo(() => {
    const tx = data.transactions.filter((t) => t.date.startsWith(month));
    return new Map([...totalsByBig(tx, data.categories, "EXPENSE"), ...totalsByBig(tx, data.categories, "INCOME")].map((e) => [e.id, e.total]));
  }, [data, month]);

  return (
    <div className="space-y-6">
      {data.categories.length === 0 && (
        <div className="ui-card p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-bold text-foreground">Sổ còn trống</p>
            <p className="text-sm text-muted">Tạo nhanh bộ danh mục gợi ý (Ăn uống, Nhà ở, Di chuyển, Lương…) rồi chỉnh sửa tuỳ ý, hoặc tự thêm từng danh mục bên dưới.</p>
          </div>
          <button onClick={() => store.seedCategories()} className="btn-primary px-5 py-2.5 cursor-pointer">Tạo danh mục gợi ý</button>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Column type="EXPENSE" store={store} data={data} monthTotals={monthTotals} />
        <Column type="INCOME" store={store} data={data} monthTotals={monthTotals} />
      </div>
    </div>
  );
}
