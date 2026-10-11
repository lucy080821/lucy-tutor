// Dữ liệu trò chơi Tiếng Anh Lớp 3 (Global Success, học kỳ 1: Starter → Unit 9 Colours).
// Từ vựng, mẫu câu và dạng câu hỏi lấy theo sách bài tập bổ trợ "Global Success 3 - First Term".
// Thuần client-side, không gọi API — thêm/sửa nội dung chỉ cần sửa file này.

export type UnitId = "STARTER" | "U1" | "U2" | "U3" | "U4" | "U5" | "U6" | "U7" | "U8" | "U9";

export const GRADE3_UNITS: { id: UnitId; label: string; title: string }[] = [
  { id: "STARTER", label: "Starter", title: "Numbers and Alphabet" },
  { id: "U1", label: "Unit 1", title: "Hello" },
  { id: "U2", label: "Unit 2", title: "Our names" },
  { id: "U3", label: "Unit 3", title: "Our friends" },
  { id: "U4", label: "Unit 4", title: "Our bodies" },
  { id: "U5", label: "Unit 5", title: "My hobbies" },
  { id: "U6", label: "Unit 6", title: "Our school" },
  { id: "U7", label: "Unit 7", title: "Classroom instructions" },
  { id: "U8", label: "Unit 8", title: "My school things" },
  { id: "U9", label: "Unit 9", title: "Colours" },
];

export type VocabItem = {
  en: string;
  vi: string;
  unit: UnitId;
  /** Hình minh hoạ cho trò "Nghe và Chọn" / thẻ nghĩa — chỉ từ vẽ được bằng hình mới có */
  pic?: string;
  /** Mã màu cho từ chỉ màu sắc (Unit 9) */
  color?: string;
};

