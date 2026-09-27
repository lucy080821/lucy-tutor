// IELTS Cambridge book extraction pipeline — see CLAUDE.md's "Module IELTS Cambridge" section
// and the approved plan for the full design.
//
// Three passes, run as fire-and-forget background jobs (same pattern as listening.routes.js's
// processAlignment): Pass 1 finds page-number boundaries for every Test/skill in the book plus
// the shared Answer Key/Audioscript sections (kept deliberately small-output even though the
// input can be a whole 150-250 page book, mirroring — at much larger scale — why
// mockTest.routes.js splits its single generated test into 2 calls). Pass 2 extracts one
// skill's structured content per Test (Reading further splits into one call per passage, since
// it's the largest/riskiest content). Pass 3 matches each Test's Listening/Reading questions
// against the book's own Answer Key text (Writing/Speaking have no fixed answer key).
const { Groq } = require('groq-sdk');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const MODEL = 'llama-3.3-70b-versatile';
// Conservative safety margin for llama-3.3-70b-versatile's context window, leaving room for
// prompt scaffolding + JSON output — a whole Cambridge book easily exceeds this, triggering
// the chunked fallback below.
const PASS1_SINGLE_CALL_TOKEN_LIMIT = 100000;
const CHUNK_PAGE_SIZE = 18;

const READING_QUESTION_TYPES = [
  'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'YES_NO_NOTGIVEN', 'MATCHING_HEADING',
  'MATCHING_INFORMATION', 'MATCHING_FEATURES', 'SUMMARY_COMPLETION', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'
];

function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

function buildPagesText(pages) {
  return pages.map((p) => `[PAGE ${p.num}]\n${p.text}`).join('\n\n');
}

async function callJsonGroq(systemMsg, userPrompt, temperature = 0.2) {
  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemMsg },
      { role: 'user', content: userPrompt }
    ],
    model: MODEL,
    temperature,
    response_format: { type: 'json_object' }
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const STRUCTURE_SYSTEM_MSG = 'You are a precise document-structure analyzer. Respond only in valid JSON, no explanations.';
const EXTRACTOR_SYSTEM_MSG = 'You are a precise IELTS test-content extractor. Respond only in valid JSON, no explanations.';

// ── Pass 1 — whole-book boundary detection ──────────────────────────────────────────────────

async function detectBoundariesSingleCall(pages) {
  const prompt = `Đây là toàn bộ nội dung 1 cuốn sách luyện thi IELTS (Cambridge IELTS), đã được đánh số trang bằng thẻ [PAGE n]. Sách có thể chứa nhiều đề thi (Test 1, Test 2, Test 3, Test 4...), mỗi đề gồm 4 phần: LISTENING, READING, WRITING, SPEAKING. Cuối sách thường có phần "Answer Key" (đáp án Listening + Reading của TẤT CẢ các đề) và phần "Audioscripts" (áp dụng cho tất cả đề).

Nhiệm vụ: CHỈ xác định trang bắt đầu của từng phần, KHÔNG trích xuất nội dung.

Nội dung sách:
"""
${buildPagesText(pages)}
"""

Trả về JSON:
{
  "tests": [
    { "testNumber": 1, "listeningStartPage": <int|null>, "readingStartPage": <int|null>, "writingStartPage": <int|null>, "speakingStartPage": <int|null> }
  ],
  "answerKey": { "startPage": <int|null>, "endPage": <int|null> },
  "audioscript": { "startPage": <int|null>, "endPage": <int|null> }
}`;
  return callJsonGroq(STRUCTURE_SYSTEM_MSG, prompt, 0.1);
}

