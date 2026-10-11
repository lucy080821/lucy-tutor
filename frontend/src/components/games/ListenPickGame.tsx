"use client";
import { useState } from "react";
import { GRADE3_VOCAB, poolFor, shuffle, speakEnglish, type UnitId, type VocabItem } from "@/lib/games/grade3";
import { FallbackNote, GameHeader, GameResult, ProgressBar, SpeakButton, starsFromRatio, type GameProps } from "./GameKit";

const ROUNDS = 10;
// Chỉ những từ vẽ được bằng hình (số, emoji) hoặc ô màu
const PICTURED = GRADE3_VOCAB.filter((v) => v.pic || v.color);

type Round = { target: VocabItem; options: VocabItem[] };

function buildRounds(unit: UnitId | "ALL") {
  const { items, fellBack } = poolFor(PICTURED, unit, 4);
  const targets = shuffle(items).slice(0, Math.min(ROUNDS, items.length));
  const rounds: Round[] = targets.map((target) => {
    const distractors = shuffle(items.filter((v) => v.en !== target.en)).slice(0, 3);
    return { target, options: shuffle([target, ...distractors]) };
  });
  return { rounds, fellBack };
}

function Picture({ v, size }: { v: VocabItem; size: "lg" | "md" }) {
  if (v.color) {
    return <span className={`block rounded-full border-2 border-line-strong ${size === "lg" ? "w-16 h-16 sm:w-20 sm:h-20" : "w-12 h-12"}`} style={{ background: v.color }} />;
  }
  return <span className={`font-extrabold text-primary leading-none ${size === "lg" ? "text-5xl sm:text-6xl" : "text-4xl"}`}>{v.pic}</span>;
}

// Trò 5 — Nghe Và Chọn: nghe từ tiếng Anh rồi chọn đúng hình (số, màu, bộ phận cơ thể, đồ dùng...)
export default function ListenPickGame({ unit, onExit }: GameProps) {
  const [session, setSession] = useState(() => buildRounds(unit as UnitId | "ALL"));
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const current = session.rounds[idx];

  // Lần phát đầu tiên phải nằm trong 1 thao tác bấm (trình duyệt chặn tự phát âm thanh)
  const begin = () => { setStarted(true); speakEnglish(session.rounds[0].target.en); };
  const restart = () => { setSession(buildRounds(unit as UnitId | "ALL")); setIdx(0); setScore(0); setCorrect(0); setChosen(null); setFinished(false); setStarted(false); };

  const choose = (v: VocabItem) => {
    if (chosen) return;
    setChosen(v.en);
    if (v.en === current.target.en) {
      setScore((s) => s + 10);
      setCorrect((c) => c + 1);
    }
  };

  const next = () => {
    if (idx + 1 >= session.rounds.length) { setFinished(true); return; }
    setChosen(null);
    setIdx(idx + 1);
    speakEnglish(session.rounds[idx + 1].target.en);
  };

  if (finished) {
    return (
      <GameResult gameId="listen" unit={unit} score={score} stars={starsFromRatio(correct / session.rounds.length)}
        summary={`Bạn nghe và chọn đúng ${correct}/${session.rounds.length} từ.`}
        onReplay={restart} onExit={onExit} />
    );
  }

  if (!started) {
    return (
      <div>
        <GameHeader title="Nghe Và Chọn" score={0} onExit={onExit} />
        <FallbackNote show={session.fellBack} />
        <div className="ui-card p-8 text-center max-w-xl mx-auto">
          <p className="text-foreground mb-2">Lucy sẽ đọc một từ tiếng Anh. Hãy chọn đúng hình của từ đó.</p>
          <p className="text-muted text-sm mb-6">Nhớ bật loa nhé! Có thể bấm &ldquo;Nghe lại&rdquo; bao nhiêu lần cũng được.</p>
          <button onClick={begin} className="btn-primary px-8 py-3 text-lg cursor-pointer">Bắt đầu</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <GameHeader title="Nghe Và Chọn" progress={`Câu ${idx + 1}/${session.rounds.length}`} score={score} onExit={onExit} />
      <ProgressBar value={idx / session.rounds.length} />

      <div className="ui-card p-6 sm:p-8">
        <div className="flex justify-center mb-6">
          <SpeakButton big onClick={() => speakEnglish(current.target.en)} label="Nghe lại" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {current.options.map((v) => {
            const isTarget = v.en === current.target.en;
            const state = !chosen ? "border-line-strong hover:border-primary hover:bg-primary-soft"
              : isTarget ? "border-emerald-400 bg-emerald-50"
              : v.en === chosen ? "border-red-300 bg-red-50" : "border-line opacity-60";
            return (
              <button key={v.en} onClick={() => choose(v)} disabled={!!chosen}
                className={`rounded-2xl border-2 bg-surface min-h-[120px] sm:min-h-[150px] flex flex-col items-center justify-center gap-2 p-3 transition-all cursor-pointer ${state}`}>
                <Picture v={v} size="lg" />
                {chosen && <span className={`font-bold ${isTarget ? "text-emerald-700" : "text-muted"}`}>{v.en}</span>}
              </button>
            );
          })}
        </div>

        {chosen && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <p className={`font-semibold ${chosen === current.target.en ? "text-emerald-700" : "text-red-700"}`}>
              {chosen === current.target.en ? "✓ Chính xác!" : "✗ Chưa đúng."} <b>{current.target.en}</b> = {current.target.vi}
            </p>
            <button onClick={next} className="btn-primary px-6 py-2.5 cursor-pointer">{idx + 1 >= session.rounds.length ? "Xem kết quả" : "Câu tiếp theo"}</button>
          </div>
        )}
      </div>
    </div>
  );
}
