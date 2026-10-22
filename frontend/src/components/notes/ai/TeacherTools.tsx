"use client";
// Đợt 4 — Sổ lớp thông minh cho giáo viên: trang soạn bài → Bài học / Đề thi (file Excel đúng mẫu "Nhập Từ Excel"),
// nhận xét định kỳ gửi phụ huynh, lỗ hổng kiến thức chung của lớp (từ trang học viên chủ động gửi).
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import { aiApi, notesApi, errMsg } from "../api";
import { Spinner, safeHtml } from "../ui";

type Cls = { id: string; name: string };

function LessonDraft({ pageId, classrooms, flush, onUsed }: { pageId: string; classrooms: Cls[]; flush: () => Promise<void>; onUsed: () => void }) {
  const [draft, setDraft] = useState<{ title: string; html: string; vocabularies: any[] } | null>(null);
  const [preview, setPreview] = useState("");
  const [cls, setCls] = useState(classrooms[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try {
      await flush();
      const d = await aiApi("/teacher/lesson-draft", { body: { pageId } });
      setDraft(d); setPreview(await safeHtml(d.html)); onUsed();
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  const create = async () => {
    if (!draft || !cls) return;
    try {
      const r = await aiApi("/teacher/lesson-create", { body: { pageId, classroomId: cls, ...draft } });
      Swal.fire({ icon: "success", title: "Đã tạo bài học", html: `Bài <b>${r.lesson.title.replace(/</g, "&lt;")}</b> đã vào lớp ${r.classroom.name.replace(/</g, "&lt;")} (chưa đặt giờ mở/hạn nộp). Vào Dashboard Giáo viên › Bài Học để chỉnh tiếp.`, confirmButtonText: "OK" });
      setDraft(null);
    } catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); }
  };
  if (loading) return <Spinner label="AI đang soạn bài học…" />;
  if (!draft) return <button type="button" onClick={run} className="btn-primary w-full py-2.5">Biến trang thành Bài học</button>;
  return (
    <div className="space-y-2">
      <input className="ui-input w-full font-bold" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      <div className="rounded-xl border border-line p-3 max-h-60 overflow-y-auto note-content text-sm" dangerouslySetInnerHTML={{ __html: preview }} />
      <p className="text-sm text-muted">{draft.vocabularies.length} từ vựng kèm theo: {draft.vocabularies.slice(0, 8).map((v) => v.word).join(", ")}{draft.vocabularies.length > 8 ? "…" : ""}</p>
      <select className="ui-input w-full" value={cls} onChange={(e) => setCls(e.target.value)}>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setDraft(null)} className="btn-ghost py-2">Huỷ</button>
        <button type="button" onClick={create} disabled={!cls} className="btn-primary py-2">Tạo bài học</button>
      </div>
    </div>
  );
}

