"use client";
// Recharts nặng — file riêng để Overview tải lười qua next/dynamic (giống administrator/_components/AdminCharts.tsx)
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatShortVND } from "@/lib/adminApi";
import { vnd } from "@/lib/personalFinance";

const tooltipStyle = { borderRadius: "12px", border: "1px solid #eaecef", boxShadow: "0 8px 20px rgba(30,58,138,0.08)", fontSize: "13px" };
const axisTick = { fontSize: 12, fill: "#5b6b82" };
const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />;
const money = (v: unknown) => vnd(Number(v));
const legend = <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px" }} />;
const NAVY = "#1E3A8A";
const BLUE = "#3b82f6";
const ACCENT = "#f9a95a";

/** Thu / chi từng tháng + đường số dư cuối kỳ */
export function CashflowChart({ data }: { data: { name: string; income: number; expense: number; closing: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} contentStyle={tooltipStyle} />
        {legend}
        <Bar dataKey="income" name="Thu" fill={NAVY} radius={[4, 4, 0, 0]} barSize={16} />
        <Bar dataKey="expense" name="Chi" fill={BLUE} radius={[4, 4, 0, 0]} barSize={16} />
        <Line dataKey="closing" name="Số dư cuối kỳ" type="monotone" stroke={ACCENT} strokeWidth={3} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Cơ cấu theo danh mục lớn (donut) — tổng ở giữa */
export function DonutChart({ data, centerLabel }: { data: { name: string; value: number; color: string }[]; centerLabel: string }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="relative h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={data.length > 1 ? 2 : 0} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${vnd(Number(v))} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]} contentStyle={tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{centerLabel}</span>
        <span className="text-base sm:text-lg font-extrabold text-foreground">{formatShortVND(total)}</span>
      </div>
    </div>
  );
}

/** Top danh mục nhỏ (thanh ngang) */
export function HorizontalBars({ data, color = NAVY }: { data: { name: string; value: number }[]; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eaecef" />
        <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatShortVND} />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={axisTick} width={104} tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} contentStyle={tooltipStyle} />
        <Bar dataKey="value" name="Số tiền" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Chi từng ngày trong tháng */
export function DailyBars({ data }: { data: { day: string; amount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={14} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} labelFormatter={(l) => `Ngày ${l}`} contentStyle={tooltipStyle} />
        <Bar dataKey="amount" name="Chi" fill={BLUE} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Chi lũy kế trong tháng so với tổng hạn mức (nếu đã đặt) và thu nhập tháng */
export function CumulativeChart({ data, budget, income }: { data: { day: string; cumulative: number | null }[]; budget: number; income: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={14} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} domain={[0, (max: number) => Math.max(max, budget, income) * 1.05]} />
        <Tooltip formatter={money} labelFormatter={(l) => `Đến hết ngày ${l}`} contentStyle={tooltipStyle} />
        {income > 0 && <ReferenceLine y={income} stroke={NAVY} strokeDasharray="5 4" label={{ value: "Thu nhập", position: "insideTopLeft", fontSize: 11, fill: NAVY }} />}
        {budget > 0 && <ReferenceLine y={budget} stroke="#e11d48" strokeDasharray="5 4" label={{ value: "Tổng hạn mức", position: "insideBottomLeft", fontSize: 11, fill: "#e11d48" }} />}
        <Area dataKey="cumulative" name="Chi lũy kế" type="monotone" stroke={BLUE} fill={BLUE} fillOpacity={0.15} strokeWidth={2.5} connectNulls={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Chi theo danh mục lớn qua từng tháng (cột chồng) */
export function StackedMonthChart({ data, keys }: { data: Record<string, number | string>[]; keys: { key: string; color: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} contentStyle={tooltipStyle} />
        {legend}
        {keys.map((k, i) => (
          <Bar key={k.key} dataKey={k.key} stackId="s" fill={k.color} barSize={26} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Chi theo thứ trong tuần */
export function WeekdayChart({ data }: { data: { name: string; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} contentStyle={tooltipStyle} />
        <Bar dataKey="total" name="Chi" fill={NAVY} radius={[4, 4, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Gửi / rút tiết kiệm từng tháng + quỹ tiết kiệm lũy kế */
export function SavingsChart({ data }: { data: { name: string; delta: number; total: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#eef2fb" }} formatter={money} contentStyle={tooltipStyle} />
        {legend}
        <ReferenceLine y={0} stroke="#94a3b8" />
        <Bar dataKey="delta" name="Gửi / rút trong tháng" fill={BLUE} radius={[4, 4, 0, 0]} barSize={22} />
        <Line dataKey="total" name="Quỹ tiết kiệm" type="monotone" stroke={ACCENT} strokeWidth={3} dot={{ r: 3 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** Tỷ lệ tiết kiệm (% thu nhập giữ lại) qua các tháng */
export function SavingRateChart({ data }: { data: { name: string; rate: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 16, left: -6, bottom: 0 }}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={44} tickFormatter={(v) => `${v}%`} />
        <Tooltip formatter={(v) => `${Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} contentStyle={tooltipStyle} />
        <ReferenceLine y={0} stroke="#94a3b8" />
        <ReferenceLine y={20} stroke="#10b981" strokeDasharray="5 4" label={{ value: "Mục tiêu 20%", position: "insideTopRight", fontSize: 11, fill: "#10b981" }} />
        <Line dataKey="rate" name="Tỷ lệ tiết kiệm" type="monotone" stroke={NAVY} strokeWidth={3} dot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
