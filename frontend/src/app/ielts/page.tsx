"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const SKILL_META: Record<string, { label: string; path: string }> = {
  LISTENING: { label: "Listening", path: "listening" },
  READING: { label: "Reading", path: "reading" },
  WRITING: { label: "Writing", path: "writing" },
  SPEAKING: { label: "Speaking", path: "speaking" }
};

// Student landing page for the IELTS Cambridge module — browse tests a teacher has published
// (either LIBRARY mode: visible via classroom/personal scope, unlimited practice; or ASSIGNED
// mode: deadline + maxAttempts, same semantics as the main Exam system) and review past
// attempts. Each of the 4 skills has its own dedicated taking page since their UX differs
// completely (audio+form / passage+form / 2 timed essays / 3-part recording).
export default function IeltsLandingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<"AVAILABLE" | "HISTORY">("AVAILABLE");
  const [tests, setTests] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    Promise.all([
      fetch(`${API}/api/ielts-attempts/available/${uid}`).then((r) => r.json()),
      fetch(`${API}/api/ielts-attempts/attempts/${uid}`).then((r) => r.json())
    ]).then(([availableData, historyData]) => {
      setTests(Array.isArray(availableData) ? availableData : []);
      setHistory(Array.isArray(historyData) ? historyData : []);
    }).catch(() => {
      setTests([]);
      setHistory([]);
    }).finally(() => setLoading(false));
  }, [router]);

  // Banner + tabs render immediately; only the list area waits for the two requests.
  const listLoader = <div className="ui-card text-center py-12 px-4 text-primary font-bold animate-pulse">Đang tải...</div>;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 pt-6 pb-10 space-y-6">
        <section className="rounded-2xl bg-primary-soft border border-line px-5 py-6 sm:px-8 sm:py-8 flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm text-muted mb-2">
              <Link href="/dashboard" className="hover:text-primary transition-colors font-semibold py-2">← Dashboard</Link>
              <span className="mx-2 text-line-strong">/</span>
              IELTS Cambridge
            </p>
            <h1 className="ui-page-title text-2xl sm:text-4xl mb-2">IELTS Cambridge</h1>
            <p className="ui-page-subtitle">Luyện đề Cambridge IELTS đủ 4 kỹ năng Listening, Reading, Writing, Speaking và xem lại band điểm từng lần làm.</p>
          </div>
          <div className="hidden md:block w-full max-w-[300px] shrink-0">
            <img src="/images/thumbs/ielts.svg" alt="Minh hoạ luyện đề IELTS Cambridge" width={640} height={360} loading="eager" className="w-full h-auto rounded-2xl" />
          </div>
        </section>

        <div className="flex flex-wrap gap-2">
          {[{ key: "AVAILABLE", label: "Đề Có Sẵn" }, { key: "HISTORY", label: loading ? "Lịch Sử" : `Lịch Sử (${history.length})` }].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`ui-chip ${tab === t.key ? "ui-chip-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
        {loading ? listLoader : <>
        {tab === "AVAILABLE" && (
          tests.length === 0 ? (
            <div className="ui-card text-center py-12 px-4 text-muted italic">
              <img src="/images/illustrations/empty-state.svg" alt="Chưa có đề IELTS" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-3" />
              Chưa có đề IELTS nào được giao cho bạn — hãy liên hệ giáo viên.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {tests.map((test) => (
              <div key={test.id} className="ui-card ui-card-hover overflow-hidden flex flex-col">
                <div className="aspect-video bg-primary-soft rounded-t-2xl overflow-hidden">
                  <img src="/images/thumbs/ielts.svg" alt={`Đề IELTS ${test.title}`} width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                </div>
                <div className="p-5 space-y-4 flex-1 flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">{test.bookTitle}</p>
                    <h3 className="font-bold text-lg text-primary leading-snug">{test.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {test.testType && <span className="ui-badge">{test.testType === "ACADEMIC" ? "Academic" : "General Training"}</span>}
                    <span className={`ui-badge ${test.deliveryMode === "ASSIGNED" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {test.deliveryMode === "ASSIGNED" ? "Được giao" : "Tự luyện"}
                    </span>
                  </div>
                </div>
                {test.deliveryMode === "ASSIGNED" && test.deadline && (
                  <p className="text-xs text-muted">Hạn nộp: {new Date(test.deadline).toLocaleString("vi-VN")}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-auto pt-4 border-t border-line">
                  {(["LISTENING", "READING", "WRITING", "SPEAKING"] as const).map((skill) => {
                    const info = test.skills?.[skill];
                    if (!info) return null;
                    const meta = SKILL_META[skill];
                    return (
                      <Link
                        key={skill}
                        href={info.canAttempt ? `/ielts/${test.id}/${meta.path}` : "#"}
                        onClick={(e) => { if (!info.canAttempt) e.preventDefault(); }}
                        className={`ui-chip ${info.canAttempt ? "cursor-pointer hover:bg-primary hover:text-white" : "bg-background text-muted/50 border-line cursor-not-allowed"}`}
                        title={info.canAttempt ? "" : "Đã hết số lần làm hoặc đã quá hạn nộp"}
                      >
                        {meta.label}
                        {test.deliveryMode === "ASSIGNED" && <span className="text-xs opacity-70">({info.attemptsCount}/{test.maxAttempts})</span>}
                      </Link>
                    );
                  })}
                </div>
                </div>
              </div>
            ))}
            </div>
          )
        )}

        {tab === "HISTORY" && (
          history.length === 0 ? (
            <div className="ui-card text-center py-12 px-4 text-muted italic">
              <img src="/images/illustrations/empty-state.svg" alt="Chưa có lịch sử làm bài IELTS" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-3" />
              Chưa có lần làm bài IELTS nào.
            </div>
          ) : (
            history.map((h) => (
              <div key={`${h.skill}-${h.id}`} className="ui-card p-4 sm:p-5">
                <button onClick={() => setExpandedAttempt(expandedAttempt === h.id ? null : h.id)} className="w-full flex items-center justify-between gap-3 cursor-pointer">
                  <div className="text-left">
                    <p className="text-xs text-muted">{h.test?.book?.title} — {h.test?.title}</p>
                    <p className="font-bold text-primary mt-0.5">{SKILL_META[h.skill].label}</p>
                  </div>
                  <div className="text-right">
                    <p className="inline-flex items-center justify-center min-w-[3.25rem] px-3 py-1 rounded-full bg-primary text-white text-lg font-black">{h.band?.toFixed(1)}</p>
                    <p className="text-xs text-muted mt-1">{new Date(h.practicedAt).toLocaleDateString("vi-VN")}</p>
                  </div>
                </button>
                {expandedAttempt === h.id && (
                  <div className="mt-4 pt-4 border-t border-line">
                    <AttemptDetail skill={h.skill} attemptId={h.id} />
                  </div>
                )}
              </div>
            ))
          )
        )}
        </>}
        </div>
      </div>
    </div>
  );
}

