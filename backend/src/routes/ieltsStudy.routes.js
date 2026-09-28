// IELTS "Học đề" (study step) + band progress tracking — the two steps that follow "Làm đề"
// (timed test + band, handled by ieltsAttempts.routes.js) for every skill of a Cambridge test:
//   1. POST /:skill/:attemptId/analysis — AI deep-dive into ONE finished attempt: why each wrong
//      answer is wrong and the right one is right (evidence + paraphrase), vocabulary, structures,
//      model answers for Writing/Speaking. Generated once, cached in IeltsStudySession.
//   2. POST /:skill/:attemptId/practice — extra exercises targeting what the student got wrong.
//   3. GET  /progress/:userId — band history per skill + rule-based notifications (no AI).
const express = require('express');
const crypto = require('crypto');
const { Groq } = require('groq-sdk');
const prisma = require('../lib/prisma');
const { roundIeltsBand } = require('../utils/ieltsRounding');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });
const MODEL = GROQ_TEXT_MODEL;

const SKILLS = ['LISTENING', 'READING', 'WRITING', 'SPEAKING'];
const SKILL_LABEL = { LISTENING: 'Listening', READING: 'Reading', WRITING: 'Writing', SPEAKING: 'Speaking' };
const ATTEMPT_MODEL = {
  LISTENING: () => prisma.ieltsListeningAttempt,
  READING: () => prisma.ieltsReadingAttempt,
  WRITING: () => prisma.ieltsWritingAttempt,
  SPEAKING: () => prisma.ieltsSpeakingAttempt
};
// Same free-text types as frontend readingGrading.ts's FILL_TYPES.
const FILL_TYPES = ['FILL_BLANK', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'];
const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'YES_NO_NOTGIVEN', 'MATCHING_HEADING', 'MATCHING_INFORMATION', 'MATCHING_FEATURES', 'SUMMARY_COMPLETION', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'];

async function askJson(system, prompt, temperature = 0.4) {
  const completion = await groq.chat.completions.create({
    messages: [{ role: 'system', content: `${system} Respond only in valid JSON.` }, { role: 'user', content: prompt }],
    model: MODEL,
    temperature,
    response_format: { type: 'json_object' }
  });
  return JSON.parse(completion.choices[0]?.message?.content || '{}');
}

const arr = (v) => (Array.isArray(v) ? v : []);
const parseJson = (s, fallback) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };

// Loads the attempt and checks it belongs to this student — a student can only study their own attempts.
async function loadOwnAttempt(skill, attemptId, userId) {
  if (!SKILLS.includes(skill)) throw Object.assign(new Error('skill không hợp lệ'), { status: 400 });
  if (!userId) throw Object.assign(new Error('Thiếu userId'), { status: 400 });
  const attempt = await ATTEMPT_MODEL[skill]().findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) throw Object.assign(new Error('Không tìm thấy lần làm bài này'), { status: 404 });
  return attempt;
}

function answerLabel(q, answer) {
  if (answer === undefined || answer === null || answer === '') return '(bỏ trống)';
  if (FILL_TYPES.includes(q.type)) return String(answer);
  const options = parseJson(q.options, []);
  return options[answer] ?? String(answer);
}
function correctLabel(q) {
  if (FILL_TYPES.includes(q.type)) return q.correctAnswer || '';
  return parseJson(q.options, [])[q.correctIndex] ?? '';
}

