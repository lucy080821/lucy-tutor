"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { notesApi, errMsg } from "./api";
import { fmtBytes } from "./ui";
import { NOTE_COLORS, type Bootstrap, type Notebook, type View } from "./types";

const sameView = (a: View, b: View) => a.kind === b.kind && (a as { id?: string }).id === (b as { id?: string }).id && (a as { tag?: string }).tag === (b as { tag?: string }).tag;
const OPEN_KEY = "lucy_notes_open_notebooks";

function Row({ active, onClick, label, count, alert, dot, indent }: { active?: boolean; onClick: () => void; label: string; count?: number; alert?: boolean; dot?: string; indent?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "page" : undefined}
      className={`group w-full flex items-center gap-2 rounded-[10px] ${indent ? "pl-7" : "pl-3"} pr-2 py-1.5 text-[14px] font-semibold text-left transition-colors ${active ? "bg-primary-soft text-primary shadow-[inset_3px_0_0_var(--primary)]" : "text-foreground/75 hover:bg-[#f3f6fb] hover:text-primary"}`}>
      {dot && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: dot }} />}
      <span className="truncate">{label}</span>
      {!!count && <span className={`ml-auto text-[11px] font-bold rounded-full px-1.5 min-w-5 text-center ${alert ? "bg-red-500 text-white" : "text-muted"}`}>{count > 999 ? "999+" : count}</span>}
    </button>
  );
}

async function pickColor(title: string, current: string) {
  const { value } = await Swal.fire({
    title, input: "radio", inputValue: current,
    inputOptions: Object.fromEntries(NOTE_COLORS.map((c) => [c, `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${c};vertical-align:middle"></span>`])),
    showCancelButton: true, confirmButtonText: "Chọn", cancelButtonText: "Huỷ",
  });
  return value as string | undefined;
}

