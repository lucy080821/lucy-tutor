"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  adminFetch, AdminAuthError, formatClock, formatDuration, formatPct, pctChange, ROLE_LABEL,
  type RangeDays, type Realtime, type Traffic,
} from "@/lib/adminApi";
import { FREE_TOOLS } from "@/lib/freeTools";
import { NO_TRACK_KEY } from "@/components/analytics/AnalyticsTracker";
import { BarList, ErrorBlock, KpiCard, LoadingBlock, RangeChips, SectionCard } from "./ui";

const TrafficChart = dynamic(() => import("./AdminCharts").then((m) => m.TrafficChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const HoursChart = dynamic(() => import("./AdminCharts").then((m) => m.HoursChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const RealtimeChart = dynamic(() => import("./AdminCharts").then((m) => m.RealtimeChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

const RANGES: RangeDays[] = [7, 30, 90];
const RANGE_KEY = "lucy_admin_traffic_days";

// Tên dễ đọc cho đường dẫn hay gặp (còn lại hiện nguyên đường dẫn)
const PAGE_NAMES: Record<string, string> = {
  "/": "Trang chủ", "/auth": "Đăng nhập / Đăng ký", "/blog": "Blog", "/dashboard": "Dashboard học viên", "/teacher": "Dashboard giáo viên",
  ...Object.fromEntries(FREE_TOOLS.map((t) => [t.href, t.title])),
};
const pageName = (path: string) => {
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  if (path.startsWith("/blog/")) return `Blog: ${path.slice(6)}`;
  if (path.startsWith("/flashcard-tieng-anh/")) return `Flashcard ${path.slice(21).replace("lop-", "lớp ")}`;
  return path;
};
const DEVICE_LABEL: Record<string, string> = { mobile: "Điện thoại", tablet: "Máy tính bảng", desktop: "Máy tính" };

function usePolling<T>(path: string, intervalMs: number, onAuthLost: () => void) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const load = () => adminFetch<T>(path)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AdminAuthError) onAuthLost();
        else setError((err as Error).message);
      });
    load();
    // Làm mới định kỳ khi tab đang mở + ngay khi quay lại tab
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, intervalMs);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [path, intervalMs, onAuthLost, tick]);
  return { data, error, retry: () => { setError(""); setTick((t) => t + 1); } };
}

export default function TrafficTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [days, setDays] = useState<RangeDays>(() => {
    try { const v = Number(localStorage.getItem(RANGE_KEY)); return RANGES.includes(v as RangeDays) ? (v as RangeDays) : 30; } catch { return 30; }
  });
  const changeDays = (d: RangeDays) => { setDays(d); try { localStorage.setItem(RANGE_KEY, String(d)); } catch { /* bị chặn */ } };

  const traffic = usePolling<Traffic>(`/analytics/traffic?days=${days}`, 60_000, onAuthLost);
  const realtime = usePolling<Realtime>("/analytics/realtime", 30_000, onAuthLost);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RangeChips value={days} options={RANGES} onChange={changeDays} />
        <NoTrackToggle />
      </div>

      <RealtimeCard data={realtime.data} error={realtime.error} />

      {traffic.error ? <ErrorBlock message={traffic.error} onRetry={traffic.retry} />
        : !traffic.data ? <LoadingBlock />
        : <TrafficBody data={traffic.data} />}
    </div>
  );
}

