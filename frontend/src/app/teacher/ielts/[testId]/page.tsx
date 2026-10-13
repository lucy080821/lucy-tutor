"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionUserId, redirectToOwnArea } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { QUESTION_TYPE_META, FILL_TYPES, QuestionType } from "@/lib/readingGrading";
import IeltsAssignPanel from "@/components/ielts/IeltsAssignPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type SkillTab = "READING" | "LISTENING" | "WRITING" | "SPEAKING";
type Kind = "READING" | "LISTENING";

// Hướng dẫn mẫu theo dạng câu — điền sẵn khi thêm nhóm câu để giáo viên đỡ gõ (sửa được)
const INSTRUCTION_TEMPLATES: Record<string, string> = {
  TRUE_FALSE: "Do the following statements agree with the information given in the reading passage? Write TRUE, FALSE or NOT GIVEN.",
  YES_NO_NOTGIVEN: "Do the following statements agree with the views of the writer? Write YES, NO or NOT GIVEN.",
  MULTIPLE_CHOICE: "Choose the correct letter, A, B, C or D.",
  MATCHING_HEADING: "Choose the correct heading for each paragraph from the list of headings below.",
  MATCHING_INFORMATION: "Which paragraph contains the following information?",
  MATCHING_FEATURES: "Match each statement with the correct person below.",
  SUMMARY_COMPLETION: "Complete the summary below. Choose ONE WORD ONLY from the passage for each answer.",
  SENTENCE_COMPLETION: "Complete the sentences below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
  FILL_BLANK: "Complete the notes below. Write ONE WORD ONLY for each answer.",
  SHORT_ANSWER: "Answer the questions below. Choose NO MORE THAN THREE WORDS from the passage for each answer.",
};
const AUTO_OPTION_TYPES = ["TRUE_FALSE", "YES_NO_NOTGIVEN"];

