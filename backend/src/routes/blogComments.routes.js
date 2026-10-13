const express = require('express');
const crypto = require('crypto');

const prisma = require('../lib/prisma');
const { isBlogAdmin } = require('../utils/blogAccess');

// Bình luận dưới bài blog — mount tại /api/blog-comments.
//
// 2 loại người bình luận:
// - Đã đăng nhập (STUDENT/TEACHER, gửi kèm userId như mọi route khác): tên + avatar lấy theo tài khoản, hiện ngay.
//   Học viên gửi bình luận có link thì chờ duyệt (đăng ký học viên là công khai → chặn spam tạo tài khoản rác).
// - Khách: tự nhập tên (+ email tuỳ chọn, không hiển thị công khai). Chế độ theo BLOG_GUEST_COMMENT_MODE:
//     moderate (mặc định) = mọi bình luận của khách chờ duyệt · open = hiện ngay, trừ bình luận có link · off = khoá
//   Khách được nhận diện bằng visitorId ngẫu nhiên lưu trong localStorage → tự xoá được bình luận của mình,
//   thấy bình luận đang chờ duyệt của mình, và thả emoji. Server chỉ lưu sha256 của mã này.
// Người duyệt: giáo viên là tác giả bài viết, hoặc admin blog (BLOG_ADMIN_EMAILS).
// Không bao giờ trả userId của người bình luận ra ngoài — userId đang là "chìa khoá phiên" của cả app.

const router = express.Router();

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const MIN_CONTENT = 2;
const MAX_CONTENT = 2000;
const MAX_NAME = 50;
const MAX_COMMENTS_PER_POST = 500;
const MANAGE_PAGE_SIZE = 20;
const GUEST_MODE = ['open', 'moderate', 'off'].includes(process.env.BLOG_GUEST_COMMENT_MODE)
  ? process.env.BLOG_GUEST_COMMENT_MODE
  : 'moderate';

const publicWhere = () => ({ status: 'PUBLISHED', publishedAt: { lte: new Date() } });
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const VISITOR_RE = /^[A-Za-z0-9-]{16,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LINK_RE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|vn|info|xyz|top|io|me|ru|cn|site|online|link|click)\b)/i;
// Khách không được tự xưng là quản trị / giáo viên / Lucy Tutor
const RESERVED_NAME_RE = /admin|quan tri|lucy ?tutor|giao vien|moderator|ban quan ly/;
const stripAccents = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

function clientIp(req) {
  // Render đứng sau proxy (server không bật trust proxy) -> lấy IP gốc từ x-forwarded-for, giống passwordReset.routes.js
  return String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
}

// Giới hạn tần suất trong RAM (khởi động lại server = reset), giống freeTools.routes.js
const hits = new Map(); // key -> mốc thời gian các lần gọi
function overLimit(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (list.length >= max) { hits.set(key, list); return true; }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 10_000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 60 * 60 * 1000) hits.delete(k);
  }
  return false;
}

// Người đang xem: tài khoản (nếu có userId hợp lệ thuộc luồng học viên/giáo viên) + mã khách (nếu có)
async function resolveViewer(userId, visitorId) {
  const user = userId
    ? await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true, name: true, role: true, email: true } })
    : null;
  const validUser = user && (user.role === 'STUDENT' || user.role === 'TEACHER') ? user : null;
  const guestHash = visitorId && VISITOR_RE.test(String(visitorId)) ? sha256(String(visitorId)) : null;
  return {
    user: validUser,
    invalidUser: !!userId && !validUser,
    guestHash,
    voterKey: validUser ? `u:${validUser.id}` : guestHash ? `g:${guestHash}` : null,
  };
}

const canModerate = (user, post) => !!user && user.role === 'TEACHER' && (post.authorId === user.id || isBlogAdmin(user));

