"use client";

import { useEffect, useState } from "react";

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;
  if (!deferredPrompt && !isIOS) return null;

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSHint(true);
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  return (
    <div className="relative shrink-0">
      <button
        onClick={handleInstall}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white text-primary font-bold text-sm whitespace-nowrap shadow-sm hover:bg-primary-soft transition-colors cursor-pointer"
      >
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Cài Đặt Ứng Dụng
      </button>
      {showIOSHint && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-line rounded-2xl shadow-card p-4 text-sm text-muted z-20">
          Nhấn nút <b>Chia sẻ</b> (⬆️) trên Safari, sau đó chọn <b>&quot;Thêm vào Màn hình chính&quot;</b> để cài đặt ứng dụng.
          <button onClick={() => setShowIOSHint(false)} className="block mt-3 px-4 py-2 rounded-full bg-primary text-white text-xs font-bold cursor-pointer hover:bg-[#172e6e] transition-colors">Đã hiểu</button>
        </div>
      )}
    </div>
  );
}
