"use client";
// Trang được chia sẻ: học viên thấy trang giáo viên chia sẻ cho lớp (chỉ đọc, có thể tạo bản sao nếu được phép);
// giáo viên thấy trang học viên gửi để góp ý (AI soạn trước bản nháp góp ý).
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import type { JSONContent } from "@tiptap/react";
import { notesApi, aiApi, errMsg } from "./api";
import { Modal, Spinner, timeAgo } from "./ui";
import NoteEditor from "./editor/NoteEditor";
import type { Bootstrap } from "./types";
import { sheetCss, type PageStyle } from "./pageStyle";

type Item = { id: string; scope: string; classroomName: string | null; allowCopy: boolean; feedback: string | null; feedbackAt: string | null; createdAt: string; ownerName: string; page: { id: string; title: string; excerpt: string; updatedAt: string; wordCount: number } };

export default function SharedView({ boot, onOpenOwn, refreshBoot }: { boot: Bootstrap; onOpenOwn: (id: string) => void; refreshBoot: () => void }) {
  const isTeacher = boot.user.role === "TEACHER";
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<{ item: Item; content: JSONContent | null; style: PageStyle | null } | null>(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => notesApi<Item[]>("/shared").then(setItems).catch((e) => { setItems([]); Swal.fire({ icon: "error", text: errMsg(e) }); });
  useEffect(() => { load(); }, []);

  const view = async (item: Item) => {
    try {
      const r = await notesApi<{ page: { contentJson: JSONContent | null; style: PageStyle | null } }>(`/shared/${item.id}`);
      setOpen({ item, content: r.page.contentJson, style: r.page.style });
      setFeedback(item.feedback || "");
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const draft = async () => {
    if (!open) return;
    setBusy(true);
    try { const r = await aiApi<{ feedback: string }>("/teacher/feedback-draft", { body: { shareId: open.item.id } }); setFeedback(r.feedback); refreshBoot(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!open) return;
    try {
      await notesApi(`/shared/${open.item.id}/feedback`, { body: { feedback } });
      setOpen(null); load(); refreshBoot();
      Swal.fire({ icon: "success", text: "Đã gửi góp ý — học viên thấy ngay trong trang của mình.", timer: 1600, showConfirmButton: false });
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  const copy = async () => {
    if (!open) return;
    try { const r = await notesApi<{ id: string }>(`/shared/${open.item.id}/copy`, { body: {} }); setOpen(null); refreshBoot(); onOpenOwn(r.id); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <p className="text-sm text-muted">Trang chủ / Ghi chú / {isTeacher ? "Học viên gửi" : "Được chia sẻ"}</p>
        <h1 className="ui-page-title mt-1">{isTeacher ? "Trang học viên gửi" : "Được chia sẻ với bạn"}</h1>
        <p className="ui-page-subtitle">{isTeacher ? "Học viên gửi dàn ý, bài viết, nhật ký… để nhờ góp ý. Trang chưa góp ý được đánh dấu." : "Ghi chú bài giảng, dặn dò giáo viên chia sẻ cho lớp của bạn (chỉ đọc)."}</p>
        <div className="mt-5">
          {!items ? <Spinner /> : !items.length ? <p className="ui-card p-6 text-center text-sm text-muted">{isTeacher ? "Chưa có học viên nào gửi trang." : "Chưa có trang nào được chia sẻ."}</p> : (
            <div className="grid sm:grid-cols-2 gap-3">
              {items.map((it) => (
                <button key={it.id} type="button" onClick={() => view(it)} className="ui-card ui-card-hover p-4 text-left">
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-primary truncate">{it.page.title || "Không tiêu đề"}</span>
                    {isTeacher && !it.feedbackAt && <span className="ui-badge-new shrink-0">Chờ góp ý</span>}
                  </span>
                  <span className="block text-xs text-muted mt-1">{it.ownerName}{it.classroomName ? ` · ${it.classroomName}` : ""} · {timeAgo(it.createdAt)}</span>
                  <span className="block text-sm text-muted line-clamp-2 mt-2">{it.page.excerpt}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.item.page.title || "Không tiêu đề"} wide footer={open && (isTeacher ? (
        <><button type="button" onClick={() => setOpen(null)} className="btn-ghost px-4 py-2">Đóng</button><button type="button" onClick={send} className="btn-primary px-4 py-2">Gửi góp ý</button></>
      ) : open.item.allowCopy ? <button type="button" onClick={copy} className="btn-primary px-4 py-2">Tạo bản sao để ghi thêm</button> : undefined)}>
        {open && (
          <div className="space-y-4">
            <p className="text-xs text-muted">{open.item.ownerName} · chỉ đọc</p>
            <div className="note-sheet rounded-xl p-4" {...(sheetCss(open.style)["--note-text"] ? { "data-text": "" } : {})} style={sheetCss(open.style)}>
              <NoteEditor content={open.content} editable={false} paperStyle={open.style} />
            </div>
            {isTeacher && (
              <div className="pt-3 border-t border-line">
                <div className="flex items-center gap-2 mb-1"><span className="ui-label m-0">Góp ý cho học viên</span>
                  {!boot.user.accessLocked && <button type="button" onClick={draft} disabled={busy} className="ml-auto ui-chip text-xs">{busy ? "AI đang soạn…" : "AI soạn bản nháp"}</button>}
                </div>
                <textarea className="ui-input w-full min-h-32" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Nhận xét điểm tốt, lỗi cần sửa, gợi ý cải thiện…" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
