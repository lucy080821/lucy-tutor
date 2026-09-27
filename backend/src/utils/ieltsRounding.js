// IELTS overall-band rounding rule. VERIFY against an official IELTS source before relying on
// this for anything beyond practice-test estimates — the commonly-described rule (used here) is:
// take the raw average, round to the nearest quarter band, then if the result ends in .25 round
// UP to the next .5, and if it ends in .75 round UP to the next whole band (bands never round
// down at the quarter mark). Examples: 6.25 -> 6.5, 6.63 (~6.75 after rounding to quarter) -> 7.0.
function roundIeltsBand(rawAverage) {
  const nearestQuarter = Math.round(rawAverage * 4) / 4;
  const wholePart = Math.floor(nearestQuarter);
  const frac = nearestQuarter - wholePart;
  if (Math.abs(frac - 0.25) < 1e-9) return wholePart + 0.5;
  if (Math.abs(frac - 0.75) < 1e-9) return wholePart + 1;
  return nearestQuarter; // frac is already 0 or 0.5
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
