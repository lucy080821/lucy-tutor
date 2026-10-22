// AI cho Lucy Notes (mount /api/notes-ai). 5 nhóm tính năng — xem CLAUDE.md mục "Lucy Notes":
//  1. Lệnh AI trong trang (tóm tắt, viết lại, dịch, chuyển thành checklist/bảng...), ghi chú → flashcard SRS /
//     quiz / ôn kiểu Feynman / sơ đồ tư duy, nhật ký tiếng Anh + hồ sơ lỗi cá nhân, từ có thể chưa biết
//  2. Ghi âm → ghi chú có mốc thời gian, chụp vở (OCR ở trình duyệt) → trang sạch, rút việc cần làm + ngày hạn
//  3. Hỏi sổ ghi chú có trích dẫn, gợi ý liên kết, phân loại hộp thư ghi nhanh, xem song ngữ
//  4. Sổ lớp thông minh cho giáo viên (ghi chú → bài học/đề thi, nhận xét phụ huynh, lỗ hổng của lớp), bản tin tuần
//  5. Trợ lý thao tác bằng lời: lập kế hoạch → xem trước → thực hiện → hoàn tác
// Nguyên tắc: AI chỉ trả kết quả để người dùng bấm "Chèn/Áp dụng", không tự ghi đè trang; mỗi lệnh trừ hạn mức
// (NoteAiUsage), lượt lỗi được hoàn lại; sổ bật "Tắt AI" thì không gửi nội dung của sổ đó cho AI.
const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const sanitizeHtml = require('sanitize-html');
const { toFile } = require('groq-sdk');
const {
  prisma, groq, httpError, normalizeSearch, loadNoteUser, loadNoteActor, requireAccount, sanitizeDoc, docBlocks, contentHash,
  aiUsage, consumeAi, askJson, uploadNoteFile, removeNoteFiles, ownPage, aiDisabledForPage, sendError, vnDay,
} = require('../utils/notesCore');
const { helpers } = require('./notes.routes');

const router = express.Router();
const uid = (req) => req.query.userId || req.body?.userId;
const str = (v, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const arr = (v) => (Array.isArray(v) ? v : []);
const MAX_INPUT = 12000;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 24 * 1024 * 1024 }, // Whisper trên Groq nhận tối đa 25MB
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm' ? cb(null, true) : cb(new Error('Chỉ nhận file ghi âm'))),
});

// HTML AI trả về được lọc chặt trước khi chèn vào trình soạn (Tiptap chỉ hiểu các thẻ này)
const cleanHtml = (html) => sanitizeHtml(String(html || ''), {
  allowedTags: ['p', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'br', 'hr', 'mark', 'div', 'label', 'input'],
  allowedAttributes: { a: ['href'], ul: ['data-type'], li: ['data-type', 'data-checked'], div: ['data-callout'], input: ['type', 'checked'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
}).slice(0, 60000);
const escapeHtml = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Chạy 1 tác vụ AI: trừ hạn mức trước, hoàn lại nếu lỗi. */
async function withQuota(user, fn, kind = 'TEXT') {
  const refund = await consumeAi(user, kind);
  try {
    return await fn();
  } catch (err) {
    await refund();
    if (err.status) throw err;
    console.error('[notes-ai]', err?.message || err);
    throw httpError(502, 'AI đang bận hoặc gặp lỗi, vui lòng thử lại sau ít phút');
  }
}

/** Trang của chính người dùng + kiểm tra "Tắt AI cho sổ này". Khách (ghi chú nằm trên trình duyệt) gửi kèm
 *  nội dung trang: body.title, body.text (chữ thuần), body.doc (JSON Tiptap, tuỳ chọn) — trả về "trang ảo" không lưu DB. */
async function aiPage(user, pageId, body = {}) {
  if (user.guest) {
    const plainText = str(body.text, MAX_INPUT * 2);
    if (plainText.length < 10) throw httpError(400, 'Trang còn quá ít nội dung để AI xử lý');
    return { id: null, title: str(body.title, 300), plainText, contentJson: body.doc ? sanitizeDoc(body.doc) : null, linkedPageIds: [], aiCache: null };
  }
  const page = await ownPage(user.id, pageId);
  if (await aiDisabledForPage(page)) throw httpError(403, 'Sổ tay này đang tắt AI. Bật lại trong cài đặt sổ tay nếu muốn dùng.');
  return page;
}

/** Nội dung đầu vào: đoạn đang chọn (text) hoặc cả trang (pageId). */
async function inputText(user, body) {
  if (body.text && String(body.text).trim()) return { text: String(body.text).slice(0, MAX_INPUT), page: body.pageId && !user.guest ? await aiPage(user, body.pageId) : null };
  if (!body.pageId) throw httpError(400, 'Thiếu nội dung');
  const page = await aiPage(user, body.pageId);
  const text = `${page.title ? `# ${page.title}\n` : ''}${page.plainText}`.trim();
  if (text.length < 10) throw httpError(400, 'Trang còn quá ít nội dung để AI xử lý');
  return { text: text.slice(0, MAX_INPUT), page };
}

/** Cache kết quả AI theo hash nội dung trang — trang chưa đổi thì không gọi AI lại. */
async function cached(page, key, compute) {
  if (!page.id) return compute(); // trang của khách không lưu server → không cache
  const hash = contentHash(page.title, page.plainText);
  const cache = page.aiCache && typeof page.aiCache === 'object' ? page.aiCache : {};
  if (cache[key]?.hash === hash) return { ...cache[key].data, cached: true };
  const data = await compute();
  const next = { ...cache, [key]: { hash, data } };
  await prisma.notePage.update({ where: { id: page.id }, data: { aiCache: next } }).catch(() => {});
  return data;
}

const LANG_RULE = 'Trả lời bằng cùng ngôn ngữ với nội dung gốc (nội dung tiếng Việt thì trả lời tiếng Việt, tiếng Anh thì tiếng Anh), trừ khi được yêu cầu dịch.';
const HTML_RULE = 'Trường "html" là HTML đơn giản, chỉ dùng các thẻ <p>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <table>, <tr>, <th>, <td>, <blockquote>. Không markdown, không ```.';

// ═══ ĐỢT 1 — Lệnh AI trong trang ═══════════════════════════════════════════════════════════
const COMMANDS = {
  summarize: 'Tóm tắt nội dung thành tối đa 5 ý chính dạng danh sách gạch đầu dòng, sau đó 1 câu kết luận ngắn.',
  rewrite_concise: 'Viết lại cho ngắn gọn, rõ ràng hơn, giữ nguyên ý.',
  rewrite_formal: 'Viết lại theo văn phong trang trọng, chuyên nghiệp.',
  rewrite_friendly: 'Viết lại theo văn phong thân thiện, gần gũi.',
  rewrite_simple: 'Viết lại thật dễ hiểu cho học sinh, câu ngắn, giải thích từ khó.',
  expand: 'Viết dài hơn: bổ sung giải thích, ví dụ cụ thể, giữ đúng ý gốc.',
  shorten: 'Rút gọn còn khoảng một nửa độ dài, giữ ý quan trọng nhất.',
  translate_en: 'Dịch sang tiếng Anh tự nhiên, giữ nguyên định dạng danh sách/tiêu đề.',
  translate_vi: 'Dịch sang tiếng Việt tự nhiên, giữ nguyên định dạng danh sách/tiêu đề.',
  checklist: 'Tách nội dung thành danh sách việc cần làm cụ thể. Trả về đúng dạng <ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p>Việc...</p></li></ul>.',
  table: 'Chuyển nội dung thành 1 bảng HTML có hàng tiêu đề <th>, chọn các cột hợp lý nhất.',
  outline: 'Lập dàn ý có cấu trúc: tiêu đề <h3> cho từng phần, ý con dạng danh sách.',
  continue: 'Viết tiếp nội dung một cách tự nhiên khoảng 1-2 đoạn, cùng giọng văn, không lặp lại phần đã có.',
  explain: 'Giải thích nội dung này cho người học: khái niệm chính, ví dụ minh hoạ, lỗi hay gặp. Nếu là kiến thức tiếng Anh thì giải thích bằng tiếng Việt kèm ví dụ tiếng Anh.',
};

router.post('/command', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const action = String(req.body.action || '');
    const custom = str(req.body.prompt, 500);
    if (!COMMANDS[action] && !(action === 'custom' && custom)) throw httpError(400, 'Lệnh AI không hợp lệ');
    const { text } = await inputText(user, req.body);
    const data = await withQuota(user, () => askJson(
      `You are a writing assistant inside a note-taking app for Vietnamese users. ${LANG_RULE} ${HTML_RULE}`,
      `Yêu cầu: ${action === 'custom' ? custom : COMMANDS[action]}\n\nNội dung:\n"""\n${text}\n"""\n\nTrả về JSON {"html": "..."}`,
      { temperature: action === 'continue' ? 0.7 : 0.4 },
    ));
    const html = cleanHtml(data.html);
    if (!html) throw httpError(502, 'AI không trả về nội dung, vui lòng thử lại');
    res.json({ html });
  } catch (err) { sendError(res, err, 'command'); }
});

router.post('/title-tags', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text } = await inputText(user, req.body);
    const data = await withQuota(user, () => askJson(
      'You name and tag notes for a Vietnamese note-taking app.',
      `Đặt tiêu đề ngắn (≤ 60 ký tự, cùng ngôn ngữ nội dung) và 2-4 thẻ chữ thường không dấu, nối bằng gạch ngang cho nội dung sau.\n"""\n${text.slice(0, 4000)}\n"""\nJSON: {"title": "...", "tags": ["..."]}`,
    ));
    res.json({ title: str(data.title, 120), tags: arr(data.tags).map((t) => normalizeSearch(t).replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).slice(0, 4) });
  } catch (err) { sendError(res, err, 'title-tags'); }
});

