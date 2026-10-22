// Tiện ích chung cho các bộ đồng bộ mạng xã hội (youtube.js, facebook.js)
const DAY_MS = 24 * 60 * 60 * 1000;

const ymd = (d) => d.toISOString().slice(0, 10);
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Ô biến môi trường của hosting giữ nguyên ký tự → bỏ cặp nháy bọc ngoài nếu lỡ chép cả từ .env
const env = (name) => (process.env[name] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2');

async function getJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

module.exports = { DAY_MS, ymd, toDate, num, chunk, env, getJson };
