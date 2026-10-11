"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { SITE_URL } from "@/lib/seo";

// Quên mật khẩu — phía giáo viên. Email đăng nhập của học viên thường không phải hộp thư thật, nên giáo viên
// cấp mật khẩu tạm rồi nhắn cho học viên (Zalo/điện thoại); học viên đăng nhập bằng nó thì bị bắt đặt mật khẩu mới.
// Mật khẩu tạm được giữ lại (backend User.tempPassword) để giáo viên xem lại bất cứ lúc nào nếu quên,
// tới khi học viên đổi mật khẩu thì tự biến mất. Backend: backend/src/routes/passwordReset.routes.js

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export type ResetRequest = {
  id: string; contact: string | null; note: string | null; createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
};
export type TempPasswordRow = {
  id: string; name: string; email: string; phone: string | null; tempPassword: string; tempPasswordIssuedAt: string | null;
};

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Tin nhắn soạn sẵn để giáo viên dán vào Zalo
const loginMessage = (email: string, tempPassword: string) =>
  `Lucy Tutor — thông tin đăng nhập của bạn:\nEmail: ${email}\nMật khẩu tạm: ${tempPassword}\nĐăng nhập tại ${SITE_URL}/auth — hệ thống sẽ yêu cầu bạn đặt mật khẩu mới ngay sau đó.`;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Đã sao chép", showConfirmButton: false, timer: 1500 });
  } catch {
    Swal.fire("Không sao chép được", "Trình duyệt chặn quyền clipboard — hãy bôi đen và sao chép thủ công.", "warning");
  }
}

// Hộp thoại hiện mật khẩu tạm vừa cấp (dùng chung cho đặt lại mật khẩu và thêm học viên thủ công)
export function showTempPasswordDialog(name: string, email: string, tempPassword: string, title = "Đã cấp mật khẩu tạm") {
  return Swal.fire({
    title,
    html: `<div style="text-align:left;font-size:14px;line-height:1.6">
      Gửi cho <b>${esc(name)}</b> thông tin sau:<br/>
      Email: <b>${esc(email)}</b><br/>
      Mật khẩu tạm: <b style="font-size:18px;letter-spacing:1px;color:#1E3A8A">${esc(tempPassword)}</b>
      <p style="margin-top:10px;color:#64748b;font-size:13px">Lần đăng nhập đầu học viên sẽ phải đặt mật khẩu mới. Nếu quên, bạn xem lại mật khẩu này ở tab <b>Học Viên</b> → "Mật khẩu tạm chưa được đổi".</p>
    </div>`,
    icon: "success",
    showCancelButton: true,
    confirmButtonText: "Sao chép tin nhắn",
    cancelButtonText: "Đóng",
  }).then((r) => { if (r.isConfirmed) copyText(loginMessage(email, tempPassword)); });
}

