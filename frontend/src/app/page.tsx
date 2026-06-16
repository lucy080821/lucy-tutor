"use client";
import Link from "next/link";
import { useState } from "react";

const STATS = [
  { value: "2,400+", label: "Học sinh đang học", icon: "🎓" },
  { value: "180+", label: "Giáo viên tin dùng", icon: "👨‍🏫" },
  { value: "15,000+", label: "Câu hỏi ngân hàng", icon: "📚" },
  { value: "94%", label: "Học sinh tăng điểm", icon: "📈" },
];

const SKILLS = [
  {
    key: "reading",
    emoji: "📖",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    title: "Reading",
    desc: "Luyện đọc hiểu với passage thực tế từ IELTS, TOEIC và đề thi THPT. AI phân tích điểm yếu theo từng dạng câu hỏi.",
    color: "text-blue-600",
    bg: "bg-blue-50",
    activeBg: "bg-blue-600",
    border: "border-blue-200",
    gradient: "from-blue-500 to-blue-700",
    lightGrad: "from-blue-50 to-blue-100",
  },
  {
    key: "listening",
    emoji: "🎧",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
      </svg>
    ),
    title: "Listening",
    desc: "Bài nghe theo chuẩn IELTS/TOEIC với audio chất lượng cao. Luyện tập nhiều lần, track kết quả theo từng phần.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    activeBg: "bg-emerald-600",
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-emerald-700",
    lightGrad: "from-emerald-50 to-emerald-100",
  },
  {
    key: "speaking",
    emoji: "🎤",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    ),
    title: "Speaking",
    desc: "Luyện nói với AI phân tích phát âm, fluency và coherence theo tiêu chí IELTS. Ghi âm và nhận phản hồi tức thì.",
    color: "text-purple-600",
    bg: "bg-purple-50",
    activeBg: "bg-purple-600",
    border: "border-purple-200",
    gradient: "from-purple-500 to-purple-700",
    lightGrad: "from-purple-50 to-purple-100",
  },
  {
    key: "writing",
    emoji: "✍️",
    icon: (
      <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
    title: "Writing",
    desc: "Luyện viết Task 1 và Task 2 IELTS. AI chấm điểm theo 4 tiêu chí: Task Achievement, Coherence, Lexical Resource, Grammar.",
    color: "text-orange-600",
    bg: "bg-orange-50",
    activeBg: "bg-orange-600",
    border: "border-orange-200",
    gradient: "from-orange-500 to-orange-700",
    lightGrad: "from-orange-50 to-orange-100",
  },
];

const STEPS = [
  {
    num: "01",
    icon: "🎯",
    title: "Làm bài kiểm tra đầu vào",
    desc: "Hệ thống đánh giá trình độ hiện tại của bạn qua bài placement test 20 phút, trả về band score và profiling điểm yếu.",
    color: "from-blue-500 to-indigo-600",
  },
  {
    num: "02",
    icon: "🗺️",
    title: "Nhận lộ trình cá nhân hóa",
    desc: "AI xây dựng study plan theo mục tiêu của bạn (IELTS 6.5, TOEIC 750…), lịch học phù hợp và bộ bài luyện tập hàng ngày.",
    color: "from-purple-500 to-pink-600",
  },
  {
    num: "03",
    icon: "📊",
    title: "Học & theo dõi tiến độ",
    desc: "Luyện tập theo SRS (spaced repetition), tham gia lớp học của giáo viên, xem báo cáo tiến độ theo từng kỹ năng.",
    color: "from-emerald-500 to-teal-600",
  },
];

const FEATURES = [
  { icon: "🤖", title: "AI Phân Tích Điểm Yếu", desc: "Tự động nhận diện lỗi sai theo từng chủ điểm ngữ pháp, từ vựng, gợi ý bài luyện tập phù hợp.", color: "bg-violet-100 text-violet-600" },
  { icon: "🗂️", title: "Ngân Hàng Câu Hỏi 15K+", desc: "Đề thi THPT, IELTS, TOEIC được phân loại theo chuẩn Cambridge. Giáo viên import từ Word/PDF chỉ 1 click.", color: "bg-blue-100 text-blue-600" },
  { icon: "📈", title: "Biểu Đồ Tiến Độ 4 Kỹ Năng", desc: "Dashboard riêng cho từng kỹ năng Reading, Listening, Speaking, Writing với IELTS band tracker.", color: "bg-emerald-100 text-emerald-600" },
  { icon: "🔁", title: "SRS Vocabulary", desc: "Thuật toán SM-2 lên lịch ôn từ vựng khoa học — nhớ lâu hơn với ít thời gian học hơn.", color: "bg-amber-100 text-amber-600" },
  { icon: "🏆", title: "Gamification & Streak", desc: "Tích XP, giữ streak học mỗi ngày, leo bảng xếp hạng lớp học — tạo động lực học tập bền vững.", color: "bg-rose-100 text-rose-600" },
  { icon: "👨‍🏫", title: "Dashboard Giáo Viên Pro", desc: "Quản lý lớp học, điểm danh, học phí, giao đề thi — tất cả trên một nền tảng, không cần bảng tính Excel.", color: "bg-cyan-100 text-cyan-600" },
];

