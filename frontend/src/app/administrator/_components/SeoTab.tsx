"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import {
  adminFetch, AdminAuthError, formatPct, formatPosition, pctChange,
  type SeoMetrics, type SeoRange, type SeoReport, type SeoReportMeta, type SeoRow, type SeoSummary,
} from "@/lib/adminApi";
import { BarList, ErrorBlock, KpiCard, LoadingBlock, SectionCard } from "./ui";
import MiniMarkdown from "./MiniMarkdown";

// Tab "SEO Performance": số liệu Google Search Console (đồng bộ mỗi ngày 06:00 giờ VN — backend/src/utils/searchConsole.js)
// + bài phân tích tuần do routine Claude viết mỗi sáng thứ Hai (backend/src/routes/seoReport.routes.js).

const SeoMetricChart = dynamic(() => import("./AdminCharts").then((m) => m.SeoMetricChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const SeoSparkline = dynamic(() => import("./AdminCharts").then((m) => m.SeoSparkline), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const SeoPositionChart = dynamic(() => import("./AdminCharts").then((m) => m.SeoPositionChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

const RANGES: SeoRange[] = [7, 28, 90];
const RANGE_KEY = "lucy_admin_seo_days";
const SITE_PREFIX = /^https?:\/\/(www\.)?lucytutor\.online/;
const shortUrl = (url: string) => url.replace(SITE_PREFIX, "") || "/";
const vnDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const nf = (n: number) => n.toLocaleString("vi-VN");

// Search Console trả mã nước ISO 3 chữ cái viết thường
const COUNTRY: Record<string, string> = {
  vnm: "Việt Nam", usa: "Hoa Kỳ", bra: "Brazil", arg: "Argentina", bgd: "Bangladesh", idn: "Indonesia", ven: "Venezuela",
  col: "Colombia", mys: "Malaysia", che: "Thuỵ Sĩ", irl: "Ireland", ind: "Ấn Độ", phl: "Philippines", tha: "Thái Lan",
  sgp: "Singapore", jpn: "Nhật Bản", kor: "Hàn Quốc", chn: "Trung Quốc", twn: "Đài Loan", aus: "Úc", gbr: "Anh",
  can: "Canada", deu: "Đức", fra: "Pháp", khm: "Campuchia", lao: "Lào", pak: "Pakistan", mex: "Mexico",
};
const DEVICE: Record<string, string> = { MOBILE: "Điện thoại", DESKTOP: "Máy tính", TABLET: "Máy tính bảng" };

type Metric = "impressions" | "clicks" | "ctr" | "position";
const METRICS: { id: Metric; label: string; format: (v: number) => string }[] = [
  { id: "impressions", label: "Lượt hiển thị", format: nf },
  { id: "clicks", label: "Click", format: nf },
  { id: "ctr", label: "CTR", format: (v) => formatPct(v) },
  { id: "position", label: "Vị trí TB", format: (v) => formatPosition(v) },
];

export default function SeoTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [days, setDays] = useState<SeoRange>(() => {
    try { const v = Number(localStorage.getItem(RANGE_KEY)); return RANGES.includes(v as SeoRange) ? (v as SeoRange) : 28; } catch { return 28; }
  });
  const [data, setData] = useState<SeoSummary | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else setError((err as Error).message);
  }, [onAuthLost]);

  useEffect(() => {
    let cancelled = false;
    adminFetch<SeoSummary>(`/seo/summary?days=${days}`)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) fail(err); });
    return () => { cancelled = true; };
  }, [days, tick, fail]);

  const changeDays = (d: SeoRange) => {
    setDays(d);
    try { localStorage.setItem(RANGE_KEY, String(d)); } catch { /* bị chặn */ }
  };

  const syncNow = async () => {
    setSyncing(true);
    try {
      await adminFetch("/seo/sync", { method: "POST" });
      setTick((t) => t + 1);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không đồng bộ được", (err as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((o) => (
            <button key={o} onClick={() => changeDays(o)} aria-pressed={o === days}
              className={`ui-chip cursor-pointer ${o === days ? "ui-chip-active" : ""}`}>{o} ngày</button>
          ))}
        </div>
        {data?.configured && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>
              {data.period && <>Dữ liệu tới {vnDate(data.period.end)} (Google trễ 2–3 ngày) · </>}
              {data.sync.at ? `Đồng bộ lúc ${new Date(data.sync.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}` : "Chưa đồng bộ từ khi khởi động server"}
            </span>
            <button onClick={syncNow} disabled={syncing} className="btn-outline px-4 py-2 text-sm cursor-pointer">
              {syncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}
            </button>
          </div>
        )}
      </div>

      {data?.sync.error && <ErrorBlock message={`Lần đồng bộ gần nhất lỗi: ${data.sync.error}`} />}

      <ReportsCard onAuthLost={onAuthLost} />

      {error ? <ErrorBlock message={error} onRetry={() => { setError(""); setTick((t) => t + 1); }} />
        : !data ? <LoadingBlock />
        : !data.configured && !data.hasData ? <SetupCard />
        : !data.hasData ? <SectionCard title="Chưa có số liệu"><p className="text-sm text-muted">Bấm &ldquo;Đồng bộ ngay&rdquo; để lấy số liệu từ Search Console.</p></SectionCard>
        : <SeoBody data={data} />}
    </div>
  );
}

