"use client";
import { useState, useEffect, useCallback } from "react";
import { getSessionUserId } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { QUESTION_TYPE_META, FILL_TYPES, QuestionType } from "@/lib/readingGrading";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type SkillTab = "READING" | "LISTENING" | "WRITING" | "SPEAKING";

// Teacher review/edit page for one extracted IELTS test — the mandatory human-in-the-loop
// step before a test can be published (AI extraction from even a clean digital PDF will not
// be 100% reliable: multi-column passages get reordered, shared group instructions get
// misattached, answer-key matching can pick the wrong test's block, and Listening audio/
// Writing Task 1 charts are never auto-attached since AI extraction is text-only).
export default function IeltsTestReviewPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [savingTestConfig, setSavingTestConfig] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [skillTab, setSkillTab] = useState<SkillTab>("READING");

  const fetchTest = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/ielts/tests/${testId}`);
      if (res.ok) setTest(await res.json());
      else Swal.fire("Lỗi", "Không tìm thấy đề này", "error");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [testId]);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/"); return; }
    // Trang rà soát đề chỉ dành cho giáo viên
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => { if (u?.id && u.role !== "TEACHER") router.replace("/dashboard"); }).catch(() => {});
    fetch(`${API}/api/classroom/teacher/${uid}`).then((r) => r.json()).then(setClassrooms).catch(() => {});
    fetchTest();
  }, [fetchTest, router]);

  const patchTest = async (data: any) => {
    setSavingTestConfig(true);
    try {
      const res = await fetch(`${API}/api/ielts/tests/${testId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu", "error"); return; }
      setTest((prev: any) => ({ ...prev, ...updated }));
    } catch (err) { console.error(err); } finally { setSavingTestConfig(false); }
  };

  const patchQuestion = async (questionId: string, data: any) => {
    try {
      const res = await fetch(`${API}/api/ielts/questions/${questionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu câu hỏi", "error"); return; }
      setTest((prev: any) => ({
        ...prev,
        readingPassages: (prev.readingPassages || []).map((p: any) => ({ ...p, questions: p.questions.map((q: any) => (q.id === questionId ? updated : q)) })),
        listeningSections: (prev.listeningSections || []).map((s: any) => ({ ...s, questions: s.questions.map((q: any) => (q.id === questionId ? updated : q)) }))
      }));
    } catch (err) { console.error(err); }
  };

  const patchPassage = async (passageId: string, data: any) => {
    try {
      const res = await fetch(`${API}/api/ielts/reading-passages/${passageId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu đoạn văn", "error"); return; }
      setTest((prev: any) => ({ ...prev, readingPassages: prev.readingPassages.map((p: any) => (p.id === passageId ? { ...p, ...updated } : p)) }));
    } catch (err) { console.error(err); }
  };

  const patchListeningSection = async (sectionId: string, data: any) => {
    try {
      const res = await fetch(`${API}/api/ielts/listening-sections/${sectionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu", "error"); return; }
      setTest((prev: any) => ({ ...prev, listeningSections: prev.listeningSections.map((s: any) => (s.id === sectionId ? { ...s, ...updated } : s)) }));
    } catch (err) { console.error(err); }
  };

  const handleUploadListeningAudio = async (sectionId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("audio", file);
      const res = await fetch(`${API}/api/ielts/listening-sections/${sectionId}/audio`, { method: "POST", body: formData });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể gắn audio", "error"); return; }
      setTest((prev: any) => ({ ...prev, listeningSections: prev.listeningSections.map((s: any) => (s.id === sectionId ? { ...s, ...updated } : s)) }));
      Swal.fire({ title: "Đã gắn audio!", icon: "success", timer: 1500, toast: true, position: "top-end" });
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể gắn audio", "error"); }
  };

  const patchWritingTask = async (taskId: string, data: any) => {
    try {
      const res = await fetch(`${API}/api/ielts/writing-tasks/${taskId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu", "error"); return; }
      setTest((prev: any) => ({ ...prev, writingTasks: prev.writingTasks.map((t: any) => (t.id === taskId ? { ...t, ...updated } : t)) }));
    } catch (err) { console.error(err); }
  };

  const handleUploadWritingImage = async (taskId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${API}/api/ielts/writing-tasks/${taskId}/image`, { method: "POST", body: formData });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể tải ảnh lên", "error"); return; }
      setTest((prev: any) => ({ ...prev, writingTasks: prev.writingTasks.map((t: any) => (t.id === taskId ? { ...t, ...updated } : t)) }));
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể tải ảnh lên", "error"); }
  };

  const patchSpeakingPart = async (partId: string, data: any) => {
    try {
      const res = await fetch(`${API}/api/ielts/speaking-parts/${partId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data)
      });
      const updated = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", updated.error || "Không thể lưu", "error"); return; }
      setTest((prev: any) => ({ ...prev, speakingParts: prev.speakingParts.map((p: any) => (p.id === partId ? { ...p, ...updated, questions: JSON.parse(updated.questions || "[]") } : p)) }));
    } catch (err) { console.error(err); }
  };

  const handleReExtractSkill = async (skill: SkillTab) => {
    try {
      const res = await fetch(`${API}/api/ielts/tests/${testId}/extract-skill`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ skill })
      });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể trích xuất lại", "error"); return; }
      Swal.fire({ title: "Đang trích xuất lại...", text: "Vui lòng tải lại trang sau vài phút.", icon: "success", timer: 2500, toast: true, position: "top-end" });
    } catch (err) { console.error(err); }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`${API}/api/ielts/tests/${testId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Chưa thể publish", data.error, "warning"); return; }
      setTest((prev: any) => ({ ...prev, status: data.status }));
      Swal.fire("Đã publish!", "Đề thi này đã sẵn sàng cho học viên.", "success");
    } catch (err) { console.error(err); } finally { setPublishing(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!test) return null;

  const readingPassages = test.readingPassages || [];
  const listeningSections = test.listeningSections || [];
  const writingTasks = test.writingTasks || [];
  const speakingParts = test.speakingParts || [];

  const readingQuestionCount = readingPassages.reduce((s: number, p: any) => s + (p.questions?.length || 0), 0);
  const readingUnmatched = readingPassages.reduce((s: number, p: any) => s + (p.questions || []).filter((q: any) => q.correctIndex === null && !q.correctAnswer).length, 0);
  const listeningQuestionCount = listeningSections.reduce((s: number, sec: any) => s + (sec.questions?.length || 0), 0);
  const listeningUnmatched = listeningSections.reduce((s: number, sec: any) => s + (sec.questions || []).filter((q: any) => q.correctIndex === null && !q.correctAnswer).length, 0);
  const missingAudioCount = listeningSections.filter((s: any) => !s.audioUrl).length;

  const TABS: { id: SkillTab; label: string; count: number }[] = [
    { id: "READING", label: "Reading", count: readingPassages.length },
    { id: "LISTENING", label: "Listening", count: listeningSections.length },
    { id: "WRITING", label: "Writing", count: writingTasks.length },
    { id: "SPEAKING", label: "Speaking", count: speakingParts.length }
  ];

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-surface border-b border-line px-4 sm:px-6 py-3 flex items-center gap-2 sm:gap-4 flex-wrap">
        <Link href="/teacher" className="text-muted hover:text-primary transition-colors text-sm font-semibold shrink-0 py-2">← Thư viện IELTS</Link>
        <span className="text-line-strong hidden sm:inline">/</span>
        <h1 className="font-bold text-primary text-sm sm:text-base">{test.book?.title} — {test.title}</h1>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {/* ── Test config ── */}
        <div className="ui-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="ui-section-title text-lg">Cấu hình đề</h2>
            <span className="ui-badge px-3 py-1">{test.status}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="ui-label text-xs">Dạng đề (AI đề xuất — bạn xác nhận lại)</label>
              <select value={test.testType || ""} onChange={(e) => patchTest({ testType: e.target.value })} className="w-full p-2.5 ui-input font-bold">
                <option value="">-- Chưa xác nhận --</option>
                <option value="ACADEMIC">Academic</option>
                <option value="GENERAL_TRAINING">General Training</option>
              </select>
            </div>
            <div>
              <label className="ui-label text-xs">Cách giao đề</label>
              <select value={test.deliveryMode} onChange={(e) => patchTest({ deliveryMode: e.target.value })} className="w-full p-2.5 ui-input font-bold">
                <option value="LIBRARY">Thư viện tự luyện (không hạn nộp)</option>
                <option value="ASSIGNED">Giao bài có hạn nộp</option>
              </select>
            </div>
          </div>

          {test.deliveryMode === "LIBRARY" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="ui-label text-xs">Lớp học được xem</label>
                <select value={test.libraryClassroomId || ""} onChange={(e) => patchTest({ libraryClassroomId: e.target.value || null, libraryStudentId: null })} className="w-full p-2.5 ui-input">
                  <option value="">-- Không chọn --</option>
                  {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="ui-label text-xs">Hoặc 1 học viên cụ thể</label>
                <select value={test.libraryStudentId || ""} onChange={(e) => patchTest({ libraryStudentId: e.target.value || null, libraryClassroomId: null })} className="w-full p-2.5 ui-input">
                  <option value="">-- Không chọn --</option>
                  {classrooms.flatMap((c) => c.students || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="ui-label text-xs">Lớp học</label>
                <select value={test.assignedClassroomId || ""} onChange={(e) => patchTest({ assignedClassroomId: e.target.value || null })} className="w-full p-2.5 ui-input">
                  <option value="">-- Chọn lớp --</option>
                  {classrooms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="ui-label text-xs">Hạn nộp</label>
                <input type="datetime-local" defaultValue={test.deadline ? test.deadline.slice(0, 16) : ""} onBlur={(e) => patchTest({ deadline: e.target.value || null })} className="w-full p-2.5 ui-input" />
              </div>
              <div>
                <label className="ui-label text-xs">Số lần làm tối đa</label>
                <input type="number" min={1} defaultValue={test.maxAttempts} onBlur={(e) => patchTest({ maxAttempts: e.target.value })} className="w-full p-2.5 ui-input" />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handlePublish}
              disabled={publishing || test.status === "PUBLISHED"}
              className="btn-primary px-5 py-2 text-sm cursor-pointer"
            >
              {test.status === "PUBLISHED" ? "✓ Đã publish" : publishing ? "Đang publish..." : "Publish"}
            </button>
          </div>
          {savingTestConfig && <p className="text-xs text-muted">Đang lưu...</p>}
        </div>

        {/* ── Skill tabs ── */}
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setSkillTab(t.id)}
              className={`ui-chip cursor-pointer ${skillTab === t.id ? "ui-chip-active" : ""}`}
            >
              {t.label} {t.count > 0 && `(${t.count})`}
            </button>
          ))}
        </div>

        {skillTab === "READING" && (
          <>
            {readingQuestionCount > 0 && (
              <AnswerCrossCheckBanner unmatched={readingUnmatched} total={readingQuestionCount} label="Reading" />
            )}
            {readingPassages.length === 0 ? (
              <EmptySkillNotice skill="READING" onReExtract={() => handleReExtractSkill("READING")} />
            ) : (
              <div className="flex justify-end">
                <ReExtractButton onClick={() => handleReExtractSkill("READING")} />
              </div>
            )}
            {readingPassages.map((passage: any) => (
              <div key={passage.id} className="ui-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-lg text-primary">Reading Section {passage.sectionNumber}{passage.passageIndex > 1 ? `.${passage.passageIndex}` : ""}</h3>
                  <span className="text-xs text-muted">{passage.questions?.length || 0} câu hỏi</span>
                </div>
                <input defaultValue={passage.title || ""} placeholder="Tên đoạn văn (tuỳ chọn)" onBlur={(e) => patchPassage(passage.id, { title: e.target.value })} className="w-full p-2.5 ui-input font-bold" />
                <textarea defaultValue={passage.bodyText} onBlur={(e) => patchPassage(passage.id, { bodyText: e.target.value })} rows={10} className="w-full p-3 ui-input text-sm leading-relaxed font-mono" placeholder="Nội dung đoạn văn..." />
                <p className="text-xs text-muted">Rủi ro cao nhất khi trích xuất tự động — hãy đối chiếu lại đúng thứ tự câu với sách gốc, đặc biệt nếu bài viết dàn nhiều cột.</p>
                <div className="space-y-3 pt-2">
                  {(passage.questions || []).map((q: any) => <QuestionEditor key={q.id} question={q} onSave={(data) => patchQuestion(q.id, data)} />)}
                </div>
              </div>
            ))}
          </>
        )}

        {skillTab === "LISTENING" && (
          <>
            {listeningQuestionCount > 0 && <AnswerCrossCheckBanner unmatched={listeningUnmatched} total={listeningQuestionCount} label="Listening" />}
            {missingAudioCount > 0 && (
              <div className="rounded-xl p-4 border bg-amber-50 border-amber-200">
                <p className="font-bold text-sm text-amber-700">⚠️ Còn {missingAudioCount} Section chưa gắn audio — bắt buộc gắn đủ audio mới publish được.</p>
              </div>
            )}
            {listeningSections.length === 0 ? (
              <EmptySkillNotice skill="LISTENING" onReExtract={() => handleReExtractSkill("LISTENING")} />
            ) : (
              <div className="flex justify-end"><ReExtractButton onClick={() => handleReExtractSkill("LISTENING")} /></div>
            )}
            {listeningSections.map((section: any) => (
              <div key={section.id} className="ui-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-lg text-primary">Listening Section {section.sectionNumber}</h3>
                  <span className="text-xs text-muted">{section.questions?.length || 0} câu hỏi</span>
                </div>
                <input defaultValue={section.instructions || ""} placeholder="Hướng dẫn chung đầu Section" onBlur={(e) => patchListeningSection(section.id, { instructions: e.target.value })} className="w-full p-2.5 ui-input italic text-sm" />

                <div className="flex items-center gap-3">
                  {section.audioUrl ? <audio src={section.audioUrl} controls className="flex-1 h-9" /> : <p className="text-sm text-red-600 font-bold flex-1">Chưa gắn audio</p>}
                  <label className="btn-outline px-4 py-2 text-xs cursor-pointer shrink-0">
                    {section.audioUrl ? "Đổi audio" : "Gắn audio"}
                    <input type="file" accept=".mp3,.m4a,.wav" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadListeningAudio(section.id, f); }} />
                  </label>
                </div>

                <div className="space-y-3 pt-2">
                  {(section.questions || []).map((q: any) => <QuestionEditor key={q.id} question={q} onSave={(data) => patchQuestion(q.id, data)} />)}
                </div>
              </div>
            ))}
          </>
        )}

        {skillTab === "WRITING" && (
          <>
            {writingTasks.length === 0 ? (
              <EmptySkillNotice skill="WRITING" onReExtract={() => handleReExtractSkill("WRITING")} />
            ) : (
              <div className="flex justify-end"><ReExtractButton onClick={() => handleReExtractSkill("WRITING")} /></div>
            )}
            {writingTasks.map((t: any) => (
              <div key={t.id} className="ui-card p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-bold text-lg text-primary">Writing Task {t.taskNumber}</h3>
                  <span className="text-xs text-muted">{t.minWords} từ · {t.timeMinutes} phút</span>
                </div>
                <textarea defaultValue={t.promptText} onBlur={(e) => patchWritingTask(t.id, { promptText: e.target.value })} rows={4} className="w-full p-3 ui-input text-sm leading-relaxed" placeholder="Đề bài..." />
                {t.taskNumber === 1 && (
                  <div className="flex items-center gap-3">
                    {t.imageUrl ? <img src={t.imageUrl} alt="Task 1 chart" className="max-h-48 rounded-lg border border-line" /> : <p className="text-sm text-amber-600 font-bold flex-1">Chưa gắn ảnh biểu đồ/sơ đồ (nếu đề Academic có kèm hình)</p>}
                    <label className="btn-outline px-4 py-2 text-xs cursor-pointer shrink-0">
                      {t.imageUrl ? "Đổi ảnh" : "Gắn ảnh"}
                      <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadWritingImage(t.id, f); }} />
                    </label>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="ui-label text-xs">Số từ tối thiểu</label>
                    <input type="number" defaultValue={t.minWords} onBlur={(e) => patchWritingTask(t.id, { minWords: e.target.value })} className="w-full p-2 ui-input text-sm" />
                  </div>
                  <div>
                    <label className="ui-label text-xs">Thời gian (phút)</label>
                    <input type="number" defaultValue={t.timeMinutes} onBlur={(e) => patchWritingTask(t.id, { timeMinutes: e.target.value })} className="w-full p-2 ui-input text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {skillTab === "SPEAKING" && (
          <>
            {speakingParts.length === 0 ? (
              <EmptySkillNotice skill="SPEAKING" onReExtract={() => handleReExtractSkill("SPEAKING")} />
            ) : (
              <div className="flex justify-end"><ReExtractButton onClick={() => handleReExtractSkill("SPEAKING")} /></div>
            )}
            {speakingParts.map((p: any) => (
              <SpeakingPartEditor key={p.id} part={p} onSave={(data) => patchSpeakingPart(p.id, data)} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AnswerCrossCheckBanner({ unmatched, total, label }: { unmatched: number; total: number; label: string }) {
  return (
    <div className={`rounded-xl p-4 border ${unmatched > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"}`}>
      <p className={`font-bold text-sm ${unmatched > 0 ? "text-red-700" : "text-emerald-700"}`}>
        {unmatched > 0
          ? `⚠️ Còn ${unmatched}/${total} câu ${label} chưa khớp đáp án — kiểm tra kỹ trước khi publish (đề Answer Key trong sách lặp số câu theo từng Test nên rất dễ khớp nhầm đề khác).`
          : `✓ Đã khớp đáp án cho toàn bộ ${total} câu ${label} — vẫn nên đối chiếu lại với sách gốc trước khi publish.`}
      </p>
    </div>
  );
}

function ReExtractButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="btn-outline px-4 py-2 text-sm cursor-pointer">
      Trích xuất lại
    </button>
  );
}

function EmptySkillNotice({ skill, onReExtract }: { skill: string; onReExtract: () => void }) {
  const label: Record<string, string> = { READING: "Reading", LISTENING: "Listening", WRITING: "Writing", SPEAKING: "Speaking" };
  return (
    <div className="ui-card text-center py-10 px-4 text-muted italic space-y-3">
      <img src="/images/illustrations/empty-state.svg" alt={`Chưa có nội dung ${label[skill]}`} width={800} height={600} loading="lazy" className="w-full h-auto max-w-[200px] mx-auto" />
      <p>Chưa có nội dung {label[skill]} nào được trích xuất.</p>
      <button onClick={onReExtract} className="btn-primary px-4 py-2 text-sm cursor-pointer">
        Trích xuất {label[skill]}
      </button>
    </div>
  );
}

function QuestionEditor({ question, onSave }: { question: any; onSave: (data: any) => void }) {
  const [options, setOptions] = useState<string[]>(question.options ? JSON.parse(question.options) : []);
  const isFillType = FILL_TYPES.includes(question.type as QuestionType);
  const unmatched = question.correctIndex === null && !question.correctAnswer;

  return (
    <div className={`rounded-xl p-4 border ${unmatched ? "border-red-300 bg-red-50" : "border-line bg-surface"}`}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="ui-badge px-2.5 py-1">Câu {question.questionNumber}</span>
        <select defaultValue={question.type} onBlur={(e) => onSave({ type: e.target.value })} className="ui-input w-auto text-xs font-bold px-2 py-1.5">
          {Object.entries(QUESTION_TYPE_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
        </select>
        {unmatched && <span className="text-xs font-bold text-red-600">⚠️ Chưa khớp đáp án</span>}
      </div>

      <input defaultValue={question.groupInstruction || ""} placeholder="Hướng dẫn chung của nhóm câu (nếu có), ví dụ: Questions 14-18: Complete the summary below" onBlur={(e) => onSave({ groupInstruction: e.target.value })} className="w-full mb-2 p-2 text-xs ui-input italic" />
      <textarea defaultValue={question.promptText} onBlur={(e) => onSave({ promptText: e.target.value })} rows={2} className="w-full mb-2 p-2.5 ui-input text-sm" placeholder="Nội dung câu hỏi..." />

      {isFillType ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input defaultValue={question.correctAnswer || ""} placeholder="Đáp án đúng" onBlur={(e) => onSave({ correctAnswer: e.target.value })} className="p-2 text-sm ui-input font-bold" />
          <input
            defaultValue={question.acceptableAnswers ? JSON.parse(question.acceptableAnswers).join(", ") : ""}
            placeholder="Biến thể được chấp nhận, ngăn bởi dấu phẩy (VD: colour, color)"
            onBlur={(e) => onSave({ acceptableAnswers: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
            className="p-2 text-sm ui-input"
          />
        </div>
      ) : (
        <div className="space-y-1.5">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name={`correct-${question.id}`} defaultChecked={question.correctIndex === i} onChange={() => onSave({ correctIndex: i })} />
              <input
                defaultValue={opt}
                onBlur={(e) => { const next = [...options]; next[i] = e.target.value; setOptions(next); onSave({ options: next }); }}
                className="flex-1 p-1.5 text-sm ui-input"
              />
            </div>
          ))}
          <button type="button" onClick={() => setOptions([...options, ""])} className="text-xs font-bold text-primary hover:underline cursor-pointer py-2">+ Thêm lựa chọn</button>
        </div>
      )}

      <input defaultValue={question.wordLimit || ""} placeholder='Giới hạn từ (VD: "NO MORE THAN TWO WORDS")' onBlur={(e) => onSave({ wordLimit: e.target.value })} className="w-full mt-2 p-2 text-xs ui-input" />
    </div>
  );
}

function SpeakingPartEditor({ part, onSave }: { part: any; onSave: (data: any) => void }) {
  const [lines, setLines] = useState<string[]>(Array.isArray(part.questions) ? part.questions : []);

  const saveLines = (next: string[]) => { setLines(next); onSave({ questions: next }); };

  return (
    <div className="ui-card p-5 space-y-3">
      <h3 className="font-bold text-lg text-primary">Speaking Part {part.partNumber}</h3>
      <input defaultValue={part.instructions || ""} placeholder="Hướng dẫn chung (nếu có)" onBlur={(e) => onSave({ instructions: e.target.value })} className="w-full p-2.5 ui-input italic text-sm" />

      <div className="space-y-2">
        {lines.map((line, i) => (
          <div key={i} className="flex items-center gap-2">
            <textarea
              defaultValue={line}
              rows={1}
              onBlur={(e) => { const next = [...lines]; next[i] = e.target.value; saveLines(next); }}
              className="flex-1 p-2 text-sm ui-input"
            />
            <button type="button" onClick={() => saveLines(lines.filter((_, idx) => idx !== i))} className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 cursor-pointer text-sm" title="Xoá dòng">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => saveLines([...lines, ""])} className="text-xs font-bold text-primary hover:underline cursor-pointer py-2">+ Thêm dòng</button>
      </div>

      {part.partNumber === 2 && (
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
