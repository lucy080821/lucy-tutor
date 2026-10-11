// Flashcard tiếng Anh lớp 1–12 theo Unit sách Global Success — trang /flashcard-tieng-anh.
// Từ vựng lấy THẲNG từ bài học giáo viên Lucy Tutor đã soạn trong hệ thống (GET /api/free-tools/flashcards,
// backend tự quét lại DB mỗi ngày 23:30 giờ VN — xem backend/src/utils/flashcardCatalog.js). File này chỉ giữ
// KHUNG tên Unit của từng lớp; Unit chưa có từ trong hệ thống hiện "Hệ thống đang cập nhật...".
// Trang render phía server (tốt cho SEO) và làm mới mỗi giờ (FLASHCARD_REVALIDATE).
import { API_URL } from "@/lib/blog";

export type Flashcard = { en: string; vi: string; phonetic?: string; example?: string; pos?: string };
export type FlashUnit = { label: string; title: string; cards: Flashcard[] };
export type FlashGrade = { grade: number; slug: string; units: FlashUnit[] };

export const FLASHCARD_REVALIDATE = 3600;
export const UPDATING_TEXT = "Hệ thống đang cập nhật...";

// Tên Unit theo mục lục sách. "Starter: …" ở đầu = Unit Starter (key 0), các mục còn lại là Unit 1, 2, 3…
const UNIT_TITLES: Record<number, string[]> = {
  1: ["In the school playground", "In the dining room", "At the street market", "In the bedroom", "At the fish and chip shop", "In the classroom", "In the garden", "In the park", "In the shop", "At the zoo", "At the bus stop", "At the lake", "In the school canteen", "In the toy shop", "At the football match", "At home"],
  2: ["At my birthday party", "In the backyard", "At the seaside", "In the countryside", "In the classroom", "On the farm", "In the kitchen", "In the village", "In the grocery store", "At the zoo", "In the playground", "At the café", "In the maths class", "At home", "In the clothes shop", "At the campsite"],
  3: ["Starter: Numbers and alphabet", "Hello", "Our names", "Our friends", "Our bodies", "My hobbies", "Our school", "Classroom instructions", "My school things", "Colours", "Break time activities", "My family", "Jobs", "My house", "My bedroom", "At the dining table", "My pets", "Our toys", "Playing and doing", "Outdoor activities", "At the zoo"],
  4: ["My friends", "Time and daily routines", "My week", "My birthday party", "Things we can do", "Our school facilities", "Our timetables", "My favourite subjects", "Our sports day", "Our summer holidays", "My home", "Jobs", "Appearance", "Daily activities", "My family's weekends", "Weather", "In the city", "At the shopping centre", "The animal world", "At summer camp"],
  5: ["All about me", "Our homes", "My foreign friends", "Our free-time activities", "My future job", "Our school rooms", "Our favourite school activities", "In our classroom", "Our outdoor activities", "Our school trip", "Family time", "Our Tet holiday", "Our special days", "Staying healthy", "Our health", "Seasons and the weather", "Stories for children", "Means of transport", "Places of interest", "Our summer holidays"],
  6: ["My new school", "My house", "My friends", "My neighbourhood", "Natural wonders of Viet Nam", "Our Tet holiday", "Television", "Sports and games", "Cities of the world", "Our houses in the future", "Our greener world", "Robots"],
  7: ["Hobbies", "Healthy living", "Community service", "Music and arts", "Food and drink", "A visit to a school", "Traffic", "Films", "Festivals around the world", "Energy sources", "Travelling in the future", "English-speaking countries"],
  8: ["Leisure time", "Life in the countryside", "Teenagers", "Ethnic groups of Viet Nam", "Our customs and traditions", "Lifestyles", "Environmental protection", "Shopping", "Natural disasters", "Communication in the future", "Science and technology", "Life on other planets"],
  9: ["Local community", "City life", "Healthy living for teens", "Remembering the past", "Our experiences", "Vietnamese lifestyle: then and now", "Natural wonders of the world", "Tourism", "World Englishes", "Planet Earth", "Electronic devices", "Career choices"],
  10: ["Family life", "Humans and the environment", "Music", "For a better community", "Inventions", "Gender equality", "Viet Nam and international organisations", "New ways to learn", "Protecting the environment", "Ecotourism"],
  11: ["A long and healthy life", "The generation gap", "Cities of the future", "ASEAN and Viet Nam", "Global warming", "Preserving our heritage", "Education options for school-leavers", "Becoming independent", "Social issues", "The ecosystem"],
  12: ["Life stories we admire", "A multicultural world", "Green living", "Urbanisation", "The world of work", "Artificial intelligence", "The world of mass media", "Wildlife conservation", "Career paths", "Lifelong learning"],
};

export const GRADE_NUMBERS = Object.keys(UNIT_TITLES).map(Number);
export const gradeSlug = (grade: number) => `lop-${grade}`;
export const gradeFromSlug = (slug: string) => {
  const m = slug.match(/^lop-(\d{1,2})$/);
  const g = m ? Number(m[1]) : NaN;
  return GRADE_NUMBERS.includes(g) ? g : null;
};

type ApiUnit = { key: number; title: string; cards: Flashcard[] };
type ApiSnapshot = { scannedAt: string | null; grades: { grade: number; units: ApiUnit[] }[] };

const labelOf = (key: number) => (key === 0 ? "Starter" : `Unit ${key}`);

function skeleton(grade: number): Map<number, FlashUnit> {
  const units = new Map<number, FlashUnit>();
  let n = 1;
  for (const t of UNIT_TITLES[grade] ?? []) {
    const key = t.startsWith("Starter: ") ? 0 : n++;
    units.set(key, { label: labelOf(key), title: key === 0 ? t.slice(9) : t, cards: [] });
  }
  return units;
}

async function fetchSnapshot(): Promise<ApiSnapshot | null> {
  try {
    const res = await fetch(`${API_URL}/api/free-tools/flashcards`, { next: { revalidate: FLASHCARD_REVALIDATE } });
    if (!res.ok) return null;
    return (await res.json()) as ApiSnapshot;
  } catch {
    return null;
  }
}

/** Khung Unit lớp 1–12 ghép với từ vựng trong hệ thống. Backend lỗi → mọi Unit đều "đang cập nhật". */
export async function getFlashGrades(): Promise<FlashGrade[]> {
  const snap = await fetchSnapshot();
  return GRADE_NUMBERS.map((grade) => {
    const units = skeleton(grade);
    for (const u of snap?.grades.find((g) => g.grade === grade)?.units ?? []) {
      const known = units.get(u.key);
      // Ưu tiên tên Unit theo mục lục sách; Unit ngoài khung thì dùng tên bài học của giáo viên
      units.set(u.key, { label: labelOf(u.key), title: known?.title || u.title || labelOf(u.key), cards: u.cards });
    }
    return { grade, slug: gradeSlug(grade), units: [...units.entries()].sort((a, b) => a[0] - b[0]).map(([, u]) => u) };
  });
}

export async function getFlashGrade(slug: string): Promise<FlashGrade | undefined> {
  const grade = gradeFromSlug(slug);
  if (grade === null) return undefined;
  return (await getFlashGrades()).find((g) => g.grade === grade);
}

export const gradeWordCount = (g: FlashGrade) => g.units.reduce((s, u) => s + u.cards.length, 0);
export const readyUnits = (g: FlashGrade) => g.units.filter((u) => u.cards.length > 0);
