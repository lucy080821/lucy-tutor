"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type Difficulty = "easy" | "medium" | "hard";

interface Phoneme {
  symbol: string;
  keyword: string;
  difficulty: string;
  difficultyLevel: Difficulty;
  howTo: string;
  vsVietnamese: string;
  examples: string[];
  speakWord: string;
  tip?: string;
  voiced?: boolean; // only set on CONSONANTS — vowels are always voiced, no distinction needed
}

// ── DATA ────────────────────────────────────────────────────────────────────
// Order below matches the classic Adrian Underhill phonemic chart layout row by row
// (rendered as a fixed 4-column grid — see MONOPHTHONG_COLS in PhonemeGroup usage).
const MONOPHTHONGS: Phoneme[] = [
  {
    symbol: "/iː/", keyword: "see", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Môi dẹt, lưỡi cao trước, kéo dài. Giống 'i' tiếng Việt nhưng dài hơn.",
    vsVietnamese: "'i' trong 'bi' — nhưng kéo dài",
    examples: ["see", "feet", "team", "green", "believe"],
    speakWord: "see",
  },
  {
    symbol: "/ɪ/", keyword: "sit", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Lưỡi hơi cao trước, thả lỏng hơn /iː/. Ngắn và nhẹ.",
    vsVietnamese: "'i' ngắn — miệng không căng như /iː/",
    examples: ["sit", "big", "fish", "city", "busy"],
    speakWord: "sit",
    tip: "Đừng kéo dài — nếu kéo dài sẽ nghe thành /iː/",
  },
  {
    symbol: "/ʊ/", keyword: "put", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Môi hơi tròn, lưỡi cao sau, thả lỏng. Không căng như /uː/.",
    vsVietnamese: "'u' thả lỏng — không căng, không kéo dài",
    examples: ["put", "good", "book", "could", "foot"],
    speakWord: "put",
    tip: "Nhiều người học nhầm thành /uː/ — nhớ thả lỏng môi",
  },
  {
    symbol: "/uː/", keyword: "food", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Môi tròn căng, lưỡi cao sau, kéo dài. Giống 'u' tiếng Việt.",
    vsVietnamese: "'u' trong 'búa' — nhưng kéo dài hơn",
    examples: ["food", "shoe", "true", "blue", "school"],
    speakWord: "food",
  },
  {
    symbol: "/e/", keyword: "bed", difficulty: "Khá dễ", difficultyLevel: "easy",
    howTo: "Miệng hơi mở, lưỡi ở giữa-trước. Không lên quá cao.",
    vsVietnamese: "Gần 'ê' trong 'bế' — nhưng miệng mở hơn",
    examples: ["bed", "red", "head", "said", "many"],
    speakWord: "bed",
  },
  {
    symbol: "/ə/", keyword: "about", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Schwa — âm trung tính nhất, miệng thả lỏng hoàn toàn. Rất ngắn.",
    vsVietnamese: "Không có — âm 'ờ' cực ngắn và lười biếng",
    examples: ["about", "teacher", "second", "banana", "problem"],
    speakWord: "about",
    tip: "Schwa xuất hiện hầu hết trong các syllable không nhấn — phổ biến nhất tiếng Anh!",
  },
  {
    symbol: "/ɜː/", keyword: "nurse", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Lưỡi giữa, môi không tròn, kéo dài. Âm rất trung tính.",
    vsVietnamese: "Không có — gần 'ơ' nhưng lưỡi ở giữa miệng hơn",
    examples: ["nurse", "bird", "word", "learn", "first"],
    speakWord: "nurse",
    tip: "Nhiều người Việt đọc thành /ɔː/ — nhớ không tròn môi",
  },
  {
    symbol: "/ɔː/", keyword: "call", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Môi tròn, lưỡi sau, kéo dài. Âm 'o' sâu và dài hơn /ɒ/.",
    vsVietnamese: "'o' dài — như trong 'bò' nhưng sâu hơn",
    examples: ["call", "walk", "door", "four", "more"],
    speakWord: "call",
  },
  {
    symbol: "/æ/", keyword: "bad", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Miệng mở rộng theo chiều ngang, lưỡi thấp trước. Giống cười gượng.",
    vsVietnamese: "Không có trong tiếng Việt — giữa 'a' và 'e'",
    examples: ["bad", "cat", "man", "back", "happy"],
    speakWord: "bad",
    tip: "Cách nhớ: kéo khóe miệng ra hai bên và nói 'a'",
  },
  {
    symbol: "/ʌ/", keyword: "cup", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Miệng hơi mở, lưỡi giữa-thấp, thư giãn. Âm trung tính.",
    vsVietnamese: "Không có trong tiếng Việt — gần 'ă' ngắn nhưng vị trí lưỡi khác",
    examples: ["cup", "bus", "love", "blood", "money"],
    speakWord: "cup",
    tip: "Đây là nguyên âm phổ biến nhất trong tiếng Anh — rất quan trọng!",
  },
  {
    symbol: "/ɑː/", keyword: "calm", difficulty: "Khá dễ", difficultyLevel: "easy",
    howTo: "Miệng mở to, lưỡi thấp ra sau. Âm 'a' sâu, kéo dài.",
    vsVietnamese: "'a' trong 'ba' — nhưng sâu hơn và kéo dài",
    examples: ["calm", "car", "father", "heart", "start"],
    speakWord: "calm",
  },
  {
    symbol: "/ɒ/", keyword: "hot", difficulty: "Khá dễ", difficultyLevel: "easy",
    howTo: "Môi tròn nhẹ, lưỡi thấp sau. Ngắn và tròn.",
    vsVietnamese: "Gần 'o' trong 'bọ' — miệng mở rộng hơn",
    examples: ["hot", "dog", "stop", "body", "clock"],
    speakWord: "hot",
  },
];