// Best-effort cut of this test's (and this section's) part of the book-wide Audioscript — pure
// string search on "TEST n" / "SECTION k"/"PART k" headings. Returns '' when the headings can't be found.
function sliceBetween(text, startRe, endRe) {
  const start = text.search(startRe);
  if (start < 0) return '';
  const rest = text.slice(start + 1);
  const end = rest.search(endRe);
  return end < 0 ? text.slice(start) : text.slice(start, start + 1 + end);
}
function listeningTranscriptFor(audioscript, testNumber, sectionNumber) {
  if (!audioscript) return '';
  const testText = sliceBetween(audioscript, new RegExp(`TEST\\s*${testNumber}\\b`, 'i'), new RegExp(`TEST\\s*${testNumber + 1}\\b`, 'i')) || '';
  if (!testText) return '';
  const sec = sliceBetween(testText, new RegExp(`(SECTION|PART)\\s*${sectionNumber}\\b`, 'i'), new RegExp(`(SECTION|PART)\\s*${sectionNumber + 1}\\b`, 'i'));
  return (sec || testText).slice(0, 12000);
}

const OBJECTIVE_SECTION_SHAPE = `{
  "overview": "Tóm tắt nội dung phần này bằng tiếng Việt (2-3 câu)",
  "questions": [
    {
      "questionNumber": <số câu>,
      "whyCorrect": "Vì sao đáp án đúng là đúng — giải thích tiếng Việt",
      "whyWrong": "Vì sao đáp án học viên chọn sai (bẫy gì: paraphrase, thông tin gây nhiễu, sai chính tả, quá số từ...). Nếu bỏ trống thì nói cách tìm ra đáp án",
      "evidence": "Câu trích NGUYÊN VĂN tiếng Anh trong bài chứa đáp án",
      "paraphrase": "Cặp diễn đạt tương đương giữa câu hỏi và bài (vd: 'rise sharply' = 'increase dramatically')",
      "tip": "Mẹo ngắn để lần sau không sai dạng này"
    }
  ],
  "vocabulary": [ { "word": "từ/cụm từ tiếng Anh quan trọng trong phần này", "ipa": "/phiên âm/", "partOfSpeech": "n/v/adj/adv/phr", "meaning": "nghĩa tiếng Việt theo ngữ cảnh", "example": "câu ví dụ tiếng Anh (ưu tiên câu trong bài)" } ],
  "structures": [ { "structure": "cấu trúc ngữ pháp/diễn đạt hay xuất hiện trong phần này", "meaning": "giải thích tiếng Việt", "example": "câu ví dụ tiếng Anh" } ],
  "tips": [ "Chiến thuật làm bài cho các dạng câu hỏi trong phần này" ]
}`;

async function analyzeObjectiveSection({ skill, title, sourceLabel, sourceText, questions, answers }) {
  const wrong = questions.filter((q) => !q.correct);
  const questionLines = questions.map((q) => {
    const opts = parseJson(q.options, null);
    return `Câu ${q.questionNumber} [${q.type}]${q.groupInstruction ? ` (${q.groupInstruction})` : ''}: ${q.promptText}` +
      (opts ? `\n  Lựa chọn: ${opts.map((o, i) => `${i}. ${o}`).join(' | ')}` : '') +
      `\n  Đáp án đúng: ${correctLabel(q)} — Học viên trả lời: ${answerLabel(q, answers[q.questionNumber])} — ${q.correct ? 'ĐÚNG' : 'SAI'}`;
  }).join('\n');

  const prompt = `Bạn là giáo viên IELTS ${SKILL_LABEL[skill]} giàu kinh nghiệm, đang giúp học viên người Việt "học đề" sau khi làm xong: ${title}.

${sourceLabel}:
"""
${sourceText || '(không có văn bản gốc — hãy giải thích dựa trên câu hỏi và lựa chọn)'}
"""

Các câu hỏi và kết quả của học viên:
${questionLines}

Yêu cầu:
- "questions": CHỈ giải thích các câu học viên làm SAI hoặc bỏ trống (${wrong.length} câu: ${wrong.map((q) => q.questionNumber).join(', ') || 'không có'}). Không bỏ sót câu sai nào. Nếu không có câu sai thì trả mảng rỗng.
- "vocabulary": 8-12 từ/cụm từ đáng học nhất (ưu tiên từ nằm trong câu chứa đáp án và từ học viên có thể chưa biết).
- "structures": 3-5 cấu trúc.
- "tips": 2-4 mẹo.
Mọi giải thích bằng tiếng Việt, trích dẫn bằng tiếng Anh nguyên văn.

Trả về JSON đúng dạng:
${OBJECTIVE_SECTION_SHAPE}`;

  const parsed = await askJson('You are an expert IELTS teacher explaining a finished test to a Vietnamese learner.', prompt, 0.3);
  const byNumber = new Map(questions.map((q) => [q.questionNumber, q]));
  return {
    title,
    overview: parsed.overview || '',
    questions: arr(parsed.questions)
      .filter((x) => byNumber.has(Number(x.questionNumber)))
      .map((x) => {
        const q = byNumber.get(Number(x.questionNumber));
        return {
          questionNumber: q.questionNumber, type: q.type, promptText: q.promptText,
          userAnswer: answerLabel(q, answers[q.questionNumber]), correctAnswer: correctLabel(q),
          whyCorrect: x.whyCorrect || '', whyWrong: x.whyWrong || '', evidence: x.evidence || '', paraphrase: x.paraphrase || '', tip: x.tip || ''
        };
      }),
    vocabulary: arr(parsed.vocabulary), structures: arr(parsed.structures), tips: arr(parsed.tips)
  };
}

