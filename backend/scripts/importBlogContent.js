// Nhập bài blog từ backend/content/blog/posts/ vào CSDL (cùng logic với lúc server khởi động — xem src/utils/blogContentSync.js).
//
//   cd backend
//   node scripts/importBlogContent.js --dry-run     # chỉ liệt kê bài SẼ được tạo, không ghi gì
//   node scripts/importBlogContent.js               # tạo các bài chưa có (bài đã có không bị đụng tới)
require('dotenv').config();
const { syncBlogContent } = require('../src/utils/blogContentSync');
const prisma = require('../src/lib/prisma');

syncBlogContent({ dryRun: process.argv.includes('--dry-run') })
  .then((r) => { console.log(JSON.stringify(r, null, 2)); })
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
