const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { Groq, toFile } = require('groq-sdk');

const prisma = new PrismaClient();
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // short clips only

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

// Pool of words to practice, sourced entirely from the student's own SRS vocab deck (either
// self-added via /api/srs/vocab/custom, or from a teacher's Lesson) — no teacher-authored
// content needed for this feature. Mirrors listening.routes.js's /queue/:userId: no due-date
// gate, just the most-recently-due-first slice of the whole deck.
router.get('/practice-set/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const deck = await prisma.userVocabProgress.findMany({
      where: { userId },
      include: { vocab: true },
      orderBy: { nextReviewDate: 'asc' },
      take: 200
    });

    const practiceSet = deck
      .filter(p => p.vocab.phonetic)
      .map(p => ({ vocabId: p.vocabId, word: p.vocab.word, phonetic: p.vocab.phonetic, example: p.vocab.example, meaning: p.vocab.meaning }));

    res.json(practiceSet);
  } catch (error) {
    console.error('Error fetching pronunciation practice set:', error);
    res.status(500).json({ error: 'Failed to fetch practice set' });
  }
});

// Transcribe a student's recorded pronunciation attempt via Groq Whisper — synchronous
// (unlike listening.routes.js's fire-and-forget alignment job) since the transcript is
// needed immediately to grade the attempt. Buffer is sent directly to Groq (via toFile),
// not persisted to Supabase Storage — these are short, throwaway practice clips.
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Thiếu file ghi âm' });

    const file = await toFile(req.file.buffer, 'recording.webm', { type: req.file.mimetype || 'audio/webm' });
    const transcription = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3',
      response_format: 'json'
    });

    res.json({ transcript: transcription.text || '' });
  } catch (error) {
    console.error('Error transcribing pronunciation attempt:', error);
    res.status(500).json({ error: 'Không thể xử lý bản ghi âm này' });
  }
});

// AI coaching tip — given the target text and what Whisper heard, guess likely pronunciation
// issues (proxy via ASR mismatch, not true phoneme scoring) and give tips for Vietnamese speakers.
router.post('/coach', async (req, res) => {
  try {
    const { targetText, transcript, mismatchedWords } = req.body;
    if (!targetText || !transcript) return res.status(400).json({ error: 'Thiếu dữ liệu để góp ý' });

    const prompt = `
Bạn là chuyên gia luyện phát âm tiếng Anh cho người Việt.

Câu/từ mẫu học viên cần đọc: "${targetText}"
Hệ thống nhận dạng giọng nói (ASR) nghe được học viên đọc là: "${transcript}"
Các từ bị lệch so với mẫu: ${JSON.stringify(mismatchedWords || [])}

Lưu ý: đây là suy đoán dựa trên kết quả nhận dạng giọng nói tự động, không phải phân tích âm vị học chính xác 100%. Dựa vào các từ bị lệch (nếu có) và các lỗi phát âm phổ biến của người Việt học tiếng Anh (âm cuối bị nuốt, âm "th", trọng âm sai, nguyên âm dài/ngắn, âm "r"/"l"...), hãy đoán học viên có thể đang gặp lỗi gì và góp ý cách sửa.

Trả về JSON với cấu trúc:
{
  "overall": "1-2 câu nhận xét tổng quan, khích lệ",
  "likelyIssues": [{ "word": "từ bị nghi ngờ phát âm sai", "tip": "gợi ý cách đọc đúng, ngắn gọn, dễ hiểu" }],
  "suggestions": ["1-2 gợi ý luyện tập chung"]
}

Nếu transcript khớp hoàn toàn với câu mẫu, "likelyIssues" có thể để rỗng và "overall" khen ngợi. Tất cả bằng tiếng Việt.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an encouraging English pronunciation coach for Vietnamese learners. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch {
      feedback = { overall: 'Không thể phân tích lúc này. Vui lòng thử lại.', likelyIssues: [], suggestions: [] };
    }
    res.json(feedback);
  } catch (error) {
    console.error('Pronunciation coach error:', error);
    res.status(500).json({ error: 'Failed to generate coaching feedback' });
  }
});

router.post('/attempts', async (req, res) => {
  try {
    const { userId, vocabId, targetText, transcript, matchScore, feedback } = req.body;
    if (!userId || !targetText || transcript === undefined) return res.status(400).json({ error: 'Thiếu dữ liệu lần luyện tập' });

    const attempt = await prisma.pronunciationAttempt.create({
      data: {
        userId,
        vocabId: vocabId || null,
        targetText,
        transcript,
        matchScore: parseFloat(matchScore) || 0,
        feedback: feedback ? JSON.stringify(feedback) : null
      }
    });
    res.json(attempt);
  } catch (error) {
    console.error('Save pronunciation attempt error:', error);
    res.status(500).json({ error: 'Failed to save pronunciation attempt' });
  }
});

router.get('/attempts/:userId', async (req, res) => {
  try {
    const attempts = await prisma.pronunciationAttempt.findMany({
      where: { userId: req.params.userId },
      orderBy: { practicedAt: 'desc' }
    });
    res.json(attempts);
  } catch (error) {
    console.error('Fetch pronunciation attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch pronunciation attempts' });
  }
});

module.exports = router;
