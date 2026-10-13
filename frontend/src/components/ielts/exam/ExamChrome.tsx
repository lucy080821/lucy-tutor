"use client";
import { useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { formatClock, useSplitRatio } from "./examHooks";

// Khung giao diện làm bài IELTS dùng chung cho Listening / Reading / Writing — mô phỏng giao diện
// thi IELTS trên máy tính: toàn màn hình, tab theo Part, chia đôi bài đọc | câu hỏi, thanh điều
// hướng câu ở đáy, chỉnh cỡ chữ, ẩn/hiện đồng hồ.

export type PartTab = { key: string; label: string; sub?: string };

// Khung toàn màn hình (che header chung của site, như phòng thi)
export function ExamFrame({ children, fontSize }: { children: ReactNode; fontSize?: number }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background text-foreground" style={fontSize ? { fontSize } : undefined}>
      {children}
    </div>
  );
}

export function ExamTopBar({ title, parts, activePart, onPart, timeLeft, font, onSubmit, submitting, submitLabel = "Nộp bài" }: {
  title: string;
  parts?: PartTab[];
  activePart?: string;
  onPart?: (key: string) => void;
  timeLeft: number;
  font?: { inc: () => void; dec: () => void; canInc: boolean; canDec: boolean };
  onSubmit: () => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [timerHidden, setTimerHidden] = useState(false);
  const urgent = timeLeft <= 300;
  // 5 phút cuối luôn hiện đồng hồ dù đã ẩn
  const showTimer = !timerHidden || urgent;

  return (
    <div className="shrink-0 bg-surface border-b border-line shadow-[0_2px_10px_rgba(30,58,138,0.06)] text-[15px]">
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 flex-wrap">
        <h1 className="font-bold text-primary text-sm sm:text-base whitespace-nowrap">{title}</h1>

        {parts && parts.length > 1 && (
          <div className="hidden md:flex items-center gap-1.5 ml-2" role="tablist">
            {parts.map((p) => (
              <button
                key={p.key}
                role="tab"
                aria-selected={activePart === p.key}
                onClick={() => onPart?.(p.key)}
                className={`ui-chip cursor-pointer ${activePart === p.key ? "ui-chip-active" : ""}`}
              >
                {p.label}{p.sub && <span className="ml-1.5 text-xs font-semibold opacity-75">{p.sub}</span>}
              </button>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {font && (
            <div className="flex items-center rounded-full border border-line-strong overflow-hidden" title="Cỡ chữ">
              <button onClick={font.dec} disabled={!font.canDec} aria-label="Giảm cỡ chữ" className="w-9 h-9 text-xs font-bold text-foreground hover:bg-primary-soft disabled:opacity-30 cursor-pointer">A−</button>
              <span className="w-px h-5 bg-line" />
              <button onClick={font.inc} disabled={!font.canInc} aria-label="Tăng cỡ chữ" className="w-9 h-9 text-base font-bold text-foreground hover:bg-primary-soft disabled:opacity-30 cursor-pointer">A+</button>
            </div>
          )}
          <button
            onClick={() => setTimerHidden((v) => !v)}
            title={timerHidden ? "Hiện đồng hồ" : "Ẩn đồng hồ"}
            className={`font-mono font-black text-base sm:text-lg px-3 sm:px-4 h-9 rounded-full cursor-pointer tabular-nums ${urgent ? "bg-red-50 text-red-700 ring-1 ring-red-300" : showTimer ? "bg-primary text-white" : "bg-primary-soft text-primary text-xs sm:text-xs font-bold font-sans"}`}
          >
            {showTimer ? formatClock(timeLeft) : "Hiện giờ"}
          </button>
          <button onClick={onSubmit} disabled={submitting} className="btn-primary px-4 sm:px-5 h-9 text-sm cursor-pointer whitespace-nowrap">
            {submitting ? "Đang nộp..." : submitLabel}
          </button>
        </div>
      </div>

      {parts && parts.length > 1 && (
        <div className="md:hidden flex gap-1.5 px-3 pb-2 overflow-x-auto" role="tablist">
          {parts.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={activePart === p.key}
              onClick={() => onPart?.(p.key)}
              className={`ui-chip shrink-0 cursor-pointer ${activePart === p.key ? "ui-chip-active" : ""}`}
            >
              {p.label}{p.sub && <span className="ml-1 text-xs font-semibold opacity-75">{p.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Màn hình trước khi bắt đầu — đồng hồ chỉ chạy khi học viên bấm bắt đầu; có bản nháp thì cho làm tiếp
export function ExamIntro({ title, durationMin, facts, tips, draft, onStart, onResume, children }: {
  title: string;
  durationMin: number;
  facts: string[];
  tips: string[];
  draft?: { timeLeft: number; answered: number; total?: number; summary?: string } | null;
  onStart: () => void;
  onResume?: () => void;
  children?: ReactNode;
}) {
  const expired = draft && draft.timeLeft <= 0;
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <Link href="/ielts" className="text-sm font-semibold text-primary hover:underline">← Về trang IELTS</Link>
        <div className="ui-card p-6 sm:p-8 mt-4 space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted">IELTS Cambridge</p>
            <h1 className="ui-page-title mt-1">{title}</h1>
            <div className="flex flex-wrap gap-2 mt-3">
              <span className="ui-badge">{durationMin} phút</span>
              {facts.map((f) => <span key={f} className="ui-badge">{f}</span>)}
            </div>
          </div>

          <ul className="space-y-2 text-sm text-foreground">
            {tips.map((t) => (
              <li key={t} className="flex gap-2.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />{t}</li>
            ))}
          </ul>

          {children}

          {draft && onResume ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-3">
              <p className="text-sm text-amber-900">
                {expired
                  ? <>Lần làm trước đã <b>hết giờ</b> nhưng chưa nộp ({draft.summary ?? <>{draft.answered}{draft.total ? `/${draft.total}` : ""} câu đã làm</>}, lưu trên máy này).</>
                  : <>Bạn có bài đang làm dở: <b>{draft.summary ?? <>{draft.answered}{draft.total ? `/${draft.total}` : ""} câu đã làm</>}</b>, còn <b>{formatClock(draft.timeLeft)}</b>.</>}
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={onResume} className="btn-primary px-5 py-2.5 text-sm cursor-pointer">{expired ? "Nộp bài đã làm" : "Làm tiếp"}</button>
                <button onClick={onStart} className="btn-outline px-5 py-2.5 text-sm cursor-pointer">Làm lại từ đầu</button>
              </div>
            </div>
          ) : (
            <button onClick={onStart} className="btn-primary w-full sm:w-auto px-8 py-3 cursor-pointer">Bắt đầu làm bài</button>
          )}
        </div>
      </div>
    </div>
  );
}

// Chia đôi màn hình: desktop kéo được thanh giữa; điện thoại chuyển bằng 2 tab.
// Cả 2 cột luôn được mount (chỉ ẩn bằng CSS) để không mất highlight / vị trí cuộn.
export type MobilePane = "left" | "right";

export function SplitPane({ left, right, leftLabel, rightLabel, mobileTab: controlledTab, onMobileTab }: {
  left: ReactNode; right: ReactNode; leftLabel: string; rightLabel: string;
  mobileTab?: MobilePane; onMobileTab?: (t: MobilePane) => void;
}) {
  const [ratio, setRatio] = useSplitRatio();
  const [ownTab, setOwnTab] = useState<MobilePane>("left");
  const mobileTab = controlledTab ?? ownTab;
  const setMobileTab = (t: MobilePane) => { setOwnTab(t); onMobileTab?.(t); };
  const boxRef = useRef<HTMLDivElement>(null);

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    const box = boxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const move = (ev: PointerEvent) => setRatio(((ev.clientX - rect.left) / rect.width) * 100);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
    };
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="lg:hidden shrink-0 grid grid-cols-2 gap-1 p-1.5 mx-3 mt-2 rounded-full bg-primary-soft text-sm">
        {(["left", "right"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setMobileTab(k)}
            className={`py-2 rounded-full font-bold cursor-pointer ${mobileTab === k ? "bg-surface text-primary shadow-card" : "text-muted"}`}
          >
            {k === "left" ? leftLabel : rightLabel}
          </button>
        ))}
      </div>
      <div ref={boxRef} className="flex-1 min-h-0 flex" style={{ ["--split" as string]: `${ratio}%` }}>
        <div className={`${mobileTab === "left" ? "flex" : "hidden"} lg:flex flex-col min-w-0 w-full lg:w-[var(--split)] lg:shrink-0`}>
          {left}
        </div>
        <div
          onPointerDown={startDrag}
          onDoubleClick={() => setRatio(50)}
          title="Kéo để đổi độ rộng (bấm đúp: chia đều)"
          className="hidden lg:flex w-3 shrink-0 cursor-col-resize items-center justify-center group"
        >
          <div className="w-1 h-14 rounded-full bg-line-strong group-hover:bg-primary transition-colors" />
        </div>
        <div className={`${mobileTab === "right" ? "flex" : "hidden"} lg:flex flex-col min-w-0 flex-1`}>
          {right}
        </div>
      </div>
    </div>
  );
}

export type NavPart = { key: string; label: string; numbers: number[] };

// Thanh điều hướng câu ở đáy: Part đang mở hiện đủ ô số, Part khác thu gọn "đã làm x/y".
export function QuestionNavigator({ parts, activePart, answered, flags, current, onJump }: {
  parts: NavPart[];
  activePart: string;
  answered: (n: number) => boolean;
  flags: number[];
  current: number | null;
  onJump: (n: number) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const all = parts.flatMap((p) => p.numbers);
  const doneCount = all.filter(answered).length;
  const idx = current != null ? all.indexOf(current) : -1;
  const go = (d: 1 | -1) => {
    const n = all[Math.max(0, Math.min(all.length - 1, (idx < 0 ? (d === 1 ? -1 : all.length) : idx) + d))];
    if (n != null) onJump(n);
  };

  const cell = (n: number, big = false) => {
    const done = answered(n);
    const flagged = flags.includes(n);
    const isCur = current === n;
    return (
      <button
        key={n}
        onClick={() => { onJump(n); setSheetOpen(false); }}
        aria-label={`Câu ${n}${done ? ", đã làm" : ", chưa làm"}${flagged ? ", đánh dấu xem lại" : ""}`}
        className={`relative shrink-0 ${big ? "w-11 h-11" : "w-8 h-8"} rounded-lg text-xs font-bold tabular-nums cursor-pointer transition-colors border
          ${done ? "bg-primary text-white border-primary" : "bg-surface text-foreground border-line-strong hover:border-primary"}
          ${isCur ? "ring-2 ring-offset-1 ring-highlight" : ""}`}
      >
        {n}
        {flagged && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 border-2 border-surface" />}
      </button>
    );
  };

  const legend = (
    <div className="flex items-center gap-3 text-[11px] text-muted whitespace-nowrap">
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary" />Đã làm</span>
      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-line-strong bg-surface" />Chưa làm</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Xem lại</span>
    </div>
  );

  return (
    <>
      <div className="shrink-0 bg-surface border-t border-line text-[15px]">
        {/* Desktop */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2">
          <div className="flex-1 min-w-0 flex items-center gap-3 overflow-x-auto py-1">
            {parts.map((p) => {
              const done = p.numbers.filter(answered).length;
              if (p.key === activePart) {
                return (
                  <div key={p.key} className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-primary mr-1 whitespace-nowrap">{p.label}</span>
                    {p.numbers.map((n) => cell(n))}
                  </div>
                );
              }
              return (
                <button key={p.key} onClick={() => p.numbers[0] != null && onJump(p.numbers[0])} className="shrink-0 px-3 h-8 rounded-lg border border-line text-xs font-semibold text-muted hover:border-primary hover:text-primary cursor-pointer whitespace-nowrap">
                  {p.label}: {done}/{p.numbers.length}
                </button>
              );
            })}
          </div>
          {legend}
          <div className="flex items-center gap-1">
            <button onClick={() => go(-1)} aria-label="Câu trước" className="w-9 h-9 rounded-full border border-line-strong text-primary font-bold hover:bg-primary-soft cursor-pointer">←</button>
            <button onClick={() => go(1)} aria-label="Câu sau" className="w-9 h-9 rounded-full bg-primary text-white font-bold hover:opacity-90 cursor-pointer">→</button>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden flex items-center gap-2 px-3 py-2">
          <button onClick={() => go(-1)} aria-label="Câu trước" className="w-10 h-10 rounded-full border border-line-strong text-primary font-bold cursor-pointer">←</button>
          <button onClick={() => setSheetOpen(true)} className="flex-1 h-10 rounded-full bg-primary-soft text-primary text-sm font-bold cursor-pointer">
            {current != null ? `Câu ${current} · ` : ""}Đã làm {doneCount}/{all.length} ▴
          </button>
          <button onClick={() => go(1)} aria-label="Câu sau" className="w-10 h-10 rounded-full bg-primary text-white font-bold cursor-pointer">→</button>
        </div>
      </div>

      {sheetOpen && (
        <div className="md:hidden fixed inset-0 z-[70] bg-black/40 flex items-end" onClick={() => setSheetOpen(false)}>
          <div className="w-full max-h-[75vh] overflow-y-auto bg-surface rounded-t-3xl p-4 space-y-4 text-[15px]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-primary">Danh sách câu hỏi</p>
              <button onClick={() => setSheetOpen(false)} aria-label="Đóng" className="w-9 h-9 rounded-full hover:bg-primary-soft text-xl cursor-pointer">×</button>
            </div>
            {legend}
            {parts.map((p) => (
              <div key={p.key}>
                <p className="text-xs font-bold text-muted mb-2">{p.label} · {p.numbers.filter(answered).length}/{p.numbers.length}</p>
                <div className="flex flex-wrap gap-2">{p.numbers.map((n) => cell(n, true))}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// Cuộn tới câu hỏi + đặt con trỏ vào ô trả lời đầu tiên của câu đó
// (chờ 1 nhịp để Part chứa câu đó kịp hiện ra khi vừa chuyển tab)
export function focusQuestion(n: number) {
  setTimeout(() => {
    const el = document.getElementById(`q-${n}`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const input = el.querySelector<HTMLElement>("input, select, button[data-answer]");
    input?.focus({ preventScroll: true });
  }, 30);
}