function RealtimeCard({ data, error }: { data: Realtime | null; error: string }) {
  return (
    <SectionCard title="Đang truy cập" subtitle="Khách có lượt xem trong 5 phút gần nhất · tự làm mới mỗi 30 giây">
      {error ? <p className="text-sm text-red-700">{error}</p> : !data ? <LoadingBlock /> : (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_1fr] gap-6 items-start">
          <div>
            <p className="flex items-center gap-2 text-4xl font-extrabold text-primary">
              <span aria-hidden="true" className={`w-3 h-3 rounded-full ${data.activeVisitors ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`} />
              {data.activeVisitors}
            </p>
            <p className="text-sm text-muted mt-1">khách đang online</p>
            <p className="text-xs text-muted mt-2">{data.activeUsers} đã đăng nhập · {data.mobile} trên điện thoại/máy tính bảng</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Lượt xem 30 phút gần nhất</p>
            <div className="h-24"><RealtimeChart data={data.perMinute} /></div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Đang xem trang</p>
            <BarList items={data.pages.map((p) => ({ name: pageName(p.path), value: p.visitors }))} empty="Không có ai đang online" />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function TrafficBody({ data }: { data: Traffic }) {
  const { current: c, previous: p } = data;
  const prevLabel = `so với ${data.days} ngày trước đó`;
  const totalVisitors = data.visitorsNew + data.visitorsReturning;
  const roleItems = data.roles.map((r) => ({
    name: r.role === "ANON" ? "Khách chưa đăng nhập" : ROLE_LABEL[r.role] || r.role,
    value: r.sessions,
    hint: r.role === "ANON" ? undefined : `${r.users} tài khoản`,
  }));

  if (!c.views && !p.views) {
    return (
      <div className="ui-card p-8 text-center">
        <p className="font-bold text-primary text-lg">Chưa có lượt truy cập nào được ghi nhận</p>
        <p className="text-sm text-muted mt-2 max-w-xl mx-auto">
          Hệ thống bắt đầu đếm từ lúc tính năng này được triển khai lên website thật (chỉ đếm ở bản production, không đếm khi chạy thử trên máy).
          Số liệu sẽ xuất hiện tại đây sau vài phút có người truy cập.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label="Khách truy cập" value={c.visitors.toLocaleString("vi-VN")} delta={pctChange(c.visitors, p.visitors)} hint={prevLabel} />
        <KpiCard label="Phiên truy cập" value={c.sessions.toLocaleString("vi-VN")} delta={pctChange(c.sessions, p.sessions)} />
        <KpiCard label="Lượt xem trang" value={c.views.toLocaleString("vi-VN")} delta={pctChange(c.views, p.views)} />
        <KpiCard label="Trang / phiên" value={c.pagesPerSession.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
          delta={pctChange(c.pagesPerSession, p.pagesPerSession)} />
        <KpiCard label="Thời gian / phiên" value={formatClock(c.avgSessionSec)} delta={pctChange(c.avgSessionSec, p.avgSessionSec)} hint="phút:giây" />
        <KpiCard label="Tỉ lệ thoát" value={formatPct(c.bounceRate)} delta={pctChange(c.bounceRate, p.bounceRate)} invertDelta
          hint="phiên chỉ xem 1 trang" />
      </div>

      <SectionCard title="Khách và lượt xem theo ngày" subtitle={`${data.days} ngày gần nhất (giờ Việt Nam)`}>
        <div className="h-72"><TrafficChart data={data.series} /></div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Nguồn truy cập" subtitle="Theo phiên — kênh đưa khách tới website">
          <BarList items={data.channels.map((x) => ({ name: x.name, value: x.sessions }))} valueLabel="Phiên" />
          {data.referrers.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Website giới thiệu</p>
              <BarList items={data.referrers.map((x) => ({ name: x.name, value: x.sessions }))} />
            </>
          )}
          {data.campaigns.length > 0 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Chiến dịch (utm_source / medium / campaign)</p>
              <BarList items={data.campaigns.map((x) => ({ name: x.name, value: x.sessions }))} />
            </>
          )}
        </SectionCard>

        <SectionCard title="Trang vào đầu tiên" subtitle="Trang khách nhìn thấy đầu tiên trong phiên + tỉ lệ thoát">
          <TableOrEmpty empty={!data.landingPages.length}>
            <table className="ui-table w-full text-sm">
              <thead><tr><th>Trang</th><th className="text-right">Phiên</th><th className="text-right">Thoát</th></tr></thead>
              <tbody>
                {data.landingPages.map((l) => (
                  <tr key={l.path}>
                    <td className="max-w-[220px] truncate" title={l.path}>{pageName(l.path)}</td>
                    <td className="text-right font-bold">{l.sessions.toLocaleString("vi-VN")}</td>
                    <td className={`text-right ${l.bounceRate >= 0.7 ? "text-red-700 font-bold" : ""}`}>{formatPct(l.bounceRate, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableOrEmpty>
        </SectionCard>
      </div>

      <SectionCard title="Trang được xem nhiều nhất" subtitle="Lượt xem, khách và thời gian xem trung bình mỗi lượt">
        <TableOrEmpty empty={!data.topPages.length}>
          <table className="ui-table w-full text-sm">
            <thead><tr><th>Trang</th><th className="text-right">Lượt xem</th><th className="text-right">Khách</th><th className="text-right">Thời gian TB</th></tr></thead>
            <tbody>
              {data.topPages.map((t) => (
                <tr key={t.path}>
                  <td className="max-w-[320px]"><span className="block truncate font-semibold" title={t.path}>{pageName(t.path)}</span>
                    {pageName(t.path) !== t.path && <span className="block truncate text-xs text-muted">{t.path}</span>}</td>
                  <td className="text-right font-bold">{t.views.toLocaleString("vi-VN")}</td>
                  <td className="text-right">{t.visitors.toLocaleString("vi-VN")}</td>
                  <td className="text-right whitespace-nowrap">{formatDuration(t.avgSec)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableOrEmpty>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Thiết bị" subtitle="Theo phiên">
          <BarList items={data.devices.map((x) => ({ name: DEVICE_LABEL[x.name] || x.name, value: x.sessions }))} />
          <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Trình duyệt</p>
          <BarList items={data.browsers.map((x) => ({ name: x.name, value: x.sessions }))} />
        </SectionCard>
        <SectionCard title="Khách mới & quay lại" subtitle="Quay lại = đã từng truy cập trước kỳ này">
          <BarList items={[
            { name: "Khách mới", value: data.visitorsNew },
            { name: "Khách quay lại", value: data.visitorsReturning },
          ]} />
          <p className="text-xs text-muted mt-3">
            {totalVisitors ? `${formatPct(data.visitorsReturning / totalVisitors, 0)} khách quay lại.` : ""} Cùng 1 người dùng 2 trình duyệt/thiết bị được tính là 2 khách.
          </p>
          <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Đăng nhập hay chưa</p>
          <BarList items={roleItems} valueLabel="Phiên" />
        </SectionCard>
        <SectionCard title="Khung giờ truy cập" subtitle="Lượt xem theo giờ trong ngày (giờ VN)">
          <div className="h-56"><HoursChart data={data.hours} /></div>
        </SectionCard>
      </div>

      <p className="text-xs text-muted">
        Số liệu tự ghi, không dùng cookie và không lưu địa chỉ IP. Không đếm bot/công cụ tìm kiếm, khu vực quản trị và thiết bị đã tắt đếm.
        Phiên kết thúc sau 30 phút không hoạt động. Dữ liệu chi tiết giữ 400 ngày.
      </p>
    </>
  );
}

function TableOrEmpty({ empty, children }: { empty: boolean; children: React.ReactNode }) {
  if (empty) return <p className="text-sm text-muted py-4 text-center">Chưa có dữ liệu</p>;
  return <div className="overflow-x-auto">{children}</div>;
}

// Admin tự loại trình duyệt của mình khỏi thống kê (lưu localStorage của chính website, áp dụng cho mọi tab)
function NoTrackToggle() {
  const [off, setOff] = useState(() => { try { return localStorage.getItem(NO_TRACK_KEY) === "1"; } catch { return false; } });
  const toggle = () => {
    const next = !off;
    try { if (next) localStorage.setItem(NO_TRACK_KEY, "1"); else localStorage.removeItem(NO_TRACK_KEY); } catch { /* bị chặn */ }
    setOff(next);
  };
  return (
    <label className="flex items-center gap-2 text-sm text-muted cursor-pointer select-none">
      <input type="checkbox" checked={off} onChange={toggle} className="w-4 h-4 accent-[#1E3A8A]" />
      Không đếm lượt truy cập từ trình duyệt này
    </label>
  );
}
