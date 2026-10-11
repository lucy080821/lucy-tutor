// Bảng quy đổi số câu đúng (0-40) → band IELTS và quy tắc làm tròn Overall, dùng cho trang /ielts-band-calculator.
// CHÉP Y NGUYÊN từ backend/src/utils/ieltsBandTables.js + ieltsRounding.js (frontend không import được file
// CommonJS của backend) — sửa số liệu thì sửa cả 2 nơi. Đây là bảng quy đổi phổ biến, không phải bảng chính
// thức của 1 kỳ thi cụ thể (mỗi đề thật có thể lệch ±1 câu ở ngưỡng).

export type BandRow = { minRaw: number; band: number };

export const LISTENING_BAND_TABLE: BandRow[] = [
  { minRaw: 39, band: 9.0 }, { minRaw: 37, band: 8.5 }, { minRaw: 35, band: 8.0 }, { minRaw: 32, band: 7.5 },
  { minRaw: 30, band: 7.0 }, { minRaw: 26, band: 6.5 }, { minRaw: 23, band: 6.0 }, { minRaw: 18, band: 5.5 },
  { minRaw: 16, band: 5.0 }, { minRaw: 13, band: 4.5 }, { minRaw: 11, band: 4.0 }, { minRaw: 9, band: 3.5 },
  { minRaw: 7, band: 3.0 }, { minRaw: 5, band: 2.5 }, { minRaw: 4, band: 2.0 }, { minRaw: 0, band: 1.0 },
];

export const READING_BAND_TABLE_ACADEMIC: BandRow[] = [
  { minRaw: 39, band: 9.0 }, { minRaw: 37, band: 8.5 }, { minRaw: 36, band: 8.0 }, { minRaw: 34, band: 7.5 },
  { minRaw: 32, band: 7.0 }, { minRaw: 30, band: 6.5 }, { minRaw: 27, band: 6.0 }, { minRaw: 23, band: 5.5 },
  { minRaw: 19, band: 5.0 }, { minRaw: 15, band: 4.5 }, { minRaw: 13, band: 4.0 }, { minRaw: 10, band: 3.5 },
  { minRaw: 8, band: 3.0 }, { minRaw: 6, band: 2.5 }, { minRaw: 4, band: 2.0 }, { minRaw: 0, band: 1.0 },
];

export const READING_BAND_TABLE_GT: BandRow[] = [
  { minRaw: 40, band: 9.0 }, { minRaw: 39, band: 8.5 }, { minRaw: 37, band: 8.0 }, { minRaw: 36, band: 7.5 },
  { minRaw: 34, band: 7.0 }, { minRaw: 32, band: 6.5 }, { minRaw: 30, band: 6.0 }, { minRaw: 27, band: 5.5 },
  { minRaw: 23, band: 5.0 }, { minRaw: 19, band: 4.5 }, { minRaw: 15, band: 4.0 }, { minRaw: 12, band: 3.5 },
  { minRaw: 9, band: 3.0 }, { minRaw: 6, band: 2.5 }, { minRaw: 4, band: 2.0 }, { minRaw: 0, band: 1.0 },
];

export function rawScoreToBand(raw: number, table: BandRow[]): number {
  const row = [...table].sort((a, b) => b.minRaw - a.minRaw).find((r) => raw >= r.minRaw);
  return row ? row.band : 0;
}

/** Khoảng số câu đúng của mỗi band, để in bảng quy đổi: [{ band, from, to }]. */
export function bandRanges(table: BandRow[]): { band: number; from: number; to: number }[] {
  const sorted = [...table].sort((a, b) => b.minRaw - a.minRaw);
  return sorted.map((r, i) => ({ band: r.band, from: r.minRaw, to: i === 0 ? 40 : sorted[i - 1].minRaw - 1 }));
}

/** Phần lẻ < .25 → làm tròn xuống; từ .25 đến < .75 → .5; từ .75 trở lên → band nguyên kế tiếp
 *  (6.125 → 6.0, 6.25 → 6.5, 6.625 → 6.5, 6.75 → 7.0). */
export function roundIeltsBand(avg: number): number {
  const whole = Math.floor(avg + 1e-9);
  const frac = avg - whole;
  if (frac < 0.25 - 1e-9) return whole;
  if (frac < 0.75 - 1e-9) return whole + 0.5;
  return whole + 1;
}

export const fmtBand = (b: number) => b.toFixed(1);
