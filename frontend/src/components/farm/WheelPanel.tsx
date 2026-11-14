"use client";
import { useState } from "react";
import Swal from "sweetalert2";
import Modal from "./Modal";
import { farmApi, type Catalog, type FarmState, type FarmView } from "@/lib/farm/api";

const COLORS = ["#fde68a", "#bae6fd", "#fecaca", "#bbf7d0", "#e9d5ff", "#fed7aa", "#c7d2fe", "#fbcfe8"];

// Vòng quay may mắn: server chọn ô (theo tỉ lệ), client chỉ quay kim tới đúng ô đó.
export default function WheelPanel({ userId, farm, catalog, onClose, onState }: { userId: string; farm: FarmView; catalog: Catalog; onClose: () => void; onState: (s: FarmState) => void }) {
  const segs = catalog.wheel; const n = segs.length; const step = 360 / n;
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pending, setPending] = useState<FarmState | null>(null);
  const [done, setDone] = useState<FarmState["spin"] | null>(null);

  const spin = async () => {
    if (spinning || !farm.canSpin) return;
    setSpinning(true);
    try {
      const s = await farmApi.spin(userId);
      const idx = segs.findIndex((x) => x.id === s.spin!.segmentId);
      // Kim ở đỉnh (12h). Ô i nằm ở góc [i*step, (i+1)*step] tính từ 12h theo chiều kim đồng hồ → xoay ngược về giữa ô.
      const target = 360 * 6 - (idx * step + step / 2) + (Math.random() * step * 0.6 - step * 0.3);
      setRot(target); setPending(s);
    } catch (e: any) { setSpinning(false); Swal.fire("", e.message, "info"); }
  };
  const finished = () => {
    if (!pending) return;
    onState(pending); setDone(pending.spin || null); setSpinning(false);
  };

  const R = 120;
  return (
    <Modal title="🎡 Vòng quay may mắn" subtitle={farm.canSpin ? "Mỗi ngày 1 lượt, không cần làm bài!" : "Hôm nay bạn đã quay rồi — mai quay tiếp nhé"} onClose={onClose}>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: 2 * R + 20, height: 2 * R + 20 }}>
          <div className="absolute left-1/2 -translate-x-1/2 -top-1 z-10 text-3xl drop-shadow">🔻</div>
          <svg viewBox={`${-R - 10} ${-R - 10} ${2 * R + 20} ${2 * R + 20}`} className="farm-wheel w-full h-full" style={{ transform: `rotate(${rot}deg)` }} onTransitionEnd={finished}>
            {segs.map((s, i) => {
              const a0 = ((i * step - 90) * Math.PI) / 180, a1 = (((i + 1) * step - 90) * Math.PI) / 180;
              const x0 = R * Math.cos(a0), y0 = R * Math.sin(a0), x1 = R * Math.cos(a1), y1 = R * Math.sin(a1);
              const mid = ((i + 0.5) * step - 90) * (Math.PI / 180);
              const tx = R * 0.62 * Math.cos(mid), ty = R * 0.62 * Math.sin(mid);
              return (
                <g key={s.id}>
                  <path d={`M0 0 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z`} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth={3} />
                  <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={800} fill="#1f2d3d" transform={`rotate(${(i + 0.5) * step} ${tx} ${ty})`}>{s.label}</text>
                </g>
              );
            })}
            <circle cx={0} cy={0} r={R} fill="none" stroke="#1e3a8a" strokeWidth={6} />
            <circle cx={0} cy={0} r={22} fill="#1e3a8a" /><text x={0} y={5} textAnchor="middle" fontSize={16} fill="#fff" fontWeight={800}>GO</text>
          </svg>
        </div>
        {done ? (
          <div className="mt-4 text-center farm-toast">
            <p className="text-2xl font-extrabold text-primary">{done.kind === "nothing" ? "Hụt rồi 😅" : `🎉 ${done.label}!`}</p>
            <p className="text-sm text-muted mt-1">
              {done.kind === "coins" && `Đã cộng ${done.value} xu vào ví.`}
              {done.kind === "gems" && `Đã cộng ${done.value} kim cương.`}
              {done.kind === "boost" && `${done.value} lần thu hoạch tiếp theo được nhân đôi xu.`}
              {done.kind === "decor" && `Bạn nhận được ${catalog.decor[done.decorKey || ""]?.name || "một món trang trí"} — đã đặt sẵn trên đất.`}
              {done.kind === "nothing" && "Mai thử lại nhé, vận may đang tới!"}
            </p>
            <button onClick={onClose} className="btn-primary rounded-full px-6 py-2.5 font-bold mt-3">Tuyệt!</button>
          </div>
        ) : (
          <button onClick={spin} disabled={spinning || !farm.canSpin} className="btn-highlight rounded-full px-8 py-3 font-extrabold text-lg mt-4 disabled:opacity-50">{spinning ? "Đang quay..." : farm.canSpin ? "QUAY!" : "Hẹn mai"}</button>
        )}
      </div>
    </Modal>
  );
}
