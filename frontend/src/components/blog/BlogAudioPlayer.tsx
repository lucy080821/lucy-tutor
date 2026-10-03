"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// "Nghe bài viết" bằng giọng đọc có sẵn của trình duyệt (Web Speech API) — không tạo file audio,
// không tốn phí, bài vừa đăng là nghe được ngay. Đổi lại: giọng phụ thuộc thiết bị người đọc
// (Edge/Windows, Chrome, Android, iOS mỗi nơi có bộ giọng tiếng Việt khác nhau, có máy không có).
//
// Đọc theo từng câu ngắn chứ không đưa cả bài vào 1 lần: Chrome tự dừng các câu đọc dài quá ~15 giây,
// và pause()/resume() của nhiều giọng Google không hoạt động — nên "Tạm dừng" thực chất là huỷ rồi
// đọc lại từ câu hiện tại. Câu đang đọc được tô sáng ngay trong bài.

type Chunk = { text: string; el: HTMLElement | null; english: boolean };

const STORAGE_KEY = "blog_tts_prefs";
const RATES = [0.75, 1, 1.25, 1.5];
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

function buildChunks(): Chunk[] {
  const chunks: Chunk[] = [];
  const push = (el: HTMLElement | null, raw: string | null | undefined) => {
    if (!raw) return;
    for (const s of splitSentences(raw)) {
      const english = isEnglish(s);
      const text = normalize(s, english);
      if (text) chunks.push({ text, el, english });
    }
  };
  push(document.querySelector<HTMLElement>("[data-blog-title]"), document.querySelector("[data-blog-title]")?.textContent);
  push(document.querySelector<HTMLElement>("[data-blog-excerpt]"), document.querySelector("[data-blog-excerpt]")?.textContent);
  // Đọc tiêu đề mục, đoạn văn, ý trong danh sách, trích dẫn; bỏ qua ảnh, video, code
  document.querySelectorAll<HTMLElement>("[data-blog-content] :is(h1, h2, h3, h4, p, li, blockquote)").forEach((el) => {
    if (el.closest("pre, .ql-code-block-container")) return;
    if (el.tagName === "P" && el.closest("li, blockquote")) return; // tránh đọc 2 lần
    push(el, el.textContent);
  });
  return chunks;
}

type Prefs = { voiceURI?: string; rate?: number; englishVoice?: boolean; follow?: boolean };
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