// ── Ghi chú → flashcard SRS ─────────────────────────────────────────────────────────────────
router.post('/flashcards', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text } = await inputText(user, req.body);
    const data = await withQuota(user, () => askJson(
      'You extract study flashcards from notes for Vietnamese learners of English.',
      `Từ ghi chú dưới đây, rút ra tối đa 25 thẻ học. Ưu tiên từ/cụm từ tiếng Anh đáng học (kèm nghĩa tiếng Việt theo ngữ cảnh). Nếu ghi chú không phải tiếng Anh thì rút khái niệm quan trọng: "word" = thuật ngữ, "meaning" = định nghĩa ngắn.
Ghi chú:
"""
${text}
"""
JSON: {"cards": [{"word": "...", "meaning": "nghĩa tiếng Việt ngắn gọn", "phonetic": "IPA /.../ hoặc rỗng", "pos": "n./v./adj./... hoặc rỗng", "example": "câu ví dụ (ưu tiên lấy từ ghi chú) hoặc rỗng"}]}`,
    ));
    const seen = new Set();
    const cards = arr(data.cards).map((c) => ({
      word: str(c.word, 120), meaning: str(c.meaning, 300), phonetic: str(c.phonetic, 80), pos: str(c.pos, 20), example: str(c.example, 400),
    })).filter((c) => c.word && c.meaning && !seen.has(c.word.toLowerCase()) && seen.add(c.word.toLowerCase())).slice(0, 25);
    // Đánh dấu từ đã có trong deck SRS để học viên không thêm trùng
    let existing = new Set();
    if (user.role === 'STUDENT' && cards.length) {
      const rows = await prisma.userVocabProgress.findMany({ where: { userId: user.id }, select: { vocab: { select: { word: true } } } });
      existing = new Set(rows.map((r) => r.vocab.word.trim().toLowerCase()));
    }
    res.json({ cards: cards.map((c) => ({ ...c, inDeck: existing.has(c.word.toLowerCase()) })) });
  } catch (err) { sendError(res, err, 'flashcards'); }
});

// Lưu thẻ đã chọn vào deck SRS (cùng bảng với "Từ Của Tôi" ở /gym) — 2 lệnh createMany thay vì N lần gọi API
router.post('/flashcards/save', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Đưa thẻ vào deck ôn tập SRS');
    if (user.role !== 'STUDENT') throw httpError(403, 'Deck ôn tập SRS dành cho tài khoản học viên');
    const rows = await prisma.userVocabProgress.findMany({ where: { userId: user.id }, select: { vocab: { select: { word: true } } } });
    const existing = new Set(rows.map((r) => r.vocab.word.trim().toLowerCase()));
    const cards = arr(req.body.cards).map((c) => ({
      word: str(c.word, 120), meaning: str(c.meaning, 300), phonetic: str(c.phonetic, 80) || null, pos: str(c.pos, 20) || null, example: str(c.example, 400) || null,
    })).filter((c) => c.word && c.meaning && !existing.has(c.word.toLowerCase())).slice(0, 100);
    if (!cards.length) return res.json({ added: 0 });
    const vocab = cards.map((c) => ({ ...c, id: crypto.randomUUID(), addedByUserId: user.id }));
    const now = new Date();
    await prisma.$transaction([
      prisma.vocabItem.createMany({ data: vocab }),
      prisma.userVocabProgress.createMany({
        data: vocab.map((v) => ({ userId: user.id, vocabId: v.id, status: 'LEARNING', nextReviewDate: now, interval: 0, easeFactor: 2.5, repetitions: 0 })),
      }),
    ]);
    res.json({ added: vocab.length });
  } catch (err) { sendError(res, err, 'flashcards save'); }
});

// ── Quiz từ trang (khuôn ReadingQuestion → chấm ở client bằng isReadingAnswerCorrect) ──────────
const QUIZ_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK', 'SHORT_ANSWER'];
function cleanQuestion(q) {
  const type = QUIZ_TYPES.includes(q?.type) ? q.type : 'MULTIPLE_CHOICE';
  const question = str(q?.question, 600);
  const explanation = str(q?.explanation, 800);
  if (!question) return null;
  if (type === 'FILL_BLANK' || type === 'SHORT_ANSWER') {
    const correctAnswer = str(q.correctAnswer, 120);
    return correctAnswer ? { type, question, correctAnswer, explanation } : null;
  }
  const options = type === 'TRUE_FALSE' ? ['True', 'False'] : arr(q.options).map((o) => str(o, 300)).filter(Boolean).slice(0, 5);
  const correctIndex = Number(q.correctIndex);
  if (options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null;
  return { type, question, options, correctIndex, explanation };
}

router.post('/quiz', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const page = await aiPage(user, req.body.pageId, req.body);
    if (page.plainText.length < 80) throw httpError(400, 'Trang cần nhiều nội dung hơn để tạo câu hỏi');
    const fresh = !!req.body.fresh;
    const compute = () => withQuota(user, () => askJson(
      'You write review quizzes from a learner\'s own notes.',
      `Tạo 8 câu hỏi ôn tập CHỈ dựa trên ghi chú dưới đây (không hỏi kiến thức ngoài ghi chú). Trộn các dạng: MULTIPLE_CHOICE (4 lựa chọn), TRUE_FALSE, FILL_BLANK (điền 1-3 từ), SHORT_ANSWER. Câu hỏi và giải thích viết cùng ngôn ngữ với ghi chú (ghi chú học tiếng Anh thì câu hỏi tiếng Anh, giải thích tiếng Việt).
Ghi chú "${page.title}":
"""
${page.plainText.slice(0, MAX_INPUT)}
"""
JSON: {"questions": [{"type": "MULTIPLE_CHOICE|TRUE_FALSE|FILL_BLANK|SHORT_ANSWER", "question": "...", "options": ["..."] (chỉ với MULTIPLE_CHOICE), "correctIndex": 0 (MULTIPLE_CHOICE/TRUE_FALSE, True=0 False=1), "correctAnswer": "..." (FILL_BLANK/SHORT_ANSWER), "explanation": "vì sao, trích ý trong ghi chú"}]}`,
    )).then((d) => ({ questions: arr(d.questions).map(cleanQuestion).filter(Boolean) }));
    const data = fresh ? await compute() : await cached(page, 'quiz', compute);
    if (!data.questions.length) throw httpError(502, 'AI chưa tạo được câu hỏi, vui lòng thử lại');
    res.json(data);
  } catch (err) { sendError(res, err, 'quiz'); }
});

// ── Ôn kiểu Feynman: AI hỏi → người học giải thích lại → AI chỉ ra chỗ hiểu sai/thiếu ─────────
router.post('/feynman', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const page = await aiPage(user, req.body.pageId, req.body);
    const notes = page.plainText.slice(0, MAX_INPUT);
    if (req.body.mode === 'grade') {
      const question = str(req.body.question, 600);
      const answer = str(req.body.answer, 3000);
      if (!question || answer.length < 5) throw httpError(400, 'Hãy viết câu giải thích của bạn');
      const data = await withQuota(user, () => askJson(
        'You are a patient tutor using the Feynman technique. Reply in Vietnamese.',
        `Ghi chú gốc của người học:\n"""\n${notes}\n"""\nCâu hỏi: ${question}\nNgười học giải thích lại: """${answer}"""\nĐánh giá dựa trên ghi chú. JSON: {"verdict": "GOOD|PARTIAL|WRONG", "score": 0-10, "correct": ["ý đúng"], "misconceptions": ["chỗ hiểu sai + sửa lại"], "missing": ["ý quan trọng còn thiếu"], "betterAnswer": "câu trả lời mẫu ngắn gọn"}`,
      ));
      return res.json({
        verdict: ['GOOD', 'PARTIAL', 'WRONG'].includes(data.verdict) ? data.verdict : 'PARTIAL',
        score: Math.max(0, Math.min(10, Number(data.score) || 0)),
        correct: arr(data.correct).map((s) => str(s, 400)).filter(Boolean),
        misconceptions: arr(data.misconceptions).map((s) => str(s, 400)).filter(Boolean),
        missing: arr(data.missing).map((s) => str(s, 400)).filter(Boolean),
        betterAnswer: str(data.betterAnswer, 1500),
      });
    }
    const data = await withQuota(user, () => askJson(
      'You are a tutor using the Feynman technique. Reply in Vietnamese.',
      `Dựa trên ghi chú dưới đây, đặt 1 câu hỏi mở yêu cầu người học GIẢI THÍCH LẠI bằng lời của mình một ý quan trọng (không hỏi thuộc lòng). Tránh lặp lại các câu đã hỏi: ${arr(req.body.asked).map((q) => str(q, 200)).join(' | ') || '(chưa có)'}.\n"""\n${notes}\n"""\nJSON: {"question": "..."}`,
      { temperature: 0.7 },
    ));
    res.json({ question: str(data.question, 600) });
  } catch (err) { sendError(res, err, 'feynman'); }
});

// ── Sơ đồ tư duy (chèn thành khối mindmap trong trang, sửa nhãn được) ─────────────────────────
function cleanTree(node, depth = 0) {
  if (!node || depth > 4) return null;
  const label = str(node.label, 80);
  if (!label) return null;
  const children = depth < 3 ? arr(node.children).map((c) => cleanTree(c, depth + 1)).filter(Boolean).slice(0, 8) : [];
  return { label, children };
}
router.post('/mindmap', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text } = await inputText(user, req.body);
    const data = await withQuota(user, () => askJson(
      `You turn notes into concise mind maps. ${LANG_RULE}`,
      `Lập sơ đồ tư duy cho nội dung dưới đây: 1 nút gốc (chủ đề chính), 3-7 nhánh chính, mỗi nhánh 0-5 ý con, nhãn ngắn ≤ 6 từ.\n"""\n${text}\n"""\nJSON: {"root": {"label": "...", "children": [{"label": "...", "children": [{"label": "..."}]}]}}`,
    ));
    const root = cleanTree(data.root);
    if (!root) throw httpError(502, 'AI chưa tạo được sơ đồ, vui lòng thử lại');
    res.json({ root });
  } catch (err) { sendError(res, err, 'mindmap'); }
});

// ── Ôn lại trang theo đường cong quên (không gọi AI) ────────────────────────────────────────
const STUDY_STEPS = [1, 3, 7, 14, 30, 60];
router.post('/study/:pageId/review', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Lịch ôn trên máy chủ');
    const page = await ownPage(user.id, req.params.pageId, { id: true, studyStep: true });
    const grade = req.body.grade;
    let step = page.studyStep;
    if (grade === 'again') step = 0;
    else if (grade === 'easy') step += 2;
    else step += 1;
    const done = step >= STUDY_STEPS.length;
    const days = grade === 'again' ? 1 : STUDY_STEPS[Math.min(step, STUDY_STEPS.length - 1)];
    const studyDueAt = done ? null : new Date(Date.now() + days * 86400_000);
    await prisma.notePage.update({ where: { id: page.id }, data: { studyStep: done ? 0 : step, studyDueAt } });
    res.json({ studyDueAt, done, days });
  } catch (err) { sendError(res, err, 'study review'); }
});

