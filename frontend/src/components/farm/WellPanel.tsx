"use client";
import Modal from "./Modal";
import { formatCountdown, type Catalog, type FarmView, type PlotView } from "@/lib/farm/api";
import { liveStatus } from "./FarmScene";

// Giếng nước: nơi lấy nước để TƯỚI CÂY. Không có giếng thì không tưới được; mỗi giếng thêm 1 lượt tưới/cây/ngày (tối đa 3 giếng).
export default function WellPanel({ farm, plots, catalog, now, onPick, onShop, onClose }: {
  farm: FarmView; plots: PlotView[]; catalog: Catalog; now: number; onPick: (p: PlotView) => void; onShop: () => void; onClose: () => void;
}) {
  const growing = plots.filter((p) => p.status !== "EMPTY" && liveStatus(p, now).status === "GROWING");
  const maxWells = catalog.decor.well?.maxCount ?? 3;
  return (
    <Modal title="Giếng nước" subtitle={`Bạn có ${farm.wells} giếng · mỗi cây tưới tối đa ${farm.waterMax} lần/ngày`} onClose={onClose}>
      <p className="rounded-xl bg-primary-soft px-4 py-3 text-sm text-muted leading-relaxed">
        Lấy nước từ giếng rồi chọn cây để <b className="text-foreground">tưới bằng kiến thức</b>: gõ lại 1 từ bạn đã học, cây rút <b className="text-foreground">{Math.round(catalog.water.cut * 100)}% thời gian còn lại</b>.
        Có thêm giếng thì mỗi cây được tưới nhiều lần hơn mỗi ngày (1 giếng 3 lần, 2 giếng 4 lần, 3 giếng 5 lần).
      </p>
      <p className="text-xs font-bold text-muted uppercase mt-4 mb-2">Cây đang lớn ({growing.length})</p>
      {growing.length === 0 ? <p className="text-sm text-muted">Chưa có cây nào đang lớn để tưới. Hãy trồng thêm từ mới!</p> : (
        <ul className="space-y-2">
          {growing.map((p) => {
            const live = liveStatus(p, now);
            const left = Math.max(0, farm.waterMax - (p.waterUsed || 0));
            return (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                <span className="text-2xl">{p.cropKey ? catalog.crops[p.cropKey]?.emoji : "🌱"}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-primary truncate">{p.meaning || "Cây"}</p>
                  <p className="text-xs text-muted">Chín sau {formatCountdown(live.msLeft)} · còn {left}/{farm.waterMax} lượt tưới hôm nay</p>
                </div>
                <button disabled={left <= 0} onClick={() => onPick(p)} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-40">{left > 0 ? "Tưới" : "Hết lượt"}</button>
              </li>
            );
          })}
        </ul>
      )}
      {farm.wells < maxWells && (
        <button onClick={onShop} className="btn-outline rounded-full px-4 py-2.5 font-bold w-full mt-4">Xây thêm giếng (tối đa {maxWells}) để tưới được nhiều hơn</button>
      )}
    </Modal>
  );
}
