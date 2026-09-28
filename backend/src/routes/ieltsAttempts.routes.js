// Student-facing routes for the IELTS Cambridge module: browse available tests, fetch
// student-safe content, submit + grade each of the 4 skills, and view attempt history. See
// CLAUDE.md's "Module IELTS Cambridge" section and ielts.routes.js (teacher-facing
// upload/extraction/review/publish) for the rest of the design.
const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Groq, toFile } = require('groq-sdk');

const prisma = require('../lib/prisma');
const router = express.Router();

const { isIeltsAnswerCorrect } = require('../utils/ieltsAnswerGrading');
const { LISTENING_BAND_TABLE, READING_BAND_TABLE_ACADEMIC, READING_BAND_TABLE_GT, rawScoreToBand } = require('../utils/ieltsBandTables');
const { combineWritingBand, combineSpeakingBand, averageCriteriaBands } = require('../utils/ieltsRounding');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });
const MODEL = GROQ_TEXT_MODEL;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const removeVietnameseAccents = (str) =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const uploadAudio = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.webm', '.mp3', '.m4a', '.wav', '.ogg'].includes(ext)) return cb(new Error('Định dạng ghi âm không hợp lệ'));
    cb(null, true);
  }
});

// ── Access control — shared by every student-facing endpoint below ─────────────────────────

// A student can see a PUBLISHED test if: LIBRARY mode scoped to a classroom they've joined or
// to them specifically, OR ASSIGNED mode where they're in assignedStudents. Mirrors
// ListeningClip's classroom-or-student library scoping + Exam's assignedStudents scoping.
// Visibility filter shared by findAccessibleTest and /available. Classroom membership is
// resolved via a relation filter inside the same query (was: a separate user+classrooms
// lookup first, i.e. extra sequential round trips on every student IELTS request).
function accessibleTestWhere(userId) {
  return {
    status: 'PUBLISHED',
    OR: [
      { deliveryMode: 'LIBRARY', libraryClassroom: { students: { some: { id: userId } } } },
      { deliveryMode: 'LIBRARY', libraryStudentId: userId },
      { deliveryMode: 'ASSIGNED', assignedStudents: { some: { id: userId } } }
    ]
  };
}

async function findAccessibleTest(testId, userId) {
  // Guard: an undefined userId inside a relation filter would mean "no filter" in Prisma.
  if (!userId || !testId) return null;
  const [user, test] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
    prisma.ieltsTest.findFirst({ where: { id: testId, ...accessibleTestWhere(userId) } })
  ]);
  if (!user) return null;
  return test;
}

// LIBRARY = unlimited practice, no deadline. ASSIGNED = bounded by maxAttempts + deadline
// (same semantics as Exam.maxAttempts/deadline via exams.routes.js's canAttempt logic).
function computeCanAttempt(test, attemptsCount) {
  if (test.deliveryMode === 'LIBRARY') return { canAttempt: true, attemptsCount };
  const withinAttempts = attemptsCount < (test.maxAttempts || 1);
  const withinDeadline = !test.deadline || new Date(test.deadline) >= new Date();
  return { canAttempt: withinAttempts && withinDeadline, attemptsCount };
}

