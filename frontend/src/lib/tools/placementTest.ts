// Bài kiểm tra trình độ CEFR miễn phí (trang /kiem-tra-trinh-do-tieng-anh).
// 30 câu cố định, 6 câu mỗi cấp A1 → C1, độ khó tăng dần. Chấm hoàn toàn phía trình duyệt, không gọi API.
// Kết quả là ƯỚC LƯỢNG để định hướng ôn tập — không thay thế bài thi chuẩn hoá có giám sát.

export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1";
export const LEVEL_ORDER: CefrLevel[] = ["A1", "A2", "B1", "B2", "C1"];

export type PlacementQuestion = {
  level: CefrLevel;
  skill: "Ngữ pháp" | "Từ vựng" | "Đọc hiểu";
  passage?: string;
  question: string;
  options: string[];
  answer: number;
  why: string;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  // ── A1 ──
  { level: "A1", skill: "Ngữ pháp", question: "My sister ___ a teacher.", options: ["are", "is", "am", "be"], answer: 1, why: "Chủ ngữ số ít ngôi thứ ba (my sister) dùng động từ to be \"is\"." },
  { level: "A1", skill: "Ngữ pháp", question: "There ___ two cats in the garden.", options: ["is", "has", "are", "be"], answer: 2, why: "\"There are\" đi với danh từ số nhiều (two cats)." },
  { level: "A1", skill: "Ngữ pháp", question: "I ___ breakfast at 7 o'clock every day.", options: ["have", "has", "having", "am have"], answer: 0, why: "Thói quen hằng ngày dùng hiện tại đơn; chủ ngữ \"I\" đi với \"have\"." },
  { level: "A1", skill: "Ngữ pháp", question: "What's this? – It's ___ umbrella.", options: ["a", "the", "some", "an"], answer: 3, why: "\"umbrella\" bắt đầu bằng nguyên âm /ʌ/ nên dùng mạo từ \"an\"." },
  { level: "A1", skill: "Ngữ pháp", question: "We go to school ___ Monday to Friday.", options: ["in", "from", "at", "on"], answer: 1, why: "Cấu trúc \"from … to …\" diễn tả khoảng thời gian từ … đến …." },
  { level: "A1", skill: "Từ vựng", question: "The opposite of \"hot\" is ___.", options: ["tall", "happy", "cold", "small"], answer: 2, why: "Trái nghĩa của hot (nóng) là cold (lạnh)." },

  // ── A2 ──
  { level: "A2", skill: "Ngữ pháp", question: "Yesterday I ___ to the cinema with my friends.", options: ["go", "went", "have gone", "was go"], answer: 1, why: "\"Yesterday\" là mốc quá khứ đã kết thúc → quá khứ đơn: went." },
  { level: "A2", skill: "Ngữ pháp", question: "She is ___ than her brother.", options: ["taller", "more tall", "the tallest", "tallest"], answer: 0, why: "So sánh hơn của tính từ ngắn: tall → taller (đi với than)." },
  { level: "A2", skill: "Ngữ pháp", question: "___ you ever been to Da Nang?", options: ["Did", "Do", "Are", "Have"], answer: 3, why: "\"ever been\" là thì hiện tại hoàn thành: Have + S + ever + V3." },
  { level: "A2", skill: "Ngữ pháp", question: "I was watching TV when the phone ___.", options: ["was ringing", "rang", "rings", "has rung"], answer: 1, why: "Hành động đang diễn ra (quá khứ tiếp diễn) thì có hành động khác xen vào (quá khứ đơn)." },
  { level: "A2", skill: "Từ vựng", question: "You ___ wear a helmet when you ride a motorbike. It's the law.", options: ["may", "can", "must", "would"], answer: 2, why: "\"It's the law\" → bắt buộc, dùng \"must\"." },
  { level: "A2", skill: "Từ vựng", question: "I'm not very good ___ maths.", options: ["in", "at", "on", "with"], answer: 1, why: "Cụm cố định: be good at something (giỏi về cái gì)." },

  // ── B1 ──
  { level: "B1", skill: "Ngữ pháp", question: "If it rains tomorrow, we ___ the picnic.", options: ["would cancel", "cancelled", "will cancel", "cancel"], answer: 2, why: "Câu điều kiện loại 1 (có thể xảy ra): If + hiện tại đơn, S + will + V." },
  { level: "B1", skill: "Ngữ pháp", question: "This bridge ___ in 2010.", options: ["was built", "built", "has built", "is building"], answer: 0, why: "Cây cầu được xây (bị động) vào năm 2010 (quá khứ) → was built." },
  { level: "B1", skill: "Ngữ pháp", question: "She asked me where I ___.", options: ["do live", "did I live", "live", "lived"], answer: 3, why: "Câu tường thuật: lùi thì (live → lived) và câu hỏi đổi về trật tự câu khẳng định." },
  { level: "B1", skill: "Ngữ pháp", question: "I'm looking forward to ___ you next week.", options: ["see", "seeing", "saw", "be seeing"], answer: 1, why: "\"look forward to\" — \"to\" là giới từ nên theo sau là V-ing." },
  { level: "B1", skill: "Ngữ pháp", question: "The man ___ car was stolen called the police.", options: ["who", "which", "whose", "whom"], answer: 2, why: "Đại từ quan hệ chỉ sở hữu: whose + danh từ (whose car = xe của người đàn ông)." },
  { level: "B1", skill: "Từ vựng", question: "Please ___ the form and send it back to us.", options: ["fill in", "fill up", "take up", "look after"], answer: 0, why: "fill in a form = điền vào mẫu đơn." },

  // ── B2 ──
  { level: "B2", skill: "Ngữ pháp", question: "If I ___ harder at school, I would have got a better job.", options: ["studied", "had studied", "have studied", "would study"], answer: 1, why: "Câu điều kiện loại 3 (trái với quá khứ): If + had V3, S + would have V3." },
  { level: "B2", skill: "Ngữ pháp", question: "By the time we arrived, the film ___.", options: ["already started", "has already started", "had already started", "was already starting"], answer: 2, why: "Hành động xảy ra trước một hành động khác trong quá khứ → quá khứ hoàn thành." },
  { level: "B2", skill: "Ngữ pháp", question: "Not only ___ the exam, but she also got the highest score.", options: ["she passed", "did she pass", "she did pass", "passed she"], answer: 1, why: "\"Not only\" đứng đầu câu → đảo ngữ: Not only + trợ động từ + S + V." },
  { level: "B2", skill: "Từ vựng", question: "The government should ___ measures to reduce air pollution.", options: ["make", "do", "give", "take"], answer: 3, why: "Collocation: take measures = áp dụng biện pháp." },
  { level: "B2", skill: "Ngữ pháp", question: "He denied ___ the money.", options: ["stealing", "to steal", "steal", "to stealing"], answer: 0, why: "deny + V-ing (chối là đã làm gì)." },
  {
    level: "B2", skill: "Đọc hiểu",
    passage: "Remote working has become common since 2020. While employees enjoy saving commuting time, many report feeling isolated and finding it harder to separate work from their personal lives.",
    question: "According to the passage, one disadvantage of remote working is that people ___.",
    options: ["spend more time commuting", "may feel lonely", "earn less money", "work fewer hours"], answer: 1,
    why: "\"feeling isolated\" (cảm thấy bị cô lập) đồng nghĩa với \"feel lonely\". Việc đi lại ít hơn là ưu điểm, không phải nhược điểm.",
  },

  // ── C1 ──
  { level: "C1", skill: "Ngữ pháp", question: "Hardly ___ the station when the train left.", options: ["we had reached", "had we reached", "did we reached", "we reached"], answer: 1, why: "Đảo ngữ với Hardly … when: Hardly + had + S + V3 … when + quá khứ đơn." },
  { level: "C1", skill: "Từ vựng", question: "The new policy has been met with widespread ___ from teachers.", options: ["critic", "critical", "criticism", "criticise"], answer: 2, why: "Sau tính từ \"widespread\" cần danh từ chỉ sự việc: criticism (sự chỉ trích)." },
  { level: "C1", skill: "Ngữ pháp", question: "It is essential that every student ___ the safety rules.", options: ["follows", "follow", "followed", "will follow"], answer: 1, why: "Thể giả định (subjunctive): It is essential that + S + V nguyên mẫu (không chia)." },
  { level: "C1", skill: "Từ vựng", question: "His explanation was so ___ that nobody could understand it.", options: ["concise", "lucid", "straightforward", "convoluted"], answer: 3, why: "convoluted = rối rắm, phức tạp — khớp với \"nobody could understand\". Ba từ còn lại đều mang nghĩa rõ ràng, dễ hiểu." },
  { level: "C1", skill: "Ngữ pháp", question: "She ___ have left already – her coat is still here.", options: ["mustn't", "needn't", "can't", "shouldn't"], answer: 2, why: "Suy luận chắc chắn điều KHÔNG thể xảy ra trong quá khứ: can't have + V3." },
  { level: "C1", skill: "Từ vựng", question: "The findings of the study ___ doubt on the effectiveness of the treatment.", options: ["threw", "cast", "put", "made"], answer: 1, why: "Collocation: cast doubt on something = làm dấy lên nghi ngờ về điều gì." },
];

