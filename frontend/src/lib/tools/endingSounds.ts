// Đoán cách phát âm đuôi -ed (/t/, /d/, /ɪd/) và -s/-es (/s/, /z/, /ɪz/) theo âm cuối của từ gốc.
// Dùng quy tắc chính tả + danh sách ngoại lệ thường gặp trong đề thi (trang /cach-phat-am-ed-s-es).
// Chính tả tiếng Anh không phản ánh 100% âm thật, nên kết quả "theo quy tắc" luôn kèm lưu ý tra từ điển.

export type EdSound = "/t/" | "/d/" | "/ɪd/";
export type SSound = "/s/" | "/z/" | "/ɪz/";
export type Verdict<T> = { sound: T; reason: string; exception: boolean };

/** Tính từ tận cùng -ed đọc /ɪd/ dù âm cuối không phải t/d. */
const ED_ADJ_ID: Record<string, string> = {
  naked: "trần truồng", wicked: "độc ác", beloved: "yêu dấu", crooked: "cong, quanh co", ragged: "rách rưới",
  rugged: "gồ ghề", sacred: "thiêng liêng", wretched: "khốn khổ", dogged: "kiên trì", learned: "uyên bác",
  aged: "già, cao tuổi", blessed: "may mắn, thiêng liêng", cursed: "đáng nguyền rủa", hatred: "lòng căm thù",
  "one-legged": "một chân", "three-legged": "ba chân", "four-legged": "bốn chân",
};

/** Gốc tận cùng -se đọc /s/ (vô thanh) → -ed đọc /t/. Mặc định gốc nguyên âm + se đọc /z/. */
const ED_S_VOICELESS = new Set([
  "promis", "increas", "decreas", "releas", "purchas", "chas", "ceas", "bas", "practis", "focus", "leas", "greas",
  "eras", "embarras", "harass", "dos",
]);
/** Gốc tận cùng -th trong từ -ed hầu hết đến từ động từ -the (breathe, bathe) → /ð/ hữu thanh; ngoại lệ /θ/. */
const ED_TH_VOICELESS = new Set(["earth", "froth", "berth"]);
/** -s/-es: từ có "ch" đọc /k/ hoặc ngoại lệ khác. */
const S_EXCEPTIONS: Record<string, Verdict<SSound>> = {
  stomachs: { sound: "/s/", reason: "\"ch\" trong stomach đọc là /k/ (vô thanh)", exception: true },
  monarchs: { sound: "/s/", reason: "\"ch\" trong monarch đọc là /k/ (vô thanh)", exception: true },
  epochs: { sound: "/s/", reason: "\"ch\" trong epoch đọc là /k/ (vô thanh)", exception: true },
  aches: { sound: "/s/", reason: "ache đọc /eɪk/, âm cuối /k/ vô thanh", exception: true },
  headaches: { sound: "/s/", reason: "ache đọc /eɪk/, âm cuối /k/ vô thanh", exception: true },
  toothaches: { sound: "/s/", reason: "ache đọc /eɪk/, âm cuối /k/ vô thanh", exception: true },
  stomachaches: { sound: "/s/", reason: "ache đọc /eɪk/, âm cuối /k/ vô thanh", exception: true },
  ploughs: { sound: "/z/", reason: "plough đọc /plaʊ/, tận cùng nguyên âm", exception: true },
  says: { sound: "/z/", reason: "says đọc /sez/", exception: true },
  does: { sound: "/z/", reason: "does đọc /dʌz/", exception: true },
  houses: { sound: "/ɪz/", reason: "houses đọc /ˈhaʊzɪz/ (âm /s/ của house biến thành /z/)", exception: true },
  months: { sound: "/s/", reason: "month tận cùng âm /θ/ vô thanh", exception: true },
  clothes: { sound: "/z/", reason: "clothes đọc /kləʊðz/ — âm /ð/ hữu thanh", exception: true },
};

const VOICELESS_HINT = "âm vô thanh /p/, /k/, /f/, /s/, /ʃ/, /tʃ/, /θ/";

