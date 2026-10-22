"use client";
import { useEffect, useRef, useState } from "react";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useNoteEditorCtx } from "./context";

const fmt = (s: number) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// Khối ghi âm trong trang: trình phát + bản chép lời bấm từng câu để nghe lại đúng đoạn đó
export default function AudioNoteView({ node, deleteNode }: ReactNodeViewProps) {
  const { attachments, editable } = useNoteEditorCtx();
  const id = node.attrs.attachmentId as string | null;
  const att = id ? attachments[id] : undefined;
  const segments = att?.transcript || [];
  const audioRef = useRef<HTMLAudioElement>(null);
  const [now, setNow] = useState(0);
  const [open, setOpen] = useState(false);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => setNow(a.currentTime);
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, []);

  const active = segments.findIndex((s, i) => now >= s.start && (i === segments.length - 1 || now < segments[i + 1].start));
  useEffect(() => { if (open) activeRef.current?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const play = (t: number) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = t;
    a.play().catch(() => {});
  };

  return (
    <NodeViewWrapper className="note-audio" data-audio-id={id || ""} contentEditable={false}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-primary truncate max-w-full">{node.attrs.name || "Ghi âm"}</span>
        {segments.length > 0 && (
          <button type="button" className="ui-chip text-xs ml-auto" onClick={() => setOpen((v) => !v)}>
            {open ? "Ẩn bản chép lời" : `Bản chép lời (${segments.length} đoạn)`}
          </button>
        )}
        {editable && (
          <button type="button" className="btn-ghost w-9 h-9 p-0 text-lg" title="Xoá khối ghi âm khỏi trang" aria-label="Xoá khối ghi âm" onClick={deleteNode}>×</button>
        )}
      </div>
      <audio ref={audioRef} controls preload="metadata" src={node.attrs.url || att?.url} className="w-full mt-2" />
      {open && (
        <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line bg-background p-2 space-y-0.5">
          {segments.map((s, i) => (
            <button key={i} ref={i === active ? activeRef : undefined} type="button" onClick={() => play(s.start)}
              className={`w-full text-left text-sm rounded-lg px-2 py-1.5 flex gap-2 ${i === active ? "bg-primary-soft text-primary" : "hover:bg-white"}`}>
              <span className="font-mono text-xs text-muted shrink-0 pt-0.5">{fmt(s.start)}</span>
              <span>{s.text}</span>
            </button>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
}
