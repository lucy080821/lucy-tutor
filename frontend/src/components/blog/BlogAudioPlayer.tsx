"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_URL } from "@/lib/blog";

// "Nghe bài viết" — 2 bộ máy đọc:
// 1. "cloud" (mặc định): giọng ElevenLabs "Trung" (nam, miền Nam). Mỗi khối (tiêu đề / tóm tắt / đoạn văn / ý trong
//    danh sách) là 1 file mp3 do backend tạo 1 lần rồi cache (POST /api/blog/posts/:slug/tts). Phát bằng
//    1 thẻ <audio> dùng chung, tải trước khối kế tiếp khi đang phát khối hiện tại để không bị khựng.
// 2. "browser" (dự phòng khi backend chưa cấu hình / hết lượt ký tự ElevenLabs / lỗi mạng): giọng có sẵn
//    của trình duyệt (Web Speech API). Đọc theo từng câu ngắn chứ không đưa cả bài vào 1 lần: Chrome tự
//    dừng các câu đọc dài quá ~15 giây, và pause()/resume() của nhiều giọng Google không hoạt động — nên
//    "Tạm dừng" thực chất là huỷ rồi đọc lại từ câu hiện tại.
// Khối/câu đang đọc được tô sáng ngay trong bài.

type Chunk = { text: string; el: HTMLElement | null; english: boolean };
type Engine = "cloud" | "browser";
const CLOUD_MAX_CHARS = 2500; // backend nhận tối đa 3000 ký tự/đoạn

const STORAGE_KEY = "blog_tts_prefs";
const RATES = [0.75, 1, 1.25, 1.5];
// Khuếch đại giọng ElevenLabs (file gốc khá nhỏ; volume của <audio> tối đa chỉ 100%) qua Web Audio:
// gain -> limiter để to hơn mà không bị rè/vỡ tiếng. Giọng trình duyệt không khuếch đại được.
const BOOSTS = [{ value: 1, label: "Bình thường" }, { value: 2, label: "Lớn" }, { value: 3, label: "Rất lớn" }];
const DEFAULT_BOOST = 2;
// Chữ có dấu tiếng Việt -> câu tiếng Việt
const VI_CHARS = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
// Viết tắt máy hay đọc sai -> đọc đầy đủ
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bTHPT\b/g, "trung học phổ thông"],
  [/\bTHCS\b/g, "trung học cơ sở"],
  [/\bGV\b/g, "giáo viên"],
  [/\bHS\b/g, "học sinh"],
  [/\bTP\.\s?/g, "thành phố "],
  [/&/g, " và "],
];

function normalize(text: string, english: boolean) {
  let t = text.replace(/\s+/g, " ").trim();
  if (!english) ABBREVIATIONS.forEach(([re, rep]) => { t = t.replace(re, rep); });
  return t.replace(/\s+/g, " ").trim();
}

// Tách câu; câu quá dài thì cắt tiếp theo dấu phẩy (giọng đọc dễ bị ngắt giữa chừng nếu quá dài)
function splitSentences(text: string): string[] {
  // Không dùng regex lookbehind — Safari trước iOS 16.4 không hỗ trợ, sẽ làm hỏng cả file JS
  // Dấu chấm/hai chấm nằm giữa 2 chữ số (8.5, 7:30) không phải hết câu
  const sentences = text.match(/(?:[^.!?…:;]|[.:](?=\d))+(?:[.!?…:;]+|$)/g) || [];
  const out: string[] = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length <= 220) { out.push(s); continue; }
    let buf = "";
    for (const part of s.match(/[^,]+(?:,|$)/g) || []) {
      const piece = part.trim();
      if (buf && (buf + " " + piece).length > 220) { out.push(buf); buf = piece; } else buf = buf ? `${buf} ${piece}` : piece;
    }
    if (buf) out.push(buf);
  }
  return out;
}

function isEnglish(sentence: string) {
  return !VI_CHARS.test(sentence) && (sentence.match(/[a-z]{2,}/gi) || []).length >= 3;
}

