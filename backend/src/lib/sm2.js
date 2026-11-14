// Thuật toán SM-2 dùng chung cho /gym (srs.routes.js) và Nông Trại Qilin (farm.routes.js).
// Quality: 1 (Lại/Again), 3 (Khó/Hard), 4 (Tốt/Good), 5 (Dễ/Easy)
function calculateSM2(quality, prevRepetitions, prevEaseFactor, prevInterval) {
  let repetitions = prevRepetitions;
  let interval = prevInterval;
  let easeFactor = prevEaseFactor;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { repetitions, interval, easeFactor, nextReviewDate };
}

// Trạng thái thẻ sau 1 lần ôn — cùng quy tắc với POST /api/srs/review/:progressId
function statusAfterReview(quality, interval, prevStatus) {
  if (quality < 3) return 'LEARNING';
  if (interval > 21) return 'MASTERED';
  return 'REVIEWING';
}

module.exports = { calculateSM2, statusAfterReview };
