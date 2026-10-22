"use client";
// Liên kết trang với nội dung lớp học (chỉ thành viên lớp) + chia sẻ (giáo viên → lớp, học viên → giáo viên).
// Liên kết chỉ để tham chiếu, trang vẫn riêng tư; chia sẻ mới cho người khác xem và luôn có nhãn rõ ràng.
import { useEffect, useState } from "react";
import Link from "next/link";
import Swal from "sweetalert2";
import { notesApi, errMsg } from "./api";
import { Modal, Spinner } from "./ui";
import { LINK_TYPE_LABEL, type Bootstrap, type FullPage, type LinkType, type NoteLink, type Share } from "./types";

function LinkPicker({ open, onClose, isTeacher, onPick }: { open: boolean; onClose: () => void; isTeacher: boolean; onPick: (type: LinkType, id: string) => Promise<void> }) {
  const types: LinkType[] = ["CLASSROOM", "LESSON", "EXAM", "IELTS_TEST", "DOCUMENT", ...(isTeacher ? ["STUDENT" as LinkType] : [])];
  const [type, setType] = useState<LinkType>("LESSON");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ id: string; label: string; sub: string }[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setRows(null);
    const t = setTimeout(() => notesApi(`/link-targets?type=${type}&q=${encodeURIComponent(q)}`).then(setRows).catch((e) => { setRows([]); Swal.fire({ icon: "error", text: errMsg(e) }); }), 200);
    return () => clearTimeout(t);
  }, [open, type, q]);
  return (
    <Modal open={open} onClose={onClose} title="Liên kết với nội dung lớp học">
      <div className="flex flex-wrap gap-1.5 mb-3">
        {types.map((t) => <button key={t} type="button" onClick={() => setType(t)} className={`ui-chip text-xs ${type === t ? "ui-chip-active" : ""}`}>{LINK_TYPE_LABEL[t]}</button>)}
      </div>
      {type === "STUDENT" && <p className="text-xs rounded-lg bg-amber-50 text-amber-800 p-2 mb-2">Ghi chú về học viên luôn riêng tư: học viên không bao giờ thấy, và trang này sẽ không chia sẻ được.</p>}
      <input className="ui-input w-full mb-3" placeholder="Tìm theo tên…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {!rows ? <Spinner label="Đang tải…" /> : !rows.length ? <p className="text-sm text-muted">Không có mục nào bạn được truy cập.</p> : (
        <ul className="space-y-1">
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={async () => { await onPick(type, r.id); onClose(); }} className="w-full text-left rounded-xl border border-line px-3 py-2 hover:border-primary hover:bg-primary-soft/40">
                <span className="block text-sm font-bold">{r.label}</span>
                {r.sub && <span className="block text-xs text-muted">{r.sub}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function LinksPanel({ page, boot, onChange, onOpenPage, onClose }: {
  page: FullPage; boot: Bootstrap; onChange: (patch: Partial<FullPage>) => void; onOpenPage: (id: string) => void; onClose: () => void;
}) {
  const isTeacher = boot.user.role === "TEACHER";
  const [picker, setPicker] = useState(false);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [shareTo, setShareTo] = useState("");
  const [allowCopy, setAllowCopy] = useState(true);
  const privateNote = page.links.some((l) => l.targetType === "STUDENT");

  useEffect(() => {
    if (!isTeacher) notesApi<{ id: string; name: string }[]>("/share-teachers").then((t) => { setTeachers(t); setShareTo(t[0]?.id || ""); }).catch(() => {});
    else setShareTo(boot.user.classrooms[0]?.id || "");
  }, [isTeacher, boot.user.classrooms]);

  const addLink = async (type: LinkType, id: string) => {
    try {
      const link = await notesApi<NoteLink>(`/pages/${page.id}/links`, { body: { targetType: type, targetId: id } });
      onChange({ links: [...page.links.filter((l) => l.id !== link.id), link] });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const removeLink = async (id: string) => {
    try { await notesApi(`/links/${id}`, { method: "DELETE" }); onChange({ links: page.links.filter((l) => l.id !== id) }); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const share = async () => {
    if (!shareTo) return;
    try {
      const body = isTeacher ? { scope: "CLASSROOM", classroomId: shareTo, allowCopy } : { scope: "TEACHER", teacherId: shareTo };
      const s = await notesApi<Share>(`/pages/${page.id}/shares`, { body });
      const targetName = isTeacher ? boot.user.classrooms.find((c) => c.id === shareTo)?.name || "Lớp" : teachers.find((t) => t.id === shareTo)?.name || "Giáo viên";
      onChange({ shares: [...page.shares.filter((x) => x.id !== s.id), { ...s, targetName }] });
      Swal.fire({ icon: "success", title: isTeacher ? "Đã chia sẻ cho lớp" : "Đã gửi cho giáo viên", text: isTeacher ? "Học viên trong lớp thấy trang này ở mục Được chia sẻ (chỉ đọc)." : "Giáo viên sẽ đọc và góp ý. Góp ý hiện ngay trong bảng này.", timer: 2200, showConfirmButton: false });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const unshare = async (id: string) => {
    try { await notesApi(`/shares/${id}`, { method: "DELETE" }); onChange({ shares: page.shares.filter((s) => s.id !== id) }); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  return (
    <aside className="flex flex-col h-full bg-white" aria-label="Liên kết và chia sẻ">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
        <h2 className="font-bold text-primary">Liên kết & chia sẻ</h2>
        <button type="button" onClick={onClose} className="ml-auto btn-ghost w-9 h-9 p-0 text-xl" aria-label="Đóng">×</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="ui-label">Nội dung lớp học</h3>
          {boot.user.guest ? (
            <div className="text-sm text-muted space-y-2">
              <p>Đăng nhập để liên kết ghi chú với bài học, đề thi, tài liệu của lớp và chia sẻ với giáo viên. Ghi chú thường vẫn dùng miễn phí không cần đăng nhập.</p>
              <Link href="/auth?role=STUDENT&next=/notes" className="btn-primary inline-block px-4 py-2 text-sm">Đăng nhập / Đăng ký</Link>
            </div>
          ) : !boot.user.canLink ? (
            <p className="text-sm text-muted">Tham gia một lớp học để liên kết ghi chú với bài học, đề thi, tài liệu của lớp.</p>
          ) : (
            <>
              {page.links.length === 0 && <p className="text-sm text-muted mb-2">Chưa liên kết. Liên kết chỉ để bạn mở nhanh nội dung gốc — trang vẫn riêng tư.</p>}
              <ul className="space-y-1.5 mb-2">
                {page.links.map((l) => (
                  <li key={l.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${l.accessible ? "border-line" : "border-dashed border-line opacity-60"}`}>
                    <span className="ui-badge shrink-0">{LINK_TYPE_LABEL[l.targetType]}</span>
                    {l.accessible && l.href ? <Link href={l.href} className="font-semibold text-primary hover:underline truncate">{l.label}</Link>
                      : <span className="truncate" title="Bạn không còn quyền truy cập nội dung này">{l.label} <span className="text-xs text-muted">(không còn truy cập được)</span></span>}
                    <button type="button" onClick={() => removeLink(l.id)} className="ml-auto btn-ghost w-8 h-8 p-0" aria-label="Bỏ liên kết">×</button>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setPicker(true)} className="btn-outline w-full py-2 text-sm">+ Liên kết</button>
            </>
          )}
        </section>

        <section>
          <h3 className="ui-label">Chia sẻ</h3>
          {boot.user.guest ? <p className="text-sm text-muted">Chia sẻ trang cần đăng nhập.</p> : privateNote ? (
            <p className="text-sm rounded-xl bg-amber-50 text-amber-800 p-3">Trang có ghi chú về học viên nên luôn riêng tư, không chia sẻ được.</p>
          ) : (
            <>
              <p className="text-sm text-muted mb-2">{isTeacher ? "Chia sẻ cho cả lớp xem (chỉ đọc). Có thể cho phép học viên tạo bản sao để ghi thêm." : "Gửi trang cho giáo viên để nhờ góp ý (dàn ý, bài viết, nhật ký…)."}</p>
              {page.shares.map((s) => (
                <div key={s.id} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 text-sm mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-emerald-800">{s.scope === "CLASSROOM" ? "Đang chia sẻ với" : "Đã gửi"} {s.targetName}</span>
                    <button type="button" onClick={() => unshare(s.id)} className="ml-auto text-xs font-bold text-red-700 hover:underline">Ngừng</button>
                  </div>
                  {s.feedback && <p className="mt-2 rounded-lg bg-white border border-line p-2 whitespace-pre-line"><b>Góp ý của giáo viên:</b> {s.feedback}</p>}
                  {s.scope === "TEACHER" && !s.feedback && <p className="text-xs text-muted mt-1">Chưa có góp ý.</p>}
                </div>
              ))}
              {(isTeacher ? boot.user.classrooms.length : teachers.length) > 0 ? (
                <div className="space-y-2">
                  <select className="ui-input w-full" value={shareTo} onChange={(e) => setShareTo(e.target.value)}>
                    {isTeacher ? boot.user.classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>) : teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {isTeacher && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowCopy} onChange={(e) => setAllowCopy(e.target.checked)} /> Cho học viên tạo bản sao để ghi thêm</label>}
                  <button type="button" onClick={share} className="btn-primary w-full py-2 text-sm">{isTeacher ? "Chia sẻ cho lớp" : "Gửi cho giáo viên"}</button>
                </div>
              ) : <p className="text-sm text-muted">{isTeacher ? "Bạn chưa có lớp học nào." : "Bạn chưa có giáo viên (tham gia lớp hoặc có giáo viên phụ trách)."}</p>}
            </>
          )}
        </section>

        <section>
          <h3 className="ui-label">Trang nhắc tới trang này</h3>
          {page.backlinks.length === 0 ? <p className="text-sm text-muted">Chưa có. Gõ <b>[[</b> trong trang khác để liên kết tới đây.</p> : (
            <ul className="space-y-1">{page.backlinks.map((b) => <li key={b.id}><button type="button" onClick={() => onOpenPage(b.id)} className="text-sm font-semibold text-primary hover:underline text-left">{b.title || "Không tiêu đề"}</button></li>)}</ul>
          )}
        </section>
      </div>
      <LinkPicker open={picker} onClose={() => setPicker(false)} isTeacher={isTeacher} onPick={addLink} />
    </aside>
  );
}
