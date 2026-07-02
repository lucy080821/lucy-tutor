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
        className="px-4 py-2.5 bg-primary/10 text-primary font-bold text-sm hover:bg-primary hover:text-white transition-colors cursor-pointer flex items-center gap-2 rounded-lg whitespace-nowrap"
      >
        📲 Cài Đặt Ứng Dụng
      </button>
      {showIOSHint && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-sm text-slate-600 z-20">
          Nhấn nút <b>Chia sẻ</b> (⬆️) trên Safari, sau đó chọn <b>&quot;Thêm vào Màn hình chính&quot;</b> để cài đặt ứng dụng.
          <button onClick={() => setShowIOSHint(false)} className="block mt-2 text-primary font-bold cursor-pointer">Đã hiểu</button>
        </div>
      )}
    </div>
  );
}
