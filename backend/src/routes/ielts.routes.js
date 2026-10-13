// Teacher-facing routes for the IELTS module: giáo viên tự soạn đề bằng tay (bộ đề → đề → nội dung
// 4 kỹ năng + đáp án), gắn audio/ảnh, giao đề và publish. AI không còn trích xuất từ sách PDF — chỉ
// chấm bài và làm bước "Học đề" (ieltsAttempts.routes.js / ieltsStudy.routes.js). Xem CLAUDE.md mục
// "Module IELTS".
const express = require('express');
const multer = require('multer');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const prisma = require('../lib/prisma');
const router = express.Router();
const { parseOptions } = require('../utils/ieltsAnswerGrading');

const storage = multer.memoryStorage();

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

// Tải 1 file (audio/ảnh) lên Supabase Storage bucket "documents" → trả về URL công khai
async function uploadToStorage(file, folder) {
  if (!file) throw Object.assign(new Error('Thiếu file'), { status: 400 });
  if (!supabase) throw new Error('Supabase credentials not configured in backend');
  const sanitizedName = removeVietnameseAccents(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileName = `${folder}/${Date.now()}-${sanitizedName}`;
  const { error } = await supabase.storage.from('documents').upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw error;
  return supabase.storage.from('documents').getPublicUrl(fileName).data.publicUrl;
}

const FILL_QUESTION_TYPES = ['FILL_BLANK', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'];
const DEFAULT_GROUP_OPTIONS = { TRUE_FALSE: ['TRUE', 'FALSE', 'NOT GIVEN'], YES_NO_NOTGIVEN: ['YES', 'NO', 'NOT GIVEN'] };

const READING_QUESTION_TYPES = [
  'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'YES_NO_NOTGIVEN', 'MATCHING_HEADING',
  'MATCHING_INFORMATION', 'MATCHING_FEATURES', 'SUMMARY_COMPLETION', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'
];

// 1. Tạo "bộ đề" (IeltsBook) — chỉ là thư mục gom các đề giáo viên tự nhập tay (vd "Cambridge 18",
// "Đề luyện tháng 11"). Không còn upload PDF / AI trích xuất: các cột sourcePdfUrl/rawText bắt buộc
// của schema để trống, extractionStatus = 'MANUAL'. Bộ đề cũ (trích xuất từ PDF) vẫn dùng bình thường.
router.post('/books', async (req, res) => {
  try {
    const { title, teacherId } = req.body;
    if (!title?.trim() || !teacherId) return res.status(400).json({ error: 'Thiếu tên bộ đề hoặc teacherId' });
    const book = await prisma.ieltsBook.create({
      data: { title: title.trim(), teacherId, sourcePdfUrl: '', rawText: '', extractionStatus: 'MANUAL' },
      select: { id: true, title: true, extractionStatus: true, createdAt: true }
    });
    res.json({ ...book, tests: [] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 1b. Đổi tên bộ đề
router.patch('/books/:id', async (req, res) => {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Tên bộ đề không được để trống' });
    const book = await prisma.ieltsBook.update({ where: { id: req.params.id }, data: { title: title.trim() }, select: { id: true, title: true } });
    res.json(book);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
    res.status(400).json({ error: err.message });
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
        tests: {
          select: {
            id: true, testNumber: true, title: true, testType: true, status: true, deliveryMode: true,
            // Số Passage/Part/Task theo từng kỹ năng — danh sách bộ đề hiện 4 chấm L/R/W/S.
            _count: { select: { listeningSections: true, readingPassages: true, writingTasks: true, speakingParts: true, classrooms: true, assignedStudents: true } }
          },
          orderBy: { testNumber: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(books);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Thêm 1 đề trống vào bộ đề — số thứ tự tự tăng; giáo viên nhập nội dung 4 kỹ năng ở trang soạn đề.
router.post('/books/:id/tests', async (req, res) => {
  try {
    const book = await prisma.ieltsBook.findUnique({ where: { id: req.params.id }, select: { id: true, tests: { select: { testNumber: true } } } });
    if (!book) return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
    const testNumber = book.tests.reduce((m, t) => Math.max(m, t.testNumber), 0) + 1;
    const { title, testType } = req.body || {};
    const test = await prisma.ieltsTest.create({
      data: {
        bookId: book.id, testNumber, title: title?.trim() || `Test ${testNumber}`, status: 'DRAFT',
        testType: ['ACADEMIC', 'GENERAL_TRAINING'].includes(testType) ? testType : 'ACADEMIC'
      },
      select: { id: true, testNumber: true, title: true }
    });
    res.json(test);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Soạn nội dung thủ công: thêm / xoá Passage, Part, Task, câu hỏi ──

const QUESTION_INCLUDE = { orderBy: { questionNumber: 'asc' } };

// Đánh số lại câu hỏi 1..n của 1 kỹ năng theo thứ tự Passage/Part rồi số cũ — gọi sau mỗi lần
// thêm/xoá câu hoặc Passage/Part để số câu luôn liền mạch như đề thật. 2 câu lệnh trong 1
// transaction (đổi sang số âm trước rồi mới gán số mới) để không vướng ràng buộc
// @@unique([testId, skill, questionNumber]) khi 2 câu đổi chỗ cho nhau.
async function renumberQuestions(testId, skill) {
  const qs = await prisma.ieltsQuestion.findMany({
    where: { testId, skill },
    select: {
      id: true, questionNumber: true,
      readingPassage: { select: { sectionNumber: true, passageIndex: true } },
      listeningSection: { select: { sectionNumber: true } }
    }
  });
  const key = (q) => q.readingPassage
    ? q.readingPassage.sectionNumber * 100 + q.readingPassage.passageIndex
    : (q.listeningSection?.sectionNumber || 0) * 100;
  qs.sort((a, b) => key(a) - key(b) || a.questionNumber - b.questionNumber);
  if (!qs.some((q, i) => q.questionNumber !== i + 1)) return;
  const values = qs.map((q, i) => `('${q.id}', ${i + 1})`).join(',');
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`UPDATE "IeltsQuestion" SET "questionNumber" = -"questionNumber" - 1 WHERE "testId" = $1 AND "skill" = $2`, testId, skill),
    prisma.$executeRawUnsafe(`UPDATE "IeltsQuestion" AS q SET "questionNumber" = v.n FROM (VALUES ${values}) AS v(id, n) WHERE q.id = v.id`)
  ]);
}

function loadContainerWithQuestions(skill, id) {
  return skill === 'READING'
    ? prisma.ieltsReadingPassage.findUnique({ where: { id }, include: { questions: QUESTION_INCLUDE } })
    : prisma.ieltsListeningSection.findUnique({ where: { id }, include: { questions: QUESTION_INCLUDE } });
}

// Thêm Passage (Reading) — sectionNumber kế tiếp
router.post('/tests/:id/reading-passages', async (req, res) => {
  try {
    const last = await prisma.ieltsReadingPassage.findFirst({ where: { testId: req.params.id }, orderBy: [{ sectionNumber: 'desc' }, { passageIndex: 'desc' }], select: { sectionNumber: true } });
    const passage = await prisma.ieltsReadingPassage.create({
      data: { testId: req.params.id, sectionNumber: (last?.sectionNumber || 0) + 1, passageIndex: 1, bodyText: '' },
      include: { questions: QUESTION_INCLUDE }
    });
    res.json(passage);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/reading-passages/:id', async (req, res) => {
  try {
    const p = await prisma.ieltsReadingPassage.delete({ where: { id: req.params.id }, select: { testId: true } });
    await renumberQuestions(p.testId, 'READING');
    res.json({ message: 'Đã xoá bài đọc' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy bài đọc' });
    res.status(400).json({ error: err.message });
  }
});

// Thêm Part (Listening) — sectionNumber kế tiếp
router.post('/tests/:id/listening-sections', async (req, res) => {
  try {
    const last = await prisma.ieltsListeningSection.findFirst({ where: { testId: req.params.id }, orderBy: { sectionNumber: 'desc' }, select: { sectionNumber: true } });
    const section = await prisma.ieltsListeningSection.create({
      data: { testId: req.params.id, sectionNumber: (last?.sectionNumber || 0) + 1 },
      include: { questions: QUESTION_INCLUDE }
    });
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/listening-sections/:id', async (req, res) => {
  try {
    const s = await prisma.ieltsListeningSection.delete({ where: { id: req.params.id }, select: { testId: true } });
    await renumberQuestions(s.testId, 'LISTENING');
    res.json({ message: 'Đã xoá Part' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy Part' });
    res.status(400).json({ error: err.message });
  }
});

// Tạo Writing Task 1/2 (mặc định 150 từ/20 phút, 250 từ/40 phút)
router.post('/tests/:id/writing-tasks', async (req, res) => {
  try {
    const taskNumber = parseInt(req.body?.taskNumber);
    if (![1, 2].includes(taskNumber)) return res.status(400).json({ error: 'taskNumber phải là 1 hoặc 2' });
    const task = await prisma.ieltsWritingTask.create({
      data: { testId: req.params.id, taskNumber, promptText: '', minWords: taskNumber === 1 ? 150 : 250, timeMinutes: taskNumber === 1 ? 20 : 40 }
    });
    res.json(task);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Task này đã tồn tại' });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/writing-tasks/:id', async (req, res) => {
  try {
    await prisma.ieltsWritingTask.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xoá Task' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy Task' });
    res.status(400).json({ error: err.message });
  }
});

// Tạo Speaking Part 1/2/3 (Part 2: 60s chuẩn bị + 120s nói)
router.post('/tests/:id/speaking-parts', async (req, res) => {
  try {
    const partNumber = parseInt(req.body?.partNumber);
    if (![1, 2, 3].includes(partNumber)) return res.status(400).json({ error: 'partNumber phải là 1, 2 hoặc 3' });
    const part = await prisma.ieltsSpeakingPart.create({
      data: { testId: req.params.id, partNumber, questions: '[]', prepSeconds: partNumber === 2 ? 60 : null, speakSeconds: partNumber === 2 ? 120 : null }
    });
    res.json({ ...part, questions: [] });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Part này đã tồn tại' });
    res.status(400).json({ error: err.message });
  }
});

router.delete('/speaking-parts/:id', async (req, res) => {
  try {
    await prisma.ieltsSpeakingPart.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xoá Part' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy Part' });
    res.status(400).json({ error: err.message });
  }
});

// Thêm 1 nhóm câu hỏi (vd "Questions 1-6, TRUE/FALSE/NOT GIVEN") vào 1 Passage/Part: tạo `count`
// câu trống cùng dạng + hướng dẫn + danh sách lựa chọn. True/False/Not Given và Yes/No/Not Given tự
// có sẵn 3 lựa chọn. Trả về Passage/Part kèm toàn bộ câu hỏi đã đánh số lại.
router.post('/question-groups', async (req, res) => {
  try {
    const { readingPassageId, listeningSectionId, type, count, groupInstruction, options, wordLimit, insertAfter } = req.body;
    if (!!readingPassageId === !!listeningSectionId) return res.status(400).json({ error: 'Chọn đúng 1 bài đọc hoặc 1 Part Listening' });
    if (!READING_QUESTION_TYPES.includes(type)) return res.status(400).json({ error: 'Dạng câu hỏi không hợp lệ' });
    const n = Math.max(1, Math.min(40, parseInt(count) || 1));
    const skill = readingPassageId ? 'READING' : 'LISTENING';
    const container = readingPassageId
      ? await prisma.ieltsReadingPassage.findUnique({ where: { id: readingPassageId }, select: { testId: true } })
      : await prisma.ieltsListeningSection.findUnique({ where: { id: listeningSectionId }, select: { testId: true } });
    if (!container) return res.status(404).json({ error: 'Không tìm thấy bài đọc / Part' });

    const cleanOptions = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    const opts = cleanOptions.length ? cleanOptions : DEFAULT_GROUP_OPTIONS[type] || null;

    // insertAfter = số câu đứng ngay trước nhóm mới (thêm câu vào giữa đề) → dời các câu phía sau
    // xuống n số (qua số âm để không vướng ràng buộc unique); không có thì thêm vào cuối kỹ năng.
    let start;
    const after = parseInt(insertAfter);
    if (Number.isInteger(after) && after >= 0) {
      await prisma.$transaction([
        prisma.$executeRawUnsafe(`UPDATE "IeltsQuestion" SET "questionNumber" = -("questionNumber" + $3) WHERE "testId" = $1 AND "skill" = $2 AND "questionNumber" > $4`, container.testId, skill, n, after),
        prisma.$executeRawUnsafe(`UPDATE "IeltsQuestion" SET "questionNumber" = -"questionNumber" WHERE "testId" = $1 AND "skill" = $2 AND "questionNumber" < 0`, container.testId, skill)
      ]);
      start = after + 1;
    } else {
      const max = await prisma.ieltsQuestion.aggregate({ where: { testId: container.testId, skill }, _max: { questionNumber: true } });
      start = (max._max.questionNumber || 0) + 1;
    }
    await prisma.ieltsQuestion.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        testId: container.testId, skill, questionNumber: start + i, type,
        readingPassageId: readingPassageId || null, listeningSectionId: listeningSectionId || null,
        groupInstruction: groupInstruction?.trim() || null, promptText: '',
        options: opts ? JSON.stringify(opts) : null, wordLimit: wordLimit?.trim() || null
      }))
    });
    await renumberQuestions(container.testId, skill);
    res.json(await loadContainerWithQuestions(skill, readingPassageId || listeningSectionId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Sửa chung cả nhóm câu (hướng dẫn, dạng, danh sách lựa chọn, giới hạn từ) — áp dụng cho mọi id gửi lên
router.patch('/questions-bulk', async (req, res) => {
  try {
    const { ids, groupInstruction, type, options, wordLimit } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách câu hỏi' });
    if (type !== undefined && !READING_QUESTION_TYPES.includes(type)) return res.status(400).json({ error: 'Dạng câu hỏi không hợp lệ' });
    const cleanOptions = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    const data = {
      ...(groupInstruction !== undefined && { groupInstruction: groupInstruction?.trim() || null }),
      // Đổi dạng câu → bỏ đáp án cũ (đáp án chọn và đáp án điền không dùng lẫn được) + bộ lựa chọn mặc định
      ...(type !== undefined && { type, correctIndex: null, correctAnswer: null, acceptableAnswers: null, options: DEFAULT_GROUP_OPTIONS[type] ? JSON.stringify(DEFAULT_GROUP_OPTIONS[type]) : null }),
      ...(options !== undefined && { options: cleanOptions.length ? JSON.stringify(cleanOptions) : null }),
      ...(wordLimit !== undefined && { wordLimit: wordLimit?.trim() || null })
    };
    await prisma.ieltsQuestion.updateMany({ where: { id: { in: ids } }, data });
    res.json(await prisma.ieltsQuestion.findMany({ where: { id: { in: ids } }, orderBy: { questionNumber: 'asc' } }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Xoá cả nhóm câu
router.delete('/questions-bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ error: 'Thiếu danh sách câu hỏi' });
    const first = await prisma.ieltsQuestion.findUnique({ where: { id: ids[0] }, select: { testId: true, skill: true } });
    if (!first) return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
    await prisma.ieltsQuestion.deleteMany({ where: { id: { in: ids }, testId: first.testId } });
    await renumberQuestions(first.testId, first.skill);
    res.json({ message: 'Đã xoá nhóm câu' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/questions/:id', async (req, res) => {
  try {
    const q = await prisma.ieltsQuestion.delete({ where: { id: req.params.id }, select: { testId: true, skill: true, readingPassageId: true, listeningSectionId: true } });
    await renumberQuestions(q.testId, q.skill);
    res.json(await loadContainerWithQuestions(q.skill, q.readingPassageId || q.listeningSectionId));
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy câu hỏi' });
    res.status(400).json({ error: err.message });
  }
});

// Dán đáp án nhanh cho cả 1 kỹ năng, mỗi dòng "số đáp án" (vd "1 TRUE", "14 B", "18 breath",
// "22 colour/color", "27 iv"). Câu điền từ: "/" ngăn các đáp án được chấp nhận. Câu chọn đáp án:
// khớp theo nội dung lựa chọn, nhãn đầu lựa chọn (A, B, iv...), chữ cái thứ tự, hoặc viết tắt
// T/F/NG, Y/N/NG. Trả về số câu đã cập nhật + các dòng không hiểu được.
const ANSWER_ALIASES = { T: 'TRUE', F: 'FALSE', NG: 'NOT GIVEN', Y: 'YES', N: 'NO' };
function matchOptionIndex(options, raw) {
  const ans = raw.trim().replace(/\s+/g, ' ');
  const up = (ANSWER_ALIASES[ans.toUpperCase()] || ans).toUpperCase();
  let i = options.findIndex((o) => o.trim().toUpperCase() === up);
  if (i >= 0) return i;
  i = options.findIndex((o) => {
    const m = o.trim().match(/^([A-Za-z]|[ivxlcIVXLC]{1,5})(?:[.)]\s*|\s+)/);
    return m && m[1].toUpperCase() === up;
  });
  if (i >= 0) return i;
  if (/^[A-Z]$/.test(up) && up.charCodeAt(0) - 65 < options.length) return up.charCodeAt(0) - 65;
  // Gõ nội dung lựa chọn không kèm nhãn ("Tuesday" ↔ "B. Tuesday")
  return options.findIndex((o) => o.trim().replace(/^([A-Za-z]|[ivxlcIVXLC]{1,5})(?:[.)]\s*|\s+)/, '').trim().toUpperCase() === up);
}

router.post('/tests/:id/answer-key', async (req, res) => {
  try {
    const { skill, text } = req.body;
    if (!['READING', 'LISTENING'].includes(skill)) return res.status(400).json({ error: 'skill không hợp lệ' });
    const questions = await prisma.ieltsQuestion.findMany({ where: { testId: req.params.id, skill } });
    const byNumber = new Map(questions.map((q) => [q.questionNumber, q]));
    const updates = [];
    const problems = [];
    for (const line of String(text || '').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = line.match(/^\s*(\d{1,2})\s*[.):\-–]?\s*(.+?)\s*$/);
      if (!m) { problems.push(`"${line.trim()}" — không đọc được (cần dạng "số đáp án")`); continue; }
      const q = byNumber.get(parseInt(m[1]));
      if (!q) { problems.push(`Câu ${m[1]} — không có trong đề`); continue; }
      const opts = FILL_QUESTION_TYPES.includes(q.type) ? null : parseOptions(q);
      if (!opts) {
        const alts = m[2].split(/\s*\/\s*|\s+OR\s+/i).map((s) => s.trim()).filter(Boolean);
        updates.push(prisma.ieltsQuestion.update({ where: { id: q.id }, data: { correctAnswer: alts[0], acceptableAnswers: alts.length > 1 ? JSON.stringify(alts.slice(1)) : null, correctIndex: null } }));
      } else {
        const idx = matchOptionIndex(opts, m[2]);
        if (idx < 0) { problems.push(`Câu ${m[1]} — "${m[2]}" không khớp lựa chọn nào`); continue; }
        updates.push(prisma.ieltsQuestion.update({ where: { id: q.id }, data: { correctIndex: idx, correctAnswer: null, acceptableAnswers: null } }));
      }
    }
    if (updates.length) await prisma.$transaction(updates);
    res.json({ updated: updates.length, problems });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Gắn ảnh cho bài đọc (sơ đồ/bảng đi kèm Passage)
router.post('/reading-passages/:id/image', uploadImage.single('image'), async (req, res) => {
  try {
    const url = await uploadToStorage(req.file, 'ielts-books/images');
    const passage = await prisma.ieltsReadingPassage.update({ where: { id: req.params.id }, data: { imageUrl: url } });
    res.json(passage);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
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
        assignedStudents: { select: { id: true, name: true, email: true } },
        classrooms: { select: { id: true, name: true } }
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
      assignedClassroomId, assignedStudentIds, classroomIds, publishTime, deadline, maxAttempts
    } = req.body;
    if (classroomIds !== undefined && !Array.isArray(classroomIds)) {
      return res.status(400).json({ error: 'classroomIds phải là mảng' });
    }
    if (assignedStudentIds !== undefined && !Array.isArray(assignedStudentIds)) {
      return res.status(400).json({ error: 'assignedStudentIds phải là mảng' });
    }

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
      data.assignedStudents = { set: [...new Set(assignedStudentIds)].map((id) => ({ id })) };
    }
    if (Array.isArray(classroomIds)) {
      data.classrooms = { set: [...new Set(classroomIds)].map((id) => ({ id })) };
    }
    // Lưu phạm vi giao theo kiểu mới (nhiều lớp + học viên lẻ) → bỏ hẳn cách giao 1 lớp/1 học viên
    // cũ, nếu không học viên đã bị gỡ khỏi phạm vi vẫn thấy đề qua field cũ.
    if (Array.isArray(assignedStudentIds) || Array.isArray(classroomIds)) {
      Object.assign(data, { libraryClassroomId: null, libraryStudentId: null, assignedClassroomId: null });
    }

    const test = await prisma.ieltsTest.update({
      where: { id: req.params.id },
      data,
      include: {
        assignedStudents: { select: { id: true, name: true, email: true } },
        classrooms: { select: { id: true, name: true } }
      }
    });
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
    const { instructions, transcript } = req.body;
    const section = await prisma.ieltsListeningSection.update({
      where: { id: req.params.id },
      data: {
        ...(instructions !== undefined && { instructions: instructions || null }),
        ...(transcript !== undefined && { transcript: transcript || null })
      }
    });
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 8c. Teacher attaches/replaces a Listening section's audio
// (Supabase Storage, no Whisper alignment — Listening is graded against the teacher's answer
// key, not word-level timestamps, so the audio only needs to be stored + playable).
router.post('/listening-sections/:id/audio', uploadAudio.single('audio'), async (req, res) => {
  try {
    const url = await uploadToStorage(req.file, 'ielts-books/audio');
    const section = await prisma.ieltsListeningSection.update({ where: { id: req.params.id }, data: { audioUrl: url } });
    res.json(section);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
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

// 8e. Teacher attaches a Writing Task 1 chart/graph/diagram image.
router.post('/writing-tasks/:id/image', uploadImage.single('image'), async (req, res) => {
  try {
    const url = await uploadToStorage(req.file, 'ielts-books/images');
    const task = await prisma.ieltsWritingTask.update({ where: { id: req.params.id }, data: { imageUrl: url } });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// 8f. Same image attach, for a diagram/map/plan-labeling question (Reading or Listening).
router.post('/questions/:id/image', uploadImage.single('image'), async (req, res) => {
  try {
    const url = await uploadToStorage(req.file, 'ielts-books/images');
    const question = await prisma.ieltsQuestion.update({ where: { id: req.params.id }, data: { imageUrl: url } });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.message });
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
        listeningSections: { select: { audioUrl: true } },
        _count: { select: { classrooms: true, assignedStudents: true, writingTasks: true, speakingParts: true } }
      }
    });
    if (!test) return res.status(404).json({ error: 'Không tìm thấy đề' });
    if (!test.testType) return res.status(400).json({ error: 'Vui lòng xác nhận dạng đề (Academic/General Training) trước khi publish' });

    if (!test.questions.length && !test._count.writingTasks && !test._count.speakingParts) {
      return res.status(400).json({ error: 'Đề chưa có nội dung nào' });
    }
    for (const [skill, label] of [['READING', 'Reading'], ['LISTENING', 'Listening']]) {
      const unmatched = test.questions.filter((q) => q.skill === skill && q.correctIndex === null && !q.correctAnswer);
      if (unmatched.length) {
        return res.status(400).json({ error: `Còn ${unmatched.length} câu ${label} chưa có đáp án (câu ${unmatched.map((q) => q.questionNumber).sort((a, b) => a - b).join(', ')})` });
      }
    }
    const missingAudio = test.listeningSections.filter((s) => !s.audioUrl);
    if (missingAudio.length) {
      return res.status(400).json({ error: `Còn ${missingAudio.length} phần Listening chưa gắn audio` });
    }

    const hasScope = test._count.classrooms > 0 || test._count.assignedStudents > 0
      || (test.deliveryMode === 'LIBRARY' && (test.libraryClassroomId || test.libraryStudentId))
      || (test.deliveryMode === 'ASSIGNED' && test.assignedClassroomId);
    if (!hasScope) {
      return res.status(400).json({ error: 'Chưa giao đề cho ai — chọn ít nhất 1 lớp học hoặc 1 học viên rồi bấm Lưu phạm vi giao' });
    }

    const updated = await prisma.ieltsTest.update({ where: { id: req.params.id }, data: { status: 'PUBLISHED' } });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 9b. Gỡ publish — học viên không còn thấy đề (lịch sử làm bài giữ nguyên); sửa xong publish lại.
router.post('/tests/:id/unpublish', async (req, res) => {
  try {
    const updated = await prisma.ieltsTest.update({ where: { id: req.params.id }, data: { status: 'REVIEWED' } });
    res.json(updated);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy đề' });
    res.status(400).json({ error: err.message });
  }
});

// 10. Delete a whole book (cascades to its tests/passages/questions via Prisma schema).
router.delete('/books/:id', async (req, res) => {
  try {
    await prisma.ieltsBook.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xoá bộ đề' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Không tìm thấy bộ đề' });
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