type Block = { el: HTMLElement | null; text: string };
function buildBlocks(): Block[] {
  const blocks: Block[] = [];
  const push = (el: HTMLElement | null) => {
    const text = (el?.textContent || "").replace(/\s+/g, " ").trim();
    if (text) blocks.push({ el, text });
  };
  push(document.querySelector<HTMLElement>("[data-blog-title]"));
  push(document.querySelector<HTMLElement>("[data-blog-excerpt]"));
  // Đọc tiêu đề mục, đoạn văn, ý trong danh sách, trích dẫn; bỏ qua ảnh, video, code
  document.querySelectorAll<HTMLElement>("[data-blog-content] :is(h1, h2, h3, h4, p, li, blockquote)").forEach((el) => {
    if (el.closest("pre, .ql-code-block-container")) return;
    if (el.tagName === "P" && el.closest("li, blockquote")) return; // tránh đọc 2 lần
    push(el);
  });
  return blocks;
}

// Giọng trình duyệt: từng câu ngắn, viết tắt được đọc đầy đủ
function browserChunks(blocks: Block[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { el, text: raw } of blocks) {
    for (const s of splitSentences(raw)) {
      const english = isEnglish(s);
      const text = normalize(s, english);
      if (text) chunks.push({ text, el, english });
    }
  }
  return chunks;
}

// ElevenLabs: cả khối 1 lần (giọng liền mạch, ít request). Gửi nguyên văn — backend kiểm tra đoạn văn có
// trong bài rồi mới tự chuẩn hoá viết tắt. Khối rất dài thì gộp câu thành từng phần ≤ CLOUD_MAX_CHARS.
function cloudChunks(blocks: Block[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const { el, text } of blocks) {
    if (text.length <= CLOUD_MAX_CHARS) { chunks.push({ text, el, english: false }); continue; }
    let buf = "";
    for (const s of splitSentences(text)) {
      if (buf && buf.length + s.length + 1 > CLOUD_MAX_CHARS) { chunks.push({ text: buf, el, english: false }); buf = s; }
      else buf = buf ? `${buf} ${s}` : s;
    }
    if (buf) chunks.push({ text: buf, el, english: false });
  }
  return chunks;
}

// iOS Safari chỉ cho <audio> phát sau 1 cú chạm: phát 1 đoạn im lặng ngay trong lúc bấm để "mở khoá"
// thẻ <audio>, sau đó đổi src + play() (sau khi tải xong URL) mới không bị chặn.
let silentUrl = "";
function silentWav() {
  if (silentUrl) return silentUrl;
  const samples = 800;
  const buf = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, "RIFF"); v.setUint32(4, 36 + samples * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 16000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, samples * 2, true);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

type Prefs = { voiceURI?: string; rate?: number; englishVoice?: boolean; follow?: boolean; boost?: number };
function loadPrefs(): Prefs {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function savePrefs(p: Prefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* bị chặn */ }
}

// Giọng "Natural"/"Online"/"Neural" (Edge, Android) nghe tự nhiên hơn hẳn giọng offline cũ -> ưu tiên
const voiceScore = (v: SpeechSynthesisVoice) => (/natural|online|neural/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
const byScore = (a: SpeechSynthesisVoice, b: SpeechSynthesisVoice) => voiceScore(b) - voiceScore(a);
const vietnameseVoices = (all: SpeechSynthesisVoice[]) => all.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("vi")).sort(byScore);
const englishVoice = (all: SpeechSynthesisVoice[]) => all.filter((v) => /^en[-_](us|gb)/i.test(v.lang)).sort(byScore)[0] || null;