function edByStem(stem: string): Verdict<EdSound> {
  const ends = (...xs: string[]) => xs.some((x) => stem.endsWith(x));
  if (ends("t", "d")) return { sound: "/ɪd/", reason: `Từ gốc tận cùng bằng âm /t/ hoặc /d/ → thêm âm /ɪd/`, exception: false };
  if (ends("y") || /[aeiouw]$/.test(stem)) return { sound: "/d/", reason: "Từ gốc tận cùng bằng nguyên âm → âm hữu thanh → /d/", exception: false };
  if (ends("ough", "augh")) return { sound: "/t/", reason: "\"gh\" ở đây đọc là /f/ (laugh, cough) — âm vô thanh → /t/", exception: false };
  if (ends("gh")) return { sound: "/d/", reason: "\"gh\" câm, từ gốc tận cùng nguyên âm → /d/", exception: false };
  if (ends("th")) {
    if (ED_TH_VOICELESS.has(stem)) return { sound: "/t/", reason: "Âm cuối /θ/ vô thanh → /t/", exception: true };
    return { sound: "/d/", reason: "Động từ tận cùng -the (breathe, bathe) có âm /ð/ hữu thanh → /d/", exception: false };
  }
  if (ends("ss", "x", "sh", "ch", "c", "k", "p", "f", "ph")) {
    return { sound: "/t/", reason: `Từ gốc tận cùng bằng ${VOICELESS_HINT} → /t/`, exception: false };
  }
  if (ends("s")) {
    if (ED_S_VOICELESS.has(stem)) return { sound: "/t/", reason: "Chữ \"s\" ở đây đọc là /s/ (vô thanh) → /t/", exception: true };
    if (/[^aeiou]s$/.test(stem)) return { sound: "/t/", reason: "Phụ âm + \"se\" (sense, collapse, nurse) đọc /s/ vô thanh → /t/", exception: false };
    return { sound: "/d/", reason: "Nguyên âm + \"se\" (raise, close, use) thường đọc /z/ hữu thanh → /d/", exception: false };
  }
  return { sound: "/d/", reason: "Từ gốc tận cùng bằng âm hữu thanh (/b/, /g/, /v/, /z/, /m/, /n/, /ŋ/, /l/, /r/, /dʒ/…) → /d/", exception: false };
}

