"use client";
import { useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert, fire } from "./farmSwal";
import { farmApi, sellValue, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";
import { PetSprite } from "./Sprites";

// Cửa hàng: Trang trí (nhiều nhóm) · Trang phục cho Qilin · Đất đai. Toàn bộ là giải trí, không bắt học.
// Trang trí: chọn món → đóng cửa hàng → chọn ô trống để đặt (chế độ "place" ở FarmGame).
// Trang phục: mua xong mặc luôn, đổi đồ ở panel thú cưng.
export default function ShopPanel({ userId, farm, catalog, onClose, onPick, onExpand, onState, onToast }: {
  userId: string; farm: FarmView; catalog: Catalog; onClose: () => void;
  onPick: (itemKey: string, label: string) => void; onExpand: () => void; onState: (s: FarmState) => void; onToast: (m: string) => void;
}) {
  const [tab, setTab] = useState<"DECOR" | "OUTFIT" | "LAND" | "SELL">("DECOR");
  const [cat, setCat] = useState("all");
  const [cur, setCur] = useState<"all" | "coins" | "gems">("all");
  const [slot, setSlot] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const afford = (price: number, currency: string) => (currency === "coins" ? farm.coins : farm.gems) >= price;
  const decor = Object.entries(catalog.decor)
    .filter(([, d]) => (cat === "all" || d.cat === cat) && (cur === "all" || d.currency === cur))
    .sort((a, b) => a[1].minLevel - b[1].minLevel || a[1].price - b[1].price);
  const outfits = Object.entries(catalog.outfits)
    .filter(([, o]) => slot === "all" || o.slot === slot)
    .sort((a, b) => a[1].minLevel - b[1].minLevel || a[1].price - b[1].price);
  const exp = farm.nextExpansion;

  // Xem thử: ghép đồ đang mặc với món đang chọn
  const equippedEmoji = Object.fromEntries(Object.entries(farm.wardrobe.equipped).map(([s, k]) => [s, catalog.outfits[k]?.emoji || ""]));
  const tryOn = preview ? { ...equippedEmoji, [catalog.outfits[preview].slot]: catalog.outfits[preview].emoji } : equippedEmoji;

  const buyOutfit = async (key: string) => {
    if (busy) return; setBusy(key);
    try { const s = await farmApi.wardrobeBuy(userId, key); onState(s); onToast(`👗 Qilin đã mặc ${catalog.outfits[key].name}!`); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };

  // Bán lại đồ đã mua: rất lỗ (chỉ lấy lại phần nhỏ, luôn bằng xu) để không mua đi bán lại kiếm lời
  const placed = farm.layout.reduce<Record<string, string[]>>((m, d) => { (m[d.key] ||= []).push(d.uid); return m; }, {});
  const sellDecor = async (key: string, uid: string) => {
    const item = catalog.decor[key]; const refund = sellValue(item, catalog);
    const r = await fire({ title: `Bán ${item.name}?`, html: `Bạn mua ${item.price} ${item.currency === "gems" ? "kim cương" : "xu"} nhưng bán lại chỉ được <b>${refund} xu</b>.`, showCancelButton: true, confirmButtonText: `Bán lấy ${refund} xu`, cancelButtonText: "Giữ lại", confirmButtonColor: "#b45309" });
    if (!r.isConfirmed || busy) return; setBusy(uid);
    try { const s = await farmApi.sell(userId, uid); onState(s); onToast(`Đã bán ${item.name} · +${refund} xu`); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const sellOutfit = async (key: string) => {
    const item = catalog.outfits[key]; const refund = sellValue(item, catalog);
    const r = await fire({ title: `Bán ${item.name}?`, html: `Bạn mua ${item.price} ${item.currency === "gems" ? "kim cương" : "xu"} nhưng bán lại chỉ được <b>${refund} xu</b>.`, showCancelButton: true, confirmButtonText: `Bán lấy ${refund} xu`, cancelButtonText: "Giữ lại", confirmButtonColor: "#b45309" });
    if (!r.isConfirmed || busy) return; setBusy(key);
    try { const s = await farmApi.wardrobeSell(userId, key); onState(s); onToast(`Đã bán ${item.name} · +${refund} xu`); } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const sellCount = farm.layout.length + farm.wardrobe.owned.length;

  return (
    <Modal title="🛒 Cửa hàng" subtitle={`🪙 ${farm.coins} xu · 💎 ${farm.gems} kim cương · Cấp ${farm.level}`} onClose={onClose} wide>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setTab("DECOR")} className={`ui-chip ${tab === "DECOR" ? "ui-chip-active" : ""}`}>🎨 Trang trí</button>
        <button onClick={() => setTab("OUTFIT")} className={`ui-chip ${tab === "OUTFIT" ? "ui-chip-active" : ""}`}>👒 Trang phục Qilin</button>
        <button onClick={() => setTab("LAND")} className={`ui-chip ${tab === "LAND" ? "ui-chip-active" : ""}`}>🟫 Đất đai</button>
        <button onClick={() => setTab("SELL")} className={`ui-chip ${tab === "SELL" ? "ui-chip-active" : ""}`}>💸 Bán lại ({sellCount})</button>
      </div>

      {tab === "DECOR" && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {catalog.decorCats.map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`ui-chip text-xs ${cat === c.id ? "ui-chip-active" : ""}`}>{c.name}</button>)}
            <span className="mx-1 w-px bg-line self-stretch" />
            {(["all", "coins", "gems"] as const).map((c) => <button key={c} onClick={() => setCur(c)} className={`ui-chip text-xs ${cur === c ? "ui-chip-active" : ""}`}>{c === "all" ? "Mọi giá" : c === "coins" ? "🪙 Xu" : "💎 Kim cương"}</button>)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {decor.map(([key, d]) => {
              const locked = farm.level < d.minLevel;
              const ok = afford(d.price, d.currency);
              return (
                <button key={key} disabled={locked || !ok} onClick={() => onPick(key, d.name)}
                  className="farm-item relative rounded-2xl border border-line bg-white p-3 text-left disabled:opacity-50 disabled:cursor-not-allowed hover:border-primary">
                  <div className="text-4xl leading-none">{d.emoji}</div>
                  <p className="font-bold text-foreground mt-2 leading-tight">{d.name}</p>
                  <p className="text-sm font-extrabold text-primary mt-0.5">{d.currency === "coins" ? "🪙" : "💎"} {d.price}</p>
                  {locked && <span className="absolute top-2 right-2 ui-badge text-[10px] bg-slate-100 text-slate-600">🔒 Cấp {d.minLevel}</span>}
                  {!locked && !ok && <span className="absolute top-2 right-2 ui-badge text-[10px] bg-amber-100 text-amber-800">Thiếu {d.currency === "coins" ? "xu" : "💎"}</span>}
                </button>
              );
            })}
          </div>
          {decor.length === 0 && <p className="text-center text-muted text-sm py-6">Không có món nào trong nhóm này.</p>}
        </>
      )}

      {tab === "OUTFIT" && (
        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="rounded-2xl p-3 text-center self-start sm:sticky sm:top-16" style={{ background: "linear-gradient(180deg,#e0f2fe,#dcfce7)" }}>
            <svg viewBox="-70 -125 140 140" className="w-full max-w-[180px] mx-auto"><PetSprite level={farm.pet.level} size={1.35} outfit={tryOn} /></svg>
            <p className="text-xs font-bold text-primary mt-1">{preview ? `Thử: ${catalog.outfits[preview].name}` : farm.pet.name}</p>
            <p className="text-[11px] text-muted">Bấm 1 món để xem thử</p>
          </div>
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button onClick={() => setSlot("all")} className={`ui-chip text-xs ${slot === "all" ? "ui-chip-active" : ""}`}>Tất cả</button>
              {catalog.outfitSlots.map((s) => <button key={s.id} onClick={() => setSlot(s.id)} className={`ui-chip text-xs ${slot === s.id ? "ui-chip-active" : ""}`}>{s.name}</button>)}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {outfits.map(([key, o]) => {
                const owned = farm.wardrobe.owned.includes(key);
                const wearing = farm.wardrobe.equipped[o.slot] === key;
                const locked = farm.level < o.minLevel;
                const ok = afford(o.price, o.currency);
                return (
                  <div key={key} onClick={() => setPreview(key)} className={`farm-item relative rounded-2xl border p-3 cursor-pointer ${preview === key ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>
                    <div className="text-4xl leading-none">{o.emoji}</div>
                    <p className="font-bold text-foreground mt-2 leading-tight text-sm">{o.name}</p>
                    <p className="text-[11px] text-muted">{catalog.outfitSlots.find((s) => s.id === o.slot)?.name}</p>
                    {owned ? (
                      <span className={`mt-2 inline-block ui-badge text-[11px] ${wearing ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{wearing ? "Đang mặc" : "Đã có"}</span>
                    ) : (
                      <button disabled={locked || !ok || busy === key} onClick={(e) => { e.stopPropagation(); buyOutfit(key); }}
                        className="mt-2 btn-primary rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50">
                        {locked ? `🔒 Cấp ${o.minLevel}` : `${o.currency === "coins" ? "🪙" : "💎"} ${o.price}`}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted mt-3">Đồ đã mua đổi qua lại miễn phí ở panel {farm.pet.name}. Bạn bè thăm nông trại cũng thấy Qilin của bạn mặc gì.</p>
          </div>
        </div>
      )}

      {tab === "SELL" && (
        <div className="space-y-4">
          <p className="rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold px-3 py-2">Bán lại đồ đã mua rất lỗ: chỉ nhận lại khoảng {Math.round(catalog.decorSellRate * 100)}% giá xu (đồ kim cương đổi {catalog.gemSellCoins} xu mỗi viên). Cân nhắc kỹ — hoặc dời đồ sang ô khác thay vì bán.</p>
          <div>
            <p className="text-xs font-bold text-muted uppercase mb-2">Đồ trang trí đang đặt ({farm.layout.length})</p>
            {farm.layout.length === 0 ? <p className="text-sm text-muted">Chưa đặt món nào.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(placed).map(([key, uids]) => {
                  const d = catalog.decor[key]; if (!d) return null;
                  return (
                    <div key={key} className="rounded-2xl border border-line bg-white p-3">
                      <div className="text-3xl leading-none">{d.emoji}{uids.length > 1 && <span className="ml-1 text-sm font-extrabold text-primary align-middle">×{uids.length}</span>}</div>
                      <p className="font-bold text-foreground mt-1.5 leading-tight text-sm">{d.name}</p>
                      <button disabled={busy === uids[0]} onClick={() => sellDecor(key, uids[0])} className="mt-2 btn-outline rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50">Bán 1 · 🪙 {sellValue(d, catalog)}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-bold text-muted uppercase mb-2">Trang phục đã mua ({farm.wardrobe.owned.length})</p>
            {farm.wardrobe.owned.length === 0 ? <p className="text-sm text-muted">Chưa mua món nào.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {farm.wardrobe.owned.map((key) => {
                  const o = catalog.outfits[key]; if (!o) return null;
                  const wearing = farm.wardrobe.equipped[o.slot] === key;
                  return (
                    <div key={key} className="rounded-2xl border border-line bg-white p-3">
                      <div className="text-3xl leading-none">{o.emoji}</div>
                      <p className="font-bold text-foreground mt-1.5 leading-tight text-sm">{o.name}{wearing && <span className="ml-1 text-[10px] font-bold text-emerald-700">(đang mặc)</span>}</p>
                      <button disabled={busy === key} onClick={() => sellOutfit(key)} className="mt-2 btn-outline rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-50">Bán · 🪙 {sellValue(o, catalog)}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
