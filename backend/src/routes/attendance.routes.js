const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();

// Standard number of scheduled lesson-days a class has within a given calendar month,
// derived from classroom.scheduleDays (day-of-week list, e.g. "[1,4]" = Mon/Thu). Walks
// the real calendar rather than a flat weeks*sessionsPerWeek estimate, so a month that
// happens to contain an extra Monday naturally counts 1 more lesson than a typical one.
// Returns null when the class has no schedule set. Purely informational now (shown as
// "X/Y buổi" next to the flat fee) — no longer feeds into calcTuitionAmount below.
function getStandardLessonsInMonth(classroom, month, year) {
  if (!classroom.scheduleDays) return null;
  let days;
  try { days = JSON.parse(classroom.scheduleDays); } catch { return null; }
  if (!Array.isArray(days) || days.length === 0) return null;

  const daySet = new Set(days.map(Number));
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  let count = 0;
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (daySet.has(d.getDay())) count++;
  }
  return count;
}

// MONTHLY classes are billed a flat feePerMonth collected upfront at the start of the
// month, regardless of how many sessions the student ends up attending — tuition no
// longer prorates against attendance (that used to divide feePerMonth by the standard
// lesson count and multiply by presentCount). Attendance is still tracked in full
// (see getStandardLessonsInMonth above) for chuyên cần/insight purposes, just no longer
// drives the amount owed. PER_LESSON classes (e.g. lớp Giao Tiếp) are unaffected — those
// were always billed per session actually attended and stay that way.
function calcTuitionAmount(classroom, presentCount, month, year) {
  if (classroom.feeType === 'MONTHLY') {
    return classroom.feePerMonth || 0;
  }
  return presentCount * (classroom.feePerLesson || 0);
}

// 1. Lấy danh sách điểm danh của 1 lớp trong 1 ngày cụ thể
router.get('/class/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { date } = req.query; // YYYY-MM-DD
    
    if (!date) return res.status(400).json({ error: 'Missing date parameter' });
    
    // Parse date ensuring it's the start of the day in UTC or local timezone based on how it's saved
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const attendances = await prisma.attendance.findMany({
      where: {
        classroomId,
        date: {
          gte: targetDate,
          lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
        }
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true }
        }
      }
    });

    res.json(attendances);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 1b. Điểm danh cả tháng của TẤT CẢ các lớp một giáo viên đang dạy — dùng cho lưới điểm danh
