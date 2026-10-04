// Tạo tài khoản QUẢN TRỊ (role ADMIN) cho trang /administrator — cách duy nhất để có tài khoản admin.
//
//   cd backend
//   node scripts/createAdmin.js --email admin@lucytutor.online --name "Quản trị viên"
//
// Mật khẩu được hỏi trong terminal (gõ ẩn, không lưu vào lịch sử lệnh), tối thiểu 8 ký tự.
// 3 loại tài khoản tách biệt: email đã là tài khoản học viên/giáo viên thì KHÔNG chuyển thành admin được —
// phải dùng 1 email khác. Chạy lại với email của 1 admin đã có = đặt lại mật khẩu cho admin đó.
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const prisma = require('../src/lib/prisma');

const BCRYPT_ROUNDS = 10;

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

// Hỏi mật khẩu, thay ký tự gõ bằng dấu *
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = (s) => { rl.output.write(muted ? (s.includes('\n') ? '\n' : '*') : s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
    muted = true;
  });
}

(async () => {
  const email = String(arg('email') || '').trim().toLowerCase();
  const name = String(arg('name') || 'Quản trị viên').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('Thiếu hoặc sai email. Dùng: node scripts/createAdmin.js --email <email> [--name "Tên"]');
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, role: true },
  });
  if (existing && existing.role !== 'ADMIN') {
    const label = existing.role === 'TEACHER' ? 'giáo viên' : 'học viên';
    console.error(`Email này đang là tài khoản ${label}. Tài khoản admin phải tách riêng — hãy dùng 1 email khác.`);
    process.exit(1);
  }

  const password = await askHidden(existing ? 'Mật khẩu MỚI cho admin này: ' : 'Mật khẩu admin: ');
  if (password.length < 8) { console.error('Mật khẩu phải có ít nhất 8 ký tự.'); process.exit(1); }
  const again = await askHidden('Nhập lại mật khẩu: ');
  if (again !== password) { console.error('Hai lần nhập không khớp.'); process.exit(1); }

  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { password: hash } });
    console.log(`Đã đặt lại mật khẩu cho admin ${email}.`);
  } else {
    await prisma.user.create({ data: { email, name, role: 'ADMIN', password: hash } });
    console.log(`Đã tạo tài khoản admin ${email}. Đăng nhập tại /administrator.`);
  }
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error('Lỗi:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
