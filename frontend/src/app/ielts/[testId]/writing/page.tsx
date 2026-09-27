"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DURATION_SEC = 60 * 60; // real IELTS Writing = 60 min total for both tasks

function countWords(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// Student Writing test-taking page — both tasks shown together (student manages their own
// time within the 60-min total, same as the real test), graded via 2 parallel Groq calls
// (ieltsAttempts.routes.js's /writing/submit) against the real official IELTS Writing
// criteria (Task Achievement/Response, Coherence & Cohesion, Lexical Resource, Grammatical
// Range & Accuracy), combined per the official 1/3 + 2/3 Task weighting.
export default function IeltsWritingTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [task1Text, setTask1Text] = useState("");
  const [task2Text, setTask2Text] = useState("");
  const [timeLeft, setTimeLeft] = useState(DURATION_SEC);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);
  const submitRef = useRef<() => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
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

  const handleSubmit = async () => {
    if (!userId || submitting) return;
    if (!task1Text.trim() || !task2Text.trim()) {
      Swal.fire("Chưa hoàn thành", "Vui lòng viết cả 2 Task trước khi nộp bài.", "warning");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/writing/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, task1Text, task2Text })
      });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể chấm bài", "error"); return; }
      setResult(data);
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể chấm bài lúc này", "error"); } finally { setSubmitting(false); }
  };
  submitRef.current = handleSubmit;

  useEffect(() => {
    if (!tasks.length || result) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); submitRef.current(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [tasks, result]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!task1 || !task2) return <div className="min-h-screen flex items-center justify-center text-muted italic">Đề này chưa có đủ 2 Task Writing.</div>;

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, "0");
  const ss = String(timeLeft % 60).padStart(2, "0");

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
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả IELTS Writing" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-20 bg-surface border-b border-line px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap shadow-[0_2px_10px_rgba(30,58,138,0.06)]">
        <h1 className="font-bold text-primary text-sm sm:text-base">IELTS Writing</h1>
        <span className={`ml-auto font-mono font-black text-base sm:text-lg px-4 py-1.5 rounded-full ${timeLeft < 300 ? "bg-red-50 text-red-600 ring-1 ring-red-200 animate-pulse" : "bg-primary text-white shadow-[0_4px_12px_rgba(30,58,138,0.25)]"}`}>{mm}:{ss}</span>
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary px-5 py-2 text-sm cursor-pointer">
          {submitting ? "Đang chấm bài..." : "Nộp bài"}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        <WritingTaskEditor task={task1} value={task1Text} onChange={setTask1Text} />
        <WritingTaskEditor task={task2} value={task2Text} onChange={setTask2Text} />
      </div>
    </div>
  );
}

function WritingTaskEditor({ task, value, onChange }: { task: any; value: string; onChange: (v: string) => void }) {
  const words = countWords(value);
  return (
    <div className="ui-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ui-section-title text-lg">Task {task.taskNumber}</h2>
        <span className="text-xs text-muted">{task.minWords} từ tối thiểu · {task.timeMinutes} phút gợi ý</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground bg-background border border-line rounded-lg p-4">{task.promptText}</p>
      {task.imageUrl && <img src={task.imageUrl} alt="" className="max-h-72 rounded-lg border border-line" />}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        className="ui-input p-3 text-sm leading-relaxed"
        placeholder="Viết bài của bạn tại đây..."
      />
      <p className={`text-xs font-bold ${words < task.minWords ? "text-amber-600" : "text-emerald-600"}`}>{words} từ {words < task.minWords ? `(cần tối thiểu ${task.minWords})` : "✓"}</p>
    </div>
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