function SetupCard() {
  return (
    <SectionCard title="Chưa kết nối Google Search Console" subtitle="Cần cấu hình 1 lần trên server backend">
      <ol className="list-decimal pl-6 space-y-1.5 text-sm text-foreground/90">
        <li>Tạo service account trên Google Cloud, bật &ldquo;Google Search Console API&rdquo;, tải khoá JSON.</li>
        <li>Search Console → Cài đặt → Người dùng và quyền → thêm email service account với quyền &ldquo;Hạn chế&rdquo;.</li>
        <li>Đặt biến môi trường backend <code>GSC_SERVICE_ACCOUNT_JSON</code> (nội dung khoá trên 1 dòng) và <code>GSC_SITE_URL=https://lucytutor.online/</code>, rồi khởi động lại server.</li>
      </ol>
    </SectionCard>
  );
}

// ===== Bài phân tích tuần =====

function ReportsCard({ onAuthLost }: { onAuthLost: () => void }) {
  const [list, setList] = useState<SeoReportMeta[] | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [report, setReport] = useState<SeoReport | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    adminFetch<{ reports: SeoReportMeta[] }>("/seo/reports")
      .then((r) => { setList(r.reports); setSelected((s) => (s && r.reports.some((x) => x.id === s) ? s : r.reports[0]?.id || "")); })
      .catch((err) => { if (err instanceof AdminAuthError) onAuthLost(); else setError((err as Error).message); });
  }, [onAuthLost, tick]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    adminFetch<{ report: SeoReport }>(`/seo/reports/${selected}`)
      .then((r) => { if (!cancelled) setReport(r.report); })
      .catch((err) => { if (err instanceof AdminAuthError) onAuthLost(); else if (!cancelled) setError((err as Error).message); });
    return () => { cancelled = true; };
  }, [selected, onAuthLost]);

  const remove = async () => {
    if (!report) return;
    const ok = await Swal.fire({ title: "Xoá bài phân tích này?", icon: "warning", showCancelButton: true, confirmButtonText: "Xoá", cancelButtonText: "Huỷ", confirmButtonColor: "#dc2626" });
    if (!ok.isConfirmed) return;
    try {
      await adminFetch(`/seo/reports/${report.id}`, { method: "DELETE" });
      setSelected("");
      setTick((t) => t + 1);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost(); else Swal.fire("Không xoá được", (err as Error).message, "error");
    }
  };

  const label = (r: SeoReportMeta) => `${vnDate(r.periodStart.slice(0, 10))} – ${vnDate(r.periodEnd.slice(0, 10))}`;

  return (
    <SectionCard title="Bài phân tích hằng tuần"
      subtitle="Claude tự viết mỗi sáng thứ Hai từ số liệu Search Console: làm tốt, chưa tốt và đề xuất chỉnh sửa"
      actions={list && list.length > 0 ? (
        <>
          <label className="sr-only" htmlFor="seo-report-pick">Chọn tuần</label>
          <select id="seo-report-pick" value={selected} onChange={(e) => setSelected(e.target.value)} className="ui-input !w-auto !py-2 text-sm">
            {list.map((r) => <option key={r.id} value={r.id}>Tuần {label(r)}</option>)}
          </select>
          <button onClick={remove} className="btn-ghost px-3 py-2 text-sm text-red-600 cursor-pointer">Xoá</button>
        </>
      ) : undefined}>
      {error ? <ErrorBlock message={error} />
        : !list ? <LoadingBlock />
        : !list.length ? <p className="text-sm text-muted">Chưa có bài phân tích nào. Bài đầu tiên sẽ xuất hiện sau lần chạy sáng thứ Hai kế tiếp.</p>
        : !report || report.id !== selected ? <LoadingBlock />
        : (
          <article>
            <p className="text-xs text-muted mb-3">
              Kỳ {label(report)} · {report.author} viết lúc {new Date(report.createdAt).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            <ReportVisuals key={report.id} periodEnd={report.periodEnd.slice(0, 10)} onAuthLost={onAuthLost} />
            <CollapsibleText key={`t-${report.id}`}><MiniMarkdown source={report.content} /></CollapsibleText>
          </article>
        )}
    </SectionCard>
  );
}

