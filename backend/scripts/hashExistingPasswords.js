// One-time migration: hash any User.password still stored as plaintext.
// Safe to re-run — bcrypt hashes always start with "$2", so already-hashed rows are skipped.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 10;

(async () => {
  const users = await prisma.user.findMany({ where: { password: { not: null } } });
  let migrated = 0;
  for (const user of users) {
    if (user.password && !user.password.startsWith('$2')) {
      const hashed = await bcrypt.hash(user.password, BCRYPT_ROUNDS);
      await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
      migrated++;
    }
  }
  console.log(`Đã hash ${migrated}/${users.length} tài khoản (số còn lại đã được hash từ trước).`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
