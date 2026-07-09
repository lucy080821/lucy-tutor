"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { cleanString, levenshteinDistance, getHintMask } from "@/lib/textGrading";
import { logSkillProgress } from "@/lib/skillProgress";

// Maps the existing SM-2 review quality scale (1/3/4/5 — see textGrading-based
// grading below) to a plain 0-10 score, purely to feed the dashboard's 4-skill
// radar chart with a rolling "recent listening accuracy" estimate.
const QUALITY_TO_SCORE: Record<number, number> = { 1: 2, 3: 6.5, 4: 8, 5: 10 };

interface ClipMatch {
  clipId: string;
  title: string;
  audioUrl: string;
  accent: string;
  start: number;
  end: number;
  tokens: string[];
  targetTokenIndex: number;
  fullScript: string;
}

function highlightWords(text: string, words: string[]) {
  if (words.length === 0) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(\\b(?:${escaped.join("|")})\\b)`, "gi");
  const cleanWords = new Set(words.map((w) => w.toLowerCase()));
  return text.split(pattern).map((part, i) =>
    cleanWords.has(part.toLowerCase()) ? (
      <mark key={i} className="bg-primary/15 text-primary font-bold rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const ACCENT_OPTIONS: { value: string; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "UK", label: "🇬🇧 UK" },
  { value: "US", label: "🇺🇸 US" },
  { value: "AUS", label: "🇦🇺 AUS" }
];

interface QueueItem {
  progressId: string;
  vocab: {
    id: string;
    word: string;
    meaning: string;
    pos?: string;
    phonetic?: string;
  };
  clips: ClipMatch[];
}

export default function ListeningPracticePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedClipIndex, setSelectedClipIndex] = useState(0);
  const [accentFilter, setAccentFilter] = useState("ALL");
  const [phase, setPhase] = useState<"EXPLORE" | "TEST">("EXPLORE");
  const [loadingMore, setLoadingMore] = useState(false);

  const [typedAnswer, setTypedAnswer] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [computedQuality, setComputedQuality] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playingFullRef = useRef(false);

  useEffect(() => {
    const uid = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!uid) {
      router.push("/");
      return;
    }
    setUserId(uid);
    fetchQueue(uid, accentFilter);
  }, [router]);

  const fetchQueue = async (uid: string, accent: string) => {
    setLoading(true);
    try {
      const accentParam = accent !== "ALL" ? `?accent=${accent}` : "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/listening/queue/${uid}${accentParam}`);
      if (res.ok) setQueue(await res.json());
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải dữ liệu luyện nghe", "error");
    }
    setLoading(false);
  };

  const changeAccentFilter = (accent: string) => {
    if (accent === accentFilter || !userId) return;
    setAccentFilter(accent);
    setCurrentIndex(0);
    resetCardState();
    fetchQueue(userId, accent);
  };

  const currentItem = queue[currentIndex];
  const currentClip = currentItem?.clips[selectedClipIndex];

  // Seek to the start of the sentence containing the matched word whenever the active clip
  // changes, and auto-pause once playback passes the end of that sentence.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentClip) return;

    const seekToStart = () => {
      playingFullRef.current = false;
      audio.currentTime = currentClip.start;
      audio.play().catch(() => {});
    };
    const pauseAtEnd = () => {
      if (playingFullRef.current) return;
      if (audio.currentTime >= currentClip.end) audio.pause();
    };

    audio.addEventListener("loadedmetadata", seekToStart);
    audio.addEventListener("timeupdate", pauseAtEnd);
    if (audio.readyState >= 1) seekToStart();

    return () => {
      audio.removeEventListener("loadedmetadata", seekToStart);
      audio.removeEventListener("timeupdate", pauseAtEnd);
    };
  }, [currentClip]);

  const replay = () => {
    const audio = audioRef.current;
    if (!audio || !currentClip) return;
    playingFullRef.current = false;
    audio.currentTime = currentClip.start;
    audio.play().catch(() => {});
  };

  const playFullTranscript = () => {
    const audio = audioRef.current;
    if (!audio) return;
    playingFullRef.current = true;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  };

  const resetCardState = () => {
    setSelectedClipIndex(0);
    setPhase("EXPLORE");
    setTypedAnswer("");
    setSubmitted(false);
    setUsedHint(false);
    setIsCorrect(null);
    setComputedQuality(null);
  };

  const submitTypedAnswer = () => {
    if (submitted || !currentItem || !currentClip) return;
    const targetWord = currentClip.tokens[currentClip.targetTokenIndex];
    const cleanUser = cleanString(typedAnswer);
    const cleanCorrect = cleanString(targetWord);

    if (!cleanUser) {
      setIsCorrect(false);
      setComputedQuality(1);
      setSubmitted(true);
      return;
    }

    const maxTypoDistance = cleanCorrect.length <= 4 ? 1 : 2;

    if (cleanUser === cleanCorrect) {
      setIsCorrect(true);
      setComputedQuality(usedHint ? 4 : 5);
    } else if (levenshteinDistance(cleanUser, cleanCorrect) <= maxTypoDistance) {
      setIsCorrect(true);
      setComputedQuality(3);
    } else {
      setIsCorrect(false);
      setComputedQuality(1);
    }
    setSubmitted(true);
  };

  const goNext = async () => {
    if (!currentItem || !currentClip || computedQuality === null || !userId) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/srs/review/${currentItem.progressId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quality: computedQuality })
      });
      logSkillProgress(userId, "LISTENING", QUALITY_TO_SCORE[computedQuality] ?? 2, "LISTENING_SRS");
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể lưu kết quả", "error");
      return;
    }

    resetCardState();

    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    // Ran through the current batch — silently pull in the next batch of due words
    // and keep going rather than interrupting with a "session complete" screen.
    setLoadingMore(true);
    try {
      const accentParam = accentFilter !== "ALL" ? `?accent=${accentFilter}` : "";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/listening/queue/${userId}${accentParam}`);
      setQueue(res.ok ? await res.json() : []);
      setCurrentIndex(0);
    } catch (err) {
      console.error(err);
      Swal.fire("Lỗi", "Không thể tải thêm từ vựng", "error");
    }
    setLoadingMore(false);
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-bold text-xl text-primary animate-pulse">Đang nạp dữ liệu...</div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-surface border-b border-foreground/10 px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4 flex-wrap">
        <button onClick={() => router.push("/dashboard")} className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium shrink-0">
          ← Dashboard
        </button>
        <span className="text-foreground/20 hidden sm:inline">/</span>
        <h1 className="font-bold text-primary text-sm sm:text-base">🎧 Studio Luyện Nghe</h1>
      </div>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {ACCENT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => changeAccentFilter(opt.value)}
              className={`px-4 py-1.5 rounded-full text-sm font-bold border transition-colors ${
                accentFilter === opt.value
                  ? "bg-primary text-white border-primary"
                  : "border-foreground/15 text-foreground/50 hover:border-primary/40"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {loadingMore ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="text-4xl mb-4 animate-pulse">🎧</div>
            <p className="text-foreground/50 font-bold">Đang nạp thêm từ vựng...</p>
          </div>
        ) : queue.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="text-6xl mb-4">🎧</div>
            <h2 className="text-2xl font-bold mb-2">Chưa có audio để luyện nghe</h2>
            <p className="text-foreground/50">
              Hiện chưa có audio nào chứa từ vựng bạn cần ôn ngay bây giờ. Hãy quay lại sau khi có thêm từ đến hạn hoặc giáo viên cập nhật thêm nội dung.
            </p>
          </div>
        ) : currentItem && currentClip ? (
          <div className="space-y-6">
            <div className="w-full mb-2">
              <div className="flex justify-between text-xs font-bold text-foreground/50 mb-2">
                <span>Tiến độ</span>
                <span>Còn lại {queue.length - currentIndex} từ</span>
              </div>
              <div className="h-2 w-full bg-foreground/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(currentIndex / queue.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-surface border border-foreground/10 rounded-[2rem] p-5 sm:p-8 text-center shadow-xl">
              <p className="text-xs sm:text-sm font-bold text-foreground/40 uppercase tracking-widest mb-1">
                {phase === "EXPLORE" ? "Xem & Nghe Từ Trong Câu" : "Nghe Và Điền Từ"}
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-primary mb-1 break-words">{currentItem.vocab.meaning}</h2>
              {currentItem.vocab.phonetic && <p className="text-foreground/50 font-mono">{currentItem.vocab.phonetic}</p>}
              {currentItem.clips.length === 1 && (
                <p className="text-xs text-foreground/40 font-bold mt-1">
                  {ACCENT_OPTIONS.find((o) => o.value === currentClip.accent)?.label || currentClip.accent}
                </p>
              )}

              {phase === "EXPLORE" && currentItem.clips.length > 1 && (
                <div className="flex justify-center gap-2 mt-4 flex-wrap">
                  {currentItem.clips.map((clip, idx) => (
                    <button
                      key={clip.clipId}
                      onClick={() => setSelectedClipIndex(idx)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors max-w-[70vw] sm:max-w-[220px] truncate ${
                        idx === selectedClipIndex
                          ? "bg-primary text-white border-primary"
                          : "border-foreground/15 text-foreground/50 hover:border-primary/40"
                      }`}
                    >
                      {ACCENT_OPTIONS.find((o) => o.value === clip.accent)?.label || clip.accent} · Ví dụ {idx + 1}: {clip.title}
                    </button>
                  ))}
                </div>
              )}

              <audio ref={audioRef} src={currentClip.audioUrl} className="hidden" />

              <button
                onClick={replay}
                className="mt-6 w-16 h-16 mx-auto rounded-full bg-primary text-white flex items-center justify-center text-2xl shadow-md hover:opacity-90 transition-opacity"
                aria-label="Nghe lại"
              >
                ▶
              </button>

              {phase === "EXPLORE" ? (
                <div className="mt-6">
                  <p className="text-lg leading-relaxed">
                    {currentClip.tokens.map((token, idx) =>
                      idx === currentClip.targetTokenIndex ? (
                        <button
                          key={idx}
                          onClick={replay}
                          className="font-black text-primary underline decoration-dotted decoration-2 underline-offset-4 hover:bg-primary/10 rounded px-0.5 cursor-pointer"
                          title="Bấm để nghe lại từ này"
                        >
                          {token}{" "}
                        </button>
                      ) : (
                        <span key={idx}>{token} </span>
                      )
                    )}
                  </p>
                  <p className="text-xs text-foreground/40 mt-2">Bấm vào từ được bôi đậm để nghe lại</p>
                  <button
                    onClick={() => setPhase("TEST")}
                    className="mt-6 w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-md hover:opacity-90 transition-opacity"
                  >
                    Bắt Đầu Kiểm Tra →
                  </button>
                </div>
              ) : !submitted ? (
                <div className="mt-6 flex flex-col items-center w-full">
                  <p className="text-lg leading-relaxed mb-4">
                    {currentClip.tokens.map((token, idx) =>
                      idx === currentClip.targetTokenIndex ? (
                        <span key={idx} className="inline-block border-b-2 border-primary min-w-[3rem] px-1">&nbsp;</span>
                      ) : (
                        <span key={idx}>{token} </span>
                      )
                    )}
                  </p>
                  <input
                    type="text"
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitTypedAnswer(); }}
                    placeholder="Gõ từ bạn nghe được..."
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    className="w-full max-w-xs text-center text-xl font-bold border-2 border-foreground/10 focus:border-primary rounded-2xl px-4 py-3 outline-none transition-colors bg-background text-foreground"
                  />
                  {usedHint && (
                    <p className="mt-4 font-mono text-lg tracking-widest text-foreground/50">
                      {getHintMask(currentClip.tokens[currentClip.targetTokenIndex])}
                    </p>
                  )}
                  <div className="mt-6 flex flex-wrap justify-center gap-3 w-full max-w-xs">
                    <button
                      onClick={() => setUsedHint(true)}
                      disabled={usedHint}
                      className="flex-1 min-w-[120px] px-4 py-2 bg-amber-500/10 text-amber-600 font-bold rounded-xl hover:bg-amber-500 hover:text-white transition-colors disabled:opacity-50"
                    >
                      💡 Gợi Ý
                    </button>
                    <button
                      onClick={submitTypedAnswer}
                      className="flex-1 min-w-[120px] px-4 py-2 bg-primary text-white font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                      Kiểm Tra
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6">
                  <div className={`inline-block mb-4 px-4 py-2 rounded-xl font-bold ${isCorrect ? "bg-green-500/10 text-green-600" : "bg-rose-500/10 text-rose-600"}`}>
                    {isCorrect ? (computedQuality === 3 ? "Gần đúng!" : "Chính xác!") : "Chưa đúng"}
                  </div>
                  <p className="text-lg leading-relaxed">
                    {currentClip.tokens.map((token, idx) => (
                      <span key={idx} className={idx === currentClip.targetTokenIndex ? "font-black text-primary underline" : ""}>
                        {token}{" "}
                      </span>
                    ))}
                  </p>
                  {!isCorrect && typedAnswer && (
                    <p className="text-foreground/50 mt-3 text-sm">Bạn đã gõ: <span className="line-through">{typedAnswer}</span></p>
                  )}

                  <div className="mt-6 pt-6 border-t border-foreground/10 text-left">
                    <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 text-center">Toàn Bộ Transcript</p>
                    <p className="text-sm text-foreground/70 leading-relaxed whitespace-pre-wrap">
                      {highlightWords(currentClip.fullScript, [currentClip.tokens[currentClip.targetTokenIndex]])}
                    </p>
                    <button
                      onClick={playFullTranscript}
                      className="mt-4 mx-auto flex items-center gap-2 px-5 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary hover:text-white transition-colors"
                    >
                      ▶ Nghe Toàn Bộ
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className={`transition-opacity duration-300 ${submitted ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
              <button
                onClick={goNext}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-md hover:opacity-90 transition-opacity"
              >
                Tiếp Tục →
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