// ── Nhật ký tiếng Anh: sửa lỗi + nâng cấp từ vựng + ghi vào hồ sơ lỗi cá nhân ───────────────
const ERROR_CATEGORIES = ['Chia động từ', 'Thì', 'Mạo từ', 'Giới từ', 'Số ít/số nhiều', 'Trật tự từ', 'Từ vựng/collocation', 'Chính tả', 'Dấu câu', 'Cấu trúc câu', 'Khác'];
router.post('/journal/correct', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text, page } = await inputText(user, req.body);
    const level = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(req.body.level) ? req.body.level : 'B1';
    const data = await withQuota(user, () => askJson(
      'You are an English writing coach for Vietnamese learners. Explanations in Vietnamese.',
      `Sửa lỗi tiếng Anh trong bài dưới đây (bỏ qua phần tiếng Việt nếu có). Chỉ liệt kê lỗi thật, mỗi lỗi 1 dòng. Phân loại mỗi lỗi vào đúng 1 nhóm: ${ERROR_CATEGORIES.join(', ')}.
Sau đó gợi ý tối đa 6 nâng cấp từ vựng cao hơn 1 bậc so với trình độ ${level} (từ/cụm học viên đã dùng → từ hay hơn, ghi cấp CEFR).
Bài viết:
"""
${text}
"""
JSON: {"corrections": [{"original": "câu/cụm gốc nguyên văn", "corrected": "bản sửa", "explanation": "giải thích ngắn tiếng Việt", "category": "..."}], "upgrades": [{"from": "...", "to": "...", "level": "B2", "example": "câu ví dụ"}], "summary": "nhận xét chung 1-2 câu"}`,
      { temperature: 0.2 },
    ));
    const corrections = arr(data.corrections).map((c) => ({
      original: str(c.original, 500), corrected: str(c.corrected, 500), explanation: str(c.explanation, 500),
      category: ERROR_CATEGORIES.includes(c.category) ? c.category : 'Khác',
    })).filter((c) => c.original && c.corrected && c.original !== c.corrected).slice(0, 40);
    const upgrades = arr(data.upgrades).map((u) => ({ from: str(u.from, 120), to: str(u.to, 120), level: str(u.level, 4), example: str(u.example, 300) }))
      .filter((u) => u.from && u.to).slice(0, 6);
    if (corrections.length && !user.guest) {
      await prisma.noteWritingError.createMany({ data: corrections.map((c) => ({ ...c, userId: user.id, pageId: page?.id || null })) });
    }
    res.json({ corrections, upgrades, summary: str(data.summary, 600) });
  } catch (err) { sendError(res, err, 'journal'); }
});

// Hồ sơ lỗi: 30 ngày gần nhất so với 30 ngày trước đó (không gọi AI)
router.get('/journal/profile', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    if (user.guest) return res.json({ total: 0, categories: [], guest: true });
    const now = Date.now();
    const d30 = new Date(now - 30 * 86400_000);
    const d60 = new Date(now - 60 * 86400_000);
    const [current, previous, recent] = await Promise.all([
      prisma.noteWritingError.groupBy({ by: ['category'], where: { userId: user.id, createdAt: { gte: d30 } }, _count: { id: true } }),
      prisma.noteWritingError.groupBy({ by: ['category'], where: { userId: user.id, createdAt: { gte: d60, lt: d30 } }, _count: { id: true } }),
      prisma.noteWritingError.findMany({ where: { userId: user.id, createdAt: { gte: d30 } }, orderBy: { createdAt: 'desc' }, take: 60, select: { category: true, original: true, corrected: true, explanation: true, createdAt: true } }),
    ]);
    const prev = Object.fromEntries(previous.map((r) => [r.category, r._count.id]));
    const categories = current.map((r) => ({ category: r.category, count: r._count.id, previous: prev[r.category] || 0 }))
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, examples: recent.filter((e) => e.category === c.category).slice(0, 3) }));
    res.json({ total: categories.reduce((s, c) => s + c.count, 0), categories });
  } catch (err) { sendError(res, err, 'journal profile'); }
});

// ── Từ có thể chưa biết trong 1 đoạn tiếng Anh (lọc bỏ từ đã có trong deck SRS) ──────────────
router.post('/unknown-words', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text } = await inputText(user, req.body);
    const level = ['A1', 'A2', 'B1', 'B2', 'C1'].includes(req.body.level) ? req.body.level : 'B1';
    const [data, deck] = await Promise.all([
      withQuota(user, () => askJson(
        'You identify vocabulary above a learner\'s CEFR level.',
        `Người học ở trình độ ${level}. Chọn tối đa 20 từ/cụm từ tiếng Anh trong đoạn dưới đây có khả năng CAO HƠN trình độ này (bỏ qua tên riêng, từ cơ bản). Giữ đúng dạng xuất hiện trong bài ở "surface".
"""
${text}
"""
JSON: {"words": [{"surface": "dạng trong bài", "word": "dạng từ điển", "level": "B2", "meaning": "nghĩa tiếng Việt theo ngữ cảnh", "phonetic": "/.../", "pos": "n./v./adj."}]}`,
        { temperature: 0.2 },
      )),
      user.role === 'STUDENT' ? prisma.userVocabProgress.findMany({ where: { userId: user.id }, select: { vocab: { select: { word: true } } } }) : [],
    ]);
    const known = new Set(deck.map((r) => r.vocab.word.trim().toLowerCase()));
    const words = arr(data.words).map((w) => ({
      surface: str(w.surface, 80), word: str(w.word, 80), level: str(w.level, 4), meaning: str(w.meaning, 200), phonetic: str(w.phonetic, 60), pos: str(w.pos, 12),
    })).filter((w) => w.word && w.meaning && text.toLowerCase().includes((w.surface || w.word).toLowerCase()) && !known.has(w.word.toLowerCase())).slice(0, 20);
    res.json({ words });
  } catch (err) { sendError(res, err, 'unknown words'); }
});

// ═══ ĐỢT 2 — Ghi âm → ghi chú, chụp vở → trang sạch, rút việc cần làm ════════════════════════
const fmtTime = (s) => {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const sec = t % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};
const STYLES = {
  lecture: 'ghi chép bài giảng: các phần chính, ý quan trọng, ví dụ',
  meeting: 'biên bản họp: nội dung thảo luận, quyết định, ai làm gì',
  cornell: 'ghi chú Cornell: câu hỏi/từ khoá cho từng phần, ý chính, tóm tắt cuối',
  outline: 'dàn ý ngắn gọn theo thứ tự thời gian',
};

router.post('/transcribe', audioUpload.single('audio'), async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    if (!req.file) throw httpError(400, 'Thiếu file ghi âm');
    const page = req.body.pageId && !user.guest ? await aiPage(user, req.body.pageId, req.body) : null;
    const style = STYLES[req.body.style] ? req.body.style : 'lecture';
    const language = ['vi', 'en'].includes(req.body.language) ? req.body.language : undefined;
    const result = await withQuota(user, async () => {
      // 1) Lưu file ghi âm để phát lại đúng đoạn khi bấm mốc thời gian (khách: file nằm trên trình duyệt, không lưu server)
      const stamp = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 16).replace('T', ' ');
      // Kho lưu trữ lỗi (vd Supabase bị khoá vì vượt egress) → vẫn chép lời và tạo ghi chú, chỉ không lưu được file để phát lại
      let url = null; let storagePath = null; let storageError = null;
      if (!user.guest) {
        try { ({ url, storagePath } = await uploadNoteFile(user.id, req.file, 'audio')); }
        catch (e) { if (e.status === 413) throw e; storageError = e.message; }
      }
      // 2) Whisper → các đoạn có mốc thời gian
      let segments;
      try {
        const file = await toFile(req.file.buffer, req.file.originalname || 'recording.webm', { type: req.file.mimetype });
        const tr = await groq.audio.transcriptions.create({
          file, model: 'whisper-large-v3', response_format: 'verbose_json', timestamp_granularities: ['segment'], ...(language ? { language } : {}),
        });
        segments = arr(tr.segments).map((s) => ({ start: Number(s.start) || 0, end: Number(s.end) || 0, text: String(s.text || '').trim() })).filter((s) => s.text);
        if (!segments.length) throw httpError(422, 'Không nghe được nội dung trong bản ghi âm. Hãy thử nói gần micro hơn.');
      } catch (err) {
        if (storagePath) await removeNoteFiles([storagePath]);
        throw err;
      }
      const att = user.guest
        ? { id: str(req.body.localId, 64) || crypto.randomUUID(), kind: 'AUDIO', name: `Ghi âm ${stamp}`, url: null, size: req.file.size, mime: req.file.mimetype, createdAt: new Date() }
        : storageError ? null : await prisma.noteAttachment.create({
        data: { userId: user.id, pageId: page?.id || null, kind: 'AUDIO', name: `Ghi âm ${stamp}`, mime: req.file.mimetype, size: req.file.size, url, storagePath, transcript: segments },
        select: { id: true, kind: true, name: true, url: true, size: true, mime: true, createdAt: true },
      });
      // 3) AI sắp xếp transcript thành ghi chú, mỗi ý trỏ về số thứ tự đoạn để gắn mốc thời gian
      const lines = [];
      let budget = 26000;
      for (let i = 0; i < segments.length && budget > 0; i += 1) {
        const line = `[${i}] (${fmtTime(segments[i].start)}) ${segments[i].text}`;
        budget -= line.length;
        lines.push(line);
      }
      const data = await askJson(
        `You turn recorded lectures and meetings into structured notes. ${LANG_RULE}`,
        `Đây là bản chép lời ghi âm, mỗi dòng có số thứ tự đoạn [n] và mốc thời gian. Hãy viết thành ${STYLES[style]}.
Mỗi ý phải ghi "seg" = số thứ tự đoạn mà ý đó bắt đầu được nói tới. Nếu là bài giảng tiếng Anh, rút thêm từ vựng/cấu trúc đáng học kèm nghĩa tiếng Việt.
${lines.join('\n')}
JSON: {"title": "tiêu đề ngắn", "summary": "2-3 câu tóm tắt", "sections": [{"heading": "...", "points": [{"text": "...", "seg": 0}]}], "vocabulary": [{"word": "...", "meaning": "..."}], "tasks": [{"text": "việc cần làm được nhắc tới", "seg": 0}], "questions": ["câu hỏi còn bỏ ngỏ/cần hỏi lại"]}`,
        { temperature: 0.3 },
      );
      return { att, segments, data, storageError };
    }, 'AUDIO');
    const { att, segments, data, storageError } = result;
    const ts = (seg) => {
      const s = segments[Math.max(0, Math.min(segments.length - 1, Number(seg) || 0))];
      return att ? `<a href="#t=${Math.floor(s.start)}&amp;a=${att.id}">${fmtTime(s.start)}</a>` : `<code>${fmtTime(s.start)}</code>`;
    };
    let html = '';
    if (str(data.summary)) html += `<div data-callout="info"><p><strong>Tóm tắt:</strong> ${escapeHtml(str(data.summary, 1200))}</p></div>`;
    for (const sec of arr(data.sections).slice(0, 20)) {
      const points = arr(sec.points).filter((p) => str(p.text)).slice(0, 20);
      if (!str(sec.heading) && !points.length) continue;
      html += `<h3>${escapeHtml(str(sec.heading, 200) || 'Nội dung')}</h3><ul>${points.map((p) => `<li><p>${ts(p.seg)} ${escapeHtml(str(p.text, 800))}</p></li>`).join('')}</ul>`;
    }
    const vocab = arr(data.vocabulary).filter((v) => str(v.word) && str(v.meaning)).slice(0, 30);
    if (vocab.length) html += `<h3>Từ vựng</h3><table><tr><th>Từ</th><th>Nghĩa</th></tr>${vocab.map((v) => `<tr><td>${escapeHtml(str(v.word, 120))}</td><td>${escapeHtml(str(v.meaning, 300))}</td></tr>`).join('')}</table>`;
    const tasks = arr(data.tasks).filter((t) => str(t.text)).slice(0, 20);
    if (tasks.length) html += `<h3>Việc cần làm</h3><ul data-type="taskList">${tasks.map((t) => `<li data-type="taskItem" data-checked="false"><p>${escapeHtml(str(t.text, 400))} (${ts(t.seg)})</p></li>`).join('')}</ul>`;
    const questions = arr(data.questions).map((q) => str(q, 400)).filter(Boolean).slice(0, 10);
    if (questions.length) html += `<h3>Câu hỏi cần làm rõ</h3><ul>${questions.map((q) => `<li><p>${escapeHtml(q)}</p></li>`).join('')}</ul>`;
    if (page?.id) await helpers.refreshSearchText(page.id);
    res.json({
      ...(storageError ? { warning: 'Kho lưu file đang tạm lỗi nên chưa lưu được bản ghi âm để phát lại — ghi chú vẫn được tạo từ bản chép lời.' } : {}),
      attachment: att, transcript: segments, title: str(data.title, 120), html: cleanHtml(html) });
  } catch (err) { sendError(res, err, 'transcribe'); }
});

