// Thời tiết THẬT theo vị trí thiết bị cho Nông Trại Qilin (chỉ là hiệu ứng thị giác, không đổi luật chơi).
//
// Quyền riêng tư (quan trọng):
//  - Chỉ xin vị trí khi NGƯỜI CHƠI tự bấm bật (không tự hỏi lúc mở game); lựa chọn nhớ ở localStorage.
//  - Toạ độ làm tròn 1 chữ số thập phân (~11 km, đủ cho dự báo) và chỉ gửi TỪ TRÌNH DUYỆT tới dịch vụ dự báo.
//    KHÔNG gửi toạ độ lên backend Lucy Tutor, không lưu ở DB (chỉ cache trong localStorage của máy người chơi).
//  - Nguồn: Open-Meteo (không cần API key, cho phép gọi từ trình duyệt). ⚠️ Gói miễn phí của Open-Meteo chỉ dành cho
//    MỤC ĐÍCH PHI THƯƠNG MẠI — nếu Lucy Tutor chạy thương mại cần mua gói API của họ hoặc đổi nguồn. Toàn bộ chỗ gọi
//    nguồn nằm trong file này (`fetchWeather`), đổi nhà cung cấp chỉ cần sửa 1 hàm.

export type WeatherKind = "clear" | "cloudy" | "overcast" | "fog" | "drizzle" | "rain" | "storm" | "snow";
export const WEATHER_KINDS: WeatherKind[] = ["clear", "cloudy", "overcast", "fog", "drizzle", "rain", "storm", "snow"];

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: "Nắng đẹp", cloudy: "Có mây", overcast: "Trời âm u", fog: "Sương mù", drizzle: "Mưa phùn", rain: "Có mưa", storm: "Giông bão", snow: "Có tuyết",
};
export const WEATHER_EMOJI: Record<WeatherKind, string> = { clear: "☀️", cloudy: "⛅", overcast: "☁️", fog: "🌫️", drizzle: "🌦️", rain: "🌧️", storm: "⛈️", snow: "❄️" };
export const isWetWeather = (k: WeatherKind) => k === "drizzle" || k === "rain" || k === "storm";
export const weatherLabel = (k: WeatherKind, isDay: boolean | null) => (k === "clear" && isDay === false ? "Trời quang" : WEATHER_LABEL[k]);

// Mã thời tiết WMO (Open-Meteo) → loại hiển thị
export function kindFromCode(c: number): WeatherKind {
  if (c === 0 || c === 1) return "clear";
  if (c === 2) return "cloudy";
  if (c === 3) return "overcast";
  if (c === 45 || c === 48) return "fog";
  if (c >= 51 && c <= 57) return "drizzle";
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 82)) return "rain";
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return "snow";
  if (c >= 95) return "storm";
  return "clear";
}

export type HourForecast = { t: number; kind: WeatherKind; tempC: number; pop: number };
export type WeatherData = {
  lat: number; lon: number; kind: WeatherKind; code: number; tempC: number | null; precipMm: number; isDay: boolean | null;
  sunrise: number | null; sunset: number | null; // mốc UTC (ms) của hôm nay tại vị trí
  utcOffsetSec: number; tz: string;                // múi giờ của VỊ TRÍ (không phải múi giờ cài trên máy)
  hourly: HourForecast[];                          // 6 giờ tới
  updatedAt: number;
};

const API = "https://api.open-meteo.com/v1/forecast";
export const roundCoord = (n: number) => Math.round(n * 10) / 10;

export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherData> {
  const la = roundCoord(lat), lo = roundCoord(lon);
  const q = new URLSearchParams({
    latitude: String(la), longitude: String(lo), timezone: "auto", forecast_days: "2",
    current: "temperature_2m,weather_code,is_day,precipitation",
    hourly: "weather_code,temperature_2m,precipitation_probability",
    daily: "sunrise,sunset",
  });
  const res = await fetch(`${API}?${q}`, { signal });
  if (!res.ok) throw new Error(`Dịch vụ thời tiết trả lỗi ${res.status}`);
  const d = await res.json();
  const off = Number(d.utc_offset_seconds) || 0;
  const toMs = (iso: string) => Date.parse(`${iso}Z`) - off * 1000; // Open-Meteo trả giờ địa phương không kèm múi giờ
  const curMs = toMs(d.current.time);
  const di = Math.max(0, (d.daily?.time as string[] | undefined)?.indexOf(String(d.current.time).slice(0, 10)) ?? 0);
  const hourly: HourForecast[] = [];
  (d.hourly.time as string[]).forEach((iso, i) => {
    const t = toMs(iso);
    if (t >= curMs - 30 * 60e3 && hourly.length < 6) hourly.push({ t, kind: kindFromCode(d.hourly.weather_code[i]), tempC: Math.round(d.hourly.temperature_2m[i]), pop: Math.round(d.hourly.precipitation_probability?.[i] ?? 0) });
  });
  return {
    lat: la, lon: lo, kind: kindFromCode(d.current.weather_code), code: d.current.weather_code, tempC: d.current.temperature_2m != null ? Math.round(d.current.temperature_2m) : null,
    precipMm: d.current.precipitation ?? 0, isDay: d.current.is_day == null ? null : d.current.is_day === 1,
    sunrise: d.daily?.sunrise?.[di] ? toMs(d.daily.sunrise[di]) : null, sunset: d.daily?.sunset?.[di] ? toMs(d.daily.sunset[di]) : null,
    utcOffsetSec: off, tz: d.timezone || "", hourly, updatedAt: Date.now(),
  };
}

// ── Lưu lựa chọn + vị trí (chỉ trong localStorage của máy người chơi) ──────────────
const PREF_KEY = "lucy_farm_weather";
const GEO_KEY = "lucy_farm_geo";
const GEO_TTL = 24 * 3600e3;
const safe = <T,>(fn: () => T, fb: T): T => { try { return fn(); } catch { return fb; } };
export const loadWeatherPref = () => safe(() => localStorage.getItem(PREF_KEY) === "on", false);
export const saveWeatherPref = (on: boolean) => safe(() => { on ? localStorage.setItem(PREF_KEY, "on") : (localStorage.removeItem(PREF_KEY), localStorage.removeItem(GEO_KEY)); }, undefined);
export const loadGeo = (): { lat: number; lon: number } | null => safe(() => {
  const g = JSON.parse(localStorage.getItem(GEO_KEY) || "null");
  return g && Date.now() - g.at < GEO_TTL && Number.isFinite(g.lat) && Number.isFinite(g.lon) ? { lat: g.lat, lon: g.lon } : null;
}, null);
export const saveGeo = (lat: number, lon: number) => safe(() => localStorage.setItem(GEO_KEY, JSON.stringify({ lat: roundCoord(lat), lon: roundCoord(lon), at: Date.now() })), undefined);

export class GeoError extends Error { code: "denied" | "unsupported" | "unavailable" | "timeout"; constructor(code: GeoError["code"], msg: string) { super(msg); this.code = code; } }
export function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) { reject(new GeoError("unsupported", "Thiết bị không hỗ trợ định vị")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      (e) => reject(new GeoError(e.code === 1 ? "denied" : e.code === 3 ? "timeout" : "unavailable", e.message)),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 3600e3 },
    );
  });
}
