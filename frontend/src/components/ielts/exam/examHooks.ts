"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";

// ── Bản nháp bài làm (localStorage) ──
// Lưu đáp án + câu đánh dấu + mốc giờ kết thúc ngay trên trình duyệt để tải lại trang / mất mạng /
// lỡ đóng tab không mất bài. Đồng hồ tính theo mốc `endAt` (không đếm lùi trong state) nên tải lại
// trang vẫn đúng thời gian còn lại. Xoá nháp sau khi nộp bài thành công.
export type ExamDraft<A> = { answers: A; flags: number[]; endAt: number; startedAt: number; extra?: Record<string, any> };

function readDraft<A>(key: string): ExamDraft<A> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return d && typeof d.endAt === "number" ? d : null;
  } catch { return null; }
}

export function useExamDraft<A>(key: string | null, initialAnswers: A, durationSec: number) {
  const [savedDraft, setSavedDraft] = useState<ExamDraft<A> | null>(null);
  const [checked, setChecked] = useState(false);
  const [running, setRunning] = useState(false);
  const [answers, setAnswers] = useState<A>(initialAnswers);
  const [flags, setFlags] = useState<number[]>([]);
  const [extra, setExtra] = useState<Record<string, any>>({});
  const [endAt, setEndAt] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const initialRef = useRef(initialAnswers);

  useEffect(() => {
    if (!key) return;
    setSavedDraft(readDraft<A>(key));
    setChecked(true);
  }, [key]);

  useEffect(() => {
    if (!key || !running) return;
    try { localStorage.setItem(key, JSON.stringify({ answers, flags, endAt, startedAt, extra })); } catch {}
  }, [key, running, answers, flags, endAt, startedAt, extra]);

  const startFresh = useCallback((extraInit: Record<string, any> = {}) => {
    const now = Date.now();
    setAnswers(initialRef.current);
    setFlags([]);
    setExtra(extraInit);
    setStartedAt(now);
    setEndAt(now + durationSec * 1000);
    setRunning(true);
  }, [durationSec]);

  const resume = useCallback(() => {
    if (!savedDraft) return;
    setAnswers(savedDraft.answers);
    setFlags(savedDraft.flags || []);
    setExtra(savedDraft.extra || {});
    setStartedAt(savedDraft.startedAt || Date.now());
    setEndAt(savedDraft.endAt);
    setRunning(true);
  }, [savedDraft]);

  const clear = useCallback(() => {
    if (key) { try { localStorage.removeItem(key); } catch {} }
    setSavedDraft(null);
  }, [key]);

  const toggleFlag = useCallback((n: number) => {
    setFlags((prev) => (prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]));
  }, []);

  return { checked, savedDraft, running, answers, setAnswers, flags, toggleFlag, extra, setExtra, endAt, startedAt, startFresh, resume, clear };
}

// ── Đồng hồ đếm ngược theo mốc giờ kết thúc + nhắc giờ ở mốc 10 và 5 phút ──
const WARN_AT = [600, 300];

export function useCountdown(endAt: number, active: boolean, onExpire: () => void) {
  const calc = useCallback(() => Math.max(0, Math.ceil((endAt - Date.now()) / 1000)), [endAt]);
  const [timeLeft, setTimeLeft] = useState(() => (endAt ? calc() : 0));
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !endAt) return;
    prevRef.current = null;
    let fired = false;
    const tick = () => {
      const t = calc();
      setTimeLeft(t);
      const prev = prevRef.current;
      // Chỉ nhắc khi đồng hồ vừa đi qua mốc (khôi phục bài làm dở đã dưới mốc thì không nhắc lại)
      if (prev !== null) {
        WARN_AT.forEach((w) => {
          if (prev > w && t <= w && t > 0) {
            Swal.fire({ toast: true, position: "top", icon: "warning", title: `Còn ${w / 60} phút`, timer: 4000, showConfirmButton: false });
          }
        });
      }
      prevRef.current = t;
      if (t <= 0 && !fired) { fired = true; expireRef.current(); }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, endAt, calc]);

  return timeLeft;
}

export function formatClock(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Cỡ chữ vùng đề bài (nhớ theo trình duyệt) ──
const FONT_STEPS = [14, 16, 18, 20, 22];
const FONT_KEY = "lucy_ielts_font";

export function useFontScale() {
  const [size, setSize] = useState(16);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(FONT_KEY));
      if (FONT_STEPS.includes(v)) setSize(v);
    } catch {}
  }, []);
  const step = useCallback((dir: 1 | -1) => {
    setSize((cur) => {
      const i = Math.max(0, Math.min(FONT_STEPS.length - 1, FONT_STEPS.indexOf(cur) + dir));
      const next = FONT_STEPS[i];
      try { localStorage.setItem(FONT_KEY, String(next)); } catch {}
      return next;
    });
  }, []);
  return { size, inc: () => step(1), dec: () => step(-1), canInc: size < FONT_STEPS[FONT_STEPS.length - 1], canDec: size > FONT_STEPS[0] };
}

// ── Tỉ lệ chia đôi màn hình (bài đọc | câu hỏi) ──
const SPLIT_KEY = "lucy_ielts_split";

export function useSplitRatio() {
  const [ratio, setRatio] = useState(50);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(SPLIT_KEY));
      if (v >= 25 && v <= 75) setRatio(v);
    } catch {}
  }, []);
  const update = useCallback((v: number) => {
    const clamped = Math.max(25, Math.min(75, v));
    setRatio(clamped);
    try { localStorage.setItem(SPLIT_KEY, String(Math.round(clamped))); } catch {}
  }, []);
  return [ratio, update] as const;
}

export function isAnswered(v: unknown) {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

// Hỏi xác nhận trước khi nộp — liệt kê câu còn trống / đang đánh dấu xem lại
export async function confirmSubmit({ unanswered, flagged, total, unit = "câu" }: { unanswered: (number | string)[]; flagged?: number[]; total: number; unit?: string }) {
  const lines: string[] = [];
  if (unanswered.length) {
    const list = unanswered.slice(0, 15).join(", ") + (unanswered.length > 15 ? "…" : "");
    lines.push(`<p style="margin:0 0 8px"><b style="color:#b91c1c">Còn ${unanswered.length}/${total} ${unit} chưa làm:</b> ${list}</p>`);
  }
  if (flagged && flagged.length) {
    lines.push(`<p style="margin:0 0 8px"><b style="color:#b45309">Đang đánh dấu xem lại:</b> ${flagged.sort((a, b) => a - b).join(", ")}</p>`);
  }
  lines.push(`<p style="margin:0">Sau khi nộp sẽ không sửa được nữa.</p>`);
  const r = await Swal.fire({
    title: unanswered.length ? "Nộp bài khi chưa làm hết?" : "Nộp bài?",
    html: lines.join(""),
    icon: unanswered.length ? "warning" : "question",
    showCancelButton: true,
    confirmButtonText: "Nộp bài",
    cancelButtonText: "Làm tiếp",
    reverseButtons: true,
    focusCancel: true,
  });
  return r.isConfirmed;
}
