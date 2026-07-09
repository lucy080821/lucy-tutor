"use client";
import { useState, useEffect, useRef, createRef } from "react";
import CalendarComponent from "@/components/calendar/CalendarComponent";
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { TuitionInvoice } from '@/components/tuition/TuitionInvoice';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, PieChart, Pie, Cell, LabelList } from 'recharts';
import dynamic from 'next/dynamic';
import DOMPurify from 'dompurify';
import 'react-quill-new/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill-new'), { ssr: false });
const miniQuillModules = {
  toolbar: [
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    ['clean']
  ]
};

let questionKeySeq = 0;
const newQuestionKey = () => `q-${Date.now()}-${questionKeySeq++}`;
const BLANK_QUESTION = () => ({
  _key: newQuestionKey(),
  type: "MULTIPLE_CHOICE" as "MULTIPLE_CHOICE" | "ESSAY",
  heading: "",
  content: "",
  options: ["", "", "", ""],
  correctOption: "A",
  explanation: "",
  imageUrl: "",
  points: 1,
});

const stripHtml = (html?: string) => (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const escapeHtml = (text: string) => text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");
const textToQuillHtml = (text: string) => text ? `<p>${escapeHtml(text)}</p>` : "";

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [classrooms, setClassrooms] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editClassroom, setEditClassroom] = useState<any>(null);
  const [newClassName, setNewClassName] = useState("");
  const [scheduleDays, setScheduleDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [feePerLesson, setFeePerLesson] = useState("");
  const [searchStudentQuery, setSearchStudentQuery] = useState("");
  const [globalLoading, setGlobalLoading] = useState({ isLoading: false, message: "" });

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

  useEffect(() => {
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
    const url = userId ? `${API}/api/auth/me?userId=${userId}` : `${API}/api/auth/me`;
    fetch(url)
      .then(res => res.json())
      .then(data => { setUser(data); setLoading(false); })
      .catch(err => { console.error(err); setLoading(false); });
  }, []);

  const fetchTeacherData = () => {
    if (user?.id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/classroom/teacher/${user.id}`)
        .then(res => res.json()).then(setClassrooms).catch(console.error);
    }
  };

  useEffect(() => {
    fetchTeacherData();
  }, [user]);

  const handleCreateOrEditClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    try {
      const isEditing = !!editClassroom;
      const url = isEditing 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/classroom/edit/${editClassroom.id}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/classroom/create`;
        
      const method = isEditing ? 'PUT' : 'POST';
      
      const payload: any = {
        name: newClassName,
        scheduleDays: JSON.stringify(scheduleDays),
        startTime,
        endTime,
        feePerLesson: feePerLesson ? parseInt(feePerLesson) : 0
      };
      if (!isEditing) payload.teacherId = user.id;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setNewClassName("");
        setScheduleDays([]);
        setStartTime("");
        setEndTime("");
        setFeePerLesson("");
        setShowModal(false);
        setEditClassroom(null);
        fetchTeacherData();
      }
    } catch (err) {
      console.error('Error saving classroom', err);
    }
  };

  const openEditModal = (c: any) => {
    setEditClassroom(c);
    setNewClassName(c.name);
    try { setScheduleDays(c.scheduleDays ? JSON.parse(c.scheduleDays) : []); } catch { setScheduleDays([]); }
    setStartTime(c.startTime || "");
    setEndTime(c.endTime || "");
    setFeePerLesson(c.feePerLesson ? String(c.feePerLesson) : "");
    setShowModal(true);
  };
  
  const openCreateModal = () => {
    setEditClassroom(null);
    setNewClassName("");
    setScheduleDays([]);
    setStartTime("");
    setEndTime("");
    setFeePerLesson("");
    setShowModal(true);
  };

  // ── Document management state ──
  const [documents, setDocuments] = useState<any[]>([]);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docVisibility, setDocVisibility] = useState("PUBLIC");
  const [docClassroomId, setDocClassroomId] = useState("");
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [searchDocQuery, setSearchDocQuery] = useState("");

  // ── Listening clip (Studio Luyện Nghe) state ──
  const [listeningClips, setListeningClips] = useState<any[]>([]);
  const [lcTitle, setLcTitle] = useState("");
  const [lcScript, setLcScript] = useState("");
  const [lcAudioFile, setLcAudioFile] = useState<File | null>(null);
  const [lcScope, setLcScope] = useState("CLASS"); // "CLASS" or "STUDENT"
  const [lcClassroomId, setLcClassroomId] = useState("");
  const [lcStudentId, setLcStudentId] = useState("");
  const [lcAccent, setLcAccent] = useState("US"); // "UK", "US", "AUS"
  const [isUploadingClip, setIsUploadingClip] = useState(false);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);

  const ACCENT_LABELS: Record<string, string> = { UK: "🇬🇧 Anh-Anh (UK)", US: "🇺🇸 Anh-Mỹ (US)", AUS: "🇦🇺 Anh-Úc (AUS)" };

  const fetchListeningClips = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/listening?teacherId=${user.id}`);
      if (res.ok) setListeningClips(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === "LISTENING_STUDIO" && user) {
      fetchListeningClips();
    }
  }, [activeTab, user]);

  // Poll while any clip is still being aligned in the background, so the status badge
  // (Đang xử lý → Sẵn sàng/Lỗi) updates without the teacher needing to switch tabs/refresh.
  useEffect(() => {
    if (activeTab !== "LISTENING_STUDIO" || !listeningClips.some(c => c.status === 'PROCESSING')) return;
    const interval = setInterval(fetchListeningClips, 4000);
    return () => clearInterval(interval);
  }, [activeTab, listeningClips]);

  const resetListeningClipForm = () => {
    setEditingClipId(null);
    setLcTitle("");
    setLcScript("");
    setLcAudioFile(null);
    setLcScope("CLASS");
    setLcClassroomId("");
    setLcStudentId("");
    setLcAccent("US");
  };

  const startEditListeningClip = (clip: any) => {
    setEditingClipId(clip.id);
    setLcTitle(clip.title);
    setLcAccent(clip.accent);
    if (clip.classroomId) {
      setLcScope("CLASS");
      setLcClassroomId(clip.classroomId);
      setLcStudentId("");
    } else {
      setLcScope("STUDENT");
      setLcStudentId(clip.studentId);
      setLcClassroomId("");
    }
    document.getElementById('listening-clip-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleUploadListeningClip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (lcScope === "CLASS" && !lcClassroomId) return Swal.fire('Lỗi', 'Vui lòng chọn lớp học', 'error');
    if (lcScope === "STUDENT" && !lcStudentId) return Swal.fire('Lỗi', 'Vui lòng chọn học viên', 'error');

    setIsUploadingClip(true);
    try {
      let res: Response;
      if (editingClipId) {
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/listening/${editingClipId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: lcTitle,
            accent: lcAccent,
            classroomId: lcScope === "CLASS" ? lcClassroomId : null,
            studentId: lcScope === "STUDENT" ? lcStudentId : null
          })
        });
      } else {
        if (!lcAudioFile) { setIsUploadingClip(false); return; }
        const formData = new FormData();
        formData.append('audio', lcAudioFile);
        formData.append('title', lcTitle);
        formData.append('script', lcScript);
        formData.append('teacherId', user.id);
        formData.append('accent', lcAccent);
        if (lcScope === "CLASS") formData.append('classroomId', lcClassroomId);
        if (lcScope === "STUDENT") formData.append('studentId', lcStudentId);
        res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/listening/upload`, {
          method: 'POST',
          body: formData
        });
      }

      if (res.ok) {
        Swal.fire('Thành công', editingClipId ? 'Đã cập nhật thông tin audio' : 'Đã tải audio lên, đang xử lý căn chỉnh âm thanh...', 'success');
        resetListeningClipForm();
        fetchListeningClips();
      } else {
        const errData = await res.json();
        Swal.fire('Lỗi', errData.error || 'Thao tác thất bại', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Lỗi kết nối mạng', 'error');
    } finally {
      setIsUploadingClip(false);
    }
  };

  const handleDeleteListeningClip = async (clipId: string) => {
    const result = await Swal.fire({
      title: 'Xóa audio này?',
      text: 'Học viên sẽ không thể luyện nghe với audio này nữa.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/listening/${clipId}`, { method: 'DELETE' });
      if (res.ok) {
        Swal.fire('Đã xóa', '', 'success');
        fetchListeningClips();
      }
    } catch (err) { console.error(err); }
  };

  // ── Speaking topic (Luyện Nói Cùng AI) state ──
  const [speakingTopics, setSpeakingTopics] = useState<any[]>([]);
  const [stTitle, setStTitle] = useState("");
  const [stDescription, setStDescription] = useState("");
  const [stPersona, setStPersona] = useState("");
  const [stOpeningLine, setStOpeningLine] = useState("");
  const [stScope, setStScope] = useState("CLASS"); // "CLASS" or "STUDENT"
  const [stClassroomId, setStClassroomId] = useState("");
  const [stStudentId, setStStudentId] = useState("");
  const [isSavingTopic, setIsSavingTopic] = useState(false);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);

  const fetchSpeakingTopics = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/speaking-conversation/topics?teacherId=${user.id}`);
      if (res.ok) setSpeakingTopics(await res.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === "SPEAKING_TOPICS" && user) {
      fetchSpeakingTopics();
    }
  }, [activeTab, user]);

  const resetSpeakingTopicForm = () => {
    setEditingTopicId(null);
    setStTitle("");
    setStDescription("");
    setStPersona("");
    setStOpeningLine("");
    setStScope("CLASS");
    setStClassroomId("");
    setStStudentId("");
  };

  const startEditSpeakingTopic = (topic: any) => {
    setEditingTopicId(topic.id);
    setStTitle(topic.title);
    setStDescription(topic.description || "");
    setStPersona(topic.aiPersona);
    setStOpeningLine(topic.openingLine || "");
    if (topic.classroomId) {
      setStScope("CLASS");
      setStClassroomId(topic.classroomId);
      setStStudentId("");
    } else {
      setStScope("STUDENT");
      setStStudentId(topic.studentId);
      setStClassroomId("");
    }
    document.getElementById('speaking-topic-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSaveSpeakingTopic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (stScope === "CLASS" && !stClassroomId) return Swal.fire('Lỗi', 'Vui lòng chọn lớp học', 'error');
    if (stScope === "STUDENT" && !stStudentId) return Swal.fire('Lỗi', 'Vui lòng chọn học viên', 'error');

    setIsSavingTopic(true);
    try {
      const body = {
        title: stTitle,
        description: stDescription,
        aiPersona: stPersona,
        openingLine: stOpeningLine,
        teacherId: user.id,
        classroomId: stScope === "CLASS" ? stClassroomId : null,
        studentId: stScope === "STUDENT" ? stStudentId : null
      };
      const res = editingTopicId
        ? await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/speaking-conversation/topics/${editingTopicId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        : await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/speaking-conversation/topics`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });

      if (res.ok) {
        Swal.fire('Thành công', editingTopicId ? 'Đã cập nhật chủ đề' : 'Đã tạo chủ đề hội thoại', 'success');
        resetSpeakingTopicForm();
        fetchSpeakingTopics();
      } else {
        const errData = await res.json();
        Swal.fire('Lỗi', errData.error || 'Thao tác thất bại', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Lỗi kết nối mạng', 'error');
    } finally {
      setIsSavingTopic(false);
    }
  };

  const handleDeleteSpeakingTopic = async (topicId: string) => {
    const result = await Swal.fire({
      title: 'Xóa chủ đề này?',
      text: 'Học viên sẽ không thể luyện nói với chủ đề này nữa.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Xóa',
      cancelButtonText: 'Hủy'
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/speaking-conversation/topics/${topicId}`, { method: 'DELETE' });
      if (res.ok) {
        Swal.fire('Đã xóa', '', 'success');
        fetchSpeakingTopics();
      }
    } catch (err) { console.error(err); }
  };

  const fetchDocuments = async () => {
    if (!user) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents?teacherId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (activeTab === "DOCUMENTS" && user) {
      fetchDocuments();
    }
  }, [activeTab, user]);

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docFile || !user) return;
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', docFile);
      formData.append('title', docTitle);
      formData.append('visibility', docVisibility);
      if (docVisibility === 'CLASS' && docClassroomId) {
        formData.append('classroomId', docClassroomId);
      }
      formData.append('uploadedById', user.id);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        Swal.fire('Thành công', 'Tải tài liệu lên thành công!', 'success');
        setDocFile(null);
        setDocTitle("");
        setDocVisibility("PUBLIC");
        setDocClassroomId("");
        fetchDocuments();
      } else {
        const errData = await res.json();
        Swal.fire('Lỗi', errData.error || 'Tải lên thất bại', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Lỗi', 'Lỗi kết nối mạng', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('Bạn có chắc muốn xóa tài liệu này?')) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents/${docId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        Swal.fire('Đã xóa', 'Xóa tài liệu thành công', 'success');
        fetchDocuments();
      } else {
        Swal.fire('Lỗi', 'Xóa thất bại', 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handleUpdateDocumentVisibility = async (doc: any) => {
    const inputOptions: Record<string, string> = {
      'PUBLIC': 'Tất cả trung tâm (Public)',
      'PRIVATE': 'Chỉ mình tôi (Private)'
    };
    classrooms.forEach((c: any) => {
      inputOptions[`CLASS_${c.id}`] = `Lớp: ${c.name}`;
    });

    const currentVal = doc.visibility === 'CLASS' ? `CLASS_${doc.classroomId}` : doc.visibility;

    const { value: selectedOption } = await Swal.fire({
      title: 'Đổi trạng thái chia sẻ',
      input: 'select',
      inputOptions,
      inputValue: currentVal,
      showCancelButton: true,
      confirmButtonText: 'Lưu',
      cancelButtonText: 'Hủy'
    });

    if (selectedOption && selectedOption !== currentVal) {
      let newVisibility = selectedOption;
      let newClassroomId = null;
      if (selectedOption.startsWith('CLASS_')) {
         newVisibility = 'CLASS';
         newClassroomId = selectedOption.replace('CLASS_', '');
      }

      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/documents/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visibility: newVisibility, classroomId: newClassroomId })
        });
        if (res.ok) {
          fetchDocuments();
          Swal.fire('Thành công', 'Đã cập nhật trạng thái', 'success');
        } else {
          Swal.fire('Lỗi', 'Cập nhật thất bại', 'error');
        }
      } catch(err) {
        console.error(err);
      }
    }
  };

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

  // ── Cheat Logs state ──
  const [cheatIncidents, setCheatIncidents] = useState<any[]>([]);
  const [cheatLoading, setCheatLoading] = useState(false);
  const [cheatSearch, setCheatSearch] = useState("");
  const [cheatClassFilter, setCheatClassFilter] = useState("ALL");

  const fetchCheatLogs = (userId: string) => {
    setCheatLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/cheat-logs/${userId}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCheatIncidents(data.map(log => ({
            id: log.id,
            studentName: log.user?.name || "Học viên ẩn danh",
            examTitle: log.exam?.title || "Bài thi",
            className: log.exam?.classroom?.name || "Lớp chung",
            cheatCount: log.cheatCount,
            autoSubmitted: log.isAutoSubmitted,
            createdAt: log.updatedAt,
            studentEmail: log.user?.email || "",
            studentAvatar: log.user?.avatar || ""
          })));
        }
      })
      .catch(console.error)
      .finally(() => setCheatLoading(false));
  };

  useEffect(() => {
    if (activeTab !== "CHEAT_CONTROL" || !user) return;
    fetchCheatLogs(user.id);
    const interval = setInterval(() => fetchCheatLogs(user.id), 30000);
    return () => clearInterval(interval);
  }, [activeTab, user]);

  // ── Lesson management state ──
  const [localLessons, setLocalLessons] = useState<any[]>([]);
  const [lessonClassFilter, setLessonClassFilter] = useState("");
  useEffect(() => {
    if (user?.id) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/teacher/${user.id}`)
        .then(res => res.json()).then(setLocalLessons).catch(console.error);
    }
  }, [user]);

  const [createLessonTitle, setCreateLessonTitle] = useState("");
  const [createLessonDesc, setCreateLessonDesc] = useState("");
  const [createLessonClassroomId, setCreateLessonClassroomId] = useState("");
  const [lessonVocabs, setLessonVocabs] = useState<any[]>([]);
  const [lessonGrammars, setLessonGrammars] = useState<any[]>([]);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const handleDownloadVocabTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { word: "apple", pos: "Noun", phonetic: "/ˈæpl/", meaning: "quả táo", example: "I eat an apple." }
    ]);

    const headerStyle = {
      font: { name: 'Calibri', bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
      }
    };

    const dataStyle = {
      font: { name: 'Calibri', sz: 11 },
      alignment: { vertical: "center" },
      border: {
        top: { style: "thin", color: { rgb: "EEEEEE" } },
        bottom: { style: "thin", color: { rgb: "EEEEEE" } },
        left: { style: "thin", color: { rgb: "EEEEEE" } },
        right: { style: "thin", color: { rgb: "EEEEEE" } }
      }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:E2");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_ref]) continue;
        if (R === 0) {
          ws[cell_ref].s = headerStyle;
          if (typeof ws[cell_ref].v === 'string') {
            ws[cell_ref].v = ws[cell_ref].v.toUpperCase();
          }
        } else {
          ws[cell_ref].s = dataStyle;
        }
      }
    }

    ws['!cols'] = [
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 25 },
      { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vocabulary");
    XLSX.writeFile(wb, "VocabTemplate.xlsx");
  };

  const handleUploadVocabExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData = XLSX.utils.sheet_to_json(ws);
      
      const data = rawData.map((item: any) => {
        const normalizedItem: any = {};
        for (const key in item) {
          normalizedItem[key.toLowerCase()] = item[key];
        }
        return normalizedItem;
      });

      setLessonVocabs([...lessonVocabs, ...data]);
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };
  const handleUploadVocabImage = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      return Swal.fire('Lỗi', 'Kích thước ảnh tối đa 5MB', 'error');
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const newVocabs = [...lessonVocabs];
      newVocabs[index].imageUrl = base64;
      setLessonVocabs(newVocabs);
    };
    reader.readAsDataURL(file);
    
    // reset input
    if (e.target) e.target.value = '';
  };

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createLessonTitle.trim()) return Swal.fire('Cảnh báo', 'Vui lòng nhập tiêu đề bài học', 'warning');
    if (!createLessonClassroomId) return Swal.fire('Cảnh báo', 'Vui lòng chọn lớp học', 'warning');
    if (lessonVocabs.length === 0 && lessonGrammars.length === 0) return Swal.fire('Cảnh báo', 'Bài học cần có ít nhất 1 từ vựng hoặc 1 điểm ngữ pháp', 'warning');

    setGlobalLoading({ isLoading: true, message: "Đang lưu bài học..." });
    try {
      const isEditing = !!editingLessonId;
      const url = isEditing 
        ? `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${editingLessonId}`
        : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/create`;
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createLessonTitle,
          description: createLessonDesc,
          classroomId: createLessonClassroomId,
          uploadedById: user.id,
          vocabularies: lessonVocabs.map((v: any) => ({ word: v.word, pos: v.pos, phonetic: v.phonetic, meaning: v.meaning, example: v.example, imageUrl: v.imageUrl })),
          grammars: lessonGrammars.map((g: any) => ({ title: g.title, structure: g.structure, explanation: g.explanation }))
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (isEditing) {
          setLocalLessons(localLessons.map(l => l.id === editingLessonId ? data : l));
          Swal.fire('Thành công', 'Cập nhật bài học thành công!', 'success');
        } else {
          setLocalLessons([data, ...localLessons]);
          Swal.fire('Thành công', 'Tạo bài học thành công!', 'success');
        }
        setCreateLessonTitle(""); setCreateLessonDesc(""); setCreateLessonClassroomId("");
        setLessonVocabs([]); setLessonGrammars([]); setEditingLessonId(null);
        setActiveTab("LESSONS");
      } else {
        Swal.fire('Lỗi', isEditing ? 'Cập nhật thất bại' : 'Tạo thất bại', 'error');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  // ── ATTENDANCE & TUITION state ──
  const [attClassroomId, setAttClassroomId] = useState("");
  const [attView, setAttView] = useState("MARK"); // "MARK" or "REPORT"
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attMonth, setAttMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [attRecords, setAttRecords] = useState<any[]>([]); // { userId, status, notes, user }
  const [attReport, setAttReport] = useState<any>(null);
  const [aggregatedReports, setAggregatedReports] = useState<Record<string, any>>({});
  const invoiceRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [isExporting, setIsExporting] = useState(false);

  // ── Overview tuition summary (quản lý chung) ──
  const [overviewTuitionMonth, setOverviewTuitionMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [overviewTuitionData, setOverviewTuitionData] = useState<any>(null);
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);

  useEffect(() => {
    if (activeTab !== "OVERVIEW" || !user?.id || !overviewTuitionMonth) return;
    const [year, month] = overviewTuitionMonth.split("-");
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/report/teacher/${user.id}?month=${parseInt(month)}&year=${year}`)
      .then(res => res.json())
      .then(setOverviewTuitionData)
      .catch(console.error);
  }, [activeTab, user, overviewTuitionMonth]);

  // ── Revenue trend: last 6 months, for the OVERVIEW "business health" chart ──
  const [revenueTrend, setRevenueTrend] = useState<any[] | null>(null);
  useEffect(() => {
    if (activeTab !== "OVERVIEW" || !user?.id) return;
    const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { month: d.getMonth() + 1, year: d.getFullYear() };
    });
    let cancelled = false;
    Promise.all(months.map(({ month, year }) =>
      fetch(`${API}/api/attendance/report/teacher/${user.id}?month=${month}&year=${year}`).then(res => res.json())
    )).then(reports => {
      if (cancelled) return;
      setRevenueTrend(reports.map((r, i) => ({
        name: `T${months[i].month}/${String(months[i].year).slice(2)}`,
        DaThu: r.totalCollected || 0,
        CanThu: r.totalExpected || 0,
      })));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [activeTab, user]);

  const fetchAttendance = async () => {
    if (!attClassroomId || !attDate) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/class/${attClassroomId}?date=${attDate}`);
      if (res.ok) {
        const data = await res.json();
        // Initialize records for all students in class
        const crm = classrooms.find(c => c.id === attClassroomId);
        if (crm?.students) {
          const records = crm.students.map((s: any) => {
            const existing = data.find((d: any) => d.userId === s.id);
            return {
              userId: s.id,
              user: s,
              status: existing ? existing.status : null,
              notes: existing ? existing.notes : ''
            };
          });
          setAttRecords(records);
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchAttReport = async () => {
    if (!attClassroomId || !attMonth) return;
    try {
      const [year, month] = attMonth.split("-");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/report/${attClassroomId}?month=${month}&year=${year}`);
      if (res.ok) {
        setAttReport(await res.json());
      }

      const allReports: Record<string, any> = {};
      await Promise.all(classrooms.map(async (c: any) => {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/report/${c.id}?month=${month}&year=${year}`);
        if (r.ok) {
          const data = await r.json();
          data.report.forEach((sr: any) => {
            if (!allReports[sr.user.id]) {
              allReports[sr.user.id] = { user: sr.user, classes: [], totalAmount: 0 };
            }
            if (sr.totalAmount > 0 || sr.presentCount > 0) {
              allReports[sr.user.id].classes.push({
                classroomName: data.classroom.name,
                presentCount: sr.presentCount,
                feePerLesson: data.classroom.feePerLesson,
                totalAmount: sr.totalAmount,
              });
              allReports[sr.user.id].totalAmount += sr.totalAmount;
            }
          });
        }
      }));
      setAggregatedReports(allReports);

    } catch (err) { console.error(err); }
  };

  const exportSinglePDF = async (studentId: string, studentName: string) => {
    const el = invoiceRefs.current[studentId];
    if (!el) return;
    try {
      setIsExporting(true);
      // Brief timeout to let any styles settle
      await new Promise(r => setTimeout(r, 100));
      const imgData = await toPng(el, { pixelRatio: 2, cacheBust: true });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [800, 1131] });
      pdf.addImage(imgData, 'PNG', 0, 0, 800, 1131);
      pdf.save(`${studentName.replace(/\s+/g, '_')}_${attMonth.replace('-', '_')}.pdf`);
    } catch (err: any) {
      console.error(err);
      Swal.fire('Lỗi', `Không thể xuất PDF: ${err.message || String(err)}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const exportAllPDFs = async () => {
    if (!attReport?.report?.length) return;
    try {
      setIsExporting(true);
      const zip = new JSZip();
      for (const sr of attReport.report) {
        const el = invoiceRefs.current[sr.user.id];
        if (el) {
          const imgData = await toPng(el, { pixelRatio: 2, cacheBust: true });
          const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [800, 1131] });
          pdf.addImage(imgData, 'PNG', 0, 0, 800, 1131);
          const pdfBlob = pdf.output('blob');
          zip.file(`${sr.user.name.replace(/\s+/g, '_')}_${attMonth.replace('-', '_')}.pdf`, pdfBlob);
        }
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `HoaDon_${attMonth.replace('-', '_')}.zip`);
    } catch (err: any) {
      console.error(err);
      Swal.fire('Lỗi', `Không thể xuất file ZIP: ${err.message || String(err)}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    if (activeTab === "ATTENDANCE") {
      if (attView === "MARK") fetchAttendance();
      if (attView === "REPORT") fetchAttReport();
    }
  }, [attClassroomId, attDate, attMonth, attView, activeTab]);

  const handleSaveAttendance = async (recordsToSave = attRecords, showToast = true) => {
    if (!attClassroomId || !attDate) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId: attClassroomId, date: attDate, records: recordsToSave })
      });
      if (res.ok && showToast) {
        Swal.fire({
          title: 'Đã lưu điểm danh',
          icon: 'success',
          toast: true,
          position: 'top-end',
          showConfirmButton: false,
          timer: 1500
        });
      } else if (!res.ok) {
        Swal.fire('Lỗi', 'Lưu thất bại', 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handlePayTuition = async (userId: string, totalAmount: number) => {
    if (!attClassroomId || !attMonth) return;
    try {
      const [year, month] = attMonth.split("-");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/attendance/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classroomId: attClassroomId, userId, month, year, totalAmount })
      });
      if (res.ok) {
        Swal.fire('Thành công', 'Đã xác nhận thanh toán!', 'success');
        fetchAttReport();
      } else {
        Swal.fire('Lỗi', 'Thất bại', 'error');
      }
    } catch (err) { console.error(err); }
  };

  const handleDuplicateLesson = (oldLesson: any) => {
    setCreateLessonTitle(`[Bản sao] ${oldLesson.title}`);
    setCreateLessonDesc(oldLesson.description || "");
    setCreateLessonClassroomId("");
    setLessonVocabs(oldLesson.vocabularies?.map((v: any) => ({ word: v.word, pos: v.pos, phonetic: v.phonetic, meaning: v.meaning, example: v.example, imageUrl: v.imageUrl })) || []);
    setLessonGrammars(oldLesson.grammars?.map((g: any) => ({ title: g.title, structure: g.structure, explanation: g.explanation })) || []);
    setEditingLessonId(null);
    setActiveTab("CREATE_LESSON");
    setExpandedNav(prev => ({ ...prev, 'LESSONS_GROUP': true }));
  };

  const handleEditLessonSetup = (lesson: any) => {
    setCreateLessonTitle(lesson.title);
    setCreateLessonDesc(lesson.description || "");
    setCreateLessonClassroomId(lesson.classroomId || "");
    setLessonVocabs(lesson.vocabularies?.map((v: any) => ({ word: v.word, pos: v.pos, phonetic: v.phonetic, meaning: v.meaning, example: v.example, imageUrl: v.imageUrl })) || []);
    setLessonGrammars(lesson.grammars?.map((g: any) => ({ title: g.title, structure: g.structure, explanation: g.explanation })) || []);
    setEditingLessonId(lesson.id);
    setActiveTab("CREATE_LESSON");
    setExpandedNav(prev => ({ ...prev, 'LESSONS_GROUP': true }));
  };

  const handleDuplicateExam = async (oldExam: any) => {
    setGlobalLoading({ isLoading: true, message: "Đang tải dữ liệu để nhân bản..." });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/${oldExam.id}`);
      const fullExam = await res.json();
      if (fullExam.error) throw new Error(fullExam.error);

      setCreateTitle(`[Bản sao] ${fullExam.title}`);
      setCreateType(fullExam.examType || "ASSIGNMENT");
      setCreateClassroomId("");
      setCreateAssignMode("CLASS");
      setCreateStudentIds([]);
      setCreateDuration((fullExam.duration || 45).toString());
      setCreateMaxAttempts((fullExam.maxAttempts || 1).toString());
      setCreatePublishMode("NOW");
      setCreatePublishTime("");
      setCreateDeadline("");
      setCreateNotes(fullExam.notes || "");
      
      const qArray = (fullExam.questions && fullExam.questions.length > 0) ? fullExam.questions.map((qObj: any) => {
        const q = qObj.question || qObj; // Handle both nested and unnested structures just in case
        let parsedOpts = ["", "", "", ""];
        if (q.type === 'MULTIPLE_CHOICE') {
          try {
            const arr = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            if (Array.isArray(arr)) {
              parsedOpts = [arr[0] || "", arr[1] || "", arr[2] || "", arr[3] || ""];
            }
          } catch (e) {}
        }
        return {
          _key: newQuestionKey(),
          heading: q.heading || "",
          type: q.type,
          content: q.content,
          options: parsedOpts,
          correctOption: q.correctOption || "A",
          explanation: q.explanation || "",
          imageUrl: q.imageUrl || "",
          points: q.points || 1
        };
      }) : [BLANK_QUESTION()];

      setCreateQuestions(qArray);
      setExpandedQuestions(Object.fromEntries(qArray.map((q: any) => [q._key, true])));
      markExpanded(qArray.map((q: any) => q._key));
      setQuestionsListGeneration(g => g + 1);
      setActiveTab("CREATE");
      setExpandedNav(prev => ({ ...prev, 'EXAMS_GROUP': true }));
    } catch (e: any) {
      Swal.fire('Lỗi', 'Không thể tải chi tiết đề thi để nhân bản.', 'error');
    } finally {
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  // ── Handlers for exams ──management state ──
  const [localExams, setLocalExams] = useState<any[]>([]);
  const [selectedExamForView, setSelectedExamForView] = useState<any>(null);
  const [editExam, setEditExam] = useState<any>(null);
  const [examViewTab, setExamViewTab] = useState<'QUESTIONS' | 'RESULTS'>('QUESTIONS');

  useEffect(() => {
    if (selectedExamForView && !selectedExamForView.questions) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/exams/${selectedExamForView.id}`)
        .then(res => res.json()).then(data => setSelectedExamForView(data)).catch(console.error);
    }
  }, [selectedExamForView]);

  const handleDeleteExam = async (examId: string) => {
    Swal.fire({
      title: 'Xác nhận xóa',
      text: 'Bạn có chắc muốn xóa đề thi này không?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Có, xóa',
      cancelButtonText: 'Hủy'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/exams/${examId}`, { method: 'DELETE' });
          if (res.ok) {
            setLocalExams(localExams.filter((e: any) => e.id !== examId));
            const refreshed = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/classroom/teacher/${user.id}`).then(r => r.json());
            setClassrooms(refreshed);
            Swal.fire('Đã xóa!', 'Đề thi đã được xóa thành công.', 'success');
          } else { 
            Swal.fire('Lỗi', 'Xóa thất bại', 'error'); 
          }
        } catch (err) { console.error(err); }
      }
    });
  };

  const handleDeleteClassroom = async (classroom: any) => {
    Swal.fire({
      title: 'Xác nhận xóa lớp',
      html: `Bạn có chắc muốn xóa lớp <b>${classroom.name}</b> không?<br/>Toàn bộ bài học, đề thi, tài liệu, điểm danh và học phí của lớp này sẽ bị xóa vĩnh viễn.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Có, xóa lớp',
      cancelButtonText: 'Hủy',
      confirmButtonColor: '#e11d48'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/classroom/${classroom.id}`, { method: 'DELETE' });
          if (res.ok) {
            setClassrooms(classrooms.filter((c: any) => c.id !== classroom.id));
            Swal.fire('Đã xóa!', 'Lớp học đã được xóa thành công.', 'success');
          } else {
            Swal.fire('Lỗi', 'Xóa lớp thất bại', 'error');
          }
        } catch (err) { console.error(err); Swal.fire('Lỗi', 'Xóa lớp thất bại', 'error'); }
      }
    });
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editExam) return;
    setGlobalLoading({ isLoading: true, message: "Đang lưu thay đổi đề thi..." });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/exams/${editExam.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editExam.title, examType: editExam.examType, duration: editExam.duration,
          publishTime: editExam.publishTime || null, deadline: editExam.deadline || null, notes: editExam.notes || null
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setLocalExams(localExams.map((e: any) => e.id === updated.id ? updated : e));
        const refreshed = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/classroom/teacher/${user.id}`).then(r => r.json());
        setClassrooms(refreshed);
        setEditExam(null);
      } else { Swal.fire('Lỗi', 'Cập nhật thất bại', 'error'); }
    } catch (err) { console.error(err); } finally { setGlobalLoading({ isLoading: false, message: "" }); }
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

  const [expandedQuestions, setExpandedQuestions] = useState<Record<string, boolean>>(() => ({ [createQuestions[0]._key]: true }));
  const isQuestionExpanded = (key: string) => expandedQuestions[key] !== false;
  // Once a question card has been opened, its editors stay mounted forever and collapsing just hides
  // them with CSS — react-quill-new can fail to sync a *freshly mounted* editor's value when other
  // already-initialized editors exist alongside it, but toggling visibility of an already-mounted
  // editor is safe (this is also why only the FIRST open of a card needs the section-remount below).
  const [everExpandedQuestions, setEverExpandedQuestions] = useState<Record<string, boolean>>(() => ({ [createQuestions[0]._key]: true }));
  const markExpanded = (keys: string[]) => setEverExpandedQuestions(prev => {
    const next = { ...prev };
    keys.forEach(k => { next[k] = true; });
    return next;
  });
  const toggleQuestionExpanded = (key: string) => {
    const expanding = !isQuestionExpanded(key);
    setExpandedQuestions(prev => ({ ...prev, [key]: expanding }));
    if (expanding) markExpanded([key]);
  };
  const allQuestionsExpanded = createQuestions.every(q => isQuestionExpanded(q._key));
  const toggleAllQuestionsExpanded = () => {
    const next = !allQuestionsExpanded;
    setExpandedQuestions(Object.fromEntries(createQuestions.map(q => [q._key, next])));
    if (next) markExpanded(createQuestions.map(q => q._key));
  };
  // react-quill-new can fail to sync a fresh editor's controlled value when it mounts alongside
  // other already-open editors on the same tab. Bumping this key forces the whole question list to
  // fully unmount and remount as one batch whenever content is bulk-loaded (Excel import), which
  // mounts every editor the same reliable way the (pre-existing, working) "Nhân bản" duplicate flow does.
  const [questionsListGeneration, setQuestionsListGeneration] = useState(0);

  const addQuestion = () => {
    const q = BLANK_QUESTION();
    setCreateQuestions([...createQuestions, q]);
    setExpandedQuestions(prev => ({ ...prev, [q._key]: true }));
    markExpanded([q._key]);
  };
  const removeQuestion = (i: number) => {
    const removedKey = createQuestions[i]._key;
    setCreateQuestions(createQuestions.filter((_, idx) => idx !== i));
    setExpandedQuestions(prev => {
      const next = { ...prev };
      delete next[removedKey];
      return next;
    });
  };
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

  const handleDownloadExamQuestionTemplate = () => {
    const headers = ["Loại (TN/TL)", "Câu hỏi *", "Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D", "Đáp án đúng", "Giải thích", "Điểm"];
    const sampleRows = [
      ["TN", "What is the capital of Vietnam?", "Hanoi", "Ho Chi Minh City", "Da Nang", "Hue", "A", "Hanoi là thủ đô của Việt Nam.", 1],
      ["TL", "Complete: I ___ (go) to school every day.", "", "", "", "", "go", "Thì hiện tại đơn với chủ ngữ I (thói quen).", 1],
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);

    const headerStyle = {
      font: { name: 'Calibri', bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
      fill: { fgColor: { rgb: "1E3A8A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: {
        top: { style: "thin", color: { auto: 1 } },
        bottom: { style: "thin", color: { auto: 1 } },
        left: { style: "thin", color: { auto: 1 } },
        right: { style: "thin", color: { auto: 1 } }
      }
    };
    const dataStyle = {
      font: { name: 'Calibri', sz: 11 },
      alignment: { vertical: "center", wrapText: true },
      border: {
        top: { style: "thin", color: { rgb: "EEEEEE" } },
        bottom: { style: "thin", color: { rgb: "EEEEEE" } },
        left: { style: "thin", color: { rgb: "EEEEEE" } },
        right: { style: "thin", color: { rgb: "EEEEEE" } }
      }
    };

    const range = XLSX.utils.decode_range(ws['!ref'] || "A1:I3");
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_ref = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cell_ref]) continue;
        ws[cell_ref].s = R === 0 ? headerStyle : dataStyle;
      }
    }

    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 14 }, { wch: 35 }, { wch: 8 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Questions");
    XLSX.writeFile(wb, "ExamQuestionsTemplate.xlsx");
  };

  const handleUploadExamQuestionsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
      const dataRows = rows.slice(1);

      const imported: ReturnType<typeof BLANK_QUESTION>[] = [];
      let skipped = 0;
      dataRows.forEach(row => {
        const [loai, noidung, a, b, c, d, dapAnDung, giaiThich, diem] = row || [];
        const content = (noidung ?? '').toString().trim();
        if (!content) { skipped++; return; }

        const type: "MULTIPLE_CHOICE" | "ESSAY" = (loai ?? '').toString().trim().toUpperCase().startsWith('TL') ? 'ESSAY' : 'MULTIPLE_CHOICE';
        const q = BLANK_QUESTION();
        q.type = type;
        q.points = parseFloat(diem) || 1;
        q.explanation = textToQuillHtml((giaiThich ?? '').toString().trim());
        if (type === 'MULTIPLE_CHOICE') {
          q.options = [a, b, c, d].map(v => textToQuillHtml((v ?? '').toString().trim()));
          const letter = (dapAnDung ?? '').toString().trim().toUpperCase();
          q.correctOption = ['A', 'B', 'C', 'D'].includes(letter) ? letter : 'A';
        } else {
          q.correctOption = (dapAnDung ?? '').toString().trim().toLowerCase();
        }
        q.content = textToQuillHtml(content);
        imported.push(q);
      });

      if (imported.length === 0) {
        Swal.fire('Không tìm thấy câu hỏi', 'File Excel không có dòng dữ liệu hợp lệ. Vui lòng dùng đúng file mẫu.', 'warning');
        e.target.value = '';
        return;
      }

      const isBlankOnly = createQuestions.length === 1 && !createQuestions[0].content.trim();
      setCreateQuestions(isBlankOnly ? imported : [...createQuestions, ...imported]);
      setExpandedQuestions(prev => {
        const next = isBlankOnly ? {} : { ...prev };
        imported.forEach((q) => { next[q._key] = true; });
        return next;
      });
      markExpanded(imported.map(q => q._key));
      // Force the whole question list to remount as one batch: mounting every editor together in a
      // single commit is the reliable path (matching the existing "Nhân bản" duplicate-exam flow);
      // mounting a freshly-imported, already non-empty editor on its own later is what triggers the bug.
      setQuestionsListGeneration(g => g + 1);
      Swal.fire('Thành công', `Đã nhập ${imported.length} câu hỏi từ Excel${skipped ? ` (bỏ qua ${skipped} dòng trống)` : ''}. Vui lòng kiểm tra lại nội dung trước khi lưu.`, 'success');
      e.target.value = '';
    };
    reader.readAsBinaryString(file);
  };

  const [solvingAI, setSolvingAI] = useState<Record<number, boolean>>({});

  const handleSolveAI = async (qi: number) => {
    const q = createQuestions[qi];
    if (!q.content.trim()) return Swal.fire('Cảnh báo', "Vui lòng nhập nội dung câu hỏi trước khi nhờ AI giải!", 'warning');
    if (q.type === 'MULTIPLE_CHOICE' && q.options.filter(o => o.trim()).length < 2) {
      return Swal.fire('Cảnh báo', "Vui lòng nhập ít nhất 2 đáp án trước khi nhờ AI giải!", 'warning');
    }

    setSolvingAI(prev => ({ ...prev, [qi]: true }));
    setGlobalLoading({ isLoading: true, message: "AI đang chọn đáp án & giải thích..." });
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/ai/solve-question`, {
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
        correctOption: q.type === 'ESSAY' ? (data.correctOption || q.correctOption).toLowerCase() : (data.correctOption || q.correctOption),
        explanation: data.explanation || ''
      });
    } catch (err: any) {
      Swal.fire('Lỗi AI', err.message, 'error');
    } finally {
      setSolvingAI(prev => ({ ...prev, [qi]: false }));
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTitle.trim()) return Swal.fire('Cảnh báo', 'Vui lòng nhập tiêu đề đề thi', 'warning');
    if (!createClassroomId) return Swal.fire('Cảnh báo', 'Vui lòng chọn lớp học', 'warning');
    if (createQuestions.length === 0) return Swal.fire('Cảnh báo', 'Vui lòng thêm ít nhất 1 câu hỏi', 'warning');
    for (let i = 0; i < createQuestions.length; i++) {
      if (!createQuestions[i].content.trim()) return Swal.fire('Cảnh báo', `Câu ${i + 1}: Vui lòng nhập nội dung câu hỏi`, 'warning');
      if (createQuestions[i].type === 'MULTIPLE_CHOICE') {
        const filledOpts = createQuestions[i].options.filter(o => o.trim());
        if (filledOpts.length < 2) return Swal.fire('Cảnh báo', `Câu ${i + 1}: Trắc nghiệm cần ít nhất 2 đáp án`, 'warning');
      }
    }
    setIsCreating(true);
    setGlobalLoading({ isLoading: true, message: "Đang lưu đề thi..." });
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
          correctOption: q.correctOption || '',
          explanation: q.explanation || '',
          imageUrl: q.imageUrl || null,
          points: q.points || 1,
        }))
      };
      if (user?.id) {
        (payload as any).uploadedById = user.id;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/exams/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tạo đề thất bại');
      const refreshed = await fetch(`${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/classroom/teacher/${user.id}`).then(r => r.json());
      setClassrooms(refreshed);
      setLocalExams([...localExams, data]);
      // Reset form
      setCreateTitle(""); setCreateType("ASSIGNMENT"); setCreateClassroomId("");
      setCreateAssignMode("CLASS"); setCreateStudentIds([]); setCreateDuration("45"); setCreateMaxAttempts("1");
      setCreatePublishMode("NOW"); setCreatePublishTime(""); setCreateDeadline(""); setCreateNotes("");
      setCreateQuestions([BLANK_QUESTION()]);
      setActiveTab("EXAMS");
      Swal.fire('Thành công', 'Tạo đề thi thành công!', 'success');
    } catch (err: any) {
      Swal.fire('Lỗi', err.message, 'error');
      console.error(err);
    } finally {
      setIsCreating(false);
      setGlobalLoading({ isLoading: false, message: "" });
    }
  };

  // ── Nav ──
  const [expandedNav, setExpandedNav] = useState<Record<string, boolean>>({
    'QUANLY': true,
    'DOCUMENTS_GROUP': true,
    'LESSONS_GROUP': true,
    'EXAMS_GROUP': true,
  });

  const toggleNavGroup = (id: string) => {
    setExpandedNav(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const navGroups = [
    { id: "OVERVIEW", label: "Tổng Quan", icon: "📊" },
    {
      id: "QUANLY", label: "Quản Lý Chung", icon: "🗂️",
      subItems: [
        { id: "CLASSES", label: "Lớp Học", icon: "🏫" },
        { id: "STUDENTS", label: "Học Viên", icon: "🧑‍🎓" },
        { id: "ATTENDANCE", label: "Điểm Danh & Học Phí", icon: "💳" },
        { id: "CALENDAR", label: "Thời Khóa Biểu", icon: "📅" },
        { id: "CHEAT_CONTROL", label: "Kiểm Soát Gian Lận", icon: "🛡️" }
      ]
    },
    {
      id: "LESSONS_GROUP", label: "Bài Học", icon: "📖",
      subItems: [
        { id: "LESSONS", label: "Danh Sách Bài Học", icon: "📋" },
        { id: "CREATE_LESSON", label: "Tạo Bài Học", icon: "✍️" }
      ]
    },
    {
      id: "DOCUMENTS_GROUP", label: "Tài Liệu", icon: "📁",
      subItems: [
        { id: "DOCUMENTS", label: "Kho Tài Liệu", icon: "📁" }
      ]
    },
    {
      id: "LISTENING_GROUP", label: "Luyện Nghe", icon: "🎧",
      subItems: [
        { id: "LISTENING_STUDIO", label: "Studio Luyện Nghe", icon: "🎙️" }
      ]
    },
    {
      id: "SPEAKING_GROUP", label: "Luyện Nói", icon: "🗣️",
      subItems: [
        { id: "SPEAKING_TOPICS", label: "Chủ Đề Hội Thoại", icon: "💬" }
      ]
    },
    {
      id: "EXAMS_GROUP", label: "Đề Thi", icon: "📝",
      subItems: [
        { id: "EXAMS", label: "Ngân Hàng Đề Thi", icon: "🏦" },
        { id: "CREATE", label: "Tạo Đề Mới", icon: "➕" }
      ]
    },
    { id: "LEADERBOARD", label: "Bảng Xếp Hạng", icon: "🏆" }
  ];

  const allStudents = classrooms.flatMap(c => c.students || []).filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);

  const studentAvgScore = (s: any) => {
    const results = s.examResults || [];
    const uniqueResults: any[] = Object.values(results.reduce((acc: any, r: any) => {
      if (!acc[r.examId] || r.score > acc[r.examId].score) acc[r.examId] = r;
      return acc;
    }, {}));
    return uniqueResults.length > 0 ? uniqueResults.reduce((sum: number, r: any) => sum + r.score, 0) / uniqueResults.length : null;
  };

  const classroomScoreStats = classrooms
    .map(c => {
      const scored = (c.students || []).map(studentAvgScore).filter((v: number | null): v is number => v !== null);
      const avg = scored.length > 0 ? scored.reduce((s: number, v: number) => s + v, 0) / scored.length : 0;
      return { name: c.name, DiemTB: Math.round(avg * 10) / 10 };
    })
    .filter(c => c.DiemTB > 0);

  const assignmentCompletion = classrooms.reduce((acc, c) => {
    const studentCount = c.students?.length || 0;
    (c.exams || []).forEach((e: any) => {
      const submitters = new Set((e.results || []).map((r: any) => r.userId)).size;
      acc.expected += studentCount;
      acc.submitted += Math.min(submitters, studentCount);
    });
    return acc;
  }, { expected: 0, submitted: 0 });
  const completionRate = assignmentCompletion.expected > 0 ? Math.round((assignmentCompletion.submitted / assignmentCompletion.expected) * 100) : null;

  if (loading) return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden w-full">
      <div className="hidden md:flex w-64 bg-[#1e3a8a] flex-col shrink-0 h-full pt-6 px-4 gap-2">
        <div className="flex items-center gap-3 px-1 pb-4 border-b border-white/10 mb-4">
          <div className="skeleton w-10 h-10 rounded-full shrink-0 opacity-40" />
          <div className="flex flex-col gap-2 flex-1">
            <div className="skeleton h-3 rounded w-3/4 opacity-40" />
            <div className="skeleton h-2 rounded w-1/2 opacity-30" />
          </div>
        </div>
        {[80, 60, 70, 50, 65, 55, 75, 45].map((w, i) => (
          <div key={i} className="skeleton h-8 rounded-lg opacity-20" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="flex-1 p-8 bg-slate-100 flex flex-col gap-6">
        <div className="skeleton h-8 w-64 rounded-lg" />
        <div className="grid grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="skeleton h-72 rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
          <div className="skeleton h-40 rounded-xl" />
          <div className="skeleton h-40 rounded-xl" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-80px)] overflow-hidden w-full relative">

      {/* Mobile Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 md:z-auto w-64 bg-[#1e3a8a] flex flex-col shrink-0 h-full overflow-y-auto border-r border-blue-900/50 shadow-2xl md:shadow-none transform transition-transform duration-300 md:relative md:translate-x-0 pt-6 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-4 px-4 pb-4 border-b border-white/10 flex items-center gap-3">
          <label className="w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center font-bold text-lg shrink-0 cursor-pointer relative overflow-hidden hover:ring-2 hover:ring-white/30 transition-all group">
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() || 'T'
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] font-bold text-white tracking-wider">ĐỔI</span>
            </div>
          </label>
          <div className="overflow-hidden">
            <h2 className="text-sm font-bold text-white truncate">{user?.name || 'Thầy/Cô'}</h2>
            <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">Giáo viên</p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 px-2">
          {navGroups.map((group, index) => (
            <div key={group.id} className={`flex flex-col ${index > 0 && (group.subItems || (navGroups[index - 1] as any).subItems) ? 'mt-2 pt-2 border-t border-white/10' : ''}`}>
              {group.subItems ? (
                <>
                  <button
                    onClick={() => toggleNavGroup(group.id)}
                    className="flex items-center justify-between gap-2 px-3 pb-1.5 transition-colors duration-150 cursor-pointer text-left text-[11px] font-bold uppercase tracking-widest text-white/50 hover:text-white/80"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm not-italic">{group.icon}</span>
                      {group.label}
                    </span>
                    <span className={`transform transition-transform text-white/40 ${expandedNav[group.id] ? 'rotate-180' : ''}`}>▾</span>
                  </button>
                  {expandedNav[group.id] && (
                    <div className="flex flex-col gap-0.5">
                      {group.subItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                          className={`flex items-center gap-2.5 pr-3 py-2 text-sm transition-colors duration-150 cursor-pointer text-left w-full rounded-lg mx-1 ${activeTab === item.id ? 'bg-white text-[#1e3a8a] font-bold shadow-sm pl-4' : 'pl-4 font-medium text-white/60 hover:bg-white/10 hover:text-white'}`}>
                          <span className="text-base shrink-0">{item.icon}</span>
                          <span className="truncate">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button onClick={() => { setActiveTab(group.id); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-2.5 pr-3 py-2.5 text-sm transition-colors duration-150 cursor-pointer text-left w-full rounded-lg mx-1 ${activeTab === group.id ? 'bg-white text-[#1e3a8a] font-bold shadow-sm pl-3' : 'pl-3 font-medium text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  <span className="text-base shrink-0">{group.icon}</span>
                  <span className="truncate">{group.label}</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-auto border-t border-white/10 px-3 py-3">
          <button
            onClick={() => { localStorage.removeItem('userId'); window.location.href = '/'; }}
            className="flex items-center justify-center gap-2 px-3 py-2.5 font-semibold text-white/40 hover:bg-white/10 hover:text-white/80 transition-colors w-full cursor-pointer text-sm rounded-lg"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 md:p-8 h-full overflow-y-auto relative bg-slate-100 flex flex-col w-full">

        {/* Mobile Header with Hamburger */}
        <div className="md:hidden flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-slate-50 transition-colors">
              <span className="text-xl">☰</span>
            </button>
            <h2 className="font-bold text-primary tracking-tight">LUCY TUTOR</h2>
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "OVERVIEW" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold">Xin chào, {user?.name?.split(' ').slice(-1)[0] || 'Thầy/Cô'} 👋</h1>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <StatCard title="Tổng Lớp" value={String(classrooms.length)} icon="🏫" accent="blue" />
              <StatCard title="Tổng Học Viên" value={String(allStudents.length)} icon="🧑‍🎓" accent="violet" />
              <StatCard title="Bài Tập / Đề Thi" value={String(classrooms.flatMap(c => c.exams || []).length)} icon="📝" accent="green" />
              <StatCard title="Câu Hỏi" value={String(classrooms.flatMap(c => c.exams || []).reduce((s: number, e: any) => s + (e.totalQuestions || 0), 0))} icon="❓" accent="amber" />
              <StatCard title="Tỷ Lệ Nộp Bài" value={completionRate !== null ? `${completionRate}%` : '—'} icon="📊" accent="cyan" sub="Trên tổng số bài đã giao" />
            </div>

            {/* Revenue trend — the headline "business health" chart */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mt-6">
              <div className="mb-6">
                <h3 className="font-bold text-slate-700">Doanh Thu Học Phí 6 Tháng Gần Đây</h3>
                <p className="text-xs text-slate-400 mt-0.5">Tổng đã thu so với tổng cần thu mỗi tháng, trên tất cả các lớp</p>
              </div>
              {revenueTrend ? (
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} width={56}
                        tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(0)}tr` : String(v)} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v: any) => `${Number(v).toLocaleString()} đ`}
                        contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                      <Bar dataKey="CanThu" name="Cần Thu" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={22} />
                      <Bar dataKey="DaThu" name="Đã Thu" fill="#059669" radius={[4, 4, 0, 0]} barSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm italic">Đang tải dữ liệu doanh thu...</div>
              )}
            </div>

            {/* Overview Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
              <div className="lg:col-span-2 bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-slate-700">Sĩ Số & Bài Tập Theo Lớp</h3>
                    <p className="text-xs text-slate-400 mt-0.5">So sánh quy mô và khối lượng bài tập giữa các lớp</p>
                  </div>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classrooms.map(c => ({ name: c.name, HọcSinh: c.students?.length || 0, BàiTập: c.exams?.length || 0 }))} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} width={28} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                      <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '13px' }} />
                      <Bar dataKey="HọcSinh" name="Số Học Viên" fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28} />
                      <Bar dataKey="BàiTập" name="Số Bài Tập" fill="#059669" radius={[4, 4, 0, 0]} barSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm flex flex-col">
                <div className="mb-2">
                  <h3 className="font-bold text-slate-700">Tình Hình Thu Học Phí</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Tháng {overviewTuitionMonth.split('-')[1]}/{overviewTuitionMonth.split('-')[0]}</p>
                </div>
                {overviewTuitionData ? (
                  <>
                    <div className="relative h-[190px] w-full shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Đã thu', value: overviewTuitionData.totalCollected },
                              { name: 'Còn thiếu', value: Math.max(overviewTuitionData.totalExpected - overviewTuitionData.totalCollected, 0) },
                            ]}
                            dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={78}
                            paddingAngle={3} stroke="#fff" strokeWidth={2}
                          >
                            <Cell fill="#059669" />
                            <Cell fill="#fda4af" />
                          </Pie>
                          <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()} đ`} contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-extrabold text-slate-800 tabular-nums">
                          {overviewTuitionData.totalExpected > 0 ? Math.round((overviewTuitionData.totalCollected / overviewTuitionData.totalExpected) * 100) : 0}%
                        </span>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Đã thu</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-4 text-xs font-semibold mt-2">
                      <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Đã thu</span>
                      <span className="flex items-center gap-1.5 text-slate-500"><span className="w-2.5 h-2.5 rounded-full bg-rose-300 inline-block" /> Còn thiếu</span>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic">Đang tải dữ liệu học phí...</div>
                )}
              </div>
            </div>

            {classroomScoreStats.length > 0 && (
              <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mb-6">
                <div className="mb-6">
                  <h3 className="font-bold text-slate-700">Điểm Trung Bình Theo Lớp</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Dựa trên điểm cao nhất mỗi đề của học viên trong lớp</p>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classroomScoreStats} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" domain={[0, 10]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                      <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={160} tick={{ fontSize: 12, fill: '#475569' }} />
                      <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', fontSize: '13px' }} />
                      <Bar dataKey="DiemTB" name="Điểm trung bình" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={22}>
                        <LabelList dataKey="DiemTB" position="right" style={{ fontSize: 12, fontWeight: 700, fill: '#1e293b' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Tuition management summary (quản lý chung) */}
            <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm mt-6">
              <div className="flex justify-between items-center flex-wrap gap-4 mb-6">
                <h3 className="font-bold text-slate-700 text-lg">💰 Quản Lý Thu Học Phí</h3>
                <input type="month" value={overviewTuitionMonth} onChange={e => setOverviewTuitionMonth(e.target.value)}
                  className="p-2 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>

              {!overviewTuitionData ? (
                <p className="text-slate-400 italic">Đang tải dữ liệu học phí...</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <StatCard title="Tổng Đã Thu" value={`${overviewTuitionData.totalCollected.toLocaleString()} đ`} />
                    <StatCard title="Tổng Cần Thu" value={`${overviewTuitionData.totalExpected.toLocaleString()} đ`} />
                    <StatCard title="Đã Đóng" value={String(overviewTuitionData.paidCount)} />
                    <StatCard title="Chưa Đóng" value={String(overviewTuitionData.unpaidCount)} />
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <button onClick={() => setShowUnpaidOnly(false)} className={`px-3 py-1.5 text-sm font-bold rounded-lg cursor-pointer transition-colors ${!showUnpaidOnly ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Tất cả</button>
                    <button onClick={() => setShowUnpaidOnly(true)} className={`px-3 py-1.5 text-sm font-bold rounded-lg cursor-pointer transition-colors ${showUnpaidOnly ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Chỉ chưa đóng</button>
                  </div>

                  {(() => {
                    const rows = [...overviewTuitionData.paidList, ...overviewTuitionData.unpaidList]
                      .filter((r: any) => !showUnpaidOnly || r.paymentStatus !== 'PAID')
                      .sort((a: any, b: any) => (a.paymentStatus === b.paymentStatus ? 0 : a.paymentStatus === 'PAID' ? 1 : -1));

                    if (rows.length === 0) return <p className="text-slate-400 italic">Không có dữ liệu học phí phù hợp.</p>;

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[700px]">
                          <thead>
                            <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest">
                              <th className="p-3 font-bold border-b border-gray-100">Học Viên</th>
                              <th className="p-3 font-bold border-b border-gray-100">Lớp</th>
                              <th className="p-3 font-bold border-b border-gray-100 text-center">Số Buổi</th>
                              <th className="p-3 font-bold border-b border-gray-100 text-right">Số Tiền</th>
                              <th className="p-3 font-bold border-b border-gray-100 text-center">Trạng Thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r: any, i: number) => (
                              <tr key={`${r.classroomId}-${r.user.id}-${i}`} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors">
                                <td className="p-3 font-medium flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                    {r.user.name.charAt(0)}
                                  </div>
                                  <div>{r.user.name}</div>
                                </td>
                                <td className="p-3 text-sm text-slate-500">{r.classroomName}</td>
                                <td className="p-3 text-center">{r.presentCount}</td>
                                <td className="p-3 text-right font-bold">{r.totalAmount.toLocaleString()} đ</td>
                                <td className="p-3 text-center">
                                  <span className={`px-2 py-1 text-xs font-bold rounded-full ${r.paymentStatus === 'PAID' ? 'bg-green-500/10 text-green-600' : 'bg-rose-500/10 text-rose-600'}`}>
                                    {r.paymentStatus === 'PAID' ? 'Đã đóng' : 'Chưa đóng'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── CLASSES ── */}
        {activeTab === "CLASSES" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Lớp Học</h1>
              <button onClick={openCreateModal} className="px-4 py-2 bg-primary text-white font-bold hover:bg-blue-700 rounded-lg cursor-pointer">+ Tạo Lớp</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map(c => <ClassCard key={c.id} c={c} onEdit={() => openEditModal(c)} onDelete={() => handleDeleteClassroom(c)} />)}
            </div>
          </div>
        )}

        {/* ── STUDENTS ── */}
        {activeTab === "STUDENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center flex-wrap gap-4">
              <h1 className="text-3xl font-bold">Danh Sách Học Viên</h1>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                <input 
                  type="text" 
                  placeholder="Tìm theo tên hoặc email..." 
                  value={searchStudentQuery}
                  onChange={(e) => setSearchStudentQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-200 bg-white rounded-lg focus:border-primary focus:outline-none min-w-[250px]"
                />
              </div>
            </div>
            {(() => {
              const filteredStudents = allStudents.filter((s: any) => 
                s.name.toLowerCase().includes(searchStudentQuery.toLowerCase()) || 
                s.email.toLowerCase().includes(searchStudentQuery.toLowerCase())
              );
              if (allStudents.length === 0) return <p className="text-slate-400">Chưa có học viên nào tham gia lớp.</p>;
              if (filteredStudents.length === 0) return <p className="text-slate-400">Không tìm thấy học viên phù hợp.</p>;
              
              const getTier = (xp: number) => {
                const level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
                if (level >= 20) return { name: `Cấp ${level} - 💎 Huyền Thoại`, color: 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20' };
                if (level >= 15) return { name: `Cấp ${level} - 🥇 Bậc Thầy`, color: 'text-yellow-600 bg-yellow-500/10 border border-yellow-500/20' };
                if (level >= 10) return { name: `Cấp ${level} - 🥈 Tinh Anh`, color: 'text-slate-600 bg-slate-500/10 border border-slate-500/20' };
                if (level >= 5) return { name: `Cấp ${level} - 📖 Học Giả`, color: 'text-amber-700 bg-amber-500/10 border border-amber-500/20' };
                return { name: `Cấp ${level} - 🌱 Tân Binh`, color: 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20' };
              };

              return (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-[800px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest">
                        <th className="p-4 font-bold border-b border-gray-100">Học Viên</th>
                        <th className="p-4 font-bold border-b border-gray-100">Cấp Bậc</th>
                        <th className="p-4 font-bold border-b border-gray-100 text-center">Điểm XP</th>
                        <th className="p-4 font-bold border-b border-gray-100">Lớp</th>
                        <th className="p-4 font-bold border-b border-gray-100 text-center">Điểm TB</th>
                        <th className="p-4 font-bold border-b border-gray-100 text-center">Mục tiêu</th>
                        <th className="p-4 font-bold border-b border-gray-100 w-32">Tiến độ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((s: any) => {
                        const studentResults = s.examResults || [];
                        const uniqueResults: any[] = Object.values(studentResults.reduce((acc: any, r: any) => {
                          if (!acc[r.examId] || r.score > acc[r.examId].score) acc[r.examId] = r;
                          return acc;
                        }, {}));
                        const avgScore = uniqueResults.length > 0 ? (uniqueResults.reduce((acc: number, r: any) => acc + r.score, 0) / uniqueResults.length) : 0;
                        const percentToTarget = s.targetScore > 0 ? Math.min(100, Math.round((avgScore / s.targetScore) * 100)) : 0;
                        const tier = getTier(s.totalXP || 0);

                        return (
                          <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                {s.avatar ? <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                              </div>
                              <div>
                                <div>{s.name}</div>
                                <div className="text-xs text-slate-400 font-normal">{s.email}</div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 text-xs font-bold ${tier.color} shadow-sm`}>
                                {tier.name}
                              </span>
                            </td>
                            <td className="p-4 text-center font-bold text-amber-500">{s.totalXP || 0} XP</td>
                            <td className="p-4 text-sm">{classrooms.find(c => c.students?.some((st: any) => st.id === s.id))?.name || '—'}</td>
                            <td className="p-4 text-center font-bold text-lg">{avgScore.toFixed(1)}</td>
                            <td className="p-4 font-bold text-primary text-center">{s.targetScore}+</td>
                            <td className="p-4">
                              <div className="flex items-center justify-between text-xs mb-1 font-bold text-slate-500">
                                <span>{percentToTarget}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-2">
                                <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${percentToTarget}%` }}></div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              );
            })()}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "DOCUMENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Kho Tài Liệu</h1>
            <div className="bg-white rounded-xl p-6 border border-gray-100 mb-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4">Tải tài liệu lên</h2>
              <form onSubmit={handleUploadDocument} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2">Chọn file (PDF, Word)</label>
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx" onChange={e => setDocFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" required />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2">Tiêu đề (Tùy chọn)</label>
                  <input type="text" value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Tên tài liệu..." className="w-full p-3 border border-gray-200 bg-white rounded-lg" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-bold mb-2">Phạm vi chia sẻ</label>
                  <select value={docVisibility} onChange={e => setDocVisibility(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold">
                    <option value="PUBLIC">Tất cả trung tâm</option>
                    <option value="CLASS">Chỉ lớp học</option>
                    <option value="PRIVATE">Chỉ mình tôi</option>
                  </select>
                </div>
                {docVisibility === 'CLASS' && (
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                    <select value={docClassroomId} onChange={e => setDocClassroomId(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold" required>
                      <option value="">-- Chọn lớp --</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" disabled={isUploadingDoc} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 min-w-[120px]">
                  {isUploadingDoc ? 'Đang tải...' : 'Upload'}
                </button>
              </form>
            </div>
            
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold">Danh sách tài liệu</h2>
               <input 
                 type="text" 
                 placeholder="Tìm kiếm tài liệu..." 
                 value={searchDocQuery}
                 onChange={e => setSearchDocQuery(e.target.value)}
                 className="w-full md:w-1/3 p-3 border border-gray-200 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" 
               />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).length === 0 && <div className="text-slate-400 italic col-span-full">Không tìm thấy tài liệu phù hợp</div>}
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).map((doc: any) => (
                <div key={doc.id} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden shadow-sm">
                  <div className="absolute top-0 right-0 p-3 flex gap-2 z-10">
                     <button onClick={() => handleUpdateDocumentVisibility(doc)} className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase hover:opacity-80 cursor-pointer transition-opacity ${doc.visibility === 'PUBLIC' ? 'bg-green-500/10 text-green-500' : doc.visibility === 'CLASS' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'}`} title="Nhấn để đổi trạng thái">
                        {doc.visibility === 'CLASS' ? (doc.classroom?.name || 'Lớp') : doc.visibility}
                     </button>
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
                    <h3 className="font-bold text-lg line-clamp-2 mb-1 group-hover:text-primary transition-colors" title={doc.title}>{doc.title}</h3>
                    <p className="text-xs text-slate-400 mb-4">{new Date(doc.createdAt).toLocaleDateString('vi-VN')} • {(doc.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <div className="flex gap-2 z-10">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download={doc.title} className="flex-1 py-2 text-center bg-primary/10 text-primary text-sm font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer block">Tải xuống</a>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer z-10 relative" title="Xóa">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTENING STUDIO ── */}
        {activeTab === "LISTENING_STUDIO" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Studio Luyện Nghe</h1>
            <div id="listening-clip-form" className="bg-white rounded-xl p-6 border border-gray-100 mb-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4">{editingClipId ? 'Sửa thông tin audio' : 'Tải audio lên'}</h2>
              <form onSubmit={handleUploadListeningClip} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-bold mb-2">Tiêu đề</label>
                    <input type="text" value={lcTitle} onChange={e => setLcTitle(e.target.value)} placeholder="VD: Hội thoại đặt phòng khách sạn" className="w-full p-3 border border-gray-200 bg-white rounded-lg" required />
                  </div>
                  {!editingClipId && (
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-sm font-bold mb-2">File audio (.mp3, .m4a, .wav)</label>
                      <input type="file" accept=".mp3,.m4a,.wav" onChange={e => setLcAudioFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" required />
                    </div>
                  )}
                </div>

                {!editingClipId && (
                  <div>
                    <label className="block text-sm font-bold mb-2">Script (chính xác 100% với nội dung audio)</label>
                    <textarea value={lcScript} onChange={e => setLcScript(e.target.value)} rows={4} placeholder="Dán nguyên văn script đã dùng để tạo audio..." className="w-full p-3 border border-gray-200 bg-white rounded-lg" required />
                  </div>
                )}

                {editingClipId && (
                  <p className="text-xs text-slate-400 italic">Không thể sửa file audio/script sau khi đã tải lên (vì đã gắn với timestamp căn chỉnh) — cần xóa và upload lại nếu muốn đổi nội dung.</p>
                )}

                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-bold mb-2">Giọng đọc</label>
                    <select value={lcAccent} onChange={e => setLcAccent(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold">
                      <option value="UK">{ACCENT_LABELS.UK}</option>
                      <option value="US">{ACCENT_LABELS.US}</option>
                      <option value="AUS">{ACCENT_LABELS.AUS}</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-bold mb-2">Phạm vi gán</label>
                    <select value={lcScope} onChange={e => setLcScope(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold">
                      <option value="CLASS">Một lớp học</option>
                      <option value="STUDENT">Một học viên cụ thể</option>
                    </select>
                  </div>
                  {lcScope === "CLASS" ? (
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                      <select value={lcClassroomId} onChange={e => setLcClassroomId(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold" required>
                        <option value="">-- Chọn lớp --</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-2">Chọn Học Viên</label>
                      <select value={lcStudentId} onChange={e => setLcStudentId(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold" required>
                        <option value="">-- Chọn học viên --</option>
                        {allStudents.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button type="submit" disabled={isUploadingClip} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 min-w-[120px]">
                    {isUploadingClip ? 'Đang lưu...' : editingClipId ? 'Lưu thay đổi' : 'Upload'}
                  </button>
                  {editingClipId && (
                    <button type="button" onClick={resetListeningClipForm} className="px-6 py-3 bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 min-w-[100px]">
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            </div>

            <h2 className="text-xl font-bold mb-4">Danh sách audio đã tải</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listeningClips.length === 0 && <div className="text-slate-400 italic col-span-full">Chưa có audio nào</div>}
              {listeningClips.map((clip: any) => (
                <div key={clip.id} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between group relative shadow-sm">
                  <div className="absolute top-3 right-3">
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${clip.status === 'READY' ? 'bg-green-500/10 text-green-600' : clip.status === 'FAILED' ? 'bg-red-500/10 text-red-600' : 'bg-amber-500/10 text-amber-600'}`}>
                      {clip.status === 'READY' ? 'Sẵn sàng' : clip.status === 'FAILED' ? 'Lỗi' : 'Đang xử lý'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg line-clamp-2 mb-1 pr-16" title={clip.title}>{clip.title}</h3>
                    <p className="text-xs text-slate-400 mb-1">{new Date(clip.createdAt).toLocaleDateString('vi-VN')} • {ACCENT_LABELS[clip.accent] || clip.accent}</p>
                    <p className="text-xs text-slate-500 font-semibold mb-4">
                      {clip.classroom ? `Lớp: ${clip.classroom.name}` : clip.student ? `Học viên: ${clip.student.name}` : ''}
                    </p>
                    {clip.status === 'FAILED' && clip.errorMessage && (
                      <p className="text-xs text-red-500 italic mb-4">{clip.errorMessage}</p>
                    )}
                  </div>
                  <div className="flex gap-2 z-10">
                    <audio src={clip.audioUrl} controls className="flex-1 h-9" />
                    <button onClick={() => startEditListeningClip(clip)} className="w-10 h-10 shrink-0 flex items-center justify-center bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer" title="Sửa">✏️</button>
                    <button onClick={() => handleDeleteListeningClip(clip.id)} className="w-10 h-10 shrink-0 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer" title="Xóa">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SPEAKING TOPICS (Luyện Nói Cùng AI) ── */}
        {activeTab === "SPEAKING_TOPICS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Chủ Đề Hội Thoại</h1>
            <p className="text-sm text-slate-500 -mt-4 mb-2">
              Tạo tình huống để học viên luyện nói tự do với AI. AI sẽ đóng vai theo mô tả bạn viết bên dưới và trò chuyện qua lại nhiều lượt — đây là luyện tập hội thoại, không phải bài thi.
            </p>

            <div id="speaking-topic-form" className="bg-white rounded-xl p-6 border border-gray-100 mb-8 shadow-sm">
              <h2 className="text-xl font-bold mb-4">{editingTopicId ? 'Sửa chủ đề' : 'Tạo chủ đề mới'}</h2>
              <form onSubmit={handleSaveSpeakingTopic} className="flex flex-col gap-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-bold mb-2">Tiêu đề</label>
                    <input type="text" value={stTitle} onChange={e => setStTitle(e.target.value)} placeholder="VD: Đặt phòng khách sạn" className="w-full p-3 border border-gray-200 bg-white rounded-lg" required />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <label className="block text-sm font-bold mb-2">Mô tả ngắn (hiện cho học viên)</label>
                    <input type="text" value={stDescription} onChange={e => setStDescription(e.target.value)} placeholder="VD: Bạn gọi điện đặt phòng cho kỳ nghỉ" className="w-full p-3 border border-gray-200 bg-white rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Vai trò/persona của AI</label>
                  <textarea
                    value={stPersona}
                    onChange={e => setStPersona(e.target.value)}
                    rows={4}
                    placeholder="VD: Bạn là nhân viên lễ tân khách sạn, nói chuyện thân thiện, lịch sự bằng tiếng Anh. Nếu học viên nói sai ngữ pháp, hãy nhẹ nhàng diễn đạt lại đúng trong câu trả lời của bạn thay vì sửa lỗi trực tiếp."
                    className="w-full p-3 border border-gray-200 bg-white rounded-lg"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">Đây là hướng dẫn cho AI, không hiện cho học viên — mô tả càng cụ thể, AI phản hồi càng đúng vai.</p>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2">Câu mở đầu (tùy chọn)</label>
                  <input type="text" value={stOpeningLine} onChange={e => setStOpeningLine(e.target.value)} placeholder="Để trống để AI tự nghĩ câu mở đầu phù hợp" className="w-full p-3 border border-gray-200 bg-white rounded-lg" />
                </div>

                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-bold mb-2">Phạm vi gán</label>
                    <select value={stScope} onChange={e => setStScope(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold">
                      <option value="CLASS">Một lớp học</option>
                      <option value="STUDENT">Một học viên cụ thể</option>
                    </select>
                  </div>
                  {stScope === "CLASS" ? (
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                      <select value={stClassroomId} onChange={e => setStClassroomId(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold" required>
                        <option value="">-- Chọn lớp --</option>
                        {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-sm font-bold mb-2">Chọn Học Viên</label>
                      <select value={stStudentId} onChange={e => setStStudentId(e.target.value)} className="w-full p-3 border border-gray-200 bg-white rounded-lg font-bold" required>
                        <option value="">-- Chọn học viên --</option>
                        {allStudents.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  )}
                  <button type="submit" disabled={isSavingTopic} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 min-w-[120px]">
                    {isSavingTopic ? 'Đang lưu...' : editingTopicId ? 'Lưu thay đổi' : 'Tạo chủ đề'}
                  </button>
                  {editingTopicId && (
                    <button type="button" onClick={resetSpeakingTopicForm} className="px-6 py-3 bg-gray-100 text-gray-600 font-bold hover:bg-gray-200 min-w-[100px]">
                      Hủy
                    </button>
                  )}
                </div>
              </form>
            </div>

            <h2 className="text-xl font-bold mb-4">Danh sách chủ đề đã tạo</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {speakingTopics.length === 0 && <div className="text-slate-400 italic col-span-full">Chưa có chủ đề nào</div>}
              {speakingTopics.map((topic: any) => (
                <div key={topic.id} className="bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all flex flex-col justify-between group relative shadow-sm">
                  <div>
                    <h3 className="font-bold text-lg line-clamp-2 mb-1" title={topic.title}>{topic.title}</h3>
                    {topic.description && <p className="text-sm text-slate-500 mb-2 line-clamp-2">{topic.description}</p>}
                    <p className="text-xs text-slate-500 font-semibold mb-4">
                      {topic.classroom ? `Lớp: ${topic.classroom.name}` : topic.student ? `Học viên: ${topic.student.name}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 z-10">
                    <button onClick={() => startEditSpeakingTopic(topic)} className="flex-1 h-10 shrink-0 flex items-center justify-center gap-1 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors cursor-pointer text-sm font-bold" title="Sửa">✏️ Sửa</button>
                    <button onClick={() => handleDeleteSpeakingTopic(topic.id)} className="w-10 h-10 shrink-0 flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors cursor-pointer" title="Xóa">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ATTENDANCE & TUITION ── */}
        {activeTab === "ATTENDANCE" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Điểm Danh & Học Phí</h1>
            
            <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6 flex flex-wrap gap-4 items-end shadow-sm">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                <select 
                  className="w-full p-3 border border-gray-200 bg-white rounded-lg"
                  value={attClassroomId} onChange={e => setAttClassroomId(e.target.value)}
                >
                  <option value="">-- Chọn lớp --</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex bg-slate-50 p-1">
                <button 
                  onClick={() => setAttView('MARK')} 
                  className={`px-4 py-2 font-bold text-sm transition-colors ${attView === 'MARK' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Điểm Danh
                </button>
                <button 
                  onClick={() => setAttView('REPORT')} 
                  className={`px-4 py-2 font-bold text-sm transition-colors ${attView === 'REPORT' ? 'bg-white shadow text-primary' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Báo Cáo Học Phí
                </button>
              </div>
            </div>

            {attClassroomId ? (
              <>
                {attView === 'MARK' && (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">Điểm danh ngày</h2>
                        <input 
                          type="date" 
                          value={attDate} 
                          onChange={e => setAttDate(e.target.value)} 
                          className="p-2 border border-gray-200 bg-white rounded-lg font-medium"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const next = attRecords.map(r => ({ ...r, status: r.status || 'PRESENT' }));
                          setAttRecords(next);
                          handleSaveAttendance(next);
                        }}
                        className="px-4 py-2 bg-green-500/10 text-green-600 font-bold text-sm hover:bg-green-500/20 transition-colors shrink-0"
                      >
                        ✓ Đánh dấu tất cả có mặt (những người chưa ĐD)
                      </button>
                    </div>
                    {attRecords.length > 0 ? (
                      <>
                        <div className="border border-gray-100 rounded-xl overflow-hidden mb-6">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="p-3 font-bold border-b border-gray-200">Học Viên</th>
                                <th className="p-3 font-bold border-b border-gray-200 text-center">Trạng Thái</th>
                                <th className="p-3 font-bold border-b border-gray-200">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attRecords.map((rec, i) => (
                                <tr key={rec.userId} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors">
                                  <td className="p-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                                        {rec.user?.avatar ? <img src={rec.user.avatar} className="w-full h-full object-cover" /> : rec.user?.name?.charAt(0)}
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="font-semibold whitespace-nowrap">{rec.user?.name}</span>
                                        {!rec.status ? (
                                          <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">Chưa điểm danh</span>
                                        ) : (
                                          <span className="text-[10px] text-green-500 font-bold uppercase tracking-wider">✓ Đã lưu</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center justify-center gap-1 sm:gap-2 flex-wrap">
                                      <button 
                                        onClick={() => {
                                          const next = [...attRecords];
                                          next[i].status = 'PRESENT';
                                          setAttRecords(next);
                                          handleSaveAttendance(next, false);
                                        }}
                                        className={`px-3 py-1.5 font-bold text-xs transition-colors ${rec.status === 'PRESENT' ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                      >
                                        Có mặt
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const next = [...attRecords];
                                          next[i].status = 'EXCUSED_ABSENCE';
                                          setAttRecords(next);
                                          handleSaveAttendance(next, false);
                                        }}
                                        className={`px-3 py-1.5 font-bold text-xs transition-colors ${rec.status === 'EXCUSED_ABSENCE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                      >
                                        Vắng (Có phép)
                                      </button>
                                      <button 
                                        onClick={() => {
                                          const next = [...attRecords];
                                          next[i].status = 'UNEXCUSED_ABSENCE';
                                          setAttRecords(next);
                                          handleSaveAttendance(next, false);
                                        }}
                                        className={`px-3 py-1.5 font-bold text-xs transition-colors ${rec.status === 'UNEXCUSED_ABSENCE' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                      >
                                        Vắng (Không phép)
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3 w-1/3 sm:w-1/4">
                                    <input 
                                      type="text" 
                                      placeholder="Ghi chú..." 
                                      value={rec.notes} 
                                      onChange={e => {
                                        const next = [...attRecords];
                                        next[i].notes = e.target.value;
                                        setAttRecords(next);
                                      }}
                                      onBlur={() => handleSaveAttendance(attRecords, false)}
                                      className="w-full px-3 py-1.5 bg-transparent border border-gray-100 focus:border-primary outline-none text-sm transition-colors"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-slate-400 py-8">Lớp chưa có học viên nào.</p>
                    )}
                  </div>
                )}

                {attView === 'REPORT' && (
                  <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">Báo Cáo Học Phí</h2>
                        <input 
                          type="month" 
                          value={attMonth} 
                          onChange={e => setAttMonth(e.target.value)} 
                          className="p-2 border border-gray-200 bg-white rounded-lg"
                        />
                      </div>
                      {attReport?.report?.length > 0 && (
                        <button 
                          onClick={exportAllPDFs}
                          disabled={isExporting}
                          className="px-4 py-2 bg-indigo-500/10 text-indigo-600 font-bold text-sm hover:bg-indigo-500/20 transition-colors shrink-0 flex items-center gap-2"
                        >
                          {isExporting ? 'Đang xuất...' : '📦 Xuất PDF tất cả (ZIP)'}
                        </button>
                      )}
                    </div>
                    {attReport ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="p-4 font-bold border-b border-gray-200">Học Viên</th>
                              <th className="p-4 font-bold border-b border-gray-200">Số Buổi Học</th>
                              <th className="p-4 font-bold border-b border-gray-200 text-right">Tổng Học Phí</th>
                              <th className="p-4 font-bold border-b border-gray-200 text-center">Trạng Thái</th>
                              <th className="p-4 font-bold border-b border-gray-200 text-center">Hành Động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attReport.report?.map((sr: any) => (
                              <tr key={sr.user.id} className="border-b border-gray-100 last:border-0 hover:bg-slate-50">
                                <td className="p-4 font-medium">{sr.user.name}</td>
                                <td className="p-4">{sr.presentCount} buổi</td>
                                <td className="p-4 font-black text-primary text-right">{sr.totalAmount.toLocaleString()} VNĐ</td>
                                <td className="p-4 text-center">
                                  {sr.isPaid ? (
                                    <span className="text-xs bg-green-500/10 text-green-600 font-bold px-3 py-1 rounded-full">Đã nộp ({new Date(sr.paidAt).toLocaleDateString('vi-VN')})</span>
                                  ) : (
                                    <span className="text-xs bg-rose-500/10 text-rose-600 font-bold px-3 py-1 rounded-full">Chưa nộp</span>
                                  )}
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => exportSinglePDF(sr.user.id, sr.user.name)}
                                      disabled={isExporting}
                                      className="text-xs bg-slate-100 text-slate-600 font-bold px-3 py-1.5 hover:bg-slate-200 transition-colors flex items-center gap-1"
                                    >
                                      📄 Xuất PDF
                                    </button>
                                    {!sr.isPaid && sr.totalAmount > 0 && (
                                      <button 
                                        onClick={() => handlePayTuition(sr.user.id, sr.totalAmount)}
                                        className="text-xs bg-primary text-white font-bold px-3 py-1.5 hover:bg-primary/90"
                                      >
                                        Xác nhận đã nộp
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-center text-slate-400 py-8">Đang tải báo cáo...</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-slate-400 py-12 bg-slate-50 border-2 border-dashed border-gray-200">
                Vui lòng chọn lớp học để xem điểm danh
              </div>
            )}
          </div>
        )}

        {/* ── CALENDAR ── */}
        {activeTab === "CALENDAR" && (
          <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Quản Lý Lịch Dạy</h1>
            <div className="flex-1 min-h-[500px]">
              <CalendarComponent user={user} role="TEACHER" classrooms={classrooms} />
            </div>
          </div>
        )}

        {/* ── CHEAT_CONTROL ── */}
        {activeTab === "CHEAT_CONTROL" && (() => {
          const allClasses = Array.from(new Set(cheatIncidents.map(i => i.className))).sort();
          const filtered = cheatIncidents.filter(i => {
            const matchSearch = !cheatSearch || i.studentName.toLowerCase().includes(cheatSearch.toLowerCase()) || i.studentEmail.toLowerCase().includes(cheatSearch.toLowerCase());
            const matchClass = cheatClassFilter === "ALL" || i.className === cheatClassFilter;
            return matchSearch && matchClass;
          });
          const totalViolations = cheatIncidents.reduce((s, i) => s + i.cheatCount, 0);
          const autoSubmittedCount = cheatIncidents.filter(i => i.autoSubmitted).length;
          const uniqueStudents = new Set(cheatIncidents.map(i => i.studentEmail || i.studentName)).size;
          return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-rose-600 flex items-center gap-2">
                  ⚠️ Kiểm Soát Gian Lận
                </h1>
                <button
                  onClick={() => user && fetchCheatLogs(user.id)}
                  className="flex items-center gap-2 text-sm px-4 py-2 border border-gray-200 bg-white rounded-lg hover:bg-slate-50 transition-colors font-medium"
                >
                  <span className={cheatLoading ? "animate-spin" : ""}>↻</span>
                  {cheatLoading ? "Đang tải..." : "Cập nhật"}
                </button>
              </div>

              {/* Stat cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="text-2xl font-black text-rose-600">{totalViolations}</div>
                  <div className="text-sm text-slate-500 mt-1 font-medium">Tổng số lần vi phạm</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="text-2xl font-black text-orange-500">{autoSubmittedCount}</div>
                  <div className="text-sm text-slate-500 mt-1 font-medium">Bài bị thu tự động</div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
                  <div className="text-2xl font-black text-amber-500">{uniqueStudents}</div>
                  <div className="text-sm text-slate-500 mt-1 font-medium">Học viên vi phạm</div>
                </div>
              </div>

              {/* Filter bar */}
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Tìm theo tên hoặc email học viên..."
                  value={cheatSearch}
                  onChange={e => setCheatSearch(e.target.value)}
                  className="flex-1 border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary/50"
                />
                <select
                  value={cheatClassFilter}
                  onChange={e => setCheatClassFilter(e.target.value)}
                  className="border border-gray-200 bg-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="ALL">Tất cả lớp</option>
                  {allClasses.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                </select>
                {(cheatSearch || cheatClassFilter !== "ALL") && (
                  <button onClick={() => { setCheatSearch(""); setCheatClassFilter("ALL"); }} className="text-xs text-slate-400 hover:text-slate-700 px-3 py-2 border border-gray-200 bg-white rounded-lg">
                    Xóa bộ lọc
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                {cheatLoading && cheatIncidents.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-2xl animate-spin mb-4">↻</div>
                    <p className="text-sm">Đang tải dữ liệu...</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <div className="text-5xl mb-4 opacity-40">✨</div>
                    <p className="font-semibold">{cheatIncidents.length === 0 ? "Tuyệt vời! Chưa phát hiện hành vi gian lận nào." : "Không tìm thấy kết quả phù hợp."}</p>
                    {cheatIncidents.length > 0 && <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc từ khoá tìm kiếm</p>}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200 text-left text-xs text-slate-400 uppercase tracking-wider bg-slate-50">
                          <th className="px-5 py-3 font-bold">Thời gian</th>
                          <th className="px-5 py-3 font-bold">Học viên</th>
                          <th className="px-5 py-3 font-bold">Lớp học</th>
                          <th className="px-5 py-3 font-bold">Bài kiểm tra</th>
                          <th className="px-5 py-3 font-bold text-center">Vi phạm</th>
                          <th className="px-5 py-3 font-bold text-right">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/5">
                        {filtered.map((incident: any) => {
                          const severity = incident.cheatCount >= 3 ? "high" : incident.cheatCount === 2 ? "mid" : "low";
                          return (
                            <tr key={incident.id} className={`hover:bg-slate-50 transition-colors ${severity === "high" ? "bg-rose-50/50" : ""}`}>
                              <td className="px-5 py-4 text-sm text-slate-500 whitespace-nowrap">
                                {new Date(incident.createdAt).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden text-primary border border-primary/10">
                                    {incident.studentAvatar
                                      ? <img src={incident.studentAvatar} className="w-full h-full object-cover" alt="avatar" />
                                      : incident.studentName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="leading-tight">
                                    <div className="font-semibold text-sm">{incident.studentName}</div>
                                    {incident.studentEmail && <div className="text-xs text-slate-400">{incident.studentEmail}</div>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                <span className="text-xs font-medium bg-primary/8 text-primary px-2 py-1 border border-primary/15">{incident.className}</span>
                              </td>
                              <td className="px-5 py-4 text-sm font-medium max-w-[200px] truncate">{incident.examTitle}</td>
                              <td className="px-5 py-4 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 font-black text-sm text-white ${
                                  severity === "high" ? "bg-rose-500" : severity === "mid" ? "bg-orange-500" : "bg-amber-400"
                                }`}>
                                  {incident.cheatCount}×
                                </span>
                              </td>
                              <td className="px-5 py-4 text-right">
                                {incident.autoSubmitted ? (
                                  <span className="text-xs bg-rose-500/10 text-rose-600 font-bold px-3 py-1.5 border border-rose-500/25">
                                    Thu bài tự động
                                  </span>
                                ) : (
                                  <span className="text-xs bg-amber-50 text-amber-700 font-bold px-3 py-1.5 border border-amber-300/50">
                                    Đang cảnh báo
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="px-5 py-3 border-t border-gray-100 text-xs text-slate-400 flex justify-between items-center bg-slate-50">
                      <span>Hiển thị {filtered.length}/{cheatIncidents.length} vi phạm</span>
                      <span>Tự động cập nhật mỗi 30 giây</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── LESSONS ── */}
        {activeTab === "LESSONS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
              <h1 className="text-3xl font-bold">Ngân Hàng Bài Học</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <select className="p-2.5 border border-gray-200 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-auto" value={lessonClassFilter} onChange={e => setLessonClassFilter(e.target.value)}>
                  <option value="">Tất cả các lớp</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={() => {
                  setCreateLessonTitle(""); setCreateLessonDesc(""); setCreateLessonClassroomId("");
                  setLessonVocabs([]); setLessonGrammars([]); setEditingLessonId(null);
                  setActiveTab('CREATE_LESSON');
                }} className="px-4 py-2 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer w-full sm:w-auto">✏️ Tạo Bài Học Mới</button>
              </div>
            </div>
            {(() => {
              const filteredLessons = lessonClassFilter ? localLessons.filter((l: any) => l.classroomId === lessonClassFilter) : localLessons;
              return filteredLessons.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center text-center shadow-sm">
                  <span className="text-5xl mb-4">📚</span>
                  <h2 className="text-2xl font-bold mb-2">{lessonClassFilter ? 'Lớp này chưa có bài học nào' : 'Chưa có bài học nào'}</h2>
                  <p className="text-slate-400 mb-6">Bắt đầu bằng cách tạo bài học mới</p>
                  <button onClick={() => setActiveTab('CREATE_LESSON')} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">✏️ Tạo Bài Học Ngay</button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLessons.map((lesson: any) => (
                    <div key={lesson.id} className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 hover:shadow-md transition-all shadow-sm">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-600 flex items-center justify-center text-2xl shrink-0">📚</div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-lg break-words">{lesson.title}</h3>
                          <p className="text-sm text-slate-400">{lesson.classroom?.name ? `${lesson.classroom.name} • ` : ''}{lesson.vocabularies?.length || 0} từ vựng • {lesson.grammars?.length || 0} ngữ pháp</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button onClick={() => handleEditLessonSetup(lesson)} className="text-amber-500 hover:text-amber-600 font-bold text-sm px-3 py-1.5 hover:bg-amber-500/10 transition-colors cursor-pointer">✏️ Sửa</button>
                        <button onClick={() => handleDuplicateLesson(lesson)} className="text-blue-500 hover:text-blue-600 font-bold text-sm px-3 py-1.5 hover:bg-blue-500/10 transition-colors cursor-pointer">📋 Nhân bản</button>
                        <button onClick={async () => {
                          if (confirm('Bạn có chắc muốn xóa bài học này?')) {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${lesson.id}`, { method: 'DELETE' });
                            if (res.ok) setLocalLessons(localLessons.filter(l => l.id !== lesson.id));
                          }
                        }} className="text-rose-500 hover:text-rose-600 font-bold text-sm px-3 py-1.5 hover:bg-rose-500/10 transition-colors cursor-pointer">🗑 Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── CREATE LESSON ── */}
        {activeTab === "CREATE_LESSON" && (
          <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold mb-1">{editingLessonId ? "Sửa Bài Học" : "Tạo Bài Học Mới"}</h1>
              <p className="text-slate-400">Thêm từ vựng qua file Excel, upload ảnh và tạo ngữ pháp</p>
            </div>
            <form onSubmit={handleCreateLesson} className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-lg border-b border-gray-200 pb-3 mb-4">📋 Thông Tin Bài Học</h2>
                <div>
                  <label className="block text-sm font-bold mb-1">Tiêu đề *</label>
                  <input type="text" className="w-full p-3 border border-gray-200 bg-transparent focus:border-primary outline-none"
                    placeholder="VD: Unit 1 - Family" value={createLessonTitle} onChange={e => setCreateLessonTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Lớp học *</label>
                  <select className="w-full p-3 border border-gray-200 bg-transparent" value={createLessonClassroomId}
                    onChange={e => setCreateLessonClassroomId(e.target.value)} required>
                    <option value="">-- Chọn lớp --</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Mô tả (Không bắt buộc)</label>
                  <textarea className="w-full p-3 border border-gray-200 bg-transparent focus:border-primary outline-none"
                    placeholder="Mô tả bài học..." value={createLessonDesc} onChange={e => setCreateLessonDesc(e.target.value)} />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                  <h2 className="font-bold text-lg">📝 Từ Vựng ({lessonVocabs.length} từ)</h2>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleDownloadVocabTemplate} className="px-3 py-1.5 bg-green-500/10 text-green-600 font-bold text-sm cursor-pointer hover:bg-green-500/20">⬇️ Tải Excel Mẫu</button>
                    <label className="px-3 py-1.5 bg-blue-500/10 text-blue-600 font-bold text-sm cursor-pointer hover:bg-blue-500/20">
                      ⬆️ Upload Excel
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadVocabExcel} />
                    </label>
                  </div>
                </div>
                {lessonVocabs.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-gray-100">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="p-2 font-bold">Từ</th>
                          <th className="p-2 font-bold">Loại</th>
                          <th className="p-2 font-bold">Phiên âm</th>
                          <th className="p-2 font-bold">Nghĩa</th>
                          <th className="p-2 font-bold text-center">Ảnh</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lessonVocabs.map((v, i) => (
                          <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-slate-50 transition-colors">
                            <td className="p-2">{v.word}</td>
                            <td className="p-2 text-slate-400">{v.pos}</td>
                            <td className="p-2 text-primary">{v.phonetic}</td>
                            <td className="p-2">{v.meaning}</td>
                            <td className="p-2 text-center">
                              {v.imageUrl ? (
                                <div className="flex flex-col items-center gap-1">
                                  <img src={v.imageUrl} alt={v.word} className="w-12 h-12 object-cover rounded shadow-sm border border-gray-100" />
                                  <label className="cursor-pointer text-[10px] text-blue-500 hover:underline">
                                    Đổi ảnh
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadVocabImage(i, e)} />
                                  </label>
                                </div>
                              ) : (
                                <label className="cursor-pointer text-xs bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-slate-600 transition-colors">
                                  + Thêm ảnh
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadVocabImage(i, e)} />
                                </label>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                  <h2 className="font-bold text-lg">📖 Ngữ Pháp ({lessonGrammars.length} mục)</h2>
                  <button type="button" onClick={() => setLessonGrammars([...lessonGrammars, { title: '', structure: '', explanation: '' }])} className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-sm cursor-pointer hover:bg-primary/20">+ Thêm Ngữ Pháp</button>
                </div>
                {lessonGrammars.map((g, i) => (
                  <div key={i} className="p-4 border border-gray-100 space-y-3 relative">
                    <button type="button" onClick={() => setLessonGrammars(lessonGrammars.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-rose-500 font-bold cursor-pointer hover:underline text-xs">Xóa</button>
                    <input type="text" placeholder="Tên điểm ngữ pháp (VD: Thì hiện tại đơn)" className="w-full p-2 border-b border-gray-200 bg-transparent font-bold outline-none" value={g.title} onChange={e => { const n = [...lessonGrammars]; n[i].title = e.target.value; setLessonGrammars(n); }} />
                    <input type="text" placeholder="Công thức (S + V + O)" className="w-full p-2 border-b border-gray-200 bg-transparent outline-none text-primary font-mono text-sm" value={g.structure} onChange={e => { const n = [...lessonGrammars]; n[i].structure = e.target.value; setLessonGrammars(n); }} />
                    <ReactQuill theme="snow" placeholder="Giải thích chi tiết..." className="bg-white text-black" value={g.explanation} onChange={(content) => { const n = [...lessonGrammars]; n[i].explanation = content; setLessonGrammars(n); }} />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button type="submit" className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer shadow-lg shadow-primary/30">
                  Lưu Bài Học
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── EXAMS ── */}
        {activeTab === "EXAMS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
              <h1 className="text-3xl font-bold">Ngân Hàng Bài Tập & Đề Thi</h1>
              <button onClick={() => setActiveTab('CREATE')} className="px-4 py-2 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer w-full sm:w-auto">✏️ Tạo Đề Mới</button>
            </div>
            {(() => {
              const dbExams = classrooms.flatMap(c => c.exams || []).filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);
              const allExamsRaw = [...dbExams, ...localExams];
              const allExams = allExamsRaw.filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);
              const assignments = allExams.filter(e => e.examType === 'ASSIGNMENT' || e.examType === 'REGULAR');
              const tests = allExams.filter(e => e.examType === 'EXAM' || e.examType === 'PLACEMENT');
              if (allExams.length === 0) return (
                <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center text-center shadow-sm">
                  <span className="text-5xl mb-4">📄</span>
                  <h2 className="text-2xl font-bold mb-2">Chưa có đề thi nào</h2>
                  <p className="text-slate-400 mb-6">Bắt đầu bằng cách tạo đề thủ công</p>
                  <button onClick={() => setActiveTab('CREATE')} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">✏️ Tạo Đề Ngay</button>
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
                            onDelete={() => handleDeleteExam(exam.id)}
                            onDuplicate={() => handleDuplicateExam(exam)} />
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
                            onDelete={() => handleDeleteExam(exam.id)}
                            onDuplicate={() => handleDuplicateExam(exam)} />
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
              <p className="text-slate-400">Nhập từng câu hỏi — trắc nghiệm hoặc tự luận</p>
            </div>
            <form onSubmit={handleCreateExam} className="space-y-6">

              {/* ── SECTION 1: Thông tin đề ── */}
              <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-4 shadow-sm">
                <h2 className="font-bold text-lg border-b border-gray-200 pb-3 mb-4">📋 Thông Tin Đề Thi</h2>
                <div>
                  <label className="block text-sm font-bold mb-1">Tiêu đề *</label>
                  <input type="text" className="w-full p-3 border border-gray-200 bg-transparent focus:border-primary outline-none transition-colors"
                    placeholder="VD: Kiểm tra 15 phút – Unit 5" value={createTitle} onChange={e => setCreateTitle(e.target.value)} required />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Loại đề</label>
                    <select className="w-full p-3 border border-gray-200 bg-transparent" value={createType} onChange={e => setCreateType(e.target.value)}>
                      <option value="ASSIGNMENT">📝 Bài Tập (Luyện tập)</option>
                      <option value="EXAM">🏆 Đề Thi (Chấm điểm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Thời gian (phút)</label>
                    <input type="number" className="w-full p-3 border border-gray-200 bg-transparent" value={createDuration} onChange={e => setCreateDuration(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Số lần làm tối đa</label>
                    <input type="number" min="1" className="w-full p-3 border border-gray-200 bg-transparent" value={createMaxAttempts} onChange={e => setCreateMaxAttempts(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Hình thức giao</label>
                    <select className="w-full p-3 border border-gray-200 bg-transparent" value={createAssignMode} onChange={e => setCreateAssignMode(e.target.value)}>
                      <option value="CLASS">🏫 Giao cả Lớp</option>
                      <option value="STUDENT">👤 Giao cá nhân</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Lớp học *</label>
                    <select className="w-full p-3 border border-gray-200 bg-transparent" value={createClassroomId}
                      onChange={e => { setCreateClassroomId(e.target.value); setCreateStudentIds([]); }}>
                      <option value="">-- Chọn lớp --</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Student picker */}
                {createAssignMode === 'STUDENT' && createClassroomId && (
                  <div className="p-4 border border-gray-100">
                    <label className="block text-sm font-bold mb-2">Chọn học viên</label>
                    <div className="space-y-1 max-h-36 overflow-y-auto">
                      {classrooms.find(c => c.id === createClassroomId)?.students?.map((s: any) => (
                        <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold mb-1">Ghi chú</label>
                    <input type="text" className="w-full p-3 border border-gray-200 bg-transparent" placeholder="VD: Không dùng tài liệu" value={createNotes} onChange={e => setCreateNotes(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-1">Deadline</label>
                    <input type="datetime-local" className="w-full p-3 border border-gray-200 bg-transparent" value={createDeadline} onChange={e => setCreateDeadline(e.target.value)} />
                  </div>
                </div>

                {/* Publish mode */}
                <div>
                  <label className="block text-sm font-bold mb-2">Thời gian đăng bài</label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setCreatePublishMode('NOW')}
                      className={`flex-1 py-2.5 font-bold border-2 text-sm transition-all cursor-pointer ${createPublishMode === 'NOW' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:border-gray-400'}`}>
                      ⚡ Đăng Ngay
                    </button>
                    <button type="button" onClick={() => setCreatePublishMode('SCHEDULED')}
                      className={`flex-1 py-2.5 font-bold border-2 text-sm transition-all cursor-pointer ${createPublishMode === 'SCHEDULED' ? 'border-amber-500 bg-amber-500/10 text-amber-600' : 'border-gray-200 hover:border-gray-400'}`}>
                      📅 Hẹn Giờ
                    </button>
                  </div>
                  {createPublishMode === 'SCHEDULED' && (
                    <input type="datetime-local" className="w-full mt-2 p-3 border border-amber-400/40 bg-amber-500/5" value={createPublishTime} onChange={e => setCreatePublishTime(e.target.value)} />
                  )}
                </div>
              </div>

              {/* ── SECTION 2: Câu hỏi ── */}
              <div className="space-y-4" key={questionsListGeneration}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-bold text-lg">❓ Câu Hỏi <span className="text-slate-400 font-normal text-base">({createQuestions.length} câu)</span></h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Đã soạn xong {createQuestions.filter(q => q.content.trim() && (q.type === 'ESSAY' || q.options.filter(o => o.trim()).length >= 2)).length}/{createQuestions.length} câu
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={handleDownloadExamQuestionTemplate}
                      className="px-3 py-1.5 bg-green-500/10 text-green-600 font-bold text-sm cursor-pointer hover:bg-green-500/20 transition-colors">
                      ⬇️ Tải Excel Mẫu
                    </button>
                    <label className="px-3 py-1.5 bg-blue-500/10 text-blue-600 font-bold text-sm cursor-pointer hover:bg-blue-500/20 transition-colors">
                      ⬆️ Nhập Từ Excel
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadExamQuestionsExcel} />
                    </label>
                    {createQuestions.length > 1 && (
                      <button type="button" onClick={toggleAllQuestionsExpanded}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold text-sm cursor-pointer hover:bg-slate-200 transition-colors">
                        {allQuestionsExpanded ? '▲ Thu Gọn Tất Cả' : '▼ Mở Rộng Tất Cả'}
                      </button>
                    )}
                    <button type="button" onClick={addQuestion}
                      className="px-4 py-2 bg-primary/10 text-primary font-bold hover:bg-primary/20 cursor-pointer text-sm transition-colors">
                      + Thêm câu hỏi
                    </button>
                  </div>
                </div>

                {createQuestions.map((q, qi) => {
                  const expanded = isQuestionExpanded(q._key);
                  return (
                  <div key={q._key} className="bg-white rounded-xl border border-gray-100 shadow-sm">
                    {/* Question header */}
                    <div className="flex items-center justify-between gap-3 p-4 sm:p-6 cursor-pointer" onClick={() => toggleQuestionExpanded(q._key)}>
                      <div className="flex items-center gap-3 flex-wrap min-w-0">
                        <span className="w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center font-bold text-sm shrink-0">{qi + 1}</span>
                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                          <button type="button"
                            onClick={() => updateQuestion(qi, { type: 'MULTIPLE_CHOICE', correctOption: 'A' })}
                            className={`px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${q.type === 'MULTIPLE_CHOICE' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 hover:border-gray-400'}`}>
                            🔘 Trắc Nghiệm
                          </button>
                          <button type="button"
                            onClick={() => updateQuestion(qi, { type: 'ESSAY', correctOption: '' })}
                            className={`px-3 py-1.5 text-xs font-bold border-2 transition-all cursor-pointer ${q.type === 'ESSAY' ? 'border-secondary bg-secondary/10 text-secondary' : 'border-gray-200 hover:border-gray-400'}`}>
                            ✍️ Tự Luận
                          </button>
                        </div>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5" onClick={e => e.stopPropagation()}>
                          <label className="text-xs font-bold text-slate-400">Điểm:</label>
                          <input type="number" min="0" step="0.01" className="w-20 bg-transparent text-sm font-bold outline-none text-primary"
                            value={q.points ?? 1} onChange={e => updateQuestion(qi, { points: parseFloat(e.target.value) || 0 })} />
                        </div>
                        {!expanded && (
                          <span className="text-sm text-slate-400 truncate max-w-[160px] sm:max-w-xs">
                            {stripHtml(q.content) || 'Chưa có nội dung'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        {createQuestions.length > 1 && (
                          <button type="button" onClick={() => removeQuestion(qi)}
                            className="text-rose-500 hover:text-rose-600 font-bold text-sm cursor-pointer px-2 py-1 hover:bg-rose-500/10 transition-colors">
                            Xóa
                          </button>
                        )}
                        <button type="button" onClick={() => toggleQuestionExpanded(q._key)}
                          aria-label={expanded ? 'Thu gọn câu hỏi' : 'Mở rộng câu hỏi'}
                          className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                          {expanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>

                    {everExpandedQuestions[q._key] && (
                    <div className={`px-4 sm:px-6 pb-4 sm:pb-6 space-y-4 border-t border-gray-100 pt-4 ${expanded ? '' : 'hidden'}`}>
                    {/* Question content */}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                          Heading / Câu hỏi tổng (Không bắt buộc)
                        </label>
                        <div className="bg-white overflow-hidden border border-gray-200">
                          <ReactQuill 
                            theme="snow" 
                            modules={miniQuillModules}
                            className="text-black [&_.ql-editor]:min-h-[40px] [&_.ql-editor]:py-2 [&_.ql-toolbar]:py-1 [&_.ql-toolbar]:px-2"
                            placeholder="VD: Read the following passage and answer the questions..."
                            value={q.heading || ''} 
                            onChange={content => updateQuestion(qi, { heading: content })} 
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">Nội dung câu hỏi *</label>
                        <ReactQuill theme="snow" className="bg-white text-black"
                          placeholder={q.type === 'ESSAY' ? 'Nhập câu hỏi tự luận...' : 'Nhập câu hỏi trắc nghiệm...'}
                          value={q.content} onChange={content => updateQuestion(qi, { content })} />
                      </div>
                      
                      {/* Image upload for question */}
                      <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">Hình ảnh (không bắt buộc)</label>
                        {q.imageUrl ? (
                          <div className="relative inline-block mt-2">
                            <img src={q.imageUrl} alt="Question image" className="max-h-40 border border-gray-100" />
                            <button type="button" onClick={() => updateQuestion(qi, { imageUrl: '' })} className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs cursor-pointer shadow-md">✕</button>
                          </div>
                        ) : (
                          <input type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              if (file.size > 5 * 1024 * 1024) return Swal.fire('Lỗi', 'Kích thước ảnh tối đa là 5MB', 'error');
                              const reader = new FileReader();
                              reader.onload = (ev) => updateQuestion(qi, { imageUrl: ev.target?.result as string });
                              reader.readAsDataURL(file);
                            }
                          }} className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                        )}
                      </div>
                    </div>

                    {/* MULTIPLE CHOICE options */}
                    {q.type === 'MULTIPLE_CHOICE' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-wide">Các đáp án (chọn đáp án đúng)</label>
                        {['A', 'B', 'C', 'D'].map((letter, oi) => (
                          <div key={letter} className={`flex items-center gap-3 p-3 border-2 transition-all ${q.correctOption === letter ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                            <button type="button"
                              onClick={() => updateQuestion(qi, { correctOption: letter })}
                              className={`w-8 h-8 rounded-full font-bold text-sm shrink-0 transition-all cursor-pointer ${q.correctOption === letter ? 'bg-primary text-white' : 'bg-slate-100 hover:bg-slate-200'}`}>
                              {letter}
                            </button>
                            <div className="flex-1 min-w-0 bg-white overflow-hidden border border-gray-100">
                              <ReactQuill 
                                theme="snow" 
                                modules={miniQuillModules}
                                className="text-black [&_.ql-editor]:min-h-[40px] [&_.ql-editor]:py-2 [&_.ql-toolbar]:py-1 [&_.ql-toolbar]:px-2"
                                placeholder={`Đáp án ${letter}...`}
                                value={q.options[oi]} 
                                onChange={content => updateOption(qi, oi, content)} 
                              />
                            </div>
                            {q.correctOption === letter && <span className="text-primary text-xs font-bold shrink-0">✓ Đúng</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.type === 'ESSAY' && (
                      <div className="space-y-3 p-4 bg-secondary/5 border border-secondary/20">
                        <p className="text-xs font-bold text-secondary/90">✍️ Nhập Đáp án chính xác (Để hệ thống tự động chấm)</p>
                        <p className="text-[11px] text-secondary/70">Hệ thống sẽ cộng điểm nếu học viên nhập trùng khớp với đáp án này. Vui lòng nhập ngắn gọn (VD: book, apple). Nếu để trống, giáo viên sẽ phải chấm thủ công cho câu này.</p>
                        <textarea rows={2} className="w-full p-3 border border-secondary/30 bg-white/50 resize-none focus:border-secondary outline-none transition-colors text-sm"
                          placeholder="VD: book, apple, can... (nhập ngắn gọn, hệ thống sẽ so sánh chính xác)"
                          value={!q.correctOption || q.correctOption === 'A' ? '' : q.correctOption} onChange={e => updateQuestion(qi, { correctOption: e.target.value.toLowerCase() })} />
                      </div>
                    )}

                    {/* Explanation */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Giải thích <span className="font-normal normal-case">(không bắt buộc)</span></label>
                        <button type="button" onClick={() => handleSolveAI(qi)} disabled={solvingAI[qi]} className="flex items-center gap-1 text-xs font-bold bg-amber-500/10 text-amber-600 px-3 py-1.5 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-50">
                          {solvingAI[qi] ? '⏳ Đang giải...' : '🪄 AI Chọn & Giải Thích'}
                        </button>
                      </div>
                      <div className="bg-white overflow-hidden border border-gray-100">
                        <ReactQuill 
                          theme="snow" 
                          modules={miniQuillModules}
                          className="text-black [&_.ql-editor]:min-h-[40px] [&_.ql-editor]:py-2 [&_.ql-toolbar]:py-1 [&_.ql-toolbar]:px-2"
                          placeholder="Giải thích đáp án..."
                          value={q.explanation} 
                          onChange={content => updateQuestion(qi, { explanation: content })} 
                        />
                      </div>
                    </div>
                    </div>
                    )}
                  </div>
                  );
                })}

                <button type="button" onClick={addQuestion}
                  className="w-full py-4 border-2 border-dashed border-gray-300 text-slate-400 font-bold hover:border-primary/40 hover:text-primary/60 transition-colors cursor-pointer">
                  + Thêm câu hỏi
                </button>
              </div>

              <button type="submit" disabled={isCreating}
                className="w-full py-4 bg-primary text-white font-black text-lg hover:bg-primary/90 transition-colors shadow-lg cursor-pointer disabled:opacity-50">
                {isCreating ? 'Đang lưu...' : `🚀 Lưu Đề Thi (${createQuestions.length} câu)`}
              </button>
            </form>
          </div>
        )}

        {/* VIEW: LEADERBOARD */}
        {activeTab === "LEADERBOARD" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl relative pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h1 className="text-3xl font-bold">🏆 Bảng Xếp Hạng</h1>
              <div className="bg-white border border-gray-200 rounded-xl p-1 flex overflow-x-auto max-w-full shadow-sm">
                <button
                  onClick={() => setLeaderboardFilter('GLOBAL')}
                  className={`px-4 py-2 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer rounded-lg ${leaderboardFilter === 'GLOBAL' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                >
                  🌍 Toàn Hệ Thống
                </button>
                {classrooms.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setLeaderboardFilter(c.id)}
                    className={`px-4 py-2 font-bold text-sm transition-colors whitespace-nowrap cursor-pointer rounded-lg ${leaderboardFilter === c.id ? 'bg-amber-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                  >
                    🏫 {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Podium for Top 3 */}
            {leaderboardData.length > 0 && (
              <div className="flex justify-center items-end gap-2 sm:gap-6 mb-12 mt-12">
                {/* 2nd Place */}
                {leaderboardData.length > 1 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-100 w-1/3 max-w-[120px]">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#C0C0C0] bg-white flex items-center justify-center font-bold text-xl overflow-hidden shadow-[0_0_15px_rgba(192,192,192,0.5)]">
                        {leaderboardData[1].avatar ? <img src={leaderboardData[1].avatar} className="w-full h-full object-cover"/> : leaderboardData[1].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#C0C0C0] text-black text-xs font-black px-2 py-0.5 rounded-full border border-white">#2</div>
                    </div>
                    <div className="text-sm font-bold mt-3 text-center w-full truncate">{leaderboardData[1].name}</div>
                    <div className="text-xs text-amber-500 font-bold">{leaderboardData[1].totalXP} XP</div>
                    <div className="w-full h-24 sm:h-32 bg-gradient-to-t from-[#C0C0C0]/20 to-[#C0C0C0]/40 rounded-t-xl mt-2 border-t-2 border-[#C0C0C0]/50 backdrop-blur-sm"></div>
                  </div>
                )}
                
                {/* 1st Place */}
                {leaderboardData.length > 0 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-12 duration-700 z-10 relative w-1/3 max-w-[140px]">
                    <div className="absolute -top-10 text-4xl animate-bounce">👑</div>
                    <div className="relative mb-2">
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-[#FFD700] bg-white flex items-center justify-center font-bold text-3xl overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.6)]">
                        {leaderboardData[0].avatar ? <img src={leaderboardData[0].avatar} className="w-full h-full object-cover"/> : leaderboardData[0].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black text-xs font-black px-3 py-0.5 rounded-full border border-white">#1</div>
                    </div>
                    <div className="text-base font-black mt-3 text-center w-full truncate text-[#FFD700]">{leaderboardData[0].name}</div>
                    <div className="text-sm text-amber-500 font-bold">{leaderboardData[0].totalXP} XP</div>
                    <div className="w-full h-32 sm:h-40 bg-gradient-to-t from-[#FFD700]/20 to-[#FFD700]/40 rounded-t-xl mt-2 border-t-2 border-[#FFD700]/50 backdrop-blur-sm"></div>
                  </div>
                )}

                {/* 3rd Place */}
                {leaderboardData.length > 2 && (
                  <div className="flex flex-col items-center animate-in slide-in-from-bottom-8 duration-700 delay-200 w-1/3 max-w-[120px]">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#CD7F32] bg-white flex items-center justify-center font-bold text-xl overflow-hidden shadow-[0_0_15px_rgba(205,127,50,0.5)]">
                        {leaderboardData[2].avatar ? <img src={leaderboardData[2].avatar} className="w-full h-full object-cover"/> : leaderboardData[2].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#CD7F32] text-white text-xs font-black px-2 py-0.5 rounded-full border border-white">#3</div>
                    </div>
                    <div className="text-sm font-bold mt-3 text-center w-full truncate">{leaderboardData[2].name}</div>
                    <div className="text-xs text-amber-500 font-bold">{leaderboardData[2].totalXP} XP</div>
                    <div className="w-full h-20 sm:h-24 bg-gradient-to-t from-[#CD7F32]/20 to-[#CD7F32]/40 rounded-t-xl mt-2 border-t-2 border-[#CD7F32]/50 backdrop-blur-sm"></div>
                  </div>
                )}
              </div>
            )}

            {/* List */}
            {leaderboardData.length === 0 ? (
              <div className="text-center p-12 bg-white rounded-xl border border-gray-100 text-slate-400 shadow-sm">Chưa có dữ liệu xếp hạng.</div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                {leaderboardData.slice(3).map((u, idx) => (
                  <div key={u.id} className="flex items-center p-4 border-b border-gray-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <div className="w-12 text-center font-bold text-slate-400">#{u.rank}</div>
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden mr-4 shrink-0 font-bold text-sm">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate text-sm sm:text-base">{u.name}</div>
                      <div className="text-xs text-slate-400">Mục tiêu: {u.targetScore || 7.0}+</div>
                    </div>
                    <div className="font-black text-amber-500 text-sm sm:text-base">{u.totalXP} <span className="text-xs text-slate-400 font-normal">XP</span></div>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        )}

      </div>

      {/* ── Create / Edit Class Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">{editClassroom ? 'Chỉnh Sửa Lớp Học' : 'Tạo Lớp Học Mới'}</h2>
            <form onSubmit={handleCreateOrEditClass}>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Tên Lớp</label>
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white rounded-lg focus:outline-none focus:border-primary"
                  placeholder="VD: Tiếng Anh luyện thi Đại học" required autoFocus />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Ngày học trong tuần</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ id: 1, label: 'T2' }, { id: 2, label: 'T3' }, { id: 3, label: 'T4' }, { id: 4, label: 'T5' }, { id: 5, label: 'T6' }, { id: 6, label: 'T7' }, { id: 0, label: 'CN' }].map(day => (
                    <label key={day.id} className={`flex items-center justify-center px-2 py-2 border font-bold text-sm cursor-pointer transition-colors ${scheduleDays.includes(day.id) ? 'bg-primary text-white border-primary' : 'border-gray-200 text-slate-600 hover:bg-slate-50'}`}>
                      <input type="checkbox" className="hidden" checked={scheduleDays.includes(day.id)} onChange={(e) => {
                        if (e.target.checked) setScheduleDays([...scheduleDays, day.id]);
                        else setScheduleDays(scheduleDays.filter(d => d !== day.id));
                      }} />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-bold mb-2">Giờ Bắt Đầu</label>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 bg-white rounded-lg focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Giờ Kết Thúc</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 bg-white rounded-lg focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold mb-2">Học phí mỗi buổi (VNĐ)</label>
                <input type="number" value={feePerLesson} onChange={e => setFeePerLesson(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 bg-white rounded-lg focus:outline-none focus:border-primary"
                  placeholder="VD: 100000" />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 font-bold hover:bg-slate-50 cursor-pointer text-slate-600">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">{editClassroom ? 'Lưu Thay Đổi' : 'Tạo Lớp'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Quick View Exam Modal ── */}
      {selectedExamForView && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-4xl max-h-[90vh] flex flex-col border border-gray-100 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">{selectedExamForView.title}</h2>
                <p className="text-sm text-slate-400">{selectedExamForView.totalQuestions} câu hỏi • {selectedExamForView.duration} phút</p>
              </div>
              <button onClick={() => { setSelectedExamForView(null); setExamViewTab('QUESTIONS'); }} className="p-2 hover:bg-slate-100 rounded-full cursor-pointer transition-colors text-xl">✕</button>
            </div>
              <div className="flex gap-4 border-b border-gray-200 mb-4">
                <button onClick={() => setExamViewTab('QUESTIONS')} className={`px-4 py-2 font-bold ${examViewTab === 'QUESTIONS' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-800'}`}>Nội Dung Đề</button>
                <button onClick={() => setExamViewTab('RESULTS')} className={`px-4 py-2 font-bold ${examViewTab === 'RESULTS' ? 'text-primary border-b-2 border-primary' : 'text-slate-400 hover:text-slate-800'}`}>Tiến Độ Nộp Bài</button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
              
              {examViewTab === 'QUESTIONS' && (
                !selectedExamForView.questions ? (
                  <p className="text-center text-slate-400 py-8">Đang tải...</p>
                ) : selectedExamForView.questions.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Đề thi chưa có câu hỏi</p>
                ) : (
                selectedExamForView.questions.map((q: any, i: number) => {
                  const isEssay = q.question.type === 'ESSAY';
                  const opts = (() => { try { return JSON.parse(q.question.options || '[]'); } catch { return []; } })();
                  return (
                    <div key={i} className="p-5 bg-slate-50">
                      <div className="flex items-start gap-3">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isEssay ? 'bg-secondary/20 text-secondary' : 'bg-primary/20 text-primary'}`}>{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${isEssay ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'}`}>{isEssay ? '✍️ Tự luận' : '🔘 Trắc nghiệm'}</span>
                          </div>
                          {q.question.heading && (
                            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700/80 font-bold whitespace-pre-wrap">
                              {q.question.heading}
                            </div>
                          )}
                          <div className="mb-3 quill-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.question.content) }}></div>
                          {!isEssay && opts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {opts.map((opt: string, idx: number) => (
                                <p key={idx} className={`text-sm p-2 ${String.fromCharCode(65 + idx) === q.question.correctOption ? 'bg-primary/10 text-primary font-bold' : 'text-slate-600'}`}>
                                  {String.fromCharCode(65 + idx)}. {opt}
                                </p>
                              ))}
                            </div>
                          )}
                          {isEssay && <p className="text-sm text-slate-400 italic">Học viên nhập câu trả lời tự do</p>}
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
                    
                    if (targetStudents.length === 0) return <p className="text-center text-slate-400 py-8">Không có học viên nào được giao bài.</p>;
                    
                    const submittedCount = targetStudents.filter((s: any) => selectedExamForView.results?.some((r: any) => r.userId === s.id)).length;
                    
                    return (
                      <>
                        <div className="flex gap-4 p-4 bg-primary/10 mb-4">
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
                        
                        <div className="border border-gray-100 overflow-hidden">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="p-3 font-bold border-b border-gray-200">Học Viên</th>
                                <th className="p-3 font-bold border-b border-gray-200">Điểm cao nhất</th>
                                <th className="p-3 font-bold border-b border-gray-200">Lượt làm</th>
                                <th className="p-3 font-bold border-b border-gray-200">Giờ kết thúc</th>
                                <th className="p-3 font-bold border-b border-gray-200">Thời gian làm</th>
                              </tr>
                            </thead>
                            <tbody>
                              {targetStudents.map((s: any) => {
                                const userResults = selectedExamForView.results?.filter((r: any) => r.userId === s.id) || [];
                                const hasSubmitted = userResults.length > 0;
                                const bestResult = hasSubmitted ? userResults.reduce((prev: any, current: any) => (prev.score > current.score) ? prev : current) : null;
                                const latestResult = hasSubmitted ? userResults.reduce((prev: any, current: any) => (new Date(prev.createdAt) > new Date(current.createdAt)) ? prev : current) : null;
                                
                                return (
                                  <tr key={s.id} className="border-b border-gray-100 last:border-0 hover:bg-slate-50">
                                    <td className="p-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold overflow-hidden">
                                          {s.avatar ? <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" /> : s.name.charAt(0)}
                                        </div>
                                        {s.name}
                                      </div>
                                    </td>
                                    {hasSubmitted ? (
                                      <>
                                        <td className="p-3 font-black text-primary">{bestResult.score.toFixed(1)}</td>
                                        <td className="p-3">{userResults.length} lượt</td>
                                        <td className="p-3 text-slate-600">{new Date(latestResult.createdAt).toLocaleString('vi-VN')}</td>
                                        <td className="p-3 text-slate-600">{Math.floor(latestResult.timeSpent / 60)} phút {latestResult.timeSpent % 60} giây</td>
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
              <button onClick={() => setSelectedExamForView(null)} className="px-6 py-3 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Exam Modal ── */}
      {editExam && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-lg border border-gray-100 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6">Chỉnh Sửa Đề Thi</h2>
            <form onSubmit={handleUpdateExam} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Tiêu đề</label>
                <input className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.title} onChange={e => setEditExam({ ...editExam, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Loại</label>
                  <select className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.examType} onChange={e => setEditExam({ ...editExam, examType: e.target.value })}>
                    <option value="ASSIGNMENT">Bài Tập</option>
                    <option value="EXAM">Đề Thi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Thời gian (phút)</label>
                  <input type="number" className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.duration} onChange={e => setEditExam({ ...editExam, duration: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Public lúc</label>
                  <input type="datetime-local" className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.publishTime || ''} onChange={e => setEditExam({ ...editExam, publishTime: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Deadline</label>
                  <input type="datetime-local" className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.deadline || ''} onChange={e => setEditExam({ ...editExam, deadline: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Ghi chú</label>
                <input type="text" className="w-full p-3 border border-gray-200 bg-white rounded-lg" value={editExam.notes || ''} onChange={e => setEditExam({ ...editExam, notes: e.target.value })} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditExam(null)} className="flex-1 py-3 border border-gray-200 font-bold hover:bg-slate-50 cursor-pointer rounded-lg">Hủy</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-white font-bold hover:bg-primary/90 cursor-pointer">Lưu Thay Đổi</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HIDDEN INVOICE TEMPLATES FOR PDF EXPORT */}
      {Object.keys(aggregatedReports).length > 0 && (
        <div style={{ position: 'absolute', top: '-10000px', left: '-10000px', zIndex: -1 }}>
          {Object.values(aggregatedReports).map((studentData: any) => {
            const [year, month] = attMonth.split('-');
            return (
              <div key={`pdf-${studentData.user.id}`}>
                <TuitionInvoice
                  ref={(el) => { if (el) invoiceRefs.current[studentData.user.id] = el; }}
                  studentName={studentData.user.name}
                  month={parseInt(month)}
                  year={parseInt(year)}
                  classes={studentData.classes}
                  totalAmount={studentData.totalAmount}
                />
              </div>
            );
          })}
        </div>
      )}

      {globalLoading.isLoading && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex flex-col items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6 max-w-sm w-full border border-gray-100">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-bold text-center">{globalLoading.message || 'Đang xử lý...'}</p>
            <p className="text-sm text-slate-400 text-center">Vui lòng chờ trong giây lát</p>
          </div>
        </div>
      )}
    </div>
  );
}

const STAT_CARD_ACCENTS: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-600',
  green: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  rose: 'bg-rose-500/10 text-rose-600',
  violet: 'bg-violet-500/10 text-violet-600',
  cyan: 'bg-cyan-500/10 text-cyan-600',
};

function StatCard({ title, value, icon, accent, sub }: { title: string; value: string; icon?: string; accent?: 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'cyan'; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
          <p className="text-3xl font-extrabold text-slate-800 mt-1 tabular-nums truncate">{value}</p>
          {sub && <p className="text-xs text-slate-400 font-medium mt-1">{sub}</p>}
        </div>
        {icon && (
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${STAT_CARD_ACCENTS[accent || 'blue']}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

function ClassCard({ c, onEdit, onDelete }: { c: any; onEdit?: () => void; onDelete?: () => void }) {
  let daysStr = '';
  try {
    const days = c.scheduleDays ? JSON.parse(c.scheduleDays) : [];
    if (days.length > 0) {
      const map: any = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
      daysStr = days.sort((a: number,b: number) => a-b).map((d: number) => map[d]).join(' - ');
    }
  } catch (e) {}

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex justify-between items-center hover:shadow-md hover:-translate-y-0.5 transition-all group shadow-sm">
      <div>
        <h4 className="font-bold text-lg flex items-center gap-2">
          {c.name}
          {onEdit && (
            <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-primary transition-all rounded-lg hover:bg-blue-50">
              ✎
            </button>
          )}
        </h4>
        <p className="text-sm text-slate-500">{c.students?.length || 0} Học viên</p>

        {(daysStr || c.startTime || c.endTime) && (
          <div className="mt-2 text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg inline-flex gap-2">
            {daysStr && <span>📅 {daysStr}</span>}
            {c.startTime && <span>⏰ {c.startTime} {c.endTime && `- ${c.endTime}`}</span>}
          </div>
        )}
      </div>
      <div className="text-right shrink-0 flex flex-col items-end gap-2">
        <p className="text-xs text-slate-400 mb-1">Mã tham gia</p>
        <div className="bg-blue-50 text-primary font-mono font-bold px-3 py-1.5 rounded-lg text-base tracking-widest border border-blue-100">{c.joinCode}</div>
        {onDelete && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-2 py-1 rounded-lg transition-all cursor-pointer">
            🗑 Xóa lớp
          </button>
        )}
      </div>
    </div>
  );
}

function ExamCard({ title, type, detail, questions, onClick, onEdit, onDelete, onDuplicate, exam }: { title: string; type: string; detail: string; questions: number; onClick?: () => void; onEdit?: () => void; onDelete?: () => void; onDuplicate?: () => void; exam?: any }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 hover:shadow-md hover:border-blue-100 transition-all shadow-sm">
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
        <h4 className="font-bold text-base flex items-center gap-2 flex-wrap">
          {title}
          {exam?.deadline && <span className="bg-rose-50 text-rose-500 text-xs px-2 py-0.5 rounded-full border border-rose-100">⏰ Hạn: {new Date(exam.deadline).toLocaleDateString('vi-VN')}</span>}
          {exam?.notes && <span className="bg-amber-50 text-amber-600 text-xs px-2 py-0.5 rounded-full border border-amber-100">📌 {exam.notes}</span>}
        </h4>
        <p className="text-sm text-slate-500 mt-1">Giao cho: <span className="font-medium text-slate-700">{detail}</span> • {questions} câu • {exam?.duration || 45} phút</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:justify-end">
        <button onClick={e => { e.stopPropagation(); onDuplicate?.(); }} className="px-2.5 py-1.5 text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg cursor-pointer">📋 Nhân bản</button>
        <button onClick={onClick} className="px-2.5 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer">👁 Xem</button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} className="px-2.5 py-1.5 text-xs font-bold bg-blue-50 text-primary hover:bg-blue-100 rounded-lg cursor-pointer">✏️ Sửa</button>
        <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="px-2.5 py-1.5 text-xs font-bold bg-rose-50 text-rose-500 hover:bg-rose-100 rounded-lg cursor-pointer">🗑 Xóa</button>
      </div>
    </div>
  );
}
