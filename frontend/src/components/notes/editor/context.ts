"use client";
import { createContext, useContext } from "react";
import type { Attachment } from "../types";

// Dữ liệu trang cho các node view (khối ghi âm cần transcript lưu ở NoteAttachment, không nằm trong JSON trang)
export type NoteEditorCtx = { attachments: Record<string, Attachment>; editable: boolean };
export const NoteEditorContext = createContext<NoteEditorCtx>({ attachments: {}, editable: true });
export const useNoteEditorCtx = () => useContext(NoteEditorContext);

/** Phát file ghi âm trong trang từ mốc giây `t` (link "#t=…&a=<attachmentId>" do AI tạo). */
export function seekAudio(root: HTMLElement | null, attachmentId: string | null, t: number) {
  if (!root) return false;
  const sel = attachmentId ? `[data-audio-id="${CSS.escape(attachmentId)}"] audio` : "[data-audio-id] audio";
  const audio = root.querySelector<HTMLAudioElement>(sel) || root.querySelector<HTMLAudioElement>("[data-audio-id] audio");
  if (!audio) return false;
  audio.currentTime = t;
  audio.play().catch(() => {});
  audio.closest("[data-audio-id]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return true;
}