// 1. Tests visible to this student, optionally filtered by which skill has content, with
// per-skill attempt/canAttempt info so the picker page can show "Đã làm 1/1 lần" etc.
router.get('/available/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { skill } = req.query;

    // One parallel round: user check, visible tests, and per-test attempt counts for all 4
    // skills via groupBy (was: user -> tests -> 4 counts PER TEST, i.e. 4N extra queries).
    const countBy = (model, extraWhere = {}) => model.groupBy({ by: ['testId'], where: { userId, ...extraWhere }, _count: { _all: true } });
    const [user, tests, lCounts, rCounts, wCounts, sCounts] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
      prisma.ieltsTest.findMany({
        where: accessibleTestWhere(userId),
        include: {
          book: { select: { title: true } },
          _count: { select: { readingPassages: true, listeningSections: true, writingTasks: true, speakingParts: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      countBy(prisma.ieltsListeningAttempt),
      countBy(prisma.ieltsReadingAttempt),
      countBy(prisma.ieltsWritingAttempt),
      countBy(prisma.ieltsSpeakingAttempt, { overallBand: { not: null } })
    ]);
    if (!user) return res.status(404).json({ error: 'Không tìm thấy học viên' });
    const toMap = (rows) => new Map(rows.map((r) => [r.testId, r._count._all]));
    const lMap = toMap(lCounts), rMap = toMap(rCounts), wMap = toMap(wCounts), sMap = toMap(sCounts);

    const out = tests.map((test) => {
      const listeningCount = lMap.get(test.id) || 0;
      const readingCount = rMap.get(test.id) || 0;
      const writingCount = wMap.get(test.id) || 0;
      const speakingCount = sMap.get(test.id) || 0;
      return {
        id: test.id, title: test.title, testType: test.testType, deliveryMode: test.deliveryMode, deadline: test.deadline, maxAttempts: test.maxAttempts,
        bookTitle: test.book.title,
        skills: {
          LISTENING: test._count.listeningSections > 0 ? computeCanAttempt(test, listeningCount) : null,
          READING: test._count.readingPassages > 0 ? computeCanAttempt(test, readingCount) : null,
          WRITING: test._count.writingTasks > 0 ? computeCanAttempt(test, writingCount) : null,
          SPEAKING: test._count.speakingParts > 0 ? computeCanAttempt(test, speakingCount) : null
        }
      };
    });

    res.json(skill ? out.filter((t) => t.skills[skill]) : out);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

// 2. Student-safe Listening content — correctIndex/correctAnswer/acceptableAnswers/explanation
// stripped server-side (not just hidden client-side), same posture as exams.routes.js never
// sending gradingDetails/correctOption to an in-progress attempt.
router.get('/tests/:id/listening', async (req, res) => {
  try {
    const { userId } = req.query;
    // Access check + content fetch concurrently; content is discarded if access is denied.
    const [test, sections] = await Promise.all([
      findAccessibleTest(req.params.id, userId),
      prisma.ieltsListeningSection.findMany({
        where: { testId: req.params.id },
        orderBy: { sectionNumber: 'asc' },
        include: { questions: { orderBy: { questionNumber: 'asc' } } }
      })
    ]);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });
    const safe = sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => ({
        id: q.id, questionNumber: q.questionNumber, type: q.type, groupInstruction: q.groupInstruction,
        promptText: q.promptText, options: q.options ? JSON.parse(q.options) : null, wordLimit: q.wordLimit, imageUrl: q.imageUrl
      }))
    }));
    res.json({ testId: test.id, testType: test.testType, sections: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Student-safe Reading content (same redaction posture as Listening above).
router.get('/tests/:id/reading', async (req, res) => {
  try {
    const { userId } = req.query;
    const [test, passages] = await Promise.all([
      findAccessibleTest(req.params.id, userId),
      prisma.ieltsReadingPassage.findMany({
        where: { testId: req.params.id },
        orderBy: [{ sectionNumber: 'asc' }, { passageIndex: 'asc' }],
        include: { questions: { orderBy: { questionNumber: 'asc' } } }
      })
    ]);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });
    const safe = passages.map((p) => ({
      id: p.id, sectionNumber: p.sectionNumber, passageIndex: p.passageIndex, title: p.title, bodyText: p.bodyText, imageUrl: p.imageUrl,
      questions: p.questions.map((q) => ({
        id: q.id, questionNumber: q.questionNumber, type: q.type, groupInstruction: q.groupInstruction,
        promptText: q.promptText, options: q.options ? JSON.parse(q.options) : null, wordLimit: q.wordLimit, imageUrl: q.imageUrl
      }))
    }));
    res.json({ testId: test.id, testType: test.testType, passages: safe });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Writing tasks — no hidden answer key (open-ended), so full content is safe to return.
router.get('/tests/:id/writing', async (req, res) => {
  try {
    const { userId } = req.query;
    const [test, tasks] = await Promise.all([
      findAccessibleTest(req.params.id, userId),
      prisma.ieltsWritingTask.findMany({ where: { testId: req.params.id }, orderBy: { taskNumber: 'asc' } })
    ]);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });
    res.json({ testId: test.id, testType: test.testType, tasks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Speaking parts — same, no hidden answer key.
router.get('/tests/:id/speaking', async (req, res) => {
  try {
    const { userId } = req.query;
    const [test, parts] = await Promise.all([
      findAccessibleTest(req.params.id, userId),
      prisma.ieltsSpeakingPart.findMany({ where: { testId: req.params.id }, orderBy: { partNumber: 'asc' } })
    ]);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });
    res.json({ testId: test.id, testType: test.testType, parts: parts.map((p) => ({ ...p, questions: JSON.parse(p.questions || '[]') })) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

async function logSkillProgress(userId, skill, score10, source) {
  try {
    await prisma.skillPracticeResult.create({ data: { userId, skill, band: Math.max(0, Math.min(10, score10)), source } });
  } catch (err) {
    console.error('Failed to log IELTS attempt to skill-progress:', err);
  }
}

async function assertCanAttempt(test, model, userId) {
  const attemptsCount = await model.count({ where: { userId, testId: test.id, ...(model === prisma.ieltsSpeakingAttempt ? { overallBand: { not: null } } : {}) } });
  const { canAttempt } = computeCanAttempt(test, attemptsCount);
  if (!canAttempt) throw Object.assign(new Error('Bạn đã hết số lần làm bài hoặc đã quá hạn nộp cho đề này'), { status: 403 });
  return attemptsCount;
}

// 6. Grade + record a Listening attempt (deterministic against the book's own answer key).
router.post('/tests/:id/listening/submit', async (req, res) => {
  try {
    const { userId, answers, timeSpentSec } = req.body;
    const test = await findAccessibleTest(req.params.id, userId);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });

    // Attempt-limit check + answer key fetch concurrently
    const [attemptsCount, questions] = await Promise.all([
      assertCanAttempt(test, prisma.ieltsListeningAttempt, userId),
      prisma.ieltsQuestion.findMany({ where: { testId: test.id, skill: 'LISTENING' }, orderBy: { questionNumber: 'asc' } })
    ]);
    const review = questions.map((q) => ({
      questionNumber: q.questionNumber,
      userAnswer: answers?.[q.questionNumber] ?? null,
      correct: isIeltsAnswerCorrect(q, answers?.[q.questionNumber]),
      correctIndex: q.correctIndex, correctAnswer: q.correctAnswer, options: q.options ? JSON.parse(q.options) : null
    }));
    const rawScore = review.filter((r) => r.correct).length;
    const band = rawScoreToBand(rawScore, LISTENING_BAND_TABLE);

    // Attempt insert + skill-progress log are independent (logSkillProgress never throws)
    const [attempt] = await Promise.all([
      prisma.ieltsListeningAttempt.create({
        data: { userId, testId: test.id, answers: JSON.stringify(answers || {}), rawScore, band, timeSpentSec: timeSpentSec || null, attemptNumber: attemptsCount + 1 }
      }),
      logSkillProgress(userId, 'LISTENING', (band / 9) * 10, 'IELTS_LISTENING')
    ]);
    res.json({ ...attempt, review });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// 7. Grade + record a Reading attempt — band table chosen by test.testType (Academic vs GT
// use different concordance tables, per the plan's decision to support both formats).
router.post('/tests/:id/reading/submit', async (req, res) => {
  try {
    const { userId, answers, timeSpentSec } = req.body;
    const test = await findAccessibleTest(req.params.id, userId);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });

    // Attempt-limit check + answer key fetch concurrently
    const [attemptsCount, questions] = await Promise.all([
      assertCanAttempt(test, prisma.ieltsReadingAttempt, userId),
      prisma.ieltsQuestion.findMany({ where: { testId: test.id, skill: 'READING' }, orderBy: { questionNumber: 'asc' } })
    ]);
    const review = questions.map((q) => ({
      questionNumber: q.questionNumber,
      userAnswer: answers?.[q.questionNumber] ?? null,
      correct: isIeltsAnswerCorrect(q, answers?.[q.questionNumber]),
      correctIndex: q.correctIndex, correctAnswer: q.correctAnswer, options: q.options ? JSON.parse(q.options) : null
    }));
    const rawScore = review.filter((r) => r.correct).length;
    const table = test.testType === 'GENERAL_TRAINING' ? READING_BAND_TABLE_GT : READING_BAND_TABLE_ACADEMIC;
    const band = rawScoreToBand(rawScore, table);

    // Attempt insert + skill-progress log are independent (logSkillProgress never throws)
    const [attempt] = await Promise.all([
      prisma.ieltsReadingAttempt.create({
        data: { userId, testId: test.id, answers: JSON.stringify(answers || {}), rawScore, band, timeSpentSec: timeSpentSec || null, attemptNumber: attemptsCount + 1 }
      }),
      logSkillProgress(userId, 'READING', (band / 9) * 10, 'IELTS_READING')
    ]);
    res.json({ ...attempt, review });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

// ── Writing — AI-graded against the real official IELTS Writing criteria ───────────────────

const WRITING_RUBRIC = `Chấm theo đúng 4 tiêu chí chính thức của IELTS Writing, mỗi tiêu chí cho band 0-9 (có thể lẻ .5):
1. "${'{CRITERION_1}'}" — Task 1: mức độ hoàn thành yêu cầu đề bài (đủ ý, đúng định dạng, có tổng quan/so sánh nếu là dạng biểu đồ). Task 2: mức độ trả lời đầy đủ các phần của đề bài, quan điểm rõ ràng, ý phát triển đầy đủ.
2. Coherence and Cohesion (Mạch lạc & Liên kết) — tổ chức thông tin logic, sử dụng từ nối hợp lý, chia đoạn rõ ràng.
3. Lexical Resource (Vốn từ vựng) — độ đa dạng từ vựng, dùng từ chính xác, ít lỗi chính tả/chọn từ.
4. Grammatical Range and Accuracy (Ngữ pháp) — độ đa dạng cấu trúc câu, độ chính xác ngữ pháp, câu phức có kiểm soát.

Band cao (8-9): rất ít lỗi, ý tưởng phát triển đầy đủ, từ vựng/ngữ pháp linh hoạt tự nhiên.
Band trung (6-7): đáp ứng được yêu cầu chính, một số lỗi nhưng không cản trở việc hiểu, từ vựng/ngữ pháp đa dạng ở mức độ nhất định.
Band thấp (4-5): chỉ đáp ứng phần nào yêu cầu, lỗi lặp lại gây khó hiểu, vốn từ/ngữ pháp hạn chế.
Band rất thấp (≤3): không đáp ứng yêu cầu đề bài hoặc quá ngắn/lạc đề, lỗi tràn lan.`;

async function gradeWritingTask(taskNumber, promptText, essay, level) {
  const criterion1 = taskNumber === 1 ? 'Task Achievement (Hoàn thành yêu cầu đề — Task 1)' : 'Task Response (Trả lời đề bài — Task 2)';
  const rubric = WRITING_RUBRIC.replace('{CRITERION_1}', criterion1);
  const prompt = `Bạn là giám khảo IELTS Writing đang chấm điểm Task ${taskNumber}.

Đề bài: "${promptText}"

Bài làm của học viên:
"""
${essay}
"""

${rubric}

Trả về JSON:
{
  "taskAchievement": { "band": <số 0-9, có thể .5>, "comment": "Nhận xét cụ thể tiếng Việt, trích dẫn câu học viên viết để minh chứng" },
  "coherenceCohesion": { "band": <số>, "comment": "..." },
  "lexicalResource": { "band": <số>, "comment": "..." },
  "grammaticalRangeAccuracy": { "band": <số>, "comment": "..." },
  "taskBand": <trung bình 4 band trên, làm tròn tới 0.5 gần nhất>
}
(Field đầu luôn tên "taskAchievement" dù là Task 1 hay Task 2, chỉ nội dung nhận xét đổi theo đúng tiêu chí "${criterion1}")`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an official IELTS Writing examiner. Respond only in valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    parsed = { taskAchievement: { band: 0, comment: 'Không thể chấm bài này lúc này, vui lòng thử lại.' }, coherenceCohesion: { band: 0, comment: '' }, lexicalResource: { band: 0, comment: '' }, grammaticalRangeAccuracy: { band: 0, comment: '' }, taskBand: 0 };
  }
  const bands = [parsed.taskAchievement?.band, parsed.coherenceCohesion?.band, parsed.lexicalResource?.band, parsed.grammaticalRangeAccuracy?.band];
  parsed.taskBand = averageCriteriaBands(bands);
  return parsed;
}

// 8. Grade + record a Writing attempt — 2 parallel Groq calls (Task 1, Task 2), combined per
// the official 1/3 + 2/3 weighting, rounded per the official half-band rule.
router.post('/tests/:id/writing/submit', async (req, res) => {
  try {
    const { userId, task1Text, task2Text } = req.body;
    if (!task1Text?.trim() || !task2Text?.trim()) return res.status(400).json({ error: 'Vui lòng hoàn thành cả 2 Task trước khi nộp' });

    const test = await findAccessibleTest(req.params.id, userId);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });

    const [attemptsCount, tasks] = await Promise.all([
      assertCanAttempt(test, prisma.ieltsWritingAttempt, userId),
      prisma.ieltsWritingTask.findMany({ where: { testId: test.id }, orderBy: { taskNumber: 'asc' } })
    ]);
    const task1 = tasks.find((t) => t.taskNumber === 1);
    const task2 = tasks.find((t) => t.taskNumber === 2);
    if (!task1 || !task2) return res.status(400).json({ error: 'Đề này chưa có đủ Task 1 và Task 2' });

    const [feedback1, feedback2] = await Promise.all([
      gradeWritingTask(1, task1.promptText, task1Text),
      gradeWritingTask(2, task2.promptText, task2Text)
    ]);
    const overallBand = combineWritingBand(feedback1.taskBand, feedback2.taskBand);

    const [attempt] = await Promise.all([
      prisma.ieltsWritingAttempt.create({
        data: {
          userId, testId: test.id,
          task1Text, task1Feedback: JSON.stringify(feedback1),
          task2Text, task2Feedback: JSON.stringify(feedback2),
          overallBand, attemptNumber: attemptsCount + 1
        }
      }),
      logSkillProgress(userId, 'WRITING', (overallBand / 9) * 10, 'IELTS_WRITING')
    ]);
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Không thể chấm bài Writing lúc này' });
  }
});

// ── Speaking — record → transcribe → AI-grade against the real official Speaking criteria ──

const SPEAKING_RUBRIC = `Chấm theo đúng 4 tiêu chí chính thức của IELTS Speaking, mỗi tiêu chí cho band 0-9 (có thể lẻ .5):
1. Fluency and Coherence (Trôi chảy & Mạch lạc) — tốc độ nói tự nhiên, ít ngập ngừng/lặp lại, ý phát triển đầy đủ và liên kết logic.
2. Lexical Resource (Vốn từ vựng) — độ đa dạng từ vựng, khả năng diễn giải (paraphrase) khi thiếu từ.
3. Grammatical Range and Accuracy (Ngữ pháp) — độ đa dạng cấu trúc câu, độ chính xác ngữ pháp khi nói.
4. Pronunciation (Phát âm) — CHỈ SUY ĐOÁN qua văn bản chuyển giọng nói (transcript), KHÔNG phải phân tích âm thanh thật — luôn ghi rõ trong "comment" rằng đây là ước lượng dựa trên nhận dạng giọng nói tự động (ASR), không phải chấm âm vị học chính xác.

Band cao (8-9): nói trôi chảy tự nhiên, từ vựng/ngữ pháp linh hoạt, hầu như không có lỗi.
Band trung (6-7): duy trì được mạch nói, một số ngập ngừng/lỗi nhưng không cản trở giao tiếp.
Band thấp (4-5): nói ngắt quãng nhiều, từ vựng/ngữ pháp hạn chế, lỗi lặp lại.
Band rất thấp (≤3): rất khó duy trì hội thoại, vốn từ/ngữ pháp rất hạn chế.`;

async function gradeSpeakingPart(partNumber, questions, transcript) {
  const prompt = `Bạn là giám khảo IELTS Speaking đang chấm điểm Part ${partNumber}.

Câu hỏi/chủ đề của phần này: ${JSON.stringify(questions)}

Văn bản chuyển giọng nói (transcript) câu trả lời của học viên:
"""
${transcript || '(không có nội dung — có thể học viên không nói gì hoặc ghi âm lỗi)'}
"""

${SPEAKING_RUBRIC}

Trả về JSON:
{
  "fluencyCoherence": { "band": <số 0-9, có thể .5>, "comment": "Nhận xét cụ thể tiếng Việt" },
  "lexicalResource": { "band": <số>, "comment": "..." },
  "grammaticalRangeAccuracy": { "band": <số>, "comment": "..." },
  "pronunciation": { "band": <số>, "comment": "Nhận xét + PHẢI nhắc rõ đây là ước lượng qua nhận dạng giọng nói tự động (ASR), không phải phân tích âm vị học chính xác" },
  "overallBand": <trung bình 4 band trên, làm tròn tới 0.5 gần nhất>
}`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: 'You are an official IELTS Speaking examiner. Respond only in valid JSON.' },
      { role: 'user', content: prompt }
    ],
    model: MODEL,
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  let parsed;
  try { parsed = JSON.parse(raw); } catch {
    parsed = { fluencyCoherence: { band: 0, comment: '' }, lexicalResource: { band: 0, comment: '' }, grammaticalRangeAccuracy: { band: 0, comment: '' }, pronunciation: { band: 0, comment: 'Không thể chấm lúc này.' }, overallBand: 0 };
  }
  const ASR_DISCLAIMER = ' (Lưu ý: điểm Phát âm chỉ là ước lượng dựa trên nhận dạng giọng nói tự động — ASR — không phải phân tích âm vị học chính xác.)';
  if (parsed.pronunciation && !String(parsed.pronunciation.comment || '').includes('ASR')) {
    parsed.pronunciation.comment = (parsed.pronunciation.comment || '') + ASR_DISCLAIMER;
  }
  parsed.overallBand = averageCriteriaBands([parsed.fluencyCoherence?.band, parsed.lexicalResource?.band, parsed.grammaticalRangeAccuracy?.band, parsed.pronunciation?.band]);
  return parsed;
}

// 9. Submit exactly one Speaking part's recording — grades that part immediately, and finds
// (or starts) the "in-progress" attempt for this test: the most recent IeltsSpeakingAttempt
// with overallBand still null. Once all 3 parts are filled, overallBand is computed and the
// attempt is considered complete — a further part submission then starts a brand-new attempt
// rather than overwriting the completed one (a full retake, not a partial edit).
router.post('/tests/:id/speaking/submit-part', uploadAudio.single('audio'), async (req, res) => {
  try {
    const { userId, partNumber } = req.body;
    const partNum = parseInt(partNumber);
    if (![1, 2, 3].includes(partNum)) return res.status(400).json({ error: 'partNumber phải là 1, 2 hoặc 3' });
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ghi âm' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const test = await findAccessibleTest(req.params.id, userId);
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề hoặc bạn không có quyền truy cập' });

    // Part lookup + in-progress attempt lookup are independent
    let [part, attempt] = await Promise.all([
      prisma.ieltsSpeakingPart.findFirst({ where: { testId: test.id, partNumber: partNum } }),
      prisma.ieltsSpeakingAttempt.findFirst({
        where: { userId, testId: test.id, overallBand: null },
        orderBy: { createdAt: 'desc' }
      })
    ]);
    if (!part) return res.status(400).json({ error: `Đề này chưa có Speaking Part ${partNum}` });
    if (!attempt) {
      // Starting mid-way (part 2/3 with no in-progress attempt) still works — creates a fresh
      // attempt missing the earlier part(s), which stays incomplete (no overallBand) until the
      // student submits those too. Not blocked, just won't complete without all 3.
      // assertCanAttempt runs the exact same count (completed attempts) — reuse its result
      const priorCount = await assertCanAttempt(test, prisma.ieltsSpeakingAttempt, userId);
      attempt = await prisma.ieltsSpeakingAttempt.create({ data: { userId, testId: test.id, attemptNumber: priorCount + 1 } });
    }

    const sanitizedName = removeVietnameseAccents(req.file.originalname || `part${partNum}.webm`).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `ielts-speaking/${Date.now()}-${sanitizedName}`;
    // Storage upload and Whisper transcription both only need the in-memory buffer — run them
    // concurrently instead of upload-then-transcribe.
    const [{ error: uploadError }, transcription] = await Promise.all([
      supabase.storage.from('documents').upload(fileName, req.file.buffer, { contentType: req.file.mimetype || 'audio/webm', upsert: false }),
      toFile(req.file.buffer, sanitizedName, { type: req.file.mimetype || 'audio/webm' })
        .then((whisperFile) => groq.audio.transcriptions.create({ file: whisperFile, model: 'whisper-large-v3', response_format: 'json' }))
    ]);
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);
    const audioUrl = publicUrlData.publicUrl;
    const transcript = transcription.text || '';

    const questions = JSON.parse(part.questions || '[]');
    const feedback = await gradeSpeakingPart(partNum, questions, transcript);

    const updateData = {
      [`part${partNum}AudioUrl`]: audioUrl,
      [`part${partNum}Transcript`]: transcript,
      [`part${partNum}Feedback`]: JSON.stringify(feedback)
    };

    const merged = { ...attempt, ...updateData };
    const allPartsDone = merged.part1Feedback && merged.part2Feedback && merged.part3Feedback;
    if (allPartsDone) {
      const bandOf = (f) => (typeof f === 'string' ? JSON.parse(f).overallBand : f?.overallBand) || 0;
      updateData.overallBand = combineSpeakingBand(bandOf(merged.part1Feedback), bandOf(merged.part2Feedback), bandOf(merged.part3Feedback));
    }

    const updated = await prisma.ieltsSpeakingAttempt.update({ where: { id: attempt.id }, data: updateData });
    if (updated.overallBand !== null) {
      await logSkillProgress(userId, 'SPEAKING', (updated.overallBand / 9) * 10, 'IELTS_SPEAKING');
    }
    res.json({ attempt: updated, partFeedback: feedback });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message || 'Không thể chấm phần Speaking này lúc này' });
  }
});

// ── History ──────────────────────────────────────────────────────────────────────────────

router.get('/attempts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { skill } = req.query;
    const testInclude = { test: { select: { id: true, title: true, testType: true, book: { select: { title: true } } } } };

    const [listening, reading, writing, speaking] = await Promise.all([
      (!skill || skill === 'LISTENING') ? prisma.ieltsListeningAttempt.findMany({ where: { userId }, include: testInclude, orderBy: { practicedAt: 'desc' } }) : [],
      (!skill || skill === 'READING') ? prisma.ieltsReadingAttempt.findMany({ where: { userId }, include: testInclude, orderBy: { practicedAt: 'desc' } }) : [],
      (!skill || skill === 'WRITING') ? prisma.ieltsWritingAttempt.findMany({ where: { userId }, include: testInclude, orderBy: { practicedAt: 'desc' } }) : [],
      (!skill || skill === 'SPEAKING') ? prisma.ieltsSpeakingAttempt.findMany({ where: { userId, overallBand: { not: null } }, include: testInclude, orderBy: { practicedAt: 'desc' } }) : []
    ]);

    const shape = (rows, sk) => rows.map((r) => ({ id: r.id, skill: sk, band: r.band ?? r.overallBand, practicedAt: r.practicedAt, test: r.test }));
    const all = [...shape(listening, 'LISTENING'), ...shape(reading, 'READING'), ...shape(writing, 'WRITING'), ...shape(speaking, 'SPEAKING')]
      .sort((a, b) => new Date(b.practicedAt) - new Date(a.practicedAt));
    res.json(all);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

const ATTEMPT_MODELS = {
  LISTENING: () => prisma.ieltsListeningAttempt,
  READING: () => prisma.ieltsReadingAttempt,
  WRITING: () => prisma.ieltsWritingAttempt,
  SPEAKING: () => prisma.ieltsSpeakingAttempt
};

router.get('/attempts/:skill/:id', async (req, res) => {
  try {
    const modelFn = ATTEMPT_MODELS[req.params.skill];
    if (!modelFn) return res.status(400).json({ error: 'skill không hợp lệ' });
    const attempt = await modelFn().findUnique({
      where: { id: req.params.id },
      include: { test: { include: { book: { select: { title: true } } } } }
    });
    if (!attempt) return res.status(404).json({ error: 'Không tìm thấy lần làm bài này' });
    res.json(attempt);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
