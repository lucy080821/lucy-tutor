"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fire, alert as swalAlert } from "./farmSwal";
import "./farm.css";
import { farmApi, formatCountdown, speak, type DecorPlaced, type FarmState, type PlotView } from "@/lib/farm/api";
import FarmScene, { liveStatus, type SceneMode } from "./FarmScene";
import type { Outfit } from "./Sprites";
import HarvestModal from "./HarvestModal";
import SeedPicker from "./SeedPicker";
import ShopPanel from "./ShopPanel";
import OrdersPanel from "./OrdersPanel";
import PetPanel from "./PetPanel";
import WheelPanel from "./WheelPanel";
import NeighborsPanel from "./NeighborsPanel";
import BarnPanel from "./BarnPanel";
import Modal from "./Modal";

type Panel = null | "SEED" | "HARVEST" | "SHOP" | "PET" | "WHEEL" | "NEIGHBORS" | "BARN" | "HELP";
const TUT_KEY = "lucy_farm_tut_v1";

async function confetti(opts: any) {
  try { const c = (await import("canvas-confetti")).default; c({ particleCount: 90, spread: 70, origin: { y: 0.6 }, ...opts }); } catch { /* không có confetti cũng không sao */ }
}

export default function FarmGame({ userId }: { userId: string }) {
  const [state, setState] = useState<FarmState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const offsetRef = useRef(0); // lệch giờ server - client để đếm ngược đúng
  const [mode, setMode] = useState<SceneMode>({ type: "normal" });
  const [panel, setPanel] = useState<Panel>(null);
  const [activePlot, setActivePlot] = useState<PlotView | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [petJumping, setPetJumping] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  // Toàn màn hình: dùng Fullscreen API trên #farm-root; trình duyệt không hỗ trợ (iPhone) thì dùng lớp CSS cố định
  const rootRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const toggleFullscreen = async () => {
    const el = rootRef.current; if (!el) return;
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => { }); setFs(false); return; }
    if (fs) { setFs(false); return; }
    try { if (el.requestFullscreen) await el.requestFullscreen(); } catch { /* iOS Safari không hỗ trợ → chỉ dùng CSS */ }
    setFs(true);
  };
  useEffect(() => { const f = () => { if (!document.fullscreenElement) setFs(false); }; document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  }, []);

  const applyState = useCallback((s: FarmState) => {
    offsetRef.current = new Date(s.now).getTime() - Date.now();
    setState(s);
    if (s.result?.correct) {
      if (s.result.levelUp) { confetti({ particleCount: 160, spread: 100 }); fire({ icon: "success", title: `🎉 Nông trại lên cấp ${s.result.levelUp}!`, text: "Cửa hàng mở thêm vật phẩm mới, đơn hàng thưởng cao hơn.", confirmButtonColor: "#1E3A8A" }); }
      else if (s.result.becameMastered) confetti({ particleCount: 60, spread: 60 });
    }
  }, []);

  const load = useCallback(async () => {
    try { applyState(await farmApi.state(userId)); setError(null); } catch (e: any) { setError(e.message || "Không tải được nông trại"); }
  }, [userId, applyState]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() + offsetRef.current), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { try { if (!localStorage.getItem(TUT_KEY)) setPanel("HELP"); } catch { /* bỏ qua */ } }, []);
  // Tải lại khi quay về tab (cây có thể đã chín, đơn mới...)
  useEffect(() => { const f = () => { if (document.visibilityState === "visible") load(); }; document.addEventListener("visibilitychange", f); return () => document.removeEventListener("visibilitychange", f); }, [load]);

  const readyPlots = useMemo(() => (state?.plots || []).filter((p) => liveStatus(p, now).status === "READY"), [state, now]);
  const nextReadyAfter = (id: string) => readyPlots.find((p) => p.id !== id) || null;

  // ── Tương tác trên đất ─────────────────────────────────────────────────────
  const onPlotClick = async (plot: PlotView) => {
    if (!state) return;
    if (mode.type === "edit") { setMode({ type: "edit", selected: { kind: "plot", id: plot.id } }); return; }
    const live = liveStatus(plot, now);
    if (plot.status === "EMPTY") { setActivePlot(plot); setPanel("SEED"); return; }
    if (live.status === "READY") { setActivePlot(plot); setPanel("HARVEST"); return; }
    // Đang lớn: xem thẻ từ + tuỳ chọn nhổ / cất kho
    const mastered = plot.srs?.status === "MASTERED";
    const r = await fire({
      title: plot.word, html: `<p class="text-lg">${plot.meaning}</p>${plot.example ? `<p class="text-sm italic mt-2 opacity-70">“${plot.example}”</p>` : ""}<p class="text-sm mt-3">⏳ Chín sau <b>${formatCountdown(live.msLeft)}</b>${plot.wilted ? " (cây đang héo, học lại từ đầu)" : ""}<br/>Đã nhớ đúng ${plot.srs?.repetitions ?? 0} lần · ${plot.srs?.status === "MASTERED" ? "⭐ Thuộc lòng" : plot.srs?.status === "REVIEWING" ? "Đang ôn" : "Mới"}</p>`,
      showDenyButton: true, showCancelButton: true, confirmButtonText: "🔊 Nghe", denyButtonText: mastered ? "⭐ Cất kho (+xu)" : "🪓 Nhổ cây", cancelButtonText: "Đóng", confirmButtonColor: "#1E3A8A", denyButtonColor: mastered ? "#059669" : "#b45309",
    });
    if (r.isConfirmed) { speak(plot.word || ""); return; }
    if (r.isDenied) {
      try {
        if (mastered) { const s = await farmApi.store(userId, plot.id); applyState(s); toast(`⭐ Đã cất "${s.stored?.word}" vào kho · 🪙 +${s.stored?.coins}`); }
        else { const ok = await fire({ title: "Nhổ cây này?", text: "Từ vẫn còn trong deck SRS, chỉ rời khỏi ô đất.", icon: "warning", showCancelButton: true, confirmButtonText: "Nhổ", cancelButtonText: "Thôi", confirmButtonColor: "#b45309" }); if (ok.isConfirmed) applyState(await farmApi.dig(userId, plot.id)); }
      } catch (e: any) { swalAlert("Lỗi", e.message, "error"); }
    }
  };

  const onTileClick = async (x: number, y: number) => {
    if (!state) return;
    try {
      if (mode.type === "place") {
        const s = await farmApi.buy(userId, mode.itemKey, x, y); applyState(s);
        toast(`Đã đặt ${mode.label} · −${s.bought?.price ?? ""} ${s.bought?.currency === "gems" ? "💎" : "🪙"}`);
        if (!["path", "fence", "flower", "rock"].includes(mode.itemKey)) setMode({ type: "normal" });
        else if (s.farm.coins < (s.catalog.decor[mode.itemKey]?.price ?? 0)) setMode({ type: "normal" });
      } else if (mode.type === "edit" && mode.selected) {
        applyState(await farmApi.move(userId, mode.selected.kind, mode.selected.id, x, y)); setMode({ type: "edit", selected: null });
      }
    } catch (e: any) { swalAlert("", e.message, "info"); }
  };

  const onDecorClick = async (d: DecorPlaced) => {
    if (!state || mode.type !== "edit") return;
    if (mode.selected?.id !== d.uid) { setMode({ type: "edit", selected: { kind: "decor", id: d.uid } }); return; }
    const item = state.catalog.decor[d.key];
    const r = await fire({ title: item?.name || "Vật phẩm", text: `Bán lại được ${Math.floor((item?.price || 0) * state.catalog.decorSellRate)} ${item?.currency === "gems" ? "kim cương" : "xu"}. Hoặc bấm 1 ô trống để dời.`, showCancelButton: true, confirmButtonText: "Bán", cancelButtonText: "Giữ", confirmButtonColor: "#b45309" });
    if (r.isConfirmed) { try { const s = await farmApi.sell(userId, d.uid); applyState(s); toast(`Đã bán · +${s.sold?.refund} ${s.sold?.currency === "gems" ? "💎" : "🪙"}`); setMode({ type: "edit", selected: null }); } catch (e: any) { swalAlert("Lỗi", e.message, "error"); } }
  };

  const onPetClick = () => {
    setPetJumping(false); requestAnimationFrame(() => setPetJumping(true)); setTimeout(() => setPetJumping(false), 600);
    const id = Date.now(); setHearts((h) => [...h, id]); setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000);
    farmApi.patPet(userId).catch(() => { });
  };

  const expand = async () => {
    try { const s = await farmApi.buy(userId, "expand"); applyState(s); setPanel(null); toast(`🗺️ Đã mở rộng đất lên ${s.farm.gridW}×${s.farm.gridH}`); confetti({}); } catch (e: any) { swalAlert("", e.message, "info"); }
  };

  const closeTut = () => { try { localStorage.setItem(TUT_KEY, "1"); } catch { /* bỏ qua */ } setPanel(null); };

  if (error) return <div className="ui-card p-8 text-center"><p className="text-red-600 font-bold">{error}</p><button onClick={load} className="btn-primary rounded-full px-5 py-2.5 mt-4 font-bold">Thử lại</button></div>;
  if (!state) return <div className="ui-card p-8 text-center text-muted">Đang mở cổng nông trại... 🌾</div>;

  const { farm, catalog, user, orders } = state;
  const outfit: Outfit = Object.fromEntries(Object.entries(farm.wardrobe.equipped).map(([slot, key]) => [slot, catalog.outfits[key]?.emoji || ""]).filter(([, e]) => e));
  const lvPct = Math.min(100, ((farm.harvestCount - farm.levelStart) / Math.max(1, farm.nextLevelAt - farm.levelStart)) * 100);
  const readyOrders = orders.filter((o) => o.ready).length;

  return (
    <div ref={rootRef} id="farm-root" className={`grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] ${fs ? "farm-fullscreen" : ""}`}>
      <div className="space-y-3 min-w-0">
        {/* HUD */}
        <div className="ui-card px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 font-extrabold text-foreground">
            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 rounded-full px-3 py-1">🪙 {farm.coins}</span>
            <span className="inline-flex items-center gap-1 bg-sky-50 text-sky-800 rounded-full px-3 py-1">💎 {farm.gems}</span>
            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 rounded-full px-3 py-1" title="Kho nông sản">🧺 {farm.barnUsed}/{farm.barnCapacity}</span>
            {farm.boostHarvests > 0 && <span className="ui-badge bg-pink-100 text-pink-800 text-xs">⚡ x2 xu còn {farm.boostHarvests} lần</span>}
          </div>
          <div className="flex-1 min-w-[160px]">
            <div className="flex justify-between text-xs font-bold text-muted"><span>Cấp {farm.level}</span><span>{farm.harvestCount}/{farm.nextLevelAt} thu hoạch</span></div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden mt-0.5"><div className="h-full bg-primary transition-all" style={{ width: `${lvPct}%` }} /></div>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-muted">
            <span title="Chuỗi ngày học">🔥 {user.streakCount}</span><span title="Tổng XP">⚡ {user.totalXP} XP</span>
            <button onClick={toggleFullscreen} className="btn-outline rounded-full px-3 py-1.5 text-xs font-bold" title={fs ? "Thoát toàn màn hình" : "Toàn màn hình"}>{fs ? "🗗 Thu nhỏ" : "⛶ Toàn màn hình"}</button>
          </div>
        </div>

        {/* Thanh chế độ */}
        {mode.type !== "normal" && (
          <div className={`rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-bold ${mode.type === "place" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-primary-soft text-primary"}`}>
            <span>{mode.type === "place" ? `🛒 Chọn 1 ô trống (viền vàng) để đặt ${mode.label}` : mode.selected ? "✋ Chọn ô trống để dời, hoặc bấm lại vật phẩm để bán" : "✏️ Chế độ sắp xếp: bấm vào ô đất hoặc vật trang trí để chọn"}</span>
            <button onClick={() => setMode({ type: "normal" })} className="btn-outline rounded-full px-3 py-1.5 text-xs">Xong</button>
          </div>
        )}

        <div className="relative">
          <FarmScene farm={farm} plots={state.plots} catalog={catalog} now={now} mode={mode} pet={{ name: farm.pet.name, level: farm.pet.level }} outfit={outfit} petJumping={petJumping} hearts={hearts}
            onTileClick={onTileClick} onPlotClick={onPlotClick} onDecorClick={onDecorClick} onPetClick={onPetClick} />
          {readyPlots.length > 0 && mode.type === "normal" && (
            <button onClick={() => { setActivePlot(readyPlots[0]); setPanel("HARVEST"); }} className="absolute top-3 left-3 btn-highlight rounded-full px-4 py-2 font-extrabold shadow-card farm-toast">🌾 {readyPlots.length} cây chín — thu hoạch!</button>
          )}
          <div className="absolute top-3 right-3 flex flex-col items-end gap-1 pointer-events-none">
            {toasts.map((t) => <div key={t.id} className="farm-toast bg-white/95 border border-line rounded-full px-3 py-1.5 text-sm font-bold text-foreground shadow-card">{t.msg}</div>)}
          </div>
        </div>

        {/* Thanh hành động */}
        <div className="ui-card p-2 grid grid-cols-4 sm:grid-cols-8 gap-1">
          {[
            { k: "SHOP", icon: "🛒", label: "Cửa hàng" },
            { k: "PET", icon: "🐉", label: farm.pet.name, badge: !farm.pet.fedToday ? "🍖" : undefined },
            { k: "WHEEL", icon: "🎡", label: "Vòng quay", badge: farm.canSpin ? "!" : undefined },
            { k: "NEIGHBORS", icon: "👋", label: "Bạn bè" },
            { k: "BARN", icon: "🧺", label: `Kho ${farm.barnUsed}/${farm.barnCapacity}`, badge: orders.some((o) => o.kind === "PRODUCE" && o.ready) ? "🚚" : undefined },
            { k: "EDIT", icon: "✏️", label: "Sắp xếp" },
            { k: "RELOAD", icon: "🔄", label: "Tải lại" },
            { k: "HELP", icon: "❓", label: "Hướng dẫn" },
          ].map((b) => (
            <button key={b.k} onClick={() => { if (b.k === "EDIT") setMode(mode.type === "edit" ? { type: "normal" } : { type: "edit", selected: null }); else if (b.k === "RELOAD") { load(); toast("Đã tải lại"); } else setPanel(b.k as Panel); }}
              className={`relative rounded-xl py-2 flex flex-col items-center gap-0.5 hover:bg-primary-soft ${b.k === "EDIT" && mode.type === "edit" ? "bg-primary-soft" : ""}`}>
              <span className="text-2xl leading-none">{b.icon}</span><span className="text-[11px] font-bold text-foreground truncate max-w-full px-1">{b.label}</span>
              {b.badge && <span className="absolute top-1 right-2 bg-highlight text-[10px] font-extrabold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">{b.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <OrdersPanel userId={userId} orders={orders} catalog={catalog} coins={farm.coins} difficulty={farm.orderDifficulty} onState={applyState} onToast={toast} />
        <div className="ui-card p-4 text-sm text-muted space-y-1">
          <p className="font-extrabold text-primary">📊 Hôm nay</p>
          <p>🌱 {state.plots.filter((p) => p.status !== "EMPTY").length}/{farm.plotCount} ô đang trồng · 🌾 {readyPlots.length} cây chín</p>
          <p>🚚 {readyOrders} đơn đủ hàng · 🥀 {farm.witherCount} lần héo tổng</p>
          <p>Nhịp chơi gợi ý: 5–10 phút, 2–3 lần mỗi ngày.</p>
        </div>
      </div>

      {/* Panels */}
      {panel === "SEED" && activePlot && <SeedPicker userId={userId} plot={activePlot} catalog={catalog} onClose={() => setPanel(null)} onState={(s) => { applyState(s); toast("🌱 Đã trồng! Chín lần đầu sau 10 phút."); }} />}
      {panel === "HARVEST" && activePlot && (
        <HarvestModal userId={userId} plot={activePlot} cropName={catalog.crops[activePlot.cropKey || ""]?.name || "cây"} nextReadyPlot={nextReadyAfter(activePlot.id)}
          onClose={() => setPanel(null)} onState={applyState} onNext={(p) => setActivePlot(p)} catalog={catalog} />
      )}
      {panel === "SHOP" && <ShopPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} onToast={toast} onPick={(k, label) => { setPanel(null); setMode({ type: "place", itemKey: k, label }); }} onExpand={expand} />}
      {panel === "PET" && <PetPanel userId={userId} farm={farm} catalog={catalog} onClose={() => { setPanel(null); load(); }} onState={applyState} />}
      {panel === "WHEEL" && <WheelPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} />}
      {panel === "NEIGHBORS" && <NeighborsPanel userId={userId} catalog={catalog} onClose={() => setPanel(null)} onToast={toast} onRefresh={load} />}
      {panel === "BARN" && <BarnPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} onToast={toast} />}
      {panel === "HELP" && (
        <Modal title="🌾 Chào mừng tới Nông Trại Qilin!" subtitle="Vừa chơi vừa nhớ từ — cây lớn theo đúng lịch ôn của bạn" onClose={closeTut}
          footer={<button onClick={closeTut} className="btn-primary rounded-full px-6 py-2.5 font-bold w-full">Bắt đầu trồng!</button>}>
          <ol className="space-y-3 text-sm text-foreground">
            {[
              ["🌱", "Bấm ô đất trống (dấu +) để chọn 1 từ và trồng. Xem thẻ từ trước khi trồng."],
              ["⏳", "Cây chín lần đầu sau 10 phút. Những lần sau chín theo lịch ôn SRS (1 ngày → 6 ngày → lâu hơn). Không mua được thời gian!"],
              ["🌾", "Cây chín hiện dấu ! — bấm để thu hoạch bằng cách trả lời 1 câu về từ đó. Đúng được xu + XP, sai thì cây héo và học lại sau 10 phút."],
              ["🚚", "Giao đơn hàng cho khách để nhận thưởng lớn. Đơn 'Viết câu' được AI chấm."],
              ["🧺", "Mỗi lần thu hoạch còn cho 1–2 nông sản vào kho: bán lấy xu, hoặc để dành giao đơn nông sản (lời gấp đôi). Kho đầy thì nâng cấp."],
              ["🎉", "Phần chơi thuần: trang trí nông trại, mua trang phục cho Qilin con, vòng quay mỗi ngày, thăm nông trại bạn bè toàn app."],
              ["⭐", "Từ nhớ lâu hơn 21 ngày = thuộc lòng → cất vào kho, lấy chỗ trồng từ mới."],
            ].map(([i, t]) => <li key={t} className="flex gap-3"><span className="text-2xl leading-none">{i}</span><span>{t}</span></li>)}
          </ol>
        </Modal>
      )}
    </div>
  );
}