async function detectBoundariesChunked(pages) {
  const chunks = [];
  for (let i = 0; i < pages.length; i += CHUNK_PAGE_SIZE) {
    chunks.push(pages.slice(i, i + CHUNK_PAGE_SIZE));
  }
  const chunkResults = await Promise.all(chunks.map(async (chunk) => {
    const prompt = `Đây là 1 đoạn trích (nhiều trang liên tiếp) của 1 cuốn sách luyện thi IELTS, đánh số bằng [PAGE n]:
"""
${buildPagesText(chunk)}
"""
Với MỖI trang trong đoạn này, nếu trang đó THỰC SỰ là trang bắt đầu (có tiêu đề rõ ràng, không chỉ nhắc tới tên mục) của: 1 đề thi mới ("Test N"), phần LISTENING/READING/WRITING/SPEAKING của 1 đề, phần "Answer Key", hoặc phần "Audioscripts" — hãy báo lại.

Trả về JSON: { "hits": [ { "page": <int>, "marker": "TEST_N"|"LISTENING"|"READING"|"WRITING"|"SPEAKING"|"ANSWER_KEY"|"AUDIOSCRIPT", "testNumber": <int|null> } ] }`;
    const result = await callJsonGroq(STRUCTURE_SYSTEM_MSG, prompt, 0.1);
    return result?.hits || [];
  }));

  const hits = chunkResults.flat();
  const testsByNumber = {};
  let answerKeyStart = null;
  let audioscriptStart = null;
  hits.forEach((h) => {
    if (h.marker === 'ANSWER_KEY' && answerKeyStart === null) answerKeyStart = h.page;
    else if (h.marker === 'AUDIOSCRIPT' && audioscriptStart === null) audioscriptStart = h.page;
    else if (h.testNumber) {
      if (!testsByNumber[h.testNumber]) testsByNumber[h.testNumber] = { testNumber: h.testNumber };
      const key = { LISTENING: 'listeningStartPage', READING: 'readingStartPage', WRITING: 'writingStartPage', SPEAKING: 'speakingStartPage' }[h.marker];
      if (key) testsByNumber[h.testNumber][key] = h.page;
    }
  });

  const lastPage = pages[pages.length - 1]?.num || 0;
  return {
    tests: Object.values(testsByNumber).sort((a, b) => a.testNumber - b.testNumber),
    answerKey: { startPage: answerKeyStart, endPage: audioscriptStart ? audioscriptStart - 1 : lastPage },
    audioscript: { startPage: audioscriptStart, endPage: audioscriptStart ? lastPage : null }
  };
}

async function detectBookBoundaries(pages) {
  const fullText = buildPagesText(pages);
  if (estimateTokens(fullText) <= PASS1_SINGLE_CALL_TOKEN_LIMIT) {
    const result = await detectBoundariesSingleCall(pages);
    if (result?.tests?.length) return result;
  }
  return detectBoundariesChunked(pages);
}

function sliceRange(pages, start, end) {
  if (!start) return null;
  const lastPage = pages[pages.length - 1]?.num;
  const endNum = end || lastPage;
  return pages.filter((p) => p.num >= start && p.num <= endNum).map((p) => p.text).join('\n\n');
}

// Runs Pass 1 for one IeltsBook and creates one IeltsTest row per detected test. Never throws
// to its caller — failures are recorded on the book row, same defensive posture as
// listening.routes.js's processAlignment.
async function runBoundaryExtraction(bookId) {
  try {
    await prisma.ieltsBook.update({ where: { id: bookId }, data: { extractionStatus: 'EXTRACTING' } });
    const book = await prisma.ieltsBook.findUnique({ where: { id: bookId } });
    if (!book) return;

    const pages = JSON.parse(book.pagesJson || '[]');
    if (!pages.length) throw new Error('Không đọc được nội dung PDF theo trang');

    const boundaries = await detectBookBoundaries(pages);
    if (!boundaries?.tests?.length) throw new Error('Không tìm thấy cấu trúc đề thi (Test 1, Test 2...) nào trong sách');

    const answerKeyText = sliceRange(pages, boundaries.answerKey?.startPage, boundaries.answerKey?.endPage);
    const audioscriptText = sliceRange(pages, boundaries.audioscript?.startPage, boundaries.audioscript?.endPage);

    await prisma.ieltsBook.update({
      where: { id: bookId },
      data: { boundariesJson: JSON.stringify(boundaries), answerKeyText, audioscriptText, extractionStatus: 'BOUNDARIES_EXTRACTED' }
    });

    for (const t of boundaries.tests) {
      if (!t.testNumber) continue;
      await prisma.ieltsTest.upsert({
        where: { bookId_testNumber: { bookId, testNumber: t.testNumber } },
        update: {},
        create: { bookId, testNumber: t.testNumber, title: `Test ${t.testNumber}`, status: 'PENDING_EXTRACTION' }
      });
    }
  } catch (err) {
    console.error('IELTS boundary extraction failed:', err);
    await prisma.ieltsBook.update({ where: { id: bookId }, data: { extractionStatus: 'FAILED', errorMessage: err.message || 'Boundary extraction failed' } }).catch(() => {});
  }
}

