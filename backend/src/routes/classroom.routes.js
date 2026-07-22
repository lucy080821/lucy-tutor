const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;
const DEFAULT_STUDENT_PASSWORD = '123456';

// Teacher creates a classroom
router.post('/create', async (req, res) => {
  try {
    const { name, teacherId, scheduleDays, startTime, endTime, feeType, feePerLesson, feePerMonth } = req.body;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"

    const classroom = await prisma.classroom.create({
      data: {
        name,
        teacherId,
        joinCode,
        scheduleDays: scheduleDays || null,
        startTime: startTime || null,
        endTime: endTime || null,
        feeType: feeType === 'MONTHLY' ? 'MONTHLY' : 'PER_LESSON',
        feePerLesson: feePerLesson ? parseInt(feePerLesson) : 0,
        feePerMonth: feePerMonth ? parseInt(feePerMonth) : 0
      }
    });
    res.json(classroom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Student joins a classroom
router.post('/join', async (req, res) => {
  try {
    const { userId, joinCode } = req.body;
    
    const classroom = await prisma.classroom.findUnique({ where: { joinCode } });
    if (!classroom) return res.status(404).json({ error: 'Mã lớp không hợp lệ' });
    
    // Joining a classroom hands tuition tracking over to that classroom's own attendance-based
    // billing — a free-standing student's trial/monthly lock (if any) no longer applies.
    const user = await prisma.user.update({
      where: { id: userId },
      data: { classroomsJoined: { connect: { id: classroom.id } }, accessExpiresAt: null }
    });
    
    res.json({ message: 'Joined classroom successfully', classroom });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Teacher manually creates a student account (default password, changeable later) and
// enrolls it into one or more of their own classrooms in one step — for students who
// join in person rather than signing up themselves with a join code.
router.post('/add-student', async (req, res) => {
  try {
    const { name, email, phone, classroomIds, teacherId } = req.body;
    if (!name || !email || !teacherId) {
      return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
    }
    if (!Array.isArray(classroomIds) || classroomIds.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 lớp học' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được sử dụng. Vui lòng chọn email khác.' });
    }

    // Only enroll into classrooms this teacher actually owns — prevents a crafted request
    // from enrolling a manually-added student into another teacher's class.
    const ownedClassrooms = await prisma.classroom.findMany({
      where: { id: { in: classroomIds }, teacherId },
      select: { id: true }
    });
    if (ownedClassrooms.length !== classroomIds.length) {
      return res.status(400).json({ error: 'Một hoặc nhiều lớp học không hợp lệ' });
    }

    const student = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, BCRYPT_ROUNDS),
        role: 'STUDENT',
        classroomsJoined: { connect: classroomIds.map((id) => ({ id })) }
      }
    });

    res.json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get classrooms for a teacher
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId: req.params.teacherId },
      include: {
        students: {
          select: {
            id: true, name: true, email: true, avatar: true, totalXP: true, targetScore: true, createdAt: true,
            // Only examId+score are ever read (average-score calculations) — the student's
            // own avatar is already carried once at this level, so no need to duplicate it.
            examResults: { select: { score: true, examId: true } }
          }
        },
        exams: {
          select: {
            id: true, title: true, totalQuestions: true, duration: true, maxAttempts: true,
            deadline: true, examType: true, notes: true, createdAt: true, classroomId: true,
            // No nested `user` here — it was re-embedding each student's full base64 avatar
            // once per exam result (unused by the frontend, which reads student avatars from
            // the `students` list above), ballooning this endpoint's payload by tens of MB.
            results: {
              select: { score: true, userId: true, createdAt: true, timeSpent: true }
            }
          }
        }
      }
    });
    res.json(classrooms);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Edit a classroom
router.put('/edit/:id', async (req, res) => {
  try {
    const { name, scheduleDays, startTime, endTime, feeType, feePerLesson, feePerMonth } = req.body;
    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data: {
        name,
        scheduleDays: scheduleDays || null,
        startTime: startTime || null,
        endTime: endTime || null,
        ...(feeType !== undefined && { feeType: feeType === 'MONTHLY' ? 'MONTHLY' : 'PER_LESSON' }),
        ...(feePerLesson !== undefined && { feePerLesson: parseInt(feePerLesson) }),
        ...(feePerMonth !== undefined && { feePerMonth: parseInt(feePerMonth) })
      }
    });
    res.json(classroom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update enabled features for a classroom
router.patch('/:id/features', async (req, res) => {
  try {
    const { enabledFeatures } = req.body; // array of feature keys
    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data: { enabledFeatures: JSON.stringify(enabledFeatures || []) }
    });
    res.json(classroom);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a classroom
router.delete('/:id', async (req, res) => {
  try {
    await prisma.classroom.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa lớp học thành công' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy lớp học' });
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
