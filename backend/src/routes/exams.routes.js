const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
// Create exam manually with questions
router.post('/create', async (req, res) => {
  try {
    const {
      title, examType, classroomId, assignMode, studentIds,
      duration, publishTime, deadline, notes, maxAttempts, questions = []
    } = req.body;

    // Resolve target students
    let targetStudentIds = [];
    if (assignMode === 'STUDENT' && studentIds?.length) {
      targetStudentIds = studentIds.map((id) => ({ id }));
    } else {
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId }, include: { students: true }
      });
      if (classroom?.students) {
        targetStudentIds = classroom.students.map(s => ({ id: s.id }));
      }
    }

    // Create the exam
    const exam = await prisma.exam.create({
      data: {
        title: title || 'Đề Thi Không Tên',
        examType: examType || 'ASSIGNMENT',
        classroomId: classroomId || null,
        duration: parseInt(duration) || 45,
        totalQuestions: questions.length,
        publishTime: publishTime ? new Date(publishTime) : null,
        deadline: deadline ? new Date(deadline) : null,
        notes: notes || null,
        maxAttempts: maxAttempts !== undefined ? parseInt(maxAttempts) : 1,
        assignedStudents: { connect: targetStudentIds }
      }
    });

    // Create questions and link to exam
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const question = await prisma.question.create({
        data: {
          heading: q.heading || null,
          content: q.content || '',
          type: q.type || 'MULTIPLE_CHOICE',
          difficulty: 'Medium',
          options: q.options || '[]',
          correctOption: q.correctOption || '',
          explanation: q.explanation || '',
        }
      });
      await prisma.examQuestion.create({
        data: { examId: exam.id, questionId: question.id, order: i + 1 }
      });
    }

    res.json(exam);
  } catch (error) {
    console.error('CREATE exam error:', error);
    res.status(400).json({ error: error.message });
  }
});


// Get an exam with its questions
router.get('/:id', async (req, res) => {
  try {
    const exam = await prisma.exam.findUnique({
      where: { id: req.params.id },
      include: {
        assignedStudents: true,
        results: true,
        questions: {
          include: { question: true },
          orderBy: { order: 'asc' }
        }
      }
    });
    if (!exam) return res.status(404).json({ error: 'Exam not found' });

    let canAttempt = true;
    let attemptsCount = 0;
    const userId = req.query.userId;
    if (userId) {
      attemptsCount = await prisma.examResult.count({
        where: { examId: req.params.id, userId: userId }
      });
      if (attemptsCount >= exam.maxAttempts) {
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
    const { userId, examId, selectedAnswers, timeSpent } = req.body;
    
    // Fetch exam questions to calculate score
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { question: true } } }
    });
    
    let correctCount = 0;
    const mistakeData = [];
    
    exam.questions.forEach(eq => {
      const q = eq.question;
      const userAnswer = selectedAnswers[q.id];
      if (userAnswer === q.correctOption) {
        correctCount++;
      } else if (userAnswer) {
        // Record mistake if wrong answer was provided
        mistakeData.push({
          userId,
          questionId: q.id,
        });
      }
    });
    
    const score = (correctCount / exam.totalQuestions) * 10; // Scale to 10
    
    // Save Result
    const result = await prisma.examResult.create({
      data: {
        userId,
        examId,
        selectedAnswers: JSON.stringify(selectedAnswers),
        score,
        timeSpent
      }
    });
    
    // Update Mistake Bank (upsert)
    for (const mistake of mistakeData) {
      await prisma.mistakeBank.upsert({
        where: { userId_questionId: { userId: mistake.userId, questionId: mistake.questionId } },
        update: { wrongAnswerCount: { increment: 1 } },
        create: { userId: mistake.userId, questionId: mistake.questionId, wrongAnswerCount: 1 }
      });
    }
    
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

    await prisma.user.update({
      where: { id: userId },
      data: { totalXP: { increment: earnedXP } }
    });

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
              userId: userId
            };
            
            await fetch(`http://localhost:5000/api/ai/explain`, {
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

    res.json({ result, earnedXP });
  } catch (error) {
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
        publishTime: publishTime ? new Date(publishTime) : null,
        deadline: deadline ? new Date(deadline) : null,
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

    // 1. Delete exam results
    await prisma.examResult.deleteMany({ where: { examId: id } });

    // 2. Delete exam questions
    await prisma.examQuestion.deleteMany({ where: { examId: id } });

    // 3. Disconnect assigned students (many-to-many)
    await prisma.exam.update({
      where: { id },
      data: { assignedStudents: { set: [] } }
    });

    // 4. Finally delete the exam
    await prisma.exam.delete({ where: { id } });

    res.json({ message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('DELETE exam error:', error);
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
