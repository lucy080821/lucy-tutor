"use client";
import { useState, useEffect } from "react";

const BLANK_QUESTION = () => ({
  type: "MULTIPLE_CHOICE" as "MULTIPLE_CHOICE" | "ESSAY",
  heading: "",
  content: "",
  options: ["", "", "", ""],
  correctOption: "A",
  explanation: "",
});

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [user, setUser] = useState<any>(null);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [searchStudentQuery, setSearchStudentQuery] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) return alert('Ảnh quá lớn. Vui lòng chọn ảnh dưới 10MB');
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const res = await fetch(`http://localhost:5000/api/auth/avatar/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64 })
        });
        if (res.ok) {
          const updatedUser = await res.json();
          setUser(updatedUser);
        } else {
          alert('Lỗi tải ảnh');
        }
      } catch (err) {
        console.error('Lỗi tải ảnh:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    const url = userId ? `http://localhost:5000/api/auth/me?userId=${userId}` : "http://localhost:5000/api/auth/me";
    fetch(url).then(res => res.json()).then(data => setUser(data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetch(`http://localhost:5000/api/classroom/teacher/${user.id}`)
        .then(res => res.json()).then(setClassrooms).catch(console.error);
    }
  }, [user]);

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName || !user?.id) return;
    try {
      const res = await fetch('http://localhost:5000/api/classroom/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName, teacherId: user.id })
      });
      const data = await res.json();
      if (res.ok) { setClassrooms([...classrooms, data]); setShowModal(false); setNewClassName(""); }
    } catch (err) { console.error(err); }
  };

  // ── Exam management state ──
  const [localExams, setLocalExams] = useState<any[]>([]);
  const [selectedExamForView, setSelectedExamForView] = useState<any>(null);
  const [editExam, setEditExam] = useState<any>(null);
  const [examViewTab, setExamViewTab] = useState<'QUESTIONS' | 'RESULTS'>('QUESTIONS');

  useEffect(() => {
    if (selectedExamForView && !selectedExamForView.questions) {
      fetch(`http://localhost:5000/api/exams/${selectedExamForView.id}`)
        .then(res => res.json()).then(data => setSelectedExamForView(data)).catch(console.error);
    }
  }, [selectedExamForView]);

  const handleDeleteExam = async (examId: string) => {
    if (!confirm('Bạn có chắc muốn xóa đề thi này không?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/exams/${examId}`, { method: 'DELETE' });
      if (res.ok) {
        setLocalExams(localExams.filter((e: any) => e.id !== examId));
        const refreshed = await fetch(`http://localhost:5000/api/classroom/teacher/${user.id}`).then(r => r.json());
        setClassrooms(refreshed);
      } else { alert('Xóa thất bại'); }
    } catch (err) { console.error(err); }
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExam) return;
    try {
      const res = await fetch(`http://localhost:5000/api/exams/${editExam.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editExam.title, examType: editExam.examType, duration: editExam.duration,
          publishTime: editExam.publishTime || null, deadline: editExam.deadline || null, notes: editExam.notes || null
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalExams(localExams.map((e: any) => e.id === updated.id ? updated : e));
        const refreshed = await fetch(`http://localhost:5000/api/classroom/teacher/${user.id}`).then(r => r.json());
        setClassrooms(refreshed);
        setEditExam(null);
      } else { alert('Cập nhật thất bại'); }
    } catch (err) { console.error(err); }
  };

  // ── CREATE EXAM state ──
  const [createTitle, setCreateTitle] = useState("");
  const [createType, setCreateType] = useState("ASSIGNMENT");
  const [createClassroomId, setCreateClassroomId] = useState("");
  const [createAssignMode, setCreateAssignMode] = useState("CLASS");
  const [createStudentIds, setCreateStudentIds] = useState<string[]>([]);
  const [createDuration, setCreateDuration] = useState("45");
  const [createMaxAttempts, setCreateMaxAttempts] = useState("1");
  const [createPublishMode, setCreatePublishMode] = useState("NOW");
  const [createPublishTime, setCreatePublishTime] = useState("");
  const [createDeadline, setCreateDeadline] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createQuestions, setCreateQuestions] = useState([BLANK_QUESTION()]);
  const [isCreating, setIsCreating] = useState(false);

  const addQuestion = () => setCreateQuestions([...createQuestions, BLANK_QUESTION()]);
  const removeQuestion = (i: number) => setCreateQuestions(createQuestions.filter((_, idx) => idx !== i));
  const updateQuestion = (i: number, patch: any) => {
    const next = [...createQuestions];
    next[i] = { ...next[i], ...patch };
    setCreateQuestions(next);
  };
  const updateOption = (qi: number, oi: number, val: string) => {
    const next = [...createQuestions];
    const opts = [...next[qi].options];
    opts[oi] = val;
    next[qi] = { ...next[qi], options: opts };
    setCreateQuestions(next);
  };

  const [solvingAI, setSolvingAI] = useState<Record<number, boolean>>({});

  const handleSolveAI = async (qi: number) => {
    const q = createQuestions[qi];
    if (!q.content.trim()) return alert("Vui lòng nhập nội dung câu hỏi trước khi nhờ AI giải!");
    if (q.type === 'MULTIPLE_CHOICE' && q.options.filter(o => o.trim()).length < 2) {
      return alert("Vui lòng nhập ít nhất 2 đáp án trước khi nhờ AI giải!");
    }

    setSolvingAI(prev => ({ ...prev, [qi]: true }));
    try {
      const res = await fetch('http://localhost:5000/api/ai/solve-question', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          heading: q.heading,
          content: q.content,
          options: q.options,
          type: q.type
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi từ AI');
      
      updateQuestion(qi, {
        correctOption: data.correctOption || q.correctOption,
        explanation: data.explanation || ''
      });
    } catch (err: any) {
      alert('Lỗi AI: ' + err.message);
    }
    setSolvingAI(prev => ({ ...prev, [qi]: false }));
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return alert('Vui lòng nhập tiêu đề đề thi');
    if (!createClassroomId) return alert('Vui lòng chọn lớp học');
    if (createQuestions.length === 0) return alert('Vui lòng thêm ít nhất 1 câu hỏi');
    for (let i = 0; i < createQuestions.length; i++) {
      if (!createQuestions[i].content.trim()) return alert(`Câu ${i + 1}: Vui lòng nhập nội dung câu hỏi`);
      if (createQuestions[i].type === 'MULTIPLE_CHOICE') {
        const filledOpts = createQuestions[i].options.filter(o => o.trim());
        if (filledOpts.length < 2) return alert(`Câu ${i + 1}: Trắc nghiệm cần ít nhất 2 đáp án`);
      }
    }
    setIsCreating(true);
    try {
      const payload = {
        title: createTitle, examType: createType,
        classroomId: createClassroomId,
        assignMode: createAssignMode,
        studentIds: createAssignMode === 'STUDENT' ? createStudentIds : [],
        duration: parseInt(createDuration) || 45,
        maxAttempts: parseInt(createMaxAttempts) || 1,
        publishTime: createPublishMode === 'NOW' ? new Date().toISOString() : (createPublishTime || null),
        deadline: createDeadline || null,
        notes: createNotes || null,
        questions: createQuestions.map(q => ({
          heading: q.heading || null,
          type: q.type,
          content: q.content,
          options: q.type === 'MULTIPLE_CHOICE' ? JSON.stringify(q.options.filter(o => o.trim())) : '[]',
          correctOption: q.type === 'MULTIPLE_CHOICE' ? q.correctOption : null,
          explanation: q.explanation || '',
        }))
      };
      const res = await fetch('http://localhost:5000/api/exams/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo đề thất bại');
      const refreshed = await fetch(`http://localhost:5000/api/classroom/teacher/${user.id}`).then(r => r.json());
      setClassrooms(refreshed);
      setLocalExams([...localExams, data]);
      // Reset form
      setCreateTitle(""); setCreateType("ASSIGNMENT"); setCreateClassroomId("");
      setCreateAssignMode("CLASS"); setCreateStudentIds([]); setCreateDuration("45"); setCreateMaxAttempts("1");
      setCreatePublishMode("NOW"); setCreatePublishTime(""); setCreateDeadline(""); setCreateNotes("");
      setCreateQuestions([BLANK_QUESTION()]);
      setActiveTab("EXAMS");
      alert(`✅ Tạo đề thi thành công! ${createQuestions.length} câu hỏi đã được lưu.`);
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
      console.error(err);
    }
    setIsCreating(false);
  };

  // ── Nav ──
  const navItems = [
    { id: "OVERVIEW", label: "Tổng Quan" },
    { id: "CLASSES", label: "Lớp Học" },
    { id: "STUDENTS", label: "Học Sinh" },
    { id: "EXAMS", label: "Quản Lý Đề Thi" },
    { id: "CREATE", label: "Tạo Đề Mới" },
  ];

  const allStudents = classrooms.flatMap(c => c.students || []).filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);

  return (
    <div className="flex h-screen bg-background text-foreground p-6 gap-6">
      {/* Sidebar */}
      <div className="w-64 bg-surface rounded-3xl p-6 flex flex-col gap-2 shrink-0 h-full overflow-y-auto border border-foreground/10 shadow-sm">
        <div className="mb-10 px-2">
          <h2 className="text-2xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Lucy Tutor</h2>
          <p className="text-xs text-foreground/50 mt-1 font-bold">Giáo viên</p>
        </div>
        
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all cursor-pointer text-left ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'hover:bg-foreground/5 text-foreground/70 hover:text-foreground'}`}>
            {item.label}
          </button>
        ))}
        <div className="mt-auto pt-6 border-t border-foreground/10 px-2 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <label className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0 cursor-pointer relative overflow-hidden group">
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                user?.name?.charAt(0)
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] font-medium text-white">Đổi</span>
              </div>
            </label>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name || '...'}</p>
              <p className="text-xs text-foreground/50 truncate">{user?.email}</p>
            </div>
          </div>
          <button 
            onClick={() => { localStorage.removeItem('userId'); window.location.href = '/'; }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-rose-500 bg-rose-500/10 hover:bg-rose-500/20 transition-colors w-full cursor-pointer text-sm"
          >
            🚪 Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 rounded-3xl p-8 h-full overflow-y-auto relative bg-surface border border-foreground/10 shadow-sm flex flex-col">

        {/* ── OVERVIEW ── */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold">Xin chào, {user?.name?.split(' ').slice(-1)[0] || 'Thầy/Cô'} 👋</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Tổng Lớp" value={String(classrooms.length)} />
              <StatCard title="Tổng Học Sinh" value={String(allStudents.length)} />
              <StatCard title="Bài Tập / Đề Thi" value={String(classrooms.flatMap(c => c.exams || []).length)} />
              <StatCard title="Câu Hỏi" value={String(classrooms.flatMap(c => c.exams || []).reduce((s: number, e: any) => s + (e.totalQuestions || 0), 0))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map(c => <ClassCard key={c.id} name={c.name} count={c.students?.length || 0} code={c.joinCode} />)}
              <button onClick={() => setShowModal(true)} className="border-2 border-dashed border-foreground/20 rounded-2xl p-5 flex items-center justify-center gap-2 text-foreground/40 font-bold hover:border-primary/40 hover:text-primary/60 transition-colors cursor-pointer">
                + Tạo Lớp Mới
              </button>
            </div>
          </div>
        )}

        {/* ── CLASSES ── */}
        {activeTab === "CLASSES" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Lớp Học</h1>
              <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 cursor-pointer">+ Tạo Lớp</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map(c => <ClassCard key={c.id} name={c.name} count={c.students?.length || 0} code={c.joinCode} />)}
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {activeTab === "STUDENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h1 className="text-3xl font-bold">Danh Sách Học Sinh</h1>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40">🔍</span>
                <input 
                  type="text" 
                  placeholder="Tìm theo tên hoặc email..." 
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 rounded-xl border border-foreground/15 bg-surface focus:border-primary focus:outline-none min-w-[250px]"
                />
              </div>
            </div>
            {(() => {
              const filteredStudents = allStudents.filter((s: any) => 
                s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) || 
                s.email.toLowerCase().includes(searchStudentQuery.toLowerCase())
              );
              if (allStudents.length === 0) return <p className="text-foreground/50">Chưa có học sinh nào tham gia lớp.</p>;
              if (filteredStudents.length === 0) return <p className="text-foreground/50">Không tìm thấy học sinh phù hợp.</p>;
              
              const getTier = (xp: number) => {
                if (xp >= 20000) return { name: '💎 Huyền Thoại', color: 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20' };
                if (xp >= 10000) return { name: '🥇 Bậc Thầy', color: 'text-yellow-600 bg-yellow-500/10 border border-yellow-500/20' };
                if (xp >= 4000) return { name: '🥈 Tinh Anh', color: 'text-slate-600 bg-slate-500/10 border border-slate-500/20' };
                if (xp >= 1000) return { name: '📖 Học Giả', color: 'text-amber-700 bg-amber-500/10 border border-amber-500/20' };
                return { name: '🌱 Tân Binh', color: 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20' };
              };

              return (
                <div className="bg-surface border border-foreground/10 rounded-2xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-foreground/5 text-foreground/70 text-sm">
                        <th className="p-4 font-bold border-b border-foreground/10">Học Sinh</th>
                        <th className="p-4 font-bold border-b border-foreground/10">Cấp Bậc</th>
                        <th className="p-4 font-bold border-b border-foreground/10 text-center">Điểm XP</th>
                        <th className="p-4 font-bold border-b border-foreground/10">Lớp</th>
                        <th className="p-4 font-bold border-b border-foreground/10 text-center">Điểm TB</th>
                        <th className="p-4 font-bold border-b border-foreground/10 text-center">Mục tiêu</th>
                        <th className="p-4 font-bold border-b border-foreground/10 w-32">Tiến độ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s: any) => {
                        const studentResults = classrooms.flatMap(c => c.exams || []).flatMap(e => e.results || []).filter(r => r.userId === s.id);
                        const avgScore = studentResults.length > 0 ? (studentResults.reduce((acc, r) => acc + r.score, 0) / studentResults.length) : 0;
                        const percentToTarget = s.targetScore > 0 ? Math.min(100, Math.round((avgScore / s.targetScore) * 100)) : 0;
                        const tier = getTier(s.totalXP || 0);

                        return (
                          <tr key={s.id} className="border-b border-foreground/10 last:border-0 hover:bg-foreground/5 transition-colors">
                            <td className="p-4 font-medium flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                {s.avatar ? <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                              </div>
                              <div>
                                <div>{s.name}</div>
                                <div className="text-xs text-foreground/50 font-normal">{s.email}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-md text-xs font-bold ${tier.color} shadow-sm`}>
                                {tier.name}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-amber-500">{s.totalXP || 0} XP</td>
                            <td className="p-4 text-sm">{classrooms.find(c => c.students?.some((st: any) => st.id === s.id))?.name || '—'}</td>
                            <td className="p-4 text-center font-bold text-lg">{avgScore.toFixed(1)}</td>
                            <td className="p-4 font-bold text-primary text-center">{s.targetScore}+</td>
                            <td className="p-4">
                              <div className="flex items-center justify-between text-xs mb-1 font-bold text-foreground/60">
                                <span>{percentToTarget}%</span>
                              </div>
                              <div className="w-full bg-foreground/10 rounded-full h-2">
                                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${percentToTarget}%` }}></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── EXAMS ── */}
        {activeTab === "EXAMS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Ngân Hàng Bài Tập & Đề Thi</h1>
              <button onClick={() => setActiveTab('CREATE')} className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 cursor-pointer">✏️ Tạo Đề Mới</button>
            </div>
            {(() => {
              const dbExams = classrooms.flatMap(c => c.exams || []).filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);
              const allExamsRaw = [...dbExams, ...localExams];
              const allExams = allExamsRaw.filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);
              const assignments = allExams.filter(e => e.examType === 'ASSIGNMENT' || e.examType === 'REGULAR');
              const tests = allExams.filter(e => e.examType === 'EXAM' || e.examType === 'PLACEMENT');
              if (allExams.length === 0) return (
                <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col items-center text-center">
                  <span className="text-5xl mb-4">📄</span>
                  <h2 className="text-2xl font-bold mb-2">Chưa có đề thi nào</h2>
                  <p className="text-foreground/50 mb-6">Bắt đầu bằng cách tạo đề thủ công</p>
                  <button onClick={() => setActiveTab('CREATE')} className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer">✏️ Tạo Đề Ngay</button>
                </div>
              );
              return (
                <div className="space-y-8">
                  {assignments.length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="text-blue-500">📘</span> Bài Tập Về Nhà</h2>
                      <div className="space-y-3">
                        {assignments.map((exam: any) => (
                          <ExamCard key={exam.id} exam={exam} title={exam.title} type="Bài tập"
                            detail={classrooms.find((c: any) => c.id === exam.classroomId)?.name || 'N/A'}
                            questions={exam.totalQuestions}
                            onClick={() => { setSelectedExamForView(exam); setExamViewTab('QUESTIONS'); }}
                            onEdit={() => setEditExam({ ...exam, publishTime: exam.publishTime ? new Date(exam.publishTime).toISOString().slice(0, 16) : '', deadline: exam.deadline ? new Date(exam.deadline).toISOString().slice(0, 16) : '' })}
                            onDelete={() => handleDeleteExam(exam.id)} />
                        ))}
                      </div>
                    </div>
                  )}
                  {tests.length > 0 && (
                    <div>
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><span className="text-rose-500">🏆</span> Đề Thi Thử / Đánh Giá</h2>
                      <div className="space-y-3">
                        {tests.map((exam: any) => (
                          <ExamCard key={exam.id} exam={exam} title={exam.title} type="Đề thi"
                            detail={classrooms.find((c: any) => c.id === exam.classroomId)?.name || 'N/A'}
                            questions={exam.totalQuestions}
                            onClick={() => { setSelectedExamForView(exam); setExamViewTab('QUESTIONS'); }}
                            onEdit={() => setEditExam({ ...exam, publishTime: exam.publishTime ? new Date(exam.publishTime).toISOString().slice(0, 16) : '', deadline: exam.deadline ? new Date(exam.deadline).toISOString().slice(0, 16) : '' })}
                            onDelete={() => handleDeleteExam(exam.id)} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── CREATE EXAM ── */}
        {activeTab === "CREATE" && (
          <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold mb-1">Tạo Đề Thi Thủ Công</h1>
              <p className="text-foreground/50">Nhập từng câu hỏi — trắc nghiệm hoặc tự luận</p>
            </div>
            <form onSubmit={handleCreateExam} className="space-y-6">

              {/* ── SECTION 1: Thông tin đề ── */}
              <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4">
                <h2 className="font-bold text-lg border-b border-foreground/10 pb-3 mb-4">📋 Thông Tin Đề Thi</h2>
                <div>
                  <label className="block text-sm font-bold mb-1">Tiêu đề *</label>
                  <input type="text" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent focus:border-primary outline-none transition-colors"
                    placeholder="VD: Kiểm tra 15 phút – Unit 5" value={createTitle} onChange={e => setCreateTitle(e.target.value)} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Loại đề</label>
                    <select className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createType} onChange={e => setCreateType(e.target.value)}>
                      <option value="ASSIGNMENT">📝 Bài Tập (Luyện tập)</option>
                      <option value="EXAM">🏆 Đề Thi (Chấm điểm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Thời gian (phút)</label>
                    <input type="number" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createDuration} onChange={e => setCreateDuration(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Số lần làm tối đa</label>
                    <input type="number" min="1" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createMaxAttempts} onChange={e => setCreateMaxAttempts(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Hình thức giao</label>
                    <select className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createAssignMode} onChange={e => setCreateAssignMode(e.target.value)}>
                      <option value="CLASS">🏫 Giao cả Lớp</option>
                      <option value="STUDENT">👤 Giao cá nhân</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Lớp học *</label>
                    <select className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createClassroomId}
                      onChange={e => { setCreateClassroomId(e.target.value); setCreateStudentIds([]); }}>
                      <option value="">-- Chọn lớp --</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Student picker */}
                {createAssignMode === 'STUDENT' && createClassroomId && (
                  <div className="p-4 border border-foreground/10 rounded-xl">
                    <label className="block text-sm font-bold mb-2">Chọn học sinh</label>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {classrooms.find(c => c.id === createClassroomId)?.students?.map((s: any) => (
                        <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-foreground/5 rounded-lg cursor-pointer">
                          <input type="checkbox" checked={createStudentIds.includes(s.id)}
                            onChange={e => {
                              if (e.target.checked) setCreateStudentIds([...createStudentIds, s.id]);
                              else setCreateStudentIds(createStudentIds.filter(id => id !== s.id));
                            }} className="w-4 h-4 cursor-pointer" />
                          <span className="font-medium">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Ghi chú</label>
                    <input type="text" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" placeholder="VD: Không dùng tài liệu" value={createNotes} onChange={e => setCreateNotes(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Deadline</label>
                    <input type="datetime-local" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createDeadline} onChange={e => setCreateDeadline(e.target.value)} />
                  </div>
                </div>

                {/* Publish mode */}
                <div>
                  <label className="block text-sm font-bold mb-2">Thời gian đăng bài</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setCreatePublishMode('NOW')}
                      className={`flex-1 py-2.5 rounded-xl font-bold border-2 text-sm transition-all cursor-pointer ${createPublishMode === 'NOW' ? 'border-primary bg-primary/10 text-primary' : 'border-foreground/10 hover:border-foreground/30'}`}>
                      ⚡ Đăng Ngay
                    </button>
                    <button type="button" onClick={() => setCreatePublishMode('SCHEDULED')}
                      className={`flex-1 py-2.5 rounded-xl font-bold border-2 text-sm transition-all cursor-pointer ${createPublishMode === 'SCHEDULED' ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-foreground/10 hover:border-foreground/30'}`}>
                      📅 Hẹn Giờ
                    </button>
                  </div>
                  {createPublishMode === 'SCHEDULED' && (
                    <input type="datetime-local" className="w-full mt-2 p-3 rounded-xl border border-amber-400/40 bg-amber-500/5" value={createPublishTime} onChange={e => setCreatePublishTime(e.target.value)} />
                  )}
                </div>
              </div>

              {/* ── SECTION 2: Câu hỏi ── */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="font-bold text-lg">❓ Câu Hỏi <span className="text-foreground/40 font-normal text-base">({createQuestions.length} câu)</span></h2>
                  <button type="button" onClick={addQuestion}
                    className="px-4 py-2 bg-primary/10 text-primary font-bold rounded-xl hover:bg-primary/20 cursor-pointer text-sm transition-colors">
                    + Thêm câu hỏi
                  </button>
                </div>

                {createQuestions.map((q, qi) => (
                  <div key={qi} className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4 relative">
                    {/* Question header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">{qi + 1}</span>
                        <div className="flex gap-2">
                          <button type="button"
                            onClick={() => updateQuestion(qi, { type: 'MULTIPLE_CHOICE', correctOption: 'A' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer ${q.type === 'MULTIPLE_CHOICE' ? 'border-primary bg-primary/10 text-primary' : 'border-foreground/10 hover:border-foreground/30'}`}>
                            🔘 Trắc Nghiệm
                          </button>
                          <button type="button"
                            onClick={() => updateQuestion(qi, { type: 'ESSAY' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all cursor-pointer ${q.type === 'ESSAY' ? 'border-secondary bg-secondary/10 text-secondary' : 'border-foreground/10 hover:border-foreground/30'}`}>
                            ✍️ Tự Luận
                          </button>
                        </div>
                      </div>
                      {createQuestions.length > 1 && (
                        <button type="button" onClick={() => removeQuestion(qi)}
                          className="text-rose-500 hover:text-rose-600 font-bold text-sm cursor-pointer px-2 py-1 hover:bg-rose-500/10 rounded-lg transition-colors">
                          Xóa
                        </button>
                      )}
                    </div>

                    {/* Question content */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground/50 mb-1 uppercase tracking-wide">
                          Heading / Câu hỏi tổng (Không bắt buộc)
                        </label>
                        <textarea rows={2} className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent resize-none focus:border-primary outline-none transition-colors"
                          placeholder="VD: Read the following passage and answer the questions..."
                          value={q.heading || ''} onChange={e => updateQuestion(qi, { heading: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground/50 mb-1 uppercase tracking-wide">Nội dung câu hỏi *</label>
                        <textarea rows={2} className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent resize-none focus:border-primary outline-none transition-colors"
                          placeholder={q.type === 'ESSAY' ? 'Nhập câu hỏi tự luận...' : 'Nhập câu hỏi trắc nghiệm...'}
                          value={q.content} onChange={e => updateQuestion(qi, { content: e.target.value })} />
                      </div>
                    </div>

                    {/* MULTIPLE CHOICE options */}
                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-foreground/50 mb-2 uppercase tracking-wide">Các đáp án (chọn đáp án đúng)</label>
                        {['A', 'B', 'C', 'D'].map((letter, oi) => (
                          <div key={letter} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${q.correctOption === letter ? 'border-primary bg-primary/5' : 'border-foreground/10'}`}>
                            <button type="button"
                              onClick={() => updateQuestion(qi, { correctOption: letter })}
                              className={`w-8 h-8 rounded-full font-bold text-sm shrink-0 transition-all cursor-pointer ${q.correctOption === letter ? 'bg-primary text-white' : 'bg-foreground/10 hover:bg-foreground/20'}`}>
                              {letter}
                            </button>
                            <input type="text" className="flex-1 bg-transparent outline-none font-medium placeholder:text-foreground/30"
                              placeholder={`Đáp án ${letter}...`}
                              value={q.options[oi]} onChange={e => updateOption(qi, oi, e.target.value)} />
                            {q.correctOption === letter && <span className="text-primary text-xs font-bold shrink-0">✓ Đúng</span>}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ESSAY hint */}
                    {q.type === 'ESSAY' && (
                      <div className="p-3 bg-secondary/5 border border-secondary/20 rounded-xl">
                        <p className="text-xs text-secondary/70">✍️ Học sinh sẽ nhập câu trả lời tự do vào ô văn bản. Giáo viên chấm thủ công sau.</p>
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-foreground/50 uppercase tracking-wide">Giải thích <span className="font-normal normal-case">(không bắt buộc)</span></label>
                        <button type="button" onClick={() => handleSolveAI(qi)} disabled={solvingAI[qi]} className="flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50">
                          {solvingAI[qi] ? '⏳ Đang giải...' : '🪄 AI Chọn & Giải Thích'}
                        </button>
                      </div>
                      <input type="text" className="w-full p-2.5 rounded-xl border border-foreground/10 bg-transparent text-sm focus:border-primary outline-none transition-colors"
                        placeholder="Giải thích đáp án..." value={q.explanation} onChange={e => updateQuestion(qi, { explanation: e.target.value })} />
                    </div>
                  </div>
                ))}

                <button type="button" onClick={addQuestion}
                  className="w-full py-4 border-2 border-dashed border-foreground/20 rounded-2xl text-foreground/40 font-bold hover:border-primary/40 hover:text-primary/60 transition-colors cursor-pointer">
                  + Thêm câu hỏi
                </button>
              </div>

              <button type="submit" disabled={isCreating}
                className="w-full py-4 rounded-2xl bg-primary text-white font-black text-lg hover:bg-primary/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50">
                {isCreating ? 'Đang lưu...' : `🚀 Lưu Đề Thi (${createQuestions.length} câu)`}
              </button>
            </form>
          </div>
        )}

      </main>

      {/* ── Create Class Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface p-8 rounded-3xl w-full max-w-md border border-foreground/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">Tạo Lớp Học Mới</h2>
            <form onSubmit={handleCreateClass}>
              <div className="mb-6">
                <label className="block text-sm font-bold mb-2">Tên Lớp</label>
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-transparent focus:outline-none focus:border-primary"
                  placeholder="VD: Lớp 12A1" required autoFocus />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold hover:bg-foreground/5 cursor-pointer text-foreground/70">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer">Tạo Lớp</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick View Exam Modal ── */}
      {selectedExamForView && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface p-8 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-foreground/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedExamForView.title}</h2>
                <p className="text-sm text-foreground/50">{selectedExamForView.totalQuestions} câu hỏi • {selectedExamForView.duration} phút</p>
              </div>
              <button onClick={() => { setSelectedExamForView(null); setExamViewTab('QUESTIONS'); }} className="p-2 hover:bg-foreground/10 rounded-full cursor-pointer transition-colors text-xl">✕</button>
            </div>
              <div className="flex gap-4 border-b border-foreground/10 mb-4">
                <button onClick={() => setExamViewTab('QUESTIONS')} className={`px-4 py-2 font-bold ${examViewTab === 'QUESTIONS' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}>Nội Dung Đề</button>
                <button onClick={() => setExamViewTab('RESULTS')} className={`px-4 py-2 font-bold ${examViewTab === 'RESULTS' ? 'text-primary border-b-2 border-primary' : 'text-foreground/50 hover:text-foreground'}`}>Tiến Độ Nộp Bài</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
              
              {examViewTab === 'QUESTIONS' && (
                !selectedExamForView.questions ? (
                  <p className="text-center text-foreground/40 py-8">Đang tải...</p>
                ) : selectedExamForView.questions.length === 0 ? (
                  <p className="text-center text-foreground/40 py-8">Đề thi chưa có câu hỏi</p>
                ) : (
                selectedExamForView.questions.map((q: any, i: number) => {
                  const isEssay = q.question.type === 'ESSAY';
                  const opts = (() => { try { return JSON.parse(q.question.options || '[]'); } catch { return []; } })();
                  return (
                    <div key={i} className="p-5 bg-foreground/5 rounded-2xl">
                      <div className="flex items-start gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isEssay ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isEssay ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>{isEssay ? '✍️ Tự luận' : '🔘 Trắc nghiệm'}</span>
                          </div>
                          {q.question.heading && (
                            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700/80 font-medium whitespace-pre-wrap">
                              {q.question.heading}
                            </div>
                          )}
                          <p className="font-semibold mb-3" dangerouslySetInnerHTML={{ __html: q.question.content }}></p>
                          {!isEssay && opts.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {opts.map((opt: string, idx: number) => (
                                <p key={idx} className={`text-sm p-2 rounded-lg ${String.fromCharCode(65 + idx) === q.question.correctOption ? 'bg-primary/10 text-primary font-bold' : 'text-foreground/70'}`}>
                                  {String.fromCharCode(65 + idx)}. {opt}
                                </p>
                              ))}
                            </div>
                          )}
                          {isEssay && <p className="text-sm text-foreground/40 italic">Học sinh nhập câu trả lời tự do</p>}
                        </div>
                      </div>
                    </div>
                  );
                })
                )
              )}
              
              {examViewTab === 'RESULTS' && (
                <div className="space-y-4">
                  {(() => {
                    const crm = classrooms.find(c => c.id === selectedExamForView.classroomId);
                    let targetStudents = crm?.students || [];
                    if (selectedExamForView.assignMode === 'STUDENT' && selectedExamForView.assignedStudents) {
                      targetStudents = targetStudents.filter((s: any) => selectedExamForView.assignedStudents.some((a: any) => a.id === s.id));
                    }
                    
                    if (targetStudents.length === 0) return <p className="text-center text-foreground/40 py-8">Không có học sinh nào được giao bài.</p>;
                    
                    const submittedCount = targetStudents.filter((s: any) => selectedExamForView.results?.some((r: any) => r.userId === s.id)).length;
                    
                    return (
                      <>
                        <div className="flex gap-4 p-4 bg-primary/10 rounded-2xl mb-4">
                          <div className="flex-1 text-center">
                            <p className="text-sm font-bold text-primary mb-1">Tổng Giao</p>
                            <p className="text-2xl font-black">{targetStudents.length}</p>
                          </div>
                          <div className="flex-1 text-center border-l border-primary/20">
                            <p className="text-sm font-bold text-green-600 mb-1">Đã Nộp</p>
                            <p className="text-2xl font-black text-green-600">{submittedCount}</p>
                          </div>
                          <div className="flex-1 text-center border-l border-primary/20">
                            <p className="text-sm font-bold text-rose-500 mb-1">Chưa Làm</p>
                            <p className="text-2xl font-black text-rose-500">{targetStudents.length - submittedCount}</p>
                          </div>
                        </div>
                        
                        <div className="border border-foreground/10 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-foreground/5">
                              <tr>
                                <th className="p-3 font-bold border-b border-foreground/10">Học Sinh</th>
                                <th className="p-3 font-bold border-b border-foreground/10">Điểm cao nhất</th>
                                <th className="p-3 font-bold border-b border-foreground/10">Lượt làm</th>
                                <th className="p-3 font-bold border-b border-foreground/10">Giờ kết thúc</th>
                                <th className="p-3 font-bold border-b border-foreground/10">Thời gian làm</th>
                              </tr>
                            </thead>
                            <tbody>
                              {targetStudents.map((s: any) => {
                                const userResults = selectedExamForView.results?.filter((r: any) => r.userId === s.id) || [];
                                const hasSubmitted = userResults.length > 0;
                                const bestResult = hasSubmitted ? userResults.reduce((prev: any, current: any) => (prev.score > current.score) ? prev : current) : null;
                                const latestResult = hasSubmitted ? userResults.reduce((prev: any, current: any) => (new Date(prev.createdAt) > new Date(current.createdAt)) ? prev : current) : null;
                                
                                return (
                                  <tr key={s.id} className="border-b border-foreground/10 last:border-0 hover:bg-foreground/5">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-bold overflow-hidden">
                                          {s.avatar ? <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                                        </div>
                                        {s.name}
                                      </div>
                                    </td>
                                    {hasSubmitted ? (
                                      <>
                                        <td className="p-3 font-black text-primary">{bestResult.score.toFixed(1)}</td>
                                        <td className="p-3">{userResults.length} lượt</td>
                                        <td className="p-3 text-foreground/70">{new Date(latestResult.createdAt).toLocaleString('vi-VN')}</td>
                                        <td className="p-3 text-foreground/70">{Math.floor(latestResult.timeSpent / 60)} phút {latestResult.timeSpent % 60} giây</td>
                                      </>
                                    ) : (
                                      <td colSpan={4} className="p-3 text-rose-500 font-medium italic text-center bg-rose-500/5">Chưa làm bài</td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setSelectedExamForView(null)} className="px-6 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Exam Modal ── */}
      {editExam && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-surface p-8 rounded-3xl w-full max-w-lg border border-foreground/10 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Chỉnh Sửa Đề Thi</h2>
            <form onSubmit={handleUpdateExam} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Tiêu đề</label>
                <input className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.title} onChange={e => setEditExam({ ...editExam, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Loại</label>
                  <select className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.examType} onChange={e => setEditExam({ ...editExam, examType: e.target.value })}>
                    <option value="ASSIGNMENT">Bài Tập</option>
                    <option value="EXAM">Đề Thi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Thời gian (phút)</label>
                  <input type="number" className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.duration} onChange={e => setEditExam({ ...editExam, duration: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Public lúc</label>
                  <input type="datetime-local" className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.publishTime || ''} onChange={e => setEditExam({ ...editExam, publishTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Deadline</label>
                  <input type="datetime-local" className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.deadline || ''} onChange={e => setEditExam({ ...editExam, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Ghi chú</label>
                <input type="text" className="w-full p-3 rounded-lg border border-foreground/20 bg-transparent" value={editExam.notes || ''} onChange={e => setEditExam({ ...editExam, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditExam(null)} className="flex-1 py-3 rounded-xl border border-foreground/20 font-bold hover:bg-foreground/5 cursor-pointer">Hủy</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-surface border border-foreground/10 p-6 rounded-2xl">
      <p className="text-sm text-foreground/60 font-medium">{title}</p>
      <p className="text-3xl font-extrabold mt-1">{value}</p>
    </div>
  );
}

function ClassCard({ name, count, code }: { name: string; count: number; code: string }) {
  return (
    <div className="bg-surface border border-foreground/10 p-5 rounded-2xl flex justify-between items-center hover:-translate-y-1 transition-transform cursor-pointer">
      <div>
        <h4 className="font-bold text-lg">{name}</h4>
        <p className="text-sm text-foreground/60">{count} Học sinh</p>
      </div>
      <div className="text-right">
        <p className="text-xs text-foreground/50 mb-1">Mã tham gia</p>
        <div className="bg-primary/10 text-primary font-mono font-bold px-3 py-1 rounded text-lg tracking-widest">{code}</div>
      </div>
    </div>
  );
}

function ExamCard({ title, type, detail, questions, onClick, onEdit, onDelete, exam }: { title: string; type: string; detail: string; questions: number; onClick?: () => void; onEdit?: () => void; onDelete?: () => void; exam?: any }) {
  return (
    <div className="bg-surface border border-foreground/10 p-5 rounded-2xl flex justify-between items-center hover:bg-foreground/5 transition-colors">
      <div className="flex-1 cursor-pointer" onClick={onClick}>
        <h4 className="font-bold text-lg flex items-center gap-2 flex-wrap">
          {title}
          {exam?.deadline && <span className="bg-rose-500/10 text-rose-500 text-xs px-2 py-0.5 rounded-full">⏰ Hạn: {new Date(exam.deadline).toLocaleDateString('vi-VN')}</span>}
          {exam?.notes && <span className="bg-amber-500/10 text-amber-600 text-xs px-2 py-0.5 rounded-full">📌 {exam.notes}</span>}
        </h4>
        <p className="text-sm text-foreground/60 mt-1">Giao cho: <span className="font-medium text-foreground">{detail}</span> • {questions} câu • {exam?.duration || 45} phút</p>
      </div>
      <div className="flex items-center gap-2 ml-4 shrink-0">
        <button onClick={onClick} className="px-3 py-2 text-sm font-bold bg-foreground/10 rounded-lg hover:bg-foreground/20 cursor-pointer">👁 Xem</button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} className="px-3 py-2 text-sm font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer">✏️ Sửa</button>
        <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="px-3 py-2 text-sm font-bold bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 cursor-pointer">🗑 Xóa</button>
      </div>
    </div>
  );
}
