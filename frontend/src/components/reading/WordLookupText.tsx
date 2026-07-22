"use client";
import { useEffect, useRef, useState } from "react";

interface WordLookupResult {
  word: string;
  meaning: string;
  phonetic: string;
  pos: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// Splits text into (word | other) runs, keeping whitespace/punctuation intact so layout
// (line breaks, spacing, punctuation) is unaffected — only the word runs become clickable.
function tokenize(text: string): { type: "word" | "text"; value: string; start: number }[] {
  const regex = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
  const tokens: { type: "word" | "text"; value: string; start: number }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) tokens.push({ type: "text", value: text.slice(lastIndex, match.index), start: lastIndex });
    tokens.push({ type: "word", value: match[0], start: match.index });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", value: text.slice(lastIndex), start: lastIndex });
  return tokens;
}

// Rough sentence split — doesn't need to be grammatically perfect, just enough
// surrounding context for the AI lookup to disambiguate word sense.
function splitSentences(text: string): { start: number; end: number; text: string }[] {
  const spans: { start: number; end: number; text: string }[] = [];
  const regex = /[^.!?]+[.!?]*/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    if (!m[0].trim()) continue;
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0].trim() });
  }
  return spans;
}

// Renders text with every word clickable for a real-time contextual dictionary lookup
// (click, not hover, so it works on mobile and doesn't spam the AI on mouse-over).
export function WordLookupText({ text, userId, className }: { text: string; userId: string | null; className?: string }) {
  const [popup, setPopup] = useState<{ top: number; left: number; word: string; sentence: string } | null>(null);
  const [result, setResult] = useState<WordLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const cacheRef = useRef<Map<string, WordLookupResult>>(new Map());
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!popup) return;
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current?.contains(e.target as Node)) return;
      setPopup(null);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [popup]);

  const sentences = splitSentences(text);

  const lookup = async (word: string, sentence: string) => {
    setAdded(false);
    const key = word.toLowerCase();
    const cached = cacheRef.current.get(key);
    if (cached) {
      setResult(cached);
      return;
    }
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/ai/lookup-word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence })
      });
      const data = await res.json();
      cacheRef.current.set(key, data);
      setResult(data);
    } catch {
      setResult({ word, meaning: "Không tra được nghĩa lúc này.", phonetic: "", pos: "" });
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = (e: React.MouseEvent<HTMLSpanElement>, word: string, start: number) => {
    e.stopPropagation();
    const sentence = sentences.find((s) => start >= s.start && start < s.end)?.text || text;
    const rect = e.currentTarget.getBoundingClientRect();
    const left = Math.min(rect.left, typeof window !== "undefined" ? window.innerWidth - 300 : rect.left);
    setPopup({ top: rect.bottom + 6, left, word, sentence });
    lookup(word, sentence);
  };

  const handleAddToMyWords = async () => {
    if (!userId || !result || !popup) return;
    try {
      await fetch(`${API}/api/srs/vocab/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          word: result.word,
          meaning: result.meaning,
          phonetic: result.phonetic || undefined,
          pos: result.pos || undefined,
          example: popup.sentence
        })
      });
      setAdded(true);
    } catch {}
  };

  const tokens = tokenize(text);

  return (
    <span className={className}>
      {tokens.map((t, i) =>
        t.type === "word" ? (
          <span
            key={i}
            onClick={(e) => handleWordClick(e, t.value, t.start)}
            className="cursor-pointer hover:underline decoration-dotted decoration-primary/60 underline-offset-2 hover:text-primary transition-colors"
          >
            {t.value}
          </span>
        ) : (
          <span key={i}>{t.value}</span>
        )
      )}
      {popup && (
        <span
          ref={popupRef}
          style={{ position: "fixed", top: popup.top, left: popup.left, zIndex: 200 }}
          className="block w-72 max-w-[90vw] bg-surface border border-foreground/10 rounded-2xl shadow-2xl p-4 animate-in fade-in zoom-in-95 duration-150 not-italic font-normal whitespace-normal text-left"
        >
          <span className="flex items-start justify-between gap-2 mb-1">
            <span className="font-black text-lg text-foreground">{result?.word || popup.word}</span>
            <button onClick={() => setPopup(null)} className="text-foreground/40 hover:text-foreground text-sm cursor-pointer">✕</button>
          </span>
          {loading ? (
            <span className="text-sm text-foreground/50 flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin inline-block" /> Đang tra nghĩa...
            </span>
          ) : result ? (
            <>
              <span className="text-xs text-foreground/40 mb-2 flex gap-2">
                {result.pos && <span className="italic">{result.pos}</span>}
                {result.phonetic && <span>{result.phonetic}</span>}
              </span>
              <span className="text-sm text-foreground/80 leading-relaxed mb-3 block">{result.meaning}</span>
              {userId && (
                <button
                  onClick={handleAddToMyWords}
                  disabled={added}
                  className="w-full text-xs font-bold py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {added ? "✓ Đã thêm vào Từ Của Tôi" : "+ Thêm vào Từ Của Tôi"}
                </button>
              )}
            </>
          ) : null}
        </span>
      )}
    </span>
  );
}
