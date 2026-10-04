const express = require('express');
const bcrypt = require('bcryptjs');

const prisma = require('../lib/prisma');
const {
  ADMIN_ROLE, createAdminToken, requireAdmin,
  loginBlocked, recordFailedLogin, clearFailedLogins,
} = require('../utils/adminAuth');

// Trang quản trị /administrator: tổng quan hệ thống, sổ thu chi nhập tay + lợi nhuận theo tháng, quản lý tài khoản.
// Chỉ tài khoản role ADMIN (tài khoản riêng, tạo bằng backend/scripts/createAdmin.js) mới vào được.
// Mọi route (trừ /login) yêu cầu token admin — xem utils/adminAuth.js.

const router = express.Router();

const BCRYPT_ROUNDS = 10;
const DEFAULT_PASSWORD = '123456'; // giống mật khẩu mặc định khi giáo viên thêm học viên thủ công
const TYPES = ['INCOME', 'EXPENSE'];
const DAY_MS = 24 * 60 * 60 * 1000;

// ===== Thời gian theo giờ Việt Nam (server chạy UTC) =====
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');
const vnMonthStart = (year, month) => new Date(`${year}-${pad(month)}-01T00:00:00+07:00`);
const vnMonthRange = (year, month) => ({
  gte: vnMonthStart(year, month),
  lt: month === 12 ? vnMonthStart(year + 1, 1) : vnMonthStart(year, month + 1),
});
const vnParts = (date) => {
  const d = new Date(date.getTime() + VN_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
};
const daysInMonth = (year, month) => new Date(Date.UTC(year, month, 0)).getUTCDate();
// Ngày "YYYY-MM-DD" -> 12:00 giờ VN (giữa ngày, đổi múi giờ thế nào cũng không nhảy sang ngày/tháng khác)
const vnNoon = (year, month, day) => new Date(`${year}-${pad(month)}-${pad(day)}T12:00:00+07:00`);

function parseYearMonth(query) {
  const now = vnParts(new Date());
  const year = Number(query.year) || now.year;
  const month = query.month === undefined ? null : Number(query.month);
  if (year < 2000 || year > 2100) return null;
  if (month !== null && !(month >= 1 && month <= 12)) return null;
  return { year, month };
}

const httpError = (status, message) => Object.assign(new Error(message), { status });
const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[admin]', err);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
};

// ===== Đăng nhập =====

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu' });

    const key = `${req.ip}|${email}`;
    const waitMinutes = loginBlocked(key);
    if (waitMinutes) return res.status(429).json({ error: `Sai quá nhiều lần, thử lại sau ${waitMinutes} phút` });

    const user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { id: true, email: true, name: true, role: true, password: true },
    });
    // Chỉ tài khoản ADMIN — tài khoản học viên/giáo viên dù đúng mật khẩu cũng không vào được
    const ok = !!user?.password && user.role === ADMIN_ROLE && await bcrypt.compare(password, user.password);
    if (!ok) {
      recordFailedLogin(key);
      // Cùng 1 thông báo cho mọi trường hợp — không để lộ email nào tồn tại / là admin
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng, hoặc đây không phải tài khoản quản trị' });
    }
    clearFailedLogins(key);
    res.json({ token: createAdminToken(user), admin: { email: user.email, name: user.name } });
  } catch (err) {
    sendError(res, err);
  }
});

router.use(requireAdmin);

router.get('/me', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.admin.uid }, select: { email: true, name: true } });
    if (!user) return res.status(401).json({ error: 'Tài khoản không còn tồn tại' });
    res.json({ admin: user });
  } catch (err) {
    sendError(res, err);
  }
});

// Admin tự đổi mật khẩu của mình (tài khoản admin không dùng được trang đổi mật khẩu của học viên)
router.put('/change-password', async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự' });
    const user = await prisma.user.findUnique({ where: { id: req.admin.uid }, select: { password: true } });
    if (!user?.password || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng' });
    }
    await prisma.user.update({ where: { id: req.admin.uid }, data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) } });
    res.json({ ok: true });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Tổng quan hệ thống =====