function AttemptDetail({ skill, attemptId }: { skill: string; attemptId: string }) {
  const [detail, setDetail] = useState<any>(null);
  useEffect(() => {
    fetch(`${API}/api/ielts-attempts/attempts/${skill}/${attemptId}`).then((r) => r.json()).then(setDetail).catch(() => {});
  }, [skill, attemptId]);

  if (!detail) return <p className="text-xs text-muted italic">Đang tải...</p>;

  if (skill === "LISTENING" || skill === "READING") {
    return <p className="text-sm text-foreground">Trả lời đúng {detail.rawScore}/40 câu — Band {detail.band?.toFixed(1)}</p>;
  }
  if (skill === "WRITING") {
    const f1 = JSON.parse(detail.task1Feedback);
    const f2 = JSON.parse(detail.task2Feedback);
    return (
      <div className="space-y-3 text-sm">
        <RubricBlock title="Task 1" feedback={f1} />
        <RubricBlock title="Task 2" feedback={f2} />
      </div>
    );
  }
  if (skill === "SPEAKING") {
    return (
      <div className="space-y-3 text-sm">
        {[1, 2, 3].map((n) => {
          const fb = detail[`part${n}Feedback`];
          if (!fb) return null;
          return <RubricBlock key={n} title={`Part ${n}`} feedback={JSON.parse(fb)} />;
        })}
      </div>
    );
  }
  return null;
}

function RubricBlock({ title, feedback }: { title: string; feedback: any }) {
  const criteria = Object.entries(feedback).filter(([key]) => key !== "taskBand" && key !== "overallBand");
  return (
    <div className="bg-background border border-line rounded-xl p-3">
      <p className="font-bold text-primary mb-1">{title} — Band {(feedback.taskBand ?? feedback.overallBand)?.toFixed(1)}</p>
      <div className="space-y-1">
        {criteria.map(([key, val]: [string, any]) => (
          <p key={key} className="text-foreground"><span className="font-bold text-primary">{val.band?.toFixed(1)}</span> — {val.comment}</p>
        ))}
      </div>
    </div>
  );
}