const TESTIMONIALS = [
  {
    name: "Nguyễn Minh Tú",
    role: "Học sinh lớp 12 — THPT Nguyễn Thị Minh Khai",
    text: "Sau 3 tháng luyện với Lucy Tutor, điểm Reading IELTS của mình tăng từ 5.5 lên 7.0. Phần AI giải thích lỗi sai rất chi tiết, mình hiểu tại sao sai chứ không chỉ biết đáp án đúng.",
    score: "IELTS 7.0",
    avatar: "MT",
    avatarColor: "from-blue-400 to-blue-600",
  },
  {
    name: "Trần Thị Lan Anh",
    role: "Giáo viên Tiếng Anh — 8 năm kinh nghiệm",
    text: "Tính năng import đề từ Word giúp tôi tiết kiệm 3-4 tiếng mỗi tuần. Phụ huynh cũng rất hài lòng vì có thể xem báo cáo tiến độ con trực tiếp trên app.",
    score: "Giáo viên",
    avatar: "LA",
    avatarColor: "from-purple-400 to-purple-600",
  },
  {
    name: "Lê Hoàng Nam",
    role: "Sinh viên năm 1 — Đại học Ngoại Thương",
    text: "Mình ôn TOEIC 650+ chỉ trong 6 tuần nhờ study plan của Lucy Tutor. Bộ từ vựng SRS đặc biệt hiệu quả — ôn đúng từ mình hay quên vào đúng thời điểm.",
    score: "TOEIC 710",
    avatar: "HN",
    avatarColor: "from-emerald-400 to-emerald-600",
  },
];

