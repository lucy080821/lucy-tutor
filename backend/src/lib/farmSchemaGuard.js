// Cột thêm vào FarmState sau bản đầu (kho nông sản, trang phục, độ khó đơn) được tự thêm lúc khởi động
// bằng ADD COLUMN IF NOT EXISTS — vì deploy frontend/backend (Hostinger) không chạy `prisma db push`,
// và Prisma SELECT mọi cột nên thiếu 1 cột là toàn bộ /farm lỗi. Chỉ thêm cột (an toàn, idempotent),
// không bao giờ xoá/sửa. Thay đổi lớn hơn vẫn phải `prisma db push`/SQL thủ công.
const prisma = require('./prisma');

const COLUMNS = [
  `"ordersDone" INTEGER NOT NULL DEFAULT 0`,
  `"inventory" TEXT NOT NULL DEFAULT '{}'`,
  `"barnCapacity" INTEGER NOT NULL DEFAULT 30`,
  `"barnQuizOn" TEXT`,
  `"barnQuizCount" INTEGER NOT NULL DEFAULT 0`,
  `"wardrobe" TEXT NOT NULL DEFAULT '{}'`,
  `"stats" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `"daily" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `"achievements" JSONB NOT NULL DEFAULT '{}'::jsonb`,
  `"petTrip" JSONB`,
];

async function ensureFarmColumns() {
  try {
    const exists = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."FarmState"')::text AS t`);
    if (!exists?.[0]?.t) return; // chưa có bảng FarmState (chưa chạy SQL tạo bảng) — bỏ qua
    for (const col of COLUMNS) await prisma.$executeRawUnsafe(`ALTER TABLE "FarmState" ADD COLUMN IF NOT EXISTS ${col}`);
    console.log('[farm] schema guard: cột FarmState đầy đủ');
  } catch (e) {
    console.error('[farm] schema guard lỗi (không chặn server):', e.message || e);
  }
}

module.exports = { ensureFarmColumns };
