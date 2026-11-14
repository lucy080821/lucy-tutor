"use client";
import { useState } from "react";
import Modal from "./Modal";
import { alert as swalAlert, fire } from "./farmSwal";
import { farmApi, formatCountdown, produceInfo, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";
import { PetSprite } from "./Sprites";

const PHRASES = ["Grrr~ 💕", "Rawr! Chơi với tớ đi!", "Hôm nay học giỏi lắm!", "Tớ đói rồi...", "Zzz... hả? Tớ tỉnh rồi!", "Nữa đi nữa đi!", "Tớ là rồng nước xịn nhất!", "Thu hoạch xong chưa?"];
const TRICKS = ["Lộn vòng", "Bờm hồng", "Mọc cánh", "Phun bong bóng", "Nhảy múa", "Vương miện"];

// Thú cưng Qilin con — giải trí thuần: vuốt ve, cho ăn (1 lần/ngày), lớn lên qua cấp, đổi tên, và TỦ ĐỒ để thay trang phục
// (đồ mua ở Cửa hàng › Trang phục Qilin; đổi qua lại miễn phí).
export default function PetPanel({ userId, farm, catalog, now, onClose, onState }: { userId: string; farm: FarmView; catalog: Catalog; now: number; onClose: () => void; onState: (s: FarmState) => void }) {
  const [tab, setTab] = useState<"PET" | "TRIP" | "WARDROBE">("PET");
  const [jump, setJump] = useState(false);
  const [phrase, setPhrase] = useState("Chào bạn! Vuốt ve tớ đi 👇");
  const [localXp, setLocalXp] = useState(farm.pet.xp);
  const [localLevel, setLocalLevel] = useState(farm.pet.level);
  const [busy, setBusy] = useState(false);
  const levels = catalog.petLevels;
  const curStart = levels[localLevel - 1] ?? 0; const next = levels[localLevel] ?? null;
  const pct = next ? Math.min(100, ((localXp - curStart) / (next - curStart)) * 100) : 100;
  const outfit = Object.fromEntries(Object.entries(farm.wardrobe.equipped).map(([slot, key]) => [slot, catalog.outfits[key]?.emoji || ""]).filter(([, e]) => e)) as Record<string, string>;

  const pat = async () => {
    setJump(false); requestAnimationFrame(() => setJump(true));
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    try { const r = await farmApi.patPet(userId); setLocalXp(r.petXp); if (r.petLevel !== localLevel) { setLocalLevel(r.petLevel); fire({ icon: "success", title: `${farm.pet.name} lên cấp ${r.petLevel}!`, text: `Mở khoá: ${TRICKS[r.petLevel - 1] || "kỹ năng mới"}`, confirmButtonColor: "#1E3A8A" }); } } catch { /* bỏ qua */ }
  };
  const feed = async () => {
    if (busy) return; setBusy(true);
    try { const s = await farmApi.feedPet(userId); onState(s); setLocalXp(s.farm.pet.xp); setLocalLevel(s.farm.pet.level); setPhrase("Ngon quá! Cảm ơn bạn 😋"); setJump(false); requestAnimationFrame(() => setJump(true)); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(false);
  };
  const rename = async () => {
    const r = await fire({ title: "Đặt tên cho Qilin con", input: "text", inputValue: farm.pet.name, inputAttributes: { maxlength: "16" }, showCancelButton: true, confirmButtonText: "Đổi tên", cancelButtonText: "Huỷ", confirmButtonColor: "#1E3A8A" });
    if (!r.isConfirmed || !r.value?.trim()) return;
    try { onState(await farmApi.renamePet(userId, r.value.trim())); } catch (e: any) { swalAlert("Lỗi", e.message, "error"); }
  };
  const equip = async (slot: string, key: string | null) => {
    if (busy) return; setBusy(true);
    try { onState(await farmApi.wardrobeEquip(userId, slot, key)); setJump(false); requestAnimationFrame(() => setJump(true)); if (key) setPhrase(`Đẹp không? ${catalog.outfits[key]?.emoji}`); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(false);
  };
  const clearAll = async () => { for (const slot of Object.keys(farm.wardrobe.equipped)) await farmApi.wardrobeEquip(userId, slot, null).then(onState).catch(() => { }); };

  // ── Thám hiểm ──
  const trip = farm.pet.trip;
  const tripDef = trip ? catalog.petTrips.find((t) => t.tier === trip.tier) : undefined;
  const tripLeft = trip ? new Date(trip.readyAt).getTime() - now : 0;
  const tripDone = !!trip && tripLeft <= 0;
  const tripPct = trip && tripDef ? Math.max(0, Math.min(100, (1 - tripLeft / (new Date(trip.readyAt).getTime() - new Date(trip.startedAt).getTime())) * 100)) : 0;
  const startTrip = async (tier: number) => {
    if (busy) return; setBusy(true);
    try { onState(await farmApi.tripStart(userId, tier)); setPhrase("Tớ đi đây! Chờ tớ nhé 🎒"); }
    catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(false);
  };
  const collectTrip = async () => {
    if (busy) return; setBusy(true);
    try {
      const s = await farmApi.tripCollect(userId); onState(s); setLocalXp(s.farm.pet.xp); setLocalLevel(s.farm.pet.level);
      const r = s.tripResult;
      if (r) {
        const prod = Object.entries(r.produce).map(([k, n]) => `${produceInfo(catalog, k).emoji}×${n}`).join(" ");
        const words = r.words.length ? `<div style="margin-top:10px;text-align:left"><b>Từ mới Qilin nhặt được (đã vào deck, trồng ngay nhé):</b>${r.words.map((w) => `<div style="margin-top:4px">📘 <b>${w.word}</b> — ${w.meaning}${w.example ? `<br/><small style="color:#64748b">${w.example}</small>` : ""}</div>`).join("")}</div>` : "";
        await fire({ title: `${farm.pet.name} đã về! 🎒`, html: `<div style="font-size:16px">🪙 +${r.coins}${r.gems ? ` &nbsp; 💎 +${r.gems}` : ""} &nbsp; ⭐ +${r.petXp} XP Qilin</div><div style="margin-top:6px;font-size:22px">${prod || "—"}</div>${words}`, confirmButtonText: "Tuyệt!", confirmButtonColor: "#1E3A8A" });
      }
    } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(false);
  };
  const perkOn = (l: number) => localLevel >= l;

  return (
    <Modal title={`🐉 ${farm.pet.name}`} subtitle={`Cấp ${localLevel} · đã được vuốt ve ${farm.pet.pats} lần`} onClose={onClose}>
      <div className="text-center">
        <div className="relative mx-auto w-56 h-48 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(180deg,#e0f2fe,#dcfce7)" }}>
          <svg viewBox="-70 -125 140 140" className="w-full h-full cursor-pointer" onClick={pat} role="button" aria-label="Vuốt ve">
            <ellipse cx={0} cy={10} rx={48} ry={10} fill="rgba(31,45,61,.12)" />
            <g className={jump ? "farm-pet-jump" : "farm-pet-idle"} onAnimationEnd={() => setJump(false)}>
              <PetSprite level={localLevel} size={1.35} outfit={outfit} />
            </g>
          </svg>
          <div className="absolute top-2 left-0 right-0 text-center"><span className="inline-block bg-white/90 rounded-full px-3 py-1 text-sm font-bold text-primary shadow-card farm-toast" key={phrase}>{phrase}</span></div>
        </div>

        <div className="flex justify-center gap-2 mt-3">
          <button onClick={() => setTab("PET")} className={`ui-chip ${tab === "PET" ? "ui-chip-active" : ""}`}>🐾 Chăm sóc</button>
          <button onClick={() => setTab("TRIP")} className={`ui-chip relative ${tab === "TRIP" ? "ui-chip-active" : ""}`}>🧭 Thám hiểm{tripDone && <span className="ml-1 inline-block w-2 h-2 rounded-full bg-red-500 align-middle" />}</button>
          <button onClick={() => setTab("WARDROBE")} className={`ui-chip ${tab === "WARDROBE" ? "ui-chip-active" : ""}`}>👗 Tủ đồ ({farm.wardrobe.owned.length})</button>
        </div>

        {tab === "PET" && (
          <>
            <div className="mt-4 text-left">
              <div className="flex justify-between text-xs font-bold text-muted"><span>Cấp {localLevel}</span><span>{next ? `${localXp}/${next} XP` : "Tối đa"}</span></div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full bg-pink-400 transition-all" style={{ width: `${pct}%` }} /></div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={feed} disabled={farm.pet.fedToday || busy} className="btn-primary rounded-2xl py-3 font-bold disabled:opacity-50">🍖 {farm.pet.fedToday ? "Đã ăn" : "Cho ăn"}<div className="text-[10px] font-semibold opacity-80">+{catalog.petFeedReward.coins} xu/ngày</div></button>
              <button onClick={pat} className="btn-outline rounded-2xl py-3 font-bold">🤚 Vuốt ve<div className="text-[10px] font-semibold opacity-80">+1 XP</div></button>
              <button onClick={rename} className="btn-outline rounded-2xl py-3 font-bold">✏️ Đổi tên</button>
            </div>
            <div className="mt-4 text-left">
              <p className="text-xs font-bold text-muted uppercase">Kỹ năng của {farm.pet.name}</p>
              <p className={`text-xs font-semibold mt-1 rounded-lg px-2 py-1 ${farm.pet.buffs.active ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{farm.pet.buffs.active ? "Đang có hiệu lực: đã cho ăn hôm nay ✓" : "Chưa có hiệu lực — cho ăn hôm nay để bật các kỹ năng đã mở khoá"}</p>
              <div className="mt-2 space-y-1.5">
                {catalog.petPerks.map((p) => (
                  <div key={p.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${perkOn(p.level) ? "border-pink-200 bg-pink-50" : "border-line bg-slate-50 text-slate-400"}`}>
                    <span className="text-base">{perkOn(p.level) ? "✓" : "🔒"}</span>
                    <span className="flex-1"><b>{p.name}</b> · {p.desc}</span>
                    <span className="text-[11px] font-bold shrink-0">Cấp {p.level}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === "TRIP" && (
          <div className="mt-4 text-left space-y-3">
            <p className="text-sm text-muted">Cho {farm.pet.name} đi thám hiểm theo giờ thật: về mang quà <b>xu, nông sản, đôi khi kim cương</b> và <b>từ vựng mới</b> (tự vào deck của bạn để trồng và ôn). Chuyến dài cần Qilin cấp cao hơn.</p>
            {trip && tripDef ? (
              <div className="rounded-2xl bg-primary-soft p-4">
                <div className="flex items-center gap-3">
                  <div className="text-4xl leading-none">{tripDef.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-primary leading-tight">{tripDone ? `${farm.pet.name} đã về!` : `${farm.pet.name} đang ở ${tripDef.name}`}</p>
                    <p className="text-xs text-muted">{tripDone ? "Nhận quà thôi" : `Còn ${formatCountdown(tripLeft)}`}</p>
                  </div>
                  {tripDone && <button onClick={collectTrip} disabled={busy} className="btn-primary rounded-full px-5 py-2.5 font-bold disabled:opacity-50">Nhận quà</button>}
                </div>
                {!tripDone && <div className="h-2 rounded-full bg-white overflow-hidden mt-3"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${tripPct}%` }} /></div>}
              </div>
            ) : (
              <div className="space-y-2">
                {catalog.petTrips.map((t) => {
                  const locked = localLevel < t.minLevel;
                  const mins = Math.round(t.minutes * (1 - farm.pet.buffs.tripTimePct));
                  return (
                    <div key={t.tier} className={`rounded-2xl border p-3 flex items-center gap-3 ${locked ? "border-line bg-slate-50 opacity-70" : "border-line bg-white"}`}>
                      <div className="text-3xl leading-none">{t.emoji}</div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-foreground leading-tight">{t.name}</p>
                        <p className="text-xs text-muted">⏱ {mins >= 60 ? `${Math.round(mins / 60 * 10) / 10} giờ` : `${mins} phút`} · 🪙 {t.coins[0]}–{t.coins[1]} · {t.produce[0]}–{t.produce[1]} nông sản · 📘 {t.words} từ mới{t.gemChance >= 0.1 ? " · có thể 💎" : ""}</p>
                      </div>
                      <button onClick={() => startTrip(t.tier)} disabled={locked || busy} className="btn-primary rounded-full px-4 py-2 text-sm font-bold disabled:opacity-50">{locked ? `🔒 Cấp ${t.minLevel}` : "Đi thôi"}</button>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted">Tối đa {catalog.petTripWordsPerDay} từ mới mỗi ngày từ thám hiểm. Phần thưởng tăng theo cấp Qilin. Khi Qilin đi vắng, nó biến mất khỏi nông trại.</p>
          </div>
        )}

        {tab === "WARDROBE" && (
          <div className="mt-4 text-left space-y-3">
            {farm.wardrobe.owned.length === 0 ? (
              <div className="text-center py-4 text-sm text-muted">
                <div className="text-4xl mb-1">👗</div>
                <p className="font-semibold">Tủ đồ còn trống.</p>
                <p className="mt-1">Ghé Cửa hàng › Trang phục Qilin để mua mũ, kính, khăn, cánh... cho {farm.pet.name}.</p>
              </div>
            ) : (
              <>
                {catalog.outfitSlots.map((slot) => {
                  const mine = farm.wardrobe.owned.filter((k) => catalog.outfits[k]?.slot === slot.id);
                  if (!mine.length) return null;
                  const wearing = farm.wardrobe.equipped[slot.id];
                  return (
                    <div key={slot.id}>
                      <p className="text-xs font-bold text-muted uppercase mb-1">{slot.name}</p>
                      <div className="flex flex-wrap gap-2">
                        <button disabled={busy || !wearing} onClick={() => equip(slot.id, null)} className={`w-14 h-14 rounded-2xl border text-xs font-bold ${!wearing ? "border-primary bg-primary-soft text-primary" : "border-line bg-white text-muted hover:border-primary"}`}>Trống</button>
                        {mine.map((k) => (
                          <button key={k} disabled={busy} title={catalog.outfits[k].name} onClick={() => equip(slot.id, k)} className={`w-14 h-14 rounded-2xl border text-3xl leading-none ${wearing === k ? "border-primary bg-primary-soft" : "border-line bg-white hover:border-primary"}`}>{catalog.outfits[k].emoji}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {Object.keys(farm.wardrobe.equipped).length > 0 && <div className="text-center"><button onClick={clearAll} disabled={busy} className="btn-ghost rounded-full px-4 py-2 text-xs font-bold">Cởi hết đồ</button></div>}
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
