const express = require('express');
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const prisma = require('../lib/prisma');
const router = express.Router();
const { parseVNDateTime } = require('../utils/vnTime');

// Create exam manually with questions
router.post('/create', async (req, res) => {
  try {
    const {
      title, examType, classroomId, assignMode, studentIds,
      duration, publishTime, deadline, notes, maxAttempts, questions = [], uploadedById
    } = req.body;

    // Resolve target students
    let targetStudentIds = [];
    if (assignMode === 'STUDENT' && studentIds?.length) {
      targetStudentIds = studentIds.map((id) => ({ id }));
    } else if (classroomId) {
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId }, select: { students: { select: { id: true } } }
      });
      if (classroom?.students) {
        targetStudentIds = classroom.students.map(s => ({ id: s.id }));
      }
    }

    // Question ids are generated here (schema default is uuid()) so every question + its
    // ExamQuestion link can be inserted with 2 createMany calls instead of 2 sequential
    // round trips per question (~340ms each on the Supabase pooler).
    const questionRows = questions.map((q) => ({
      id: crypto.randomUUID(),
      heading: q.heading || null,
      content: q.content || '',
      type: q.type || 'MULTIPLE_CHOICE',
      difficulty: 'Medium',
      options: q.options || '[]',
      correctOption: q.correctOption || '',
      explanation: q.explanation || '',
      imageUrl: q.imageUrl || null,
      points: q.points !== undefined ? parseFloat(q.points) : 1.0,
    }));

    // Create the exam and its questions in parallel (questions have no FK to exam)
    const [exam] = await Promise.all([
      prisma.exam.create({
        data: {
          title: title || 'Đề Thi Không Tên',
          examType: examType || 'ASSIGNMENT',
          classroomId: classroomId || null,
          uploadedById: uploadedById || null,
          duration: parseInt(duration) || 45,
          totalQuestions: questions.length,
          publishTime: parseVNDateTime(publishTime),
          deadline: parseVNDateTime(deadline),
          notes: notes || null,
          maxAttempts: maxAttempts !== undefined ? parseInt(maxAttempts) : 1,
          assignedStudents: { connect: targetStudentIds }
        }
      }),
      questionRows.length ? prisma.question.createMany({ data: questionRows }) : null,
    ]);

    // Link questions to exam
    if (questionRows.length) {
      await prisma.examQuestion.createMany({
        data: questionRows.map((q, i) => ({ examId: exam.id, questionId: q.id, order: i + 1 }))
      });
    }

    res.json(exam);
  } catch (error) {
    console.error('CREATE exam error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Log cheat live
router.post('/cheat', async (req, res) => {
  try {
    const { userId, examId, cheatCount, isAutoSubmitted } = req.body;
    if (!userId || !examId) return res.status(400).json({ error: 'Missing userId or examId' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    const log = await prisma.cheatLog.upsert({
      where: { userId_examId: { userId, examId } },
      update: {
        cheatCount: cheatCount ?? 1,
        isAutoSubmitted: isAutoSubmitted || false,
        updatedAt: new Date()
      },
      create: {
        userId,
        examId,
        cheatCount: cheatCount ?? 1,
        isAutoSubmitted: isAutoSubmitted || false
      }
    });
    res.json({ log, userId });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get cheat logs for a teacher
router.get('/cheat-logs/:teacherId', async (req, res) => {
  try {
    const logs = await prisma.cheatLog.findMany({
      where: {
        OR: [
          { exam: { classroom: { teacherId: req.params.teacherId } } },
          { exam: { uploadedById: req.params.teacherId } }
        ]
      },
      select: {
        id: true,
        cheatCount: true,
        isAutoSubmitted: true,
        createdAt: true,
        updatedAt: true,
        // No `avatar` here — a user with cheat logs across several exams would otherwise get
        // their full base64 avatar re-embedded once per log row, the exact anti-pattern already
        // fixed in classroom.routes.js's teacher-classrooms endpoint. The frontend already has
        // every real user's avatar exactly once via the STUDENTS list; it looks it up from there.
        user: { select: { id: true, name: true, email: true } },
        exam: {
          select: {
            id: true,
            title: true,
            classroom: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(logs);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get an exam with its questions
router.get('/:id', async (req, res) => {
  try {
    const userId = req.query.userId;
    // Exam + this user's past attempts are independent — fetch concurrently
    const [exam, pastResults] = await Promise.all([prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        // Was `true` = full User rows (password hash + base64 avatar per student); FE only reads `.id`
        assignedStudents: { select: { id: true, name: true, email: true } },
        // No `results` here — this returns every student's answers/score/gradingDetails/
        // cheatLogs for the exam to anyone who can call this route with just the exam id, and
        // nothing in the frontend actually reads `exam.results` from this endpoint (canAttempt
        // below is computed from a separately-scoped, per-requesting-user query instead).
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' }
        }
      }
    }),
      userId
        ? prisma.examResult.findMany({ where: { examId: req.params.id, userId: userId }, select: { score: true } })
        : []
    ]);
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    let canAttempt = true;
    let attemptsCount = 0;
    if (userId) {
      attemptsCount = pastResults.length;
      const hasPerfectScore = pastResults.some(r => r.score >= 10);
      if (attemptsCount >= exam.maxAttempts || hasPerfectScore) {
        canAttempt = false;
      }
    }

    res.json({ ...exam, canAttempt, attemptsCount });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit exam results
router.post('/submit', async (req, res) => {
  try {
    const { userId, examId, selectedAnswers, timeSpent, cheatLogs } = req.body;

    if (!userId || !examId) {
      return res.status(400).json({ error: 'Thiếu userId hoặc examId' });
    }

    // User check + exam fetch are independent — run them concurrently
    const [user, exam] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.exam.findUnique({
        where: { id: examId },
        include: { questions: { include: { question: true } } }
      }),
    ]);
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không hợp lệ. Vui lòng đăng nhập lại.' });
    }

    if (!exam) {
      return res.status(404).json({ error: 'Không tìm thấy đề thi. Vui lòng tải lại trang.' });
    }
    
    let earnedPoints = 0;
    let totalPossiblePoints = 0;
    const mistakeData = [];
    const gradingDetails = [];
    
    exam.questions.forEach(eq => {
      const q = eq.question;
      const userAnswer = selectedAnswers[q.id];
      const qPoints = q.points !== undefined ? parseFloat(q.points) : 1.0;

      if (q.type === 'MULTIPLE_CHOICE') {
        totalPossiblePoints += qPoints;
        if (userAnswer === q.correctOption) {
          earnedPoints += qPoints;
        } else if (userAnswer) {
          mistakeData.push({ userId, questionId: q.id });
        }
      } else if (q.type === 'ESSAY') {
        // Only grade if teacher provided a correct answer (not the default empty/"a" value)
        const rawCorrectOpt = q.correctOption ? q.correctOption.trim() : '';
        const hasCorrectAnswer = rawCorrectOpt && rawCorrectOpt.toLowerCase() !== 'a';

        if (hasCorrectAnswer) {
          totalPossiblePoints += qPoints;
          const cleanAnswer = (userAnswer || '').trim().toLowerCase();
          const isCorrect = !!userAnswer && cleanAnswer === rawCorrectOpt.toLowerCase();
          if (isCorrect) {
            earnedPoints += qPoints;
            gradingDetails.push({
              questionId: q.id,
              pointsEarned: qPoints,
              maxPoints: qPoints,
              feedback: 'Chính xác!'
            });
          } else {
            gradingDetails.push({
              questionId: q.id,
              pointsEarned: 0,
              maxPoints: qPoints,
              feedback: `Chưa chính xác. Đáp án đúng: "${rawCorrectOpt}".`
            });
            mistakeData.push({ userId, questionId: q.id });
          }
        } else if (userAnswer) {
          // No correct answer provided by teacher and there's no manual-grading workflow in
          // this app — exclude from both earnedPoints and totalPossiblePoints so this câu tự
          // luận never counts against the student's score (previously counted as wrong forever).
          gradingDetails.push({
            questionId: q.id,
            pointsEarned: null,
            maxPoints: qPoints,
            feedback: 'Câu này không có đáp án chấm tự động, không tính vào điểm.'
          });
        }
      }
    });
    
    const score = totalPossiblePoints > 0 ? (earnedPoints / totalPossiblePoints) * 10 : 0;

    // Save Result
    let result;
    try {
      result = await prisma.examResult.create({
      data: {
        userId,
        examId,
        selectedAnswers: JSON.stringify(selectedAnswers),
        score,
        timeSpent,
        gradingDetails: JSON.stringify(gradingDetails),
        cheatLogs: cheatLogs ? JSON.stringify(cheatLogs) : null
      }
      });
    } catch (err) {
      // Prisma foreign key error code P2003 indicates a missing related record
      if (err && (err.code === 'P2003' || (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'))) {
        return res.status(400).json({ error: 'Ràng buộc khóa ngoại bị vi phạm - có thể user hoặc exam không tồn tại' });
      }
      throw err;
    }
    
    // Use logged-in userId for subsequent operations
    const effectiveUserId = userId;

    // Update Mistake Bank (upsert)
    const effectiveMistakes = mistakeData.map(m => ({ ...m, userId: effectiveUserId }));
    // Update User XP based on score
    let baseXP = Math.round(score * 10);
    let bonusXP = 0;
    let penaltyXP = 0;
    const examDurationSec = (exam.duration || 60) * 60;
    
    if (timeSpent <= examDurationSec * 0.75 && score >= 8.0) {
      const timeSavedMin = Math.floor((examDurationSec - timeSpent) / 60);
      bonusXP = Math.min(30, timeSavedMin);
    }
    
    if (timeSpent < examDurationSec * 0.5 && score < 5.0) {
      penaltyXP = 10;
    }
    
    const multiplier = (exam.examType === 'EXAM' || exam.examType === 'PLACEMENT') ? 2 : 1;
    const earnedXP = Math.max(0, (baseXP + bonusXP - penaltyXP) * multiplier);

    // Mistake Bank upsert (one bulk INSERT ... ON CONFLICT instead of 1 upsert per wrong
    // question), XP increment and attempts count are independent — run concurrently.
    // attemptsCount runs after examResult.create above, so it still includes this attempt.
    const mistakeUpsert = effectiveMistakes.length
      ? prisma.$executeRaw`
          INSERT INTO "MistakeBank" ("userId", "questionId", "wrongAnswerCount")
          VALUES ${Prisma.join(effectiveMistakes.map(m => Prisma.sql`(${m.userId}, ${m.questionId}, 1)`))}
          ON CONFLICT ("userId", "questionId")
          DO UPDATE SET "wrongAnswerCount" = "MistakeBank"."wrongAnswerCount" + 1`
      : null;
    const [, , attemptsCount] = await Promise.all([
      mistakeUpsert,
      prisma.user.update({
        where: { id: effectiveUserId },
        data: { totalXP: { increment: earnedXP } },
        select: { id: true }
      }),
      prisma.examResult.count({ where: { examId, userId: effectiveUserId } }),
    ]);

    // Start AI processing for mistakes in the background
    if (mistakeData.length > 0) {
      setTimeout(async () => {
        try {
          // Process at most 3 mistakes at a time to prevent rate limits and long queues
          const topMistakes = mistakeData.slice(0, 3);
          for (const mistake of topMistakes) {
            const eq = exam.questions.find(eq => eq.questionId === mistake.questionId);
            if (!eq) continue;
            const q = eq.question;
              const payload = {
              questionContent: q.content,
              options: JSON.parse(q.options || '[]'),
              studentAnswer: selectedAnswers[q.id],
              correctAnswer: q.correctOption,
              userId: effectiveUserId
            };
            
            const port = process.env.PORT || 5000;
            await fetch(`http://127.0.0.1:${port}/api/ai/explain`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
          }
        } catch (err) {
          console.error("Background AI Notebook update failed:", err);
        }
      }, 100);
    }

    // Return attempts count and effective user id so frontend can refresh state
    res.json({ result, earnedXP, attemptsCount, userId: effectiveUserId });
  } catch (error) {
    console.error("Submit exam error:", error.message, error.stack);
    res.status(400).json({ error: error.message });
  }
});

// Update an exam
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, examType, duration, publishTime, deadline, notes } = req.body;

    const exam = await prisma.exam.update({
      where: { id },
      data: {
        title,
        examType,
        duration: duration ? parseInt(duration) : undefined,
        publishTime: parseVNDateTime(publishTime),
        deadline: parseVNDateTime(deadline),
        notes
      }
    });
    
    res.json(exam);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete an exam (with manual cascade for SQLite FK constraints)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 1-3. Delete results, exam-question links and disconnect assigned students (independent)
    await Promise.all([
      prisma.examResult.deleteMany({ where: { examId: id } }),
      prisma.examQuestion.deleteMany({ where: { examId: id } }),
      prisma.exam.update({
        where: { id },
        data: { assignedStudents: { set: [] } },
        select: { id: true }
      }),
    ]);

    // 4. Finally delete the exam
    await prisma.exam.delete({ where: { id } });

    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('DELETE exam error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
