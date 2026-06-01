"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import CalendarComponent from "@/components/calendar/CalendarComponent";
import Swal from 'sweetalert2';
import confetti from "canvas-confetti";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [user, setUser] = useState<any>(null);
  const [joinCode, setJoinCode] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);

  useEffect(() => {
    if (user?.classroomsJoined?.length > 0) {
      Promise.all(user.classroomsJoined.map((c: any) => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/classroom/${c.id}`).then(res => res.json())
      )).then(results => {
        const allLessons = results.flat();
        setLessons(allLessons);
      }).catch(console.error);
    }
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 100 * 1024 * 1024) return Swal.fire('Lỗi', 'Ảnh quá lớn. Vui lòng chọn ảnh dưới 100MB', 'error');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/auth/avatar/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64 })
        });
        if (res.ok) {
          const updatedUser = await res.json();
          setUser(updatedUser);
        } else {
          Swal.fire('Lỗi', 'Lỗi tải ảnh', 'error');
        }
      } catch (err) {
        console.error('Lỗi tải ảnh:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleJoinClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || !user?.id) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/classroom/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, joinCode })
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ ...user, classroomsJoined: [...(user.classroomsJoined || []), data.classroom] });
        Swal.fire('Thành công', 'Đã tham gia lớp học thành công!', 'success');
        setJoinCode("");
      } else {
        Swal.fire('Lỗi', data.error || 'Lỗi khi tham gia lớp', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Lỗi kết nối', 'error');
    }
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const url = userId ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me?userId=${userId}` : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`;
    
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        if (data?.id) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/analytics/history/${data.id}`)
            .then(res => res.json())
            .then(hist => setHistory(hist || []))
            .catch(console.error);
            
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/gamification/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: data.id })
          })
            .then(res => res.json())
            .then(checkinData => {
              if (checkinData.checkedIn) {
                setUser(checkinData.user);
                if (checkinData.bonusXP > 0) {
                  confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
                  Swal.fire({
                    title: 'Đỉnh quá! 🎉',
                    html: `Bạn đã học liên tục <b>${checkinData.user.streakCount} ngày</b>!<br/>Được thưởng nóng <b>+${checkinData.xpAdded} XP</b> (gồm ${checkinData.bonusXP} XP thưởng chuỗi).`,
                    icon: 'success',
                    confirmButtonText: 'Tuyệt vời!'
                  });
                } else {
                  Swal.fire({
                    title: 'Điểm danh ngày mới! ☀️',
                    html: `Bạn nhận được <b>+10 XP</b>. Đang giữ chuỗi: <b>${checkinData.user.streakCount} ngày</b>!`,
                    icon: 'info',
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    timer: 3000
                  });
                }
              }
            })
            .catch(console.error);
        }
      })
      .catch(err => console.error(err));
  }, []);

  useEffect(() => {
    if (!user) return;
    const currentXP = user.totalXP || 0;
    const storedXP = localStorage.getItem('lucy_previous_xp');
    
    if (storedXP !== null) {
      const prevXP = parseInt(storedXP, 10);
      if (currentXP > prevXP) {
        const prevLevel = Math.floor((1 + Math.sqrt(1 + 4 * prevXP / 50)) / 2);
        const currentLevel = Math.floor((1 + Math.sqrt(1 + 4 * currentXP / 50)) / 2);
        
        if (currentLevel > prevLevel) {
          const getRankLabel = (lvl: number) => {
            if (lvl >= 20) return '💎 Huyền Thoại';
            if (lvl >= 15) return '🥇 Bậc Thầy';
            if (lvl >= 10) return '🥈 Tinh Anh';
            if (lvl >= 5) return '📖 Học Giả';
            return '🌱 Tân Binh';
          };
          const prevRank = getRankLabel(prevLevel);
          const currentRank = getRankLabel(currentLevel);
          
          if (prevRank !== currentRank) {
            // Rank up celebration
            confetti({ particleCount: 200, spread: 160, origin: { y: 0.6 } });
            setTimeout(() => {
              Swal.fire({
                title: 'THĂNG HẠNG THÀNH CÔNG!',
                html: `Sự kiên trì của bạn đã được đền đáp!<br/><br/>Chúc mừng bạn đã chính thức đạt danh hiệu <br/><b style="font-size:1.5em; color:#eab308;">${currentRank}</b>!`,
                icon: 'success',
                confirmButtonText: 'Tuyệt vời!'
              });
            }, 500);
          } else {
            // Level up celebration
            confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
            Swal.fire({
              title: 'Lên Cấp!',
              text: `Tuyệt vời! Bạn vừa đạt Cấp ${currentLevel}!`,
              icon: 'success',
              toast: true,
              position: 'top-end',
              showConfirmButton: false,
              timer: 3000,
              timerProgressBar: true
            });
          }
        }
      }
    }
    localStorage.setItem('lucy_previous_xp', currentXP.toString());
  }, [user?.totalXP]);

  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    'LEARNING': true,
  });

  const toggleNavGroup = (id: string) => {
    setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navGroups = [
    { id: "OVERVIEW", label: "Tổng Quan" },
    { 
      id: "LEARNING", label: "Học Tập", 
      subItems: [
        { id: "LESSONS", label: "Bài Học" },
        { id: "PRACTICE", label: "Bài Tập" },
        { id: "EXAMS", label: "Bài Kiểm Tra" },
        { id: "ATTENDANCE", label: "Chuyên Cần" },
        { id: "DOCUMENTS", label: "Tài Liệu" },
      ]
    },
    { 
      id: "TRAINING_CENTER", label: "Trại Huấn Luyện", 
      subItems: [
        { id: "GYM_LINK", label: "Phòng Gym từ vựng", isLink: true, href: '/gym' },
        { id: "GRAMMAR_GYM_LINK", label: "Phòng Gym ngữ pháp", isLink: true, href: '/grammar-gym' },
      ]
    },
    { id: "CALENDAR", label: "Thời Khóa Biểu" },
    { id: "NOTEBOOK", label: "Sổ Tay Lỗi Sai" },
    { id: "SETTINGS", label: "Cài Đặt" },
  ];

  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [chartViewMode, setChartViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [selectedNotebookForView, setSelectedNotebookForView] = useState<any>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ── ATTENDANCE & TUITION state ──
  const [attMonth, setAttMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [attReports, setAttReports] = useState<any[]>([]); // Array of reports for each joined classroom

  useEffect(() => {
    if (activeTab === "ATTENDANCE" && user?.id && user?.classroomsJoined?.length > 0) {
      const [year, month] = attMonth.split("-");
      Promise.all(user.classroomsJoined.map((c: any) =>
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/report/${c.id}?month=${month}&year=${year}`)
          .then(res => res.json())
          .then(data => {
            const myReport = data.report?.find((r: any) => r.user?.id === user.id);
            return {
              classroomId: c.id,
              classroomName: c.name,
              ...myReport
            };
          })
      )).then(reports => {
        setAttReports(reports.filter(r => r && r.user?.id)); // only valid reports
      }).catch(console.error);
    }
  }, [activeTab, attMonth, user]);

  // ── DOCUMENTS state ──
  const [documents, setDocuments] = useState<any[]>([]);
  const [searchDocQuery, setSearchDocQuery] = useState("");
  useEffect(() => {
    if (activeTab === "DOCUMENTS" && user) {
      const classroomIds = user.classroomsJoined?.map((c: any) => c.id) || [];
      const fetchPromises = classroomIds.map((id: string) => 
        fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents?classroomId=${id}`).then(r => r.json())
      );
      if (classroomIds.length === 0) {
        fetchPromises.push(fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents`).then(r => r.json()));
      }
      Promise.all(fetchPromises)
        .then(results => {
          const allDocs = results.flat();
          const uniqueDocs = Array.from(new Map(allDocs.map((d: any) => [d.id, d])).values());
          setDocuments(uniqueDocs.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        })
        .catch(console.error);
    }
  }, [activeTab, user]);

  const totalExams = history.length;
  const avgScore = totalExams > 0 ? (history.reduce((acc, curr) => acc + curr.score, 0) / totalExams).toFixed(1) : "0.0";
  const totalXP = user?.totalXP || 0;
  const percentToTarget = user?.targetScore > 0 ? Math.min(100, Math.round((parseFloat(avgScore) / user.targetScore) * 100)) : 0;
  
  const needsActionExams = (user?.assignedExams || []).filter((e: any) => {
    const examHistory = history.filter(h => h.examId === e.id);
    const attempts = examHistory.length;
    const maxAttempts = e.maxAttempts || 1;
    const maxScore = attempts > 0 ? Math.max(...examHistory.map(h => h.score)) : 0;
    
    if (attempts === 0) return true;
    if (attempts > 0 && attempts < maxAttempts && maxScore < 7) return true;
    return false;
  });
  
  const groupedHistory = history.reduce((acc, curr) => {
    const d = new Date(curr.createdAt);
    let key = '';
    if (chartViewMode === 'day') {
      key = d.toLocaleDateString('vi-VN');
    } else if (chartViewMode === 'week') {
      const currentDay = d.getDay() === 0 ? 7 : d.getDay();
      const firstDay = new Date(d);
      firstDay.setDate(d.getDate() - currentDay + 1);
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);
      key = `${firstDay.getDate()}/${firstDay.getMonth() + 1} - ${lastDay.getDate()}/${lastDay.getMonth() + 1}`;
    } else {
      key = `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;
    }

    if (!acc[key]) acc[key] = { scoreSum: 0, count: 0 };
    acc[key].scoreSum += curr.score;
    acc[key].count += 1;
    return acc;
  }, {} as Record<string, {scoreSum: number, count: number}>);

  const chartData = Object.keys(groupedHistory).map(date => ({
    name: date,
    score: Number((groupedHistory[date].scoreSum / groupedHistory[date].count).toFixed(1)),
    attempts: groupedHistory[date].count
  }));

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden w-full p-2 md:p-6 gap-0 md:gap-6 relative">
      
      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 md:z-auto w-72 bg-surface/95 md:bg-surface/80 backdrop-blur-2xl rounded-r-3xl md:rounded-3xl p-6 flex flex-col gap-2 shrink-0 h-full overflow-y-auto border-r md:border border-foreground/5 shadow-2xl md:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transform transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="mb-10 px-2 flex items-center gap-4">
          <label className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0 cursor-pointer relative overflow-hidden ring-2 ring-transparent hover:ring-primary/30 transition-all group shadow-sm">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || 'H'
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <span className="text-[10px] font-bold text-white tracking-wider">ĐỔI</span>
            </div>
          </label>
          <div className="overflow-hidden">
            <h2 className="text-xl font-black text-foreground truncate tracking-tight">{user?.name || 'Học sinh'}</h2>
            <p className="text-[10px] text-foreground/50 font-bold uppercase tracking-widest mt-0.5">Học sinh</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {navGroups.map(group => (
            <div key={group.id} className="flex flex-col gap-1">
              {group.subItems ? (
                <>
                  <button 
                    onClick={() => toggleNavGroup(group.id)}
                    className="flex items-center justify-between px-5 py-3 rounded-2xl font-bold transition-all duration-300 cursor-pointer text-left text-foreground/80 hover:bg-foreground/5"
                  >
                    <span className="tracking-wide">{group.label}</span>
                    <span className={`transform transition-transform text-xs ${expandedNav[group.id] ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {expandedNav[group.id] && (
                    <div className="flex flex-col gap-1 pl-4">
                      {group.subItems.map((item: any) => (
                        item.isLink ? (
                          <Link key={item.id} href={item.href}
                            className={`flex items-center px-5 py-2.5 rounded-2xl font-bold transition-all duration-300 cursor-pointer text-left text-sm group hover:bg-foreground/5 text-foreground/60 hover:text-foreground hover:translate-x-1`}>
                            <span className="tracking-wide">{item.label}</span>
                          </Link>
                        ) : (
                          <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                            className={`flex items-center px-5 py-2.5 rounded-2xl font-bold transition-all duration-300 cursor-pointer text-left text-sm group ${activeTab === item.id ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md shadow-primary/25 scale-[1.02]' : 'hover:bg-foreground/5 text-foreground/60 hover:text-foreground hover:translate-x-1'}`}>
                            <span className="tracking-wide">{item.label}</span>
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button onClick={() => { setActiveTab(group.id); setIsMobileMenuOpen(false); }}
                  className={`flex items-center px-5 py-3.5 rounded-2xl font-bold transition-all duration-300 cursor-pointer text-left group ${activeTab === group.id ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-xl shadow-primary/25 scale-[1.02]' : 'hover:bg-foreground/5 text-foreground/60 hover:text-foreground hover:translate-x-1'}`}>
                  <span className="tracking-wide">{group.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto pt-6 border-t border-foreground/5">
          <button 
            onClick={() => { localStorage.removeItem('userId'); window.location.href = '/'; }}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-rose-500/80 bg-rose-500/5 hover:bg-rose-500 hover:text-white transition-all w-full cursor-pointer text-sm shadow-sm hover:shadow-rose-500/25"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 rounded-3xl p-4 md:p-8 h-full overflow-y-auto relative bg-surface border border-foreground/10 shadow-sm flex flex-col w-full">
        
        {/* Mobile Header with Hamburger */}
        <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-foreground/5">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-foreground/5 rounded-xl hover:bg-foreground/10 transition-colors">
              <span className="text-xl">☰</span>
            </button>
            <h2 className="font-bold text-primary tracking-tight">LUCY TUTOR</h2>
          </div>
        </div>

        {/* Dashboard Header - User Info Sync */}
        {user && (
          <div className="mb-8 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-primary/5 p-4 sm:p-6 rounded-2xl border border-primary/10">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <label className="w-14 h-14 shrink-0 bg-gradient-to-tr from-primary to-secondary text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-md cursor-pointer relative overflow-hidden group">
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.name.charAt(0)
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs font-medium">Đổi</span>
                </div>
              </label>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                  <p className="text-sm text-foreground/60 font-medium">
                    {user.classroomsJoined?.length > 0 ? `Lớp: ${user.classroomsJoined.map((c: any) => c.name).join(', ')}` : 'Chưa tham gia lớp học'}
                  </p>
                  <span className="text-foreground/30">•</span>
                  {(() => {
                    const xp = user.totalXP || 0;
                    const level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
                    const currentLevelXP = 50 * level * (level - 1);
                    const nextLevelXP = 50 * (level + 1) * level;
                    const xpInCurrentLevel = xp - currentLevelXP;
                    const xpNeededForNext = nextLevelXP - currentLevelXP;

                    let rank = { label: '🌱 Tân Binh', color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' };
                    if (level >= 20) rank = { label: '💎 Huyền Thoại', color: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' };
                    else if (level >= 15) rank = { label: '🥇 Bậc Thầy', color: 'text-yellow-600 bg-yellow-500/10 border-yellow-500/20' };
                    else if (level >= 10) rank = { label: '🥈 Tinh Anh', color: 'text-slate-600 bg-slate-500/10 border-slate-500/20' };
                    else if (level >= 5) rank = { label: '📖 Học Giả', color: 'text-amber-700 bg-amber-500/10 border-amber-500/20' };
                    
                    return (
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <span 
                          onClick={() => {
                            Swal.fire({
                              title: 'Cẩm Nang Cày Cấp',
                              html: `
                                <div style="text-align: left; font-size: 15px; line-height: 1.6;">
                                  <p>Bạn sẽ kiếm được điểm <b>XP</b> để thăng cấp và đạt các Danh hiệu danh giá. Cấp càng cao, lượng XP yêu cầu để thăng cấp càng lớn!</p>
                                  <div style="background: rgba(0,0,0,0.05); padding: 15px; border-radius: 10px; margin: 15px 0;">
                                    <b>Hệ Thống Danh Hiệu:</b><br/>
                                    🌱 Tân Binh (Cấp 1 - 4)<br/>
                                    📖 Học Giả (Cấp 5 - 9)<br/>
                                    🥈 Tinh Anh (Cấp 10 - 14)<br/>
                                    🥇 Bậc Thầy (Cấp 15 - 19)<br/>
                                    💎 Huyền Thoại (Cấp 20+)
                                  </div>
                                  <p><b>Cách nhận XP:</b></p>
                                  <ul style="padding-left: 20px;">
                                    <li>✅ <b>Làm Bài Tập/Kiểm Tra:</b> Nhận tới 100 XP cho mỗi bài xuất sắc.</li>
                                    <li>📅 <b>Điểm Danh:</b> Đăng nhập mỗi ngày để nhận XP khởi động.</li>
                                  </ul>
                                  <p style="margin-top: 15px; font-weight: bold; color: #ef4444;">🔥 Chúc bạn leo rank thần tốc!</p>
                                </div>
                              `,
                              confirmButtonText: 'Đã Rõ!',
                              confirmButtonColor: '#3b82f6',
                            });
                          }}
                          className={`px-2.5 py-0.5 rounded-md border text-xs font-bold ${rank.color} shadow-sm whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity`}
                        >
                          Cấp {level} - {rank.label}
                        </span>
                        <div className="flex items-center gap-2" title={`Cấp ${level}: ${xpInCurrentLevel} / ${xpNeededForNext} XP`}>
                          <div className="w-24 h-1.5 bg-foreground/10 rounded-full overflow-hidden shadow-inner relative group">
                            <div className="h-full bg-primary/80 rounded-full" style={{ width: `${(xpInCurrentLevel / xpNeededForNext) * 100}%` }} />
                          </div>
                          <span className="text-xs text-foreground/40 font-bold">{xpInCurrentLevel}/{xpNeededForNext}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: OVERVIEW */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <h1 className="text-3xl font-bold">Tổng Quan Học Tập</h1>
            
            {needsActionExams.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/20 p-5 sm:p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
                <div className="flex items-center gap-4 w-full">
                  <div className="w-12 h-12 shrink-0 bg-rose-500 text-white rounded-full flex items-center justify-center text-2xl font-black shadow-md animate-pulse">
                    !
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-rose-700">Bạn có {needsActionExams.length} bài cần xử lý!</h3>
                    <p className="text-sm text-rose-600/80 font-medium mt-1">Gồm các bài chưa làm hoặc chưa đạt điểm yêu cầu (dưới 7 điểm).</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('EXAMS')}
                  className="px-6 py-3 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-colors shadow-md cursor-pointer whitespace-nowrap w-full sm:w-auto"
                >
                  Xử lý ngay →
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              <div className="bg-surface border border-foreground/10 p-8 rounded-3xl relative overflow-hidden flex flex-col justify-center hover:border-primary/30 transition-colors shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-[50px] rounded-full" />
                <p className="text-sm font-bold text-foreground/50 mb-2 uppercase tracking-wide">Điểm Trung Bình</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-5xl font-black text-primary">{avgScore}</p>
                  <span className="text-xl text-foreground/50 font-medium">/10</span>
                </div>
              </div>

              <div className="bg-surface border border-foreground/10 p-8 rounded-3xl flex flex-col justify-center hover:border-emerald-500/30 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[50px] rounded-full" />
                <p className="text-sm font-bold text-foreground/50 mb-2 uppercase tracking-wide">Tiến Độ Mục Tiêu</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-end justify-between">
                    <p className="text-5xl font-black text-emerald-500">{percentToTarget}<span className="text-xl text-foreground/50 font-medium">%</span></p>
                    <span className="text-xs font-bold text-foreground/40 mb-2">Mục tiêu: {user?.targetScore}+</span>
                  </div>
                  <div className="w-full bg-foreground/5 rounded-full h-2 mt-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${percentToTarget}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="bg-surface border border-foreground/10 p-8 rounded-3xl flex flex-col justify-center hover:border-secondary/30 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-secondary/10 blur-[50px] rounded-full" />
                <p className="text-sm font-bold text-foreground/50 mb-2 uppercase tracking-wide">Số bài đã làm</p>
                <p className="text-5xl font-black text-secondary">{totalExams} <span className="text-xl text-foreground/50 font-medium">bài</span></p>
              </div>

              <div className="bg-surface border border-foreground/10 p-8 rounded-3xl flex flex-col justify-center hover:border-amber-500/30 transition-colors shadow-sm relative overflow-hidden">
                <div className="absolute top-1/2 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] rounded-full" />
                <p className="text-sm font-bold text-foreground/50 mb-2 uppercase tracking-wide">Tổng XP Tích Lũy</p>
                <p className="text-5xl font-black text-amber-500">{totalXP} <span className="text-xl text-foreground/50 font-medium">XP</span></p>
              </div>
            </div>

            {/* Chart Section */}
            {history.length > 0 && (
              <div className="bg-surface border border-foreground/10 rounded-3xl shadow-sm p-4 sm:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h4 className="text-xl font-bold flex items-center gap-3">
                    <span className="p-2 bg-primary/10 text-primary rounded-xl">📈</span> Biểu Đồ Tiến Bộ
                  </h4>
                  <div className="flex bg-foreground/5 p-1 rounded-xl">
                    <button onClick={() => setChartViewMode('day')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${chartViewMode === 'day' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}>Ngày</button>
                    <button onClick={() => setChartViewMode('week')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${chartViewMode === 'week' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}>Tuần</button>
                    <button onClick={() => setChartViewMode('month')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${chartViewMode === 'month' ? 'bg-surface shadow-sm text-foreground' : 'text-foreground/50 hover:text-foreground'}`}>Tháng</button>
                  </div>
                </div>
                <div className="h-[250px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-[0.05]" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.5, fontSize: 12}} dy={10} />
                      <YAxis yAxisId="left" domain={[0, 10]} axisLine={false} tickLine={false} tick={{fill: 'currentColor', opacity: 0.5, fontSize: 12}} dx={-10} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: 'var(--color-secondary)', opacity: 0.5, fontSize: 12}} dx={10} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)', backgroundColor: 'var(--color-surface)', color: 'var(--color-foreground)' }}
                        itemStyle={{ fontWeight: '900', fontSize: '1.1rem' }}
                        formatter={(value: any, name: any) => [name === 'score' ? `${value} Điểm` : `${value} Phút`, name === 'score' ? 'Điểm số' : 'Thời gian']}
                        labelStyle={{ color: 'var(--color-foreground)', opacity: 0.6, margin: 0, paddingBottom: '12px', fontWeight: 'bold' }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="score" name="score" stroke="var(--color-primary)" strokeWidth={4} dot={{ r: 5, fill: 'var(--color-surface)', strokeWidth: 3 }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                      <Line yAxisId="right" type="monotone" dataKey="attempts" name="attempts" stroke="var(--color-secondary)" strokeWidth={4} strokeDasharray="5 5" dot={{ r: 5, fill: 'var(--color-surface)', strokeWidth: 3 }} activeDot={{ r: 8, strokeWidth: 0 }} animationDuration={1500} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* History Table */}
            {history.length > 0 && (
              <div className="bg-surface border border-foreground/10 rounded-3xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-foreground/10 bg-foreground/[0.02]">
                  <h4 className="text-xl font-bold flex items-center gap-3">
                    <span className="p-2 bg-secondary/10 text-secondary rounded-xl">📜</span> Lịch Sử Bài Làm Gần Đây
                  </h4>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-foreground/5">
                        <th className="p-4 font-bold text-foreground/50 text-sm uppercase tracking-wide">Tên Bài Thi</th>
                        <th className="p-4 font-bold text-foreground/50 text-sm uppercase tracking-wide">Thời Gian Làm</th>
                        <th className="p-4 font-bold text-foreground/50 text-sm uppercase tracking-wide">Thời Lượng</th>
                        <th className="p-4 font-bold text-foreground/50 text-sm uppercase tracking-wide text-right">Điểm Số</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/5">
                      {[...history].reverse().slice(0, 10).map((item, i) => {
                        const scoreColor = item.score >= 8 ? 'text-green-500' : item.score >= 5 ? 'text-amber-500' : 'text-rose-500';
                        const scoreBg = item.score >= 8 ? 'bg-green-500/10' : item.score >= 5 ? 'bg-amber-500/10' : 'bg-rose-500/10';
                        return (
                          <tr key={i} className="hover:bg-foreground/[0.03] transition-colors group">
                            <td className="p-4 font-bold text-foreground/90">{item.exam?.title || "Bài thi"}</td>
                            <td className="p-4 text-foreground/60 text-sm">
                              {new Date(item.createdAt).toLocaleDateString('vi-VN')} <span className="opacity-50">lúc</span> {new Date(item.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}
                            </td>
                            <td className="p-4 text-foreground/60 text-sm">
                              {Math.floor(item.timeSpent / 60)} phút {item.timeSpent % 60} giây
                            </td>
                            <td className="p-4 text-right">
                              <span className={`inline-flex px-3 py-1 rounded-lg font-black ${scoreBg} ${scoreColor}`}>
                                {item.score.toFixed(1)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {history.length === 0 && (
              <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col justify-center items-center text-center shadow-sm">
                <div className="w-20 h-20 rounded-full bg-foreground/5 flex items-center justify-center mb-6 text-4xl">📭</div>
                <h2 className="text-2xl font-bold mb-2">Chưa có dữ liệu</h2>
                <p className="text-foreground/50 max-w-md">Bạn chưa hoàn thành bài thi nào. Hãy bắt đầu làm bài để tích lũy dữ liệu thống kê nhé!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: LESSONS */}
        {activeTab === "LESSONS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Bài Học Của Bạn</h1>
            {lessons.length === 0 ? (
              <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col justify-center items-center text-center">
                <div className="w-20 h-20 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-6">
                  <span className="text-3xl">📚</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">Chưa có bài học nào</h2>
                <p className="text-foreground/50 max-w-md">Hiện tại lớp của bạn chưa có bài học mới.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {lessons.map(lesson => {
                  const progress = lesson.progress?.find((p: any) => p.userId === user?.id);
                  const isCompleted = progress?.status === 'COMPLETED';
                  return (
                    <div key={lesson.id} className="bg-surface border border-foreground/10 p-5 rounded-2xl flex flex-col gap-4 hover:border-primary/30 transition-colors shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center text-2xl">📚</div>
                        <div>
                          <h3 className="font-bold text-lg">{lesson.title}</h3>
                          <p className="text-sm text-foreground/50">{lesson.vocabularies?.length || 0} từ vựng • {lesson.grammars?.length || 0} ngữ pháp</p>
                        </div>
                      </div>
                      <div className="mt-auto flex items-center justify-between pt-2 border-t border-foreground/10">
                        {isCompleted ? (
                          <span className="px-3 py-1 bg-green-500/10 text-green-600 font-bold rounded-lg text-sm">✅ Đã học</span>
                        ) : (
                          <span className="px-3 py-1 bg-amber-500/10 text-amber-600 font-bold rounded-lg text-sm">⏳ Chưa học</span>
                        )}
                        <Link href={`/lesson/${lesson.id}`} className="px-5 py-2 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition-colors text-sm whitespace-nowrap flex items-center justify-center gap-2">
                          Học Ngay <span>→</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* VIEW: PRACTICE */}
        {activeTab === "PRACTICE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Bài Tập Về Nhà</h1>
            
            {(() => {
              const assignments = user?.assignedExams?.filter((e: any) => e.examType === 'ASSIGNMENT' || e.examType === 'REGULAR') || [];
              if (assignments.length === 0) return (
                <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col justify-center items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-6">
                    <span className="text-3xl">📝</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Chưa có bài tập nào</h2>
                  <p className="text-foreground/50 max-w-md">Hiện tại bạn chưa được giao bài tập về nhà. Hãy quay lại sau nhé!</p>
                </div>
              );
              
              return (
                <div className="space-y-4">
                  {assignments.map((e: any) => (
                    <div key={e.id} className="bg-surface border border-foreground/10 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-primary/30 transition-colors">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-2xl">
                          📝
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{e.title}</h3>
                          <p className="text-sm text-foreground/50">{e.totalQuestions} câu hỏi • {e.duration || 45} phút • Tối đa {e.maxAttempts || 1} lần làm</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {e.deadline && <span className="text-xs bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">⏰ Hạn: {new Date(e.deadline).toLocaleString('vi-VN')}</span>}
                            {e.notes && <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">📌 {e.notes}</span>}
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const attempts = history.filter(h => h.examId === e.id).length;
                        const maxAttempts = e.maxAttempts || 1;
                        if (attempts >= maxAttempts) {
                          return <span className="px-6 py-2 bg-foreground/10 text-foreground/50 font-bold rounded-xl cursor-not-allowed w-full sm:w-auto text-center">Hết Lượt ({attempts}/{maxAttempts})</span>;
                        }
                        return (
                          <Link href={`/exam/${e.id}`} className="px-6 py-2 bg-foreground text-background font-bold rounded-xl hover:bg-foreground/80 transition-colors w-full sm:w-auto mt-2 sm:mt-0 whitespace-nowrap flex items-center justify-center gap-2">
                            Làm Bài ({attempts}/{maxAttempts}) <span>→</span>
                          </Link>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW: EXAMS */}
        {activeTab === "EXAMS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Bài Kiểm Tra (Exams)</h1>
            
            {(() => {
              const tests = user?.assignedExams?.filter((e: any) => e.examType === 'EXAM' || e.examType === 'PLACEMENT') || [];
              if (tests.length === 0) return (
                <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col justify-center items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mb-6">
                    <span className="text-3xl">⏰</span>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Chưa có bài kiểm tra</h2>
                  <p className="text-foreground/50 max-w-md">Chưa có bài thi nào sắp diễn ra hoặc đã hoàn thành. Chăm chỉ luyện tập chờ kỳ thi tiếp theo nhé!</p>
                </div>
              );
              
              return (
                <div className="space-y-4">
                  {tests.map((e: any) => (
                    <div key={e.id} className="bg-surface border border-foreground/10 p-5 sm:p-6 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-rose-500/30 transition-colors">
                      <div className="flex items-center gap-4 w-full">
                        <div className="w-12 h-12 shrink-0 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center text-2xl">
                          ⏰
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{e.title}</h3>
                          <p className="text-sm text-foreground/50">{e.totalQuestions} câu hỏi • {e.duration || 60} phút • Tối đa {e.maxAttempts || 1} lần làm</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            {e.deadline && <span className="text-xs bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded-full">⏰ Hạn: {new Date(e.deadline).toLocaleString('vi-VN')}</span>}
                            {e.notes && <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full">📌 {e.notes}</span>}
                          </div>
                        </div>
                      </div>
                      {(() => {
                        const examHistory = history.filter(h => h.examId === e.id);
                        const attempts = examHistory.length;
                        const maxAttempts = e.maxAttempts || 1;
                        const maxScore = attempts > 0 ? Math.max(...examHistory.map(h => h.score)) : 0;
                        
                        if (attempts >= maxAttempts) {
                          if (maxScore < 5) {
                            return <span className="px-6 py-2 bg-rose-500/10 text-rose-700 font-bold rounded-xl cursor-not-allowed w-full sm:w-auto text-center mt-2 sm:mt-0">Khóa (Thi Trượt)</span>;
                          }
                          return <span className="px-6 py-2 bg-foreground/10 text-foreground/50 font-bold rounded-xl cursor-not-allowed w-full sm:w-auto text-center mt-2 sm:mt-0">Hết Lượt ({attempts}/{maxAttempts})</span>;
                        }
                        return (
                          <Link href={`/exam/${e.id}`} className="px-6 py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 transition-colors w-full sm:w-auto mt-2 sm:mt-0 whitespace-nowrap flex items-center justify-center gap-2">
                            Thi Ngay ({attempts}/{maxAttempts}) <span>→</span>
                          </Link>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "DOCUMENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
               <h1 className="text-3xl font-bold">Kho Tài Liệu</h1>
               <input 
                 type="text" 
                 placeholder="Tìm kiếm tài liệu..." 
                 value={searchDocQuery}
                 onChange={e => setSearchDocQuery(e.target.value)}
                 className="w-full md:w-1/3 p-3 rounded-xl border border-foreground/20 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50" 
               />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).length === 0 && <div className="text-foreground/50 italic col-span-full">Không tìm thấy tài liệu phù hợp</div>}
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).map((doc: any) => (
                <div key={doc.id} className="bg-surface p-6 rounded-3xl border border-foreground/10 hover:border-primary/30 transition-all flex flex-col justify-between group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 flex gap-2">
                     <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${doc.visibility === 'PUBLIC' ? 'bg-green-500/10 text-green-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {doc.visibility === 'CLASS' ? (doc.classroom?.name || 'Lớp') : 'Chung'}
                     </span>
                  </div>
                  <div>
                    <div className="w-12 h-12 flex items-center justify-center mb-4">
                       {doc.fileType === '.pdf' ? (
                          <svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 4 h22 l10 10 v30 h-32 Z" fill="#fff" stroke="#e11d48" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M30 4 v10 h10" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M22 20 c0 0 -2 -6 -5 -6 c-2 0 -3 2 -1 4 c2 2 4 4 6 7 c2 3 1 6 3 6 c2 0 3 -1 2 -3 c-1 -2 -3 -3 -5 -5 c-1 -2 -2 -5 -2 -5 c0 0 2 0 2 2 z" fill="none" stroke="#e11d48" strokeWidth="2"/>
                            <text x="13" y="38" fontFamily="Arial" fontSize="12" fontWeight="bold" fill="#1f2937">PDF</text>
                          </svg>
                       ) : (
                          <svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                            <rect x="18" y="8" width="24" height="32" fill="#fff" stroke="#1d4ed8" strokeWidth="2" rx="2"/>
                            <rect x="24" y="14" width="14" height="2" fill="#1d4ed8"/>
                            <rect x="24" y="19" width="14" height="2" fill="#1d4ed8"/>
                            <rect x="24" y="24" width="14" height="2" fill="#1d4ed8"/>
                            <rect x="24" y="29" width="14" height="2" fill="#1d4ed8"/>
                            <rect x="24" y="34" width="14" height="2" fill="#1d4ed8"/>
                            <path d="M4 12 L20 8 L20 40 L4 36 Z" fill="#1d4ed8" stroke="#1d4ed8" strokeWidth="1" strokeLinejoin="round"/>
                            <text x="6" y="31" fontFamily="Arial" fontSize="18" fontWeight="bold" fill="#fff">W</text>
                          </svg>
                       )}
                    </div>
                    <h3 className="font-bold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors" title={doc.title}>{doc.title}</h3>
                    <p className="text-xs text-foreground/50 mb-4">{new Date(doc.createdAt).toLocaleDateString('vi-VN')} • {(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div className="flex gap-2 z-10">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download={doc.title} className="flex-1 py-2 text-center bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer block z-10 relative">Tải xuống</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === "ATTENDANCE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Chuyên Cần & Học Phí</h1>
              <input 
                type="month" 
                value={attMonth} 
                onChange={e => setAttMonth(e.target.value)} 
                className="p-3 border border-foreground/20 rounded-xl bg-surface font-bold shadow-sm"
              />
            </div>

            {attReports.length === 0 ? (
              <div className="text-center text-foreground/40 py-12 bg-foreground/5 rounded-3xl border-2 border-dashed border-foreground/10">
                <p className="text-lg font-medium mb-2">Không có dữ liệu tháng này</p>
                <p className="text-sm">Tháng này bạn chưa tham gia hoặc chưa được điểm danh lớp nào.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {attReports.map((report: any) => (
                  <div key={report.classroomId} className="bg-surface border border-foreground/10 p-6 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-center border-b border-foreground/10 pb-4 mb-4">
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>
                        {report.classroomName}
                      </h2>
                      {report.isPaid ? (
                        <div className="bg-green-500/10 text-green-600 px-4 py-1.5 rounded-full font-bold text-sm border border-green-500/20">
                          Đã thanh toán: {new Date(report.paidAt).toLocaleDateString('vi-VN')}
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 text-rose-600 px-4 py-1.5 rounded-full font-bold text-sm border border-rose-500/20">
                          Chưa thanh toán
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-foreground/5 rounded-2xl">
                        <p className="text-sm text-foreground/60 mb-1">Số buổi đã học (có mặt)</p>
                        <p className="text-2xl font-black">{report.presentCount}</p>
                      </div>
                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                        <p className="text-sm text-primary/80 mb-1 font-bold">Học phí tháng {attMonth.split('-')[1]}</p>
                        <p className="text-2xl font-black text-primary">{report.totalAmount.toLocaleString()} VNĐ</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW: CALENDAR */}
        {activeTab === "CALENDAR" && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Lịch Học & Bài Tập</h1>
            <div className="flex-1 min-h-[500px]">
              <CalendarComponent user={user} role="STUDENT" />
            </div>
          </div>
        )}

        {/* VIEW: NOTEBOOK */}
        {activeTab === "NOTEBOOK" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-6">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">Sổ Tay Lỗi Sai</h1>
                <p className="text-foreground/60">Gia sư Lucy đã tự động tổng hợp các lỗ hổng kiến thức của bạn dựa trên những câu làm sai.</p>
              </div>
            </div>

            {user?.notebooks?.length > 0 ? (
              <div className="space-y-8">
                {/* Chart Top Mistakes */}
                <div className="bg-surface border border-foreground/10 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-bold text-lg mb-6 flex items-center gap-2">📊 Top Lỗi Mắc Phải Nhiều Nhất</h3>
                  <div className="space-y-4">
                    {[...user.notebooks].sort((a: any, b: any) => b.mistakeCount - a.mistakeCount).slice(0, 5).map((nb: any, index: number) => {
                      const maxCount = Math.max(...user.notebooks.map((n: any) => n.mistakeCount));
                      const percent = (nb.mistakeCount / maxCount) * 100;
                      return (
                        <div key={nb.id} className="flex items-center gap-4">
                          <div className="w-1/3 truncate text-sm font-bold text-foreground/80" title={nb.topic}>{nb.topic}</div>
                          <div className="flex-1 h-3 bg-foreground/5 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="w-12 text-right text-sm font-bold text-amber-600">{nb.mistakeCount} lỗi</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {user.notebooks.map((nb: any) => (
                    <div key={nb.id} className="bg-surface border border-foreground/10 p-6 rounded-2xl shadow-sm hover:border-amber-500/30 transition-colors flex flex-col h-full">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg text-amber-600 line-clamp-2 pr-4">{nb.topic}</h3>
                        <span className="bg-rose-500/10 text-rose-500 font-bold px-3 py-1 rounded-lg text-xs whitespace-nowrap shrink-0">{nb.mistakeCount} lần sai</span>
                      </div>
                      <p className="text-xs text-foreground/50 mb-4 font-medium flex items-center gap-1">
                        🗓 Cập nhật: {new Date(nb.updatedAt).toLocaleDateString('vi-VN')}
                      </p>
                      
                      <div className="mt-auto pt-4 flex justify-end">
                        <button 
                          onClick={() => setSelectedNotebookForView(nb)}
                          className="px-4 py-2 bg-amber-500/10 text-amber-600 font-bold rounded-xl hover:bg-amber-500/20 transition-colors text-sm cursor-pointer"
                        >
                          👁 Xem Chi Tiết Giải Thích
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col justify-center items-center text-center">
                <div className="w-20 h-20 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-6">
                  <span className="text-3xl">📓</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">Sổ tay trống</h2>
                <p className="text-foreground/50 max-w-md">Bạn chưa có câu làm sai nào cần ghi chú. Hoàn thành bài tập để AI Lucy tự động tạo sổ tay điểm yếu cho bạn nhé!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: SETTINGS */}
        {activeTab === "SETTINGS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl">
            <h1 className="text-3xl font-bold mb-6">Cài Đặt Tài Khoản</h1>
            
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const userId = localStorage.getItem('userId');
                if (!userId) return;
                
                try {
                  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/auth/me?userId=${userId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      targetScore: formData.get('targetScore'),
                      phone: formData.get('phone')
                    })
                  });
                  if (res.ok) {
                    const data = await res.json();
                    setUser(data);
                    Swal.fire('Thành công', 'Cập nhật thông tin thành công!', 'success');
                  } else {
                    Swal.fire('Lỗi', 'Lỗi cập nhật thông tin', 'error');
                  }
                } catch (error) {
                  console.error(error);
                  Swal.fire('Lỗi', 'Lỗi cập nhật thông tin', 'error');
                }
              }}
              className="bg-surface border border-foreground/10 p-8 rounded-3xl space-y-6 shadow-sm"
            >
              <div>
                <label className="block text-sm font-bold mb-2">Họ và Tên</label>
                <input type="text" disabled defaultValue={user?.name} className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-foreground/5 text-foreground/50 cursor-not-allowed" />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2">Email</label>
                <input type="email" disabled defaultValue={user?.email} className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-foreground/5 text-foreground/50 cursor-not-allowed" />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Số điện thoại liên hệ</label>
                <input type="tel" name="phone" defaultValue={user?.phone || ''} placeholder="0987654321" className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary" />
              </div>
              
              <div>
                <label className="block text-sm font-bold mb-2">Mục tiêu điểm số</label>
                <select name="targetScore" defaultValue={user?.targetScore || 7.0} className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary">
                  <option value="5">5.0 - Cơ bản</option>
                  <option value="6">6.0 - Trung bình khá</option>
                  <option value="7">7.0 - Khá</option>
                  <option value="8">8.0 - Giỏi</option>
                  <option value="9">9.0 - Xuất sắc</option>
                  <option value="10">10 - Thủ khoa</option>
                </select>
              </div>

              <button type="submit" className="w-full py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-colors shadow-lg cursor-pointer">
                Lưu Thay Đổi
              </button>
            </form>

            <div className="bg-surface border border-foreground/10 p-4 md:p-8 rounded-3xl space-y-4 shadow-sm mt-8">
              <h2 className="text-xl font-bold">Tham Gia Lớp Học</h2>
              <p className="text-sm text-foreground/60 mb-4">Nhập mã lớp do Giáo viên cung cấp để tham gia làm bài tập và đề thi được giao.</p>
              <form onSubmit={handleJoinClass} className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-bold mb-2">Mã Lớp Học (Join Code)</label>
                  <input 
                    type="text" 
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="VD: A1B2C3" 
                    className="w-full px-4 py-3 rounded-xl border border-foreground/10 bg-transparent focus:outline-none focus:border-primary uppercase" 
                    required
                  />
                </div>
                <button type="submit" className="w-full sm:w-auto px-6 py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 transition-colors shadow-lg cursor-pointer h-[50px] whitespace-nowrap">
                  Tham Gia
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
      
      {/* Notebook Detail Modal */}
      {selectedNotebookForView && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface p-8 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-foreground/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-6 border-b border-foreground/10 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-amber-600 mb-2">{selectedNotebookForView.topic}</h2>
                <div className="flex items-center gap-3">
                  <span className="bg-rose-500/10 text-rose-500 font-bold px-3 py-1 rounded-lg text-xs">Mắc lỗi: {selectedNotebookForView.mistakeCount} lần</span>
                  <span className="text-xs text-foreground/50 font-medium">Cập nhật lúc: {new Date(selectedNotebookForView.updatedAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>
              <button onClick={() => setSelectedNotebookForView(null)} className="p-2 hover:bg-foreground/10 rounded-full cursor-pointer transition-colors text-xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/80">
                {/* We use a simple markdown parser approach for basic formatting since ReactMarkdown isn't imported */}
                {selectedNotebookForView.theoryContent.split('\n').map((line: string, i: number) => {
                  if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold mt-4 mb-2">{line.replace('### ', '')}</h3>;
                  if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-5 mb-2 border-b pb-1">{line.replace('## ', '')}</h2>;
                  if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-6 mb-3">{line.replace('# ', '')}</h1>;
                  if (line.startsWith('- ')) {
                    const liContent = line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                    return <li key={i} className="ml-4 mb-1 list-disc" dangerouslySetInnerHTML={{ __html: liContent }} />;
                  }
                  if (line.trim() === '') return <br key={i} />;
                  // Bold text parser
                  const formattedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
                  return <p key={i} className="mb-2" dangerouslySetInnerHTML={{ __html: formattedLine }} />;
                })}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end pt-4 border-t border-foreground/10">
              <button onClick={() => setSelectedNotebookForView(null)} className="px-6 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 cursor-pointer">Đã hiểu rõ</button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Mini Components for UI
function WeaknessItem({ topic, rate }: { topic: string, rate: string }) {
  return (
    <div className="flex justify-between items-center p-4 rounded-2xl bg-foreground/5 hover:bg-foreground/10 transition-colors">
      <span className="font-semibold text-foreground/90">{topic}</span>
      <span className="text-accent font-bold bg-accent/10 border border-accent/20 px-3 py-1 rounded-lg text-sm">Sai {rate}</span>
    </div>
  );
}

function LessonCard({ title, type }: { title: string, type: string }) {
  const getBadge = () => {
    switch(type) {
      case 'Video': return <span className="text-blue-500 bg-blue-500/10 px-2 py-1 rounded text-xs font-bold border border-blue-500/20">VIDEO</span>;
      case 'Practice': return <span className="text-green-500 bg-green-500/10 px-2 py-1 rounded text-xs font-bold border border-green-500/20">QUIZ</span>;
      case 'Vocab': return <span className="text-purple-500 bg-purple-500/10 px-2 py-1 rounded text-xs font-bold border border-purple-500/20">FLASHCARD</span>;
      default: return null;
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-foreground/5 hover:bg-foreground/10 cursor-pointer transition-colors border border-transparent hover:border-foreground/10">
      <div className="flex-1 font-semibold text-foreground/90">{title}</div>
      {getBadge()}
    </div>
  );
}

function AssignmentCard({ title, deadline, status, teacher, score }: { title: string, deadline: string, status: string, teacher: string, score?: string }) {
  const isCompleted = status === 'COMPLETED';
  
  return (
    <div className={`bg-surface border p-5 rounded-2xl flex justify-between items-center transition-all ${isCompleted ? 'border-foreground/10 opacity-70' : 'border-primary/20 shadow-sm hover:border-primary/50 cursor-pointer'}`}>
      <div>
        <h4 className="font-bold text-lg mb-1">{title}</h4>
        <p className="text-sm text-foreground/60 font-medium">Giao bởi: {teacher} • Hạn chót: <span className={isCompleted ? '' : 'text-orange-500 font-bold'}>{deadline}</span></p>
      </div>
      <div>
        {isCompleted ? (
          <div className="text-right">
            <div className="text-xl font-bold text-secondary">{score}</div>
            <p className="text-xs font-bold text-foreground/40 uppercase mt-0.5">Điểm</p>
          </div>
        ) : (
          <button className="px-5 py-2.5 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 transition-colors cursor-pointer">
            Làm Bài
          </button>
        )}
      </div>
    </div>
  );
}

function NotebookEntry({ topic, mistakes, correctCount = 0, status = 'NEEDS_WORK', theory, isExpanded, onClick }: { topic: string, mistakes: number, correctCount?: number, status?: string, theory: string, isExpanded: boolean, onClick: () => void }) {
  const isResolved = status === 'RESOLVED';

  return (
    <div className={`bg-surface border rounded-2xl overflow-hidden transition-all shadow-sm ${isResolved ? 'border-green-500/30' : 'border-foreground/10'}`}>
      <div 
        onClick={onClick}
        className={`p-5 flex justify-between items-center cursor-pointer transition-colors ${isResolved ? 'hover:bg-green-500/5' : 'hover:bg-foreground/5'}`}
      >
        <div className="flex items-center gap-4 flex-1">
          {isResolved ? (
            <div className="w-10 h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-xl">
              ✓
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold">
              {mistakes}
            </div>
          )}
          
          <div>
            <h3 className={`font-bold text-lg ${isResolved ? 'text-green-600 dark:text-green-400' : ''}`}>{topic}</h3>
            {isResolved ? (
              <span className="text-xs font-bold text-green-500 bg-green-500/10 px-2 py-0.5 rounded">Đã khắc phục</span>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded">Đang yếu</span>
                <span className="text-xs text-foreground/50 font-medium">Tiến độ khắc phục: {correctCount}/3</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-foreground/40">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-6 pt-2 border-t border-foreground/10 bg-primary/5 animate-in slide-in-from-top-2">
          <div className="text-[15px] text-foreground/80 leading-relaxed notebook-markdown">
            <ReactMarkdown
              components={{
                h3: ({node, ...props}) => <h3 className="text-xl font-bold text-primary mt-6 mb-3" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-2 mb-4" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-2 mb-4" {...props} />,
                li: ({node, ...props}) => <li className="pl-1" {...props} />,
                p: ({node, ...props}) => <p className="mb-4 last:mb-0" {...props} />,
                strong: ({node, ...props}) => <strong className="font-bold text-foreground" {...props} />
              }}
            >
              {theory}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
