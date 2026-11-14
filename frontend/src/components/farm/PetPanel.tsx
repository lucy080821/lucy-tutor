"use client";
import { useState } from "react";
import Swal from "sweetalert2";
import Modal from "./Modal";
import { farmApi, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";
import { PetSprite } from "./Sprites";

const PHRASES = ["Grrr~ 💕", "Rawr! Chơi với tớ đi!", "Hôm nay học giỏi lắm!", "Tớ đói rồi...", "Zzz... hả? Tớ tỉnh rồi!", "Nữa đi nữa đi!", "Tớ là rồng nước xịn nhất!", "Thu hoạch xong chưa?"];
const TRICKS = ["Lộn vòng", "Bờm hồng", "Mọc cánh", "Phun bong bóng", "Nhảy múa", "Vương miện"];

// Thú cưng Qilin con — giải trí thuần: vuốt ve, cho ăn (1 lần/ngày), lớn lên qua cấp, đổi tên.
export default function PetPanel({ userId, farm, catalog, onClose, onState }: { userId: string; farm: FarmView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void }) {
  const [jump, setJump] = useState(false);
  const [phrase, setPhrase] = useState("Chào bạn! Vuốt ve tớ đi 👇");
  const [localXp, setLocalXp] = useState(farm.pet.xp);
  const [localLevel, setLocalLevel] = useState(farm.pet.level);
  const [busy, setBusy] = useState(false);
  const levels = catalog.petLevels;
  const curStart = levels[localLevel - 1] ?? 0; const next = levels[localLevel] ?? null;
  const pct = next ? Math.min(100, ((localXp - curStart) / (next - curStart)) * 100) : 100;

  const pat = async () => {
    setJump(false); requestAnimationFrame(() => setJump(true));
    setPhrase(PHRASES[Math.floor(Math.random() * PHRASES.length)]);
    try { const r = await farmApi.patPet(userId); setLocalXp(r.petXp); if (r.petLevel !== localLevel) { setLocalLevel(r.petLevel); Swal.fire({ icon: "success", title: `${farm.pet.name} lên cấp ${r.petLevel}!`, text: `Mở khoá: ${TRICKS[r.petLevel - 1] || "kỹ năng mới"}`, confirmButtonColor: "#1E3A8A" }); } } catch { /* bỏ qua */ }
  };
  const feed = async () => {
    if (busy) return; setBusy(true);
    try { const s = await farmApi.feedPet(userId); onState(s); setLocalXp(s.farm.pet.xp); setLocalLevel(s.farm.pet.level); setPhrase("Ngon quá! Cảm ơn bạn 😋"); setJump(false); requestAnimationFrame(() => setJump(true)); }
    catch (e: any) { Swal.fire("", e.message, "info"); }
    setBusy(false);
  };
  const rename = async () => {
    const r = await Swal.fire({ title: "Đặt tên cho Qilin con", input: "text", inputValue: farm.pet.name, inputAttributes: { maxlength: "16" }, showCancelButton: true, confirmButtonText: "Đổi tên", cancelButtonText: "Huỷ", confirmButtonColor: "#1E3A8A" });
    if (!r.isConfirmed || !r.value?.trim()) return;
    try { onState(await farmApi.renamePet(userId, r.value.trim())); } catch (e: any) { Swal.fire("Lỗi", e.message, "error"); }
  };

  return (
    <Modal title={`🐉 ${farm.pet.name}`} subtitle={`Cấp ${localLevel} · đã được vuốt ve ${farm.pet.pats} lần`} onClose={onClose}>
      <div className="text-center">
        <div className="relative mx-auto w-56 h-48 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(180deg,#e0f2fe,#dcfce7)" }}>
          <svg viewBox="-70 -110 140 130" className="w-full h-full cursor-pointer" onClick={pat} role="button" aria-label="Vuốt ve">
            <ellipse cx={0} cy={10} rx={48} ry={10} fill="rgba(31,45,61,.12)" />
            <g className={jump ? "farm-pet-jump" : "farm-pet-idle"} onAnimationEnd={() => setJump(false)}>
              <PetSprite level={localLevel} size={1.35} />
            </g>
          </svg>
          <div className="absolute top-2 left-0 right-0 text-center"><span className="inline-block bg-white/90 rounded-full px-3 py-1 text-sm font-bold text-primary shadow-card farm-toast" key={phrase}>{phrase}</span></div>
        </div>
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
          <p className="text-xs font-bold text-muted uppercase">Kỹ năng theo cấp</p>
          <div className="flex flex-wrap gap-1.5 mt-1">{TRICKS.map((t, i) => <span key={t} className={`ui-badge text-xs ${i < localLevel ? "bg-pink-100 text-pink-800" : "bg-slate-100 text-slate-400"}`}>{i < localLevel ? "✓" : "🔒"} {t}</span>)}</div>
        </div>
      </div>
    </Modal>
  );
}
