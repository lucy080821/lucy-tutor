const express = require('express');
const multer = require('multer');
const path = require('path');
const sanitizeHtml = require('sanitize-html');
const { createClient } = require('@supabase/supabase-js');

const prisma = require('../lib/prisma');
const { slugify } = require('../utils/slugify');
const { Groq } = require('groq-sdk');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');
const tts = require('../utils/elevenlabsTts');

const router = express.Router();

const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!IMAGE_EXTS.includes(path.extname(file.originalname).toLowerCase())) {
      return cb(new Error('Chỉ cho phép ảnh .jpg, .jpeg, .png, .webp, .gif (tối đa 5MB)'));
    }
    cb(null, true);
  },
});

// HTML từ ReactQuill được render thẳng ở trang công khai /blog/[slug] (server component, không có
// DOMPurify phía server) nên phải lọc ngay lúc lưu. Ảnh chỉ nhận http(s) — không nhận data: base64
// (editor đã upload ảnh lên Storage và chèn URL, tránh 1 bài viết phình lên hàng MB).
const SANITIZE_OPTIONS = {
  allowedTags: [
    'p', 'br', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
    'blockquote', 'pre', 'code', 'img', 'span', 'div', 'sub', 'sup', 'hr', 'iframe',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: ['src', 'frameborder', 'allowfullscreen', 'allow'],
    span: ['style', 'class'],
    p: ['style', 'class'],
    li: ['data-list', 'class'],
    pre: ['spellcheck', 'class'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i],
    },
  },
  allowedClasses: { '*': [/^ql-/] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  // Chặn link dạng //domain-khac.com (thiếu giao thức) — ảnh/link nội bộ dùng đường dẫn bắt đầu bằng 1 dấu /
  allowProtocolRelative: false,
  allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'],
  // Ảnh/iframe bị gỡ src (base64, domain lạ) thì bỏ luôn thẻ rỗng
  exclusiveFilter: (frame) => (frame.tag === 'img' || frame.tag === 'iframe') && !frame.attribs.src,
  transformTags: {
    a: (tagName, attribs) => {
      const isExternal = /^https?:\/\//i.test(attribs.href || '');
      return {
        tagName,
        attribs: isExternal ? { ...attribs, target: '_blank', rel: 'noopener noreferrer' } : attribs,
      };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
};

const htmlToText = (html) => sanitizeHtml(html || '', { allowedTags: [], allowedAttributes: {} })
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// ~200 từ/phút — tốc độ đọc trung bình cho bài viết tiếng Việt xen tiếng Anh.
const estimateReadingMinutes = (html) => {
  const words = htmlToText(html).split(' ').filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
};


// Bài hiển thị công khai: đã đăng và đến giờ đăng (publishedAt ở tương lai = hẹn giờ).
const publicWhere = () => ({ status: 'PUBLISHED', publishedAt: { lte: new Date() } });

const AUTHOR_SELECT = { id: true, name: true, authorSlug: true };
const LIST_SELECT = {
  id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true,
  readingMinutes: true, featured: true, tags: true, views: true, clicks: true,
  author: { select: AUTHOR_SELECT },
  category: { select: { id: true, name: true, slug: true } },
};

const BLOG_MAX_REVISIONS = 30;
const MAX_RELATED_POSTS = 6;
// Lưu tự động chỉ tạo bản lịch sử mới nếu bản gần nhất cũ hơn mốc này (tránh 1 bản / 30 giây)
const AUTOSAVE_REVISION_GAP_MS = 10 * 60 * 1000;

// ─── Phân quyền ─────────────────────────────────────────────────────────────
// BLOG_ADMIN_EMAILS = danh sách email (phân tách bằng dấu phẩy) được duyệt/đăng bài, sửa bài của người khác,
// xoá danh mục. Để trống = mọi giáo viên đều là admin blog (không ai bị khoá khi chưa cấu hình).
// Giáo viên thường: chỉ thấy/sửa/xoá bài của mình; bấm "Đăng" sẽ thành "Gửi duyệt" (status PENDING).
const BLOG_ADMIN_EMAILS = (process.env.BLOG_ADMIN_EMAILS || '')
  .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const isBlogAdmin = (user) => BLOG_ADMIN_EMAILS.length === 0 || BLOG_ADMIN_EMAILS.includes(String(user.email).toLowerCase());

// Không có token — cùng mô hình xác thực theo userId như các route khác của dự án.
async function requireTeacher(req, res, next) {
  try {
    const userId = req.body?.userId || req.query.userId;
    if (!userId) return res.status(401).json({ error: 'Thiếu userId' });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, email: true, name: true } });
    if (!user || user.role !== 'TEACHER') return res.status(403).json({ error: 'Chỉ giáo viên mới được quản lý blog' });
    req.teacher = { ...user, isAdmin: isBlogAdmin(user) };
    req.teacherId = user.id;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const requireBlogAdmin = (req, res, next) => (req.teacher.isAdmin
  ? next()
  : res.status(403).json({ error: 'Chỉ admin blog mới được thực hiện thao tác này' }));

const canEditPost = (teacher, post) => teacher.isAdmin || post.authorId === teacher.id;

// Gán slug hồ sơ tác giả lần đầu giáo viên đứng tên 1 bài (để có trang /blog/tac-gia/[slug])
async function ensureAuthorSlug(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, authorSlug: true } });
  if (!user || user.authorSlug) return;
  const base = slugify(user.name) || 'tac-gia';
  const taken = new Set((await prisma.user.findMany({
    where: { authorSlug: { startsWith: base } }, select: { authorSlug: true },
  })).map((u) => u.authorSlug));
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  await prisma.user.update({ where: { id: userId }, data: { authorSlug: slug } });
}

