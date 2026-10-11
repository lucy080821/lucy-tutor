"use client";
import { useState } from "react";
import { GRADE3_VOCAB, poolFor, shuffle, speakEnglish, type UnitId } from "@/lib/games/grade3";
import { FallbackNote, GameHeader, GameResult, type GameProps } from "./GameKit";

const PAIRS = 6;

type Card = { id: string; pairId: string; side: "EN" | "VI"; text: string; pic?: string; color?: string };

function buildDeck(unit: UnitId | "ALL") {
  const { items, fellBack } = poolFor(GRADE3_VOCAB, unit, PAIRS);
  const words = shuffle(items).slice(0, PAIRS);
  const cards: Card[] = words.flatMap((w) => [
    { id: `${w.en}-en`, pairId: w.en, side: "EN" as const, text: w.en },
    { id: `${w.en}-vi`, pairId: w.en, side: "VI" as const, text: w.vi, pic: w.pic, color: w.color },
  ]);
  return { cards: shuffle(cards), fellBack };
}

// Trò 1 — Lật Thẻ Ghép Cặp: lật 2 thẻ, ghép từ tiếng Anh với nghĩa tiếng Việt
export default function MemoryMatchGame({ unit, onExit }: GameProps) {
  const [deck, setDeck] = useState(() => buildDeck(unit as UnitId | "ALL"));
  const [flipped, setFlipped] = useState<string[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [wrongFlash, setWrongFlash] = useState(false);

  const restart = () => { setDeck(buildDeck(unit as UnitId | "ALL")); setFlipped([]); setMatched(new Set()); setMoves(0); setWrongFlash(false); };

  const done = matched.size === PAIRS;
  // 20 điểm mỗi cặp, trừ 5 điểm cho mỗi lượt lật thừa (tối thiểu 0)
  const score = Math.max(0, matched.size * 20 - Math.max(0, moves - matched.size - 2) * 5);

  const flip = (card: Card) => {
    if (flipped.length === 2 || flipped.includes(card.id) || matched.has(card.pairId)) return;
    if (card.side === "EN") speakEnglish(card.text);
    const next = [...flipped, card.id];
    setFlipped(next);
    if (next.length < 2) return;
    setMoves((m) => m + 1);
    const [a, b] = next.map((id) => deck.cards.find((c) => c.id === id)!);
    if (a.pairId === b.pairId) {
      setTimeout(() => {
        setMatched((s) => new Set(s).add(a.pairId));
        setFlipped([]);
      }, 350);
    } else {
      setWrongFlash(true);
      setTimeout(() => { setFlipped([]); setWrongFlash(false); }, 900);
    }
  };

  if (done) {
    const stars = moves <= PAIRS + 2 ? 3 : moves <= PAIRS * 2 ? 2 : 1;
    return (
      <GameResult gameId="memory" unit={unit} score={score} stars={stars}
        summary={`Bạn ghép đủ ${PAIRS} cặp sau ${moves} lượt lật.`}
        onReplay={restart} onExit={onExit} />
    );
  }

  return (
    <div>
      <GameHeader title="Lật Thẻ Ghép Cặp" progress={`${matched.size}/${PAIRS} cặp · ${moves} lượt`} score={score} onExit={onExit} />
      <FallbackNote show={deck.fellBack} />
      <p className="text-muted mb-5">Lật 2 thẻ để ghép <b>từ tiếng Anh</b> với <b>nghĩa</b> của nó. Càng ít lượt, càng nhiều sao!</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {deck.cards.map((card) => {
          const isMatched = matched.has(card.pairId);
          const isOpen = isMatched || flipped.includes(card.id);
          const isWrong = wrongFlash && flipped.includes(card.id);
          return (
            <button key={card.id} onClick={() => flip(card)} disabled={isMatched}
              aria-label={isOpen ? card.text : "Thẻ úp"}
              className={`aspect-[4/3] rounded-2xl border-2 flex flex-col items-center justify-center p-2 text-center transition-all duration-200 cursor-pointer select-none
                ${isMatched ? "bg-emerald-50 border-emerald-300 opacity-70" :
                  isWrong ? "bg-red-50 border-red-300" :
                  isOpen ? "bg-surface border-primary shadow-card" :
                  "bg-primary border-primary hover:-translate-y-0.5 hover:shadow-card-hover"}`}>
              {isOpen ? (
                <>
                  {card.color && <span className="w-8 h-8 rounded-full border border-line-strong mb-1" style={{ background: card.color }} />}
                  {card.pic && !card.color && <span className="text-2xl sm:text-3xl leading-none mb-1 font-bold text-primary">{card.pic}</span>}
                  <span className={`font-bold leading-tight ${card.side === "EN" ? "text-primary text-lg sm:text-xl" : "text-foreground text-sm sm:text-base"}`}>{card.text}</span>
                </>
              ) : (
                <span className="text-white/90 text-3xl font-extrabold">?</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