// Reading order matches the chart: row 1 has 2 cells (ɪə, eɪ), rows 2-3 have 3 cells each —
// see DIPHTHONG_ROW_SIZES used when rendering, which slices this flat array into [2,3,3].
const DIPHTHONGS: Phoneme[] = [
  {
    symbol: "/ɪə/", keyword: "here", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Bắt đầu từ /ɪ/ cao trước trượt xuống /ə/ trung tính.",
    vsVietnamese: "Không có — 'ia' nhưng kết thúc bằng schwa, không phải 'a'",
    examples: ["here", "ear", "idea", "real", "weird"],
    speakWord: "here",
  },
  {
    symbol: "/eɪ/", keyword: "pain", difficulty: "Khá dễ", difficultyLevel: "easy",
    howTo: "Bắt đầu từ /e/ trượt lên /ɪ/. Lưỡi di chuyển từ giữa lên cao.",
    vsVietnamese: "Gần 'ây' trong 'đây' — bắt đầu bằng 'ê' rồi trượt lên",
    examples: ["pain", "day", "make", "name", "great"],
    speakWord: "pain",
  },
  {
    symbol: "/ʊə/", keyword: "cure", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Bắt đầu từ /ʊ/ tròn trượt xuống /ə/ trung tính.",
    vsVietnamese: "Không có — 'ua' nhưng âm đầu ngắn, kết thúc bằng schwa",
    examples: ["cure", "tour", "pure", "sure", "Europe"],
    speakWord: "cure",
  },
  {
    symbol: "/ɔɪ/", keyword: "joints", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Bắt đầu từ /ɔː/ tròn trượt lên /ɪ/. Môi từ tròn dần dẹt.",
    vsVietnamese: "Gần 'oi' trong 'tôi' — 'o' sâu rồi trượt lên 'i'",
    examples: ["joints", "boy", "oil", "voice", "coin"],
    speakWord: "joints",
  },
  {
    symbol: "/əʊ/", keyword: "bone", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Bắt đầu từ /ə/ trung tính trượt lên /ʊ/ tròn. Môi từ thả lỏng tới tròn.",
    vsVietnamese: "Không giống 'ô' tiếng Việt — bắt đầu bằng âm schwa rồi tròn môi",
    examples: ["bone", "go", "home", "know", "phone"],
    speakWord: "bone",
    tip: "Người Việt hay đọc thành 'ô' đơn — nhớ bắt đầu bằng schwa",
  },
  {
    symbol: "/eə/", keyword: "care", difficulty: "Khó", difficultyLevel: "hard",
    howTo: "Bắt đầu từ /e/ giữa trượt xuống /ə/ trung tính.",
    vsVietnamese: "Không có — 'ea' nhưng kết thúc mờ dần bằng schwa",
    examples: ["care", "air", "there", "where", "bear"],
    speakWord: "care",
  },
  {
    symbol: "/aɪ/", keyword: "spine", difficulty: "Khá dễ", difficultyLevel: "easy",
    howTo: "Bắt đầu từ /a/ rộng trượt lên /ɪ/. Miệng từ mở rộng thu lại.",
    vsVietnamese: "Gần 'ai' trong 'mai' — phát âm 'a' rồi trượt lên 'i'",
    examples: ["spine", "eye", "time", "write", "child"],
    speakWord: "spine",
  },
  {
    symbol: "/aʊ/", keyword: "mouth", difficulty: "Tương đối dễ", difficultyLevel: "easy",
    howTo: "Bắt đầu từ /a/ rộng trượt lên /ʊ/ tròn. Miệng từ mở rộng thu tròn.",
    vsVietnamese: "Gần 'au' trong 'màu' — 'a' rộng rồi tròn môi lên",
    examples: ["mouth", "now", "out", "house", "town"],
    speakWord: "mouth",
  },
];