function normalizeContent(raw) {
  return String(raw || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const COMMENT_SELECT = {
  id: true, parentId: true, replyToName: true, userId: true, guestName: true, guestEmail: true, guestTokenHash: true,
  content: true, status: true, createdAt: true,
  user: { select: { name: true, role: true } },
};

function displayName(c) {
  return c.user?.name || c.guestName || 'Tài khoản đã xoá';
}

function serialize(c, ctx) {
  const deleted = c.status === 'DELETED';
  const mine = (!!ctx.viewer.user && c.userId === ctx.viewer.user.id)
    || (!!ctx.viewer.guestHash && c.guestTokenHash === ctx.viewer.guestHash);
  return {
    id: c.id,
    parentId: c.parentId,
    replyToName: c.replyToName,
    status: c.status,
    createdAt: c.createdAt,
    content: deleted ? '' : c.content,
    author: deleted ? null : {
      name: displayName(c),
      role: c.user ? c.user.role : 'GUEST',
      isPostAuthor: !!c.userId && c.userId === ctx.postAuthorId,
      // Ảnh lấy qua /api/blog-comments/:id/avatar — không nhúng base64 vào danh sách
      hasAvatar: !!c.userId && ctx.avatarUserIds.has(c.userId),
    },
    reactions: REACTION_EMOJIS
      .map((emoji) => ({ emoji, count: ctx.reactionCounts.get(`${c.id}|${emoji}`) || 0, mine: ctx.myReactions.has(`${c.id}|${emoji}`) }))
      .filter((r) => r.count > 0),
    mine: !deleted && mine,
    // Email khách chỉ người duyệt mới thấy (để liên hệ lại khi cần)
    ...(ctx.canModerate && c.guestEmail ? { guestEmail: c.guestEmail } : {}),
  };
}

async function reactionContext(commentIds, voterKey) {
  if (!commentIds.length) return { reactionCounts: new Map(), myReactions: new Set() };
  const [grouped, mine] = await Promise.all([
    prisma.blogCommentReaction.groupBy({ by: ['commentId', 'emoji'], where: { commentId: { in: commentIds } }, _count: { _all: true } }),
    voterKey
      ? prisma.blogCommentReaction.findMany({ where: { commentId: { in: commentIds }, voterKey }, select: { commentId: true, emoji: true } })
      : [],
  ]);
  return {
    reactionCounts: new Map(grouped.map((g) => [`${g.commentId}|${g.emoji}`, g._count._all])),
    myReactions: new Set(mine.map((r) => `${r.commentId}|${r.emoji}`)),
  };
}

// ─── Công khai ──────────────────────────────────────────────────────────────

// Danh sách bình luận của 1 bài: gốc mới nhất trước, trả lời cũ nhất trước (đọc như hội thoại).
// Người duyệt thấy cả bình luận chờ duyệt; người viết thấy bình luận chờ duyệt của chính mình.
router.get('/post/:slug', async (req, res) => {
  try {
    const [post, viewer] = await Promise.all([
      prisma.blogPost.findFirst({ where: { ...publicWhere(), slug: req.params.slug }, select: { id: true, authorId: true } }),
      resolveViewer(req.query.userId, req.query.visitorId),
    ]);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    const mod = canModerate(viewer.user, post);

    const minePending = viewer.user
      ? [{ status: 'PENDING', userId: viewer.user.id }]
      : viewer.guestHash ? [{ status: 'PENDING', guestTokenHash: viewer.guestHash }] : [];
    const rows = await prisma.blogComment.findMany({
      where: mod ? { postId: post.id } : { postId: post.id, OR: [{ status: { in: ['APPROVED', 'DELETED'] } }, ...minePending] },
      select: COMMENT_SELECT,
      orderBy: { createdAt: 'asc' },
      take: MAX_COMMENTS_PER_POST,
    });

    const ids = rows.map((r) => r.id);
    const userIds = [...new Set([...rows.map((r) => r.userId).filter(Boolean), ...(viewer.user ? [viewer.user.id] : [])])];
    const [rc, withAvatar] = await Promise.all([
      reactionContext(ids, viewer.voterKey),
      userIds.length
        ? prisma.user.findMany({ where: { id: { in: userIds }, avatar: { not: null } }, select: { id: true } })
        : [],
    ]);
    const ctx = { viewer, canModerate: mod, postAuthorId: post.authorId, avatarUserIds: new Set(withAvatar.map((u) => u.id)), ...rc };

    // Dựng cây 1 cấp. Trả lời đã xoá thì bỏ hẳn; gốc đã xoá chỉ giữ khi còn trả lời (hiện "Bình luận đã bị xoá").
    const roots = [];
    const repliesByRoot = new Map();
    for (const r of rows) {
      if (!r.parentId) { roots.push(r); continue; }
      if (r.status === 'DELETED') continue;
      if (!repliesByRoot.has(r.parentId)) repliesByRoot.set(r.parentId, []);
      repliesByRoot.get(r.parentId).push(serialize(r, ctx));
    }
    const comments = roots
      .map((r) => ({ ...serialize(r, ctx), replies: repliesByRoot.get(r.id) || [] }))
      .filter((c) => c.status !== 'DELETED' || c.replies.length > 0)
      .reverse();
    const total = rows.filter((r) => r.status === 'APPROVED').length;

    res.set('Cache-Control', 'no-store');
    res.json({
      comments,
      total,
      canModerate: mod,
      guestMode: GUEST_MODE,
      emojis: REACTION_EMOJIS,
      viewer: viewer.user
        ? { name: viewer.user.name, role: viewer.user.role, hasAvatar: ctx.avatarUserIds.has(viewer.user.id) }
        : null,
      // Phiên userId gửi lên không còn hợp lệ (tài khoản bị xoá / ADMIN) → trình duyệt nên coi như khách
      invalidSession: viewer.invalidUser,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/post/:slug', async (req, res) => {
  try {
    const body = req.body || {};
    // Ô ẩn chống bot: người thật không thấy nên không điền. Trả lời như thành công để bot không dò ra.
    if (body.website) return res.status(201).json({ comment: null, pending: true });

    const [post, viewer] = await Promise.all([
      prisma.blogPost.findFirst({ where: { ...publicWhere(), slug: req.params.slug }, select: { id: true, authorId: true } }),
      resolveViewer(body.userId, body.visitorId),
    ]);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    if (viewer.invalidUser) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.' });

    const content = normalizeContent(body.content);
    if (content.length < MIN_CONTENT) return res.status(400).json({ error: 'Bình luận quá ngắn.' });
    if (content.length > MAX_CONTENT) return res.status(400).json({ error: `Bình luận tối đa ${MAX_CONTENT} ký tự.` });

    let guestName = null;
    let guestEmail = null;
    if (!viewer.user) {
      if (GUEST_MODE === 'off') return res.status(403).json({ error: 'Vui lòng đăng nhập để bình luận.' });
      if (!viewer.guestHash) return res.status(400).json({ error: 'Thiếu mã trình duyệt, vui lòng tải lại trang.' });
      guestName = String(body.guestName || '').replace(/\s+/g, ' ').trim();
      if (guestName.length < 2 || guestName.length > MAX_NAME) return res.status(400).json({ error: `Tên cần từ 2 đến ${MAX_NAME} ký tự.` });
      if (RESERVED_NAME_RE.test(stripAccents(guestName))) return res.status(400).json({ error: 'Tên này được dành riêng, vui lòng chọn tên khác.' });
      guestEmail = String(body.guestEmail || '').trim().toLowerCase() || null;
      if (guestEmail && (guestEmail.length > 100 || !EMAIL_RE.test(guestEmail))) return res.status(400).json({ error: 'Email không hợp lệ.' });
    }

    const ip = clientIp(req);
    if (overLimit(`c:${ip}`, viewer.user ? 15 : 5, 10 * 60 * 1000)) {
      return res.status(429).json({ error: 'Bạn bình luận hơi nhanh, vui lòng thử lại sau vài phút.' });
    }

    const mod = canModerate(viewer.user, post);
    let parentId = null;
    let replyToName = null;
    if (body.parentId) {
      const parent = await prisma.blogComment.findFirst({
        where: { id: String(body.parentId), postId: post.id, status: mod ? { not: 'DELETED' } : 'APPROVED' },
        select: { id: true, parentId: true, userId: true, guestName: true, user: { select: { name: true } } },
      });
      if (!parent) return res.status(404).json({ error: 'Bình luận bạn trả lời không còn tồn tại.' });
      // Chỉ 1 cấp trả lời: trả lời 1 câu trả lời = thêm vào cùng luồng của bình luận gốc, kèm "@Tên"
      parentId = parent.parentId || parent.id;
      if (parent.parentId) replyToName = displayName(parent);
    }

    const owner = viewer.user ? { userId: viewer.user.id } : { guestTokenHash: viewer.guestHash };
    const dup = await prisma.blogComment.findFirst({
      where: { postId: post.id, content, ...owner, createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) } },
      select: { id: true },
    });
    if (dup) return res.status(409).json({ error: 'Bạn vừa gửi bình luận này rồi.' });

    const hasLink = LINK_RE.test(content);
    let status = 'APPROVED';
    if (!viewer.user) status = GUEST_MODE === 'open' && !hasLink ? 'APPROVED' : 'PENDING';
    else if (viewer.user.role === 'STUDENT' && hasLink) status = 'PENDING';

    const created = await prisma.blogComment.create({
      data: { postId: post.id, parentId, replyToName, content, status, guestName, guestEmail, ...owner },
      select: COMMENT_SELECT,
    });
    const hasAvatar = viewer.user
      ? !!(await prisma.user.count({ where: { id: viewer.user.id, avatar: { not: null } } }))
      : false;
    const ctx = {
      viewer, canModerate: mod, postAuthorId: post.authorId,
      avatarUserIds: new Set(hasAvatar ? [viewer.user.id] : []), reactionCounts: new Map(), myReactions: new Set(),
    };
    res.status(201).json({ comment: { ...serialize(created, ctx), replies: [] }, pending: status === 'PENDING' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bật/tắt 1 emoji trên 1 bình luận. Trả về tổng emoji mới nhất của bình luận đó.
router.post('/:id/reactions', async (req, res) => {
  try {
    const emoji = String(req.body?.emoji || '');
    if (!REACTION_EMOJIS.includes(emoji)) return res.status(400).json({ error: 'Emoji không hợp lệ' });
    const viewer = await resolveViewer(req.body?.userId, req.body?.visitorId);
    if (!viewer.voterKey) return res.status(400).json({ error: 'Thiếu mã trình duyệt, vui lòng tải lại trang.' });
    if (overLimit(`r:${clientIp(req)}`, 60, 5 * 60 * 1000)) {
      return res.status(429).json({ error: 'Thao tác quá nhanh, vui lòng thử lại sau.' });
    }

    const comment = await prisma.blogComment.findFirst({
      where: { id: req.params.id, status: 'APPROVED', post: publicWhere() },
      select: { id: true },
    });
    if (!comment) return res.status(404).json({ error: 'Không tìm thấy bình luận' });

    const key = { commentId: comment.id, voterKey: viewer.voterKey, emoji };
    const { count } = await prisma.blogCommentReaction.deleteMany({ where: key });
    if (!count) {
      try {
        await prisma.blogCommentReaction.create({ data: key });
      } catch (e) {
        if (e.code !== 'P2002') throw e; // bấm 2 lần liên tiếp — đã có rồi
      }
    }
    const rc = await reactionContext([comment.id], viewer.voterKey);
    const reactions = REACTION_EMOJIS
      .map((e) => ({ emoji: e, count: rc.reactionCounts.get(`${comment.id}|${e}`) || 0, mine: rc.myReactions.has(`${comment.id}|${e}`) }))
      .filter((r) => r.count > 0);
    res.json({ reactions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Xoá: chủ bình luận (tài khoản hoặc đúng trình duyệt khách đã viết) hoặc người duyệt.
// Gốc còn trả lời → xoá mềm (giữ luồng, hiện "Bình luận đã bị xoá"); còn lại xoá hẳn.
router.delete('/:id', async (req, res) => {
  try {
    const [comment, viewer] = await Promise.all([
      prisma.blogComment.findUnique({
        where: { id: req.params.id },
        select: {
          id: true, parentId: true, userId: true, guestTokenHash: true, status: true,
          post: { select: { authorId: true } },
          _count: { select: { replies: { where: { status: { not: 'DELETED' } } } } },
        },
      }),
      resolveViewer(req.query.userId, req.query.visitorId),
    ]);
    if (!comment || comment.status === 'DELETED') return res.status(404).json({ error: 'Không tìm thấy bình luận' });
    const isOwner = (!!viewer.user && comment.userId === viewer.user.id)
      || (!!viewer.guestHash && comment.guestTokenHash === viewer.guestHash);
    if (!isOwner && !canModerate(viewer.user, comment.post)) return res.status(403).json({ error: 'Bạn không có quyền xoá bình luận này' });

    if (!comment.parentId && comment._count.replies > 0) {
      await prisma.$transaction([
        prisma.blogComment.update({ where: { id: comment.id }, data: { status: 'DELETED', content: '' } }),
        prisma.blogCommentReaction.deleteMany({ where: { commentId: comment.id } }),
      ]);
      return res.json({ ok: true, mode: 'soft' });
    }
    await prisma.blogComment.delete({ where: { id: comment.id } });
    res.json({ ok: true, mode: 'hard' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/avatar', async (req, res) => {
  try {
    const c = await prisma.blogComment.findUnique({
      where: { id: req.params.id },
      select: { status: true, user: { select: { avatar: true } } },
    });
    const match = c && c.status !== 'DELETED' ? c.user?.avatar?.match(/^data:(image\/[a-z+]+);base64,(.+)$/) : null;
    if (!match) return res.status(404).end();
    res.set('Content-Type', match[1]);
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(match[2], 'base64'));
  } catch (err) {
    res.status(500).end();
  }
});

// ─── Duyệt bình luận (giáo viên) ────────────────────────────────────────────

async function requireModerator(req, res, next) {
  try {
    const userId = req.body?.userId || req.query.userId;
    if (!userId) return res.status(401).json({ error: 'Thiếu userId' });
    const user = await prisma.user.findUnique({ where: { id: String(userId) }, select: { id: true, role: true, email: true, name: true } });
    if (!user || user.role !== 'TEACHER') return res.status(403).json({ error: 'Chỉ giáo viên mới được duyệt bình luận' });
    req.moderator = { ...user, isAdmin: isBlogAdmin(user) };
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Bình luận trên các bài mình có quyền duyệt (admin blog: mọi bài). ?status=PENDING|APPROVED|ALL&page=
router.get('/manage/list', requireModerator, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const scope = req.moderator.isAdmin ? {} : { post: { authorId: req.moderator.id } };
    const status = ['PENDING', 'APPROVED'].includes(req.query.status) ? req.query.status : null;
    const where = { ...scope, status: status || { not: 'DELETED' } };
    const [rows, total, pendingCount] = await Promise.all([
      prisma.blogComment.findMany({
        where,
        select: { ...COMMENT_SELECT, post: { select: { title: true, slug: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * MANAGE_PAGE_SIZE,
        take: MANAGE_PAGE_SIZE,
      }),
      prisma.blogComment.count({ where }),
      prisma.blogComment.count({ where: { ...scope, status: 'PENDING' } }),
    ]);
    res.json({
      comments: rows.map((c) => ({
        id: c.id,
        content: c.content,
        status: c.status,
        createdAt: c.createdAt,
        isReply: !!c.parentId,
        replyToName: c.replyToName,
        author: { name: displayName(c), role: c.user ? c.user.role : 'GUEST', guestEmail: c.guestEmail },
        post: c.post,
      })),
      total,
      pendingCount,
      page,
      totalPages: Math.max(1, Math.ceil(total / MANAGE_PAGE_SIZE)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/approve', requireModerator, async (req, res) => {
  try {
    const comment = await prisma.blogComment.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, post: { select: { authorId: true } } },
    });
    if (!comment || comment.status === 'DELETED') return res.status(404).json({ error: 'Không tìm thấy bình luận' });
    if (!canModerate(req.moderator, comment.post)) return res.status(403).json({ error: 'Bạn không có quyền duyệt bình luận này' });
    await prisma.blogComment.update({ where: { id: comment.id }, data: { status: 'APPROVED' } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