export default function Sidebar({ boot, view, onView, onNewPage, onAsk, onAgent, onSearch, onExport, refresh, onNavigate }: {
  boot: Bootstrap; view: View; onView: (v: View) => void; onNewPage: () => void; onAsk: () => void; onAgent: () => void;
  onSearch: () => void; onExport: () => void; refresh: () => void; onNavigate?: () => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => { try { setOpen(new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || "[]"))); } catch { /* bỏ qua */ } }, []);
  // Sổ chứa mục đang xem luôn mở
  const activeNb = view.kind === "section" ? boot.notebooks.find((nb) => nb.sections.some((s) => s.id === view.id))?.id : null;
  const toggle = (id: string) => {
    const n = new Set(open);
    if (n.has(id)) n.delete(id); else n.add(id);
    setOpen(n);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...n])); } catch { /* bỏ qua */ }
  };
  const go = (v: View) => { onView(v); onNavigate?.(); };
  const c = boot.counts;

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); refresh(); } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } };
  const newNotebook = async () => {
    const { value } = await Swal.fire({ title: "Sổ tay mới", input: "text", inputPlaceholder: "Ví dụ: Học tiếng Anh, Công việc, Cá nhân", showCancelButton: true, confirmButtonText: "Tạo", cancelButtonText: "Huỷ" });
    if (!value?.trim()) return;
    act(async () => {
      const nb = await notesApi<Notebook>("/notebooks", { body: { name: value, color: NOTE_COLORS[boot.notebooks.length % NOTE_COLORS.length] } });
      const n = new Set(open); n.add(nb.id); setOpen(n);
      go({ kind: "section", id: nb.sections[0].id });
    });
  };
  const notebookMenu = async (nb: Notebook) => {
    const { value } = await Swal.fire({
      title: nb.name, input: "select", showCancelButton: true, confirmButtonText: "Chọn", cancelButtonText: "Đóng",
      inputOptions: { section: "Thêm mục", rename: "Đổi tên", color: "Đổi màu", ai: nb.aiDisabled ? "Bật lại AI cho sổ này" : "Tắt AI cho sổ này (nội dung không gửi cho AI)", delete: "Xoá sổ tay" },
    });
    if (value === "section") {
      const r = await Swal.fire({ title: "Mục mới", input: "text", inputPlaceholder: "Ví dụ: Ngữ pháp, Từ vựng, IELTS", showCancelButton: true, confirmButtonText: "Tạo", cancelButtonText: "Huỷ" });
      if (r.value?.trim()) act(async () => { const s = await notesApi<{ id: string }>("/sections", { body: { notebookId: nb.id, name: r.value } }); go({ kind: "section", id: s.id }); });
    } else if (value === "rename") {
      const r = await Swal.fire({ title: "Đổi tên sổ tay", input: "text", inputValue: nb.name, showCancelButton: true, confirmButtonText: "Lưu", cancelButtonText: "Huỷ" });
      if (r.value?.trim()) act(() => notesApi(`/notebooks/${nb.id}`, { method: "PATCH", body: { name: r.value } }));
    } else if (value === "color") {
      const color = await pickColor("Màu sổ tay", nb.color);
      if (color) act(() => notesApi(`/notebooks/${nb.id}`, { method: "PATCH", body: { color } }));
    } else if (value === "ai") {
      act(() => notesApi(`/notebooks/${nb.id}`, { method: "PATCH", body: { aiDisabled: !nb.aiDisabled } }));
    } else if (value === "delete") {
      const total = nb.sections.reduce((n, s) => n + s.count, 0);
      const r = await Swal.fire({ icon: "warning", title: `Xoá sổ "${nb.name}"?`, text: total ? `${total} trang bên trong sẽ vào thùng rác (khôi phục về Hộp thư ghi nhanh trong 30 ngày).` : "Sổ đang trống.", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
      if (r.isConfirmed) act(async () => { await notesApi(`/notebooks/${nb.id}`, { method: "DELETE" }); go({ kind: "home" }); });
    }
  };
  const sectionMenu = async (nb: Notebook, s: Notebook["sections"][number]) => {
    const others = boot.notebooks.filter((x) => x.id !== nb.id);
    const { value } = await Swal.fire({
      title: s.name, input: "select", showCancelButton: true, confirmButtonText: "Chọn", cancelButtonText: "Đóng",
      inputOptions: { rename: "Đổi tên", color: "Đổi màu", ...(others.length ? { move: "Chuyển sang sổ khác" } : {}), up: "Đưa lên trên", delete: "Xoá mục" },
    });
    if (value === "rename") {
      const r = await Swal.fire({ title: "Đổi tên mục", input: "text", inputValue: s.name, showCancelButton: true, confirmButtonText: "Lưu", cancelButtonText: "Huỷ" });
      if (r.value?.trim()) act(() => notesApi(`/sections/${s.id}`, { method: "PATCH", body: { name: r.value } }));
    } else if (value === "color") {
      const color = await pickColor("Màu mục", s.color);
      if (color) act(() => notesApi(`/sections/${s.id}`, { method: "PATCH", body: { color } }));
    } else if (value === "move") {
      const r = await Swal.fire({ title: "Chuyển mục sang sổ", input: "select", inputOptions: Object.fromEntries(others.map((o) => [o.id, o.name])), showCancelButton: true, confirmButtonText: "Chuyển", cancelButtonText: "Huỷ" });
      if (r.value) act(() => notesApi(`/sections/${s.id}`, { method: "PATCH", body: { notebookId: r.value } }));
    } else if (value === "up") {
      const ids = nb.sections.map((x) => x.id);
      const i = ids.indexOf(s.id);
      if (i > 0) { [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; act(() => notesApi("/sections/reorder", { body: { ids } })); }
    } else if (value === "delete") {
      const r = await Swal.fire({ icon: "warning", title: `Xoá mục "${s.name}"?`, text: s.count ? `${s.count} trang sẽ vào thùng rác.` : "Mục đang trống.", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
      if (r.isConfirmed) act(async () => { await notesApi(`/sections/${s.id}`, { method: "DELETE" }); if (view.kind === "section" && view.id === s.id) go({ kind: "home" }); });
    }
  };

  const used = Math.min(100, Math.round((boot.storage.used / boot.storage.quota) * 100));

  return (
    <nav className="flex flex-col h-full" aria-label="Sổ ghi chú">
      <div className="p-3 space-y-2 border-b border-line">
        <button type="button" onClick={onNewPage} className="btn-primary w-full py-2.5">+ Trang mới</button>
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" onClick={onSearch} className="btn-outline py-2 text-xs" title="Ctrl+K">Tìm · Ctrl K</button>
          <button type="button" onClick={onAsk} className="btn-outline py-2 text-xs">Hỏi sổ ghi chú</button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <Row label="Trang chủ ghi chú" active={view.kind === "home"} onClick={() => go({ kind: "home" })} />
        <Row label="Hộp thư ghi nhanh" count={c.inbox} active={view.kind === "inbox"} onClick={() => go({ kind: "inbox" })} />
        <Row label="Tất cả trang" active={view.kind === "all"} onClick={() => go({ kind: "all" })} />
        <Row label="Đã ghim" count={c.pinned} active={view.kind === "pinned"} onClick={() => go({ kind: "pinned" })} />
        <Row label="Việc cần làm" count={c.overdue || c.today} alert={c.overdue > 0} active={view.kind === "tasks"} onClick={() => go({ kind: "tasks" })} />
        <Row label="Ôn hôm nay" count={c.studyDue} alert={c.studyDue > 0} active={view.kind === "study"} onClick={() => go({ kind: "study" })} />
        {!boot.user.guest && <Row label={boot.user.role === "TEACHER" ? "Học viên gửi" : "Được chia sẻ"} count={c.sharedIn} alert={boot.user.role === "TEACHER" && c.sharedIn > 0} active={view.kind === "shared"} onClick={() => go({ kind: "shared" })} />}

        <div className="flex items-center pt-4 pb-1 px-3">
          <span className="ui-nav-group-label p-0">Sổ tay</span>
          <button type="button" onClick={newNotebook} className="ml-auto text-xs font-bold text-primary hover:underline">+ Sổ mới</button>
        </div>
        {!boot.notebooks.length && <p className="px-3 text-xs text-muted">Chưa có sổ tay. Tạo sổ để sắp xếp ghi chú theo chủ đề.</p>}
        {boot.notebooks.map((nb) => {
          const isOpen = open.has(nb.id) || activeNb === nb.id;
          return (
            <div key={nb.id}>
              <div className="group flex items-center">
                <button type="button" onClick={() => toggle(nb.id)} aria-expanded={isOpen} className="flex-1 min-w-0 flex items-center gap-2 rounded-[10px] pl-3 pr-1 py-1.5 text-[14px] font-bold text-foreground hover:bg-[#f3f6fb]">
                  <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 shrink-0 text-muted transition-transform ${isOpen ? "" : "-rotate-90"}`} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                  <span className="w-3 h-3 rounded shrink-0" style={{ background: nb.color }} />
                  <span className="truncate">{nb.name}</span>
                  {nb.aiDisabled && <span className="text-[10px] text-muted font-semibold shrink-0">AI tắt</span>}
                </button>
                <button type="button" onClick={() => notebookMenu(nb)} className="btn-ghost w-8 h-8 p-0 opacity-60 group-hover:opacity-100" aria-label={`Tuỳ chọn sổ ${nb.name}`}>⋯</button>
              </div>
              {isOpen && nb.sections.map((s) => (
                <div key={s.id} className="group flex items-center">
                  <div className="flex-1 min-w-0"><Row indent dot={s.color} label={s.name} count={s.count} active={view.kind === "section" && view.id === s.id} onClick={() => go({ kind: "section", id: s.id })} /></div>
                  <button type="button" onClick={() => sectionMenu(nb, s)} className="btn-ghost w-8 h-8 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100" aria-label={`Tuỳ chọn mục ${s.name}`}>⋯</button>
                </div>
              ))}
            </div>
          );
        })}

        {boot.tags.length > 0 && (
          <>
            <p className="ui-nav-group-label px-3 pt-4 pb-1">Thẻ</p>
            <div className="flex flex-wrap gap-1 px-3">
              {boot.tags.slice(0, 24).map((t) => (
                <button key={t.tag} type="button" onClick={() => go({ kind: "tag", tag: t.tag })} className={`ui-chip text-xs py-1 ${sameView(view, { kind: "tag", tag: t.tag }) ? "ui-chip-active" : ""}`}>#{t.tag}</button>
              ))}
            </div>
          </>
        )}

        <div className="pt-4 space-y-0.5">
          <Row label="Lưu trữ" count={c.archived} active={view.kind === "archived"} onClick={() => go({ kind: "archived" })} />
          <Row label="Thùng rác" count={c.trash} active={view.kind === "trash"} onClick={() => go({ kind: "trash" })} />
        </div>
      </div>
      <div className="p-3 border-t border-line space-y-2 text-xs text-muted">
        {!boot.user.guest && <button type="button" onClick={onAgent} className="btn-ghost w-full py-1.5 text-xs justify-start">Sắp xếp bằng lời (trợ lý)</button>}
        <div>
          <div className="flex justify-between"><span>{boot.user.guest ? "Lưu trên trình duyệt" : "File đính kèm"}</span><span>{fmtBytes(boot.storage.used)} / {fmtBytes(boot.storage.quota)}</span></div>
          <div className="h-1.5 rounded-full bg-line mt-1 overflow-hidden"><div className={`h-full ${used > 85 ? "bg-red-500" : "bg-primary"}`} style={{ width: `${used}%` }} /></div>
        </div>
        <p>AI hôm nay: còn {boot.usage.TEXT.left}/{boot.usage.TEXT.limit} lượt · ghi âm {boot.usage.AUDIO.left}/{boot.usage.AUDIO.limit}</p>
        <div className="flex gap-3">
          <button type="button" onClick={onExport} className="font-bold text-primary hover:underline">Xuất toàn bộ (.zip)</button>
          {boot.user.guest
            ? <Link href="/auth?role=STUDENT&next=/notes" className="font-bold text-primary hover:underline ml-auto">Đăng nhập để đồng bộ</Link>
            : <Link href={boot.user.role === "TEACHER" ? "/teacher" : "/dashboard"} className="font-bold text-primary hover:underline ml-auto">← Dashboard</Link>}
        </div>
      </div>
    </nav>
  );
}
