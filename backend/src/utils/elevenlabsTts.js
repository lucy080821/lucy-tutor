// Giọng đọc ElevenLabs cho "Nghe bài viết" ở /blog/[slug].
//
// - Giọng mặc định: "Trung - Soft, Smooth and Narrative" (nam, miền Nam, id FTYCiQT21H9XQvhRu0ch). Đặt
//   ELEVENLABS_VOICE_ID để chỉ định thẳng (dùng được cả giọng Voice Library chưa thêm vào tài khoản); không đặt thì
//   dùng giọng mặc định; đặt ELEVENLABS_VOICE_NAME thì tự tìm theo tên trong "My Voices" (cần quyền voices_read),
//   không có thì tìm trong Voice Library và tự thêm vào tài khoản (cần thêm quyền voices_write).
// - Model mặc định eleven_turbo_v2_5: dòng v2 (multilingual_v2) KHÔNG hỗ trợ tiếng Việt, v2.5 mới có.
// - Mp3 32kbps mono: đủ cho giọng nói, nhẹ ~2.4MB/10 phút — file phục vụ từ Supabase Storage, egress
//   gói Free chỉ 5GB/tháng (từng bị khoá Storage vì vượt egress, xem CLAUDE.md).
const crypto = require('crypto');

const API = 'https://api.elevenlabs.io';
const API_KEY = process.env.ELEVENLABS_API_KEY || '';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';
const DEFAULT_VOICE_ID = 'FTYCiQT21H9XQvhRu0ch';
const VOICE_NAME = process.env.ELEVENLABS_VOICE_NAME || '';
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_22050_32';

const isConfigured = () => !!API_KEY;

class TtsError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

async function elevenFetch(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { 'xi-api-key': API_KEY, ...(init.headers || {}) },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = await res.json();
      detail = body?.detail?.message || body?.detail?.status || (typeof body?.detail === 'string' ? body.detail : '');
    } catch { /* body không phải JSON */ }
    if (res.status === 401 && /quota/i.test(detail)) throw new TtsError('Đã hết lượt ký tự ElevenLabs của tháng này', 503);
    if (res.status === 401 && /permission/i.test(detail)) throw new TtsError(`API key ElevenLabs thiếu quyền: ${detail}`, 503);
    if (res.status === 401) throw new TtsError('ELEVENLABS_API_KEY không hợp lệ', 503);
    if (res.status === 429) throw new TtsError('ElevenLabs đang quá tải, thử lại sau ít phút', 503);
    throw new TtsError(`ElevenLabs lỗi ${res.status}${detail ? `: ${detail}` : ''}`);
  }
  return res;
}

const normName = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

let voiceIdPromise = null;
async function findVoiceId() {
  if (process.env.ELEVENLABS_VOICE_ID) return process.env.ELEVENLABS_VOICE_ID;
  if (!VOICE_NAME) return DEFAULT_VOICE_ID;
  const wanted = normName(VOICE_NAME);
  const matches = (name) => normName(name).includes(wanted);

  const mine = await (await elevenFetch(`/v2/voices?page_size=100&search=${encodeURIComponent(VOICE_NAME)}`)).json();
  const own = (mine.voices || []).find((v) => matches(v.name));
  if (own) return own.voice_id;

  const shared = await (await elevenFetch(`/v1/shared-voices?page_size=30&search=${encodeURIComponent(VOICE_NAME)}`)).json();
  const lib = (shared.voices || []).find((v) => matches(v.name));
  if (!lib) throw new TtsError(`Không tìm thấy giọng "${VOICE_NAME}" trên ElevenLabs — đặt ELEVENLABS_VOICE_ID`, 503);
  const added = await (await elevenFetch(`/v1/voices/add/${lib.public_owner_id}/${lib.voice_id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ new_name: lib.name }),
  })).json();
  return added.voice_id || lib.voice_id;
}

function getVoiceId() {
  // Tìm 1 lần rồi nhớ; lỗi thì lần sau tìm lại
  if (!voiceIdPromise) voiceIdPromise = findVoiceId().catch((err) => { voiceIdPromise = null; throw err; });
  return voiceIdPromise;
}

// Viết tắt máy hay đọc sai -> đọc đầy đủ (giống bản giọng trình duyệt ở BlogAudioPlayer)
const ABBREVIATIONS = [
  [/\bTHPT\b/g, 'trung học phổ thông'],
  [/\bTHCS\b/g, 'trung học cơ sở'],
  [/\bGV\b/g, 'giáo viên'],
  [/\bHS\b/g, 'học sinh'],
  [/\bTP\.\s?/g, 'thành phố '],
  [/&/g, ' và '],
];
function normalizeForSpeech(text) {
  let t = String(text).replace(/\s+/g, ' ').trim();
  for (const [re, rep] of ABBREVIATIONS) t = t.replace(re, rep);
  return t.replace(/\s+/g, ' ').trim();
}

// Khoá cache: đổi giọng/model/định dạng hoặc sửa đoạn văn -> file mới; đoạn không đổi dùng lại file cũ
async function cacheKey(text) {
  const voiceId = await getVoiceId();
  const hash = crypto.createHash('sha1').update(`${voiceId}|${MODEL}|${OUTPUT_FORMAT}|${text}`).digest('hex');
  return { voiceId, hash };
}

async function synthesize(text, voiceId) {
  const res = await elevenFetch(`/v1/text-to-speech/${voiceId}?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: MODEL }),
  });
  return Buffer.from(await res.arrayBuffer());
}

module.exports = { isConfigured, normalizeForSpeech, cacheKey, synthesize, TtsError };