// trực quan (mỗi hàng 1 học viên, mỗi cột 1 ngày trong tháng) thay vì chỉ xem từng ngày.
router.get('/month/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) return res.status(400).json({ error: 'Missing month or year' });

    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    // Single query via relation filter (was: fetch teacher's classroom ids, then attendance).
    const attendances = await prisma.attendance.findMany({
      where: {
        classroom: { teacherId },
        date: { gte: startDate, lt: endDate }
      },
      select: { classroomId: true, userId: true, date: true, status: true }
    });

    res.json(attendances);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2. Điểm danh (hoặc cập nhật điểm danh)
router.post('/mark', async (req, res) => {
  try {
    const { classroomId, records, date } = req.body;
    // records: [{ userId: "123", status: "PRESENT", notes: "" }, ...]
    
    if (!date || !classroomId || !records) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Upsert each record — skip entries with no status yet (student not marked in this
    // save), since `status` is a required column and one bad record would otherwise abort
    // the whole batch and report failure even for students that were marked correctly.
    // Upserts run concurrently instead of one awaited round trip per student.
    const validRecords = records.filter(r => r.status === 'PRESENT' || r.status === 'UNEXCUSED');
    const results = await Promise.all(validRecords.map(record =>
      prisma.attendance.upsert({
        where: {
          classroomId_userId_date: {
            classroomId,
            userId: record.userId,
            date: targetDate
          }
        },
        update: {
          status: record.status,
          notes: record.notes || null,
          updatedAt: new Date()
        },
        create: {
          classroomId,
          userId: record.userId,
          date: targetDate,
          status: record.status,
          notes: record.notes || null
        },
        select: { id: true }
      })
    ));

    res.json({ message: 'Lưu điểm danh thành công', count: results.length });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 2b. Xoá 1 bản ghi điểm danh — dùng khi bấm lần thứ 3 trên lưới điểm danh để bỏ chọn hẳn
// (thay vì chỉ có 2 trạng thái Có mặt/Vắng lặp lại vô hạn)
router.delete('/mark', async (req, res) => {
  try {
    const { classroomId, userId, date } = req.query;

    if (!classroomId || !userId || !date) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    await prisma.attendance.deleteMany({
      where: { classroomId: String(classroomId), userId: String(userId), date: targetDate }
    });

    res.json({ message: 'Đã xoá điểm danh' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3. Báo cáo học phí theo tháng
router.get('/report/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) return res.status(400).json({ error: 'Missing month or year' });
    
    const m = parseInt(month);
    const y = parseInt(year);
    
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    // Classroom, attendance and payments are independent — fetch in parallel.
    const [classroom, attendances, payments] = await Promise.all([
      prisma.classroom.findUnique({
        where: { id: classroomId },
        select: {
          name: true, feeType: true, feePerLesson: true, feePerMonth: true, scheduleDays: true,
          students: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.attendance.findMany({
        where: { classroomId, date: { gte: startDate, lt: endDate } },
        select: { userId: true, status: true }
      }),
      prisma.tuitionPayment.findMany({
        where: { classroomId, month: m, year: y },
        select: { id: true, userId: true, status: true, paidAt: true }
      })
    ]);

    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });

    // Calculate per student
    const report = classroom.students.map(student => {
      const studentAttendances = attendances.filter(a => a.userId === student.id);
      
      const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
      const unexcusedCount = studentAttendances.filter(a => a.status === 'UNEXCUSED').length;
      const excusedCount = studentAttendances.filter(a => a.status === 'EXCUSED').length;
      
      const totalAmount = calcTuitionAmount(classroom, presentCount, m, y);

      const payment = payments.find(p => p.userId === student.id);

      return {
        user: student,
        presentCount,
        unexcusedCount,
        excusedCount,
        totalAmount,
        paymentStatus: payment?.status || 'UNPAID',
        paidAt: payment?.paidAt || null,
        paymentId: payment?.id || null
      };
    });

    res.json({
      classroom: {
        name: classroom.name, feeType: classroom.feeType, feePerLesson: classroom.feePerLesson, feePerMonth: classroom.feePerMonth,
        standardLessons: classroom.feeType === 'MONTHLY' ? getStandardLessonsInMonth(classroom, m, y) : null
      },
      month: m,
      year: y,
      report
    });

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 3b. Báo cáo học phí tổng hợp của TẤT CẢ các lớp của 1 giáo viên (quản lý chung)
router.get('/report/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const { month, year } = req.query;

    if (!month || !year) return res.status(400).json({ error: 'Missing month or year' });

    const m = parseInt(month);
    const y = parseInt(year);

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    // All 4 queries are independent (attendance/payments filter through the classroom
    // relation instead of a pre-fetched id list), so they run in parallel: 1 round trip, not 4.
    // Free-standing (classless) students pay through a separate flow (FreeStudentPayment,
    // see freeStudent.routes.js) — not tied to any classroom/attendance, so it can't be folded
    // into totalCollected/totalExpected below without corrupting the classroom collection-rate
    // math (paidCount/unpaidCount/donut chart). Reported as its own field instead; the frontend
    // adds it on top only where "revenue this month" is the actual intent (KPI + trend chart).
    const [classrooms, presentRows, payments, freeStudentAgg] = await Promise.all([
      prisma.classroom.findMany({
        where: { teacherId },
        select: {
          id: true,
          name: true,
          feeType: true,
          feePerLesson: true,
          feePerMonth: true,
          scheduleDays: true,
          students: { select: { id: true, name: true, email: true } }
        }
      }),
      prisma.attendance.findMany({
        where: {
          classroom: { teacherId },
          date: { gte: startDate, lt: endDate },
          status: 'PRESENT'
        },
        select: { classroomId: true, userId: true }
      }),
      prisma.tuitionPayment.findMany({
        where: { classroom: { teacherId }, month: m, year: y },
        select: { classroomId: true, userId: true, status: true, paidAt: true, totalAmount: true }
      }),
      prisma.freeStudentPayment.aggregate({
        where: { teacherId, paidAt: { gte: startDate, lt: endDate } },
        _sum: { amount: true }
      })
    ]);
    const freeStudentRevenue = freeStudentAgg._sum.amount || 0;

    // Index by "classroomId|userId" so the per-student loop is O(1) instead of re-scanning
    // every attendance/payment row for every student.
    const presentByKey = new Map();
    for (const a of presentRows) {
      const key = `${a.classroomId}|${a.userId}`;
      presentByKey.set(key, (presentByKey.get(key) || 0) + 1);
    }
    const paymentByKey = new Map(payments.map(p => [`${p.classroomId}|${p.userId}`, p]));

    let totalCollected = 0;
    let totalExpected = 0;
    const paidList = [];
    const unpaidList = [];

    for (const classroom of classrooms) {
      for (const student of classroom.students) {
        const key = `${classroom.id}|${student.id}`;
        const presentCount = presentByKey.get(key) || 0;
        const totalAmount = calcTuitionAmount(classroom, presentCount, m, y);
        const payment = paymentByKey.get(key);

        const entry = {
          user: student,
          classroomId: classroom.id,
          classroomName: classroom.name,
          feeType: classroom.feeType,
          presentCount,
          totalAmount,
          paymentStatus: payment?.status || 'UNPAID',
          paidAt: payment?.paidAt || null
        };

        totalExpected += totalAmount;

        if (entry.paymentStatus === 'PAID') {
          totalCollected += payment?.totalAmount ?? totalAmount;
          paidList.push(entry);
        } else {
          unpaidList.push(entry);
        }
      }
    }

    res.json({
      month: m,
      year: y,
      totalClassrooms: classrooms.length,
      totalCollected,
      totalExpected,
      freeStudentRevenue,
      paidCount: paidList.length,
      unpaidCount: unpaidList.length,
      paidList,
      unpaidList
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 4. Xác nhận đã đóng tiền học phí
router.post('/pay', async (req, res) => {
  try {
    const { classroomId, userId, month, year, totalAmount, paidAt } = req.body;
    
    if (!classroomId || !userId || !month || !year) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const payment = await prisma.tuitionPayment.upsert({
      where: {
        classroomId_userId_month_year: {
          classroomId,
          userId,
          month: parseInt(month),
          year: parseInt(year)
        }
      },
      update: {
        status: 'PAID',
        totalAmount: parseInt(totalAmount || 0),
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        updatedAt: new Date()
      },
      create: {
        classroomId,
        userId,
        month: parseInt(month),
        year: parseInt(year),
        status: 'PAID',
        totalAmount: parseInt(totalAmount || 0),
        paidAt: paidAt ? new Date(paidAt) : new Date()
      }
    });

    res.json({ message: 'Xác nhận nộp tiền thành công', payment });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 5. Học sinh xem báo cáo học phí của bản thân
router.get('/my-tuition/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { month, year } = req.query;
    
    if (!month || !year) return res.status(400).json({ error: 'Missing month or year' });
    
    const m = parseInt(month);
    const y = parseInt(year);
    
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 1);

    const CLASSROOM_FIELDS = { id: true, name: true, feeType: true, feePerLesson: true, feePerMonth: true, scheduleDays: true };

    // Seed one entry per classroom the student is currently enrolled in (joinedClassrooms) —
    // a MONTHLY class still owes its flat fee even with zero attendance rows this month (e.g.
    // the teacher hasn't taken attendance yet at the start of a new month), so this can't be
    // derived purely from the attendance rows below like it used to be.
    // The 3 queries are independent — run in parallel (1 round trip instead of 3).
    const [attendances, payments, joinedClassrooms] = await Promise.all([
      prisma.attendance.findMany({
        where: { userId, date: { gte: startDate, lt: endDate } },
        include: { classroom: { select: CLASSROOM_FIELDS } },
        orderBy: { date: 'asc' }
      }),
      prisma.tuitionPayment.findMany({
        where: { userId, month: m, year: y }
      }),
      prisma.classroom.findMany({
        where: { students: { some: { id: userId } } },
        select: CLASSROOM_FIELDS
      })
    ]);

    const classroomData = {};
    joinedClassrooms.forEach(classroom => {
      classroomData[classroom.id] = {
        classroom,
        attendances: [],
        presentCount: 0,
        unexcusedCount: 0,
        excusedCount: 0
      };
    });

    attendances.forEach(a => {
      if (!classroomData[a.classroomId]) {
        classroomData[a.classroomId] = {
          classroom: a.classroom,
          attendances: [],
          presentCount: 0,
          unexcusedCount: 0,
          excusedCount: 0
        };
      }
      
      classroomData[a.classroomId].attendances.push(a);
      if (a.status === 'PRESENT') classroomData[a.classroomId].presentCount++;
      if (a.status === 'UNEXCUSED') classroomData[a.classroomId].unexcusedCount++;
      if (a.status === 'EXCUSED') classroomData[a.classroomId].excusedCount++;
    });

    const result = Object.values(classroomData).map(data => {
      const totalAmount = calcTuitionAmount(data.classroom, data.presentCount, m, y);
      const payment = payments.find(p => p.classroomId === data.classroom.id);
      
      return {
        ...data,
        totalAmount,
        paymentStatus: payment?.status || 'UNPAID',
        paidAt: payment?.paidAt || null
      };
    });

    res.json(result);

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