// ─── Công khai ──────────────────────────────────────────────────────────────

router.get('/posts', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(30, Math.max(1, parseInt(req.query.limit) || 9));
    const where = { ...publicWhere() };
    if (req.query.category) where.category = { slug: String(req.query.category) };
    if (req.query.author) where.author = { authorSlug: String(req.query.author) };
    if (req.query.tag) where.tags = { has: String(req.query.tag) };
    if (req.query.q) {
      const q = String(req.query.q).trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { excerpt: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where, select: LIST_SELECT,
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit, take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);
    res.json({ posts, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/posts/:slug', async (req, res) => {
  try {
    const post = await prisma.blogPost.findFirst({
      where: { ...publicWhere(), slug: req.params.slug },
      select: {
        ...LIST_SELECT, content: true, metaTitle: true, metaDescription: true, updatedAt: true, categoryId: true, relatedPostIds: true,
        author: { select: { ...AUTHOR_SELECT, authorTitle: true, authorBio: true, avatar: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    // Chỉ báo có/không có avatar — ảnh tải riêng qua /authors/:slug/avatar, không nhúng base64 vào bài
    const { avatar, ...author } = post.author;
    post.author = { ...author, hasAvatar: !!avatar };

    // Bài liên quan: bài tác giả tự chọn (đúng thứ tự đã xếp) trước, thiếu 3 bài thì bù bài mới cùng danh mục.
    // 2 truy vấn độc lập chạy song song; bài được chọn mà đã bị xoá / gỡ đăng / chưa tới giờ đăng thì tự bị lọc.
    const { relatedPostIds, categoryId, ...publicPost } = post;
    const [pinnedRows, auto] = await Promise.all([
      relatedPostIds.length
        ? prisma.blogPost.findMany({ where: { ...publicWhere(), id: { in: relatedPostIds } }, select: LIST_SELECT })
        : [],
      prisma.blogPost.findMany({
        where: { ...publicWhere(), id: { notIn: [post.id, ...relatedPostIds] }, ...(categoryId ? { categoryId } : {}) },
        select: LIST_SELECT,
        orderBy: { publishedAt: 'desc' },
        take: 3,
      }),
    ]);
    const byId = new Map(pinnedRows.map((p) => [p.id, p]));
    const pinned = relatedPostIds.map((id) => byId.get(id)).filter(Boolean);
    const related = [...pinned, ...auto].slice(0, Math.max(3, pinned.length));
    res.json({ post: publicPost, related });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lượt xem / lượt click đếm riêng từ client — trang bài viết được cache (ISR) nên không đếm được lúc render.
// - view: mở trang bài viết (mỗi tab đếm 1 lần/bài, xem BlogViewTracker)
// - click: bấm vào link dẫn tới bài từ thẻ bài viết (danh sách /blog, bài liên quan, dashboard học viên)
// Trả về số liệu mới nhất để trình duyệt cập nhật ngay, không chờ lượt làm mới định kỳ.
const STATS_SELECT = { slug: true, views: true, clicks: true };

const bumpCounter = (field) => async (req, res) => {
  try {
    const where = { ...publicWhere(), slug: req.params.slug };
    const { count } = await prisma.blogPost.updateMany({ where, data: { [field]: { increment: 1 } } });
    if (!count) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    const stats = await prisma.blogPost.findFirst({ where, select: STATS_SELECT });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
router.post('/posts/:slug/view', bumpCounter('views'));
router.post('/posts/:slug/click', bumpCounter('clicks'));

// Thời gian đọc + mức cuộn, gửi từ BlogReadTracker khi người đọc rời tab/trang (navigator.sendBeacon gửi
// text/plain để khỏi bị CORS preflight → tự parse JSON). Body: { seconds, first, scroll: [25|50|75|100] }
// - seconds: số giây đọc thực sự kể từ lần gửi trước · first: lần gửi đầu của lượt đọc này → +1 lượt đọc
// - scroll: các mốc vừa đạt được lần đầu trong lượt đọc. Chỉ cộng dồn, không lưu ai đọc.
const READ_SCROLL_FIELDS = { 25: 'scroll25', 50: 'scroll50', 75: 'scroll75', 100: 'scroll100' };
const MAX_READ_SECONDS = 30 * 60;
router.post('/posts/:slug/read', express.text({ type: '*/*', limit: '2kb' }), async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Dữ liệu không hợp lệ' }); }
    }
    const seconds = Math.min(MAX_READ_SECONDS, Math.max(0, Math.round(Number(body?.seconds) || 0)));
    const data = {};
    if (seconds) data.readSeconds = { increment: seconds };
    if (body?.first === true && seconds) data.readSessions = { increment: 1 };
    for (const m of Array.isArray(body?.scroll) ? body.scroll : []) {
      const field = READ_SCROLL_FIELDS[m];
      if (field) data[field] = { increment: 1 };
    }
    if (Object.keys(data).length) {
      await prisma.blogPost.updateMany({ where: { ...publicWhere(), slug: req.params.slug }, data });
    }
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// "Nghe bài viết" bằng giọng ElevenLabs: trình phát gửi lên từng đoạn (tiêu đề / tóm tắt / từng đoạn văn),
// trả về URL mp3. Mỗi đoạn tạo 1 lần rồi cache trong Storage (`blog-tts/<hash>.mp3`, hash theo giọng + nội
// dung) → người đọc sau không tốn ký tự; sửa 1 đoạn chỉ tạo lại đúng đoạn đó; chỉ đoạn nào có người nghe
// tới mới tốn ký tự. Chỉ nhận đoạn văn có thật trong bài đã đăng — không để API key bị dùng đọc chữ tuỳ ý.
const MAX_TTS_CHARS = 3000;
const ttsUrlCache = new Map(); // hash -> URL công khai (đã có file trong Storage)
const ttsInFlight = new Map(); // hash -> Promise<URL> (2 người cùng nghe 1 đoạn chưa có file → tạo 1 lần)
// Dự phòng khi Storage lỗi (vd bị khoá vì vượt egress — lỗi 402): giữ mp3 trong RAM và backend tự phát,
// để không phải gọi ElevenLabs (tốn ký tự) lại mỗi lần có người nghe. Giới hạn dung lượng, bỏ file cũ nhất.
const TTS_MEMORY_MAX_BYTES = 64 * 1024 * 1024;
const ttsMemory = new Map(); // hash -> Buffer (Map giữ thứ tự thêm vào → phần tử đầu là cũ nhất)
let ttsMemoryBytes = 0;
function rememberTtsAudio(hash, buf) {
  ttsMemory.set(hash, buf);
  ttsMemoryBytes += buf.length;
  for (const [key, old] of ttsMemory) {
    if (ttsMemoryBytes <= TTS_MEMORY_MAX_BYTES) break;
    ttsMemory.delete(key);
    ttsUrlCache.delete(key);
    ttsMemoryBytes -= old.length;
  }
}
const decodeEntities = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, '&');
// So khớp chỉ theo chữ + số: textContent của trình duyệt và HTML đã bỏ thẻ khác nhau ở khoảng trắng/dấu câu
const lettersOnly = (s) => s.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
const ttsPostText = new Map(); // slug -> { at, text } (cache 60 giây, khỏi truy vấn DB mỗi đoạn)
async function postPlainLetters(slug) {
  const hit = ttsPostText.get(slug);
  if (hit && Date.now() - hit.at < 60_000) return hit.text;
  const post = await prisma.blogPost.findFirst({ where: { ...publicWhere(), slug }, select: { title: true, excerpt: true, content: true } });
  const text = post ? lettersOnly(decodeEntities(`${post.title} ${post.excerpt || ''} ${post.content.replace(/<[^>]*>/g, ' ')}`)) : null;
  ttsPostText.set(slug, { at: Date.now(), text });
  return text;
}

router.post('/posts/:slug/tts', async (req, res) => {
  try {
    if (!tts.isConfigured() || !supabase) return res.status(503).json({ error: 'Chưa cấu hình giọng đọc ElevenLabs' });
    const raw = String(req.body?.text || '').replace(/\s+/g, ' ').trim();
    if (!raw || raw.length > MAX_TTS_CHARS) return res.status(400).json({ error: 'Đoạn văn không hợp lệ' });
    const letters = lettersOnly(raw);
    if (!letters) return res.status(400).json({ error: 'Đoạn văn không hợp lệ' });
    const postText = await postPlainLetters(req.params.slug);
    if (postText === null) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    if (!postText.includes(letters)) return res.status(400).json({ error: 'Đoạn văn không thuộc bài viết' });

    const text = tts.normalizeForSpeech(raw);
    const { voiceId, hash } = await tts.cacheKey(text);
    if (ttsUrlCache.has(hash)) return res.json({ url: ttsUrlCache.get(hash) });

    if (!ttsInFlight.has(hash)) {
      const job = (async () => {
        const fileName = `blog-tts/${hash}.mp3`;
        const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
        // Server khởi động lại thì mất cache trong RAM → hỏi Storage xem file đã có chưa trước khi tạo lại
        const head = await fetch(data.publicUrl, { method: 'HEAD' }).catch(() => null);
        if (!head?.ok) {
          const audio = await tts.synthesize(text, voiceId);
          const { error } = await supabase.storage.from('documents').upload(fileName, audio, {
            contentType: 'audio/mpeg', cacheControl: '31536000', upsert: true,
          });
          if (error) {
            console.error('[blog tts] Storage lỗi, phát mp3 từ RAM:', error.message);
            rememberTtsAudio(hash, audio);
            const local = `/api/blog/tts-audio/${hash}.mp3`; // đường dẫn tương đối — trình phát tự ghép API_URL
            ttsUrlCache.set(hash, local);
            return local;
          }
        }
        ttsUrlCache.set(hash, data.publicUrl);
        return data.publicUrl;
      })().finally(() => ttsInFlight.delete(hash));
      ttsInFlight.set(hash, job);
    }
    res.json({ url: await ttsInFlight.get(hash) });
  } catch (err) {
    console.error('[blog tts]', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Phát mp3 giữ trong RAM (xem rememberTtsAudio). Hỗ trợ Range vì Safari bắt buộc 206 mới phát/tua được audio.
router.get('/tts-audio/:file', (req, res) => {
  const buf = ttsMemory.get(String(req.params.file).replace(/\.mp3$/, ''));
  if (!buf) return res.status(404).end();
  res.set({ 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=86400' });
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (!m || (!m[1] && !m[2])) return res.send(buf);
  const start = m[1] ? Number(m[1]) : Math.max(0, buf.length - Number(m[2]));
  const end = m[1] && m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
  if (start >= buf.length || start > end) return res.status(416).set('Content-Range', `bytes */${buf.length}`).end();
  res.status(206).set('Content-Range', `bytes ${start}-${end}/${buf.length}`).send(buf.subarray(start, end + 1));
});

// Số liệu xem/click của nhiều bài cùng lúc (?slugs=a,b,c) — trang /blog làm mới định kỳ để hiện gần real-time.
// 1 truy vấn cho cả trang, chỉ select 3 field.
const MAX_STATS_SLUGS = 50;
router.get('/stats', async (req, res) => {
  try {
    const slugs = [...new Set(String(req.query.slugs || '').split(',').map((s) => s.trim()).filter(Boolean))]
      .slice(0, MAX_STATS_SLUGS);
    if (!slugs.length) return res.json({});
    const rows = await prisma.blogPost.findMany({ where: { ...publicWhere(), slug: { in: slugs } }, select: STATS_SELECT });
    res.set('Cache-Control', 'no-store');
    res.json(Object.fromEntries(rows.map(({ slug, ...s }) => [slug, s])));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.blogCategory.findMany({
      select: {
        id: true, name: true, slug: true, description: true,
        _count: { select: { posts: { where: publicWhere() } } },
      },
      orderBy: { name: 'asc' },
    });
    res.json(categories.map(({ _count, ...c }) => ({ ...c, postCount: _count.posts })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/authors/:slug', async (req, res) => {
  try {
    const author = await prisma.user.findFirst({
      where: { authorSlug: req.params.slug, role: 'TEACHER' },
      select: { id: true, name: true, authorSlug: true, authorTitle: true, authorBio: true, avatar: true },
    });
    if (!author) return res.status(404).json({ error: 'Không tìm thấy tác giả' });
    const { avatar, ...rest } = author;
    // Không trả chuỗi base64 avatar trong JSON — ảnh lấy qua /authors/:slug/avatar (cache được)
    res.json({ ...rest, hasAvatar: !!avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/authors/:slug/avatar', async (req, res) => {
  try {
    const author = await prisma.user.findFirst({ where: { authorSlug: req.params.slug }, select: { avatar: true } });
    const match = author?.avatar?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!match) return res.status(404).end();
    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    res.status(500).end();
  }
});

// Dùng cho frontend/src/app/sitemap.ts
router.get('/sitemap', async (req, res) => {
  try {
    const [posts, categories, authors] = await Promise.all([
      prisma.blogPost.findMany({ where: publicWhere(), select: { slug: true, updatedAt: true }, orderBy: { publishedAt: 'desc' } }),
      prisma.blogCategory.findMany({ where: { posts: { some: publicWhere() } }, select: { slug: true } }),
      prisma.user.findMany({ where: { authorSlug: { not: null }, blogPosts: { some: publicWhere() } }, select: { authorSlug: true } }),
    ]);
    res.json({ posts, categories: categories.map((c) => c.slug), authors: authors.map((a) => a.authorSlug) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Quản lý (giáo viên) ────────────────────────────────────────────────────

router.get('/manage/me', requireTeacher, async (req, res) => {
  try {
    const [profile, pendingCount] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.teacherId }, select: { id: true, name: true, authorSlug: true, authorTitle: true, authorBio: true } }),
      req.teacher.isAdmin ? prisma.blogPost.count({ where: { status: 'PENDING' } }) : 0,
    ]);
    res.json({ isAdmin: req.teacher.isAdmin, profile, pendingCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/manage/author-profile', requireTeacher, async (req, res) => {
  try {
    const authorSlug = slugify(req.body.authorSlug || req.teacher.name);
    if (!authorSlug) return res.status(400).json({ error: 'Link hồ sơ không hợp lệ' });
    const clash = await prisma.user.findFirst({ where: { authorSlug, id: { not: req.teacherId } }, select: { id: true } });
    if (clash) return res.status(409).json({ error: `Link /blog/tac-gia/${authorSlug} đã có người dùng` });
    const profile = await prisma.user.update({
      where: { id: req.teacherId },
      data: {
        authorSlug,
        authorTitle: String(req.body.authorTitle || '').trim().slice(0, 100) || null,
        authorBio: String(req.body.authorBio || '').trim().slice(0, 1000) || null,
      },
      select: { id: true, name: true, authorSlug: true, authorTitle: true, authorBio: true },
    });
    res.json(profile);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/manage/posts', requireTeacher, async (req, res) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: req.teacher.isAdmin ? {} : { authorId: req.teacherId },
      select: {
        ...LIST_SELECT, status: true, updatedAt: true, createdAt: true,
        readSeconds: true, readSessions: true, scroll25: true, scroll50: true, scroll75: true, scroll100: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/manage/posts/:id', requireTeacher, async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      include: { author: { select: AUTHOR_SELECT }, category: { select: { id: true, name: true, slug: true } } },
    });
    if (!post || !canEditPost(req.teacher, post)) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ô chọn "Bài viết liên quan" trong editor:
//   ?ids=a,b    -> thông tin các bài đã chọn (giữ thứ tự, mọi trạng thái — để hiện cả bài đã bị gỡ đăng)
//   ?q=từ khoá  -> tìm trong các bài đã đăng của MỌI tác giả (để các tác giả giới thiệu bài cho nhau)
router.get('/manage/post-picker', requireTeacher, async (req, res) => {
  try {
    const select = {
      id: true, title: true, slug: true, status: true, publishedAt: true, coverImage: true,
      author: { select: { name: true } },
    };
    if (req.query.ids !== undefined) {
      const ids = String(req.query.ids).split(',').filter(Boolean).slice(0, 20);
      const rows = ids.length ? await prisma.blogPost.findMany({ where: { id: { in: ids } }, select }) : [];
      const byId = new Map(rows.map((r) => [r.id, r]));
      return res.json(ids.map((id) => byId.get(id)).filter(Boolean));
    }
    const q = String(req.query.q || '').trim();
    const posts = await prisma.blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        ...(req.query.excludeId ? { id: { not: String(req.query.excludeId) } } : {}),
        ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      },
      select,
      orderBy: { publishedAt: 'desc' },
      take: 8,
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/manage/slug-check', requireTeacher, async (req, res) => {
  try {
    const slug = slugify(req.query.slug);
    if (!slug) return res.json({ slug, available: false });
    const available = !(await isSlugTaken(slug, req.query.excludeId));
    res.json({ slug, available, suggestion: available ? slug : await uniqueSlug(slug, req.query.excludeId) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function isSlugTaken(slug, excludeId) {
  const existing = await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } });
  return !!existing && existing.id !== excludeId;
}

async function uniqueSlug(base, excludeId) {
  // 1 truy vấn lấy mọi slug cùng gốc thay vì thử từng hậu tố -2, -3... nối tiếp
  const taken = new Set((await prisma.blogPost.findMany({
    where: { slug: { startsWith: base }, ...(excludeId ? { id: { not: excludeId } } : {}) },
    select: { slug: true },
  })).map(p => p.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// Chuẩn hoá + kiểm tra dữ liệu bài viết gửi từ editor. Trả về { data } hoặc { error, status }.
// `existing` = bài hiện tại khi sửa (null khi tạo mới).
async function buildPostData(body, teacher, existing) {
  const title = String(body.title || '').trim();
  if (!title) return { error: 'Vui lòng nhập tên bài viết' };

  let status = ['PUBLISHED', 'PENDING'].includes(body.status) ? body.status : 'DRAFT';
  // Giáo viên thường không tự đăng được bài mới — "Đăng" thành "Gửi duyệt".
  // Bài đã được admin duyệt đăng thì tác giả vẫn sửa tiếp được mà không bị gỡ xuống.
  if (status === 'PUBLISHED' && !teacher.isAdmin && existing?.status !== 'PUBLISHED') status = 'PENDING';

  const content = sanitizeHtml(String(body.content || ''), SANITIZE_OPTIONS);
  if (status !== 'DRAFT' && !htmlToText(content) && !/<img|<iframe/.test(content)) {
    return { error: 'Bài viết chưa có nội dung — không thể đăng' };
  }

  const slug = slugify(body.slug || title);
  if (!slug) return { error: 'Link SEO không hợp lệ' };
  if (await isSlugTaken(slug, existing?.id)) {
    return { status: 409, error: `Link "/blog/${slug}" đã được dùng cho bài khác`, suggestion: await uniqueSlug(slug, existing?.id) };
  }

  let publishedAt = body.publishedAt ? new Date(body.publishedAt) : null;
  if (publishedAt && isNaN(publishedAt.getTime())) return { error: 'Ngày đăng không hợp lệ' };
  if (status === 'PUBLISHED' && !publishedAt) publishedAt = new Date();

  // Chỉ admin được đứng tên hộ giáo viên khác; giáo viên thường luôn là tác giả bài của mình
  let authorId = existing?.authorId || teacher.id;
  if (teacher.isAdmin && body.authorId && body.authorId !== authorId) {
    const author = await prisma.user.findUnique({ where: { id: body.authorId }, select: { role: true } });
    if (!author || author.role !== 'TEACHER') return { error: 'Tác giả phải là tài khoản giáo viên' };
    authorId = body.authorId;
  }

  const tags = [...new Set((Array.isArray(body.tags) ? body.tags : [])
    .map(t => String(t).trim().replace(/^#/, ''))
    .filter(t => t && t.length <= 40))].slice(0, 10);

  const coverImage = String(body.coverImage || '').trim();
  // Link http(s), hoặc đường dẫn ảnh nằm sẵn trong frontend/public (vd /images/blog/abc.png)
  if (coverImage && !/^(https?:\/\/|\/(?!\/))/i.test(coverImage)) return { error: 'Ảnh bìa phải là link http(s) hoặc đường dẫn bắt đầu bằng /' };

  // Bài liên quan: tối đa 6, bỏ trùng, bỏ chính nó, chỉ giữ id của bài có thật (giữ nguyên thứ tự tác giả xếp)
  const wantedRelated = [...new Set((Array.isArray(body.relatedPostIds) ? body.relatedPostIds : []).map(String))]
    .filter((id) => id && id !== existing?.id)
    .slice(0, MAX_RELATED_POSTS);
  let relatedPostIds = [];
  if (wantedRelated.length) {
    const found = new Set((await prisma.blogPost.findMany({ where: { id: { in: wantedRelated } }, select: { id: true } })).map((p) => p.id));
    relatedPostIds = wantedRelated.filter((id) => found.has(id));
  }

  const trimOrNull = (v) => (String(v || '').trim() || null);

  return {
    data: {
      title, slug, content, status, publishedAt, authorId, tags,
      excerpt: trimOrNull(body.excerpt),
      coverImage: coverImage || null,
      metaTitle: trimOrNull(body.metaTitle),
      metaDescription: trimOrNull(body.metaDescription),
      categoryId: body.categoryId || null,
      featured: teacher.isAdmin ? !!body.featured : !!existing?.featured,
      relatedPostIds,
      readingMinutes: estimateReadingMinutes(content),
    },
  };
}

router.post('/manage/posts', requireTeacher, async (req, res) => {
  try {
    const result = await buildPostData(req.body, req.teacher, null);
    if (result.error) return res.status(result.status || 400).json({ error: result.error, suggestion: result.suggestion });
    const post = await prisma.blogPost.create({ data: result.data });
    await ensureAuthorSlug(post.authorId);
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/manage/posts/:id', requireTeacher, async (req, res) => {
  try {
    const existing = await prisma.blogPost.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, status: true, featured: true, title: true, excerpt: true, content: true },
    });
    if (!existing || !canEditPost(req.teacher, existing)) return res.status(404).json({ error: 'Không tìm thấy bài viết' });

    const autosave = !!req.body.autosave;
    // Lưu tự động không bao giờ được động vào bài đang công khai (sửa dở sẽ lộ ra ngoài)
    if (autosave && existing.status === 'PUBLISHED') return res.status(409).json({ error: 'Bài đã đăng không lưu tự động' });

    const body = autosave ? { ...req.body, status: existing.status } : req.body;
    const result = await buildPostData(body, req.teacher, existing);
    if (result.error) return res.status(result.status || 400).json({ error: result.error, suggestion: result.suggestion });

    // Chụp lại bản cũ vào lịch sử nếu nội dung thực sự đổi
    const changed = existing.title !== result.data.title || existing.content !== result.data.content || (existing.excerpt || null) !== result.data.excerpt;
    let snapshot = null;
    if (changed) {
      const last = autosave
        ? await prisma.blogPostRevision.findFirst({ where: { postId: existing.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
        : null;
      if (!last || Date.now() - last.createdAt.getTime() > AUTOSAVE_REVISION_GAP_MS) {
        snapshot = prisma.blogPostRevision.create({
          data: { postId: existing.id, title: existing.title, excerpt: existing.excerpt, content: existing.content, editedById: req.teacherId },
        });
      }
    }

    const [post] = await Promise.all([
      prisma.blogPost.update({ where: { id: existing.id }, data: result.data }),
      snapshot,
    ]);
    if (snapshot) {
      // Giữ BLOG_MAX_REVISIONS bản mới nhất
      const old = await prisma.blogPostRevision.findMany({
        where: { postId: existing.id }, orderBy: { createdAt: 'desc' }, skip: BLOG_MAX_REVISIONS, select: { id: true },
      });
      if (old.length) await prisma.blogPostRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } });
    }
    await ensureAuthorSlug(post.authorId);
    res.json(post);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/manage/posts/:id', requireTeacher, async (req, res) => {
  try {
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { id: true, authorId: true } });
    if (!existing || !canEditPost(req.teacher, existing)) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    await prisma.blogPost.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/manage/posts/:id/revisions', requireTeacher, async (req, res) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { authorId: true } });
    if (!post || !canEditPost(req.teacher, post)) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    const revisions = await prisma.blogPostRevision.findMany({
      where: { postId: req.params.id },
      select: { id: true, title: true, createdAt: true, editedBy: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(revisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/manage/revisions/:id', requireTeacher, async (req, res) => {
  try {
    const revision = await prisma.blogPostRevision.findUnique({
      where: { id: req.params.id },
      include: { post: { select: { authorId: true } }, editedBy: { select: { name: true } } },
    });
    if (!revision || !canEditPost(req.teacher, revision.post)) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });
    const { post, ...rest } = revision;
    res.json(rest);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/manage/categories', requireTeacher, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'Vui lòng nhập tên danh mục' });
    const slug = slugify(name);
    if (!slug) return res.status(400).json({ error: 'Tên danh mục không hợp lệ' });
    const existing = await prisma.blogCategory.findUnique({ where: { slug } });
    if (existing) return res.json(existing); // gõ trùng tên -> dùng lại danh mục cũ thay vì báo lỗi
    const category = await prisma.blogCategory.create({
      data: { name, slug, description: String(req.body.description || '').trim() || null },
    });
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/manage/categories/:id', requireTeacher, requireBlogAdmin, async (req, res) => {
  try {
    // Bài thuộc danh mục bị xoá sẽ về "Chưa phân loại" (onDelete: SetNull), không bị xoá theo
    await prisma.blogCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Ảnh bìa + ảnh chèn trong nội dung. multer phải chạy trước requireTeacher để req.body.userId có giá trị.
router.post('/manage/upload-image', imageUpload.single('image'), requireTeacher, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn ảnh' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const base = slugify(path.basename(req.file.originalname, ext)) || 'image';
    const fileName = `blog/${Date.now()}-${base}${ext}`;

    const { error } = await supabase.storage.from('documents').upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype, upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from('documents').getPublicUrl(fileName);
    res.json({ url: data.publicUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Trợ lý AI: gợi ý tiêu đề, tóm tắt, tiêu đề/mô tả SEO, thẻ từ nội dung đang soạn. Không tự ghi vào bài —
// giáo viên chọn áp dụng từng mục ở editor.
router.post('/manage/ai-suggest', requireTeacher, async (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 200);
    const text = htmlToText(req.body.content).slice(0, 6000);
    if (!title && text.length < 50) {
      return res.status(400).json({ error: 'Hãy viết tên bài hoặc ít nhất vài câu nội dung để AI có dữ liệu gợi ý' });
    }

    const prompt = `Bạn là biên tập viên SEO cho blog giáo dục "Lucy Tutor" (luyện thi Tiếng Anh THPT Quốc Gia & IELTS cho người Việt).
Dựa trên bài viết dưới đây, đề xuất bằng TIẾNG VIỆT (giữ nguyên thuật ngữ tiếng Anh nếu cần).
KHÔNG bịa số liệu, cam kết điểm số hay thông tin không có trong bài.

Tên bài hiện tại: "${title || '(chưa có)'}"
Nội dung:
"""
${text || '(chưa có nội dung)'}
"""

Trả về JSON nguyên chất:
{
  "titles": ["5 phương án tên bài hấp dẫn, rõ ràng, 40-60 ký tự"],
  "excerpt": "tóm tắt (sapo) 1-2 câu, 120-160 ký tự",
  "metaTitle": "tiêu đề SEO 50-60 ký tự, chứa từ khoá chính",
  "metaDescription": "mô tả SEO 140-160 ký tự, có lời kêu gọi đọc bài",
  "tags": ["3-6 thẻ ngắn, chữ thường, không dấu #"]
}`;

    // gpt-oss thỉnh thoảng trả về rỗng ở chế độ JSON (lỗi json_validate_failed) -> thử lại 1 lần
    const ask = () => groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a Vietnamese SEO editor. Always respond in valid JSON.' },
        { role: 'user', content: prompt },
      ],
      model: GROQ_TEXT_MODEL,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      ...(GROQ_TEXT_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
    });
    let completion;
    try {
      completion = await ask();
    } catch (err) {
      if (err?.error?.error?.code !== 'json_validate_failed') throw err;
      completion = await ask();
    }
    let data;
    try { data = JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { data = {}; }
    const str = (v) => (typeof v === 'string' ? v.trim() : '');
    const arr = (v) => (Array.isArray(v) ? v.map(str).filter(Boolean) : []);
    res.json({
      titles: arr(data.titles).slice(0, 5),
      excerpt: str(data.excerpt),
      metaTitle: str(data.metaTitle),
      metaDescription: str(data.metaDescription),
      tags: arr(data.tags).map((t) => t.replace(/^#/, '').toLowerCase()).slice(0, 6),
    });
  } catch (err) {
    console.error('Groq AI Error (blog ai-suggest):', err);
    res.status(500).json({ error: 'AI đang bận, vui lòng thử lại sau ít phút' });
  }
});

module.exports = router;
