"use client";
import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert, fire } from "./farmSwal";
import { farmApi, produceInfo, speak, type BarnItem, type BarnQuizItem, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";

// Kho: 3 tab.
//  - Nông sản: chứa nông sản thu hoạch được (bán lấy xu, hoặc để giao đơn nông sản lời gấp đôi), nâng cấp sức chứa.
//  - Ôn kho từ: trả lời nhanh các từ đã thuộc lòng, mỗi câu đúng +xu (giới hạn mỗi ngày) — không đổi lịch SRS.
//  - Từ đã thuộc: danh sách từ MASTERED, nghe lại.
export default function BarnPanel({ userId, farm, catalog, onClose, onState, onToast }: {
  userId: string; farm: FarmView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [tab, setTab] = useState<"STOCK" | "QUIZ" | "WORDS">("STOCK");
  const [busy, setBusy] = useState<string | null>(null);

  // Tab từ đã thuộc
  const [words, setWords] = useState<BarnItem[] | null>(null);
  useEffect(() => { if (tab === "WORDS" && words === null) farmApi.barn(userId).then(setWords).catch(() => setWords([])); }, [tab, words, userId]);

  // Tab ôn kho
  const [quiz, setQuiz] = useState<{ items: BarnQuizItem[]; total: number } | null>(null);
  const [qi, setQi] = useState(0);
  const [ans, setAns] = useState("");
  const [res, setRes] = useState<{ correct: boolean; coins: number; word: string; meaning: string; example: string | null; left: number } | null>(null);
  const [earned, setEarned] = useState(0);
  const [right, setRight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const loadQuiz = () => { setQuiz(null); setQi(0); setAns(""); setRes(null); setEarned(0); setRight(0); farmApi.barnQuiz(userId).then(setQuiz).catch(() => setQuiz({ items: [], total: 0 })); };
  useEffect(() => { if (tab === "QUIZ" && quiz === null) loadQuiz(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tab === "QUIZ" && !res) inputRef.current?.focus(); }, [tab, qi, res, quiz]);

  const used = farm.barnUsed, cap = farm.barnCapacity;
  const pct = Math.min(100, (used / cap) * 100);
  const entries = Object.entries(farm.inventory).filter(([, n]) => n > 0);
  const totalValue = entries.reduce((s, [k, n]) => s + n * (catalog.producePrice[k] || 0), 0);

  const sell = async (key: string, qty: number) => {
    if (busy) return; setBusy(key);
    try { const s = await farmApi.barnSell(userId, key, qty); onState(s); onToast(`🪙 +${s.sold?.refund} xu (bán ${qty} ${produceInfo(catalog, key).name.toLowerCase()})`); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const sellAll = async () => {
    const r = await fire({ title: "Bán hết nông sản?", html: `Bán toàn bộ kho được <b>🪙 ${totalValue}</b>.<br/><small>Giữ lại một ít nếu bạn cần giao đơn nông sản (lời gấp đôi bán lẻ).</small>`, icon: "question", showCancelButton: true, confirmButtonText: "Bán hết", cancelButtonText: "Thôi", confirmButtonColor: "#1E3A8A" });
    if (!r.isConfirmed) return;
    setBusy("ALL");
    try { let s: FarmState | null = null; for (const [k, n] of entries) s = await farmApi.barnSell(userId, k, n); if (s) { onState(s); onToast(`🪙 +${totalValue} xu`); } }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const upgrade = async () => {
    const next = farm.nextBarnTier; if (!next) return;
    const r = await fire({ title: "Nâng cấp kho?", html: `Sức chứa <b>${cap} → ${next.capacity}</b><br/>Giá <b>🪙 ${next.price}</b>`, icon: "question", showCancelButton: true, confirmButtonText: "Nâng cấp", cancelButtonText: "Thôi", confirmButtonColor: "#1E3A8A" });
    if (!r.isConfirmed) return;
    setBusy("UP");
    try { const s = await farmApi.barnUpgrade(userId); onState(s); onToast(`🧺 Kho đã chứa được ${s.farm.barnCapacity}`); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };

  const submitQuiz = async () => {
    if (!quiz || res || busy) return; const it = quiz.items[qi]; if (!ans.trim()) return;
    setBusy("Q");
    try { const r = await farmApi.barnQuizAnswer(userId, it.progressId, ans); setRes(r); if (r.correct) { setRight((x) => x + 1); setEarned((x) => x + r.coins); } speak(r.word); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const nextQuiz = async () => {
    if (!quiz) return;
    if (qi + 1 >= quiz.items.length) { setQi(quiz.items.length); if (earned > 0) { const s = await farmApi.state(userId).catch(() => null); if (s) onState(s); } return; }
    setQi(qi + 1); setAns(""); setRes(null);
  };

  return (
    <Modal title="🧺 Kho" subtitle={`Nông sản ${used}/${cap} · ${farm.barnCount} từ đã cất · còn ${farm.barnQuizLeft} lượt thưởng ôn kho hôm nay`} onClose={onClose}>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setTab("STOCK")} className={`ui-chip ${tab === "STOCK" ? "ui-chip-active" : ""}`}>🌾 Nông sản</button>
        <button onClick={() => setTab("QUIZ")} className={`ui-chip ${tab === "QUIZ" ? "ui-chip-active" : ""}`}>🧠 Ôn kho từ</button>
        <button onClick={() => setTab("WORDS")} className={`ui-chip ${tab === "WORDS" ? "ui-chip-active" : ""}`}>⭐ Từ đã thuộc</button>
      </div>

      {tab === "STOCK" && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-bold text-muted"><span>Kho cấp {farm.barnTier}</span><span>{used}/{cap}{used >= cap ? " · ĐẦY" : ""}</span></div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={`h-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} /></div>
            {used >= cap && <p className="text-xs text-red-600 font-semibold mt-1">Kho đầy: nông sản thu hoạch thêm sẽ tự bán nửa giá. Bán bớt hoặc nâng cấp kho.</p>}
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted">
              <div className="text-5xl mb-2">🧺</div>
              <p className="font-semibold">Kho nông sản còn trống.</p>
              <p className="mt-1">Mỗi lần thu hoạch đúng, bạn nhận 1–2 nông sản của loại cây đó. Đem bán hoặc giữ lại giao đơn nông sản.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entries.map(([key, n]) => {
                const c = produceInfo(catalog, key); const price = catalog.producePrice[key] || 0;
                return (
                  <div key={key} className="rounded-2xl border border-line bg-white p-3 flex items-center gap-3">
                    <div className="text-4xl leading-none">{c?.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground leading-tight">{c?.name} <span className="text-primary">×{n}</span></p>
                      <p className="text-xs text-muted">🪙 {price} / cái · tổng {price * n}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button disabled={!!busy} onClick={() => sell(key, 1)} className="btn-outline rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50">Bán 1</button>
                      {n > 1 && <button disabled={!!busy} onClick={() => sell(key, n)} className="btn-outline rounded-full px-3 py-1 text-xs font-bold disabled:opacity-50">Bán hết</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap gap-2 items-center justify-between rounded-2xl bg-primary-soft px-4 py-3">
            <div>
              <p className="font-extrabold text-primary">Nâng cấp kho</p>
              <p className="text-xs text-muted">{farm.nextBarnTier ? `Sức chứa ${cap} → ${farm.nextBarnTier.capacity}` : "Kho đã lớn tối đa"}</p>
            </div>
            <div className="flex gap-2">
              {entries.length > 1 && <button disabled={!!busy} onClick={sellAll} className="btn-outline rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">Bán tất cả (🪙 {totalValue})</button>}
              {farm.nextBarnTier && <button disabled={!!busy || farm.coins < farm.nextBarnTier.price} onClick={upgrade} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">🪙 {farm.nextBarnTier.price}</button>}
            </div>
          </div>
          <p className="text-xs text-muted">Mẹo: đơn hàng "Giao nông sản" thưởng gấp khoảng 2 lần giá bán lẻ — nên giữ lại ít nông sản để giao khi có đơn.</p>
        </div>
      )}

      {tab === "QUIZ" && (
        quiz === null ? <p className="text-center text-muted py-8">Đang lấy từ trong kho...</p> :
        quiz.total === 0 ? (
          <div className="text-center py-8 text-sm text-muted">
            <div className="text-5xl mb-2">🌱</div>
            <p className="font-semibold">Chưa có từ nào thuộc lòng để ôn.</p>
            <p className="mt-1">Một từ được coi là thuộc lòng khi lịch ôn của nó dài hơn 21 ngày. Hãy thu hoạch đều đặn nhé!</p>
          </div>
        ) : qi >= quiz.items.length ? (
          <div className="text-center py-6 space-y-3 farm-toast">
            <div className="text-5xl">🎉</div>
            <p className="text-xl font-extrabold text-primary">Xong lượt ôn kho!</p>
            <p className="text-foreground">Đúng <b>{right}/{quiz.items.length}</b> · nhận <b>🪙 {earned}</b></p>
            {farm.barnQuizLeft <= 0 && <p className="text-xs text-muted">Hôm nay bạn đã hết lượt thưởng, mai quay lại nhé (vẫn ôn được, chỉ không có xu).</p>}
            <button onClick={loadQuiz} className="btn-primary rounded-full px-6 py-2.5 font-bold">Ôn lượt mới</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-between text-xs font-bold text-muted"><span>Câu {qi + 1}/{quiz.items.length}</span><span>Đã nhận 🪙 {earned}</span></div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${((qi + (res ? 1 : 0)) / quiz.items.length) * 100}%` }} /></div>
            <div className="rounded-2xl bg-primary-soft px-4 py-4">
              <p className="text-xs uppercase tracking-wide text-muted font-bold">Nghĩa</p>
              <p className="text-2xl font-extrabold text-primary leading-tight">{quiz.items[qi].meaning}</p>
              {quiz.items[qi].example && <p className="text-sm text-foreground mt-2 italic">“{quiz.items[qi].example}”</p>}
              <p className="font-mono tracking-widest text-primary mt-2">{quiz.items[qi].hint}</p>
            </div>
            {!res ? (
              <form onSubmit={(e) => { e.preventDefault(); submitQuiz(); }} className="space-y-3">
                <input ref={inputRef} value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Gõ từ tiếng Anh..." autoComplete="off" autoCapitalize="off" spellCheck={false} className="ui-input w-full text-lg font-bold" />
                <div className="flex justify-end"><button type="submit" disabled={busy === "Q" || !ans.trim()} className="btn-primary rounded-full px-6 py-2.5 font-bold disabled:opacity-50">{busy === "Q" ? "..." : "Kiểm tra"}</button></div>
              </form>
            ) : (
              <div className="space-y-3 text-center">
                <div className={`rounded-2xl px-4 py-3 ${res.correct ? "bg-emerald-50" : "bg-amber-50"}`}>
                  <p className="text-sm font-bold">{res.correct ? (res.coins > 0 ? `✅ Chính xác! +${res.coins} xu` : "✅ Chính xác! (hết lượt thưởng hôm nay)") : "❌ Chưa đúng"}</p>
                  <p className="text-2xl font-extrabold text-primary mt-1">{res.word}</p>
                  <button onClick={() => speak(res.word)} className="mt-1 btn-outline rounded-full px-3 py-1 text-xs font-bold">🔊 Nghe</button>
                </div>
                <button onClick={nextQuiz} className="btn-primary rounded-full px-6 py-2.5 font-bold">{qi + 1 >= quiz.items.length ? "Xem kết quả" : "Câu tiếp →"}</button>
              </div>
            )}
          </div>
        )
      )}

      {tab === "WORDS" && (
        words === null ? <p className="text-center text-muted py-8">Đang mở kho...</p> : words.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted">
            <div className="text-5xl mb-2">🌱</div>
            <p className="font-semibold">Chưa có từ thuộc lòng.</p>
            <p className="mt-1">Từ nhớ đúng nhiều lần đến mức lịch ôn cách hơn 21 ngày sẽ xuất hiện ở đây với ⭐.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {words.map((w) => (
              <div key={w.progressId} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2">
                <button onClick={() => speak(w.word)} className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary">🔊</button>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-foreground">{w.word} {w.phonetic && <span className="text-xs text-muted font-normal">/{w.phonetic}/</span>}</p>
                  <p className="text-sm text-muted truncate">{w.meaning}{w.example ? ` · “${w.example}”` : ""}</p>
                </div>
                <span className="ui-badge text-[10px] bg-emerald-100 text-emerald-800">{w.onPlot ? "trên đất" : "trong kho"} · {w.interval}d</span>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}
