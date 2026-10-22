const express = require('express');
const prisma = require('../lib/prisma');
const { issueTempPassword } = require('../utils/tempPassword');

// Quên mật khẩu. Email đăng nhập thường là chuỗi ngẫu nhiên, không phải hộp thư thật -> không gửi link qua email.
// Luồng: học viên/giáo viên gửi yêu cầu ở /auth -> người phụ trách cấp mật khẩu tạm (xem utils/tempPassword.js)
// rồi nhắn cho chủ tài khoản -> đăng nhập bằng mật khẩu tạm thì bắt buộc đổi mật khẩu mới.
//   - Học viên: giáo viên của lớp học viên đang học, hoặc giáo viên phụ trách (học viên tự do)
//   - Giáo viên: admin (routes trong admin.routes.js; admin cũng thấy mọi yêu cầu của học viên để làm dự phòng)

const router = express.Router();

// ===== Gửi yêu cầu (công khai) =====

// Chống spam đơn giản theo IP: tối đa 5 yêu cầu / 15 phút
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map(); // ip -> [timestamps]
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

const GENERIC_REPLY = {
  message: 'Nếu email đăng nhập đúng, yêu cầu đã được gửi tới giáo viên phụ trách (với học viên) hoặc quản trị viên (với giáo viên). Bạn sẽ nhận được mật khẩu tạm qua số điện thoại/Zalo đã ghi.',
};

router.post('/request', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    const contact = String(req.body?.contact || '').trim().slice(0, 100) || null;
    const note = String(req.body?.note || '').trim().slice(0, 500) || null;
    if (!email) return res.status(400).json({ error: 'Vui lòng nhập email đăng nhập' });
    if (!contact) return res.status(400).json({ error: 'Vui lòng nhập số điện thoại/Zalo để nhận mật khẩu mới' });
    // Render đứng sau proxy (server không bật trust proxy) -> lấy IP gốc từ x-forwarded-for
    const ip = String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    if (rateLimited(ip)) return res.status(429).json({ error: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.' });

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, role: { in: ['STUDENT', 'TEACHER', 'NOTES'] } },
      select: { id: true },
    });
    // Trả lời giống nhau dù email có tồn tại hay không -> không dò được tài khoản
    if (!user) return res.json(GENERIC_REPLY);

    // Mỗi tài khoản chỉ giữ 1 yêu cầu đang chờ — gửi lại thì cập nhật liên hệ/ghi chú và đẩy lên đầu danh sách
    const pending = await prisma.passwordResetRequest.findFirst({ where: { userId: user.id, status: 'PENDING' }, select: { id: true } });
    if (pending) {
      await prisma.passwordResetRequest.update({ where: { id: pending.id }, data: { contact, note, createdAt: new Date() } });
    } else {
      await prisma.passwordResetRequest.create({ data: { userId: user.id, contact, note } });
    }
    res.json(GENERIC_REPLY);
  } catch (error) {
    console.error('[password-reset]', error);
    res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
  }
});

// ===== Phía giáo viên =====

// Học viên thuộc quyền của giáo viên: đang học 1 lớp của giáo viên, hoặc học viên tự do chọn giáo viên này
const studentsOf = (teacherId) => ({
  role: 'STUDENT',
  OR: [{ managerTeacherId: teacherId }, { classroomsJoined: { some: { teacherId } } }],
});

async function assertTeacher(teacherId) {
  if (!teacherId) return false;
  const t = await prisma.user.findUnique({ where: { id: teacherId }, select: { role: true } });
  return t?.role === 'TEACHER';
}

// Yêu cầu đang chờ + học viên đang có mật khẩu tạm chưa đổi (để giáo viên xem lại mật khẩu đã cấp)
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    if (!(await assertTeacher(teacherId))) return res.status(403).json({ error: 'Không có quyền' });
    const [requests, tempPasswords] = await Promise.all([
      prisma.passwordResetRequest.findMany({
        where: { status: 'PENDING', user: studentsOf(teacherId) },
        select: { id: true, contact: true, note: true, createdAt: true, user: { select: { id: true, name: true, email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.findMany({
        where: { ...studentsOf(teacherId), tempPassword: { not: null } },
        select: { id: true, name: true, email: true, phone: true, tempPassword: true, tempPasswordIssuedAt: true },
        orderBy: { tempPasswordIssuedAt: 'desc' },
      }),
    ]);
    res.json({ requests, tempPasswords });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/teacher/reset', async (req, res) => {
  try {
    const { teacherId, studentId } = req.body || {};
    if (!(await assertTeacher(teacherId))) return res.status(403).json({ error: 'Không có quyền' });
    const student = await prisma.user.findFirst({ where: { id: studentId, ...studentsOf(teacherId) }, select: { id: true, name: true, email: true } });
    if (!student) return res.status(404).json({ error: 'Không tìm thấy học viên thuộc lớp/quyền phụ trách của bạn' });
    const tempPassword = await issueTempPassword(student.id, teacherId);
    res.json({ ...student, tempPassword });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/teacher/requests/:id/dismiss', async (req, res) => {
  try {
    const { teacherId } = req.body || {};
    if (!(await assertTeacher(teacherId))) return res.status(403).json({ error: 'Không có quyền' });
    const { count } = await prisma.passwordResetRequest.updateMany({
      where: { id: req.params.id, status: 'PENDING', user: studentsOf(teacherId) },
      data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedById: teacherId },
    });
    if (!count) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