// ── Shared helpers for Pass 2/3 ─────────────────────────────────────────────────────────────

// A skill's page span = from its own start page up to (but not including) whichever other
// known section start comes right after it, across ANY test in the book — since a test's
// Reading section (say) butts up against either its own Writing section or the next test
// entirely, depending on how the book is laid out.
function getSkillPageRange(boundaries, testNumber, skillKey, pages) {
  const test = boundaries.tests.find((t) => t.testNumber === testNumber);
  const startPage = test?.[skillKey];
  if (!startPage) return null;

  const allStarts = [];
  boundaries.tests.forEach((t) => {
    ['listeningStartPage', 'readingStartPage', 'writingStartPage', 'speakingStartPage'].forEach((k) => {
      if (t[k]) allStarts.push(t[k]);
    });
  });
  if (boundaries.answerKey?.startPage) allStarts.push(boundaries.answerKey.startPage);
  if (boundaries.audioscript?.startPage) allStarts.push(boundaries.audioscript.startPage);

  const sorted = [...new Set(allStarts)].sort((a, b) => a - b);
  const nextStart = sorted.find((p) => p > startPage);
  const lastPage = pages[pages.length - 1]?.num;
  return { startPage, endPage: nextStart ? nextStart - 1 : lastPage };
}

// Matches a Test's LISTENING or READING questions against the book's own Answer Key text.
// The book's Answer Key repeats "1-10 / 11-20..."-style numbering once PER TEST — the single
// most likely failure mode in this whole pipeline is scoping the wrong test's answer block
// here. This prompt is deliberately explicit about the risk; the teacher review UI's answer
// cross-check screen is the real safety net, not this prompt alone.
async function matchAnswersForSkill(testId, skill) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: testId }, include: { book: true } });
  const questions = await prisma.ieltsQuestion.findMany({ where: { testId, skill }, orderBy: { questionNumber: 'asc' } });
  if (!test?.book?.answerKeyText || !questions.length) return;

  const skillLabel = skill === 'LISTENING' ? 'Listening' : 'Reading';
  const prompt = `Đây là phần Answer Key (đáp án) trích từ 1 cuốn sách luyện thi IELTS — có thể chứa đáp án của NHIỀU đề thi khác nhau, và số câu hỏi (1, 2, 3...) LẶP LẠI theo từng đề. Cần tìm ĐÚNG phần đáp án ${skillLabel} của "Test ${test.testNumber}" — KHÔNG lấy nhầm đáp án của đề khác dù đánh số câu giống nhau.

Answer Key:
"""
${test.book.answerKeyText}
"""

Danh sách câu hỏi ${skillLabel} của Test ${test.testNumber} cần khớp đáp án (kèm dạng câu):
${JSON.stringify(questions.map((q) => ({ questionNumber: q.questionNumber, type: q.type })))}

Với mỗi câu: nếu type là MULTIPLE_CHOICE/TRUE_FALSE/YES_NO_NOTGIVEN/MATCHING_HEADING/MATCHING_INFORMATION/MATCHING_FEATURES/SUMMARY_COMPLETION và đáp án ứng với 1 lựa chọn trong "options" đã trích xuất trước đó, trả correctIndex (số thứ tự lựa chọn, bắt đầu từ 0). Nếu type là FILL_BLANK/SENTENCE_COMPLETION/SHORT_ANSWER, trả correctAnswer (text đáp án đúng) và acceptableAnswers (mảng biến thể chính tả được sách chấp nhận, nếu có ghi — ví dụ "colour"/"color").

Trả về JSON: { "answers": [ { "questionNumber": <int>, "correctIndex": <int|null>, "correctAnswer": "<string|null>", "acceptableAnswers": ["..."] } ] }`;
  const result = await callJsonGroq('You are a precise IELTS answer-key matcher. Respond only in valid JSON, no explanations.', prompt, 0.1);

  for (const a of (result?.answers || [])) {
    if (!a.questionNumber) continue;
    await prisma.ieltsQuestion.updateMany({
      where: { testId, skill, questionNumber: a.questionNumber },
      data: {
        correctIndex: a.correctIndex ?? null,
        correctAnswer: a.correctAnswer || null,
        acceptableAnswers: a.acceptableAnswers?.length ? JSON.stringify(a.acceptableAnswers) : null
      }
    });
  }
}

