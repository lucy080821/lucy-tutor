// Chia lại đoạn cho các bài đọc IELTS Reading đã trích xuất trước khi có bước khôi phục đoạn văn
// (AI trả cả bài thành 1 khối liền). Không gọi AI — đọc dấu hiệu ngắt đoạn từ text trang PDF đã lưu
// (xem src/utils/ieltsParagraphs.js).
// Chạy: node scripts/restoreIeltsParagraphs.js          (xem trước, không ghi)
//       node scripts/restoreIeltsParagraphs.js --write  (ghi vào DB)
//
// Idempotent: bài đã có dòng trống giữa các đoạn (đã chia hoặc giáo viên sửa tay) được bỏ qua.
require('dotenv').config();
const prisma = require('../src/lib/prisma');
const { restoreParagraphs } = require('../src/utils/ieltsParagraphs');
const { getSkillPageRange } = require('../src/utils/ieltsExtraction');

const WRITE = process.argv.includes('--write');

(async () => {
  const passages = await prisma.ieltsReadingPassage.findMany({
    select: { id: true, sectionNumber: true, passageIndex: true, bodyText: true, test: { select: { testNumber: true, bookId: true } } }
  });
  const books = {};
  let changed = 0;
  for (const p of passages) {
    if (!books[p.test.bookId]) {
      const b = await prisma.ieltsBook.findUnique({ where: { id: p.test.bookId }, select: { title: true, pagesJson: true, boundariesJson: true } });
      books[p.test.bookId] = { title: b.title, pages: JSON.parse(b.pagesJson || '[]'), boundaries: JSON.parse(b.boundariesJson || '{}') };
    }
    const { title, pages, boundaries } = books[p.test.bookId];
    const range = boundaries.tests ? getSkillPageRange(boundaries, p.test.testNumber, 'readingStartPage', pages) : null;
    const label = `${title} · Test ${p.test.testNumber} · Passage ${p.sectionNumber}${p.passageIndex > 1 ? '.' + p.passageIndex : ''}`;
    if (!range) { console.log(`- ${label}: bỏ qua (không có phạm vi trang Reading)`); continue; }

    const span = pages.filter((pg) => pg.num >= range.startPage && pg.num <= range.endPage);
    const next = restoreParagraphs(p.bodyText, span);
    if (next === p.bodyText) { console.log(`- ${label}: giữ nguyên`); continue; }
    changed++;
    console.log(`- ${label}: ${next.split(/\n\s*\n/).length} đoạn`);
    if (WRITE) await prisma.ieltsReadingPassage.update({ where: { id: p.id }, data: { bodyText: next } });
  }
  console.log(WRITE ? `Đã cập nhật ${changed} bài đọc.` : `${changed} bài đọc sẽ được chia đoạn — chạy lại với --write để ghi.`);
  await prisma.$disconnect();
})().catch(async (err) => { console.error(err); await prisma.$disconnect(); process.exit(1); });
