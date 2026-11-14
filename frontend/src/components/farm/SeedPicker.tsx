"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import { farmApi, speak, type Catalog, type FarmState, type PlotView, type SeedDeckItem, type SeedTopic, type SeedTopicItem } from "@/lib/farm/api";
import { CropSprite } from "./Sprites";

type Pick = { word: string; meaning: string; example?: string | null; phonetic?: string | null; cefr?: string; progressId?: string | null; topicId?: string; cropKey?: string };

// Chọn hạt giống cho 1 ô trống: Deck SRS của học viên (ưu tiên từ đến hạn) hoặc 8 chủ đề có sẵn.
// Luôn hiện flashcard trước khi trồng — bước "học" đầu tiên của từ mới.
export default function SeedPicker({ userId, plot, catalog, onClose, onState }: { userId: string; plot: PlotView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void }) {
  const [tab, setTab] = useState<"DECK" | "TOPIC">("TOPIC");
  const [deck, setDeck] = useState<SeedDeckItem[] | null>(null);
  const [topics, setTopics] = useState<SeedTopic[] | null>(null);
  const [topic, setTopic] = useState<string | null>(null);
  const [items, setItems] = useState<SeedTopicItem[] | null>(null);
  const [tier, setTier] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [search, setSearch] = useState("");
  const [pick, setPick] = useState<Pick | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    farmApi.seedsDeck(userId).then((d) => { setDeck(d.items); if (d.items.length) setTab("DECK"); }).catch(() => setDeck([]));
    farmApi.seedTopics(userId).then((d) => setTopics(d.topics)).catch(() => setTopics([]));
  }, [userId]);
  useEffect(() => {
    if (!topic) return;
    setItems(null);
    farmApi.seedTopic(userId, topic).then((d) => setItems(d.items)).catch(() => setItems([]));
  }, [userId, topic]);

  const filteredDeck = useMemo(() => (deck || []).filter((d) => !search || d.word.toLowerCase().includes(search.toLowerCase()) || d.meaning.toLowerCase().includes(search.toLowerCase())), [deck, search]);
  const filteredItems = useMemo(() => (items || []).filter((i) => (tier === "all" || i.tier === tier) && (!search || i.word.toLowerCase().includes(search.toLowerCase()) || i.meaning.toLowerCase().includes(search.toLowerCase()))), [items, tier, search]);

  const plant = async () => {
    if (!pick || busy) return;
    setBusy(true); setErr(null);
    try {
      const s = pick.progressId ? await farmApi.plant(userId, plot.id, { progressId: pick.progressId }) : await farmApi.plant(userId, plot.id, { seed: { topicId: pick.topicId!, word: pick.word } });
      onState(s); onClose();
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const tierLabel: Record<string, string> = { easy: "Dễ A1–A2", medium: "Trung bình B1", hard: "Khó B2–C1" };

  return (
    <Modal title="🌱 Chọn hạt giống" subtitle="Mỗi ô đất trồng 1 từ. Cây chín lần đầu sau 10 phút, sau đó theo lịch ôn SRS." onClose={onClose} wide
      footer={pick ? (
        <div className="flex items-center gap-3">
          <button onClick={() => speak(pick.word)} className="btn-outline rounded-full px-4 py-2.5 font-bold">🔊</button>
          <div className="flex-1 min-w-0"><p className="font-extrabold text-primary truncate">{pick.word} <span className="text-muted font-semibold">— {pick.meaning}</span></p>{err && <p className="text-xs text-red-600 font-semibold">{err}</p>}</div>
          <button onClick={plant} disabled={busy} className="btn-primary rounded-full px-6 py-2.5 font-bold disabled:opacity-50">{busy ? "Đang trồng..." : "🌱 Trồng"}</button>
        </div>
      ) : <p className="text-sm text-muted text-center">Chọn 1 từ để xem thẻ rồi bấm Trồng</p>}>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setTab("DECK")} className={`ui-chip ${tab === "DECK" ? "ui-chip-active" : ""}`}>📚 Deck của tôi {deck ? `(${deck.length})` : ""}</button>
        <button onClick={() => setTab("TOPIC")} className={`ui-chip ${tab === "TOPIC" ? "ui-chip-active" : ""}`}>🗂️ Kho chủ đề</button>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm từ..." className="ui-input ml-auto w-40 py-1.5" />
      </div>

      {pick && (
        <div className="mb-4 rounded-2xl border border-primary bg-primary-soft p-4 flex gap-4 items-center farm-toast">
          <svg width="56" height="70" viewBox="-32 -70 64 76"><g transform="translate(0 2)"><CropSprite cropKey={pick.cropKey || "tomato"} growth={1} ready /></g></svg>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-extrabold text-primary leading-tight">{pick.word} {pick.cefr && <span className="ui-badge text-xs align-middle">{pick.cefr}</span>}</p>
            {pick.phonetic && <p className="text-sm text-muted">/{pick.phonetic}/</p>}
            <p className="text-foreground font-semibold">{pick.meaning}</p>
            {pick.example && <p className="text-sm text-muted italic mt-1">“{pick.example}”</p>}
          </div>
        </div>
      )}

      {tab === "DECK" && (
        deck === null ? <p className="text-muted py-6 text-center">Đang tải deck...</p> :
        filteredDeck.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            <p className="font-semibold">Deck của bạn chưa có từ nào chưa trồng.</p>
            <p className="mt-1">Lấy hạt giống từ <b>Kho chủ đề</b>, hoặc học bài giáo viên giao / tự thêm từ ở Vocab Gym.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredDeck.map((d) => (
              <button key={d.progressId} onClick={() => setPick({ word: d.word, meaning: d.meaning, example: d.example, phonetic: d.phonetic, progressId: d.progressId })}
                className={`farm-item text-left rounded-xl border px-3 py-2 ${pick?.progressId === d.progressId ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                <p className="font-bold text-foreground truncate">{d.word}</p>
                <p className="text-xs text-muted truncate">{d.meaning}</p>
                <p className="text-[10px] mt-1 font-bold text-primary">{d.srs.status === "LEARNING" ? "Mới" : d.srs.status === "MASTERED" ? "⭐ Thuộc" : `Nhớ ${d.srs.repetitions} lần`}{d.fromLesson ? " · GV giao" : ""}</p>
              </button>
            ))}
          </div>
        )
      )}

      {tab === "TOPIC" && !topic && (
        topics === null ? <p className="text-muted py-6 text-center">Đang tải chủ đề...</p> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {topics.map((t) => (
              <button key={t.id} onClick={() => setTopic(t.id)} className="farm-item rounded-2xl border border-line bg-white p-3 text-left hover:border-primary">
                <div className="text-3xl">{catalog.crops[t.cropKey]?.emoji}</div>
                <p className="font-bold text-foreground leading-tight mt-1">{t.name}</p>
                <p className="text-xs text-muted">{t.count} từ · {t.desc}</p>
              </button>
            ))}
          </div>
        )
      )}
      {tab === "TOPIC" && topic && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button onClick={() => { setTopic(null); setItems(null); }} className="btn-ghost rounded-full px-3 py-1.5 font-bold text-sm">← Chủ đề</button>
            {(["all", "easy", "medium", "hard"] as const).map((t) => <button key={t} onClick={() => setTier(t)} className={`ui-chip text-xs ${tier === t ? "ui-chip-active" : ""}`}>{t === "all" ? "Tất cả" : tierLabel[t]}</button>)}
          </div>
          {items === null ? <p className="text-muted py-6 text-center">Đang tải từ...</p> : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {filteredItems.map((i) => {
                const cropKey = topics?.find((t) => t.id === topic)?.cropKey;
                const sel = pick?.word === i.word && pick?.topicId === topic;
                return (
                  <button key={i.word} disabled={i.planted} onClick={() => setPick({ word: i.word, meaning: i.meaning, example: i.example, cefr: i.cefr, progressId: i.progressId, topicId: topic, cropKey })}
                    className={`farm-item text-left rounded-xl border px-3 py-2 disabled:opacity-40 ${sel ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                    <p className="font-bold text-foreground truncate">{i.word} <span className="text-[10px] text-muted font-semibold">{i.cefr}</span></p>
                    <p className="text-xs text-muted truncate">{i.meaning}</p>
                    {i.planted ? <p className="text-[10px] mt-1 font-bold text-emerald-700">Đang trồng</p> : i.inDeck ? <p className="text-[10px] mt-1 font-bold text-primary">Có trong deck</p> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
