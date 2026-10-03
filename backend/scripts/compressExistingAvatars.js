// Nén lại các avatar cũ quá lớn đã lưu trong DB (upload trước khi có bước nén ở frontend/backend).
// Chạy: node scripts/compressExistingAvatars.js
//
// - Idempotent: chỉ xử lý avatar > 60KB, chạy lại không ảnh hưởng ảnh đã nén.
// - Sao lưu ảnh gốc ra backend/backups/avatars-<thời gian>.json TRƯỚC khi ghi đè (thư mục này
//   đã nằm trong .gitignore — chứa ảnh cá nhân của người dùng, không được commit).
// - Đọc từng user một: avatar lớn có thể vài chục MB, không kéo tất cả về cùng lúc.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const { compressAvatarDataUrl } = require('../src/utils/avatarCompress');

const THRESHOLD_BYTES = 60 * 1024;

(async () => {
  // Chỉ lấy id + kích thước, không kéo nội dung ảnh về
  const rows = await prisma.$queryRaw`
    SELECT id, length(avatar) AS len FROM "User"
    WHERE avatar IS NOT NULL AND length(avatar) > ${THRESHOLD_BYTES}
    ORDER BY len DESC`;
  if (rows.length === 0) { console.log('Không có avatar nào cần nén.'); return; }
  console.log(`Có ${rows.length} avatar cần nén.`);

  const backupDir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, `avatars-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  const backup = [];

  let before = 0, after = 0;
  for (const { id } of rows) {
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, avatar: true } });
    backup.push({ id: user.id, avatar: user.avatar });
    // Ghi file sao lưu sau MỖI ảnh — lỡ script dừng giữa chừng vẫn còn bản gốc của các ảnh đã xử lý
    fs.writeFileSync(backupFile, JSON.stringify(backup));
    try {
      const compressed = await compressAvatarDataUrl(user.avatar);
      await prisma.user.update({ where: { id }, data: { avatar: compressed }, select: { id: true } });
      before += user.avatar.length; after += compressed.length;
      console.log(`  ${user.name}: ${Math.round(user.avatar.length / 1024)}KB -> ${Math.round(compressed.length / 1024)}KB`);
    } catch (err) {
      console.log(`  ${user.name}: BỎ QUA (${err.message}) — giữ nguyên ảnh cũ`);
    }
  }
  console.log(`Tổng: ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB. Bản gốc: ${backupFile}`);
})()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
