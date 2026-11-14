"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GeoError, fetchWeather, getPosition, loadGeo, loadWeatherPref, saveGeo, saveWeatherPref, type WeatherData, type WeatherKind } from "./weather";

export type WeatherStatus = "off" | "loading" | "ok" | "denied" | "unsupported" | "error";
const REFRESH_MS = 20 * 60e3;

// `preview` (từ ?weather=rain trên URL) cho phép xem thử mọi loại thời tiết mà không cần vị trí.
export function useFarmWeather(preview: WeatherKind | null) {
  const [status, setStatus] = useState<WeatherStatus>("off");
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const dataRef = useRef<WeatherData | null>(null);
  dataRef.current = data;

  // `ask` = người chơi vừa bấm bật (được phép hiện hộp xin quyền); lần tự chạy khi mở lại game thì dùng vị trí đã nhớ,
  // và chỉ gọi định vị lại khi vị trí cũ hết hạn (>24 giờ).
  const load = useCallback(async (ask: boolean, silent = false) => {
    if (busy.current) return;
    busy.current = true;
    if (!silent) { setStatus("loading"); setError(null); }
    try {
      let pos = loadGeo();
      if (!pos || ask) { pos = await getPosition(); saveGeo(pos.lat, pos.lon); }
      const w = await fetchWeather(pos.lat, pos.lon);
      setData(w); setStatus("ok"); saveWeatherPref(true);
    } catch (e: any) {
      if (e instanceof GeoError && e.code === "denied") { setStatus("denied"); saveWeatherPref(false); setData(null); }
      else if (e instanceof GeoError && e.code === "unsupported") { setStatus("unsupported"); setData(null); }
      else if (silent && dataRef.current) { /* lần làm mới ngầm lỗi: giữ dữ liệu cũ */ }
      else { setStatus("error"); setError(e?.message || "Không lấy được thời tiết"); }
    } finally { busy.current = false; }
  }, []);

  const enable = useCallback(() => load(true), [load]);
  const disable = useCallback(() => { saveWeatherPref(false); setData(null); setStatus("off"); setError(null); }, []);
  const refresh = useCallback(() => load(false), [load]);

  // Lần mở game: đã từng bật thì tự lấy lại (không hỏi quyền nếu trình duyệt đã nhớ). Chế độ xem thử thì bỏ qua.
  useEffect(() => { if (!preview && loadWeatherPref()) load(false); }, [preview, load]);
  // Làm mới định kỳ + khi quay lại tab
  useEffect(() => {
    if (preview || status !== "ok") return;
    const t = setInterval(() => load(false, true), REFRESH_MS);
    const onVis = () => { if (document.visibilityState === "visible" && dataRef.current && Date.now() - dataRef.current.updatedAt > REFRESH_MS / 2) load(false, true); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [preview, status, load]);

  return { status: preview ? ("ok" as WeatherStatus) : status, data, error, enable, disable, refresh };
}
