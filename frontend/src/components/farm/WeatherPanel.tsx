"use client";
import Modal from "./Modal";
import { IconPin, IconRefresh } from "./FarmIcons";
import { fmtHM, gmtLabel, type SkyInfo } from "./Ambient";
import { WEATHER_EMOJI, weatherLabel, type WeatherData, type WeatherKind } from "@/lib/farm/weather";
import type { WeatherStatus } from "@/lib/farm/useWeather";

// Thời tiết thật theo vị trí thiết bị. Mặc định TẮT: chỉ xin vị trí khi người chơi tự bấm bật, và nói rõ dữ liệu đi đâu.
export default function WeatherPanel({ status, data, error, sky, previewKind, onEnable, onDisable, onRefresh, onClose }: {
  status: WeatherStatus; data: WeatherData | null; error: string | null; sky: SkyInfo; previewKind: WeatherKind | null;
  onEnable: () => void; onDisable: () => void; onRefresh: () => void; onClose: () => void;
}) {
  const on = status === "ok" && !!data;
  const off = data ? data.utcOffsetSec / 60 : sky.offsetMin;
  return (
    <Modal title="Thời tiết & giờ theo vị trí" subtitle={`Đồng hồ trong game: ${sky.label} · ${gmtLabel(sky.offsetMin)}`} onClose={onClose}>
      {previewKind && <p className="rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold px-3 py-2 mb-3">Đang xem thử thời tiết "{weatherLabel(previewKind, null)}" (từ đường dẫn). Bỏ <code>?weather=</code> để dùng thời tiết thật.</p>}

      {on && data ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary-soft px-4 py-4 flex items-center gap-4">
            <div className="text-5xl leading-none">{WEATHER_EMOJI[data.kind]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-3xl font-black text-primary leading-none">{data.tempC != null ? `${data.tempC}°C` : "—"}</p>
              <p className="font-bold text-foreground mt-1">{weatherLabel(data.kind, data.isDay)}</p>
              <p className="text-xs text-muted mt-0.5 inline-flex items-center gap-1"><IconPin size={12} />Vị trí của bạn (làm tròn ~11 km) · {data.tz || gmtLabel(off)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl border border-line px-3 py-2"><p className="text-xs text-muted font-bold">Mặt trời mọc</p><p className="font-extrabold text-foreground">{data.sunrise != null ? fmtHM(data.sunrise, off) : "—"}</p></div>
            <div className="rounded-xl border border-line px-3 py-2"><p className="text-xs text-muted font-bold">Mặt trời lặn</p><p className="font-extrabold text-foreground">{data.sunset != null ? fmtHM(data.sunset, off) : "—"}</p></div>
          </div>

          {data.hourly.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted uppercase mb-2">Dự báo 6 giờ tới</p>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {data.hourly.map((h) => (
                  <div key={h.t} className="rounded-xl border border-line px-2 py-2 text-center">
                    <p className="text-xs font-bold text-muted">{fmtHM(h.t, off)}</p>
                    <p className="text-2xl leading-none my-1">{WEATHER_EMOJI[h.kind]}</p>
                    <p className="font-extrabold text-sm text-foreground">{h.tempC}°</p>
                    <p className="text-[11px] text-sky-700 font-bold">{h.pop}% mưa</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted">Cảnh nông trại đổi theo thời tiết này (nắng, mây, mưa, giông, sương mù, tuyết). Chỉ là hiệu ứng, không ảnh hưởng điểm số hay thời gian cây lớn. Cập nhật mỗi 20 phút.</p>
          <div className="flex flex-wrap gap-2 justify-between">
            <button onClick={onRefresh} className="btn-outline rounded-full px-4 py-2.5 font-bold inline-flex items-center gap-2"><IconRefresh size={16} />Cập nhật ngay</button>
            {!previewKind && <button onClick={onDisable} className="btn-ghost rounded-full px-4 py-2.5 font-bold text-red-600">Tắt và xoá vị trí đã nhớ</button>}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-primary-soft px-4 py-4">
            <p className="font-extrabold text-primary">Cho nông trại có thời tiết thật nơi bạn ở</p>
            <ul className="text-sm text-foreground mt-2 space-y-1.5 list-disc pl-5">
              <li>Nắng, mây, mưa, giông, sương mù, tuyết giống bên ngoài cửa sổ của bạn.</li>
              <li>Bình minh và hoàng hôn đúng giờ mặt trời mọc, lặn ở chỗ bạn; giờ theo múi giờ của vị trí.</li>
              <li>Chỉ là hiệu ứng cho vui, không ảnh hưởng điểm số hay thời gian cây lớn.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-line px-4 py-3 text-sm text-muted space-y-1">
            <p className="font-extrabold text-foreground">Về vị trí của bạn</p>
            <p>Trình duyệt sẽ hỏi quyền dùng vị trí. Toạ độ được làm tròn (~11 km) và chỉ gửi từ máy bạn tới dịch vụ dự báo Open-Meteo. <b>Lucy Tutor không nhận và không lưu vị trí của bạn.</b> Bạn tắt được bất cứ lúc nào.</p>
          </div>
          {status === "denied" && <p className="rounded-xl bg-red-50 text-red-700 text-sm font-semibold px-3 py-2">Trình duyệt đang chặn quyền vị trí. Hãy cho phép vị trí cho trang này trong cài đặt trình duyệt rồi bấm thử lại.</p>}
          {status === "unsupported" && <p className="rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold px-3 py-2">Thiết bị hoặc trình duyệt này không hỗ trợ định vị.</p>}
          {status === "error" && <p className="rounded-xl bg-amber-50 text-amber-900 text-sm font-semibold px-3 py-2">{error || "Không lấy được thời tiết, thử lại sau nhé."}</p>}
          <button onClick={onEnable} disabled={status === "loading" || status === "unsupported"} className="btn-primary rounded-full px-6 py-3 font-bold w-full disabled:opacity-60 inline-flex items-center justify-center gap-2">
            <IconPin size={18} />{status === "loading" ? "Đang lấy vị trí và dự báo..." : status === "denied" || status === "error" ? "Thử lại" : "Bật thời tiết theo vị trí"}
          </button>
          <p className="text-xs text-muted text-center">Chưa bật: trời luôn quang, giờ theo múi giờ cài trên thiết bị ({gmtLabel(sky.offsetMin)}).</p>
        </div>
      )}
    </Modal>
  );
}
