"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import Pagination from "@/components/Pagination";
import { usePagination } from "@/lib/usePagination";
import { adminFetch, AdminAuthError, formatVNDate, FREE_STATUS_LABEL, ROLE_LABEL, type AdminUser, type FreeStatus } from "@/lib/adminApi";
import { ErrorBlock, LoadingBlock, Modal, SectionCard } from "./ui";

const PAGE_SIZE = 20;
type RoleFilter = "ALL" | "STUDENT" | "FREE" | "TEACHER" | "ADMIN";
const ROLE_FILTERS: { id: RoleFilter; label: string }[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "STUDENT", label: "Học viên" },
  { id: "FREE", label: "Học viên tự do" },
  { id: "TEACHER", label: "Giáo viên" },
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
    return () => { cancelled = true; };
  }, [reloadTick, handleError]);

  // Lọc trên toàn bộ danh sách trước, rồi mới phân trang
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return (users || []).filter((u) => {
      if (roleFilter === "STUDENT" && u.role !== "STUDENT") return false;
      if (roleFilter === "FREE" && !u.freeStatus) return false;
      if (roleFilter === "TEACHER" && u.role !== "TEACHER") return false;
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
    ADMIN: users?.filter((u) => u.role === "ADMIN").length || 0,
  }), [users]);

  const createTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await adminFetch<{ user: { name: string; email: string }; defaultPassword: string }>("/users/teacher", {
        method: "POST", body: JSON.stringify(newTeacher),
      });
      setCreating(false);
      setNewTeacher({ name: "", email: "", phone: "" });
      Swal.fire({
        title: "Đã tạo tài khoản giáo viên",
        html: `Gửi cho <b>${esc(r.user.name)}</b> thông tin đăng nhập:<br/>Email: <b>${esc(r.user.email)}</b><br/>Mật khẩu: <b>${r.defaultPassword}</b>`,
        icon: "success",
      });
      reload();
    } catch (err) {
      handleError(err, "Không tạo được tài khoản");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = async (u: AdminUser) => {
    const ok = await Swal.fire({
      title: "Đặt lại mật khẩu?",
      html: `Mật khẩu của <b>${esc(u.name)}</b> (${esc(u.email)}) sẽ được đặt về mật khẩu mặc định. Mật khẩu hiện tại sẽ không dùng được nữa.`,
      icon: "warning", showCancelButton: true, confirmButtonText: "Đặt lại", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626",
    });
    if (!ok.isConfirmed) return;
    try {
      const r = await adminFetch<{ defaultPassword: string }>(`/users/${u.id}/reset-password`, { method: "POST" });
      Swal.fire("Đã đặt lại", `Mật khẩu mới của ${u.name}: ${r.defaultPassword}`, "success");
    } catch (err) {
      handleError(err, "Không đặt lại được");
    }
  };

  if (error) return <ErrorBlock message={error} onRetry={() => { setError(""); reload(); }} />;

  return (
    <SectionCard title="Người dùng" subtitle={users ? `${users.length.toLocaleString("vi-VN")} tài khoản` : undefined}
      actions={<button onClick={() => setCreating(true)} className="btn-primary px-4 py-2 text-sm cursor-pointer">+ Tạo tài khoản giáo viên</button>}>
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
            <table className="ui-table min-w-[820px] text-sm">
              <thead>
                <tr>
                  <th>Người dùng</th>
                  <th>Vai trò</th>
                  <th>Lớp</th>
                  <th>Trạng thái</th>
                  <th>Đăng ký</th>
                  <th>Hoạt động gần nhất</th>
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
                      {u.role === "TEACHER" ? `Dạy ${u.classroomsOwned} lớp` : u.role === "ADMIN" ? "—" : u.classroomsJoined ? `${u.classroomsJoined} lớp` : "Chưa vào lớp"}
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
            <p className="text-xs text-muted">Tài khoản được tạo với mật khẩu mặc định — mật khẩu sẽ hiện sau khi tạo để bạn gửi cho giáo viên.</p>
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