const isFill = (type: string) => FILL_TYPES.includes(type as QuestionType);
const parseArr = (v: any): string[] => { try { const a = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Trang soạn đề IELTS thủ công: giáo viên tự nhập nội dung 4 kỹ năng (bài đọc, audio, câu hỏi,
// đáp án, đề Writing, câu hỏi Speaking), AI chỉ chấm bài + làm bước "Học đề". Mọi ô lưu khi rời
// ô (onBlur); thao tác thêm/xoá Passage/Part/nhóm câu tải lại cả đề để số câu luôn đúng (backend tự
// đánh số lại 1..n theo thứ tự Passage/Part).
export default function IeltsTestEditorPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [freeStudents, setFreeStudents] = useState<any[]>([]);
  const [skillTab, setSkillTab] = useState<SkillTab>("READING");
  const [pending, setPending] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const fetchTest = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ielts/tests/${testId}`);
      if (res.ok) {
        const t = await res.json();
        t.speakingParts = (t.speakingParts || []).map((p: any) => ({ ...p, questions: parseArr(p.questions) }));
        setTest(t);
      } else Swal.fire("Lỗi", "Không tìm thấy đề này", "error");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/"); return; }
    // Trang soạn đề chỉ dành cho giáo viên
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => { if (u?.id && u.role !== "TEACHER") redirectToOwnArea(u.role, router); }).catch(() => {});
    fetch(`${API}/api/classroom/teacher/${uid}`).then((r) => r.json()).then((d) => setClassrooms(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API}/api/free-students/teacher/${uid}`).then((r) => r.json()).then((d) => setFreeStudents(Array.isArray(d) ? d : [])).catch(() => {});
    fetchTest();
  }, [fetchTest, router]);

  // Gọi API + đếm số thao tác đang lưu (hiện "Đang lưu… / Đã lưu" ở thanh trên)
  const api = useCallback(async (method: string, path: string, body?: any, isForm = false) => {
    setPending((n) => n + 1);
    try {
      const res = await fetch(`${API}/api/ielts${path}`, {
        method,
        ...(body !== undefined && (isForm ? { body } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không lưu được", "error"); return null; }
      setLastSavedAt(new Date());
      return data;
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không kết nối được máy chủ", "error");
      return null;
    } finally {
      setPending((n) => n - 1);
    }
  }, []);

  // Thao tác cấu trúc (thêm/xoá) → gọi API rồi tải lại đề
  const mutate = useCallback(async (method: string, path: string, body?: any) => {
    const r = await api(method, path, body);
    if (r) await fetchTest();
    return r;
  }, [api, fetchTest]);

  const confirmDelete = async (what: string, detail?: string) => {
    const r = await Swal.fire({ title: `Xoá ${what}?`, html: detail || "Không thể hoàn tác.", icon: "warning", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#e11d48" });
    return r.isConfirmed;
  };

  // Cập nhật 1 câu hỏi trong state sau khi PATCH
  const replaceQuestion = (updated: any) => setTest((prev: any) => ({
    ...prev,
    readingPassages: prev.readingPassages.map((p: any) => ({ ...p, questions: p.questions.map((q: any) => (q.id === updated.id ? updated : q)) })),
    listeningSections: prev.listeningSections.map((s: any) => ({ ...s, questions: s.questions.map((q: any) => (q.id === updated.id ? updated : q)) }))
  }));
  const replaceQuestions = (list: any[]) => list.forEach(replaceQuestion);

  const patchQuestion = async (id: string, data: any) => { const q = await api("PATCH", `/questions/${id}`, data); if (q) replaceQuestion(q); };
  const patchList = (key: string, id: string, updated: any) => setTest((prev: any) => ({ ...prev, [key]: prev[key].map((x: any) => (x.id === id ? { ...x, ...updated, ...(key === "speakingParts" ? { questions: parseArr(updated.questions) } : {}) } : x)) }));

  const uploadFile = async (path: string, field: string, file: File) => {
    const fd = new FormData();
    fd.append(field, file);
    return api("POST", path, fd, true);
  };

  const pasteAnswerKey = async (skill: Kind) => {
    const { value } = await Swal.fire({
      title: `Dán đáp án ${skill === "READING" ? "Reading" : "Listening"}`,
      html: `<p style="font-size:14px;margin:0 0 6px;text-align:left">Mỗi dòng 1 câu: <b>số đáp án</b>. Câu điền từ có nhiều cách viết thì ngăn bằng <b>/</b>.</p><p style="font-size:13px;margin:0;text-align:left;color:#64748b">VD: <code>1 TRUE</code> · <code>2 NG</code> · <code>14 C</code> · <code>18 breath</code> · <code>22 colour/color</code> · <code>27 iv</code></p>`,
      input: "textarea",
      inputPlaceholder: "1 TRUE\n2 FALSE\n3 NOT GIVEN\n4 C\n5 breath",
      inputAttributes: { rows: "12", style: "font-family:monospace" } as any,
      showCancelButton: true, confirmButtonText: "Áp dụng", cancelButtonText: "Huỷ", width: 560
    });
    if (!value?.trim()) return;
    const r = await api("POST", `/tests/${testId}/answer-key`, { skill, text: value });
    if (!r) return;
    await fetchTest();
    Swal.fire({
      icon: r.problems.length ? "warning" : "success",
      title: `Đã cập nhật ${r.updated} câu`,
      html: r.problems.length ? `<div style="text-align:left;font-size:13px">${r.problems.map((p: string) => `<p style="margin:2px 0">• ${esc(p)}</p>`).join("")}</div>` : undefined
    });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!test) return null;

  const readingPassages = test.readingPassages || [];
  const listeningSections = test.listeningSections || [];
  const writingTasks = test.writingTasks || [];
  const speakingParts = test.speakingParts || [];
  const noAnswer = (q: any) => q.correctIndex === null && !q.correctAnswer;
  const rQs = readingPassages.flatMap((p: any) => p.questions || []);
  const lQs = listeningSections.flatMap((s: any) => s.questions || []);
  const rMissing = rQs.filter(noAnswer).length;
  const lMissing = lQs.filter(noAnswer).length;
  const missingAudio = listeningSections.filter((s: any) => !s.audioUrl).length;

  const TABS: { id: SkillTab; label: string; summary: string; warn: boolean }[] = [
    { id: "READING", label: "Reading", summary: readingPassages.length ? `${readingPassages.length} bài · ${rQs.length} câu` : "Trống", warn: rMissing > 0 || readingPassages.some((p: any) => !p.bodyText?.trim()) },
    { id: "LISTENING", label: "Listening", summary: listeningSections.length ? `${listeningSections.length} Part · ${lQs.length} câu` : "Trống", warn: lMissing > 0 || missingAudio > 0 },
    { id: "WRITING", label: "Writing", summary: writingTasks.length ? `${writingTasks.length}/2 Task` : "Trống", warn: writingTasks.some((t: any) => !t.promptText?.trim()) },
    { id: "SPEAKING", label: "Speaking", summary: speakingParts.length ? `${speakingParts.length}/3 Part` : "Trống", warn: speakingParts.some((p: any) => !p.questions.some((l: string) => l.trim())) }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-surface border-b border-line px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4 flex-wrap">
        <Link href="/teacher" className="text-muted hover:text-primary transition-colors text-sm font-semibold shrink-0 py-2">← Thư viện IELTS</Link>
        <span className="text-line-strong hidden sm:inline">/</span>
        <h1 className="font-bold text-primary text-sm sm:text-base">{test.book?.title} — {test.title}</h1>
        <span className="ml-auto text-xs font-semibold text-muted">
          {pending > 0 ? "Đang lưu…" : lastSavedAt ? `Đã lưu ${lastSavedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}` : "Tự lưu khi rời ô nhập"}
        </span>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* ── Thông tin đề ── */}
        <div className="ui-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="ui-section-title text-lg">Thông tin đề</h2>
            <span className="ui-badge px-3 py-1">{test.status === "PUBLISHED" ? "Đã publish" : "Bản nháp"}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ui-label text-xs">Tên đề</label>
              <input defaultValue={test.title} onBlur={async (e) => { const v = e.target.value.trim(); if (v && v !== test.title) { const r = await api("PATCH", `/tests/${testId}`, { title: v }); if (r) setTest((p: any) => ({ ...p, title: r.title })); } }} className="w-full p-2.5 ui-input font-bold" />
            </div>
            <div>
              <label className="ui-label text-xs">Dạng đề</label>
              <select value={test.testType || ""} onChange={async (e) => { const r = await api("PATCH", `/tests/${testId}`, { testType: e.target.value }); if (r) setTest((p: any) => ({ ...p, testType: r.testType })); }} className="w-full p-2.5 ui-input font-bold cursor-pointer">
                <option value="" disabled>-- Chọn dạng đề --</option>
                <option value="ACADEMIC">Academic</option>
                <option value="GENERAL_TRAINING">General Training</option>
              </select>
              <p className="text-xs text-muted mt-1">Quyết định bảng quy đổi band của Reading.</p>
            </div>
          </div>
          {test.status === "PUBLISHED" && (
            <p className="text-xs rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">Đề đang được học viên làm. Sửa nội dung vẫn được, nhưng thêm/xoá câu hỏi sẽ làm lệch số câu trong lịch sử làm bài cũ — nên "Gỡ publish" trước khi sửa lớn.</p>
          )}
        </div>

        {/* ── Tabs kỹ năng ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSkillTab(t.id)}
              className={`relative text-left rounded-2xl border-2 px-4 py-3 cursor-pointer transition-colors ${skillTab === t.id ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/50"}`}
            >
              <p className={`font-bold ${skillTab === t.id ? "text-primary" : "text-foreground"}`}>{t.label}</p>
              <p className="text-xs text-muted mt-0.5">{t.summary}</p>
              {t.warn && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 rounded-full bg-amber-500" title="Còn thiếu nội dung / đáp án" />}
            </button>
          ))}
        </div>

        {skillTab === "READING" && (
          <div className="space-y-5">
            <SkillToolbar
              note="Mỗi bài đọc thường có 13–14 câu (cả đề 40 câu). Thêm câu hỏi theo nhóm như trong đề gốc, rồi dán đáp án nhanh cho cả 40 câu."
              missing={rMissing}
              hasQuestions={rQs.length > 0}
              onPaste={() => pasteAnswerKey("READING")}
            />
            {readingPassages.map((p: any) => (
              <div key={p.id} className="ui-card p-5 space-y-4">
                <ContainerHeader
                  title={`Passage ${p.sectionNumber}${p.passageIndex > 1 ? `.${p.passageIndex}` : ""}`}
                  questions={p.questions}
                  onDelete={async () => { if (await confirmDelete(`Passage ${p.sectionNumber}`, `Xoá bài đọc và ${p.questions.length} câu hỏi của nó. Không thể hoàn tác.`)) mutate("DELETE", `/reading-passages/${p.id}`); }}
                />
                <input defaultValue={p.title || ""} placeholder="Tiêu đề bài đọc (VD: The Davies sisters)" onBlur={async (e) => { const r = await api("PATCH", `/reading-passages/${p.id}`, { title: e.target.value }); if (r) patchList("readingPassages", p.id, r); }} className="w-full p-2.5 ui-input font-bold" />
                <div>
                  <textarea
                    defaultValue={p.bodyText}
                    onBlur={async (e) => { if (e.target.value === p.bodyText) return; const r = await api("PATCH", `/reading-passages/${p.id}`, { bodyText: e.target.value }); if (r) patchList("readingPassages", p.id, r); }}
                    rows={14}
                    className="w-full p-3 ui-input text-[15px] leading-relaxed"
                    placeholder={"Dán nội dung bài đọc vào đây.\n\nCác đoạn cách nhau 1 dòng trống. Đề có câu hỏi \"Which paragraph…\" thì giữ nhãn A, B, C… ở đầu mỗi đoạn."}
                  />
                  <p className="text-xs text-muted mt-1">{p.bodyText?.trim() ? `${p.bodyText.trim().split(/\s+/).length} từ` : <span className="text-amber-700 font-semibold">Chưa có nội dung bài đọc</span>}</p>
                </div>
                <ImageAttach
                  url={p.imageUrl}
                  label="Ảnh đi kèm bài đọc (sơ đồ, bảng — nếu có)"
                  onUpload={async (f) => { const r = await uploadFile(`/reading-passages/${p.id}/image`, "image", f); if (r) patchList("readingPassages", p.id, r); }}
                  onRemove={async () => { const r = await api("PATCH", `/reading-passages/${p.id}`, { imageUrl: null }); if (r) patchList("readingPassages", p.id, r); }}
                />
                <QuestionGroupsEditor
                  kind="READING"
                  containerId={p.id}
                  questions={p.questions}
                  api={api}
                  mutate={mutate}
                  confirmDelete={confirmDelete}
                  patchQuestion={patchQuestion}
                  replaceQuestions={replaceQuestions}
                  uploadFile={uploadFile}
                  replaceQuestion={replaceQuestion}
                />
              </div>
            ))}
            <AddBlockButton label={`+ Thêm bài đọc (Passage ${readingPassages.length + 1})`} onClick={() => mutate("POST", `/tests/${testId}/reading-passages`)} empty={!readingPassages.length} emptyText="Chưa có bài đọc nào. Đề Reading Academic gồm 3 Passage, mỗi Passage 13–14 câu." />
          </div>
        )}

        {skillTab === "LISTENING" && (
          <div className="space-y-5">
            <SkillToolbar
              note="Đề Listening gồm 4 Part, mỗi Part 10 câu và 1 file audio. Dán transcript (lời thoại) để AI giải thích câu sai cho học viên ở bước Học đề."
              missing={lMissing}
              hasQuestions={lQs.length > 0}
              onPaste={() => pasteAnswerKey("LISTENING")}
              extra={missingAudio > 0 ? `Còn ${missingAudio} Part chưa có audio — bắt buộc trước khi publish.` : undefined}
            />
            {listeningSections.map((s: any) => (
              <div key={s.id} className="ui-card p-5 space-y-4">
                <ContainerHeader
                  title={`Part ${s.sectionNumber}`}
                  questions={s.questions}
                  onDelete={async () => { if (await confirmDelete(`Part ${s.sectionNumber}`, `Xoá Part, audio và ${s.questions.length} câu hỏi của nó. Không thể hoàn tác.`)) mutate("DELETE", `/listening-sections/${s.id}`); }}
                />
                <div className="rounded-xl border border-line bg-background p-3 flex flex-wrap items-center gap-3">
                  {s.audioUrl ? <audio src={s.audioUrl} controls preload="none" className="flex-1 min-w-[220px] h-10" /> : <p className="text-sm text-red-600 font-bold flex-1">Chưa có audio</p>}
                  <label className="btn-outline px-4 py-2 text-sm cursor-pointer shrink-0">
                    {s.audioUrl ? "Đổi audio" : "Tải audio lên"}
                    <input type="file" accept=".mp3,.m4a,.wav" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const r = await uploadFile(`/listening-sections/${s.id}/audio`, "audio", f); if (r) { patchList("listeningSections", s.id, r); Swal.fire({ title: "Đã tải audio lên", icon: "success", timer: 1500, toast: true, position: "top-end", showConfirmButton: false }); } }} />
                  </label>
                </div>
                <input defaultValue={s.instructions || ""} placeholder="Hướng dẫn đầu Part (VD: You will hear a conversation between…)" onBlur={async (e) => { const r = await api("PATCH", `/listening-sections/${s.id}`, { instructions: e.target.value }); if (r) patchList("listeningSections", s.id, r); }} className="w-full p-2.5 ui-input italic text-sm" />
                <details className="rounded-xl border border-line" open={!s.transcript}>
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold text-primary">Transcript (lời thoại) {s.transcript ? "· đã có" : "· chưa có"}</summary>
                  <div className="px-3 pb-3">
                    <textarea defaultValue={s.transcript || ""} onBlur={async (e) => { if (e.target.value === (s.transcript || "")) return; const r = await api("PATCH", `/listening-sections/${s.id}`, { transcript: e.target.value }); if (r) patchList("listeningSections", s.id, r); }} rows={8} className="w-full p-3 ui-input text-sm leading-relaxed" placeholder="Dán lời thoại của Part này. Học viên không thấy khi làm bài — chỉ AI dùng để giải thích câu sai ở bước Học đề." />
                  </div>
                </details>
                <QuestionGroupsEditor
                  kind="LISTENING"
                  containerId={s.id}
                  questions={s.questions}
                  api={api}
                  mutate={mutate}
                  confirmDelete={confirmDelete}
                  patchQuestion={patchQuestion}
                  replaceQuestions={replaceQuestions}
                  uploadFile={uploadFile}
                  replaceQuestion={replaceQuestion}
                />
              </div>
            ))}
            <AddBlockButton label={`+ Thêm Part ${listeningSections.length + 1}`} onClick={() => mutate("POST", `/tests/${testId}/listening-sections`)} empty={!listeningSections.length} emptyText="Chưa có Part nào. Đề Listening gồm 4 Part, mỗi Part 10 câu." />
          </div>
        )}

        {skillTab === "WRITING" && (
          <div className="space-y-5">
            {[1, 2].map((n) => {
              const t = writingTasks.find((x: any) => x.taskNumber === n);
              if (!t) {
                return (
                  <AddBlockButton key={n} label={`+ Tạo Writing Task ${n}`} onClick={() => mutate("POST", `/tests/${testId}/writing-tasks`, { taskNumber: n })} empty emptyText={n === 1 ? "Task 1: mô tả biểu đồ/bảng/sơ đồ (Academic) hoặc viết thư (General Training), tối thiểu 150 từ." : "Task 2: bài luận nêu quan điểm, tối thiểu 250 từ."} />
                );
              }
              return (
                <div key={t.id} className="ui-card p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-lg text-primary">Writing Task {n}</h3>
                    <DeleteButton onClick={async () => { if (await confirmDelete(`Writing Task ${n}`)) mutate("DELETE", `/writing-tasks/${t.id}`); }} />
                  </div>
                  <textarea defaultValue={t.promptText} onBlur={async (e) => { const r = await api("PATCH", `/writing-tasks/${t.id}`, { promptText: e.target.value }); if (r) patchList("writingTasks", t.id, r); }} rows={6} className="w-full p-3 ui-input text-[15px] leading-relaxed" placeholder={n === 1 ? "The chart below shows… Summarise the information by selecting and reporting the main features, and make comparisons where relevant." : "Some people believe that… To what extent do you agree or disagree?"} />
                  <ImageAttach
                    url={t.imageUrl}
                    label={n === 1 ? "Ảnh biểu đồ / bảng / sơ đồ (Academic Task 1)" : "Ảnh đi kèm (nếu có)"}
                    onUpload={async (f) => { const r = await uploadFile(`/writing-tasks/${t.id}/image`, "image", f); if (r) patchList("writingTasks", t.id, r); }}
                    onRemove={async () => { const r = await api("PATCH", `/writing-tasks/${t.id}`, { imageUrl: null }); if (r) patchList("writingTasks", t.id, r); }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="ui-label text-xs">Số từ tối thiểu</label>
                      <input type="number" defaultValue={t.minWords} onBlur={async (e) => { const r = await api("PATCH", `/writing-tasks/${t.id}`, { minWords: e.target.value }); if (r) patchList("writingTasks", t.id, r); }} className="w-full p-2 ui-input text-sm" />
                    </div>
                    <div>
                      <label className="ui-label text-xs">Thời gian gợi ý (phút)</label>
                      <input type="number" defaultValue={t.timeMinutes} onBlur={async (e) => { const r = await api("PATCH", `/writing-tasks/${t.id}`, { timeMinutes: e.target.value }); if (r) patchList("writingTasks", t.id, r); }} className="w-full p-2 ui-input text-sm" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {skillTab === "SPEAKING" && (
          <div className="space-y-5">
            {[1, 2, 3].map((n) => {
              const p = speakingParts.find((x: any) => x.partNumber === n);
              if (!p) {
                return <AddBlockButton key={n} label={`+ Tạo Speaking Part ${n}`} onClick={() => mutate("POST", `/tests/${testId}/speaking-parts`, { partNumber: n })} empty emptyText={["Part 1: 4–6 câu hỏi ngắn về bản thân, công việc, sở thích.", "Part 2: cue card — 1 chủ đề + các gợi ý, học viên chuẩn bị 1 phút rồi nói 2 phút.", "Part 3: 4–6 câu hỏi thảo luận mở rộng theo chủ đề Part 2."][n - 1]} />;
              }
              return (
                <SpeakingPartEditor
                  key={p.id}
                  part={p}
                  onSave={async (data) => { const r = await api("PATCH", `/speaking-parts/${p.id}`, data); if (r) patchList("speakingParts", p.id, r); }}
                  onDelete={async () => { if (await confirmDelete(`Speaking Part ${n}`)) mutate("DELETE", `/speaking-parts/${p.id}`); }}
                />
              );
            })}
          </div>
        )}

        {/* ── Giao đề + publish (cập nhật được cả khi đã publish) ── */}
        <div className="ui-card p-5 space-y-4">
          <h2 className="ui-section-title text-lg">Giao đề cho học viên</h2>
          <IeltsAssignPanel
            test={test}
            classrooms={classrooms}
            freeStudents={freeStudents}
            onUpdated={(patch) => setTest((prev: any) => ({ ...prev, ...patch }))}
          />
        </div>
      </div>
    </div>
  );
}

function SkillToolbar({ note, missing, hasQuestions, onPaste, extra }: { note: string; missing: number; hasQuestions: boolean; onPaste: () => void; extra?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 flex flex-wrap items-center gap-3">
      <div className="flex-1 min-w-[220px] space-y-1">
        <p className="text-sm text-muted">{note}</p>
        {hasQuestions && (
          <p className={`text-sm font-bold ${missing ? "text-amber-700" : "text-emerald-700"}`}>
            {missing ? `Còn ${missing} câu chưa có đáp án` : "✓ Tất cả câu hỏi đã có đáp án"}
          </p>
        )}
        {extra && <p className="text-sm font-bold text-red-600">{extra}</p>}
      </div>
      {hasQuestions && <button onClick={onPaste} className="btn-primary px-4 py-2.5 text-sm cursor-pointer">Dán đáp án nhanh</button>}
    </div>
  );
}

function ContainerHeader({ title, questions, onDelete }: { title: string; questions: any[]; onDelete: () => void }) {
  const range = questions.length ? `Câu ${questions[0].questionNumber}–${questions[questions.length - 1].questionNumber}` : "Chưa có câu hỏi";
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-bold text-lg text-primary">{title}</h3>
        <p className="text-xs text-muted">{range}</p>
      </div>
      <DeleteButton onClick={onDelete} />
    </div>
  );
}

function DeleteButton({ onClick, label = "Xoá" }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} className="px-3 py-2 text-xs font-bold rounded-full bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-colors cursor-pointer shrink-0">{label}</button>;
}

function AddBlockButton({ label, onClick, empty, emptyText }: { label: string; onClick: () => void; empty?: boolean; emptyText?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className={`rounded-2xl border-2 border-dashed border-line-strong p-5 text-center space-y-3 ${empty ? "bg-surface" : ""}`}>
      {empty && emptyText && <p className="text-sm text-muted">{emptyText}</p>}
      <button disabled={busy} onClick={async () => { setBusy(true); try { await onClick(); } finally { setBusy(false); } }} className="btn-outline px-5 py-2.5 text-sm cursor-pointer">{busy ? "Đang tạo..." : label}</button>
    </div>
  );
}

function ImageAttach({ url, label, onUpload, onRemove }: { url?: string | null; label: string; onUpload: (f: File) => void; onRemove: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {url ? <img src={url} alt={label} className="max-h-40 rounded-lg border border-line bg-white" /> : <p className="text-sm text-muted flex-1">{label}</p>}
      <label className="btn-outline px-4 py-2 text-xs cursor-pointer shrink-0">
        {url ? "Đổi ảnh" : "Gắn ảnh"}
        <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onUpload(f); }} />
      </label>
      {url && <button onClick={onRemove} className="text-xs font-bold text-red-600 hover:underline cursor-pointer py-2">Bỏ ảnh</button>}
    </div>
  );
}

