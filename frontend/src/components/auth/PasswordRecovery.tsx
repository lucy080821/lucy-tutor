"use client";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Email đăng nhập thường không phải hộp thư thật -> không gửi link đặt lại qua email.
// Yêu cầu được chuyển tới giáo viên phụ trách (học viên) hoặc quản trị viên (giáo viên), người đó cấp mật khẩu tạm
// rồi nhắn qua SĐT/Zalo học viên ghi ở đây. Xem backend/src/routes/passwordReset.routes.js
/** audience="notes": mở từ Lucy Notes — tài khoản Ghi chú không có giáo viên, yêu cầu do quản trị viên xử lý */
export function ForgotPasswordForm({ defaultEmail, onBack, audience = "app" }: { defaultEmail: string; onBack: () => void; audience?: "app" | "notes" }) {
  const [email, setEmail] = useState(defaultEmail);
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [doneMessage, setDoneMessage] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, contact, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không gửi được yêu cầu, vui lòng thử lại");
      setDoneMessage(data.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (doneMessage) {
    return (
      <div>
        <h1 className="text-[24px] font-extrabold text-primary text-center leading-tight mb-3 tracking-tight">Đã gửi yêu cầu</h1>
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg p-4 text-sm leading-relaxed mb-4">{doneMessage}</div>
        <p className="text-sm text-muted leading-relaxed mb-5">
          {audience === "notes" ? "Muốn nhanh hơn, bạn có thể gọi/nhắn Zalo hotline 0869.603.164." : "Muốn nhanh hơn, bạn có thể nhắn trực tiếp cho giáo viên của mình."} Khi có mật khẩu tạm, hãy đăng nhập bằng mật khẩu đó — hệ thống sẽ yêu cầu bạn đặt mật khẩu mới ngay sau đó.
        </p>
        <button onClick={onBack} className="btn-primary w-full py-3 cursor-pointer">← Quay lại đăng nhập</button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-[24px] font-extrabold text-primary text-center leading-tight mb-1.5 tracking-tight">Quên mật khẩu</h1>
      <p className="text-center text-muted text-[13.5px] mb-6">
        {audience === "notes"
          ? "Tài khoản Ghi chú: yêu cầu được gửi tới quản trị viên Lucy Tutor. Tài khoản học viên/giáo viên: gửi tới giáo viên phụ trách/quản trị viên. Người xử lý sẽ cấp mật khẩu tạm và nhắn cho bạn qua số điện thoại/Zalo bạn để lại."
          : "Yêu cầu sẽ được gửi tới giáo viên phụ trách của bạn (tài khoản giáo viên: gửi tới quản trị viên). Họ sẽ cấp mật khẩu tạm và nhắn cho bạn."}
      </p>
      {error && <div className="bg-red-50 text-red-700 p-3 text-sm mb-5 font-medium text-center rounded-lg border border-red-100">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="fp-email" className="ui-label">Email đăng nhập</label>
          <input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ui-input" placeholder="email@example.com" />
        </div>
        <div>
          <label htmlFor="fp-contact" className="ui-label">Số điện thoại / Zalo để nhận mật khẩu mới</label>
          <input id="fp-contact" type="tel" required value={contact} onChange={(e) => setContact(e.target.value)} className="ui-input" placeholder="09xx xxx xxx" />
        </div>
        <div>
          <label htmlFor="fp-note" className="ui-label">Ghi chú — Tuỳ chọn</label>
          <textarea id="fp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="ui-input" placeholder="Vd: Họ tên, lớp đang học..." />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base cursor-pointer">
          {submitting ? "Đang gửi..." : "Gửi Yêu Cầu"}
        </button>
      </form>
      <p className="text-center mt-5 text-sm">
        <button onClick={onBack} className="text-primary font-bold hover:underline cursor-pointer">← Quay lại đăng nhập</button>
      </p>
    </div>
  );
}

// Đăng nhập bằng mật khẩu tạm (User.mustChangePassword) -> bắt buộc đặt mật khẩu mới trước khi vào app.
// Mật khẩu tạm vừa gõ ở form đăng nhập được dùng làm "mật khẩu hiện tại", học viên không phải gõ lại.
export function ForceChangePassword({ userId, currentPassword, onDone, onCancel }: {
  userId: string; currentPassword: string; onDone: () => void; onCancel: () => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) return setError("Mật khẩu mới phải có ít nhất 6 ký tự");
    if (newPassword !== confirm) return setError("Mật khẩu nhập lại không khớp");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không đổi được mật khẩu");
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h1 className="text-[24px] font-extrabold text-primary text-center leading-tight mb-1.5 tracking-tight">Đặt mật khẩu mới</h1>
      <p className="text-center text-muted text-[13.5px] mb-6">
        Bạn đang đăng nhập bằng mật khẩu tạm. Hãy đặt mật khẩu riêng của bạn để tiếp tục.
      </p>
      {error && <div className="bg-red-50 text-red-700 p-3 text-sm mb-5 font-medium text-center rounded-lg border border-red-100">{error}</div>}
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="fc-new" className="ui-label">Mật khẩu mới</label>
          <input id="fc-new" type="password" required autoFocus autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="ui-input" placeholder="Ít nhất 6 ký tự" />
        </div>
        <div>
          <label htmlFor="fc-confirm" className="ui-label">Nhập lại mật khẩu mới</label>
          <input id="fc-confirm" type="password" required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="ui-input" />
        </div>
        <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base cursor-pointer">
          {submitting ? "Đang lưu..." : "Lưu Mật Khẩu & Tiếp Tục"}
        </button>
      </form>
      <p className="text-center mt-5 text-sm">
        <button onClick={onCancel} className="text-muted hover:text-primary hover:underline cursor-pointer">← Quay lại đăng nhập</button>
      </p>
    </div>
  );
}
