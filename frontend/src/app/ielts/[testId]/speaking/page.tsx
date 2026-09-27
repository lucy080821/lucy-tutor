"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Swal from "sweetalert2";
import { SkillReportPDF, SkillReportRubricItem } from "@/components/reports/SkillReportPDF";
import { exportNodeToPDF } from "@/lib/pdfExport";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Phase = "INTRO" | "PREP" | "RECORDING" | "GRADING" | "DONE";

// Student Speaking test-taking page — 3 parts submitted one at a time (record → upload →
// Whisper transcribe → AI-graded against the real IELTS Speaking criteria, all server-side via
// ieltsAttempts.routes.js's /speaking/submit-part). Reuses the MediaRecorder/getUserMedia
// pattern from pronunciation/page.tsx. Part 2 has a real prep timer (60s) then a speaking
// timer (120s, auto-stops); Parts 1/3 have no fixed timer — student records and stops manually.
export default function IeltsSpeakingTakingPage() {
  const params = useParams<{ testId: string }>();
  const router = useRouter();
  const testId = params.testId;

  const [userId, setUserId] = useState<string | null>(null);
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPartNumber, setCurrentPartNumber] = useState(1);
  const [phase, setPhase] = useState<Phase>("INTRO");
  const [prepLeft, setPrepLeft] = useState(0);
  const [speakLeft, setSpeakLeft] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [feedbackByPart, setFeedbackByPart] = useState<Record<number, any>>({});
  const [finalResult, setFinalResult] = useState<any>(null);
  const [userName, setUserName] = useState("Học viên");
  const [exportingPdf, setExportingPdf] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const stopRecordingRef = useRef<() => void>(() => {});
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) { router.push("/"); return; }
    setUserId(uid);
    fetch(`${API}/api/auth/me?userId=${uid}`).then((r) => r.json()).then((u) => setUserName(u.name || "Học viên")).catch(() => {});
    fetch(`${API}/api/ielts-attempts/tests/${testId}/speaking?userId=${uid}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) { Swal.fire("Lỗi", d.error, "error"); router.push("/ielts"); return; } setParts(d.parts || []); })
      .catch(() => { Swal.fire("Lỗi", "Không kết nối được máy chủ. Vui lòng thử lại sau.", "error"); })
      .finally(() => setLoading(false));
  }, [testId, router]);

  const currentPart = parts.find((p) => p.partNumber === currentPartNumber);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        submitPart(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setPhase("RECORDING");
      if (currentPart.partNumber === 2) setSpeakLeft(currentPart.speakSeconds || 120);
    } catch {
      Swal.fire("Không thể truy cập micro", "Vui lòng cấp quyền micro cho trình duyệt rồi thử lại.", "error");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };
  stopRecordingRef.current = stopRecording;

  const startPrep = () => {
    setPhase("PREP");
    setPrepLeft(currentPart.prepSeconds || 60);
  };

  useEffect(() => {
    if (phase !== "PREP" || prepLeft <= 0) return;
    const t = setTimeout(() => setPrepLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, prepLeft]);
  useEffect(() => {
    if (phase === "PREP" && prepLeft === 0) startRecording();
  }, [phase, prepLeft]);

  useEffect(() => {
    if (phase !== "RECORDING" || currentPart?.partNumber !== 2 || speakLeft <= 0) return;
    const t = setTimeout(() => setSpeakLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, speakLeft, currentPart]);
  useEffect(() => {
    if (phase === "RECORDING" && currentPart?.partNumber === 2 && speakLeft === 0 && isRecording) stopRecordingRef.current();
  }, [phase, speakLeft, isRecording, currentPart]);

  const submitPart = async (blob: Blob) => {
    if (!userId) return;
    setPhase("GRADING");
    try {
      const formData = new FormData();
      formData.append("audio", blob, `part${currentPartNumber}.webm`);
      formData.append("userId", userId);
      formData.append("partNumber", String(currentPartNumber));
      const res = await fetch(`${API}/api/ielts-attempts/tests/${testId}/speaking/submit-part`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) { Swal.fire("Lỗi", data.error || "Không thể chấm phần này", "error"); setPhase("INTRO"); return; }
      setFeedbackByPart((prev) => ({ ...prev, [currentPartNumber]: data.partFeedback }));
      if (data.attempt.overallBand !== null && data.attempt.overallBand !== undefined) {
        setFinalResult(data.attempt);
      }
      setPhase("DONE");
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể xử lý ghi âm này", "error");
      setPhase("INTRO");
    }
  };

  const goToNextPart = () => {
    const next = currentPartNumber + 1;
    if (parts.find((p) => p.partNumber === next)) {
      setCurrentPartNumber(next);
      setPhase("INTRO");
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-primary font-bold animate-pulse">Đang tải...</div>;
  if (!parts.length) return <div className="min-h-screen flex items-center justify-center text-muted italic">Đề này chưa có nội dung Speaking.</div>;

  if (finalResult) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-10 text-center space-y-6">
          <div className="ui-hero px-6 py-10 shadow-card flex flex-col sm:flex-row items-center gap-6">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Kết quả Speaking</p>
              <p className="text-6xl sm:text-7xl font-black text-white mt-2">{finalResult.overallBand?.toFixed(1)}</p>
            </div>
            <div className="w-full max-w-[200px] shrink-0">
              <img src="/images/illustrations/exam-result.svg" alt="Minh hoạ kết quả IELTS Speaking" width={800} height={600} loading="eager" className="w-full h-auto rounded-2xl bg-white/95 p-2" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/ielts" className="btn-primary px-5 py-2.5">← Về trang IELTS</Link>
            <button
              onClick={async () => { if (!pdfRef.current) return; setExportingPdf(true); try { await exportNodeToPDF(pdfRef.current, `ielts-speaking-${Date.now()}.pdf`); } catch { Swal.fire("Lỗi", "Không thể xuất PDF lúc này.", "error"); } finally { setExportingPdf(false); } }}
              disabled={exportingPdf}
              className="btn-outline px-5 py-2.5 cursor-pointer"
            >
              {exportingPdf ? "Đang xuất..." : "Xuất PDF"}
            </button>
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-16 space-y-6">
          {[1, 2, 3].map((n) => feedbackByPart[n] && <SpeakingFeedbackBlock key={n} partNumber={n} feedback={feedbackByPart[n]} />)}
        </div>

        <div style={{ position: "fixed", top: 0, left: "-9999px", zIndex: -1 }}>
          <SkillReportPDF
            ref={pdfRef}
            skillLabel="IELTS Speaking"
            skillIcon="🗣️"
            studentName={userName}
            practicedAt={new Date()}
            score={finalResult.overallBand}
            scoreScale="9"
            contextTitle="Bài thi Speaking 3 Part"
            overallComment={`Học viên đạt band tổng ${finalResult.overallBand?.toFixed(1)} cho Speaking.`}
            rubric={[1, 2, 3].flatMap((n) => {
              const fb = feedbackByPart[n];
              if (!fb) return [];
              return [
                { label: `Part ${n} — Fluency & Coherence`, band: fb.fluencyCoherence?.band, note: fb.fluencyCoherence?.comment || "" },
                { label: `Part ${n} — Lexical Resource`, band: fb.lexicalResource?.band, note: fb.lexicalResource?.comment || "" },
                { label: `Part ${n} — Grammatical Range & Accuracy`, band: fb.grammaticalRangeAccuracy?.band, note: fb.grammaticalRangeAccuracy?.comment || "" },
                { label: `Part ${n} — Pronunciation`, band: fb.pronunciation?.band, note: fb.pronunciation?.comment || "" }
              ] as SkillReportRubricItem[];
            })}
            suggestions={[]}
            transcriptTitle="Transcript"
            transcriptBody={[1, 2, 3].map((n) => finalResult[`part${n}Transcript`] ? `--- Part ${n} ---\n${finalResult[`part${n}Transcript`]}` : "").filter(Boolean).join("\n\n")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="bg-surface border-b border-line px-4 sm:px-6 py-2.5 flex items-center gap-3 flex-wrap shadow-[0_2px_10px_rgba(30,58,138,0.06)]">
        <h1 className="font-bold text-primary text-sm sm:text-base">IELTS Speaking</h1>
        <span className="ml-auto ui-badge text-sm px-3 py-1">Part {currentPartNumber}/3</span>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 space-y-6">
        {currentPart?.instructions && <p className="text-sm italic text-muted text-center">{currentPart.instructions}</p>}

        <div className="ui-card p-6 space-y-2">
          {(currentPart?.questions || []).map((line: string, i: number) => (
            <p key={i} className={line.startsWith("-") ? "text-sm text-muted ml-4" : "font-bold text-lg text-primary"}>{line}</p>
          ))}
        </div>

        {phase === "INTRO" && (
          <div className="text-center">
            {currentPart?.partNumber === 2 ? (
              <button onClick={startPrep} className="btn-primary px-6 py-3 cursor-pointer">
                Bắt đầu chuẩn bị ({currentPart.prepSeconds || 60}s)
              </button>
            ) : (
              <button onClick={startRecording} className="btn-primary px-6 py-3 cursor-pointer">
                🎙️ Bắt đầu ghi âm
              </button>
            )}
          </div>
        )}

        {phase === "PREP" && (
          <div className="text-center space-y-2">
            <p className="text-sm text-muted">Thời gian chuẩn bị</p>
            <p className="inline-flex items-center justify-center rounded-full bg-amber-50 text-amber-600 ring-1 ring-amber-200 px-8 py-3 text-5xl font-black font-mono">{prepLeft}s</p>
          </div>
        )}

        {phase === "RECORDING" && (
          <div className="text-center space-y-3">
            <p className="text-red-600 font-bold flex items-center justify-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" /> Đang ghi âm...</p>
            {currentPart?.partNumber === 2 && <p className="inline-flex items-center justify-center rounded-full bg-primary text-white px-6 py-2 text-3xl font-black font-mono">{speakLeft}s</p>}
            <button onClick={stopRecording} className="px-6 py-3 bg-red-500 text-white font-bold rounded-full hover:bg-red-600 transition-colors cursor-pointer">⏹ Dừng & Nộp</button>
          </div>
        )}

        {phase === "GRADING" && (
          <p className="text-center text-primary font-bold animate-pulse">Đang chấm điểm Part {currentPartNumber}...</p>
        )}

        {phase === "DONE" && feedbackByPart[currentPartNumber] && (
          <div className="space-y-4">
            <SpeakingFeedbackBlock partNumber={currentPartNumber} feedback={feedbackByPart[currentPartNumber]} />
            {parts.find((p) => p.partNumber === currentPartNumber + 1) ? (
              <div className="text-center">
                <button onClick={goToNextPart} className="btn-primary px-6 py-3 cursor-pointer">Tiếp tục Part {currentPartNumber + 1} →</button>
              </div>
            ) : (
              <p className="text-center text-sm text-muted italic">Đang tính điểm tổng...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SpeakingFeedbackBlock({ partNumber, feedback }: { partNumber: number; feedback: any }) {
  const criteria = [
    { key: "fluencyCoherence", label: "Fluency & Coherence" },
    { key: "lexicalResource", label: "Lexical Resource" },
    { key: "grammaticalRangeAccuracy", label: "Grammatical Range & Accuracy" },
    { key: "pronunciation", label: "Pronunciation" }
  ];
  return (
    <div className="ui-card p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-lg text-primary">Part {partNumber}</h3>
        <span className="inline-flex items-center rounded-full bg-primary text-white px-4 py-1 text-xl font-black">{feedback.overallBand?.toFixed(1)}</span>
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
