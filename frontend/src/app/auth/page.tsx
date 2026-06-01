"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

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

  useEffect(() => {
    // Check if already logged in
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (userId) {
      // We don't have the role locally, so we check the URL intent or try to fetch user
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
    
    try {
      const endpoint = isLogin ? '/api/auth/signin' : '/api/auth/signup';
      const body = isLogin 
        ? { email, password }
        : { name, email, password, role };

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save user ID to simulate session
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
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="glass w-full max-w-md p-8 rounded-3xl">
        <h2 className="text-3xl font-bold text-center mb-2">
          {isLogin ? 'Đăng Nhập' : 'Đăng Ký'}
        </h2>
        <p className="text-center text-foreground/60 mb-8">
          Hệ thống luyện thi thông minh Lucy Tutor
        </p>

        {/* Role Toggle */}
        <div className="flex p-1 bg-foreground/5 rounded-xl mb-6">
          <button 
            type="button"
            onClick={() => setRole('STUDENT')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${role === 'STUDENT' ? 'bg-white shadow-sm text-primary' : 'text-foreground/60 hover:text-foreground'}`}
          >
            Học Sinh
          </button>
          <button 
            type="button"
            onClick={() => setRole('TEACHER')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors cursor-pointer ${role === 'TEACHER' ? 'bg-white shadow-sm text-primary' : 'text-foreground/60 hover:text-foreground'}`}
          >
            Giáo Viên
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm mb-6 font-medium text-center border border-red-500/20">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium mb-1">Họ và Tên</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary" placeholder="Nguyễn Văn A" />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary" placeholder="email@example.com" />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Mật khẩu</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary" placeholder="••••••••" />
          </div>

          {isLogin && role === 'STUDENT' && (
            <div className="pt-2">
              <label className="block text-sm font-medium mb-1 text-secondary">Mã Lớp Học (Class Code) - Tuỳ chọn</label>
              <input type="text" value={classCode} onChange={e => setClassCode(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-secondary/30 bg-secondary/5 focus:outline-none focus:border-secondary" placeholder="Nhập mã giáo viên cấp..." />
            </div>
          )}

          {isLogin && (
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
              <label htmlFor="rememberMe" className="text-sm text-foreground/80 cursor-pointer">Ghi nhớ đăng nhập trên thiết bị này</label>
            </div>
          )}

          <button type="submit" className="w-full py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors mt-6 cursor-pointer">
            {isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-foreground/60">
          {isLogin ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}
          <button onClick={() => setIsLogin(!isLogin)} className="ml-1 text-primary font-bold hover:underline cursor-pointer">
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthForm />
    </Suspense>
  );
}