router.post('/ocr-structure', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const raw = str(req.body.text, MAX_INPUT);
    if (raw.length < 5) throw httpError(400, 'Không đọc được chữ trong ảnh');
    const data = await withQuota(user, () => askJson(
      `You clean up OCR text from photos of handwritten notebooks and whiteboards. ${HTML_RULE}`,
      `Đây là chữ nhận dạng (OCR) từ ảnh chụp vở/bảng, có thể sai chính tả, mất dấu tiếng Việt, xuống dòng lung tung. Hãy:
1. Sửa lỗi nhận dạng (khôi phục dấu tiếng Việt, ghép từ bị tách) nhưng KHÔNG thêm thông tin mới.
2. Trình bày lại thành trang ghi chú sạch: tiêu đề <h3>, danh sách, bảng nếu nội dung là bảng.
3. Chỗ không chắc chắn thì giữ nguyên và đánh dấu bằng <mark>.
OCR:
"""
${raw}
"""
JSON: {"title": "tiêu đề đoán từ nội dung", "html": "..."}`,
      { temperature: 0.2 },
    ));
    res.json({ title: str(data.title, 120), html: cleanHtml(data.html) });
  } catch (err) { sendError(res, err, 'ocr'); }
});

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
router.post('/extract-tasks', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const { text } = await inputText(user, req.body);
    const vn = new Date(Date.now() + 7 * 3600_000);
    const today = `${vn.toISOString().slice(0, 10)} (${WEEKDAYS[vn.getUTCDay()]})`;
    const data = await withQuota(user, () => askJson(
      'You extract action items and due dates from Vietnamese/English notes.',
      `Hôm nay là ${today}, múi giờ Việt Nam. Rút ra các việc cần làm trong nội dung dưới đây. Hiểu cách nói ngày tháng tự nhiên: "mai", "thứ 6", "thứ 6 tuần sau", "cuối tháng", "trước 20/11", "8h tối nay". Không có hạn thì để due = null. Giờ không nói rõ thì dùng 09:00.
"""
${text}
"""
JSON: {"tasks": [{"text": "việc cần làm, ngắn gọn", "due": "YYYY-MM-DDTHH:mm" hoặc null}]}`,
      { temperature: 0.1 },
    ));
    const tasks = arr(data.tasks).map((t) => {
      const due = typeof t.due === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t.due) ? new Date(`${t.due.slice(0, 16)}:00+07:00`) : null;
      return { text: str(t.text, 300), due: due && !isNaN(due) ? due.toISOString() : null };
    }).filter((t) => t.text).slice(0, 30);
    res.json({ tasks });
  } catch (err) { sendError(res, err, 'extract tasks'); }
});

// ═══ ĐỢT 3 — Hỏi sổ ghi chú có trích dẫn, gợi ý liên kết, hộp thư, song ngữ ══════════════════
const STOPWORDS = new Set(('la cua va co cho nhung cac mot nay do thi trong khi voi duoc ve tu den nhu nao gi khong toi minh ban '
  + 'the a an of to in on for and or is are was were be what how why which who when where do does did i my me you it this that').split(' '));
const keywords = (text) => [...new Set((normalizeSearch(text).match(/[a-z0-9]{2,}/g) || []).filter((w) => !STOPWORDS.has(w)))];

/** Lọc trang theo phạm vi + bỏ trang thuộc sổ tắt AI. */
function scopeWhere(user, scope) {
  const where = { userId: user.id, deletedAt: null, OR: [{ sectionId: null }, { section: { notebook: { aiDisabled: false } } }] };
  if (scope?.type === 'notebook' && scope.id) Object.assign(where, { section: { notebookId: String(scope.id), notebook: { aiDisabled: false } }, OR: undefined });
  if (scope?.type === 'section' && scope.id) where.sectionId = String(scope.id);
  if (scope?.type === 'page' && scope.id) where.id = String(scope.id);
  if (where.OR === undefined) delete where.OR;
  return where;
}

function chunkText(text, size = 700) {
  const chunks = [];
  let cur = '';
  for (const line of String(text || '').split('\n')) {
    if ((cur + line).length > size && cur) { chunks.push(cur.trim()); cur = ''; }
    cur += `${line}\n`;
    while (cur.length > size * 1.6) { chunks.push(cur.slice(0, size).trim()); cur = cur.slice(size); }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

router.post('/ask', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const question = str(req.body.question, 500);
    if (question.length < 3) throw httpError(400, 'Hãy nhập câu hỏi');
    const terms = keywords(question).slice(0, 10);
    let pages;
    if (user.guest) {
      let budget = 300000;
      pages = arr(req.body.pages).slice(0, 60).map((p) => {
        const text = str(p.text, Math.max(0, Math.min(40000, budget)));
        budget -= text.length;
        return { id: str(p.id, 64), title: str(p.title, 300), plainText: text, attachments: arr(p.extra).slice(0, 20).map((x) => ({ ocrText: str(x.text, 20000), kind: x.kind === 'AUDIO' ? 'AUDIO' : 'IMAGE', transcript: null })) };
      }).filter((p) => p.id && p.plainText);
    } else {
      const base = scopeWhere(user, req.body.scope);
      pages = await prisma.notePage.findMany({
        where: terms.length && req.body.scope?.type !== 'page' ? { AND: [base, { OR: terms.map((t) => ({ searchText: { contains: t } })) }] } : base,
        select: { id: true, title: true, plainText: true, updatedAt: true, attachments: { select: { ocrText: true, transcript: true, kind: true } } },
        orderBy: { updatedAt: 'desc' }, take: 60,
      });
    }
    if (!pages.length) return res.json({ found: false, answer: '<p>Không tìm thấy nội dung liên quan trong ghi chú của bạn.</p>', citations: [] });
    // Chấm điểm từng đoạn theo số từ khoá khớp (tiêu đề khớp được cộng thêm) → lấy 14 đoạn tốt nhất
    const scored = [];
    for (const p of pages) {
      const titleHits = keywords(p.title).filter((w) => terms.includes(w)).length;
      const sources = [{ text: p.plainText, kind: '' },
        ...p.attachments.filter((a) => a.ocrText).map((a) => ({ text: a.ocrText, kind: a.kind === 'AUDIO' ? 'ghi âm' : 'chữ trong ảnh' })),
        ...p.attachments.filter((a) => Array.isArray(a.transcript)).map((a) => ({ text: a.transcript.map((s) => s.text).join(' '), kind: 'ghi âm' }))];
      for (const src of sources) {
        for (const chunk of chunkText(src.text)) {
          const norm = normalizeSearch(chunk);
          const hits = terms.filter((t) => norm.includes(t)).length;
          if (hits || !terms.length) scored.push({ pageId: p.id, title: p.title || 'Không tiêu đề', kind: src.kind, chunk, score: hits * 2 + titleHits });
        }
      }
    }
    const top = scored.sort((a, b) => b.score - a.score).slice(0, 14);
    if (!top.length) return res.json({ found: false, answer: '<p>Không tìm thấy nội dung liên quan trong ghi chú của bạn.</p>', citations: [] });
    const sources = top.map((s, i) => `[${i + 1}] Trang "${s.title}"${s.kind ? ` (${s.kind})` : ''}:\n${s.chunk}`).join('\n\n');
    const data = await withQuota(user, () => askJson(
      `You answer questions using ONLY the user's own notes. Never invent facts. ${LANG_RULE.replace('nội dung gốc', 'câu hỏi')}`,
      `Câu hỏi: ${question}\n\nCác đoạn trích từ ghi chú của người dùng:\n${sources}\n\nTrả lời ngắn gọn, CHỈ dựa trên các đoạn trích. Sau mỗi ý ghi nguồn dạng [1], [2]. Nếu các đoạn trích không chứa câu trả lời thì found = false và nói rõ là không có trong ghi chú. "answer" là HTML đơn giản (<p>, <ul>, <li>, <strong>).\nJSON: {"found": true, "answer": "...", "used": [1, 2]}`,
      { temperature: 0.2 },
    ));
    const used = new Set(arr(data.used).map(Number).filter((n) => n >= 1 && n <= top.length));
    const answer = cleanHtml(data.answer) || '<p>Không tìm thấy nội dung liên quan trong ghi chú của bạn.</p>';
    String(answer).replace(/\[(\d+)\]/g, (_, n) => { if (Number(n) <= top.length) used.add(Number(n)); return _; });
    const citations = [...used].sort((a, b) => a - b).map((n) => ({
      n, pageId: top[n - 1].pageId, title: top[n - 1].title, kind: top[n - 1].kind, snippet: top[n - 1].chunk.slice(0, 280),
    }));
    res.json({ found: data.found !== false && citations.length > 0, answer, citations });
  } catch (err) { sendError(res, err, 'ask'); }
});

