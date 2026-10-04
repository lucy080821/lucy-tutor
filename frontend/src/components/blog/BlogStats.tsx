"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/blog";

// Lượt xem / lượt click của bài blog, hiện gần real-time trên /blog và /blog/[slug].
// Trang blog là server component được cache (ISR ~60s) nên số liệu render sẵn có thể cũ —
// provider này (mount ở app/blog/layout.tsx) gom slug của mọi bài đang hiện trên trang, làm mới
// bằng 1 request GET /api/blog/stats mỗi REFRESH_MS và ngay khi tab lấy lại focus (polling như
// dashboard, không dùng WebSocket). Click vào link có data-blog-click="<slug>" được đếm tự động.

type Stats = { views: number; clicks: number };
type StatsMap = Record<string, Stats>;

const REFRESH_MS = 15_000;

type Ctx = {
  stats: StatsMap;
  register: (slug: string, initial: Stats) => () => void;
  merge: (slug: string, s: Stats) => void;
};
const BlogStatsContext = createContext<Ctx | null>(null);

// Bộ đếm chỉ tăng — luôn giữ số lớn hơn để dữ liệu cache cũ / phản hồi về muộn không kéo số lùi lại.
const maxStats = (a: Stats | undefined, b: Stats): Stats =>
  a ? { views: Math.max(a.views, b.views), clicks: Math.max(a.clicks, b.clicks) } : b;

async function postCounter(slug: string, kind: "view" | "click"): Promise<Stats | null> {
  try {
    // keepalive: request vẫn gửi xong dù trang chuyển sang bài viết ngay sau cú click
    const res = await fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/${kind}`, { method: "POST", keepalive: true });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// Dùng được cả ngoài provider (vd thẻ blog ở dashboard học viên).
export const trackBlogClick = (slug: string) => postCounter(slug, "click");

export function BlogStatsProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<StatsMap>({});
  const slugCounts = useRef(new Map<string, number>());
  const [slugsVersion, setSlugsVersion] = useState(0);

  const merge = useCallback((slug: string, s: Stats) => {
    setStats((prev) => ({ ...prev, [slug]: maxStats(prev[slug], s) }));
  }, []);

  const register = useCallback((slug: string, initial: Stats) => {
    const m = slugCounts.current;
    m.set(slug, (m.get(slug) || 0) + 1);
    setStats((prev) => ({ ...prev, [slug]: maxStats(prev[slug], initial) }));
    setSlugsVersion((v) => v + 1);
    return () => {
      const n = (m.get(slug) || 1) - 1;
      if (n > 0) m.set(slug, n);
      else m.delete(slug);
    };
  }, []);

  // Làm mới định kỳ. slugsVersion đổi (chuyển trang, đổi trang phân trang) → nạp lại ngay cho các bài mới hiện.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (document.hidden) return;
      const slugs = [...slugCounts.current.keys()];
      if (!slugs.length) return;
      try {
        const res = await fetch(`${API_URL}/api/blog/stats?slugs=${encodeURIComponent(slugs.join(","))}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data: StatsMap = await res.json();
        setStats((prev) => {
          const next = { ...prev };
          for (const [slug, s] of Object.entries(data)) next[slug] = maxStats(prev[slug], s);
          return next;
        });
      } catch { /* mất mạng — giữ số cũ, lần sau thử lại */ }
    };
    const first = setTimeout(refresh, 300); // gom các thẻ đăng ký cùng lúc thành 1 request
    const timer = setInterval(refresh, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [slugsVersion]);

  // Đếm click cho mọi link gắn data-blog-click (thẻ bài viết là server component nên không gắn onClick được).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[data-blog-click]");
      const slug = link?.getAttribute("data-blog-click");
      if (!slug) return;
      setStats((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], clicks: prev[slug].clicks + 1 } } : prev));
      postCounter(slug, "click").then((s) => s && merge(slug, s));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [merge]);

  return <BlogStatsContext.Provider value={{ stats, register, merge }}>{children}</BlogStatsContext.Provider>;
}

const fmt = (n: number) => n.toLocaleString("vi-VN");