const DIPHTHONG_ROW_SIZES = [2, 3, 3];

// Order matches the chart's 8-column x 3-row layout, columns paired unvoiced/voiced
// (p/b, t/d, tʃ/dʒ, k/g, f/v, θ/ð, s/z, ʃ/ʒ); row 3 is mostly sonorants (all voiced) plus /h/.
const CONSONANTS: Phoneme[] = [
  {
    symbol: "/p/", keyword: "pulse", difficulty: "Khá dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Hai môi khép lại rồi bật ra. Vô thanh — không rung dây thanh.",
    vsVietnamese: "Như 'p' tiếng Việt — nhưng có bật hơi ở đầu từ",
    examples: ["pulse", "pain", "pressure", "pill", "patient"],
    speakWord: "pulse",
    tip: "Ở đầu từ tiếng Anh, /p/ có bật hơi (aspirated) — đặt tay trước miệng, cảm nhận luồng hơi",
  },
  {
    symbol: "/b/", keyword: "blood", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /p/ nhưng có rung dây thanh. Hai môi khép rồi bật.",
    vsVietnamese: "Như 'b' tiếng Việt",
    examples: ["blood", "bone", "body", "breath", "brain"],
    speakWord: "blood",
  },
  {
    symbol: "/t/", keyword: "tissue", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Đầu lưỡi chạm lợi trên rồi bật ra. Vô thanh.",
    vsVietnamese: "Như 't' tiếng Việt — có bật hơi ở đầu từ",
    examples: ["tissue", "tooth", "throat", "tongue", "test"],
    speakWord: "tissue",
  },
  {
    symbol: "/d/", keyword: "dose", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /t/ nhưng có rung dây thanh.",
    vsVietnamese: "Như 'd' miền Nam hoặc 'đ' — nhưng lưỡi chạm lợi, không răng",
    examples: ["dose", "drug", "diagnosis", "doctor", "disease"],
    speakWord: "dose",
  },
  {
    symbol: "/tʃ/", keyword: "chest", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "/t/ + /ʃ/ kết hợp. Lưỡi chạm lợi rồi bật ra với âm SH. CH.",
    vsVietnamese: "Gần 'ch' trong 'chiều' — nhưng lưỡi chạm lợi, không răng",
    examples: ["chest", "chin", "check", "change", "chart"],
    speakWord: "chest",
  },
  {
    symbol: "/dʒ/", keyword: "inject", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /tʃ/ nhưng có rung dây thanh. J/G trước e,i.",
    vsVietnamese: "Gần 'j' — như 'ch' miền Bắc nhưng hữu thanh",
    examples: ["inject", "joint", "jaw", "gene", "damage"],
    speakWord: "inject",
  },
  {
    symbol: "/k/", keyword: "cardiac", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Gốc lưỡi chạm vòm mềm rồi bật. Vô thanh.",
    vsVietnamese: "Như 'c/k' tiếng Việt — có bật hơi ở đầu từ",
    examples: ["cardiac", "cancer", "kidney", "cortex", "clinic"],
    speakWord: "cardiac",
  },
  {
    symbol: "/g/", keyword: "glucose", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /k/ nhưng có rung dây thanh.",
    vsVietnamese: "Như 'g' trong 'gà' miền Nam",
    examples: ["glucose", "gene", "gut", "gland", "growth"],
    speakWord: "glucose",
  },
  {
    symbol: "/f/", keyword: "fever", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Răng trên chạm nhẹ môi dưới, thổi hơi ra. Vô thanh.",
    vsVietnamese: "'ph' trong 'phở' — giống hệt",
    examples: ["fever", "fracture", "fluid", "fiber", "function"],
    speakWord: "fever",
  },
  {
    symbol: "/v/", keyword: "vein", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /f/ nhưng có rung dây thanh. Răng trên — môi dưới + rung.",
    vsVietnamese: "'v' tiếng Việt — nhưng răng chạm môi dưới (không phải hai môi)",
    examples: ["vein", "valve", "virus", "vaccine", "vitamin"],
    speakWord: "vein",
    tip: "Cách nhớ: đặt răng lên môi dưới — nếu không đặt răng sẽ thành /w/",
  },
  {
    symbol: "/θ/", keyword: "therapy", difficulty: "Khó", difficultyLevel: "hard", voiced: false,
    howTo: "Đầu lưỡi ra ngoài giữa răng, thổi hơi qua. Vô thanh. TH vô thanh.",
    vsVietnamese: "Không có trong tiếng Việt — đặt lưỡi ra ngoài răng và thổi",
    examples: ["therapy", "tooth", "think", "through", "thirst"],
    speakWord: "therapy",
    tip: "Sai phổ biến nhất của người Việt: đọc thành /t/ hoặc /s/. Lưỡi PHẢI ra ngoài răng!",
  },
  {
    symbol: "/ð/", keyword: "breathe", difficulty: "Khó", difficultyLevel: "hard", voiced: true,
    howTo: "Như /θ/ nhưng có rung dây thanh. TH hữu thanh.",
    vsVietnamese: "Không có — như /θ/ nhưng rung cổ họng",
    examples: ["breathe", "the", "this", "they", "father"],
    speakWord: "breathe",
    tip: "Đặt tay lên cổ để cảm nhận rung — đây là TH trong 'the', 'this', 'they'",
  },
  {
    symbol: "/s/", keyword: "surgery", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Đầu lưỡi gần lợi trên, thổi hơi qua khe hẹp. Vô thanh.",
    vsVietnamese: "'s' tiếng Việt — giống hệt",
    examples: ["surgery", "spine", "skull", "symptom", "scan"],
    speakWord: "surgery",
  },
  {
    symbol: "/z/", keyword: "enzyme", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Như /s/ nhưng có rung dây thanh.",
    vsVietnamese: "Không có âm này trong tiếng Việt — 's' nhưng rung cổ họng",
    examples: ["enzyme", "zero", "zone", "xray", "virus"],
    speakWord: "enzyme",
  },
  {
    symbol: "/ʃ/", keyword: "shin", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Lưỡi rộng hơn /s/, môi hơi tròn, thổi hơi. Vô thanh. SH.",
    vsVietnamese: "Gần 'sh' — như tiếng suối chảy 'sshhh'",
    examples: ["shin", "shoulder", "shiver", "shock", "shape"],
    speakWord: "shin",
  },
  {
    symbol: "/ʒ/", keyword: "measure", difficulty: "Khó", difficultyLevel: "hard", voiced: true,
    howTo: "Như /ʃ/ nhưng có rung dây thanh. Hiếm gặp.",
    vsVietnamese: "Gần 'gi' miền Nam — nhưng lưỡi không chạm vòm",
    examples: ["measure", "vision", "usual", "pleasure", "treasure"],
    speakWord: "measure",
  },
  {
    symbol: "/m/", keyword: "muscle", difficulty: "Khá dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Hai môi khép, hơi thoát qua mũi. Hữu thanh.",
    vsVietnamese: "'m' tiếng Việt — giống hệt",
    examples: ["muscle", "mouth", "membrane", "marrow", "mental"],
    speakWord: "muscle",
  },
  {
    symbol: "/n/", keyword: "nerve", difficulty: "Khá dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Đầu lưỡi chạm lợi trên, hơi thoát qua mũi. Hữu thanh.",
    vsVietnamese: "'n' tiếng Việt — giống hệt",
    examples: ["nerve", "neck", "nose", "nasal", "nutrient"],
    speakWord: "nerve",
  },
  {
    symbol: "/ŋ/", keyword: "lung", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Gốc lưỡi chạm vòm mềm, hơi ra mũi. NG cuối từ.",
    vsVietnamese: "'ng/nh' cuối từ trong 'làng', 'nóng' — giống hệt",
    examples: ["lung", "king", "sing", "tongue", "strong"],
    speakWord: "lung",
    tip: "Người Việt hay thêm /g/ vào cuối — 'lung' không có /g/, chỉ có /ŋ/",
  },
  {
    symbol: "/h/", keyword: "heart", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: false,
    howTo: "Thở ra đơn giản, không có sự cản trở. Vô thanh.",
    vsVietnamese: "'h' tiếng Việt — giống hệt",
    examples: ["heart", "head", "heal", "health", "hormones"],
    speakWord: "heart",
  },
  {
    symbol: "/l/", keyword: "liver", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Đầu lưỡi chạm lợi trên, hơi thoát hai bên lưỡi. Hữu thanh.",
    vsVietnamese: "'l' tiếng Việt — giống nhưng cuối từ /l/ 'dark' nặng hơn",
    examples: ["liver", "lungs", "limb", "ligament", "layer"],
    speakWord: "liver",
  },
  {
    symbol: "/r/", keyword: "artery", difficulty: "Khó", difficultyLevel: "hard", voiced: true,
    howTo: "Lưỡi cong lên nhưng không chạm vòm. Hữu thanh. R tiếng Anh.",
    vsVietnamese: "Khác hoàn toàn 'r' tiếng Việt — lưỡi cong lên KHÔNG rung",
    examples: ["artery", "red", "brain", "respiratory", "right"],
    speakWord: "artery",
    tip: "Không bao giờ rung lưỡi như 'r' tiếng Việt hay 'rr' tiếng Tây Ban Nha!",
  },
  {
    symbol: "/w/", keyword: "wound", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Môi tròn như /uː/ rồi trượt vào nguyên âm tiếp theo. Bán nguyên âm.",
    vsVietnamese: "'u' trong 'uống', 'uy' — giống nhưng môi tròn hơn",
    examples: ["wound", "wrist", "water", "white", "while"],
    speakWord: "wound",
  },
  {
    symbol: "/j/", keyword: "yellow", difficulty: "Tương đối dễ", difficultyLevel: "easy", voiced: true,
    howTo: "Lưỡi cao trước như /iː/ rồi trượt vào nguyên âm tiếp theo. Bán nguyên âm.",
    vsVietnamese: "'y' trong 'yêu' — giống hệt",
    examples: ["yellow", "year", "yet", "you", "yes"],
    speakWord: "yellow",
  },
];

