#!/usr/bin/env node
// Kiểm tra chuẩn SEO + quy tắc nội dung cho mọi bài trong backend/content/blog/posts/ (hoặc các slug chỉ định).
//   node backend/content/blog/tools/validate.js [slug...]
// Thoát mã 1 nếu có lỗi (✗). Cảnh báo (!) không chặn nhưng nên xem lại.
const fs = require('fs');
const path = require('path');
const { slugify } = require('../../../src/utils/slugify');

const ROOT = path.resolve(__dirname, '..');
const POSTS = path.join(ROOT, 'posts');
const IMG = path.resolve(ROOT, '../../../frontend/public/images/blog');
const existing = JSON.parse(fs.readFileSync(path.join(ROOT, 'existing-posts.json'), 'utf8')).posts;
const TOOL_PATHS = ['/gym', '/grammar-gym', '/listening', '/conversation', '/pronunciation', '/reading', '/writing', '/mock-test', '/ielts', '/phonetics',
  '/cach-phat-am-ed-s-es', '/bang-dong-tu-bat-quy-tac', '/ielts-band-calculator', '/kiem-tra-trinh-do-tieng-anh', '/cham-writing-mien-phi',
  '/flashcard-tieng-anh', '/game-hoc-tieng-anh', '/game-nong-trai-hoc-tieng-anh', '/farm', '/games/lop-3', '/blog', '/auth'];