function ExamDraft({ pageId, flush, onUsed }: { pageId: string; flush: () => Promise<void>; onUsed: () => void }) {
  const [count, setCount] = useState(15);
  const [res, setRes] = useState<{ title: string; rows: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try { await flush(); setRes(await aiApi("/teacher/exam-draft", { body: { pageId, count } })); onUsed(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  const download = async () => {
    if (!res) return;
    const mod: any = await import("xlsx-js-style");
    const XLSX: typeof import("xlsx-js-style") = mod.utils ? mod : mod.default;
    const headers = ["Loại (TN/TL)", "Câu hỏi *", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Giải thích", "Điểm"];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...res.rows.map((r) => [r.type, r.question, ...r.options, r.answer, r.explanation, r.points])]);
    const head = { font: { name: "Calibri", bold: true, color: { rgb: "FFFFFF" }, sz: 12 }, fill: { fgColor: { rgb: "1E3A8A" } }, alignment: { horizontal: "center", vertical: "center" } };
    headers.forEach((_, c) => { const cell = ws[XLSX.utils.encode_cell({ r: 0, c })]; if (cell) cell.s = head; });
    ws["!cols"] = [{ wch: 12 }, { wch: 60 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 50 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Câu hỏi");
    XLSX.writeFile(wb, `De-tu-ghi-chu-${res.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40)}.xlsx`);
  };
  if (loading) return <Spinner label="AI đang soạn câu hỏi…" />;
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm"><span className="ui-label m-0">Số câu</span>
        <input type="number" min={5} max={40} className="ui-input w-24 py-1.5" value={count} onChange={(e) => setCount(Number(e.target.value))} />
      </label>
      <button type="button" onClick={run} className={res ? "btn-outline w-full py-2" : "btn-primary w-full py-2.5"}>{res ? "Soạn lại" : "Soạn đề thi từ trang"}</button>
      {res && (
        <>
          <ol className="list-decimal pl-5 text-sm space-y-1 max-h-56 overflow-y-auto">
            {res.rows.map((r, i) => <li key={i}><span className="ui-badge mr-1">{r.type}</span>{r.question} <span className="text-emerald-700 font-bold">({r.answer})</span></li>)}
          </ol>
          <button type="button" onClick={download} className="btn-primary w-full py-2.5">Tải file Excel ({res.rows.length} câu)</button>
          <p className="text-xs text-muted">File đúng mẫu ở Dashboard Giáo viên › Đề Thi › Tạo Đề Mới › <b>Nhập Từ Excel</b> — câu hỏi được đổ vào form để bạn rà lại trước khi lưu.</p>
        </>
      )}
    </div>
  );
}

function StudentReport({ onUsed }: { onUsed: () => void }) {
  const [q, setQ] = useState("");
  const [students, setStudents] = useState<{ id: string; label: string; sub: string }[]>([]);
  const [studentId, setStudentId] = useState("");
  const [days, setDays] = useState(30);
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => notesApi(`/link-targets?type=STUDENT&q=${encodeURIComponent(q)}`).then(setStudents).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [q]);
  const run = async () => {
    setLoading(true);
    try { setRes(await aiApi("/teacher/student-report", { body: { studentId, days } })); onUsed(); }
    catch (err) { Swal.fire({ icon: "error", text: errMsg(err) }); } finally { setLoading(false); }
  };
  const copy = () => {
    if (!res) return;
    const text = [res.report, res.nextSteps?.length ? `\nViệc cần làm tháng tới:\n${res.nextSteps.map((s: string) => `- ${s}`).join("\n")}` : ""].join("");
    navigator.clipboard.writeText(text).then(() => Swal.fire({ icon: "success", title: "Đã sao chép", text: "Dán vào Zalo gửi phụ huynh.", timer: 1500, showConfirmButton: false }));
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Gộp <b>ghi chú riêng của bạn về học viên</b> (trang đã liên kết "Học viên") với điểm, chuyên cần, điểm 4 kỹ năng trong app để soạn nhận xét gửi phụ huynh.</p>
      <input className="ui-input w-full" placeholder="Tìm học viên…" value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="ui-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
        <option value="">— Chọn học viên —</option>
        {students.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select className="ui-input w-full" value={days} onChange={(e) => setDays(Number(e.target.value))}>
        <option value={30}>30 ngày gần nhất</option><option value={60}>60 ngày</option><option value={90}>90 ngày</option>
      </select>
      <button type="button" disabled={!studentId || loading} onClick={run} className="btn-primary w-full py-2.5">{loading ? "Đang soạn…" : "Soạn nhận xét"}</button>
      {res && (
        <div className="space-y-2 text-sm">
          <p className="rounded-xl border border-line p-3 whitespace-pre-line">{res.report}</p>
          {res.nextSteps?.length > 0 && <ul className="list-disc pl-5">{res.nextSteps.map((s: string) => <li key={s}>{s}</li>)}</ul>}
          <button type="button" onClick={copy} className="btn-outline w-full py-2">Sao chép để gửi Zalo</button>
          <details className="text-xs text-muted"><summary className="cursor-pointer">Dữ liệu AI đã dùng</summary><pre className="whitespace-pre-wrap mt-1">{res.facts}</pre></details>
        </div>
      )}
    </div>
  );
}

function ClassGaps({ classrooms, onUsed }: { classrooms: Cls[]; onUsed: () => void }) {
  const [cls, setCls] = useState(classrooms[0]?.id || "");
  const [res, setRes] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    try { setRes(await aiApi("/teacher/class-gaps", { body: { classroomId: cls } })); onUsed(); }
    catch (err) { Swal.fire({ icon: "info", text: errMsg(err) }); } finally { setLoading(false); }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Phân tích các trang ghi chú/bài làm học viên <b>chủ động gửi cho bạn</b> trong 90 ngày (ẩn danh) để tìm lỗ hổng kiến thức chung, gợi ý nội dung buổi sau.</p>
      <select className="ui-input w-full" value={cls} onChange={(e) => setCls(e.target.value)}>{classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
      <button type="button" disabled={!cls || loading} onClick={run} className="btn-primary w-full py-2.5">{loading ? "Đang phân tích…" : "Tìm lỗ hổng của lớp"}</button>
      {res && (
        <div className="space-y-2 text-sm">
          <p className="rounded-xl bg-primary-soft p-3">{res.summary} <span className="text-muted">({res.studentsAnalysed} học viên)</span></p>
          {res.gaps.map((g: any, i: number) => (
            <div key={i} className="rounded-xl border border-line p-3">
              <p className="font-bold">{g.topic} <span className="ui-badge bg-amber-50 text-amber-700">{g.students} học viên</span></p>
              <p className="text-muted mt-1">{g.evidence}</p>
              <p className="mt-1"><b>Gợi ý:</b> {g.suggestion}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeacherTools({ pageId, classrooms, flush, onUsed }: { pageId: string; classrooms: Cls[]; flush: () => Promise<void>; onUsed: () => void }) {
  const [tool, setTool] = useState<"lesson" | "exam" | "report" | "gaps">("lesson");
  const tabs = [["lesson", "Bài học"], ["exam", "Đề thi"], ["report", "Nhận xét PH"], ["gaps", "Lỗ hổng lớp"]] as const;
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tabs.map(([id, label]) => <button key={id} type="button" onClick={() => setTool(id)} className={`ui-chip text-xs ${tool === id ? "ui-chip-active" : ""}`}>{label}</button>)}
      </div>
      {!classrooms.length && tool !== "report" ? <p className="text-sm text-muted">Bạn chưa có lớp học nào.</p> : (
        <>
          {tool === "lesson" && <LessonDraft pageId={pageId} classrooms={classrooms} flush={flush} onUsed={onUsed} />}
          {tool === "exam" && <ExamDraft pageId={pageId} flush={flush} onUsed={onUsed} />}
          {tool === "report" && <StudentReport onUsed={onUsed} />}
          {tool === "gaps" && <ClassGaps classrooms={classrooms} onUsed={onUsed} />}
        </>
      )}
    </div>
  );
}
