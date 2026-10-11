// Nguồn dữ liệu cho công cụ công khai /flashcard-tieng-anh (lớp 1–12): lấy thẳng từ vựng giáo viên đã soạn
// trong bài học (Lesson → VocabItem), không phải danh sách tự biên soạn.
//
// Quy ước đọc lớp/Unit từ tên (schema không có cột lớp/unit):
//  - Lớp học: tên chứa "Lớp N" và "Global Success", vd "Tiếng Anh Lớp 6 - Global Success" (lớp Giao Tiếp... bị bỏ qua)
//  - Bài học: tiêu đề chứa "Unit N" hoặc "Starter", vd "Unit 2 - My House", "UNIT 1 - LOCAL COMMUNITY (LESSON 1)"
//    → nhiều bài cùng Unit (Lesson 1, Lesson 2...) được gộp, bỏ từ trùng
//  - Bài có publishTime ở tương lai chưa được đưa ra công khai
//
// Quét 1 lần lúc khởi động rồi mỗi ngày lúc 23:30 giờ VN; kết quả giữ trong RAM, GET /api/free-tools/flashcards
// trả bản chụp này (frontend cache thêm 1 giờ) → từ giáo viên thêm trong ngày hiện ra trên trang công khai sau lượt quét cuối ngày.
const prisma = require('../lib/prisma');

const SCAN_HOUR_VN = 23;
const SCAN_MINUTE_VN = 30;

let snapshot = { scannedAt: null, grades: [] };
let timer = null;

const GRADE_RE = /l[ớo]p\s*(\d{1,2})\b/i;
const UNIT_RE = /\bunit\s*(\d{1,2})\b/i;
const STARTER_RE = /\bstarter\b/i;

function unitKeyOf(title) {
  const m = title.match(UNIT_RE);
  if (m) return Number(m[1]);
  return STARTER_RE.test(title) ? 0 : null; // 0 = Starter
}

// "UNIT 3 - AT THE STREET MARKET (LESSON 1)" → "At the street market"
function unitTitleOf(title) {
  let t = title
    .replace(/\((?:lesson|part|tiết|bài)[^)]*\)/gi, '')
    .replace(/\bunit\s*(\d{1,2}|starter)\b/i, '')
    .replace(STARTER_RE, '')
    .replace(/^[\s\-–—:.|]+|[\s\-–—:.|]+$/g, '')
    .trim();
  if (t && t === t.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}

// "Cái bàn học" → "cái bàn học" (giữ nguyên chữ viết tắt như "IT", "PE")
function tidyMeaning(s) {
  const t = String(s || '').trim();
  if (t.length > 1 && t[1] === t[1].toLowerCase()) return t.charAt(0).toLowerCase() + t.slice(1);
  return t;
}

async function scan() {
  const now = new Date();
  const classrooms = await prisma.classroom.findMany({
    where: { name: { contains: 'global success', mode: 'insensitive' } },
    select: { name: true },
  });
  // Tên lớp → số lớp (đọc từ tên)
  const gradeByName = new Map();
  for (const c of classrooms) {
    const m = c.name.match(GRADE_RE);
    const g = m && Number(m[1]);
    if (g >= 1 && g <= 12) gradeByName.set(c.name, g);
  }
  if (!gradeByName.size) return { scannedAt: now.toISOString(), grades: [] };

  const lessons = await prisma.lesson.findMany({
    where: {
      classroom: { name: { in: [...gradeByName.keys()] } },
      OR: [{ publishTime: null }, { publishTime: { lte: now } }],
      vocabularies: { some: {} },
    },
    orderBy: { createdAt: 'asc' },
    select: {
      title: true,
      classroom: { select: { name: true } },
      vocabularies: { select: { word: true, meaning: true, phonetic: true, example: true, pos: true } },
    },
  });

  const grades = new Map(); // grade → Map(unitKey → { key, title, cards, seen })
  for (const l of lessons) {
    const grade = gradeByName.get(l.classroom.name);
    const key = unitKeyOf(l.title);
    if (!grade || key === null) continue;
    if (!grades.has(grade)) grades.set(grade, new Map());
    const units = grades.get(grade);
    if (!units.has(key)) units.set(key, { key, title: unitTitleOf(l.title), cards: [], seen: new Set() });
    const u = units.get(key);
    for (const v of l.vocabularies) {
      const en = String(v.word || '').trim();
      const vi = tidyMeaning(v.meaning);
      const id = en.toLowerCase();
      if (!en || !vi || u.seen.has(id)) continue;
      u.seen.add(id);
      u.cards.push({
        en, vi,
        ...(/\p{L}/u.test(v.phonetic || '') ? { phonetic: v.phonetic.trim() } : {}), // bỏ giá trị giữ chỗ như "-"
        ...(v.example?.trim() ? { example: v.example.trim() } : {}),
        ...(v.pos?.trim() ? { pos: v.pos.trim() } : {}),
      });
    }
  }

  return {
    scannedAt: now.toISOString(),
    grades: [...grades.entries()].sort((a, b) => a[0] - b[0]).map(([grade, units]) => ({
      grade,
      units: [...units.values()].sort((a, b) => a.key - b.key).map(({ key, title, cards }) => ({ key, title, cards })),
    })),
  };
}

async function refresh() {
  try {
    const next = await scan();
    const words = next.grades.reduce((s, g) => s + g.units.reduce((t, u) => t + u.cards.length, 0), 0);
    snapshot = next;
    console.log(`[flashcards] Đã quét: ${next.grades.length} lớp, ${words} từ`);
  } catch (err) {
    // Giữ bản chụp cũ nếu lần quét này lỗi (vd DB tạm mất kết nối)
    console.error('[flashcards] Quét thất bại:', err.message);
  }
}

// Mốc 23:30 giờ VN (UTC+7, không có giờ mùa hè) kế tiếp
function msUntilNextScan() {
  const now = Date.now();
  const vn = new Date(now + 7 * 3600 * 1000);
  const target = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), SCAN_HOUR_VN, SCAN_MINUTE_VN) - 7 * 3600 * 1000;
  return target > now ? target - now : target + 24 * 3600 * 1000 - now;
}

function scheduleNext() {
  clearTimeout(timer);
  timer = setTimeout(async () => { await refresh(); scheduleNext(); }, msUntilNextScan());
  timer.unref?.();
}

function startFlashcardScanner() {
  refresh();
  scheduleNext();
}

const getFlashcardSnapshot = () => snapshot;

module.exports = { startFlashcardScanner, getFlashcardSnapshot };
