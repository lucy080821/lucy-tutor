"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminFetch, API_URL, clearAdminToken, getAdminToken, pctChange, setAdminToken } from "@/lib/adminApi";
import { ErrorBlock, LoadingBlock, Modal } from "@/app/administrator/_components/ui";
import { computeMonths, monthLabel, parseMoney, shiftMonth, START_MONTH, vnd, type MonthRow } from "@/lib/personalFinance";
import AiPanel from "./_components/AiPanel";
import ChatPanel from "./_components/ChatPanel";
import Categories from "./_components/Categories";
import Overview from "./_components/Overview";
import Savings, { MonthEndPrompt } from "./_components/Savings";
import Transactions from "./_components/Transactions";
import { BalanceCard, Icon, QuickAdd, QuickBalance, StatCard, type IconName } from "./_components/DashParts";
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

const TAB_ICON: Record<Tab, IconName> = { OVERVIEW: "grid", TRANSACTIONS: "swap", SAVINGS: "piggy", CATEGORIES: "tag", AI: "spark", CHAT: "chat" };
const TAB_SHORT: Record<Tab, string> = { OVERVIEW: "Tổng quan", TRANSACTIONS: "Giao dịch", SAVINGS: "Tiết kiệm", CATEGORIES: "Danh mục", AI: "AI", CHAT: "Hỏi đáp" };

