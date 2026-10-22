"use client";
// Đăng nhập / tạo tài khoản ngay trong /notes. Tài khoản Ghi chú (role NOTES) chỉ dùng cho Ghi chú, tách biệt app học;
// đăng nhập ở đây nhận cả tài khoản học viên/giáo viên có sẵn. Mở từ mọi nơi trong Ghi chú bằng openNotesAuth().
import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { Modal } from "./ui";
import { API_URL } from "./api";
import { setSessionUserId } from "@/lib/session";
import { ForgotPasswordForm, ForceChangePassword } from "@/components/auth/PasswordRecovery";

export type AuthMode = "login" | "signup";
const EVENT = "lucy-notes-auth";
export const openNotesAuth = (mode: AuthMode = "signup") => window.dispatchEvent(new CustomEvent(EVENT, { detail: mode }));

/** Lợi ích khi có tài khoản — dùng chung cho hộp đăng ký và các lời nhắc */
export const ACCOUNT_BENEFITS = [
  "Lưu an toàn trên máy chủ — không mất khi xoá dữ liệu trình duyệt, đổi máy hay dùng tab ẩn danh",
  "Mở ghi chú trên điện thoại, máy tính bảng, máy tính — tự đồng bộ",
  "40 lượt AI và 6 lượt ghi âm thành ghi chú mỗi ngày (khách: 10 và 1)",
  "Ghi chú đang có trên trình duyệt này được đưa lên tài khoản chỉ với 1 lần bấm",
];

async function post(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Có lỗi xảy ra, vui lòng thử lại");
  return data;
}

export default function NotesAuth({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signup");
  const [forgot, setForgot] = useState(false);
  const [pending, setPending] = useState<{ id: string; role: string; password: string } | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [remember, setRemember] = useState(true);
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onOpen = (e: Event) => { setMode(((e as CustomEvent).detail as AuthMode) || "signup"); setForgot(false); setError(""); setOpen(true); };
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  const finish = (id: string, role: string) => {
    setSessionUserId(id, remember, role);
    setOpen(false); setPending(null); setPassword(""); setConfirm("");
    onLoggedIn();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "signup" && password !== confirm) { setError("Mật khẩu nhập lại không khớp"); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const u = await post("/api/notes-auth/signup", { name, email, password, website });
        finish(u.id, u.role);
        Swal.fire({ icon: "success", title: "Đã tạo tài khoản Ghi chú", text: "Từ giờ ghi chú được lưu an toàn trên tài khoản của bạn.", timer: 2200, showConfirmButton: false });
      } else {
        const u = await post("/api/notes-auth/signin", { email, password });
        if (u.mustChangePassword) setPending({ id: u.id, role: u.role, password });
        else finish(u.id, u.role);
      }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  const title = pending ? "Đặt mật khẩu mới" : forgot ? "Quên mật khẩu" : mode === "signup" ? "Tạo tài khoản Ghi chú miễn phí" : "Đăng nhập Ghi chú";
  return (
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title={title}>
      {pending ? (
        <ForceChangePassword userId={pending.id} currentPassword={pending.password} onDone={() => finish(pending.id, pending.role)} onCancel={() => setPending(null)} />
      ) : forgot ? (
        <ForgotPasswordForm audience="notes" defaultEmail={email} onBack={() => setForgot(false)} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-background p-1">
            {(["signup", "login"] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); setError(""); }}
                className={`rounded-lg py-2 text-sm font-bold ${mode === m ? "bg-white text-primary shadow-card" : "text-muted"}`}>
                {m === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
              </button>
            ))}
          </div>
          {mode === "signup" ? (
            <ul className="space-y-1.5 text-sm">
              {ACCOUNT_BENEFITS.map((b) => <li key={b} className="flex gap-2"><span className="text-emerald-600 font-bold">✓</span><span>{b}</span></li>)}
            </ul>
          ) : (
            <p className="text-sm text-muted">Dùng tài khoản Ghi chú, hoặc tài khoản <b>học viên / giáo viên</b> Lucy Tutor bạn đang có.</p>
          )}
          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <label className="block"><span className="ui-label">Tên của bạn</span>
                <input className="ui-input w-full" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} />
              </label>
            )}
            <label className="block"><span className="ui-label">Email</span>
              <input className="ui-input w-full" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
            <label className="block"><span className="ui-label">Mật khẩu</span>
              <input className="ui-input w-full" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={mode === "signup" ? 8 : 1} />
            </label>
            {mode === "signup" && (
              <label className="block"><span className="ui-label">Nhập lại mật khẩu</span>
                <input className="ui-input w-full" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required minLength={8} />
              </label>
            )}
            {/* Ô bẫy bot — người dùng không thấy */}
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
            <div className="flex items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Nhớ tôi trên máy này</label>
              {mode === "login" && <button type="button" onClick={() => setForgot(true)} className="font-bold text-primary hover:underline">Quên mật khẩu?</button>}
            </div>
            {error && <p className="text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2" role="alert">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full py-3">{busy ? "Đang xử lý…" : mode === "signup" ? "Tạo tài khoản & lưu ghi chú" : "Đăng nhập"}</button>
          </form>
          {mode === "signup" && (
            <p className="text-xs text-muted">Tài khoản Ghi chú chỉ dùng cho Ghi chú, tách biệt với các khoá học. Muốn học tiếng Anh cùng Lucy Tutor? <Link href="/auth?role=STUDENT" className="font-bold text-primary hover:underline">Đăng ký tài khoản học viên</Link> — tài khoản học viên cũng dùng được Ghi chú.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
