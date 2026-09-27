"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

const FEATURE_BULLETS = [
  { text: "AI phân tích điểm yếu tức thì" },
  { text: "Theo dõi tiến độ 4 kỹ năng IELTS" },
  { text: "Luyện phát âm cùng AI, có góp ý sửa lỗi" },
  { text: "Đề thi thử THPT Quốc Gia do AI tự sinh" },
  { text: "SRS — tự thêm từ vựng, nhớ lâu hơn" },
  { text: "Gamification & bảng xếp hạng lớp" },
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
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me?userId=${userId}`)
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
        : { name, email, password, role: 'STUDENT', classCode: signupClassCode || undefined, managerTeacherId: signupClassCode ? undefined : (managerTeacherId || undefined) };

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
    <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-64px)] bg-background px-4 py-10 lg:py-14">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 bg-white rounded-2xl shadow-card border border-line overflow-hidden">

      {/* Side panel with illustration — desktop only */}
      <div className="hidden lg:flex flex-col justify-between bg-primary-soft p-10 xl:p-12">
        <div>
          <p className="text-[11px] font-bold tracking-[0.1em] uppercase text-primary/70 mb-3">
            Nền tảng luyện thi Tiếng Anh thông minh
          </p>
          <p className="text-[1.9rem] xl:text-[2.2rem] font-extrabold text-primary leading-[1.2] mb-3 tracking-tight">
            Chinh phục Tiếng Anh bằng AI thế hệ mới
          </p>
          <p className="text-muted text-[15px] leading-relaxed">
            Lộ trình cá nhân hóa, luyện 4 kỹ năng IELTS/TOEIC và phân tích điểm yếu ngay sau mỗi bài.
          </p>
        </div>

        <img
          src="/images/illustrations/auth-learning.svg"
          alt="Học viên bắt đầu hành trình học Tiếng Anh cùng Lucy Tutor"
          width={800}
          height={600}
          loading="eager"
          className="w-full h-auto my-6"
        />

        <div>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2.5 mb-5">
            {FEATURE_BULLETS.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px] leading-snug font-semibold text-foreground">
                <span aria-hidden="true" className="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-primary" />
                {f.text}
              </li>
            ))}
          </ul>

          {/* Trial callout — an honest, concrete offer instead of vanity metrics */}
          <p className="bg-white border border-line rounded-xl px-4 py-3 text-sm text-muted leading-snug">
            Học tự do được <span className="font-bold text-primary">dùng thử miễn phí 3 ngày</span> — không cần thẻ tín dụng.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center justify-center gap-2 mb-6">
            <img src="/logo.png" alt="Lucy Tutor" width={36} height={36} className="w-9 h-9 object-contain" />
            <span className="text-xl font-black text-primary tracking-tight">LUCY<span className="text-muted">TUTOR</span></span>
          </div>

          {/* Card */}
          <div>
            <h1 className="text-[24px] font-extrabold text-primary text-center leading-tight mb-1.5 tracking-tight">
              {isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản mới'}
            </h1>
            <p className="text-center text-muted text-[13.5px] mb-6">
              {isLogin ? 'Đăng nhập để tiếp tục hành trình học của bạn' : 'Đăng ký miễn phí, không cần thẻ tín dụng'}
            </p>

            {/* Role Toggle — login only; signup is student-only (teacher accounts are provisioned, not self-registered) */}
            {isLogin && (
            <div className="grid grid-cols-2 gap-2 mb-5">
              <button
                type="button"
                onClick={() => setRole('STUDENT')}
                className={`ui-chip justify-center py-2.5 cursor-pointer ${role === 'STUDENT' ? 'ui-chip-active' : ''}`}
              >
                Học Viên
              </button>
              <button
                type="button"
                onClick={() => setRole('TEACHER')}
                className={`ui-chip justify-center py-2.5 cursor-pointer ${role === 'TEACHER' ? 'ui-chip-active' : ''}`}
              >
                Giáo Viên
              </button>
            </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-700 p-3 text-sm mb-5 font-medium text-center rounded-lg border border-red-100 flex items-center gap-2 justify-center">
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="ui-label">Họ và Tên</label>
                  <input
                    type="text" value={name} onChange={e => setName(e.target.value)} required
                    className="ui-input"
                    placeholder="Nguyễn Văn A"
                  />
                </div>
              )}

              <div>
                <label className="ui-label">Email</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="ui-input pl-10"
                    placeholder="email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="ui-label">Mật khẩu</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                  <input
                    type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                    className="ui-input pl-10 pr-11"
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-1 top-1/2 -translate-y-1/2 p-2.5 rounded-lg text-muted hover:text-primary hover:bg-primary-soft cursor-pointer">
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
                  <label className="ui-label">Mã Lớp Học — Tuỳ chọn</label>
                  <div className="relative">
                    <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
                    </svg>
                    <input
                      type="text" value={classCode} onChange={e => setClassCode(e.target.value)}
                      className="ui-input pl-10"
                      placeholder="Nhập mã giáo viên cấp..."
                    />
                  </div>
                </div>
              )}

              {!isLogin && role === 'STUDENT' && (
                <div>
                  <label className="ui-label">Mã Lớp Học — Tuỳ chọn (nếu giáo viên đã cấp mã)</label>
                  <input
                    type="text" value={signupClassCode} onChange={e => setSignupClassCode(e.target.value)}
                    className="ui-input"
                    placeholder="Bỏ trống nếu bạn học tự do, chưa có lớp"
                  />
                  {!signupClassCode.trim() && (
                    <div className="mt-3">
                      <label className="ui-label">Chọn Giáo Viên Phụ Trách</label>
                      <select
                        value={managerTeacherId} onChange={e => setManagerTeacherId(e.target.value)} required
                        className="ui-input"
                      >
                        <option value="">-- Chọn giáo viên --</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <p className="text-xs text-muted mt-1.5">Học tự do được dùng thử miễn phí 3 ngày. Giáo viên phụ trách sẽ kích hoạt lại mỗi tháng sau khi bạn đóng học phí.</p>
                    </div>
                  )}
                </div>
              )}

              {isLogin && (
                <div className="flex items-center gap-2.5">
                  <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-line-strong text-primary focus:ring-primary cursor-pointer accent-primary" />
                  <label htmlFor="rememberMe" className="text-sm text-muted cursor-pointer select-none">Ghi nhớ đăng nhập trên thiết bị này</label>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="btn-primary w-full py-3 text-base mt-2 cursor-pointer"
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

            {isLogin && role === 'TEACHER' ? (
              <p className="text-center mt-5 text-sm text-muted">
                Tài khoản Giáo Viên do quản trị viên cấp — không tự đăng ký.
              </p>
            ) : (
              <p className="text-center mt-5 text-sm text-muted">
                {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
                <button onClick={() => { if (isLogin) setRole('STUDENT'); setIsLogin(!isLogin); }} className="ml-1.5 text-primary font-bold hover:underline cursor-pointer">
                  {isLogin ? 'Đăng ký ngay →' : '← Đăng nhập'}
                </button>
              </p>
            )}

            <div className="mt-4 pt-4 border-t border-line text-center">
              <Link href="/" className="text-xs text-muted hover:text-primary transition-colors">
                ← Về trang chủ
              </Link>
            </div>
          </div>

          {/* Trust badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {[
              { label: "Bảo mật SSL" },
              { label: "Miễn phí 100%" },
              { label: "Dành cho VN" },
            ].map((b, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted bg-background border border-line rounded-full px-3 py-1.5">
                {b.label}
              </span>
            ))}
          </div>
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
