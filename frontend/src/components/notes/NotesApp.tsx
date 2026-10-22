"use client";
// Lucy Notes — màn chính /notes. Desktop 3 cột (sổ tay | danh sách | trang), điện thoại 1 cột mỗi lúc.
// Trạng thái xem nằm trên URL (?v=…&p=…) để tải lại trang / chia sẻ link nội bộ vẫn mở đúng chỗ.
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import Link from "next/link";
import { notesApi, errMsg, ApiError, isGuest } from "./api";
import { clearGuestNotes, localStats, migrateGuestNotes } from "./localStore";
import { Spinner } from "./ui";
import Sidebar from "./Sidebar";
import PageList from "./PageList";
import PageView from "./PageView";
import HomeView from "./HomeView";
import TasksView from "./TasksView";
import SharedView from "./SharedView";
import { AskModal, AgentModal, CommandPalette, TemplatePicker, type PickedTemplate } from "./Dialogs";
import { readDefaultStyle } from "./StylePanel";
import { exportAll } from "./exportNotes";
import type { Bootstrap, PageItem, View } from "./types";
import { clearSession, getSessionUserId } from "@/lib/session";

const LIST_VIEWS = new Set(["inbox", "all", "pinned", "archived", "trash", "study", "section", "tag"]);

function parseView(v: string | null): View {
  if (!v) return { kind: "home" };
  if (v.startsWith("section:")) return { kind: "section", id: v.slice(8) };
  if (v.startsWith("tag:")) return { kind: "tag", tag: v.slice(4) };
  if (["home", "inbox", "all", "pinned", "archived", "trash", "study", "tasks", "shared"].includes(v)) return { kind: v } as View;
  return { kind: "home" };
}
const encodeView = (v: View) => (v.kind === "section" ? `section:${v.id}` : v.kind === "tag" ? `tag:${v.tag}` : v.kind);

