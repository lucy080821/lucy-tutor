const express = require('express');
const multer = require('multer');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');

const prisma = new PrismaClient();
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp3', '.m4a', '.wav'];
    if (!allowedExts.includes(ext)) {
      return cb(new Error('Chỉ cho phép file audio .mp3, .m4a, .wav'));
    }
    cb(null, true);
  }
});

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const removeVietnameseAccents = (str) =>
  str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');

const cleanString = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const ALLOWED_ACCENTS = ['UK', 'US', 'AUS'];
const ALLOWED_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

// Find the first sentence in the original (teacher-authored) script containing the target
// word, and which token within that sentence it is — used to blank the word for dictation
// while always displaying the teacher's exact script text (never Whisper's own transcription).
function findSentenceMatch(script, cleanTarget) {
  const sentences = script.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/);
    const targetTokenIndex = tokens.findIndex((t) => cleanString(t) === cleanTarget);
    if (targetTokenIndex !== -1) {
      return { tokens, targetTokenIndex };
    }
  }
  return null;
}

// Locate every accessible READY clip that contains `word` (optionally restricted to one
// accent), pairing the Whisper-derived timestamp (for seeking/playback) with the teacher's
// own script sentence (for display).
function matchClipsForWord(clips, word, accent) {
  const cleanTarget = cleanString(word);
  const matches = [];
  for (const clip of clips) {
    if (accent && clip.accent !== accent) continue;

    let words;
    try {
      words = JSON.parse(clip.alignment);
    } catch {
      continue;
    }
    if (!Array.isArray(words)) continue;

    const globalWordIdx = words.findIndex((w) => cleanString(w.word) === cleanTarget);
    if (globalWordIdx === -1) continue;

    const sentenceMatch = findSentenceMatch(clip.script, cleanTarget);
    if (!sentenceMatch) continue;
    const { tokens, targetTokenIndex } = sentenceMatch;

    // The sentence's own tokens line up 1:1 with a local run of the Whisper alignment
    // array anchored at the target word — use that run's first/last timestamps so
    // playback covers the whole sentence, not just the single matched word.
    const sentenceStartIdx = Math.max(0, globalWordIdx - targetTokenIndex);
    const sentenceEndIdx = Math.min(words.length - 1, sentenceStartIdx + tokens.length - 1);

    matches.push({
      clipId: clip.id,
      title: clip.title,
      audioUrl: clip.audioUrl,
      accent: clip.accent,
      start: words[sentenceStartIdx].start,
      end: words[sentenceEndIdx].end,
      tokens,
      targetTokenIndex,
      fullScript: clip.script
    });
  }
  return matches;
}

async function findAccessibleReadyClips(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { classroomsJoined: { select: { id: true } } }
  });
  if (!user) return null;

  const classroomIds = user.classroomsJoined.map((c) => c.id);

  return prisma.listeningClip.findMany({
    where: {
      status: 'READY',
      OR: [
        { studentId: userId },
        ...(classroomIds.length ? [{ classroomId: { in: classroomIds } }] : [])
      ]
    }
  });
}

