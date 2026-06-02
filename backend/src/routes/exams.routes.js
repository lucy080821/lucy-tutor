const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Groq } = require('groq-sdk');
const prisma = new PrismaClient();
const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' 
});
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
          imageUrl: q.imageUrl || null,
          points: q.points !== undefined ? parseFloat(q.points) : 1.0,
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
      const pastResults = await prisma.examResult.findMany({
        where: { examId: req.params.id, userId: userId }
      });
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
    const { userId, examId, selectedAnswers, timeSpent } = req.body;
    
    // Fetch exam questions to calculate score
    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: { questions: { include: { question: true } } }
    });
    
    let earnedPoints = 0;
    let totalPossiblePoints = 0;
    const mistakeData = [];
    const essayPromises = [];
    const gradingDetails = [];
    
    exam.questions.forEach(eq => {
      const q = eq.question;
      const userAnswer = selectedAnswers[q.id];
      const qPoints = q.points !== undefined ? parseFloat(q.points) : 1.0;
      totalPossiblePoints += qPoints;
      
      if (q.type === 'MULTIPLE_CHOICE') {
        if (userAnswer === q.correctOption) {
          earnedPoints += qPoints;
        } else if (userAnswer) {
          mistakeData.push({ userId, questionId: q.id });
        }
      } else if (q.type === 'ESSAY' && userAnswer) {
        if (!q.correctOption || q.correctOption.trim() === '') {
          // AI Grades if teacher left it blank
          const prompt = `
Bạn là một giáo viên Tiếng Anh đang chấm bài tự luận của học sinh.
Câu hỏi: "${q.content}"
Học sinh trả lời: "${userAnswer}"

Hãy đánh giá câu trả lời của học sinh dựa trên ngữ nghĩa và ngữ pháp. 
Trả về ĐÚNG MỘT JSON với định dạng sau (KHÔNG CÓ markdown code blocks bọc ngoài):
{
  "scoreRatio": 0.8, // Tỉ lệ điểm học sinh đạt được (từ 0.0 đến 1.0)
  "feedback": "Nhận xét chi tiết cho học sinh..."
}
`;
          const gradingPromise = groq.chat.completions.create({
            messages: [
              { role: 'system', content: 'You must respond in valid JSON format.' },
              { role: 'user', content: prompt }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.1,
            response_format: { type: "json_object" }
          }).then(res => {
            let aiResult = { scoreRatio: 0, feedback: 'Lỗi chấm điểm.' };
            try {
              aiResult = JSON.parse(res.choices[0]?.message?.content || '{}');
            } catch (e) {}
            
            const finalRatio = Math.max(0, Math.min(1, parseFloat(aiResult.scoreRatio) || 0));
            const scoreForThis = qPoints * finalRatio;
            
            return {
              questionId: q.id,
              pointsEarned: scoreForThis,
              maxPoints: qPoints,
              feedback: aiResult.feedback
            };
          }).catch(err => {
            console.error("AI grading failed:", err);
            return { questionId: q.id, pointsEarned: 0, maxPoints: qPoints, feedback: 'AI không thể chấm câu này.' };
          });
          
          essayPromises.push(gradingPromise);
        } else {
          // Teacher provided an exact answer, so AI does not grade it automatically.
          // It checks for exact match or leaves it for manual grading (score=0 for now)
          if (userAnswer.trim().toLowerCase() === q.correctOption.trim().toLowerCase()) {
            earnedPoints += qPoints;
            gradingDetails.push({
              questionId: q.id,
              pointsEarned: qPoints,
              maxPoints: qPoints,
              feedback: 'Chính xác! (Chấm tự động theo đáp án của giáo viên)'
            });
          } else {
            gradingDetails.push({
              questionId: q.id,
              pointsEarned: 0,
              maxPoints: qPoints,
              feedback: 'Chưa chính xác hoặc cần giáo viên chấm thủ công.'
            });
            mistakeData.push({ userId, questionId: q.id });
          }
        }
      }
    });
    
    // Wait for all AI grading to complete
    if (essayPromises.length > 0) {
      const essayResults = await Promise.all(essayPromises);
      essayResults.forEach(res => {
        earnedPoints += res.pointsEarned;
        gradingDetails.push(res);
      });
    }
    
    const score = totalPossiblePoints > 0 ? (earnedPoints / totalPossiblePoints) * 10 : 0;
    
    // Save Result
    const result = await prisma.examResult.create({
      data: {
        userId,
        examId,
        selectedAnswers: JSON.stringify(selectedAnswers),
        score,
        timeSpent,
        gradingDetails: JSON.stringify(gradingDetails)
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
