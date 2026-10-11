"use client";
import { useEffect, useState } from "react";
import { getBestScore, saveBestScore } from "@/lib/games/grade3";

export type GameProps = { unit: string; onExit: () => void };

/** Thanh trên cùng của mỗi trò chơi: nút quay lại, tên trò chơi, tiến độ, điểm */
export function GameHeader({ title, progress, score, onExit, extra }: {
  title: string;
  progress?: string;
  score: number;
  onExit: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <button onClick={onExit} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-line-strong text-muted hover:border-primary hover:text-primary hover:bg-primary-soft transition-colors cursor-pointer" aria-label="Quay lại danh sách trò chơi">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
      </button>
      <h2 className="text-xl sm:text-2xl font-extrabold text-primary flex-1 min-w-0">{title}</h2>
      {extra}
      {progress && <span className="ui-badge">{progress}</span>}
      <span className="px-3 py-1.5 rounded-full bg-highlight/15 text-[#b45309] font-bold text-sm">Điểm: {score}</span>
    </div>
  );
}

/** Thanh tiến độ mảnh dưới header */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-2 rounded-full bg-line overflow-hidden mb-6">
      <div className="h-full bg-primary transition-all duration-300" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-12 h-12 sm:w-14 sm:h-14 ${on ? "text-highlight" : "text-line-strong"}`} fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" />
    </svg>
  );
}

/** Màn kết quả chung: số sao, điểm, kỷ lục (lưu trên trình duyệt), chơi lại */
export function GameResult({ gameId, unit, score, stars, summary, onReplay, onExit }: {
  gameId: string;
  unit: string;
  score: number;
  stars: 0 | 1 | 2 | 3;
  summary: string;
  onReplay: () => void;
  onExit: () => void;
}) {
  // Đọc kỷ lục cũ 1 lần lúc mở màn kết quả (trước khi effect ghi đè)
  const [prev] = useState(() => getBestScore(gameId, unit));
  const best = Math.max(prev, score);
  const isRecord = prev > 0 && score > prev;

  useEffect(() => {
    saveBestScore(gameId, unit, score);
    if (stars === 3) {
      import("canvas-confetti").then((m) => m.default({ particleCount: 150, spread: 80, origin: { y: 0.6 } })).catch(() => {});
    }
  }, [gameId, unit, score, stars]);

  const message = stars === 3 ? "Xuất sắc!" : stars === 2 ? "Giỏi lắm!" : stars === 1 ? "Cố lên nhé!" : "Thử lại nào!";

  return (
    <div className="ui-card p-6 sm:p-10 text-center max-w-xl mx-auto">
      <div className="flex justify-center gap-2 mb-3" aria-label={`${stars} trên 3 sao`}>
        {[1, 2, 3].map((i) => <Star key={i} on={stars >= i} />)}
      </div>
      <h2 className="text-3xl font-extrabold text-primary mb-1">{message}</h2>
      <p className="text-muted mb-6">{summary}</p>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-primary-soft p-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">Điểm lần này</p>
          <p className="text-3xl font-extrabold text-primary">{score}</p>
        </div>
        <div className="rounded-2xl bg-highlight/15 p-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">Kỷ lục</p>
          <p className="text-3xl font-extrabold text-[#b45309]">{best}</p>
        </div>
      </div>
      {isRecord && <p className="ui-badge-new inline-block mb-5">Kỷ lục mới!</p>}
      <div className="flex flex-wrap justify-center gap-3">
        <button onClick={onReplay} className="btn-primary px-6 py-2.5 cursor-pointer">Chơi lại</button>
        <button onClick={onExit} className="btn-outline px-6 py-2.5 cursor-pointer">Chọn trò khác</button>
      </div>
    </div>
  );
}

/** Ghi chú khi unit đang chọn không đủ dữ liệu cho trò chơi này */
export function FallbackNote({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="text-sm bg-amber-50 text-amber-800 border border-amber-200 rounded-xl px-4 py-2 mb-5">
      Unit đang chọn chưa đủ từ cho trò chơi này nên Lucy trộn thêm từ của các unit khác.
    </p>
  );
}

/** Nút loa đọc to tiếng Anh */
export function SpeakButton({ onClick, label = "Nghe", big = false }: { onClick: () => void; label?: string; big?: boolean }) {
  return (
    <button onClick={onClick} className={`btn-outline inline-flex items-center gap-2 cursor-pointer ${big ? "px-6 py-3 text-lg" : "px-4 py-2 text-sm"}`} aria-label={label}>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={big ? "w-6 h-6" : "w-4 h-4"} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M15.5 8.5a5 5 0 010 7" /><path d="M19 5a10 10 0 010 14" />
      </svg>
      {label}
    </button>
  );
}

export function starsFromRatio(ratio: number): 0 | 1 | 2 | 3 {
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.6) return 2;
  if (ratio > 0) return 1;
  return 0;
}
