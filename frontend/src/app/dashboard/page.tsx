"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';
import CalendarComponent from "@/components/calendar/CalendarComponent";
import InstallPWAButton from "@/components/InstallPWAButton";
import Swal from 'sweetalert2';
import confetti from "canvas-confetti";
import { usePagination } from "@/lib/usePagination";
import Pagination from "@/components/Pagination";
import { compressImageToBase64 } from "@/lib/imageCompress";

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [lessonClassFilter, setLessonClassFilter] = useState("");
  const [skillProgress, setSkillProgress] = useState<Record<string, { score: number; hasData: boolean }>>({});

  // ── SETTINGS tab: change password + free-standing student account status ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  useEffect(() => {
    if (activeTab === "SETTINGS" && user?.id && user?.managerTeacher) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/free-students/payments/${user.id}`)
        .then(res => res.json())
        .then(data => setPaymentHistory(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [activeTab, user?.id, user?.managerTeacher]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    if (newPassword !== confirmNewPassword) {
      Swal.fire('Lỗi', 'Mật khẩu mới nhập lại không khớp.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      Swal.fire('Lỗi', 'Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire('Thành công', 'Đã đổi mật khẩu thành công!', 'success');
        setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      } else {
        Swal.fire('Lỗi', data.error || 'Không thể đổi mật khẩu', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Không thể đổi mật khẩu', 'error');
    } finally {
      setChangingPassword(false);
    }
  };

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

    try {
      // Downscaled + re-compressed client-side — a raw phone photo stored as-is would get
      // re-transferred in full on every page that renders this avatar, even as a tiny icon.
      const base64 = await compressImageToBase64(file);
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
      Swal.fire('Lỗi', 'Không thể xử lý ảnh này', 'error');
    }
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
        // Joining a classroom hands tuition tracking to that classroom's own billing — clear
        // any free-standing trial/lock state client-side too (backend already nulled it).
        setUser({ ...user, classroomsJoined: [...(user.classroomsJoined || []), data.classroom], accessLocked: false, accessDaysRemaining: null });
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
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
    if (!userId) {
      window.location.href = '/';
      return;
    }

    fetch(`${API}/api/auth/me?userId=${userId}`)
      .then(res => res.json())
      .then(data => {
        setUser(data);
        setLoading(false);
        if (data?.id) {
          Promise.all([
            fetch(`${API}/api/analytics/history/${data.id}`).then(r => r.json()),
            fetch(`${API}/api/gamification/checkin`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: data.id })
            }).then(r => r.json())
          ]).then(([hist, checkinData]) => {
            setHistory(hist || []);
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
          }).catch(console.error);
        }
      })
      .catch(err => { console.error(err); setLoading(false); });
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

  // ── OVERVIEW real-time refresh: re-poll profile, exam history & skill progress every 30s while viewing this tab, and instantly when the browser tab regains focus ──
  useEffect(() => {
    if (activeTab !== "OVERVIEW" || !user?.id || user?.accessLocked) return;
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const refresh = () => {
      fetch(`${API}/api/auth/me?userId=${user.id}`).then(r => r.json()).then(setUser).catch(console.error);
      fetch(`${API}/api/analytics/history/${user.id}`).then(r => r.json()).then(data => setHistory(data || [])).catch(console.error);
      fetch(`${API}/api/skill-progress/${user.id}`).then(r => r.json()).then(setSkillProgress).catch(() => {});
    };
    // Run immediately — otherwise skillProgress (feeding studentInsights below) stays empty
    // for up to 30s after every OVERVIEW mount, since neither setInterval nor visibilitychange
    // fires on initial load, causing the "weakest skill" insight to misfire as "no data yet".
    refresh();
    const interval = setInterval(refresh, 30000);
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, [activeTab, user?.id, user?.accessLocked]);

  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    'LEARNING': true,
  });

  const toggleNavGroup = (id: string) => {
    setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Once we know the account has no classroom, default-open the self-practice groups instead
  // of the (still-empty) "Học Tập" group — only runs once per login, so it doesn't fight a
  // student's own manual expand/collapse afterwards.
  useEffect(() => {
    if (user?.id && !user?.classroomsJoined?.length) {
      setExpandedNav(prev => ({ ...prev, FOUR_SKILLS: true, TRAINING_CENTER: true }));
    }
  }, [user?.id, user?.classroomsJoined?.length]);

  const learningGroup = {
    id: "LEARNING", label: "Học Tập", icon: "🎓",
    subItems: [
      { id: "LESSONS", label: "Bài Học", icon: "📖" },
      { id: "PRACTICE", label: "Bài Tập", icon: "📝" },
      { id: "EXAMS", label: "Bài Kiểm Tra", icon: "🧪" },
      { id: "ATTENDANCE", label: "Chuyên Cần", icon: "🗓️" },
      { id: "DOCUMENTS", label: "Tài Liệu", icon: "📁" },
    ]
  };
  const fourSkillsGroup = {
    id: "FOUR_SKILLS", label: "Huấn Luyện 4 Kỹ Năng", icon: "🎯",
    subItems: [
      { id: "LISTENING_LINK",    featureKey: "listening",    label: "Luyện Nghe Cùng AI",         icon: "🎧", isLink: true, href: '/listening' },
      { id: "CONVERSATION_LINK", featureKey: "speaking_conversation", label: "Luyện Nói Cùng AI", icon: "🗨️", isLink: true, href: '/conversation' },
      { id: "READING_LINK",      featureKey: "reading",      label: "Luyện Đọc Hiểu Cùng AI",     icon: "📰", isLink: true, href: '/reading' },
      { id: "WRITING_LINK",      featureKey: "writing",      label: "Luyện Viết Cùng AI",         icon: "✍️", isLink: true, href: '/writing' },
    ]
  };
  const trainingCenterGroup = {
    id: "TRAINING_CENTER", label: "Trại Huấn Luyện", icon: "💪",
    subItems: [
      { id: "GYM_LINK",          featureKey: "gym",          label: "Vocab Gym — Từ vựng",       icon: "🔤", isLink: true, href: '/gym' },
      { id: "GRAMMAR_GYM_LINK",  featureKey: "grammar_gym",  label: "Grammar Gym — Ngữ pháp",    icon: "🧩", isLink: true, href: '/grammar-gym' },
      { id: "STUDY_PLAN_LINK",   featureKey: "study_plan",   label: "Lộ trình học (AI)",          icon: "🤖", isLink: true, href: '/study-plan' },
      { id: "PHONETICS_LINK",    featureKey: "phonetics",    label: "Bảng Âm IPA",               icon: "🔊", isLink: true, href: '/phonetics' },
      { id: "PRONUNCIATION_LINK", featureKey: "pronunciation", label: "Luyện Phát Âm",           icon: "🗣️", isLink: true, href: '/pronunciation' },
      { id: "MOCK_TEST_LINK",    featureKey: "mock_test",    label: "Đề Thi Thử THPT",            icon: "🏁", isLink: true, href: '/mock-test' },
      { id: "IELTS_LINK",        featureKey: "ielts",        label: "IELTS Cambridge",            icon: "🎓", isLink: true, href: '/ielts' },
    ]
  };
  // Học viên chưa tham gia lớp nào chưa dùng được nhóm "Học Tập" (phụ thuộc giáo viên giao) —
  // đưa 2 nhóm tự luyện (không cần lớp) lên trước để chúng là thứ đầu tiên nhìn thấy.
  const isClassless = !user?.classroomsJoined?.length;
  const navGroups = [
    { id: "OVERVIEW", label: "Tổng Quan", icon: "📊" },
    ...(isClassless ? [fourSkillsGroup, trainingCenterGroup, learningGroup] : [learningGroup, fourSkillsGroup, trainingCenterGroup]),
    { id: "CALENDAR", label: "Thời Khóa Biểu", icon: "📅" },
    { id: "NOTEBOOK", label: "Sổ Tay Lỗi Sai", icon: "📔" },
    { id: "LEADERBOARD", label: "Bảng Xếp Hạng", icon: "🏆" },
    { id: "SETTINGS", label: "Cài Đặt", icon: "⚙️" },
  ];

  // Compute union of enabled features across all joined classrooms.
  // Empty array in a classroom = all features enabled for that classroom.
  const ALL_FEATURES = ["gym", "grammar_gym", "reading", "writing", "speaking_conversation", "listening", "study_plan", "phonetics", "pronunciation", "mock_test", "ielts"];
  const enabledFeatures: Set<string> = (() => {
    if (!user?.classroomsJoined?.length) return new Set(ALL_FEATURES);
    const union = new Set<string>();
    for (const c of user.classroomsJoined) {
      let features: string[] = [];
      try { features = JSON.parse(c.enabledFeatures || "[]"); } catch {}
      const active = features.length === 0 ? ALL_FEATURES : features;
      active.forEach((f: string) => union.add(f));
    }
    return union.size === 0 ? new Set(ALL_FEATURES) : union;
  })();

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

  // ── LEADERBOARD state ──
  const [leaderboardFilter, setLeaderboardFilter] = useState<string>("GLOBAL");
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [leaderboardCurrentUser, setLeaderboardCurrentUser] = useState<any>(null);

  useEffect(() => {
    if (activeTab === "LEADERBOARD" && user) {
      let url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/leaderboard?currentUserId=${user.id}`;
      if (leaderboardFilter !== "GLOBAL") {
        url += `&classroomId=${leaderboardFilter}`;
      }
      fetch(url)
        .then(res => res.json())
        .then(data => {
          setLeaderboardData(data.leaderboard || []);
          setLeaderboardCurrentUser(data.currentUser || null);
        })
        .catch(console.error);
    }
  }, [activeTab, leaderboardFilter, user]);

  const uniqueHistory = Object.values(history.reduce((acc: any, curr: any) => {
    if (!acc[curr.examId] || curr.score > acc[curr.examId].score) {
      acc[curr.examId] = curr;
    }
    return acc;
  }, {}));

  const totalExams = uniqueHistory.length;
  const avgScore = totalExams > 0 ? (uniqueHistory.reduce((acc: number, curr: any) => acc + curr.score, 0) / totalExams).toFixed(1) : "0.0";
  const totalXP = user?.totalXP || 0;
  const percentToTarget = user?.targetScore > 0 ? Math.min(100, Math.round((parseFloat(avgScore) / user.targetScore) * 100)) : 0;
  
  const needsActionFilter = (e: any) => {
    const examHistory = history.filter(h => h.examId === e.id);
    const attempts = examHistory.length;
    const maxAttempts = e.maxAttempts || 1;
    const maxScore = attempts > 0 ? Math.max(...examHistory.map(h => h.score)) : 0;

    if (attempts === 0) return true;
    if (attempts > 0 && attempts < maxAttempts && maxScore < 7) return true;
    return false;
  };
  const needsActionExams = (user?.assignedExams || []).filter(needsActionFilter);

  // ── List pagination: filter over the full source list first, then paginate the result ──
  const LIST_PAGE_SIZE = 12;
  const filteredLessons = lessonClassFilter ? lessons.filter((l: any) => l.classroomId === lessonClassFilter) : lessons;
  const lessonsPagination = usePagination(filteredLessons, LIST_PAGE_SIZE, lessonClassFilter);

  const practiceAssignments = user?.assignedExams?.filter((e: any) => e.examType === 'ASSIGNMENT' || e.examType === 'REGULAR') || [];
  const practicePagination = usePagination(practiceAssignments, LIST_PAGE_SIZE);

  const examTests = user?.assignedExams?.filter((e: any) => e.examType === 'EXAM' || e.examType === 'PLACEMENT') || [];
  const examsPagination = usePagination(examTests, LIST_PAGE_SIZE);

  // Which tab actually holds the pending items — "Xem Bài Đang Chờ" CTAs route here instead of
  // a hard-coded tab, since needsActionExams mixes both PRACTICE-type and EXAMS-type items and
  // sending the student to the wrong tab shows them an empty list with nothing to act on.
  const needsActionTargetTab = needsActionExams.some((e: any) => e.examType === 'ASSIGNMENT' || e.examType === 'REGULAR') ? 'PRACTICE' : 'EXAMS';

  const filteredDocuments = documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase()));
  const documentsPagination = usePagination(filteredDocuments, LIST_PAGE_SIZE, searchDocQuery);

  const notebooksSorted = [...(user?.notebooks || [])];
  const notebooksPagination = usePagination(notebooksSorted, LIST_PAGE_SIZE);

  const leaderboardRest = leaderboardData.slice(3);
  const leaderboardPagination = usePagination(leaderboardRest, 15, leaderboardFilter);

  // ── Auto-generated learning insights (rule-based, computed from live profile/history/skill data) ──
  const studentInsights: StudentInsight[] = (() => {
    const items: StudentInsight[] = [];
    const numAvgScore = parseFloat(avgScore);

    if (totalExams === 0) {
      items.push(!user?.classroomsJoined?.length
        ? { level: 'info', icon: '🚀', title: 'Bắt đầu hành trình học tập', message: 'Bạn đang học tự do nên chưa có Bài Tập/Đề Thi từ giáo viên. Hãy thử Vocab Gym, Grammar Gym hoặc Huấn Luyện 4 Kỹ Năng cùng AI để hệ thống bắt đầu phân tích và đưa ra gợi ý phù hợp với bạn.', cta: { label: 'Vào Vocab Gym', href: '/gym' } }
        : { level: 'info', icon: '🚀', title: 'Bắt đầu hành trình học tập', message: 'Bạn chưa hoàn thành bài kiểm tra nào. Hãy làm thử một bài trong mục Bài Tập/Đề Thi để hệ thống bắt đầu phân tích và đưa ra gợi ý phù hợp với bạn.', cta: { label: 'Xem Bài Tập', tab: 'PRACTICE' } });
    } else {
      if (percentToTarget < 50) {
        items.push({ level: 'warning', icon: '🎯', title: 'Còn cách xa mục tiêu', message: `Điểm trung bình hiện tại (${avgScore}) mới đạt ${percentToTarget}% mục tiêu ${user?.targetScore}+. Hãy ôn lại Sổ Tay Lỗi Sai và làm thêm bài luyện tập để rút ngắn khoảng cách.`, cta: { label: 'Xem Sổ Tay Lỗi Sai', tab: 'NOTEBOOK' } });
      } else if (numAvgScore >= (user?.targetScore || 999)) {
        items.push({ level: 'success', icon: '🎉', title: 'Đã đạt mục tiêu điểm số!', message: `Điểm trung bình ${avgScore} đã đạt/vượt mục tiêu ${user?.targetScore}+. Hãy đặt mục tiêu cao hơn trong Cài Đặt để tiếp tục bứt phá!`, cta: { label: 'Cập Nhật Mục Tiêu', tab: 'SETTINGS' } });
      } else if (percentToTarget >= 85) {
        items.push({ level: 'success', icon: '🔥', title: 'Sắp chạm mục tiêu', message: `Bạn đã đạt ${percentToTarget}% mục tiêu ${user?.targetScore}+ điểm — chỉ cần cố thêm chút nữa!`, cta: { label: 'Luyện Tập Thêm', tab: 'PRACTICE' } });
      }

      const sortedHistory = [...history].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      if (sortedHistory.length >= 4) {
        const recent = sortedHistory.slice(-3);
        const prior = sortedHistory.slice(-6, -3);
        if (prior.length > 0) {
          const recentAvg = recent.reduce((s: number, h: any) => s + h.score, 0) / recent.length;
          const priorAvg = prior.reduce((s: number, h: any) => s + h.score, 0) / prior.length;
          const diff = Math.round((recentAvg - priorAvg) * 10) / 10;
          if (diff >= 1) {
            items.push({ level: 'success', icon: '📈', title: 'Tiến bộ rõ rệt', message: `Điểm trung bình 3 bài gần nhất tăng ${diff} điểm so với trước đó — bạn đang tiến bộ rất tốt, tiếp tục duy trì nhé!` });
          } else if (diff <= -1) {
            items.push({ level: 'warning', icon: '📉', title: 'Điểm số đang chững lại', message: `Điểm trung bình 3 bài gần nhất giảm ${Math.abs(diff)} điểm so với trước. Xem lại Sổ Tay Lỗi Sai để tìm nguyên nhân và điều chỉnh cách ôn tập.`, cta: { label: 'Xem Sổ Tay Lỗi Sai', tab: 'NOTEBOOK' } });
          }
        }
      }
    }

    const skillHref: Record<string, string> = { READING: '/reading', LISTENING: '/listening', SPEAKING: '/conversation', WRITING: '/writing' };
    const skillList = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'].map(key => ({
      key, label: key.charAt(0) + key.slice(1).toLowerCase(),
      score: skillProgress[key]?.score ?? 0, hasData: skillProgress[key]?.hasData ?? false
    }));
    const skillsWithData = skillList.filter(s => s.hasData);
    if (skillsWithData.length > 0) {
      const weakest = [...skillsWithData].sort((a, b) => a.score - b.score)[0];
      if (weakest.score < 6) {
        items.push({ level: 'warning', icon: '🧩', title: `Kỹ năng ${weakest.label} cần cải thiện`, message: `Kỹ năng ${weakest.label} hiện chỉ đạt ${weakest.score.toFixed(1)}/10 — thấp nhất trong 4 kỹ năng của bạn. Dành thêm thời gian luyện tập tại mục Huấn Luyện 4 Kỹ Năng để cải thiện.`, cta: { label: `Luyện ${weakest.label} Ngay`, href: skillHref[weakest.key] } });
      }
    }
    const untrained = skillList.find(s => !s.hasData);
    if (untrained && skillsWithData.length > 0) {
      items.push({ level: 'info', icon: '🌱', title: `Chưa luyện tập kỹ năng ${untrained.label}`, message: `Bạn chưa có dữ liệu luyện tập ${untrained.label}. Thử ngay để có bức tranh đầy đủ về năng lực 4 kỹ năng của mình.`, cta: { label: `Luyện ${untrained.label} Ngay`, href: skillHref[untrained.key] } });
    }

    if (user?.notebooks?.length > 0) {
      const topMistake = [...user.notebooks].sort((a: any, b: any) => b.mistakeCount - a.mistakeCount)[0];
      if (topMistake.mistakeCount >= 3) {
        items.push({ level: 'warning', icon: '📔', title: 'Lỗ hổng kiến thức cần khắc phục', message: `Bạn sai nhiều nhất ở chuyên đề "${topMistake.topic}" (${topMistake.mistakeCount} lần). Ôn lại chuyên đề này trong Sổ Tay Lỗi Sai để tránh lặp lại lỗi cũ.`, cta: { label: 'Xem Sổ Tay Lỗi Sai', tab: 'NOTEBOOK' } });
      }
    }

    if ((user?.streakCount || 0) >= 7) {
      items.push({ level: 'success', icon: '🔥', title: 'Chuỗi học tập ấn tượng', message: `Bạn đã duy trì streak ${user.streakCount} ngày học liên tục — đừng bỏ lỡ hôm nay để giữ vững thành tích này!` });
    }

    if (needsActionExams.length >= 3) {
      items.push({ level: 'critical', icon: '⚠️', title: 'Nhiều bài đang chờ xử lý', message: `Bạn có ${needsActionExams.length} bài tập/đề thi chưa làm hoặc chưa đạt điểm yêu cầu. Ưu tiên xử lý sớm để không bị dồn bài gần hạn nộp.`, cta: { label: 'Xem Bài Đang Chờ', tab: needsActionTargetTab } });
    }

    const severityOrder: Record<StudentInsight['level'], number> = { critical: 0, warning: 1, success: 2, info: 3 };
    return items.sort((a, b) => severityOrder[a.level] - severityOrder[b.level]).slice(0, 6);
  })();

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

  if (loading) return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden w-full">
      {/* Skeleton Sidebar */}
      <div className="hidden md:flex w-64 ui-sidebar flex-col shrink-0 h-full pt-6 px-4 gap-2">
        <div className="flex items-center gap-3 px-1 pb-5 border-b border-line mb-4">
          <div className="skeleton w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="skeleton h-3 rounded w-3/4" />
            <div className="skeleton h-2 rounded w-1/2 opacity-70" />
          </div>
        </div>
        {[80, 60, 70, 50, 65, 55].map((w, i) => (
          <div key={i} className="skeleton h-9 rounded-lg opacity-60" style={{ width: `${w}%` }} />
        ))}
      </div>
      {/* Skeleton Content */}
      <div className="flex-1 p-8 bg-background flex flex-col gap-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-4 gap-5">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-2xl" />)}
        </div>
        <div className="skeleton h-64 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    </div>
  );

  // Free-standing (no classroom) student whose trial/monthly subscription has expired —
  // computed server-side in GET /api/auth/me (see backend/src/utils/freeTrial.js). Full-app
  // lock: no dashboard, no self-practice tools, only contact info for the managing teacher.
  if (user?.accessLocked) return (
    <div className="flex h-[calc(100vh-80px)] w-full items-center justify-center bg-background p-4 sm:p-6">
      <div className="max-w-md w-full ui-card p-6 sm:p-8 text-center">
        <img
          src="/images/illustrations/locked.svg"
          alt="Minh hoạ tài khoản đang tạm khóa"
          width={800}
          height={600}
          loading="eager"
          className="w-full h-auto max-w-[240px] mx-auto mb-5"
        />
        <h1 className="text-xl font-bold mb-2 text-primary">Tài khoản đã tạm khóa</h1>
        <p className="text-muted text-sm mb-6 leading-relaxed">
          Thời gian dùng thử hoặc kỳ học phí tháng này của bạn đã kết thúc. Vui lòng liên hệ giáo viên phụ trách để đóng học phí và kích hoạt lại tài khoản.
        </p>
        {user.managerTeacher && (
          <div className="bg-primary-soft rounded-xl p-4 text-left mb-6 border border-line">
            <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Giáo viên phụ trách</p>
            <p className="font-bold text-primary">{user.managerTeacher.name}</p>
            {user.managerTeacher.phone && <p className="text-sm text-foreground mt-1"><span className="text-muted">Điện thoại: </span>{user.managerTeacher.phone}</p>}
            <p className="text-sm text-foreground mt-1"><span className="text-muted">Email: </span>{user.managerTeacher.email}</p>
          </div>
        )}
        <button
          onClick={() => { localStorage.removeItem('userId'); sessionStorage.removeItem('userId'); window.location.href = '/'; }}
          className="btn-outline px-6 py-2 text-sm cursor-pointer"
        >
          Đăng xuất
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden w-full relative">

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 md:z-auto w-64 ui-sidebar flex flex-col shrink-0 h-full overflow-y-auto shadow-2xl md:shadow-none transform transition-transform duration-300 md:relative md:translate-x-0 pt-5 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>

        <div className="mb-3 mx-3 px-2 pb-4 border-b border-line flex items-center gap-3">
          <label className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-bold text-lg shrink-0 cursor-pointer relative overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all group">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || 'H'
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold text-white tracking-wider">ĐỔI</span>
            </div>
          </label>
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-primary truncate">{user?.name || 'Học viên'}</h2>
            <p className="text-[10px] text-muted font-semibold uppercase tracking-widest">Học viên</p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 px-3">
          {navGroups.map((group: any, index) => (
            <div key={group.id} className={`flex flex-col ${index > 0 && (group.subItems || (navGroups[index - 1] as any).subItems) ? 'mt-3 pt-3 border-t border-line' : ''}`}>
              {group.subItems ? (
                <>
                  {/* Section label — muted, không phải nav item */}
                  <button
                    onClick={() => toggleNavGroup(group.id)}
                    className="ui-nav-group-label flex items-center justify-between gap-2 py-1.5 mb-0.5 transition-colors duration-150 cursor-pointer text-left hover:text-primary"
                  >
                    <span className="flex items-center gap-1.5">
                      {group.label}
                    </span>
                    <span className={`transform transition-transform ${expandedNav[group.id] ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {expandedNav[group.id] && (
                    <div className="flex flex-col gap-0.5">
                      {group.subItems.filter((item: any) => !item.featureKey || enabledFeatures.has(item.featureKey)).map((item: any) => (
                        item.isLink ? (
                          <Link key={item.id} href={item.href}
                            className="ui-nav-item text-sm">
                            <span className="truncate">{item.label}</span>
                          </Link>
                        ) : (
                          <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                            className={`ui-nav-item text-sm cursor-pointer ${activeTab === item.id ? 'ui-nav-item-active' : ''}`}>
                            <span className="truncate">{item.label}</span>
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </>
              ) : (
                /* Top-level nav item — rõ hơn section label */
                <button onClick={() => { setActiveTab(group.id); setIsMobileMenuOpen(false); }}
                  className={`ui-nav-item text-sm cursor-pointer ${activeTab === group.id ? 'ui-nav-item-active' : ''}`}>
                  <span className="truncate">{group.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="mt-auto border-t border-line px-3 py-3">
          <button
            onClick={() => { localStorage.removeItem('userId'); sessionStorage.removeItem('userId'); window.location.href = '/'; }}
            className="btn-ghost w-full px-3 py-2.5 text-sm cursor-pointer hover:text-red-600 hover:bg-red-50"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 pb-4 sm:px-6 sm:pb-6 md:p-8 h-full overflow-y-auto relative bg-background flex flex-col w-full">

        {/* Mobile Header with Hamburger */}
        <div className="md:hidden flex items-center justify-between -mx-4 sm:-mx-6 px-4 sm:px-6 h-[60px] mb-5 bg-white border-b border-line">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-lg border border-line text-primary hover:bg-primary-soft transition-colors">
              <span className="text-xl">☰</span>
            </button>
            <h2 className="font-extrabold text-primary tracking-tight">LUCY TUTOR</h2>
          </div>
        </div>

        {/* Free-standing student subscription reminder — shown on every tab once ≤7 days remain */}
        {user?.accessDaysRemaining !== null && user?.accessDaysRemaining !== undefined && user.accessDaysRemaining <= 7 && (
          <div className="mb-6 flex items-start sm:items-center gap-3 bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 text-amber-800 rounded-2xl px-4 sm:px-5 py-3.5 text-sm font-medium">
            <span className="leading-relaxed">
              Còn <b>{Math.max(user.accessDaysRemaining, 0)} ngày</b> nữa là đến hạn đóng học phí — liên hệ giáo viên phụ trách
              {user.managerTeacher ? ` (${user.managerTeacher.name}${user.managerTeacher.phone ? `, ${user.managerTeacher.phone}` : ''})` : ''} để gia hạn, tránh bị tạm khóa tài khoản.
            </span>
          </div>
        )}

        {/* Dashboard Header - User Info Sync */}
        {user && (
          <div className="ui-hero mb-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 px-5 sm:px-6 py-5 shadow-card">
            <div className="flex items-center gap-4 w-full sm:w-auto min-w-0">
              <label className="w-14 h-14 shrink-0 bg-white/15 ring-2 ring-white/40 text-white rounded-full flex items-center justify-center text-2xl font-bold cursor-pointer relative overflow-hidden group">
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
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold text-white">{user.name}</h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                  <p className="text-sm text-white/75 font-medium">
                    {user.classroomsJoined?.length > 0 ? `Lớp: ${user.classroomsJoined.map((c: any) => c.name).join(', ')}` : 'Chưa tham gia lớp học'}
                  </p>
                  <span className="text-white/40">•</span>
                  {(() => {
                    const xp = user.totalXP || 0;
                    const level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
                    const currentLevelXP = 50 * level * (level - 1);
                    const nextLevelXP = 50 * (level + 1) * level;
                    const xpInCurrentLevel = xp - currentLevelXP;
                    const xpNeededForNext = nextLevelXP - currentLevelXP;

                    let rank = { label: 'Tân Binh', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
                    if (level >= 20) rank = { label: 'Huyền Thoại', color: 'text-cyan-700 bg-cyan-50 border-cyan-200' };
                    else if (level >= 15) rank = { label: 'Bậc Thầy', color: 'text-amber-800 bg-amber-50 border-amber-200' };
                    else if (level >= 10) rank = { label: 'Tinh Anh', color: 'text-slate-700 bg-slate-50 border-slate-200' };
                    else if (level >= 5) rank = { label: 'Học Giả', color: 'text-primary bg-primary-soft border-white/60' };
                    
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
                          className={`px-3 py-1.5 rounded-full border text-xs font-bold ${rank.color} whitespace-nowrap cursor-pointer hover:opacity-90 transition-opacity inline-flex items-center`}
                        >
                          Cấp {level} - {rank.label}
                        </span>
                        <div className="flex items-center gap-2" title={`Cấp ${level}: ${xpInCurrentLevel} / ${xpNeededForNext} XP`}>
                          <div className="w-24 h-2 bg-white/20 rounded-full overflow-hidden relative group">
                            <div className="h-full bg-highlight rounded-full" style={{ width: `${(xpInCurrentLevel / xpNeededForNext) * 100}%` }} />
                          </div>
                          <span className="text-xs text-white/75 font-bold">{xpInCurrentLevel}/{xpNeededForNext}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-6 self-stretch lg:self-auto">
              <InstallPWAButton />
              {activeTab === "OVERVIEW" && (
                <img
                  src="/images/illustrations/study-progress.svg"
                  alt="Minh hoạ học viên theo dõi tiến độ học tập"
                  width={800}
                  height={600}
                  loading="eager"
                  className="hidden lg:block w-52 xl:w-60 h-auto -my-3"
                />
              )}
            </div>
          </div>
        )}

        {/* VIEW: OVERVIEW */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            <h1 className="ui-page-title">Tổng Quan Học Tập</h1>

            {!user?.classroomsJoined?.length && (
              <div className="ui-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-l-primary">
                <div className="flex items-center gap-4 w-full">
                  <div>
                    <h3 className="text-lg font-bold text-primary">Bạn đang học tự do</h3>
                    <p className="text-sm text-muted mt-1 leading-relaxed">Nhập mã lớp giáo viên cung cấp để mở khoá Bài Học, Bài Tập, Đề Thi, Chuyên Cần — hoặc cứ tiếp tục tự luyện với AI ở mục &ldquo;Huấn Luyện 4 Kỹ Năng&rdquo; và &ldquo;Trại Huấn Luyện&rdquo; bên menu trái.</p>
                  </div>
                </div>
                <form onSubmit={handleJoinClass} className="flex gap-2 w-full sm:w-auto shrink-0">
                  <input
                    type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
                    placeholder="Nhập mã lớp..."
                    className="ui-input flex-1 sm:w-40 text-sm"
                  />
                  <button type="submit" className="btn-primary px-5 py-2.5 text-sm whitespace-nowrap">
                    Tham gia
                  </button>
                </form>
              </div>
            )}

            {needsActionExams.length > 0 && (
              <div className="ui-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4 border-l-red-500">
                <div className="flex items-center gap-4 w-full">
                  <div>
                    <h3 className="text-lg font-bold text-red-700">Bạn có {needsActionExams.length} bài cần xử lý!</h3>
                    <p className="text-sm text-muted mt-1">Gồm các bài chưa làm hoặc chưa đạt điểm yêu cầu (dưới 7 điểm).</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab(needsActionTargetTab)}
                  className="btn-primary px-6 py-2.5 text-sm cursor-pointer whitespace-nowrap w-full sm:w-auto"
                >
                  Xử lý ngay →
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col justify-center border-t-4 border-t-primary">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wider">Điểm Trung Bình</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-extrabold text-primary">{avgScore}</p>
                    <span className="text-base text-muted font-medium">/10</span>
                  </div>
                </div>
              </div>

              <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col justify-center border-t-4 border-t-emerald-500">
                <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wider">Tiến Độ Mục Tiêu</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-extrabold text-emerald-600">{percentToTarget}<span className="text-base text-muted font-medium">%</span></p>
                    <span className="ui-badge mb-1">Target: {user?.targetScore}+</span>
                  </div>
                  <div className="w-full bg-emerald-50 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${percentToTarget}%` }}></div>
                  </div>
                </div>
              </div>

              <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col justify-center border-t-4 border-t-blue-500">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wider">Số Bài Đã Làm</p>
                  <p className="text-3xl font-extrabold text-primary">{totalExams} <span className="text-base text-muted font-medium">bài</span></p>
                </div>
              </div>

              <div className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col justify-center border-t-4 border-t-highlight">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wider">Tổng XP Tích Lũy</p>
                  <p className="text-3xl font-extrabold text-primary">{totalXP} <span className="text-base text-muted font-medium">XP</span></p>
                </div>
              </div>
            </div>

            {/* Practice grid (IOT-style) — built only from the self-practice links already in the sidebar, same featureKey gating */}
            {(() => {
              const practiceLinks = [...fourSkillsGroup.subItems, ...trainingCenterGroup.subItems]
                .filter((item: any) => !item.featureKey || enabledFeatures.has(item.featureKey));
              if (practiceLinks.length === 0) return null;
              return (
                <section>
                  <h3 className="ui-section-title text-lg mb-5">Luyện tập</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {practiceLinks.map((item: any) => (
                      <Link key={item.id} href={item.href} className="ui-card ui-card-hover overflow-hidden flex flex-col group">
                        <div className="aspect-video bg-primary-soft overflow-hidden">
                          <img
                            src={`/images/thumbs/${PRACTICE_THUMBS[item.href] || 'reading'}.svg`}
                            alt={`Ảnh minh hoạ ${item.label}`}
                            width={640}
                            height={360}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        </div>
                        <div className="p-4 sm:p-5 flex flex-col flex-1 gap-3">
                          <h4 className="font-bold text-primary leading-snug">{item.label}</h4>
                          <span className="btn-outline mt-auto self-start px-4 py-2 text-sm">Luyện ngay</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })()}

            {/* Learning insights — auto-generated recommendations from live profile/history/skill data */}
            <div className="ui-card p-5 sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="ui-section-title text-lg">Nhận Định & Gợi Ý Học Tập</h3>
                  <p className="text-sm text-muted mt-2">Tự động phân tích từ điểm số, kỹ năng và lỗi sai của bạn để biết cần cải thiện gì</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Tự động cập nhật mỗi 30 giây
                </span>
              </div>
              {studentInsights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {studentInsights.map((insight, i) => <InsightCard key={i} insight={insight} onNavigateTab={setActiveTab} />)}
                </div>
              ) : (
                <p className="text-sm text-muted italic">Chưa đủ dữ liệu để đưa ra gợi ý. Hãy làm thêm bài tập và luyện tập các kỹ năng để hệ thống phân tích chính xác hơn.</p>
              )}
            </div>

            {/* 4 Skills Panel */}
            <SkillsPanel user={user} />

            {/* Chart Section */}
            {history.length > 0 && (
              <div className="ui-card p-4 sm:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h4 className="ui-section-title text-lg">Biểu Đồ Tiến Bộ</h4>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setChartViewMode('day')} className={`ui-chip cursor-pointer ${chartViewMode === 'day' ? 'ui-chip-active' : ''}`}>Ngày</button>
                    <button onClick={() => setChartViewMode('week')} className={`ui-chip cursor-pointer ${chartViewMode === 'week' ? 'ui-chip-active' : ''}`}>Tuần</button>
                    <button onClick={() => setChartViewMode('month')} className={`ui-chip cursor-pointer ${chartViewMode === 'month' ? 'ui-chip-active' : ''}`}>Tháng</button>
                  </div>
                </div>
                <div className="h-[250px] sm:h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eaecef" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#5b6b82', fontSize: 12}} dy={10} />
                      <YAxis yAxisId="left" domain={[0, 10]} axisLine={false} tickLine={false} tick={{fill: '#5b6b82', fontSize: 12}} dx={-10} />
                      <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fill: '#3b82f6', opacity: 0.7, fontSize: 12}} dx={10} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #eaecef', boxShadow: '0 8px 20px rgba(30,58,138,.08)', backgroundColor: '#ffffff', color: '#1f2d3d' }}
                        itemStyle={{ fontWeight: '800', fontSize: '1rem' }}
                        formatter={(value: any, name: any) => [name === 'score' ? `${value} Điểm` : `${value} Phút`, name === 'score' ? 'Điểm số' : 'Thời gian']}
                        labelStyle={{ color: '#5b6b82', margin: 0, paddingBottom: '8px', fontWeight: 'bold' }}
                      />
                      <Line yAxisId="left" type="monotone" dataKey="score" name="score" stroke="#1E3A8A" strokeWidth={3} dot={{ r: 4, fill: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
                      <Line yAxisId="right" type="monotone" dataKey="attempts" name="attempts" stroke="#3b82f6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* History Table */}
            {history.length > 0 && (
              <div className="ui-card overflow-hidden">
                <div className="p-5 sm:p-6 border-b border-line">
                  <h4 className="ui-section-title text-lg">Lịch Sử Bài Làm Gần Đây</h4>
                </div>
                <div className="overflow-x-auto w-full">
                  <table className="ui-table min-w-[500px]">
                    <thead>
                      <tr>
                        <th>Tên Bài Thi</th>
                        <th>Thời Gian Làm</th>
                        <th>Thời Lượng</th>
                        <th className="text-right">Điểm Số</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...history].reverse().slice(0, 10).map((item, i) => {
                        const scoreColor = item.score >= 8 ? 'text-emerald-700' : item.score >= 5 ? 'text-amber-700' : 'text-red-700';
                        const scoreBg = item.score >= 8 ? 'bg-emerald-50' : item.score >= 5 ? 'bg-amber-50' : 'bg-red-50';
                        return (
                          <tr key={i} className="group">
                            <td className="font-bold text-foreground">{item.exam?.title || "Bài thi"}</td>
                            <td className="text-muted text-sm">
                              {new Date(item.createdAt).toLocaleDateString('vi-VN')} <span className="opacity-60">lúc</span> {new Date(item.createdAt).toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'})}
                            </td>
                            <td className="text-muted text-sm">
                              {Math.floor(item.timeSpent / 60)} phút {item.timeSpent % 60} giây
                            </td>
                            <td className="text-right">
                              <span className={`inline-flex px-3 py-1 rounded-full text-sm font-extrabold ${scoreBg} ${scoreColor}`}>
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
              <div className="ui-card p-8 sm:p-12 flex flex-col justify-center items-center text-center">
                <EmptyIllustration />
                <h2 className="text-xl font-bold text-primary mb-2">Chưa có dữ liệu</h2>
                <p className="text-muted max-w-md">Bạn chưa hoàn thành bài thi nào. Hãy bắt đầu làm bài để tích lũy dữ liệu thống kê nhé!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: LESSONS */}
        {activeTab === "LESSONS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
              <h1 className="ui-page-title">Bài Học Của Bạn</h1>
              {(user?.classroomsJoined?.length || 0) > 1 && (
                <select className="ui-input w-auto text-sm font-medium" value={lessonClassFilter} onChange={e => setLessonClassFilter(e.target.value)}>
                  <option value="">Tất cả các lớp</option>
                  {user.classroomsJoined.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            {(() => {
              return filteredLessons.length === 0 ? (
              <div className="ui-card p-8 sm:p-12 flex flex-col justify-center items-center text-center">
                <EmptyIllustration />
                <h2 className="text-xl font-bold text-primary mb-2">Chưa có bài học nào</h2>
                <p className="text-muted max-w-md">{user?.classroomsJoined?.length ? 'Hiện tại lớp của bạn chưa có bài học mới.' : 'Bài học do giáo viên soạn — tham gia 1 lớp học để xem bài học của lớp đó.'}</p>
                {!user?.classroomsJoined?.length && (
                  <JoinClassPrompt hint="" joinCode={joinCode} setJoinCode={setJoinCode} onSubmit={handleJoinClass} />
                )}
              </div>
            ) : (
              <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {lessonsPagination.pageItems.map(lesson => {
                  const progress = lesson.progress?.find((p: any) => p.userId === user?.id);
                  const isCompleted = progress?.status === 'COMPLETED';
                  return (
                    <div key={lesson.id} className="ui-card ui-card-hover overflow-hidden flex flex-col">
                      <div className="aspect-video bg-primary-soft overflow-hidden">
                        <img src="/images/thumbs/lesson.svg" alt="Ảnh minh hoạ bài học" width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-5 flex flex-col flex-1 gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg text-primary leading-snug">{lesson.title}</h3>
                          <p className="text-sm text-muted mt-1">{lesson.vocabularies?.length || 0} từ vựng • {lesson.grammars?.length || 0} ngữ pháp</p>
                        </div>
                        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line">
                          {isCompleted ? (
                            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs">Đã học</span>
                          ) : (
                            <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs">Chưa học</span>
                          )}
                          <Link href={`/lesson/${lesson.id}`} className="btn-primary px-5 py-2 text-sm whitespace-nowrap">
                            Học Ngay <span>→</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Pagination page={lessonsPagination.page} totalPages={lessonsPagination.totalPages} totalItems={lessonsPagination.totalItems} pageSize={LIST_PAGE_SIZE} onPageChange={lessonsPagination.setPage} />
              </div>
              );
            })()}
          </div>
        )}

        {/* VIEW: PRACTICE */}
        {activeTab === "PRACTICE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="ui-page-title mb-6">Bài Tập Về Nhà</h1>

            {(() => {
              if (practiceAssignments.length === 0) return (
                <div className="ui-card p-8 sm:p-12 flex flex-col justify-center items-center text-center">
                  <EmptyIllustration />
                  <h2 className="text-xl font-bold text-primary mb-2">Chưa có bài tập nào</h2>
                  <p className="text-muted max-w-md">{user?.classroomsJoined?.length ? 'Hiện tại bạn chưa được giao bài tập về nhà. Hãy quay lại sau nhé!' : 'Bài tập do giáo viên giao — tham gia 1 lớp học để bắt đầu nhận bài tập.'}</p>
                  {!user?.classroomsJoined?.length && (
                    <JoinClassPrompt hint="" joinCode={joinCode} setJoinCode={setJoinCode} onSubmit={handleJoinClass} />
                  )}
                </div>
              );

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {practicePagination.pageItems.map((e: any) => (
                    <div key={e.id} className="ui-card ui-card-hover overflow-hidden flex flex-col">
                      <div className="aspect-video bg-primary-soft overflow-hidden">
                        <img src="/images/thumbs/exam.svg" alt="Ảnh minh hoạ bài tập" width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-5 flex flex-col flex-1 gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg text-primary leading-snug">{e.title}</h3>
                          <p className="text-sm text-muted mt-1">{e.totalQuestions} câu hỏi • {e.duration || 45} phút • Tối đa {e.maxAttempts || 1} lần làm</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {e.deadline && <span className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full">Hạn: {new Date(e.deadline).toLocaleString('vi-VN')}</span>}
                            {e.notes && <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">{e.notes}</span>}
                          </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-line">
                      {(() => {
                        const attempts = history.filter(h => h.examId === e.id).length;
                        const maxAttempts = e.maxAttempts || 1;
                        if (attempts >= maxAttempts) {
                          return <span className="block px-6 py-2.5 rounded-full bg-slate-100 text-muted text-sm font-bold cursor-not-allowed w-full text-center whitespace-nowrap">Hết Lượt ({attempts}/{maxAttempts})</span>;
                        }
                        return (
                          <Link href={`/exam/${e.id}`} className="btn-primary px-6 py-2.5 text-sm w-full whitespace-nowrap">
                            Làm Bài ({attempts}/{maxAttempts}) <span>→</span>
                          </Link>
                        );
                      })()}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                  <Pagination page={practicePagination.page} totalPages={practicePagination.totalPages} totalItems={practicePagination.totalItems} pageSize={LIST_PAGE_SIZE} onPageChange={practicePagination.setPage} />
                </div>
              );
            })()}
          </div>
        )}

        {/* VIEW: EXAMS */}
        {activeTab === "EXAMS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="ui-page-title mb-6">Bài Kiểm Tra (Exams)</h1>

            {(() => {
              if (examTests.length === 0) return (
                <div className="ui-card p-8 sm:p-12 flex flex-col justify-center items-center text-center">
                  <EmptyIllustration />
                  <h2 className="text-xl font-bold text-primary mb-2">Chưa có bài kiểm tra</h2>
                  <p className="text-muted max-w-md">{user?.classroomsJoined?.length ? 'Chưa có bài thi nào sắp diễn ra hoặc đã hoàn thành. Chăm chỉ luyện tập chờ kỳ thi tiếp theo nhé!' : 'Bài kiểm tra do giáo viên tổ chức — tham gia 1 lớp học để tham gia các kỳ thi của lớp.'}</p>
                  {!user?.classroomsJoined?.length && (
                    <JoinClassPrompt hint="" joinCode={joinCode} setJoinCode={setJoinCode} onSubmit={handleJoinClass} />
                  )}
                </div>
              );

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {examsPagination.pageItems.map((e: any) => (
                    <div key={e.id} className="ui-card ui-card-hover overflow-hidden flex flex-col">
                      <div className="aspect-video bg-primary-soft overflow-hidden">
                        <img src="/images/thumbs/exam.svg" alt="Ảnh minh hoạ bài kiểm tra" width={640} height={360} loading="lazy" className="w-full h-full object-cover" />
                      </div>
                      <div className="p-5 flex flex-col flex-1 gap-4">
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg text-primary leading-snug">{e.title}</h3>
                          <p className="text-sm text-muted mt-1">{e.totalQuestions} câu hỏi • {e.duration || 60} phút • Tối đa {e.maxAttempts || 1} lần làm</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            {e.deadline && <span className="text-xs font-semibold bg-red-50 text-red-700 px-2.5 py-0.5 rounded-full">Hạn: {new Date(e.deadline).toLocaleString('vi-VN')}</span>}
                            {e.notes && <span className="text-xs font-semibold bg-amber-50 text-amber-700 px-2.5 py-0.5 rounded-full">{e.notes}</span>}
                          </div>
                        </div>
                        <div className="mt-auto pt-4 border-t border-line">
                      {(() => {
                        const examHistory = history.filter(h => h.examId === e.id);
                        const attempts = examHistory.length;
                        const maxAttempts = e.maxAttempts || 1;
                        const maxScore = attempts > 0 ? Math.max(...examHistory.map(h => h.score)) : 0;
                        
                        if (attempts >= maxAttempts) {
                          if (maxScore < 5) {
                            return <span className="block px-6 py-2.5 rounded-full bg-red-50 text-red-700 text-sm font-bold cursor-not-allowed w-full text-center whitespace-nowrap">Khóa (Thi Trượt)</span>;
                          }
                          return <span className="block px-6 py-2.5 rounded-full bg-slate-100 text-muted text-sm font-bold cursor-not-allowed w-full text-center whitespace-nowrap">Hết Lượt ({attempts}/{maxAttempts})</span>;
                        }
                        return (
                          <Link href={`/exam/${e.id}`} className="btn-primary px-6 py-2.5 text-sm w-full whitespace-nowrap">
                            Thi Ngay ({attempts}/{maxAttempts}) <span>→</span>
                          </Link>
                        );
                      })()}
                        </div>
                      </div>
                    </div>
                  ))}
                  </div>
                  <Pagination page={examsPagination.page} totalPages={examsPagination.totalPages} totalItems={examsPagination.totalItems} pageSize={LIST_PAGE_SIZE} onPageChange={examsPagination.setPage} />
                </div>
              );
            })()}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "DOCUMENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
               <h1 className="ui-page-title">Kho Tài Liệu</h1>
               <input
                 type="text"
                 placeholder="Tìm kiếm tài liệu..."
                 value={searchDocQuery}
                 onChange={e => setSearchDocQuery(e.target.value)}
                 className="ui-input md:w-1/3"
               />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDocuments.length === 0 && <div className="text-muted italic col-span-full ui-card p-8 flex flex-col items-center text-center"><EmptyIllustration />Không tìm thấy tài liệu phù hợp</div>}
              {documentsPagination.pageItems.map((doc: any) => (
                <div key={doc.id} className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col justify-between group relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 flex gap-2">
                     <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase ${doc.visibility === 'PUBLIC' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-soft text-primary'}`}>
                        {doc.visibility === 'CLASS' ? (doc.classroom?.name || 'Lớp') : 'Chung'}
                     </span>
                  </div>
                  <div>
                    <div className="w-14 h-14 rounded-xl bg-background flex items-center justify-center mb-4">
                       {doc.fileType === '.pdf' ? (
                          <svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 4 h22 l10 10 v30 h-32 Z" fill="#fff" stroke="#e11d48" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M30 4 v10 h10" fill="none" stroke="#e11d48" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M22 20 c0 0 -2 -6 -5 -6 c-2 0 -3 2 -1 4 c2 2 4 4 6 7 c2 3 1 6 3 6 c2 0 3 -1 2 -3 c-1 -2 -3 -3 -5 -5 c-1 -2 -2 -5 -2 -5 c0 0 2 0 2 2 z" fill="none" stroke="#e11d48" strokeWidth="2"/>
                            <text x="13" y="38" fontFamily="Arial" fontSize="12" fontWeight="bold" fill="#1f2937">PDF</text>
                          </svg>
                       ) : (doc.fileType === '.ppt' || doc.fileType === '.pptx') ? (
                          <svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8 4 h22 l10 10 v30 h-32 Z" fill="#fff" stroke="#d2691e" strokeWidth="2" strokeLinejoin="round"/>
                            <path d="M30 4 v10 h10" fill="none" stroke="#d2691e" strokeWidth="2" strokeLinejoin="round"/>
                            <text x="11" y="38" fontFamily="Arial" fontSize="11" fontWeight="bold" fill="#1f2937">PPT</text>
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
                    <h3 className="font-bold text-lg text-primary line-clamp-2 mb-1" title={doc.title}>{doc.title}</h3>
                    <p className="text-xs text-muted mb-4">{new Date(doc.createdAt).toLocaleDateString('vi-VN')} • {(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div className="flex gap-2 z-10">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download={doc.title} className="btn-outline flex-1 py-2 text-sm cursor-pointer z-10 relative">Tải xuống</a>
                  </div>
                </div>
              ))}
            </div>
            <Pagination page={documentsPagination.page} totalPages={documentsPagination.totalPages} totalItems={documentsPagination.totalItems} pageSize={LIST_PAGE_SIZE} onPageChange={documentsPagination.setPage} />
          </div>
        )}

        {/* ── ATTENDANCE ── */}
        {activeTab === "ATTENDANCE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
              <h1 className="ui-page-title">Chuyên Cần & Học Phí</h1>
              <input
                type="month"
                value={attMonth}
                onChange={e => setAttMonth(e.target.value)}
                className="ui-input w-auto font-bold"
              />
            </div>

            {attReports.length === 0 ? (
              <div className="text-center text-muted py-12 px-4 ui-card flex flex-col items-center">
                <EmptyIllustration />
                <p className="text-lg font-bold text-primary mb-2">Không có dữ liệu tháng này</p>
                <p className="text-sm">{user?.classroomsJoined?.length ? 'Tháng này bạn chưa được điểm danh ở lớp nào.' : 'Chuyên cần & học phí gắn với lớp học — tham gia 1 lớp học để xem dữ liệu điểm danh.'}</p>
                {!user?.classroomsJoined?.length && (
                  <JoinClassPrompt hint="" joinCode={joinCode} setJoinCode={setJoinCode} onSubmit={handleJoinClass} />
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {attReports.map((report: any) => (
                  <div key={report.classroomId} className="ui-card ui-card-hover p-5 sm:p-6">
                    <div className="flex flex-wrap justify-between items-center gap-2 border-b border-line pb-4 mb-4">
                      <h2 className="text-lg font-bold text-primary flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block shrink-0"></span>
                        <span className="truncate">{report.classroomName}</span>
                      </h2>
                      {report.isPaid ? (
                        <div className="bg-emerald-50 text-emerald-700 px-3.5 py-1 rounded-full font-bold text-xs shrink-0">
                          Đã thanh toán: {new Date(report.paidAt).toLocaleDateString('vi-VN')}
                        </div>
                      ) : (
                        <div className="bg-red-50 text-red-700 px-3.5 py-1 rounded-full font-bold text-xs shrink-0">
                          Chưa thanh toán
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-background border border-line">
                        <p className="text-sm text-muted mb-1">Số buổi đã học (có mặt)</p>
                        <p className="text-2xl font-extrabold text-foreground">{report.presentCount}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-primary-soft">
                        <p className="text-sm text-primary/80 mb-1 font-bold">Học phí tháng {attMonth.split('-')[1]}</p>
                        <p className="text-2xl font-extrabold text-primary">{report.totalAmount.toLocaleString()} VNĐ</p>
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
            <h1 className="ui-page-title mb-6">Lịch Học & Bài Tập</h1>
            <div className="flex-1 min-h-[500px] ui-card p-3 sm:p-5">
              <CalendarComponent user={user} role="STUDENT" />
            </div>
          </div>
        )}

        {/* VIEW: NOTEBOOK */}
        {activeTab === "NOTEBOOK" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-end mb-6">
              <div className="flex-1">
                <h1 className="ui-page-title mb-2">Sổ Tay Lỗi Sai</h1>
                <p className="ui-page-subtitle">Gia sư Lucy đã tự động tổng hợp các lỗ hổng kiến thức của bạn dựa trên những câu làm sai.</p>
              </div>
            </div>

            {user?.notebooks?.length > 0 ? (
              <div className="space-y-8">
                {/* Chart Top Mistakes */}
                <div className="ui-card p-5 sm:p-6">
                  <h3 className="ui-section-title text-lg mb-6">Top Lỗi Mắc Phải Nhiều Nhất</h3>
                  <div className="space-y-4">
                    {[...user.notebooks].sort((a: any, b: any) => b.mistakeCount - a.mistakeCount).slice(0, 5).map((nb: any, index: number) => {
                      const maxCount = Math.max(...user.notebooks.map((n: any) => n.mistakeCount));
                      const percent = (nb.mistakeCount / maxCount) * 100;
                      return (
                        <div key={nb.id} className="flex items-center gap-3 sm:gap-4">
                          <div className="w-1/3 truncate text-sm font-bold text-foreground" title={nb.topic}>{nb.topic}</div>
                          <div className="flex-1 h-2.5 bg-primary-soft rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                          <div className="w-14 text-right text-sm font-bold text-primary whitespace-nowrap">{nb.mistakeCount} lỗi</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {notebooksPagination.pageItems.map((nb: any) => (
                    <div key={nb.id} className="ui-card ui-card-hover p-5 sm:p-6 flex flex-col h-full">
                      <div className="flex justify-between items-start gap-3 mb-2">
                        <h3 className="font-bold text-lg text-primary line-clamp-2">{nb.topic}</h3>
                        <span className="bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full text-xs whitespace-nowrap shrink-0">{nb.mistakeCount} lần sai</span>
                      </div>
                      <p className="text-xs text-muted mb-4 font-medium flex items-center gap-1">
                        Cập nhật: {new Date(nb.updatedAt).toLocaleDateString('vi-VN')}
                      </p>

                      <div className="mt-auto pt-4 border-t border-line flex justify-end">
                        <button
                          onClick={() => setSelectedNotebookForView(nb)}
                          className="btn-outline px-4 py-2 text-sm cursor-pointer"
                        >
                          Xem Chi Tiết Giải Thích
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <Pagination page={notebooksPagination.page} totalPages={notebooksPagination.totalPages} totalItems={notebooksPagination.totalItems} pageSize={LIST_PAGE_SIZE} onPageChange={notebooksPagination.setPage} />
              </div>
            ) : (
              <div className="ui-card p-8 sm:p-12 flex flex-col justify-center items-center text-center">
                <EmptyIllustration />
                <h2 className="text-xl font-bold text-primary mb-2">Sổ tay trống</h2>
                <p className="text-muted max-w-md">Bạn chưa có câu làm sai nào cần ghi chú. Hoàn thành bài tập để AI Lucy tự động tạo sổ tay điểm yếu cho bạn nhé!</p>
              </div>
            )}
          </div>
        )}

        {/* VIEW: LEADERBOARD */}
        {activeTab === "LEADERBOARD" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl relative pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h1 className="ui-page-title">Bảng Xếp Hạng</h1>
              <div className="flex gap-2 overflow-x-auto max-w-full pb-1">
                <button
                  onClick={() => setLeaderboardFilter('GLOBAL')}
                  className={`ui-chip cursor-pointer ${leaderboardFilter === 'GLOBAL' ? 'ui-chip-active' : ''}`}
                >
                  Toàn Hệ Thống
                </button>
                {(user?.classroomsJoined || []).map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setLeaderboardFilter(c.id)}
                    className={`ui-chip cursor-pointer ${leaderboardFilter === c.id ? 'ui-chip-active' : ''}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Podium for Top 3 */}
            {leaderboardData.length > 0 && (
              <div className="ui-card flex justify-center items-end gap-2 sm:gap-6 mb-8 pt-10 px-4 sm:px-8 overflow-hidden">
                {/* 2nd Place */}
                {leaderboardData.length > 1 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100 w-1/3 max-w-[90px] sm:max-w-[120px]">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#C0C0C0] bg-white flex items-center justify-center font-bold text-xl overflow-hidden shadow-card">
                        {leaderboardData[1].avatar ? <img src={leaderboardData[1].avatar} className="w-full h-full object-cover"/> : leaderboardData[1].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#C0C0C0] text-black text-xs font-black px-2 py-0.5 rounded-full border border-surface">#2</div>
                    </div>
                    <div className="text-sm font-bold text-foreground mt-3 text-center w-full truncate">{leaderboardData[1].name}</div>
                    <div className="text-xs text-muted font-bold">{leaderboardData[1].totalXP} XP</div>
                    <div className="w-full h-24 sm:h-32 bg-primary-soft rounded-t-xl mt-2 border-t-4 border-[#C0C0C0]"></div>
                  </div>
                )}
                
                {/* 1st Place */}
                {leaderboardData.length > 0 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 z-10 relative w-1/3 max-w-[100px] sm:max-w-[140px]">
                    <div className="relative mb-2">
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-[#FFD700] bg-white flex items-center justify-center font-bold text-3xl overflow-hidden shadow-card-hover">
                        {leaderboardData[0].avatar ? <img src={leaderboardData[0].avatar} className="w-full h-full object-cover"/> : leaderboardData[0].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black text-xs font-black px-3 py-0.5 rounded-full border border-surface">#1</div>
                    </div>
                    <div className="text-base font-extrabold mt-3 text-center w-full truncate text-primary">{leaderboardData[0].name}</div>
                    <div className="text-sm text-muted font-bold">{leaderboardData[0].totalXP} XP</div>
                    <div className="w-full h-32 sm:h-40 bg-primary/15 rounded-t-xl mt-2 border-t-4 border-[#FFD700]"></div>
                  </div>
                )}

                {/* 3rd Place */}
                {leaderboardData.length > 2 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-200 w-1/3 max-w-[90px] sm:max-w-[120px]">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#CD7F32] bg-white flex items-center justify-center font-bold text-xl overflow-hidden shadow-card">
                        {leaderboardData[2].avatar ? <img src={leaderboardData[2].avatar} className="w-full h-full object-cover"/> : leaderboardData[2].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#CD7F32] text-white text-xs font-black px-2 py-0.5 rounded-full border border-surface">#3</div>
                    </div>
                    <div className="text-sm font-bold text-foreground mt-3 text-center w-full truncate">{leaderboardData[2].name}</div>
                    <div className="text-xs text-muted font-bold">{leaderboardData[2].totalXP} XP</div>
                    <div className="w-full h-20 sm:h-24 bg-primary-soft rounded-t-xl mt-2 border-t-4 border-[#CD7F32]"></div>
                  </div>
                )}
              </div>
            )}

            {/* List */}
            {leaderboardData.length === 0 ? (
              <div className="text-center p-12 ui-card text-muted flex flex-col items-center"><EmptyIllustration />Chưa có dữ liệu xếp hạng.</div>
            ) : (
              <div className="ui-card overflow-hidden">
                {leaderboardPagination.pageItems.map((u, idx) => (
                  <div key={u.id} className={`flex items-center px-4 py-3 border-b border-line last:border-0 hover:bg-[#fafbfd] transition-colors ${u.id === user?.id ? 'bg-primary-soft shadow-[inset_3px_0_0_var(--primary)]' : ''}`}>
                    <div className="w-12 text-center font-bold text-muted">#{u.rank}</div>
                    <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center overflow-hidden mr-4 shrink-0 font-bold text-sm">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-foreground truncate text-sm sm:text-base">{u.name} {u.id === user?.id && <span className="ml-2 ui-badge bg-primary text-white">Bạn</span>}</div>
                      <div className="text-xs text-muted">Mục tiêu: {u.targetScore || 7.0}+</div>
                    </div>
                    <div className="font-extrabold text-primary text-sm sm:text-base whitespace-nowrap">{u.totalXP} <span className="text-xs text-muted font-normal">XP</span></div>
                  </div>
                ))}
                <div className="p-4 border-t border-line">
                  <Pagination page={leaderboardPagination.page} totalPages={leaderboardPagination.totalPages} totalItems={leaderboardPagination.totalItems} pageSize={15} onPageChange={leaderboardPagination.setPage} />
                </div>
              </div>
            )}

            {/* Current User Fixed Bottom Bar */}
            {leaderboardCurrentUser && (
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-3xl bg-white rounded-2xl border border-line shadow-card-hover p-4 flex items-center z-50 animate-in slide-in-from-bottom-10">
                <div className="w-12 text-center font-extrabold text-xl text-primary">#{leaderboardCurrentUser.rank}</div>
                <div className="w-10 h-10 rounded-full bg-primary-soft text-primary flex items-center justify-center overflow-hidden mr-4 shrink-0 font-bold text-sm border-2 border-primary/20">
                  {leaderboardCurrentUser.avatar ? <img src={leaderboardCurrentUser.avatar} className="w-full h-full object-cover"/> : leaderboardCurrentUser.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-primary truncate text-sm sm:text-base">Thứ hạng của bạn</div>
                  <div className="text-xs text-muted">{leaderboardFilter === 'GLOBAL' ? 'Toàn hệ thống' : 'Trong lớp học'}</div>
                </div>
                <div className="font-extrabold text-primary text-lg sm:text-xl whitespace-nowrap">{leaderboardCurrentUser.totalXP} <span className="text-xs text-muted font-normal">XP</span></div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: SETTINGS */}
        {activeTab === "SETTINGS" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl">
            <h1 className="ui-page-title">Cài Đặt Tài Khoản</h1>
            <p className="ui-page-subtitle mb-6">Quản lý thông tin cá nhân, bảo mật và lớp học của bạn.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="space-y-6">

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
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
              className="ui-card p-5 sm:p-7 space-y-5"
            >
              <div className="flex items-center gap-4 mb-1">
                                <div>
                  <h2 className="text-lg font-bold text-primary">Thông Tin Cá Nhân</h2>
                  <p className="text-xs text-muted">Thông tin liên hệ và mục tiêu học tập</p>
                </div>
              </div>

              <div>
                <label className="ui-label">Họ và Tên</label>
                <input type="text" disabled defaultValue={user?.name} className="ui-input bg-background text-muted cursor-not-allowed" />
              </div>

              <div>
                <label className="ui-label">Email</label>
                <input type="email" disabled defaultValue={user?.email} className="ui-input bg-background text-muted cursor-not-allowed" />
              </div>

              <div>
                <label className="ui-label">Số điện thoại liên hệ</label>
                <input type="tel" name="phone" defaultValue={user?.phone || ''} placeholder="0987654321" className="ui-input" />
              </div>

              <div>
                <label className="ui-label">Mục tiêu điểm số</label>
                <select name="targetScore" defaultValue={user?.targetScore || 7.0} className="ui-input font-medium">
                  <option value="5">5.0 - Cơ bản</option>
                  <option value="6">6.0 - Trung bình khá</option>
                  <option value="7">7.0 - Khá</option>
                  <option value="8">8.0 - Giỏi</option>
                  <option value="9">9.0 - Xuất sắc</option>
                  <option value="10">10 - Thủ khoa</option>
                </select>
              </div>

              <button type="submit" className="btn-primary w-full py-3 cursor-pointer">
                Lưu Thay Đổi
              </button>
            </form>

            <form onSubmit={handleChangePassword} className="ui-card p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-4 mb-1">
                                <div>
                  <h2 className="text-lg font-bold text-primary">Đổi Mật Khẩu</h2>
                  <p className="text-xs text-muted">Bảo mật tài khoản của bạn</p>
                </div>
              </div>

              <div>
                <label className="ui-label">Mật khẩu hiện tại</label>
                <input
                  type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Mật khẩu mới</label>
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6}
                  className="ui-input"
                />
              </div>
              <div>
                <label className="ui-label">Nhập lại mật khẩu mới</label>
                <input
                  type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required minLength={6}
                  className="ui-input"
                />
              </div>
              <button type="submit" disabled={changingPassword} className="btn-primary w-full py-3 cursor-pointer disabled:opacity-50">
                {changingPassword ? 'Đang xử lý...' : 'Đổi Mật Khẩu'}
              </button>
            </form>
            </div>

            <div className="space-y-6">
            {user?.managerTeacher && (() => {
              const statusMeta = user.accessLocked
                ? { label: 'Đã khóa', badge: 'bg-red-50 text-red-700', circle: 'bg-red-50', icon: '🔒' }
                : paymentHistory.length > 0
                ? { label: 'Đang hoạt động', badge: 'bg-emerald-50 text-emerald-700', circle: 'bg-emerald-50', icon: '✅' }
                : { label: 'Đang dùng thử', badge: 'bg-amber-50 text-amber-700', circle: 'bg-amber-50', icon: '⏳' };
              return (
              <div className="ui-card p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-4 mb-1">
                                    <div>
                    <h2 className="text-lg font-bold text-primary">Tình Trạng Tài Khoản</h2>
                    <p className="text-xs text-muted">Học phí & quyền sử dụng của bạn</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${statusMeta.badge}`}>
                    {statusMeta.label}
                  </span>
                  {!user.accessLocked && user.accessDaysRemaining !== null && user.accessDaysRemaining !== undefined && (
                    <span className="text-sm text-muted">
                      Còn <b>{Math.max(user.accessDaysRemaining, 0)} ngày</b> sử dụng
                      {user.accessExpiresAt && ` (hết hạn ${new Date(user.accessExpiresAt).toLocaleDateString('vi-VN')})`}
                    </span>
                  )}
                </div>

                <div className="bg-background rounded-xl p-4 border border-line">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Giáo viên phụ trách</p>
                  <p className="font-bold text-primary">{user.managerTeacher.name}</p>
                  {user.managerTeacher.phone && <p className="text-sm text-muted mt-1">Điện thoại: {user.managerTeacher.phone}</p>}
                  <p className="text-sm text-muted mt-1">Email: {user.managerTeacher.email}</p>
                </div>

                <div>
                  <p className="text-sm font-bold mb-2 text-foreground">Lịch sử thanh toán</p>
                  {paymentHistory.length === 0 ? (
                    <p className="text-sm text-muted">Chưa có lần thanh toán nào.</p>
                  ) : (
                    <div className="space-y-2">
                      {paymentHistory.map((p: any) => (
                        <div key={p.id} className="flex flex-wrap justify-between items-center gap-1 text-sm bg-background rounded-xl px-4 py-3 border border-line">
                          <span className="flex items-center gap-2 text-muted min-w-0">
                            <span className="truncate">{new Date(p.paidAt).toLocaleDateString('vi-VN')} — hết hạn {new Date(p.periodEnd).toLocaleDateString('vi-VN')}</span>
                          </span>
                          <span className="font-bold text-primary shrink-0">{p.amount.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            <div className="ui-card p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-4 mb-1">
                                <div>
                  <h2 className="text-lg font-bold text-primary">Lớp Học Của Tôi</h2>
                  <p className="text-xs text-muted">Các lớp bạn đã tham gia</p>
                </div>
              </div>
              {!user?.classroomsJoined?.length ? (
                <p className="text-sm text-muted">Bạn chưa tham gia lớp nào — nhập mã lớp ở bên dưới để bắt đầu.</p>
              ) : (
                <div className="space-y-2">
                  {user.classroomsJoined.map((c: any) => {
                    const dayMap: Record<number, string> = { 0: 'CN', 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' };
                    let days: number[] = [];
                    try { days = JSON.parse(c.scheduleDays || '[]'); } catch {}
                    const daysStr = days.length > 0 ? days.sort((a: number, b: number) => a - b).map((d: number) => dayMap[d]).join(' - ') : null;
                    return (
                      <div key={c.id} className="bg-background rounded-xl p-4 border border-line">
                        <p className="font-bold text-primary">{c.name}</p>
                        {daysStr && (
                          <p className="text-sm text-muted mt-1">
                            {daysStr}{c.startTime && c.endTime && ` · ${c.startTime}-${c.endTime}`}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ui-card p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-4 mb-1">
                                <div>
                  <h2 className="text-lg font-bold text-primary">Tham Gia Lớp Học</h2>
                  <p className="text-xs text-muted">Nhập mã lớp do giáo viên cung cấp</p>
                </div>
              </div>
              <p className="text-sm text-muted">Nhập mã lớp để tham gia làm bài tập và đề thi được giao.</p>
              <form onSubmit={handleJoinClass} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                <div className="flex-1 w-full">
                  <label className="ui-label">Mã Lớp Học (Join Code)</label>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="VD: A1B2C3"
                    className="ui-input uppercase"
                    required
                  />
                </div>
                <button type="submit" className="btn-primary w-full sm:w-auto px-6 py-3 cursor-pointer whitespace-nowrap">
                  Tham Gia
                </button>
              </form>
            </div>

            <div className="ui-card p-5 sm:p-7 space-y-4">
              <div className="flex items-center gap-4 mb-1">
                                <div>
                  <h2 className="text-lg font-bold text-primary">Đăng Xuất</h2>
                  <p className="text-xs text-muted">Thoát khỏi tài khoản trên thiết bị này</p>
                </div>
              </div>
              <button
                onClick={() => { localStorage.removeItem('userId'); sessionStorage.removeItem('userId'); window.location.href = '/'; }}
                className="w-full py-3 rounded-full border border-red-200 bg-white text-red-600 font-bold hover:bg-red-50 transition-colors cursor-pointer"
              >
                Đăng Xuất
              </button>
            </div>
            </div>
            </div>
          </div>
        )}

      </div>
      
      {/* Notebook Detail Modal */}
      {selectedNotebookForView && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 sm:p-8 w-full max-w-2xl max-h-[90vh] flex flex-col border border-line shadow-card-hover animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start gap-3 mb-6 border-b border-line pb-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-primary mb-2">{selectedNotebookForView.topic}</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="bg-red-50 text-red-700 font-bold px-3 py-1 rounded-full text-xs">Mắc lỗi: {selectedNotebookForView.mistakeCount} lần</span>
                  <span className="text-xs text-muted font-medium">Cập nhật lúc: {new Date(selectedNotebookForView.updatedAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>
              <button onClick={() => setSelectedNotebookForView(null)} className="w-10 h-10 shrink-0 flex items-center justify-center text-muted hover:bg-primary-soft hover:text-primary rounded-full cursor-pointer transition-colors text-xl">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
              {(() => {
                const lines = selectedNotebookForView.theoryContent.split('\n');
                const blocks: any[] = [];
                let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

                const flushList = () => {
                  if (!currentList) return;
                  const listNode = currentList.type === 'ol'
                    ? <ol key={blocks.length} className="list-decimal pl-6 space-y-2 mb-4">{currentList.items.map((item, index) => <li key={index} dangerouslySetInnerHTML={{ __html: item }} />)}</ol>
                    : <ul key={blocks.length} className="list-disc pl-6 space-y-2 mb-4">{currentList.items.map((item, index) => <li key={index} dangerouslySetInnerHTML={{ __html: item }} />)}</ul>;
                  blocks.push(listNode);
                  currentList = null;
                };

                const formatInline = (text: string) => {
                  return text
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/__(.*?)__/g, '<strong>$1</strong>')
                    .replace(/_(.*?)_/g, '<em>$1</em>');
                };

                lines.forEach((line: string, i: number) => {
                  const trimmed = line.trim();
                  if (!trimmed) {
                    flushList();
                    blocks.push(<div key={i} className="py-1" />);
                    return;
                  }

                  const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
                  if (headingMatch) {
                    flushList();
                    const level = headingMatch[1].length;
                    const text = formatInline(headingMatch[2]);
                    const headingClass = [
                      'text-2xl font-bold mt-6 mb-3',
                      'text-xl font-bold mt-5 mb-3',
                      'text-lg font-bold mt-4 mb-2',
                      'text-base font-semibold mt-4 mb-2',
                      'text-base font-semibold mt-4 mb-2',
                      'text-base font-semibold mt-4 mb-2'
                    ][Math.min(level - 1, 5)];
                    blocks.push(
                      <div key={i} className={headingClass} dangerouslySetInnerHTML={{ __html: text }} />
                    );
                    return;
                  }

                  const unorderedMatch = trimmed.match(/^[-*]\s+(.*)$/);
                  const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
                  if (unorderedMatch || orderedMatch) {
                    const itemText = formatInline((unorderedMatch || orderedMatch)![1]);
                    const listType = orderedMatch ? 'ol' : 'ul';
                    if (!currentList || currentList.type !== listType) {
                      flushList();
                      currentList = { type: listType, items: [] };
                    }
                    currentList.items.push(itemText);
                    return;
                  }

                  flushList();
                  blocks.push(
                    <p key={i} className="mb-4" dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }} />
                  );
                });
                flushList();
                return blocks;
              })()}
            </div>
            </div>
            
            <div className="mt-6 flex justify-end pt-4 border-t border-line">
              <button onClick={() => setSelectedNotebookForView(null)} className="btn-primary px-6 py-2.5 cursor-pointer">Đã hiểu rõ</button>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}

// Thumbnail per self-practice route for the OVERVIEW "Luyện tập" grid (files under /public/images/thumbs/)
const PRACTICE_THUMBS: Record<string, string> = {
  '/listening': 'listening',
  '/conversation': 'conversation',
  '/reading': 'reading',
  '/writing': 'writing',
  '/gym': 'vocabulary',
  '/grammar-gym': 'grammar',
  '/study-plan': 'study-plan',
  '/phonetics': 'phonetics',
  '/pronunciation': 'pronunciation',
  '/mock-test': 'mock-test',
  '/ielts': 'ielts',
  '/mistakes': 'mistakes',
};

function EmptyIllustration() {
  return (
    <img
      src="/images/illustrations/empty-state.svg"
      alt="Minh hoạ chưa có dữ liệu"
      width={800}
      height={600}
      loading="lazy"
      className="w-full h-auto max-w-[220px] mx-auto mb-5"
    />
  );
}

// Mini Components for UI
function WeaknessItem({ topic, rate }: { topic: string, rate: string }) {
  return (
    <div className="flex justify-between items-center p-4 rounded-xl bg-background hover:bg-primary-soft transition-colors">
      <span className="font-semibold text-foreground">{topic}</span>
      <span className="text-red-700 font-bold bg-red-50 px-3 py-1 rounded-full text-xs">Sai {rate}</span>
    </div>
  );
}

function LessonCard({ title, type }: { title: string, type: string }) {
  const getBadge = () => {
    switch(type) {
      case 'Video': return <span className="ui-badge">VIDEO</span>;
      case 'Practice': return <span className="ui-badge bg-emerald-50 text-emerald-700">QUIZ</span>;
      case 'Vocab': return <span className="ui-badge">FLASHCARD</span>;
      default: return null;
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-background hover:bg-primary-soft cursor-pointer transition-colors">
      <div className="flex-1 font-semibold text-foreground">{title}</div>
      {getBadge()}
    </div>
  );
}

function AssignmentCard({ title, deadline, status, teacher, score }: { title: string, deadline: string, status: string, teacher: string, score?: string }) {
  const isCompleted = status === 'COMPLETED';
  
  return (
    <div className={`ui-card p-5 flex flex-wrap gap-3 justify-between items-center transition-all ${isCompleted ? 'opacity-70' : 'ui-card-hover cursor-pointer'}`}>
      <div>
        <h4 className="font-bold text-lg text-primary mb-1">{title}</h4>
        <p className="text-sm text-muted font-medium">Giao bởi: {teacher} • Hạn chót: <span className={isCompleted ? '' : 'text-red-600 font-bold'}>{deadline}</span></p>
      </div>
      <div>
        {isCompleted ? (
          <div className="text-right">
            <div className="text-xl font-bold text-primary">{score}</div>
            <p className="text-xs font-bold text-muted uppercase mt-0.5">Điểm</p>
          </div>
        ) : (
          <button className="btn-outline px-5 py-2 text-sm cursor-pointer">
            Làm Bài
          </button>
        )}
      </div>
    </div>
  );
}

// Reusable "nhập mã lớp" prompt for classless students — defined at module scope (not inline
// inside StudentDashboard) so its component identity stays stable across renders; an inline
// function component recreated every render would remount the input and drop keystroke focus.
function JoinClassPrompt({ hint, joinCode, setJoinCode, onSubmit }: { hint: string; joinCode: string; setJoinCode: (v: string) => void; onSubmit: (e: React.FormEvent) => void }) {
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      {hint && <p className="text-sm text-muted text-center max-w-sm">{hint}</p>}
      <form onSubmit={onSubmit} className="flex flex-wrap justify-center gap-2">
        <input
          type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)}
          placeholder="Nhập mã lớp..."
          className="ui-input w-48 text-sm"
        />
        <button type="submit" className="btn-primary px-5 py-2.5 text-sm whitespace-nowrap">
          Tham gia lớp
        </button>
      </form>
    </div>
  );
}

type StudentInsight = {
  level: 'critical' | 'warning' | 'success' | 'info'; icon: string; title: string; message: string;
  cta?: { label: string; tab?: string; href?: string };
};

function InsightCard({ insight, onNavigateTab }: { insight: StudentInsight; onNavigateTab: (tab: string) => void }) {
  const styles: Record<StudentInsight['level'], string> = {
    critical: 'border-l-red-500',
    warning: 'border-l-amber-500',
    success: 'border-l-emerald-500',
    info: 'border-l-primary',
  };
  const titleColor: Record<StudentInsight['level'], string> = {
    critical: 'text-red-700',
    warning: 'text-amber-700',
    success: 'text-emerald-700',
    info: 'text-primary',
  };
  const buttonColor: Record<StudentInsight['level'], string> = {
    critical: 'bg-red-50 text-red-700 hover:bg-red-100',
    warning: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
    success: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
    info: 'bg-primary-soft text-primary hover:bg-primary hover:text-white',
  };
  return (
    <div className={`p-4 sm:p-5 rounded-xl bg-white border border-line border-l-4 ${styles[insight.level]} h-full flex flex-col`}>
      <div className="flex items-start gap-3 flex-1">
        <div className="min-w-0">
          <h4 className={`font-bold text-sm mb-1 ${titleColor[insight.level]}`}>{insight.title}</h4>
          <p className="text-sm text-muted leading-relaxed">{insight.message}</p>
        </div>
      </div>
      {insight.cta && (
        insight.cta.href ? (
          <Link
            href={insight.cta.href}
            className={`inline-flex items-center justify-center gap-1.5 mt-4 px-4 py-2 text-xs font-bold rounded-full transition-colors self-start ${buttonColor[insight.level]}`}
          >
            {insight.cta.label} →
          </Link>
        ) : (
          <button
            onClick={() => insight.cta && onNavigateTab(insight.cta.tab!)}
            className={`inline-flex items-center justify-center gap-1.5 mt-4 px-4 py-2 text-xs font-bold rounded-full transition-colors self-start cursor-pointer ${buttonColor[insight.level]}`}
          >
            {insight.cta.label} →
          </button>
        )
      )}
    </div>
  );
}

function SkillsPanel({ user }: { user: any }) {
  const [progress, setProgress] = useState<Record<string, { score: number; hasData: boolean }>>({});

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/skill-progress/${user.id}`)
      .then(res => res.json())
      .then(data => setProgress(data))
      .catch(() => {});
  }, [user?.id]);

  const skills = [
    {
      key: "READING",
      label: "Reading",
      color: "#1E3A8A",
      bgClass: "bg-primary-soft border-primary/15",
      textClass: "text-primary",
      href: "/reading",
    },
    {
      key: "LISTENING",
      label: "Listening",
      color: "#3b82f6",
      bgClass: "bg-blue-50 border-blue-100",
      textClass: "text-blue-700",
      href: "/listening",
    },
    {
      key: "SPEAKING",
      label: "Speaking",
      color: "#10b981",
      bgClass: "bg-emerald-50 border-emerald-100",
      textClass: "text-emerald-700",
      href: "/conversation",
    },
    {
      key: "WRITING",
      label: "Writing",
      color: "#f9a95a",
      bgClass: "bg-orange-50 border-orange-100",
      textClass: "text-orange-700",
      href: "/writing",
    },
  ].map(s => ({ ...s, score: progress[s.key]?.score ?? 0, hasData: progress[s.key]?.hasData ?? false }));

  const radarData = skills.map(s => ({
    skill: s.label,
    score: s.hasData ? s.score : 0,
    fullMark: 10,
  }));

  return (
    <div className="ui-card p-5 sm:p-6">
      <div className="mb-6">
        <h4 className="ui-section-title text-lg">Tiến Độ 4 Kỹ Năng</h4>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Skill bars */}
        <div className="space-y-5">
          {skills.map(s => {
            const pct = s.hasData ? (s.score / 10) * 100 : 0;
            const scoreLabel = s.hasData ? s.score.toFixed(1) : "--";
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-bold text-sm px-3 py-1 rounded-full border ${s.bgClass} ${s.textClass}`}>{s.label}</span>
                  <div className="flex items-center gap-3">
                    {!s.hasData && (
                      <a href={s.href} className="text-xs font-bold px-3 py-1.5 rounded-full border border-primary text-primary bg-white hover:bg-primary-soft transition-colors">
                        Bắt đầu luyện →
                      </a>
                    )}
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-background text-foreground border border-line">
                      {scoreLabel}/10
                    </span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-background rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{ width: `${pct}%`, backgroundColor: s.color }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted pt-2">
            * Điểm mỗi kỹ năng là trung bình các lần luyện tập gần nhất — luyện tập thêm để cập nhật.
          </p>
        </div>

        {/* Radar chart */}
        <div className="flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
              <PolarGrid stroke="#eaecef" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fontWeight: 700, fill: '#5b6b82' }} />
              <Radar name="Score" dataKey="score" stroke="#1E3A8A" fill="#1E3A8A" fillOpacity={0.18} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function NotebookEntry({ topic, mistakes, correctCount = 0, status = 'NEEDS_WORK', theory, isExpanded, onClick }: { topic: string, mistakes: number, correctCount?: number, status?: string, theory: string, isExpanded: boolean, onClick: () => void }) {
  const isResolved = status === 'RESOLVED';

  return (
    <div className={`ui-card overflow-hidden transition-all ${isResolved ? 'border-emerald-200' : ''}`}>
      <div 
        onClick={onClick}
        className={`p-5 flex justify-between items-center cursor-pointer transition-colors ${isResolved ? 'hover:bg-emerald-50/50' : 'hover:bg-[#fafbfd]'}`}
      >
        <div className="flex items-center gap-4 flex-1">
          {isResolved ? (
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl">
              ✓
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              {mistakes}
            </div>
          )}
          
          <div>
            <h3 className={`font-bold text-lg ${isResolved ? 'text-emerald-700 dark:text-green-400' : 'text-primary'}`}>{topic}</h3>
            {isResolved ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">Đã khắc phục</span>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full">Đang yếu</span>
                <span className="text-xs text-muted font-medium">Tiến độ khắc phục: {correctCount}/3</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-muted">
          {isExpanded ? '▲' : '▼'}
        </div>
      </div>
      
      {isExpanded && (
        <div className="p-6 pt-4 border-t border-line bg-primary-soft/60 animate-in slide-in-from-top-2">
          <div className="text-[15px] text-foreground leading-relaxed notebook-markdown">
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
