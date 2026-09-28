"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { IeltsSkill } from "./IeltsStudyPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const IeltsProgressChart = dynamic(() => import("./IeltsProgressChart"), {
  ssr: false,
  loading: () => <div className="skeleton h-72 w-full" />
});

export const IELTS_SKILLS: IeltsSkill[] = ["LISTENING", "READING", "WRITING", "SPEAKING"];
export const IELTS_SKILL_LABEL: Record<IeltsSkill, string> = { LISTENING: "Listening", READING: "Reading", WRITING: "Writing", SPEAKING: "Speaking" };

export type SkillProgress = {
  count: number; latest: number | null; previous: number | null; change: number | null; best: number | null;
  lastPracticedAt: string | null; daysSinceLast: number | null;
  series: { band: number; practicedAt: string; testTitle: string }[];
};
export type IeltsProgressData = {
  skills: Record<IeltsSkill, SkillProgress>;
  overall: number | null;
  notifications: { level: "success" | "warning" | "info"; skill?: IeltsSkill; message: string }[];
};

// GET /api/ielts-study/progress/:userId — band history + rule-based notifications (no AI).
export function useIeltsProgress(userId: string | null, refreshKey?: unknown) {
  const [data, setData] = useState<IeltsProgressData | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetch(`${API}/api/ielts-study/progress/${userId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d?.skills) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId, refreshKey]);
  return data;
}

const NOTICE_STYLE = {
  success: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  info: "bg-primary-soft text-primary border-line"
};

export function IeltsNotifications({ items, max = 3 }: { items: IeltsProgressData["notifications"]; max?: number }) {
  if (!items.length) return null;
  return (
    <div className="space-y-2">
      {items.slice(0, max).map((n, i) => (
        <div key={i} className={`rounded-xl border px-4 py-3 text-sm font-medium text-left ${NOTICE_STYLE[n.level]}`}>{n.message}</div>
      ))}
    </div>
  );
}

function ChangeChip({ change }: { change: number | null }) {
  if (change === null) return <span className="text-xs text-muted">Lần đầu</span>;
  if (change === 0) return <span className="ui-badge">Giữ nguyên</span>;
  return (
    <span className={`ui-badge ${change > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
      {change > 0 ? "▲ +" : "▼ "}{change.toFixed(1)}
    </span>
  );
}

// Compact block for the result screen right after "Làm đề": this skill's band vs the previous
// attempt and personal best, plus the most relevant notifications.
export function IeltsProgressNotice({ skill, userId }: { skill: IeltsSkill; userId: string }) {
  const data = useIeltsProgress(userId);
  if (!data) return null;
  const s = data.skills[skill];
  const related = data.notifications.filter((n) => !n.skill || n.skill === skill);
  return (
    <div className="ui-card p-5 text-left space-y-3">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">Tiến bộ {IELTS_SKILL_LABEL[skill]}</p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span>Lần này: <b className="text-primary text-lg">{s.latest?.toFixed(1) ?? "-"}</b></span>
        <span>Lần trước: <b>{s.previous?.toFixed(1) ?? "-"}</b></span>
        <ChangeChip change={s.change} />
        <span>Cao nhất: <b>{s.best?.toFixed(1) ?? "-"}</b></span>
        <span className="text-muted">{s.count} lần làm</span>
      </div>
      <IeltsNotifications items={related} max={2} />
    </div>
  );
}

// Full "Tiến Bộ" tab on /ielts: per-skill cards, estimated overall band, band-over-time chart, notifications.
export function IeltsProgressPanel({ data }: { data: IeltsProgressData | null }) {
  if (!data) return <div className="ui-card text-center py-12 px-4 text-primary font-bold animate-pulse">Đang tải...</div>;
  const practiced = IELTS_SKILLS.filter((s) => data.skills[s].count > 0);
  if (!practiced.length) {
    return (
      <div className="ui-card text-center py-12 px-4 text-muted italic">
        <img src="/images/illustrations/study-progress.svg" alt="Chưa có dữ liệu tiến bộ IELTS" width={800} height={600} loading="lazy" className="w-full h-auto max-w-[220px] mx-auto mb-3" />
        Làm bài IELTS đầu tiên để bắt đầu theo dõi tiến bộ band điểm.
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="ui-hero p-5 col-span-2 lg:col-span-1">
          <p className="text-xs font-bold uppercase tracking-widest text-white/70">Overall ước tính</p>
          <p className="text-4xl font-black text-white mt-2">{data.overall?.toFixed(1) ?? "-"}</p>
          <p className="text-xs text-white/75 mt-1">{data.overall === null ? "Cần làm đủ 4 kỹ năng" : "Trung bình band gần nhất 4 kỹ năng"}</p>
        </div>
        {IELTS_SKILLS.map((skill) => {
          const s = data.skills[skill];
          return (
            <div key={skill} className="ui-card p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">{IELTS_SKILL_LABEL[skill]}</p>
              <p className="text-3xl font-black text-primary mt-2">{s.latest?.toFixed(1) ?? "-"}</p>
              <div className="mt-1"><ChangeChip change={s.count ? s.change : null} /></div>
              <p className="text-xs text-muted mt-2">
                {s.count ? `Cao nhất ${s.best?.toFixed(1)} · ${s.count} lần · ${s.daysSinceLast === 0 ? "hôm nay" : `${s.daysSinceLast} ngày trước`}` : "Chưa làm lần nào"}
              </p>
            </div>
          );
        })}
      </div>

      {data.notifications.length > 0 && (
        <div className="ui-card p-5 space-y-3">
          <h3 className="ui-section-title">Thông báo tiến bộ</h3>
          <IeltsNotifications items={data.notifications} max={10} />
        </div>
      )}

      <div className="ui-card p-5">
        <h3 className="ui-section-title mb-4">Band điểm theo thời gian</h3>
        <IeltsProgressChart skills={data.skills} />
      </div>
    </div>
  );
}
