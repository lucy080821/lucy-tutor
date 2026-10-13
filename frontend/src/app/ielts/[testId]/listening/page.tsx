"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionUserId } from "@/lib/session";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";
import IeltsStudyPanel from "@/components/ielts/IeltsStudyPanel";
import { IeltsProgressNotice } from "@/components/ielts/IeltsProgress";
import { ExamFrame, ExamIntro, ExamTopBar, QuestionNavigator, focusQuestion } from "@/components/ielts/exam/ExamChrome";
import { ExamQuestionGroups, type AnswerValue } from "@/components/ielts/exam/ExamQuestions";
import { ExamReview } from "@/components/ielts/exam/ExamReview";
import { confirmSubmit, formatClock, isAnswered, useCountdown, useExamDraft, useFontScale } from "@/components/ielts/exam/examHooks";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const DURATION_SEC = 40 * 60; // real IELTS Listening ≈ 30 min audio + 10 min transfer/review

type Answers = Record<number, AnswerValue>;
type Mode = "PRACTICE" | "EXAM";

// Student Listening test-taking page. 2 chế độ chọn ở màn hình bắt đầu:
// - Luyện tập: mỗi Part có trình phát audio đầy đủ (tua, nghe lại thoải mái).
// - Thi thật: mỗi Part chỉ phát 1 lần, không tua/tạm dừng, hết Part tự chuyển sang Part kế tiếp và phát tiếp.
// Câu hỏi hiện theo từng Part + thanh điều hướng câu ở đáy; bài làm dở lưu nháp trên trình duyệt.
// Chấm ở backend (ieltsAttempts.routes.js's /listening/submit) theo Answer Key của sách.
export default function IeltsListeningTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [data, setData] = useState<{ testType: string | null; sections: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [activePart, setActivePart] = useState("");
  const [current, setCurrent] = useState<number | null>(null);
  const [chosenMode, setChosenMode] = useState<Mode>("PRACTICE");
  const [autoPlayId, setAutoPlayId] = useState<string | null>(null);
  const submitRef = useRef<(auto?: boolean) => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  const exam = useExamDraft<Answers>(userId ? `lucy_ielts_draft_LISTENING_${testId}_${userId}` : null, {}, DURATION_SEC);
  const font = useFontScale();
  const timeLeft = useCountdown(exam.endAt, exam.running && !result, () => submitRef.current(true));
  const mode: Mode = exam.extra.mode === "EXAM" ? "EXAM" : "PRACTICE";
  const playedParts: string[] = exam.extra.played || [];

  useEffect(() => {
    const uid = getSessionUserId();
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => setUserName(u.name || "Học viên")).catch(() => {});
    fetch(`${API}/api/ielts-attempts/tests/${testId}/listening?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { Swal.fire("Lỗi", d.error, "error"); router.push("/ielts"); return; }
        setData(d);
        if (d.sections?.[0]) setActivePart(d.sections[0].id);
      })
      .catch(() => { Swal.fire("Lỗi", "Không kết nối được máy chủ. Vui lòng thử lại sau.", "error"); })
      .finally(() => setLoading(false));
  }, [testId, router]);

  const answers = exam.answers;
  const allNumbers: number[] = data ? data.sections.flatMap((s) => s.questions.map((q: any) => q.questionNumber)) : [];

  const handleSubmit = async (auto = false) => {
    if (!userId || submitting) return;
    if (!auto) {
      const unanswered = allNumbers.filter((n) => !isAnswered(answers[n]));
      if (!(await confirmSubmit({ unanswered, flagged: exam.flags, total: allNumbers.length }))) return;
    }
    setSubmitting(true);
    try {
      document.querySelectorAll<HTMLAudioElement>("audio[data-exam-audio]").forEach((a) => a.pause());
      const timeSpentSec = Math.min(DURATION_SEC, Math.round((Date.now() - exam.startedAt) / 1000));
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/listening/submit`, {
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
    const part = data?.sections.find((s) => s.questions.some((q: any) => q.questionNumber === n));
    if (part) setActivePart(part.id);
    setCurrent(n);
    focusQuestion(n);
  }, [data]);

  const setExtra = exam.setExtra;
  // Thi thật: hết audio 1 Part → đánh dấu đã nghe, chuyển sang Part kế tiếp và phát luôn
  const onPartEnded = useCallback((sectionId: string) => {
    if (mode !== "EXAM" || !data) return;
    setExtra((prev) => ({ ...prev, played: Array.from(new Set([...(prev.played || []), sectionId])) }));
    const idx = data.sections.findIndex((s) => s.id === sectionId);
    const next = data.sections[idx + 1];
    if (next) { setActivePart(next.id); setAutoPlayId(next.id); }
  }, [mode, data, setExtra]);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!data) return null;
  if (!data.sections.length) return <div className="min-h-screen flex items-center justify-center text-muted italic px-4 text-center">Đề này chưa có phần Listening.</div>;

  const totalQuestions = allNumbers.length;

  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-6">
          <div className="ui-hero px-6 py-10 shadow-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Kết quả Listening</p>
              <p className="text-6xl sm:text-7xl font-black text-white mt-2">{result.band?.toFixed(1)}</p>
              <p className="text-sm text-white/80 mt-2">Đúng {result.rawScore}/{totalQuestions} câu</p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <img src="/images/photos/app/illus/exam-result.webp" alt="Minh hoạ kết quả IELTS Listening" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ielts" className="btn-primary px-5 py-2.5">← Về trang IELTS</Link>
            <button
              onClick={async () => { if (!pdfRef.current) return; setExportingPdf(true); try { await exportNodeToPDF(pdfRef.current, `ielts-listening-${Date.now()}.pdf`); } catch { Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error"); } finally { setExportingPdf(false); } }}
              disabled={exportingPdf}
              className="btn-outline px-5 py-2.5 cursor-pointer"
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
          </div>
        </div>
        {userId && result.id && (
          <div className="max-w-3xl mx-auto px-4 pb-6 space-y-5">
            <IeltsProgressNotice skill="LISTENING" userId={userId} />
            <IeltsStudyPanel skill="LISTENING" attemptId={result.id} userId={userId} />
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 pb-16">
          <ExamReview review={result.review || []} parts={data.sections.map((s) => ({ key: s.id, label: `Part ${s.sectionNumber}`, questions: s.questions }))} />
        </div>

        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
          <SkillReportPDF
            ref={pdfRef}
            skillLabel="IELTS Listening"
            skillIcon="🎧"
            studentName={userName}
            practicedAt={new Date()}
            score={result.band}
            scoreScale="9"
            contextTitle={`Đúng ${result.rawScore}/${totalQuestions} câu`}
            overallComment={`Học viên đạt band ${result.band?.toFixed(1)} cho phần Listening, đúng ${result.rawScore}/${totalQuestions} câu.`}
            rubric={data.sections.map((s): SkillReportRubricItem => {
              const reviewByNumber = new Map<number, any>((result.review || []).map((r: any) => [r.questionNumber, r]));
              const correct = s.questions.filter((q: any) => reviewByNumber.get(q.questionNumber)?.correct).length;
              return { label: `Part ${s.sectionNumber}`, note: `Đúng ${correct}/${s.questions.length} câu` };
            })}
            suggestions={[]}
            transcriptTitle="Ghi chú"
            transcriptBody=""
          />
        </div>
      </div>
    );
  }

  if (!exam.running) {
    const draft = exam.savedDraft;
    return (
      <ExamIntro
        title="IELTS Listening"
        durationMin={DURATION_SEC / 60}
        facts={[`${data.sections.length} Part`, `${totalQuestions} câu`]}
        tips={[
          "Mỗi lần hiện 1 Part, audio của Part luôn nằm cố định phía trên câu hỏi.",
          "Đọc trước câu hỏi trước khi bấm phát audio — giống thời gian đọc đề ở phòng thi.",
          "Bấm biểu tượng lá cờ để đánh dấu câu cần xem lại; thanh dưới cùng cho biết câu nào đã làm.",
          "Bài làm được tự lưu trên máy này — tải lại trang vẫn làm tiếp được. Hết giờ hệ thống tự nộp bài.",
        ]}
        draft={draft ? { timeLeft: Math.max(0, Math.ceil((draft.endAt - Date.now()) / 1000)), answered: Object.values(draft.answers || {}).filter(isAnswered).length, total: totalQuestions } : null}
        onStart={() => { exam.startFresh({ mode: chosenMode, played: [] }); setActivePart(data.sections[0]?.id || ""); }}
        onResume={exam.resume}
      >
        <div className="space-y-2">
          <p className="ui-label">Chế độ làm bài</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {([
              ["PRACTICE", "Luyện tập", "Tua, tạm dừng, nghe lại thoải mái."],
              ["EXAM", "Thi thật", "Mỗi Part chỉ phát 1 lần, không tua — tự chuyển sang Part kế tiếp."],
            ] as const).map(([k, label, desc]) => (
              <button
                key={k}
                onClick={() => setChosenMode(k)}
                aria-pressed={chosenMode === k}
                className={`text-left p-4 rounded-2xl border-2 cursor-pointer transition-colors ${chosenMode === k ? "border-primary bg-primary-soft" : "border-line hover:border-primary/60"}`}
              >
                <p className={`font-bold ${chosenMode === k ? "text-primary" : "text-foreground"}`}>{label}</p>
                <p className="text-xs text-muted mt-1">{desc}</p>
              </button>
            ))}
          </div>
          {draft && <p className="text-xs text-muted">Chế độ chỉ áp dụng khi làm lại từ đầu; làm tiếp giữ chế độ cũ.</p>}
        </div>
      </ExamIntro>
    );
  }

  const active = data.sections.find((s) => s.id === activePart) || data.sections[0];

  return (
    <ExamFrame fontSize={font.size}>
      <ExamTopBar
        title={mode === "EXAM" ? "IELTS Listening · Thi thật" : "IELTS Listening"}
        parts={data.sections.map((s) => ({
          key: s.id,
          label: `Part ${s.sectionNumber}`,
          sub: `${s.questions.filter((q: any) => isAnswered(answers[q.questionNumber])).length}/${s.questions.length}`
        }))}
        activePart={activePart}
        onPart={setActivePart}
        timeLeft={timeLeft}
        font={font}
        onSubmit={() => handleSubmit(false)}
        submitting={submitting}
      />

      {/* Audio cố định phía trên — mọi Part đều được mount để audio đang phát không bị ngắt khi xem Part khác */}
      <div className="shrink-0 bg-primary-soft border-b border-line px-3 sm:px-5 py-2.5 text-[15px]">
        <div className="max-w-3xl mx-auto">
          {data.sections.map((s) => (
            <div key={s.id} className={s.id === active.id ? "block" : "hidden"}>
              {s.audioUrl ? (
                <SectionAudio
                  src={s.audioUrl}
                  label={`Part ${s.sectionNumber}`}
                  mode={mode}
                  played={playedParts.includes(s.id)}
                  autoPlay={autoPlayId === s.id}
                  onEnded={() => onPartEnded(s.id)}
                />
              ) : (
                <p className="text-sm text-muted italic">Part {s.sectionNumber} chưa có audio.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {data.sections.map((s) => (
          <div key={s.id} className={s.id === active.id ? "block" : "hidden"}>
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5">
              <p className="text-[0.75em] font-bold uppercase tracking-widest text-muted mb-1">Part {s.sectionNumber} · Questions {s.questions[0]?.questionNumber}–{s.questions[s.questions.length - 1]?.questionNumber}</p>
              {s.instructions && <p className="text-[0.95em] italic text-foreground/80 mb-5 whitespace-pre-line">{s.instructions}</p>}
              <div className="ui-card p-4 sm:p-6">
                <ExamQuestionGroups
                  questions={s.questions}
                  answers={answers}
                  onAnswer={onAnswer}
                  flags={exam.flags}
                  onToggleFlag={exam.toggleFlag}
                  current={current}
                  onCurrent={setCurrent}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <QuestionNavigator
        parts={data.sections.map((s) => ({ key: s.id, label: `Part ${s.sectionNumber}`, numbers: s.questions.map((q: any) => q.questionNumber) }))}
        activePart={activePart}
        answered={(n) => isAnswered(answers[n])}
        flags={exam.flags}
        current={current}
        onJump={jumpTo}
      />
    </ExamFrame>
  );
}

// Dừng mọi audio khác khi 1 Part bắt đầu phát (tránh 2 Part phát chồng lên nhau)
function pauseOthers(self: HTMLAudioElement) {
  document.querySelectorAll<HTMLAudioElement>("audio[data-exam-audio]").forEach((a) => { if (a !== self) a.pause(); });
}

function SectionAudio({ src, label, mode, played, autoPlay, onEnded }: { src: string; label: string; mode: Mode; played: boolean; autoPlay: boolean; onEnded: () => void }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const play = useCallback(() => {
    const a = ref.current;
    if (!a) return;
    a.play().catch(() => {
      Swal.fire({ toast: true, position: "top", icon: "info", title: `Bấm "Phát audio" để nghe ${label}`, timer: 3000, showConfirmButton: false });
    });
  }, [label]);

  useEffect(() => { if (autoPlay && !played && mode === "EXAM") play(); }, [autoPlay, played, mode, play]);
  useEffect(() => { if (ref.current) ref.current.volume = volume; }, [volume]);

  if (mode === "PRACTICE") {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm font-bold text-primary whitespace-nowrap">{label}</span>
        <audio data-exam-audio src={src} controls preload="metadata" className="w-full h-10" onPlay={(e) => pauseOthers(e.currentTarget)} />
      </div>
    );
  }

  const pct = duration ? Math.min(100, (time / duration) * 100) : 0;
  return (
    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <audio
        ref={ref}
        data-exam-audio
        src={src}
        preload="auto"
        onPlay={(e) => { pauseOthers(e.currentTarget); setPlaying(true); }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => { setPlaying(false); onEnded(); }}
      />
      {played ? (
        <p className="text-sm font-semibold text-emerald-700">✓ Đã nghe xong {label} — đề thi thật chỉ phát 1 lần.</p>
      ) : playing ? (
        <>
          <span className="text-sm font-bold text-primary whitespace-nowrap">{label} đang phát</span>
          <div className="flex-1 min-w-[8rem] h-2 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono tabular-nums text-muted whitespace-nowrap">{formatClock(Math.floor(time))} / {duration ? formatClock(Math.floor(duration)) : "--:--"}</span>
        </>
      ) : (
        <>
          <button onClick={play} className="btn-primary px-5 py-2 text-sm cursor-pointer whitespace-nowrap">▶ Phát audio {label}</button>
          <span className="text-xs text-muted">Chỉ được nghe 1 lần, không tạm dừng/tua. Đọc trước câu hỏi rồi hãy bấm.</span>
        </>
      )}
      {!played && (
        <label className="flex items-center gap-2 text-xs text-muted whitespace-nowrap sm:ml-auto">
          Âm lượng
          <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-24 accent-primary cursor-pointer" />
        </label>
      )}
    </div>
  );
}