const PRODUCTIVE_SECTION_SHAPE = (answerKey, answerLabelText) => `{
  "overview": "Nhận xét nhanh điểm mạnh / điểm yếu chính (tiếng Việt, 2-4 câu)",
  "errors": [ { "original": "câu/cụm học viên viết/nói sai (trích nguyên văn)", "corrected": "bản sửa đúng", "explanation": "vì sao sai (tiếng Việt)" } ],
  "vocabularyUpgrades": [ { "original": "từ/cụm học viên dùng còn đơn giản", "better": "cách diễn đạt band cao hơn", "explanation": "khi nào dùng (tiếng Việt)" } ],
  "vocabulary": [ { "word": "từ vựng chủ đề nên học", "ipa": "/phiên âm/", "partOfSpeech": "n/v/adj/adv/phr", "meaning": "nghĩa tiếng Việt", "example": "câu ví dụ tiếng Anh" } ],
  "structures": [ { "structure": "cấu trúc nên dùng cho dạng đề này", "meaning": "giải thích tiếng Việt", "example": "câu ví dụ tiếng Anh" } ],
  "outline": [ "Các ý/dàn bài nên có cho đề này (tiếng Việt)" ],
  "${answerKey}": "${answerLabelText}",
  "tips": [ "Mẹo để nâng band ở tiêu chí yếu nhất" ]
}`;

async function analyzeProductive({ skill, title, taskPrompt, studentText, feedback, sampleKey, sampleLabel }) {
  const prompt = `Bạn là giáo viên IELTS ${SKILL_LABEL[skill]} giàu kinh nghiệm, đang giúp học viên người Việt "học đề" sau khi làm xong ${title}.

Đề bài:
"""
${taskPrompt}
"""

${skill === 'SPEAKING' ? 'Transcript câu trả lời của học viên (chuyển từ giọng nói, có thể có lỗi nhận dạng)' : 'Bài viết của học viên'}:
"""
${studentText || '(trống)'}
"""

Nhận xét chấm band trước đó: ${JSON.stringify(feedback || {})}

Yêu cầu: "errors" tối đa 8 lỗi quan trọng nhất (trích đúng câu của học viên), "vocabularyUpgrades" 4-6 mục, "vocabulary" 8-10 từ chủ đề, "structures" 3-5 cấu trúc, "outline" 3-6 ý, "${sampleKey}" bằng tiếng Anh ở mức band 7.5-8, "tips" 2-4 mẹo. Giải thích bằng tiếng Việt.

Trả về JSON đúng dạng:
${PRODUCTIVE_SECTION_SHAPE(sampleKey, sampleLabel)}`;

  const parsed = await askJson('You are an expert IELTS teacher coaching a Vietnamese learner after a practice test.', prompt, 0.4);
  return {
    title,
    overview: parsed.overview || '',
    errors: arr(parsed.errors), vocabularyUpgrades: arr(parsed.vocabularyUpgrades),
    vocabulary: arr(parsed.vocabulary), structures: arr(parsed.structures), outline: arr(parsed.outline),
    modelAnswer: parsed[sampleKey] || '', modelAnswerLabel: skill === 'SPEAKING' ? 'Câu trả lời mẫu' : 'Bài mẫu',
    tips: arr(parsed.tips)
  };
}