router.post('/suggest-links', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const page = await aiPage(user, req.body.pageId, req.body);
    const freq = {};
    for (const w of normalizeSearch(`${page.title} ${page.title} ${page.plainText}`).match(/[a-z0-9]{3,}/g) || []) {
      if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1;
    }
    const top = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w);
    if (!top.length) return res.json({ suggestions: [] });
    const candidates = user.guest
      ? arr(req.body.candidates).slice(0, 25).map((c) => ({ id: str(c.id, 64), title: str(c.title, 200), excerpt: str(c.excerpt, 220) })).filter((c) => c.id)
      : await prisma.notePage.findMany({
        where: { AND: [scopeWhere(user), { id: { notIn: [page.id, ...page.linkedPageIds] } }, { OR: top.map((t) => ({ searchText: { contains: t } })) }] },
        select: { id: true, title: true, excerpt: true }, take: 25, orderBy: { updatedAt: 'desc' },
      });
    if (!candidates.length) return res.json({ suggestions: [] });
    const data = await withQuota(user, () => askJson(
      'You find genuinely related notes. Reply in Vietnamese.',
      `Trang hiện tại: "${page.title}"\n${page.plainText.slice(0, 3000)}\n\nCác trang khác:\n${candidates.map((c, i) => `${i + 1}. "${c.title || 'Không tiêu đề'}" — ${c.excerpt}`).join('\n')}\n\nChọn tối đa 5 trang THỰC SỰ liên quan nội dung để liên kết. JSON: {"picks": [{"n": 1, "reason": "liên quan thế nào, ≤ 15 từ"}]}`,
    ));
    const suggestions = arr(data.picks).map((p) => ({ c: candidates[Number(p.n) - 1], reason: str(p.reason, 200) }))
      .filter((p) => p.c).slice(0, 5).map(({ c, reason }) => ({ pageId: c.id, title: c.title || 'Không tiêu đề', reason }));
    res.json({ suggestions });
  } catch (err) { sendError(res, err, 'suggest links'); }
});

// Hộp thư ghi nhanh: AI đề xuất chuyển từng trang vào mục phù hợp + thẻ; người dùng duyệt rồi mới áp dụng
router.post('/triage', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const [pages, sections] = user.guest
      ? [
        arr(req.body.pages).slice(0, 30).map((p) => ({ id: str(p.id, 64), title: str(p.title, 200), excerpt: str(p.excerpt, 220) })).filter((p) => p.id),
        arr(req.body.sections).slice(0, 200).map((x) => ({ id: str(x.id, 64), name: str(x.name, 120), notebook: { name: str(x.notebook, 120) } })).filter((x) => x.id),
      ]
      : await Promise.all([
        prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null, archivedAt: null, sectionId: null }, select: { id: true, title: true, excerpt: true }, orderBy: { updatedAt: 'desc' }, take: 30 }),
        prisma.noteSection.findMany({ where: { userId: user.id, notebook: { aiDisabled: false } }, select: { id: true, name: true, notebook: { select: { name: true } } } }),
      ]);
    if (!pages.length) return res.json({ suggestions: [] });
    if (!sections.length) throw httpError(400, 'Hãy tạo ít nhất 1 sổ tay để AI có chỗ sắp xếp ghi chú vào');
    const data = await withQuota(user, () => askJson(
      'You organise quick notes into a notebook structure.',
      `Các mục hiện có (sổ tay / mục):\n${sections.map((s, i) => `S${i + 1}. ${s.notebook.name} / ${s.name}`).join('\n')}\n\nGhi chú nhanh cần sắp xếp:\n${pages.map((p, i) => `P${i + 1}. "${p.title || '(không tiêu đề)'}" — ${p.excerpt}`).join('\n')}\n\nVới mỗi ghi chú, chọn mục phù hợp nhất (hoặc null nếu không mục nào hợp), 1-3 thẻ chữ thường không dấu, và tiêu đề ngắn nếu ghi chú chưa có tiêu đề.\nJSON: {"items": [{"p": "P1", "s": "S2" hoặc null, "tags": ["..."], "title": "..." hoặc null}]}`,
    ));
    const suggestions = arr(data.items).map((it) => {
      const p = pages[Number(String(it.p || '').replace(/\D/g, '')) - 1];
      const s = it.s ? sections[Number(String(it.s).replace(/\D/g, '')) - 1] : null;
      if (!p) return null;
      return {
        pageId: p.id, pageTitle: p.title || '(không tiêu đề)', excerpt: p.excerpt,
        sectionId: s?.id || null, sectionLabel: s ? `${s.notebook.name} / ${s.name}` : null,
        tags: arr(it.tags).map((t) => normalizeSearch(t).replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')).filter(Boolean).slice(0, 3),
        title: !p.title ? str(it.title, 120) : null,
      };
    }).filter(Boolean);
    res.json({ suggestions, sections: sections.map((s) => ({ id: s.id, label: `${s.notebook.name} / ${s.name}` })) });
  } catch (err) { sendError(res, err, 'triage'); }
});

router.post('/triage/apply', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Áp dụng sắp xếp trên máy chủ');
    const items = arr(req.body.items).slice(0, 50);
    const sectionIds = new Set((await prisma.noteSection.findMany({ where: { userId: user.id }, select: { id: true } })).map((s) => s.id));
    let applied = 0;
    // ≤ 50 trang, chạy song song theo lô 10 để không giữ quá nhiều kết nối
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const results = await Promise.all(batch.map(async (it) => {
        const page = await prisma.notePage.findFirst({ where: { id: String(it.pageId || ''), userId: user.id, deletedAt: null }, select: { id: true, tags: true, title: true } });
        if (!page) return 0;
        const data = {};
        if (it.sectionId && sectionIds.has(it.sectionId)) data.sectionId = it.sectionId;
        const tags = helpers.cleanTags([...page.tags, ...arr(it.tags)]);
        if (tags.length !== page.tags.length) data.tags = tags;
        if (!page.title && str(it.title)) data.title = str(it.title, 300);
        if (!Object.keys(data).length) return 0;
        await prisma.notePage.update({ where: { id: page.id }, data });
        if (data.tags || data.title) await helpers.refreshSearchText(page.id);
        return 1;
      }));
      applied += results.reduce((s, n) => s + n, 0);
    }
    res.json({ applied });
  } catch (err) { sendError(res, err, 'triage apply'); }
});

// Xem song ngữ: dịch từng khối văn bản, hiển thị cạnh bản gốc
router.post('/parallel', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    const page = await aiPage(user, req.body.pageId, req.body);
    const blocks = docBlocks(page.contentJson).filter((b) => b.text.length > 1);
    const picked = [];
    let budget = 9000;
    for (const b of blocks) { if (budget - b.text.length < 0) break; budget -= b.text.length; picked.push(b.text.slice(0, 1500)); }
    if (!picked.length) throw httpError(400, 'Trang chưa có nội dung để dịch');
    const data = await cached(page, 'parallel', () => withQuota(user, () => askJson(
      'You translate notes block by block between Vietnamese and English.',
      `Dịch từng khối dưới đây: khối tiếng Việt → tiếng Anh, khối tiếng Anh → tiếng Việt. Giữ đúng số khối và thứ tự.\n${picked.map((t, i) => `<<${i + 1}>> ${t}`).join('\n')}\nJSON: {"items": ["bản dịch khối 1", "bản dịch khối 2"]}`,
      { temperature: 0.2 },
    )).then((d) => ({ pairs: picked.map((src, i) => ({ src, dst: str(arr(d.items)[i], 3000) })) })));
    res.json({ ...data, truncated: picked.length < blocks.length });
  } catch (err) { sendError(res, err, 'parallel'); }
});

// ═══ ĐỢT 4 — Sổ lớp thông minh (giáo viên) + bản tin tuần ═══════════════════════════════════
function requireTeacher(user) {
  if (user.role !== 'TEACHER') throw httpError(403, 'Tính năng dành cho giáo viên');
}

router.post('/teacher/lesson-draft', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const page = await aiPage(user, req.body.pageId, req.body);
    if (page.plainText.length < 50) throw httpError(400, 'Trang soạn bài còn quá ít nội dung');
    const data = await withQuota(user, () => askJson(
      `You turn a teacher's lesson-planning notes into a lesson for Vietnamese students learning English. ${HTML_RULE}`,
      `Từ ghi chú soạn bài dưới đây, tạo bản nháp BÀI HỌC: tiêu đề, nội dung bài học cho học viên đọc (giải thích bằng tiếng Việt, ví dụ tiếng Anh, có tiêu đề nhỏ, danh sách), và danh sách từ vựng có trong ghi chú (không bịa thêm từ ngoài ghi chú quá 5 từ).
Ghi chú:
"""
${page.plainText.slice(0, MAX_INPUT)}
"""
JSON: {"title": "...", "summary": "1 câu mô tả ngắn bài học (chữ thường, không HTML)", "html": "...", "vocabularies": [{"word": "...", "pos": "Noun|Verb|Adjective|Adverb|Phrase|...", "phonetic": "/.../", "meaning": "...", "example": "..."}]}`,
    ));
    res.json({
      title: str(data.title, 200) || page.title,
      summary: str(data.summary, 300),
      html: cleanHtml(data.html),
      vocabularies: arr(data.vocabularies).map((v) => ({ word: str(v.word, 120), pos: str(v.pos, 30), phonetic: str(v.phonetic, 80), meaning: str(v.meaning, 300), example: str(v.example, 400) }))
        .filter((v) => v.word && v.meaning).slice(0, 60),
    });
  } catch (err) { sendError(res, err, 'lesson draft'); }
});

