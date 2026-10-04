"use client";
import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { adminFetch, AdminAuthError, API_URL, clearAdminToken, getAdminToken, setAdminToken } from "@/lib/adminApi";
import OverviewTab from "./_components/OverviewTab";
import FinanceTab from "./_components/FinanceTab";
import UsersTab from "./_components/UsersTab";

// Trang quản trị toàn app (/administrator). 3 loại tài khoản tách biệt: chỉ tài khoản role ADMIN (tài khoản riêng,
// tạo bằng backend/scripts/createAdmin.js) đăng nhập được ở đây; tài khoản học viên/giáo viên không vào được, và
// tài khoản ADMIN không vào được /dashboard hay /teacher. Phiên admin tách khỏi phiên userId của lib/session.ts.
// Xem backend/src/routes/admin.routes.js.

type Tab = "OVERVIEW" | "FINANCE" | "USERS";
const TABS: { id: Tab; label: string; description: string }[] = [
  { id: "OVERVIEW", label: "Tổng quan", description: "Số liệu toàn hệ thống" },
  { id: "FINANCE", label: "Thu chi & lợi nhuận", description: "Sổ thu chi nhập tay, lợi nhuận theo tháng" },
  { id: "USERS", label: "Người dùng", description: "Tài khoản học viên, giáo viên" },
];
const TAB_KEY = "lucy_admin_tab";

type Admin = { email: string; name: string };

export default function AdministratorPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  // Lúc đang kiểm tra phiên chỉ hiện "Đang tải..." nên đọc tab đã lưu ngay từ đầu không gây lệch hydration
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = typeof window !== "undefined" ? (sessionStorage.getItem(TAB_KEY) as Tab | null) : null;
      return saved && TABS.some((t) => t.id === saved) ? saved : "OVERVIEW";
    } catch { return "OVERVIEW"; }
  });
  const [authNotice, setAuthNotice] = useState("");

  // Có token trong phiên -> kiểm tra còn hợp lệ không
  useEffect(() => {
    const check = getAdminToken()
      ? adminFetch<{ admin: Admin }>("/me").then((r) => setAdmin(r.admin)).catch(() => clearAdminToken())
      : Promise.resolve();
    check.finally(() => setChecking(false));
  }, []);

  const changeTab = (t: Tab) => {
    setTab(t);
    try { sessionStorage.setItem(TAB_KEY, t); } catch { /* bị chặn */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onAuthLost = useCallback(() => {
    clearAdminToken();
    setAdmin(null);
    setAuthNotice("Phiên quản trị đã hết hạn, vui lòng đăng nhập lại.");
  }, []);

  const logout = () => {
    clearAdminToken();
    setAdmin(null);
    setAuthNotice("");
  };

  const changePassword = async () => {
    const r = await Swal.fire({
      title: "Đổi mật khẩu quản trị",
      html:
        '<input id="pw-current" type="password" class="swal2-input" placeholder="Mật khẩu hiện tại" autocomplete="current-password">' +
        '<input id="pw-new" type="password" class="swal2-input" placeholder="Mật khẩu mới (ít nhất 8 ký tự)" autocomplete="new-password">' +
        '<input id="pw-again" type="password" class="swal2-input" placeholder="Nhập lại mật khẩu mới" autocomplete="new-password">',
      showCancelButton: true, confirmButtonText: "Đổi mật khẩu", cancelButtonText: "Huỷ", focusConfirm: false,
      preConfirm: () => {
        const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value || "";
        if (val("pw-new").length < 8) { Swal.showValidationMessage("Mật khẩu mới phải có ít nhất 8 ký tự"); return false; }
        if (val("pw-new") !== val("pw-again")) { Swal.showValidationMessage("Hai lần nhập mật khẩu mới không khớp"); return false; }
        return { currentPassword: val("pw-current"), newPassword: val("pw-new") };
      },
    });
    if (!r.isConfirmed || !r.value) return;
    try {
      await adminFetch("/change-password", { method: "PUT", body: JSON.stringify(r.value) });
      Swal.fire("Đã đổi mật khẩu", "Lần đăng nhập sau dùng mật khẩu mới.", "success");
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không đổi được", (err as Error).message, "error");
    }
  };

  if (checking) return <div className="flex-1 bg-background py-24 text-center text-muted text-sm">Đang tải...</div>;
  if (!admin) return <AdminLogin notice={authNotice} onLoggedIn={(a) => { setAdmin(a); setAuthNotice(""); }} />;

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex-1 bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 lg:py-8 flex flex-col lg:flex-row gap-6">
        {/* Điều hướng: sidebar trên desktop, hàng chip trên điện thoại */}
        <aside className="lg:w-60 shrink-0">
          <div className="ui-card lg:sticky lg:top-24 p-3">
            <div className="px-2 pb-3 mb-3 border-b border-line">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Quản trị hệ thống</p>
              <p className="font-bold text-foreground truncate mt-1">{admin.name}</p>
              <p className="text-xs text-muted truncate">{admin.email}</p>
            </div>
            <nav className="flex lg:flex-col gap-1 overflow-x-auto -mx-1 px-1 pb-1 lg:pb-0">
              {TABS.map((t) => (
                <button key={t.id} onClick={() => changeTab(t.id)}
                  className={`ui-nav-item whitespace-nowrap cursor-pointer !w-auto lg:!w-full ${tab === t.id ? "ui-nav-item-active" : ""}`}>
                  {t.label}
                </button>
              ))}
            </nav>
            <div className="mt-3 pt-3 border-t border-line flex lg:flex-col gap-1">
              <button onClick={changePassword} className="ui-nav-item !w-auto lg:!w-full text-sm cursor-pointer">Đổi mật khẩu</button>
              <button onClick={logout} className="ui-nav-item !w-auto lg:!w-full text-sm text-red-600 cursor-pointer">Đăng xuất</button>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="mb-6">
            <p className="text-xs text-muted">Quản trị / {active.label}</p>
            <h1 className="ui-page-title mt-1">{active.label}</h1>
            <p className="ui-page-subtitle">{active.description}</p>
          </div>
          {tab === "OVERVIEW" && <OverviewTab onAuthLost={onAuthLost} onOpenFinance={() => changeTab("FINANCE")} />}
          {tab === "FINANCE" && <FinanceTab onAuthLost={onAuthLost} />}
          {tab === "USERS" && <UsersTab onAuthLost={onAuthLost} />}
        </main>
      </div>
    </div>
  );
}

function AdminLogin({ notice, onLoggedIn }: { notice: string; onLoggedIn: (admin: Admin) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
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
          <h1 className="ui-page-title !text-2xl">Quản trị Lucy Tutor</h1>
          <p className="ui-page-subtitle">Chỉ dành cho tài khoản quản trị. Tài khoản học viên/giáo viên không đăng nhập được ở đây.</p>
        </div>
        {notice && <p className="rounded-lg bg-amber-50 text-amber-800 text-sm px-3 py-2">{notice}</p>}
        <div>
          <label htmlFor="admin-email" className="ui-label">Email</label>
          <input id="admin-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input" />
        </div>
        <div>
          <label htmlFor="admin-password" className="ui-label">Mật khẩu</label>
          <input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ui-input" />
        </div>
        {error && <p className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 cursor-pointer">{loading ? "Đang đăng nhập..." : "Đăng nhập"}</button>
        <p className="text-xs text-muted text-center">Phiên đăng nhập tự hết hạn sau 12 giờ hoặc khi đóng tab.</p>
      </form>
    </div>
  );
}
