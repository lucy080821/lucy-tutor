"use client";
import { useState, useEffect } from "react";
import { getSessionUserId } from "@/lib/session";
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
  High: "bg-red-50 text-red-700 border-red-100",
  Medium: "bg-amber-50 text-amber-700 border-amber-100",
  Low: "bg-emerald-50 text-emerald-700 border-emerald-100",
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
    const userId = getSessionUserId();
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
      <div className="bg-white border-b border-line px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link href="/dashboard" className="text-muted hover:text-primary transition-colors text-sm font-semibold">
          ← Dashboard
        </Link>
        <span className="text-line-strong hidden sm:inline">/</span>
        <h1 className="font-bold text-primary">Study Plan</h1>
        <span className="ml-auto ui-badge">AI Powered</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
        {step === 1 && (
          <>
            <section className="rounded-2xl bg-primary-soft border border-line px-5 py-6 sm:px-7 sm:py-7 flex flex-col md:flex-row md:items-center gap-5">
              <div className="flex-1 min-w-0 space-y-2">
                <p className="text-xs sm:text-sm text-muted">Trang chủ / Lộ Trình Học</p>
                <h2 className="ui-page-title text-2xl sm:text-3xl">Tạo lộ trình học cá nhân hóa</h2>
                <p className="ui-page-subtitle">AI sẽ xây dựng kế hoạch học chi tiết theo tuần dựa trên mục tiêu và thời gian của bạn.</p>
              </div>
              <div className="hidden md:block w-full max-w-[260px] shrink-0">
                <img src="/images/thumbs/study-plan.svg" alt="Minh hoạ lộ trình học cá nhân hóa" width={640} height={360} loading="eager" className="w-full h-auto rounded-2xl" />
              </div>
            </section>

            {/* Goal */}
            <div className="ui-card p-5 sm:p-6 space-y-4">
              <h3 className="font-bold text-primary">1. Mục tiêu của bạn</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {GOALS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setForm(f => ({ ...f, goal: g.value }))}
                    className={`p-4 text-left border rounded-xl transition-all ${form.goal === g.value ? "bg-primary-soft border-primary text-primary" : "bg-white border-line-strong hover:border-primary"}`}
                  >
                    <div className="font-bold">{g.label}</div>
                    <div className="text-xs text-muted mt-0.5">{g.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Current level */}
            <div className="ui-card p-5 sm:p-6 space-y-4">
              <h3 className="font-bold text-primary">2. Trình độ hiện tại</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LEVELS.map(l => (
                  <button
                    key={l.value}
                    onClick={() => setForm(f => ({ ...f, currentLevel: l.value }))}
                    className={`p-3 text-left border rounded-xl transition-all text-sm ${form.currentLevel === l.value ? "bg-primary-soft border-primary text-primary font-semibold" : "bg-white border-line-strong hover:border-primary"}`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Deadline & Time */}
            <div className="ui-card p-5 sm:p-6 space-y-5">
              <h3 className="font-bold text-primary">3. Thời gian & deadline</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="ui-label">Ngày thi dự kiến</label>
                  <input
                    type="date"
                    value={form.deadline}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    className="ui-input text-sm"
                  />
                  {weeksUntilDeadline && (
                    <p className="text-xs text-muted mt-1">≈ {weeksUntilDeadline} tuần còn lại</p>
                  )}
                </div>
                <div>
                  <label className="ui-label">Thời gian học mỗi ngày</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_OPTIONS.map(t => (
                      <button
                        key={t.value}
                        onClick={() => setForm(f => ({ ...f, timePerDay: t.value }))}
                        className={`ui-chip justify-center px-3 py-2 cursor-pointer ${form.timePerDay === t.value ? "ui-chip-active" : ""}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Weak areas */}
            <div className="ui-card p-5 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold text-primary">4. Điểm yếu của bạn (có thể chọn nhiều)</h3>
                {form.weakAreas.length > 0 && (
                  <span className="text-xs text-primary font-bold">{form.weakAreas.length} đã chọn</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {WEAK_AREAS.map(area => (
                  <button
                    key={area}
                    onClick={() => toggleWeak(area)}
                    className={`ui-chip cursor-pointer ${form.weakAreas.includes(area) ? "ui-chip-active" : ""}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 text-sm rounded-xl">{error}</div>
            )}

            <button
              onClick={generatePlan}
              disabled={loading}
              className="btn-primary w-full py-3.5 text-lg gap-3"
            >
              {loading ? (
                <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Đang xây dựng lộ trình...</>
              ) : (
                <>Tạo lộ trình cá nhân hóa</>
              )}
            </button>
          </>
        )}

        {step === 2 && plan && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="ui-page-title text-2xl">Lộ trình học của bạn</h2>
                <p className="text-muted text-sm mt-1">{plan.summary}</p>
              </div>
              <button
                onClick={() => { setStep(1); setPlan(null); }}
                className="btn-outline px-5 py-2 text-sm"
              >
                Tạo lại
              </button>
            </div>

            {/* Weekly Schedule */}
            <div className="space-y-4">
              <h3 className="ui-section-title text-lg">Lịch học từng tuần</h3>
              {plan.weeklySchedule.map(week => (
                <div key={week.week} className="ui-card overflow-hidden">
                  <div className="bg-primary-soft border-b border-line px-5 py-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-primary">Tuần {week.week}</span>
                    <span className="text-sm text-primary font-semibold">{week.focus}</span>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {week.skills.map(skill => (
                        <span key={skill} className="ui-badge">
                          {skill}
                        </span>
                      ))}
                    </div>
                    <ul className="space-y-1.5">
                      {week.dailyTasks.map((task, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
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
              <div className="ui-card p-5 sm:p-6 space-y-4">
                <h3 className="font-bold text-primary text-lg">Tài nguyên học tập gợi ý</h3>
                <div className="space-y-2">
                  {plan.resources.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-line last:border-0">
                      <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="flex-1 text-sm font-medium">{r.title}</span>
                      <span className="text-xs text-muted">{r.type}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${PRIORITY_STYLES[r.priority]}`}>
                        {r.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tips */}
            {plan.tips?.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 sm:p-6 space-y-3">
                <h3 className="font-bold text-amber-700">Lời khuyên từ AI</h3>
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
              <Link href="/gym" className="btn-outline py-3 text-sm">
                Bắt đầu Vocab Gym
              </Link>
              <Link href="/conversation" className="btn-outline py-3 text-sm">
                Luyện Nói Cùng AI
              </Link>
              <Link href="/listening" className="btn-outline py-3 text-sm">
                Luyện Listening
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
