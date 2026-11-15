"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { renderMarked, plain } from "./marked";
import { farmApi, speak, type Catalog, type FarmState, type PlotView, type SeedDeckItem, type SeedKind, type SeedTopic, type SeedTopicItem, type SgkGrade, type SgkItem } from "@/lib/farm/api";
import { CropSprite } from "./Sprites";

type Pick = {
  word: string; meaning: string; kind?: SeedKind; example?: string | null; phonetic?: string | null; cefr?: string; explain?: string; speak?: string;
  progressId?: string | null; topicId?: string; itemId?: string; sgk?: { grade: number; unit: number }; cropKey?: string;
};
type Cat = "DECK" | SeedKind | "SGK";

const CAT_LABEL: { id: Cat; label: string }[] = [
  { id: "vocab", label: "📖 Từ vựng" }, { id: "grammar", label: "✍️ Ngữ pháp" }, { id: "pron", label: "🔊 Phát âm" }, { id: "SGK", label: "🎒 SGK" },
];
const CAT_HINT: Record<SeedKind, string> = {
  vocab: "Mỗi hạt là 1 từ tiếng Anh.",
  grammar: "Mỗi hạt là 1 câu điền chỗ trống: chọn đúng dạng từ, rồi về sau gõ lại.",
  pron: "Mỗi hạt là 1 câu hỏi phát âm: đuôi -ed/-s, trọng âm, IPA, cặp âm dễ nhầm...",
};

