"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fire, alert as swalAlert } from "./farmSwal";
import "./farm.css";
import { farmApi, formatCountdown, sellValue, speak, type DecorPlaced, type FarmState, type PlotView } from "@/lib/farm/api";
import { loadSfxPref, setSfxEnabled, sfx } from "@/lib/farm/sfx";
import FarmScene, { liveStatus, type FloatText, type SceneMode } from "./FarmScene";
import type { Outfit } from "./Sprites";
import { PHASE_LABEL, skyNow } from "./Ambient";
import { useFarmWeather } from "@/lib/farm/useWeather";
import { WEATHER_KINDS, WEATHER_LABEL, weatherLabel, type WeatherKind } from "@/lib/farm/weather";
import WeatherPanel from "./WeatherPanel";
import { BasketIcon, CoinIcon, GemIcon, IconBarn, IconBolt, IconFlame, IconHelp, IconMaximize, IconMinimize, IconMove, IconPaw, IconRefresh, IconShop, IconSprout, IconTarget, IconUsers, IconVolume, IconVolumeOff, IconWeather, IconWheel, NamedIcon } from "./FarmIcons";
import HarvestModal from "./HarvestModal";
import SeedPicker from "./SeedPicker";
import ShopPanel from "./ShopPanel";
import OrdersPanel from "./OrdersPanel";
import PetPanel from "./PetPanel";
import WheelPanel from "./WheelPanel";
import NeighborsPanel from "./NeighborsPanel";
import BarnPanel from "./BarnPanel";
import QuestsPanel from "./QuestsPanel";
import Modal from "./Modal";

