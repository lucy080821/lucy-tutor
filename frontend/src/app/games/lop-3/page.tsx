"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getSessionUserId } from "@/lib/session";
import { GRADE3_UNITS, getBestScore } from "@/lib/games/grade3";
import MemoryMatchGame from "@/components/games/MemoryMatchGame";
import SpellingGame from "@/components/games/SpellingGame";
import SentenceBuilderGame from "@/components/games/SentenceBuilderGame";
import QuizRaceGame from "@/components/games/QuizRaceGame";
import ListenPickGame from "@/components/games/ListenPickGame";

type GameId = "memory" | "spelling" | "sentence" | "quizrace" | "listen";

const GAMES: { id: GameId; title: string; skill: string; description: string; thumb: string }[] = [
  { id: "memory", title: "Lật Thẻ Ghép Cặp", skill: "Từ vựng", description: "Lật thẻ, ghép từ tiếng Anh với nghĩa tiếng Việt. Càng ít lượt càng nhiều sao.", thumb: "vocabulary" },
  { id: "spelling", title: "Ong Đánh Vần", skill: "Chính tả", description: "Nhìn hình, nghe từ rồi xếp các chữ cái cho đúng thứ tự.", thumb: "writing" },
  { id: "sentence", title: "Xếp Câu Thần Tốc", skill: "Mẫu câu", description: "Sắp xếp các từ thành câu hoàn chỉnh theo mẫu câu của từng unit.", thumb: "grammar" },
  { id: "quizrace", title: "Đua Với Thời Gian", skill: "Ngữ pháp", description: "60 giây trả lời trắc nghiệm thật nhanh, đúng liên tiếp được thưởng combo.", thumb: "mock-test" },
  { id: "listen", title: "Nghe Và Chọn", skill: "Nghe", description: "Nghe Lucy đọc một từ rồi chọn đúng hình: số, màu sắc, bộ phận cơ thể, đồ dùng...", thumb: "listening" },
];

const UNIT_KEY = "lucy_game_g3_unit";

export default function Grade3GamesPage() {
  const [ready, setReady] = useState(false);
  // Trang công khai (không cần đăng nhập) — nút quay lại về dashboard nếu đã đăng nhập, ngược lại về trang chủ
  const [backHref, setBackHref] = useState("/");
  const [unit, setUnit] = useState<string>("ALL");
  const [game, setGame] = useState<GameId | null>(null);

  useEffect(() => {
    if (getSessionUserId()) setBackHref("/dashboard");
    let saved: string | null = null;
    try { saved = localStorage.getItem(UNIT_KEY); } catch { /* storage bị chặn */ }
    // Khôi phục unit đã chọn lần trước (localStorage chỉ đọc được sau khi mount)
    setUnit(saved && GRADE3_UNITS.some((u) => u.id === saved) ? saved : "ALL");
    setReady(true);
  }, []);

  const chooseUnit = (u: string) => {
    setUnit(u);
    try { localStorage.setItem(UNIT_KEY, u); } catch { /* storage bị chặn */ }
  };

  const openGame = (id: GameId) => {
    setGame(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Nội dung render ngay cả phía server (SEO); kỷ lục đọc từ localStorage nên chỉ tính sau khi đã mount (ready)
  const bests: Record<string, number> = game || !ready ? {} : Object.fromEntries(GAMES.map((g) => [g.id, getBestScore(g.id, unit)]));
  const unitLabel = unit === "ALL" ? "Tất cả các unit" : GRADE3_UNITS.find((u) => u.id === unit)?.label;
  const gameProps = { unit, onExit: () => setGame(null) };

  return (
    <div className="min-h-screen bg-background">
      {/* Page banner (IOT style) */}
      <div className="w-full bg-primary-soft border-b border-line">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 text-sm text-muted">
              <Link href={backHref} className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-line-strong text-muted hover:border-primary hover:text-primary hover:bg-surface transition-colors" aria-label="Quay lại">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <span>Trang chủ / Trò Chơi Học Tập / Tiếng Anh Lớp 3</span>
            </div>
            <h1 className="ui-page-title mt-3 text-2xl sm:text-3xl">Trò Chơi Tiếng Anh Lớp 3</h1>
            <p className="ui-page-subtitle">Vừa chơi vừa ôn từ vựng và mẫu câu Global Success 3, từ Starter đến Unit 9.</p>
          </div>
          <img src="/images/photos/app/games.webp" alt="Minh hoạ trò chơi học tiếng Anh" width={640} height={360} loading="eager" className="hidden md:block w-60 h-auto rounded-2xl border border-line shadow-card shrink-0" />
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {game ? (
          <>
            <p className="text-sm text-muted mb-3">Đang ôn: <b className="text-primary">{unitLabel}</b></p>
            {game === "memory" && <MemoryMatchGame key={unit} {...gameProps} />}
            {game === "spelling" && <SpellingGame key={unit} {...gameProps} />}
            {game === "sentence" && <SentenceBuilderGame key={unit} {...gameProps} />}
            {game === "quizrace" && <QuizRaceGame key={unit} {...gameProps} />}
            {game === "listen" && <ListenPickGame key={unit} {...gameProps} />}
          </>
        ) : (
          <>
            <h2 className="ui-section-title text-lg mb-4">Chọn bài muốn ôn</h2>
            <div className="flex flex-wrap gap-2 mb-8">
              <button onClick={() => chooseUnit("ALL")} className={`ui-chip cursor-pointer ${unit === "ALL" ? "ui-chip-active" : ""}`}>Tất cả</button>
              {GRADE3_UNITS.map((u) => (
                <button key={u.id} onClick={() => chooseUnit(u.id)} title={u.title}
                  className={`ui-chip cursor-pointer ${unit === u.id ? "ui-chip-active" : ""}`}>
                  {u.label}
                </button>
              ))}
            </div>
            {unit !== "ALL" && (
              <p className="text-sm text-muted -mt-5 mb-6">{GRADE3_UNITS.find((u) => u.id === unit)?.label}: <b className="text-foreground">{GRADE3_UNITS.find((u) => u.id === unit)?.title}</b></p>
            )}

            <h2 className="ui-section-title text-lg mb-4">5 trò chơi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {GAMES.map((g) => (
                <button key={g.id} onClick={() => openGame(g.id)} className="ui-card ui-card-hover overflow-hidden flex flex-col text-left group cursor-pointer">
                  <div className="aspect-video overflow-hidden bg-primary-soft">
                    <img src={`/images/photos/app/${g.thumb}.webp`} alt={`Ảnh minh hoạ trò chơi ${g.title}`} width={640} height={360} loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                  </div>
                  <div className="p-4 sm:p-5 flex flex-col flex-1 gap-2">
                    <span className="ui-badge self-start">{g.skill}</span>
                    <h3 className="font-bold text-primary text-lg leading-snug">{g.title}</h3>
                    <p className="text-sm text-muted flex-1">{g.description}</p>
                    <div className="flex items-center justify-between gap-2 mt-2">
                      <span className="btn-outline px-4 py-2 text-sm">Chơi ngay</span>
                      {bests[g.id] > 0 && <span className="text-xs font-semibold text-[#b45309]">Kỷ lục: {bests[g.id]}</span>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
