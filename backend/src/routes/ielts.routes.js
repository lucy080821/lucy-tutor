// Teacher-facing routes for the IELTS Cambridge module: upload a book PDF, trigger AI
// extraction, review/edit the extracted content, and publish a test. See CLAUDE.md's "Module
// IELTS Cambridge" section for the full design. Student-facing take/grade routes live in
// ieltsAttempts.routes.js.
const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const prisma = require('../lib/prisma');
const router = express.Router();
const { extractTextWithPages } = require('../utils/documentParser');
const { runBoundaryExtraction, runFullTestExtraction, runSingleSkillExtraction } = require('../utils/ieltsExtraction');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') return cb(new Error('Chỉ cho phép file PDF'));
    cb(null, true);
  }
});

const uploadAudio = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.mp3', '.m4a', '.wav'].includes(ext)) return cb(new Error('Chỉ cho phép file audio .mp3, .m4a, .wav'));
    cb(null, true);
  }
});

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return cb(new Error('Chỉ cho phép ảnh .jpg, .png, .webp'));
    cb(null, true);
  }
});

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const removeVietnameseAccents = (str) =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const READING_QUESTION_TYPES = [
  'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'YES_NO_NOTGIVEN', 'MATCHING_HEADING',
  'MATCHING_INFORMATION', 'MATCHING_FEATURES', 'SUMMARY_COMPLETION', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'
];

