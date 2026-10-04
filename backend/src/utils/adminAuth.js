// Đăng nhập trang quản trị /administrator.
//
// 3 loại tài khoản tách biệt hoàn toàn: STUDENT (/dashboard), TEACHER (/teacher), ADMIN (/administrator).
// Tài khoản ADMIN là tài khoản riêng (role "ADMIN" trong bảng User), chỉ tạo được bằng script
// backend/scripts/createAdmin.js — không có giao diện/API nào tạo hay đổi tài khoản khác thành ADMIN.
// Tài khoản ADMIN không đăng nhập được ở /auth, và học viên/giáo viên không đăng nhập được ở đây.
//
// Khác phần còn lại của app (chỉ gửi userId), trang này dùng phiên có chữ ký:
// - token = payload base64url + chữ ký HMAC-SHA256, hết hạn sau 12 giờ
// - khoá ký: ADMIN_TOKEN_SECRET; không đặt thì sinh ngẫu nhiên lúc khởi động (khởi động lại server = phải đăng nhập lại)
// - mỗi request kiểm tra lại tài khoản vẫn còn và vẫn là ADMIN (cache 60 giây cho đỡ truy vấn DB)
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const ADMIN_ROLE = 'ADMIN';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const ROLE_CACHE_MS = 60 * 1000;
const SECRET = process.env.ADMIN_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function createAdminToken(user) {
  const payload = Buffer.from(JSON.stringify({ uid: user.id, email: user.email, exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function verifyAdminToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.uid && data.exp && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

// uid -> { ok, expires }: tài khoản còn tồn tại và vẫn là ADMIN không
const roleCache = new Map();
async function isStillAdmin(uid) {
  const hit = roleCache.get(uid);
  if (hit && hit.expires > Date.now()) return hit.ok;
  const user = await prisma.user.findUnique({ where: { id: uid }, select: { role: true } });
  const ok = user?.role === ADMIN_ROLE;
  if (roleCache.size > 1000) roleCache.clear();
  roleCache.set(uid, { ok, expires: Date.now() + ROLE_CACHE_MS });
  return ok;
}

// Middleware: header "Authorization: Bearer <token>" -> req.admin = { uid, email }
async function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const admin = verifyAdminToken(header.startsWith('Bearer ') ? header.slice(7) : '');
    if (!admin || !(await isStillAdmin(admin.uid))) {
      return res.status(401).json({ error: 'Phiên quản trị đã hết hạn, vui lòng đăng nhập lại' });
    }
    req.admin = admin;
    next();
  } catch (err) {
    console.error('[admin-auth]', err);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
  }
}

// Chống dò mật khẩu: tối đa 5 lần sai / 15 phút cho mỗi IP + email
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED = 5;
const failedLogins = new Map();

function loginBlocked(key) {
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt < Date.now()) return 0;
  return entry.count >= MAX_FAILED ? Math.ceil((entry.resetAt - Date.now()) / 60000) : 0;
}

function recordFailedLogin(key) {
  const now = Date.now();
  const entry = failedLogins.get(key);
  if (!entry || entry.resetAt < now) failedLogins.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count++;
  if (failedLogins.size > 5000) failedLogins.clear();
}

const clearFailedLogins = (key) => failedLogins.delete(key);

module.exports = {
  ADMIN_ROLE, createAdminToken, verifyAdminToken, requireAdmin,
  loginBlocked, recordFailedLogin, clearFailedLogins,
};