async function buildAnalysis(skill, attempt) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: attempt.testId }, select: { id: true, testNumber: true, title: true, bookId: true } });
  if (!test) throw Object.assign(new Error('Đề thi không còn tồn tại'), { status: 404 });

  if (skill === 'READING' || skill === 'LISTENING') {
    const { isIeltsAnswerCorrect } = require('../utils/ieltsAnswerGrading');
    const answers = parseJson(attempt.answers, {});
    const [groups, book] = await Promise.all([
      skill === 'READING'
        ? prisma.ieltsReadingPassage.findMany({ where: { testId: test.id }, orderBy: [{ sectionNumber: 'asc' }, { passageIndex: 'asc' }], include: { questions: { orderBy: { questionNumber: 'asc' } } } })
        : prisma.ieltsListeningSection.findMany({ where: { testId: test.id }, orderBy: { sectionNumber: 'asc' }, include: { questions: { orderBy: { questionNumber: 'asc' } } } }),
      skill === 'LISTENING' ? prisma.ieltsBook.findUnique({ where: { id: test.bookId }, select: { audioscriptText: true } }) : null
    ]);
    const sections = await Promise.all(groups.map((g) => {
      const questions = g.questions.map((q) => ({ ...q, correct: isIeltsAnswerCorrect(q, answers[q.questionNumber]) }));
      const title = skill === 'READING'
        ? `Passage ${g.sectionNumber}${g.passageIndex > 1 ? `.${g.passageIndex}` : ''}${g.title ? ` — ${g.title}` : ''}`
        : `Section ${g.sectionNumber}`;
      return analyzeObjectiveSection({
        skill, title, questions, answers,
        sourceLabel: skill === 'READING' ? 'Bài đọc' : 'Transcript (Audioscript) của phần nghe',
        sourceText: skill === 'READING' ? g.bodyText : listeningTranscriptFor(book?.audioscriptText, test.testNumber, g.sectionNumber)
      });
    }));
    const total = groups.reduce((s, g) => s + g.questions.length, 0);
    return { skill, testTitle: test.title, band: attempt.band, correct: attempt.rawScore, total, wrongCount: total - attempt.rawScore, sections };
  }

  if (skill === 'WRITING') {
    const tasks = await prisma.ieltsWritingTask.findMany({ where: { testId: test.id }, orderBy: { taskNumber: 'asc' } });
    const sections = await Promise.all(tasks.map((t) => analyzeProductive({
      skill, title: `Task ${t.taskNumber}`, taskPrompt: t.promptText,
      studentText: attempt[`task${t.taskNumber}Text`], feedback: parseJson(attempt[`task${t.taskNumber}Feedback`], {}),
      sampleKey: 'modelAnswer', sampleLabel: `Bài mẫu band 7.5-8 hoàn chỉnh bằng tiếng Anh (tối thiểu ${t.minWords} từ)`
    })));
    return { skill, testTitle: test.title, band: attempt.overallBand, sections };
  }

  // SPEAKING
  const parts = await prisma.ieltsSpeakingPart.findMany({ where: { testId: test.id }, orderBy: { partNumber: 'asc' } });
  const sections = await Promise.all(parts.filter((p) => attempt[`part${p.partNumber}Transcript`] !== null && attempt[`part${p.partNumber}Transcript`] !== undefined).map((p) => analyzeProductive({
    skill, title: `Part ${p.partNumber}`, taskPrompt: parseJson(p.questions, []).join('\n'),
    studentText: attempt[`part${p.partNumber}Transcript`], feedback: parseJson(attempt[`part${p.partNumber}Feedback`], {}),
    sampleKey: 'modelAnswer', sampleLabel: p.partNumber === 2 ? 'Bài nói mẫu band 7.5-8 cho cue card (~250 từ, tiếng Anh)' : 'Câu trả lời mẫu band 7.5-8 cho từng câu hỏi (tiếng Anh, ghi rõ câu hỏi trước mỗi câu trả lời)'
  })));
  return { skill, testTitle: test.title, band: attempt.overallBand, sections };
}

