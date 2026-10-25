"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import {
  adminFetch, AdminAuthError, formatPer1000, pctChange,
  type SocialItem, type SocialKind, type SocialPlatform, type SocialRange, type SocialSummary, type SocialTotals,
} from "@/lib/adminApi";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";
import { ErrorBlock, KpiCard, LoadingBlock, SectionCard } from "./ui";
import SocialComments from "./SocialComments";

// Tab "Mạng xã hội": YouTube + Facebook (Reels, bài viết) + TikTok, kèm theo dõi bình luận (SocialComments). Đồng bộ qua API chính thức mỗi 20 phút — backend/src/utils/social/*.
// Tỷ lệ chuyển đổi = follow/subscribe mới ÷ lượt xem (hiện theo 1.000 lượt xem). Follow trễ 1–2 ngày so với lượt xem → số mới là "tạm tính".

const SocialMetricChart = dynamic(() => import("./AdminCharts").then((m) => m.SeoMetricChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

// Logo 3 nền tảng (SVG 24×24, đúng màu thương hiệu; trang trí nên aria-hidden)
const LOGO_PATH: Record<PlatformId, { d: string; fill: string }> = {
  YOUTUBE: { fill: "#FF0000", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
  FACEBOOK: { fill: "#1877F2", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
  TIKTOK: { fill: "#000000", d: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" },
};
function PlatformLogo({ id, className = "w-5 h-5" }: { id: PlatformId; className?: string }) {
  const l = LOGO_PATH[id];
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false"><path d={l.d} fill={l.fill} /></svg>;
}
const RANGES: SocialRange[] = [7, 28, 90];
const RANGE_KEY = "lucy_admin_social_days";
const PLATFORM_KEY = "lucy_admin_social_platform";
const REFRESH_MS = 30_000;
const MIN_VIEWS_FOR_RANKING = 500; // video quá ít lượt xem thì tỷ lệ nhiễu, không đưa vào xếp hạng theo chuyển đổi
const PROVISIONAL_DAYS = 3;
const PAGE_SIZE = 15;
const nf = (n: number) => n.toLocaleString("vi-VN");
const vnDate = (iso: string) => new Date(iso).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

type PlatformId = "YOUTUBE" | "FACEBOOK" | "TIKTOK";
const PLATFORMS: { id: PlatformId; label: string; kinds: { id: SocialKind | "ALL"; label: string }[]; followLabel: string }[] = [
  { id: "YOUTUBE", label: "YouTube", followLabel: "Người đăng ký", kinds: [{ id: "ALL", label: "Tất cả" }, { id: "YT_SHORT", label: "Shorts" }, { id: "YT_VIDEO", label: "Video dài" }] },
  { id: "FACEBOOK", label: "Facebook", followLabel: "Người theo dõi", kinds: [{ id: "ALL", label: "Tất cả" }, { id: "FB_REEL", label: "Reels" }, { id: "FB_POST", label: "Bài viết" }] },
  { id: "TIKTOK", label: "TikTok", followLabel: "Người theo dõi", kinds: [{ id: "ALL", label: "Tất cả" }] },
];
const KIND_LABEL: Record<SocialKind, string> = { YT_SHORT: "Short", YT_VIDEO: "Video", FB_REEL: "Reel", FB_POST: "Bài viết", TT_VIDEO: "Video" };
const PLATFORM_NAME: Record<PlatformId, string> = { YOUTUBE: "YouTube", FACEBOOK: "Facebook", TIKTOK: "TikTok" };
type View = "METRICS" | "COMMENTS";
const VIEW_KEY = "lucy_admin_social_view";

type ChartMetric = "views" | "gained" | "per1000";
const CHART_METRICS: { id: ChartMetric; label: string; format: (v: number) => string; decimals?: boolean }[] = [
  { id: "views", label: "Lượt xem", format: nf },
  { id: "gained", label: "Follow mới", format: nf },
  { id: "per1000", label: "Chuyển đổi / 1.000 view", format: formatPer1000, decimals: true },
];
type SortKey = "new" | "views" | "conv";

export default function SocialTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [days, setDays] = useState<SocialRange>(() => {
    try { const v = Number(localStorage.getItem(RANGE_KEY)); return RANGES.includes(v as SocialRange) ? (v as SocialRange) : 28; } catch { return 28; }
  });
  const [platform, setPlatform] = useState<PlatformId>(() => {
    try { const v = localStorage.getItem(PLATFORM_KEY); return v === "FACEBOOK" || v === "TIKTOK" ? v : "YOUTUBE"; } catch { return "YOUTUBE"; }
  });
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem(VIEW_KEY) === "COMMENTS" ? "COMMENTS" : "METRICS"; } catch { return "METRICS"; }
  });
  const [data, setData] = useState<SocialSummary | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const fail = useCallback((err: unknown) => {
    if (err instanceof AdminAuthError) onAuthLost();
    else setError((err as Error).message);
  }, [onAuthLost]);

  useEffect(() => {
    let cancelled = false;
    adminFetch<SocialSummary>(`/social/summary?days=${days}`)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => { if (!cancelled) fail(err); });
    return () => { cancelled = true; };
  }, [days, tick, fail]);

  // Làm mới gần real-time: 30 giây + khi tab trình duyệt lấy lại focus (polling, như các tab khác)
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const timer = setInterval(() => { if (document.visibilityState === "visible") bump(); }, REFRESH_MS);
    document.addEventListener("visibilitychange", bump);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", bump); };
  }, []);

  const changeDays = (d: SocialRange) => {
    setDays(d);
    try { localStorage.setItem(RANGE_KEY, String(d)); } catch { /* bị chặn */ }
  };
  const changePlatform = (p: PlatformId) => {
    setPlatform(p);
    try { localStorage.setItem(PLATFORM_KEY, p); } catch { /* bị chặn */ }
  };

  const changeView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* bị chặn */ }
  };

  const current = data ? (platform === "YOUTUBE" ? data.youtube : platform === "FACEBOOK" ? data.facebook : data.tiktok) : null;
  const meta = PLATFORMS.find((p) => p.id === platform)!;

  const syncNow = async () => {
    setSyncing(true);
    try {
      await adminFetch("/social/sync", { method: "POST", body: JSON.stringify({ platform }) });
      setTick((t) => t + 1);
    } catch (err) {
      if (err instanceof AdminAuthError) onAuthLost();
      else Swal.fire("Không đồng bộ được", (err as Error).message, "error");
    } finally {
      setSyncing(false);
    }
  };

  const all: Record<PlatformId, SocialPlatform> | null = data ? { YOUTUBE: data.youtube, FACEBOOK: data.facebook, TIKTOK: data.tiktok } : null;

  // Thứ bậc bộ lọc: nền tảng (lớn nhất) → Số liệu / Bình luận (nhỏ hơn, tab gạch chân) → khoảng thời gian (chip)
  const viewTabs = (
    <div className="flex gap-5 border-b border-line" role="tablist" aria-label="Nội dung">
      {([["METRICS", "Số liệu"], ["COMMENTS", "Bình luận"]] as [View, string][]).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={id === view} onClick={() => changeView(id)}
          className={`-mb-px px-1 py-2.5 text-sm font-bold border-b-2 cursor-pointer transition-colors ${id === view ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>{label}</button>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {all && <PlatformTabs all={all} value={platform} onChange={changePlatform} />}
      {viewTabs}

      {view === "COMMENTS" ? <SocialComments key={platform} platform={platform} onAuthLost={onAuthLost} /> : (
      <>
      {/* Thanh điều khiển: khoảng thời gian bên trái, trạng thái đồng bộ của nền tảng đang xem bên phải */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Khoảng thời gian">
          {RANGES.map((o) => (
            <button key={o} onClick={() => changeDays(o)} aria-pressed={o === days}
              className={`ui-chip cursor-pointer ${o === days ? "ui-chip-active" : ""}`}>{o} ngày</button>
          ))}
        </div>
        {current?.configured && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span>{current.sync.at ? `Đồng bộ lúc ${new Date(current.sync.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })} · tự làm mới mỗi 20 phút` : "Chưa đồng bộ từ khi khởi động server"}</span>
            <button onClick={syncNow} disabled={syncing} className="btn-outline px-4 py-2 text-sm cursor-pointer">{syncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}</button>
          </div>
        )}
      </div>

      {error ? <ErrorBlock message={error} onRetry={() => { setError(""); setTick((t) => t + 1); }} />
        : !current ? <LoadingBlock />
        : (
          <>
            {current.sync.error && <ErrorBlock message={`Lần đồng bộ gần nhất lỗi: ${current.sync.error}`} />}
            {!current.configured && !current.hasData ? <SetupCard platform={platform} />
              : !current.hasData ? <SectionCard title="Chưa có số liệu"><p className="text-sm text-muted">Bấm &ldquo;Đồng bộ ngay&rdquo; để lấy số liệu từ {meta.label}.</p></SectionCard>
              : <Body data={current} meta={meta} days={days} />}
          </>
        )}
      </>
      )}
    </div>
  );
}

function PlatformTabs({ all, value, onChange }: { all: Record<PlatformId, SocialPlatform>; value: PlatformId; onChange: (p: PlatformId) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-1.5 rounded-2xl bg-white border border-line p-1 sm:p-1.5" role="tablist" aria-label="Nền tảng">
      {PLATFORMS.map((m) => {
        const p = all[m.id];
        const selected = m.id === value;
        const connected = p.configured || p.hasData;
        const dot = !connected ? "bg-slate-300" : p.sync.error ? "bg-amber-500" : "bg-emerald-500";
        const hint = !connected ? "Chưa kết nối" : p.sync.error ? "Lỗi đồng bộ" : p.followers !== null && p.followers !== undefined ? `${nf(p.followers)} ${m.followLabel.toLowerCase()}` : "Đã kết nối";
        return (
          <button key={m.id} role="tab" aria-selected={selected} onClick={() => onChange(m.id)}
            className={`flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3 rounded-xl px-2 sm:px-4 py-2.5 sm:py-3 text-center sm:text-left cursor-pointer transition-colors min-w-0 ${selected ? "bg-primary text-white" : "text-foreground hover:bg-primary-soft"}`}>
            <span aria-hidden="true" className="w-10 h-10 rounded-full bg-white border border-line flex items-center justify-center shrink-0"><PlatformLogo id={m.id} /></span>
            <span className="min-w-0 max-w-full">
              <span className="flex items-center justify-center sm:justify-start gap-1.5 text-sm sm:text-base font-bold leading-tight">
                {m.label}<span aria-hidden="true" className={`sm:hidden w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
              </span>
              <span className={`hidden sm:flex items-center gap-1.5 text-xs ${selected ? "text-white/80" : "text-muted"}`}>
                <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} /><span className="truncate">{hint}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Body({ data, meta, days }: { data: SocialPlatform; meta: (typeof PLATFORMS)[number]; days: SocialRange }) {
  const t = data.totals?.current;
  const p = data.totals?.previous;
  const delta = (k: keyof SocialTotals) => (t && p ? pctChange(Number(t[k] ?? 0), Number(p[k] ?? 0)) : null);

  return (
    <>
      {data.period && (
        <p className="text-xs text-muted -mt-3">Số liệu theo ngày tính tới {vnDate(data.period.end)} — {data.platform === "TIKTOK"
          ? "TikTok không có số liệu theo ngày nên lượt xem, follow theo ngày được tích luỹ từ chênh lệch giữa các lần đồng bộ (chỉ tính từ khi bắt đầu kết nối; follow là tăng/giảm ròng)."
          : `${PLATFORM_NAME[data.platform]} cập nhật chậm 1–3 ngày nên video mới đăng sẽ chưa có trong các ô bên dưới (xem cột “Lượt xem” trong bảng nội dung để thấy số mới nhất).`}</p>
      )}

      {t && p && (
        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <KpiCard label={`Lượt xem ${days} ngày`} value={nf(t.views)} delta={delta("views")}
            hint={data.platform === "TIKTOK"
              ? `tích luỹ từ khi kết nối · tổng từ trước tới nay: ${nf(data.lifetimeViews || 0)}`
              : data.lifetimeViews ? `tổng từ trước tới nay: ${nf(data.lifetimeViews)}` : undefined} />
          <KpiCard label="Follow mới" value={nf(t.gained)} delta={delta("gained")} hint={`mất ${nf(t.lost)}`} />
          <KpiCard label="Tăng ròng" value={`${t.net > 0 ? "+" : ""}${nf(t.net)}`} tone={t.net > 0 ? "good" : t.net < 0 ? "bad" : "default"} delta={delta("net")} />
          <KpiCard label="Chuyển đổi / 1.000 view" value={formatPer1000(t.per1000)}
            delta={t.per1000 !== null && p.per1000 !== null ? pctChange(t.per1000, p.per1000) : null}
            hint="tạm tính 2–3 ngày cuối" />
          {/* 5 ô trên lưới 2 cột: ô cuối trải rộng 2 cột để không bị lẻ trên điện thoại */}
          <div className="col-span-2 lg:col-span-1 min-w-0">
            <KpiCard label={meta.followLabel} value={data.followers !== null && data.followers !== undefined ? nf(data.followers) : "—"}
              hint={data.platform === "YOUTUBE" ? "YouTube làm tròn khi >1.000" : undefined} />
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <TrendCard data={data} className="lg:col-span-2" />
        <TopContentCard data={data} />
      </div>
      <ItemsCard data={data} meta={meta} />

      {data.sync.notes.length > 0 && (
        <details className="rounded-xl bg-amber-50 text-amber-800 text-xs px-4 py-3">
          <summary className="cursor-pointer font-bold select-none">Ghi chú đồng bộ ({data.sync.notes.length})</summary>
          <div className="mt-2 space-y-1 break-words">{data.sync.notes.map((n) => <p key={n}>{n}</p>)}</div>
        </details>
      )}
    </>
  );
}

// Top 5 nội dung theo lượt xem hoặc theo chuyển đổi (chỉ nội dung đủ lượt xem để tỷ lệ không nhiễu)
function TopContentCard({ data }: { data: SocialPlatform }) {
  const [by, setBy] = useState<"views" | "conv">("views");
  const top = useMemo(() => {
    const list = by === "views"
      ? [...data.items].sort((a, b) => b.views - a.views)
      : data.items.filter((i) => i.per1000 !== null && (i.convViews ?? 0) >= MIN_VIEWS_FOR_RANKING).sort((a, b) => (b.per1000 ?? 0) - (a.per1000 ?? 0));
    return list.slice(0, 5);
  }, [data.items, by]);
  return (
    <SectionCard title="Nội dung nổi bật" subtitle={by === "views" ? "Nhiều lượt xem nhất" : `Chuyển đổi cao nhất (từ ${nf(MIN_VIEWS_FOR_RANKING)} lượt xem)`}
>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Xếp hạng theo">
        {([["views", "Lượt xem"], ["conv", "Chuyển đổi"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setBy(id)} aria-pressed={id === by} className={`ui-chip cursor-pointer ${id === by ? "ui-chip-active" : ""}`}>{label}</button>
        ))}
      </div>
      {!top.length ? <p className="text-sm text-muted py-6 text-center">{by === "conv" ? "Chưa có nội dung đủ dữ liệu follow để xếp hạng." : "Chưa có nội dung."}</p> : (
        <ol className="divide-y divide-line">
          {top.map((i, idx) => (
            <li key={i.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className="w-5 text-sm font-extrabold text-muted shrink-0 text-center">{idx + 1}</span>
              {i.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.thumbnail} alt="" width={56} height={32} loading="lazy" className="w-14 h-8 rounded-md object-cover bg-primary-soft shrink-0" />}
              <a href={i.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-sm font-bold text-foreground hover:text-primary line-clamp-2 break-words">{i.title || "(Không có tiêu đề)"}</a>
              <span className="text-sm font-extrabold text-foreground shrink-0 text-right">
                {by === "views" ? nf(i.views) : formatPer1000(i.per1000)}
                <span className="block text-[10px] font-normal text-muted">{by === "views" ? "lượt xem" : "/ 1.000 view"}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function TrendCard({ data, className = "" }: { data: SocialPlatform; className?: string }) {
  const [metric, setMetric] = useState<ChartMetric>("views");
  const m = CHART_METRICS.find((x) => x.id === metric)!;
  const series = useMemo(() => (data.series || []).map((r) => ({ date: r.date, value: r[metric] })), [data.series, metric]);
  return (
    <SectionCard title="Xu hướng theo ngày" subtitle={data.period ? `${vnDate(data.period.start)} – ${vnDate(data.period.end)}` : undefined} className={className}
      actions={<div className="flex flex-wrap gap-2">{CHART_METRICS.map((o) => (
        <button key={o.id} onClick={() => setMetric(o.id)} aria-pressed={o.id === metric} className={`ui-chip cursor-pointer ${o.id === metric ? "ui-chip-active" : ""}`}>{o.label}</button>
      ))}</div>}>
      <div className="h-72">
        <SocialMetricChart data={series} metric="clicks" label={m.label} format={m.format} decimals={m.decimals} />
      </div>
    </SectionCard>
  );
}

function ItemsCard({ data, meta }: { data: SocialPlatform; meta: (typeof PLATFORMS)[number] }) {
  const [kind, setKind] = useState<SocialKind | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("new");

  // Lọc + sắp xếp trên toàn bộ danh sách rồi mới phân trang
  const filtered = useMemo(() => {
    let list: SocialItem[] = data.items.filter((i) => kind === "ALL" || i.kind === kind);
    if (sort === "views") list = [...list].sort((a, b) => b.views - a.views);
    else if (sort === "conv") list = list.filter((i) => i.per1000 !== null && (i.convViews ?? 0) >= MIN_VIEWS_FOR_RANKING).sort((a, b) => (b.per1000 ?? 0) - (a.per1000 ?? 0));
    return list;
  }, [data.items, kind, sort]);
  const pg = usePagination(filtered, PAGE_SIZE, `${kind}|${sort}|${data.platform}`);
  const now = Date.now();

  return (
    <SectionCard title={data.platform === "YOUTUBE" ? "Video & Shorts" : data.platform === "TIKTOK" ? "Video TikTok" : "Reels & bài viết"}
      subtitle="Số liệu cộng dồn từ lúc đăng. Chuyển đổi = follow mới từ nội dung ÷ lượt xem."
      actions={
        <>
          {meta.kinds.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={k.id === kind} className={`ui-chip cursor-pointer ${k.id === kind ? "ui-chip-active" : ""}`}>{k.label}</button>
          ))}
          <label className="sr-only" htmlFor="social-sort">Sắp xếp</label>
          <select id="social-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="ui-input !w-auto !py-2 text-sm">
            <option value="new">Mới nhất</option>
            <option value="views">Nhiều lượt xem nhất</option>
            <option value="conv">Chuyển đổi cao nhất</option>
          </select>
        </>
      }>
      {sort === "conv" && <p className="text-xs text-muted mb-3">Chỉ xếp hạng nội dung có từ {nf(MIN_VIEWS_FOR_RANKING)} lượt xem trở lên (ít hơn thì tỷ lệ nhiễu).</p>}
      {!pg.totalItems ? <p className="text-sm text-muted py-6 text-center">Không có nội dung phù hợp.</p> : (
        <div className="space-y-3">
          {/* Điện thoại: mỗi nội dung 1 thẻ (bảng 5 cột sẽ phải cuộn ngang) */}
          <ul className="sm:hidden space-y-3">
            {pg.pageItems.map((i) => {
              const provisional = now - new Date(i.publishedAt).getTime() < PROVISIONAL_DAYS * 86_400_000;
              return (
                <li key={i.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start gap-3">
                    {i.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.thumbnail} alt="" width={80} height={45} loading="lazy" className="w-20 h-[45px] rounded-md object-cover bg-primary-soft shrink-0" />}
                    <div className="min-w-0">
                      <a href={i.url} target="_blank" rel="noopener noreferrer" className="font-bold text-foreground text-sm line-clamp-2 break-words">{i.title || "(Không có tiêu đề)"}</a>
                      <p className="text-xs text-muted mt-1"><span className="ui-badge mr-1.5">{KIND_LABEL[i.kind]}</span>{vnDate(i.publishedAt)}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className="rounded-lg bg-background py-2 min-w-0">
                      <dt className="text-[11px] text-muted">Lượt xem</dt>
                      <dd className="font-bold text-sm">{nf(i.views)}</dd>
                    </div>
                    <div className="rounded-lg bg-background py-2 min-w-0">
                      <dt className="text-[11px] text-muted">Follow mới</dt>
                      <dd className="font-bold text-sm">{i.followsGained === null ? "—" : `+${nf(i.followsGained)}`}</dd>
                    </div>
                    <div className="rounded-lg bg-background py-2 min-w-0">
                      <dt className="text-[11px] text-muted">/ 1.000 view</dt>
                      <dd className="font-bold text-sm">{formatPer1000(i.per1000)}</dd>
                      {i.per1000 !== null && provisional && <span className="block text-[10px] text-amber-700">tạm tính</span>}
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>
          <div className="hidden sm:block overflow-x-auto">
            <table className="ui-table w-full text-sm">
              <thead>
                <tr>
                  <th>Nội dung</th>
                  <th className="text-right whitespace-nowrap">Lượt xem</th>
                  <th className="text-right whitespace-nowrap">Tương tác</th>
                  <th className="text-right whitespace-nowrap">Follow mới</th>
                  <th className="text-right whitespace-nowrap">/ 1.000 view</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((i) => {
                  const provisional = now - new Date(i.publishedAt).getTime() < PROVISIONAL_DAYS * 86_400_000;
                  return (
                    <tr key={i.id}>
                      <td className="min-w-[260px]">
                        <div className="flex items-center gap-3">
                          {i.thumbnail && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.thumbnail} alt="" width={64} height={36} loading="lazy" className="w-16 h-9 rounded-md object-cover bg-primary-soft shrink-0" />}
                          <div className="min-w-0">
                            <a href={i.url} target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:text-primary line-clamp-2">{i.title || "(Không có tiêu đề)"}</a>
                            <p className="text-xs text-muted mt-0.5"><span className="ui-badge mr-1.5">{KIND_LABEL[i.kind]}</span>{vnDate(i.publishedAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-right font-bold">{nf(i.views)}</td>
                      <td className="text-right text-muted">{nf(i.likes + i.comments + i.shares)}</td>
                      <td className="text-right">{i.followsGained === null ? "—" : <>+{nf(i.followsGained)}{i.followsLost ? <span className="text-xs text-muted"> / −{nf(i.followsLost)}</span> : null}</>}</td>
                      <td className="text-right whitespace-nowrap font-bold">
                        {formatPer1000(i.per1000)}
                        {i.per1000 !== null && provisional && <span className="block text-[10px] font-normal text-amber-700">tạm tính</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={pg.page} totalPages={pg.totalPages} onPageChange={pg.setPage} totalItems={pg.totalItems} pageSize={PAGE_SIZE} />
        </div>
      )}
      {data.platform !== "YOUTUBE" && data.items.length > 0 && data.items.every((i) => i.followsGained === null) && (
        <p className="text-xs text-muted mt-3">{PLATFORM_NAME[data.platform]} chưa trả số follow theo từng nội dung nên cột chuyển đổi để trống; chuyển đổi cấp {data.platform === "TIKTOK" ? "kênh" : "Page"} vẫn tính ở các ô phía trên.</p>
      )}
    </SectionCard>
  );
}

function SetupCard({ platform }: { platform: PlatformId }) {
  return platform === "YOUTUBE" ? (
    <SectionCard title="Chưa kết nối YouTube" subtitle="Cần cấu hình 1 lần trên server backend">
      <ol className="list-decimal pl-6 space-y-1.5 text-sm text-foreground/90 break-words">
        <li>Google Cloud: bật <b>YouTube Data API v3</b> và <b>YouTube Analytics API</b>, tạo OAuth client loại &ldquo;Desktop app&rdquo;, chuyển màn hình đồng ý OAuth sang <b>In production</b>.</li>
        <li>Đặt <code>YT_CLIENT_ID</code>, <code>YT_CLIENT_SECRET</code> trong <code>backend/.env</code>, chạy <code>node scripts/youtubeAuth.js</code> và đăng nhập bằng tài khoản chủ kênh.</li>
        <li>Chép <code>YT_REFRESH_TOKEN</code> script in ra vào <code>.env</code> (và biến môi trường hosting), khởi động lại server.</li>
      </ol>
    </SectionCard>
  ) : platform === "TIKTOK" ? (
    <SectionCard title="Chưa kết nối TikTok" subtitle="Cần cấu hình 1 lần trên server backend">
      <ol className="list-decimal pl-6 space-y-1.5 text-sm text-foreground/90 break-words">
        <li>Tạo app ở <b>developers.tiktok.com</b>, thêm product <b>Login Kit</b> + <b>Display API</b> với scope <code>user.info.basic</code>, <code>user.info.stats</code>, <code>video.list</code>. Khi app còn Sandbox, thêm tài khoản TikTok của kênh vào &ldquo;Target users&rdquo;.</li>
        <li>Đăng ký Redirect URI <code>http://localhost:53683/callback</code>, đặt <code>TT_CLIENT_KEY</code>, <code>TT_CLIENT_SECRET</code> trong <code>backend/.env</code>, chạy <code>node scripts/tiktokAuth.js</code> và đăng nhập bằng tài khoản chủ kênh.</li>
        <li>Chép <code>TT_REFRESH_TOKEN</code> script in ra vào <code>.env</code> (và biến môi trường hosting), khởi động lại server. Các lần sau token tự xoay vòng và được lưu trong database.</li>
      </ol>
    </SectionCard>
  ) : (
    <SectionCard title="Chưa kết nối Facebook" subtitle="Cần cấu hình 1 lần trên server backend">
      <ol className="list-decimal pl-6 space-y-1.5 text-sm text-foreground/90 break-words">
        <li>Reels phải đăng trên <b>Fanpage</b> (trang cá nhân không đọc được số liệu qua API).</li>
        <li>Tạo Meta App, cấp quyền <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>read_insights</code>, lấy <b>Page access token dài hạn</b>.</li>
        <li>Đặt <code>FB_PAGE_ID</code> và <code>FB_PAGE_TOKEN</code> trong <code>backend/.env</code> (và biến môi trường hosting), khởi động lại server.</li>
      </ol>
    </SectionCard>
  );
}
