const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const crypto = require('crypto');

// Teacher creates a classroom
router.post('/create', async (req, res) => {
  try {
    const { name, teacherId, scheduleDays, startTime, endTime, feePerLesson } = req.body;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
    
    const classroom = await prisma.classroom.create({
      data: {
        name,
        teacherId,
        joinCode,
        scheduleDays: scheduleDays || null,
        startTime: startTime || null,
        endTime: endTime || null,
        feePerLesson: feePerLesson ? parseInt(feePerLesson) : 0
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
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { classroomsJoined: { connect: { id: classroom.id } } }
    });
    
    res.json({ message: 'Joined classroom successfully', classroom });
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
            id: true, name: true, email: true, avatar: true, totalXP: true, targetScore: true,
            examResults: { select: { id: true, score: true, examId: true, createdAt: true } }
          }
        },
        exams: {
          select: {
            id: true, title: true, totalQuestions: true, duration: true, maxAttempts: true,
            deadline: true, examType: true, notes: true, createdAt: true,
            results: {
              select: {
                id: true, score: true, userId: true, createdAt: true, timeSpent: true,
                user: { select: { id: true, name: true, avatar: true } }
              }
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
    const { name, scheduleDays, startTime, endTime, feePerLesson } = req.body;
    const classroom = await prisma.classroom.update({
      where: { id: req.params.id },
      data: {
        name,
        scheduleDays: scheduleDays || null,
        startTime: startTime || null,
        endTime: endTime || null,
        ...(feePerLesson !== undefined && { feePerLesson: parseInt(feePerLesson) })
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