function Book({ admin, onAuthLost, onLogout }: { admin: Admin; onAuthLost: () => void; onLogout: () => void }) {
  const store = usePfData(onAuthLost);
  const { data } = store;
  const [tab, setTab] = useState<Tab>("OVERVIEW");
  const [picked, setPicked] = useState<string | null>(null);
  const [menu, setMenu] = useState(false);
  const [quick, setQuick] = useState(false);

  const todayMonth = data ? (data.today.slice(0, 7) < START_MONTH ? START_MONTH : data.today.slice(0, 7)) : START_MONTH;
  const month = picked ?? todayMonth;
  const rows = useMemo(() => (data ? computeMonths(data.transactions, data.balances, data.savings, todayMonth) : []), [data, todayMonth]);
  const cur = rows.find((r) => r.month === month);
  const prev = rows.find((r) => r.month === shiftMonth(month, -1));
  const showKpi = tab === "OVERVIEW" || tab === "TRANSACTIONS" || tab === "SAVINGS";
  const go = (t: Tab) => { setTab(t); document.getElementById("pf-scroll")?.scrollTo({ top: 0 }); };

  return (
    <div className="pf-dark fixed inset-0 z-[55] flex">
      {/* Thanh icon bên trái (máy tính) */}
      <aside className="hidden md:flex w-[76px] shrink-0 flex-col items-center gap-2 border-r border-line bg-[#171822] py-5">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4f7bff] to-[#2442c2] text-white shadow-[0_8px_20px_rgba(61,107,255,.4)]"><Icon name="wallet" className="w-6 h-6" /></span>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} title={t.label} aria-label={t.label} aria-current={tab === t.id ? "page" : undefined}
            className={`group relative flex h-11 w-11 items-center justify-center rounded-xl cursor-pointer transition-colors ${tab === t.id ? "bg-primary-soft text-[#8db0ff]" : "text-muted hover:text-foreground hover:bg-primary-soft/60"}`}>
            {tab === t.id && <span aria-hidden className="absolute -left-[17px] h-6 w-1 rounded-r-full bg-[#5b84ff]" />}
            <Icon name={TAB_ICON[t.id]} />
          </button>
        ))}
      </aside>

      <div id="pf-scroll" className="pf-scroll flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto flex max-w-[1560px] items-start gap-6 px-4 py-4 md:px-6 md:py-6">
          <main className="min-w-0 flex-1 space-y-5 pb-28 md:pb-10">
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-[1.75rem] font-extrabold text-foreground leading-tight">Thu chi cá nhân</h1>
                <p className="text-sm text-muted truncate">Sổ của {admin.name} · tính từ 01/11/2026</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex flex-1 sm:flex-none items-center justify-between gap-1 rounded-full border border-line bg-surface px-1 py-1">
                  <button onClick={() => setPicked(shiftMonth(month, -1))} disabled={month <= START_MONTH} aria-label="Tháng trước"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Icon name="chevL" className="w-4 h-4" /></button>
                  <span className="min-w-[7.5rem] flex-1 text-center font-bold text-foreground text-sm">{monthLabel(month)}</span>
                  <button onClick={() => setPicked(shiftMonth(month, 1))} disabled={month >= todayMonth} aria-label="Tháng sau"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-primary-soft hover:text-foreground cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"><Icon name="chevR" className="w-4 h-4" /></button>
                </div>
                {month !== todayMonth && <button onClick={() => setPicked(null)} className="btn-outline !px-4 !py-2 text-sm cursor-pointer whitespace-nowrap">Tháng này</button>}
                <div className="relative">
                  <button onClick={() => setMenu((v) => !v)} aria-label="Tài khoản" aria-expanded={menu}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#4f7bff] to-[#7c5cff] text-base font-extrabold text-white cursor-pointer">{(admin.name || admin.email).charAt(0).toUpperCase()}</button>
                  {menu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
                        <div className="border-b border-line px-4 py-3"><p className="truncate text-sm font-bold text-foreground">{admin.name}</p><p className="truncate text-xs text-muted">{admin.email}</p></div>
                        <Link href="/administrator" className="flex items-center gap-2.5 px-4 py-3 text-sm text-foreground hover:bg-primary-soft"><Icon name="shield" className="w-4 h-4" />Trang quản trị</Link>
                        <button onClick={onLogout} className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-red-600 hover:bg-primary-soft cursor-pointer"><Icon name="logout" className="w-4 h-4" />Đăng xuất</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </header>

            {store.error ? <ErrorBlock message={store.error} onRetry={store.reload} /> : !data ? <LoadingBlock /> : (
              <>
                <OpeningPanel key={`${month}|${cur?.opening}|${cur?.manual}`} month={month} cur={cur} store={store} />
                <MonthEndPrompt key={month} store={store} data={data} month={month} cur={cur} />

                {showKpi && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    <StatCard featured icon="wallet" label="Số dư cuối kỳ" value={vnd(cur?.closing ?? 0)} hint={`đầu kỳ ${vnd(cur?.opening ?? 0)}`} />
                    <StatCard icon="down" label="Thu nhập" value={vnd(cur?.income ?? 0)} tone="good" delta={prev ? pctChange(cur?.income ?? 0, prev.income) : undefined} hint={prev ? "so với tháng trước" : undefined} />
                    <StatCard icon="piggy" label="Quỹ tiết kiệm" value={vnd(cur?.savingsTotal ?? 0)} hint={cur?.savedAll ? `tháng này ${cur.savedAll > 0 ? "+" : ""}${vnd(cur.savedAll)}` : "chưa có khoản tháng này"} />
                    <StatCard icon="up" label="Chi tiêu" value={vnd(cur?.expense ?? 0)} invertDelta delta={prev ? pctChange(cur?.expense ?? 0, prev.expense) : undefined} hint={prev ? "so với tháng trước" : undefined} />
                  </div>
                )}

                {tab === "OVERVIEW" && <Overview data={data} month={month} rows={rows} onSeeAll={() => go("TRANSACTIONS")} />}
                {tab === "TRANSACTIONS" && <Transactions store={store} data={data} month={month} />}
                {tab === "SAVINGS" && <Savings store={store} data={data} month={month} rows={rows} />}
                {tab === "CATEGORIES" && <Categories store={store} data={data} month={month} />}
                <div className={tab === "AI" ? "" : "hidden"}><AiPanel month={month} onAuthLost={onAuthLost} hasData={data.transactions.some((t) => t.date.startsWith(month))} /></div>
                <div className={tab === "CHAT" ? "" : "hidden"}><ChatPanel month={month} onAuthLost={onAuthLost} /></div>
              </>
            )}
          </main>

          {/* Cột phải (màn hình rộng): thẻ số dư + tóm tắt + ghi nhanh */}
          {data && !store.error && (
            <aside className="pf-scroll hidden xl:block w-[340px] shrink-0 sticky top-6 max-h-[calc(100vh-3rem)] overflow-y-auto space-y-5 pr-1">
              <h2 className="font-bold text-foreground">Số dư của tôi</h2>
              <BalanceCard cur={cur} month={month} name={admin.name} />
              <QuickBalance cur={cur} />
              <section className="ui-card p-4">
                <h3 className="mb-3 font-bold text-foreground">Ghi nhanh giao dịch</h3>
                <QuickAdd store={store} data={data} uid="qa" />
              </section>
            </aside>
          )}
        </div>
      </div>

      {/* Nút ghi nhanh (điện thoại / máy tính bảng) */}
      {data && !store.error && (
        <button onClick={() => setQuick(true)} aria-label="Ghi nhanh giao dịch"
          className="xl:hidden fixed right-4 bottom-[84px] md:bottom-6 z-[56] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#4f7bff] to-[#2442c2] text-white shadow-[0_10px_26px_rgba(61,107,255,.5)] cursor-pointer active:scale-95">
          <Icon name="plus" className="w-7 h-7" />
        </button>
      )}
      {quick && data && (
        <Modal title="Ghi nhanh giao dịch" onClose={() => setQuick(false)}>
          <QuickAdd store={store} data={data} uid="qm" onDone={() => setQuick(false)} />
        </Modal>
      )}

      {/* Thanh điều hướng dưới (điện thoại) */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-[56] flex border-t border-line bg-[#171822]/95 backdrop-blur pb-[env(safe-area-inset-bottom)]" aria-label="Mục của sổ thu chi">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} aria-label={t.label} aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold cursor-pointer ${tab === t.id ? "text-[#8db0ff]" : "text-muted"}`}>
            <span className={`flex h-7 w-11 items-center justify-center rounded-full ${tab === t.id ? "bg-primary-soft" : ""}`}><Icon name={TAB_ICON[t.id]} className="w-[18px] h-[18px]" /></span>
            <span className="truncate max-w-full px-0.5">{TAB_SHORT[t.id]}</span>
          </button>
        ))}
      </nav>
    </div>
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
            className={`ui-input !py-2 w-full sm:w-44 ${invalid ? "!border-red-400" : ""}`} />
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
