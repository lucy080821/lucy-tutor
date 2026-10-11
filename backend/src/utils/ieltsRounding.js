// IELTS overall-band rounding rule (as published by IELTS): if the average ends in .25 it is rounded
// UP to the next half band, if it ends in .75 it is rounded UP to the next whole band. Anything below
// .25 rounds down, so: fraction < .25 -> .0, .25 <= fraction < .75 -> .5, fraction >= .75 -> next whole.
// Examples: 6.125 -> 6.0, 6.25 -> 6.5, 6.625 -> 6.5, 6.75 -> 7.0.
// (An earlier version rounded to the nearest quarter first, which pushed 6.125 up to 6.5 and 6.625 up to 7.0.)
// Mirrored in frontend/src/lib/tools/ieltsBand.ts — keep both in sync.
function roundIeltsBand(rawAverage) {
  const whole = Math.floor(rawAverage + 1e-9);
  const frac = rawAverage - whole;
  if (frac < 0.25 - 1e-9) return whole;
  if (frac < 0.75 - 1e-9) return whole + 0.5;
  return whole + 1;
}

// Writing overall = Task 1 (weight 1/3) + Task 2 (weight 2/3), per the official IELTS weighting
// (Task 2 counts for more of the Writing band than Task 1).
function combineWritingBand(task1Band, task2Band) {
  return roundIeltsBand((task1Band * 1 + task2Band * 2) / 3);
}

// Speaking overall = simple average of the 3 parts' own overall bands. NOTE: this is a
// necessary simplification of real IELTS practice — a real examiner scores ONE holistic band
// per criterion across the whole speaking test, not per-part-then-averaged — but since this
// app submits/grades each Speaking part independently (asynchronous per-part recording), there
// is no single combined transcript to grade holistically against. Averaging the 3 parts' own
// overall bands is the closest practical approximation given that constraint.
function combineSpeakingBand(part1Band, part2Band, part3Band) {
  return roundIeltsBand((part1Band + part2Band + part3Band) / 3);
}

// Average of a criterion set (e.g. the 4 Writing or 4 Speaking criteria) into one task/part band.
function averageCriteriaBands(bands) {
  const valid = bands.filter((b) => typeof b === 'number' && !Number.isNaN(b));
  if (!valid.length) return 0;
  return roundIeltsBand(valid.reduce((s, b) => s + b, 0) / valid.length);
}

module.exports = { roundIeltsBand, combineWritingBand, combineSpeakingBand, averageCriteriaBands };