// ── Pass 2 — READING: passage boundaries + per-passage extraction, then answer matching ────

async function detectReadingPassageBoundaries(pages, range) {
  const spanPages = pages.filter((p) => p.num >= range.startPage && p.num <= range.endPage);
  const prompt = `Đây là phần READING của 1 đề thi IELTS, đánh số trang [PAGE n]:
"""
${buildPagesText(spanPages)}
"""
Xác định mỗi đoạn văn đọc hiểu (reading passage) bắt đầu ở trang nào, và thuộc Section mấy (1, 2, hoặc 3). Đề dạng Academic thường có đúng 1 đoạn văn dài mỗi Section. Đề dạng General Training, Section 1-2 có thể có NHIỀU đoạn văn ngắn hơn trong cùng 1 Section (passageIndex tăng dần: 1, 2, 3...); Section 3 luôn có đúng 1 đoạn dài (passageIndex 1).

Trả về JSON: { "passages": [ { "sectionNumber": <int>, "passageIndex": <int>, "startPage": <int> } ] }`;
  const result = await callJsonGroq(STRUCTURE_SYSTEM_MSG, prompt, 0.1);
  return (result?.passages || []).filter((p) => p.sectionNumber && p.startPage);
}

async function extractReadingPassage(pages, passageRange) {
  const spanPages = pages.filter((p) => p.num >= passageRange.startPage && p.num <= passageRange.endPage);
  const prompt = `Đây là 1 đoạn văn đọc hiểu (Reading Passage) trong đề thi IELTS kèm các câu hỏi đi cùng, đánh số trang [PAGE n]:
"""
${buildPagesText(spanPages)}
"""
Nhiệm vụ:
1. Trích xuất NGUYÊN VĂN đoạn văn đọc hiểu (bodyText) — ghép lại đúng thứ tự câu nếu bài bị ngắt dòng sai do dàn trang nhiều cột.
2. Trích xuất TOÀN BỘ câu hỏi đi cùng đoạn văn này. Mỗi câu gồm: questionNumber (số câu trong đề, ví dụ 1-13), type (chọn đúng 1 trong: ${READING_QUESTION_TYPES.join(', ')}), groupInstruction (hướng dẫn chung nếu câu thuộc 1 nhóm câu hỏi được giới thiệu cùng nhau, ví dụ "Questions 14-18: Complete the summary below" — để trống nếu câu độc lập), promptText (nội dung câu hỏi hoặc câu cần điền), options (mảng các lựa chọn nếu là dạng trắc nghiệm/nối — với dạng nối tiêu đề/thông tin/đặc điểm thì đây là danh sách lựa chọn chung của cả nhóm câu, lặp lại y nguyên cho mỗi câu trong nhóm; để trống nếu là dạng điền từ/trả lời ngắn), wordLimit (ví dụ "NO MORE THAN TWO WORDS", để trống nếu không ghi rõ).
KHÔNG cần điền đáp án đúng ở bước này.

Trả về JSON: { "title": "<tên đoạn văn nếu có, hoặc để trống>", "bodyText": "...", "questions": [ { "questionNumber": <int>, "type": "...", "groupInstruction": "...", "promptText": "...", "options": ["..."], "wordLimit": "..." } ] }`;
  return callJsonGroq(EXTRACTOR_SYSTEM_MSG, prompt, 0.1);
}

