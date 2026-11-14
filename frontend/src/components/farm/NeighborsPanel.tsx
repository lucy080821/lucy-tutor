"use client";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import Modal from "./Modal";
import FarmScene from "./FarmScene";
import { farmApi, type Catalog, type Neighbor, type VisitView } from "@/lib/farm/api";

// Thăm nông trại bạn cùng lớp (qua Classroom): xem đất, thích (+xu cho bạn), tặng quà (tốn xu nhỏ).
export default function NeighborsPanel({ userId, catalog, onClose, onToast, onRefresh }: { userId: string; catalog: Catalog; onClose: () => void; onToast: (m: string) => void; onRefresh: () => void }) {
  const [data, setData] = useState<{ neighbors: Neighbor[]; giftsLeft: number; hasClassroom: boolean } | null>(null);
  const [visit, setVisit] = useState<VisitView | null>(null);
  const [visiting, setVisiting] = useState<Neighbor | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => farmApi.neighbors(userId).then(setData).catch(() => setData({ neighbors: [], giftsLeft: 0, hasClassroom: false }));
  useEffect(() => { load(); }, [userId]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const open = async (n: Neighbor) => {
    setVisiting(n); setVisit(null);
    try { setVisit(await farmApi.visit(userId, n.id)); } catch (e: any) { Swal.fire("", e.message, "info"); setVisiting(null); }
  };
  const react = async (n: Neighbor, type: "LIKE" | "GIFT") => {
    if (busy) return; setBusy(n.id + type);
    try {
      const r = await farmApi.react(userId, n.id, type);
      onToast(type === "LIKE" ? `❤️ Đã thích nông trại của ${n.name} (+${r.reward} xu cho bạn ấy)` : `🎁 Đã tặng quà cho ${n.name}`);
      await load(); onRefresh();
      if (visit) setVisit({ ...visit, likes: visit.likes + (type === "LIKE" ? 1 : 0) });
    } catch (e: any) { Swal.fire("", e.message, "info"); }
    setBusy(null);
  };

  if (visiting) {
    const n = data?.neighbors.find((x) => x.id === visiting.id) || visiting;
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
            <FarmScene farm={visit.farm} plots={visit.plots} catalog={visit.catalog} now={now} mode={{ type: "normal" }} readOnly pet={{ name: visit.farm.pet.name, level: visit.farm.pet.level }} />
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="ui-badge bg-amber-100 text-amber-800">🌱 {visit.plots.filter((p) => p.status !== "EMPTY").length} cây đang trồng</span>
              <span className="ui-badge bg-emerald-100 text-emerald-800">⭐ {visit.farm.barnCount} từ đã cất kho</span>
              <span className="ui-badge bg-primary-soft text-primary">🔥 chuỗi {visit.owner.streakCount} ngày</span>
            </div>
          </>
        )}
      </Modal>
    );
  }

  return (
    <Modal title="👋 Bạn cùng lớp" subtitle={data ? `Hôm nay còn ${data.giftsLeft} lượt tặng quà` : undefined} onClose={onClose}>
      {!data ? <p className="text-center text-muted py-8">Đang tải...</p> : !data.hasClassroom ? (
        <div className="text-center py-8 text-muted text-sm"><p className="font-semibold">Bạn chưa tham gia lớp nào.</p><p className="mt-1">Vào Dashboard → Tham gia lớp bằng mã của giáo viên để thăm nông trại bạn bè.</p></div>
      ) : data.neighbors.length === 0 ? <p className="text-center text-muted py-8 text-sm">Lớp chưa có bạn nào khác.</p> : (
        <div className="space-y-2">
          {data.neighbors.map((n, i) => (
            <div key={n.id} className="flex items-center gap-3 rounded-2xl border border-line p-3 bg-white">
              <div className="w-9 h-9 rounded-full bg-primary-soft text-primary font-extrabold flex items-center justify-center">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate">{n.name}</p>
                <p className="text-xs text-muted">{n.hasFarm ? `Cấp ${n.level} · ${n.harvestCount} thu hoạch · thú cưng ${n.petName}` : "Chưa mở nông trại"} · {n.classroom}</p>
              </div>
              {n.hasFarm && (
                <div className="flex gap-1">
                  <button disabled={n.likedToday || !!busy} onClick={() => react(n, "LIKE")} className="w-10 h-10 rounded-full hover:bg-primary-soft disabled:opacity-40" title="Thích">{n.likedToday ? "❤️" : "🤍"}</button>
                  <button onClick={() => open(n)} className="btn-outline rounded-full px-3 py-2 text-sm font-bold">Thăm</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