// ── Câu hỏi theo nhóm ──
type GroupProps = {
  kind: Kind;
  containerId: string;
  questions: any[];
  api: (method: string, path: string, body?: any, isForm?: boolean) => Promise<any>;
  mutate: (method: string, path: string, body?: any) => Promise<any>;
  confirmDelete: (what: string, detail?: string) => Promise<boolean>;
  patchQuestion: (id: string, data: any) => Promise<void>;
  replaceQuestion: (q: any) => void;
  replaceQuestions: (list: any[]) => void;
  uploadFile: (path: string, field: string, f: File) => Promise<any>;
};

// Gom câu liên tiếp cùng dạng + cùng hướng dẫn thành 1 nhóm (giống "Questions 1–6" trong đề)
function groupOf(questions: any[]) {
  const groups: { key: string; type: string; instruction: string; questions: any[] }[] = [];
  for (const q of questions) {
    const last = groups[groups.length - 1];
    if (last && last.type === q.type && last.instruction === (q.groupInstruction || "")) last.questions.push(q);
    else groups.push({ key: q.id, type: q.type, instruction: q.groupInstruction || "", questions: [q] });
  }
  return groups;
}

function QuestionGroupsEditor(props: GroupProps) {
  const { kind, containerId, questions, mutate } = props;
  const groups = groupOf(questions);
  const [adding, setAdding] = useState<null | { insertAfter?: number }>(null);
  const lastNumber = questions.length ? questions[questions.length - 1].questionNumber : undefined;

  return (
    <div className="space-y-4 pt-2 border-t border-line">
      {groups.map((g, i) => (
        <div key={g.key}>
          <GroupCard group={g} {...props} />
          {i < groups.length - 1 && adding?.insertAfter !== g.questions[g.questions.length - 1].questionNumber && (
            <div className="flex justify-center py-1">
              <button onClick={() => setAdding({ insertAfter: g.questions[g.questions.length - 1].questionNumber })} className="text-xs font-semibold text-muted hover:text-primary cursor-pointer px-3 py-1.5">+ chèn nhóm câu vào đây</button>
            </div>
          )}
          {adding?.insertAfter === g.questions[g.questions.length - 1].questionNumber && i < groups.length - 1 && (
            <AddGroupForm onCancel={() => setAdding(null)} onSubmit={async (data) => { const r = await mutate("POST", "/question-groups", { ...data, insertAfter: g.questions[g.questions.length - 1].questionNumber, [kind === "READING" ? "readingPassageId" : "listeningSectionId"]: containerId }); if (r) setAdding(null); }} />
          )}
        </div>
      ))}
      {adding && (adding.insertAfter === undefined || adding.insertAfter === lastNumber) ? (
        <AddGroupForm onCancel={() => setAdding(null)} onSubmit={async (data) => { const r = await mutate("POST", "/question-groups", { ...data, ...(lastNumber !== undefined && { insertAfter: lastNumber }), [kind === "READING" ? "readingPassageId" : "listeningSectionId"]: containerId }); if (r) setAdding(null); }} />
      ) : (
        <button onClick={() => setAdding({})} className="w-full rounded-xl border-2 border-dashed border-line-strong py-3 text-sm font-bold text-primary hover:border-primary hover:bg-primary-soft transition-colors cursor-pointer">
          + Thêm nhóm câu hỏi
        </button>
      )}
    </div>
  );
}