// Run Whisper word-level alignment in the background and persist the result.
// Never throws into the caller — failures are recorded on the clip itself.
async function processAlignment(clipId, audioUrl) {
  try {
    const transcription = await groq.audio.transcriptions.create({
      url: audioUrl,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    const words = transcription.words;
    if (!Array.isArray(words) || words.length === 0) {
      throw new Error('Whisper không trả về word-level timestamps cho file này');
    }

    await prisma.listeningClip.update({
      where: { id: clipId },
      data: {
        alignment: JSON.stringify(words.map((w) => ({ word: w.word, start: w.start, end: w.end }))),
        status: 'READY'
      }
    });
  } catch (err) {
    console.error('Listening clip alignment failed:', err);
    await prisma.listeningClip.update({
      where: { id: clipId },
      data: { status: 'FAILED', errorMessage: err.message || 'Alignment failed' }
    }).catch(() => {});
  }
}

// 1. Teacher uploads an audio file + exact script, scoped to a classroom or an individual student
router.post('/upload', upload.single('audio'), async (req, res) => {
  try {
    const { title, script, teacherId, classroomId, studentId, accent, level } = req.body;

    if (!req.file) return res.status(400).json({ error: 'Thiếu file audio' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });
    if (!title || !script || !teacherId) return res.status(400).json({ error: 'Thiếu tiêu đề, script hoặc teacherId' });
    if (!classroomId && !studentId) return res.status(400).json({ error: 'Phải chọn lớp học hoặc học sinh cụ thể' });
    if (classroomId && studentId) return res.status(400).json({ error: 'Chỉ được chọn 1 trong 2: lớp học hoặc học sinh' });
    if (!ALLOWED_ACCENTS.includes(accent)) return res.status(400).json({ error: 'Giọng đọc không hợp lệ. Chọn UK, US hoặc AUS' });
    if (!ALLOWED_LEVELS.includes(level)) return res.status(400).json({ error: 'Cấp độ không hợp lệ. Chọn A1, A2, B1, B2 hoặc C1' });

    const file = req.file;
    const sanitizedName = removeVietnameseAccents(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `listening/${Date.now()}-${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from('documents').getPublicUrl(fileName);

    const clip = await prisma.listeningClip.create({
      data: {
        title,
        script,
        audioUrl: publicUrlData.publicUrl,
        accent,
        level,
        status: 'PROCESSING',
        teacherId,
        classroomId: classroomId || null,
        studentId: studentId || null
      }
    });

    res.json({ message: 'Upload thành công, đang xử lý căn chỉnh âm thanh', clip });

    // Fire-and-forget background job (same pattern as exams.routes.js's post-response setTimeout)
    setTimeout(() => processAlignment(clip.id, clip.audioUrl), 100);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Teacher's own uploaded clips (for the Studio Luyện Nghe management list)
router.get('/', async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Missing teacherId' });

    const clips = await prisma.listeningClip.findMany({
      where: { teacherId },
      include: {
        classroom: { select: { name: true } },
        student: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(clips);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Edit metadata only (title/accent/scope) — audio & script stay immutable here since the
// Whisper alignment is tied to the original audio; re-recording requires a fresh upload.
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, accent, level, classroomId, studentId } = req.body;

    const clip = await prisma.listeningClip.findUnique({ where: { id } });
    if (!clip) return res.status(404).json({ error: 'Not found' });

    if (accent && !ALLOWED_ACCENTS.includes(accent)) return res.status(400).json({ error: 'Giọng đọc không hợp lệ. Chọn UK, US hoặc AUS' });
    if (level && !ALLOWED_LEVELS.includes(level)) return res.status(400).json({ error: 'Cấp độ không hợp lệ. Chọn A1, A2, B1, B2 hoặc C1' });
    if (!classroomId && !studentId) return res.status(400).json({ error: 'Phải chọn lớp học hoặc học sinh cụ thể' });
    if (classroomId && studentId) return res.status(400).json({ error: 'Chỉ được chọn 1 trong 2: lớp học hoặc học sinh' });

    const updated = await prisma.listeningClip.update({
      where: { id },
      data: {
        title: title || clip.title,
        accent: accent || clip.accent,
        level: level || clip.level,
        classroomId: classroomId || null,
        studentId: studentId || null
      }
    });

    res.json({ message: 'Cập nhật thành công', clip: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const clip = await prisma.listeningClip.findUnique({ where: { id } });
    if (!clip) return res.status(404).json({ error: 'Not found' });

    if (supabase) {
      const key = clip.audioUrl.split('/documents/')[1];
      if (key) await supabase.storage.from('documents').remove([key]);
    }

    await prisma.listeningClip.delete({ where: { id } });
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. Free-form search: given any word, find matching clips accessible to this student
router.get('/search', async (req, res) => {
  try {
    const { userId, word, accent } = req.query;
    if (!userId || !word) return res.status(400).json({ error: 'Missing userId or word' });

    const clips = await findAccessibleReadyClips(userId);
    if (clips === null) return res.status(404).json({ error: 'User not found' });

    res.json(matchClipsForWord(clips, word, accent));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4. Practice queue: student's SRS-due vocab words paired with matching audio clips.
// Words with zero matching clips are dropped rather than shown empty.
router.get('/queue/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { accent } = req.query;
    const now = new Date();

    // Cap the candidate pool generously (not to the final batch size) — most due words
    // won't have a matching clip yet, so capping at the batch size here would starve the
    // queue even when plenty of later-due words do have matching audio.
    const dueProgress = await prisma.userVocabProgress.findMany({
      where: { userId, nextReviewDate: { lte: now } },
      include: { vocab: true },
      orderBy: { nextReviewDate: 'asc' },
      take: 200
    });

    const clips = await findAccessibleReadyClips(userId);
    if (clips === null) return res.status(404).json({ error: 'User not found' });

    const BATCH_SIZE = 10;
    const queue = [];
    for (const progress of dueProgress) {
      if (queue.length >= BATCH_SIZE) break;
      const clipMatches = matchClipsForWord(clips, progress.vocab.word, accent);
      if (clipMatches.length > 0) {
        queue.push({ progressId: progress.id, vocab: progress.vocab, clips: clipMatches });
      }
    }

    res.json(queue);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Đề Luyện Nghe (exam-style listening practice) ----
// Reuses each student's already-uploaded/assigned READY clips as source material — no new
// TTS/audio generation — and asks the AI to write exam-style questions purely from the
// teacher's exact script text (never from a fresh transcription), consistent with how the
// SRS dictation feature above always displays the teacher's script, not Whisper's.

const LISTENING_LEVEL_LABELS = {
  A1: 'A1 - mới bắt đầu', A2: 'A2 - sơ cấp', B1: 'B1 - trung cấp', B2: 'B2 - trung cao cấp', C1: 'C1 - cao cấp'
};

// Clips accessible to the student, for them to pick as the basis of a listening exam
router.get('/exam/clips/:userId', async (req, res) => {
  try {
    const clips = await findAccessibleReadyClips(req.params.userId);
    if (clips === null) return res.status(404).json({ error: 'User not found' });
    res.json(clips.map((c) => ({ id: c.id, title: c.title, audioUrl: c.audioUrl, accent: c.accent })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/exam/generate', async (req, res) => {
  try {
    const { userId, clipId, level, purpose, numQuestions } = req.body;
    if (!userId || !clipId) return res.status(400).json({ error: 'Thiếu userId hoặc clipId' });

    const clips = await findAccessibleReadyClips(userId);
    if (clips === null) return res.status(404).json({ error: 'User not found' });
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return res.status(404).json({ error: 'Không tìm thấy hoặc không có quyền truy cập audio này' });

    const count = Math.min(10, Math.max(3, parseInt(numQuestions, 10) || 5));
    const levelLabel = LISTENING_LEVEL_LABELS[level] || LISTENING_LEVEL_LABELS.B1;
    const purposeLabel = purpose === 'IELTS'
      ? 'Đây là bài luyện nghe theo định hướng thi IELTS Listening — câu hỏi theo phong cách điền từ/trắc nghiệm như đề thi thật.'
      : 'Đây là bài luyện nghe giao tiếp/đời sống — câu hỏi tự nhiên, kiểm tra khả năng nghe hiểu thực tế.';

    const prompt = `
Bạn là chuyên gia ra đề luyện nghe tiếng Anh. Dưới đây là script CHÍNH XÁC (nguyên văn) của một đoạn audio:
"${clip.script}"

Trình độ học viên: ${levelLabel}. ${purposeLabel}

Hãy tạo đúng ${count} câu hỏi kiểm tra khả năng nghe hiểu dựa HOÀN TOÀN trên nội dung script trên (giả định học viên đã nghe audio, không đọc script), trộn 2 dạng:
1. "type": "MULTIPLE_CHOICE" — có "options": ["A. ...","B. ...","C. ...","D. ..."] và "correctIndex" (0-3)
2. "type": "FILL_BLANK" — "question" là một câu trích nguyên văn từ script có chỗ trống "_____" (5 dấu gạch dưới) thay 1 từ/cụm từ ngắn (tối đa 3 từ) lấy NGUYÊN VĂN từ script, có "correctAnswer": "từ/cụm từ đúng"

BẮT BUỘC TRẢ VỀ CHỈ MỘT JSON với cấu trúc sau (không có markdown code blocks bọc ngoài JSON):
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "Câu hỏi bằng tiếng Anh",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Giải thích bằng tiếng Việt, trích câu trong script làm căn cứ"
    }
  ]
}
Phải có đúng ${count} câu hỏi.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a listening exam question generator. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }
    res.json({ clip: { id: clip.id, title: clip.title, audioUrl: clip.audioUrl, accent: clip.accent, script: clip.script }, questions: result.questions || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/exam/attempts', async (req, res) => {
  try {
    const { userId, clipId, title, level, purpose, questions, answers, score } = req.body;
    if (!userId || !questions) return res.status(400).json({ error: 'Thiếu dữ liệu bài luyện nghe' });

    const attempt = await prisma.listeningExamAttempt.create({
      data: {
        userId,
        clipId: clipId || null,
        title: title || 'Đề Luyện Nghe',
        level: level || 'B1',
        purpose: purpose || 'GENERAL',
        questions: JSON.stringify(questions),
        answers: JSON.stringify(answers || {}),
        score: parseFloat(score) || 0
      }
    });
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/exam/attempts/:userId', async (req, res) => {
  try {
    const attempts = await prisma.listeningExamAttempt.findMany({
      where: { userId: req.params.userId },
      orderBy: { practicedAt: 'desc' }
    });
    res.json(attempts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
