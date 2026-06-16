"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const FEATURE_BULLETS = [
  { icon: "🤖", text: "AI phân tích điểm yếu tức thì" },
  { icon: "📊", text: "Theo dõi tiến độ 4 kỹ năng IELTS" },
  { icon: "🔁", text: "SRS — nhớ từ vựng lâu hơn gấp 3x" },
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
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
        ? { email, password }
        : { name, email, password, role };

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

      if (role === 'TEACHER') {
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
    <div className="flex-1 flex min-h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-blue-50">

      {/* Left decorative panel — hidden on mobile */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary via-blue-700 to-secondary p-12 flex-col justify-between relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/8 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white/8 rounded-full blur-3xl" />
        </div>
        {/* Top brand */}
        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white font-black text-lg backdrop-blur">L</div>
            <span className="text-xl font-black text-white tracking-tight">LUCY<span className="text-white/60">TUTOR</span></span>
          </Link>
          <p className="text-white/60 text-sm">Nền tảng luyện thi Tiếng Anh thông minh</p>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold text-white leading-snug mb-3">
              Chinh phục Tiếng Anh<br />
              <span className="text-white/80">bằng AI thế hệ mới</span>
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-xs">
              Lộ trình cá nhân hóa, luyện 4 kỹ năng IELTS/TOEIC và phân tích điểm yếu ngay sau mỗi bài.
            </p>
          </div>
          <ul className="space-y-4">
            {FEATURE_BULLETS.map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/15 rounded-xl flex items-center justify-center text-lg shrink-0">{f.icon}</div>
                <span className="text-white/85 text-sm font-medium">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom stats */}
        <div className="relative z-10 grid grid-cols-3 gap-4">
          {[
            { v: "2,400+", l: "Học sinh" },
            { v: "94%", l: "Tăng điểm" },
            { v: "15K+", l: "Câu hỏi" },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 rounded-2xl p-3 text-center backdrop-blur">
              <div className="text-xl font-extrabold text-white">{s.v}</div>
              <div className="text-white/55 text-xs mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center text-white font-black text-sm">L</div>
            <span className="text-xl font-black text-foreground tracking-tight">LUCY<span className="text-slate-400">TUTOR</span></span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200 border border-gray-100 p-8">
            <h2 className="text-2xl font-extrabold text-center mb-1">
              {isLogin ? 'Chào mừng trở lại 👋' : 'Tạo tài khoản mới'}
            </h2>
            <p className="text-center text-slate-400 text-sm mb-7">
              {isLogin ? 'Đăng nhập để tiếp tục hành trình học của bạn' : 'Đăng ký miễn phí, không cần thẻ tín dụng'}
            </p>

            {/* Role Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`flex-1 py-2.5 text-sm font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1.5 ${role === 'STUDENT' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-foreground'}`}
              >
                🎓 Học Sinh
              </button>
              <button
                type="button"
                onClick={() => setRole('TEACHER')}
                className={`flex-1 py-2.5 text-sm font-bold transition-all rounded-xl cursor-pointer flex items-center justify-center gap-1.5 ${role === 'TEACHER' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-foreground'}`}
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

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-sm font-semibold mb-1.5 text-slate-700">Họ và Tên</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} required
                    className="w-full px-4 py-3 border border-gray-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
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
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
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
                    className="w-full pl-10 pr-11 py-3 border border-gray-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 rounded-xl transition-all"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-500 cursor-pointer">
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
                      className="w-full pl-10 pr-4 py-3 border border-secondary/20 bg-secondary/5 focus:bg-white focus:outline-none focus:border-secondary focus:ring-2 focus:ring-secondary/10 rounded-xl transition-all"
                      placeholder="Nhập mã giáo viên cấp..."
                    />
                  </div>
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
                className="w-full py-3.5 bg-gradient-to-r from-primary to-blue-700 text-white font-bold text-base hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all rounded-xl mt-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 flex items-center justify-center gap-2"
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

            <div className="mt-4 pt-4 border-t border-gray-100 text-center">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-500 transition-colors">
                ← Về trang chủ
              </Link>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-4 mt-6 text-xs text-slate-400">
            <span className="flex items-center gap-1">🔒 Bảo mật SSL</span>
            <span>·</span>
            <span className="flex items-center gap-1">✅ Miễn phí 100%</span>
            <span>·</span>
            <span className="flex items-center gap-1">🇻🇳 Dành cho VN</span>
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