/** Số câu đúng tối thiểu (trên 6) để được tính là đạt 1 cấp. */
export const PASS_PER_LEVEL = 4;

export type PlacementResult = {
  level: CefrLevel | "PRE_A1";
  total: number;
  perLevel: Record<CefrLevel, { correct: number; total: number }>;
  perSkill: Record<string, { correct: number; total: number }>;
};

/** Cấp đạt được = cấp cao nhất mà mọi cấp từ A1 tới đó đều đúng ≥ 4/6 câu. */
export function gradePlacement(answers: (number | null)[]): PlacementResult {
  const perLevel = Object.fromEntries(LEVEL_ORDER.map((l) => [l, { correct: 0, total: 0 }])) as PlacementResult["perLevel"];
  const perSkill: PlacementResult["perSkill"] = {};
  let total = 0;
  PLACEMENT_QUESTIONS.forEach((q, i) => {
    const ok = answers[i] === q.answer;
    perLevel[q.level].total++;
    perSkill[q.skill] ??= { correct: 0, total: 0 };
    perSkill[q.skill].total++;
    if (ok) { perLevel[q.level].correct++; perSkill[q.skill].correct++; total++; }
  });
  let level: PlacementResult["level"] = "PRE_A1";
  for (const l of LEVEL_ORDER) {
    if (perLevel[l].correct >= PASS_PER_LEVEL) level = l;
    else break;
  }
  return { level, total, perLevel, perSkill };
}