type Panel = null | "SEED" | "HARVEST" | "SHOP" | "PET" | "WHEEL" | "NEIGHBORS" | "BARN" | "QUESTS" | "WEATHER" | "HELP";
const TUT_KEY = "lucy_farm_tut_v2";

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
  const [questTab, setQuestTab] = useState<"DAILY" | "ACH">("DAILY");
  const [activePlot, setActivePlot] = useState<PlotView | null>(null);
  const activePlotRef = useRef<PlotView | null>(null);
  useEffect(() => { activePlotRef.current = activePlot; }, [activePlot]);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const [floats, setFloats] = useState<FloatText[]>([]);
  const [petJumping, setPetJumping] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  // Xem thử: /farm?time=21:30 (giờ bất kỳ) và /farm?weather=rain (clear|cloudy|overcast|fog|drizzle|rain|storm|snow). Mặc định = giờ + thời tiết thật tại vị trí.
  const [skyTime] = useState<string | null>(() => { try { return new URLSearchParams(window.location.search).get("time"); } catch { return null; } });
  const [wxPreview] = useState<WeatherKind | null>(() => { try { const w = new URLSearchParams(window.location.search).get("weather") as WeatherKind | null; return w && WEATHER_KINDS.includes(w) ? w : null; } catch { return null; } });
  const wx = useFarmWeather(wxPreview);
  const prevRef = useRef<FarmState | null>(null);

  // Toàn màn hình: dùng Fullscreen API trên #farm-root; trình duyệt không hỗ trợ (iPhone) thì dùng lớp CSS cố định
  const rootRef = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const toggleFullscreen = async () => {
    const el = rootRef.current; if (!el) return;
    sfx.click();
    if (document.fullscreenElement) { await document.exitFullscreen().catch(() => { }); setFs(false); return; }
    if (fs) { setFs(false); return; }
    try { if (el.requestFullscreen) await el.requestFullscreen(); } catch { /* iOS Safari không hỗ trợ → chỉ dùng CSS */ }
    setFs(true);
  };
  useEffect(() => { const f = () => { if (!document.fullscreenElement) setFs(false); }; document.addEventListener("fullscreenchange", f); return () => document.removeEventListener("fullscreenchange", f); }, []);
  useEffect(() => { setSoundOn(loadSfxPref()); }, []);
  const toggleSound = () => { const v = !soundOn; setSoundOn(v); setSfxEnabled(v); if (v) sfx.pop(); };

  const toast = useCallback((msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  }, []);
  // Chữ thưởng nổi lên trên ô đất (toạ độ lưới)
  const addFloat = useCallback((x: number, y: number, text: string, tone: FloatText["tone"], delay = 0) => {
    const id = Date.now() + Math.random();
    setTimeout(() => { setFloats((f) => [...f, { id, x, y, text, tone }]); setTimeout(() => setFloats((f) => f.filter((v) => v.id !== id)), 1600); }, delay);
  }, []);

  // Mọi phản hồi từ server đi qua đây: cập nhật state, phát âm thanh, hiện thưởng, báo nhiệm vụ/thành tựu mới đạt
  const applyState = useCallback((s: FarmState) => {
    offsetRef.current = new Date(s.now).getTime() - Date.now();
    const prev = prevRef.current;
    setState(s);
    if (s.result) {
      const r = s.result; const ap = activePlotRef.current;
      if (r.correct) {
        sfx.harvest();
        if (ap) {
          if (r.coins > 0) addFloat(ap.x, ap.y, `+${r.coins}`, "coin");
          addFloat(ap.x, ap.y, `+${r.xp} XP`, "xp", 160);
          if (r.produce > 0) addFloat(ap.x, ap.y, `+${r.produce} ${s.catalog.crops[r.produceKey || ""]?.emoji || ""}`, "item", 320);
        }
        if (r.levelUp) { sfx.levelUp(); confetti({ particleCount: 160, spread: 100 }); fire({ icon: "success", title: `Nông trại lên cấp ${r.levelUp}!`, text: "Cửa hàng mở thêm vật phẩm mới, đơn hàng thưởng cao hơn.", confirmButtonColor: "#1E3A8A" }); }
        else if (r.becameMastered) confetti({ particleCount: 60, spread: 60 });
      } else { sfx.wrong(); if (ap) addFloat(ap.x, ap.y, "Héo!", "bad"); }
    }
    if (s.delivered) sfx.claim();
    if (s.planted) sfx.plant();
    if (s.bought || s.sold || s.stored) sfx.coin();
    if (s.claimedReward) {
      const c = s.claimedReward; sfx.claim();
      toast(`Đã nhận ${c.name}: +${c.coins} xu${c.gems ? ` +${c.gems} kim cương` : ""}${c.xp ? ` +${c.xp} XP` : ""}`);
      if (c.kind === "CHEST") confetti({ particleCount: 130, spread: 90 });
    }
    // Nhiệm vụ vừa đạt / thành tựu vừa mở khoá → báo 1 lần (so với state trước, cùng 1 ngày)
    if (prev && prev.quests.day === s.quests.day) {
      s.quests.items.forEach((q) => { const p = prev.quests.items.find((x) => x.id === q.id); if (p && !p.done && q.done) toast(`Nhiệm vụ xong: ${q.label}. Vào Nhiệm vụ để nhận thưởng`); });
    }
    if (prev && s.achievements.claimable > prev.achievements.claimable && !s.claimedReward) {
      const g = s.achievements.groups.find((x) => { const p = prev.achievements.groups.find((y) => y.id === x.id); return p && x.claimable > p.claimable; });
      if (g) { sfx.pop(); toast(`Thành tựu mới: ${g.name}`); }
    }
    prevRef.current = s;
  }, [toast, addFloat]);

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
  const openPanel = (p: Panel) => { sfx.click(); setPanel(p); };

  // ── Tương tác trên đất ─────────────────────────────────────────────────────
  const onPlotClick = async (plot: PlotView) => {
    if (!state) return;
    if (mode.type === "edit") { setMode({ type: "edit", selected: { kind: "plot", id: plot.id } }); return; }
    const live = liveStatus(plot, now);
    sfx.pop();
    if (plot.status === "EMPTY") { setActivePlot(plot); setPanel("SEED"); return; }
    if (live.status === "READY") { setActivePlot(plot); setPanel("HARVEST"); return; }
    // Đang lớn: xem thẻ từ + tuỳ chọn nhổ / cất kho
    const mastered = plot.srs?.status === "MASTERED";
    const r = await fire({
      title: plot.word, html: `<p class="text-lg">${plot.meaning}</p>${plot.example ? `<p class="text-sm italic mt-2 opacity-70">“${plot.example}”</p>` : ""}<p class="text-sm mt-3">Chín sau <b>${formatCountdown(live.msLeft)}</b>${plot.wilted ? " (cây đang héo, học lại từ đầu)" : ""}<br/>Đã nhớ đúng ${plot.srs?.repetitions ?? 0} lần · ${plot.srs?.status === "MASTERED" ? "Thuộc lòng" : plot.srs?.status === "REVIEWING" ? "Đang ôn" : "Mới"}</p>`,
      showDenyButton: true, showCancelButton: true, confirmButtonText: "Nghe", denyButtonText: mastered ? "Cất kho (+xu)" : "Nhổ cây", cancelButtonText: "Đóng", confirmButtonColor: "#1E3A8A", denyButtonColor: mastered ? "#059669" : "#b45309",
    });
    if (r.isConfirmed) { speak(plot.word || ""); return; }
    if (r.isDenied) {
      try {
        if (mastered) { const s = await farmApi.store(userId, plot.id); applyState(s); addFloat(plot.x, plot.y, `+${s.stored?.coins}`, "coin"); toast(`Đã cất "${s.stored?.word}" vào kho · +${s.stored?.coins} xu`); }
        else { const ok = await fire({ title: "Nhổ cây này?", text: "Từ vẫn còn trong deck SRS, chỉ rời khỏi ô đất.", icon: "warning", showCancelButton: true, confirmButtonText: "Nhổ", cancelButtonText: "Thôi", confirmButtonColor: "#b45309" }); if (ok.isConfirmed) applyState(await farmApi.dig(userId, plot.id)); }
      } catch (e: any) { swalAlert("Lỗi", e.message, "error"); }
    }
  };

  const onTileClick = async (x: number, y: number) => {
    if (!state) return;
    try {
      if (mode.type === "place") {
        const s = await farmApi.buy(userId, mode.itemKey, x, y); applyState(s);
        addFloat(x, y, `-${s.bought?.price ?? ""}`, "bad");
        toast(`Đã đặt ${mode.label} · −${s.bought?.price ?? ""} ${s.bought?.currency === "gems" ? "kim cương" : "xu"}`);
        if (!["path", "fence", "flower", "rock", "wall", "bush"].includes(mode.itemKey)) setMode({ type: "normal" });
        else if (s.farm.coins < (s.catalog.decor[mode.itemKey]?.price ?? 0)) setMode({ type: "normal" });
      } else if (mode.type === "edit" && mode.selected) {
        applyState(await farmApi.move(userId, mode.selected.kind, mode.selected.id, x, y)); setMode({ type: "edit", selected: null }); sfx.pop();
      }
    } catch (e: any) { swalAlert("", e.message, "info"); }
  };

  const onDecorClick = async (d: DecorPlaced) => {
    if (!state || mode.type !== "edit") return;
    if (mode.selected?.id !== d.uid) { setMode({ type: "edit", selected: { kind: "decor", id: d.uid } }); sfx.pop(); return; }
    const item = state.catalog.decor[d.key];
    const refund = sellValue(item, state.catalog);
    const r = await fire({ title: item?.name || "Vật phẩm", html: `Bán lại chỉ được <b>${refund} xu</b> (bạn mua ${item?.price} ${item?.currency === "gems" ? "kim cương" : "xu"}) — rất lỗ.<br/>Muốn giữ thì bấm 1 ô trống để dời đồ sang đó.`, showCancelButton: true, confirmButtonText: `Bán lấy ${refund} xu`, cancelButtonText: "Giữ lại", confirmButtonColor: "#b45309" });
    if (r.isConfirmed) { try { const s = await farmApi.sell(userId, d.uid); applyState(s); toast(`Đã bán · +${s.sold?.refund} xu`); setMode({ type: "edit", selected: null }); } catch (e: any) { swalAlert("Lỗi", e.message, "error"); } }
  };

  const onPetClick = () => {
    sfx.pop();
    setPetJumping(false); requestAnimationFrame(() => setPetJumping(true)); setTimeout(() => setPetJumping(false), 600);
    const id = Date.now(); setHearts((h) => [...h, id]); setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1000);
    farmApi.patPet(userId).catch(() => { });
  };

  const expand = async () => {
    try { const s = await farmApi.buy(userId, "expand"); applyState(s); setPanel(null); toast(`Đã mở rộng đất lên ${s.farm.gridW}×${s.farm.gridH}`); confetti({}); } catch (e: any) { swalAlert("", e.message, "info"); }
  };

  const closeTut = () => { try { localStorage.setItem(TUT_KEY, "1"); } catch { /* bỏ qua */ } setPanel(null); };

  if (error) return <div className="ui-card p-8 text-center"><p className="text-red-600 font-bold">{error}</p><button onClick={load} className="btn-primary rounded-full px-5 py-2.5 mt-4 font-bold">Thử lại</button></div>;
  if (!state) return <div className="ui-card p-8 text-center text-muted">Đang mở cổng nông trại...</div>;

  const { farm, catalog, user, orders, quests, achievements } = state;
  const outfit: Outfit = Object.fromEntries(Object.entries(farm.wardrobe.equipped).map(([slot, key]) => [slot, catalog.outfits[key]?.emoji || ""]).filter(([, e]) => e));
  const lvPct = Math.min(100, ((farm.harvestCount - farm.levelStart) / Math.max(1, farm.nextLevelAt - farm.levelStart)) * 100);
  const readyOrders = orders.filter((o) => o.ready).length;
  const barnFull = farm.barnUsed >= farm.barnCapacity;
  const claimable = quests.claimable + achievements.claimable;
  // Múi giờ + giờ mặt trời mọc/lặn của VỊ TRÍ (khi đã bật thời tiết); chưa bật thì theo múi giờ thiết bị
  const wdata = wx.status === "ok" ? wx.data : null;
  const sky = skyNow(now, skyTime, { offsetMin: wdata ? wdata.utcOffsetSec / 60 : undefined, sunrise: wdata?.sunrise, sunset: wdata?.sunset });
  const weather: WeatherKind = wxPreview ?? wdata?.kind ?? "clear";
  const questsDone = quests.items.filter((q) => q.claimed).length;

  const dock: { k: Panel; label: string; Icon: (p: { size?: number }) => React.ReactElement; c1: string; c2: string; badge?: string }[] = [
    { k: "SHOP", label: "Cửa hàng", Icon: IconShop, c1: "#fb923c", c2: "#ea580c" },
    { k: "PET", label: farm.pet.name, Icon: IconPaw, c1: "#60a5fa", c2: "#2563eb", badge: farm.pet.fedToday ? undefined : "!" },
    { k: "QUESTS", label: "Nhiệm vụ", Icon: IconTarget, c1: "#fb7185", c2: "#e11d48", badge: claimable > 0 ? String(claimable) : undefined },
    { k: "WHEEL", label: "Vòng quay", Icon: IconWheel, c1: "#a78bfa", c2: "#7c3aed", badge: farm.canSpin ? "!" : undefined },
    { k: "NEIGHBORS", label: "Bạn bè", Icon: IconUsers, c1: "#34d399", c2: "#059669" },
    { k: "BARN", label: "Kho", Icon: IconBarn, c1: "#fbbf24", c2: "#d97706", badge: barnFull || orders.some((o) => o.kind === "PRODUCE" && o.ready) ? "!" : undefined },
  ];
  const tools: { k: string; title: string; Icon: (p: { size?: number }) => React.ReactElement; on?: boolean; run: () => void }[] = [
    { k: "EDIT", title: mode.type === "edit" ? "Xong sắp xếp" : "Sắp xếp đất & trang trí", Icon: IconMove, on: mode.type === "edit", run: () => { sfx.click(); setMode(mode.type === "edit" ? { type: "normal" } : { type: "edit", selected: null }); } },
    { k: "SOUND", title: soundOn ? "Tắt âm thanh" : "Bật âm thanh", Icon: soundOn ? IconVolume : IconVolumeOff, on: !soundOn, run: toggleSound },
    { k: "WEATHER", title: wx.status === "ok" ? "Thời tiết theo vị trí (đang bật)" : "Bật thời tiết theo vị trí", Icon: IconWeather, on: wx.status === "ok", run: () => openPanel("WEATHER") },
    { k: "FS", title: fs ? "Thu nhỏ" : "Toàn màn hình", Icon: fs ? IconMinimize : IconMaximize, run: toggleFullscreen },
    { k: "HELP", title: "Hướng dẫn", Icon: IconHelp, run: () => openPanel("HELP") },
    { k: "RELOAD", title: "Tải lại", Icon: IconRefresh, run: () => { sfx.click(); load(); toast("Đã tải lại"); } },
  ];

  return (
    <div ref={rootRef} id="farm-root" className={`farm-root-pad grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] ${fs ? "farm-fullscreen" : ""}`}>
      <div className="space-y-3 min-w-0">
        {/* Thanh trạng thái */}
        <div className="ui-card px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-3">
          <div className="flex items-center gap-3 flex-1 min-w-[190px]">
            <div className="farm-lv" title={`Cấp nông trại ${farm.level}`}><small>CẤP</small><b>{farm.level}</b></div>
            <div className="flex-1 min-w-[110px]">
              <div className="flex justify-between text-xs font-bold text-muted"><span>Thu hoạch</span><span>{farm.harvestCount}/{farm.nextLevelAt}</span></div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className="h-full rounded-full bg-gradient-to-r from-primary to-secondary transition-all duration-500" style={{ width: `${lvPct}%` }} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span key={`c${farm.coins}`} className="farm-pill farm-pill-coin farm-pop" title="Xu"><CoinIcon size={21} />{farm.coins}</span>
            <span key={`g${farm.gems}`} className="farm-pill farm-pill-gem farm-pop" title="Kim cương"><GemIcon size={21} />{farm.gems}</span>
            <span className={`farm-pill ${barnFull ? "farm-pill-full" : "farm-pill-barn"}`} title="Kho nông sản"><BasketIcon size={21} />{farm.barnUsed}/{farm.barnCapacity}</span>
            {farm.boostHarvests > 0 && <span className="ui-badge bg-pink-100 text-pink-800 text-xs inline-flex items-center gap-1"><IconBolt size={12} />x2 xu · còn {farm.boostHarvests} lần</span>}
          </div>
          <div className="flex items-center gap-3 text-sm font-extrabold ml-auto">
            <span className="inline-flex items-center gap-1 text-orange-600" title="Chuỗi ngày học"><IconFlame size={18} />{user.streakCount}</span>
            <span className="inline-flex items-center gap-1 text-primary" title="Tổng XP"><IconBolt size={17} />{user.totalXP} XP</span>
          </div>
        </div>

        {/* Thanh chế độ */}
        {mode.type !== "normal" && (
          <div className={`rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-sm font-bold ${mode.type === "place" ? "bg-amber-50 text-amber-900 border border-amber-200" : "bg-primary-soft text-primary"}`}>
            <span>{mode.type === "place" ? `Chọn 1 ô trống (viền vàng) để đặt ${mode.label}` : mode.selected ? "Chọn ô trống để dời, hoặc bấm lại vật phẩm để bán" : "Chế độ sắp xếp: bấm vào ô đất hoặc vật trang trí để chọn"}</span>
            <button onClick={() => setMode({ type: "normal" })} className="btn-outline rounded-full px-3 py-1.5 text-xs">Xong</button>
          </div>
        )}

        <div className="relative">
          <FarmScene farm={farm} plots={state.plots} catalog={catalog} now={now} mode={mode} pet={{ name: farm.pet.name, level: farm.pet.level }} outfit={outfit} petJumping={petJumping} hearts={hearts} floats={floats} sky={sky} weather={weather}
            onTileClick={onTileClick} onPlotClick={onPlotClick} onDecorClick={onDecorClick} onPetClick={onPetClick} />
          {readyPlots.length > 0 && mode.type === "normal" && (
            <button onClick={() => { sfx.click(); setActivePlot(readyPlots[0]); setPanel("HARVEST"); }} className="absolute top-3 left-3 z-[5] btn-highlight rounded-full pl-3 pr-4 py-2 font-extrabold shadow-card farm-toast inline-flex items-center gap-2"><IconSprout size={18} />{readyPlots.length} cây chín</button>
          )}
          <div className="farm-tools">
            {tools.map((t) => <button key={t.k} onClick={t.run} title={t.title} aria-label={t.title} className={`farm-tool ${t.on ? "farm-tool-on" : ""}`}><t.Icon size={19} /></button>)}
          </div>
          <button className="farm-phase" onClick={() => openPanel("WEATHER")} title={wx.status === "ok" ? "Xem dự báo thời tiết" : "Bật thời tiết thật theo vị trí của bạn"}>
            <b>{sky.label}</b><span>{PHASE_LABEL[sky.phase]}</span>
            {wdata && wdata.tempC != null ? <span>{wdata.tempC}°C {weatherLabel(weather, wdata.isDay)}</span> : wxPreview ? <span>{WEATHER_LABEL[wxPreview]} (xem thử)</span> : null}
            <span className="opacity-70">{sky.gmt}{sky.preview ? " · xem thử" : ""}</span>
          </button>
          <div className="absolute left-1/2 -translate-x-1/2 bottom-12 z-10 flex flex-col items-center gap-1.5 pointer-events-none max-w-[92%]">
            {toasts.map((t) => <div key={t.id} className="farm-toast bg-white/95 border border-line rounded-full px-4 py-2 text-sm font-bold text-foreground shadow-card text-center">{t.msg}</div>)}
          </div>
        </div>

        {/* Thanh điều hướng dạng game */}
        <nav className="farm-dock" aria-label="Menu nông trại">
          {dock.map((b) => (
            <button key={b.k} className="farm-dock-btn" onClick={() => openPanel(b.k)} style={{ ["--c1" as any]: b.c1, ["--c2" as any]: b.c2 }} aria-label={b.label}>
              <span className="farm-dock-ico"><b.Icon size={26} /></span>
              <span className="farm-dock-label">{b.label}</span>
              {b.badge && <span className="farm-dock-badge">{b.badge}</span>}
            </button>
          ))}
        </nav>
      </div>

      <div className="space-y-4">
        <OrdersPanel userId={userId} orders={orders} catalog={catalog} coins={farm.coins} difficulty={farm.orderDifficulty} onState={applyState} onToast={toast} />
        {/* Nhiệm vụ hôm nay (rút gọn) — bấm để mở đầy đủ */}
        <button onClick={() => { setQuestTab("DAILY"); openPanel("QUESTS"); }} className="ui-card p-4 w-full text-left hover:shadow-card-hover transition-shadow">
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="font-extrabold text-primary inline-flex items-center gap-2"><IconTarget size={18} />Nhiệm vụ hôm nay</h3>
            <span className="text-xs font-bold text-muted">{questsDone}/{quests.items.length}{claimable > 0 ? ` · ${claimable} chờ nhận` : ""}</span>
          </div>
          <div className="space-y-2">
            {quests.items.map((q) => (
              <div key={q.id} className="flex items-center gap-2.5">
                <span className={`farm-ring !w-8 !h-8 ${q.claimed ? "farm-ring-done" : q.done ? "farm-ring-gold" : ""}`}><NamedIcon name={q.icon} size={16} /></span>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-xs font-bold"><span className={`truncate ${q.claimed ? "text-muted line-through" : "text-foreground"}`}>{q.label}</span><span className="text-muted shrink-0 ml-2">{q.progress}/{q.target}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1"><div className={`h-full rounded-full transition-all ${q.done ? "bg-emerald-500" : "bg-primary"}`} style={{ width: `${(q.progress / q.target) * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted mt-3">{state.plots.filter((p) => p.status !== "EMPTY").length}/{farm.plotCount} ô đang trồng · {readyPlots.length} cây chín · {readyOrders} đơn đủ hàng</p>
        </button>
      </div>

      {/* Panels */}
      {panel === "SEED" && activePlot && <SeedPicker userId={userId} plot={activePlot} catalog={catalog} onClose={() => setPanel(null)} onState={(s) => { applyState(s); toast("Đã trồng! Chín lần đầu sau 10 phút."); }} />}
      {panel === "HARVEST" && activePlot && (
        <HarvestModal userId={userId} plot={activePlot} cropName={catalog.crops[activePlot.cropKey || ""]?.name || "cây"} nextReadyPlot={nextReadyAfter(activePlot.id)}
          onClose={() => setPanel(null)} onState={applyState} onNext={(p) => setActivePlot(p)} catalog={catalog} />
      )}
      {panel === "SHOP" && <ShopPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} onToast={toast} onPick={(k, label) => { setPanel(null); setMode({ type: "place", itemKey: k, label }); }} onExpand={expand} />}
      {panel === "PET" && <PetPanel userId={userId} farm={farm} catalog={catalog} onClose={() => { setPanel(null); load(); }} onState={applyState} />}
      {panel === "WHEEL" && <WheelPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} />}
      {panel === "NEIGHBORS" && <NeighborsPanel userId={userId} catalog={catalog} sky={sky} weather={weather} onClose={() => setPanel(null)} onToast={toast} onRefresh={load} />}
      {panel === "BARN" && <BarnPanel userId={userId} farm={farm} catalog={catalog} onClose={() => setPanel(null)} onState={applyState} onToast={toast} />}
      {panel === "WEATHER" && <WeatherPanel status={wx.status} data={wx.data} error={wx.error} sky={sky} previewKind={wxPreview} onEnable={wx.enable} onDisable={wx.disable} onRefresh={wx.refresh} onClose={() => setPanel(null)} />}
      {panel === "QUESTS" && <QuestsPanel userId={userId} quests={quests} achievements={achievements} initialTab={questTab} onClose={() => setPanel(null)} onState={applyState} />}
      {panel === "HELP" && (
        <Modal title="Chào mừng tới Nông Trại Qilin!" subtitle="Vừa chơi vừa nhớ từ — cây lớn theo đúng lịch ôn của bạn" onClose={closeTut}
          footer={<button onClick={closeTut} className="btn-primary rounded-full px-6 py-2.5 font-bold w-full">Bắt đầu trồng!</button>}>
          <ol className="space-y-3 text-sm text-foreground">
            {([
              ["sprout", "Bấm ô đất trống (dấu +) để chọn 1 từ và trồng. Xem thẻ từ trước khi trồng."],
              ["seed", "Cây chín lần đầu sau 10 phút. Những lần sau chín theo lịch ôn SRS (1 ngày, 6 ngày, lâu hơn). Không mua được thời gian!"],
              ["pen", "Cây chín hiện dấu ! — bấm để thu hoạch bằng cách trả lời 1 câu về từ đó. Đúng được xu, XP và nông sản; sai thì cây héo, học lại sau 10 phút."],
              ["truck", "Giao đơn hàng cho khách để nhận thưởng lớn, càng giao nhiều đơn càng khó. Đơn 'Viết câu' được AI chấm; đơn nông sản lấy hàng từ Kho."],
              ["target", "Mỗi ngày có 4 nhiệm vụ và 1 rương thưởng; Thành tựu là các mốc dài hạn. Vào mục Nhiệm vụ để nhận thưởng."],
              ["palette", "Phần chơi thuần: trang trí nông trại, mua trang phục cho Qilin con, vòng quay mỗi ngày, thăm nông trại và xem Bảng vàng của bạn bè."],
              ["star", "Từ nhớ lâu hơn 21 ngày = thuộc lòng. Cất vào kho để lấy chỗ trồng từ mới, hoặc ôn kho từ để kiếm thêm xu."],
              ["wheel", "Cảnh nông trại đổi theo giờ thật (bình minh, sáng, trưa, chiều, hoàng hôn, đêm; khuya Qilin đi ngủ). Bấm nút đám mây bên phải để bật thời tiết thật theo vị trí của bạn (nắng, mưa, giông...). Nút loa để tắt âm thanh."],
            ] as [string, string][]).map(([i, t]) => <li key={t} className="flex gap-3 items-start"><span className="farm-ring !w-9 !h-9 mt-0.5"><NamedIcon name={i} size={18} /></span><span className="pt-1">{t}</span></li>)}
          </ol>
        </Modal>
      )}
    </div>
  );
}
