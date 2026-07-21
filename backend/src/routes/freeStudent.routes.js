const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { addOneMonth, computeAccessStatus } = require('../utils/freeTrial');

// List free-standing students managed by a teacher (students with no classroom yet).
// A student who later joins a classroom drops off this list — their tuition is tracked
// by that classroom's own Attendance/TuitionPayment flow instead.
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        managerTeacherId: req.params.teacherId,
        classroomsJoined: { none: {} }
      },
      select: {
        id: true, name: true, email: true, phone: true, avatar: true, createdAt: true, accessExpiresAt: true,
        freeStudentPaymentsMade: { orderBy: { paidAt: 'desc' }, take: 1, select: { amount: true, paidAt: true } }
      },
      orderBy: { accessExpiresAt: 'asc' }
    });

    const enriched = students.map(s => ({ ...s, ...computeAccessStatus({ ...s, role: 'STUDENT', classroomsJoined: [] }) }));
    res.json(enriched);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Teacher confirms a free-standing student has paid — renews access for exactly 1 month
// from now (mirrors attendance.routes.js's /pay upsert, but there's no classroom/attendance
// to derive the amount from here, so the teacher types it in each time).
router.post('/confirm-payment', async (req, res) => {
  try {
    const { studentId, teacherId, amount } = req.body;
    if (!studentId || !teacherId || amount === undefined) {
      return res.status(400).json({ error: 'Thiếu thông tin xác nhận thanh toán.' });
    }

    const student = await prisma.user.findUnique({ where: { id: studentId } });
    if (!student || student.role !== 'STUDENT') {
      return res.status(404).json({ error: 'Không tìm thấy học viên.' });
    }
    if (student.managerTeacherId !== teacherId) {
      return res.status(403).json({ error: 'Bạn không phải giáo viên phụ trách học viên này.' });
    }

    const paidAt = new Date();
    const periodEnd = addOneMonth(paidAt);

    const [payment] = await prisma.$transaction([
      prisma.freeStudentPayment.create({
        data: { userId: studentId, teacherId, amount: parseInt(amount), paidAt, periodEnd }
      }),
      prisma.user.update({ where: { id: studentId }, data: { accessExpiresAt: periodEnd } })
    ]);

    res.json({ payment, accessExpiresAt: periodEnd });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Payment history for one free-standing student (teacher-facing transparency).
router.get('/payments/:studentId', async (req, res) => {
  try {
    const payments = await prisma.freeStudentPayment.findMany({
      where: { userId: req.params.studentId },
      orderBy: { paidAt: 'desc' }
    });
    res.json(payments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