export const GRADE3_VOCAB: VocabItem[] = [
  // Starter
  { en: "one", vi: "số một", unit: "STARTER", pic: "1" },
  { en: "two", vi: "số hai", unit: "STARTER", pic: "2" },
  { en: "three", vi: "số ba", unit: "STARTER", pic: "3" },
  { en: "four", vi: "số bốn", unit: "STARTER", pic: "4" },
  { en: "five", vi: "số năm", unit: "STARTER", pic: "5" },
  { en: "six", vi: "số sáu", unit: "STARTER", pic: "6" },
  { en: "seven", vi: "số bảy", unit: "STARTER", pic: "7" },
  { en: "eight", vi: "số tám", unit: "STARTER", pic: "8" },
  { en: "nine", vi: "số chín", unit: "STARTER", pic: "9" },
  { en: "ten", vi: "số mười", unit: "STARTER", pic: "10" },
  // Unit 1
  { en: "hello", vi: "xin chào", unit: "U1", pic: "👋" },
  { en: "hi", vi: "chào (thân mật)", unit: "U1" },
  { en: "goodbye", vi: "tạm biệt", unit: "U1" },
  { en: "bye", vi: "tạm biệt (thân mật)", unit: "U1" },
  { en: "fine", vi: "khoẻ", unit: "U1", pic: "👍" },
  { en: "thank you", vi: "cảm ơn", unit: "U1", pic: "🙏" },
  // Unit 2
  { en: "my", vi: "của tôi", unit: "U2" },
  { en: "name", vi: "tên", unit: "U2", pic: "📛" },
  { en: "what", vi: "cái gì", unit: "U2" },
  { en: "your", vi: "của bạn", unit: "U2" },
  { en: "our", vi: "của chúng ta", unit: "U2" },
  { en: "how", vi: "thế nào", unit: "U2" },
  // Unit 3
  { en: "friend", vi: "bạn bè", unit: "U3", pic: "🧑‍🤝‍🧑" },
  { en: "teacher", vi: "giáo viên", unit: "U3", pic: "🧑‍🏫" },
  { en: "yes", vi: "có, vâng", unit: "U3", pic: "✅" },
  { en: "no", vi: "không", unit: "U3", pic: "❌" },
  { en: "this", vi: "đây, cái này", unit: "U3" },
  { en: "that", vi: "kia, cái kia", unit: "U3" },
  // Unit 4
  { en: "ear", vi: "cái tai", unit: "U4", pic: "👂" },
  { en: "eye", vi: "con mắt", unit: "U4", pic: "👁️" },
  { en: "face", vi: "khuôn mặt", unit: "U4", pic: "🙂" },
  { en: "hair", vi: "tóc", unit: "U4", pic: "💇" },
  { en: "hand", vi: "bàn tay", unit: "U4", pic: "✋" },
  { en: "mouth", vi: "cái miệng", unit: "U4", pic: "👄" },
  { en: "nose", vi: "cái mũi", unit: "U4", pic: "👃" },
  { en: "open", vi: "mở", unit: "U4" },
  { en: "touch", vi: "chạm", unit: "U4", pic: "👆" },
  // Unit 5
  { en: "hobby", vi: "sở thích", unit: "U5" },
  { en: "like", vi: "thích", unit: "U5", pic: "❤️" },
  { en: "cook", vi: "nấu ăn", unit: "U5", pic: "🍳" },
  { en: "dance", vi: "nhảy múa", unit: "U5", pic: "💃" },
  { en: "paint", vi: "tô màu, vẽ tranh màu", unit: "U5", pic: "🎨" },
  { en: "run", vi: "chạy", unit: "U5", pic: "🏃" },
  { en: "sing", vi: "hát", unit: "U5", pic: "🎤" },
  { en: "swim", vi: "bơi", unit: "U5", pic: "🏊" },
  { en: "walk", vi: "đi bộ", unit: "U5", pic: "🚶" },
  { en: "draw", vi: "vẽ", unit: "U5", pic: "✍️" },
  // Unit 6
  { en: "school", vi: "trường học", unit: "U6", pic: "🏫" },
  { en: "classroom", vi: "lớp học", unit: "U6", pic: "🪑" },
  { en: "library", vi: "thư viện", unit: "U6", pic: "📚" },
  { en: "playground", vi: "sân chơi", unit: "U6", pic: "🛝" },
  { en: "computer room", vi: "phòng máy tính", unit: "U6", pic: "💻" },
  { en: "art room", vi: "phòng mỹ thuật", unit: "U6", pic: "🖼️" },
  { en: "music room", vi: "phòng âm nhạc", unit: "U6", pic: "🎹" },
  { en: "gym", vi: "phòng thể chất", unit: "U6", pic: "🏋️" },
  // Unit 7
  { en: "close", vi: "đóng, gấp lại", unit: "U7" },
  { en: "come in", vi: "đi vào", unit: "U7", pic: "🚪" },
  { en: "go out", vi: "đi ra ngoài", unit: "U7" },
  { en: "sit down", vi: "ngồi xuống", unit: "U7" },
  { en: "stand up", vi: "đứng lên", unit: "U7", pic: "🧍" },
  { en: "speak", vi: "nói", unit: "U7", pic: "🗣️" },
  { en: "read", vi: "đọc", unit: "U7" },
  // Unit 8
  { en: "pen", vi: "bút mực", unit: "U8", pic: "🖊️" },
  { en: "ruler", vi: "thước kẻ", unit: "U8", pic: "📏" },
  { en: "book", vi: "quyển sách", unit: "U8", pic: "📕" },
  { en: "school bag", vi: "cặp sách", unit: "U8", pic: "🎒" },
  { en: "pencil", vi: "bút chì", unit: "U8", pic: "✏️" },
  { en: "pencil case", vi: "hộp bút", unit: "U8" },
  { en: "notebook", vi: "quyển vở", unit: "U8", pic: "📓" },
  { en: "eraser", vi: "cục tẩy", unit: "U8" },
  // Unit 9
  { en: "colour", vi: "màu sắc", unit: "U9", pic: "🌈" },
  { en: "blue", vi: "màu xanh dương", unit: "U9", color: "#2563eb" },
  { en: "brown", vi: "màu nâu", unit: "U9", color: "#8b4513" },
  { en: "red", vi: "màu đỏ", unit: "U9", color: "#dc2626" },
  { en: "yellow", vi: "màu vàng", unit: "U9", color: "#facc15" },
  { en: "orange", vi: "màu cam", unit: "U9", color: "#f97316" },
  { en: "green", vi: "màu xanh lá", unit: "U9", color: "#16a34a" },
  { en: "white", vi: "màu trắng", unit: "U9", color: "#ffffff" },
  { en: "black", vi: "màu đen", unit: "U9", color: "#111827" },
];

