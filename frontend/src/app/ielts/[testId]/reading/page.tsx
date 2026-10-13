"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionUserId } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import HighlightableHtml, { type StoredHighlight } from "@/components/highlight/HighlightableHtml";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import IeltsStudyPanel from "@/components/ielts/IeltsStudyPanel";
import { IeltsProgressNotice } from "@/components/ielts/IeltsProgress";
import { ExamFrame, ExamIntro, ExamTopBar, QuestionNavigator, SplitPane, focusQuestion, type MobilePane } from "@/components/ielts/exam/ExamChrome";
import { ExamQuestionGroups, type AnswerValue } from "@/components/ielts/exam/ExamQuestions";
import { ExamReview } from "@/components/ielts/exam/ExamReview";
import { confirmSubmit, isAnswered, useCountdown, useExamDraft, useFontScale } from "@/components/ielts/exam/examHooks";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DURATION_SEC = 60 * 60; // real IELTS Reading is 60 minutes

type Answers = Record<number, AnswerValue>;

// Student Reading test-taking page — giao diện mô phỏng IELTS trên máy: mỗi lần 1 Part, chia đôi
// bài đọc | câu hỏi, thanh điều hướng câu ở đáy, đánh dấu xem lại, chỉnh cỡ chữ. Bài làm dở được
// lưu nháp trên trình duyệt (examHooks.ts) nên tải lại trang không mất bài. Chấm ở backend
// (ieltsAttempts.routes.js's /reading/submit) — band theo test.testType (Academic vs GT).
export default function IeltsReadingTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<{ testType: string | null; passages: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activePart, setActivePart] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("left");
  const submitRef = useRef<(auto?: boolean) => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  const exam = useExamDraft<Answers>(userId ? `lucy_ielts_draft_READING_${testId}_${userId}` : null, {}, DURATION_SEC);
  const font = useFontScale();
  const timeLeft = useCountdown(exam.endAt, exam.running && !result, () => submitRef.current(true));

  // ── Lưu highlight/ghi chú lên server: gom thao tác liên tiếp (0,6s) rồi gửi 1 lần / bài đọc ──
  const pendingHlRef = useRef<Record<string, StoredHighlight[]>>({});
  const hlTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hlErrorShownRef = useRef(false);

  const flushHighlights = useCallback((passageId: string, keepalive = false) => {
    clearTimeout(hlTimersRef.current[passageId]);
    const list = pendingHlRef.current[passageId];
    if (!list || !userId) return;
    delete pendingHlRef.current[passageId];
    fetch(`${API}/api/ielts-attempts/tests/${testId}/reading/annotations/${passageId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, keepalive,
      body: JSON.stringify({ userId, highlights: list })
    }).then((r) => { if (!r.ok) throw new Error(); }).catch(() => {
      if (hlErrorShownRef.current || keepalive) return;
      hlErrorShownRef.current = true;
      Swal.fire({ toast: true, position: "top-end", icon: "warning", title: "Chưa lưu được highlight — kiểm tra kết nối mạng", timer: 3000, showConfirmButton: false });
    });
  }, [testId, userId]);

  const saveHighlights = useCallback((passageId: string, list: StoredHighlight[]) => {
    pendingHlRef.current[passageId] = list;
    clearTimeout(hlTimersRef.current[passageId]);
    hlTimersRef.current[passageId] = setTimeout(() => flushHighlights(passageId), 600);
  }, [flushHighlights]);

  // Rời trang / ẩn tab → gửi nốt phần chưa lưu (keepalive để request vẫn đi khi trang đóng)
  useEffect(() => {
    const flushAll = () => Object.keys(pendingHlRef.current).forEach((id) => flushHighlights(id, true));
    const onVisibility = () => { if (document.visibilityState === "hidden") flushAll(); };
    window.addEventListener("pagehide", flushAll);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flushAll);
      document.removeEventListener("visibilitychange", onVisibility);
      flushAll();
    };
  }, [flushHighlights]);

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => setUserName(u.name || "Học viên")).catch(() => {});
    fetch(`${API}/api/ielts-attempts/tests/${testId}/reading?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { Swal.fire("Lỗi", d.error, "error"); router.push("/ielts"); return; }
        setData(d);
        if (d.passages?.[0]) setActivePart(d.passages[0].id);
      })
      .catch(() => { Swal.fire("Lỗi", "Không kết nối được máy chủ. Vui lòng thử lại sau.", "error"); })
      .finally(() => setLoading(false));
  }, [testId, router]);

  const answers = exam.answers;
  const allNumbers: number[] = data ? data.passages.flatMap((p) => p.questions.map((q: any) => q.questionNumber)) : [];

  const handleSubmit = async (auto = false) => {
    if (!userId || submitting) return;
    if (!auto) {
      const unanswered = allNumbers.filter((n) => !isAnswered(answers[n]));
      if (!(await confirmSubmit({ unanswered, flagged: exam.flags, total: allNumbers.length }))) return;
    }
    setSubmitting(true);
    try {
      const timeSpentSec = Math.min(DURATION_SEC, Math.round((Date.now() - exam.startedAt) / 1000));
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/reading/submit`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, answers, timeSpentSec })
      });
      const resData = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", resData.error || "Không thể nộp bài", "error"); return; }
      exam.clear();
      setResult(resData);
      window.scrollTo(0, 0);
    } catch (err) { console.error(err); Swal.fire("Lỗi", "Không thể nộp bài — bài làm vẫn được lưu trên máy, hãy thử nộp lại.", "error"); } finally { setSubmitting(false); }
  };
  submitRef.current = handleSubmit;

  const setAnswer = exam.setAnswers;
  const onAnswer = useCallback((n: number, v: AnswerValue | undefined) => {
    setAnswer((prev) => {
      const next = { ...prev };
      if (v === undefined || v === "") delete next[n]; else next[n] = v;
      return next;
    });
  }, [setAnswer]);

  const jumpTo = useCallback((n: number) => {
    const part = data?.passages.find((p) => p.questions.some((q: any) => q.questionNumber === n));
    if (part) setActivePart(part.id);
    setCurrent(n);
    setMobilePane("right");
    focusQuestion(n);
  }, [data]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!data) return null;
  if (!data.passages.length) return <div className="min-h-screen flex items-center justify-center text-muted italic px-4 text-center">Đề này chưa có phần Reading.</div>;

  const totalQuestions = allNumbers.length;
  const partLabel = (p: any, i: number) => (p.passageIndex > 1 ? `Part ${p.sectionNumber}.${p.passageIndex}` : `Part ${data.passages.length === 3 ? i + 1 : p.sectionNumber}`);

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-6">
          <div className="ui-hero px-6 py-10 shadow-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Kết quả Reading</p>
              <p className="text-6xl sm:text-7xl font-black text-white mt-2">{result.band?.toFixed(1)}</p>
              <p className="text-sm text-white/80 mt-2">Đúng {result.rawScore}/{totalQuestions} câu</p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <img src="/images/photos/app/illus/exam-result.webp" alt="Minh hoạ kết quả IELTS Reading" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ielts" className="btn-primary px-5 py-2.5">← Về trang IELTS</Link>
            <button
              onClick={async () => { if (!pdfRef.current) return; setExportingPdf(true); try { await exportNodeToPDF(pdfRef.current, `ielts-reading-${Date.now()}.pdf`); } catch { Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error"); } finally { setExportingPdf(false); } }}
              disabled={exportingPdf}
              className="btn-outline px-5 py-2.5 cursor-pointer"
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
          </div>
        </div>
        {userId && result.id && (
          <div className="max-w-3xl mx-auto px-4 pb-6 space-y-5">
            <IeltsProgressNotice skill="READING" userId={userId} />
            <IeltsStudyPanel skill="READING" attemptId={result.id} userId={userId} />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <ExamReview
            review={result.review || []}
            parts={data.passages.map((p, i) => ({ key: p.id, label: `${partLabel(p, i)}${p.title ? ` — ${p.title}` : ""}`, questions: p.questions, sourceHtml: p.bodyText, sourceLabel: "Xem lại bài đọc" }))}
          />
        </div>

        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
          <SkillReportPDF
            ref={pdfRef}
            skillLabel="IELTS Reading"
            skillIcon="📖"
            studentName={userName}
            practicedAt={new Date()}
            score={result.band}
            scoreScale="9"
            contextTitle={`Đúng ${result.rawScore}/${totalQuestions} câu`}
            overallComment={`Học viên đạt band ${result.band?.toFixed(1)} cho phần Reading, đúng ${result.rawScore}/${totalQuestions} câu.`}
            rubric={data.passages.map((p, i): SkillReportRubricItem => {
              const reviewByNumber = new Map<number, any>((result.review || []).map((r: any) => [r.questionNumber, r]));
              const correct = p.questions.filter((q: any) => reviewByNumber.get(q.questionNumber)?.correct).length;
              return { label: partLabel(p, i), note: `Đúng ${correct}/${p.questions.length} câu` };
            })}
            suggestions={[]}
            transcriptTitle="Đề bài"
            transcriptBody={data.passages.map((p) => p.bodyText).join("\n\n---\n\n")}
          />
        </div>
      </div>
    );
  }

  if (!exam.running) {
    const draft = exam.savedDraft;
    return (
      <ExamIntro
        title="IELTS Reading"
        durationMin={DURATION_SEC / 60}
        facts={[`${data.passages.length} bài đọc`, `${totalQuestions} câu`, ...(data.testType ? [data.testType === "GENERAL_TRAINING" ? "General Training" : "Academic"] : [])]}
        tips={[
          "Mỗi lần hiện 1 Part: bài đọc bên trái, câu hỏi bên phải (điện thoại: chuyển bằng 2 tab).",
          "Bôi đen chữ trong bài đọc rồi bấm chuột phải (điện thoại: ấn giữ) để highlight hoặc ghi chú.",
          "Bấm biểu tượng lá cờ cạnh câu hỏi để đánh dấu câu cần xem lại; thanh dưới cùng cho biết câu nào đã làm.",
          "Bài làm được tự lưu trên máy này — tải lại trang vẫn làm tiếp được. Hết giờ hệ thống tự nộp bài.",
        ]}
        draft={draft ? { timeLeft: Math.max(0, Math.ceil((draft.endAt - Date.now()) / 1000)), answered: Object.values(draft.answers || {}).filter(isAnswered).length, total: totalQuestions } : null}
        onStart={() => { exam.startFresh(); setActivePart(data.passages[0]?.id || ""); }}
        onResume={exam.resume}
      />
    );
  }

  return (
    <ExamFrame fontSize={font.size}>
      <ExamTopBar
        title="IELTS Reading"
        parts={data.passages.map((p, i) => ({
          key: p.id,
          label: partLabel(p, i),
          sub: `${p.questions.filter((q: any) => isAnswered(answers[q.questionNumber])).length}/${p.questions.length}`
        }))}
        activePart={activePart}
        onPart={setActivePart}
        timeLeft={timeLeft}
        font={font}
        onSubmit={() => handleSubmit(false)}
        submitting={submitting}
      />

      <SplitPane
        leftLabel="Bài đọc"
        rightLabel="Câu hỏi"
        mobileTab={mobilePane}
        onMobileTab={setMobilePane}
        left={data.passages.map((p, i) => (
          <div key={p.id} className={p.id === activePart ? "flex-1 min-h-0 overflow-y-auto" : "hidden"}>
            <div className="px-4 sm:px-6 py-5 max-w-[46rem] mx-auto">
              <p className="text-[0.75em] font-bold uppercase tracking-widest text-muted">{partLabel(p, i)} · Questions {p.questions[0]?.questionNumber}–{p.questions[p.questions.length - 1]?.questionNumber}</p>
              {p.title && <h2 className="text-[1.35em] font-bold text-foreground mt-1 mb-4 leading-snug">{p.title}</h2>}
              <HighlightableHtml
                html={p.bodyText || ""}
                initialHighlights={p.highlights}
                onChange={(list) => saveHighlights(p.id, list)}
                className="text-[1em] leading-[1.75] whitespace-pre-wrap text-foreground"
              />
              {p.imageUrl && <img src={p.imageUrl} alt={`Hình minh hoạ ${partLabel(p, i)}`} className="max-h-80 rounded-xl border border-line mt-4 bg-white" />}
            </div>
          </div>
        ))}
        right={data.passages.map((p) => (
          <div key={p.id} className={p.id === activePart ? "flex-1 min-h-0 overflow-y-auto bg-surface lg:border-l border-line" : "hidden"}>
            <div className="px-4 sm:px-6 py-5 max-w-[46rem] mx-auto">
              <ExamQuestionGroups
                questions={p.questions}
                answers={answers}
                onAnswer={onAnswer}
                flags={exam.flags}
                onToggleFlag={exam.toggleFlag}
                current={current}
                onCurrent={setCurrent}
              />
            </div>
          </div>
        ))}
      />

      <QuestionNavigator
        parts={data.passages.map((p, i) => ({ key: p.id, label: partLabel(p, i), numbers: p.questions.map((q: any) => q.questionNumber) }))}
        activePart={activePart}
        answered={(n) => isAnswered(answers[n])}
        flags={exam.flags}
        current={current}
        onJump={jumpTo}
      />
    </ExamFrame>
  );
}
