"use client";
import { useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert } from "./farmSwal";
import { farmApi, formatCountdown, produceInfo, type Catalog, type DecorPlaced, type FarmState, type FarmView } from "@/lib/farm/api";

// Nhà máy chế biến: chọn công thức → bỏ nguyên liệu (nông sản trong Kho) vào → chờ → thu thành phẩm (giá bán cao hơn nhiều).
// Mỗi nhà máy làm 1 mẻ một lúc; chạy theo giờ thật, kim cương không rút ngắn được.
export default function FactoryPanel({ userId, uid, farm, catalog, now, onClose, onState, onToast }: {
  userId: string; uid: string; farm: FarmView; catalog: Catalog; now: number; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const d: DecorPlaced | undefined = farm.layout.find((x) => x.uid === uid);
  const fac = d ? catalog.factories[d.key] : undefined;
  if (!d || !fac) return null;

  const job = d.job;
  const jobRec = job ? fac.recipes.find((r) => r.id === job.recipe) : undefined;
  const jobProd = jobRec ? catalog.products[jobRec.product] : undefined;
  const left = job ? new Date(job.readyAt).getTime() - now : 0;
  const done = !!job && left <= 0;
  const pct = job && jobRec ? Math.max(0, Math.min(100, (1 - left / (jobRec.minutes * 60000)) * 100)) : 0;
  const barnFull = farm.barnUsed >= farm.barnCapacity;

  const start = async (id: string) => {
    if (busy) return; setBusy(id);
    try { onState(await farmApi.factoryStart(userId, uid, id)); onToast(`${fac.emoji} Đã bỏ nguyên liệu vào ${fac.name.toLowerCase()}`); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const collect = async () => {
    if (busy) return; setBusy("collect");
    try { const s = await farmApi.factoryCollect(userId, uid); onState(s); onToast(`${jobProd?.emoji} +1 ${jobProd?.name} (bán được 🪙 ${jobProd?.price})`); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };

  return (
    <Modal title={`${fac.emoji} ${fac.name}`} subtitle={`Kho ${farm.barnUsed}/${farm.barnCapacity} · bỏ nông sản vào để chế biến thành đồ giá cao`} onClose={onClose}>
      {job && jobRec && jobProd && (
        <div className="rounded-2xl bg-primary-soft p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl leading-none">{jobProd.emoji}</div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-primary leading-tight">{done ? `${jobProd.name} đã xong!` : `Đang làm ${jobProd.name}`}</p>
              <p className="text-xs text-muted">{done ? "Thu về Kho để bán hoặc giữ" : `Còn ${formatCountdown(left)}`}</p>
            </div>
            {done && <button onClick={collect} disabled={busy === "collect" || barnFull} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-50">Thu</button>}
          </div>
          {!done && <div className="h-2 rounded-full bg-white overflow-hidden mt-3"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>}
          {done && barnFull && <p className="text-xs font-semibold text-red-700 mt-2">Kho đầy — bán bớt hoặc nâng cấp Kho trước khi thu.</p>}
        </div>
      )}

      <p className="text-xs font-bold text-muted uppercase mb-2">Công thức</p>
      <div className="space-y-2">
        {fac.recipes.map((r) => {
          const prod = catalog.products[r.product];
          const ok = Object.entries(r.inputs).every(([k, n]) => (farm.inventory[k] || 0) >= n);
          const cost = Object.entries(r.inputs).reduce((a, [k, n]) => a + n * (catalog.producePrice[k] || 0), 0);
          return (
            <div key={r.id} className={`rounded-2xl border p-3 flex flex-wrap items-center gap-3 ${job ? "border-line bg-slate-50 opacity-70" : "border-line bg-white"}`}>
              <div className="text-4xl leading-none">{prod.emoji}</div>
              <div className="flex-1 min-w-[150px]">
                <p className="font-bold text-foreground leading-tight">{prod.name}</p>
                <p className="text-xs text-muted">⏱ {r.minutes} phút · bán 🪙 <b className="text-primary">{prod.price}</b> <span className="text-emerald-700 font-bold">(nguyên liệu bán lẻ chỉ {cost})</span></p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Object.entries(r.inputs).map(([k, n]) => {
                    const have = farm.inventory[k] || 0; const info = produceInfo(catalog, k);
                    return <span key={k} className={`ui-badge text-xs ${have >= n ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"}`}>{info.emoji} {Math.min(have, 99)}/{n}</span>;
                  })}
                </div>
              </div>
              <button onClick={() => start(r.id)} disabled={!!job || !ok || busy === r.id} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">{job ? "Đang bận" : ok ? "Bắt đầu" : "Thiếu hàng"}</button>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted mt-3">Nguyên liệu là nông sản trong Kho (thu hoạch đúng để có). Thành phẩm vào Kho và bán ở mục Kho.</p>
    </Modal>
  );
}
