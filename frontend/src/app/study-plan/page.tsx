"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface StudyPlan {
  summary: string;
  targetDate: string;
  weeklySchedule: {
    week: number;
    focus: string;
    dailyTasks: string[];
    skills: string[];
  }[];
  resources: { title: string; type: string; priority: "High" | "Medium" | "Low" }[];
  tips: string[];
}

const GOALS = [
  { value: "IELTS_6", label: "IELTS 6.0", desc: "Đại học, xin học bổng cơ bản" },
  { value: "IELTS_6_5", label: "IELTS 6.5", desc: "Đại học top, học bổng tốt" },
  { value: "IELTS_7", label: "IELTS 7.0", desc: "Thạc sĩ, học bổng chất lượng cao" },
  { value: "IELTS_7_5", label: "IELTS 7.5+", desc: "Nghiên cứu sinh, học bổng xuất sắc" },
  { value: "TOEIC_600", label: "TOEIC 600", desc: "Yêu cầu tốt nghiệp, xin việc" },
  { value: "TOEIC_750", label: "TOEIC 750", desc: "Doanh nghiệp nước ngoài" },
  { value: "THPTQG", label: "THPT Quốc gia 8+", desc: "Vào đại học điểm cao" },
];

const TIME_OPTIONS = [
  { value: "30", label: "30 phút/ngày" },
  { value: "60", label: "1 tiếng/ngày" },
  { value: "90", label: "1.5 tiếng/ngày" },
  { value: "120", label: "2+ tiếng/ngày" },
];

const LEVELS = [
  { value: "A1", label: "A1 — Sơ cấp (0-3 điểm)" },
  { value: "A2", label: "A2 — Cơ bản (3-5 điểm)" },
  { value: "B1", label: "B1 — Trung cấp (5-6.5 điểm)" },
  { value: "B2", label: "B2 — Khá (6.5-8 điểm)" },
  { value: "C1", label: "C1 — Giỏi (8+ điểm)" },
];

const WEAK_AREAS = [
  "Grammar", "Vocabulary", "Reading Comprehension", "Listening", "Speaking",
  "Writing Task 1", "Writing Task 2", "Pronunciation", "Academic Vocabulary",
];

const PRIORITY_STYLES = {
  High: "bg-red-50 text-red-700 border-red-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Low: "bg-green-50 text-green-700 border-green-200",
};

const TYPE_ICON: Record<string, string> = {
  Practice: "📝",
  Video: "🎬",
  Reading: "📖",
  Listening: "🎧",
  Speaking: "🗣️",
  Writing: "✏️",
  Flashcard: "🃏",
  Grammar: "✏️",
};