export default function BlogAudioPlayer({ wordCount }: { wordCount: number }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [prefs, setPrefs] = useState<Prefs>({});
  const [status, setStatus] = useState<"idle" | "playing" | "paused">("idle");
  const [index, setIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [currentText, setCurrentText] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const chunksRef = useRef<Chunk[]>([]);
  const runRef = useRef(0); // tăng mỗi lần dừng/đọc lại -> bỏ qua onend của lượt đọc cũ
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null); // giữ tham chiếu: Chrome dọn rác utterance làm mất onend
  const highlightedRef = useRef<HTMLElement | null>(null);
  const prefsRef = useRef<Prefs>({});

  // Nạp danh sách giọng (trình duyệt nạp bất đồng bộ, báo qua sự kiện voiceschanged)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      queueMicrotask(() => setSupported(false));
      return;
    }
    const synth = window.speechSynthesis;
    const load = () => {
      setVoices(synth.getVoices());
      setSupported(true);
    };
    load();
    prefsRef.current = loadPrefs();
    setPrefs(prefsRef.current);
    synth.addEventListener("voiceschanged", load);
    const runs = runRef;
    const highlighted = highlightedRef;
    return () => {
      synth.removeEventListener("voiceschanged", load);
      runs.current++;
      synth.cancel();
      highlighted.current?.classList.remove("blog-reading");
    };
  }, []);

  const viVoices = useMemo(() => vietnameseVoices(voices), [voices]);
  const enVoice = useMemo(() => englishVoice(voices), [voices]);
  const viVoice = viVoices.find((v) => v.voiceURI === prefs.voiceURI) || viVoices[0] || null;
  const rate = prefs.rate ?? 1;
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

  const finish = useCallback(() => {
    setStatus("idle");
    setIndex(0);
    highlight(null);
  }, [highlight]);

  const speakFrom = useCallback((start: number) => {
    const synth = window.speechSynthesis;
    if (!chunksRef.current.length) chunksRef.current = buildChunks();
    const chunks = chunksRef.current;
    setTotal(chunks.length);
    runRef.current++;
    const run = runRef.current;
    synth.cancel();

    const speak = (i: number) => {
      if (run !== runRef.current) return;
      if (i >= chunks.length) { finish(); return; }
      const chunk = chunks[i];
      setIndex(i);
      setCurrentText(chunk.text);
      highlight(chunk.el);
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
      u.onend = () => speak(i + 1);
      // "interrupted"/"canceled" = do chính mình dừng; lỗi khác thì bỏ qua câu đó, đọc tiếp
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") speak(i + 1); };
      utterRef.current = u;
      synth.speak(u);
    };
    setStatus("playing");
    speak(Math.max(0, Math.min(start, chunks.length - 1)));
  }, [finish, highlight]);

  const pause = () => {
    runRef.current++;
    window.speechSynthesis.cancel();
    setStatus("paused");
  };

  const stop = () => {
    runRef.current++;
    window.speechSynthesis.cancel();
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

  // Đổi giọng/tốc độ khi đang đọc -> đọc lại câu hiện tại với cài đặt mới
  const applyAndRestart = (patch: Prefs) => {
    updatePrefs(patch);
    if (status === "playing") speakFrom(index);
  };

  const minutes = Math.max(1, Math.round(wordCount / (170 * rate)));
  const progress = total ? Math.round((index / total) * 100) : 0;

  if (supported === null) return null;

  if (!supported || viVoices.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-line bg-white p-4 text-sm text-muted">
        <p className="font-semibold text-foreground">Nghe bài viết</p>
        <p className="mt-1">
          {supported === false
            ? "Trình duyệt này không hỗ trợ đọc văn bản. Hãy thử Chrome, Edge hoặc Safari bản mới."
            : "Thiết bị chưa có giọng đọc tiếng Việt. Windows: Cài đặt → Thời gian & ngôn ngữ → Giọng nói → thêm Tiếng Việt (hoặc mở bằng trình duyệt Edge). Android: cài \"Dịch vụ chuyển văn bản sang lời nói của Google\". iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Việt."}
        </p>
      </div>
    );
  }

  const controls = (compact: boolean) => (
    <div className="flex items-center gap-2">
      {status === "playing" ? (
        <button onClick={pause} aria-label="Tạm dừng" className="w-11 h-11 rounded-full bg-primary text-white flex items-center justify-center cursor-pointer shrink-0 text-lg">❚❚</button>
      ) : (
        <button onClick={() => speakFrom(status === "paused" ? index : 0)} aria-label={status === "paused" ? "Đọc tiếp" : "Nghe bài viết"}
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

  return (
    <>
      <div className="mt-6 rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          {controls(false)}
          <div className="flex-1 min-w-[140px]">
            <p className="font-semibold text-foreground text-sm">
              {status === "idle" ? "Nghe bài viết" : status === "playing" ? "Đang đọc..." : "Đã tạm dừng"}
              <span className="text-muted font-normal"> · khoảng {minutes} phút</span>
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-primary-soft overflow-hidden">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center gap-1">
            {RATES.map((r) => (
              <button key={r} onClick={() => applyAndRestart({ rate: r })}
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

        {showSettings && (
          <div className="mt-4 pt-4 border-t border-line grid gap-3 sm:grid-cols-2">
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
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={follow} onChange={(e) => updatePrefs({ follow: e.target.checked })} className="w-4 h-4 accent-[#1e3a8a]" />
              Tự cuộn theo câu đang đọc
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
