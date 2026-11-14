"use client";
import { useState } from "react";
import Modal from "./Modal";
import type { Catalog, FarmView } from "@/lib/farm/api";

// Cửa hàng: trang trí (giải trí thuần, không bắt học) + mua thêm ô đất / mở rộng lưới.
// Chọn món → đóng cửa hàng → chọn ô trống trên đất để đặt (chế độ "place" ở FarmGame).
export default function ShopPanel({ farm, catalog, onClose, onPick, onExpand }: {
  farm: FarmView; catalog: Catalog; onClose: () => void;
  onPick: (itemKey: string, label: string) => void; onExpand: () => void;
}) {
  const [tab, setTab] = useState<"DECOR" | "LAND">("DECOR");
  const [cur, setCur] = useState<"all" | "coins" | "gems">("all");
  const decor = Object.entries(catalog.decor).filter(([, d]) => cur === "all" || d.currency === cur).sort((a, b) => a[1].minLevel - b[1].minLevel || a[1].price - b[1].price);
  const exp = farm.nextExpansion;

  return (
    <Modal title="🛒 Cửa hàng" subtitle={`🪙 ${farm.coins} xu · 💎 ${farm.gems} kim cương · Cấp ${farm.level}`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setTab("DECOR")} className={`ui-chip ${tab === "DECOR" ? "ui-chip-active" : ""}`}>🎨 Trang trí</button>
        <button onClick={() => setTab("LAND")} className={`ui-chip ${tab === "LAND" ? "ui-chip-active" : ""}`}>🟫 Đất đai</button>
        {tab === "DECOR" && (
          <div className="ml-auto flex gap-1">
            {(["all", "coins", "gems"] as const).map((c) => <button key={c} onClick={() => setCur(c)} className={`ui-chip text-xs ${cur === c ? "ui-chip-active" : ""}`}>{c === "all" ? "Tất cả" : c === "coins" ? "🪙 Xu" : "💎 Kim cương"}</button>)}
          </div>
        )}
      </div>

      {tab === "DECOR" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {decor.map(([key, d]) => {
            const locked = farm.level < d.minLevel;
            const afford = (d.currency === "coins" ? farm.coins : farm.gems) >= d.price;
            return (
              <button key={key} disabled={locked || !afford} onClick={() => onPick(key, d.name)}
                className="farm-item relative rounded-2xl border border-line bg-white p-3 text-left disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary">
                <div className="text-4xl leading-none">{key === "path" ? "🟫" : d.emoji}</div>
                <p className="font-bold text-foreground mt-2 leading-tight">{d.name}</p>
                <p className="text-sm font-extrabold text-primary mt-0.5">{d.currency === "coins" ? "🪙" : "💎"} {d.price}</p>
                {locked && <span className="absolute top-2 right-2 ui-badge text-[10px] bg-slate-100 text-slate-600">🔒 Cấp {d.minLevel}</span>}
                {!locked && !afford && <span className="absolute top-2 right-2 ui-badge text-[10px] bg-amber-100 text-amber-800">Thiếu {d.currency === "coins" ? "xu" : "💎"}</span>}
              </button>
            );
          })}
        </div>
      )}

      {tab === "LAND" && (
        <div className="space-y-3">
          <div className="ui-card p-4 flex items-center gap-4">
            <div className="text-4xl">🟫</div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-foreground">Thêm 1 ô đất</p>
              <p className="text-sm text-muted">Đang có {farm.plotCount}/{catalog.maxPlots} ô. Mỗi ô trồng được thêm 1 từ.</p>
            </div>
            {farm.plotPrice === null ? <span className="ui-badge">Tối đa</span> : (
              <button disabled={farm.coins < farm.plotPrice} onClick={() => onPick("plot", "ô đất mới")} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-50">🪙 {farm.plotPrice}</button>
            )}
          </div>
          <div className="ui-card p-4 flex items-center gap-4">
            <div className="text-4xl">🗺️</div>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-foreground">Mở rộng đất</p>
              <p className="text-sm text-muted">Lưới hiện tại {farm.gridW}×{farm.gridH}. {exp ? `Bậc tiếp theo ${exp.w}×${exp.h}, cần cấp ${exp.minLevel}.` : "Đã rộng tối đa."}</p>
            </div>
            {exp && <button disabled={farm.coins < exp.price || farm.level < exp.minLevel} onClick={onExpand} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-50">🪙 {exp.price}</button>}
          </div>
          <p className="text-xs text-muted">Mẹo: kim cương không rút ngắn thời gian cây lớn (đó là lịch ôn tối ưu của bạn) — chỉ dùng để mua đồ hiếm.</p>
        </div>
      )}
    </Modal>
  );
}
