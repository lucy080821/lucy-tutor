"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Pagination from "@/components/Pagination";
import { usePagination } from "@/lib/usePagination";
import { adminFetch, AdminAuthError, formatVNDate, FREE_STATUS_LABEL, ROLE_LABEL, type AdminUser, type FreeStatus, type PasswordRequest } from "@/lib/adminApi";
import { SITE_URL } from "@/lib/seo";
import { ErrorBlock, LoadingBlock, Modal, SectionCard } from "./ui";

const PAGE_SIZE = 20;
type RoleFilter = "ALL" | "STUDENT" | "FREE" | "TEACHER" | "NOTES" | "ADMIN";
const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "STUDENT", label: "Học viên" },
  { id: "FREE", label: "Học viên tự do" },
  { id: "TEACHER", label: "Giáo viên" },
  { id: "NOTES", label: "Tài khoản Ghi chú" },
  { id: "ADMIN", label: "Quản trị" },
];
const FREE_STATUS_STYLE: Record<FreeStatus, string> = {
  TRIAL: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  LOCKED: "bg-red-50 text-red-700",
  EXEMPT: "bg-slate-100 text-slate-600",
};

// Tên/email do người dùng tự nhập -> phải escape trước khi chèn vào HTML của SweetAlert
const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

// Bỏ dấu để tìm "tuan" ra "Tuấn"
// Tin nhắn soạn sẵn gửi mật khẩu tạm qua Zalo/điện thoại (email đăng nhập thường không phải hộp thư thật)
const loginMessage = (email: string, tempPassword: string) =>
  `Lucy Tutor — thông tin đăng nhập của bạn:\nEmail: ${email}\nMật khẩu tạm: ${tempPassword}\nĐăng nhập tại ${SITE_URL}/auth — hệ thống sẽ yêu cầu bạn đặt mật khẩu mới ngay sau đó.`;
const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    Swal.fire({ toast: true, position: "top-end", icon: "success", title: "Đã sao chép", showConfirmButton: false, timer: 1500 });
  } catch {
    Swal.fire("Không sao chép được", "Trình duyệt chặn quyền clipboard — hãy sao chép thủ công.", "warning");
  }
};
const showTempPassword = (title: string, name: string, email: string, tempPassword: string) =>
  Swal.fire({
    title,
    html: `Gửi cho <b>${esc(name)}</b> thông tin đăng nhập:<br/>Email: <b>${esc(email)}</b><br/>Mật khẩu tạm: <b style="font-size:18px;letter-spacing:1px">${esc(tempPassword)}</b>`
      + `<p style="margin-top:10px;font-size:13px;color:#64748b">Lần đăng nhập đầu sẽ phải đặt mật khẩu mới. Nếu quên, xem lại ở cột "Mật khẩu tạm" tới khi người dùng đổi.</p>`,
    icon: "success", showCancelButton: true, confirmButtonText: "Sao chép tin nhắn", cancelButtonText: "Đóng",
  }).then((r) => { if (r.isConfirmed) copyText(loginMessage(email, tempPassword)); });

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