// Chọn hạt giống cho 1 ô trống: Deck SRS của học viên, kho Từ vựng / Ngữ pháp / Phát âm theo chủ đề, hoặc Sách giáo khoa theo lớp/unit.
// Luôn hiện thẻ học (flashcard) trước khi trồng — bước "học" đầu tiên.
export default function SeedPicker({ userId, plot, catalog, onClose, onState }: { userId: string; plot: PlotView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void }) {
  const [cat, setCat] = useState<Cat>("vocab");
  const [deck, setDeck] = useState<SeedDeckItem[] | null>(null);
  const [topics, setTopics] = useState<SeedTopic[] | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [items, setItems] = useState<SeedTopicItem[] | null>(null);
  const [grades, setGrades] = useState<SgkGrade[] | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
  const [unit, setUnit] = useState<number | null>(null);
  const [sgkItems, setSgkItems] = useState<SgkItem[] | null>(null);
  const [tier, setTier] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    farmApi.seedsDeck(userId).then((d) => { setDeck(d.items); if (d.items.length) setCat("DECK"); }).catch(() => setDeck([]));
    farmApi.seedTopics(userId).then((d) => setTopics(d.topics)).catch(() => setTopics([]));
    farmApi.seedsSgk(userId).then((d) => setGrades(d.grades)).catch(() => setGrades([]));
  }, [userId]);
  useEffect(() => {
    if (!topic) return;
    setItems(null);
    farmApi.seedTopic(userId, topic).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [userId, topic]);
  useEffect(() => {
    if (grade === null || unit === null) return;
    setSgkItems(null);
    farmApi.seedsSgkUnit(userId, grade, unit).then((d) => setSgkItems(d.items)).catch(() => setSgkItems([]));
  }, [userId, grade, unit]);

  const q = search.trim().toLowerCase();
  const filteredDeck = useMemo(() => (deck || []).filter((d) => !q || d.word.toLowerCase().includes(q) || d.meaning.toLowerCase().includes(q)), [deck, q]);
  const filteredItems = useMemo(() => (items || []).filter((i) => (tier === "all" || i.tier === tier) && (!q || i.word.toLowerCase().includes(q) || i.meaning.toLowerCase().includes(q) || (i.blank || "").toLowerCase().includes(q))), [items, tier, q]);
  const catTopics = useMemo(() => (topics || []).filter((t) => t.kind === cat), [topics, cat]);
  const curTopic = topics?.find((t) => t.id === topic);

  const plant = async () => {
    if (!pick || busy) return;
    setBusy(true); setErr(null);
    try {
      const src = pick.progressId ? { progressId: pick.progressId } : pick.sgk ? { seed: { sgk: { ...pick.sgk, en: pick.word } } } : { seed: { topicId: pick.topicId!, id: pick.itemId, word: pick.word } };
      const s = await farmApi.plant(userId, plot.id, src);
      onState(s); onClose();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const tierLabel: Record<string, string> = { easy: "Dễ A1–A2", medium: "Trung bình B1", hard: "Khó B2+" };
  const switchCat = (c: Cat) => { setCat(c); setTopic(null); setItems(null); setPick(null); setTier("all"); setGrade(null); setUnit(null); setSgkItems(null); };
  const pickItem = (i: SeedTopicItem) => setPick({ word: i.word, meaning: i.meaning, kind: i.kind, example: i.example, phonetic: i.phonetic, cefr: i.cefr, explain: i.explain, speak: i.speak, progressId: i.progressId, topicId: topic!, itemId: i.id, cropKey: curTopic?.cropKey });
  const sel = (i: SeedTopicItem) => pick?.topicId === topic && (i.id ? pick?.itemId === i.id : pick?.word === i.word);

  return (
    <Modal title="🌱 Chọn hạt giống" subtitle="Mỗi ô đất trồng 1 thẻ. Cây chín lần đầu sau 10 phút, sau đó theo lịch ôn SRS." onClose={onClose} wide
      footer={pick ? (
        <div className="flex items-center gap-3">
          <button onClick={() => speak(pick.speak || (pick.kind && pick.kind !== "vocab" ? "" : pick.word))} disabled={pick.kind === "grammar" || (pick.kind === "pron" && !pick.speak)} className="btn-outline rounded-full px-4 py-2.5 font-bold disabled:opacity-40">🔊</button>
          <div className="flex-1 min-w-0"><p className="font-extrabold text-primary truncate">{pick.kind && pick.kind !== "vocab" ? plain(pick.meaning) : pick.word} {pick.kind === "vocab" || !pick.kind ? <span className="text-muted font-semibold">— {pick.meaning}</span> : null}</p>{err && <p className="text-xs text-red-600 font-semibold">{err}</p>}</div>
          <button onClick={plant} disabled={busy} className="btn-primary rounded-full px-6 py-2.5 font-bold disabled:opacity-50">{busy ? "Đang trồng..." : "🌱 Trồng"}</button>
        </div>
      ) : <p className="text-sm text-muted text-center">Chọn 1 thẻ để xem rồi bấm Trồng</p>}>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => switchCat("DECK")} className={`ui-chip ${cat === "DECK" ? "ui-chip-active" : ""}`}>📚 Deck của tôi {deck ? `(${deck.length})` : ""}</button>
        {CAT_LABEL.map((c) => <button key={c.id} onClick={() => switchCat(c.id)} className={`ui-chip ${cat === c.id ? "ui-chip-active" : ""}`}>{c.label}</button>)}
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm..." className="ui-input ml-auto w-36 py-1.5" />
      </div>

      {pick && (
        <div className="mb-4 rounded-2xl border border-primary bg-primary-soft p-4 flex gap-4 items-center farm-toast">
          <svg width="56" height="70" viewBox="-32 -70 64 76" className="shrink-0"><g transform="translate(0 2)"><CropSprite cropKey={pick.cropKey || "tomato"} growth={1} ready /></g></svg>
          <div className="min-w-0 flex-1">
            {pick.kind === "grammar" ? (
              <>
                <p className="text-lg font-extrabold text-primary leading-snug">{pick.example}</p>
                <p className="text-sm text-foreground mt-1">Đáp án: <b className="text-primary">{pick.word}</b> <span className="text-muted">· {pick.meaning}</span></p>
                {pick.explain && <p className="text-sm text-muted italic mt-1">{pick.explain}</p>}
              </>
            ) : pick.kind === "pron" ? (
              <>
                <p className="text-lg font-extrabold text-primary leading-snug">{renderMarked(pick.meaning)}</p>
                <p className="text-sm text-foreground mt-1">Đáp án: <b className="text-primary">{renderMarked(pick.word)}</b></p>
                {pick.explain && <p className="text-sm text-muted italic mt-1">{pick.explain}</p>}
              </>
            ) : (
              <>
                <p className="text-2xl font-extrabold text-primary leading-tight">{pick.word} {pick.cefr && <span className="ui-badge text-xs align-middle">{pick.cefr}</span>}</p>
                {pick.phonetic && <p className="text-sm text-muted">{pick.phonetic.startsWith("/") ? pick.phonetic : `/${pick.phonetic}/`}</p>}
                <p className="text-foreground font-semibold">{pick.meaning}</p>
                {pick.example && <p className="text-sm text-muted italic mt-1">“{pick.example}”</p>}
              </>
            )}
          </div>
        </div>
      )}

      {cat === "DECK" && (
        deck === null ? <p className="text-muted py-6 text-center">Đang tải deck...</p> :
        filteredDeck.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <p className="font-semibold">Deck của bạn chưa có thẻ nào chưa trồng.</p>
            <p className="mt-1">Lấy hạt giống từ <b>Từ vựng</b>, <b>Ngữ pháp</b>, <b>Phát âm</b> hoặc <b>SGK</b>, hoặc học bài giáo viên giao / tự thêm từ ở Vocab Gym.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredDeck.map((d) => (
              <button key={d.progressId} onClick={() => setPick({ word: d.word, meaning: d.meaning, example: d.example, phonetic: d.phonetic, progressId: d.progressId, kind: d.pos === "grammar" ? "grammar" : d.pos === "pron" ? "pron" : "vocab" })}
                className={`farm-item text-left rounded-xl border px-3 py-2 ${pick?.progressId === d.progressId ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                <p className="font-bold text-foreground truncate">{renderMarked(d.pos === "grammar" || d.pos === "pron" ? d.meaning : d.word)}</p>
                <p className="text-xs text-muted truncate">{d.pos === "grammar" ? "Ngữ pháp" : d.pos === "pron" ? "Phát âm" : d.meaning}</p>
                <p className="text-[10px] mt-1 font-bold text-primary">{d.srs.status === "LEARNING" ? "Mới" : d.srs.status === "MASTERED" ? "⭐ Thuộc" : `Nhớ ${d.srs.repetitions} lần`}{d.fromLesson ? " · GV giao" : ""}</p>
              </button>
            ))}
          </div>
        )
      )}

      {(cat === "vocab" || cat === "grammar" || cat === "pron") && !topic && (
        topics === null ? <p className="text-muted py-6 text-center">Đang tải chủ đề...</p> : (
          <>
            <p className="text-xs text-muted mb-2">{CAT_HINT[cat]}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {catTopics.map((t) => (
                <button key={t.id} onClick={() => setTopic(t.id)} className="farm-item rounded-2xl border border-line bg-white p-3 text-left hover:border-primary">
                  <div className="text-3xl">{catalog.crops[t.cropKey]?.emoji}</div>
                  <p className="font-bold text-foreground leading-tight mt-1">{t.name}</p>
                  <p className="text-xs text-muted">{t.count} thẻ · {t.desc}</p>
                </button>
              ))}
            </div>
          </>
        )
      )}
      {(cat === "vocab" || cat === "grammar" || cat === "pron") && topic && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button onClick={() => { setTopic(null); setItems(null); }} className="btn-ghost rounded-full px-3 py-1.5 font-bold text-sm">← {curTopic?.name || "Chủ đề"}</button>
            {(["all", "easy", "medium", "hard"] as const).map((t) => <button key={t} onClick={() => setTier(t)} className={`ui-chip text-xs ${tier === t ? "ui-chip-active" : ""}`}>{t === "all" ? "Tất cả" : tierLabel[t]}</button>)}
          </div>
          {items === null ? <p className="text-muted py-6 text-center">Đang tải...</p> : (
            <div className={`grid gap-2 ${cat === "vocab" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2"}`}>
              {filteredItems.map((i) => (
                <button key={i.id || i.word} disabled={i.planted} onClick={() => pickItem(i)}
                  className={`farm-item text-left rounded-xl border px-3 py-2 disabled:opacity-40 ${sel(i) ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                  {cat === "vocab" ? (
                    <>
                      <p className="font-bold text-foreground truncate">{i.word} <span className="text-[10px] text-muted font-semibold">{i.cefr}</span></p>
                      <p className="text-xs text-muted truncate">{i.meaning}</p>
                    </>
                  ) : cat === "grammar" ? (
                    <>
                      <p className="font-bold text-foreground leading-snug">{i.blank}</p>
                      <p className="text-xs text-muted truncate">{i.meaning} · {i.cefr}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-foreground leading-snug">{renderMarked(i.type === "odd" ? i.meaning.replace("Chọn từ có phần gạch chân phát âm khác: ", "") : i.meaning)}</p>
                      <p className="text-xs text-muted truncate">{i.type === "odd" ? "Chọn từ phát âm khác" : i.type === "sound" ? "Nghe và chọn" : i.type === "ipa" ? "Phiên âm IPA" : i.type === "stress" ? "Trọng âm" : "Đuôi từ"}</p>
                    </>
                  )}
                  {i.planted ? <p className="text-[10px] mt-1 font-bold text-emerald-700">Đang trồng</p> : i.inDeck ? <p className="text-[10px] mt-1 font-bold text-primary">Có trong deck</p> : null}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cat === "SGK" && (
        grades === null ? <p className="text-muted py-6 text-center">Đang tải sách giáo khoa...</p> :
        grades.length === 0 ? <p className="text-center text-muted text-sm py-8">Chưa có từ SGK trong hệ thống. Từ SGK lấy từ bài học giáo viên đã soạn (Global Success).</p> : (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {grades.map((g) => <button key={g.grade} onClick={() => { setGrade(g.grade); setUnit(null); setSgkItems(null); setPick(null); }} className={`ui-chip text-xs ${grade === g.grade ? "ui-chip-active" : ""}`}>Lớp {g.grade}</button>)}
            </div>
            {grade !== null && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {grades.find((g) => g.grade === grade)?.units.map((u) => <button key={u.key} onClick={() => { setUnit(u.key); setPick(null); }} className={`ui-chip text-xs ${unit === u.key ? "ui-chip-active" : ""}`}>{u.key === 0 ? "Starter" : `Unit ${u.key}`}{u.title ? ` · ${u.title}` : ""} ({u.count})</button>)}
              </div>
            )}
            {grade !== null && unit !== null && (sgkItems === null ? <p className="text-muted py-6 text-center">Đang tải từ...</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {sgkItems.filter((i) => !q || i.word.toLowerCase().includes(q) || i.meaning.toLowerCase().includes(q)).map((i) => (
                  <button key={i.word} disabled={i.planted} onClick={() => setPick({ word: i.word, meaning: i.meaning, kind: "vocab", example: i.example, phonetic: i.phonetic, progressId: i.progressId, sgk: { grade, unit } })}
                    className={`farm-item text-left rounded-xl border px-3 py-2 disabled:opacity-40 ${pick?.word === i.word && pick?.sgk ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                    <p className="font-bold text-foreground truncate">{i.word}</p>
                    <p className="text-xs text-muted truncate">{i.meaning}</p>
                    {i.planted ? <p className="text-[10px] mt-1 font-bold text-emerald-700">Đang trồng</p> : i.inDeck ? <p className="text-[10px] mt-1 font-bold text-primary">Có trong deck</p> : null}
                  </button>
                ))}
              </div>
            ))}
            {grade === null && <p className="text-xs text-muted">Chọn lớp, rồi chọn unit để lấy từ theo sách giáo khoa.</p>}
          </div>
        )
      )}
    </Modal>
  );
}
