"use client";
import { useEffect, useRef, useState } from "react";

// Game Qilin Run là 1 trang HTML tĩnh (public/games/qilin-run/play.html, build từ games-src/qilin-run/)
// nhúng qua iframe: CSS/JS của game tách hẳn khỏi globals.css nên không đụng class của app.
export const QILIN_RUN_SRC = "/games/qilin-run/play.html";

export default function QilinRunEmbed() {
  const wrap = useRef<HTMLDivElement>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFull = async () => {
    const el = wrap.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else window.location.assign(QILIN_RUN_SRC); // iPhone không cho phóng to 1 khung trong trang
    } catch {
      window.location.assign(QILIN_RUN_SRC);
    }
  };

  return (
    <div>
      <div
        ref={wrap}
        className="relative w-full overflow-hidden rounded-2xl border border-line shadow-card bg-[#0e1d48]"
        style={full ? { height: "100%" } : { height: "min(820px, calc(100dvh - 5rem))", minHeight: 480 }}
      >
        <iframe
          src={QILIN_RUN_SRC}
          title="Game học tiếng Anh Qilin Run"
          className="absolute inset-0 w-full h-full border-0"
          allow="fullscreen; autoplay"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Bấm vào khung game một lần để dùng bàn phím (Space để nhảy, 1–3 để chọn đáp án).</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleFull} className="btn-outline px-4 py-2 text-sm cursor-pointer">
            {full ? "Thoát toàn màn hình" : "Toàn màn hình"}
          </button>
          <a href={QILIN_RUN_SRC} className="btn-ghost px-4 py-2 text-sm">Mở game ở trang riêng</a>
        </div>
      </div>
    </div>
  );
}
