const express = require('express');
const prisma = require('../lib/prisma');
const router = express.Router();
const { parseVNDateTime: parseVNTime } = require('../utils/vnTime');

const CALENDAR_CLASSROOM_SELECT = {
  id: true, name: true, scheduleDays: true, startTime: true, endTime: true,
  classSessions: true
};
const CALENDAR_EXAM_SELECT = { id: true, title: true, deadline: true };

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
      // Classrooms and exams are independent — fetch in parallel. Only the fields the
      // calendar actually renders are selected (exams: id/title/deadline).
      const [classrooms, teacherExams] = await Promise.all([
        prisma.classroom.findMany({
          where: { teacherId: userId },
          select: CALENDAR_CLASSROOM_SELECT
        }),
        prisma.exam.findMany({
          where: { uploadedById: userId },
          select: CALENDAR_EXAM_SELECT
        })
      ]);
      exams = teacherExams;
      classSessions = classrooms.flatMap(c => {
        const sessions = [...c.classSessions];
        if (c.scheduleDays && c.startTime && c.endTime) {
          try {
            const days = JSON.parse(c.scheduleDays);
            if (days.length > 0) {
              sessions.push({
                id: `virtual-${c.id}`,
                title: `${c.name}`,
                classroomId: c.id,
                startTime: new Date(`2024-01-01T${c.startTime}:00+07:00`),
                endTime: new Date(`2024-01-01T${c.endTime}:00+07:00`),
                recurrenceRule: JSON.stringify(days), // pass days array
                isVirtual: true
              });
            }
          } catch (e) {}
        }
        return sessions;
      });
    } else {
      // Student sees sessions of classrooms they joined
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          classroomsJoined: { select: CALENDAR_CLASSROOM_SELECT },
          assignedExams: { select: CALENDAR_EXAM_SELECT }
        }
      });
      if (user) {
        classSessions = user.classroomsJoined.flatMap(c => {
          const sessions = [...c.classSessions];
          if (c.scheduleDays && c.startTime && c.endTime) {
            try {
              const days = JSON.parse(c.scheduleDays);
              if (days.length > 0) {
                sessions.push({
                  id: `virtual-${c.id}`,
                  title: `${c.name}`,
                  classroomId: c.id,
                  startTime: new Date(`2024-01-01T${c.startTime}:00+07:00`),
                  endTime: new Date(`2024-01-01T${c.endTime}:00+07:00`),
                  recurrenceRule: JSON.stringify(days),
                  isVirtual: true
                });
              }
            } catch (e) {}
          }
          return sessions;
        });
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
        startTime: parseVNTime(startTime),
        endTime: parseVNTime(endTime),
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
    if (startTime) data.startTime = parseVNTime(startTime);
    if (endTime) data.endTime = parseVNTime(endTime);
    
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
