"use client";
import { useState } from "react";
import { GRADE3_SENTENCES, poolFor, shuffle, speakEnglish, type UnitId } from "@/lib/games/grade3";
import { FallbackNote, GameHeader, GameResult, ProgressBar, SpeakButton, starsFromRatio, type GameProps } from "./GameKit";

const ROUNDS = 6;

type Chip = { id: number; w: string };

function scramble(text: string): Chip[] {
  const chips = text.split(" ").map((w, id) => ({ id, w }));
  for (let i = 0; i < 10; i++) {
    const s = shuffle(chips);
    if (s.map((c) => c.w).join(" ") !== text) return s;
  }
  return shuffle(chips);
}

function makeSession(unit: UnitId | "ALL") {
  const { items, fellBack } = poolFor(GRADE3_SENTENCES, unit, 3);
  return { list: shuffle(items).slice(0, ROUNDS), fellBack };
}

// Trò 3 — Xếp Câu Thần Tốc: bấm các từ theo đúng thứ tự để tạo thành câu (dạng "Reorder the words")
export default function SentenceBuilderGame({ unit, onExit }: GameProps) {
  const [session, setSession] = useState(() => makeSession(unit as UnitId | "ALL"));
  const [idx, setIdx] = useState(0);
  const [chips, setChips] = useState<Chip[]>(() => scramble(session.list[0]?.text ?? ""));
  const [picked, setPicked] = useState<Chip[]>([]);
  const [status, setStatus] = useState<"PLAYING" | "WRONG" | "RIGHT" | "SKIPPED">("PLAYING");
  const [triedWrong, setTriedWrong] = useState(false);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const item = session.list[idx];

  // Nạp 1 câu mới: xáo từ + xoá trạng thái của câu trước
  const loadSentence = (text: string) => {
    setChips(scramble(text));
    setPicked([]);
    setStatus("PLAYING");
    setTriedWrong(false);
  };

  const restart = () => {
    const s = makeSession(unit as UnitId | "ALL");
    setSession(s); setIdx(0); setScore(0); setCorrect(0); setFinished(false);
    loadSentence(s.list[0]?.text ?? "");
  };

  const locked = status === "RIGHT" || status === "SKIPPED";
  const total = item ? item.text.split(" ").length : 0;

  const pick = (c: Chip) => {
    if (locked) return;
    const next = [...picked, c];
    setPicked(next);
    setStatus("PLAYING");
    if (next.length === total) {
      // So khớp theo chữ (không theo id) — câu có 2 từ giống nhau vẫn chấm đúng
      if (next.map((x) => x.w).join(" ") === item.text) {
        setStatus("RIGHT");
        setScore((s) => s + (triedWrong ? 5 : 10));
        setCorrect((n) => n + 1);
        speakEnglish(item.text);
      } else {
        setStatus("WRONG");
        setTriedWrong(true);
      }
    }
  };

  const unpick = (c: Chip) => {
    if (locked) return;
    setPicked((p) => p.filter((x) => x.id !== c.id));
    setStatus("PLAYING");
  };

  const next = () => {
    if (idx + 1 >= session.list.length) { setFinished(true); return; }
    setIdx(idx + 1);
    loadSentence(session.list[idx + 1].text);
  };

  if (finished) {
    return (
      <GameResult gameId="sentence" unit={unit} score={score} stars={starsFromRatio(correct / session.list.length)}
        summary={`Bạn xếp đúng ${correct}/${session.list.length} câu.`}
        onReplay={restart} onExit={onExit} />
    );
  }
  if (!item) return null;

  const pickedIds = new Set(picked.map((p) => p.id));

  return (
    <div>
      <GameHeader title="Xếp Câu Thần Tốc" progress={`Câu ${idx + 1}/${session.list.length}`} score={score} onExit={onExit} />
      <ProgressBar value={idx / session.list.length} />
      <FallbackNote show={session.fellBack} />

      <div className="ui-card p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="text-lg font-bold text-foreground">Nghĩa: <span className="text-primary">{item.vi}</span></p>
          {locked && <SpeakButton onClick={() => speakEnglish(item.text)} label="Nghe câu" />}
        </div>

        {/* Câu đang xếp — bấm vào từ để bỏ ra */}
        <div className={`min-h-[72px] rounded-2xl border-2 p-3 flex flex-wrap gap-2 mb-5
          ${status === "RIGHT" ? "border-emerald-300 bg-emerald-50" : status === "WRONG" ? "border-red-300 bg-red-50" : "border-dashed border-line-strong bg-background"}`}>
          {status === "SKIPPED" ? (
            <span className="text-xl font-bold text-primary px-2 py-1">{item.text}</span>
          ) : picked.length === 0 ? (
            <span className="text-muted self-center px-2">Bấm các từ bên dưới để xếp câu...</span>
          ) : picked.map((c) => (
            <button key={c.id} onClick={() => unpick(c)} disabled={locked}
              className="px-4 py-2 rounded-xl bg-surface border-2 border-primary text-primary text-lg font-bold cursor-pointer">
              {c.w}
            </button>
          ))}
        </div>

        {!locked && (
          <div className="flex flex-wrap gap-2 mb-6">
            {chips.map((c) => (
              <button key={c.id} onClick={() => pick(c)} disabled={pickedIds.has(c.id)}
                className={`px-4 py-2 rounded-xl text-lg font-bold transition-all cursor-pointer ${pickedIds.has(c.id) ? "bg-line text-transparent" : "bg-primary text-white shadow-card hover:-translate-y-0.5"}`}>
                {c.w}
              </button>
            ))}
          </div>
        )}

        {status === "WRONG" && <p className="text-red-700 font-semibold mb-4">✗ Thứ tự chưa đúng — bấm vào từ ở trên để sửa nhé.</p>}
        {status === "RIGHT" && <p className="text-emerald-700 font-semibold mb-4">✓ Tuyệt vời! Câu đúng rồi.</p>}

        <div className="flex flex-wrap gap-3">
          {locked ? (
            <button onClick={next} className="btn-primary px-6 py-2.5 cursor-pointer">{idx + 1 >= session.list.length ? "Xem kết quả" : "Câu tiếp theo"}</button>
          ) : (
            <>
              <button onClick={() => { setPicked([]); setStatus("PLAYING"); }} className="btn-outline px-5 py-2.5 cursor-pointer">Xếp lại</button>
              <button onClick={() => setStatus("SKIPPED")} className="btn-ghost px-5 py-2.5 cursor-pointer">Xem đáp án</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