export type SentenceItem = { text: string; vi: string; unit: UnitId };

// Mẫu câu theo mục "B. STRUCTURE" và bài "Reorder the words" của từng unit
export const GRADE3_SENTENCES: SentenceItem[] = [
  { text: "It's number five.", vi: "Đó là số năm.", unit: "STARTER" },
  { text: "It's number ten.", vi: "Đó là số mười.", unit: "STARTER" },
  { text: "Hello. I am Ben.", vi: "Xin chào. Mình là Ben.", unit: "U1" },
  { text: "How are you?", vi: "Bạn có khoẻ không?", unit: "U1" },
  { text: "I am fine, thank you.", vi: "Mình khoẻ, cảm ơn bạn.", unit: "U1" },
  { text: "What is your name?", vi: "Bạn tên là gì?", unit: "U2" },
  { text: "My name is Bill.", vi: "Tên mình là Bill.", unit: "U2" },
  { text: "How old are you?", vi: "Bạn bao nhiêu tuổi?", unit: "U2" },
  { text: "I am eight years old.", vi: "Mình 8 tuổi.", unit: "U2" },
  { text: "Is that Mary?", vi: "Kia có phải là Mary không?", unit: "U3" },
  { text: "No, it isn't. It's Lucy.", vi: "Không phải. Đó là Lucy.", unit: "U3" },
  { text: "This is my friend.", vi: "Đây là bạn của mình.", unit: "U3" },
  { text: "It is a mouth.", vi: "Đó là cái miệng.", unit: "U4" },
  { text: "Touch your nose.", vi: "Hãy chạm vào mũi của bạn.", unit: "U4" },
  { text: "Open your mouth.", vi: "Hãy mở miệng ra.", unit: "U4" },
  { text: "What is your hobby?", vi: "Sở thích của bạn là gì?", unit: "U5" },
  { text: "I like dancing and singing.", vi: "Mình thích nhảy và hát.", unit: "U5" },
  { text: "She likes running.", vi: "Cô ấy thích chạy.", unit: "U5" },
  { text: "Is this our library?", vi: "Đây có phải thư viện của chúng ta không?", unit: "U6" },
  { text: "Let's go to the art room.", vi: "Cùng đến phòng mỹ thuật nào.", unit: "U6" },
  { text: "That is our playground.", vi: "Kia là sân chơi của chúng ta.", unit: "U6" },
  { text: "Sit down, please.", vi: "Mời ngồi xuống.", unit: "U7" },
  { text: "May I come in?", vi: "Em vào lớp được không ạ?", unit: "U7" },
  { text: "Open your book, please.", vi: "Hãy mở sách ra.", unit: "U7" },
  { text: "I have a pencil case.", vi: "Mình có một cái hộp bút.", unit: "U8" },
  { text: "Do you have a ruler?", vi: "Bạn có thước kẻ không?", unit: "U8" },
  { text: "She has an eraser.", vi: "Cô ấy có một cục tẩy.", unit: "U8" },
  { text: "What colour is it?", vi: "Nó màu gì?", unit: "U9" },
  { text: "It is green.", vi: "Nó màu xanh lá.", unit: "U9" },
  { text: "My books are blue.", vi: "Những quyển sách của mình màu xanh dương.", unit: "U9" },
];