// 1. Teacher uploads a whole book PDF — creates the IeltsBook row and kicks off Pass 1
// (boundary detection) as a fire-and-forget background job, same pattern as
// listening.routes.js's upload -> processAlignment.
router.post('/books', upload.single('pdf'), async (req, res) => {
  try {
    const { title, teacherId } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Thiếu file PDF' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });
    if (!title || !teacherId) return res.status(400).json({ error: 'Thiếu tiêu đề sách hoặc teacherId' });

    const file = req.file;
    const sanitizedName = removeVietnameseAccents(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `ielts-books/${Date.now()}-${sanitizedName}`;

    // Storage upload (network) and PDF text extraction (local CPU) are independent — overlap them
    const [{ error: uploadError }, { text: rawText, pages }] = await Promise.all([
      supabase.storage
        .from('documents')
        .upload(fileName, file.buffer, { contentType: 'application/pdf', upsert: false }),
      extractTextWithPages(file.buffer)
    ]);
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);

    if (!rawText.trim()) return res.status(400).json({ error: 'Không đọc được nội dung chữ từ file PDF này (có thể là bản scan ảnh)' });

    const book = await prisma.ieltsBook.create({
      data: {
        title,
        teacherId,
        sourcePdfUrl: publicUrlData.publicUrl,
        rawText,
        pagesJson: JSON.stringify(pages),
        extractionStatus: 'PENDING'
      },
      // Don't echo the whole book's rawText/pagesJson (MBs) back over the wire
      select: { id: true, title: true, extractionStatus: true }
    });

    res.json({ message: 'Upload thành công, đang phân tích cấu trúc sách', book: { id: book.id, title: book.title, extractionStatus: book.extractionStatus } });

    setTimeout(() => runBoundaryExtraction(book.id), 100);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. List a teacher's uploaded books (+ test count/status summary)
router.get('/books', async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Thiếu teacherId' });

    const books = await prisma.ieltsBook.findMany({
      where: { teacherId },
      select: {
        id: true, title: true, extractionStatus: true, errorMessage: true, createdAt: true,
        tests: { select: { id: true, testNumber: true, title: true, testType: true, status: true, deliveryMode: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(books);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Book detail (debug/manual re-trigger view)
router.get('/books/:id', async (req, res) => {
  try {
    const book = await prisma.ieltsBook.findUnique({
      where: { id: req.params.id },
      include: { tests: { orderBy: { testNumber: 'asc' } } }
    });
    if (!book) return res.status(404).json({ error: 'Không tìm thấy sách' });
    res.json(book);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4. Trigger Pass 2+3 (all 4 skills) for a book's tests that still need extracting.
router.post('/books/:id/extract-tests', async (req, res) => {
  try {
    // Only the status + test ids/statuses are needed — skip the book's multi-MB rawText/pagesJson
    const book = await prisma.ieltsBook.findUnique({
      where: { id: req.params.id },
      select: { id: true, extractionStatus: true, tests: { select: { id: true, status: true } } }
    });
    if (!book) return res.status(404).json({ error: 'Không tìm thấy sách' });
    if (book.extractionStatus !== 'BOUNDARIES_EXTRACTED' && book.extractionStatus !== 'EXTRACTED') {
      return res.status(400).json({ error: 'Sách chưa xác định xong cấu trúc (Pass 1) — vui lòng chờ hoặc thử lại upload' });
    }

    const { testIds } = req.body; // optional: specific test ids, else all pending ones
    const targetTests = book.tests.filter((t) =>
      (!testIds || testIds.includes(t.id)) && (t.status === 'PENDING_EXTRACTION' || t.status === 'NEEDS_ATTENTION')
    );
    if (!targetTests.length) return res.status(400).json({ error: 'Không có đề nào cần trích xuất' });

    res.json({ message: `Đang trích xuất ${targetTests.length} đề (Listening/Reading/Writing/Speaking)`, testIds: targetTests.map((t) => t.id) });

    setTimeout(async () => {
      // Small concurrency cap across tests — each test itself already runs its 4 skills in
      // parallel (see runFullTestExtraction), so this bounds the total number of simultaneous
      // Groq calls for the whole book rather than firing one giant unbounded Promise.all.
      const CONCURRENCY = 3;
      for (let i = 0; i < targetTests.length; i += CONCURRENCY) {
        await Promise.all(targetTests.slice(i, i + CONCURRENCY).map((t) => runFullTestExtraction(t.id)));
      }
      await prisma.ieltsBook.update({ where: { id: book.id }, data: { extractionStatus: 'EXTRACTED' } }).catch(() => {});
    }, 100);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 4b. Re-run exactly one skill's extraction for a single test (the review UI's "🔄 Trích xuất
// lại" buttons) — doesn't touch the other 3 skills' already-reviewed content.
router.post('/tests/:id/extract-skill', async (req, res) => {
  try {
    const { skill } = req.body;
    if (!['READING', 'LISTENING', 'WRITING', 'SPEAKING'].includes(skill)) {
      return res.status(400).json({ error: 'skill không hợp lệ' });
    }
    res.json({ message: `Đang trích xuất lại ${skill}` });
    setTimeout(() => runSingleSkillExtraction(req.params.id, skill), 100);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 5. Full test detail for the teacher's review UI — unredacted (includes correct answers).
router.get('/tests/:id', async (req, res) => {
  try {
    const test = await prisma.ieltsTest.findUnique({
      where: { id: req.params.id },
      include: {
        book: { select: { id: true, title: true } },
        readingPassages: { orderBy: [{ sectionNumber: 'asc' }, { passageIndex: 'asc' }], include: { questions: { orderBy: { questionNumber: 'asc' } } } },
        listeningSections: { orderBy: { sectionNumber: 'asc' }, include: { questions: { orderBy: { questionNumber: 'asc' } } } },
        writingTasks: { orderBy: { taskNumber: 'asc' } },
        speakingParts: { orderBy: { partNumber: 'asc' } },
        assignedStudents: { select: { id: true, name: true, email: true } }
      }
    });
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề' });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 6. Edit test-level config: title, testType (Academic/GT confirm), delivery mode + assignment.
router.patch('/tests/:id', async (req, res) => {
  try {
    const {
      title, testType, deliveryMode,
      libraryClassroomId, libraryStudentId,
      assignedClassroomId, assignedStudentIds, publishTime, deadline, maxAttempts
    } = req.body;

    if (testType !== undefined && testType !== null && !['ACADEMIC', 'GENERAL_TRAINING'].includes(testType)) {
      return res.status(400).json({ error: 'testType không hợp lệ' });
    }
    if (deliveryMode !== undefined && !['LIBRARY', 'ASSIGNED'].includes(deliveryMode)) {
      return res.status(400).json({ error: 'deliveryMode không hợp lệ' });
    }
    if (deliveryMode === 'LIBRARY' && libraryClassroomId && libraryStudentId) {
      return res.status(400).json({ error: 'Chỉ chọn 1 trong 2: lớp học hoặc học sinh' });
    }

    const data = {
      ...(title !== undefined && { title }),
      ...(testType !== undefined && { testType }),
      ...(deliveryMode !== undefined && { deliveryMode }),
      ...(libraryClassroomId !== undefined && { libraryClassroomId: libraryClassroomId || null }),
      ...(libraryStudentId !== undefined && { libraryStudentId: libraryStudentId || null }),
      ...(assignedClassroomId !== undefined && { assignedClassroomId: assignedClassroomId || null }),
      ...(publishTime !== undefined && { publishTime: publishTime || null }),
      ...(deadline !== undefined && { deadline: deadline || null }),
      ...(maxAttempts !== undefined && { maxAttempts: parseInt(maxAttempts) || 1 })
    };
    if (Array.isArray(assignedStudentIds)) {
      data.assignedStudents = { set: assignedStudentIds.map((id) => ({ id })) };
    }

    const test = await prisma.ieltsTest.update({ where: { id: req.params.id }, data });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 7. Edit one question during review (prompt/options/answer/word limit/group instruction).
router.patch('/questions/:id', async (req, res) => {
  try {
    const { type, groupInstruction, promptText, options, correctIndex, correctAnswer, acceptableAnswers, wordLimit, explanation, imageUrl } = req.body;
    if (type !== undefined && !READING_QUESTION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Dạng câu hỏi không hợp lệ' });
    }

    const question = await prisma.ieltsQuestion.update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined && { type }),
        ...(groupInstruction !== undefined && { groupInstruction: groupInstruction || null }),
        ...(promptText !== undefined && { promptText }),
        ...(options !== undefined && { options: options?.length ? JSON.stringify(options) : null }),
        ...(correctIndex !== undefined && { correctIndex: correctIndex === null ? null : parseInt(correctIndex) }),
        ...(correctAnswer !== undefined && { correctAnswer: correctAnswer || null }),
        ...(acceptableAnswers !== undefined && { acceptableAnswers: acceptableAnswers?.length ? JSON.stringify(acceptableAnswers) : null }),
        ...(wordLimit !== undefined && { wordLimit: wordLimit || null }),
        ...(explanation !== undefined && { explanation: explanation || null }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null })
      }
    });
    res.json(question);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8. Edit a reading passage's body/title/image during review (highest-risk field for
// multi-column reordering corruption — always teacher-editable).
router.patch('/reading-passages/:id', async (req, res) => {
  try {
    const { title, bodyText, imageUrl } = req.body;
    const passage = await prisma.ieltsReadingPassage.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(bodyText !== undefined && { bodyText }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null })
      }
    });
    res.json(passage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8b. Edit a listening section's instructions during review.
router.patch('/listening-sections/:id', async (req, res) => {
  try {
    const { instructions } = req.body;
    const section = await prisma.ieltsListeningSection.update({
      where: { id: req.params.id },
      data: { ...(instructions !== undefined && { instructions: instructions || null }) }
    });
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8c. Teacher manually attaches/replaces a Listening section's audio — never auto-detected
// from filename, per the plan's decision. Reuses listening.routes.js's exact upload mechanics
// (multer memoryStorage + Supabase Storage), but skips Whisper alignment entirely: this
// module grades Listening against the book's own answer key, not word-level timestamps, so
// the audio only needs to be stored + playable.
router.post('/listening-sections/:id/audio', uploadAudio.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file audio' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const sanitizedName = removeVietnameseAccents(req.file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `ielts-books/audio/${Date.now()}-${sanitizedName}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);

    const section = await prisma.ieltsListeningSection.update({ where: { id: req.params.id }, data: { audioUrl: publicUrlData.publicUrl } });
    res.json(section);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 8d. Edit a writing task's prompt/word-count/time during review.
router.patch('/writing-tasks/:id', async (req, res) => {
  try {
    const { promptText, minWords, timeMinutes, imageUrl } = req.body;
    const task = await prisma.ieltsWritingTask.update({
      where: { id: req.params.id },
      data: {
        ...(promptText !== undefined && { promptText }),
        ...(minWords !== undefined && { minWords: parseInt(minWords) || 150 }),
        ...(timeMinutes !== undefined && { timeMinutes: parseInt(timeMinutes) || 20 }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl || null })
      }
    });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8e. Teacher manually attaches a Writing Task 1 chart/graph/diagram image (AI extraction can't
// see it, since these are non-text elements pdf-parse can't extract) or a Reading/Listening
// diagram-labeling question's image.
router.post('/writing-tasks/:id/image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const sanitizedName = removeVietnameseAccents(req.file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `ielts-books/images/${Date.now()}-${sanitizedName}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);

    const task = await prisma.ieltsWritingTask.update({ where: { id: req.params.id }, data: { imageUrl: publicUrlData.publicUrl } });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 8f. Same manual image attach, for a diagram/map/plan-labeling question (Reading or Listening).
router.post('/questions/:id/image', uploadImage.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ảnh' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const sanitizedName = removeVietnameseAccents(req.file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `ielts-books/images/${Date.now()}-${sanitizedName}`;
    const { error: uploadError } = await supabase.storage.from('documents').upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
    if (uploadError) throw uploadError;
    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);

    const question = await prisma.ieltsQuestion.update({ where: { id: req.params.id }, data: { imageUrl: publicUrlData.publicUrl } });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 8g. Edit a speaking part's instructions/prompt lines/timing during review.
router.patch('/speaking-parts/:id', async (req, res) => {
  try {
    const { instructions, questions, prepSeconds, speakSeconds } = req.body;
    const part = await prisma.ieltsSpeakingPart.update({
      where: { id: req.params.id },
      data: {
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(questions !== undefined && { questions: JSON.stringify(questions) }),
        ...(prepSeconds !== undefined && { prepSeconds: prepSeconds === null ? null : parseInt(prepSeconds) }),
        ...(speakSeconds !== undefined && { speakSeconds: speakSeconds === null ? null : parseInt(speakSeconds) })
      }
    });
    res.json(part);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9. Publish — server-side gate, not just client-side.
router.post('/tests/:id/publish', async (req, res) => {
  try {
    const test = await prisma.ieltsTest.findUnique({
      where: { id: req.params.id },
      // Only the fields the publish gate checks (was: full rows incl. transcripts/prompt text)
      include: {
        questions: { select: { skill: true, questionNumber: true, correctIndex: true, correctAnswer: true } },
        listeningSections: { select: { audioUrl: true } }
      }
    });
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề' });
    if (!test.testType) return res.status(400).json({ error: 'Vui lòng xác nhận dạng đề (Academic/General Training) trước khi publish' });

    const readingQuestions = test.questions.filter((q) => q.skill === 'READING');
    if (readingQuestions.length) {
      const unmatched = readingQuestions.filter((q) => q.correctIndex === null && !q.correctAnswer);
      if (unmatched.length) {
        return res.status(400).json({ error: `Còn ${unmatched.length} câu Reading chưa khớp đáp án (câu ${unmatched.map((q) => q.questionNumber).join(', ')})` });
      }
    }
    const missingAudio = test.listeningSections.filter((s) => !s.audioUrl);
    if (missingAudio.length) {
      return res.status(400).json({ error: `Còn ${missingAudio.length} phần Listening chưa gắn audio` });
    }

    if (test.deliveryMode === 'LIBRARY' && !test.libraryClassroomId && !test.libraryStudentId) {
      return res.status(400).json({ error: 'Chế độ thư viện cần chọn 1 lớp học hoặc 1 học sinh' });
    }

    const updated = await prisma.ieltsTest.update({ where: { id: req.params.id }, data: { status: 'PUBLISHED' } });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 10. Delete a whole book (cascades to its tests/passages/questions via Prisma schema).
router.delete('/books/:id', async (req, res) => {
  try {
    await prisma.ieltsBook.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xoá sách' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy sách' });
    res.status(400).json({ error: err.message });
  }
});

// 11. Delete one test within a book (e.g. a mis-extracted Test row) without discarding the rest.
router.delete('/tests/:id', async (req, res) => {
  try {
    await prisma.ieltsTest.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xoá đề' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy đề' });
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
