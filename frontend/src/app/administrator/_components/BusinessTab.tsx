"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  adminFetch, AdminAuthError, formatPct, formatVND, pctChange,
  type Business, type RangeDays,
} from "@/lib/adminApi";
import { BarList, ErrorBlock, KpiCard, LoadingBlock, RangeChips, SectionCard } from "./ui";

const RevenueChart = dynamic(() => import("./AdminCharts").then((m) => m.RevenueChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const ActiveUsersChart = dynamic(() => import("./AdminCharts").then((m) => m.ActiveUsersChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});
const MonthlyActiveChart = dynamic(() => import("./AdminCharts").then((m) => m.MonthlyActiveChart), {
  ssr: false, loading: () => <div className="skeleton w-full h-full" />,
});

const RANGES: RangeDays[] = [7, 30, 90];
const RANGE_KEY = "lucy_admin_business_days";

type Level = "critical" | "warning" | "success" | "info";
type Insight = { level: Level; title: string; text: string };
const LEVEL_ORDER: Record<Level, number> = { critical: 0, warning: 1, info: 2, success: 3 };
const LEVEL_STYLE: Record<Level, { box: string; tag: string; label: string }> = {
  critical: { box: "border-red-200 bg-red-50", tag: "bg-red-600 text-white", label: "Nghiêm trọng" },
  warning: { box: "border-amber-200 bg-amber-50", tag: "bg-amber-500 text-white", label: "Cần chú ý" },
  info: { box: "border-blue-200 bg-blue-50", tag: "bg-primary text-white", label: "Thông tin" },
  success: { box: "border-emerald-200 bg-emerald-50", tag: "bg-emerald-600 text-white", label: "Tốt" },
};

const n = (v: number) => v.toLocaleString("vi-VN");
const ratio = (a: number, b: number) => (b ? a / b : 0);

export default function BusinessTab({ onAuthLost }: { onAuthLost: () => void }) {
  const [days, setDays] = useState<RangeDays>(() => {
    try { const v = Number(localStorage.getItem(RANGE_KEY)); return RANGES.includes(v as RangeDays) ? (v as RangeDays) : 30; } catch { return 30; }
  });
  const [data, setData] = useState<Business | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = () => adminFetch<Business>(`/analytics/business?days=${days}`)
      .then((d) => { if (!cancelled) { setData(d); setError(""); } })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof AdminAuthError) onAuthLost();
        else setError((err as Error).message);
      });
    load();
    const timer = setInterval(() => { if (document.visibilityState === "visible") load(); }, 5 * 60_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [days, tick, onAuthLost]);

  const changeDays = (d: RangeDays) => {
    setDays(d); setData(null);
    try { localStorage.setItem(RANGE_KEY, String(d)); } catch { /* bị chặn */ }
  };

  return (
    <div className="space-y-6">
      <RangeChips value={days} options={RANGES} onChange={changeDays} />
      {error ? <ErrorBlock message={error} onRetry={() => { setError(""); setTick((t) => t + 1); }} />
        : !data ? <LoadingBlock />
        : <BusinessBody data={data} />}
    </div>
  );
}

