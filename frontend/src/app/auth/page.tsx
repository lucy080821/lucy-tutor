"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const FEATURE_BULLETS = [
  { icon: "🤖", text: "AI phân tích điểm yếu tức thì" },
  { icon: "📊", text: "Theo dõi tiến độ 4 kỹ năng IELTS" },
  { icon: "🗣️", text: "Luyện phát âm cùng AI, có góp ý sửa lỗi" },
  { icon: "🏁", text: "Đề thi thử THPT Quốc Gia do AI tự sinh" },
  { icon: "🔁", text: "SRS — tự thêm từ vựng, nhớ lâu hơn" },
  { icon: "🏆", text: "Gamification & bảng xếp hạng lớp" },
];

function AuthForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') || 'STUDENT';

  const [role, setRole] = useState(initialRole);
  const [isLogin, setIsLogin] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classCode, setClassCode] = useState('');
  const [signupClassCode, setSignupClassCode] = useState('');
  const [managerTeacherId, setManagerTeacherId] = useState('');
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Only needed for the "free-standing student" signup picker below — cheap enough to fetch upfront.
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/teachers`)
      .then(res => res.ok ? res.json() : [])
      .then(setTeachers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (userId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/users/profile/${userId}`)
        .then(res => {
          if (res.ok) return res.json();
          throw new Error('Invalid session');
        })
        .then(data => {
          if (data.role === 'TEACHER') {
            window.location.href = '/teacher';
          } else {
            window.location.href = '/dashboard';
          }
        })
        .catch(() => {
          localStorage.removeItem('userId');
          sessionStorage.removeItem('userId');
        });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const endpoint = isLogin ? '/api/auth/signin' : '/api/auth/signup';
      const body = isLogin
        ? { email, password, role }
        : { name, email, password, role, classCode: signupClassCode || undefined, managerTeacherId: signupClassCode ? undefined : (managerTeacherId || undefined) };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (rememberMe) {
        localStorage.setItem('userId', data.id);
      } else {
        sessionStorage.setItem('userId', data.id);
      }

      // Redirect based on the account's actual stored role (server response), not the locally
      // selected toggle — keeps this consistent with the session-restore effect above.
      if (data.role === 'TEACHER') {
        window.location.href = '/teacher';
      } else {
        window.location.href = '/dashboard';
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex min-h-[calc(100vh-64px)] bg-background">

      {/* Left brand panel — hidden on mobile */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-gradient-to-br from-primary via-primary to-secondary">
        {/* Subtle dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        {/* Soft glow orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-28 -right-20 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-32 -left-20 w-96 h-96 bg-secondary/30 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center h-full p-8 xl:p-14 w-full">
          <div className="max-w-md">
            {/* Eyebrow badge */}
            <span className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.1em] uppercase text-white/80 bg-white/10 border border-white/15 rounded-full px-3.5 py-1.5 mb-6 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Nền tảng luyện thi Tiếng Anh thông minh
            </span>

            <h1 className="text-[2.1rem] xl:text-[2.6rem] font-extrabold text-white leading-[1.15] mb-4 tracking-tight">
              Chinh phục Tiếng Anh<br />bằng AI thế hệ mới
            </h1>
            <p className="text-white/70 text-[15px] leading-relaxed mb-8 max-w-sm">
              Lộ trình cá nhân hóa, luyện 4 kỹ năng IELTS/TOEIC và phân tích điểm yếu ngay sau mỗi bài.
            </p>

            <ul className="grid grid-cols-2 gap-x-5 gap-y-4 border-y border-white/10 py-5 mb-8">
              {FEATURE_BULLETS.map((f, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 shrink-0 bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-sm">{f.icon}</div>
                  <span className="text-white/90 text-[12.5px] leading-snug font-semibold">{f.text}</span>
                </li>
              ))}
            </ul>

            {/* Trial callout — an honest, concrete offer instead of vanity metrics */}
            <div className="flex items-start gap-3.5 bg-white/10 border border-white/15 rounded-2xl p-4 backdrop-blur-sm">
              <span className="text-xl shrink-0 w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">🎁</span>
              <p className="text-white/85 text-sm leading-snug pt-1.5">
                Học tự do được <span className="font-bold text-white">dùng thử miễn phí 3 ngày</span> — không cần thẻ tín dụng.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 py-10 lg:p-12">
        <div className="w-full max-w-[420px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 bg-primary rounded-xl flex items-center justify-center text-white font-black text-sm">L</div>
            <span className="text-xl font-black text-foreground tracking-tight">LUCY<span className="text-slate-400">TUTOR</span></span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_-15px_rgba(15,23,42,0.18)] border border-slate-100 p-7 sm:p-8">
            <h2 className="text-[24px] font-extrabold text-center leading-tight mb-1.5 tracking-tight">
              {isLogin ? 'Chào mừng trở lại 👋' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-center text-slate-400 text-[13.5px] mb-5">
              {isLogin ? 'Đăng nhập để tiếp tục hành trình học của bạn' : 'Đăng ký miễn phí, không cần thẻ tín dụng'}
            </p>

            {/* Role Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-2xl mb-5">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`py-2 text-sm font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1.5 ${role === 'STUDENT' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
              >
                🎓 Học Viên
              </button>
              <button
                type="button"
                onClick={() => setRole('TEACHER')}
                className={`py-2 text-sm font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1.5 ${role === 'TEACHER' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
              >
                👨‍🏫 Giáo Viên
              </button>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 p-3 text-sm mb-5 font-medium text-center rounded-xl border border-red-100 flex items-center gap-2 justify-center">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Họ và Tên</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} required
                    className="w-full px-4 py-2.5 border border-slate-200 bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Email</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700">Mật khẩu</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full pl-10 pr-11 py-2.5 border border-slate-200 bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 cursor-pointer">
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {isLogin && role === 'STUDENT' && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-secondary/80">Mã Lớp Học — Tuỳ chọn</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary/40" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                    </svg>
                    <input
                      type="text" value={classCode} onChange={e => setClassCode(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-secondary/20 bg-secondary/5 focus:bg-white focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 rounded-xl transition-all"
                      placeholder="Nhập mã giáo viên cấp..."
                    />
                  </div>
                </div>
              )}

              {!isLogin && role === 'STUDENT' && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-secondary/80">Mã Lớp Học — Tuỳ chọn (nếu giáo viên đã cấp mã)</label>
                  <input
                    type="text" value={signupClassCode} onChange={e => setSignupClassCode(e.target.value)}
                    className="w-full px-4 py-2.5 border border-secondary/20 bg-secondary/5 focus:bg-white focus:outline-none focus:border-secondary focus:ring-4 focus:ring-secondary/10 rounded-xl transition-all"
                    placeholder="Bỏ trống nếu bạn học tự do, chưa có lớp"
                  />
                  {!signupClassCode.trim() && (
                    <div className="mt-3">
                      <label className="block text-sm font-semibold mb-1.5 text-slate-700">Chọn Giáo Viên Phụ Trách</label>
                      <select
                        value={managerTeacherId} onChange={e => setManagerTeacherId(e.target.value)} required
                        className="w-full px-4 py-2.5 border border-slate-200 bg-white focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 rounded-xl transition-all"
                      >
                        <option value="">-- Chọn giáo viên --</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <p className="text-xs text-slate-400 mt-1.5">Học tự do được dùng thử miễn phí 3 ngày. Giáo viên phụ trách sẽ kích hoạt lại mỗi tháng sau khi bạn đóng học phí.</p>
                    </div>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-200 text-primary focus:ring-primary cursor-pointer accent-primary" />
                  <label htmlFor="rememberMe" className="text-sm text-slate-500 cursor-pointer select-none">Ghi nhớ đăng nhập trên thiết bị này</label>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 bg-primary hover:bg-[#152c69] text-white font-bold text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all rounded-xl mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang xử lý...
                  </>
                ) : (
                  isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'
                )}
              </button>
            </form>

            <p className="text-center mt-5 text-sm text-slate-400">
              {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
              <button onClick={() => setIsLogin(!isLogin)} className="ml-1.5 text-primary font-bold hover:underline cursor-pointer">
                {isLogin ? 'Đăng ký ngay →' : '← Đăng nhập'}
              </button>
            </p>

            <div className="mt-3.5 pt-3.5 border-t border-slate-100 text-center">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                ← Về trang chủ
              </Link>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {[
              { icon: "🔒", label: "Bảo mật SSL" },
              { icon: "✅", label: "Miễn phí 100%" },
              { icon: "🇻🇳", label: "Dành cho VN" },
            ].map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-white border border-slate-200 rounded-full px-3 py-1.5 shadow-sm">
                <span>{b.icon}</span>{b.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
