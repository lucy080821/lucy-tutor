"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch, API_URL, clearAdminToken, getAdminToken, pctChange, setAdminToken } from "@/lib/adminApi";
import { ErrorBlock, KpiCard, LoadingBlock } from "@/app/administrator/_components/ui";
import { computeMonths, daysInMonth, monthLabel, parseMoney, shiftMonth, START_MONTH, vnd, type MonthRow } from "@/lib/personalFinance";
import AiPanel from "./_components/AiPanel";
import ChatPanel from "./_components/ChatPanel";
import Categories from "./_components/Categories";
import Overview from "./_components/Overview";
import Savings, { MonthEndPrompt } from "./_components/Savings";
import Transactions from "./_components/Transactions";
import { usePfData, type PfStore } from "./_components/usePfData";

// Sổ thu chi cá nhân (/personal-finance). Đăng nhập bằng đúng tài khoản ADMIN của /administrator (cùng token phiên,
// lưu sessionStorage) — đã đăng nhập ở một trang thì trang kia vào thẳng. Dữ liệu: backend/src/routes/personalFinance.routes.js.
// Sổ tính từ 01/11/2026; tháng đầu cần nhập số dư tháng trước, các tháng sau tự chuyển số dư cuối kỳ sang.

type Tab = "OVERVIEW" | "TRANSACTIONS" | "SAVINGS" | "CATEGORIES" | "AI" | "CHAT";
const TABS: { id: Tab; label: string }[] = [
  { id: "OVERVIEW", label: "Tổng quan" },
  { id: "TRANSACTIONS", label: "Giao dịch" },
  { id: "SAVINGS", label: "Tiết kiệm" },
  { id: "CATEGORIES", label: "Danh mục" },
  { id: "AI", label: "AI phân tích" },
  { id: "CHAT", label: "Hỏi đáp AI" },
];
type Admin = { email: string; name: string };