const DIFF_STYLE: Record<Difficulty, { badge: string; dot: string }> = {
  easy: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  medium: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  hard: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
};

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PhoneticsPage() {
  const [selected, setSelected] = useState<Phoneme>(MONOPHTHONGS[0]);
  const [speaking, setSpeaking] = useState(false);
  const [speakingExample, setSpeakingExample] = useState<string | null>(null);
  const [hasTTS, setHasTTS] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setHasTTS("speechSynthesis" in window);
  }, []);

  // Consonants (8 cols) and monophthongs (4 cols) both need more width than a phone screen
  // has — cap the column count on narrow viewports instead of forcing horizontal scroll.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const speak = useCallback((text: string, isExample = false) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-GB";
    utterance.rate = isExample ? 0.85 : 0.75;
    utterance.pitch = 1;
    if (isExample) setSpeakingExample(text);
    else setSpeaking(true);
    utterance.onend = () => { setSpeaking(false); setSpeakingExample(null); };
    utterance.onerror = () => { setSpeaking(false); setSpeakingExample(null); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const select = (ph: Phoneme) => {
    setSelected(ph);
    speak(ph.speakWord);
  };

  const diffStyle = DIFF_STYLE[selected.difficultyLevel];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">

      {/* ── Page banner (IOT style) ── */}
      <div className="bg-surface border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex items-center gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <Link href="/dashboard" className="font-semibold text-muted hover:text-primary transition-colors py-2">
                ← Dashboard
              </Link>
              <span className="text-line-strong">/</span>
              <span>Bảng Âm IPA</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <h1 className="ui-page-title text-2xl sm:text-3xl">Bảng Âm IPA</h1>
              <span className="ui-badge px-3 py-1">
                44 âm · British English
              </span>
            </div>
            <p className="ui-page-subtitle">Bấm vào từng âm để nghe mẫu và xem cách phát âm, so sánh với tiếng Việt.</p>
          </div>
          <img src="/images/thumbs/phonetics.svg" alt="Minh hoạ bảng âm IPA" width={640} height={360} loading="eager" className="hidden md:block w-60 h-auto rounded-2xl border border-line shadow-card shrink-0" />
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-0 lg:gap-6 w-full max-w-7xl mx-auto lg:px-6 lg:py-6">

        {/* ── Detail Panel (left/top) ── */}
        {/* sticky/max-height only apply on lg+ (side-by-side layout) — on mobile the panel is
            stacked above the phoneme grid in normal flow, so pinning it would trap most of the
            viewport and block scrolling down to the grid. */}
        <div className="lg:w-80 shrink-0 p-5 flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-52px)] lg:overflow-y-auto bg-surface border-b border-line lg:border lg:rounded-2xl lg:shadow-card">

          {/* Symbol */}
          <div className="flex items-center gap-4">
            <div className="text-5xl font-black tracking-tight text-primary" style={{ fontFamily: "serif" }}>
              {selected.symbol}
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">{selected.keyword}</div>
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${diffStyle.badge} mt-1 inline-block`}>
                {selected.difficulty}
              </span>
            </div>
          </div>

          {/* Play button */}
          <button
            onClick={() => speak(selected.speakWord)}
            disabled={!hasTTS}
            className="flex items-center justify-center gap-3 w-full px-4 py-3 font-bold rounded-full transition-all disabled:opacity-50"
            style={{
              background: speaking ? "#172e6e" : "#1e3a8a",
              border: "1px solid #1e3a8a",
              color: "#ffffff",
            }}
          >
            {speaking ? (
              <span className="flex gap-0.5 items-end h-5">
                {[1,2,3,4].map(i => (
                  <span key={i} className="w-1 animate-bounce rounded-full" style={{ height: `${8 + i * 4}px`, background: "#ffffff", animationDelay: `${i * 0.1}s` }} />
                ))}
              </span>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
            {speaking ? "Đang phát..." : `Nghe "${selected.keyword}"`}
          </button>

          {/* Info blocks */}
          <div className="space-y-3">
            <InfoBlock label="CÁCH PHÁT ÂM" value={selected.howTo} color="#1e3a8a" />
            <InfoBlock label="SO VỚI TIẾNG VIỆT" value={selected.vsVietnamese} color="#10b981" />
          </div>

          {/* Tip */}
          {selected.tip && (
            <div className="p-3 text-sm rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
              <span className="font-bold">Mẹo: </span>{selected.tip}
            </div>
          )}

          {/* Example words */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-2 text-muted">Từ ví dụ</div>
            <div className="flex flex-wrap gap-2">
              {selected.examples.map(ex => (
                <button
                  key={ex}
                  onClick={() => speak(ex, true)}
                  className="px-3.5 py-2 text-sm font-bold rounded-full transition-all flex items-center gap-1.5"
                  style={{
                    background: speakingExample === ex ? "#1e3a8a" : "#ffffff",
                    border: `1px solid ${speakingExample === ex ? "#1e3a8a" : "#d4dae0"}`,
                    color: speakingExample === ex ? "#ffffff" : "#1e3a8a",
                  }}
                >
                  {speakingExample === ex && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Phoneme Grid (right/bottom) ── */}
        <div className="flex-1 min-w-0 p-5 lg:p-6 space-y-8 overflow-y-auto bg-surface lg:border lg:border-line lg:rounded-2xl lg:shadow-card">

          <PhonemeGroup
            title="NGUYÊN ÂM ĐƠN"
            subtitle="MONOPHTHONGS"
            count={MONOPHTHONGS.length}
            phonemes={MONOPHTHONGS}
            columns={4}
            isMobile={isMobile}
            selected={selected}
            onSelect={select}
          />

          <PhonemeGroup
            title="NGUYÊN ÂM ĐÔI"
            subtitle="DIPHTHONGS"
            count={DIPHTHONGS.length}
            phonemes={DIPHTHONGS}
            columns={3}
            rowSizes={DIPHTHONG_ROW_SIZES}
            isMobile={isMobile}
            selected={selected}
            onSelect={select}
          />

          <PhonemeGroup
            title="PHỤ ÂM"
            subtitle="CONSONANTS"
            count={CONSONANTS.length}
            phonemes={CONSONANTS}
            columns={8}
            showVoicing
            isMobile={isMobile}
            selected={selected}
            onSelect={select}
          />

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 pb-6">
            <span className="text-xs font-bold uppercase tracking-widest text-muted">Độ khó:</span>
            {[
              { dot: "bg-emerald-500", label: "Tương đối dễ" },
              { dot: "bg-amber-500", label: "Khó hơn" },
              { dot: "bg-red-500", label: "Khó" },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${d.dot}`} />
                <span className="text-xs text-muted">{d.label}</span>
              </div>
            ))}
            <span className="text-xs font-bold uppercase tracking-widest ml-2 text-muted">Phụ âm:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#f0fdfa", border: "1px solid #14b8a6" }} />
              <span className="text-xs text-muted">Hữu thanh (voiced)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm" style={{ background: "#f7f9fc", border: "1px solid #d4dae0" }} />
              <span className="text-xs text-muted">Vô thanh (unvoiced)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function InfoBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color }}>{label}</div>
      <div className="text-sm leading-relaxed text-foreground/85">{value}</div>
    </div>
  );
}

