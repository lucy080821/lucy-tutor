// Backend port of frontend/src/lib/readingGrading.ts's isReadingAnswerCorrect +
// frontend/src/lib/textGrading.ts's cleanString/levenshteinDistance — the backend is a
// separate Node runtime and can't import the frontend's TS module directly, so this is a
// deliberate small duplication, kept behaviorally identical: index equality for non-fill
// types, Levenshtein-tolerant cleaned-string equality for FILL_TYPES. Extended here to also
// check each IeltsQuestion's `acceptableAnswers` (IELTS answer keys often allow spelling
// variants, e.g. "colour"/"color") in addition to `correctAnswer`.
const FILL_TYPES = ['FILL_BLANK', 'SENTENCE_COMPLETION', 'SHORT_ANSWER'];

const cleanString = (str) => String(str).toLowerCase().replace(/[^a-z0-9]/g, '');

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

function matchesFreeText(userAnswer, candidate) {
  const cleanUser = cleanString(userAnswer ?? '');
  const cleanCandidate = cleanString(candidate ?? '');
  if (!cleanUser || !cleanCandidate) return false;
  const maxTypoDistance = cleanCandidate.length <= 4 ? 1 : 2;
  return cleanUser === cleanCandidate || levenshteinDistance(cleanUser, cleanCandidate) <= maxTypoDistance;
}

// AI trích xuất hay bỏ trống `options` của True/False/Not Given (đáp án vẫn là correctIndex 0/1/2)
// → điền sẵn bộ lựa chọn chuẩn của đề thật, thứ tự khớp với correctIndex.
const DEFAULT_OPTIONS = {
  TRUE_FALSE: ['TRUE', 'FALSE', 'NOT GIVEN'],
  YES_NO_NOTGIVEN: ['YES', 'NO', 'NOT GIVEN']
};

function parseOptions(question) {
  let opts = null;
  try { opts = question.options ? JSON.parse(question.options) : null; } catch { opts = null; }
  if (Array.isArray(opts) && opts.length) return opts;
  return DEFAULT_OPTIONS[question.type] || null;
}

// Câu trả lời bằng chữ: dạng điền từ, hoặc dạng chọn đáp án nhưng không có lựa chọn nào
// (vd Summary Completion không có ngân hàng từ — sách yêu cầu lấy từ trong bài đọc).
function isTextAnswerQuestion(question) {
  if (FILL_TYPES.includes(question.type)) return true;
  return !parseOptions(question) || (question.correctIndex == null && question.correctAnswer != null);
}

// Dạng câu hỏi gửi cho học viên — không kèm đáp án
function studentQuestionView(q) {
  const answerMode = isTextAnswerQuestion(q) ? 'TEXT' : 'CHOICE';
  const opts = parseOptions(q);
  // Câu điền có danh sách nhãn ngắn (vd ngân hàng từ A–I, đáp án là chữ cái) → vẫn gửi nhãn để
  // học viên bấm chọn thay vì gõ; đáp án gửi lên là chính chữ cái đó nên chấm kiểu điền từ vẫn đúng.
  const letterOptions = opts && opts.every((o) => String(o).trim().length <= 3) ? opts : null;
  return {
    id: q.id, questionNumber: q.questionNumber, type: q.type, groupInstruction: q.groupInstruction,
    promptText: q.promptText, options: answerMode === 'CHOICE' ? opts : letterOptions, answerMode,
    wordLimit: q.wordLimit, imageUrl: q.imageUrl
  };
}

// question: an IeltsQuestion row (type, correctIndex, correctAnswer, acceptableAnswers JSON string)
// userAnswer: number (option index) for choice questions, string for text questions
function isIeltsAnswerCorrect(question, userAnswer) {
  if (userAnswer === undefined || userAnswer === null || userAnswer === '') return false;

  if (isTextAnswerQuestion(question)) {
    if (matchesFreeText(userAnswer, question.correctAnswer)) return true;
    let acceptable = [];
    try { acceptable = question.acceptableAnswers ? JSON.parse(question.acceptableAnswers) : []; } catch { acceptable = []; }
    return acceptable.some((alt) => matchesFreeText(userAnswer, alt));
  }

  return Number(userAnswer) === question.correctIndex;
}

module.exports = { isIeltsAnswerCorrect, isTextAnswerQuestion, parseOptions, studentQuestionView, cleanString, levenshteinDistance };