// options[0] luôn là đáp án đúng — trò chơi tự xáo thứ tự khi hiển thị
export type QuizItem = { q: string; options: string[]; explain: string; unit: UnitId };

export const GRADE3_QUIZ: QuizItem[] = [
  { q: "How many? ⭐⭐⭐⭐⭐", options: ["five", "four", "six"], explain: "Có 5 ngôi sao → five.", unit: "STARTER" },
  { q: "3 + 4 = ?", options: ["seven", "six", "eight"], explain: "3 + 4 = 7 → seven.", unit: "STARTER" },
  { q: "A, B, C, ___", options: ["D", "E", "F"], explain: "Sau C là D.", unit: "STARTER" },
  { q: "Odd one out:", options: ["Mai", "nine", "two"], explain: "Mai là tên người, còn lại là số.", unit: "STARTER" },
  { q: "___. I am Lucy.", options: ["Hello", "Bye", "Fine"], explain: "Chào khi gặp mặt: Hello.", unit: "U1" },
  { q: "How are you? – ___, thank you.", options: ["Fine", "Hi", "Goodbye"], explain: "Trả lời: Fine, thank you.", unit: "U1" },
  { q: "Bye, Ben. – ___", options: ["Goodbye, Bill.", "I'm Bill.", "Fine, thanks."], explain: "Đáp lại lời tạm biệt bằng lời tạm biệt.", unit: "U1" },
  { q: "Which word is correct?", options: ["hello", "holle", "hoell"], explain: "Viết đúng là hello.", unit: "U1" },
  { q: "What's ___ name?", options: ["your", "you", "is"], explain: "What's your name? – dùng your trước name.", unit: "U2" },
  { q: "My name ___ Linh.", options: ["is", "am", "are"], explain: "My name là số ít → is.", unit: "U2" },
  { q: "How ___ are you? – I'm eight years old.", options: ["old", "are", "and"], explain: "Hỏi tuổi: How old are you?", unit: "U2" },
  { q: "What is ___ name? – Her name is Lucy.", options: ["her", "his", "my"], explain: "Trả lời Her name → hỏi her name.", unit: "U2" },
  { q: "Is that Lucy? – No, it ___.", options: ["isn't", "aren't", "am not"], explain: "No, it isn't. (isn't = is not)", unit: "U3" },
  { q: "This is Nam and that ___ Ben.", options: ["is", "am", "are"], explain: "That is + tên người.", unit: "U3" },
  { q: "Is this Ben? – ___", options: ["Yes, it is.", "Yes, it isn't.", "No, it is."], explain: "Yes, it is. / No, it isn't.", unit: "U3" },
  { q: "Odd one out:", options: ["Lucy", "this", "that"], explain: "Lucy là tên người, this/that là đại từ chỉ định.", unit: "U3" },
  { q: "It's ___ ear.", options: ["an", "a", "two"], explain: "ear bắt đầu bằng nguyên âm → an.", unit: "U4" },
  { q: "It's ___ nose.", options: ["a", "an", "I"], explain: "nose bắt đầu bằng phụ âm → a.", unit: "U4" },
  { q: "I can see with my ___.", options: ["eyes", "ears", "nose"], explain: "Nhìn bằng mắt → eyes.", unit: "U4" },
  { q: "___ your mouth!", options: ["Open", "Sit", "Come"], explain: "Open your mouth! – Hãy mở miệng ra.", unit: "U4" },
  { q: "I like ___.", options: ["singing", "sing", "sings"], explain: "I like + V-ing.", unit: "U5" },
  { q: "She ___ swimming.", options: ["likes", "like", "liking"], explain: "She → likes (thêm s).", unit: "U5" },
  { q: "What's ___ hobby? – He likes cooking.", options: ["his", "her", "your"], explain: "He → his.", unit: "U5" },
  { q: "Odd one out:", options: ["running", "draw", "cook"], explain: "running là V-ing, còn lại là động từ nguyên thể.", unit: "U5" },
  { q: "I like reading. Let's go to the ___.", options: ["library", "gym", "music room"], explain: "Đọc sách → thư viện (library).", unit: "U6" },
  { q: "We like drawing. Let's go to the ___.", options: ["art room", "gym", "library"], explain: "Vẽ tranh → phòng mỹ thuật (art room).", unit: "U6" },
  { q: "Is this our gym? – No, it ___.", options: ["isn't", "is", "am"], explain: "No, it isn't.", unit: "U6" },
  { q: "___ go to the music room.", options: ["Let's", "Let", "That"], explain: "Rủ rê: Let's go to the …", unit: "U6" },
  { q: "___ down, please!", options: ["Sit", "Stand", "Open"], explain: "Sit down – ngồi xuống.", unit: "U7" },
  { q: "Stand ___, please!", options: ["up", "down", "in"], explain: "Stand up – đứng lên.", unit: "U7" },
  { q: "May I ___ out? – No, you can't.", options: ["go", "come", "sit"], explain: "Xin ra ngoài: May I go out?", unit: "U7" },
  { q: "May I come in? – Yes, you ___.", options: ["can", "can't", "do"], explain: "Đồng ý: Yes, you can.", unit: "U7" },
  { q: "I have ___ eraser.", options: ["an", "a", "two"], explain: "eraser bắt đầu bằng nguyên âm → an.", unit: "U8" },
  { q: "Do you have a pen? – Yes, I ___.", options: ["do", "am", "does"], explain: "Do you …? → Yes, I do.", unit: "U8" },
  { q: "He ___ a ruler.", options: ["has", "have", "is"], explain: "He/She → has.", unit: "U8" },
  { q: "Odd one out:", options: ["gym", "ruler", "pencil"], explain: "gym là phòng trong trường, còn lại là đồ dùng học tập.", unit: "U8" },
  { q: "What colour ___ the ruler? – It's green.", options: ["is", "are", "am"], explain: "the ruler số ít → is.", unit: "U9" },
  { q: "What colour are the pens? – ___ black.", options: ["They're", "It's", "Its"], explain: "the pens số nhiều → They're.", unit: "U9" },
  { q: "A banana is ___.", options: ["yellow", "blue", "black"], explain: "Quả chuối màu vàng → yellow.", unit: "U9" },
  { q: "My books ___ green.", options: ["are", "is", "am"], explain: "My books số nhiều → are.", unit: "U9" },
];

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Lọc theo unit; nếu unit đó không đủ `min` mục thì dùng toàn bộ kho (fellBack = true để báo cho học viên) */
export function poolFor<T extends { unit: UnitId }>(items: T[], unit: UnitId | "ALL", min: number) {
  if (unit === "ALL") return { items, fellBack: false };
  const filtered = items.filter((i) => i.unit === unit);
  return filtered.length >= min ? { items: filtered, fellBack: false } : { items, fellBack: true };
}

/** Đọc từ/câu tiếng Anh bằng giọng của trình duyệt (không gọi API) */
export function speakEnglish(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.85;
  const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("en"));
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}

const BEST_KEY = (game: string, unit: string) => `lucy_game_best_${game}_${unit}`;

export function getBestScore(game: string, unit: string): number {
  try { return Number(localStorage.getItem(BEST_KEY(game, unit))) || 0; } catch { return 0; }
}

/** Lưu điểm cao nhất (chỉ trên trình duyệt này); trả về true nếu là kỷ lục mới */
export function saveBestScore(game: string, unit: string, score: number): boolean {
  const prev = getBestScore(game, unit);
  if (score <= prev) return false;
  try { localStorage.setItem(BEST_KEY(game, unit), String(score)); } catch { /* storage bị chặn */ }
  return true;
}
