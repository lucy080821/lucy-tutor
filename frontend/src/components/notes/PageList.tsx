"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { notesApi, errMsg } from "./api";
import { Spinner, timeAgo } from "./ui";
import type { Bootstrap, PageItem, View } from "./types";

export function viewTitle(view: View, boot: Bootstrap) {
  switch (view.kind) {
    case "inbox": return "Hộp thư ghi nhanh";
    case "all": return "Tất cả trang";
    case "pinned": return "Đã ghim";
    case "archived": return "Lưu trữ";
    case "trash": return "Thùng rác";
    case "study": return "Ôn hôm nay";
    case "tag": return `#${view.tag}`;
    case "section": {
      for (const nb of boot.notebooks) { const s = nb.sections.find((x) => x.id === view.id); if (s) return `${nb.name} / ${s.name}`; }
      return "Mục";
    }
    default: return "";
  }
}

function viewQuery(view: View) {
  if (view.kind === "section") return `view=section&sectionId=${view.id}`;
  if (view.kind === "tag") return `view=tag&tag=${encodeURIComponent(view.tag)}`;
  return `view=${view.kind}`;
}

type Tree = { item: PageItem; depth: number; hasKids: boolean };

export default function PageList({ view, boot, activeId, onOpen, onNew, refreshKey, patches, removed, refreshBoot }: {
  view: View; boot: Bootstrap; activeId: string | null; onOpen: (id: string) => void;
  onNew: (opts?: { parentId?: string; title?: string; quick?: string }) => void;
  refreshKey: number; patches: Record<string, Partial<PageItem>>; removed: Set<string>; refreshBoot: () => void;
}) {
  const [pages, setPages] = useState<PageItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("updated");
  const [quick, setQuick] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const dragId = useRef<string | null>(null);
  const qs = viewQuery(view);
  const inSection = view.kind === "section" && !q;

  const load = async (skip = 0) => {
    try {
      const r = await notesApi<{ pages: PageItem[]; total: number }>(`/pages?${qs}&q=${encodeURIComponent(q)}&sort=${sort}&skip=${skip}&take=${inSection ? 200 : 60}`);
      setPages((prev) => (skip ? [...(prev || []), ...r.pages] : r.pages));
      setTotal(r.total);
    } catch (err) { setPages([]); Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  useEffect(() => {
    setPages(null);
    const t = setTimeout(() => load(0), q ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, q, sort, refreshKey]);

  // Cập nhật lạc quan từ trang đang sửa (tiêu đề/đoạn trích/thời gian) mà không tải lại danh sách
  const list = useMemo(() => (pages || []).filter((p) => !removed.has(p.id)).map((p) => (patches[p.id] ? { ...p, ...patches[p.id] } : p)), [pages, patches, removed]);

  const tree: Tree[] = useMemo(() => {
    if (!inSection) return list.map((item) => ({ item, depth: 0, hasKids: false }));
    const ids = new Set(list.map((p) => p.id));
    const kids: Record<string, PageItem[]> = {};
    const roots: PageItem[] = [];
    list.forEach((p) => { if (p.parentId && ids.has(p.parentId)) (kids[p.parentId] ||= []).push(p); else roots.push(p); });
    const out: Tree[] = [];
    const walk = (p: PageItem, depth: number) => {
      out.push({ item: p, depth, hasKids: !!kids[p.id]?.length });
      if (!collapsed.has(p.id)) (kids[p.id] || []).forEach((k) => walk(k, depth + 1));
    };
    roots.forEach((r) => walk(r, 0));
    return out;
  }, [list, inSection, collapsed]);

  const drop = async (targetId: string) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const a = list.find((p) => p.id === from); const b = list.find((p) => p.id === targetId);
    if (!a || !b || a.parentId !== b.parentId) return;
    const siblings = list.filter((p) => p.parentId === a.parentId).sort((x, y) => x.order - y.order).map((p) => p.id).filter((id) => id !== from);
    siblings.splice(siblings.indexOf(targetId), 0, from);
    setPages((prev) => (prev || []).map((p) => { const i = siblings.indexOf(p.id); return i >= 0 ? { ...p, order: i } : p; }).sort((x, y) => x.order - y.order));
    try { await notesApi("/pages/reorder", { body: { ids: siblings } }); } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const restore = async (id: string) => {
    try { await notesApi(`/pages/${id}/restore`, { body: {} }); setPages((p) => (p || []).filter((x) => x.id !== id)); refreshBoot(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const destroy = async (id: string) => {
    const r = await Swal.fire({ icon: "warning", title: "Xoá vĩnh viễn?", text: "Trang và file đính kèm bị xoá hẳn, không khôi phục được.", showCancelButton: true, confirmButtonText: "Xoá vĩnh viễn", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
    if (!r.isConfirmed) return;
    try { await notesApi(`/pages/${id}/permanent`, { method: "DELETE" }); setPages((p) => (p || []).filter((x) => x.id !== id)); refreshBoot(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const emptyTrash = async () => {
    const r = await Swal.fire({ icon: "warning", title: "Dọn sạch thùng rác?", text: `${total} trang sẽ bị xoá vĩnh viễn.`, showCancelButton: true, confirmButtonText: "Dọn sạch", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
    if (!r.isConfirmed) return;
    try { await notesApi("/trash", { method: "DELETE" }); setPages([]); setTotal(0); refreshBoot(); } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const submitQuick = () => {
    const text = quick.trim();
    if (!text) return;
    onNew({ quick: text });
    setQuick("");
  };

  const canCreate = view.kind !== "trash" && view.kind !== "archived";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-3 border-b border-line space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="font-extrabold text-primary text-lg truncate">{viewTitle(view, boot)}</h1>
          <span className="text-xs text-muted shrink-0">{total} trang</span>
          {canCreate && <button type="button" onClick={() => onNew()} className="ml-auto btn-outline h-9 px-3 text-xs shrink-0">+ Trang</button>}
          {view.kind === "trash" && total > 0 && <button type="button" onClick={emptyTrash} className="ml-auto text-xs font-bold text-red-700 hover:underline">Dọn sạch</button>}
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder='Tìm: từ khoá, "cụm từ", tag:abc, co:anh' className="ui-input py-2 text-sm flex-1 min-w-0" aria-label="Tìm trong danh sách" />
          {!inSection && (
            <select value={sort} onChange={(e) => setSort(e.target.value)} className="ui-input py-2 text-sm w-auto" aria-label="Sắp xếp">
              <option value="updated">Mới sửa</option><option value="created">Mới tạo</option><option value="title">Tên A–Z</option>
            </select>
          )}
        </div>
        {(view.kind === "inbox" || view.kind === "section" || view.kind === "all") && (
          <div className="flex gap-2">
            <input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); }}
              placeholder="Ghi nhanh… (Enter để lưu)" className="ui-input py-2 text-sm flex-1 min-w-0 bg-primary-soft/40" aria-label="Ghi nhanh" />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!pages ? <Spinner label="Đang tải…" /> : !tree.length ? (
          <div className="text-center text-sm text-muted py-10 px-4">
            {q ? "Không tìm thấy trang nào." : view.kind === "trash" ? "Thùng rác trống." : view.kind === "study" ? "Hôm nay không có trang nào cần ôn. Bật \"Ôn lại trang này\" ở trang bất kỳ để được nhắc." : "Chưa có trang nào."}
            {canCreate && !q && <button type="button" onClick={() => onNew()} className="btn-primary block mx-auto mt-4 px-5 py-2">Tạo trang đầu tiên</button>}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {tree.map(({ item: p, depth, hasKids }) => (
              <li key={p.id} draggable={inSection} onDragStart={() => { dragId.current = p.id; }} onDragOver={(e) => { if (inSection) e.preventDefault(); }} onDrop={() => drop(p.id)}>
                <div className={`group flex items-stretch rounded-xl ${activeId === p.id ? "bg-primary-soft" : "hover:bg-[#f3f6fb]"}`} style={{ paddingLeft: depth * 16 }}>
                  {inSection && (
                    <button type="button" aria-label={hasKids ? (collapsed.has(p.id) ? "Mở trang con" : "Thu gọn trang con") : undefined} disabled={!hasKids}
                      onClick={() => { const n = new Set(collapsed); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); setCollapsed(n); }}
                      className="w-6 shrink-0 flex items-center justify-center text-muted">
                      {hasKids && <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 transition-transform ${collapsed.has(p.id) ? "-rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>}
                    </button>
                  )}
                  <button type="button" onClick={() => onOpen(p.id)} className="flex-1 min-w-0 text-left px-2 py-2.5">
                    <span className="flex items-center gap-1.5">
                      {p.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />}
                      <span className={`truncate text-sm font-bold ${activeId === p.id ? "text-primary" : "text-foreground"}`}>{p.title || "Không tiêu đề"}</span>
                      {p.pinned && <span className="text-[10px] font-bold text-primary shrink-0">GHIM</span>}
                    </span>
                    {p.excerpt && <span className="block text-xs text-muted line-clamp-2 mt-0.5">{p.excerpt}</span>}
                    <span className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-muted">
                      <span>{timeAgo(p.updatedAt)}</span>
                      {p.tags.slice(0, 3).map((t) => <span key={t} className="text-primary/80">#{t}</span>)}
                      {p.studyDueAt && new Date(p.studyDueAt) <= new Date() && <span className="text-red-700 font-bold">Đến hạn ôn</span>}
                    </span>
                  </button>
                  {view.kind === "trash" ? (
                    <span className="flex flex-col justify-center gap-1 pr-2">
                      <button type="button" onClick={() => restore(p.id)} className="text-xs font-bold text-primary hover:underline">Khôi phục</button>
                      <button type="button" onClick={() => destroy(p.id)} className="text-xs font-bold text-red-700 hover:underline">Xoá hẳn</button>
                    </span>
                  ) : inSection && depth < 2 && (
                    <button type="button" onClick={() => onNew({ parentId: p.id })} className="btn-ghost w-8 h-8 p-0 self-center opacity-0 group-hover:opacity-100 focus:opacity-100 mr-1" aria-label="Thêm trang con" title="Thêm trang con">+</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {pages && pages.length < total && <button type="button" onClick={() => load(pages.length)} className="btn-ghost w-full py-2 text-sm mt-2">Tải thêm</button>}
      </div>
    </div>
  );
}
