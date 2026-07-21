const express = require('express');
const { Groq } = require('groq-sdk');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

// Section sizing per variant — chosen so SHORT totals ~20 câu/25 phút and FULL ~40 câu/50 phút,
// mirroring the real Vietnamese THPT Quốc Gia English exam's 5-part structure.
const VARIANTS = {
  SHORT: { phonetics: 2, grammarVocab: 10, communication: 2, cloze: 3, reading: 3, durationSec: 25 * 60 },
  FULL: { phonetics: 4, grammarVocab: 20, communication: 4, cloze: 5, reading: 7, durationSec: 50 * 60 }
};

// Every question across every section shares the ReadingQuestion shape from
// frontend/src/lib/readingGrading.ts (type/question/options/correctIndex/explanation) so the
// client can reuse isReadingAnswerCorrect/readingCorrectAnswerLabel unmodified — we just tag
// each one with a `section` field for grouped display and per-section scoring.
function tagSection(questions, section) {
  return (Array.isArray(questions) ? questions : []).map(q => ({ ...q, type: 'MULTIPLE_CHOICE', section }));
}

router.post('/generate', async (req, res) => {
  try {
    const { variant } = req.body;
    const counts = VARIANTS[variant] || VARIANTS.SHORT;
    const variantKey = VARIANTS[variant] ? variant : 'SHORT';

    // Call 1: discrete single-sentence MCQ sections (no passage needed) — kept in its own call
    // so neither JSON response risks truncation from being too large in one go.
    const discretePrompt = `
Bạn là chuyên gia ra đề Tiếng Anh theo cấu trúc đề thi THPT Quốc Gia (Việt Nam), dành cho học sinh lớp 12 ôn thi tốt nghiệp.

Hãy tạo 3 nhóm câu hỏi trắc nghiệm ĐỘC LẬP (không cần đoạn văn), mỗi câu có đúng 4 đáp án A-D:

1. NGỮ ÂM (Phonetics) — ${counts.phonetics} câu: mỗi câu cho 4 từ, yêu cầu chọn từ có trọng âm chính khác 3 từ còn lại, HOẶC từ có phần gạch chân phát âm khác 3 từ còn lại. Ghi rõ trong "question" các từ cần so sánh.
2. NGỮ PHÁP & TỪ VỰNG (Grammar & Vocabulary) — ${counts.grammarVocab} câu: mỗi câu là 1 câu tiếng Anh có 1 chỗ trống "______", chọn đáp án đúng nhất để hoàn thành câu (ngữ pháp, từ vựng, cụm động từ, giới từ, mệnh đề quan hệ...).
3. GIAO TIẾP (Communication) — ${counts.communication} câu: mỗi câu là 1 đoạn hội thoại ngắn 2 lượt lời, 1 câu bị thay bằng "______", chọn đáp án phù hợp nhất để hoàn thành hội thoại tự nhiên.

BẮT BUỘC trả về CHỈ MỘT JSON (không có markdown code block bọc ngoài):
{
  "phonetics": [ { "question": "...", "options": ["A. ...","B. ...","C. ...","D. ..."], "correctIndex": 0, "explanation": "giải thích tiếng Việt ngắn gọn" } ],
  "grammarVocab": [ ... cùng cấu trúc ... ],
  "communication": [ ... cùng cấu trúc ... ]
}
Số lượng câu phải đúng chính xác: phonetics ${counts.phonetics} câu, grammarVocab ${counts.grammarVocab} câu, communication ${counts.communication} câu.
`;

    // Call 2: passage-based sections (cloze + reading comprehension), modeled after
    // generate-reading-passage's passage+questions pattern.
    const passagePrompt = `
Bạn là chuyên gia ra đề Tiếng Anh theo cấu trúc đề thi THPT Quốc Gia (Việt Nam), dành cho học sinh lớp 12 ôn thi tốt nghiệp.

Hãy tạo 2 phần cần đoạn văn:

1. ĐỌC ĐIỀN TỪ (Cloze) — viết 1 đoạn văn tiếng Anh (100-150 từ) có đúng ${counts.cloze} chỗ trống được đánh số ngay trong đoạn văn theo dạng "_____(1)_____", "_____(2)_____"... rồi tạo ${counts.cloze} câu hỏi trắc nghiệm tương ứng, mỗi câu hỏi ghi rõ "Chọn đáp án đúng cho chỗ trống (X)" kèm 4 lựa chọn.
2. ĐỌC HIỂU (Reading Comprehension) — viết 1 đoạn văn tiếng Anh KHÁC (150-200 từ), rồi tạo ${counts.reading} câu hỏi trắc nghiệm đọc hiểu (ý chính, chi tiết, suy luận, từ vựng trong ngữ cảnh...).

BẮT BUỘC trả về CHỈ MỘT JSON (không có markdown code block bọc ngoài):
{
  "cloze": { "passage": "đoạn văn có đánh số chỗ trống", "questions": [ { "question": "Chọn đáp án đúng cho chỗ trống (1)", "options": ["A. ...","B. ...","C. ...","D. ..."], "correctIndex": 0, "explanation": "..." } ] },
  "reading": { "passage": "đoạn văn đọc hiểu", "questions": [ ... cùng cấu trúc ... ] }
}
Số câu hỏi phải đúng chính xác: cloze ${counts.cloze} câu (khớp đúng số thứ tự chỗ trống), reading ${counts.reading} câu.
`;

    const [discreteCompletion, passageCompletion] = await Promise.all([
      groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a Vietnamese high-school English exam generator. Respond only in valid JSON.' },
          { role: 'user', content: discretePrompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: 'json_object' }
      }),
      groq.chat.completions.create({
        messages: [
          { role: 'system', content: 'You are a Vietnamese high-school English exam generator. Respond only in valid JSON.' },
          { role: 'user', content: passagePrompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    ]);

    let discrete, passages;
    try {
      discrete = JSON.parse(discreteCompletion.choices[0]?.message?.content || '{}');
      passages = JSON.parse(passageCompletion.choices[0]?.message?.content || '{}');
    } catch {
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }

    const sections = [
      { section: 'PHONETICS', questions: tagSection(discrete.phonetics, 'PHONETICS') },
      { section: 'GRAMMAR_VOCAB', questions: tagSection(discrete.grammarVocab, 'GRAMMAR_VOCAB') },
      { section: 'COMMUNICATION', questions: tagSection(discrete.communication, 'COMMUNICATION') },
      { section: 'CLOZE', passage: passages.cloze?.passage || '', questions: tagSection(passages.cloze?.questions, 'CLOZE') },
      { section: 'READING', passage: passages.reading?.passage || '', questions: tagSection(passages.reading?.questions, 'READING') }
    ];

    res.json({ variant: variantKey, durationSec: counts.durationSec, sections });
  } catch (error) {
    console.error('Generate mock test error:', error);
    res.status(500).json({ error: 'Failed to generate mock test' });
  }
});

const SECTION_LABELS = {
  PHONETICS: 'Ngữ Âm',
  GRAMMAR_VOCAB: 'Ngữ Pháp & Từ Vựng',
  COMMUNICATION: 'Giao Tiếp',
  CLOZE: 'Đọc Điền Từ',
  READING: 'Đọc Hiểu'
};

router.post('/analysis', async (req, res) => {
  try {
    const { questions, results, level } = req.body;
    if (!Array.isArray(questions) || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Thiếu dữ liệu câu hỏi/kết quả' });
    }

    const bySection = {};
    results.forEach((r, i) => {
      const section = questions[i]?.section || 'UNKNOWN';
      if (!bySection[section]) bySection[section] = { correct: 0, total: 0 };
      bySection[section].total += 1;
      if (r.correct) bySection[section].correct += 1;
    });
    const sectionSummary = Object.entries(bySection).map(([s, v]) => `${SECTION_LABELS[s] || s}: ${v.correct}/${v.total} đúng`).join('; ');

    const prompt = `
Bạn là gia sư luyện thi Tiếng Anh THPT Quốc Gia, đang phân tích kết quả một đề thi thử của học sinh (trình độ ~${level || 'THPT'}).

Kết quả theo từng phần: ${sectionSummary}

Chi tiết từng câu (đúng/sai):
${results.map((r, i) => `Câu ${i + 1} (${SECTION_LABELS[questions[i]?.section] || questions[i]?.section}): ${r.correct ? 'ĐÚNG' : 'SAI'} — "${questions[i]?.question}"`).join('\n')}

Hãy phân tích và đưa ra chiến thuật ôn tập phù hợp cho TỪNG PHẦN, đặc biệt các phần còn yếu. Trả về JSON:
{
  "overall": "1-2 câu nhận xét tổng quan về kết quả đề thi thử",
  "bySection": [ { "section": "PHONETICS|GRAMMAR_VOCAB|COMMUNICATION|CLOZE|READING", "note": "Nhận xét + chiến thuật ôn tập cho phần này dựa trên kết quả thực tế" } ],
  "suggestions": ["2-3 gợi ý ôn tập cụ thể tiếp theo"]
}
Tất cả bằng tiếng Việt.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a Vietnamese high-school English exam strategy coach. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = { overall: 'Không thể phân tích lúc này. Vui lòng thử lại.', bySection: [], suggestions: [] };
    }
    res.json(analysis);
  } catch (error) {
    console.error('Mock test analysis error:', error);
    res.status(500).json({ error: 'Failed to generate mock test analysis' });
  }
});

router.post('/attempts', async (req, res) => {
  try {
    const { userId, variant, sections, answers, score, timeSpentSec, analysis } = req.body;
    if (!userId || !sections) return res.status(400).json({ error: 'Thiếu dữ liệu đề thi thử' });

    const attempt = await prisma.mockTestAttempt.create({
      data: {
        userId,
        variant: variant || 'SHORT',
        sections: JSON.stringify(sections),
        answers: JSON.stringify(answers || {}),
        score: parseFloat(score) || 0,
        timeSpentSec: timeSpentSec != null ? parseInt(timeSpentSec) : null,
        analysis: analysis ? JSON.stringify(analysis) : null
      }
    });
    res.json(attempt);
  } catch (error) {
    console.error('Save mock test attempt error:', error);
    res.status(500).json({ error: 'Failed to save mock test attempt' });
  }
});

router.patch('/attempts/:id', async (req, res) => {
  try {
    const { analysis } = req.body;
    const attempt = await prisma.mockTestAttempt.update({
      where: { id: req.params.id },
      data: { analysis: analysis ? JSON.stringify(analysis) : null }
    });
    res.json(attempt);
  } catch (error) {
    console.error('Update mock test attempt analysis error:', error);
    res.status(500).json({ error: 'Failed to update mock test attempt' });
  }
});

router.get('/attempts/:userId', async (req, res) => {
  try {
    const attempts = await prisma.mockTestAttempt.findMany({
      where: { userId: req.params.userId },
      orderBy: { practicedAt: 'desc' }
    });
    res.json(attempts);
  } catch (error) {
    console.error('Fetch mock test attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch mock test attempts' });
  }
});

module.exports = router;
