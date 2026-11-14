"use client";
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import FarmScene from "./FarmScene";
import { alert as swalAlert } from "./farmSwal";
import { farmApi, type Catalog, type LeaderRow, type Neighbor, type NeighborGroup, type VisitView } from "@/lib/farm/api";
import { IconCrown, IconFlame } from "./FarmIcons";
import type { SkyInfo } from "./Ambient";
import type { WeatherKind } from "@/lib/farm/weather";

// Bạn bè toàn app (không cần tham gia lớp): nhóm theo lớp — "Lớp của tôi" đứng đầu, rồi các lớp khác, cuối cùng là học viên tự do.
// Thăm nông trại (chỉ xem), thích (+xu cho bạn), tặng quà (tốn xu nhỏ, tối đa 3/ngày).
export default function NeighborsPanel({ userId, catalog, sky, weather, onClose, onToast, onRefresh }: { userId: string; catalog: Catalog; sky?: SkyInfo; weather?: WeatherKind; onClose: () => void; onToast: (m: string) => void; onRefresh: () => void }) {
  const [data, setData] = useState<{ groups: NeighborGroup[]; total: number; giftsLeft: number; hasClassroom: boolean } | null>(null);
  const [visit, setVisit] = useState<VisitView | null>(null);
  const [visiting, setVisiting] = useState<Neighbor | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Tab: danh sách bạn (nhóm theo lớp) | Bảng vàng nông dân
  const [tab, setTab] = useState<"FRIENDS" | "TOP">("FRIENDS");
  const [scope, setScope] = useState<"all" | "class">("all");
  const [board, setBoard] = useState<{ top: LeaderRow[]; total: number; myRank: number | null; hasClassroom: boolean } | null>(null);
  useEffect(() => {
    if (tab !== "TOP") return;
    setBoard(null);
    farmApi.leaderboard(userId, scope).then(setBoard).catch(() => setBoard({ top: [], total: 0, myRank: null, hasClassroom: false }));
  }, [tab, scope, userId]);
  const asNeighbor = (r: LeaderRow): Neighbor => ({ id: r.id, name: r.name, level: r.level, harvestCount: r.harvestCount, barnCount: r.barnCount, petName: r.petName, petLevel: r.petLevel, streak: r.streak, equipped: r.equipped, lastActive: "", likedToday: false, giftedToday: false });

  const load = () => farmApi.neighbors(userId).then((d) => { setData(d); setOpen((o) => { const n = { ...o }; d.groups.forEach((g, i) => { if (n[g.id] === undefined) n[g.id] = g.mine || i === 0; }); return n; }); }).catch(() => setData({ groups: [], total: 0, giftsLeft: 0, hasClassroom: false }));
  useEffect(() => { load(); }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const groups = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    return data.groups.map((g) => ({ ...g, members: s ? g.members.filter((m) => m.name.toLowerCase().includes(s)) : g.members })).filter((g) => g.members.length > 0);
  }, [data, q]);

  const open_ = async (n: Neighbor) => {
    setVisiting(n); setVisit(null);
    try { setVisit(await farmApi.visit(userId, n.id)); } catch (e: any) { swalAlert("", e.message, "info"); setVisiting(null); }
  };
  const react = async (n: Neighbor, type: "LIKE" | "GIFT") => {
    if (busy) return; setBusy(n.id + type);
    try {
      const r = await farmApi.react(userId, n.id, type);
      onToast(type === "LIKE" ? `❤️ Đã thích nông trại của ${n.name} (+${r.reward} xu cho bạn ấy)` : `🎁 Đã tặng quà cho ${n.name}`);
      await load(); onRefresh();
      if (visit) setVisit({ ...visit, likes: visit.likes + (type === "LIKE" ? 1 : 0) });
    } catch (e: any) { swalAlert("", e.message, "info"); }
    setBusy(null);
  };
  const outfitOf = (eq: Record<string, string>) => Object.values(eq).map((k) => catalog.outfits[k]?.emoji).filter(Boolean).join("");

  if (visiting) {
    const n = data?.groups.flatMap((g) => g.members).find((x) => x.id === visiting.id) || visiting;
    const vEquipped = visit ? Object.fromEntries(Object.entries(visit.farm.wardrobe.equipped).map(([s, k]) => [s, visit.catalog.outfits[k]?.emoji || ""]).filter(([, e]) => e)) as Record<string, string> : undefined;
    return (
      <Modal title={`🏡 Nông trại của ${visiting.name}`} subtitle={visit ? `Cấp ${visit.farm.level} · ${visit.farm.harvestCount} lần thu hoạch · ❤️ ${visit.likes}` : "Đang tới..."} onClose={onClose} wide
        footer={<div className="flex flex-wrap gap-2 items-center justify-between">
          <button onClick={() => setVisiting(null)} className="btn-ghost rounded-full px-4 py-2 font-bold">← Danh sách</button>
          <div className="flex gap-2">
            <button disabled={n.likedToday || !!busy} onClick={() => react(n, "LIKE")} className="btn-outline rounded-full px-4 py-2 font-bold disabled:opacity-50">{n.likedToday ? "❤️ Đã thích" : "🤍 Thích"}</button>
            <button disabled={n.giftedToday || !data?.giftsLeft || !!busy} onClick={() => react(n, "GIFT")} className="btn-primary rounded-full px-4 py-2 font-bold disabled:opacity-50">🎁 Tặng quà (−{catalog.visit.giftCost} xu)</button>
          </div>
        </div>}>
        {!visit ? <p className="text-center text-muted py-10">Đang đi bộ sang nhà bạn...</p> : (
          <>
            <FarmScene farm={visit.farm} plots={visit.plots} catalog={visit.catalog} now={now} mode={{ type: "normal" }} readOnly pet={{ name: visit.farm.pet.name, level: visit.farm.pet.level }} outfit={vEquipped} sky={sky} weather={weather} />
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="ui-badge bg-amber-100 text-amber-800">🌱 {visit.plots.filter((p) => p.status !== "EMPTY").length} cây đang trồng</span>
              <span className="ui-badge bg-emerald-100 text-emerald-800">⭐ {visit.farm.barnCount} từ đã cất kho</span>
              <span className="ui-badge bg-primary-soft text-primary">🔥 chuỗi {visit.owner.streakCount} ngày</span>
              <span className="ui-badge bg-pink-100 text-pink-800">🎨 {visit.farm.layout.length} món trang trí</span>
            </div>
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="Bạn bè" subtitle={data ? `${data.total} bạn đã mở nông trại · hôm nay còn ${data.giftsLeft} lượt tặng quà` : undefined} onClose={onClose}>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setTab("FRIENDS")} className={`ui-chip ${tab === "FRIENDS" ? "ui-chip-active" : ""}`}>Danh sách bạn</button>
        <button onClick={() => setTab("TOP")} className={`ui-chip inline-flex items-center gap-1.5 ${tab === "TOP" ? "ui-chip-active" : ""}`}><IconCrown size={15} />Bảng vàng</button>
      </div>
      {tab === "TOP" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setScope("all")} className={`ui-chip text-xs ${scope === "all" ? "ui-chip-active" : ""}`}>Cả hệ thống</button>
            <button onClick={() => setScope("class")} className={`ui-chip text-xs ${scope === "class" ? "ui-chip-active" : ""}`}>Lớp của tôi</button>
            {board?.myRank && <span className="ml-auto text-sm font-extrabold text-primary">Hạng của bạn: #{board.myRank}/{board.total}</span>}
          </div>
          {!board ? <p className="text-center text-muted py-8">Đang tính điểm...</p> : board.top.length === 0 ? (
            <p className="text-center text-muted text-sm py-8">{scope === "class" && !board.hasClassroom ? "Bạn chưa vào lớp nào nên chưa có bảng riêng cho lớp." : "Chưa có ai trên bảng vàng."}</p>
          ) : (
            <div className="space-y-2">
              {board.top.map((r) => (
                <div key={r.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${r.isMe ? "border-primary bg-primary-soft" : "border-line bg-white"}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${r.rank === 1 ? "bg-amber-300 text-amber-900" : r.rank === 2 ? "bg-slate-300 text-slate-800" : r.rank === 3 ? "bg-orange-300 text-orange-900" : "bg-slate-100 text-slate-600"}`}>{r.rank <= 3 ? <IconCrown size={17} /> : r.rank}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{r.name}{r.isMe && <span className="ml-2 ui-badge text-[10px] bg-primary text-white">Bạn</span>} <span className="text-sm">{outfitOf(r.equipped)}</span></p>
                    <p className="text-xs text-muted truncate inline-flex items-center gap-2">Cấp {r.level} · {r.harvestCount} thu hoạch · {r.orders} đơn · <span className="inline-flex items-center gap-0.5"><IconFlame size={12} />{r.streak}</span></p>
                  </div>
                  {!r.isMe && <button onClick={() => open_(asNeighbor(r))} className="btn-outline rounded-full px-3 py-2 text-sm font-bold shrink-0">Thăm</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : !data ? <p className="text-center text-muted py-8">Đang tải...</p> : data.total === 0 ? (
        <div className="text-center py-8 text-sm text-muted">
          <div className="text-5xl mb-2">🌱</div>
          <p className="font-semibold">Chưa có bạn nào mở nông trại.</p>
          <p className="mt-1">Khi có học viên khác vào chơi, họ sẽ xuất hiện ở đây, nhóm theo lớp.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {!data.hasClassroom && <p className="text-xs rounded-xl bg-primary-soft text-primary px-3 py-2 font-semibold">Bạn chưa vào lớp nào nên vẫn thấy bạn bè của cả hệ thống. Tham gia lớp bằng mã của giáo viên để có nhóm "Lớp của tôi" riêng.</p>}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm bạn theo tên..." className="ui-input w-full py-2" />
          {groups.length === 0 && <p className="text-center text-muted text-sm py-4">Không tìm thấy bạn nào.</p>}
          {groups.map((g) => {
            const isOpen = q ? true : open[g.id];
            return (
              <div key={g.id} className="rounded-2xl border border-line overflow-hidden bg-white">
                <button onClick={() => setOpen((o) => ({ ...o, [g.id]: !o[g.id] }))} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-primary-soft">
                  <span className="text-lg">{g.id === "FREE" ? "🧑‍🌾" : "🏫"}</span>
                  <span className="flex-1 min-w-0 font-extrabold text-primary truncate">{g.name}{g.mine && <span className="ml-2 ui-badge text-[10px] bg-emerald-100 text-emerald-800">Lớp của tôi</span>}</span>
                  <span className="text-xs font-bold text-muted">{g.members.length} bạn</span>
                  <span className="text-muted">{isOpen ? "▾" : "▸"}</span>
                </button>
                {isOpen && (
                  <div className="divide-y divide-line">
                    {g.members.map((n, i) => (
                      <div key={n.id} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-soft text-primary font-extrabold flex items-center justify-center text-sm shrink-0">{i + 1}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground truncate">{n.name} {outfitOf(n.equipped) && <span className="text-sm">{outfitOf(n.equipped)}</span>}</p>
                          <p className="text-xs text-muted truncate">Cấp {n.level} · {n.harvestCount} thu hoạch · ⭐ {n.barnCount} · 🔥 {n.streak} · {n.petName} cấp {n.petLevel}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button disabled={n.likedToday || !!busy} onClick={() => react(n, "LIKE")} className="w-10 h-10 rounded-full hover:bg-primary-soft disabled:opacity-40" title="Thích">{n.likedToday ? "❤️" : "🤍"}</button>
                          <button onClick={() => open_(n)} className="btn-outline rounded-full px-3 py-2 text-sm font-bold">Thăm</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
