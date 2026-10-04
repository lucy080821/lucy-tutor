"use client";

import { useState } from "react";

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard bị chặn */ }
  };

  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* người dùng huỷ */ }
    } else {
      copy();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-muted mr-1">Chia sẻ:</span>
      <a
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-outline text-sm"
      >
        Facebook
      </a>
      <button type="button" onClick={copy} className="btn-outline text-sm cursor-pointer">
        {copied ? "✓ Đã sao chép" : "Sao chép link"}
      </button>
      <button type="button" onClick={share} className="btn-ghost text-sm cursor-pointer sm:hidden">
        Khác…
      </button>
    </div>
  );
}
