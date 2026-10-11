// Công cụ miễn phí công khai (không cần đăng nhập) — mount tại /api/free-tools.
// Hiện có: chấm Writing bằng AI (trang /cham-writing-mien-phi), từ vựng flashcard theo lớp/Unit (trang /flashcard-tieng-anh).
//
// Vì ai cũng gọi được, route này phải tự bảo vệ hạn mức Groq của học viên trả phí:
//  - Giới hạn lượt theo IP mỗi ngày (FREE_WRITING_PER_IP, mặc định 3) — ngày tính theo giờ VN
//  - Trần tổng toàn hệ thống mỗi ngày (FREE_WRITING_DAILY_CAP, mặc định 200) — chặn bot đổi IP
//  - Giới hạn độ dài bài (MIN_WORDS–MAX_WORDS từ, MAX_CHARS ký tự) và đề (MAX_PROMPT_CHARS)
//  - Ô honeypot "website" ẩn trên form: bot điền vào → trả lỗi chung
// Bộ đếm giữ trong RAM (khởi động lại server là reset) — đủ cho 1 instance Render.
const express = require('express');
const { Groq } = require('groq-sdk');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');
const { getFlashcardSnapshot } = require('../utils/flashcardCatalog');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const PER_IP = Number(process.env.FREE_WRITING_PER_IP) || 3;
const DAILY_CAP = Number(process.env.FREE_WRITING_DAILY_CAP) || 200;
const MIN_WORDS = 50;
const MAX_WORDS = 350;
const MAX_CHARS = 2500;
const MAX_PROMPT_CHARS = 600;
const TASK_TYPES = ['IELTS_TASK2', 'IELTS_TASK1', 'GENERAL'];

let usageDay = '';
let usageByIp = new Map();
let usageTotal = 0;