/** Mô tả cấp độ + gợi ý ôn tập. Mốc IELTS là mức tương đương thường được nhắc tới, chỉ để tham khảo. */
export const LEVEL_INFO: Record<PlacementResult["level"], { name: string; desc: string; ielts: string; next: string[] }> = {
  PRE_A1: {
    name: "Mới bắt đầu (dưới A1)",
    desc: "Bạn đang ở giai đoạn làm quen. Hãy bắt đầu từ bảng chữ cái, phát âm và các mẫu câu giới thiệu bản thân.",
    ielts: "Chưa tương đương",
    next: ["Học bảng phiên âm IPA để đọc đúng từ mới", "Ôn động từ to be, thì hiện tại đơn", "Mỗi ngày học 5–10 từ vựng cơ bản theo chủ đề"],
  },
  A1: {
    name: "A1 — Sơ cấp",
    desc: "Bạn hiểu và dùng được câu đơn giản về bản thân, gia đình, sinh hoạt hằng ngày.",
    ielts: "chưa có mức tương đương chính thức",
    next: ["Ôn thì quá khứ đơn và hiện tại hoàn thành", "So sánh hơn, so sánh nhất của tính từ", "Mở rộng từ vựng chủ đề trường học, du lịch, mua sắm"],
  },
  A2: {
    name: "A2 — Sơ trung cấp",
    desc: "Bạn giao tiếp được trong tình huống quen thuộc và mô tả trải nghiệm ngắn.",
    ielts: "khoảng 3.0–3.5",
    next: ["Câu điều kiện loại 1, 2 và câu bị động", "Câu tường thuật, mệnh đề quan hệ", "Luyện đọc đoạn văn 150–250 từ"],
  },
  B1: {
    name: "B1 — Trung cấp",
    desc: "Bạn xử lý được phần lớn tình huống thường gặp và viết được đoạn văn liền mạch.",
    ielts: "khoảng 4.0–5.0",
    next: ["Câu điều kiện loại 3, đảo ngữ, các thì hoàn thành", "Collocation và cụm động từ thông dụng", "Luyện viết đoạn nghị luận ngắn, có ví dụ minh hoạ"],
  },
  B2: {
    name: "B2 — Trung cao cấp",
    desc: "Bạn đọc hiểu văn bản phức tạp và trình bày quan điểm rõ ràng, chi tiết.",
    ielts: "khoảng 5.5–6.5",
    next: ["Đảo ngữ nâng cao, thể giả định, động từ khuyết thiếu ở quá khứ", "Từ vựng học thuật và collocation nâng cao", "Luyện IELTS Writing Task 2 và Reading học thuật"],
  },
  C1: {
    name: "C1 — Cao cấp",
    desc: "Bạn dùng tiếng Anh linh hoạt, hiệu quả cho học tập và công việc.",
    ielts: "khoảng 7.0–8.0",
    next: ["Luyện đề IELTS đầy đủ 4 kỹ năng có tính giờ", "Đa dạng hoá cấu trúc câu và từ vựng ít phổ biến", "Đọc báo, nghe podcast học thuật mỗi ngày"],
  },
};
