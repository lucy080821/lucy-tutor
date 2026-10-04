"use client";
// Recharts nặng (~100KB gzip) — tách riêng để page.tsx tải lười qua next/dynamic (giống teacher/_components/OverviewCharts.tsx)
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatShortVND, formatVND } from "@/lib/adminApi";

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