function vnDay() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
function resetIfNewDay() {
  const day = vnDay();
  if (day !== usageDay) { usageDay = day; usageByIp = new Map(); usageTotal = 0; }
}
function clientIp(req) {
  // Render đứng sau proxy (server không bật trust proxy) -> lấy IP gốc từ x-forwarded-for, giống passwordReset.routes.js
  return String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
}
function remainingFor(ip) {
  resetIfNewDay();
  return Math.max(0, PER_IP - (usageByIp.get(ip) || 0));
}
function countWords(text) {
  return (text.trim().match(/[A-Za-z0-9'’-]+/g) || []).length;
}

const TASK_INFO = {
  IELTS_TASK2: {
    label: 'IELTS Writing Task 2 (bài luận)',
    criteria: [
      ['TR', 'Task Response'], ['CC', 'Coherence & Cohesion'], ['LR', 'Lexical Resource'], ['GRA', 'Grammatical Range & Accuracy'],
    ],
    note: 'Bài chuẩn cần tối thiểu 250 từ; bài ngắn hơn bị trừ điểm Task Response.',
  },
  IELTS_TASK1: {
    label: 'IELTS Writing Task 1 (mô tả biểu đồ/bức thư)',
    criteria: [
      ['TA', 'Task Achievement'], ['CC', 'Coherence & Cohesion'], ['LR', 'Lexical Resource'], ['GRA', 'Grammatical Range & Accuracy'],
    ],
    note: 'Bài chuẩn cần tối thiểu 150 từ. Bạn KHÔNG nhìn thấy biểu đồ/hình — chỉ dựa vào đề bài người dùng mô tả; không trừ điểm vì những số liệu bạn không kiểm chứng được.',
  },
  GENERAL: {
    label: 'Đoạn văn/bài luận tiếng Anh thông thường (học sinh THPT hoặc người đi làm)',
    criteria: [
      ['TR', 'Nội dung & đáp ứng đề'], ['CC', 'Mạch lạc & liên kết'], ['LR', 'Từ vựng'], ['GRA', 'Ngữ pháp'],
    ],
    note: 'Không có yêu cầu số từ cố định.',
  },
};

// Từ vựng flashcard lớp 1–12 theo Unit — bản chụp quét từ bài học của giáo viên (xem utils/flashcardCatalog.js)
router.get('/flashcards', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(getFlashcardSnapshot());
});

router.get('/writing-check/quota', (req, res) => {
  res.json({ remaining: remainingFor(clientIp(req)), perDay: PER_IP, minWords: MIN_WORDS, maxWords: MAX_WORDS, maxChars: MAX_CHARS });
});

router.post('/writing-check', async (req, res) => {
  const { taskType, prompt, essay, website } = req.body || {};
  if (website) return res.status(400).json({ error: 'Yêu cầu không hợp lệ.' });
  if (!TASK_TYPES.includes(taskType)) return res.status(400).json({ error: 'Vui lòng chọn dạng bài.' });
  const text = typeof essay === 'string' ? essay.trim() : '';
  const topic = typeof prompt === 'string' ? prompt.trim() : '';
  if (text.length > MAX_CHARS) return res.status(400).json({ error: `Bài viết tối đa ${MAX_CHARS} ký tự.` });
  if (topic.length > MAX_PROMPT_CHARS) return res.status(400).json({ error: `Đề bài tối đa ${MAX_PROMPT_CHARS} ký tự.` });
  const words = countWords(text);
  if (words < MIN_WORDS) return res.status(400).json({ error: `Bài viết cần ít nhất ${MIN_WORDS} từ (hiện có ${words} từ).` });
  if (words > MAX_WORDS) return res.status(400).json({ error: `Bản miễn phí chấm tối đa ${MAX_WORDS} từ (hiện có ${words} từ).` });

  const ip = clientIp(req);
  resetIfNewDay();
  const used = usageByIp.get(ip) || 0;
  if (used >= PER_IP) {
    return res.status(429).json({ error: `Bạn đã dùng hết ${PER_IP} lượt chấm miễn phí hôm nay. Quay lại vào ngày mai, hoặc đăng ký dùng thử để chấm không giới hạn.`, remaining: 0 });
  }
  if (usageTotal >= DAILY_CAP) {
    return res.status(429).json({ error: 'Hôm nay công cụ đã đạt giới hạn lượt chấm miễn phí. Vui lòng quay lại vào ngày mai.', remaining: remainingFor(ip) });
  }
  // Giữ chỗ trước khi gọi AI (chặn bấm liên tục), hoàn lại nếu chấm lỗi
  usageByIp.set(ip, used + 1);
  usageTotal += 1;
  const refund = () => {
    if (vnDay() !== usageDay) return;
    usageByIp.set(ip, Math.max(0, (usageByIp.get(ip) || 1) - 1));
    usageTotal = Math.max(0, usageTotal - 1);
  };

  const info = TASK_INFO[taskType];
  const isIelts = taskType !== 'GENERAL';
  const criteriaSpec = info.criteria.map(([key, name]) => `{"key":"${key}","name":"${name}","band":<số>,"comment":"<2-3 câu tiếng Việt, cụ thể theo bài>"}`).join(',\n    ');

  const system = 'You are a strict but encouraging certified IELTS examiner and English teacher for Vietnamese learners. Grade only what the learner actually wrote. Respond ONLY with valid JSON.';
  const user = `Chấm bài viết sau.
Dạng bài: ${info.label}. ${info.note}
Đề bài: ${topic ? `"""${topic}"""` : '(người dùng không cung cấp đề — chấm dựa trên chính nội dung bài)'}
Số từ: ${words}
Bài viết:
"""${text}"""

Yêu cầu:
- ${isIelts ? 'Chấm theo band descriptors IELTS công khai, mỗi tiêu chí band 0-9 (bước 0.5).' : 'Chấm mỗi tiêu chí theo thang 0-9 (bước 0.5) giống thang IELTS để người học dễ so sánh, và ước tính trình độ CEFR (A1, A2, B1, B2, C1, C2).'}
- Chỉ ra TỐI ĐA 8 lỗi quan trọng nhất (ngữ pháp, từ vựng, collocation, chính tả, liên kết). "original" phải trích NGUYÊN VĂN đoạn ngắn trong bài; "corrected" là bản sửa; "explanation" giải thích ngắn bằng tiếng Việt.
- Nếu bài không phải tiếng Anh hoặc không liên quan đề, cho band thấp và nói rõ trong "overall".
- Mọi nhận xét bằng tiếng Việt, ngắn gọn, cụ thể.

Trả về JSON:
{
  "criteria": [
    ${criteriaSpec}
  ],
  ${isIelts ? '' : '"cefr": "<A1|A2|B1|B2|C1|C2>",\n  '}"overall": "<2-3 câu nhận xét tổng quan tiếng Việt>",
  "strengths": ["<1-3 điểm mạnh>"],
  "mistakes": [{"original":"...","corrected":"...","explanation":"..."}],
  "improvements": ["<2-4 gợi ý cụ thể để tăng điểm>"]
}`;

  try {
    let parsed = null;
    for (let attempt = 0; attempt < 2 && !parsed; attempt++) {
      try {
        const completion = await groq.chat.completions.create({
          model: GROQ_TEXT_MODEL,
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
          temperature: 0.3,
          max_completion_tokens: 3000,
          response_format: { type: 'json_object' },
          ...(GROQ_TEXT_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
        });
        parsed = JSON.parse(completion.choices[0]?.message?.content || 'null');
      } catch (err) {
        // gpt-oss đôi khi trả json_validate_failed -> thử lại 1 lần
        if (attempt === 1) throw err;
      }
    }
    if (!parsed || !Array.isArray(parsed.criteria)) throw new Error('AI trả về sai định dạng');

    const clampBand = (b) => {
      const n = Number(b);
      if (Number.isNaN(n)) return 0;
      return Math.min(9, Math.max(0, Math.round(n * 2) / 2));
    };
    const criteria = info.criteria.map(([key, name]) => {
      const found = parsed.criteria.find((c) => c && c.key === key) || {};
      return { key, name, band: clampBand(found.band), comment: String(found.comment || '') };
    });
    const avg = criteria.reduce((s, c) => s + c.band, 0) / criteria.length;
    // Band từng bài Writing = trung bình 4 tiêu chí, làm tròn XUỐNG về .5 gần nhất (cách chấm Writing của IELTS)
    const overallBand = Math.floor(avg * 2) / 2;
    const str = (x) => (typeof x === 'string' ? x : '');
    const list = (xs, n) => (Array.isArray(xs) ? xs.map(str).filter(Boolean).slice(0, n) : []);

    res.json({
      taskType,
      words,
      overallBand,
      cefr: isIelts ? null : (['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(parsed.cefr) ? parsed.cefr : null),
      criteria,
      overall: str(parsed.overall),
      strengths: list(parsed.strengths, 3),
      improvements: list(parsed.improvements, 4),
      mistakes: (Array.isArray(parsed.mistakes) ? parsed.mistakes : [])
        .filter((m) => m && m.original && m.corrected)
        .slice(0, 8)
        .map((m) => ({ original: str(m.original), corrected: str(m.corrected), explanation: str(m.explanation) })),
      remaining: remainingFor(ip),
    });
  } catch (error) {
    refund();
    console.error('Free writing check error:', error?.message || error);
    const busy = error?.status === 429 || error?.status === 413;
    res.status(busy ? 503 : 500).json({
      error: busy ? 'Hệ thống AI đang quá tải, vui lòng thử lại sau ít phút (lượt này không bị tính).' : 'Không chấm được bài lúc này, vui lòng thử lại (lượt này không bị tính).',
      remaining: remainingFor(ip),
    });
  }
});

module.exports = router;