// Runs Pass 2 (per-passage extraction) + Pass 3 (answer matching) for one Test's Reading
// content. Throws on failure — callers decide how to record that (see runFullTestExtraction /
// runSingleSkillExtraction below).
async function runReadingExtraction(testId) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: testId }, include: { book: true } });
  if (!test) throw new Error('Không tìm thấy đề');

  const boundaries = JSON.parse(test.book.boundariesJson || '{}');
  const pages = JSON.parse(test.book.pagesJson || '[]');
  const range = getSkillPageRange(boundaries, test.testNumber, 'readingStartPage', pages);
  if (!range) throw new Error('Không xác định được phạm vi trang Reading cho đề này (Pass 1 chưa tìm thấy)');

  const passageBoundaries = await detectReadingPassageBoundaries(pages, range);
  if (!passageBoundaries.length) throw new Error('Không tìm thấy đoạn văn Reading nào trong phạm vi đã xác định');

  const sortedPassages = [...passageBoundaries].sort((a, b) => a.startPage - b.startPage);
  const extracted = await Promise.all(sortedPassages.map((p, i) => {
    const endPage = i + 1 < sortedPassages.length ? sortedPassages[i + 1].startPage - 1 : range.endPage;
    return extractReadingPassage(pages, { startPage: p.startPage, endPage })
      .then((data) => ({ sectionNumber: p.sectionNumber, passageIndex: p.passageIndex || 1, ...data }));
  }));

  for (const p of extracted) {
    if (!p?.bodyText) continue;
    const passageRow = await prisma.ieltsReadingPassage.upsert({
      where: { testId_sectionNumber_passageIndex: { testId, sectionNumber: p.sectionNumber, passageIndex: p.passageIndex } },
      update: { title: p.title || null, bodyText: p.bodyText },
      create: { testId, sectionNumber: p.sectionNumber, passageIndex: p.passageIndex, title: p.title || null, bodyText: p.bodyText }
    });

    for (const q of (p.questions || [])) {
      if (!q.questionNumber) continue;
      const data = {
        readingPassageId: passageRow.id,
        type: READING_QUESTION_TYPES.includes(q.type) ? q.type : 'SHORT_ANSWER',
        groupInstruction: q.groupInstruction || null,
        promptText: q.promptText || '',
        options: q.options?.length ? JSON.stringify(q.options) : null,
        wordLimit: q.wordLimit || null
      };
      await prisma.ieltsQuestion.upsert({
        where: { testId_skill_questionNumber: { testId, skill: 'READING', questionNumber: q.questionNumber } },
        update: data,
        create: { testId, skill: 'READING', questionNumber: q.questionNumber, ...data }
      });
    }
  }

  await matchAnswersForSkill(testId, 'READING');
}

// ── Pass 2 — LISTENING: 1 call for all 4 sections (small enough, no per-section split needed) ─

async function extractListeningSections(pages, range) {
  const spanPages = pages.filter((p) => p.num >= range.startPage && p.num <= range.endPage);
  const prompt = `Đây là phần LISTENING của 1 đề thi IELTS — chỉ có văn bản câu hỏi/form điền (KHÔNG có audio ở đây, audio sẽ được giáo viên gắn riêng), đánh số trang [PAGE n]:
"""
${buildPagesText(spanPages)}
"""
Đề Listening luôn có đúng 4 Section, mỗi Section có 10 câu hỏi (tổng 40 câu, đánh số liên tục 1-40 xuyên suốt cả 4 Section). Với MỖI Section, trích xuất:
- instructions: hướng dẫn chung đầu Section (ví dụ "Questions 1-10. Complete the notes below.")
- questions: toàn bộ câu hỏi, mỗi câu gồm questionNumber, type (1 trong: ${READING_QUESTION_TYPES.join(', ')}), groupInstruction (nếu câu thuộc 1 nhóm), promptText, options (nếu có), wordLimit (ví dụ "ONE WORD ONLY", nếu có).
KHÔNG cần điền đáp án đúng ở bước này.

Trả về JSON: { "sections": [ { "sectionNumber": 1, "instructions": "...", "questions": [ { "questionNumber": 1, "type": "...", "groupInstruction": "...", "promptText": "...", "options": ["..."], "wordLimit": "..." } ] } ] }`;
  return callJsonGroq(EXTRACTOR_SYSTEM_MSG, prompt, 0.1);
}