export default function StudyPlanPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    goal: "IELTS_6_5",
    currentLevel: "B1",
    deadline: "",
    timePerDay: "60",
    weakAreas: [] as string[],
    name: "",
  });

  useEffect(() => {
    const userId = localStorage.getItem("userId") || sessionStorage.getItem("userId");
    if (!userId) return;
    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
    fetch(`${API}/api/auth/me?userId=${userId}`)
      .then(r => r.json())
      .then(u => {
        if (u?.name) setForm(f => ({ ...f, name: u.name }));
        if (u?.targetScore) {
          const score = parseFloat(u.targetScore);
          if (score >= 8) setForm(f => ({ ...f, goal: "IELTS_7_5" }));
          else if (score >= 7) setForm(f => ({ ...f, goal: "IELTS_7" }));
          else if (score >= 6) setForm(f => ({ ...f, goal: "IELTS_6_5" }));
        }
      })
      .catch(() => {});
  }, []);

  const toggleWeak = (area: string) => {
    setForm(f => ({
      ...f,
      weakAreas: f.weakAreas.includes(area)
        ? f.weakAreas.filter(a => a !== area)
        : [...f.weakAreas, area],
    }));
  };

  const generatePlan = async () => {
    setLoading(true);
    setError("");
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const res = await fetch(`${API}/api/ai/study-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlan(data);
      setStep(2);
    } catch {
      setError("Không thể tạo lộ trình lúc này. Vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  const weeksUntilDeadline = form.deadline
    ? Math.max(1, Math.ceil((new Date(form.deadline).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-foreground/10 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard" className="text-foreground/50 hover:text-foreground transition-colors text-sm font-medium">
          ← Dashboard
        </Link>
        <span className="text-foreground/20">/</span>
        <h1 className="font-bold">Study Plan</h1>
        <span className="ml-auto px-3 py-1 bg-primary/10 text-primary text-xs font-bold border border-primary/20">AI Powered</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {step === 1 && (
          <>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Tạo lộ trình học cá nhân hóa</h2>
              <p className="text-foreground/60">AI sẽ xây dựng kế hoạch học chi tiết theo tuần dựa trên mục tiêu và thời gian của bạn.</p>
            </div>

            {/* Goal */}
            <div className="bg-surface border border-foreground/10 p-6 space-y-4">
              <h3 className="font-bold">1. Mục tiêu của bạn</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                    className={`p-4 text-left border transition-all ${form.goal === g.value ? "bg-primary/10 border-primary text-primary" : "border-foreground/15 hover:border-foreground/30"}`}
                  >
                    <div className="font-bold">{g.label}</div>
                    <div className="text-xs text-foreground/50 mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current level */}
            <div className="bg-surface border border-foreground/10 p-6 space-y-4">
              <h3 className="font-bold">2. Trình độ hiện tại</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setForm(f => ({ ...f, currentLevel: l.value }))}
                    className={`p-3 text-left border transition-all text-sm ${form.currentLevel === l.value ? "bg-primary/10 border-primary text-primary" : "border-foreground/15 hover:border-foreground/30"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline & Time */}
            <div className="bg-surface border border-foreground/10 p-6 space-y-5">
              <h3 className="font-bold">3. Thời gian & deadline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/70">Ngày thi dự kiến</label>
                  <input
                    type="date"
                    value={form.deadline}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-foreground/15 focus:outline-none focus:border-primary bg-transparent text-sm"
                  />
                  {weeksUntilDeadline && (
                    <p className="text-xs text-foreground/50 mt-1">≈ {weeksUntilDeadline} tuần còn lại</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-foreground/70">Thời gian học mỗi ngày</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setForm(f => ({ ...f, timePerDay: t.value }))}
                        className={`px-3 py-2 text-sm border transition-all ${form.timePerDay === t.value ? "bg-primary/10 border-primary text-primary font-bold" : "border-foreground/15 hover:border-foreground/30"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Weak areas */}
            <div className="bg-surface border border-foreground/10 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">4. Điểm yếu của bạn (có thể chọn nhiều)</h3>
                {form.weakAreas.length > 0 && (
                  <span className="text-xs text-primary font-bold">{form.weakAreas.length} đã chọn</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {WEAK_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleWeak(area)}
                    className={`px-3 py-1.5 text-sm border transition-all ${form.weakAreas.includes(area) ? "bg-rose-50 border-rose-300 text-rose-700 font-bold" : "border-foreground/15 hover:border-foreground/30 text-foreground/70"}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
            )}

            <button
              onClick={generatePlan}
              disabled={loading}
              className="w-full py-4 bg-primary text-white font-bold text-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-3"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xây dựng lộ trình...</>
              ) : (
                <><span>🤖</span> Tạo lộ trình cá nhân hóa</>
              )}
            </button>
          </>
        )}

        {step === 2 && plan && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-2xl font-bold">Lộ trình học của bạn</h2>
                <p className="text-foreground/60 text-sm mt-1">{plan.summary}</p>
              </div>
              <button
                onClick={() => { setStep(1); setPlan(null); }}
                className="px-4 py-2 border border-foreground/20 text-sm font-bold hover:bg-foreground/5 transition-colors"
              >
                Tạo lại
              </button>
            </div>

            {/* Weekly Schedule */}
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">📅 Lịch học từng tuần</h3>
              {plan.weeklySchedule.map(week => (
                <div key={week.week} className="bg-surface border border-foreground/10 overflow-hidden">
                  <div className="bg-primary/5 border-b border-foreground/10 px-5 py-3 flex items-center justify-between">
                    <span className="font-bold">Tuần {week.week}</span>
                    <span className="text-sm text-primary font-semibold">{week.focus}</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {week.skills.map(skill => (
                        <span key={skill} className="text-xs px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-1.5">
                      {week.dailyTasks.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/75">
                          <span className="text-primary font-bold shrink-0 mt-0.5">→</span>
                          {task}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Resources */}
            {plan.resources?.length > 0 && (
              <div className="bg-surface border border-foreground/10 p-6 space-y-4">
                <h3 className="font-bold text-lg">📚 Tài nguyên học tập gợi ý</h3>
                <div className="space-y-2">
                  {plan.resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-foreground/5 last:border-0">
                      <span className="text-xl">{TYPE_ICON[r.type] || "📌"}</span>
                      <span className="flex-1 text-sm font-medium">{r.title}</span>
                      <span className="text-xs text-foreground/50">{r.type}</span>
                      <span className={`text-xs px-2 py-0.5 font-bold border ${PRIORITY_STYLES[r.priority]}`}>
                        {r.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {plan.tips?.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 p-6 space-y-3">
                <h3 className="font-bold text-amber-700 flex items-center gap-2">💡 Lời khuyên từ AI</h3>
                <ul className="space-y-2">
                  {plan.tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-amber-800">
                      <span className="font-bold shrink-0 text-amber-500">{i + 1}.</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/gym" className="py-3 bg-surface border border-foreground/15 text-center font-bold text-sm hover:bg-foreground/5 transition-colors flex items-center justify-center gap-2">
                🏋️ Bắt đầu Vocab Gym
              </Link>
              <Link href="/conversation" className="py-3 bg-surface border border-foreground/15 text-center font-bold text-sm hover:bg-foreground/5 transition-colors flex items-center justify-center gap-2">
                🗣️ Luyện Nói Cùng AI
              </Link>
              <Link href="/listening" className="py-3 bg-surface border border-foreground/15 text-center font-bold text-sm hover:bg-foreground/5 transition-colors flex items-center justify-center gap-2">
                🎧 Luyện Listening
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
