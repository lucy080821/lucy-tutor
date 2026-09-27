// Raw score (out of 40) -> IELTS band (1-9, .5 increments) concordance tables.
//
// These are the commonly-published Cambridge/IELTS concordance tables used across most prep
// materials — NOT copied from a single official per-test-administration key (IELTS doesn't
// publish one universal table; each real test administration can shift by ±1 raw point at the
// boundaries). Cross-check against an official/current IELTS source before relying on these
// for anything beyond practice-test estimates, and expect to update them if a more precise
// source becomes available.
//
// Listening uses one table for both Academic and General Training. Reading has two DIFFERENT
// tables — General Training is more lenient at the low end (fewer correct answers needed for
// the same band) since its texts are shorter/simpler than Academic's.
const LISTENING_BAND_TABLE = [
  { minRaw: 39, band: 9.0 },
  { minRaw: 37, band: 8.5 },
  { minRaw: 35, band: 8.0 },
  { minRaw: 32, band: 7.5 },
  { minRaw: 30, band: 7.0 },
  { minRaw: 26, band: 6.5 },
  { minRaw: 23, band: 6.0 },
  { minRaw: 18, band: 5.5 },
  { minRaw: 16, band: 5.0 },
  { minRaw: 13, band: 4.5 },
  { minRaw: 11, band: 4.0 },
  { minRaw: 9, band: 3.5 },
  { minRaw: 7, band: 3.0 },
  { minRaw: 5, band: 2.5 },
  { minRaw: 4, band: 2.0 },
  { minRaw: 0, band: 1.0 }
];

const READING_BAND_TABLE_ACADEMIC = [
  { minRaw: 39, band: 9.0 },
  { minRaw: 37, band: 8.5 },
  { minRaw: 36, band: 8.0 },
  { minRaw: 34, band: 7.5 },
  { minRaw: 32, band: 7.0 },
  { minRaw: 30, band: 6.5 },
  { minRaw: 27, band: 6.0 },
  { minRaw: 23, band: 5.5 },
  { minRaw: 19, band: 5.0 },
  { minRaw: 15, band: 4.5 },
  { minRaw: 13, band: 4.0 },
  { minRaw: 10, band: 3.5 },
  { minRaw: 8, band: 3.0 },
  { minRaw: 6, band: 2.5 },
  { minRaw: 4, band: 2.0 },
  { minRaw: 0, band: 1.0 }
];

const READING_BAND_TABLE_GT = [
  { minRaw: 40, band: 9.0 },
  { minRaw: 39, band: 8.5 },
  { minRaw: 37, band: 8.0 },
  { minRaw: 36, band: 7.5 },
  { minRaw: 34, band: 7.0 },
  { minRaw: 32, band: 6.5 },
  { minRaw: 30, band: 6.0 },
  { minRaw: 27, band: 5.5 },
  { minRaw: 23, band: 5.0 },
  { minRaw: 19, band: 4.5 },
  { minRaw: 15, band: 4.0 },
  { minRaw: 12, band: 3.5 },
  { minRaw: 9, band: 3.0 },
  { minRaw: 6, band: 2.5 },
  { minRaw: 4, band: 2.0 },
  { minRaw: 0, band: 1.0 }
];

function rawScoreToBand(rawScore, table) {
  const sorted = [...table].sort((a, b) => b.minRaw - a.minRaw);
  const row = sorted.find((r) => rawScore >= r.minRaw);
  return row ? row.band : 0;
}

module.exports = { LISTENING_BAND_TABLE, READING_BAND_TABLE_ACADEMIC, READING_BAND_TABLE_GT, rawScoreToBand };
