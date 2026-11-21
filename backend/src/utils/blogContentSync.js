// Nhập bài blog từ thư mục backend/content/blog/posts/<slug>/ (post.json + content.html) vào CSDL — KHÔNG cần đăng nhập/gọi API.
// Chạy tự động sau khi server khởi động (mỗi lần deploy), cũng chạy tay được: `node scripts/importBlogContent.js [--dry-run]`.
//
// Nguyên tắc an toàn:
//  - CHỈ TẠO bài chưa có (so theo slug). Bài đã có — kể cả đã sửa trong trình soạn /teacher/blog — KHÔNG bao giờ bị ghi đè.
//  - Bài vào với status PUBLISHED + publishedAt = giờ hẹn (post.json `publishAt`, vd 05:00 giờ VN). Trang công khai chỉ hiện bài khi
//    publishedAt <= bây giờ (xem publicWhere ở blog.routes.js) nên "hẹn giờ đăng" không cần cron.
//  - Không thấy tác giả (authorSlug) hoặc lỗi 1 bài → ghi log và bỏ qua, không làm hỏng server.
//  - Tắt hẳn bằng biến môi trường BLOG_CONTENT_SYNC=off. Bài có `"draft": true` trong post.json bị bỏ qua.
const fs = require('fs');
const path = require('path');
const prisma = require('../lib/prisma');
const { slugify } = require('./slugify');

const POSTS_DIR = path.resolve(__dirname, '../../content/blog/posts');
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function loadPosts(dir = POSTS_DIR) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const jsonPath = path.join(dir, name, 'post.json');
    const htmlPath = path.join(dir, name, 'content.html');
    if (!fs.existsSync(jsonPath) || !fs.existsSync(htmlPath)) continue;
    try { out.push({ dir: name, post: JSON.parse(fs.readFileSync(jsonPath, 'utf8')), html: fs.readFileSync(htmlPath, 'utf8') }); }
    catch (e) { console.error(`[blog-sync] ${name}: không đọc được (${e.message})`); }
  }
  return out.sort((a, b) => String(a.post.publishAt).localeCompare(String(b.post.publishAt)));
}

/** Ghép HTML bài: chèn infographic vào chỗ đánh dấu <!--INFOGRAPHIC--> */
function buildContent(post, html) {
  const info = post.images?.infographic;
  const tag = info ? `<p><img src="/images/blog/${post.slug}/${info.file}" alt="${esc(info.alt)}" width="1080" height="1350" loading="lazy" /></p>` : '';
  return html.includes('<!--INFOGRAPHIC-->') ? html.replace('<!--INFOGRAPHIC-->', tag) : html;
}

async function syncBlogContent({ dryRun = false, log = console.log } = {}) {
  if (process.env.BLOG_CONTENT_SYNC === 'off') return { skipped: 'off' };
  const { SANITIZE_OPTIONS, estimateReadingMinutes } = require('../routes/blog.routes'); // lấy lại đúng bộ lọc HTML + cách tính thời gian đọc của trình soạn bài
  const sanitizeHtml = require('sanitize-html');
  const items = loadPosts().filter((x) => !x.post.draft);
  const result = { created: [], existing: [], failed: [] };
  if (!items.length) return result;

  const authors = new Map();
  const authorOf = async (slug) => {
    if (!authors.has(slug)) authors.set(slug, await prisma.user.findFirst({ where: { authorSlug: slug, role: 'TEACHER' }, select: { id: true } }));
    return authors.get(slug);
  };

  for (const { post, html } of items) {
    try {
      const slug = slugify(post.slug);
      if (!slug) throw new Error('slug không hợp lệ');
      if (await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) { result.existing.push(slug); continue; }
      const publishedAt = new Date(post.publishAt);
      if (isNaN(publishedAt.getTime())) throw new Error(`publishAt không hợp lệ: ${post.publishAt}`);
      const author = await authorOf(post.author || 'leo-harrison');
      if (!author) throw new Error(`không tìm thấy tác giả "${post.author}" (tài khoản giáo viên có authorSlug này)`);

      let categoryId = null;
      if (post.category?.slug) {
        let cat = await prisma.blogCategory.findUnique({ where: { slug: post.category.slug } });
        if (!cat && !dryRun) cat = await prisma.blogCategory.create({ data: { name: post.category.name || post.category.slug, slug: post.category.slug } });
        categoryId = cat?.id || null;
      }
      const relatedSlugs = (post.related || []).slice(0, 6);
      const related = relatedSlugs.length ? await prisma.blogPost.findMany({ where: { slug: { in: relatedSlugs } }, select: { id: true, slug: true } }) : [];
      const relatedPostIds = relatedSlugs.map((s) => related.find((r) => r.slug === s)?.id).filter(Boolean);

      const content = sanitizeHtml(buildContent({ ...post, slug }, html), SANITIZE_OPTIONS);
      const cover = post.images?.cover?.file ? `/images/blog/${slug}/${post.images.cover.file}` : null;
      const data = {
        title: post.title, slug, excerpt: post.excerpt || null, content, coverImage: cover,
        status: 'PUBLISHED', publishedAt, metaTitle: post.metaTitle || null, metaDescription: post.metaDescription || null,
        tags: [...new Set((post.tags || []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 10),
        readingMinutes: estimateReadingMinutes(content), featured: false, authorId: author.id, categoryId, relatedPostIds,
      };
      if (!dryRun) await prisma.blogPost.create({ data });
      result.created.push(slug);
      log(`[blog-sync] ${dryRun ? '(thử) ' : ''}tạo bài "${slug}" — đăng lúc ${publishedAt.toISOString()}`);
    } catch (e) {
      result.failed.push({ slug: post.slug, error: e.message });
      console.error(`[blog-sync] ${post.slug}: ${e.message}`);
    }
  }
  return result;
}

module.exports = { syncBlogContent, loadPosts, buildContent, POSTS_DIR };
