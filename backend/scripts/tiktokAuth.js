// Lấy TT_REFRESH_TOKEN cho tab "Mạng xã hội" (chạy 1 lần, bằng tài khoản TikTok là chủ kênh):
//   cd backend && node scripts/tiktokAuth.js
// Cần TT_CLIENT_KEY + TT_CLIENT_SECRET trong backend/.env. App TikTok (developers.tiktok.com) phải bật Login Kit + Display API,
// scope user.info.basic, user.info.stats, video.list, và ĐĂNG KÝ Redirect URI đúng bằng dòng script in ra
// (mặc định http://127.0.0.1:53683/ ; đổi bằng biến TT_REDIRECT_URI nếu cần địa chỉ khác).
// Khi app còn ở chế độ Sandbox, tài khoản đăng nhập phải nằm trong "Target users" của app.
// Script mở máy chủ tạm ở cổng 53683 để nhận mã; in refresh token ra màn hình — chép vào .env, KHÔNG commit.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const key = process.env.TT_CLIENT_KEY;
const secret = process.env.TT_CLIENT_SECRET;
if (!key || !secret) {
  console.error('Thiếu TT_CLIENT_KEY / TT_CLIENT_SECRET trong backend/.env');
  process.exit(1);
}
const PORT = 53683;
// TikTok (nền tảng Desktop) chỉ nhận Redirect URI có host là localhost:port hoặc 127.0.0.1:port; server tạm bên dưới nghe ở 127.0.0.1
const redirect = process.env.TT_REDIRECT_URI || `http://127.0.0.1:${PORT}/`;
const state = crypto.randomBytes(8).toString('hex');

// TikTok bắt buộc PKCE (lỗi "code_challenge" nếu thiếu). code_challenge của TikTok = SHA-256 của code_verifier dạng HEX
// (khác chuẩn RFC là base64url). Verifier lưu tạm vào file để chế độ "node scripts/tiktokAuth.js <code>" (redirect https) dùng lại.
const verifierFile = path.join(os.tmpdir(), 'lucy-tiktok-verifier.txt');
let verifier;
if (process.argv[2]) {
  try { verifier = fs.readFileSync(verifierFile, 'utf8').trim(); } catch { /* chưa chạy bước lấy link */ }
  if (!verifier) { console.error('Chưa có code_verifier: chạy "node scripts/tiktokAuth.js" (không tham số) để lấy link đăng nhập trước.'); process.exit(1); }
} else {
  verifier = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(verifierFile, verifier);
}
const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
const authUrl = 'https://www.tiktok.com/v2/auth/authorize/?' + new URLSearchParams({
  client_key: key, scope: process.env.TT_SCOPES || 'user.info.stats,video.list', response_type: 'code', redirect_uri: redirect, state,
  code_challenge: challenge, code_challenge_method: 'S256',
});

async function exchange(code) {
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key: key, client_secret: secret, code, grant_type: 'authorization_code', redirect_uri: redirect, code_verifier: verifier }),
  });
  const data = await r.json();
  if (data.refresh_token) console.log('\nThêm dòng này vào backend/.env (và biến môi trường trên hosting):\n\nTT_REFRESH_TOKEN=' + data.refresh_token + '\n');
  else console.error('Không nhận được refresh token:', data);
  return !!data.refresh_token;
}

// Redirect URI https (không phải localhost): sau khi cấp quyền, chép giá trị "code" trên thanh địa chỉ rồi chạy
//   node scripts/tiktokAuth.js <code>
if (process.argv[2]) {
  exchange(decodeURIComponent(process.argv[2])).then((ok) => process.exit(ok ? 0 : 1));
  return;
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const code = u.searchParams.get('code');
  if (!code) { res.end('Đang chờ mã từ TikTok...'); return; }
  if (u.searchParams.get('state') !== state) { res.end('Sai state, thử lại.'); return; }
  const ok = await exchange(decodeURIComponent(code));
  res.end(ok ? 'Xong! Quay lại cửa sổ dòng lệnh để chép token.' : 'Lỗi, xem cửa sổ dòng lệnh.');
  server.close();
});
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Redirect URI (phải khớp đã đăng ký trong app TikTok): ${redirect}\n`);
  console.log('Mở link này trong trình duyệt, đăng nhập bằng tài khoản chủ kênh TikTok:\n\n' + authUrl + '\n');
  if (!redirect.startsWith(`http://127.0.0.1:${PORT}`)) console.log('Redirect URI không phải localhost: xem hướng dẫn "node scripts/tiktokAuth.js <code>" ở đầu phần mã.');
});