export default function Home() {
  const [activeSkill, setActiveSkill] = useState("reading");
  const activeSkillData = SKILLS.find((s) => s.key === activeSkill)!;

  return (
    <div className="flex-1 flex flex-col bg-white">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden py-24 md:py-32 px-6">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-secondary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-gradient-to-tr from-blue-100/60 to-purple-100/60 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-7">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-primary text-sm font-semibold tracking-wide border border-blue-200 rounded-full">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            NỀN TẢNG LUYỆN THI TIẾNG ANH #1 VIỆT NAM
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight">
            Chinh phục Tiếng Anh<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-secondary">
              bằng AI thế hệ mới
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Lộ trình học cá nhân hóa · Luyện 4 kỹ năng Reading, Listening, Speaking, Writing · AI phân tích điểm yếu tức thì · Giáo viên quản lý lớp không cần Excel.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/auth?role=STUDENT"
              className="group px-8 py-4 bg-gradient-to-r from-primary to-blue-700 text-white font-bold text-lg hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all rounded-xl flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
              </svg>
              Bắt đầu miễn phí
              <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/auth?role=TEACHER"
              className="px-8 py-4 bg-white font-bold text-lg text-primary hover:bg-primary/5 hover:-translate-y-0.5 transition-all rounded-xl border-2 border-primary/25 flex items-center justify-center gap-2 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              Tôi là Giáo Viên
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-3xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="bg-white rounded-2xl px-5 py-5 text-center shadow-md shadow-slate-200 border border-gray-100 hover:-translate-y-0.5 transition-transform">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-2xl md:text-3xl font-extrabold text-primary">{s.value}</div>
              <div className="text-xs text-slate-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4 Skills ── */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary text-xs font-bold tracking-widest uppercase rounded-full border border-blue-200">
              Luyện tập toàn diện
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold">4 Kỹ Năng — Một Nền Tảng</h2>
            <p className="text-slate-400 max-w-xl mx-auto">Mỗi kỹ năng được track độc lập với lộ trình, bài tập và báo cáo riêng biệt.</p>
          </div>

          {/* Skill tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {SKILLS.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSkill(s.key)}
                className={`flex items-center gap-2 px-5 py-2.5 font-semibold text-sm rounded-full border-2 transition-all ${
                  activeSkill === s.key
                    ? `bg-gradient-to-r ${s.gradient} text-white border-transparent shadow-md`
                    : "bg-white text-slate-500 border-gray-200 hover:border-gray-300 hover:bg-slate-50"
                }`}
              >
                <span>{s.emoji}</span>
                {s.title}
              </button>
            ))}
          </div>

          {/* Active skill card */}
          <div className={`flex flex-col md:flex-row items-start gap-8 p-8 rounded-2xl border-2 ${activeSkillData.border} bg-gradient-to-br ${activeSkillData.lightGrad} shadow-sm`}>
            <div className={`${activeSkillData.color} shrink-0 p-4 bg-white rounded-2xl shadow-md border ${activeSkillData.border}`}>
              {activeSkillData.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{activeSkillData.emoji}</span>
                <h3 className={`text-2xl font-bold ${activeSkillData.color}`}>{activeSkillData.title}</h3>
              </div>
              <p className="text-slate-600 leading-relaxed text-lg mb-5">{activeSkillData.desc}</p>
              <Link href="/auth?role=STUDENT" className={`inline-flex items-center gap-2 px-6 py-2.5 font-semibold text-sm text-white bg-gradient-to-r ${activeSkillData.gradient} rounded-xl hover:shadow-md hover:-translate-y-0.5 transition-all`}>
                Bắt đầu luyện {activeSkillData.title}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14 space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary text-xs font-bold tracking-widest uppercase rounded-full border border-blue-200">
              Quy trình
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold">Bắt đầu chỉ trong 3 bước</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="relative group">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[calc(100%-0px)] w-full h-0.5 bg-gradient-to-r from-primary/25 to-transparent z-10 pointer-events-none" />
                )}
                <div className="p-7 h-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center text-2xl mb-4 shadow-sm`}>
                    {step.icon}
                  </div>
                  <span className="text-4xl font-black text-gray-200 leading-none block mb-2">{step.num}</span>
                  <h3 className="text-lg font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ── */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary text-xs font-bold tracking-widest uppercase rounded-full border border-blue-200">
              Tính năng nổi bật
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold">Mọi thứ bạn cần để bứt phá</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="group bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-default">
                <div className={`w-12 h-12 rounded-xl ${f.color} flex items-center justify-center text-2xl mb-4`}>{f.icon}</div>
                <h3 className="font-bold mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 space-y-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 text-primary text-xs font-bold tracking-widest uppercase rounded-full border border-blue-200">
              Học sinh & giáo viên nói gì
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold">Kết quả thực tế</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col gap-4">
                {/* Stars */}
                <div className="flex items-center gap-1">
                  {[1,2,3,4,5].map(n => (
                    <svg key={n} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                {/* Quote */}
                <p className="text-slate-500 text-sm leading-relaxed flex-1">"{t.text}"</p>
                {/* Author */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                      {t.avatar}
                    </div>
                    <div>
                      <div className="font-bold text-sm">{t.name}</div>
                      <div className="text-slate-400 text-xs">{t.role}</div>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-50 text-primary text-xs font-bold rounded-full border border-blue-200 shrink-0">
                    {t.score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="py-20 px-6 bg-gradient-to-br from-primary via-blue-700 to-secondary text-white relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-extrabold">Bắt đầu học miễn phí ngay hôm nay</h2>
          <p className="text-white/70 text-lg">Không cần thẻ tín dụng. Không giới hạn thời gian dùng thử.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth?role=STUDENT" className="px-8 py-4 bg-white text-primary font-bold text-lg hover:bg-white/95 hover:-translate-y-0.5 transition-all rounded-xl shadow-lg shadow-black/20 flex items-center justify-center gap-2">
              🎓 Học sinh đăng ký
            </Link>
            <Link href="/auth?role=TEACHER" className="px-8 py-4 bg-white/10 backdrop-blur text-white font-bold text-lg hover:bg-white/20 hover:-translate-y-0.5 transition-all rounded-xl border border-white/30 flex items-center justify-center gap-2">
              👨‍🏫 Giáo viên đăng ký
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-950 text-white/60 py-12 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-white/8">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-black text-sm">L</div>
                <span className="text-lg font-black text-white">LUCY<span className="text-white/50">TUTOR</span></span>
              </div>
              <p className="text-sm text-white/40 leading-relaxed">
                Nền tảng luyện thi Tiếng Anh thông minh dành cho học sinh và giáo viên Việt Nam.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Học sinh</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth?role=STUDENT" className="hover:text-white transition-colors">Đăng ký miễn phí</Link></li>
                <li><Link href="/exam" className="hover:text-white transition-colors">Demo bài thi</Link></li>
                <li><Link href="/grammar-gym" className="hover:text-white transition-colors">Luyện ngữ pháp</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-3 text-sm">Giáo viên</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/auth?role=TEACHER" className="hover:text-white transition-colors">Mở lớp học</Link></li>
                <li><span className="text-white/35 cursor-default">Hỗ trợ: lucy@lucytutor.vn</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-white/30">
            <span>© 2026 Lucy Tutor. Đã đăng ký bản quyền.</span>
            <span>Hệ thống luyện thi Tiếng Anh thông minh · Powered by AI</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
