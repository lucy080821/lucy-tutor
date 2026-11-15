"use client";
import Modal from "./Modal";
import { formatCountdown, speak, type Catalog, type PlotView } from "@/lib/farm/api";
import { liveStatus } from "./FarmScene";

// Cây đang lớn: xem thẻ từ + các cách rút ngắn thời gian chờ mà VẪN HỌC (không mua được thời gian bằng xu):
// Ôn sớm (gõ từ, thưởng giảm) · Tưới nước (trả lời từ đã học khác, rút 10% thời gian còn lại) · Nhổ / Cất kho.
export default function GrowingPanel({ plot, catalog, now, onClose, onEarly, onWater, onRemove }: {
  plot: PlotView; catalog: Catalog; now: number; onClose: () => void; onEarly: () => void; onWater: () => void; onRemove: () => void;
}) {
  const live = liveStatus(plot, now);
  const mastered = plot.srs?.status === "MASTERED";
  const ratePct = Math.round(catalog.early.rewardRate * 100);
  return (
    <Modal title={plot.word || "Cây đang lớn"} subtitle={live.status === "READY" ? "Cây đã chín!" : `Chín sau ${formatCountdown(live.msLeft)}${plot.wilted ? " (đang héo, học lại từ đầu)" : ""}`} onClose={onClose}>
      <div className="rounded-2xl bg-primary-soft px-4 py-3 text-center">
        <p className="text-xl font-extrabold text-primary">{plot.meaning}</p>
        {plot.example && <p className="text-sm italic text-muted mt-1">“{plot.example}”</p>}
        <p className="text-xs text-muted mt-2">Đã nhớ đúng {plot.srs?.repetitions ?? 0} lần · {mastered ? "Thuộc lòng" : plot.srs?.status === "REVIEWING" ? "Đang ôn" : "Mới"}</p>
      </div>
      <p className="text-xs font-bold text-muted uppercase mt-4 mb-2">Muốn không phải chờ?</p>
      <div className="grid gap-2">
        <button onClick={onEarly} className="farm-item text-left rounded-2xl border border-line bg-white px-4 py-3 hover:border-primary">
          <p className="font-extrabold text-primary">✍️ Ôn sớm</p>
          <p className="text-xs text-muted mt-0.5">Gõ từ tiếng Anh, không gợi ý. Đúng thì thu hoạch ngay, thưởng {ratePct}%; sai thì cây vẫn lớn, không héo.</p>
        </button>
        <button onClick={onWater} className="farm-item text-left rounded-2xl border border-line bg-white px-4 py-3 hover:border-primary">
          <p className="font-extrabold text-primary">💧 Tưới nước bằng kiến thức</p>
          <p className="text-xs text-muted mt-0.5">Trả lời 1 từ bạn đã học: cây rút {Math.round(catalog.water.cut * 100)}% thời gian còn lại (tối đa {catalog.water.maxPerDay} lần/ngày cho mỗi cây).</p>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onClick={() => speak(plot.word || "")} className="btn-outline rounded-full px-4 py-2.5 font-bold">🔊 Nghe</button>
        <button onClick={onRemove} className="btn-ghost rounded-full px-4 py-2.5 font-bold text-amber-700">{mastered ? "Cất kho (+xu)" : "Nhổ cây"}</button>
      </div>
    </Modal>
  );
}
