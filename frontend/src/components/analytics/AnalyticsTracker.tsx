"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

// Ghi lượt xem trang cho tab "Lượt truy cập" ở /administrator (backend: routes/track.routes.js). Tự viết thay cho
// Google Analytics: không cookie, không lưu IP — chỉ mã khách ngẫu nhiên (localStorage) + mã phiên.
// - Phiên = chuỗi lượt xem cách nhau ≤ 30 phút (dùng chung giữa các tab), giống cách tính của GA.
// - Referrer + UTM chỉ gửi ở trang vào đầu tiên của phiên (điều hướng nội bộ không đổi document.referrer).
// - Thời gian xem = số giây tab đang hiện, gửi lại mỗi khi ẩn tab/rời trang (server lấy giá trị mới nhất).
// Chỉ chạy ở production (dev dùng chung DB với production, không được làm bẩn số liệu); không đếm khu vực
// /administrator, trình duyệt đang đăng nhập admin, hoặc thiết bị đã bấm "Không đếm thiết bị này" (lucy_no_track).

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const SESSION_IDLE_MS = 30 * 60 * 1000;
const VISITOR_KEY = "lucy_vid";
const SESSION_KEY = "lucy_sess";
export const NO_TRACK_KEY = "lucy_no_track";

const randomId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

function storageGet(key: string, storage: "local" | "session" = "local") {
  try { return (storage === "local" ? localStorage : sessionStorage).getItem(key); } catch { return null; }
}
function storageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* bị chặn — vẫn đếm, chỉ không nhận ra khách quay lại */ }
}

function visitorId() {
  let id = storageGet(VISITOR_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) { id = randomId(); storageSet(VISITOR_KEY, id); }
  return id;
}

/** Trả về mã phiên + có phải phiên mới không; gia hạn mốc hoạt động cuối. */
function touchSession(): { id: string; isNew: boolean } {
  const now = Date.now();
  let s: { id: string; last: number } | null = null;
  try { s = JSON.parse(storageGet(SESSION_KEY) || "null"); } catch { s = null; }
  const isNew = !s || typeof s.id !== "string" || now - Number(s.last) > SESSION_IDLE_MS;
  const id = isNew ? randomId() : s!.id;
  storageSet(SESSION_KEY, JSON.stringify({ id, last: now }));
  return { id, isNew };
}

function send(path: string, payload: object) {
  const body = JSON.stringify(payload);
  const url = `${API_URL}/api/track${path}`;
  try {
    // text/plain → không bị CORS preflight; sendBeacon vẫn gửi được khi đang đóng tab
    if (navigator.sendBeacon?.(url, new Blob([body], { type: "text/plain" }))) return;
  } catch { /* rơi xuống fetch */ }
  fetch(url, { method: "POST", body, keepalive: true, headers: { "Content-Type": "text/plain" } }).catch(() => {});
}

function trackingDisabled(pathname: string) {
  if (process.env.NODE_ENV !== "production") return true;
  if (pathname.startsWith("/administrator")) return true;
  if (storageGet(NO_TRACK_KEY) === "1") return true;
  if (storageGet("lucy_admin_token", "session")) return true;
  return false;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  // Lượt xem hiện tại: id + số ms đã hiện + mốc bắt đầu đoạn đang hiện (null khi tab ẩn)
  const view = useRef<{ id: string; visibleMs: number; since: number | null } | null>(null);

  const reportDuration = () => {
    const v = view.current;
    if (!v) return;
    const ms = v.visibleMs + (v.since ? Date.now() - v.since : 0);
    send("/leave", { id: v.id, seconds: Math.round(ms / 1000) });
  };

  // Mỗi lần đổi trang: chốt thời gian trang trước, ghi lượt xem trang mới
  useEffect(() => {
    if (!pathname || trackingDisabled(pathname)) { view.current = null; return; }
    reportDuration();
    const session = touchSession();
    const id = randomId();
    view.current = { id, visibleMs: 0, since: document.visibilityState === "visible" ? Date.now() : null };
    const params = new URLSearchParams(window.location.search);
    send("", {
      id,
      path: pathname,
      visitorId: visitorId(),
      sessionId: session.id,
      isEntry: session.isNew,
      userId: getSessionUserId() || undefined,
      ...(session.isNew ? {
        referrer: document.referrer || undefined,
        utm: { source: params.get("utm_source"), medium: params.get("utm_medium"), campaign: params.get("utm_campaign") },
      } : {}),
    });
  }, [pathname]);

  // Ẩn tab / đóng tab: gửi thời gian đã xem; hiện lại: đếm tiếp (và giữ phiên còn sống)
  useEffect(() => {
    const onVisibility = () => {
      const v = view.current;
      if (!v) return;
      if (document.visibilityState === "hidden") {
        if (v.since) { v.visibleMs += Date.now() - v.since; v.since = null; }
        reportDuration();
      } else if (!v.since) {
        v.since = Date.now();
        touchSession();
      }
    };
    const onPageHide = () => reportDuration();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

  return null;
}