// Học viên tự do (0 lớp): miễn trừ (tạo trước mốc dùng thử, không có hạn) / dùng thử / đang hoạt động (đã đóng phí) / đã khoá
function freeStudentStatus(u) {
  if (!u.accessExpiresAt) return 'EXEMPT';
  if (new Date(u.accessExpiresAt).getTime() <= Date.now()) return 'LOCKED';
  return u._count.freeStudentPaymentsMade > 0 ? 'ACTIVE' : 'TRIAL';
}

async function monthFinance(year, month) {
  const rows = await prisma.adminTransaction.groupBy({
    by: ['type'], where: { date: vnMonthRange(year, month) }, _sum: { amount: true },
  });
  const sum = (t) => rows.find((r) => r.type === t)?._sum.amount || 0;
  const income = sum('INCOME');
  const expense = sum('EXPENSE');
  return { income, expense, profit: income - expense };
}

router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const { year, month } = vnParts(now);
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    // 12 tháng gần nhất tính cả tháng này (cũ -> mới)
    const last12 = [];
    for (let i = 0, y = year, m = month; i < 12; i++) {
      last12.unshift({ y, m });
      if (--m === 0) { m = 12; y--; }
    }
    const from = vnMonthStart(last12[0].y, last12[0].m);

    const [students, teachers, classrooms, active7, active30, publishedPosts, freeStudents, signupRows, finance, prevFinance] = await Promise.all([
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.classroom.count(),
      prisma.user.count({ where: { lastActive: { gte: new Date(now - 7 * DAY_MS) } } }),
      prisma.user.count({ where: { lastActive: { gte: new Date(now - 30 * DAY_MS) } } }),
      prisma.blogPost.count({ where: { status: 'PUBLISHED', publishedAt: { lte: now } } }),
      prisma.user.findMany({
        where: { role: 'STUDENT', classroomsJoined: { none: {} } },
        select: { accessExpiresAt: true, _count: { select: { freeStudentPaymentsMade: true } } },
      }),
      prisma.$queryRaw`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') AS ym,
               role, COUNT(*)::int AS n
        FROM "User" WHERE "createdAt" >= ${from}
        GROUP BY 1, 2`,
      monthFinance(year, month),
      monthFinance(prev.year, prev.month),
    ]);

    const freeStatus = { TRIAL: 0, ACTIVE: 0, LOCKED: 0, EXEMPT: 0 };
    freeStudents.forEach((u) => { freeStatus[freeStudentStatus(u)]++; });

    const signups = last12.map(({ y, m }) => {
      const ym = `${y}-${pad(m)}`;
      const pick = (role) => signupRows.find((r) => r.ym === ym && r.role === role)?.n || 0;
      return { ym, label: `T${m}/${String(y).slice(2)}`, students: pick('STUDENT'), teachers: pick('TEACHER') };
    });

    res.json({
      counts: { students, teachers, classrooms, freeStudents: freeStudents.length, active7, active30, publishedPosts },
      freeStatus,
      signups,
      finance: { year, month, ...finance, prev: prevFinance },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Thu chi =====

const TX_SELECT = { id: true, type: true, category: true, amount: true, date: true, note: true, recurring: true, createdByEmail: true };

function parseTransaction(body) {
  const type = String(body?.type || '');
  if (!TYPES.includes(type)) throw httpError(400, 'Loại khoản không hợp lệ');
  const category = String(body?.category || '').trim().replace(/\s+/g, ' ');
  if (!category) throw httpError(400, 'Vui lòng nhập nhóm/danh mục');
  if (category.length > 60) throw httpError(400, 'Tên danh mục tối đa 60 ký tự');
  const amount = Number(body?.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 1e12) throw httpError(400, 'Số tiền phải là số nguyên dương (VND)');
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(body?.date || ''));
  if (!m) throw httpError(400, 'Ngày không hợp lệ');
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(y, mo)) throw httpError(400, 'Ngày không hợp lệ');
  const note = body?.note ? String(body.note).trim().slice(0, 500) : null;
  return { type, category, amount, date: vnNoon(y, mo, d), note: note || null, recurring: !!body?.recurring };
}