// Pads phonemes into fixed-size rows, inserting `null` placeholders so a row with fewer
// items than the widest row (e.g. diphthongs' first row) still aligns to the same columns —
// matching the reference chart's staggered layout instead of a plain auto-fill wrap.
function padToRows(phonemes: Phoneme[], rowSizes: number[]): (Phoneme | null)[] {
  const maxCols = Math.max(...rowSizes);
  const result: (Phoneme | null)[] = [];
  let idx = 0;
  for (const size of rowSizes) {
    for (let i = 0; i < size; i++) result.push(phonemes[idx++]);
    for (let i = size; i < maxCols; i++) result.push(null);
  }
  return result;
}

function PhonemeGroup({
  title, subtitle, count, phonemes, columns, rowSizes, showVoicing, isMobile, selected, onSelect,
}: {
  title: string; subtitle: string; count: number;
  phonemes: Phoneme[]; columns: number; rowSizes?: number[]; showVoicing?: boolean; isMobile?: boolean;
  selected: Phoneme; onSelect: (p: Phoneme) => void;
}) {
  const baseCols = rowSizes ? Math.max(...rowSizes) : columns;
  // On phones, cap wide grids (e.g. the 8-column consonant chart) down to 4 columns instead of
  // forcing horizontal scroll — rowSizes-based groups (diphthongs) are already ≤4, untouched.
  const cols = isMobile ? Math.min(4, baseCols) : baseCols;
  const cells: (Phoneme | null)[] = rowSizes ? padToRows(phonemes, rowSizes) : phonemes;

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-sm font-black uppercase tracking-widest text-primary">
          {title} — {subtitle}
        </h2>
        <span className="text-xs font-bold text-muted">({count})</span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(70px, 1fr))` }}>
          {cells.map((ph, i) => {
            if (!ph) return <div key={`blank-${i}`} />;
            const isActive = selected.symbol === ph.symbol;
            const dotColor = DIFF_STYLE[ph.difficultyLevel].dot;
            const voicing = showVoicing
              ? ph.voiced
                ? { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e" }
                : { bg: "#f7f9fc", border: "#d4dae0", text: "#475569" }
              : null;
            return (
              <button
                key={ph.symbol}
                onClick={() => onSelect(ph)}
                className="flex flex-col items-center justify-center py-4 px-2 rounded-xl transition-all group relative hover:-translate-y-0.5 hover:shadow-card"
                style={{
                  background: isActive ? "#eef2fb" : voicing ? voicing.bg : "#ffffff",
                  border: `1px solid ${isActive ? "#1e3a8a" : voicing ? voicing.border : "#eaecef"}`,
                  borderLeft: isActive ? "3px solid #1e3a8a" : `1px solid ${voicing ? voicing.border : "#eaecef"}`,
                }}
              >
                <span
                  className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${dotColor}`}
                />
                <span
                  className="text-xl font-black mb-1"
                  style={{
                    color: isActive ? "#1e3a8a" : voicing ? voicing.text : "#1e3a8a",
                    fontFamily: "serif",
                  }}
                >
                  {ph.symbol}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: isActive ? "#1e3a8a" : "#5b6b82" }}
                >
                  {ph.keyword}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