// Keeps only questions the frontend grader can actually grade (same rules as readingGrading.ts).
function sanitizePracticeQuestions(questions) {
  return arr(questions).map((q) => ({
    type: QUESTION_TYPES.includes(q.type) ? q.type : 'MULTIPLE_CHOICE',
    question: String(q.question || '').trim(),
    options: Array.isArray(q.options) ? q.options.map(String) : undefined,
    correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : (q.correctIndex !== undefined ? parseInt(q.correctIndex) : undefined),
    correctAnswer: q.correctAnswer ? String(q.correctAnswer) : undefined,
    wordLimit: q.wordLimit ? String(q.wordLimit) : undefined,
    explanation: String(q.explanation || '')
  })).filter((q) => {
    if (!q.question) return false;
    if (FILL_TYPES.includes(q.type)) return !!q.correctAnswer;
    return q.options && q.options.length >= 2 && q.correctIndex >= 0 && q.correctIndex < q.options.length;
  });
}

const PRACTICE_QUESTION_RULES = `Mỗi câu hỏi có dạng:
{ "type": "<một trong: MULTIPLE_CHOICE, TRUE_FALSE, YES_NO_NOTGIVEN, MATCHING_INFORMATION, FILL_BLANK, SENTENCE_COMPLETION, SHORT_ANSWER>",
  "question": "nội dung câu hỏi (tiếng Anh)",
  "options": ["..."],            // BẮT BUỘC với dạng chọn đáp án (TRUE_FALSE: ["True","False","Not Given"], YES_NO_NOTGIVEN: ["Yes","No","Not Given"]); bỏ qua với dạng điền
  "correctIndex": <số, vị trí đáp án đúng trong options, bắt đầu từ 0>,
  "correctAnswer": "đáp án đúng cho dạng điền (FILL_BLANK/SENTENCE_COMPLETION/SHORT_ANSWER)",
  "wordLimit": "vd: NO MORE THAN TWO WORDS (chỉ dạng điền)",
  "explanation": "giải thích đáp án bằng tiếng Việt, trích dẫn bằng chứng" }`;

