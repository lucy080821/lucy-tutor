"use client";
// Recharts is ~100KB+ gzipped — kept in its own module so teacher/page.tsx can load it via
// next/dynamic instead of shipping it in the dashboard's initial bundle. Markup/props are
// moved verbatim from the OVERVIEW tab; do not change the visuals here.
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';

const tooltipStyle = { borderRadius: '12px', border: '1px solid #eaecef', boxShadow: '0 8px 20px rgba(30,58,138,0.08)', fontSize: '13px' };

export function RevenueTrendChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6b82' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6b82' }} width={56}
          tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}tr` : String(v)} />
        <Tooltip cursor={{ fill: '#eef2fb' }} formatter={(v: any) => `${Number(v).toLocaleString()} đ`}
          contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
        <Bar dataKey="CanThu" name="Cần Thu (Lớp)" fill="#d4dae0" radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey="DaThu" name="Đã Thu (Lớp)" fill="#1E3A8A" radius={[4, 4, 0, 0]} barSize={18} />
        <Bar dataKey="HocVienTuDo" name="Học Viên Tự Do" fill="#f9a95a" radius={[4, 4, 0, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ClassSizeChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6b82' }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6b82' }} allowDecimals={false} width={28} />
        <Tooltip cursor={{ fill: '#eef2fb' }} contentStyle={tooltipStyle} />
        <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
        <Bar dataKey="HọcSinh" name="Số Học Viên" fill="#1E3A8A" radius={[4, 4, 0, 0]} barSize={28} />
        <Bar dataKey="BàiTập" name="Số Bài Tập" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TuitionDonutChart({ collected, expected }: { collected: number; expected: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={[
            { name: 'Đã thu', value: collected },
            { name: 'Còn thiếu', value: Math.max(expected - collected, 0) },
          ]}
          dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={78}
          paddingAngle={3} stroke="#fff" strokeWidth={2}
        >
          <Cell fill="#10b981" />
          <Cell fill="#ef4444" />
        </Pie>
        <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} đ`} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ClassScoreChart({ data }: { data: { name: string; DiemTB: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eaecef" />
        <XAxis type="number" domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#5b6b82' }} />
        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={160} tick={{ fontSize: 12, fill: '#1f2d3d' }} />
        <Tooltip cursor={{ fill: '#eef2fb' }} contentStyle={tooltipStyle} />
        <Bar dataKey="DiemTB" name="Điểm trung bình" fill="#1E3A8A" radius={[0, 4, 4, 0]} barSize={22}>
          <LabelList dataKey="DiemTB" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#1f2d3d' }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
