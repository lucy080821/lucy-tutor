"use client";
// Recharts nặng — file riêng để Overview tải lười qua next/dynamic (giống administrator/_components/AdminCharts.tsx)
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatShortVND } from "@/lib/adminApi";
import { vnd } from "@/lib/personalFinance";

const tooltipStyle = { borderRadius: "12px", border: "1px solid #363a50", background: "#252a42", color: "#e8eaf3", boxShadow: "0 8px 24px rgba(0,0,0,0.45)", fontSize: "13px" };
const tooltipText = { color: "#e8eaf3" };
const axisTick = { fontSize: 12, fill: "#8d93aa" };
const grid = <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2d3e" />;
const money = (v: unknown) => vnd(Number(v));
const legend = <Legend iconType="circle" wrapperStyle={{ paddingTop: "12px", fontSize: "13px", color: "#8d93aa" }} />;
const NAVY = "#5b84ff";
const BLUE = "#a78bfa";
const ACCENT = "#fbbf24";

/** Thu / chi từng tháng + đường số dư cuối kỳ */
export function CashflowChart({ data }: { data: { name: string; income: number; expense: number; closing: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} barGap={3}>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={data.length > 1 ? 3 : 0} cornerRadius={4} stroke="none">
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [`${vnd(Number(v))} (${total ? Math.round((Number(v) / total) * 100) : 0}%)`, n]} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#2a2d3e" />
        <XAxis type="number" axisLine={false} tickLine={false} tick={axisTick} tickFormatter={formatShortVND} />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={axisTick} width={104} tickFormatter={(v: string) => (v.length > 15 ? `${v.slice(0, 14)}…` : v)} />
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} labelFormatter={(l) => `Ngày ${l}`} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <Tooltip formatter={money} labelFormatter={(l) => `Đến hết ngày ${l}`} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
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
        <Tooltip cursor={{ fill: "#252a42" }} formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
        {legend}
        <ReferenceLine y={0} stroke="#4b5270" />
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
        <Tooltip formatter={(v) => `${Number(v).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
        <ReferenceLine y={0} stroke="#4b5270" />
        <ReferenceLine y={20} stroke="#10b981" strokeDasharray="5 4" label={{ value: "Mục tiêu 20%", position: "insideTopRight", fontSize: 11, fill: "#10b981" }} />
        <Line dataKey="rate" name="Tỷ lệ tiết kiệm" type="monotone" stroke={NAVY} strokeWidth={3} dot={{ r: 4 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Đường Thu / Chi (kiểu "Finances" của dashboard mẫu): đường cong mượt có vùng mờ bên dưới */
export function FinanceLineChart({ data }: { data: { name: string; income: number | null; expense: number | null; closing?: number }[] }) {
  const hasClosing = data.some((d) => d.closing !== undefined);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="pf-g-exp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} /><stop offset="100%" stopColor="#fb7185" stopOpacity={0} /></linearGradient>
          <linearGradient id="pf-g-inc" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#34d399" stopOpacity={0.3} /><stop offset="100%" stopColor="#34d399" stopOpacity={0} /></linearGradient>
        </defs>
        {grid}
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={axisTick} interval="preserveStartEnd" minTickGap={16} />
        <YAxis axisLine={false} tickLine={false} tick={axisTick} width={52} tickFormatter={formatShortVND} />
        <Tooltip formatter={money} contentStyle={tooltipStyle} itemStyle={tooltipText} labelStyle={tooltipText} />
        {legend}
        <Area dataKey="income" name="Thu" type="monotone" stroke="#34d399" strokeWidth={2.5} fill="url(#pf-g-inc)" dot={false} activeDot={{ r: 5 }} />
        <Area dataKey="expense" name="Chi" type="monotone" stroke="#fb7185" strokeWidth={2.5} fill="url(#pf-g-exp)" dot={false} activeDot={{ r: 5 }} />
        {hasClosing && <Line dataKey="closing" name="Số dư cuối kỳ" type="monotone" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3 }} />}
      </AreaChart>
    </ResponsiveContainer>
  );
}
