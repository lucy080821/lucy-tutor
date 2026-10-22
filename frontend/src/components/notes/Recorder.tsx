"use client";
// Đợt 2 — Ghi âm buổi học/cuộc họp → AI chép lời (Whisper) + sắp xếp thành ghi chú, mỗi ý có mốc thời gian
// bấm để nghe lại đúng đoạn. Ghi bằng MediaRecorder (cùng hạ tầng với /pronunciation), tối đa 30 phút ở 32kbps
// (~7MB) để vừa giới hạn 25MB/file của Whisper trên Groq.
import { useEffect, useMemo, useRef, useState } from "react";
import Swal from "sweetalert2";
import { Modal, Spinner } from "./ui";
import { aiApi, errMsg } from "./api";
import type { Attachment, Segment, Usage } from "./types";

const MAX_SECONDS = 30 * 60;
const MAX_BYTES = 24 * 1024 * 1024;
const STYLES = [["lecture", "Ghi chép bài giảng"], ["meeting", "Biên bản họp"], ["cornell", "Cornell (câu hỏi · ý chính · tóm tắt)"], ["outline", "Dàn ý theo thời gian"]] as const;
const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export type RecordResult = { attachment: Attachment; transcript: Segment[]; title: string; html: string };

export default function Recorder({ open, onClose, pageId, usage, onDone }: {
  open: boolean; onClose: () => void; pageId: string | null; usage: Usage; onDone: (r: RecordResult) => void;
}) {
  const [phase, setPhase] = useState<"idle" | "recording" | "ready" | "processing">("idle");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState("ghi-am.webm");
  const [style, setStyle] = useState<string>("lecture");
  const [language, setLanguage] = useState("");
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : ""), [blob]);

  const stopAll = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => () => stopAll(), []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  // Đang ghi mà đóng tab → cảnh báo mất bản ghi
  useEffect(() => {
    if (phase !== "recording") return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [phase]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        setBlob(new Blob(chunks, { type }));
        setFileName(type.includes("mp4") ? "ghi-am.m4a" : "ghi-am.webm");
        setPhase("ready");
        stopAll();
      };
      rec.start(1000);
      recRef.current = rec;
      setSeconds(0);
      setPhase("recording");
      timerRef.current = setInterval(() => setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) recRef.current?.stop();
        return s + 1;
      }), 1000);
    } catch {
      Swal.fire({ icon: "error", title: "Không mở được micro", text: "Hãy cho phép trình duyệt dùng micro (biểu tượng ổ khoá cạnh thanh địa chỉ) rồi thử lại." });
    }
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_BYTES) { Swal.fire({ icon: "error", text: "File ghi âm tối đa 24MB (khoảng 1 giờ ở chất lượng giọng nói)." }); return; }
    setBlob(f); setFileName(f.name); setPhase("ready");
  };

  const process = async () => {
    if (!blob) return;
    if (blob.size > MAX_BYTES) { Swal.fire({ icon: "error", text: "Bản ghi quá lớn (tối đa 24MB)." }); return; }
    setPhase("processing");
    try {
      const form = new FormData();
      form.append("audio", new File([blob], fileName, { type: blob.type || "audio/webm" }));
      form.append("style", style);
      if (language) form.append("language", language);
      if (pageId) form.append("pageId", pageId);
      const r = await aiApi<RecordResult>("/transcribe", { form });
      onDone(r);
      reset();
      onClose();
    } catch (err) {
      setPhase("ready");
      Swal.fire({ icon: "error", text: errMsg(err) });
    }
  };

  const reset = () => { setBlob(null); setSeconds(0); setPhase("idle"); };
  const close = () => {
    if (phase === "recording") { Swal.fire({ icon: "info", text: "Hãy bấm Dừng ghi trước khi đóng." }); return; }
    if (phase === "processing") return;
    reset(); onClose();
  };

  return (
    <Modal open={open} onClose={close} title="Ghi âm thành ghi chú">
      {phase === "processing" ? <Spinner label="Đang chép lời và sắp xếp ghi chú — bản ghi dài có thể mất 1–2 phút…" /> : (
        <div className="space-y-4">
          <p className="text-sm text-muted">Ghi âm buổi học hoặc cuộc họp. AI chép lời, tách thành ý chính, từ vựng, việc cần làm; bấm mốc thời gian để nghe lại đúng đoạn. Còn <b>{usage.AUDIO.left}/{usage.AUDIO.limit}</b> lượt hôm nay.</p>
          {phase === "idle" && (
            <div className="grid gap-2">
              <button type="button" onClick={start} disabled={!usage.AUDIO.left} className="btn-primary py-3 text-base">Bắt đầu ghi âm</button>
              <label className="btn-outline py-2.5 text-center cursor-pointer">
                Chọn file ghi âm có sẵn
                <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </label>
            </div>
          )}
          {phase === "recording" && (
            <div className="text-center space-y-3">
              <p className="flex items-center justify-center gap-2 text-3xl font-extrabold text-primary tabular-nums"><span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />{fmt(seconds)}</p>
              <p className="text-xs text-muted">Tối đa 30 phút — tự dừng khi hết giờ. Giữ tab này mở trong lúc ghi.</p>
              <button type="button" onClick={() => recRef.current?.stop()} className="btn-primary px-8 py-3">Dừng ghi</button>
            </div>
          )}
          {phase === "ready" && blob && (
            <div className="space-y-3">
              <audio controls src={url} className="w-full" />
              <label className="block"><span className="ui-label">Kiểu ghi chú</span>
                <select className="ui-input w-full" value={style} onChange={(e) => setStyle(e.target.value)}>{STYLES.map(([id, l]) => <option key={id} value={id}>{l}</option>)}</select>
              </label>
              <label className="block"><span className="ui-label">Ngôn ngữ nói chính</span>
                <select className="ui-input w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="">Tự nhận diện</option><option value="vi">Tiếng Việt</option><option value="en">Tiếng Anh</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={reset} className="btn-ghost py-2.5">Ghi lại</button>
                <button type="button" onClick={process} className="btn-primary py-2.5">Tạo ghi chú</button>
              </div>
              <p className="text-xs text-muted">File ghi âm được lưu kèm trang (tính vào dung lượng file đính kèm của bạn) để phát lại.</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