// Phần chữ của bài: mặc định chỉ hiện đoạn đầu, bấm "Đọc toàn bài" để mở
function CollapsibleText({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Nhận xét & đề xuất</p>
      <div className={`relative ${open ? "" : "max-h-72 overflow-hidden"}`}>
        {children}
        {!open && <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white to-transparent" />}
      </div>
      <button onClick={() => setOpen((o) => !o)} className="btn-outline mt-3 px-4 py-2 text-sm cursor-pointer">
        {open ? "Thu gọn" : "Đọc toàn bài"}
      </button>
    </div>
  );
}

// Đủ mọi ngày trong kỳ (ngày không có lượt hiển thị: click/hiển thị = 0, CTR/vị trí bỏ trống)
function fillDays(series: (SeoMetrics & { date: string })[], start: string, end: string) {
  const byDate = new Map(series.map((r) => [r.date, r]));
  const out: (SeoMetrics & { date: string })[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    out.push(byDate.get(date) ?? { date, clicks: 0, impressions: 0, ctr: 0, position: null });
  }
  return out;
}

// Lượt hiển thị theo nhóm vị trí — tính từ các truy vấn có tên (Google ẩn truy vấn quá hiếm nên tổng nhỏ hơn KPI)
const POSITION_BUCKETS: { name: string; max: number }[] = [
  { name: "Top 3", max: 3.5 }, { name: "4–10", max: 10.5 }, { name: "11–20", max: 20.5 }, { name: "21–50", max: 50.5 }, { name: "> 50", max: Infinity },
];
function positionBuckets(rows: SeoRow[]) {
  const out = POSITION_BUCKETS.map((b) => ({ name: b.name, impressions: 0, clicks: 0 }));
  for (const r of rows) {
    if (!r.position || !r.impressions) continue;
    const i = POSITION_BUCKETS.findIndex((b) => r.position! <= b.max);
    out[i].impressions += r.impressions;
    out[i].clicks += r.clicks;
  }
  return out;
}

// "Bức tranh tuần" ở đầu mỗi bài phân tích: số liệu đúng kỳ của bài (7 ngày kết thúc ở periodEnd)
function ReportVisuals({ periodEnd, onAuthLost }: { periodEnd: string; onAuthLost: () => void }) {
  const [data, setData] = useState<SeoSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    adminFetch<SeoSummary>(`/seo/summary?days=7&end=${periodEnd}`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (cancelled) return; if (err instanceof AdminAuthError) onAuthLost(); else setError((err as Error).message); });
    return () => { cancelled = true; };
  }, [periodEnd, onAuthLost]);

  if (error) return <ErrorBlock message={error} />;
  if (!data) return <div className="skeleton w-full h-48 rounded-xl" />;
  if (!data.hasData || !data.totals) return null;

  const c = data.totals.current;
  const p = data.totals.previous;
  const hasPrev = p.impressions > 0;
  const days = fillDays(data.series!, data.period!.start, data.period!.end);
  const tiles: { id: Metric; label: string; value: string; delta: number | null; invert?: boolean; format: (v: number) => string }[] = [
    { id: "clicks", label: "Click", value: nf(c.clicks), delta: hasPrev ? pctChange(c.clicks, p.clicks) : null, format: nf },
    { id: "impressions", label: "Lượt hiển thị", value: nf(c.impressions), delta: hasPrev ? pctChange(c.impressions, p.impressions) : null, format: nf },
    { id: "ctr", label: "CTR", value: formatPct(c.ctr), delta: hasPrev ? pctChange(c.ctr, p.ctr) : null, format: (v) => formatPct(v) },
    { id: "position", label: "Vị trí TB", value: formatPosition(c.position), invert: true,
      delta: hasPrev && c.position && p.position ? pctChange(c.position, p.position) : null, format: (v) => formatPosition(v) },
  ];
  const buckets = positionBuckets(data.queries!);
  const topQueries = data.queries!.slice(0, 6);
  const topPages = data.pages!.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => {
          const good = t.delta !== null && (t.invert ? t.delta < 0 : t.delta > 0);
          return (
            <div key={t.id} className="rounded-xl border border-line p-3 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">{t.label}</p>
                {t.delta !== null && Number.isFinite(t.delta) && Math.abs(t.delta) >= 0.5 && (
                  <span className={`text-[11px] font-bold rounded-full px-1.5 py-0.5 ${good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                    {t.delta > 0 ? "▲" : "▼"} {Math.abs(t.delta).toLocaleString("vi-VN", { maximumFractionDigits: 0 })}%
                  </span>
                )}
              </div>
              <p className="mt-1 text-xl font-extrabold text-foreground">{t.value}</p>
              <div className="h-10 mt-1">
                <SeoSparkline id={t.id} label={t.label} format={t.format} reversed={t.id === "position"}
                  data={days.map((d) => ({ date: d.date, value: t.id === "position" ? d.position : t.id === "ctr" ? (d.impressions ? d.ctr : null) : d[t.id] }))} />
              </div>
            </div>
          );
        })}
      </div>
      {!hasPrev && <p className="text-xs text-muted">Kỳ trước chưa có dữ liệu nên chưa có % thay đổi.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-line p-4 min-w-0">
          <p className="text-sm font-bold text-foreground">Truy vấn đang ở vị trí nào</p>
          <p className="text-xs text-muted mb-2">Lượt hiển thị theo nhóm vị trí — màu càng đậm là thứ hạng càng tốt</p>
          <div className="h-44"><SeoPositionChart data={buckets} /></div>
        </div>
        <div className="rounded-xl border border-line p-4 min-w-0">
          <p className="text-sm font-bold text-foreground mb-2">Top truy vấn</p>
          <BarList valueLabel="Lượt hiển thị" items={topQueries.map((q) => ({ name: q.key, value: q.impressions }))} />
        </div>
        <div className="rounded-xl border border-line p-4 min-w-0">
          <p className="text-sm font-bold text-foreground mb-2">Top trang</p>
          <BarList valueLabel="Lượt hiển thị" items={topPages.map((pg) => ({ name: shortUrl(pg.key), value: pg.impressions }))} />
        </div>
      </div>
    </div>
  );
}

// ===== Số liệu =====

const valueOf = (m: SeoMetrics, metric: Metric) => (metric === "position" ? m.position : m[metric]);

function SeoBody({ data }: { data: SeoSummary }) {
  const [metric, setMetric] = useState<Metric>("impressions");
  const c = data.totals!.current;
  const p = data.totals!.previous;
  const hasPrev = p.impressions > 0;
  const prevLabel = hasPrev ? `kỳ trước: ` : "kỳ trước chưa có dữ liệu";
  const m = METRICS.find((x) => x.id === metric)!;
  const hidden = c.impressions - (data.namedQueryImpressions || 0);

  return (
    <>
      <p className="text-sm text-muted">
        Kỳ này {vnDate(data.period!.start)} – {vnDate(data.period!.end)}, so với {vnDate(data.previousPeriod!.start)} – {vnDate(data.previousPeriod!.end)}.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Click" value={nf(c.clicks)} delta={hasPrev ? pctChange(c.clicks, p.clicks) : null} hint={hasPrev ? `${prevLabel}${nf(p.clicks)}` : prevLabel} />
        <KpiCard label="Lượt hiển thị" value={nf(c.impressions)} delta={hasPrev ? pctChange(c.impressions, p.impressions) : null} hint={hasPrev ? `${prevLabel}${nf(p.impressions)}` : prevLabel} />
        <KpiCard label="CTR" value={formatPct(c.ctr)} delta={hasPrev ? pctChange(c.ctr, p.ctr) : null} hint={hasPrev ? `${prevLabel}${formatPct(p.ctr)}` : prevLabel} />
        <KpiCard label="Vị trí TB" value={formatPosition(c.position)} invertDelta
          delta={hasPrev && c.position && p.position ? pctChange(c.position, p.position) : null}
          hint={hasPrev ? `${prevLabel}${formatPosition(p.position)} · càng nhỏ càng tốt` : "càng nhỏ càng tốt"} />
      </div>

      <SectionCard title="Theo ngày" actions={
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chỉ số">
          {METRICS.map((x) => (
            <button key={x.id} onClick={() => setMetric(x.id)} aria-pressed={x.id === metric}
              className={`ui-chip cursor-pointer text-sm ${x.id === metric ? "ui-chip-active" : ""}`}>{x.label}</button>
          ))}
        </div>
      }>
        <div className="h-64">
          <SeoMetricChart metric={metric} label={m.label} format={m.format}
            data={data.series!.map((r) => ({ date: r.date, value: valueOf(r, metric) }))} />
        </div>
      </SectionCard>

      <SectionCard title="Cơ hội lên top" subtitle="Truy vấn đang ở vị trí 4–20 (trang 1–2) có người thấy — cải thiện nội dung/tiêu đề để vào top 3 là có click">
        <SeoTable rows={data.opportunities!} keyLabel="Truy vấn" empty="Chưa có truy vấn nào ở vị trí 4–20 với đủ lượt hiển thị" />
      </SectionCard>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SectionCard title="Truy vấn" subtitle={hidden > 0 ? `${nf(hidden)} lượt hiển thị (${formatPct(hidden / Math.max(c.impressions, 1), 0)}) đến từ truy vấn bị Google ẩn vì quá hiếm` : undefined}>
          <SeoTable rows={data.queries!} keyLabel="Truy vấn" showChange={hasPrev} />
        </SectionCard>
        <SectionCard title="Trang">
          <SeoTable rows={data.pages!} keyLabel="Trang" showChange={hasPrev} formatKey={shortUrl} />
        </SectionCard>
      </div>

      {hasPrev && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <SectionCard title="Vị trí thay đổi nhiều nhất" subtitle="Truy vấn có đủ lượt hiển thị ở cả 2 kỳ">
            <SeoTable rows={data.movers!} keyLabel="Truy vấn" showChange empty="Chưa có truy vấn nào đủ dữ liệu ở cả 2 kỳ" />
          </SectionCard>
          <SectionCard title="Truy vấn mới / biến mất" subtitle="So với kỳ trước">
            <p className="text-xs font-bold uppercase tracking-wide text-muted mb-2">Mới xuất hiện</p>
            <SeoTable rows={data.newQueries!} keyLabel="Truy vấn" empty="Không có" pageSize={5} />
            <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Không còn hiển thị</p>
            {data.lostQueries!.length ? (
              <ul className="text-sm space-y-1">
                {data.lostQueries!.slice(0, 10).map((q) => (
                  <li key={q.key} className="flex justify-between gap-3"><span className="truncate">{q.key}</span><span className="text-muted shrink-0">trước: {nf(q.prev.impressions)} lượt · vị trí {formatPosition(q.prev.position)}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">Không có</p>}
          </SectionCard>
        </div>
      )}

      <SectionCard title="Truy vấn → trang" subtitle="Truy vấn nào đang đưa người tìm kiếm tới trang nào">
        <SeoTable keyLabel="Truy vấn · Trang" formatKey={(k) => { const [q, pg] = k.split("\t"); return `${q}  →  ${shortUrl(pg || "")}`; }}
          rows={data.queryPages!} />
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Quốc gia">
          <BarList valueLabel="Lượt hiển thị" items={data.countries!.slice(0, 10).map((r) => ({ name: COUNTRY[r.key] || r.key.toUpperCase(), value: r.impressions, hint: `${nf(r.clicks)} click · vị trí ${formatPosition(r.position)}` }))} />
        </SectionCard>
        <SectionCard title="Thiết bị">
          <BarList valueLabel="Lượt hiển thị" items={data.devices!.map((r) => ({ name: DEVICE[r.key] || r.key, value: r.impressions, hint: `${nf(r.clicks)} click · vị trí ${formatPosition(r.position)}` }))} />
        </SectionCard>
        <SectionCard title="Giao diện tìm kiếm" subtitle="Kết quả nổi bật (rich result) — Google chỉ cho lấy 10 ngày gần nhất">
          <BarList valueLabel="Lượt hiển thị" empty="Chưa có kết quả nổi bật nào"
            items={data.appearances!.map((r) => ({ name: r.key, value: r.impressions, hint: `${nf(r.clicks)} click` }))} />
        </SectionCard>
      </div>
    </>
  );
}

function PositionChange({ row }: { row: SeoRow }) {
  if (!row.position || !row.prev.position) return <span className="text-muted">{row.prev.impressions ? "—" : "mới"}</span>;
  const diff = row.prev.position - row.position; // dương = tốt lên (số vị trí nhỏ đi)
  if (Math.abs(diff) < 0.5) return <span className="text-muted">0</span>;
  return (
    <span className={`font-bold ${diff > 0 ? "text-emerald-700" : "text-red-700"}`}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}
    </span>
  );
}

function SeoTable({ rows, keyLabel, showChange = false, formatKey = (k: string) => k, empty = "Chưa có dữ liệu", pageSize = 10 }: {
  rows: SeoRow[]; keyLabel: string; showChange?: boolean; formatKey?: (k: string) => string; empty?: string; pageSize?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!rows.length) return <p className="text-sm text-muted py-2">{empty}</p>;
  const shown = expanded ? rows : rows.slice(0, pageSize);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="ui-table w-full text-sm">
          <thead>
            <tr>
              <th>{keyLabel}</th>
              <th className="text-right">Click</th>
              <th className="text-right">Hiển thị</th>
              <th className="text-right">CTR</th>
              <th className="text-right">Vị trí</th>
              {showChange && <th className="text-right whitespace-nowrap">Đổi vị trí</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                <td className="max-w-[18rem] break-words">{formatKey(r.key)}</td>
                <td className="text-right font-semibold">{nf(r.clicks)}</td>
                <td className="text-right">{nf(r.impressions)}</td>
                <td className="text-right">{formatPct(r.ctr)}</td>
                <td className="text-right">{formatPosition(r.position)}</td>
                {showChange && <td className="text-right whitespace-nowrap"><PositionChange row={r} /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <button onClick={() => setExpanded((e) => !e)} className="btn-ghost mt-2 px-3 py-2 text-sm cursor-pointer">
          {expanded ? "Thu gọn" : `Xem tất cả ${rows.length} dòng`}
        </button>
      )}
    </div>
  );
}