export function usePasswordResets(teacherId: string | undefined, active: boolean) {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [tempPasswords, setTempPasswords] = useState<TempPasswordRow[]>([]);
  const inFlight = useRef(false);

  const reload = useCallback(async () => {
    if (!teacherId || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch(`${API_URL}/api/password-reset/teacher/${teacherId}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
        setTempPasswords(data.tempPasswords || []);
      }
    } catch (err) { console.error(err); } finally { inFlight.current = false; }
  }, [teacherId]);

  useEffect(() => { if (active) reload(); }, [active, reload]);

  const resetPassword = useCallback(async (student: { id: string; name: string; email: string }) => {
    if (!teacherId) return;
    const ok = await Swal.fire({
      title: "Cấp mật khẩu tạm?",
      html: `Mật khẩu hiện tại của <b>${esc(student.name)}</b> (${esc(student.email)}) sẽ không dùng được nữa. Hệ thống tạo 1 mật khẩu tạm để bạn gửi cho học viên.`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Cấp mật khẩu tạm", cancelButtonText: "Huỷ",
    });
    if (!ok.isConfirmed) return;
    try {
      const res = await fetch(`${API_URL}/api/password-reset/teacher/reset`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId, studentId: student.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Không đặt lại được mật khẩu");
      reload();
      showTempPasswordDialog(data.name, data.email, data.tempPassword);
    } catch (err) {
      Swal.fire("Lỗi", (err as Error).message, "error");
    }
  }, [teacherId, reload]);

  const dismissRequest = useCallback(async (req: ResetRequest) => {
    if (!teacherId) return;
    const ok = await Swal.fire({
      title: "Bỏ qua yêu cầu?",
      text: `Yêu cầu của ${req.user.name} sẽ bị xoá khỏi danh sách, mật khẩu không thay đổi.`,
      icon: "question", showCancelButton: true, confirmButtonText: "Bỏ qua", cancelButtonText: "Huỷ",
    });
    if (!ok.isConfirmed) return;
    const res = await fetch(`${API_URL}/api/password-reset/teacher/requests/${req.id}/dismiss`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherId }),
    });
    if (!res.ok) Swal.fire("Lỗi", "Không bỏ qua được yêu cầu", "error");
    reload();
  }, [teacherId, reload]);

  return { requests, tempPasswords, reload, resetPassword, dismissRequest };
}

const formatDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—");

export function PasswordResetPanel({ requests, tempPasswords, resetPassword, dismissRequest }: ReturnType<typeof usePasswordResets>) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  if (requests.length === 0 && tempPasswords.length === 0) return null;

  return (
    <div className="space-y-4">
      {requests.length > 0 && (
        <div className="ui-card p-5 border-amber-200 bg-amber-50/40">
          <h3 className="font-bold text-foreground mb-1">Yêu cầu quên mật khẩu ({requests.length})</h3>
          <p className="text-sm text-muted mb-4">Học viên đã bấm &quot;Quên mật khẩu&quot; ở trang đăng nhập. Cấp mật khẩu tạm rồi nhắn cho học viên qua số liên hệ bên dưới.</p>
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{r.user.name}</p>
                  <p className="text-xs text-muted break-all">{r.user.email}</p>
                  <p className="text-sm mt-1">Liên hệ: <b>{r.contact || r.user.phone || "—"}</b> <span className="text-xs text-muted">· {formatDateTime(r.createdAt)}</span></p>
                  {r.note && <p className="text-xs text-muted mt-0.5 italic">&quot;{r.note}&quot;</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resetPassword(r.user)} className="btn-primary px-4 py-2 text-sm cursor-pointer">Cấp Mật Khẩu Tạm</button>
                  <button onClick={() => dismissRequest(r)} className="btn-ghost px-3 py-2 text-sm cursor-pointer">Bỏ qua</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tempPasswords.length > 0 && (
        <div className="ui-card p-5">
          <h3 className="font-bold text-foreground mb-1">Mật khẩu tạm chưa được đổi ({tempPasswords.length})</h3>
          <p className="text-sm text-muted mb-4">Mật khẩu bạn đã cấp nhưng học viên chưa đăng nhập để đặt mật khẩu mới. Học viên đổi xong thì dòng đó tự biến mất.</p>
          <ul className="divide-y divide-line">
            {tempPasswords.map((t) => (
              <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted break-all">{t.email}{t.phone ? ` · ${t.phone}` : ""} · cấp lúc {formatDateTime(t.tempPasswordIssuedAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <code className="px-3 py-2 rounded-lg bg-primary-soft text-primary font-bold tracking-wider text-sm min-w-[110px] text-center">
                    {revealed[t.id] ? t.tempPassword : "••••-••••"}
                  </code>
                  <button onClick={() => setRevealed((v) => ({ ...v, [t.id]: !v[t.id] }))} className="btn-outline px-3 py-2 text-sm cursor-pointer">
                    {revealed[t.id] ? "Ẩn" : "Hiện"}
                  </button>
                  <button onClick={() => copyText(loginMessage(t.email, t.tempPassword))} className="btn-outline px-3 py-2 text-sm cursor-pointer">Sao chép tin nhắn</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
