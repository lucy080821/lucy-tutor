"use client";
// Đợt 2 — Chụp vở / bảng: ảnh nén ở trình duyệt → tải lên làm file đính kèm → OCR bằng tesseract.js ngay trên máy
// (tiếng Việt + tiếng Anh, không tốn chi phí server) → AI sửa lỗi nhận dạng và trình bày lại thành trang sạch.
// Chữ OCR được lưu vào file đính kèm nên tìm kiếm thấy cả chữ trong ảnh.
import { useState } from "react";
import Swal from "sweetalert2";
import { Modal, Spinner, safeHtml } from "./ui";
import { aiApi, notesApi, errMsg } from "./api";
import type { Attachment } from "./types";

/** Thu nhỏ ảnh (cạnh dài ≤ 2000px) và nén WebP để không tốn dung lượng/egress lưu trữ. */
export async function compressImage(file: File, max = 2000, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 400_000) return file;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: "image/webp" });
}

export default function OcrCapture({ open, onClose, upload, onInsert, aiLeft }: {
  open: boolean; onClose: () => void;
  upload: (file: File) => Promise<Attachment | null>;
  onInsert: (r: { image: Attachment | null; html: string; title?: string }) => void;
  aiLeft: number;
}) {
  const [stage, setStage] = useState<"pick" | "ocr" | "text" | "ai" | "preview">("pick");
  const [progress, setProgress] = useState(0);
  const [text, setText] = useState("");
  const [image, setImage] = useState<Attachment | null>(null);
  const [result, setResult] = useState<{ html: string; preview: string; title: string } | null>(null);

  const reset = () => { setStage("pick"); setText(""); setImage(null); setResult(null); setProgress(0); };
  const close = () => { if (stage === "ocr" || stage === "ai") return; reset(); onClose(); };

  const run = async (file: File | undefined) => {
    if (!file) return;
    setStage("ocr"); setProgress(0);
    try {
      const small = await compressImage(file);
      const [att, ocr] = await Promise.all([
        upload(small),
        (async () => {
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker(["vie", "eng"], 1, { logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") setProgress(Math.round(m.progress * 100)); } });
          try { return (await worker.recognize(small)).data.text; } finally { await worker.terminate(); }
        })(),
      ]);
      setImage(att);
      setText(ocr.trim());
      setStage("text");
      if (att && ocr.trim()) notesApi(`/attachments/${att.id}`, { method: "PATCH", body: { ocrText: ocr.trim() } }).catch(() => {});
    } catch (err) {
      setStage("pick");
      Swal.fire({ icon: "error", text: errMsg(err) || "Không đọc được ảnh" });
    }
  };

  const clean = async () => {
    setStage("ai");
    try {
      const r = await aiApi<{ title: string; html: string }>("/ocr-structure", { body: { text } });
      setResult({ ...r, preview: await safeHtml(r.html) });
      setStage("preview");
    } catch (err) { setStage("text"); Swal.fire({ icon: "error", text: errMsg(err) }); }
  };

  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const finish = (html: string, title?: string) => { onInsert({ image, html, title }); reset(); onClose(); };

  return (
    <Modal open={open} onClose={close} title="Chụp vở / bảng thành ghi chú" wide>
      {stage === "pick" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">Chụp trang vở, bảng trắng hoặc tài liệu in. Chữ được nhận dạng ngay trên máy bạn, rồi AI sửa lỗi nhận dạng (khôi phục dấu tiếng Việt) và trình bày lại thành trang ghi chú. Ảnh gốc được giữ trong trang.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="btn-primary py-3 text-center cursor-pointer">Chụp ảnh
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => run(e.target.files?.[0])} />
            </label>
            <label className="btn-outline py-3 text-center cursor-pointer">Chọn ảnh có sẵn
              <input type="file" accept="image/*" className="hidden" onChange={(e) => run(e.target.files?.[0])} />
            </label>
          </div>
          <p className="text-xs text-muted">Mẹo: chụp thẳng, đủ sáng, chữ chiếm gần hết khung hình. Chữ viết tay rất nghiêng/ẩu có thể nhận dạng sai.</p>
        </div>
      )}
      {stage === "ocr" && (
        <div>
          <Spinner label={progress ? `Đang nhận dạng chữ… ${progress}%` : "Đang tải bộ nhận dạng chữ (lần đầu mất vài giây)…"} />
          <div className="h-2 rounded-full bg-line overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} /></div>
        </div>
      )}
      {stage === "text" && (
        <div className="space-y-3">
          {image && <img src={image.url} alt="Ảnh vừa chụp" className="max-h-56 rounded-xl border border-line mx-auto" />}
          <label className="block"><span className="ui-label">Chữ nhận dạng được (sửa được)</span>
            <textarea className="ui-input w-full min-h-40 font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => finish(text.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join(""))} className="btn-outline py-2.5">Chèn chữ thô</button>
            <button type="button" onClick={clean} disabled={text.length < 5 || !aiLeft} className="btn-primary py-2.5">AI làm sạch thành trang</button>
          </div>
        </div>
      )}
      {stage === "ai" && <Spinner label="AI đang sửa lỗi nhận dạng và trình bày lại…" />}
      {stage === "preview" && result && (
        <div className="space-y-3">
          <p className="ui-label">{result.title}</p>
          <div className="rounded-xl border border-line p-3 max-h-96 overflow-y-auto note-content text-sm" dangerouslySetInnerHTML={{ __html: result.preview }} />
          <p className="text-xs text-muted">Chỗ AI không chắc chắn được tô vàng — hãy đối chiếu với ảnh gốc.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <button type="button" onClick={() => setStage("text")} className="btn-ghost py-2.5">Quay lại</button>
            <button type="button" onClick={() => finish(result.html, result.title)} className="btn-primary py-2.5">Chèn vào trang</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
