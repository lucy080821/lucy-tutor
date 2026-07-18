const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

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

    const classroomIds = (await prisma.classroom.findMany({
      where: { teacherId },
      select: { id: true }
    })).map(c => c.id);

    const attendances = classroomIds.length ? await prisma.attendance.findMany({
      where: {
        classroomId: { in: classroomIds },
        date: { gte: startDate, lt: endDate }
      },
      select: { classroomId: true, userId: true, date: true, status: true }
    }) : [];

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

    const results = [];

    // Upsert each record — skip entries with no status yet (student not marked in this
    // save), since `status` is a required column and one bad record would otherwise abort
    // the whole batch and report failure even for students that were marked correctly.
    for (const record of records) {
      if (!record.status) continue;
      const attendance = await prisma.attendance.upsert({
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
        }
      });
      results.push(attendance);
    }

    res.json({ message: 'Lưu điểm danh thành công', count: results.length });
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

    const classroom = await prisma.classroom.findUnique({
      where: { id: classroomId },
      include: {
        students: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
    
    const feePerLesson = classroom.feePerLesson || 0;

    const attendances = await prisma.attendance.findMany({
      where: {
        classroomId,
        date: {
          gte: startDate,
          lt: endDate
        }
      }
    });

    // Also fetch any existing payment records
    const payments = await prisma.tuitionPayment.findMany({
      where: { classroomId, month: m, year: y }
    });

    // Calculate per student
    const report = classroom.students.map(student => {
      const studentAttendances = attendances.filter(a => a.userId === student.id);
      
      const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
      const unexcusedCount = studentAttendances.filter(a => a.status === 'UNEXCUSED').length;
      const excusedCount = studentAttendances.filter(a => a.status === 'EXCUSED').length;
      
      // User rule: (Nghỉ là không tính tiền) => totalAmount = presentCount * feePerLesson
      const totalAmount = presentCount * feePerLesson;
      
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
      classroom: { name: classroom.name, feePerLesson },
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

    const classrooms = await prisma.classroom.findMany({
      where: { teacherId },
      select: {
        id: true,
        name: true,
        feePerLesson: true,
        students: { select: { id: true, name: true, email: true } }
      }
    });

    const classroomIds = classrooms.map(c => c.id);

    const attendances = classroomIds.length ? await prisma.attendance.findMany({
      where: {
        classroomId: { in: classroomIds },
        date: { gte: startDate, lt: endDate }
      }
    }) : [];

    const payments = classroomIds.length ? await prisma.tuitionPayment.findMany({
      where: { classroomId: { in: classroomIds }, month: m, year: y }
    }) : [];

    let totalCollected = 0;
    let totalExpected = 0;
    const paidList = [];
    const unpaidList = [];

    for (const classroom of classrooms) {
      const feePerLesson = classroom.feePerLesson || 0;
      for (const student of classroom.students) {
        const studentAttendances = attendances.filter(a => a.classroomId === classroom.id && a.userId === student.id);
        const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
        const totalAmount = presentCount * feePerLesson;
        const payment = payments.find(p => p.classroomId === classroom.id && p.userId === student.id);

        const entry = {
          user: student,
          classroomId: classroom.id,
          classroomName: classroom.name,
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

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        classroom: {
          select: { id: true, name: true, feePerLesson: true }
        }
      },
      orderBy: { date: 'asc' }
    });

    const payments = await prisma.tuitionPayment.findMany({
      where: { userId, month: m, year: y }
    });

    // Group by classroom
    const classroomData = {};
    
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
      const feePerLesson = data.classroom.feePerLesson || 0;
      const totalAmount = data.presentCount * feePerLesson;
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
