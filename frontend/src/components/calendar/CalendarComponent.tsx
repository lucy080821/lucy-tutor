"use client";
import React, { useState, useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";

export default function CalendarComponent({ user, role, classrooms }: { user: any, role: 'STUDENT' | 'TEACHER', classrooms?: any[] }) {
  const [events, setEvents] = useState<any[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editSession, setEditSession] = useState<any>(null);
  
  // For dragging/creating
  const [sessionForm, setSessionForm] = useState({
    title: "",
    classroomId: "",
    startTime: "",
    endTime: "",
    location: "",
    isRecurring: false
  });

  const fetchEvents = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/calendar/events?userId=${user.id}&role=${role}`);
      const data = await res.json();
      
      const formattedEvents = [];
      
      // Class Sessions
      for (const session of data.classSessions || []) {
        const isRecurring = !!session.recurrenceRule;
        const baseEvent: any = {
          id: session.id,
          title: session.title || 'Lịch học',
          backgroundColor: '#3b82f6',
          borderColor: '#2563eb',
          extendedProps: {
            type: 'SESSION',
            location: session.location,
            classroomId: session.classroomId,
            recurrenceRule: session.recurrenceRule,
            originalStart: session.startTime,
            originalEnd: session.endTime,
            isVirtual: session.isVirtual
          }
        };

        if (isRecurring) {
          const startDate = new Date(session.startTime);
          const endDate = new Date(session.endTime);
          baseEvent.startTime = startDate.toTimeString().slice(0, 5); // "HH:MM"
          baseEvent.endTime = endDate.toTimeString().slice(0, 5);
          if (session.isVirtual) {
            try {
              baseEvent.daysOfWeek = JSON.parse(session.recurrenceRule);
            } catch (e) {
              baseEvent.daysOfWeek = [startDate.getDay()];
            }
            baseEvent.editable = false; // Cannot drag and drop virtual classroom schedules
            baseEvent.backgroundColor = '#10b981'; // Green for classroom schedule
            baseEvent.borderColor = '#059669';
          } else {
            baseEvent.startRecur = startDate.toISOString().split('T')[0];
            baseEvent.daysOfWeek = [startDate.getDay()]; // Recurs on that day of week
          }
        } else {
          baseEvent.start = session.startTime;
          baseEvent.end = session.endTime;
        }

        formattedEvents.push(baseEvent);
      }
      
      // Exams (Homework / Tests)
      for (const exam of data.exams || []) {
        if (exam.deadline) {
          formattedEvents.push({
            id: `exam-${exam.id}`,
            title: `[Hạn] ${exam.title}`,
            start: exam.deadline,
            allDay: false,
            backgroundColor: '#ef4444', // red
            borderColor: '#dc2626',
            extendedProps: {
              type: 'EXAM',
              examId: exam.id
            }
          });
        }
      }
      
      setEvents(formattedEvents);
    } catch (err) {
      console.error('Error fetching calendar events', err);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const handleDateSelect = (selectInfo: any) => {
    if (role !== 'TEACHER') return;
    setEditSession(null);
    setSessionForm({
      title: "Lịch dạy",
      classroomId: classrooms?.[0]?.id || "",
      startTime: selectInfo.startStr.slice(0, 16),
      endTime: selectInfo.endStr.slice(0, 16),
      location: "",
      isRecurring: true // Default to true as requested
    });
    setShowSessionModal(true);
    selectInfo.view.calendar.unselect();
  };

  const handleEventClick = (clickInfo: any) => {
    const ev = clickInfo.event;
    if (ev.extendedProps.type === 'SESSION' && role === 'TEACHER') {
      if (ev.extendedProps.isVirtual) {
        alert("Đây là lịch học cố định của lớp. Để sửa, vui lòng vào tab 'Lớp Học' và sửa thông tin lớp.");
        return;
      }
      setEditSession({ id: ev.id });
      setSessionForm({
        title: ev.title,
        classroomId: ev.extendedProps.classroomId,
        startTime: (ev.extendedProps.originalStart || ev.startStr).slice(0, 16),
        endTime: ev.extendedProps.originalEnd ? ev.extendedProps.originalEnd.slice(0, 16) : ((ev.endStr || ev.startStr).slice(0, 16)),
        location: ev.extendedProps.location || "",
        isRecurring: !!ev.extendedProps.recurrenceRule
      });
      setShowSessionModal(true);
    } else {
      // Just show simple alert for now
      alert(`Sự kiện: ${ev.title}\nLoại: ${ev.extendedProps.type === 'EXAM' ? 'Bài tập/Kiểm tra' : 'Buổi học'}`);
    }
  };

  const handleEventDrop = async (dropInfo: any) => {
    if (role !== 'TEACHER') {
      dropInfo.revert();
      return;
    }
    const ev = dropInfo.event;
    if (ev.extendedProps.type !== 'SESSION') {
      dropInfo.revert();
      return;
    }

    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/calendar/sessions/${ev.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startTime: ev.startStr,
          endTime: ev.endStr || ev.startStr
        })
      });
    } catch (err) {
      dropInfo.revert();
      console.error(err);
    }
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/calendar/sessions${editSession ? `/${editSession.id}` : ''}`;
      const method = editSession ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sessionForm,
          recurrenceRule: sessionForm.isRecurring ? 'WEEKLY' : null
        })
      });
      if (res.ok) {
        fetchEvents();
        setShowSessionModal(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSession = async () => {
    if (!editSession || !confirm('Xóa lịch học này?')) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/calendar/sessions/${editSession.id}`, {
        method: 'DELETE'
      });
      fetchEvents();
      setShowSessionModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-surface rounded-3xl p-4 md:p-8 h-full flex flex-col relative border border-foreground/10 shadow-sm animate-in fade-in zoom-in duration-500">
      <div className="flex-1 w-full overflow-y-auto">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          initialView="timeGridWeek"
          editable={role === 'TEACHER'}
          selectable={role === 'TEACHER'}
          selectMirror={true}
          dayMaxEvents={true}
          weekends={true}
          events={events}
          select={handleDateSelect}
          eventClick={handleEventClick}
          eventDrop={handleEventDrop}
          eventResize={handleEventDrop}
          height="100%"
          contentHeight="auto"
        />
      </div>

      {showSessionModal && role === 'TEACHER' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-3xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-bold mb-4">{editSession ? 'Sửa Lịch Học' : 'Tạo Lịch Học'}</h2>
            <form onSubmit={handleSaveSession} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1">Tiêu đề</label>
                <input required type="text" className="w-full p-2 border border-foreground/20 rounded-lg bg-transparent"
                  value={sessionForm.title} onChange={e => setSessionForm({...sessionForm, title: e.target.value})} />
              </div>
              {!editSession && (
                <div>
                  <label className="block text-sm font-bold mb-1">Lớp Học</label>
                  <select required className="w-full p-2 border border-foreground/20 rounded-lg bg-transparent"
                    value={sessionForm.classroomId} onChange={e => setSessionForm({...sessionForm, classroomId: e.target.value})}>
                    <option value="">Chọn lớp</option>
                    {classrooms?.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Bắt đầu</label>
                  <input required type="datetime-local" className="w-full p-2 border border-foreground/20 rounded-lg bg-transparent"
                    value={sessionForm.startTime} onChange={e => setSessionForm({...sessionForm, startTime: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">Kết thúc</label>
                  <input required type="datetime-local" className="w-full p-2 border border-foreground/20 rounded-lg bg-transparent"
                    value={sessionForm.endTime} onChange={e => setSessionForm({...sessionForm, endTime: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold mb-1">Địa điểm / Link</label>
                <input type="text" className="w-full p-2 border border-foreground/20 rounded-lg bg-transparent" placeholder="Zoom / Google Meet"
                  value={sessionForm.location} onChange={e => setSessionForm({...sessionForm, location: e.target.value})} />
              </div>
              
              <div className="flex gap-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold">
                  <input type="checkbox" checked={sessionForm.isRecurring} onChange={e => setSessionForm({...sessionForm, isRecurring: e.target.checked})} className="w-4 h-4" />
                  Lặp lại hàng tuần (vào thứ {new Date(sessionForm.startTime || Date.now()).getDay() === 0 ? 'Chủ nhật' : new Date(sessionForm.startTime || Date.now()).getDay() + 1})
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="submit" className="flex-1 bg-primary text-white font-bold py-2 rounded-lg hover:bg-primary/90">
                  Lưu
                </button>
                {editSession && (
                  <button type="button" onClick={handleDeleteSession} className="bg-rose-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-rose-600">
                    Xóa
                  </button>
                )}
                <button type="button" onClick={() => setShowSessionModal(false)} className="px-4 py-2 bg-foreground/10 font-bold rounded-lg hover:bg-foreground/20">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
