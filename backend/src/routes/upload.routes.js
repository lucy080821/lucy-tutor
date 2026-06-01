const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const parser = require('../utils/documentParser');

const prisma = new PrismaClient();
const router = express.Router();

// Configure multer for memory storage (used for exams)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const path = require('path');
const fs = require('fs');

const diskStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const uploadDisk = multer({ storage: diskStorage });

router.post('/image', uploadDisk.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.get('host');
  const API_URL = process.env.API_URL || `${protocol}://${host}`;
  const imageUrl = `${API_URL}/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

router.post('/exam', upload.fields([
  { name: 'examFile', maxCount: 1 },
  { name: 'answerFile', maxCount: 1 }
]), async (req, res) => {
  try {
    const { title, duration, teacherId, classroomId, examType, grade, publishTime, deadline, notes } = req.body;
    
    if (!req.files || !req.files['examFile']) {
      return res.status(400).json({ error: 'Missing examFile' });
    }

    const examFile = req.files['examFile'][0];
    const answerFile = req.files['answerFile'] ? req.files['answerFile'][0] : null;

    // Extract raw text
    const examText = await parser.extractTextFromFile(examFile.buffer, examFile.mimetype);
    let answerData = {};
    if (answerFile) {
      const answerText = await parser.extractTextFromFile(answerFile.buffer, answerFile.mimetype);
      answerData = parser.parseAnswerText(answerText);
    }

    // Parse text
    const examQuestions = parser.parseExamText(examText);

    // Combine
    const finalQuestions = parser.combineExamAndAnswers(examQuestions, answerData);

    const { assignMode, studentIds } = req.body;
    let targetStudentIds = [];
    if (assignMode === 'STUDENT' && studentIds) {
      const ids = Array.isArray(studentIds) ? studentIds : studentIds.split(',');
      targetStudentIds = ids.map(id => ({ id: id.trim() }));
    } else {
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        include: { students: true }
      });
      if (classroom && classroom.students) {
        targetStudentIds = classroom.students.map(s => ({ id: s.id }));
      }
    }

    // Create Exam
    const exam = await prisma.exam.create({
      data: {
        title: title || 'Đề thi mới',
        duration: duration ? parseInt(duration) : 45,
        totalQuestions: finalQuestions.length,
        uploadedById: teacherId || null,
        classroomId: classroomId || null,
        examType: examType || 'ASSIGNMENT',
        grade: grade ? parseInt(grade) : null,
        publishTime: publishTime ? new Date(publishTime) : null,
        deadline: deadline ? new Date(deadline) : null,
        notes: notes || null,
        assignedStudents: {
          connect: targetStudentIds
        }
      }
    });

    // Create Questions & Connect to Exam
    for (let i = 0; i < finalQuestions.length; i++) {
      const qData = finalQuestions[i];
      const createdQuestion = await prisma.question.create({ data: qData });
      
      await prisma.examQuestion.create({
        data: {
          examId: exam.id,
          questionId: createdQuestion.id,
          order: i + 1
        }
      });
    }

    res.json({ message: 'Upload successful', examId: exam.id, totalParsed: finalQuestions.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
