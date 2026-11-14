"use client";
import { useEffect, useState } from "react";
import Modal from "./Modal";
import { farmApi, speak, type BarnItem } from "@/lib/farm/api";

// Kho từ đã thuộc lòng (MASTERED): thành quả tích luỹ của nông trại.
export default function BarnPanel({ userId, barnCount, onClose }: { userId: string; barnCount: number; onClose: () => void }) {
  const [items, setItems] = useState<BarnItem[] | null>(null);
  useEffect(() => { farmApi.barn(userId).then(setItems).catch(() => setItems([])); }, [userId]);
  return (
    <Modal title="🏚️ Kho từ đã thuộc" subtitle={`${barnCount} từ đã cất kho · ${items?.length ?? "…"} từ ở mức Thuộc lòng`} onClose={onClose}>
      {items === null ? <p className="text-center text-muted py-8">Đang mở kho...</p> : items.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted">
          <div className="text-5xl mb-2">🌱</div>
          <p className="font-semibold">Kho còn trống.</p>
          <p className="mt-1">Một từ được coi là <b>thuộc lòng</b> khi bạn nhớ đúng nhiều lần đến mức lịch ôn cách nhau hơn 21 ngày. Khi đó cây hiện ⭐ và bạn có thể cất kho để lấy chỗ trồng từ mới.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((w) => (
            <div key={w.progressId} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2">
              <button onClick={() => speak(w.word)} className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary">🔊</button>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground">{w.word} {w.phonetic && <span className="text-xs text-muted font-normal">/{w.phonetic}/</span>}</p>
                <p className="text-sm text-muted truncate">{w.meaning}{w.example ? ` · “${w.example}”` : ""}</p>
              </div>
              <span className="ui-badge text-[10px] bg-emerald-100 text-emerald-800">{w.onPlot ? "trên đất" : "trong kho"} · {w.interval}d</span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
