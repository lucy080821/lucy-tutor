"use client";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { IeltsSkill } from "./IeltsStudyPanel";
import type { SkillProgress } from "./IeltsProgress";

// Loaded via next/dynamic from IeltsProgress.tsx so recharts only ships when the chart renders.
const SKILL_COLORS: Record<IeltsSkill, string> = { LISTENING: "#1E3A8A", READING: "#3b82f6", WRITING: "#f9a95a", SPEAKING: "#10b981" };
const SKILL_LABEL: Record<IeltsSkill, string> = { LISTENING: "Listening", READING: "Reading", WRITING: "Writing", SPEAKING: "Speaking" };

export default function IeltsProgressChart({ skills }: { skills: Record<IeltsSkill, SkillProgress> }) {
  // One row per attempt date; each skill's band sits in its own column so lines connect across gaps.
  const rows = new Map<string, Record<string, number | string>>();
  (Object.keys(skills) as IeltsSkill[]).forEach((skill) => {
    skills[skill].series.forEach((p) => {
      const key = new Date(p.practicedAt).toISOString();
      const row = rows.get(key) || { t: key, label: new Date(p.practicedAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" }) };
      row[skill] = p.band;
      rows.set(key, row);
    });
  });
  const data = [...rows.values()].sort((a, b) => String(a.t).localeCompare(String(b.t)));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eaecef" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#5b6b82" }} />
          <YAxis domain={[0, 9]} ticks={[0, 3, 4, 5, 6, 7, 8, 9]} tick={{ fontSize: 12, fill: "#5b6b82" }} />
          <Tooltip formatter={(v: any, name: any) => [Number(v).toFixed(1), name]} />
          <Legend />
          {(Object.keys(skills) as IeltsSkill[]).filter((s) => skills[s].count > 0).map((skill) => (
            <Line key={skill} type="monotone" dataKey={skill} name={SKILL_LABEL[skill]} stroke={SKILL_COLORS[skill]} strokeWidth={2.5} dot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
