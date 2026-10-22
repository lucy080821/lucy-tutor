// Tài khoản cho Lucy Notes (mount /api/notes-auth). Loại tài khoản thứ 4: role "NOTES" — CHỈ dùng cho Ghi chú, không vào
// được app học (/api/auth/signin từ chối, frontend chặn các trang học). Đăng nhập ở đây nhận cả tài khoản NOTES lẫn
// học viên/giáo viên có sẵn (họ dùng chung 1 sổ ghi chú theo tài khoản); ADMIN không bao giờ đăng nhập qua đây.
// Xem CLAUDE.md mục "/notes — Lucy Notes".
const express = require('express');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

const router = express.Router();
const BCRYPT_ROUNDS = 10;
const NOTES_LOGIN_ROLES = ['NOTES', 'STUDENT', 'TEACHER'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Chặn dò mật khẩu / tạo tài khoản hàng loạt: đếm theo IP (+ email khi đăng nhập), lưu RAM, 15 phút
const hits = new Map();
function limited(key, max) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < 15 * 60_000);
  if (list.length >= max) return true;
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 15 * 60_000)) hits.delete(k);
  return false;
}
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, mustChangePassword: !!u.mustChangePassword });

router.post('/signup', async (req, res) => {
  try {
    if (limited(`signup:${ipOf(req)}`, 5)) return res.status(429).json({ error: 'Bạn tạo tài khoản quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    const name = String(req.body.name || '').trim().slice(0, 80);
    const email = String(req.body.email || '').trim().toLowerCase().slice(0, 160);
    const password = String(req.body.password || '');
    if (String(req.body.website || '')) return res.status(400).json({ error: 'Yêu cầu không hợp lệ' }); // ô bẫy bot
    if (name.length < 2) return res.status(400).json({ error: 'Vui lòng nhập tên (ít nhất 2 ký tự)' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Email không hợp lệ' });
    if (password.length < 8) return res.status(400).json({ error: 'Mật khẩu cần ít nhất 8 ký tự' });
    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { role: true } });
    if (existing) {
      return res.status(409).json({
        error: existing.role === 'ADMIN' ? 'Email này không dùng được. Vui lòng dùng email khác.'
          : existing.role === 'NOTES' ? 'Email này đã có tài khoản Ghi chú — hãy đăng nhập.'
            : 'Email này đã có tài khoản Lucy Tutor (học viên/giáo viên). Hãy đăng nhập bằng tài khoản đó — ghi chú dùng chung.',
      });
    }
    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS), role: 'NOTES' },
      select: { id: true, name: true, email: true, role: true, mustChangePassword: true },
    });
    res.json(publicUser(user));
  } catch (err) {
    console.error('[notes-auth] signup', err);
    res.status(500).json({ error: 'Không tạo được tài khoản, vui lòng thử lại' });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (limited(`signin:${ipOf(req)}:${email.toLowerCase()}`, 8)) return res.status(429).json({ error: 'Sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, omit: { password: false } });
    if (!user || !user.password || !(await bcrypt.compare(String(req.body.password || ''), user.password))) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
    }
    if (!NOTES_LOGIN_ROLES.includes(user.role)) {
      return res.status(403).json({ error: 'Tài khoản này không dùng để đăng nhập Ghi chú.' });
    }
    prisma.user.update({ where: { id: user.id }, data: { lastActive: new Date() } }).catch(() => {});
    res.json(publicUser(user));
  } catch (err) {
    console.error('[notes-auth] signin', err);
    res.status(500).json({ error: 'Không đăng nhập được, vui lòng thử lại' });
  }
});

module.exports = router;