router.post('/teacher/lesson-create', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const page = await ownPage(user.id, req.body.pageId, { id: true });
    const classroom = user.classroomsOwned.find((c) => c.id === req.body.classroomId);
    if (!classroom) throw httpError(403, 'Hãy chọn 1 lớp bạn đang dạy');
    const title = str(req.body.title, 200);
    if (!title) throw httpError(400, 'Thiếu tiêu đề bài học');
    const vocabularies = arr(req.body.vocabularies).map((v) => ({
      word: str(v.word, 120), pos: str(v.pos, 30) || null, phonetic: str(v.phonetic, 80) || null, meaning: str(v.meaning, 300), example: str(v.example, 400) || null,
    })).filter((v) => v.word && v.meaning).slice(0, 100);
    const lesson = await prisma.lesson.create({
      // Lesson.description hiển thị dạng chữ thường ở /lesson/[id]; nội dung HTML đặt vào 1 mục "Ngữ pháp trọng tâm"
      // (GrammarItem.explanation được render qua DOMPurify) để học viên đọc được đúng định dạng
      data: {
        title, description: str(req.body.summary, 300) || null, classroomId: classroom.id, uploadedById: user.id,
        vocabularies: { createMany: { data: vocabularies } },
        ...(cleanHtml(req.body.html) ? { grammars: { createMany: { data: [{ title: 'Nội dung bài học', explanation: cleanHtml(req.body.html) }] } } } : {}),
      },
      select: { id: true, title: true },
    });
    await prisma.noteLink.create({ data: { pageId: page.id, userId: user.id, targetType: 'LESSON', targetId: lesson.id, label: lesson.title, classroomId: classroom.id } }).catch(() => {});
    res.json({ lesson, classroom });
  } catch (err) { sendError(res, err, 'lesson create'); }
});

// Đề thi: trả các dòng đúng định dạng Excel mẫu ở tab "Tạo Đề Mới" (frontend tạo file để giáo viên Nhập Từ Excel)
router.post('/teacher/exam-draft', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const page = await aiPage(user, req.body.pageId, req.body);
    const count = Math.min(Math.max(Number(req.body.count) || 15, 5), 40);
    const data = await withQuota(user, () => askJson(
      'You write English test questions for Vietnamese high-school students from a teacher\'s notes.',
      `Từ ghi chú dưới đây, soạn ${count} câu hỏi kiểm tra bám sát nội dung. Khoảng 80% trắc nghiệm 4 đáp án (TN), 20% tự luận ngắn điền từ (TL). Câu hỏi bằng tiếng Anh, giải thích bằng tiếng Việt.
"""
${page.plainText.slice(0, MAX_INPUT)}
"""
JSON: {"questions": [{"type": "TN|TL", "question": "...", "options": ["A", "B", "C", "D"] (TN), "answer": "A|B|C|D" (TN) hoặc đáp án đúng (TL), "explanation": "..."}]}`,
    ));
    const rows = arr(data.questions).map((q) => {
      const type = q.type === 'TL' ? 'TL' : 'TN';
      const question = str(q.question, 800);
      const options = type === 'TN' ? arr(q.options).map((o) => str(o, 300)).slice(0, 4) : [];
      const answer = type === 'TN' ? String(q.answer || '').trim().toUpperCase().slice(0, 1) : str(q.answer, 200);
      if (!question || (type === 'TN' && (options.length < 4 || !'ABCD'.includes(answer) || !answer)) || (type === 'TL' && !answer)) return null;
      return { type, question, options: type === 'TN' ? options : ['', '', '', ''], answer, explanation: str(q.explanation, 600), points: 1 };
    }).filter(Boolean);
    if (!rows.length) throw httpError(502, 'AI chưa soạn được câu hỏi, vui lòng thử lại');
    res.json({ title: page.title || 'Đề từ ghi chú', rows });
  } catch (err) { sendError(res, err, 'exam draft'); }
});

router.post('/teacher/student-report', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const studentId = String(req.body.studentId || '');
    const allowed = await helpers.accessibleIds(user, 'STUDENT', [studentId]);
    if (!allowed.has(studentId)) throw httpError(403, 'Học viên không thuộc lớp/quyền phụ trách của bạn');
    const days = Math.min(Math.max(Number(req.body.days) || 30, 7), 120);
    const since = new Date(Date.now() - days * 86400_000);
    const ownClassIds = user.classroomsOwned.map((c) => c.id);
    const [student, notes, results, attendance, skills] = await Promise.all([
      prisma.user.findUnique({ where: { id: studentId }, select: { name: true, targetScore: true } }),
      prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null, links: { some: { targetType: 'STUDENT', targetId: studentId } } }, select: { title: true, plainText: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 10 }),
      prisma.examResult.findMany({ where: { userId: studentId, createdAt: { gte: since } }, select: { score: true, createdAt: true, exam: { select: { title: true } } }, orderBy: { createdAt: 'asc' }, take: 40 }),
      prisma.attendance.groupBy({ by: ['status'], where: { userId: studentId, classroomId: { in: ownClassIds }, date: { gte: since } }, _count: { id: true } }),
      prisma.skillPracticeResult.groupBy({ by: ['skill'], where: { userId: studentId, createdAt: { gte: since } }, _avg: { band: true }, _count: { id: true } }),
    ]);
    const att = Object.fromEntries(attendance.map((a) => [a.status, a._count.id]));
    const facts = [
      `Học viên: ${student?.name}. Mục tiêu điểm: ${student?.targetScore}. Giai đoạn: ${days} ngày gần nhất.`,
      `Chuyên cần: có mặt ${att.PRESENT || 0} buổi, vắng ${(att.UNEXCUSED || 0) + (att.EXCUSED || 0)} buổi.`,
      results.length ? `Kết quả bài kiểm tra (thang 10): ${results.map((r) => `${r.exam.title}: ${r.score}`).join('; ')}` : 'Chưa có bài kiểm tra trong giai đoạn này.',
      skills.length ? `Luyện 4 kỹ năng (điểm TB thang 10): ${skills.map((s) => `${s.skill} ${(s._avg.band || 0).toFixed(1)} (${s._count.id} lần)`).join('; ')}` : 'Chưa có dữ liệu luyện 4 kỹ năng.',
      notes.length ? `Ghi chú riêng của giáo viên về học viên:\n${notes.map((n) => `- ${n.title}: ${n.plainText.slice(0, 1200)}`).join('\n')}` : 'Giáo viên chưa có ghi chú riêng về học viên này.',
    ].join('\n');
    const data = await withQuota(user, () => askJson(
      'You help Vietnamese English teachers write progress reports for parents. Write in Vietnamese, warm, specific, honest.',
      `Dựa CHỈ trên dữ liệu dưới đây (không bịa số liệu), viết nhận xét định kỳ gửi phụ huynh.\n${facts}\nJSON: {"report": "đoạn nhận xét 120-200 từ, xưng 'em' với học viên và 'anh/chị' với phụ huynh, sẵn sàng dán Zalo", "strengths": ["..."], "improvements": ["..."], "nextSteps": ["việc cụ thể cho tháng tới"]}`,
      { temperature: 0.5 },
    ));
    res.json({
      studentName: student?.name, facts,
      report: str(data.report, 3000), strengths: arr(data.strengths).map((s) => str(s, 300)).filter(Boolean),
      improvements: arr(data.improvements).map((s) => str(s, 300)).filter(Boolean), nextSteps: arr(data.nextSteps).map((s) => str(s, 300)).filter(Boolean),
    });
  } catch (err) { sendError(res, err, 'student report'); }
});

// Lỗ hổng kiến thức của lớp: chỉ đọc các trang học viên CHỦ ĐỘNG gửi cho giáo viên (NoteShare scope TEACHER)
router.post('/teacher/class-gaps', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const classroom = user.classroomsOwned.find((c) => c.id === req.body.classroomId);
    if (!classroom) throw httpError(403, 'Hãy chọn 1 lớp bạn đang dạy');
    const shares = await prisma.noteShare.findMany({
      where: { scope: 'TEACHER', teacherId: user.id, createdAt: { gte: new Date(Date.now() - 90 * 86400_000) }, page: { deletedAt: null, user: { classroomsJoined: { some: { id: classroom.id } } } } },
      select: { ownerId: true, page: { select: { title: true, plainText: true } } }, take: 40, orderBy: { createdAt: 'desc' },
    });
    const owners = new Set(shares.map((s) => s.ownerId));
    if (owners.size < 2) throw httpError(400, 'Cần ít nhất 2 học viên trong lớp gửi trang ghi chú cho bạn thì mới phân tích được lỗ hổng chung');
    const ownerIndex = Object.fromEntries([...owners].map((id, i) => [id, `HV${i + 1}`]));
    const data = await withQuota(user, () => askJson(
      'You analyse students\' notes to find shared knowledge gaps. Reply in Vietnamese. Never reveal student identities.',
      `Lớp "${classroom.name}" có ${owners.size} học viên gửi ghi chú/bài làm (ẩn danh). Tìm các lỗ hổng kiến thức/hiểu nhầm CHUNG (xuất hiện ở ≥ 2 học viên), ghi số học viên mắc.\n${shares.map((s) => `[${ownerIndex[s.ownerId]}] ${s.page.title}: ${s.page.plainText.slice(0, 1200)}`).join('\n\n')}\nJSON: {"summary": "nhận định chung 2-3 câu", "gaps": [{"topic": "...", "students": 3, "evidence": "biểu hiện cụ thể (không nêu tên)", "suggestion": "gợi ý nội dung/hoạt động cho buổi sau"}]}`,
    ));
    res.json({
      classroom, studentsAnalysed: owners.size, summary: str(data.summary, 1000),
      gaps: arr(data.gaps).map((g) => ({ topic: str(g.topic, 200), students: Math.min(owners.size, Math.max(0, Number(g.students) || 0)), evidence: str(g.evidence, 500), suggestion: str(g.suggestion, 500) }))
        .filter((g) => g.topic).slice(0, 10),
    });
  } catch (err) { sendError(res, err, 'class gaps'); }
});

