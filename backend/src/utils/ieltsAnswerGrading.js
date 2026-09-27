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

// question: an IeltsQuestion row (type, correctIndex, correctAnswer, acceptableAnswers JSON string)
// userAnswer: number (option index) for non-fill types, string for FILL_TYPES
function isIeltsAnswerCorrect(question, userAnswer) {
  if (userAnswer === undefined || userAnswer === null || userAnswer === '') return false;

  if (FILL_TYPES.includes(question.type)) {
    if (matchesFreeText(userAnswer, question.correctAnswer)) return true;
    let acceptable = [];
    try { acceptable = question.acceptableAnswers ? JSON.parse(question.acceptableAnswers) : []; } catch { acceptable = []; }
    return acceptable.some((alt) => matchesFreeText(userAnswer, alt));
  }

  return Number(userAnswer) === question.correctIndex;
}

module.exports = { isIeltsAnswerCorrect, cleanString, levenshteinDistance };