function buildInsights(d: Business): Insight[] {
  const out: Insight[] = [];
  const [prev2, lastFull, thisMonth] = d.revenue.slice(-3);

  // Doanh thu: so tháng đã trọn vẹn gần nhất với tháng trước nó (tháng hiện tại chưa hết nên không so)
  const revChange = pctChange(lastFull.total, prev2.total);
  if (revChange !== null && revChange <= -20) out.push({ level: "critical", title: `Doanh thu ${lastFull.label} giảm ${Math.abs(Math.round(revChange))}%`, text: `${formatVND(lastFull.total)} so với ${formatVND(prev2.total)} tháng trước đó. Kiểm tra học viên chưa đóng phí và lớp vắng.` });
  else if (revChange !== null && revChange >= 15) out.push({ level: "success", title: `Doanh thu ${lastFull.label} tăng ${Math.round(revChange)}%`, text: `${formatVND(lastFull.total)} so với ${formatVND(prev2.total)}.` });
  if (!thisMonth.total && !lastFull.total) out.push({ level: "info", title: "Chưa ghi nhận doanh thu qua app 2 tháng gần đây", text: "Doanh thu ở đây chỉ gồm học phí giáo viên bấm xác nhận trong app. Nếu thu ngoài app, hãy nhập ở tab Thu chi." });

  // Người dùng hoạt động
  const mauChange = pctChange(d.active.mau, d.active.prevMau);
  if (mauChange !== null && mauChange <= -15) out.push({ level: "warning", title: `Học viên hoạt động giảm ${Math.abs(Math.round(mauChange))}%`, text: `${n(d.active.mau)} học viên hoạt động 30 ngày qua, so với ${n(d.active.prevMau)} của 30 ngày trước đó.` });
  else if (mauChange !== null && mauChange >= 15) out.push({ level: "success", title: `Học viên hoạt động tăng ${Math.round(mauChange)}%`, text: `${n(d.active.mau)} học viên hoạt động 30 ngày qua (trước đó ${n(d.active.prevMau)}).` });
  if (d.active.mau >= 10) {
    if (d.active.stickiness < 0.1) out.push({ level: "warning", title: `Độ gắn bó thấp (${formatPct(d.active.stickiness, 0)})`, text: "Học viên trung bình chưa tới 3 ngày/tháng mở app học. Cân nhắc nhắc học hằng ngày, giao bài tập ngắn đều đặn." });
    else if (d.active.stickiness >= 0.25) out.push({ level: "success", title: `Độ gắn bó tốt (${formatPct(d.active.stickiness, 0)})`, text: "Học viên quay lại học thường xuyên." });
  }

  // Phễu
  const f = d.funnel;
  if (f.visitors >= 100 && ratio(f.signups, f.visitors) < 0.01) out.push({ level: "warning", title: `Chỉ ${formatPct(ratio(f.signups, f.visitors))} khách đăng ký`, text: `${n(f.visitors)} khách → ${n(f.signups)} đăng ký trong ${d.days} ngày. Thêm lời mời dùng thử ở các trang công cụ được xem nhiều (xem tab Lượt truy cập).` });
  if (f.signups >= 5 && ratio(f.activated, f.signups) < 0.4) out.push({ level: "warning", title: `${formatPct(1 - ratio(f.activated, f.signups), 0)} học viên mới chưa học bài nào`, text: "Học viên đăng ký nhưng không làm bài luyện tập nào trong 7 ngày đầu — dễ rời bỏ. Nên có hướng dẫn bắt đầu hoặc giáo viên liên hệ chào mừng." });

  // Dùng thử → trả phí
  const t = d.trial;
  if (t.ended >= 5) {
    const conv = ratio(t.paid + t.joinedClass, t.ended);
    if (conv < 0.2) out.push({ level: "warning", title: `Chuyển đổi sau dùng thử thấp (${formatPct(conv, 0)})`, text: `${n(t.ended)} học viên đã hết 3 ngày dùng thử, ${n(t.paid)} đóng phí, ${n(t.joinedClass)} vào lớp, ${n(t.lockedNeverPaid)} bị khoá chưa từng đóng phí.` });
    else out.push({ level: "success", title: `Chuyển đổi sau dùng thử ${formatPct(conv, 0)}`, text: `${n(t.paid)} đóng phí và ${n(t.joinedClass)} vào lớp trên ${n(t.ended)} học viên đã hết dùng thử.` });
  }
  const s = d.subscriptions;
  if (s.everPaid >= 3 && s.lapsed > s.active) out.push({ level: "critical", title: "Nhiều học viên tự do không gia hạn", text: `${n(s.lapsed)} học viên đã từng đóng phí nhưng hết hạn chưa gia hạn, chỉ còn ${n(s.active)} còn hạn.` });
  if (s.expiringIn7 > 0) out.push({ level: "info", title: `${n(s.expiringIn7)} học viên tự do hết hạn trong 7 ngày`, text: "Nhắc giáo viên phụ trách liên hệ gia hạn trước khi tài khoản bị khoá." });

  // Giữ chân: nhóm đăng ký gần nhất đã qua trọn 1 tháng
  const cohort = [...d.cohorts].reverse().find((c) => c.size >= 5 && c.retention.length >= 2);
  if (cohort && cohort.retention[1] !== null && cohort.retention[1] < 0.2) out.push({ level: "warning", title: `Chỉ ${formatPct(cohort.retention[1], 0)} học viên đăng ký ${cohort.label} còn học tháng sau`, text: "Tỉ lệ giữ chân tháng thứ 2 thấp. Xem tính năng nào học viên dùng nhiều nhất để đẩy mạnh." });

  // Tính năng giảm mạnh
  d.features.filter((x) => x.prevUses >= 10 && x.uses < x.prevUses * 0.5).slice(0, 2).forEach((x) =>
    out.push({ level: "info", title: `"${x.name}" giảm ${Math.round((1 - x.uses / x.prevUses) * 100)}% lượt dùng`, text: `${n(x.uses)} lượt so với ${n(x.prevUses)} của kỳ trước.` }));

  // Giáo viên
  if (d.teachers.emptyClassrooms > 0) out.push({ level: "info", title: `${n(d.teachers.emptyClassrooms)} lớp chưa có học viên`, text: "Lớp tạo ra nhưng chưa ai tham gia — cơ hội tuyển sinh hoặc lớp cần dọn dẹp." });
  const idleTeachers = d.teachers.total - d.teachers.active30;
  if (idleTeachers > 0) out.push({ level: "info", title: `${n(idleTeachers)} giáo viên không hoạt động 30 ngày`, text: "Giáo viên không đăng nhập trong 30 ngày qua." });

  return out.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]).slice(0, 8);
}

