"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { AdminAuthError } from "@/lib/adminApi";
import { pfApi, type PfCategory, type PfData, type PfTx, type PfType, type TxInput } from "@/lib/personalFinance";

// Toàn bộ dữ liệu thu chi nằm trong 1 state; mọi thao tác cập nhật giao diện NGAY (lạc quan) rồi mới gọi API,
// lỗi thì hoàn lại — nên thêm danh mục/giao dịch hiện tức thì dù mỗi lệnh gọi server mất vài trăm ms.

const TMP = "tmp-";
export const isTemp = (id: string) => id.startsWith(TMP);
let tmpCounter = 0;
const tmpId = () => `${TMP}${Date.now()}-${tmpCounter++}`;

const toast = (message: string) =>
  Swal.fire({ toast: true, position: "top-end", icon: "error", title: message, showConfirmButton: false, timer: 3500 });

export function usePfData(onAuthLost: () => void) {
  const [data, setData] = useState<PfData | null>(null);
  const [error, setError] = useState("");
  // Bản mới nhất, cập nhật đồng bộ cùng setData: thao tác liên tiếp (thêm danh mục rồi ghi giao dịch) luôn thấy dữ liệu mới
  const dataRef = useRef<PfData | null>(null);
  const commit = useCallback((next: PfData) => { dataRef.current = next; setData(next); }, []);

  const fail = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else toast((err as Error).message || "Có lỗi xảy ra");
  }, [onAuthLost]);

  const onLoadError = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else setError((err as Error).message);
  }, [onAuthLost]);

  useEffect(() => {
    let alive = true;
    pfApi.load().then((d) => { if (alive) commit(d); }, (err) => { if (alive) onLoadError(err); });
    return () => { alive = false; };
  }, [commit, onLoadError]);

  const reload = useCallback(() => {
    setError("");
    pfApi.load().then(commit, onLoadError);
  }, [commit, onLoadError]);

  const patch = useCallback((fn: (d: PfData) => PfData) => {
    if (dataRef.current) commit(fn(dataRef.current));
  }, [commit]);

  // ----- Danh mục -----
  /** Thêm danh mục; trùng tên cùng cấp thì trả về danh mục đang có. Hiện ngay với id tạm, xong đổi sang id thật. */
  const addCategory = useCallback(async (input: { name: string; type?: PfType; parentId?: string | null }) => {
    const d = dataRef.current;
    const name = input.name.replace(/\s+/g, " ").trim();
    if (!d || !name) return null;
    const parent = input.parentId ? d.categories.find((c) => c.id === input.parentId) : null;
    if (parent && isTemp(parent.id)) { toast("Danh mục lớn đang được lưu, thử lại sau giây lát"); return null; }
    const type = parent ? parent.type : input.type;
    if (!type) return null;
    const parentId = parent ? parent.id : null;
    const dup = d.categories.find((c) => c.type === type && c.parentId === parentId && c.name.toLowerCase() === name.toLowerCase());
    if (dup) return { category: dup, ready: Promise.resolve(dup) };

    const temp: PfCategory = { id: tmpId(), type, name, parentId, budget: null };
    patch((s) => ({ ...s, categories: [...s.categories, temp] }));
    const ready = pfApi.addCategory({ type, name, parentId }).then(
      (real) => {
        patch((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === temp.id ? real : c)),
          transactions: s.transactions.map((t) => (t.categoryId === temp.id ? { ...t, categoryId: real.id } : t)),
        }));
        return real;
      },
      (err) => {
        patch((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== temp.id) }));
        fail(err);
        throw err;
      },
    );
    ready.catch(() => undefined);
    return { category: temp, ready };
  }, [fail, patch]);

  const seedCategories = useCallback(async () => {
    try {
      const { categories } = await pfApi.seedCategories();
      patch((s) => ({ ...s, categories }));
    } catch (err) { fail(err); }
  }, [fail, patch]);

  const updateCategory = useCallback(async (id: string, change: { name?: string; budget?: number | null }) => {
    const before = dataRef.current;
    patch((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...change } : c)) }));
    try {
      await pfApi.updateCategory(id, change);
    } catch (err) {
      if (before) commit(before);
      fail(err);
    }
  }, [fail, patch, commit]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await pfApi.deleteCategory(id);
      patch((s) => ({ ...s, categories: s.categories.filter((c) => c.id !== id && c.parentId !== id) }));
      return true;
    } catch (err) {
      fail(err);
      return false;
    }
  }, [fail, patch]);

  // ----- Giao dịch -----
  const addTx = useCallback(async (input: TxInput) => {
    const d = dataRef.current;
    const cat = d?.categories.find((c) => c.id === input.categoryId);
    if (!d || !cat) return false;
    const temp: PfTx = { id: tmpId(), type: cat.type, categoryId: cat.id, amount: input.amount, date: input.date, detail: input.detail || null };
    patch((s) => ({ ...s, transactions: [...s.transactions, temp] }));
    try {
      const real = await pfApi.addTx(input);
      patch((s) => ({ ...s, transactions: s.transactions.map((t) => (t.id === temp.id ? real : t)) }));
      return true;
    } catch (err) {
      patch((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== temp.id) }));
      fail(err);
      return false;
    }
  }, [fail, patch]);

  const updateTx = useCallback(async (id: string, input: TxInput) => {
    const before = dataRef.current;
    const cat = before?.categories.find((c) => c.id === input.categoryId);
    if (!cat) return false;
    patch((s) => ({
      ...s,
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, type: cat.type, categoryId: cat.id, amount: input.amount, date: input.date, detail: input.detail || null } : t)),
    }));
    try {
      await pfApi.updateTx(id, input);
      return true;
    } catch (err) {
      if (before) commit(before);
      fail(err);
      return false;
    }
  }, [fail, patch, commit]);

  const deleteTx = useCallback(async (id: string) => {
    const before = dataRef.current;
    patch((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }));
    try {
      await pfApi.deleteTx(id);
    } catch (err) {
      if (before) commit(before);
      fail(err);
    }
  }, [fail, patch, commit]);

  // ----- Số dư đầu tháng -----
  const setOpening = useCallback(async (month: string, opening: number | null) => {
    const before = dataRef.current;
    patch((s) => ({
      ...s,
      balances: opening === null
        ? s.balances.filter((b) => b.month !== month)
        : [...s.balances.filter((b) => b.month !== month), { month, opening }],
    }));
    try {
      await pfApi.setOpening(month, opening);
      return true;
    } catch (err) {
      if (before) commit(before);
      fail(err);
      return false;
    }
  }, [fail, patch, commit]);

  return { data, error, reload, fail, addCategory, seedCategories, updateCategory, deleteCategory, addTx, updateTx, deleteTx, setOpening };
}

export type PfStore = ReturnType<typeof usePfData>;
