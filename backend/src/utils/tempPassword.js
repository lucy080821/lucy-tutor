const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

// Mật khẩu tạm khi giáo viên/admin đặt lại mật khẩu hoặc tạo tài khoản hộ.
// Email đăng nhập của học viên thường không phải hộp thư thật nên không gửi link qua email được —
// người cấp nhắn mật khẩu tạm cho chủ tài khoản (Zalo/điện thoại), lần đăng nhập kế tiếp bắt buộc đổi.
// Bản rõ được lưu ở User.tempPassword để người cấp xem lại nếu quên, và bị xoá ngay khi chủ tài khoản
// đổi mật khẩu (PUT /api/auth/change-password) — lúc đó nó cũng không còn dùng được nữa.

const BCRYPT_ROUNDS = 10;
// Bỏ các ký tự dễ nhầm khi đọc qua điện thoại: 0/o, 1/l/i
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

// Dạng "k7mp-2x9q": 8 ký tự ngẫu nhiên (~39 bit), dễ đọc/gõ trên điện thoại
function generateTempPassword() {
  const pick = () => ALPHABET[crypto.randomInt(ALPHABET.length)];
  const part = () => Array.from({ length: 4 }, pick).join('');
  return `${part()}-${part()}`;
}

// Các field cần ghi vào User khi cấp mật khẩu tạm (dùng cho cả create lẫn update)
async function tempPasswordData() {
  const tempPassword = generateTempPassword();
  return {
    tempPassword,
    data: {
      password: await bcrypt.hash(tempPassword, BCRYPT_ROUNDS),
      tempPassword,
      tempPasswordIssuedAt: new Date(),
      mustChangePassword: true,
    },
  };
}

// Đặt lại mật khẩu của 1 tài khoản đã có + đóng các yêu cầu "Quên mật khẩu" đang chờ của tài khoản đó
async function issueTempPassword(userId, resolvedById) {
  const { tempPassword, data } = await tempPasswordData();
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data, select: { id: true } }),
    prisma.passwordResetRequest.updateMany({
      where: { userId, status: 'PENDING' },
      data: { status: 'DONE', resolvedAt: new Date(), resolvedById: resolvedById || null },
    }),
  ]);
  return tempPassword;
}

// Field xoá khi chủ tài khoản tự đặt mật khẩu mới
const CLEAR_TEMP_PASSWORD = { mustChangePassword: false, tempPassword: null, tempPasswordIssuedAt: null };

module.exports = { generateTempPassword, tempPasswordData, issueTempPassword, CLEAR_TEMP_PASSWORD };
