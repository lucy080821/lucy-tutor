"use client";
import { useState, useEffect, useRef } from "react";
import { getSessionUserId } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import IeltsStudyPanel from "@/components/ielts/IeltsStudyPanel";
import { IeltsProgressNotice } from "@/components/ielts/IeltsProgress";
import { ExamFrame, ExamIntro, ExamTopBar, SplitPane, type MobilePane } from "@/components/ielts/exam/ExamChrome";
import { useCountdown, useExamDraft, useFontScale } from "@/components/ielts/exam/examHooks";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DURATION_SEC = 60 * 60; // real IELTS Writing = 60 min total for both tasks

type Texts = { t1: string; t2: string };

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Student Writing test-taking page — giao diện như IELTS trên máy: tab Task 1 / Task 2, chia đôi
// đề bài | khung viết (biểu đồ Task 1 luôn trong tầm mắt), đếm từ trực tiếp, không kiểm tra chính
// tả của trình duyệt (đề thật cũng không có). Bài viết dở được lưu nháp trên trình duyệt.
// Chấm bằng 2 lệnh Groq song song (ieltsAttempts.routes.js's /writing/submit) theo 4 tiêu chí
// chính thức, gộp band theo trọng số Task 1 × 1/3 + Task 2 × 2/3.
export default function IeltsWritingTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activeTask, setActiveTask] = useState("1");
  const [mobilePane, setMobilePane] = useState<MobilePane>("right");
  const submitRef = useRef<(auto?: boolean) => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  const exam = useExamDraft<Texts>(userId ? `lucy_ielts_draft_WRITING_${testId}_${userId}` : null, { t1: "", t2: "" }, DURATION_SEC);
  const font = useFontScale();
  const timeLeft = useCountdown(exam.endAt, exam.running && !result, () => submitRef.current(true));

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => setUserName(u.name || "Học viên")).catch(() => {});
    fetch(`${API}/api/ielts-attempts/tests/${testId}/writing?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { Swal.fire("Lỗi", d.error, "error"); router.push("/ielts"); return; } setTasks(d.tasks || []); })
      .catch(() => { Swal.fire("Lỗi", "Không kết nối được máy chủ. Vui lòng thử lại sau.", "error"); })
      .finally(() => setLoading(false));
  }, [testId, router]);

  const task1 = tasks.find((t) => t.taskNumber === 1);
  const task2 = tasks.find((t) => t.taskNumber === 2);
  const { t1: task1Text, t2: task2Text } = exam.answers;
  const setText = (key: keyof Texts, v: string) => exam.setAnswers((prev) => ({ ...prev, [key]: v }));

  const handleSubmit = async (auto = false) => {
    if (!userId || submitting) return;
    if (!task1Text.trim() || !task2Text.trim()) {
      Swal.fire(
        auto ? "Hết giờ làm bài" : "Chưa hoàn thành",
        auto ? "Bài chưa có đủ 2 Task nên chưa chấm được. Bài viết vẫn được lưu trên máy này." : "Vui lòng viết cả 2 Task trước khi nộp bài.",
        "warning"
      );
      return;
    }
    if (!auto) {
      const short = [task1, task2].filter((t) => t && countWords(t.taskNumber === 1 ? task1Text : task2Text) < t.minWords);
      const r = await Swal.fire({
        title: "Nộp bài?",
        html: (short.length
          ? `<p style="margin:0 0 8px"><b style="color:#b45309">Chưa đủ số từ tối thiểu:</b> ${short.map((t) => `Task ${t.taskNumber} (${countWords(t.taskNumber === 1 ? task1Text : task2Text)}/${t.minWords} từ)`).join(", ")}</p><p style="margin:0 0 8px">Bài thiếu số từ sẽ bị trừ điểm Task Achievement/Response.</p>`
          : "") + `<p style="margin:0">Sau khi nộp sẽ không sửa được nữa. AI chấm mất khoảng 20–40 giây.</p>`,
        icon: short.length ? "warning" : "question",
        showCancelButton: true,
        confirmButtonText: "Nộp bài",
        cancelButtonText: "Viết tiếp",
        reverseButtons: true,
        focusCancel: true,
      });
      if (!r.isConfirmed) return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/writing/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, task1Text, task2Text })
      });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể chấm bài", "error"); return; }
      exam.clear();
      setResult(data);
      window.scrollTo(0, 0);
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể chấm bài lúc này — bài viết vẫn được lưu trên máy, hãy thử nộp lại.", "error"); } finally { setSubmitting(false); }
  };
  submitRef.current = handleSubmit;

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!task1 || !task2) return <div className="min-h-screen flex items-center justify-center text-muted italic">Đề này chưa có đủ 2 Task Writing.</div>;

  if (result) {
    const f1 = JSON.parse(result.task1Feedback);
    const f2 = JSON.parse(result.task2Feedback);
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-6">
          <div className="ui-hero px-6 py-10 shadow-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Kết quả Writing</p>
              <p className="text-6xl sm:text-7xl font-black text-white mt-2">{result.overallBand?.toFixed(1)}</p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <img src="/images/photos/app/illus/exam-result.webp" alt="Minh hoạ kết quả IELTS Writing" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ielts" className="btn-primary px-5 py-2.5">← Về trang IELTS</Link>
            <button
              onClick={async () => { if (!pdfRef.current) return; setExportingPdf(true); try { await exportNodeToPDF(pdfRef.current, `ielts-writing-${Date.now()}.pdf`); } catch { Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error"); } finally { setExportingPdf(false); } }}
              disabled={exportingPdf}
              className="btn-outline px-5 py-2.5 cursor-pointer"
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
          </div>
        </div>
        {userId && result.id && (
          <div className="max-w-3xl mx-auto px-4 pb-6 space-y-5">
            <IeltsProgressNotice skill="WRITING" userId={userId} />
            <IeltsStudyPanel skill="WRITING" attemptId={result.id} userId={userId} />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 pb-16 space-y-6">
          <WritingFeedbackBlock title="Task 1" feedback={f1} />
          <WritingFeedbackBlock title="Task 2" feedback={f2} />
        </div>

        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
          <SkillReportPDF
            ref={pdfRef}
            skillLabel="IELTS Writing"
            skillIcon="✍️"
            studentName={userName}
            practicedAt={new Date()}
            score={result.overallBand}
            scoreScale="9"
            contextTitle={`${task1.promptText.slice(0, 80)}...`}
            overallComment={`Học viên đạt band tổng ${result.overallBand?.toFixed(1)} cho Writing (Task 1 band ${f1.taskBand?.toFixed(1)}, Task 2 band ${f2.taskBand?.toFixed(1)}).`}
            rubric={[
              { label: "Task 1 — Task Achievement", band: f1.taskAchievement?.band, note: f1.taskAchievement?.comment || "" },
              { label: "Task 1 — Coherence & Cohesion", band: f1.coherenceCohesion?.band, note: f1.coherenceCohesion?.comment || "" },
              { label: "Task 1 — Lexical Resource", band: f1.lexicalResource?.band, note: f1.lexicalResource?.comment || "" },
              { label: "Task 1 — Grammatical Range & Accuracy", band: f1.grammaticalRangeAccuracy?.band, note: f1.grammaticalRangeAccuracy?.comment || "" },
              { label: "Task 2 — Task Response", band: f2.taskAchievement?.band, note: f2.taskAchievement?.comment || "" },
              { label: "Task 2 — Coherence & Cohesion", band: f2.coherenceCohesion?.band, note: f2.coherenceCohesion?.comment || "" },
              { label: "Task 2 — Lexical Resource", band: f2.lexicalResource?.band, note: f2.lexicalResource?.comment || "" },
              { label: "Task 2 — Grammatical Range & Accuracy", band: f2.grammaticalRangeAccuracy?.band, note: f2.grammaticalRangeAccuracy?.comment || "" }
            ] as SkillReportRubricItem[]}
            suggestions={[]}
            transcriptTitle="Bài viết"
            transcriptBody={`--- Task 1 ---\n${result.task1Text}\n\n--- Task 2 ---\n${result.task2Text}`}
          />
        </div>
      </div>
    );
  }

  if (!exam.running) {
    const draft = exam.savedDraft;
    const draftWords = draft ? countWords(draft.answers?.t1 || "") + countWords(draft.answers?.t2 || "") : 0;
    return (
      <ExamIntro
        title="IELTS Writing"
        durationMin={DURATION_SEC / 60}
        facts={[`Task 1 ≥ ${task1.minWords} từ`, `Task 2 ≥ ${task2.minWords} từ`]}
        tips={[
          `Gợi ý chia giờ: Task 1 khoảng ${task1.timeMinutes || 20} phút, Task 2 khoảng ${task2.timeMinutes || 40} phút. Task 2 chiếm 2/3 điểm.`,
          "Đề bài bên trái, khung viết bên phải (điện thoại: chuyển bằng 2 tab). Chuyển Task bằng tab trên cùng.",
          "Số từ được đếm trực tiếp. Không có kiểm tra chính tả tự động — giống phòng thi.",
          "Bài viết được tự lưu trên máy này — tải lại trang vẫn viết tiếp được.",
        ]}
        draft={draft ? { timeLeft: Math.max(0, Math.ceil((draft.endAt - Date.now()) / 1000)), answered: draftWords, summary: `đã viết ${draftWords} từ` } : null}
        onStart={() => { exam.startFresh(); setActiveTask("1"); }}
        onResume={exam.resume}
      />
    );
  }

  const task = activeTask === "1" ? task1 : task2;
  const words1 = countWords(task1Text);
  const words2 = countWords(task2Text);

  return (
    <ExamFrame fontSize={font.size}>
      <ExamTopBar
        title="IELTS Writing"
        parts={[
          { key: "1", label: "Task 1", sub: `${words1} từ` },
          { key: "2", label: "Task 2", sub: `${words2} từ` },
        ]}
        activePart={activeTask}
        onPart={setActiveTask}
        timeLeft={timeLeft}
        font={font}
        onSubmit={() => handleSubmit(false)}
        submitting={submitting}
        submitLabel={submitting ? "Đang chấm..." : "Nộp bài"}
      />

      <SplitPane
        leftLabel="Đề bài"
        rightLabel="Bài viết"
        mobileTab={mobilePane}
        onMobileTab={setMobilePane}
        left={[task1, task2].map((t) => (
          <div key={t.taskNumber} className={String(t.taskNumber) === activeTask ? "flex-1 min-h-0 overflow-y-auto" : "hidden"}>
            <div className="px-4 sm:px-6 py-5 max-w-[46rem] mx-auto space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[1.2em] font-bold text-primary">Writing Task {t.taskNumber}</h2>
                <span className="ui-badge">≥ {t.minWords} từ</span>
                {t.timeMinutes && <span className="ui-badge">~{t.timeMinutes} phút</span>}
              </div>
              <div className="rounded-xl border border-line bg-surface p-4 sm:p-5 leading-relaxed whitespace-pre-wrap">{t.promptText}</div>
              {t.imageUrl && <img src={t.imageUrl} alt={`Biểu đồ / hình minh hoạ Writing Task ${t.taskNumber}`} className="w-full rounded-xl border border-line bg-white" />}
            </div>
          </div>
        ))}
        right={[task1, task2].map((t) => {
          const key: keyof Texts = t.taskNumber === 1 ? "t1" : "t2";
          const text = exam.answers[key];
          const words = countWords(text);
          const enough = words >= t.minWords;
          return (
            <div key={t.taskNumber} className={String(t.taskNumber) === activeTask ? "flex-1 min-h-0 flex flex-col bg-surface lg:border-l border-line" : "hidden"}>
              <textarea
                value={text}
                onChange={(e) => setText(key, e.target.value)}
                aria-label={`Bài viết Task ${t.taskNumber}`}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="sentences"
                placeholder={`Viết bài Task ${t.taskNumber} tại đây...`}
                className="flex-1 min-h-0 w-full resize-none bg-surface px-4 sm:px-6 py-5 leading-[1.8] text-foreground focus:outline-none"
              />
              <div className="shrink-0 border-t border-line px-4 sm:px-6 py-2.5 flex items-center gap-3 text-[15px]">
                <div className="flex-1 h-1.5 rounded-full bg-primary-soft overflow-hidden">
                  <div className={`h-full transition-[width] ${enough ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, (words / t.minWords) * 100)}%` }} />
                </div>
                <span className={`text-sm font-bold tabular-nums whitespace-nowrap ${enough ? "text-emerald-700" : "text-amber-700"}`}>
                  {words} / {t.minWords} từ {enough ? "✓" : ""}
                </span>
              </div>
            </div>
          );
        })}
      />

      {/* Thanh dưới: chuyển nhanh giữa 2 Task */}
      <div className="shrink-0 bg-surface border-t border-line px-3 sm:px-5 py-2 flex items-center gap-2 text-[15px]">
        {[task1, task2].map((t) => {
          const w = t.taskNumber === 1 ? words1 : words2;
          const on = String(t.taskNumber) === activeTask;
          return (
            <button
              key={t.taskNumber}
              onClick={() => { setActiveTask(String(t.taskNumber)); setMobilePane("right"); }}
              className={`flex-1 sm:flex-none px-4 h-10 rounded-full border text-sm font-bold cursor-pointer ${on ? "bg-primary text-white border-primary" : "border-line-strong text-foreground hover:border-primary"}`}
            >
              Task {t.taskNumber} · {w}/{t.minWords} từ
            </button>
          );
        })}
        <span className="hidden sm:block ml-auto text-xs text-muted">Đang viết: {task.taskNumber === 1 ? "Task 1" : "Task 2"}</span>
      </div>
    </ExamFrame>
  );
}

function WritingFeedbackBlock({ title, feedback }: { title: string; feedback: any }) {
  const criteria = [
    { key: "taskAchievement", label: title === "Task 1" ? "Task Achievement" : "Task Response" },
    { key: "coherenceCohesion", label: "Coherence & Cohesion" },
    { key: "lexicalResource", label: "Lexical Resource" },
    { key: "grammaticalRangeAccuracy", label: "Grammatical Range & Accuracy" }
  ];
  return (
    <div className="ui-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-primary">{title}</h3>
        <span className="inline-flex items-center rounded-full bg-primary text-white px-4 py-1 text-xl font-black">{feedback.taskBand?.toFixed(1)}</span>
      </div>
      {criteria.map((c) => (
        <div key={c.key} className="text-sm border-t border-line pt-3">
          <p className="font-bold text-foreground">{c.label} — <span className="text-primary">{feedback[c.key]?.band?.toFixed(1)}</span></p>
          <p className="text-muted mt-0.5">{feedback[c.key]?.comment}</p>
        </div>
      ))}
    </div>
  );
}