async function runListeningExtraction(testId) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: testId }, include: { book: true } });
  if (!test) throw new Error('Không tìm thấy đề');

  const boundaries = JSON.parse(test.book.boundariesJson || '{}');
  const pages = JSON.parse(test.book.pagesJson || '[]');
  const range = getSkillPageRange(boundaries, test.testNumber, 'listeningStartPage', pages);
  if (!range) throw new Error('Không xác định được phạm vi trang Listening cho đề này (Pass 1 chưa tìm thấy)');

  const result = await extractListeningSections(pages, range);
  const sections = result?.sections || [];
  if (!sections.length) throw new Error('Không trích xuất được nội dung Listening');

  for (const s of sections) {
    if (!s.sectionNumber) continue;
    const sectionRow = await prisma.ieltsListeningSection.upsert({
      where: { testId_sectionNumber: { testId, sectionNumber: s.sectionNumber } },
      update: { instructions: s.instructions || null },
      create: { testId, sectionNumber: s.sectionNumber, instructions: s.instructions || null }
    });

    for (const q of (s.questions || [])) {
      if (!q.questionNumber) continue;
      const data = {
        listeningSectionId: sectionRow.id,
        type: READING_QUESTION_TYPES.includes(q.type) ? q.type : 'SHORT_ANSWER',
        groupInstruction: q.groupInstruction || null,
        promptText: q.promptText || '',
        options: q.options?.length ? JSON.stringify(q.options) : null,
        wordLimit: q.wordLimit || null
      };
      await prisma.ieltsQuestion.upsert({
        where: { testId_skill_questionNumber: { testId, skill: 'LISTENING', questionNumber: q.questionNumber } },
        update: data,
        create: { testId, skill: 'LISTENING', questionNumber: q.questionNumber, ...data }
      });
    }
  }

  await matchAnswersForSkill(testId, 'LISTENING');
}

// ── Pass 2 — WRITING: 1 call for both tasks (no answer key — nothing to match) ─────────────

async function extractWritingTasks(pages, range) {
  const spanPages = pages.filter((p) => p.num >= range.startPage && p.num <= range.endPage);
  const prompt = `Đây là phần WRITING của 1 đề thi IELTS, đánh số trang [PAGE n]:
"""
${buildPagesText(spanPages)}
"""
Đề Writing luôn có đúng 2 Task. Với MỖI Task, trích xuất promptText (đề bài, nguyên văn) và minWords/timeMinutes theo quy ước IELTS chuẩn: Task 1 = 150 từ / 20 phút, Task 2 = 250 từ / 40 phút (lấy số khác nếu sách ghi rõ khác). Task 1 dạng Academic thường có kèm 1 biểu đồ/bảng/sơ đồ — bạn KHÔNG thấy được hình đó, chỉ trích xuất phần chữ hướng dẫn (ví dụ "The chart below shows..."), giáo viên sẽ tự đính kèm ảnh sau. Nếu là General Training, Task 1 là 1 bức thư, không có hình kèm.

Trả về JSON: { "tasks": [ { "taskNumber": 1, "promptText": "...", "minWords": 150, "timeMinutes": 20 }, { "taskNumber": 2, "promptText": "...", "minWords": 250, "timeMinutes": 40 } ] }`;
  return callJsonGroq(EXTRACTOR_SYSTEM_MSG, prompt, 0.1);
}

async function runWritingExtraction(testId) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: testId }, include: { book: true } });
  if (!test) throw new Error('Không tìm thấy đề');

  const boundaries = JSON.parse(test.book.boundariesJson || '{}');
  const pages = JSON.parse(test.book.pagesJson || '[]');
  const range = getSkillPageRange(boundaries, test.testNumber, 'writingStartPage', pages);
  if (!range) throw new Error('Không xác định được phạm vi trang Writing cho đề này (Pass 1 chưa tìm thấy)');

  const result = await extractWritingTasks(pages, range);
  const tasks = result?.tasks || [];
  if (!tasks.length) throw new Error('Không trích xuất được nội dung Writing');

  for (const t of tasks) {
    if (!t.taskNumber) continue;
    const minWords = t.minWords || (t.taskNumber === 1 ? 150 : 250);
    const timeMinutes = t.timeMinutes || (t.taskNumber === 1 ? 20 : 40);
    await prisma.ieltsWritingTask.upsert({
      where: { testId_taskNumber: { testId, taskNumber: t.taskNumber } },
      update: { promptText: t.promptText || '', minWords, timeMinutes },
      create: { testId, taskNumber: t.taskNumber, promptText: t.promptText || '', minWords, timeMinutes }
    });
  }
}

// ── Pass 2 — SPEAKING: 1 call for all 3 parts (no answer key — nothing to match) ───────────