export default function BlogAudioPlayer({ slug, wordCount }: { slug: string; wordCount: number }) {
  const [browserSupported, setBrowserSupported] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [engine, setEngine] = useState<Engine>("cloud");
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const chunksRef = useRef<Chunk[]>([]);
  const engineRef = useRef<Engine>("cloud");
  const runRef = useRef(0); // tăng mỗi lần dừng/đọc lại -> bỏ qua onend/onended/fetch của lượt đọc cũ
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null); // giữ tham chiếu: Chrome dọn rác utterance làm mất onend
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioIndexRef = useRef(-1); // khối đang nạp trong <audio> (để "Đọc tiếp" phát tiếp đúng chỗ đã dừng)
  const unlockedRef = useRef(false);
  const gainRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const urlCacheRef = useRef(new Map<string, Promise<string>>());
  const highlightedRef = useRef<HTMLElement | null>(null);
  const prefsRef = useRef<Prefs>({});

  // Nạp cài đặt + danh sách giọng trình duyệt (nạp bất đồng bộ, báo qua sự kiện voiceschanged)
  useEffect(() => {
    prefsRef.current = loadPrefs();
    setPrefs(prefsRef.current);
    const runs = runRef;
    const highlighted = highlightedRef;
    const audio = audioRef;
    const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
    const load = () => { if (synth) { setVoices(synth.getVoices()); setBrowserSupported(true); } };
    load();
    synth?.addEventListener("voiceschanged", load);
    return () => {
      synth?.removeEventListener("voiceschanged", load);
      runs.current++;
      synth?.cancel();
      audio.current?.pause();
      highlighted.current?.classList.remove("blog-reading");
    };
  }, []);

  const viVoices = useMemo(() => vietnameseVoices(voices), [voices]);
  const enVoice = useMemo(() => englishVoice(voices), [voices]);
  const viVoice = viVoices.find((v) => v.voiceURI === prefs.voiceURI) || viVoices[0] || null;
  const rate = prefs.rate ?? 1;
  const boost = prefs.boost ?? DEFAULT_BOOST;
  const englishVoiceOn = prefs.englishVoice ?? true;
  const follow = prefs.follow ?? true;

  const updatePrefs = (patch: Prefs) => {
    prefsRef.current = { ...prefsRef.current, ...patch };
    savePrefs(prefsRef.current);
    setPrefs(prefsRef.current);
  };

  const highlight = useCallback((el: HTMLElement | null) => {
    if (highlightedRef.current === el) return;
    highlightedRef.current?.classList.remove("blog-reading");
    highlightedRef.current = el;
    if (!el) return;
    el.classList.add("blog-reading");
    if (prefsRef.current.follow ?? true) {
      const r = el.getBoundingClientRect();
      if (r.top < 80 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  const finish = () => {
    setStatus("idle");
    setIndex(0);
    audioIndexRef.current = -1;
    highlight(null);
  };

  const silenceAll = () => {
    if (browserSupported) window.speechSynthesis.cancel();
    audioRef.current?.pause();
  };

  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      // Bắt buộc để Web Audio đọc được mp3 khác domain (Supabase / backend đều trả CORS *); thiếu là ra im lặng
      audioRef.current.crossOrigin = "anonymous";
    }
    return audioRef.current;
  };

  // Nối <audio> -> gain -> limiter -> loa. Gọi trong lúc bấm nút (iOS/Chrome chỉ cho AudioContext chạy sau cú chạm).
  // Trình duyệt không có Web Audio thì vẫn phát bình thường, chỉ không khuếch đại.
  const ensureBoost = () => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        const gain = ctx.createGain();
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.15;
        ctx.createMediaElementSource(getAudio()).connect(gain);
        gain.connect(limiter).connect(ctx.destination);
        audioCtxRef.current = ctx;
        gainRef.current = gain;
      }
      if (gainRef.current) gainRef.current.gain.value = prefsRef.current.boost ?? DEFAULT_BOOST;
      if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume().catch(() => {});
    } catch { /* không khuếch đại được -> phát âm lượng gốc */ }
  };

  // URL mp3 của 1 đoạn (backend tạo 1 lần rồi cache) — nhớ promise để tải trước / bấm lại không gọi 2 lần
  const fetchUrl = (text: string) => {
    const cache = urlCacheRef.current;
    let p = cache.get(text);
    if (!p) {
      p = fetch(`${API_URL}/api/blog/posts/${encodeURIComponent(slug)}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) throw new Error(data.error || "Không tải được giọng đọc");
        const url = data.url as string;
        return url.startsWith("/") ? `${API_URL}${url}` : url; // mp3 backend tự phát khi Storage lỗi
      });
      p.catch(() => cache.delete(text));
      cache.set(text, p);
    }
    return p;
  };

  const bindAudio = (audio: HTMLAudioElement, i: number, run: number) => {
    audio.onended = () => playCloud(i + 1, run);
    // File lỗi giữa chừng -> bỏ qua đoạn đó, đọc tiếp
    audio.onerror = () => { if (run === runRef.current) playCloud(i + 1, run); };
  };

  const playCloud = async (i: number, run: number) => {
    const chunks = chunksRef.current;
    if (run !== runRef.current) return;
    if (i >= chunks.length) { finish(); return; }
    const chunk = chunks[i];
    setIndex(i);
    setCurrentText(chunk.text);
    highlight(chunk.el);
    setStatus("loading");
    let url: string;
    try {
      url = await fetchUrl(chunk.text);
    } catch {
      if (run === runRef.current) switchToBrowser(chunk.el);
      return;
    }
    if (run !== runRef.current) return;
    if (chunks[i + 1]) fetchUrl(chunks[i + 1].text).catch(() => {}); // tải trước đoạn kế tiếp
    const audio = getAudio();
    bindAudio(audio, i, run);
    audio.src = url;
    audioIndexRef.current = i;
    audio.defaultPlaybackRate = audio.playbackRate = prefsRef.current.rate ?? 1;
    setStatus("playing");
    audio.play().catch((e) => {
      if (run !== runRef.current || e?.name === "AbortError") return;
      // Trình duyệt chặn tự phát (chưa có cú chạm) -> chờ người đọc bấm "Đọc tiếp"
      runRef.current++;
      setStatus("paused");
    });
  };

  const speakBrowser = (i: number, run: number) => {
    const synth = window.speechSynthesis;
    const chunks = chunksRef.current;
    if (run !== runRef.current) return;
    if (i >= chunks.length) { finish(); return; }
    const chunk = chunks[i];
    setIndex(i);
    setCurrentText(chunk.text);
    highlight(chunk.el);
    setStatus("playing");
    // Đọc cài đặt mới nhất mỗi câu (đổi giọng/tốc độ giữa chừng có hiệu lực ngay)
    const p = prefsRef.current;
    const all = synth.getVoices();
    const vis = vietnameseVoices(all);
    const vi = vis.find((v) => v.voiceURI === p.voiceURI) || vis[0] || null;
    const en = englishVoice(all);
    const voice = chunk.english && (p.englishVoice ?? true) && en ? en : vi;
    const u = new SpeechSynthesisUtterance(chunk.text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "vi-VN";
    u.rate = p.rate ?? 1;
    u.onend = () => speakBrowser(i + 1, run);
    // "interrupted"/"canceled" = do chính mình dừng; lỗi khác thì bỏ qua câu đó, đọc tiếp
    u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") speakBrowser(i + 1, run); };
    utterRef.current = u;
    synth.speak(u);
  };

  const speakFrom = (start: number) => {
    if (!chunksRef.current.length) {
      const blocks = buildBlocks();
      chunksRef.current = engineRef.current === "cloud" ? cloudChunks(blocks) : browserChunks(blocks);
    }
    const chunks = chunksRef.current;
    if (!chunks.length) return;
    setTotal(chunks.length);
    runRef.current++;
    const run = runRef.current;
    silenceAll();
    if (engineRef.current === "cloud") ensureBoost();
    if (engineRef.current === "cloud" && !unlockedRef.current) {
      // Gọi trong lúc bấm nút (đồng bộ) -> mở khoá <audio> cho iOS
      unlockedRef.current = true;
      const audio = getAudio();
      audio.src = silentWav();
      audio.play().catch(() => {});
    }
    const first = Math.max(0, Math.min(start, chunks.length - 1));
    if (engineRef.current === "cloud") playCloud(first, run);
    else speakBrowser(first, run);
  };

  const setEngineMode = (mode: Engine) => {
    engineRef.current = mode;
    setEngine(mode);
    chunksRef.current = [];
    audioIndexRef.current = -1;
  };

  // Giọng ElevenLabs lỗi (chưa cấu hình / hết lượt ký tự / mất mạng) -> đọc tiếp bằng giọng trình duyệt từ đúng khối đó
  const switchToBrowser = (fromEl: HTMLElement | null) => {
    setEngineMode("browser");
    if (!browserSupported || vietnameseVoices(window.speechSynthesis.getVoices()).length === 0) {
      setNotice(!browserSupported
        ? "Không tải được giọng đọc và trình duyệt này không hỗ trợ đọc văn bản. Hãy thử lại sau."
        : "Không tải được giọng đọc, thiết bị cũng chưa có giọng tiếng Việt. Windows: Cài đặt → Thời gian & ngôn ngữ → Giọng nói → thêm Tiếng Việt (hoặc mở bằng trình duyệt Edge). Android: cài \"Dịch vụ chuyển văn bản sang lời nói của Google\". iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt.");
      runRef.current++;
      finish();
      return;
    }
    setNotice("Giọng đọc AI tạm thời không tải được — đang đọc bằng giọng có sẵn của trình duyệt.");
    chunksRef.current = browserChunks(buildBlocks());
    const i = chunksRef.current.findIndex((c) => c.el === fromEl);
    speakFrom(Math.max(0, i));
  };

  const retryCloud = () => {
    const el = chunksRef.current[index]?.el ?? null;
    const wasActive = status !== "idle";
    runRef.current++;
    silenceAll();
    setEngineMode("cloud");
    setNotice(null);
    if (!wasActive) { finish(); return; }
    chunksRef.current = cloudChunks(buildBlocks());
    speakFrom(Math.max(0, chunksRef.current.findIndex((c) => c.el === el)));
  };

  const pause = () => {
    runRef.current++;
    silenceAll();
    setStatus("paused");
  };

  // "Đọc tiếp": giọng ElevenLabs phát tiếp đúng giây đã dừng; giọng trình duyệt đọc lại câu hiện tại
  const resume = () => {
    const audio = audioRef.current;
    if (engineRef.current === "cloud" && audio && audioIndexRef.current === index) {
      runRef.current++;
      const run = runRef.current;
      bindAudio(audio, index, run);
      ensureBoost();
      audio.playbackRate = prefsRef.current.rate ?? 1;
      setStatus("playing");
      audio.play().catch(() => { if (run === runRef.current) speakFrom(index); });
      return;
    }
    speakFrom(index);
  };

  const stop = () => {
    runRef.current++;
    silenceAll();
    finish();
  };

  // Nhảy sang đoạn (khối) trước/sau thay vì từng câu
  const jumpBlock = (dir: 1 | -1) => {
    const chunks = chunksRef.current;
    if (!chunks.length) return;
    let i = index;
    const curEl = chunks[i]?.el;
    if (dir === 1) {
      while (i < chunks.length && chunks[i].el === curEl) i++;
    } else {
      while (i > 0 && chunks[i].el === curEl) i--;
      const prevEl = chunks[i]?.el;
      while (i > 0 && chunks[i - 1].el === prevEl) i--;
    }
    if (i >= chunks.length) { stop(); return; }
    speakFrom(i);
  };

  // Đổi tốc độ: <audio> đổi ngay không cần đọc lại; giọng trình duyệt phải đọc lại câu hiện tại
  const changeRate = (r: number) => {
    updatePrefs({ rate: r });
    if (engineRef.current === "cloud") {
      if (audioRef.current) audioRef.current.defaultPlaybackRate = audioRef.current.playbackRate = r;
    } else if (status === "playing") speakFrom(index);
  };

  // Đổi giọng trình duyệt khi đang đọc -> đọc lại câu hiện tại với cài đặt mới
  const applyAndRestart = (patch: Prefs) => {
    updatePrefs(patch);
    if (status === "playing") speakFrom(index);
  };

  const minutes = Math.max(1, Math.round(wordCount / (170 * rate)));
  const progress = total ? Math.round((index / total) * 100) : 0;
  const active = status === "playing" || status === "loading";

  const controls = (compact: boolean) => (
    <div className="flex items-center gap-2">
      {active ? (
        <button onClick={pause} aria-label="Tạm dừng" className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shrink-0 text-lg">❚❚</button>
      ) : (
        <button onClick={() => (status === "paused" ? resume() : speakFrom(0))} aria-label={status === "paused" ? "Đọc tiếp" : "Nghe bài viết"}
          className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shrink-0 text-lg pl-0.5">▶</button>
      )}
      {status !== "idle" && (
        <>
          <button onClick={() => jumpBlock(-1)} aria-label="Đoạn trước" className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer">⏮</button>
          <button onClick={() => jumpBlock(1)} aria-label="Đoạn sau" className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer">⏭</button>
          {!compact && <button onClick={stop} aria-label="Dừng hẳn" className="w-9 h-9 rounded-full hover:bg-primary-soft text-primary flex items-center justify-center cursor-pointer">■</button>}
        </>
      )}
    </div>
  );

  const statusLabel = { idle: "Nghe bài viết", loading: "Đang tải giọng đọc...", playing: "Đang đọc...", paused: "Đã tạm dừng" }[status];

  return (
    <>
      <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          {controls(false)}
          <div className="flex-1 min-w-[140px]">
            <p className="font-semibold text-foreground text-sm">
              {statusLabel}
              <span className="text-muted font-normal"> · khoảng {minutes} phút</span>
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-primary-soft overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {RATES.map((r) => (
              <button key={r} onClick={() => changeRate(r)}
                className={`px-2.5 py-2 rounded-full text-xs font-bold cursor-pointer ${rate === r ? "bg-primary text-white" : "text-muted hover:bg-primary-soft"}`}>
                {r}×
              </button>
            ))}
          </div>
          <button onClick={() => setShowSettings((s) => !s)} aria-expanded={showSettings}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer px-2 py-2">
            Giọng đọc
          </button>
        </div>

        {notice && (
          <div className="mt-3 rounded-xl bg-amber-50 text-amber-800 text-xs px-3 py-2 flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-[200px]">{notice}</span>
            {engine === "browser" && (
              <button onClick={retryCloud} className="font-semibold underline cursor-pointer py-1">Thử lại giọng AI</button>
            )}
          </div>
        )}

        {showSettings && (
          <div className="mt-4 pt-4 border-t border-line grid gap-3 sm:grid-cols-2">
            {engine === "cloud" ? (
              <p className="sm:col-span-2 text-sm text-foreground">
                Giọng đọc: <span className="font-semibold">Trung</span>
                <span className="text-muted"> · giọng nam miền Nam (AI ElevenLabs), nghe giống nhau trên mọi thiết bị</span>
              </p>
            ) : null}
            {engine === "cloud" ? (
              <div className="sm:col-span-2">
                <p className="ui-label">Âm lượng</p>
                <div className="flex flex-wrap gap-2">
                  {BOOSTS.map((b) => (
                    <button key={b.value} onClick={() => { updatePrefs({ boost: b.value }); if (gainRef.current) gainRef.current.gain.value = b.value; }}
                      className={`ui-chip ${boost === b.value ? "ui-chip-active" : ""}`}>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="sm:col-span-2">
                  <label htmlFor="tts-voice" className="ui-label">Giọng tiếng Việt ({viVoices.length} giọng trên thiết bị này)</label>
                  <select id="tts-voice" value={viVoice?.voiceURI || ""} onChange={(e) => applyAndRestart({ voiceURI: e.target.value })} className="ui-input w-full">
                    {viVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
                  </select>
                  <p className="text-[11px] text-muted mt-1">
                    Danh sách giọng (nam/nữ, miền Bắc/Nam) do thiết bị và trình duyệt cung cấp. Trình duyệt Edge thường có nhiều giọng tự nhiên nhất.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={englishVoiceOn} disabled={!enVoice} onChange={(e) => applyAndRestart({ englishVoice: e.target.checked })} className="w-4 h-4 accent-[#1e3a8a]" />
                  Đọc câu tiếng Anh bằng giọng Anh{!enVoice && " (thiết bị không có)"}
                </label>
              </>
            )}
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={follow} onChange={(e) => updatePrefs({ follow: e.target.checked })} className="w-4 h-4 accent-[#1e3a8a]" />
              Tự cuộn theo đoạn đang đọc
            </label>
          </div>
        )}
      </div>

      {/* Thanh mini dính cuối màn hình khi đang nghe, để điều khiển khi đã cuộn xa */}
      {status !== "idle" && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line shadow-[0_-4px_16px_rgba(30,58,138,0.08)] px-4 py-2">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            {controls(true)}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted truncate">{currentText}</p>
              <div className="mt-1 h-1 rounded-full bg-primary-soft overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <button onClick={stop} aria-label="Đóng trình phát" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center cursor-pointer text-lg shrink-0">×</button>
          </div>
        </div>
      )}
    </>
  );
}
