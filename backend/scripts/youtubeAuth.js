// Lấy YT_REFRESH_TOKEN cho tab "Mạng xã hội" (chạy 1 lần, bằng tài khoản Google là chủ kênh YouTube):
//   cd backend && node scripts/youtubeAuth.js
// Cần YT_CLIENT_ID + YT_CLIENT_SECRET trong backend/.env (OAuth client loại "Desktop app", project đã bật
// YouTube Data API v3 + YouTube Analytics API; màn hình đồng ý OAuth phải ở trạng thái "In production" kẻo token chỉ sống 7 ngày).
// Script mở máy chủ tạm ở 127.0.0.1:53682 để nhận mã; in refresh token ra màn hình — chép vào .env, KHÔNG commit.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');

const clientId = process.env.YT_CLIENT_ID;
const clientSecret = process.env.YT_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Thiếu YT_CLIENT_ID / YT_CLIENT_SECRET trong backend/.env');
  process.exit(1);
}
const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}`;
const scope = 'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly';
const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId, redirect_uri: redirect, response_type: 'code', scope, access_type: 'offline', prompt: 'consent',
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirect).searchParams.get('code');
  if (!code) { res.end('Đang chờ mã từ Google...'); return; }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
  });
  const data = await r.json();
  res.end(data.refresh_token ? 'Xong! Quay lại cửa sổ dòng lệnh để chép token.' : 'Lỗi, xem cửa sổ dòng lệnh.');
  if (data.refresh_token) console.log('\nThêm dòng này vào backend/.env (và biến môi trường trên hosting):\n\nYT_REFRESH_TOKEN=' + data.refresh_token + '\n');
  else console.error('Không nhận được refresh token:', data);
  server.close();
});
server.listen(PORT, '127.0.0.1', () => console.log('Mở link này trong trình duyệt, đăng nhập bằng tài khoản chủ kênh YouTube:\n\n' + authUrl + '\n'));
