"use client";
// Recharts nặng (~100KB gzip) — tách riêng để page.tsx tải lười qua next/dynamic (giống teacher/_components/OverviewCharts.tsx)
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortVND, formatVND, shortDay } from "@/lib/adminApi";

const tooltipStyle = { borderRadius: "12px", border: "1px solid #eaecef", boxShadow: "0 8px 20px rgba(30,58,138,0.08)", fontSize: "13px" };
const axisTick = { fontSize: 12, fill: "#5b6b82" };

type FinancePoint = { name: string; income: number; expense: number; profit: number };

// Thu (navy), chi (xanh phụ), lợi nhuận (đường cam) theo 12 tháng
export function FinanceYearChart({ data, onSelect }: { data: FinancePoint[]; onSelect?: (index: number) => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}
        onClick={(e) => { if (onSelect && typeof e?.activeTooltipIndex === "number") onSelect(e.activeTooltipIndex); }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={(v) => formatVND(Number(v))} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />
        <Bar dataKey="income" name="Thu nhập" fill="#1E3A8A" radius={[4, 4, 0, 0]} barSize={14} />
        <Bar dataKey="expense" name="Chi phí" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={14} />
        <Line dataKey="profit" name="Lợi nhuận" type="monotone" stroke="#f9a95a" strokeWidth={3} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SignupChart({ data }: { data: { label: string; students: number; teachers: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "#eef2fb" }} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />
        <Bar dataKey="students" name="Học viên" stackId="u" fill="#1E3A8A" barSize={22} />
        <Bar dataKey="teachers" name="Giáo viên" stackId="u" fill="#f9a95a" radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ===== Lượt truy cập & sức khoẻ kinh doanh =====
// Bảng màu theo CLAUDE.md: navy chuỗi chính, cam nhấn cho chuỗi thứ 2 (tối đa 2 chuỗi/biểu đồ, luôn có chú thích;
// số liệu chi tiết nằm ở bảng bên cạnh vì cam có tương phản thấp trên nền trắng). Không dùng 2 trục Y.
const NAVY = "#1E3A8A";
const ACCENT = "#f9a95a";
const nf = (v: unknown) => Number(v).toLocaleString("vi-VN");

/** Khách & lượt xem theo ngày */
export function TrafficChart({ data }: { data: { day: string; views: number; visitors: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="day" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={axisTick} minTickGap={18} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip labelFormatter={(d) => shortDay(String(d))} formatter={nf} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />
        <Line dataKey="views" name="Lượt xem" type="monotone" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        <Line dataKey="visitors" name="Khách" type="monotone" stroke={NAVY} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Lượt xem theo giờ trong ngày (giờ VN) — 1 chuỗi */
export function HoursChart({ data }: { data: { hour: number; views: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="hour" tickFormatter={(h) => `${h}h`} axisLine={false} tickLine={false} tick={axisTick} interval={2} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "#eef2fb" }} labelFormatter={(h) => `${h}:00 – ${h}:59`} formatter={(v) => [nf(v), "Lượt xem"]} contentStyle={tooltipStyle} />
        <Bar dataKey="views" fill={NAVY} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Lượt xem từng phút trong 30 phút gần nhất — 1 chuỗi */
export function RealtimeChart({ data }: { data: { ago: number; views: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <XAxis dataKey="ago" hide />
        <Tooltip cursor={{ fill: "#eef2fb" }} labelFormatter={(a) => (Number(a) === 0 ? "Phút này" : `${a} phút trước`)} formatter={(v) => [nf(v), "Lượt xem"]} contentStyle={tooltipStyle} />
        <Bar dataKey="views" fill={NAVY} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Doanh thu ghi nhận qua app theo tháng: học phí lớp + học viên tự do (cột chồng) */
export function RevenueChart({ data }: { data: { label: string; classTuition: number; freeStudent: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={(v) => formatVND(Number(v))} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />
        <Bar dataKey="classTuition" name="Học phí lớp" stackId="r" fill={NAVY} stroke="#fff" strokeWidth={1} barSize={22} />
        <Bar dataKey="freeStudent" name="Học viên tự do" stackId="r" fill={ACCENT} stroke="#fff" strokeWidth={1} radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Học viên hoạt động: DAU (mỗi ngày) và WAU (7 ngày cuộn) — cùng đơn vị "người" nên chung 1 trục */
export function ActiveUsersChart({ data }: { data: { day: string; dau: number; wau: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="day" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={axisTick} minTickGap={18} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip labelFormatter={(d) => shortDay(String(d))} formatter={nf} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />
        <Line dataKey="wau" name="Hoạt động 7 ngày (WAU)" type="monotone" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
        <Line dataKey="dau" name="Hoạt động trong ngày (DAU)" type="monotone" stroke={NAVY} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Học viên hoạt động theo tháng (MAU) — 1 chuỗi */
export function MonthlyActiveChart({ data }: { data: { label: string; activeStudents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={(v) => [nf(v), "Học viên hoạt động"]} contentStyle={tooltipStyle} />
        <Bar dataKey="activeStudents" fill={NAVY} radius={[4, 4, 0, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** SEO: 1 chỉ số theo ngày (click / lượt hiển thị / CTR / vị trí). Vị trí đảo trục: càng nhỏ càng tốt nên vẽ càng cao */
export function SeoMetricChart({ data, metric, label, format }: {
  data: { date: string; value: number | null }[]; metric: "clicks" | "impressions" | "ctr" | "position"; label: string;
  format: (v: number) => string;
}) {
  const isPosition = metric === "position";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="date" tickFormatter={shortDay} axisLine={false} tickLine={false} tick={axisTick} minTickGap={18} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={44} reversed={isPosition}
          allowDecimals={metric === "ctr" || isPosition} tickFormatter={(v) => format(Number(v))}
          domain={isPosition ? [1, "auto"] : [0, "auto"]} />
        <Tooltip labelFormatter={(d) => shortDay(String(d))} formatter={(v) => [v === null ? "—" : format(Number(v)), label]} contentStyle={tooltipStyle} />
        <Line dataKey="value" name={label} type="monotone" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** SEO: biểu đồ mini theo ngày trong ô chỉ số (không trục, chỉ tooltip). Vị trí đảo trục: đường đi lên = thứ hạng tốt lên */
export function SeoSparkline({ id, data, reversed = false, label, format }: {
  id: string; data: { date: string; value: number | null }[]; reversed?: boolean; label: string; format: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.22} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <YAxis hide reversed={reversed} domain={["auto", "auto"]} />
        <Tooltip labelFormatter={(d) => shortDay(String(d))} formatter={(v) => [v === null || v === undefined ? "—" : format(Number(v)), label]}
          contentStyle={{ ...tooltipStyle, padding: "4px 8px" }} />
        <Area dataKey="value" type="monotone" stroke={NAVY} strokeWidth={2} fill={reversed ? "none" : `url(#spark-${id})`}
          dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// Thang 1 màu navy nhạt → đậm: nhóm vị trí càng tốt càng đậm
const POSITION_RAMP = ["#1E3A8A", "#3556a8", "#5f7fc4", "#93aadb", "#c7d3ee"];

/** SEO: lượt hiển thị chia theo nhóm vị trí (Top 3, 4–10, 11–20, 21–50, > 50) — 1 chuỗi, màu theo thứ hạng */
export function SeoPositionChart({ data }: { data: { name: string; impressions: number; clicks: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 18, right: 6, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} interval={0} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} allowDecimals={false} width={40} />
        <Tooltip cursor={{ fill: "#eef2fb" }} contentStyle={tooltipStyle}
          formatter={(v, _n, item) => [`${nf(v)} lượt hiển thị · ${nf((item?.payload as { clicks: number })?.clicks ?? 0)} click`, "Vị trí " + (item?.payload as { name: string })?.name]}
          labelFormatter={() => ""} />
        <Bar dataKey="impressions" radius={[4, 4, 0, 0]} maxBarSize={56} label={{ position: "top", fontSize: 12, fill: "#334155", formatter: (v: unknown) => (Number(v) ? nf(v) : "") }}>
          {data.map((_, i) => <Cell key={i} fill={POSITION_RAMP[i] ?? POSITION_RAMP[POSITION_RAMP.length - 1]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