export function classifyEd(input: string): Verdict<EdSound> | null {
  const w = input.trim().toLowerCase();
  if (!/^[a-z][a-z'-]*$/.test(w)) return null;
  if (ED_ADJ_ID[w]) return { sound: "/ɪd/", reason: `Ngoại lệ: \"${w}\" là tính từ (${ED_ADJ_ID[w]}) nên đuôi -ed đọc /ɪd/`, exception: true };
  if (w.endsWith("ied")) return { sound: "/d/", reason: "Gốc tận cùng -y (study → studied) là nguyên âm → /d/", exception: false };
  // -eed: need/succeed là động từ gốc; agreed/freed là gốc -ee + d
  if (w.endsWith("eed") && !["agreed", "freed", "guaranteed", "refereed", "decreed"].includes(w)) return edByStem(w);
  if (w.endsWith("ed") && w.length >= 4) return edByStem(w.slice(0, -2));
  // Người dùng gõ động từ nguyên mẫu: bỏ "e" câm cuối (like → lik) rồi áp quy tắc
  const stem = w.endsWith("e") && !w.endsWith("ee") ? w.slice(0, -1) : w;
  return edByStem(stem);
}

/** Gốc dạng "từ bỏ -s" (book, like, house, clothe) → âm cuối. */
function sByBase(base: string): Verdict<SSound> {
  const ends = (...xs: string[]) => xs.some((x) => base.endsWith(x));
  if (ends("s", "ss", "x", "z", "sh", "ch", "ce", "se", "ze", "ge", "dge")) {
    return { sound: "/ɪz/", reason: "Từ gốc tận cùng bằng âm gió /s/, /z/, /ʃ/, /ʒ/, /tʃ/, /dʒ/ (s, ss, x, z, sh, ch, ce, se, ge…) → /ɪz/", exception: false };
  }
  if (ends("the")) return { sound: "/z/", reason: "\"the\" cuối từ đọc /ð/ hữu thanh → /z/", exception: false };
  if (ends("th")) return { sound: "/s/", reason: "\"th\" cuối từ đọc /θ/ vô thanh → /s/", exception: false };
  if (ends("ough", "augh")) return { sound: "/s/", reason: "\"gh\" ở đây đọc /f/ (laugh, cough) — vô thanh → /s/", exception: false };
  if (ends("gh")) return { sound: "/z/", reason: "\"gh\" câm, tận cùng nguyên âm → /z/", exception: false };
  if (ends("p", "pe", "t", "te", "k", "ke", "ck", "que", "f", "fe", "ph", "ff")) {
    return { sound: "/s/", reason: "Từ gốc tận cùng bằng âm vô thanh /p/, /t/, /k/, /f/, /θ/ → /s/", exception: false };
  }
  return { sound: "/z/", reason: "Từ gốc tận cùng bằng nguyên âm hoặc phụ âm hữu thanh (/b/, /d/, /g/, /v/, /m/, /n/, /l/…) → /z/", exception: false };
}

export function classifyS(input: string): Verdict<SSound> | null {
  const w = input.trim().toLowerCase();
  if (!/^[a-z][a-z'-]*$/.test(w)) return null;
  if (S_EXCEPTIONS[w]) return S_EXCEPTIONS[w];
  if (!w.endsWith("s") || w.endsWith("ss")) return sByBase(w); // người dùng gõ từ gốc (book, watch, kiss)
  if (w.endsWith("ies")) return { sound: "/z/", reason: "Gốc tận cùng -y (study → studies) là nguyên âm → /z/", exception: false };
  if (w.endsWith("es")) {
    const beforeEs = w.slice(0, -2);
    if (/(s|x|z|sh|ch)$/.test(beforeEs)) return sByBase(beforeEs);
  }
  return sByBase(w.slice(0, -1));
}

/** Ngân hàng từ để sinh câu hỏi luyện tập kiểu đề THPT ("chọn từ có phần gạch chân phát âm khác"). */
export const ED_BANK: Record<EdSound, string[]> = {
  "/t/": ["watched", "stopped", "laughed", "washed", "looked", "missed", "helped", "worked", "finished", "cooked", "danced", "fixed", "hoped", "liked", "talked", "walked", "jumped", "produced", "mixed", "kissed"],
  "/d/": ["played", "cleaned", "opened", "lived", "called", "loved", "stayed", "enjoyed", "changed", "cried", "studied", "listened", "arrived", "closed", "used", "raised", "answered", "explained", "travelled", "phoned"],
  "/ɪd/": ["wanted", "needed", "decided", "visited", "started", "waited", "ended", "invited", "collected", "added", "painted", "created", "repeated", "hated", "protected", "attended"],
};
export const S_BANK: Record<SSound, string[]> = {
  "/s/": ["books", "cups", "cats", "laughs", "maps", "students", "parents", "stops", "likes", "works", "takes", "hopes", "walks", "coughs", "graphs", "months"],
  "/z/": ["dogs", "pens", "plays", "bags", "friends", "trees", "songs", "rooms", "tables", "goes", "cries", "studies", "cars", "apples", "lives", "clothes"],
  "/ɪz/": ["watches", "boxes", "buses", "houses", "changes", "washes", "dances", "classes", "oranges", "pages", "villages", "kisses", "fixes", "judges", "places", "roses"],
};

export type PracticeQuestion = { kind: "ed" | "s"; words: string[]; answer: number; sounds: string[] };

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** 1 câu: 3 từ cùng cách đọc + 1 từ khác, xáo trộn vị trí. */
export function makePracticeQuestion(kind: "ed" | "s"): PracticeQuestion {
  const bank: Record<string, string[]> = kind === "ed" ? ED_BANK : S_BANK;
  const keys = Object.keys(bank);
  const same = pick(keys);
  const odd = pick(keys.filter((k) => k !== same));
  const trio = shuffle(bank[same]).slice(0, 3);
  const oddWord = pick(bank[odd]);
  const items = shuffle([...trio.map((w) => ({ w, s: same })), { w: oddWord, s: odd }]);
  return { kind, words: items.map((x) => x.w), sounds: items.map((x) => x.s), answer: items.findIndex((x) => x.w === oddWord) };
}

/** Tách phần đuôi để gạch chân giống đề thi: -ed, -es (nếu đọc /ɪz/ và viết -es) hoặc -s. */
export function splitEnding(word: string, kind: "ed" | "s"): [string, string] {
  if (kind === "ed") return word.endsWith("ed") ? [word.slice(0, -2), "ed"] : [word.slice(0, -1), "d"];
  if (word.endsWith("es") && /(s|x|z|sh|ch)es$/.test(word)) return [word.slice(0, -2), "es"];
  return [word.slice(0, -1), "s"];
}