export default function PersonalFinancePage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const check = getAdminToken()
      ? adminFetch<{ admin: Admin }>("/me").then((r) => setAdmin(r.admin)).catch(() => clearAdminToken())
      : Promise.resolve();
    check.finally(() => setChecking(false));
  }, []);

  const onAuthLost = useCallback(() => {
    clearAdminToken();
    setAdmin(null);
    setNotice("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }, []);

  if (checking) return <div className="flex-1 bg-background py-24 text-center text-muted text-sm">Đang tải...</div>;
  if (!admin) return <Login notice={notice} onLoggedIn={(a) => { setAdmin(a); setNotice(""); }} />;
  return <Book admin={admin} onAuthLost={onAuthLost} onLogout={() => { clearAdminToken(); setAdmin(null); setNotice(""); }} />;
}

function Book({ admin, onAuthLost, onLogout }: { admin: Admin; onAuthLost: () => void; onLogout: () => void }) {
  const store = usePfData(onAuthLost);
  const { data } = store;
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [picked, setPicked] = useState<string | null>(null);

  const todayMonth = data ? (data.today.slice(0, 7) < START_MONTH ? START_MONTH : data.today.slice(0, 7)) : START_MONTH;
  const month = picked ?? todayMonth;
  const rows = useMemo(() => (data ? computeMonths(data.transactions, data.balances, data.savings, todayMonth) : []), [data, todayMonth]);
  const cur = rows.find((r) => r.month === month);
  const prev = rows.find((r) => r.month === shiftMonth(month, -1));

  return (
    <div className="flex-1 bg-background">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs text-muted">Quản trị / Thu chi cá nhân</p>
            <h1 className="ui-page-title mt-1">Thu chi cá nhân</h1>
            <p className="ui-page-subtitle">Sổ riêng của {admin.name} · tính từ 01/11/2026</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 ui-card !rounded-full px-1 py-1">
              <button onClick={() => setPicked(shiftMonth(month, -1))} disabled={month <= START_MONTH} aria-label="Tháng trước"
                className="w-10 h-10 rounded-full hover:bg-slate-100 text-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">‹</button>
              <span className="min-w-[8.5rem] text-center font-bold text-primary text-sm">{monthLabel(month)}</span>
              <button onClick={() => setPicked(shiftMonth(month, 1))} disabled={month >= todayMonth} aria-label="Tháng sau"
                className="w-10 h-10 rounded-full hover:bg-slate-100 text-lg cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">›</button>
            </div>
            {month !== todayMonth && <button onClick={() => setPicked(null)} className="btn-outline px-4 py-2 cursor-pointer">Về tháng này</button>}
            <Link href="/administrator" className="btn-outline px-4 py-2">Trang quản trị</Link>
            <button onClick={onLogout} className="btn-ghost px-4 py-2 text-red-600 cursor-pointer">Đăng xuất</button>
          </div>
        </header>

        {store.error ? <ErrorBlock message={store.error} onRetry={store.reload} /> : !data ? <LoadingBlock /> : (
          <>
            <OpeningPanel key={`${month}|${cur?.opening}|${cur?.manual}`} month={month} cur={cur} store={store} />

            <MonthEndPrompt key={month} store={store} data={data} month={month} cur={cur} />

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <KpiCard label="Thu nhập" value={vnd(cur?.income ?? 0)} tone="good" delta={prev ? pctChange(cur?.income ?? 0, prev.income) : undefined} hint={prev ? "so với tháng trước" : undefined} />
              <KpiCard label="Chi tiêu" value={vnd(cur?.expense ?? 0)} invertDelta delta={prev ? pctChange(cur?.expense ?? 0, prev.expense) : undefined} hint={prev ? "so với tháng trước" : undefined} />
              <KpiCard label="Số dư cuối kỳ" value={vnd(cur?.closing ?? 0)} tone={(cur?.closing ?? 0) < 0 ? "bad" : "default"} hint={`đầu kỳ ${vnd(cur?.opening ?? 0)}`} />
              <SavingKpi cur={cur} month={month} today={data.today} />
              <KpiCard label="Quỹ tiết kiệm" value={vnd(cur?.savingsTotal ?? 0)} tone="good" hint={cur?.savedAll ? `tháng này ${cur.savedAll > 0 ? "+" : ""}${vnd(cur.savedAll)}` : "chưa có khoản tháng này"} />
            </div>

            <nav className="flex flex-wrap gap-2" aria-label="Mục của sổ thu chi">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`ui-chip cursor-pointer ${tab === t.id ? "ui-chip-active" : ""}`}>{t.label}</button>
              ))}
            </nav>

            {tab === "OVERVIEW" && <Overview data={data} month={month} rows={rows} />}
            {tab === "TRANSACTIONS" && <Transactions store={store} data={data} month={month} />}
            {tab === "SAVINGS" && <Savings store={store} data={data} month={month} rows={rows} />}
            {tab === "CATEGORIES" && <Categories store={store} data={data} month={month} />}
            <div className={tab === "AI" ? "" : "hidden"}><AiPanel month={month} onAuthLost={onAuthLost} hasData={data.transactions.some((t) => t.date.startsWith(month))} /></div>
            <div className={tab === "CHAT" ? "" : "hidden"}><ChatPanel month={month} onAuthLost={onAuthLost} /></div>
          </>
        )}
      </div>
    </div>
  );
}

