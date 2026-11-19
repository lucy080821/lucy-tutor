"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { farmApi, produceInfo, speak, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";

// Chợ làng: giá nông sản đổi theo NGÀY (0,8–1,4 × giá kho). Hàng nào đang giá cao thì bán, hàng thấp giá thì để dành giao đơn.
export default function MarketPanel({ userId, farm, catalog, onClose, onState, onToast }: {
  userId: string; farm: FarmView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [mults, setMults] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { farmApi.market(userId).then((r) => setMults(r.mults)).catch(() => setMults({})); }, [userId]);
  const keys = Object.keys(catalog.producePrice).sort((a, b) => ((farm.inventory[b] || 0) > 0 ? 1 : 0) - ((farm.inventory[a] || 0) > 0 ? 1 : 0) || (mults?.[b] ?? 1) - (mults?.[a] ?? 1)); // hàng đang có lên đầu, rồi theo giá cao
  const sell = async (key: string, qty: number) => {
    if (busy) return; setBusy(key);
    try { const s = await farmApi.marketSell(userId, key, qty); onState(s); onToast(`Đã bán ${qty} ${produceInfo(catalog, key).name.toLowerCase()}: +${s.sold?.refund} xu (giá chợ ×${s.sold?.mult})`); } catch (e: any) { onToast(e.message); }
    setBusy(null);
  };
  return (
    <Modal title="Chợ làng" subtitle="Village Market — giá thay đổi mỗi ngày" onClose={onClose}>
      <p className="text-sm text-muted">Giá chợ hôm nay = giá kho × hệ số ngày. <b className="text-emerald-700">Xanh</b> là giá cao (nên bán), <b className="text-red-600">đỏ</b> là giá thấp (nên để dành giao đơn hoặc chờ ngày mai).</p>
      {!mults ? <p className="py-8 text-center text-sm text-muted">Đang mở chợ...</p> : (
        <ul className="mt-3 divide-y divide-line">
          {keys.map((k) => {
            const info = produceInfo(catalog, k); const base = catalog.producePrice[k]; const m = mults[k] ?? 1; const have = farm.inventory[k] || 0; const price = Math.round(base * m);
            return (
              <li key={k} className="py-2.5 flex items-center gap-3">
                <span className="text-2xl w-9 text-center">{info.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-foreground">{info.name} <button type="button" onClick={() => speak(k)} className="text-xs text-primary ml-1" aria-label={`Nghe ${k}`}>🔊 {k}</button></p>
                  <p className="text-xs text-muted">Giá kho {base} → chợ <b className={m >= 1 ? "text-emerald-700" : "text-red-600"}>{price} xu</b> ({m >= 1 ? "▲" : "▼"} {Math.round(Math.abs(m - 1) * 100)}%) · Đang có {have}</p>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button disabled={!have || busy === k} onClick={() => sell(k, 1)} className="btn-outline rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40">Bán 1</button>
                  <button disabled={!have || busy === k} onClick={() => sell(k, have)} className="btn-primary rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40">Bán hết</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