export default function UsersTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("ALL");
  const [creating, setCreating] = useState(false);
  const [newTeacher, setNewTeacher] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [requests, setRequests] = useState<PasswordRequest[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const reload = () => setReloadTick((t) => t + 1);

  const handleError = useCallback((err: unknown, title?: string) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else if (title) Swal.fire(title, (err as Error).message, "error");
    else setError((err as Error).message);
  }, [onAuthLost]);

  useEffect(() => {
    let cancelled = false;
    adminFetch<{ users: AdminUser[] }>("/users")
      .then((d) => { if (!cancelled) setUsers(d.users); })
      .catch((err) => { if (!cancelled) handleError(err); });
    adminFetch<{ requests: PasswordRequest[] }>("/password-requests")
      .then((d) => { if (!cancelled) setRequests(d.requests); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reloadTick, handleError]);

  // Lọc trên toàn bộ danh sách trước, rồi mới phân trang
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (users || []).filter((u) => {
      if (roleFilter === "STUDENT" && u.role !== "STUDENT") return false;
      if (roleFilter === "FREE" && !u.freeStatus) return false;
      if (roleFilter === "TEACHER" && u.role !== "TEACHER") return false;
      if (roleFilter === "NOTES" && u.role !== "NOTES") return false;
      if (roleFilter === "ADMIN" && u.role !== "ADMIN") return false;
      return !q || fold(`${u.name} ${u.email} ${u.phone || ""}`).includes(q);
    });
  }, [users, query, roleFilter]);
  const pagination = usePagination(filtered, PAGE_SIZE, `${query}|${roleFilter}`);

  const counts = useMemo(() => ({
    ALL: users?.length || 0,
    STUDENT: users?.filter((u) => u.role === "STUDENT").length || 0,
    FREE: users?.filter((u) => u.freeStatus).length || 0,
    TEACHER: users?.filter((u) => u.role === "TEACHER").length || 0,
    NOTES: users?.filter((u) => u.role === "NOTES").length || 0,
    ADMIN: users?.filter((u) => u.role === "ADMIN").length || 0,
  }), [users]);

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await adminFetch<{ user: { name: string; email: string }; tempPassword: string }>("/users/teacher", {
        method: "POST", body: JSON.stringify(newTeacher),
      });
      setCreating(false);
      setNewTeacher({ name: "", email: "", phone: "" });
      showTempPassword("Đã tạo tài khoản giáo viên", r.user.name, r.user.email, r.tempPassword);
      reload();
    } catch (err) {
      handleError(err, "Không tạo được tài khoản");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: { id: string; name: string; email: string }) => {
    const ok = await Swal.fire({
      title: "Đặt lại mật khẩu?",
      html: `Hệ thống sẽ tạo 1 mật khẩu tạm cho <b>${esc(u.name)}</b> (${esc(u.email)}). Mật khẩu hiện tại sẽ không dùng được nữa.`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Đặt lại", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    try {
      const r = await adminFetch<{ tempPassword: string }>(`/users/${u.id}/reset-password`, { method: "POST" });
      reload();
      showTempPassword("Đã đặt lại mật khẩu", u.name, u.email, r.tempPassword);
    } catch (err) {
      handleError(err, "Không đặt lại được");
    }
  };

  const dismissRequest = async (r: PasswordRequest) => {
    try {
      await adminFetch(`/password-requests/${r.id}/dismiss`, { method: "POST" });
      setRequests((list) => list.filter((x) => x.id !== r.id));
    } catch (err) {
      handleError(err, "Không bỏ qua được yêu cầu");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => { setError(""); reload(); }} />;

  return (
    <SectionCard title="Người dùng" subtitle={users ? `${users.length.toLocaleString("vi-VN")} tài khoản` : undefined}
      actions={<button onClick={() => setCreating(true)} className="btn-primary px-4 py-2 text-sm cursor-pointer">+ Tạo tài khoản giáo viên</button>}>
      {requests.length > 0 && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="font-bold text-foreground mb-1">Yêu cầu quên mật khẩu ({requests.length})</p>
          <p className="text-xs text-muted mb-3">Gửi từ trang đăng nhập. Yêu cầu của giáo viên chỉ admin xử lý; yêu cầu của học viên thường do giáo viên phụ trách xử lý — admin làm thay nếu cần.</p>
          <ul className="divide-y divide-line">
            {requests.map((r) => (
              <li key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-semibold text-foreground">{r.user.name} <span className="text-xs font-normal text-muted">· {ROLE_LABEL[r.user.role] || r.user.role}</span></p>
                  <p className="text-xs text-muted break-all">{r.user.email} · Liên hệ: <b className="text-foreground">{r.contact || r.user.phone || "—"}</b> · {formatVNDate(r.createdAt)}</p>
                  {r.note && <p className="text-xs text-muted italic">&quot;{r.note}&quot;</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resetPassword(r.user)} className="btn-primary px-3 py-2 text-xs cursor-pointer">Cấp mật khẩu tạm</button>
                  <button onClick={() => dismissRequest(r)} className="btn-ghost px-3 py-2 text-xs cursor-pointer">Bỏ qua</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center gap-3 mb-4">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm theo tên, email, số điện thoại..."
          className="ui-input md:max-w-sm" aria-label="Tìm người dùng" />
        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((f) => (
            <button key={f.id} onClick={() => setRoleFilter(f.id)} className={`ui-chip ${roleFilter === f.id ? "ui-chip-active" : ""}`}>
              {f.label} <span className="opacity-70">({counts[f.id]})</span>
            </button>
          ))}
        </div>
      </div>

      {!users ? <LoadingBlock /> : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Không tìm thấy tài khoản nào.</p>
      ) : (
        <>
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="ui-table min-w-[960px] text-sm">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Lớp</th>
                  <th>Trạng thái</th>
                  <th>Đăng ký</th>
                  <th>Hoạt động gần nhất</th>
                  <th>Mật khẩu tạm</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <p className="font-semibold text-foreground">{u.name}</p>
                      <p className="text-xs text-muted break-all">{u.email}{u.phone ? ` · ${u.phone}` : ""}</p>
                    </td>
                    <td>{u.role === "ADMIN" ? <span className="ui-badge">{ROLE_LABEL.ADMIN}</span> : ROLE_LABEL[u.role] || u.role}</td>
                    <td className="text-muted">
                      {u.role === "TEACHER" ? `Dạy ${u.classroomsOwned} lớp` : u.role === "ADMIN" || u.role === "NOTES" ? "—" : u.classroomsJoined ? `${u.classroomsJoined} lớp` : "Chưa vào lớp"}
                    </td>
                    <td>
                      {u.freeStatus ? (
                        <div>
                          <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${FREE_STATUS_STYLE[u.freeStatus]}`}>{FREE_STATUS_LABEL[u.freeStatus]}</span>
                          {u.accessExpiresAt && <p className="text-[11px] text-muted mt-1">Hạn: {formatVNDate(u.accessExpiresAt)}</p>}
                          {u.managerTeacherName && <p className="text-[11px] text-muted">GV: {u.managerTeacherName}</p>}
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-muted whitespace-nowrap">{formatVNDate(u.createdAt)}</td>
                    <td className="text-muted whitespace-nowrap">{formatVNDate(u.lastActive)}</td>
                    <td className="whitespace-nowrap">
                      {u.tempPassword ? (
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-bold text-primary bg-primary-soft rounded px-2 py-1">{revealed[u.id] ? u.tempPassword : "••••-••••"}</code>
                          <button onClick={() => setRevealed((v) => ({ ...v, [u.id]: !v[u.id] }))} className="text-xs text-primary hover:underline px-1.5 py-2 cursor-pointer">{revealed[u.id] ? "Ẩn" : "Hiện"}</button>
                          <button onClick={() => copyText(loginMessage(u.email, u.tempPassword!))} className="text-xs text-primary hover:underline px-1.5 py-2 cursor-pointer">Sao chép</button>
                        </div>
                      ) : <span className="text-muted">—</span>}
                    </td>
                    <td className="text-right">
                      {/* Mật khẩu admin chỉ do chính admin đó đổi (hoặc script createAdmin.js) */}
                      {u.role !== "ADMIN" && <button onClick={() => resetPassword(u)} className="text-xs font-semibold text-primary hover:underline px-2 py-2 cursor-pointer whitespace-nowrap">
                        Đặt lại mật khẩu
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.totalItems}
            pageSize={PAGE_SIZE} onPageChange={pagination.setPage} />
        </>
      )}

      {creating && (
        <Modal title="Tạo tài khoản giáo viên" onClose={() => setCreating(false)}>
          <form onSubmit={createTeacher} className="space-y-4">
            <div>
              <label htmlFor="t-name" className="ui-label">Họ tên</label>
              <input id="t-name" required value={newTeacher.name} onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })} className="ui-input" />
            </div>
            <div>
              <label htmlFor="t-email" className="ui-label">Email đăng nhập</label>
              <input id="t-email" type="email" required value={newTeacher.email} onChange={(e) => setNewTeacher({ ...newTeacher, email: e.target.value })} className="ui-input" />
            </div>
            <div>
              <label htmlFor="t-phone" className="ui-label">Số điện thoại <span className="text-muted font-normal">(tuỳ chọn)</span></label>
              <input id="t-phone" type="tel" value={newTeacher.phone} onChange={(e) => setNewTeacher({ ...newTeacher, phone: e.target.value })} className="ui-input" />
            </div>
            <p className="text-xs text-muted">Tài khoản được tạo với mật khẩu tạm ngẫu nhiên — mật khẩu hiện sau khi tạo để bạn gửi cho giáo viên; giáo viên phải đặt mật khẩu mới ở lần đăng nhập đầu.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="btn-ghost px-4 py-2 cursor-pointer">Huỷ</button>
              <button type="submit" disabled={saving} className="btn-primary px-5 py-2 cursor-pointer">{saving ? "Đang tạo..." : "Tạo tài khoản"}</button>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
