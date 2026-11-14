"use client";
import { useState } from "react";
import { alert as swalAlert, fire } from "./farmSwal";
import { farmApi, type Catalog, type FarmState, type OrderView } from "@/lib/farm/api";

// Bảng đơn hàng (luôn hiện cạnh nông trại). Đơn "Viết câu" chấm bằng AI (Groq) hoặc quy tắc.
export default function OrdersPanel({ userId, orders, catalog, coins, difficulty, onState, onToast }: {
  userId: string; orders: OrderView[]; catalog: Catalog; coins: number; difficulty?: number; onState: (s: FarmState) => void; onToast: (msg: string) => void;
}) {
  const [sentences, setSentences] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, { ok: boolean; text: string; corrected?: string }>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const deliver = async (o: OrderView) => {
    if (busy) return;
    setBusy(o.id);
    try {
      const s = await farmApi.completeOrder(userId, o.id, sentences[o.id]);
      if (o.kind === "SENTENCE" && s.ok === false) {
        setFeedback((f) => ({ ...f, [o.id]: { ok: false, text: s.feedback || "Chưa đạt, thử lại nhé.", corrected: s.corrected } }));
      } else {
        onState(s as FarmState);
        const d = (s as FarmState).delivered;
        onToast(`${o.customer} cảm ơn! 🪙 +${o.rewardCoins}${o.rewardGems ? ` 💎 +${o.rewardGems}` : ""} ⚡ +${o.rewardXp} XP`);
        if (d?.feedback) fire({ icon: "success", title: "Khách hài lòng!", html: `<p>${d.feedback}</p>${d.corrected && d.corrected !== sentences[o.id] ? `<p class="mt-2 text-sm">Gợi ý câu hay hơn: <i>${d.corrected}</i></p>` : ""}`, confirmButtonColor: "#1E3A8A" });
        setSentences((x) => { const y = { ...x }; delete y[o.id]; return y; });
      }
    } catch (e: any) { swalAlert("Lỗi", e.message, "error"); }
    setBusy(null);
  };

  const trash = async (o: OrderView) => {
    const r = await fire({ title: "Bỏ đơn này?", text: `Tốn ${catalog.orderTrashCost} xu, đơn mới sẽ xuất hiện ngay.`, icon: "question", showCancelButton: true, confirmButtonText: "Bỏ đơn", cancelButtonText: "Giữ lại", confirmButtonColor: "#1E3A8A" });
    if (!r.isConfirmed) return;
    try { onState(await farmApi.trashOrder(userId, o.id)); } catch (e: any) { swalAlert("Lỗi", e.message, "error"); }
  };

  const kindIcon: Record<string, string> = { HARVEST: "🌾", HARVEST_CROP: "🌾", PLANT: "🌱", SENTENCE: "✍️", PRODUCE: "🚚" };

  return (
    <div className="ui-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-primary text-lg">🚚 Đơn hàng</h3>
        <span className="text-xs text-muted font-semibold">{orders.filter((o) => o.ready).length} đơn đủ hàng{difficulty ? ` · độ khó ${difficulty}` : ""}</span>
      </div>
      <div className="space-y-3">
        {orders.map((o) => {
          const fb = feedback[o.id];
          const crop = o.requirement.cropKey ? catalog.crops[o.requirement.cropKey] : null;
          return (
            <div key={o.id} className={`rounded-2xl border p-3 ${o.ready ? "border-emerald-300 bg-emerald-50/60" : "border-line bg-white"}`}>
              <div className="flex items-start gap-2">
                <div className="text-2xl leading-none">{kindIcon[o.kind]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-muted">{o.customer}</p>
                  <p className="font-bold text-foreground leading-snug">{o.title}{crop ? "" : ""}</p>
                </div>
                <button onClick={() => trash(o)} disabled={coins < catalog.orderTrashCost} title={`Bỏ đơn (−${catalog.orderTrashCost} xu)`} className="w-9 h-9 rounded-full hover:bg-red-50 text-muted hover:text-red-600 flex items-center justify-center disabled:opacity-40">🗑️</button>
              </div>
              {o.kind === "PRODUCE" ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(o.requirement.items || {}).map(([k, n]) => {
                    const have = o.have?.[k] ?? 0; const ok = have >= n;
                    return <span key={k} className={`ui-badge text-xs ${ok ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{catalog.crops[k]?.emoji} {Math.min(have, n)}/{n}</span>;
                  })}
                  {!o.ready && <span className="text-[11px] text-muted self-center">Thu hoạch để có nông sản trong kho</span>}
                </div>
              ) : o.kind !== "SENTENCE" ? (
                <div className="mt-2">
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (o.progress / o.need) * 100)}%` }} /></div>
                  <p className="text-xs text-muted mt-1 font-semibold">{Math.min(o.progress, o.need)}/{o.need}</p>
                </div>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea value={sentences[o.id] || ""} onChange={(e) => setSentences((s) => ({ ...s, [o.id]: e.target.value }))} rows={2} placeholder={`Viết 1 câu tiếng Anh (≥ ${o.requirement.minWords ?? 4} từ) dùng ${o.requirement.words?.map((w) => `"${w}"`).join(" và ")}...`} className="ui-input w-full text-sm" />
                  {fb && !fb.ok && <div className="rounded-xl bg-amber-50 text-amber-900 text-xs px-3 py-2 font-semibold">{fb.text}{fb.corrected && <div className="mt-1 italic font-normal">Gợi ý: {fb.corrected}</div>}</div>}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-xs font-extrabold text-amber-700">🪙 {o.rewardCoins}{o.rewardGems ? ` · 💎 ${o.rewardGems}` : ""} · ⚡ {o.rewardXp}</p>
                <button onClick={() => deliver(o)} disabled={busy === o.id || (o.kind === "SENTENCE" ? !(sentences[o.id] || "").trim() : !o.ready)}
                  className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">{busy === o.id ? "..." : o.kind === "SENTENCE" ? "Gửi câu" : "Giao hàng"}</button>
              </div>
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-muted text-center py-4">Khách đang tới...</p>}
      </div>
    </div>
  );
}
