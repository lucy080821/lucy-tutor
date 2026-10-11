"use client";
import { useEffect, useRef, useState } from "react";
import { GRADE3_QUIZ, poolFor, shuffle, type QuizItem, type UnitId } from "@/lib/games/grade3";
import { FallbackNote, GameHeader, GameResult, type GameProps } from "./GameKit";

const DURATION = 60;

type Shown = { item: QuizItem; options: string[] };

const prepare = (item: QuizItem): Shown => ({ item, options: shuffle(item.options) });

// Trò 4 — Đua Với Thời Gian: trả lời càng nhiều câu trắc nghiệm càng tốt trong 60 giây, đúng liên tiếp được thưởng combo
export default function QuizRaceGame({ unit, onExit }: GameProps) {
  const [{ items, fellBack }] = useState(() => poolFor(GRADE3_QUIZ, unit as UnitId | "ALL", 4));
  const [stage, setStage] = useState<"READY" | "PLAYING" | "DONE">("READY");
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [current, setCurrent] = useState<Shown | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });
  const queue = useRef<QuizItem[]>([]);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draw = (): Shown => {
    if (queue.current.length === 0) queue.current = shuffle(items);
    return prepare(queue.current.pop()!);
  };

  const start = () => {
    queue.current = [];
    setScore(0); setCombo(0); setStats({ right: 0, wrong: 0 });
    setTimeLeft(DURATION); setChosen(null);
    setCurrent(draw());
    setStage("PLAYING");
  };

  useEffect(() => {
    if (stage !== "PLAYING") return;
    const endAt = Date.now() + DURATION * 1000;
    const t = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(t);
        if (nextTimer.current) clearTimeout(nextTimer.current);
        setStage("DONE");
      }
    }, 250);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => () => { if (nextTimer.current) clearTimeout(nextTimer.current); }, []);

  const answer = (opt: string) => {
    if (!current || chosen) return;
    setChosen(opt);
    const ok = opt === current.item.options[0];
    if (ok) {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setScore((s) => s + 10 + (nextCombo >= 3 ? 5 : 0));
      setStats((st) => ({ ...st, right: st.right + 1 }));
    } else {
      setCombo(0);
      setStats((st) => ({ ...st, wrong: st.wrong + 1 }));
    }
    nextTimer.current = setTimeout(() => { setChosen(null); setCurrent(draw()); }, ok ? 600 : 1600);
  };

  if (stage === "DONE") {
    const stars = stats.right >= 10 ? 3 : stats.right >= 6 ? 2 : stats.right >= 1 ? 1 : 0;
    return (
      <GameResult gameId="quizrace" unit={unit} score={score} stars={stars}
        summary={`Trong ${DURATION} giây bạn trả lời đúng ${stats.right} câu, sai ${stats.wrong} câu.`}
        onReplay={start} onExit={onExit} />
    );
  }

  if (stage === "READY") {
    return (
      <div>
        <GameHeader title="Đua Với Thời Gian" score={0} onExit={onExit} />
        <FallbackNote show={fellBack} />
        <div className="ui-card p-8 text-center max-w-xl mx-auto">
          <p className="text-5xl font-extrabold text-primary mb-2">{DURATION}s</p>
          <p className="text-foreground mb-2">Trả lời càng nhiều câu càng tốt trước khi hết giờ.</p>
          <p className="text-muted text-sm mb-6">Mỗi câu đúng +10 điểm · Đúng liên tiếp từ 3 câu trở lên được thưởng thêm +5 mỗi câu.</p>
          <button onClick={start} className="btn-primary px-8 py-3 text-lg cursor-pointer">Bắt đầu</button>
        </div>
      </div>
    );
  }

  const ratio = timeLeft / DURATION;
  return (
    <div>
      <GameHeader title="Đua Với Thời Gian" score={score} onExit={onExit}
        extra={combo >= 3 ? <span className="ui-badge-new">Combo x{combo}</span> : null}
        progress={`${Math.max(0, timeLeft)}s`} />
      <div className="h-3 rounded-full bg-line overflow-hidden mb-6">
        <div className={`h-full transition-all duration-1000 ease-linear ${ratio > 0.3 ? "bg-primary" : "bg-red-500"}`} style={{ width: `${ratio * 100}%` }} />
      </div>

      {current && (
        <div className="ui-card p-6 sm:p-8">
          <p className="text-2xl sm:text-3xl font-extrabold text-foreground mb-6 text-center">{current.item.q}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {current.options.map((opt) => {
              const isRight = opt === current.item.options[0];
              const state = !chosen ? "bg-surface border-line-strong hover:border-primary hover:bg-primary-soft"
                : isRight ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                : opt === chosen ? "bg-red-50 border-red-300 text-red-700" : "bg-surface border-line opacity-60";
              return (
                <button key={opt} onClick={() => answer(opt)} disabled={!!chosen}
                  className={`rounded-2xl border-2 px-4 py-4 text-xl font-bold transition-all cursor-pointer ${state}`}>
                  {opt}
                </button>
              );
            })}
          </div>
          {chosen && chosen !== current.item.options[0] && (
            <p className="mt-5 text-center text-red-700 font-semibold">✗ Đáp án: {current.item.options[0]} — {current.item.explain}</p>
          )}
          {chosen && chosen === current.item.options[0] && (
            <p className="mt-5 text-center text-emerald-700 font-semibold">✓ Đúng rồi!</p>
          )}
        </div>
      )}
    </div>
  );
}
