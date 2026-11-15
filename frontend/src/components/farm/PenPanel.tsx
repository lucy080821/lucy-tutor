"use client";
import { useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert } from "./farmSwal";
import { farmApi, formatCountdown, produceInfo, type Catalog, type DecorPlaced, type FarmState, type FarmView } from "@/lib/farm/api";

// Chuồng trại: mua vật nuôi → cho ăn bằng nông sản trong Kho → chờ → thu sản phẩm (trứng, sữa, thịt xông khói, len).
// Đang xây thì hiện tiến độ và nút "Xong ngay" (bù thêm phần chênh lệch giữa Xây và Mua ngay).
export default function PenPanel({ userId, uid, farm, catalog, now, onClose, onState, onToast }: {
  userId: string; uid: string; farm: FarmView; catalog: Catalog; now: number; onClose: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const d: DecorPlaced | undefined = farm.layout.find((x) => x.uid === uid);
  const pen = d ? catalog.pens[d.key] : undefined;
  if (!d || !pen) return null;
  const prod = catalog.products[pen.product];
  const n = d.animals || 0;
  const buildLeft = d.build ? new Date(d.build.readyAt).getTime() - now : 0;
  const building = !!d.build && buildLeft > 0;
  const jobLeft = d.job ? new Date(d.job.readyAt).getTime() - now : 0;
  const ready = !!d.job && jobLeft <= 0;
  const need = Object.entries(pen.feed).map(([k, v]) => [k, v * Math.max(1, n)] as const);
  const feedOk = n > 0 && need.every(([k, v]) => (farm.inventory[k] || 0) >= v);
  const skipCost = building && d.build ? Math.max(1, Math.ceil((pen.buyNow - pen.build) * Math.min(1, buildLeft / (pen.buildMinutes * 60000)))) : 0;

  const run = async (key: string, fn: () => Promise<FarmState>, msg?: (s: FarmState) => string) => {
    if (busy) return; setBusy(key);
    try { const s = await fn(); onState(s); if (msg) onToast(msg(s)); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };

  return (
    <Modal title={`${pen.emoji} ${pen.name}`} subtitle={building ? "Đang xây" : `${n}/${pen.capacity} ${pen.animalName.toLowerCase()} · ra ${prod.name.toLowerCase()}`} onClose={onClose}>
      {building ? (
        <div className="rounded-2xl bg-primary-soft p-4">
          <p className="font-extrabold text-primary">🔨 Đang xây chuồng, còn {formatCountdown(buildLeft)}</p>
          <div className="h-2 rounded-full bg-white overflow-hidden mt-3"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, (1 - buildLeft / (pen.buildMinutes * 60000)) * 100))}%` }} /></div>
          <button onClick={() => run("fin", () => farmApi.penFinish(userId, uid), () => "Xây xong ngay!")} disabled={!!busy || farm.coins < skipCost} className="mt-3 btn-highlight rounded-full px-5 py-2.5 font-bold w-full disabled:opacity-50">Xong ngay · 🪙 {skipCost}</button>
          <p className="text-xs text-muted mt-2 text-center">Xây thường rẻ hơn nhưng phải đợi; bấm "Xong ngay" bù thêm phần chênh lệch theo thời gian còn lại.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary-soft p-4">
            <div className="flex items-center gap-1 text-3xl leading-none min-h-[34px]">
              {Array.from({ length: pen.capacity }).map((_, i) => <span key={i} className={i < n ? "" : "opacity-20 grayscale"}>{pen.animal}</span>)}
            </div>
            <p className="text-xs text-muted mt-2">{n}/{pen.capacity} chỗ. Mỗi con cho 1 {prod.name.toLowerCase()} mỗi lần ({pen.minutes} phút), bán 🪙 {prod.price}/cái.</p>
            <button onClick={() => run("ani", () => farmApi.penAnimal(userId, uid), () => `Thêm 1 ${pen.animalName.toLowerCase()}!`)} disabled={!!busy || n >= pen.capacity || farm.coins < pen.animalPrice} className="mt-3 btn-outline rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">
              {n >= pen.capacity ? "Chuồng đã đầy" : `+ Mua ${pen.animalName.toLowerCase()} · 🪙 ${pen.animalPrice}`}
            </button>
          </div>

          {d.job ? (
            <div className="rounded-2xl border border-line p-4">
              <div className="flex items-center gap-3">
                <div className="text-4xl leading-none">{prod.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-primary leading-tight">{ready ? `${d.job.qty} ${prod.name.toLowerCase()} đã xong!` : `Đang tạo ${d.job.qty} ${prod.name.toLowerCase()}`}</p>
                  <p className="text-xs text-muted">{ready ? "Thu về Kho" : `Còn ${formatCountdown(jobLeft)}`}</p>
                </div>
                {ready && <button onClick={() => run("col", () => farmApi.penCollect(userId, uid), (s) => `${prod.emoji} +${s.penResult?.qty} ${prod.name.toLowerCase()} (bán 🪙 ${prod.price}/cái)`)} disabled={!!busy} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-50">Thu</button>}
              </div>
              {!ready && d.job && <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-3"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, (1 - jobLeft / (pen.minutes * 60000)) * 100))}%` }} /></div>}
            </div>
          ) : (
            <div className="rounded-2xl border border-line p-4">
              <p className="font-bold text-foreground">Cho ăn</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {need.map(([k, v]) => { const have = farm.inventory[k] || 0; const info = produceInfo(catalog, k); return <span key={k} className={`ui-badge text-xs ${n > 0 && have >= v ? "bg-emerald-100 text-emerald-800" : "bg-red-50 text-red-700"}`}>{info.emoji} {Math.min(have, 99)}/{v}</span>; })}
              </div>
              <button onClick={() => run("feed", () => farmApi.penFeed(userId, uid), () => `${pen.animalName} đang ăn, lát nữa có ${prod.name.toLowerCase()}`)} disabled={!!busy || !feedOk} className="mt-3 btn-primary rounded-full px-5 py-2.5 font-bold w-full disabled:opacity-50">{n === 0 ? "Mua vật nuôi trước" : feedOk ? "🌾 Cho ăn" : "Thiếu thức ăn"}</button>
              <p className="text-xs text-muted mt-2">Thức ăn là nông sản trong Kho (thu hoạch đúng để có).</p>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
