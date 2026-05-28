const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// GET /api/calendar/events?userId=xyz&role=STUDENT|TEACHER
router.get('/events', async (req, res) => {
  try {
    const { userId, role } = req.query;
    if (!userId || !role) {
      return res.status(400).json({ error: 'Missing userId or role' });
    }

    let classSessions = [];
    let exams = [];

    if (role === 'TEACHER') {
      // Teacher sees sessions of classrooms they own
      const classrooms = await prisma.classroom.findMany({
        where: { teacherId: userId },
        include: { classSessions: true }
      });
      classSessions = classrooms.flatMap(c => c.classSessions);
      
      // Teacher sees exams they uploaded
      exams = await prisma.exam.findMany({
        where: { uploadedById: userId }
      });
    } else {
      // Student sees sessions of classrooms they joined
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          classroomsJoined: {
            include: { classSessions: true }
          },
          assignedExams: true
        }
      });
      if (user) {
        classSessions = user.classroomsJoined.flatMap(c => c.classSessions);
        exams = user.assignedExams;
      }
    }

    res.json({ classSessions, exams });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calendar/sessions
router.post('/sessions', async (req, res) => {
  try {
    const { classroomId, title, startTime, endTime, recurrenceRule, location } = req.body;
    const session = await prisma.classSession.create({
      data: {
        classroomId,
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        recurrenceRule,
        location
      },
      include: { classroom: true }
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/calendar/sessions/:id
router.put('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, startTime, endTime, recurrenceRule, location } = req.body;
    const data = { title, recurrenceRule, location };
    if (startTime) data.startTime = new Date(startTime);
    if (endTime) data.endTime = new Date(endTime);
    
    const session = await prisma.classSession.update({
      where: { id },
      data,
      include: { classroom: true }
    });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/calendar/sessions/:id
router.delete('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.classSession.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