// Thu/chi nhập tay của 12 tháng trong năm + học phí thu qua app (chỉ tham khảo, KHÔNG cộng vào lợi nhuận)
router.get('/finance/summary', async (req, res) => {
  try {
    const ym = parseYearMonth(req.query);
    if (!ym) return res.status(400).json({ error: 'Năm không hợp lệ' });
    const { year } = ym;
    const range = { gte: vnMonthStart(year, 1), lt: vnMonthStart(year + 1, 1) };

    const [txs, tuition, freePayments] = await Promise.all([
      prisma.adminTransaction.findMany({ where: { date: range }, select: { type: true, amount: true, date: true } }),
      prisma.tuitionPayment.groupBy({ by: ['month'], where: { year, status: 'PAID' }, _sum: { totalAmount: true } }),
      prisma.freeStudentPayment.findMany({ where: { paidAt: range }, select: { amount: true, paidAt: true } }),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1, income: 0, expense: 0, profit: 0, appTuition: 0, appFreeStudent: 0,
    }));
    for (const t of txs) {
      const row = months[vnParts(t.date).month - 1];
      if (t.type === 'INCOME') row.income += t.amount; else row.expense += t.amount;
    }
    for (const t of tuition) months[t.month - 1].appTuition = t._sum.totalAmount || 0;
    for (const p of freePayments) months[vnParts(p.paidAt).month - 1].appFreeStudent += p.amount;
    months.forEach((m) => { m.profit = m.income - m.expense; });

    const total = months.reduce((acc, m) => ({
      income: acc.income + m.income, expense: acc.expense + m.expense, profit: acc.profit + m.profit,
      appTuition: acc.appTuition + m.appTuition, appFreeStudent: acc.appFreeStudent + m.appFreeStudent,
    }), { income: 0, expense: 0, profit: 0, appTuition: 0, appFreeStudent: 0 });

    res.json({ year, months, total });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/finance/transactions', async (req, res) => {
  try {
    const ym = parseYearMonth(req.query);
    if (!ym || ym.month === null) return res.status(400).json({ error: 'Tháng/năm không hợp lệ' });
    const transactions = await prisma.adminTransaction.findMany({
      where: { date: vnMonthRange(ym.year, ym.month) },
      select: TX_SELECT,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    res.json({ transactions });
  } catch (err) {
    sendError(res, err);
  }
});

// Danh mục đã dùng (gợi ý khi nhập), kèm số lần dùng để xếp hay dùng lên trước
router.get('/finance/categories', async (req, res) => {
  try {
    const rows = await prisma.adminTransaction.groupBy({ by: ['type', 'category'], _count: { _all: true } });
    rows.sort((a, b) => b._count._all - a._count._all);
    res.json({
      INCOME: rows.filter((r) => r.type === 'INCOME').map((r) => r.category),
      EXPENSE: rows.filter((r) => r.type === 'EXPENSE').map((r) => r.category),
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post('/finance/transactions', async (req, res) => {
  try {
    const data = parseTransaction(req.body);
    const transaction = await prisma.adminTransaction.create({
      data: { ...data, createdByEmail: req.admin.email }, select: TX_SELECT,
    });
    res.status(201).json({ transaction });
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/finance/transactions/:id', async (req, res) => {
  try {
    const data = parseTransaction(req.body);
    const { count } = await prisma.adminTransaction.updateMany({ where: { id: req.params.id }, data });
    if (!count) return res.status(404).json({ error: 'Không tìm thấy khoản này' });
    const transaction = await prisma.adminTransaction.findUnique({ where: { id: req.params.id }, select: TX_SELECT });
    res.json({ transaction });
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/finance/transactions/:id', async (req, res) => {
  try {
    const { count } = await prisma.adminTransaction.deleteMany({ where: { id: req.params.id } });
    if (!count) return res.status(404).json({ error: 'Không tìm thấy khoản này' });
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

// Chép các khoản "cố định hàng tháng" của tháng trước sang tháng { year, month }, giữ nguyên ngày trong tháng
// (ngày 31 sang tháng ngắn hơn thì lùi về ngày cuối tháng). Khoản đã có ở tháng đích (cùng loại, danh mục,
// số tiền, ghi chú) thì bỏ qua — bấm nhiều lần không tạo trùng.
router.post('/finance/copy-recurring', async (req, res) => {
  try {
    const ym = parseYearMonth(req.body || {});
    if (!ym || ym.month === null) return res.status(400).json({ error: 'Tháng/năm không hợp lệ' });
    const { year, month } = ym;
    const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };

    const [source, existing] = await Promise.all([
      prisma.adminTransaction.findMany({ where: { recurring: true, date: vnMonthRange(prev.year, prev.month) } }),
      prisma.adminTransaction.findMany({
        where: { date: vnMonthRange(year, month) }, select: { type: true, category: true, amount: true, note: true },
      }),
    ]);
    const keyOf = (t) => `${t.type}|${t.category}|${t.amount}|${t.note || ''}`;
    const seen = new Set(existing.map(keyOf));
    const toCreate = source.filter((t) => !seen.has(keyOf(t))).map((t) => ({
      type: t.type, category: t.category, amount: t.amount, note: t.note, recurring: true,
      date: vnNoon(year, month, Math.min(vnParts(t.date).day, daysInMonth(year, month))),
      createdByEmail: req.admin.email,
    }));
    if (toCreate.length) await prisma.adminTransaction.createMany({ data: toCreate });
    res.json({ created: toCreate.length, skipped: source.length - toCreate.length, from: prev });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Người dùng =====

router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true, name: true, email: true, phone: true, role: true, createdAt: true, lastActive: true, totalXP: true,
        accessExpiresAt: true,
        managerTeacher: { select: { name: true } },
        _count: { select: { classroomsJoined: true, classroomsOwned: true, freeStudentPaymentsMade: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      users: users.map(({ _count, managerTeacher, ...u }) => ({
        ...u,
        classroomsJoined: _count.classroomsJoined,
        classroomsOwned: _count.classroomsOwned,
        managerTeacherName: managerTeacher?.name || null,
        freeStatus: u.role === 'STUDENT' && _count.classroomsJoined === 0 ? freeStudentStatus({ ...u, _count }) : null,
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Giáo viên không tự đăng ký được (xem /auth) -> admin tạo tài khoản, mật khẩu mặc định, giáo viên tự đổi sau
router.post('/users/teacher', async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim() || null;
    if (!name) return res.status(400).json({ error: 'Vui lòng nhập họ tên' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Email không hợp lệ' });

    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (exists) return res.status(409).json({ error: 'Email này đã có tài khoản' });

    const user = await prisma.user.create({
      data: { name, email, phone, role: 'TEACHER', password: await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS) },
      select: { id: true, name: true, email: true },
    });
    res.status(201).json({ user, defaultPassword: DEFAULT_PASSWORD });
  } catch (err) {
    sendError(res, err);
  }
});

// Chỉ áp dụng cho tài khoản học viên/giáo viên — mật khẩu admin chỉ đổi bằng chính admin đó hoặc script createAdmin.js
// (để 1 admin không chiếm được tài khoản admin khác)
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { count } = await prisma.user.updateMany({
      where: { id: req.params.id, role: { in: ['STUDENT', 'TEACHER'] } },
      data: { password: await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS) },
    });
    if (!count) return res.status(404).json({ error: 'Không tìm thấy tài khoản học viên/giáo viên này' });
    res.json({ defaultPassword: DEFAULT_PASSWORD });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
