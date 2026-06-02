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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
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

const BLANK_QUESTION = () => ({
  type: "MULTIPLE_CHOICE" as "MULTIPLE_CHOICE" | "ESSAY",
  heading: "",
  content: "",
  options: ["", "", "", ""],
  correctOption: "A",
  explanation: "",
  imageUrl: "",
  points: 1,
});

export default function TeacherDashboard() {
  const [activeTab, setActiveTab] = useState("OVERVIEW");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
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
    const userId = (localStorage.getItem('userId') || sessionStorage.getItem('userId'));
    const url = userId ? `${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}`}/api/auth/me?userId=${userId}` : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/me`;
    fetch(url).then(res => res.json()).then(data => setUser(data)).catch(console.error);
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

  // ── Lesson management state ──
  const [localLessons, setLocalLessons] = useState<any[]>([]);
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
        correctOption: data.correctOption || q.correctOption,
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
    { id: "OVERVIEW", label: "Tổng Quan" },
    { 
      id: "QUANLY", label: "Quản Lý Chung", 
      subItems: [
        { id: "CLASSES", label: "Lớp Học" },
        { id: "STUDENTS", label: "Học Sinh" },
        { id: "ATTENDANCE", label: "Điểm Danh & Học Phí" },
        { id: "CALENDAR", label: "Thời Khóa Biểu" }
      ]
    },
    {
      id: "LESSONS_GROUP", label: "Bài Học",
      subItems: [
        { id: "LESSONS", label: "Danh Sách Bài Học" },
        { id: "CREATE_LESSON", label: "Tạo Bài Học" }
      ]
    },
    {
      id: "DOCUMENTS_GROUP", label: "Tài Liệu",
      subItems: [
        { id: "DOCUMENTS", label: "Kho Tài Liệu" }
      ]
    },
    {
      id: "EXAMS_GROUP", label: "Đề Thi",
      subItems: [
        { id: "EXAMS", label: "Ngân Hàng Đề Thi" },
        { id: "CREATE", label: "Tạo Đề Mới" }
      ]
    },
    { id: "LEADERBOARD", label: "Bảng Xếp Hạng" }
  ];

  const allStudents = classrooms.flatMap(c => c.students || []).filter((v, i, a) => a.findIndex((t: any) => t.id === v.id) === i);

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
              user?.name?.charAt(0)?.toUpperCase() || 'T'
            )}
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
              <span className="text-[10px] font-bold text-white tracking-wider">ĐỔI</span>
            </div>
          </label>
          <div className="overflow-hidden">
            <h2 className="text-xl font-black text-foreground truncate tracking-tight">{user?.name || 'Thầy/Cô'}</h2>
            <p className="text-[10px] text-foreground/50 font-bold uppercase tracking-widest mt-0.5">Giáo viên</p>
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
                      {group.subItems.map(item => (
                        <button key={item.id} onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
                          className={`flex items-center px-5 py-2.5 rounded-2xl font-bold transition-all duration-300 cursor-pointer text-left text-sm group ${activeTab === item.id ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md shadow-primary/25 scale-[1.02]' : 'hover:bg-foreground/5 text-foreground/60 hover:text-foreground hover:translate-x-1'}`}>
                          <span className="tracking-wide">{item.label}</span>
                        </button>
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
        <div className="mt-auto pt-6 border-t border-foreground/5 px-2 flex flex-col gap-4">

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

            {/* Overview Chart */}
            <div className="bg-surface p-6 rounded-3xl border border-foreground/10 shadow-sm mt-6 mb-6">
              <h3 className="font-bold mb-6 text-foreground/80">Thống kê Lớp học</h3>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classrooms.map(c => ({ name: c.name, HọcSinh: c.students?.length || 0, BàiTập: c.exams?.length || 0 }))} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }} allowDecimals={false} />
                    <Tooltip cursor={{ fill: 'currentColor', opacity: 0.05 }} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '14px' }} />
                    <Bar dataKey="HọcSinh" name="Số Học Sinh" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="BàiTập" name="Số Bài Tập" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map(c => <ClassCard key={c.id} c={c} onEdit={() => openEditModal(c)} />)}
              <button onClick={openCreateModal} className="border-2 border-dashed border-foreground/20 rounded-2xl p-5 flex items-center justify-center gap-2 text-foreground/40 font-bold hover:border-primary/40 hover:text-primary/60 transition-colors cursor-pointer">
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
              <button onClick={openCreateModal} className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 cursor-pointer">+ Tạo Lớp</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {classrooms.map(c => <ClassCard key={c.id} c={c} onEdit={() => openEditModal(c)} />)}
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
                const level = Math.floor((1 + Math.sqrt(1 + 4 * xp / 50)) / 2);
                if (level >= 20) return { name: `Cấp ${level} - 💎 Huyền Thoại`, color: 'text-cyan-600 bg-cyan-500/10 border border-cyan-500/20' };
                if (level >= 15) return { name: `Cấp ${level} - 🥇 Bậc Thầy`, color: 'text-yellow-600 bg-yellow-500/10 border border-yellow-500/20' };
                if (level >= 10) return { name: `Cấp ${level} - 🥈 Tinh Anh`, color: 'text-slate-600 bg-slate-500/10 border border-slate-500/20' };
                if (level >= 5) return { name: `Cấp ${level} - 📖 Học Giả`, color: 'text-amber-700 bg-amber-500/10 border border-amber-500/20' };
                return { name: `Cấp ${level} - 🌱 Tân Binh`, color: 'text-emerald-600 bg-emerald-500/10 border border-emerald-500/20' };
              };

              return (
                <div className="bg-surface border border-foreground/10 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto w-full">
                    <table className="w-full text-left min-w-[800px]">
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
                        const studentResults = s.examResults || [];
                        const uniqueResults: any[] = Object.values(studentResults.reduce((acc: any, r: any) => {
                          if (!acc[r.examId] || r.score > acc[r.examId].score) acc[r.examId] = r;
                          return acc;
                        }, {}));
                        const avgScore = uniqueResults.length > 0 ? (uniqueResults.reduce((acc: number, r: any) => acc + r.score, 0) / uniqueResults.length) : 0;
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
              </div>
              );
            })()}
          </div>
        )}

        {/* ── DOCUMENTS ── */}
        {activeTab === "DOCUMENTS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h1 className="text-3xl font-bold mb-6">Kho Tài Liệu</h1>
            <div className="bg-surface p-6 rounded-3xl border border-foreground/10 mb-8">
              <h2 className="text-xl font-bold mb-4">Tải tài liệu lên</h2>
              <form onSubmit={handleUploadDocument} className="flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2">Chọn file (PDF, Word)</label>
                  <input type="file" accept=".pdf,.doc,.docx" onChange={e => setDocFile(e.target.files?.[0] || null)} className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" required />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-bold mb-2">Tiêu đề (Tùy chọn)</label>
                  <input type="text" value={docTitle} onChange={e => setDocTitle(e.target.value)} placeholder="Tên tài liệu..." className="w-full p-3 rounded-xl border border-foreground/20 bg-transparent" />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="block text-sm font-bold mb-2">Phạm vi chia sẻ</label>
                  <select value={docVisibility} onChange={e => setDocVisibility(e.target.value)} className="w-full p-3 rounded-xl border border-foreground/20 bg-transparent font-bold">
                    <option value="PUBLIC">Tất cả trung tâm</option>
                    <option value="CLASS">Chỉ lớp học</option>
                    <option value="PRIVATE">Chỉ mình tôi</option>
                  </select>
                </div>
                {docVisibility === 'CLASS' && (
                  <div className="flex-1 min-w-[150px]">
                    <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                    <select value={docClassroomId} onChange={e => setDocClassroomId(e.target.value)} className="w-full p-3 rounded-xl border border-foreground/20 bg-transparent font-bold" required>
                      <option value="">-- Chọn lớp --</option>
                      {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                )}
                <button type="submit" disabled={isUploadingDoc} className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 min-w-[120px]">
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
                 className="w-full md:w-1/3 p-3 rounded-xl border border-foreground/20 bg-surface focus:outline-none focus:ring-2 focus:ring-primary/50" 
               />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).length === 0 && <div className="text-foreground/50 italic col-span-full">Không tìm thấy tài liệu phù hợp</div>}
              {documents.filter(d => d.title.toLowerCase().includes(searchDocQuery.toLowerCase())).map((doc: any) => (
                <div key={doc.id} className="bg-surface p-6 rounded-3xl border border-foreground/10 hover:border-primary/30 transition-all flex flex-col justify-between group relative overflow-hidden">
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
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" download={doc.title} className="flex-1 py-2 text-center bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer block">Tải xuống</a>
                    <button onClick={() => handleDeleteDocument(doc.id)} className="w-10 h-10 flex items-center justify-center bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-colors cursor-pointer z-10 relative" title="Xóa">🗑️</button>
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
            
            <div className="bg-surface border border-foreground/10 p-6 rounded-3xl mb-6 flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-bold mb-2">Chọn Lớp Học</label>
                <select 
                  className="w-full p-3 rounded-xl border border-foreground/20 bg-transparent"
                  value={attClassroomId} onChange={e => setAttClassroomId(e.target.value)}
                >
                  <option value="">-- Chọn lớp --</option>
                  {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex bg-foreground/5 p-1 rounded-xl">
                <button 
                  onClick={() => setAttView('MARK')} 
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${attView === 'MARK' ? 'bg-white shadow text-primary' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  Điểm Danh
                </button>
                <button 
                  onClick={() => setAttView('REPORT')} 
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${attView === 'REPORT' ? 'bg-white shadow text-primary' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  Báo Cáo Học Phí
                </button>
              </div>
            </div>

            {attClassroomId ? (
              <>
                {attView === 'MARK' && (
                  <div className="bg-surface border border-foreground/10 p-6 rounded-3xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">Điểm danh ngày</h2>
                        <input 
                          type="date" 
                          value={attDate} 
                          onChange={e => setAttDate(e.target.value)} 
                          className="p-2 border border-foreground/20 rounded-lg bg-transparent font-medium"
                        />
                      </div>
                      <button 
                        onClick={() => {
                          const next = attRecords.map(r => ({ ...r, status: r.status || 'PRESENT' }));
                          setAttRecords(next);
                          handleSaveAttendance(next);
                        }}
                        className="px-4 py-2 bg-green-500/10 text-green-600 font-bold text-sm rounded-xl hover:bg-green-500/20 transition-colors shrink-0"
                      >
                        ✓ Đánh dấu tất cả có mặt (những người chưa ĐD)
                      </button>
                    </div>
                    {attRecords.length > 0 ? (
                      <>
                        <div className="border border-foreground/10 rounded-2xl overflow-hidden mb-6">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-foreground/5">
                              <tr>
                                <th className="p-3 font-bold border-b border-foreground/10">Học Sinh</th>
                                <th className="p-3 font-bold border-b border-foreground/10 text-center">Trạng Thái</th>
                                <th className="p-3 font-bold border-b border-foreground/10">Ghi chú</th>
                              </tr>
                            </thead>
                            <tbody>
                              {attRecords.map((rec, i) => (
                                <tr key={rec.userId} className="border-b border-foreground/10 last:border-0 hover:bg-foreground/5 transition-colors">
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
                                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${rec.status === 'PRESENT' ? 'bg-green-500 text-white shadow-md shadow-green-500/20' : 'bg-foreground/5 text-foreground/50 hover:bg-foreground/10'}`}
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
                                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${rec.status === 'EXCUSED_ABSENCE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' : 'bg-foreground/5 text-foreground/50 hover:bg-foreground/10'}`}
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
                                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${rec.status === 'UNEXCUSED_ABSENCE' ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20' : 'bg-foreground/5 text-foreground/50 hover:bg-foreground/10'}`}
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
                                      className="w-full px-3 py-1.5 bg-transparent border border-foreground/10 focus:border-primary rounded-lg outline-none text-sm transition-colors"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p className="text-center text-foreground/50 py-8">Lớp chưa có học sinh nào.</p>
                    )}
                  </div>
                )}

                {attView === 'REPORT' && (
                  <div className="bg-surface border border-foreground/10 p-6 rounded-3xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                      <div className="flex items-center gap-4">
                        <h2 className="text-xl font-bold">Báo Cáo Học Phí</h2>
                        <input 
                          type="month" 
                          value={attMonth} 
                          onChange={e => setAttMonth(e.target.value)} 
                          className="p-2 border border-foreground/20 rounded-lg bg-transparent"
                        />
                      </div>
                      {attReport?.report?.length > 0 && (
                        <button 
                          onClick={exportAllPDFs}
                          disabled={isExporting}
                          className="px-4 py-2 bg-indigo-500/10 text-indigo-600 font-bold text-sm rounded-xl hover:bg-indigo-500/20 transition-colors shrink-0 flex items-center gap-2"
                        >
                          {isExporting ? 'Đang xuất...' : '📦 Xuất PDF tất cả (ZIP)'}
                        </button>
                      )}
                    </div>
                    {attReport ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-foreground/5">
                            <tr>
                              <th className="p-4 font-bold border-b border-foreground/10">Học Sinh</th>
                              <th className="p-4 font-bold border-b border-foreground/10">Số Buổi Học</th>
                              <th className="p-4 font-bold border-b border-foreground/10 text-right">Tổng Học Phí</th>
                              <th className="p-4 font-bold border-b border-foreground/10 text-center">Trạng Thái</th>
                              <th className="p-4 font-bold border-b border-foreground/10 text-center">Hành Động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {attReport.report?.map((sr: any) => (
                              <tr key={sr.user.id} className="border-b border-foreground/10 last:border-0 hover:bg-foreground/5">
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
                                      className="text-xs bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                                    >
                                      📄 Xuất PDF
                                    </button>
                                    {!sr.isPaid && sr.totalAmount > 0 && (
                                      <button 
                                        onClick={() => handlePayTuition(sr.user.id, sr.totalAmount)}
                                        className="text-xs bg-primary text-white font-bold px-3 py-1.5 rounded-lg hover:bg-primary/90"
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
                      <p className="text-center text-foreground/50 py-8">Đang tải báo cáo...</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-foreground/40 py-12 bg-foreground/5 rounded-3xl border-2 border-dashed border-foreground/10">
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

        {/* ── LESSONS ── */}
        {activeTab === "LESSONS" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">Ngân Hàng Bài Học</h1>
              <button onClick={() => {
                setCreateLessonTitle(""); setCreateLessonDesc(""); setCreateLessonClassroomId("");
                setLessonVocabs([]); setLessonGrammars([]); setEditingLessonId(null);
                setActiveTab('CREATE_LESSON');
              }} className="px-4 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary/90 cursor-pointer">✏️ Tạo Bài Học Mới</button>
            </div>
            {localLessons.length === 0 ? (
                <div className="bg-surface border border-foreground/10 p-12 rounded-3xl flex flex-col items-center text-center">
                  <span className="text-5xl mb-4">📚</span>
                  <h2 className="text-2xl font-bold mb-2">Chưa có bài học nào</h2>
                  <p className="text-foreground/50 mb-6">Bắt đầu bằng cách tạo bài học mới</p>
                  <button onClick={() => setActiveTab('CREATE_LESSON')} className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer">✏️ Tạo Bài Học Ngay</button>
                </div>
            ) : (
                <div className="space-y-3">
                  {localLessons.map((lesson: any) => (
                    <div key={lesson.id} className="bg-surface border border-foreground/10 p-5 rounded-2xl flex items-center justify-between hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center text-2xl">📚</div>
                        <div>
                          <h3 className="font-bold text-lg">{lesson.title}</h3>
                          <p className="text-sm text-foreground/50">{lesson.vocabularies?.length || 0} từ vựng • {lesson.grammars?.length || 0} ngữ pháp</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleEditLessonSetup(lesson)} className="text-amber-500 hover:text-amber-600 font-bold text-sm px-3 py-1.5 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer mr-2">✏️ Sửa</button>
                        <button onClick={() => handleDuplicateLesson(lesson)} className="text-blue-500 hover:text-blue-600 font-bold text-sm px-3 py-1.5 hover:bg-blue-500/10 rounded-lg transition-colors cursor-pointer mr-2">📋 Nhân bản</button>
                        <button onClick={async () => {
                          if (confirm('Bạn có chắc muốn xóa bài học này?')) {
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/lessons/${lesson.id}`, { method: 'DELETE' });
                            if (res.ok) setLocalLessons(localLessons.filter(l => l.id !== lesson.id));
                          }
                        }} className="text-rose-500 hover:text-rose-600 font-bold text-sm px-3 py-1.5 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">🗑 Xóa</button>
                      </div>
                    </div>
                  ))}
                </div>
            )}
          </div>
        )}

        {/* ── CREATE LESSON ── */}
        {activeTab === "CREATE_LESSON" && (
          <div className="space-y-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h1 className="text-3xl font-bold mb-1">{editingLessonId ? "Sửa Bài Học" : "Tạo Bài Học Mới"}</h1>
              <p className="text-foreground/50">Thêm từ vựng qua file Excel, upload ảnh và tạo ngữ pháp</p>
            </div>
            <form onSubmit={handleCreateLesson} className="space-y-6">
              <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4">
                <h2 className="font-bold text-lg border-b border-foreground/10 pb-3 mb-4">📋 Thông Tin Bài Học</h2>
                <div>
                  <label className="block text-sm font-bold mb-1">Tiêu đề *</label>
                  <input type="text" className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent focus:border-primary outline-none"
                    placeholder="VD: Unit 1 - Family" value={createLessonTitle} onChange={e => setCreateLessonTitle(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Lớp học *</label>
                  <select className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent" value={createLessonClassroomId}
                    onChange={e => setCreateLessonClassroomId(e.target.value)} required>
                    <option value="">-- Chọn lớp --</option>
                    {classrooms.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Mô tả (Không bắt buộc)</label>
                  <textarea className="w-full p-3 rounded-xl border border-foreground/15 bg-transparent focus:border-primary outline-none"
                    placeholder="Mô tả bài học..." value={createLessonDesc} onChange={e => setCreateLessonDesc(e.target.value)} />
                </div>
              </div>

              <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-foreground/10 pb-3 mb-4">
                  <h2 className="font-bold text-lg">📝 Từ Vựng ({lessonVocabs.length} từ)</h2>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleDownloadVocabTemplate} className="px-3 py-1.5 bg-green-500/10 text-green-600 font-bold rounded-lg text-sm cursor-pointer hover:bg-green-500/20">⬇️ Tải Excel Mẫu</button>
                    <label className="px-3 py-1.5 bg-blue-500/10 text-blue-600 font-bold rounded-lg text-sm cursor-pointer hover:bg-blue-500/20">
                      ⬆️ Upload Excel
                      <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleUploadVocabExcel} />
                    </label>
                  </div>
                </div>
                {lessonVocabs.length > 0 && (
                  <div className="max-h-60 overflow-y-auto border border-foreground/10 rounded-xl">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/5 sticky top-0">
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
                          <tr key={i} className="border-b border-foreground/10 last:border-0 hover:bg-foreground/5 transition-colors">
                            <td className="p-2">{v.word}</td>
                            <td className="p-2 text-foreground/50">{v.pos}</td>
                            <td className="p-2 text-primary">{v.phonetic}</td>
                            <td className="p-2">{v.meaning}</td>
                            <td className="p-2 text-center">
                              {v.imageUrl ? (
                                <div className="flex flex-col items-center gap-1">
                                  <img src={v.imageUrl} alt={v.word} className="w-12 h-12 object-cover rounded shadow-sm border border-foreground/10" />
                                  <label className="cursor-pointer text-[10px] text-blue-500 hover:underline">
                                    Đổi ảnh
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadVocabImage(i, e)} />
                                  </label>
                                </div>
                              ) : (
                                <label className="cursor-pointer text-xs bg-foreground/5 hover:bg-foreground/10 px-2 py-1 rounded text-foreground/70 transition-colors">
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

              <div className="bg-surface border border-foreground/10 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-foreground/10 pb-3 mb-4">
                  <h2 className="font-bold text-lg">📖 Ngữ Pháp ({lessonGrammars.length} mục)</h2>
                  <button type="button" onClick={() => setLessonGrammars([...lessonGrammars, { title: '', structure: '', explanation: '' }])} className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-sm cursor-pointer hover:bg-primary/20">+ Thêm Ngữ Pháp</button>
                </div>
                {lessonGrammars.map((g, i) => (
                  <div key={i} className="p-4 border border-foreground/10 rounded-xl space-y-3 relative">
                    <button type="button" onClick={() => setLessonGrammars(lessonGrammars.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 text-rose-500 font-bold cursor-pointer hover:underline text-xs">Xóa</button>
                    <input type="text" placeholder="Tên điểm ngữ pháp (VD: Thì hiện tại đơn)" className="w-full p-2 border-b border-foreground/15 bg-transparent font-bold outline-none" value={g.title} onChange={e => { const n = [...lessonGrammars]; n[i].title = e.target.value; setLessonGrammars(n); }} />
                    <input type="text" placeholder="Công thức (S + V + O)" className="w-full p-2 border-b border-foreground/15 bg-transparent outline-none text-primary font-mono text-sm" value={g.structure} onChange={e => { const n = [...lessonGrammars]; n[i].structure = e.target.value; setLessonGrammars(n); }} />
                    <ReactQuill theme="snow" placeholder="Giải thích chi tiết..." className="bg-white text-black" value={g.explanation} onChange={(content) => { const n = [...lessonGrammars]; n[i].explanation = content; setLessonGrammars(n); }} />
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button type="submit" className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer shadow-lg shadow-primary/30">
                  Lưu Bài Học
                </button>
              </div>
            </form>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <div className="flex items-center gap-2 bg-foreground/5 px-3 py-1.5 rounded-lg ml-4">
                          <label className="text-xs font-bold text-foreground/50">Điểm:</label>
                          <input type="number" min="0" step="0.5" className="w-16 bg-transparent text-sm font-bold outline-none text-primary"
                            value={q.points || 1} onChange={e => updateQuestion(qi, { points: parseFloat(e.target.value) || 0 })} />
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
                        <ReactQuill theme="snow" className="bg-white text-black"
                          placeholder={q.type === 'ESSAY' ? 'Nhập câu hỏi tự luận...' : 'Nhập câu hỏi trắc nghiệm...'}
                          value={q.content} onChange={content => updateQuestion(qi, { content })} />
                      </div>
                      
                      {/* Image upload for question */}
                      <div>
                        <label className="block text-xs font-bold text-foreground/50 mb-1 uppercase tracking-wide">Hình ảnh (không bắt buộc)</label>
                        {q.imageUrl ? (
                          <div className="relative inline-block mt-2">
                            <img src={q.imageUrl} alt="Question image" className="max-h-40 rounded-xl border border-foreground/10" />
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
                          }} className="block w-full text-sm text-foreground/70 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer" />
                        )}
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
                            <div className="flex-1 min-w-0 bg-white rounded-lg overflow-hidden border border-foreground/10">
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

                    {/* ESSAY hint & Rubric input */}
                    {q.type === 'ESSAY' && (
                      <div className="space-y-3 p-4 bg-secondary/5 border border-secondary/20 rounded-xl">
                        <p className="text-xs font-bold text-secondary/90">✍️ Nhập Đáp án chính xác (Nếu có)</p>
                        <p className="text-[11px] text-secondary/70">Nếu bạn để trống, AI sẽ tự động chấm điểm bài làm bằng kiến thức của nó. Nếu bạn nhập một đáp án, AI sẽ không tham gia chấm điểm (hệ thống sẽ so sánh khớp chính xác hoặc chờ bạn chấm thủ công).</p>
                        <textarea rows={4} className="w-full p-3 rounded-xl border border-secondary/30 bg-white/50 resize-none focus:border-secondary outline-none transition-colors text-sm"
                          placeholder="VD: Học sinh cần đề cập đến 3 ý chính: 1. Môi trường, 2. Xã hội, 3. Kinh tế..."
                          value={q.correctOption === 'A' ? '' : q.correctOption} onChange={e => updateQuestion(qi, { correctOption: e.target.value })} />
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
                      <div className="bg-white rounded-lg overflow-hidden border border-foreground/10">
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

        {/* VIEW: LEADERBOARD */}
        {activeTab === "LEADERBOARD" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl relative pb-24">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h1 className="text-3xl font-bold">🏆 Bảng Xếp Hạng</h1>
              <div className="bg-surface border border-foreground/10 rounded-xl p-1 flex overflow-x-auto max-w-full">
                <button 
                  onClick={() => setLeaderboardFilter('GLOBAL')} 
                  className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${leaderboardFilter === 'GLOBAL' ? 'bg-amber-500 text-white shadow-md' : 'text-foreground/60 hover:text-foreground'}`}
                >
                  🌍 Toàn Hệ Thống
                </button>
                {classrooms.map((c: any) => (
                  <button 
                    key={c.id}
                    onClick={() => setLeaderboardFilter(c.id)} 
                    className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors whitespace-nowrap cursor-pointer ${leaderboardFilter === c.id ? 'bg-amber-500 text-white shadow-md' : 'text-foreground/60 hover:text-foreground'}`}
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
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#C0C0C0] bg-surface flex items-center justify-center font-bold text-xl overflow-hidden shadow-[0_0_15px_rgba(192,192,192,0.5)]">
                        {leaderboardData[1].avatar ? <img src={leaderboardData[1].avatar} className="w-full h-full object-cover"/> : leaderboardData[1].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#C0C0C0] text-black text-xs font-black px-2 py-0.5 rounded-full border border-surface">#2</div>
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
                      <div className="w-20 h-20 sm:w-28 sm:h-28 rounded-full border-4 border-[#FFD700] bg-surface flex items-center justify-center font-bold text-3xl overflow-hidden shadow-[0_0_30px_rgba(255,215,0,0.6)]">
                        {leaderboardData[0].avatar ? <img src={leaderboardData[0].avatar} className="w-full h-full object-cover"/> : leaderboardData[0].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#FFD700] text-black text-xs font-black px-3 py-0.5 rounded-full border border-surface">#1</div>
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
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#CD7F32] bg-surface flex items-center justify-center font-bold text-xl overflow-hidden shadow-[0_0_15px_rgba(205,127,50,0.5)]">
                        {leaderboardData[2].avatar ? <img src={leaderboardData[2].avatar} className="w-full h-full object-cover"/> : leaderboardData[2].name.charAt(0)}
                      </div>
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#CD7F32] text-white text-xs font-black px-2 py-0.5 rounded-full border border-surface">#3</div>
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
              <div className="text-center p-12 bg-surface rounded-3xl border border-foreground/10 text-foreground/50">Chưa có dữ liệu xếp hạng.</div>
            ) : (
              <div className="bg-surface border border-foreground/10 rounded-3xl overflow-hidden shadow-sm">
                {leaderboardData.slice(3).map((u, idx) => (
                  <div key={u.id} className="flex items-center p-4 border-b border-foreground/5 last:border-0 hover:bg-foreground/5 transition-colors">
                    <div className="w-12 text-center font-bold text-foreground/50">#{u.rank}</div>
                    <div className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center overflow-hidden mr-4 shrink-0 font-bold text-sm">
                      {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover"/> : u.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate text-sm sm:text-base">{u.name}</div>
                      <div className="text-xs text-foreground/50">Mục tiêu: {u.targetScore || 7.0}+</div>
                    </div>
                    <div className="font-black text-amber-500 text-sm sm:text-base">{u.totalXP} <span className="text-xs text-foreground/50 font-normal">XP</span></div>
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
          <div className="bg-surface p-8 rounded-3xl w-full max-w-md border border-foreground/10 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold mb-6">{editClassroom ? 'Chỉnh Sửa Lớp Học' : 'Tạo Lớp Học Mới'}</h2>
            <form onSubmit={handleCreateOrEditClass}>
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Tên Lớp</label>
                <input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-transparent focus:outline-none focus:border-primary"
                  placeholder="VD: Tiếng Anh luyện thi Đại học" required autoFocus />
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-bold mb-2">Ngày học trong tuần</label>
                <div className="grid grid-cols-4 gap-2">
                  {[{ id: 1, label: 'T2' }, { id: 2, label: 'T3' }, { id: 3, label: 'T4' }, { id: 4, label: 'T5' }, { id: 5, label: 'T6' }, { id: 6, label: 'T7' }, { id: 0, label: 'CN' }].map(day => (
                    <label key={day.id} className={`flex items-center justify-center px-2 py-2 rounded-lg border font-bold text-sm cursor-pointer transition-colors ${scheduleDays.includes(day.id) ? 'bg-primary text-white border-primary' : 'border-foreground/20 text-foreground/70 hover:bg-foreground/5'}`}>
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
                    className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-transparent focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">Giờ Kết Thúc</label>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-transparent focus:outline-none focus:border-primary" />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold mb-2">Học phí mỗi buổi (VNĐ)</label>
                <input type="number" value={feePerLesson} onChange={e => setFeePerLesson(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-foreground/20 bg-transparent focus:outline-none focus:border-primary"
                  placeholder="VD: 100000" />
              </div>

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold hover:bg-foreground/5 cursor-pointer text-foreground/70">Hủy</button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 cursor-pointer">{editClassroom ? 'Lưu Thay Đổi' : 'Tạo Lớp'}</button>
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
                            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-700/80 font-bold whitespace-pre-wrap">
                              {q.question.heading}
                            </div>
                          )}
                          <div className="mb-3 quill-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(q.question.content) }}></div>
                          {!isEssay && opts.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <div className="bg-surface p-8 rounded-3xl shadow-2xl flex flex-col items-center space-y-6 max-w-sm w-full border border-foreground/10">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-lg font-bold text-center">{globalLoading.message || 'Đang xử lý...'}</p>
            <p className="text-sm text-foreground/50 text-center">Vui lòng chờ trong giây lát</p>
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

function ClassCard({ c, onEdit }: { c: any; onEdit?: () => void }) {
  let daysStr = '';
  try {
    const days = c.scheduleDays ? JSON.parse(c.scheduleDays) : [];
    if (days.length > 0) {
      const map: any = { 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7', 0: 'CN' };
      daysStr = days.sort((a: number,b: number) => a-b).map((d: number) => map[d]).join(' - ');
    }
  } catch (e) {}

  return (
    <div className="bg-surface border border-foreground/10 p-5 rounded-2xl flex justify-between items-center hover:-translate-y-1 transition-transform group relative">
      <div>
        <h4 className="font-bold text-lg flex items-center gap-2">
          {c.name}
          {onEdit && (
            <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 p-1 text-foreground/40 hover:text-primary transition-all rounded hover:bg-primary/10">
              ✎
            </button>
          )}
        </h4>
        <p className="text-sm text-foreground/60">{c.students?.length || 0} Học sinh</p>
        
        {(daysStr || c.startTime || c.endTime) && (
          <div className="mt-2 text-xs font-bold bg-foreground/5 text-foreground/70 px-3 py-1.5 rounded-lg inline-flex gap-2">
            {daysStr && <span>📅 {daysStr}</span>}
            {c.startTime && <span>⏰ {c.startTime} {c.endTime && `- ${c.endTime}`}</span>}
          </div>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-foreground/50 mb-1">Mã tham gia</p>
        <div className="bg-primary/10 text-primary font-mono font-bold px-3 py-1 rounded text-lg tracking-widest">{c.joinCode}</div>
      </div>
    </div>
  );
}

function ExamCard({ title, type, detail, questions, onClick, onEdit, onDelete, onDuplicate, exam }: { title: string; type: string; detail: string; questions: number; onClick?: () => void; onEdit?: () => void; onDelete?: () => void; onDuplicate?: () => void; exam?: any }) {
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
        <button onClick={e => { e.stopPropagation(); onDuplicate?.(); }} className="px-3 py-2 text-sm font-bold bg-blue-500/10 text-blue-600 rounded-lg hover:bg-blue-500/20 cursor-pointer">📋 Nhân bản</button>
        <button onClick={onClick} className="px-3 py-2 text-sm font-bold bg-foreground/10 rounded-lg hover:bg-foreground/20 cursor-pointer">👁 Xem</button>
        <button onClick={e => { e.stopPropagation(); onEdit?.(); }} className="px-3 py-2 text-sm font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 cursor-pointer">✏️ Sửa</button>
        <button onClick={e => { e.stopPropagation(); onDelete?.(); }} className="px-3 py-2 text-sm font-bold bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500/20 cursor-pointer">🗑 Xóa</button>
      </div>
    </div>
  );
}