async function extractSpeakingParts(pages, range) {
  const spanPages = pages.filter((p) => p.num >= range.startPage && p.num <= range.endPage);
  const prompt = `Đây là phần SPEAKING của 1 đề thi IELTS, đánh số trang [PAGE n]:
"""
${buildPagesText(spanPages)}
"""
Đề Speaking luôn có đúng 3 Part. Với MỖI Part, trích xuất instructions (hướng dẫn chung, nếu có) và questions (mảng nội dung — Part 1: vài câu hỏi ngắn về bản thân/chủ đề quen thuộc; Part 2: 1 "cue card" — dòng đầu là chủ đề "Describe...", các dòng sau là gợi ý "You should say:" và từng gạch đầu dòng; Part 3: vài câu hỏi thảo luận sâu hơn liên quan chủ đề Part 2).

Trả về JSON: { "parts": [ { "partNumber": 1, "instructions": "...", "questions": ["...", "..."] }, { "partNumber": 2, "instructions": "...", "questions": ["Describe ...", "You should say:", "- ...", "- ..."] }, { "partNumber": 3, "instructions": "...", "questions": ["...", "..."] } ] }`;
  return callJsonGroq(EXTRACTOR_SYSTEM_MSG, prompt, 0.1);
}

async function runSpeakingExtraction(testId) {
  const test = await prisma.ieltsTest.findUnique({ where: { id: testId }, include: { book: true } });
  if (!test) throw new Error('Không tìm thấy đề');

  const boundaries = JSON.parse(test.book.boundariesJson || '{}');
  const pages = JSON.parse(test.book.pagesJson || '[]');
  const range = getSkillPageRange(boundaries, test.testNumber, 'speakingStartPage', pages);
  if (!range) throw new Error('Không xác định được phạm vi trang Speaking cho đề này (Pass 1 chưa tìm thấy)');

  const result = await extractSpeakingParts(pages, range);
  const parts = result?.parts || [];
  if (!parts.length) throw new Error('Không trích xuất được nội dung Speaking');

  for (const p of parts) {
    if (!p.partNumber) continue;
    await prisma.ieltsSpeakingPart.upsert({
      where: { testId_partNumber: { testId, partNumber: p.partNumber } },
      update: {
        instructions: p.instructions || null,
        questions: JSON.stringify(p.questions || []),
        prepSeconds: p.partNumber === 2 ? 60 : null,
        speakSeconds: p.partNumber === 2 ? 120 : null
      },
      create: {
        testId, partNumber: p.partNumber,
        instructions: p.instructions || null,
        questions: JSON.stringify(p.questions || []),
        prepSeconds: p.partNumber === 2 ? 60 : null,
        speakSeconds: p.partNumber === 2 ? 120 : null
      }
    });
  }
}

// ── Orchestration ────────────────────────────────────────────────────────────────────────────

// Runs all 4 skills' extraction for one Test in parallel (they operate on disjoint page ranges
// and disjoint DB rows, so there's no ordering dependency between them) and sets ONE final
// status based on whether any of them failed. This is what "🤖 Trích xuất đề" in the teacher
// library tab triggers.
async function runFullTestExtraction(testId) {
  const results = await Promise.allSettled([
    runReadingExtraction(testId),
    runListeningExtraction(testId),
    runWritingExtraction(testId),
    runSpeakingExtraction(testId)
  ]);
  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason?.message || String(r.reason));
  await prisma.ieltsTest.update({
    where: { id: testId },
    data: { status: errors.length ? 'NEEDS_ATTENTION' : 'EXTRACTED_DRAFT' }
  }).catch(() => {});
  if (errors.length) console.error(`IELTS extraction had ${errors.length} failure(s) for test ${testId}:`, errors);
}

// Re-runs exactly one skill's extraction — used by the review UI's individual "🔄 Trích xuất
// lại" buttons, which retry a single skill without touching the other 3 already-reviewed ones.
async function runSingleSkillExtraction(testId, skill) {
  const fn = { READING: runReadingExtraction, LISTENING: runListeningExtraction, WRITING: runWritingExtraction, SPEAKING: runSpeakingExtraction }[skill];
  if (!fn) return;
  try {
    await fn(testId);
    await prisma.ieltsTest.update({ where: { id: testId }, data: { status: 'EXTRACTED_DRAFT' } }).catch(() => {});
  } catch (err) {
    console.error(`IELTS ${skill} extraction failed for test ${testId}:`, err);
    await prisma.ieltsTest.update({ where: { id: testId }, data: { status: 'NEEDS_ATTENTION' } }).catch(() => {});
  }
}

module.exports = {
  runBoundaryExtraction,
  runFullTestExtraction,
  runSingleSkillExtraction
};