const text = (html) => html.replace(/<!--.*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const lc = (s) => s.toLocaleLowerCase('vi');
const count = (hay, needle) => (lc(hay).match(new RegExp(lc(needle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
function pngSize(file) { const b = fs.readFileSync(file); return b.toString('ascii', 1, 4) === 'PNG' ? { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } : null; }

const all = fs.readdirSync(POSTS).filter((d) => fs.existsSync(path.join(POSTS, d, 'post.json')));
const wanted = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const slugs = wanted.length ? wanted : all;
const loaded = Object.fromEntries(all.map((d) => [d, JSON.parse(fs.readFileSync(path.join(POSTS, d, 'post.json'), 'utf8'))]));
const knownSlugs = new Set([...existing.map((p) => p.slug), ...Object.values(loaded).map((p) => p.slug)]);

let errors = 0, warns = 0;
for (const dir of slugs) {
  const p = loaded[dir]; const out = [];
  const bad = (m) => { out.push(`  ✗ ${m}`); errors++; };
  const warn = (m) => { out.push(`  ! ${m}`); warns++; };
  const ok = (m) => out.push(`  ✓ ${m}`);
  if (!p) { console.log(`${dir}: không có post.json`); errors++; continue; }
  const html = fs.readFileSync(path.join(POSTS, dir, 'content.html'), 'utf8');
  const body = text(html); const words = body.split(' ').length;
  const f = p.focusKeyword; const fs_ = slugify(f);

  console.log(`\n■ ${p.slug}  —  ${f}`);
  if (p.slug !== dir) bad(`slug "${p.slug}" khác tên thư mục "${dir}"`);
  if (!p.slug.includes(fs_)) bad(`slug phải chứa từ khoá chính (${fs_})`); else ok('slug chứa từ khoá chính');
  // tiêu đề / meta
  if (!lc(p.title).includes(lc(f))) bad('tiêu đề chưa chứa từ khoá chính'); else if (lc(p.title).indexOf(lc(f)) > 25) warn('từ khoá chính nên đứng đầu tiêu đề'); else ok('tiêu đề chứa từ khoá chính');
  if (p.title.length < 40 || p.title.length > 80) warn(`tiêu đề ${p.title.length} ký tự (nên 40–80)`);
  if (!p.metaTitle || p.metaTitle.length > 58) bad(`metaTitle phải ≤58 ký tự (đang ${p.metaTitle?.length})`); else if (!lc(p.metaTitle).includes(lc(f))) bad('metaTitle chưa chứa từ khoá chính'); else ok(`metaTitle ${p.metaTitle.length} ký tự`);
  const md = p.metaDescription || '';
  if (md.length < 110 || md.length > 160) bad(`metaDescription phải 110–160 ký tự (đang ${md.length})`); else if (!lc(md).includes(lc(f))) bad('metaDescription chưa chứa từ khoá chính'); else ok(`metaDescription ${md.length} ký tự`);
  if (!p.excerpt || p.excerpt.length < 80 || p.excerpt.length > 220) warn(`excerpt nên 80–220 ký tự (đang ${p.excerpt?.length})`);
  // nội dung
  if (words < 1500) bad(`bài mới ${words} từ (cần ≥1500)`); else ok(`${words} từ`);
  const first = body.split(' ').slice(0, 120).join(' ');
  if (!lc(first).includes(lc(f))) bad('120 từ đầu chưa có từ khoá chính'); else ok('từ khoá chính nằm trong 120 từ đầu');
  if (!new RegExp(`<strong>[^<]*${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(html)) warn('nên in đậm từ khoá chính ở đoạn mở đầu');
  const occ = count(body, f); const dens = occ / words * 100; // mật độ chuẩn = số lần xuất hiện / tổng số từ
  if (occ < 6 || dens > 2.5) warn(`từ khoá chính xuất hiện ${occ} lần (${dens.toFixed(2)}%) — nên 6+ lần và <2,5%`); else ok(`từ khoá chính ${occ} lần (${dens.toFixed(2)}%)`);
  const h2 = [...html.matchAll(/<h2[^>]*>(.*?)<\/h2>/gs)].map((m) => text(m[1]));
  const h3 = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/gs)].map((m) => text(m[1]));
  if (/<h1/i.test(html)) bad('không dùng <h1> trong thân bài (tiêu đề bài đã là H1)');
  if (h2.length < 5) bad(`cần ≥5 H2 (đang ${h2.length})`); else ok(`${h2.length} H2, ${h3.length} H3`);
  const kws = [f, ...(p.secondaryKeywords || [])].map(lc);
  if (!h2.some((h) => kws.some((k) => lc(h).includes(k.split(' ').slice(0, 3).join(' '))))) warn('chưa có H2 nào chứa từ khoá chính/phụ');
  if (!h2.some((h) => /câu hỏi thường gặp|faq/i.test(h))) bad('thiếu mục "Câu hỏi thường gặp" (H2)'); else if (h3.length < 3) warn('mục FAQ nên có ≥3 câu hỏi (H3)');
  const sec = (p.secondaryKeywords || []).filter((k) => lc(body).includes(lc(k)));
  if (sec.length < Math.min(3, (p.secondaryKeywords || []).length)) warn(`chỉ ${sec.length} từ khoá phụ xuất hiện trong bài (nên ≥3)`); else ok(`${sec.length}/${p.secondaryKeywords.length} từ khoá phụ có trong bài`);
  // placeholder ảnh + liên kết
  if ((html.match(/<!--INFOGRAPHIC-->/g) || []).length !== 1) bad('cần đúng 1 chỗ <!--INFOGRAPHIC--> trong content.html'); else ok('có chỗ chèn infographic');
  const links = [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const internal = links.filter((l) => l.startsWith('/'));
  if (links.some((l) => /^https?:/i.test(l))) warn('có link ngoài — chỉ giữ nếu thật sự cần và đã kiểm tra còn sống');
  if (internal.length < 3) bad(`cần ≥3 link nội bộ (đang ${internal.length})`); else ok(`${internal.length} link nội bộ`);
  for (const l of internal) {
    const pathOnly = l.split('#')[0];
    const okLink = TOOL_PATHS.includes(pathOnly) || (pathOnly.startsWith('/blog/') && knownSlugs.has(pathOnly.slice(6)));
    if (!okLink) bad(`link nội bộ không tồn tại: ${l}`);
  }
  if (!/<blockquote><strong>[\s\S]*<a href="\/[^"]+">/.test(html.slice(-1500))) warn('cuối bài nên có khối CTA (blockquote) dẫn tới công cụ Lucy Tutor');
  // ảnh
  for (const [key, [w, h]] of Object.entries({ cover: [1200, 630], infographic: [1080, 1350] })) {
    const im = p.images?.[key]; if (!im) { bad(`thiếu images.${key}`); continue; }
    if (!im.file.includes(fs_)) bad(`tên file ${key} phải chứa từ khoá chính (${fs_})`);
    if (!lc(im.alt).includes(lc(f)) && !(p.secondaryKeywords || []).some((k) => lc(im.alt).includes(lc(k)))) bad(`alt ảnh ${key} phải chứa từ khoá`);
    const file = path.join(IMG, p.slug, im.file);
    if (!fs.existsSync(file)) { bad(`chưa có file ảnh ${im.file} (chạy render-images.js)`); continue; }
    const sz = pngSize(file); if (!sz || sz.w !== w || sz.h !== h) bad(`${im.file} phải là PNG ${w}×${h} (đang ${sz ? `${sz.w}×${sz.h}` : 'không phải PNG'})`); else ok(`ảnh ${key}: ${im.file} (${Math.round(fs.statSync(file).size / 1024)} KB)`);
  }
  if (p.images?.cover?.alt === p.images?.infographic?.alt) warn('alt của thumbnail và infographic nên khác nhau');
  // tags, lịch, trùng lặp
  const tags = p.tags || [];
  if (tags.length < 6 || tags.length > 10) warn(`nên 6–10 thẻ (đang ${tags.length})`);
  if (!tags.some((t) => lc(t) === lc(f))) bad('thẻ phải gồm từ khoá chính');
  const d = new Date(p.publishAt); const vn = new Date(d.getTime() + 7 * 3600e3);
  if (isNaN(d)) bad('publishAt không hợp lệ'); else {
    if (vn.getUTCDay() === 0 || vn.getUTCDay() === 6) bad('publishAt phải rơi vào thứ 2–thứ 6');
    if (vn.getUTCHours() !== 5 || vn.getUTCMinutes() !== 0) bad('publishAt phải đúng 05:00 giờ VN (+07:00)'); else ok(`đăng ${vn.toISOString().slice(0, 10)} lúc 05:00 (thứ ${vn.getUTCDay() + 1})`);
    const clash = Object.entries(loaded).find(([k, o]) => k !== dir && new Date(o.publishAt).getTime() === d.getTime());
    if (clash) bad(`trùng giờ đăng với bài ${clash[0]}`);
  }
  for (const r of p.related || []) if (!knownSlugs.has(r)) bad(`bài liên quan không tồn tại: ${r}`);
  const dupKw = [...existing.map((e) => [e.slug, e.tags?.[0]]), ...Object.entries(loaded).filter(([k]) => k !== dir).map(([k, o]) => [k, o.focusKeyword])].find(([, k]) => k && lc(k) === lc(f));
  if (dupKw) bad(`trùng từ khoá chính với bài ${dupKw[0]}`);
  if (existing.some((e) => e.slug === p.slug)) bad('slug trùng bài đã có trên blog');
  console.log(out.join('\n'));
}
console.log(`\n${errors ? '✗' : '✓'} ${slugs.length} bài — ${errors} lỗi, ${warns} cảnh báo`);
process.exit(errors ? 1 : 0);