function SavingKpi({ cur, month, today }: { cur?: MonthRow; month: string; today: string }) {
  const net = (cur?.income ?? 0) - (cur?.expense ?? 0);
  const rate = cur && cur.income > 0 ? (net / cur.income) * 100 : null;
  const elapsed = month === today.slice(0, 7) ? Number(today.slice(8)) : month < today.slice(0, 7) ? daysInMonth(month) : 0;
  return (
    <KpiCard label="Thu − chi" value={`${net > 0 ? "+" : ""}${vnd(net)}`} tone={net < 0 ? "bad" : net > 0 ? "good" : "default"}
      hint={`${rate === null ? "chưa có thu nhập" : `${rate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% thu nhập`}${elapsed && cur ? ` · chi TB ${vnd(cur.expense / elapsed)}/ngày` : ""}`} />
  );
}

/** Ô nhập số dư tháng trước (đầu kỳ). Tháng đầu tiên bắt buộc nhập tay; tháng sau để trống thì tự lấy cuối kỳ tháng trước. */
function OpeningPanel({ month, cur, store }: { month: string; cur?: MonthRow; store: PfStore }) {
  const first = month === START_MONTH;
  const [text, setText] = useState(cur?.manual ? String(cur.opening) : "");
  const [saving, setSaving] = useState(false);
  const value = text.trim() === "" ? null : parseMoney(text);
  const invalid = value !== null && !Number.isFinite(value);
  const dirty = cur?.manual ? text.trim() !== String(cur.opening) : text.trim() !== "";
  const needsInput = first && !cur?.manual;

  const save = async (v: number | null) => {
    setSaving(true);
    await store.setOpening(month, v);
    setSaving(false);
  };

  return (
    <section className={`ui-card p-4 sm:p-5 ${needsInput ? "ring-2 ring-[#f9a95a]" : ""}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h2 className="font-bold text-primary">Số dư tháng trước chuyển sang ({monthLabel(month)})</h2>
          <p className="text-sm text-muted mt-0.5">
            {needsInput
              ? "Nhập số tiền bạn đang có vào đầu 01/11/2026 (số dư cuối tháng 10) để các tháng sau tính đúng."
              : cur?.manual ? "Đang dùng số bạn nhập tay." : first ? "" : `Đang tự lấy số dư cuối kỳ tháng trước: ${vnd(cur?.opening ?? 0)}. Nhập số khác nếu cần đối chiếu lại với tài khoản thật.`}
          </p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); if (!invalid && value !== null) save(value); }} className="flex flex-wrap items-center gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} inputMode="decimal" placeholder={first ? "vd: 15tr" : "Tự động"} aria-label="Số dư đầu kỳ"
            className={`ui-input !py-2 w-44 ${invalid ? "!border-red-400" : ""}`} />
          <button type="submit" disabled={saving || invalid || value === null || !dirty} className="btn-primary px-5 py-2 cursor-pointer disabled:opacity-50">{saving ? "Đang lưu…" : "Lưu số dư"}</button>
          {cur?.manual && !first && <button type="button" disabled={saving} onClick={() => save(null)} className="btn-ghost px-3 py-2 cursor-pointer">Dùng số tự chuyển</button>}
        </form>
      </div>
      {value !== null && !invalid && <p className="mt-2 text-xs text-muted">= {vnd(value)}</p>}
      {invalid && <p className="mt-2 text-xs text-red-600">Chưa hiểu số tiền này (vd: 15tr, 2.500.000)</p>}
    </section>
  );
}

function Login({ notice, onLoggedIn }: { notice: string; onLoggedIn: (admin: Admin) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Đăng nhập thất bại");
      setAdminToken(data.token);
      onLoggedIn(data.admin);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-background flex items-center justify-center px-4 py-16">
      <form onSubmit={submit} className="ui-card w-full max-w-sm p-6 sm:p-8 space-y-4">
        <div>
          <h1 className="ui-page-title !text-2xl">Thu chi cá nhân</h1>
          <p className="ui-page-subtitle">Đăng nhập bằng tài khoản quản trị (cùng tài khoản của trang /administrator).</p>
        </div>
        {notice && <p className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">{notice}</p>}
        <div>
          <label htmlFor="pf-email" className="ui-label">Email</label>
          <input id="pf-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input" />
        </div>
        <div>
          <label htmlFor="pf-password" className="ui-label">Mật khẩu</label>
          <input id="pf-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" />
        </div>
        {error && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 cursor-pointer">{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        <p className="text-xs text-muted text-center">Phiên tự hết hạn sau 12 giờ hoặc khi đóng tab.</p>
      </form>
    </div>
  );
}
