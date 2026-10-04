import { SCROLL_MILESTONES, deriveReadStats, formatDuration, type BlogReadStats } from "@/lib/blog";

const fmt = (n: number) => n.toLocaleString("vi-VN");

// Màu theo mức giữ chân: đọc được ≥60% thời lượng bài = tốt, 30–59% = trung bình, dưới 30% = thấp
export const readPercentTone = (p: number) =>
  p >= 60 ? "bg-emerald-50 text-emerald-700" : p >= 30 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";

// 4 cột nhỏ: % lượt đọc cuộn tới 25/50/75/100% nội dung bài — cho thấy người đọc hay bỏ ngang ở đoạn nào.
export function ScrollBars({ scroll }: { scroll: Record<(typeof SCROLL_MILESTONES)[number], number> }) {
  return (
    <div className="flex items-end gap-1.5" role="img"
      aria-label={SCROLL_MILESTONES.map((m) => `cuộn tới ${m}%: ${scroll[m]}% lượt đọc`).join(", ")}>
      {SCROLL_MILESTONES.map((m) => (
        <div key={m} className="flex flex-col items-center gap-0.5" title={`Cuộn tới ${m === 100 ? "hết bài" : `${m}% bài`}: ${scroll[m]}% lượt đọc`}>
          <span className="text-[10px] tabular-nums text-muted">{scroll[m]}%</span>
          <div className="w-5 h-8 rounded bg-slate-100 flex items-end overflow-hidden">
            <div className="w-full bg-primary" style={{ height: `${scroll[m]}%` }} />
          </div>
          <span className="text-[10px] text-muted">{m === 100 ? "Hết" : m}</span>
        </div>
      ))}
    </div>
  );
}

// Khối thống kê đầy đủ của 1 bài — dùng ở sidebar trình soạn bài.
export function PostStatsDetail({ stats }: { stats: BlogReadStats }) {
  const d = deriveReadStats(stats);
  const rows: [string, string][] = [
    ["Lượt xem", fmt(stats.views)],
    ["Lượt click", fmt(stats.clicks)],
    ["Lượt đọc", fmt(stats.readSessions)],
    ["Thời gian đọc TB", stats.readSessions ? formatDuration(d.avgSeconds) : "—"],
    ["Thời gian đọc dự kiến", `${stats.readingMinutes} phút`],
  ];
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-semibold text-foreground tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {stats.readSessions > 0 ? (
        <>
          <p className="text-xs">
            Người đọc ở lại trung bình{" "}
            <span className={`ui-badge ${readPercentTone(d.readPercent)}`}>{d.readPercent}%</span> thời lượng bài
          </p>
          <div>
            <p className="text-xs text-muted mb-1">Mức cuộn (% lượt đọc)</p>
            <ScrollBars scroll={d.scroll} />
          </div>
        </>
      ) : (
        <p className="text-xs text-muted">Chưa có lượt đọc nào được ghi nhận.</p>
      )}
    </div>
  );
}