async function buildPractice(skill, analysis) {
  const sections = arr(analysis.sections);
  if (skill === 'READING' || skill === 'LISTENING') {
    const wrong = sections.flatMap((s) => arr(s.questions));
    const typeCounts = {};
    wrong.forEach((q) => { typeCounts[q.type] = (typeCounts[q.type] || 0) + 1; });
    const weakTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const vocab = sections.flatMap((s) => arr(s.vocabulary)).slice(0, 12).map((v) => v.word).filter(Boolean);
    const isListening = skill === 'LISTENING';
    const prompt = `Tạo 1 bài luyện tập IELTS ${SKILL_LABEL[skill]} ngắn cho học viên người Việt, nhắm đúng vào các câu học viên vừa làm sai.

Các câu học viên làm sai (dạng câu hỏi, và lý do sai):
${wrong.slice(0, 12).map((q) => `- [${q.type}] ${q.promptText} — sai vì: ${q.whyWrong}`).join('\n') || '(không có)'}
Dạng câu hỏi cần luyện nhiều nhất: ${weakTypes.join(', ') || 'MULTIPLE_CHOICE'}
Từ vựng nên lồng ghép: ${vocab.join(', ')}

Yêu cầu:
- ${isListening ? '"script": 1 đoạn hội thoại/độc thoại tiếng Anh 180-250 từ theo phong cách IELTS Listening (sẽ được đọc bằng giọng máy cho học viên nghe, KHÔNG hiện chữ trước khi nộp bài) — dùng thông tin gây nhiễu và paraphrase giống bẫy học viên vừa mắc' : '"passage": 1 đoạn văn học thuật tiếng Anh 250-350 từ phong cách IELTS Reading, có paraphrase và thông tin gây nhiễu giống bẫy học viên vừa mắc'}
- "questions": 8 câu hỏi, ưu tiên các dạng học viên sai nhiều nhất, đáp án phải kiểm chứng được từ ${isListening ? 'script' : 'đoạn văn'}.
${PRACTICE_QUESTION_RULES}

Trả về JSON: { "title": "tiêu đề ngắn tiếng Việt", "instructions": "hướng dẫn làm bài tiếng Việt", "${isListening ? 'script' : 'passage'}": "...", "questions": [ ... ] }`;
    const parsed = await askJson('You are an IELTS materials writer.', prompt, 0.7);
    return {
      title: parsed.title || `Bài luyện thêm ${SKILL_LABEL[skill]}`,
      instructions: parsed.instructions || '',
      passage: isListening ? undefined : String(parsed.passage || ''),
      script: isListening ? String(parsed.script || '') : undefined,
      questions: sanitizePracticeQuestions(parsed.questions)
    };
  }

  // WRITING / SPEAKING — drills built from the student's own errors and vocabulary gaps.
  const errors = sections.flatMap((s) => arr(s.errors)).slice(0, 10);
  const upgrades = sections.flatMap((s) => arr(s.vocabularyUpgrades)).slice(0, 8);
  const structures = sections.flatMap((s) => arr(s.structures)).slice(0, 6);
  const prompt = `Tạo 1 bộ bài tập củng cố cho học viên người Việt vừa làm IELTS ${SKILL_LABEL[skill]}, dựa trên đúng các lỗi của họ.

Lỗi học viên mắc: ${JSON.stringify(errors)}
Từ vựng cần nâng cấp: ${JSON.stringify(upgrades)}
Cấu trúc nên luyện: ${JSON.stringify(structures)}

Yêu cầu "questions": 10 câu, trộn các dạng:
- MULTIPLE_CHOICE "Chọn câu đúng" (1 đáp án đúng + 3 đáp án chứa lỗi giống lỗi học viên hay mắc)
- FILL_BLANK điền từ/collocation band cao vào chỗ trống (dùng "____" trong câu)
- SENTENCE_COMPLETION hoàn thành câu bằng cấu trúc đã học
${PRACTICE_QUESTION_RULES}

Trả về JSON: { "title": "tiêu đề ngắn tiếng Việt", "instructions": "hướng dẫn tiếng Việt", "questions": [ ... ] }`;
  const parsed = await askJson('You are an IELTS teacher designing targeted drills.', prompt, 0.7);
  return {
    title: parsed.title || `Bài tập củng cố ${SKILL_LABEL[skill]}`,
    instructions: parsed.instructions || '',
    questions: sanitizePracticeQuestions(parsed.questions)
  };
}

// ── Progress ─────────────────────────────────────────────────────────────────────────────