// "1.234 lượt xem · 56 lượt click" — nhận số liệu render sẵn từ server, sau đó tự cập nhật theo provider.
export function BlogPostStats({ slug, views, clicks, className = "" }: { slug: string; views: number; clicks: number; className?: string }) {
  const ctx = useContext(BlogStatsContext);
  const register = ctx?.register;
  useEffect(() => register?.(slug, { views, clicks }), [register, slug, views, clicks]);
  const s = ctx?.stats[slug] ?? { views, clicks };
  return (
    <span className={`tabular-nums ${className}`} aria-live="polite">
      {fmt(s.views)} lượt xem · {fmt(s.clicks)} lượt click
    </span>
  );
}

// Mở trang bài viết = 1 lượt xem. Trang được cache (ISR) nên phải đếm từ trình duyệt; mỗi tab chỉ đếm 1 lần/bài.
export function BlogViewTracker({ slug }: { slug: string }) {
  const merge = useContext(BlogStatsContext)?.merge;
  useEffect(() => {
    const key = `blog_viewed_${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* storage bị chặn — vẫn đếm */ }
    postCounter(slug, "view").then((s) => s && merge?.(slug, s));
  }, [slug, merge]);
  return null;
}

// ─── Thời gian giữ chân người đọc ───────────────────────────────────────────
// Đếm số giây người đọc THỰC SỰ ở lại: tab đang hiện + có tương tác (cuộn/chuột/phím/chạm) trong IDLE_MS gần nhất,
// hoặc đang bật "Nghe bài viết". Tối đa MAX_READ_SECONDS/lượt để tab bỏ quên không làm phình số liệu.
// Đồng thời ghi lại mốc cuộn 25/50/75/100% của phần nội dung bài. Gửi về backend mỗi khi tab bị ẩn / rời trang /
// chuyển sang bài khác (chỉ gửi phần chênh lệch kể từ lần gửi trước). Không lưu gì về danh tính người đọc.
const IDLE_MS = 60_000;
const MAX_READ_SECONDS = 30 * 60;
const SCROLL_MARKS = [25, 50, 75, 100];

export function BlogReadTracker({ slug }: { slug: string }) {
  useEffect(() => {
    const url = `${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/read`;
    let total = 0;
    let unsent = 0;
    let sessionSent = false;
    let lastActive = Date.now();
    const reached = new Set<number>();
    const pendingMarks: number[] = [];

    const measureScroll = () => {
      const content = document.querySelector<HTMLElement>("[data-blog-content]");
      if (!content) return;
      const rect = content.getBoundingClientRect();
      const percent = rect.height > 0 ? ((window.innerHeight - rect.top) / rect.height) * 100 : 100;
      for (const m of SCROLL_MARKS) {
        if (percent >= m && !reached.has(m)) { reached.add(m); pendingMarks.push(m); }
      }
    };
    const markActive = () => { lastActive = Date.now(); };
    const onScroll = () => { markActive(); measureScroll(); };

    const tick = setInterval(() => {
      if (window.speechSynthesis?.speaking) markActive(); // đang nghe bài viết = đang đọc
      if (document.hidden || Date.now() - lastActive > IDLE_MS || total >= MAX_READ_SECONDS) return;
      total++;
      unsent++;
    }, 1000);

    const flush = () => {
      // Lượt đọc chỉ được tính khi đã có ít nhất 1 giây đọc thật
      if (!unsent && (!sessionSent || !pendingMarks.length)) return;
      const body = JSON.stringify({ seconds: unsent, first: !sessionSent, scroll: pendingMarks.splice(0) });
      sessionSent = true;
      unsent = 0;
      let queued = false;
      try { queued = navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" })) ?? false; } catch { /* bỏ qua */ }
      if (!queued) {
        fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
      }
    };
    const onVisibility = () => { if (document.hidden) flush(); else markActive(); };

    measureScroll();
    const activity = ["mousemove", "keydown", "touchstart", "pointerdown", "wheel"] as const;
    activity.forEach((e) => window.addEventListener(e, markActive, { passive: true }));
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      flush(); // chuyển trang trong app (Link) không phát visibilitychange/pagehide
      clearInterval(tick);
      activity.forEach((e) => window.removeEventListener(e, markActive));
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [slug]);
  return null;
}