function AddGroupForm({ onSubmit, onCancel }: { onSubmit: (data: any) => Promise<void>; onCancel: () => void }) {
  const [type, setType] = useState("TRUE_FALSE");
  const [count, setCount] = useState(5);
  const [instruction, setInstruction] = useState(INSTRUCTION_TEMPLATES.TRUE_FALSE);
  const [optionsText, setOptionsText] = useState("");
  const [wordLimit, setWordLimit] = useState("");
  const [busy, setBusy] = useState(false);
  const instructionTouched = useRef(false);
  const needsOptions = !isFill(type) && !AUTO_OPTION_TYPES.includes(type);

  return (
    <div className="rounded-2xl border-2 border-primary/40 bg-primary-soft/40 p-4 space-y-3">
      <p className="font-bold text-primary">Thêm nhóm câu hỏi</p>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3">
        <div>
          <label className="ui-label text-xs">Dạng câu hỏi</label>
          <select value={type} onChange={(e) => { setType(e.target.value); if (!instructionTouched.current) setInstruction(INSTRUCTION_TEMPLATES[e.target.value] || ""); }} className="w-full p-2.5 ui-input font-semibold cursor-pointer">
            {Object.entries(QUESTION_TYPE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
          </select>
        </div>
        <div>
          <label className="ui-label text-xs">Số câu</label>
          <input type="number" min={1} max={40} value={count} onChange={(e) => setCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 1)))} className="w-full p-2.5 ui-input font-bold" />
        </div>
      </div>
      <div>
        <label className="ui-label text-xs">Hướng dẫn của nhóm (hiện 1 lần ở đầu nhóm cho học viên)</label>
        <textarea value={instruction} onChange={(e) => { instructionTouched.current = true; setInstruction(e.target.value); }} rows={2} className="w-full p-2.5 ui-input text-sm" />
      </div>
      {needsOptions && (
        <div>
          <label className="ui-label text-xs">Danh sách lựa chọn — mỗi dòng 1 lựa chọn, dùng chung cho cả nhóm</label>
          <textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={5} className="w-full p-2.5 ui-input text-sm font-mono" placeholder={type === "MATCHING_HEADING" ? "i The cost of noise\nii A quieter future\niii Health effects of noise" : type === "MULTIPLE_CHOICE" ? "A. …\nB. …\nC. …\nD. …\n(câu trắc nghiệm có lựa chọn riêng thì sửa ở từng câu sau)" : "A\nB\nC\nD\nE"} />
          {type === "SUMMARY_COMPLETION" && <p className="text-xs text-muted mt-1">Hoàn thành tóm tắt <b>có</b> ngân hàng từ (A–I) thì nhập ở đây; nếu học viên tự lấy từ trong bài thì để trống.</p>}
        </div>
      )}
      {(isFill(type) || type === "SUMMARY_COMPLETION") && (
        <div>
          <label className="ui-label text-xs">Giới hạn từ (tuỳ chọn)</label>
          <input value={wordLimit} onChange={(e) => setWordLimit(e.target.value)} placeholder="VD: ONE WORD ONLY" className="w-full p-2.5 ui-input text-sm" />
        </div>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="btn-ghost px-4 py-2 text-sm cursor-pointer">Huỷ</button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit({ type, count, groupInstruction: instruction, wordLimit, options: needsOptions ? optionsText.split("\n").map((s) => s.trim()).filter(Boolean) : undefined });
            } finally { setBusy(false); }
          }}
          className="btn-primary px-5 py-2 text-sm cursor-pointer"
        >
          {busy ? "Đang thêm..." : `Thêm ${count} câu`}
        </button>
      </div>
    </div>
  );
}