router.get('/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const base = { practicedAt: true, test: { select: { title: true, book: { select: { title: true } } } } };
    const [listening, reading, writing, speaking] = await Promise.all([
      prisma.ieltsListeningAttempt.findMany({ where: { userId }, select: { ...base, band: true }, orderBy: { practicedAt: 'asc' } }),
      prisma.ieltsReadingAttempt.findMany({ where: { userId }, select: { ...base, band: true }, orderBy: { practicedAt: 'asc' } }),
      prisma.ieltsWritingAttempt.findMany({ where: { userId }, select: { ...base, overallBand: true }, orderBy: { practicedAt: 'asc' } }),
      prisma.ieltsSpeakingAttempt.findMany({ where: { userId, overallBand: { not: null } }, select: { ...base, overallBand: true }, orderBy: { practicedAt: 'asc' } })
    ]);
    const raw = { LISTENING: listening, READING: reading, WRITING: writing, SPEAKING: speaking };
    const now = Date.now();
    const skills = {};
    for (const skill of SKILLS) {
      const series = raw[skill].map((r) => ({ band: r.band ?? r.overallBand, practicedAt: r.practicedAt, testTitle: `${r.test?.book?.title || ''} ${r.test?.title || ''}`.trim() }));
      const latest = series.at(-1) || null;
      const previous = series.at(-2) || null;
      skills[skill] = {
        count: series.length,
        latest: latest?.band ?? null,
        previous: previous?.band ?? null,
        change: latest && previous ? Math.round((latest.band - previous.band) * 10) / 10 : null,
        best: series.length ? Math.max(...series.map((s) => s.band)) : null,
        lastPracticedAt: latest?.practicedAt ?? null,
        daysSinceLast: latest ? Math.floor((now - new Date(latest.practicedAt).getTime()) / 86400000) : null,
        series
      };
    }

    const practiced = SKILLS.filter((s) => skills[s].count > 0);
    const overall = practiced.length === 4
      ? roundIeltsBand(SKILLS.reduce((sum, s) => sum + skills[s].latest, 0) / 4)
      : null;

    // Rule-based notifications, most important first.
    const notifications = [];
    for (const s of practiced) {
      const k = skills[s];
      const earlierBest = k.count > 1 ? Math.max(...k.series.slice(0, -1).map((x) => x.band)) : null;
      if (k.change !== null && k.change > 0) {
        notifications.push({ level: 'success', skill: s, message: `Band ${SKILL_LABEL[s]} tăng từ ${k.previous.toFixed(1)} lên ${k.latest.toFixed(1)} so với lần làm trước.${earlierBest !== null && k.latest > earlierBest ? ' Đây là band cao nhất của bạn từ trước tới nay!' : ''}` });
      } else if (k.change !== null && k.change < 0) {
        notifications.push({ level: 'warning', skill: s, message: `Band ${SKILL_LABEL[s]} giảm từ ${k.previous.toFixed(1)} xuống ${k.latest.toFixed(1)}. Hãy mở bước "Học đề" của lần làm gần nhất để xem lại các lỗi sai.` });
      }
      if (k.daysSinceLast >= 14) {
        notifications.push({ level: 'warning', skill: s, message: `Đã ${k.daysSinceLast} ngày bạn chưa luyện ${SKILL_LABEL[s]} — luyện đều để giữ phong độ.` });
      }
    }
    if (practiced.length >= 2) {
      const sorted = [...practiced].sort((a, b) => skills[a].latest - skills[b].latest);
      const weakest = sorted[0];
      const strongest = sorted.at(-1);
      if (skills[strongest].latest - skills[weakest].latest >= 1) {
        notifications.push({ level: 'info', skill: weakest, message: `${SKILL_LABEL[weakest]} (band ${skills[weakest].latest.toFixed(1)}) đang là kỹ năng yếu nhất, thấp hơn ${SKILL_LABEL[strongest]} ${(skills[strongest].latest - skills[weakest].latest).toFixed(1)} band — nên ưu tiên luyện thêm.` });
      }
    }
    if (practiced.length > 0 && practiced.length < 4) {
      const missing = SKILLS.filter((s) => !practiced.includes(s)).map((s) => SKILL_LABEL[s]);
      notifications.push({ level: 'info', message: `Bạn chưa làm phần ${missing.join(', ')} lần nào — hoàn thành đủ 4 kỹ năng để có band Overall ước tính.` });
    }
    const rank = { warning: 0, success: 1, info: 2 };
    notifications.sort((a, b) => rank[a.level] - rank[b.level]);

    res.json({ skills, overall, notifications });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Study session ────────────────────────────────────────────────────────────────────────

function shapeSession(session) {
  if (!session) return { analysis: null, practice: [] };
  return { id: session.id, analysis: parseJson(session.analysis, null), practice: parseJson(session.practice, []) };
}

router.get('/:skill/:attemptId', async (req, res) => {
  try {
    const { skill, attemptId } = req.params;
    await loadOwnAttempt(skill, attemptId, req.query.userId);
    const session = await prisma.ieltsStudySession.findUnique({ where: { skill_attemptId: { skill, attemptId } } });
    res.json(shapeSession(session));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:skill/:attemptId/analysis', async (req, res) => {
  try {
    const { skill, attemptId } = req.params;
    const { userId } = req.body;
    const [attempt, existing] = await Promise.all([
      loadOwnAttempt(skill, attemptId, userId),
      prisma.ieltsStudySession.findUnique({ where: { skill_attemptId: { skill, attemptId } } })
    ]);
    if (existing?.analysis) return res.json(shapeSession(existing)); // generated once, reused

    const analysis = await buildAnalysis(skill, attempt);
    const session = await prisma.ieltsStudySession.upsert({
      where: { skill_attemptId: { skill, attemptId } },
      update: { analysis: JSON.stringify(analysis) },
      create: { userId, testId: attempt.testId, skill, attemptId, analysis: JSON.stringify(analysis) }
    });
    res.json(shapeSession(session));
  } catch (err) {
    console.error('IELTS study analysis failed:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Không thể phân tích bài làm lúc này, vui lòng thử lại.' });
  }
});

router.post('/:skill/:attemptId/practice', async (req, res) => {
  try {
    const { skill, attemptId } = req.params;
    const { userId } = req.body;
    const [, session] = await Promise.all([
      loadOwnAttempt(skill, attemptId, userId),
      prisma.ieltsStudySession.findUnique({ where: { skill_attemptId: { skill, attemptId } } })
    ]);
    const analysis = parseJson(session?.analysis, null);
    if (!analysis) return res.status(400).json({ error: 'Hãy phân tích bài làm (Học đề) trước khi tạo bài tập' });

    const set = await buildPractice(skill, analysis);
    if (!set.questions.length) return res.status(502).json({ error: 'AI chưa tạo được bài tập hợp lệ, vui lòng thử lại.' });
    const practice = [...parseJson(session.practice, []), { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...set }];
    const updated = await prisma.ieltsStudySession.update({ where: { id: session.id }, data: { practice: JSON.stringify(practice) } });
    res.json(shapeSession(updated));
  } catch (err) {
    console.error('IELTS practice generation failed:', err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Không thể tạo bài tập lúc này, vui lòng thử lại.' });
  }
});

router.post('/:skill/:attemptId/practice/:setId/result', async (req, res) => {
  try {
    const { skill, attemptId, setId } = req.params;
    const { userId, answers, score, total } = req.body;
    const [, session] = await Promise.all([
      loadOwnAttempt(skill, attemptId, userId),
      prisma.ieltsStudySession.findUnique({ where: { skill_attemptId: { skill, attemptId } } })
    ]);
    if (!session) return res.status(404).json({ error: 'Không tìm thấy buổi học đề' });
    const practice = parseJson(session.practice, []).map((p) => (p.id === setId
      ? { ...p, answers: answers || {}, score: Number(score) || 0, total: Number(total) || 0, completedAt: new Date().toISOString() }
      : p));
    const updated = await prisma.ieltsStudySession.update({ where: { id: session.id }, data: { practice: JSON.stringify(practice) } });
    res.json(shapeSession(updated));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

module.exports = router;
