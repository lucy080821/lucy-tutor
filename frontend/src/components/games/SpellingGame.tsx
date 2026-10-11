"use client";
import { useState } from "react";
import { GRADE3_VOCAB, poolFor, shuffle, speakEnglish, type UnitId } from "@/lib/games/grade3";
import { FallbackNote, GameHeader, GameResult, ProgressBar, SpeakButton, starsFromRatio, type GameProps } from "./GameKit";

const ROUNDS = 8;
// Chỉ lấy từ đơn (không dấu cách), đủ ngắn để xếp trên điện thoại
const SPELLABLE = GRADE3_VOCAB.filter((v) => !v.en.includes(" ") && v.en.length >= 2 && v.en.length <= 9);

type Tile = { id: number; ch: string };

function scramble(word: string): Tile[] {
  const tiles = word.split("").map((ch, id) => ({ id, ch }));
  for (let i = 0; i < 10; i++) {
    const s = shuffle(tiles);
    if (s.map((t) => t.ch).join("") !== word) return s;
  }
  return shuffle(tiles);
}

function makeSession(unit: UnitId | "ALL") {
  const { items, fellBack } = poolFor(SPELLABLE, unit, 4);
  return { words: shuffle(items).slice(0, ROUNDS), fellBack };
}

// Trò 2 — Ong Đánh Vần: nhìn hình/nghĩa, nghe từ, bấm chữ cái theo đúng thứ tự
export default function SpellingGame({ unit, onExit }: GameProps) {
  const [session, setSession] = useState(() => makeSession(unit as UnitId | "ALL"));
  const [idx, setIdx] = useState(0);
  const [tiles, setTiles] = useState<Tile[]>(() => scramble(session.words[0]?.en ?? ""));
  const [picked, setPicked] = useState<Tile[]>([]);
  const [status, setStatus] = useState<"PLAYING" | "WRONG" | "RIGHT" | "SKIPPED">("PLAYING");
  const [triedWrong, setTriedWrong] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const word = session.words[idx];

  // Nạp 1 từ mới: xáo chữ cái + xoá trạng thái của từ trước
  const loadWord = (en: string) => {
    setTiles(scramble(en));
    setPicked([]);
    setStatus("PLAYING");
    setTriedWrong(false);
  };

  const restart = () => {
    const s = makeSession(unit as UnitId | "ALL");
    setSession(s); setIdx(0); setScore(0); setCorrect(0); setFinished(false);
    loadWord(s.words[0]?.en ?? "");
  };

  const pick = (t: Tile) => {
    if (status === "RIGHT" || status === "SKIPPED") return;
    const next = [...picked, t];
    setPicked(next);
    setStatus("PLAYING");
    if (next.length === word.en.length) {
      if (next.map((x) => x.ch).join("") === word.en) {
        setStatus("RIGHT");
        setScore((s) => s + (triedWrong ? 5 : 10));
        setCorrect((c) => c + 1);
        speakEnglish(word.en);
      } else {
        setStatus("WRONG");
        setTriedWrong(true);
      }
    }
  };

  const unpick = (t: Tile) => {
    if (status === "RIGHT" || status === "SKIPPED") return;
    setPicked((p) => p.filter((x) => x.id !== t.id));
    setStatus("PLAYING");
  };

  const next = () => {
    if (idx + 1 >= session.words.length) { setFinished(true); return; }
    setIdx(idx + 1);
    loadWord(session.words[idx + 1].en);
  };

  if (finished) {
    return (
      <GameResult gameId="spelling" unit={unit} score={score} stars={starsFromRatio(correct / session.words.length)}
        summary={`Bạn đánh vần đúng ${correct}/${session.words.length} từ.`}
        onReplay={restart} onExit={onExit} />
    );
  }
  if (!word) return null;

  const pickedIds = new Set(picked.map((p) => p.id));
  const locked = status === "RIGHT" || status === "SKIPPED";

  return (
    <div>
      <GameHeader title="Ong Đánh Vần" progress={`Từ ${idx + 1}/${session.words.length}`} score={score} onExit={onExit} />
      <ProgressBar value={idx / session.words.length} />
      <FallbackNote show={session.fellBack} />

      <div className="ui-card p-6 sm:p-8 text-center">
        <div className="flex flex-col items-center gap-3 mb-6">
          {word.color ? (
            <span className="w-20 h-20 rounded-full border-2 border-line-strong" style={{ background: word.color }} />
          ) : word.pic ? (
            <span className="text-5xl sm:text-6xl font-extrabold text-primary leading-none">{word.pic}</span>
          ) : null}
          <p className="text-lg font-bold text-foreground">{word.vi}</p>
          <SpeakButton onClick={() => speakEnglish(word.en)} label="Nghe từ" />
        </div>

        {/* Ô chữ đã chọn — bấm để bỏ ra */}
        <div className={`flex flex-wrap justify-center gap-2 min-h-[56px] mb-6 ${status === "WRONG" ? "animate-pulse" : ""}`}>
          {word.en.split("").map((_, i) => {
            const t = picked[i];
            const color = status === "RIGHT" ? "border-emerald-400 bg-emerald-50 text-emerald-700"
              : status === "WRONG" ? "border-red-300 bg-red-50 text-red-700"
              : t ? "border-primary bg-primary-soft text-primary" : "border-dashed border-line-strong bg-surface";
            return (
              <button key={i} onClick={() => t && unpick(t)} disabled={!t || locked}
                className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl border-2 text-2xl font-extrabold flex items-center justify-center cursor-pointer ${color}`}>
                {status === "SKIPPED" ? word.en[i] : t?.ch ?? ""}
              </button>
            );
          })}
        </div>

        {/* Chữ cái để chọn */}
        {!locked && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {tiles.map((t) => (
              <button key={t.id} onClick={() => pick(t)} disabled={pickedIds.has(t.id)}
                className={`w-11 h-12 sm:w-12 sm:h-14 rounded-xl text-2xl font-extrabold transition-all cursor-pointer ${pickedIds.has(t.id) ? "bg-line text-transparent" : "bg-primary text-white hover:-translate-y-0.5 shadow-card"}`}>
                {t.ch}
              </button>
            ))}
          </div>
        )}

        {status === "WRONG" && <p className="text-red-700 font-semibold mb-4">✗ Chưa đúng rồi — bấm vào chữ để đổi lại nhé.</p>}
        {status === "RIGHT" && <p className="text-emerald-700 font-semibold mb-4">✓ Chính xác! <b>{word.en}</b> = {word.vi}</p>}
        {status === "SKIPPED" && <p className="text-muted font-semibold mb-4">Đáp án: <b className="text-primary">{word.en}</b></p>}

        <div className="flex flex-wrap justify-center gap-3">
          {locked ? (
            <button onClick={next} className="btn-primary px-6 py-2.5 cursor-pointer">{idx + 1 >= session.words.length ? "Xem kết quả" : "Từ tiếp theo"}</button>
          ) : (
            <>
              <button onClick={() => { setPicked([]); setStatus("PLAYING"); }} className="btn-outline px-5 py-2.5 cursor-pointer">Xếp lại</button>
              <button onClick={() => setStatus("SKIPPED")} className="btn-ghost px-5 py-2.5 cursor-pointer">Bỏ qua</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
