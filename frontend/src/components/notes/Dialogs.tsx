"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { aiApi, notesApi, errMsg } from "./api";
import { Modal, Spinner, safeHtml } from "./ui";
import { TEMPLATES, TEMPLATE_GROUPS, templateSearchText, type Template } from "./templates";
import { isDark, linesCss, type PageStyle } from "./pageStyle";
import type { JSONContent } from "@tiptap/react";
import type { Bootstrap } from "./types";

// ── Đợt 3: Hỏi sổ ghi chú (chỉ trả lời từ ghi chú của chính người dùng, có trích dẫn bấm được) ──
export function AskModal({ open, onClose, boot, onOpen, currentSectionId, onUsed }: {
  open: boolean; onClose: () => void; boot: Bootstrap; onOpen: (id: string) => void; currentSectionId?: string | null; onUsed: () => void;
}) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("all");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<{ found: boolean; html: string; citations: { n: number; pageId: string; title: string; kind: string; snippet: string }[] } | null>(null);
  const ask = async () => {
    if (q.trim().length < 3) return;
    setLoading(true); setRes(null);
    try {
      const [type, id] = scope === "all" ? ["all", ""] : scope.split(":");
      const r = await aiApi<{ found: boolean; answer: string; citations: any[] }>("/ask", { body: { question: q, scope: { type, id } } });
      setRes({ found: r.found, html: await safeHtml(r.answer), citations: r.citations });
      if (r.citations.length) onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  const examples = boot.user.role === "TEACHER"
    ? ["Tuần này mình đã dặn lớp những gì?", "Tổng hợp ý tưởng bài giảng về câu bị động"]
    : ["Khi nào dùng since và for?", "Tổng hợp từ vựng chủ đề môi trường mình đã ghi", "Thầy dặn gì về bài nộp tuần này?"];
  return (
    <Modal open={open} onClose={onClose} title="Hỏi sổ ghi chú" wide>
      <div className="space-y-3">
        <p className="text-sm text-muted">AI chỉ trả lời dựa trên ghi chú của bạn (cả chữ trong ảnh và bản chép lời ghi âm), kèm nguồn để bấm mở. Không có trong ghi chú thì AI sẽ nói không có.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input autoFocus className="ui-input flex-1" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ask(); }} placeholder="Hỏi bất cứ điều gì bạn từng ghi…" />
          <select className="ui-input sm:w-56" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Phạm vi">
            <option value="all">Toàn bộ ghi chú</option>
            {currentSectionId && <option value={`section:${currentSectionId}`}>Mục đang xem</option>}
            {boot.notebooks.map((nb) => <option key={nb.id} value={`notebook:${nb.id}`}>Sổ: {nb.name}</option>)}
          </select>
          <button type="button" onClick={ask} disabled={loading || q.trim().length < 3} className="btn-primary px-5 py-2.5">Hỏi</button>
        </div>
        {!res && !loading && <div className="flex flex-wrap gap-1.5">{examples.map((e) => <button key={e} type="button" onClick={() => setQ(e)} className="ui-chip text-xs">{e}</button>)}</div>}
        {loading && <Spinner label="Đang tìm trong ghi chú của bạn…" />}
        {res && (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 note-content text-sm ${res.found ? "bg-primary-soft/50" : "bg-background"}`} dangerouslySetInnerHTML={{ __html: res.html }} />
            {res.citations.length > 0 && (
              <div>
                <p className="ui-label">Nguồn</p>
                <ul className="space-y-1.5">
                  {res.citations.map((c) => (
                    <li key={c.n}>
                      <button type="button" onClick={() => { onClose(); onOpen(c.pageId); }} className="w-full text-left rounded-xl border border-line p-3 hover:border-primary">
                        <span className="text-sm font-bold text-primary">[{c.n}] {c.title}</span>{c.kind && <span className="ui-badge ml-2">{c.kind}</span>}
                        <span className="block text-xs text-muted line-clamp-2 mt-1">{c.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Đợt 5: Trợ lý thao tác bằng lời — kế hoạch → xem trước → thực hiện → hoàn tác ──
type Plan = { runId: string; note: string; actions: { type: string; label: string; count?: number; sample?: string[]; name?: string; tag?: string }[] };
export function AgentModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [cmd, setCmd] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState<"" | "plan" | "run">("");
  const [history, setHistory] = useState<{ id: string; command: string; executedAt: string; undoneAt: string | null }[]>([]);
  useEffect(() => { if (open) aiApi("/agent/history").then(setHistory).catch(() => {}); }, [open]);

  const makePlan = async () => {
    setLoading("plan"); setPlan(null);
    try { setPlan(await aiApi<Plan>("/agent/plan", { body: { command: cmd } })); onDone(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const execute = async () => {
    if (!plan) return;
    setLoading("run");
    try {
      await aiApi(`/agent/${plan.runId}/execute`, { body: {} });
      onDone();
      setHistory(await aiApi("/agent/history"));
      const runId = plan.runId;
      setPlan(null); setCmd("");
      const r = await Swal.fire({ icon: "success", title: "Đã thực hiện", showDenyButton: true, confirmButtonText: "OK", denyButtonText: "Hoàn tác" });
      if (r.isDenied) await undo(runId);
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(""); }
  };
  const undo = async (id: string) => {
    try { await aiApi(`/agent/${id}/undo`, { body: {} }); onDone(); setHistory(await aiApi("/agent/history")); Swal.fire({ icon: "success", text: "Đã hoàn tác.", timer: 1200, showConfirmButton: false }); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const examples = ["Gắn thẻ ielts cho mọi trang có chữ writing", "Tạo sổ Công việc có 3 mục: Họp, Dự án, Ý tưởng", "Chuyển các trang trong hộp thư có thẻ ngu-phap vào mục Ngữ pháp", "Tạo trang mục lục cho mọi trang có thẻ on-thi", "Lưu trữ các trang tạo trước tháng 9/2026 có thẻ nhap"];
  return (
    <Modal open={open} onClose={onClose} title="Sắp xếp ghi chú bằng lời" wide>
      <div className="space-y-3">
        <p className="text-sm text-muted">Mô tả việc cần làm với nhiều trang cùng lúc. Trợ lý lập kế hoạch và cho bạn xem chính xác những trang bị ảnh hưởng — bấm "Thực hiện" mới chạy, và hoàn tác được. Trợ lý chỉ tạo sổ/mục/trang mục lục, chuyển trang, gắn/bỏ thẻ, ghim, lưu trữ — không bao giờ xoá trang.</p>
        <textarea className="ui-input w-full min-h-20" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="Ví dụ: Chuyển mọi trang có thẻ ielts vào sổ IELTS rồi tạo trang mục lục" />
        {!plan && <div className="flex flex-wrap gap-1.5">{examples.map((e) => <button key={e} type="button" onClick={() => setCmd(e)} className="ui-chip text-xs">{e}</button>)}</div>}
        <button type="button" onClick={makePlan} disabled={cmd.trim().length < 5 || !!loading} className="btn-primary w-full py-2.5">{loading === "plan" ? "Đang lập kế hoạch…" : "Lập kế hoạch"}</button>
        {plan && (
          <div className="rounded-xl border border-line p-4 space-y-2">
            <p className="ui-label">Kế hoạch</p>
            {!plan.actions.length ? <p className="text-sm text-muted">{plan.note || "Không tìm được thao tác phù hợp hoặc không có trang nào khớp điều kiện."}</p> : (
              <ol className="list-decimal pl-5 space-y-2 text-sm">
                {plan.actions.map((a, i) => (
                  <li key={i}>
                    <b>{a.label || a.type}</b>
                    {a.count !== undefined && <span className="text-muted"> — {a.count} trang{a.sample?.length ? `: ${a.sample.join(", ")}${a.count > a.sample.length ? "…" : ""}` : ""}</span>}
                  </li>
                ))}
              </ol>
            )}
            {plan.note && plan.actions.length > 0 && <p className="text-xs text-muted">{plan.note}</p>}
            {plan.actions.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button type="button" onClick={() => setPlan(null)} className="btn-ghost py-2">Huỷ</button>
                <button type="button" onClick={execute} disabled={!!loading} className="btn-primary py-2">{loading === "run" ? "Đang thực hiện…" : "Thực hiện"}</button>
              </div>
            )}
          </div>
        )}
        {history.length > 0 && (
          <div>
            <p className="ui-label">Đã thực hiện gần đây</p>
            <ul className="space-y-1">
              {history.map((h) => (
                <li key={h.id} className="flex items-center gap-2 text-sm rounded-lg border border-line px-3 py-2">
                  <span className="truncate">{h.command}</span>
                  {h.undoneAt ? <span className="ml-auto text-xs text-muted shrink-0">Đã hoàn tác</span> : <button type="button" onClick={() => undo(h.id)} className="ml-auto text-xs font-bold text-primary hover:underline shrink-0">Hoàn tác</button>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Ctrl+K: tìm trang + lệnh nhanh ──
export function CommandPalette({ open, onClose, commands, onOpen }: {
  open: boolean; onClose: () => void; commands: { label: string; run: () => void }[]; onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [pages, setPages] = useState<{ id: string; title: string; excerpt: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => notesApi<{ pages: any[] }>(`/pages?view=all&take=12&q=${encodeURIComponent(q)}`).then((r) => setPages(r.pages)).catch(() => {}), q ? 180 : 0);
    return () => clearTimeout(t);
  }, [q, open]);
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const cmds = useMemo(() => commands.filter((c) => !q || norm(c.label).includes(norm(q))).slice(0, 6), [commands, q]);
  const rows = [...cmds.map((c) => ({ key: `c${c.label}`, label: c.label, sub: "Lệnh", run: c.run })), ...pages.map((p) => ({ key: p.id, label: p.title || "Không tiêu đề", sub: p.excerpt, run: () => onOpen(p.id) }))];
  const pick = (i: number) => { const r = rows[i]; if (!r) return; onClose(); r.run(); };
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] bg-[#0f1c3f]/40 flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-card-hover overflow-hidden" role="dialog" aria-label="Tìm nhanh">
        <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Tìm trang hoặc gõ lệnh…"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(rows.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); pick(idx); }
            else if (e.key === "Escape") onClose();
          }}
          className="w-full px-5 py-4 text-base border-b border-line focus:outline-none" />
        <ul className="max-h-[50vh] overflow-y-auto p-2">
          {rows.map((r, i) => (
            <li key={r.key}>
              <button type="button" onMouseEnter={() => setIdx(i)} onClick={() => pick(i)} className={`w-full text-left rounded-xl px-3 py-2 ${i === idx ? "bg-primary-soft" : ""}`}>
                <span className="block text-sm font-bold truncate">{r.label}</span>
                <span className="block text-xs text-muted truncate">{r.sub}</span>
              </button>
            </li>
          ))}
          {!rows.length && <li className="text-sm text-muted p-3">Không tìm thấy.</li>}
        </ul>
        <p className="px-4 py-2 border-t border-line text-[11px] text-muted">↑↓ chọn · Enter mở · Esc đóng · Mẹo: tag:ten-the, co:anh, "cụm từ"</p>
      </div>
    </div>
  );
}

export type PickedTemplate = { id: string; title: string; tags: string[]; contentJson: JSONContent; style?: PageStyle | null };
type MyTemplate = { id: string; name: string; description: string; contentJson: JSONContent; style: PageStyle | null; tags: string[] };

function StylePreview({ style }: { style?: PageStyle | null }) {
  const dark = !!style?.bg && isDark(style.bg);
  const ink = style?.text || (dark ? "#e2e8f0" : "#94a3b8");
  return (
    <span aria-hidden="true" className="block h-14 rounded-lg border border-line overflow-hidden relative" style={{ backgroundColor: style?.bg || "#fff", ...linesCss({ ...style, size: "sm" }), paddingLeft: undefined }}>
      <span className="absolute left-3 top-2.5 right-6 h-1.5 rounded-full" style={{ background: style?.text || (dark ? "#e2e8f0" : "#1E3A8A"), opacity: 0.75 }} />
      <span className="absolute left-3 top-6 right-10 h-1 rounded-full" style={{ background: ink, opacity: 0.5 }} />
      <span className="absolute left-3 top-9 right-14 h-1 rounded-full" style={{ background: ink, opacity: 0.5 }} />
    </span>
  );
}

function TemplateCard({ name, desc, style, onClick, extra }: { name: string; desc: string; style?: PageStyle | null; onClick: () => void; extra?: React.ReactNode }) {
  return (
    <div className="relative">
      <button type="button" onClick={onClick} className="w-full h-full text-left rounded-xl border border-line p-2.5 hover:border-primary hover:bg-primary-soft/40">
        <StylePreview style={style} />
        <span className="block font-bold text-sm text-primary mt-2">{name}</span>
        <span className="block text-xs text-muted mt-0.5 line-clamp-2">{desc}</span>
      </button>
      {extra}
    </div>
  );
}

export function TemplatePicker({ open, onClose, onPick, isTeacher }: { open: boolean; onClose: () => void; onPick: (t: PickedTemplate) => void; isTeacher: boolean }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string>("Tất cả");
  const [mine, setMine] = useState<MyTemplate[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setQ("");
    notesApi<MyTemplate[]>("/templates").then(setMine).catch(() => setMine([]));
  }, [open]);
  const nq = q.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase().trim();
  const builtIn = TEMPLATES.filter((t) => (!t.teacherOnly || isTeacher) && (group === "Tất cả" || group === t.group) && (!nq || templateSearchText(t).includes(nq)));
  const myList = (mine || []).filter((t) => (group === "Tất cả" || group === "Mẫu của tôi") && (!nq || templateSearchText(t).includes(nq)));
  const groups = ["Tất cả", "Mẫu của tôi", ...TEMPLATE_GROUPS.filter((g) => g !== "Giáo viên" || isTeacher)];
  const pickBuiltIn = (t: Template) => { onPick({ id: t.id, title: t.title, tags: t.tags, contentJson: t.build(), style: t.style }); onClose(); };
  const pickMine = (t: MyTemplate) => { onPick({ id: `mine:${t.id}`, title: t.name, tags: t.tags, contentJson: t.contentJson, style: t.style }); onClose(); };
  const removeMine = async (t: MyTemplate) => {
    const r = await Swal.fire({ icon: "warning", text: `Xoá mẫu "${t.name}"? Các trang đã tạo từ mẫu không bị ảnh hưởng.`, showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
    if (!r.isConfirmed) return;
    try { await notesApi(`/templates/${t.id}`, { method: "DELETE" }); setMine((m) => m?.filter((x) => x.id !== t.id) || null); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const shownGroups = group === "Tất cả" ? TEMPLATE_GROUPS : TEMPLATE_GROUPS.filter((g) => g === group);
  return (
    <Modal open={open} onClose={onClose} title="Trang mới" wide>
      <div className="space-y-4">
        <input autoFocus className="ui-input w-full" placeholder="Tìm mẫu: họp, Cornell, IELTS, thói quen…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm mẫu" />
        <div className="flex flex-wrap gap-1.5">
          {groups.map((g) => <button key={g} type="button" onClick={() => setGroup(g)} className={`ui-chip text-xs ${group === g ? "ui-chip-active" : ""}`}>{g}{g === "Mẫu của tôi" && mine ? ` (${mine.length})` : ""}</button>)}
        </div>
        {(group === "Mẫu của tôi" || (group === "Tất cả" && myList.length > 0)) && (
          <section>
            <h3 className="ui-label">Mẫu của tôi</h3>
            {!mine ? <Spinner /> : !myList.length ? (
              <p className="text-sm text-muted">Chưa có mẫu riêng. Mở một trang bất kỳ › Thêm › <b>Lưu thành mẫu</b> để dùng lại nội dung và giao diện của trang đó.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {myList.map((t) => (
                  <TemplateCard key={t.id} name={t.name} desc={t.description || t.tags.map((x) => `#${x}`).join(" ")} style={t.style} onClick={() => pickMine(t)}
                    extra={<button type="button" onClick={() => removeMine(t)} className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 border border-line text-muted hover:text-red-700" aria-label={`Xoá mẫu ${t.name}`}>×</button>} />
                ))}
              </div>
            )}
          </section>
        )}
        {group !== "Mẫu của tôi" && shownGroups.map((g) => {
          const list = builtIn.filter((t) => t.group === g);
          if (!list.length) return null;
          return (
            <section key={g}>
              <h3 className="ui-label">{g} <span className="text-muted font-normal">({list.length})</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {list.map((t) => <TemplateCard key={t.id} name={t.name} desc={t.desc} style={t.style} onClick={() => pickBuiltIn(t)} />)}
              </div>
            </section>
          );
        })}
        {nq && !builtIn.length && !myList.length && <p className="text-sm text-muted text-center py-6">Không có mẫu nào khớp &ldquo;{q}&rdquo;.</p>}
      </div>
    </Modal>
  );
}
