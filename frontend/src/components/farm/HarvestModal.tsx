"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { farmApi, speak, type Catalog, type FarmState, type HarvestResult, type PlotView, type Question } from "@/lib/farm/api";
import { CropSprite } from "./Sprites";

// Thu hoạch = ôn từ. Dạng câu hỏi do server quyết định theo số lần đã nhớ (xem farm.routes.js modeFor).
export default function HarvestModal({ userId, plot, cropName, nextReadyPlot, catalog, onClose, onState, onNext }: {
  userId: string; plot: PlotView; cropName: string; nextReadyPlot: PlotView | null; catalog?: Catalog;
  onClose: () => void; onState: (s: FarmState) => void; onNext: (p: PlotView) => void;
}) {
  const [q, setQ] = useState<Question | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HarvestResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setQ(null); setErr(null); setAnswer(""); setPicked(null); setShowHint(false); setResult(null);
    farmApi.question(userId, plot.id).then((x) => { if (!alive) return; setQ(x); if (x.mode === "LISTEN" && x.speak) setTimeout(() => speak(x.speak!), 300); })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [userId, plot.id]);
  useEffect(() => { if (q && (q.mode === "TYPE" || q.mode === "FILL")) inputRef.current?.focus(); }, [q]);

  const submit = async (a: string) => {
    if (busy || !q) return;
    setBusy(true);
    try {
      const s = await farmApi.harvest(userId, plot.id, a, showHint);
      setResult(s.result || null);
      onState(s);
      if (s.result) speak(s.result.word);
    } catch (e: any) { setErr(e.message); }
    setBusy(false);
  };

  const modeLabel: Record<string, string> = { CHOICE: "Chọn từ đúng với nghĩa", LISTEN: "Nghe và chọn nghĩa", TYPE: "Gõ từ tiếng Anh", FILL: "Điền từ vào câu" };

  return (
    <Modal title={result ? (result.correct ? "🌾 Thu hoạch thành công!" : "🥀 Cây héo rồi...") : `Thu hoạch ${cropName}`} subtitle={!result && q ? modeLabel[q.mode] : undefined} onClose={onClose}>
      {err && <div className="rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-semibold">{err}</div>}
      {!q && !err && <div className="py-10 text-center text-muted">Đang hái câu hỏi...</div>}

      {q && !result && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl bg-primary-soft px-4 py-3">
            <svg width="64" height="76" viewBox="-32 -70 64 76"><g transform="translate(0 2)"><CropSprite cropKey={plot.cropKey} growth={1} ready /></g></svg>
            <div className="min-w-0">
              {q.mode === "LISTEN" ? (
                <button onClick={() => speak(q.speak || "")} className="btn-primary rounded-full px-5 py-2.5 font-bold inline-flex items-center gap-2">🔊 Nghe lại</button>
              ) : q.mode === "FILL" ? (
                <>
                  <p className="text-lg font-bold text-foreground leading-snug">{q.sentence}</p>
                  <p className="text-sm text-muted mt-1">Nghĩa của từ cần điền: <b className="text-foreground">{q.meaning}</b></p>
                </>
              ) : (
                <>
                  <p className="text-xs uppercase tracking-wide text-muted font-bold">Nghĩa</p>
                  <p className="text-2xl font-extrabold text-primary leading-tight">{q.meaning}</p>
                </>
              )}
            </div>
          </div>

          {(q.mode === "CHOICE" || q.mode === "LISTEN") && q.options && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {q.options.map((o) => (
                <button key={o} disabled={busy} onClick={() => { setPicked(o); submit(o); }}
                  className={`farm-item text-left rounded-2xl border px-4 py-3 font-bold text-base ${picked === o ? "border-primary bg-primary-soft" : "border-line-strong bg-white hover:border-primary"}`}>
                  {o}
                </button>
              ))}
            </div>
          )}

          {(q.mode === "TYPE" || q.mode === "FILL") && (
            <form onSubmit={(e) => { e.preventDefault(); submit(answer); }} className="space-y-3">
              <input ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Gõ từ tiếng Anh..." autoComplete="off" autoCapitalize="off" spellCheck={false}
                className="ui-input w-full text-lg font-bold" />
              {showHint && q.hint && <p className="text-center font-mono text-xl tracking-widest text-primary">{q.hint}</p>}
              <div className="flex flex-wrap gap-2 justify-between">
                <button type="button" onClick={() => setShowHint(true)} disabled={showHint} className="btn-outline rounded-full px-4 py-2.5 font-bold disabled:opacity-50">💡 Gợi ý (ít xu hơn)</button>
                <button type="submit" disabled={busy || !answer.trim()} className="btn-primary rounded-full px-6 py-2.5 font-bold disabled:opacity-50">{busy ? "Đang chấm..." : "Thu hoạch"}</button>
              </div>
            </form>
          )}
          <p className="text-xs text-muted text-center">Từ đang ở lần nhớ thứ {plot.srs?.repetitions ?? 0}. Trả lời sai thì cây héo và sau 10 phút học lại từ đầu.</p>
        </div>
      )}

      {result && (
        <div className="space-y-4 text-center">
          <div className={`rounded-2xl px-4 py-4 ${result.correct ? "bg-emerald-50" : "bg-amber-50"}`}>
            <p className="text-3xl font-extrabold text-primary">{result.word}</p>
            <p className="text-lg text-foreground mt-1">{result.meaning}</p>
            {result.example && <p className="text-sm text-muted italic mt-2">“{result.example}”</p>}
            <button onClick={() => speak(result.word)} className="mt-3 btn-outline rounded-full px-4 py-2 text-sm font-bold">🔊 Nghe</button>
          </div>
          {result.correct ? (
            <div className="flex flex-wrap justify-center gap-2 text-sm font-bold">
              <span className="ui-badge bg-amber-100 text-amber-800 px-3 py-1 rounded-full">🪙 +{result.coins}{result.boosted ? " (x2)" : ""}</span>
              {result.gems > 0 && <span className="ui-badge bg-sky-100 text-sky-800 px-3 py-1 rounded-full">💎 +{result.gems}</span>}
              {result.produce > 0 && <span className="ui-badge bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full">🧺 +{result.produce} {catalog?.crops[result.produceKey || ""]?.name?.toLowerCase() || "nông sản"} vào kho</span>}
              {result.overflowSold > 0 && <span className="ui-badge bg-orange-100 text-orange-800 px-3 py-1 rounded-full">Kho đầy, {result.overflowSold} nông sản bán nửa giá</span>}
              <span className="ui-badge bg-primary-soft text-primary px-3 py-1 rounded-full">⚡ +{result.xp} XP</span>
              <span className="ui-badge bg-slate-100 text-slate-700 px-3 py-1 rounded-full">⏳ Chín lại sau {result.srs.interval} ngày</span>
            </div>
          ) : (
            <p className="text-sm text-amber-800 font-semibold">Chưa đúng. Cây héo và sẽ mọc lại sau 10 phút — xem kỹ từ ở trên rồi quay lại nhé!</p>
          )}
          {result.becameMastered && <p className="text-sm font-bold text-emerald-700">⭐ Từ này đã THUỘC LÒNG! Bạn có thể cất vào kho để lấy chỗ trồng từ mới.</p>}
          <div className="flex flex-wrap gap-2 justify-center pt-1">
            <button onClick={onClose} className="btn-outline rounded-full px-5 py-2.5 font-bold">Đóng</button>
            {nextReadyPlot && <button onClick={() => onNext(nextReadyPlot)} className="btn-primary rounded-full px-5 py-2.5 font-bold">Thu hoạch cây tiếp theo →</button>}
          </div>
        </div>
      )}
    </Modal>
  );
}