function GroupCard({ group, api, mutate, confirmDelete, patchQuestion, replaceQuestions, uploadFile, replaceQuestion }: GroupProps & { group: ReturnType<typeof groupOf>[number] }) {
  const qs = group.questions;
  const ids = qs.map((q) => q.id);
  const first = qs[0];
  const sharedOptions = parseArr(first.options);
  const sameOptions = qs.every((q) => (q.options || "") === (first.options || ""));
  const choice = !isFill(group.type) && (sharedOptions.length > 0 || group.type !== "SUMMARY_COMPLETION");
  const bulk = async (data: any) => { const r = await api("PATCH", "/questions-bulk", { ids, ...data }); if (r) replaceQuestions(r); };

  return (
    <div className="rounded-2xl border border-line bg-background p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-primary">Questions {first.questionNumber}{qs.length > 1 ? `–${qs[qs.length - 1].questionNumber}` : ""}</span>
        <select
          value={group.type}
          onChange={async (e) => {
            const r = await Swal.fire({ title: "Đổi dạng câu cho cả nhóm?", text: "Đáp án đã nhập của nhóm này sẽ bị xoá.", icon: "warning", showCancelButton: true, confirmButtonText: "Đổi", cancelButtonText: "Huỷ" });
            if (r.isConfirmed) await mutate("PATCH", "/questions-bulk", { ids, type: e.target.value });
          }}
          className="ui-input w-auto text-xs font-bold px-2 py-1.5 cursor-pointer"
        >
          {Object.entries(QUESTION_TYPE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        <span className="ml-auto" />
        <button onClick={() => mutate("POST", "/question-groups", { type: group.type, count: 1, groupInstruction: group.instruction, options: sharedOptions, wordLimit: first.wordLimit || "", insertAfter: qs[qs.length - 1].questionNumber, ...(first.readingPassageId ? { readingPassageId: first.readingPassageId } : { listeningSectionId: first.listeningSectionId }) })} className="px-3 py-2 text-xs font-bold text-primary hover:bg-primary-soft rounded-full cursor-pointer">+ 1 câu</button>
        <DeleteButton label="Xoá nhóm" onClick={async () => { if (await confirmDelete(`nhóm câu ${first.questionNumber}–${qs[qs.length - 1].questionNumber}`)) mutate("DELETE", "/questions-bulk", { ids }); }} />
      </div>

      <textarea key={`instr-${first.groupInstruction}`} defaultValue={group.instruction} onBlur={(e) => { if (e.target.value !== group.instruction) bulk({ groupInstruction: e.target.value }); }} rows={2} placeholder="Hướng dẫn của nhóm câu" className="w-full p-2.5 ui-input text-sm italic" />

      {choice && !AUTO_OPTION_TYPES.includes(group.type) && sameOptions && (
        <div>
          <label className="ui-label text-xs">Danh sách lựa chọn của nhóm (mỗi dòng 1 lựa chọn)</label>
          <textarea key={`opts-${first.options}`} defaultValue={sharedOptions.join("\n")} onBlur={(e) => { const next = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); if (next.join("\n") !== sharedOptions.join("\n")) bulk({ options: next }); }} rows={Math.min(10, Math.max(3, sharedOptions.length + 1))} className="w-full p-2.5 ui-input text-sm font-mono" placeholder={"A. …\nB. …\nC. …"} />
        </div>
      )}

      <div className="space-y-2">
        {qs.map((q) => (
          <QuestionRow key={q.id} q={q} choice={choice} showOwnOptions={choice && !AUTO_OPTION_TYPES.includes(group.type) && !sameOptions} patchQuestion={patchQuestion} mutate={mutate} confirmDelete={confirmDelete} uploadFile={uploadFile} replaceQuestion={replaceQuestion} />
        ))}
      </div>
    </div>
  );
}

function QuestionRow({ q, choice, showOwnOptions, patchQuestion, mutate, confirmDelete, uploadFile, replaceQuestion }: { q: any; choice: boolean; showOwnOptions: boolean } & Pick<GroupProps, "patchQuestion" | "mutate" | "confirmDelete" | "uploadFile" | "replaceQuestion">) {
  const options = parseArr(q.options);
  const missing = q.correctIndex === null && !q.correctAnswer;
  const answerText = [q.correctAnswer, ...parseArr(q.acceptableAnswers)].filter(Boolean).join(" / ");

  return (
    <div className={`rounded-xl border p-3 bg-surface ${missing ? "border-amber-300" : "border-line"}`}>
      <div className="flex gap-3">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-primary-soft text-primary text-sm font-bold flex items-center justify-center">{q.questionNumber}</span>
        <div className="flex-1 min-w-0 space-y-2">
          <textarea defaultValue={q.promptText} onBlur={(e) => { if (e.target.value !== q.promptText) patchQuestion(q.id, { promptText: e.target.value }); }} rows={2} className="w-full p-2 ui-input text-sm" placeholder={choice ? "Nội dung câu hỏi / nhận định" : "Câu có chỗ trống — gõ ______ (từ 3 dấu gạch dưới) ở vị trí cần điền"} />
          {showOwnOptions && (
            <textarea defaultValue={options.join("\n")} onBlur={(e) => { const next = e.target.value.split("\n").map((s) => s.trim()).filter(Boolean); if (next.join("\n") !== options.join("\n")) patchQuestion(q.id, { options: next }); }} rows={Math.max(3, options.length)} className="w-full p-2 ui-input text-sm font-mono" placeholder={"Lựa chọn riêng của câu này, mỗi dòng 1 lựa chọn\nA. …\nB. …"} />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold ${missing ? "text-amber-700" : "text-emerald-700"}`}>Đáp án:</span>
            {choice ? (
              options.length ? (
                <select value={q.correctIndex ?? ""} onChange={(e) => patchQuestion(q.id, { correctIndex: e.target.value === "" ? null : Number(e.target.value), correctAnswer: null })} className={`ui-input w-auto max-w-full text-sm font-bold py-1.5 cursor-pointer ${missing ? "border-amber-400" : ""}`}>
                  <option value="">— Chọn đáp án —</option>
                  {options.map((o, i) => <option key={i} value={i}>{o.length > 60 ? `${o.slice(0, 60)}…` : o}</option>)}
                </select>
              ) : <span className="text-xs text-muted">Nhập danh sách lựa chọn trước</span>
            ) : (
              <input
                defaultValue={answerText}
                onBlur={(e) => {
                  if (e.target.value === answerText) return;
                  const alts = e.target.value.split("/").map((s) => s.trim()).filter(Boolean);
                  patchQuestion(q.id, { correctAnswer: alts[0] || null, acceptableAnswers: alts.slice(1), correctIndex: null });
                }}
                placeholder="VD: colour / color"
                className={`ui-input flex-1 min-w-[160px] text-sm font-bold py-1.5 ${missing ? "border-amber-400" : ""}`}
              />
            )}
            <span className="ml-auto flex items-center gap-1">
              <label className="px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-primary cursor-pointer rounded-full hover:bg-primary-soft">
                {q.imageUrl ? "Đổi ảnh" : "Ảnh"}
                <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const r = await uploadFile(`/questions/${q.id}/image`, "image", f); if (r) replaceQuestion(r); }} />
              </label>
              <button onClick={async () => { if (await confirmDelete(`câu ${q.questionNumber}`)) mutate("DELETE", `/questions/${q.id}`); }} aria-label={`Xoá câu ${q.questionNumber}`} className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 cursor-pointer">×</button>
            </span>
          </div>
          {q.imageUrl && (
            <div className="flex items-center gap-3">
              <img src={q.imageUrl} alt={`Hình câu ${q.questionNumber}`} className="max-h-28 rounded-lg border border-line bg-white" />
              <button onClick={() => patchQuestion(q.id, { imageUrl: null })} className="text-xs font-bold text-red-600 hover:underline cursor-pointer">Bỏ ảnh</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SpeakingPartEditor({ part, onSave, onDelete }: { part: any; onSave: (data: any) => void; onDelete: () => void }) {
  const [lines, setLines] = useState<string[]>(Array.isArray(part.questions) && part.questions.length ? part.questions : [""]);
  const saveLines = (next: string[]) => { setLines(next); onSave({ questions: next.map((l) => l.trim()).filter(Boolean) }); };
  const isCueCard = part.partNumber === 2;

  return (
    <div className="ui-card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-bold text-lg text-primary">Speaking Part {part.partNumber}</h3>
        <DeleteButton onClick={onDelete} />
      </div>
      <input defaultValue={part.instructions || ""} placeholder={isCueCard ? "VD: You will have 1 minute to prepare and then talk for 1–2 minutes." : "Hướng dẫn chung (tuỳ chọn)"} onBlur={(e) => onSave({ instructions: e.target.value })} className="w-full p-2.5 ui-input italic text-sm" />
      <p className="text-xs text-muted">{isCueCard ? "Dòng đầu là chủ đề cue card (Describe a…), các dòng sau là gợi ý (You should say: …)." : "Mỗi dòng 1 câu hỏi."}</p>
      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={`${i}-${lines.length}`} className="flex items-center gap-2">
            <span className="w-6 text-xs font-bold text-muted text-right shrink-0">{isCueCard && i === 0 ? "★" : i + (isCueCard ? 0 : 1)}</span>
            <textarea
              defaultValue={line}
              rows={1}
              onBlur={(e) => { if (e.target.value === line) return; const next = [...lines]; next[i] = e.target.value; saveLines(next); }}
              className="flex-1 p-2 text-sm ui-input"
              placeholder={isCueCard && i === 0 ? "Describe a place you visited that…" : "Câu hỏi"}
            />
            <button type="button" onClick={() => saveLines(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : [""])} className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 cursor-pointer text-lg" title="Xoá dòng">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, ""])} className="text-xs font-bold text-primary hover:underline cursor-pointer py-2">+ Thêm dòng</button>
      </div>
      {isCueCard && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="ui-label text-xs">Thời gian chuẩn bị (giây)</label>
            <input type="number" defaultValue={part.prepSeconds ?? 60} onBlur={(e) => onSave({ prepSeconds: e.target.value })} className="w-full p-2 ui-input text-sm" />
          </div>
          <div>
            <label className="ui-label text-xs">Thời gian nói (giây)</label>
            <input type="number" defaultValue={part.speakSeconds ?? 120} onBlur={(e) => onSave({ speakSeconds: e.target.value })} className="w-full p-2 ui-input text-sm" />
          </div>
        </div>
      )}
    </div>
  );
}