export default function NotesApp() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [boot, setBoot] = useState<Bootstrap | null>(null);
  const [fatal, setFatal] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [listKey, setListKey] = useState(0);
  const [patches, setPatches] = useState<Record<string, Partial<PageItem>>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<"" | "ask" | "agent" | "palette" | "template">("");
  const [autoTool, setAutoTool] = useState<{ id: string; tool: "record" | "ocr" } | null>(null);
  const view = parseView(params.get("v"));
  const pageId = params.get("p");

  const nav = useCallback((v: View, p: string | null) => {
    const q = new URLSearchParams();
    if (v.kind !== "home") q.set("v", encodeView(v));
    if (p) q.set("p", p);
    router.push(`${pathname}${q.toString() ? `?${q}` : ""}`, { scroll: false });
  }, [router, pathname]);

  const refreshBoot = useCallback(() => {
    notesApi<Bootstrap>("/bootstrap").then(setBoot).catch((err) => {
      // Phiên hỏng (tài khoản không còn / ADMIN) → bỏ phiên, dùng tiếp ở chế độ khách
      if (err instanceof ApiError && err.status === 401 && !isGuest()) { clearSession(); notesApi<Bootstrap>("/bootstrap").then(setBoot).catch((e) => setFatal(errMsg(e))); return; }
      if (!boot) setFatal(errMsg(err));
    });
  }, [boot]);

  useEffect(() => {
    refreshBoot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPage = useCallback((id: string) => { nav(LIST_VIEWS.has(view.kind) ? view : { kind: "all" }, id); }, [nav, view]);
  const setView = (v: View) => nav(v, null);

  const createPage = async (opts: { parentId?: string; quick?: string; template?: PickedTemplate; tool?: "record" | "ocr" } = {}) => {
    if (!boot) return;
    const sectionId = view.kind === "section" ? view.id : null;
    const body: Record<string, unknown> = { sectionId, parentId: opts.parentId };
    if (opts.quick) {
      const [first, ...lines] = opts.quick.split("\n");
      const rest = lines.join("\n").trim();
      const text = rest || (first.length > 80 ? opts.quick : "");
      body.title = first.slice(0, 80);
      body.contentJson = { type: "doc", content: [text ? { type: "paragraph", content: [{ type: "text", text }] } : { type: "paragraph" }] };
    } else if (opts.template) {
      body.title = opts.template.title; body.tags = opts.template.tags; body.contentJson = opts.template.contentJson; body.template = opts.template.id.slice(0, 40);
      if (opts.template.style) body.style = opts.template.style;
    } else if (opts.tool) {
      const stamp = new Date().toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
      body.title = opts.tool === "record" ? `Ghi âm ${stamp}` : `Ảnh chụp ${stamp}`;
    }
    // Mẫu không có giao diện riêng → dùng giao diện mặc định người dùng đã chọn ("Dùng cho trang mới")
    if (!body.style) { const def = readDefaultStyle(); if (def) body.style = def; }
    try {
      const page = await notesApi<PageItem>("/pages", { body });
      refreshBoot();
      if (opts.quick) { setListKey((k) => k + 1); return; }
      if (opts.tool) setAutoTool({ id: page.id, tool: opts.tool });
      setListKey((k) => k + 1);
      nav(LIST_VIEWS.has(view.kind) ? view : sectionId ? view : { kind: "inbox" }, page.id);
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const searchPages = useCallback(async (q: string) => {
    const r = await notesApi<{ pages: PageItem[] }>(`/pages?view=all&take=8&q=${encodeURIComponent(q)}`);
    return r.pages.filter((p) => p.id !== pageId).map((p) => ({ id: p.id, title: p.title }));
  }, [pageId]);

  const doExport = async () => {
    Swal.fire({ title: "Đang xuất ghi chú…", html: "Đang chuẩn bị", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const n = await exportAll((done, total) => Swal.update({ html: `${done}/${total || "?"} trang` }));
      Swal.fire({ icon: "success", text: `Đã xuất ${n} trang (Markdown theo thư mục sổ/mục + notes.json).` });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  // Phím tắt: Ctrl/⌘+K tìm nhanh, Ctrl+Alt+N trang mới
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setDialog("palette"); }
      else if ((e.ctrlKey || e.metaKey) && e.altKey && e.key.toLowerCase() === "n") { e.preventDefault(); setDialog("template"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Vừa đăng nhập mà trình duyệt còn ghi chú làm lúc chưa đăng nhập → hỏi đưa lên tài khoản
  useEffect(() => {
    if (!boot || boot.user.guest || !getSessionUserId()) return;
    let skip = false;
    try { skip = sessionStorage.getItem("lucy_notes_migrate_later") === "1"; } catch { /* bỏ qua */ }
    if (skip) return;
    localStats().then(async ({ pages }) => {
      if (!pages) return;
      const r = await Swal.fire({
        icon: "question", title: "Đưa ghi chú trên máy lên tài khoản?",
        text: `Trình duyệt này còn ${pages} trang ghi chú bạn tạo khi chưa đăng nhập. Đưa lên tài khoản để dùng trên mọi thiết bị?`,
        showDenyButton: true, showCancelButton: true, confirmButtonText: "Đưa lên tài khoản", denyButtonText: "Xoá khỏi máy", cancelButtonText: "Để sau",
      });
      if (r.isConfirmed) {
        Swal.fire({ title: "Đang đưa ghi chú lên…", html: "Chuẩn bị", allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
          const res = await migrateGuestNotes((path, opts) => notesApi(path, opts), (d, t) => Swal.update({ html: `${d}/${t} trang` }));
          await clearGuestNotes();
          refreshBoot(); setListKey((k) => k + 1);
          Swal.fire({ icon: "success", text: `Đã đưa ${res.pages} trang lên tài khoản.` });
        } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
      } else if (r.isDenied) {
        const ok = await Swal.fire({ icon: "warning", text: `Xoá vĩnh viễn ${pages} trang trên trình duyệt này?`, showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
        if (ok.isConfirmed) await clearGuestNotes();
      } else {
        try { sessionStorage.setItem("lucy_notes_migrate_later", "1"); } catch { /* bỏ qua */ }
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot?.user.id]);

  const [hideGuestBar, setHideGuestBar] = useState(false);
  useEffect(() => { try { setHideGuestBar(localStorage.getItem("lucy_notes_guest_bar") === "0"); } catch { /* bỏ qua */ } }, []);

  const commands = useMemo(() => [
    { label: "Trang mới", run: () => setDialog("template") },
    { label: "Ghi âm thành ghi chú", run: () => createPage({ tool: "record" }) },
    { label: "Chụp vở / bảng", run: () => createPage({ tool: "ocr" }) },
    { label: "Hỏi sổ ghi chú", run: () => setDialog("ask") },
    ...(boot?.user.guest ? [] : [{ label: "Sắp xếp bằng lời", run: () => setDialog("agent") }]),
    { label: "Việc cần làm", run: () => setView({ kind: "tasks" }) },
    { label: "Ôn hôm nay", run: () => setView({ kind: "study" }) },
    { label: "Hộp thư ghi nhanh", run: () => setView({ kind: "inbox" }) },
    { label: "Thùng rác", run: () => setView({ kind: "trash" }) },
    { label: "Xuất toàn bộ ghi chú", run: doExport },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [view, boot]);

  if (fatal) return <div className="p-10 text-center"><p className="text-red-700">{fatal}</p><button type="button" onClick={() => location.reload()} className="btn-primary mt-4 px-5 py-2">Thử lại</button></div>;
  if (!boot) return <Spinner label="Đang mở sổ ghi chú…" />;

  const isList = LIST_VIEWS.has(view.kind);
  const listPane = isList && (
    <PageList view={view} boot={boot} activeId={pageId} onOpen={openPage} refreshKey={listKey} patches={patches} removed={removed} refreshBoot={refreshBoot}
      onNew={(o) => (o?.quick || o?.parentId ? createPage(o) : setDialog("template"))} />
  );
  const mainPane = pageId ? (
    <PageView key={pageId} pageId={pageId} boot={boot} onOpenPage={openPage} searchPages={searchPages} refreshBoot={refreshBoot}
      autoTool={autoTool?.id === pageId ? autoTool.tool : undefined} onAutoToolUsed={() => setAutoTool(null)}
      onChanged={(item) => setPatches((p) => ({ ...p, [item.id]: { ...p[item.id], ...item } }))}
      onRemoved={(id) => { setRemoved((r) => new Set(r).add(id)); nav(view.kind === "home" ? { kind: "home" } : view, null); }}
      onCreateChild={(parentId) => createPage({ parentId })}
      onBack={() => nav(view, null)} />
  ) : view.kind === "home" ? (
    <HomeView boot={boot} onOpen={openPage} onNewPage={() => setDialog("template")} onRecordNew={() => createPage({ tool: "record" })} onOcrNew={() => createPage({ tool: "ocr" })}
      onAsk={() => setDialog("ask")} onAgent={() => setDialog("agent")} refreshBoot={refreshBoot} refreshList={() => setListKey((k) => k + 1)} />
  ) : view.kind === "tasks" ? <TasksView onOpen={openPage} refreshBoot={refreshBoot} />
    : view.kind === "shared" ? <SharedView boot={boot} onOpenOwn={openPage} refreshBoot={refreshBoot} />
      : <div className="hidden lg:flex h-full items-center justify-center text-sm text-muted p-8 text-center">Chọn một trang để xem, hoặc bấm "+ Trang" để tạo mới.</div>;

  const sidebar = (
    <Sidebar boot={boot} view={view} onView={setView} onNewPage={() => setDialog("template")} onAsk={() => setDialog("ask")} onAgent={() => setDialog("agent")}
      onSearch={() => setDialog("palette")} onExport={doExport} refresh={() => { refreshBoot(); setListKey((k) => k + 1); }} onNavigate={() => setMenuOpen(false)} />
  );

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)] bg-background overflow-hidden">
      {boot.user.guest && !hideGuestBar && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 bg-primary-soft border-b border-line text-sm">
          <span className="ui-badge-new shrink-0">Miễn phí</span>
          <span className="text-foreground/80 min-w-0">Bạn đang dùng Ghi chú không cần đăng nhập — ghi chú lưu trên trình duyệt này. <b>Đăng nhập</b> để đồng bộ mọi thiết bị, đưa từ vựng vào deck ôn tập và liên kết bài học của lớp.</span>
          <span className="flex items-center gap-2 ml-auto">
            <Link href="/auth?role=STUDENT&next=/notes" className="btn-primary px-4 py-1.5 text-xs">Đăng nhập / Đăng ký</Link>
            <button type="button" onClick={() => { setHideGuestBar(true); try { localStorage.setItem("lucy_notes_guest_bar", "0"); } catch { /* bỏ qua */ } }} className="btn-ghost w-8 h-8 p-0" aria-label="Ẩn thông báo">×</button>
          </span>
        </div>
      )}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
      {/* Thanh trên cùng cho điện thoại */}
      <div className="lg:hidden flex items-center gap-2 px-3 py-2 bg-white border-b border-line">
        <button type="button" onClick={() => setMenuOpen(true)} className="btn-ghost w-10 h-10 p-0" aria-label="Mở menu sổ tay">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="font-bold text-primary">Ghi chú</span>
        <button type="button" onClick={() => setDialog("palette")} className="ml-auto btn-ghost h-10 px-3 text-sm">Tìm</button>
        <button type="button" onClick={() => setDialog("template")} className="btn-primary h-10 px-4 text-sm">+ Trang</button>
      </div>

      <aside className="hidden lg:block w-[260px] shrink-0 bg-white border-r border-line">{sidebar}</aside>
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[65] flex" onMouseDown={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}>
          <div className="w-[85vw] max-w-[300px] h-full bg-white shadow-card-hover">{sidebar}</div>
          <div className="flex-1 bg-[#0f1c3f]/40" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      {isList && <section className={`${pageId ? "hidden lg:block" : "block"} w-full lg:w-[330px] shrink-0 bg-white lg:border-r border-line min-h-0 flex-1 lg:flex-none`}>{listPane}</section>}
      <main className={`${isList && !pageId ? "hidden lg:block" : "block"} flex-1 min-w-0 min-h-0 bg-white`}>{mainPane}</main>

      </div>
      <AskModal open={dialog === "ask"} onClose={() => setDialog("")} boot={boot} onOpen={openPage} currentSectionId={view.kind === "section" ? view.id : null} onUsed={refreshBoot} />
      <AgentModal open={dialog === "agent"} onClose={() => setDialog("")} onDone={() => { refreshBoot(); setListKey((k) => k + 1); }} />
      <CommandPalette open={dialog === "palette"} onClose={() => setDialog("")} commands={commands} onOpen={openPage} />
      <TemplatePicker open={dialog === "template"} onClose={() => setDialog("")} onPick={(t) => createPage({ template: t })} isTeacher={boot.user.role === "TEACHER"} />
    </div>
  );
}