router.post('/teacher/feedback-draft', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireTeacher(user);
    const share = await prisma.noteShare.findFirst({ where: { id: String(req.body.shareId || ''), scope: 'TEACHER', teacherId: user.id }, select: { page: { select: { title: true, plainText: true } } } });
    if (!share) throw httpError(404, 'Không tìm thấy trang được gửi');
    const data = await withQuota(user, () => askJson(
      'You draft encouraging, specific teacher feedback in Vietnamese for a student\'s notes or writing.',
      `Học viên gửi trang "${share.page.title}":\n"""\n${share.page.plainText.slice(0, MAX_INPUT)}\n"""\nViết bản nháp góp ý 80-150 từ: điểm tốt, lỗi/chỗ chưa đúng (nếu là tiếng Anh thì chỉ rõ câu sai → câu sửa), gợi ý cải thiện. JSON: {"feedback": "..."}`,
    ));
    res.json({ feedback: str(data.feedback, 3000) });
  } catch (err) { sendError(res, err, 'feedback draft'); }
});

// Bản tin tuần: tạo 1 lần / tuần / người khi có hoạt động (tự tạo lúc mở Ghi chú, không tốn lượt nếu tuần đó không ghi gì)
function weekKey(d = new Date()) {
  const vn = new Date(d.getTime() + 7 * 3600_000);
  const dow = (vn.getUTCDay() + 6) % 7; // thứ Hai = 0
  vn.setUTCDate(vn.getUTCDate() - dow);
  return vn.toISOString().slice(0, 10);
}
router.get('/digest', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Bản tin tuần');
    const key = weekKey();
    const existing = await prisma.noteDigest.findUnique({ where: { userId_weekKey: { userId: user.id, weekKey: key } } });
    if (existing) return res.json({ weekKey: key, ...existing.content });
    const since = new Date(Date.now() - 7 * 86400_000);
    const now = new Date();
    const [edited, openTasks, overdue, studyDue, errors] = await Promise.all([
      prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null, updatedAt: { gte: since } }, select: { id: true, title: true, excerpt: true, wordCount: true }, orderBy: { updatedAt: 'desc' }, take: 25 }),
      prisma.noteTask.count({ where: { userId: user.id, done: false, page: { deletedAt: null } } }),
      prisma.noteTask.findMany({ where: { userId: user.id, done: false, dueAt: { lt: now }, page: { deletedAt: null } }, select: { text: true }, take: 5 }),
      prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null, studyDueAt: { lte: now } }, select: { id: true, title: true }, take: 5 }),
      prisma.noteWritingError.groupBy({ by: ['category'], where: { userId: user.id, createdAt: { gte: since } }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 3 }),
    ]);
    const stats = {
      pagesEdited: edited.length, words: edited.reduce((s, p) => s + p.wordCount, 0), openTasks,
      overdue: overdue.map((t) => t.text), studyDue: studyDue.map((p) => ({ id: p.id, title: p.title || 'Không tiêu đề' })),
      topErrors: errors.map((e) => ({ category: e.category, count: e._count.id })),
    };
    if (edited.length < 2) return res.json({ weekKey: key, empty: true, stats });
    let ai = {};
    try {
      ai = await withQuota(user, () => askJson(
        'You write a short, friendly weekly recap of someone\'s notes. Reply in Vietnamese.',
        `Tuần qua người dùng đã sửa ${edited.length} trang:\n${edited.map((p) => `- ${p.title || 'Không tiêu đề'}: ${p.excerpt}`).join('\n')}\nViệc chưa xong: ${openTasks}. Quá hạn: ${stats.overdue.join('; ') || 'không'}. Lỗi tiếng Anh hay gặp: ${stats.topErrors.map((e) => `${e.category} (${e.count})`).join(', ') || 'không có dữ liệu'}.\nJSON: {"headline": "1 câu tổng kết", "themes": ["chủ đề chính tuần qua (≤ 4)"], "suggestions": ["gợi ý cụ thể cho tuần này (≤ 3)"]}`,
        { temperature: 0.6 },
      ));
    } catch (err) {
      // Hết lượt AI thì vẫn trả số liệu, tạo lại lần mở sau
      return res.json({ weekKey: key, stats, pending: true });
    }
    const content = { stats, headline: str(ai.headline, 300), themes: arr(ai.themes).map((t) => str(t, 120)).filter(Boolean).slice(0, 4), suggestions: arr(ai.suggestions).map((t) => str(t, 300)).filter(Boolean).slice(0, 3) };
    await prisma.noteDigest.create({ data: { userId: user.id, weekKey: key, content } }).catch(() => {});
    res.json({ weekKey: key, ...content });
  } catch (err) { sendError(res, err, 'digest'); }
});

// ═══ ĐỢT 5 — Trợ lý thao tác bằng lời ════════════════════════════════════════════════════════
// AI chỉ được đề xuất các thao tác trong danh sách này; bộ chọn trang (selector) được giải thành danh sách
// trang cụ thể NGAY lúc lập kế hoạch để người dùng thấy chính xác trang nào bị ảnh hưởng trước khi bấm.
const AGENT_ACTIONS = ['create_notebook', 'create_section', 'move_pages', 'add_tag', 'remove_tag', 'archive_pages', 'pin_pages', 'create_index_page'];
const MAX_AGENT_PAGES = 500;

async function resolveSelector(user, sel, refs) {
  if (!sel || typeof sel !== 'object') return [];
  const where = { userId: user.id, deletedAt: null };
  const and = [];
  if (sel.tag) and.push({ tags: { has: normalizeSearch(sel.tag).replace(/^#/, '') } });
  if (sel.sectionId) and.push({ sectionId: refs[sel.sectionId] || sel.sectionId });
  if (sel.notebookId) and.push({ section: { notebookId: refs[sel.notebookId] || sel.notebookId } });
  if (sel.inbox) and.push({ sectionId: null });
  if (sel.text) and.push({ searchText: { contains: normalizeSearch(sel.text) } });
  if (sel.titleContains) and.push({ title: { contains: String(sel.titleContains), mode: 'insensitive' } });
  const from = sel.createdFrom ? new Date(`${String(sel.createdFrom).slice(0, 10)}T00:00:00+07:00`) : null;
  const to = sel.createdTo ? new Date(`${String(sel.createdTo).slice(0, 10)}T23:59:59+07:00`) : null;
  if (from && !isNaN(from)) and.push({ createdAt: { gte: from } });
  if (to && !isNaN(to)) and.push({ createdAt: { lte: to } });
  if (Array.isArray(sel.pageIds)) and.push({ id: { in: sel.pageIds.map(String).slice(0, MAX_AGENT_PAGES) } });
  if (!and.length) return []; // không có điều kiện → không cho áp dụng lên toàn bộ ghi chú
  return prisma.notePage.findMany({ where: { ...where, AND: and }, select: { id: true, title: true }, take: MAX_AGENT_PAGES, orderBy: { updatedAt: 'desc' } });
}

router.post('/agent/plan', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Trợ lý sắp xếp bằng lời');
    const command = str(req.body.command, 600);
    if (command.length < 5) throw httpError(400, 'Hãy mô tả việc bạn muốn làm');
    const [notebooks, tagRows, recent] = await Promise.all([
      prisma.noteNotebook.findMany({ where: { userId: user.id }, select: { id: true, name: true, sections: { select: { id: true, name: true } } } }),
      prisma.$queryRaw`SELECT DISTINCT unnest(tags) AS tag FROM "NotePage" WHERE "userId" = ${user.id} AND "deletedAt" IS NULL LIMIT 200`,
      prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null }, select: { id: true, title: true }, orderBy: { updatedAt: 'desc' }, take: 40 }),
    ]);
    const vn = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const data = await withQuota(user, () => askJson(
      'You plan bulk organisation actions in a note-taking app. Only use the allowed actions. Reply labels in Vietnamese.',
      `Hôm nay: ${vn}. Yêu cầu của người dùng: "${command}"
Cấu trúc hiện có:
${notebooks.map((nb) => `- Sổ "${nb.name}" (id ${nb.id}): ${nb.sections.map((s) => `mục "${s.name}" (id ${s.id})`).join(', ') || 'chưa có mục'}`).join('\n') || '(chưa có sổ nào)'}
Thẻ đang dùng: ${tagRows.map((t) => t.tag).join(', ') || '(chưa có)'}
Trang gần đây: ${recent.map((p) => `"${p.title || 'Không tiêu đề'}" (id ${p.id})`).join(', ')}

Các thao tác được phép (tối đa 10, theo thứ tự):
- create_notebook {ref, name}
- create_section {ref, notebookId (id thật hoặc ref), name}
- move_pages {selector, sectionId (id thật hoặc ref)}
- add_tag {selector, tag} · remove_tag {selector, tag}
- archive_pages {selector} · pin_pages {selector}
- create_index_page {title, sectionId (id thật hoặc ref), selector} — trang mục lục liên kết tới các trang được chọn
selector = {tag?, sectionId?, notebookId?, inbox?: true, text?: "từ khoá trong nội dung", titleContains?, createdFrom?: "YYYY-MM-DD", createdTo?: "YYYY-MM-DD", pageIds?: [...]} (phải có ít nhất 1 điều kiện).
ref là tên tạm do bạn đặt (vd "nb1") để thao tác sau tham chiếu tới sổ/mục vừa tạo.
Nếu yêu cầu không làm được bằng các thao tác trên thì trả actions rỗng và giải thích trong "note".
JSON: {"actions": [{"type": "...", "label": "mô tả ngắn bằng tiếng Việt", ...tham số}], "note": "..."}`,
      { temperature: 0.1 },
    ));
    const validSections = new Set(notebooks.flatMap((nb) => nb.sections.map((s) => s.id)));
    const validNotebooks = new Set(notebooks.map((nb) => nb.id));
    const refs = {};
    const actions = [];
    for (const a of arr(data.actions).slice(0, 10)) {
      if (!AGENT_ACTIONS.includes(a?.type)) continue;
      const act = { type: a.type, label: str(a.label, 200) };
      if (a.type === 'create_notebook') {
        act.ref = str(a.ref, 30) || `nb${actions.length}`; act.name = str(a.name, 120); if (!act.name) continue;
        refs[act.ref] = act.ref; validNotebooks.add(act.ref);
      } else if (a.type === 'create_section') {
        act.ref = str(a.ref, 30) || `s${actions.length}`; act.name = str(a.name, 120); act.notebookId = str(a.notebookId, 60);
        if (!act.name || !validNotebooks.has(act.notebookId)) continue;
        refs[act.ref] = act.ref; validSections.add(act.ref);
      } else {
        if (a.type === 'move_pages' || a.type === 'create_index_page') {
          act.sectionId = str(a.sectionId, 60);
          if (!validSections.has(act.sectionId)) continue;
        }
        if (a.type === 'add_tag' || a.type === 'remove_tag') { act.tag = normalizeSearch(a.tag).replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, ''); if (!act.tag) continue; }
        if (a.type === 'create_index_page') act.title = str(a.title, 200) || 'Mục lục';
        const sel = a.selector && typeof a.selector === 'object' ? a.selector : {};
        // selector trỏ tới sổ/mục vừa tạo trong cùng kế hoạch thì chưa có trang nào → bỏ
        if ((sel.sectionId && refs[sel.sectionId]) || (sel.notebookId && refs[sel.notebookId])) continue;
        const pages = await resolveSelector(user, sel, {});
        if (!pages.length) continue;
        act.selector = sel; act.pageIds = pages.map((p) => p.id); act.sample = pages.slice(0, 5).map((p) => p.title || 'Không tiêu đề'); act.count = pages.length;
      }
      actions.push(act);
    }
    const run = await prisma.noteAgentRun.create({ data: { userId: user.id, command, plan: { actions, note: str(data.note, 500) } }, select: { id: true } });
    res.json({ runId: run.id, actions, note: str(data.note, 500) });
  } catch (err) { sendError(res, err, 'agent plan'); }
});