function BusinessBody({ data: d }: { data: Business }) {
  const thisMonth = d.revenue[d.revenue.length - 1];
  const lastMonth = d.revenue[d.revenue.length - 2];
  const insights = buildInsights(d);
  const f = d.funnel;
  const signupsNow = d.signups.students + d.signups.teachers;
  const signupsPrev = d.signups.prevStudents + d.signups.prevTeachers;

  const funnelSteps = [
    { name: "Khách truy cập website", value: f.visitors, note: "khách duy nhất (theo trình duyệt)" },
    { name: "Vào trang đăng nhập / đăng ký", value: f.authVisitors, note: "" },
    { name: "Đăng ký tài khoản học viên", value: f.signups, note: "" },
    { name: "Học thử trong 7 ngày đầu", value: f.activated, note: "làm ít nhất 1 bài luyện tập" },
    { name: "Đóng phí", value: f.paid, note: `ngoài ra ${n(f.joinedClass)} đã vào lớp` },
  ];

  return (
    <>
      <SectionCard title="Nhận định & cảnh báo" subtitle="Tự động sinh từ số liệu bên dưới (theo quy tắc, không dùng AI)">
        {insights.length ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((i) => (
              <li key={i.title} className={`rounded-xl border px-4 py-3 ${LEVEL_STYLE[i.level].box}`}>
                <span className={`inline-block text-[11px] font-bold rounded-full px-2 py-0.5 ${LEVEL_STYLE[i.level].tag}`}>{LEVEL_STYLE[i.level].label}</span>
                <p className="font-bold text-foreground mt-1.5">{i.title}</p>
                <p className="text-sm text-foreground/80 mt-0.5">{i.text}</p>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted">Chưa có gì bất thường — hoặc chưa đủ dữ liệu để đánh giá.</p>}
      </SectionCard>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        <KpiCard label={`Doanh thu ${thisMonth.label}`} value={formatVND(thisMonth.total)} delta={pctChange(thisMonth.total, lastMonth.total)} hint="tháng chưa kết thúc" />
        <KpiCard label="Người trả phí" value={n(thisMonth.payers)} delta={pctChange(thisMonth.payers, lastMonth.payers)} hint={`tháng trước ${n(lastMonth.payers)}`} />
        <KpiCard label="Doanh thu / người trả" value={formatVND(thisMonth.arppu)} hint={`tháng trước ${formatVND(lastMonth.arppu)}`} />
        <KpiCard label="Học viên hoạt động 30 ngày" value={n(d.active.mau)} delta={pctChange(d.active.mau, d.active.prevMau)} hint={`WAU ${n(d.active.wau)} · hôm nay ${n(d.active.dau)}`} />
        <KpiCard label="Độ gắn bó (DAU/MAU)" value={formatPct(d.active.stickiness, 0)} hint={`TB ${d.active.avgDau.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} học viên/ngày`} />
        <KpiCard label={`Đăng ký mới ${d.days} ngày`} value={n(signupsNow)} delta={pctChange(signupsNow, signupsPrev)} hint={`${n(d.signups.students)} học viên · ${n(d.signups.teachers)} giáo viên`} />
      </div>

      <SectionCard title="Doanh thu ghi nhận qua app" subtitle="12 tháng · học phí lớp giáo viên xác nhận đã nộp + phí học viên tự do">
        <div className="h-72"><RevenueChart data={d.revenue} /></div>
        <div className="overflow-x-auto mt-5">
          <table className="ui-table w-full text-sm whitespace-nowrap">
            <thead><tr><th>Tháng</th><th className="text-right">Học phí lớp</th><th className="text-right">Học viên tự do</th><th className="text-right">Tổng</th><th className="text-right">Người trả</th><th className="text-right">TB / người</th><th className="text-right">HV hoạt động</th></tr></thead>
            <tbody>
              {[...d.revenue].reverse().map((r) => (
                <tr key={r.ym}>
                  <td className="font-semibold">{r.label}</td>
                  <td className="text-right">{formatVND(r.classTuition)}</td>
                  <td className="text-right">{formatVND(r.freeStudent)}</td>
                  <td className="text-right font-bold">{formatVND(r.total)}</td>
                  <td className="text-right">{n(r.payers)}</td>
                  <td className="text-right">{r.payers ? formatVND(r.arppu) : "—"}</td>
                  <td className="text-right">{n(r.activeStudents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-3">Khác với lợi nhuận ở tab Thu chi (chỉ tính khoản nhập tay). Học phí thu ngoài app không có ở đây.</p>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Học viên hoạt động mỗi ngày" subtitle="30 ngày · hoạt động = làm bài luyện tập/ôn từ hoặc mở app khi đã đăng nhập">
          <div className="h-64"><ActiveUsersChart data={d.active.series} /></div>
        </SectionCard>
        <SectionCard title="Học viên hoạt động theo tháng" subtitle="12 tháng (MAU)">
          <div className="h-64"><MonthlyActiveChart data={d.revenue} /></div>
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SectionCard title="Phễu chuyển đổi" subtitle={`${d.days} ngày gần nhất · % so với bước ngay trước`}>
          <ol className="space-y-2">
            {funnelSteps.map((s, i) => {
              // Thanh tính theo bước lớn nhất (bước 1 có thể = 0 khi chưa bật đếm truy cập)
              const top = Math.max(...funnelSteps.map((x) => x.value), 1);
              const prev = i ? funnelSteps[i - 1].value : 0;
              return (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-foreground">{i + 1}. {s.name}</span>
                    <span className="shrink-0"><b>{n(s.value)}</b>
                      {i > 0 && <span className="text-muted text-xs ml-1.5">{prev ? formatPct(s.value / prev, 0) : "—"}</span>}</span>
                  </div>
                  <div className="h-2.5 mt-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max((s.value / top) * 100, s.value ? 2 : 0)}%` }} />
                  </div>
                  {s.note && <p className="text-xs text-muted mt-0.5">{s.note}</p>}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-muted mt-3">Bước 1–2 chỉ có số liệu từ khi bật đếm lượt truy cập. Khách là học viên trong lớp do giáo viên tạo tài khoản sẽ không qua bước đăng ký.</p>
        </SectionCard>

        <SectionCard title="Học viên tự do: dùng thử → trả phí" subtitle="Học viên đăng ký từ 01/08/2026 có chọn giáo viên phụ trách">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Stat label="Đã đăng ký dùng thử" value={n(d.trial.started)} />
            <Stat label="Đang trong 3 ngày thử" value={n(d.trial.inTrial)} />
            <Stat label="Đã hết dùng thử" value={n(d.trial.ended)} />
            <Stat label="Đã đóng phí" value={n(d.trial.paid)} sub={d.trial.ended ? formatPct(d.trial.paid / d.trial.ended, 0) : undefined} tone="good" />
            <Stat label="Chuyển sang vào lớp" value={n(d.trial.joinedClass)} sub={d.trial.ended ? formatPct(d.trial.joinedClass / d.trial.ended, 0) : undefined} />
            <Stat label="Bị khoá, chưa đóng phí" value={n(d.trial.lockedNeverPaid)} sub={d.trial.ended ? formatPct(d.trial.lockedNeverPaid / d.trial.ended, 0) : undefined} tone="bad" />
          </div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted mt-5 mb-2">Thuê bao (học viên tự do đã từng đóng phí)</p>
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Còn hạn" value={n(d.subscriptions.active)} tone="good" />
            <Stat label="Hết hạn chưa gia hạn" value={n(d.subscriptions.lapsed)} sub={d.subscriptions.everPaid ? formatPct(d.subscriptions.lapsed / d.subscriptions.everPaid, 0) : undefined} tone="bad" />
            <Stat label="Hết hạn trong 7 ngày" value={n(d.subscriptions.expiringIn7)} />
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Giữ chân học viên theo tháng đăng ký" subtitle="% học viên của mỗi nhóm còn hoạt động ở tháng thứ 1, 2, 3… kể từ tháng đăng ký">
        <div className="overflow-x-auto">
          <table className="ui-table w-full text-sm whitespace-nowrap">
            <thead><tr><th>Tháng đăng ký</th><th className="text-right">Số HV</th>{[0, 1, 2, 3, 4, 5].map((k) => <th key={k} className="text-center">{k === 0 ? "Tháng đầu" : `+${k} tháng`}</th>)}</tr></thead>
            <tbody>
              {d.cohorts.map((c) => (
                <tr key={c.cohort}>
                  <td className="font-semibold">{c.label}</td>
                  <td className="text-right">{n(c.size)}</td>
                  {[0, 1, 2, 3, 4, 5].map((k) => {
                    const v = c.retention[k];
                    if (k >= c.retention.length) return <td key={k} />;
                    if (v === null || v === undefined) return <td key={k} className="text-center text-muted">—</td>;
                    // Sequential 1 sắc độ navy: càng đậm càng giữ chân tốt; chữ đổi trắng khi nền đậm
                    return (
                      <td key={k} className="text-center font-semibold" style={{ background: `rgba(30,58,138,${0.06 + v * 0.8})`, color: v >= 0.5 ? "#fff" : "#1f2937" }}>
                        {formatPct(v, 0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SectionCard title="Mức dùng tính năng" subtitle={`Lượt dùng ${d.days} ngày gần nhất, so với ${d.days} ngày trước đó`} className="lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="ui-table w-full text-sm whitespace-nowrap">
              <thead><tr><th>Tính năng</th><th className="text-right">Lượt dùng</th><th className="text-right">Học viên</th><th className="text-right">So với kỳ trước</th></tr></thead>
              <tbody>
                {[...d.features].sort((a, b) => b.uses - a.uses).map((x) => {
                  const ch = pctChange(x.uses, x.prevUses);
                  return (
                    <tr key={x.name}>
                      <td className="font-semibold">{x.name}</td>
                      <td className="text-right font-bold">{n(x.uses)}</td>
                      <td className="text-right">{n(x.users)}</td>
                      <td className={`text-right ${ch === null ? "text-muted" : ch >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {ch === null ? (x.uses ? "mới" : "—") : `${ch >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(ch))}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-3">&quot;Ôn từ vựng SRS&quot; đếm số thẻ được ôn (mỗi thẻ tính lần ôn gần nhất). IELTS gộp 4 kỹ năng.</p>
        </SectionCard>

        <SectionCard title="Giáo viên & lớp học" subtitle="Năng lực phục vụ">
          <BarList items={[
            { name: "Giáo viên", value: d.teachers.total },
            { name: "Hoạt động 30 ngày", value: d.teachers.active30 },
            { name: "Đang có học viên", value: d.teachers.withStudents },
          ]} />
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Học viên trong lớp</dt><dd className="font-bold">{n(d.teachers.classStudents)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">TB học viên / giáo viên có lớp</dt>
              <dd className="font-bold">{d.teachers.withStudents ? (d.teachers.classStudents / d.teachers.withStudents).toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "—"}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Lớp chưa có học viên</dt><dd className="font-bold">{n(d.teachers.emptyClassrooms)}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${tone === "good" ? "bg-emerald-50" : tone === "bad" ? "bg-red-50" : "bg-slate-50"}`}>
      <p className="text-xs text-muted leading-snug">{label}</p>
      <p className={`text-xl font-extrabold mt-0.5 ${tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-foreground"}`}>
        {value}{sub && <span className="text-xs font-semibold text-muted ml-1.5">{sub}</span>}
      </p>
    </div>
  );
}