router.post('/agent/:runId/execute', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Trợ lý sắp xếp bằng lời');
    const run = await prisma.noteAgentRun.findFirst({ where: { id: req.params.runId, userId: user.id } });
    if (!run) throw httpError(404, 'Không tìm thấy kế hoạch');
    if (run.executedAt) throw httpError(400, 'Kế hoạch này đã được thực hiện');
    const refs = {};
    const undo = [];
    const real = (id) => refs[id] || id;
    const ownSections = new Set((await prisma.noteSection.findMany({ where: { userId: user.id }, select: { id: true } })).map((s) => s.id));
    const ownNotebooks = new Set((await prisma.noteNotebook.findMany({ where: { userId: user.id }, select: { id: true } })).map((n) => n.id));
    for (const a of arr(run.plan?.actions)) {
      if (a.type === 'create_notebook') {
        const nb = await prisma.noteNotebook.create({ data: { userId: user.id, name: a.name, order: 999 }, select: { id: true } });
        refs[a.ref] = nb.id; ownNotebooks.add(nb.id); undo.push({ type: 'delete_notebook', id: nb.id });
      } else if (a.type === 'create_section') {
        const notebookId = real(a.notebookId);
        if (!ownNotebooks.has(notebookId)) continue;
        const s = await prisma.noteSection.create({ data: { userId: user.id, notebookId, name: a.name, order: 999 }, select: { id: true } });
        refs[a.ref] = s.id; ownSections.add(s.id); undo.push({ type: 'delete_section', id: s.id });
      } else if (a.type === 'move_pages') {
        const sectionId = real(a.sectionId);
        if (!ownSections.has(sectionId)) continue;
        const before = await prisma.notePage.findMany({ where: { id: { in: a.pageIds }, userId: user.id }, select: { id: true, sectionId: true } });
        await prisma.notePage.updateMany({ where: { id: { in: before.map((p) => p.id) }, userId: user.id }, data: { sectionId } });
        undo.push({ type: 'restore_sections', pages: before });
      } else if (a.type === 'add_tag') {
        const changed = await prisma.$queryRaw`UPDATE "NotePage" SET tags = array_append(tags, ${a.tag}) WHERE id = ANY(${a.pageIds}::text[]) AND "userId" = ${user.id} AND NOT (${a.tag} = ANY(tags)) RETURNING id`;
        undo.push({ type: 'remove_tag', tag: a.tag, ids: changed.map((r) => r.id) });
      } else if (a.type === 'remove_tag') {
        const changed = await prisma.$queryRaw`UPDATE "NotePage" SET tags = array_remove(tags, ${a.tag}) WHERE id = ANY(${a.pageIds}::text[]) AND "userId" = ${user.id} AND ${a.tag} = ANY(tags) RETURNING id`;
        undo.push({ type: 'add_tag', tag: a.tag, ids: changed.map((r) => r.id) });
      } else if (a.type === 'archive_pages') {
        const changed = await prisma.$queryRaw`UPDATE "NotePage" SET "archivedAt" = NOW() WHERE id = ANY(${a.pageIds}::text[]) AND "userId" = ${user.id} AND "archivedAt" IS NULL RETURNING id`;
        undo.push({ type: 'unarchive', ids: changed.map((r) => r.id) });
      } else if (a.type === 'pin_pages') {
        const changed = await prisma.$queryRaw`UPDATE "NotePage" SET pinned = true WHERE id = ANY(${a.pageIds}::text[]) AND "userId" = ${user.id} AND pinned = false RETURNING id`;
        undo.push({ type: 'unpin', ids: changed.map((r) => r.id) });
      } else if (a.type === 'create_index_page') {
        const sectionId = real(a.sectionId);
        if (!ownSections.has(sectionId)) continue;
        const targets = await prisma.notePage.findMany({ where: { id: { in: a.pageIds }, userId: user.id }, select: { id: true, title: true }, orderBy: { title: 'asc' } });
        const doc = sanitizeDoc({
          type: 'doc',
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: `Mục lục ${targets.length} trang — tạo bởi trợ lý theo yêu cầu: "${run.command}"` }] },
            { type: 'bulletList', content: targets.map((t) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: t.title || 'Không tiêu đề', marks: [{ type: 'link', attrs: { href: `/notes?p=${t.id}` } }] }] }] })) },
          ],
        });
        const page = await prisma.notePage.create({ data: { userId: user.id, sectionId, title: a.title, contentJson: doc, ...helpers.derived(a.title, doc, []) }, select: { id: true } });
        undo.push({ type: 'delete_page', id: page.id });
      }
    }
    // Thẻ đổi thì searchText phải tính lại (tìm theo thẻ dùng cột tags nên không gấp — làm nền)
    const tagIds = undo.filter((u) => u.type === 'remove_tag' || u.type === 'add_tag').flatMap((u) => u.ids);
    Promise.all(tagIds.slice(0, 200).map((id) => helpers.refreshSearchText(id))).catch(() => {});
    await prisma.noteAgentRun.update({ where: { id: run.id }, data: { executedAt: new Date(), undo } });
    res.json({ ok: true, steps: undo.length });
  } catch (err) { sendError(res, err, 'agent execute'); }
});

router.post('/agent/:runId/undo', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Trợ lý sắp xếp bằng lời');
    const run = await prisma.noteAgentRun.findFirst({ where: { id: req.params.runId, userId: user.id } });
    if (!run?.executedAt) throw httpError(404, 'Không có thao tác nào để hoàn tác');
    if (run.undoneAt) throw httpError(400, 'Đã hoàn tác rồi');
    for (const u of arr(run.undo).slice().reverse()) {
      if (u.type === 'delete_page') await prisma.notePage.deleteMany({ where: { id: u.id, userId: user.id } });
      else if (u.type === 'restore_sections') {
        const groups = {};
        u.pages.forEach((p) => { (groups[p.sectionId || 'null'] ||= []).push(p.id); });
        await Promise.all(Object.entries(groups).map(([sid, ids]) => prisma.notePage.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { sectionId: sid === 'null' ? null : sid } })));
      } else if (u.type === 'remove_tag' && u.ids.length) await prisma.$executeRaw`UPDATE "NotePage" SET tags = array_remove(tags, ${u.tag}) WHERE id = ANY(${u.ids}::text[]) AND "userId" = ${user.id}`;
      else if (u.type === 'add_tag' && u.ids.length) await prisma.$executeRaw`UPDATE "NotePage" SET tags = array_append(tags, ${u.tag}) WHERE id = ANY(${u.ids}::text[]) AND "userId" = ${user.id} AND NOT (${u.tag} = ANY(tags))`;
      else if (u.type === 'unarchive' && u.ids.length) await prisma.notePage.updateMany({ where: { id: { in: u.ids }, userId: user.id }, data: { archivedAt: null } });
      else if (u.type === 'unpin' && u.ids.length) await prisma.notePage.updateMany({ where: { id: { in: u.ids }, userId: user.id }, data: { pinned: false } });
      else if (u.type === 'delete_section') {
        // Chỉ xoá mục vừa tạo nếu còn rỗng (người dùng có thể đã thêm trang vào sau đó)
        const n = await prisma.notePage.count({ where: { sectionId: u.id } });
        if (!n) await prisma.noteSection.deleteMany({ where: { id: u.id, userId: user.id } });
      } else if (u.type === 'delete_notebook') {
        const n = await prisma.notePage.count({ where: { section: { notebookId: u.id } } });
        if (!n) await prisma.noteNotebook.deleteMany({ where: { id: u.id, userId: user.id } });
      }
    }
    await prisma.noteAgentRun.update({ where: { id: run.id }, data: { undoneAt: new Date() } });
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'agent undo'); }
});

router.get('/agent/history', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    requireAccount(user, 'Trợ lý sắp xếp bằng lời');
    const runs = await prisma.noteAgentRun.findMany({ where: { userId: user.id, executedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, command: true, executedAt: true, undoneAt: true } });
    res.json(runs);
  } catch (err) { sendError(res, err, 'agent history'); }
});

router.get('/usage', async (req, res) => {
  try {
    const user = await loadNoteActor(req);
    res.json(await aiUsage(user));
  } catch (err) { sendError(res, err, 'usage'); }
});

module.exports = router;
module.exports._test = { cleanQuestion, cleanTree, chunkText, keywords, weekKey, fmtTime, vnDay };
