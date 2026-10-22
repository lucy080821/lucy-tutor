// Lucy Notes — sổ ghi chú đa năng (mount /api/notes): sổ tay → mục → trang (+ trang con), nhãn, ghim,
// lưu trữ, thùng rác, tìm kiếm không dấu, lưu tự động có kiểm tra phiên bản (409), lịch sử phiên bản,
// việc cần làm rút từ checklist, file đính kèm, liên kết với nội dung lớp học, chia sẻ trong lớp.
// Phần AI nằm ở notesAi.routes.js. Xem CLAUDE.md mục "Lucy Notes".
const express = require('express');
const multer = require('multer');
const { Prisma } = require('@prisma/client');
const {
  prisma, httpError, normalizeSearch, loadNoteUser, sanitizeDoc, docPlainText, docTasks, docLinkedPageIds,
  setTaskChecked, uploadNoteFile, removeNoteFiles, storageUsed, STORAGE_QUOTA_BYTES, ownPage, sendError, aiUsage,
} = require('../utils/notesCore');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^(image\/(jpeg|png|webp|gif)|audio\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-|text\/plain)/.test(file.mimetype);
    cb(ok ? null : new Error('Định dạng file chưa được hỗ trợ (ảnh, âm thanh, PDF, Word, PowerPoint, Excel, TXT)'), ok);
  },
});

const uid = (req) => req.query.userId || req.body?.userId;
const LIST_SELECT = {
  id: true, title: true, excerpt: true, tags: true, color: true, pinned: true, sectionId: true, parentId: true,
  order: true, wordCount: true, remindAt: true, archivedAt: true, deletedAt: true, updatedAt: true, createdAt: true,
  template: true, studyDueAt: true,
};
const MAX_DEPTH = 3; // trang → trang con → trang cháu
const TRASH_DAYS = 30;
const LINK_TYPES = ['CLASSROOM', 'LESSON', 'EXAM', 'IELTS_TEST', 'DOCUMENT', 'STUDENT'];
const cleanTags = (tags) => [...new Set((Array.isArray(tags) ? tags : [])
  .map((t) => String(t).trim().replace(/^#/, '').toLowerCase().replace(/\s+/g, '-').slice(0, 40)).filter(Boolean))].slice(0, 20);
const cleanColor = (c) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : null);
const cleanName = (n, fallback) => String(n || '').trim().slice(0, 120) || fallback;
// Giao diện trang: chỉ nhận đúng các khoá/giá trị trình soạn hỗ trợ (không lưu CSS tuỳ ý)
const PAPERS = ['plain', 'lines', 'grid', 'dots', 'margin'];
const FONTS = ['default', 'sans', 'serif', 'mono', 'hand', 'rounded'];
const SIZES = ['sm', 'md', 'lg', 'xl'];
function cleanStyle(st) {
  if (!st || typeof st !== 'object') return null;
  const out = {};
  if (cleanColor(st.bg)) out.bg = st.bg;
  if (cleanColor(st.text)) out.text = st.text;
  if (PAPERS.includes(st.paper) && st.paper !== 'plain') out.paper = st.paper;
  if (FONTS.includes(st.font) && st.font !== 'default') out.font = st.font;
  if (SIZES.includes(st.size) && st.size !== 'md') out.size = st.size;
  return Object.keys(out).length ? out : null;
}
const jsonOrUndef = (v) => (v === null || v === undefined ? undefined : v);

// Ghi đè thứ tự nhiều dòng bằng 1 lệnh SQL (thay vì N lệnh UPDATE ~340ms mỗi lệnh)
async function reorder(table, userId, ids) {
  const list = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === 'string').slice(0, 500);
  if (!list.length) return;
  const values = list.map((_, i) => `($${i * 2 + 2}::text, $${i * 2 + 3}::int)`).join(', ');
  const params = list.flatMap((id, i) => [id, i]);
  await prisma.$executeRawUnsafe(
    `UPDATE "${table}" AS t SET "order" = v.ord FROM (VALUES ${values}) AS v(id, ord) WHERE t.id = v.id AND t."userId" = $1`,
    userId, ...params,
  );
}

/** searchText = tiêu đề + nội dung + thẻ + chữ OCR trong ảnh + transcript ghi âm (không dấu). */
async function refreshSearchText(pageId) {
  const page = await prisma.notePage.findUnique({
    where: { id: pageId },
    select: { title: true, plainText: true, tags: true, attachments: { select: { ocrText: true, transcript: true, name: true } } },
  });
  if (!page) return;
  await prisma.notePage.update({ where: { id: pageId }, data: { searchText: buildSearchText(page, page.attachments) } });
}
function buildSearchText({ title, plainText, tags }, attachments = []) {
  const extra = attachments.map((a) => [
    a.name, a.ocrText || '', Array.isArray(a.transcript) ? a.transcript.map((s) => s.text).join(' ') : '',
  ].join(' ')).join(' ');
  return normalizeSearch(`${title}\n${plainText}\n${(tags || []).join(' ')}\n${extra}`).slice(0, 400000);
}

// Cú pháp tìm kiếm: từ khoá thường, "cụm từ chính xác", -loại-trừ, tag:ten-the, co:anh|ghiam|file|viec, ghim
function parseQuery(q) {
  const where = [];
  const re = /(-?)(?:(tag|co):)?(?:"([^"]+)"|(\S+))/g;
  let m;
  while ((m = re.exec(String(q || '').slice(0, 300)))) {
    const neg = m[1] === '-';
    const key = m[2];
    const raw = (m[3] ?? m[4] ?? '').trim();
    if (!raw) continue;
    let cond = null;
    if (key === 'tag') cond = { tags: { has: raw.replace(/^#/, '').toLowerCase() } };
    else if (key === 'co') {
      const kind = normalizeSearch(raw);
      if (kind === 'anh') cond = { attachments: { some: { kind: 'IMAGE' } } };
      else if (kind === 'ghiam' || kind === 'ghi-am') cond = { attachments: { some: { kind: 'AUDIO' } } };
      else if (kind === 'file') cond = { attachments: { some: { kind: 'FILE' } } };
      else if (kind === 'viec') cond = { tasks: { some: {} } };
    } else if (normalizeSearch(raw) === 'ghim' && !m[3]) cond = { pinned: true };
    else cond = { searchText: { contains: normalizeSearch(raw) } };
    if (cond) where.push(neg ? { NOT: cond } : cond);
  }
  return where;
}

async function purgeOldTrash(userId) {
  const cutoff = new Date(Date.now() - TRASH_DAYS * 86400_000);
  const old = await prisma.notePage.findMany({
    where: { userId, deletedAt: { lt: cutoff } }, select: { id: true, attachments: { select: { storagePath: true } } }, take: 200,
  });
  if (!old.length) return;
  await removeNoteFiles(old.flatMap((p) => p.attachments.map((a) => a.storagePath)));
  await prisma.notePage.deleteMany({ where: { id: { in: old.map((p) => p.id) } } });
}

// ── Tổng quan khi mở /notes ─────────────────────────────────────────────────────────────────
router.get('/bootstrap', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const now = new Date();
    const endToday = new Date(new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10) + 'T23:59:59.999+07:00');
    const alive = { userId: user.id, deletedAt: null };
    const [notebooks, sectionCounts, inbox, pinned, archived, trash, tags, overdue, today, studyDue, remind, usage, used, sharedIn] = await Promise.all([
      prisma.noteNotebook.findMany({
        where: { userId: user.id }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, name: true, color: true, order: true, aiDisabled: true, sections: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, color: true, order: true } } },
      }),
      prisma.notePage.groupBy({ by: ['sectionId'], where: { ...alive, archivedAt: null }, _count: { id: true } }),
      prisma.notePage.count({ where: { ...alive, archivedAt: null, sectionId: null } }),
      prisma.notePage.count({ where: { ...alive, archivedAt: null, pinned: true } }),
      prisma.notePage.count({ where: { ...alive, archivedAt: { not: null } } }),
      prisma.notePage.count({ where: { userId: user.id, deletedAt: { not: null } } }),
      prisma.$queryRaw`SELECT t AS tag, COUNT(*)::int AS n FROM "NotePage", unnest(tags) AS t WHERE "userId" = ${user.id} AND "deletedAt" IS NULL GROUP BY t ORDER BY n DESC LIMIT 100`,
      prisma.noteTask.count({ where: { userId: user.id, done: false, dueAt: { lt: now }, page: { deletedAt: null } } }),
      prisma.noteTask.count({ where: { userId: user.id, done: false, dueAt: { gte: now, lte: endToday }, page: { deletedAt: null } } }),
      prisma.notePage.count({ where: { ...alive, studyDueAt: { lte: now } } }),
      prisma.notePage.findMany({ where: { ...alive, remindAt: { lte: endToday } }, select: { id: true, title: true, remindAt: true }, orderBy: { remindAt: 'asc' }, take: 20 }),
      aiUsage(user.id),
      storageUsed(user.id),
      user.role === 'TEACHER'
        ? prisma.noteShare.count({ where: { scope: 'TEACHER', teacherId: user.id, feedbackAt: null } })
        : prisma.noteShare.count({ where: { scope: 'CLASSROOM', classroomId: { in: user.classroomsJoined.map((c) => c.id) } } }),
    ]);
    purgeOldTrash(user.id).catch(() => {});
    const counts = Object.fromEntries(sectionCounts.map((r) => [r.sectionId || 'INBOX', r._count.id]));
    res.json({
      user: {
        id: user.id, name: user.name, role: user.role, accessLocked: user.accessLocked,
        classrooms: user.role === 'TEACHER' ? user.classroomsOwned : user.classroomsJoined.map(({ id, name }) => ({ id, name })),
        canLink: canLink(user),
      },
      notebooks: notebooks.map((nb) => ({ ...nb, sections: nb.sections.map((s) => ({ ...s, count: counts[s.id] || 0 })) })),
      counts: { inbox, pinned, archived, trash, overdue, today, studyDue, sharedIn },
      reminders: remind,
      tags,
      usage,
      storage: { used, quota: STORAGE_QUOTA_BYTES },
    });
  } catch (err) { sendError(res, err, 'bootstrap'); }
});

// ── Sổ tay & mục ────────────────────────────────────────────────────────────────────────────
router.post('/notebooks', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const count = await prisma.noteNotebook.count({ where: { userId: user.id } });
    if (count >= 100) throw httpError(400, 'Tối đa 100 sổ tay');
    const nb = await prisma.noteNotebook.create({
      data: {
        userId: user.id, name: cleanName(req.body.name, 'Sổ tay mới'), color: cleanColor(req.body.color) || '#1E3A8A', order: count,
        sections: { create: { userId: user.id, name: 'Mục chung', order: 0 } },
      },
      select: { id: true, name: true, color: true, order: true, aiDisabled: true, sections: { select: { id: true, name: true, color: true, order: true } } },
    });
    res.json({ ...nb, sections: nb.sections.map((s) => ({ ...s, count: 0 })) });
  } catch (err) { sendError(res, err, 'create notebook'); }
});

router.patch('/notebooks/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const data = {};
    if (req.body.name !== undefined) data.name = cleanName(req.body.name, 'Sổ tay');
    if (req.body.color !== undefined) data.color = cleanColor(req.body.color) || '#1E3A8A';
    if (req.body.aiDisabled !== undefined) data.aiDisabled = !!req.body.aiDisabled;
    const { count } = await prisma.noteNotebook.updateMany({ where: { id: req.params.id, userId: user.id }, data });
    if (!count) throw httpError(404, 'Không tìm thấy sổ tay');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'update notebook'); }
});

router.post('/notebooks/reorder', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    await reorder('NoteNotebook', user.id, req.body.ids);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'reorder notebooks'); }
});

// Xoá sổ/mục: các trang bên trong vào thùng rác (khôi phục về Hộp thư ghi nhanh), cấu trúc bị xoá hẳn
router.delete('/notebooks/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const nb = await prisma.noteNotebook.findFirst({ where: { id: req.params.id, userId: user.id }, select: { sections: { select: { id: true } } } });
    if (!nb) throw httpError(404, 'Không tìm thấy sổ tay');
    const sectionIds = nb.sections.map((s) => s.id);
    await prisma.$transaction([
      prisma.notePage.updateMany({ where: { userId: user.id, sectionId: { in: sectionIds }, deletedAt: null }, data: { deletedAt: new Date() } }),
      prisma.notePage.updateMany({ where: { userId: user.id, sectionId: { in: sectionIds } }, data: { sectionId: null } }),
      prisma.noteNotebook.delete({ where: { id: req.params.id } }),
    ]);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete notebook'); }
});

router.post('/sections', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const nb = await prisma.noteNotebook.findFirst({ where: { id: req.body.notebookId, userId: user.id }, select: { id: true, _count: { select: { sections: true } } } });
    if (!nb) throw httpError(404, 'Không tìm thấy sổ tay');
    if (nb._count.sections >= 200) throw httpError(400, 'Tối đa 200 mục mỗi sổ');
    const section = await prisma.noteSection.create({
      data: { notebookId: nb.id, userId: user.id, name: cleanName(req.body.name, 'Mục mới'), color: cleanColor(req.body.color) || '#3b82f6', order: nb._count.sections },
      select: { id: true, name: true, color: true, order: true, notebookId: true },
    });
    res.json({ ...section, count: 0 });
  } catch (err) { sendError(res, err, 'create section'); }
});

router.patch('/sections/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const data = {};
    if (req.body.name !== undefined) data.name = cleanName(req.body.name, 'Mục');
    if (req.body.color !== undefined) data.color = cleanColor(req.body.color) || '#3b82f6';
    if (req.body.notebookId !== undefined) {
      const nb = await prisma.noteNotebook.findFirst({ where: { id: req.body.notebookId, userId: user.id }, select: { id: true } });
      if (!nb) throw httpError(404, 'Không tìm thấy sổ tay đích');
      data.notebookId = nb.id;
    }
    const { count } = await prisma.noteSection.updateMany({ where: { id: req.params.id, userId: user.id }, data });
    if (!count) throw httpError(404, 'Không tìm thấy mục');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'update section'); }
});

router.post('/sections/reorder', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    await reorder('NoteSection', user.id, req.body.ids);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'reorder sections'); }
});

router.delete('/sections/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const section = await prisma.noteSection.findFirst({ where: { id: req.params.id, userId: user.id }, select: { id: true } });
    if (!section) throw httpError(404, 'Không tìm thấy mục');
    await prisma.$transaction([
      prisma.notePage.updateMany({ where: { userId: user.id, sectionId: section.id, deletedAt: null }, data: { deletedAt: new Date() } }),
      prisma.notePage.updateMany({ where: { userId: user.id, sectionId: section.id }, data: { sectionId: null } }),
      prisma.noteSection.delete({ where: { id: section.id } }),
    ]);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete section'); }
});

// ── Danh sách trang ─────────────────────────────────────────────────────────────────────────
// view: section (cần sectionId) | inbox | all | pinned | archived | trash | tag (cần tag) | study | recent
router.get('/pages', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const { view = 'all', sectionId, tag, q, sort = 'updated' } = req.query;
    const take = Math.min(Number(req.query.take) || 60, 200);
    const skip = Math.max(Number(req.query.skip) || 0, 0);
    const where = { userId: user.id, AND: parseQuery(q) };
    if (view === 'trash') where.deletedAt = { not: null };
    else {
      where.deletedAt = null;
      if (view === 'archived') where.archivedAt = { not: null };
      else if (view !== 'all' || !q) where.archivedAt = null;
    }
    if (view === 'section') where.sectionId = String(sectionId || '');
    if (view === 'inbox') where.sectionId = null;
    if (view === 'pinned') where.pinned = true;
    if (view === 'tag') where.tags = { has: String(tag || '') };
    if (view === 'study') where.studyDueAt = { lte: new Date() };
    const orderBy = view === 'section' && !q
      ? [{ order: 'asc' }, { createdAt: 'asc' }]
      : sort === 'created' ? [{ createdAt: 'desc' }] : sort === 'title' ? [{ title: 'asc' }] : [{ pinned: 'desc' }, { updatedAt: 'desc' }];
    const [pages, total] = await Promise.all([
      prisma.notePage.findMany({ where, orderBy, take, skip, select: LIST_SELECT }),
      prisma.notePage.count({ where }),
    ]);
    res.json({ pages, total });
  } catch (err) { sendError(res, err, 'list pages'); }
});

// ── Một trang ───────────────────────────────────────────────────────────────────────────────
async function linksWithAccess(user, links) {
  if (!links.length) return [];
  const byType = {};
  links.forEach((l) => { (byType[l.targetType] ||= []).push(l.targetId); });
  const okSets = Object.fromEntries(await Promise.all(Object.entries(byType).map(async ([type, ids]) => [type, await accessibleIds(user, type, ids)])));
  return links.map((l) => ({ ...l, accessible: okSets[l.targetType]?.has(l.targetId) ?? false, href: linkHref(user, l) }));
}

router.get('/pages/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const page = await prisma.notePage.findFirst({
      where: { id: req.params.id, userId: user.id },
      select: {
        ...LIST_SELECT, contentJson: true, version: true, studyStep: true, style: true,
        section: { select: { id: true, name: true, notebook: { select: { id: true, name: true, aiDisabled: true } } } },
        attachments: { select: { id: true, kind: true, name: true, mime: true, size: true, url: true, createdAt: true, transcript: true }, orderBy: { createdAt: 'asc' } },
        links: { select: { id: true, targetType: true, targetId: true, label: true, classroomId: true } },
        shares: { select: { id: true, scope: true, classroomId: true, teacherId: true, allowCopy: true, feedback: true, feedbackAt: true, createdAt: true } },
        children: { where: { deletedAt: null }, select: { id: true, title: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!page) throw httpError(404, 'Không tìm thấy trang ghi chú');
    const [backlinks, links, teacherNames] = await Promise.all([
      prisma.notePage.findMany({ where: { userId: user.id, deletedAt: null, linkedPageIds: { has: page.id } }, select: { id: true, title: true }, take: 50 }),
      linksWithAccess(user, page.links),
      page.shares.some((s) => s.teacherId)
        ? prisma.user.findMany({ where: { id: { in: page.shares.map((s) => s.teacherId).filter(Boolean) } }, select: { id: true, name: true } })
        : [],
    ]);
    const tName = Object.fromEntries(teacherNames.map((t) => [t.id, t.name]));
    const cName = Object.fromEntries([...user.classroomsOwned, ...user.classroomsJoined].map((c) => [c.id, c.name]));
    res.json({
      ...page, backlinks, links,
      shares: page.shares.map((s) => ({ ...s, targetName: s.scope === 'CLASSROOM' ? cName[s.classroomId] || 'Lớp học' : tName[s.teacherId] || 'Giáo viên' })),
    });
  } catch (err) { sendError(res, err, 'get page'); }
});

async function validateParent(userId, pageId, parentId) {
  if (!parentId) return null;
  if (parentId === pageId) throw httpError(400, 'Không thể đặt trang làm trang con của chính nó');
  let depth = 1;
  let cursor = parentId;
  while (cursor) {
    if (cursor === pageId) throw httpError(400, 'Không thể chuyển trang vào trang con của chính nó');
    const p = await prisma.notePage.findFirst({ where: { id: cursor, userId }, select: { parentId: true } });
    if (!p) throw httpError(404, 'Không tìm thấy trang cha');
    cursor = p.parentId;
    depth += 1;
    if (depth > MAX_DEPTH) throw httpError(400, `Trang chỉ lồng tối đa ${MAX_DEPTH} cấp`);
  }
  return parentId;
}

async function validateSection(userId, sectionId) {
  if (!sectionId) return null;
  const s = await prisma.noteSection.findFirst({ where: { id: sectionId, userId }, select: { id: true } });
  if (!s) throw httpError(404, 'Không tìm thấy mục');
  return s.id;
}

function derived(title, doc, tags) {
  const plainText = docPlainText(doc);
  return {
    plainText,
    excerpt: plainText.replace(/\s+/g, ' ').trim().slice(0, 200),
    wordCount: (plainText.match(/\S+/g) || []).length,
    linkedPageIds: docLinkedPageIds(doc),
    searchText: buildSearchText({ title, plainText, tags }),
  };
}

async function syncTasks(pageId, userId, doc) {
  const tasks = docTasks(doc).slice(0, 500);
  await prisma.$transaction([
    prisma.noteTask.deleteMany({ where: { pageId } }),
    ...(tasks.length ? [prisma.noteTask.createMany({ data: tasks.map((t) => ({ ...t, pageId, userId })), skipDuplicates: true })] : []),
  ]);
}

router.post('/pages', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const total = await prisma.notePage.count({ where: { userId: user.id } });
    if (total >= 5000) throw httpError(400, 'Đã đạt giới hạn 5.000 trang. Hãy dọn bớt thùng rác hoặc trang cũ.');
    const parentId = await validateParent(user.id, null, req.body.parentId);
    // Trang con luôn nằm cùng mục với trang cha
    const sectionId = parentId
      ? (await prisma.notePage.findUnique({ where: { id: parentId }, select: { sectionId: true } }))?.sectionId ?? null
      : await validateSection(user.id, req.body.sectionId);
    const title = String(req.body.title || '').slice(0, 300);
    const tags = cleanTags(req.body.tags);
    const doc = sanitizeDoc(req.body.contentJson || { type: 'doc', content: [{ type: 'paragraph' }] });
    const page = await prisma.notePage.create({
      data: {
        userId: user.id, sectionId, parentId, title, tags, contentJson: doc, template: req.body.template ? String(req.body.template).slice(0, 40) : null,
        color: cleanColor(req.body.color), style: jsonOrUndef(cleanStyle(req.body.style)), order: total, ...derived(title, doc, tags),
      },
      select: { ...LIST_SELECT, version: true, contentJson: true, style: true },
    });
    await syncTasks(page.id, user.id, doc);
    res.json(page);
  } catch (err) { sendError(res, err, 'create page'); }
});

router.patch('/pages/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const body = req.body;
    const current = await ownPage(user.id, req.params.id, { id: true, title: true, contentJson: true, tags: true, version: true, plainText: true, updatedAt: true });
    const data = {};
    const contentChange = body.contentJson !== undefined || body.title !== undefined;
    if (contentChange) {
      if (Number(body.baseVersion) !== current.version) {
        const fresh = await prisma.notePage.findUnique({ where: { id: current.id }, select: { title: true, contentJson: true, version: true, updatedAt: true } });
        return res.status(409).json({ error: 'Trang đã được sửa ở thiết bị/tab khác', conflict: true, page: fresh });
      }
      data.version = current.version + 1;
    }
    const title = body.title !== undefined ? String(body.title).slice(0, 300) : current.title;
    const tags = body.tags !== undefined ? cleanTags(body.tags) : current.tags;
    const doc = body.contentJson !== undefined ? sanitizeDoc(body.contentJson) : current.contentJson;
    if (body.title !== undefined) data.title = title;
    if (body.tags !== undefined) data.tags = tags;
    if (body.contentJson !== undefined) data.contentJson = doc;
    if (contentChange || body.tags !== undefined) {
      const attachments = await prisma.noteAttachment.findMany({ where: { pageId: current.id }, select: { ocrText: true, transcript: true, name: true } });
      const d = derived(title, doc, tags);
      Object.assign(data, d, { searchText: buildSearchText({ title, plainText: d.plainText, tags }, attachments) });
    }
    if (body.color !== undefined) data.color = cleanColor(body.color);
    if (body.style !== undefined) data.style = cleanStyle(body.style) ?? Prisma.DbNull;
    if (body.pinned !== undefined) data.pinned = !!body.pinned;
    if (body.archived !== undefined) data.archivedAt = body.archived ? new Date() : null;
    if (body.remindAt !== undefined) {
      const d = body.remindAt ? new Date(body.remindAt) : null;
      data.remindAt = d && !isNaN(d) ? d : null;
    }
    if (body.study !== undefined) {
      // Bật "Ôn lại trang này": lần ôn đầu sau 1 ngày; tắt thì xoá lịch
      data.studyStep = 0;
      data.studyDueAt = body.study ? new Date(Date.now() + 86400_000) : null;
    }
    if (body.sectionId !== undefined) data.sectionId = await validateSection(user.id, body.sectionId);
    if (body.parentId !== undefined) data.parentId = await validateParent(user.id, current.id, body.parentId);
    if (body.parentId && body.sectionId === undefined) {
      const parent = await prisma.notePage.findUnique({ where: { id: body.parentId }, select: { sectionId: true } });
      data.sectionId = parent?.sectionId ?? null;
    }

    // Lịch sử phiên bản: chụp bản CŨ khi lần chụp gần nhất đã cách ≥10 phút (giữ 30 bản/trang)
    let snapshot = false;
    if (body.contentJson !== undefined && current.plainText.trim()) {
      const last = await prisma.noteRevision.findFirst({ where: { pageId: current.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } });
      snapshot = !last || Date.now() - last.createdAt.getTime() > 10 * 60_000;
    }
    // updateMany + version trong where: chặn 2 lần lưu chạy đua cùng ghi đè nhau
    const where = contentChange ? { id: current.id, version: current.version } : { id: current.id };
    const { count } = await prisma.notePage.updateMany({ where, data });
    if (!count) throw httpError(409, 'Trang đã được sửa ở thiết bị/tab khác');
    const [updated] = await Promise.all([
      prisma.notePage.findUnique({ where: { id: current.id }, select: { ...LIST_SELECT, version: true } }),
      snapshot ? prisma.noteRevision.create({ data: { pageId: current.id, title: current.title, contentJson: current.contentJson } }) : null,
    ]);
    if (body.contentJson !== undefined) {
      await syncTasks(current.id, user.id, doc);
      if (snapshot) {
        const old = await prisma.noteRevision.findMany({ where: { pageId: current.id }, orderBy: { createdAt: 'desc' }, skip: 30, select: { id: true } });
        if (old.length) prisma.noteRevision.deleteMany({ where: { id: { in: old.map((r) => r.id) } } }).catch(() => {});
      }
    }
    res.json(updated);
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ error: err.message, conflict: true });
    sendError(res, err, 'update page');
  }
});

router.post('/pages/reorder', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    await reorder('NotePage', user.id, req.body.ids);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'reorder pages'); }
});

router.post('/pages/:id/duplicate', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const src = await ownPage(user.id, req.params.id);
    const page = await prisma.notePage.create({
      data: {
        userId: user.id, sectionId: src.sectionId, parentId: src.parentId, title: `${src.title || 'Không tiêu đề'} (bản sao)`.slice(0, 300),
        contentJson: src.contentJson ?? undefined, plainText: src.plainText, excerpt: src.excerpt, searchText: src.searchText, tags: src.tags,
        color: src.color, style: jsonOrUndef(src.style), template: src.template, wordCount: src.wordCount, linkedPageIds: src.linkedPageIds, order: src.order + 1,
      },
      select: LIST_SELECT,
    });
    if (src.contentJson) await syncTasks(page.id, user.id, src.contentJson);
    res.json(page);
  } catch (err) { sendError(res, err, 'duplicate page'); }
});

// Xoá mềm (kèm toàn bộ trang con) → thùng rác 30 ngày
async function descendantIds(userId, rootId) {
  const ids = [rootId];
  let frontier = [rootId];
  for (let i = 0; i < MAX_DEPTH && frontier.length; i += 1) {
    const kids = await prisma.notePage.findMany({ where: { userId, parentId: { in: frontier } }, select: { id: true } });
    frontier = kids.map((k) => k.id);
    ids.push(...frontier);
  }
  return ids;
}

router.delete('/pages/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    await ownPage(user.id, req.params.id, { id: true });
    const ids = await descendantIds(user.id, req.params.id);
    await prisma.notePage.updateMany({ where: { id: { in: ids }, userId: user.id, deletedAt: null }, data: { deletedAt: new Date(), pinned: false } });
    res.json({ ok: true, count: ids.length });
  } catch (err) { sendError(res, err, 'trash page'); }
});

router.post('/pages/:id/restore', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const page = await ownPage(user.id, req.params.id, { id: true, sectionId: true, parentId: true });
    const ids = await descendantIds(user.id, page.id);
    const parentAlive = page.parentId ? await prisma.notePage.count({ where: { id: page.parentId, deletedAt: null } }) : 1;
    await prisma.$transaction([
      prisma.notePage.updateMany({ where: { id: { in: ids }, userId: user.id }, data: { deletedAt: null } }),
      ...(parentAlive ? [] : [prisma.notePage.update({ where: { id: page.id }, data: { parentId: null } })]),
    ]);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'restore page'); }
});

async function hardDelete(userId, where) {
  const pages = await prisma.notePage.findMany({ where: { ...where, userId }, select: { id: true, attachments: { select: { storagePath: true } } } });
  if (!pages.length) return 0;
  await removeNoteFiles(pages.flatMap((p) => p.attachments.map((a) => a.storagePath)));
  await prisma.noteAttachment.deleteMany({ where: { pageId: { in: pages.map((p) => p.id) } } });
  const { count } = await prisma.notePage.deleteMany({ where: { id: { in: pages.map((p) => p.id) }, userId } });
  return count;
}

router.delete('/pages/:id/permanent', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const count = await hardDelete(user.id, { id: req.params.id, deletedAt: { not: null } });
    if (!count) throw httpError(404, 'Trang không có trong thùng rác');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete page'); }
});

router.delete('/trash', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const count = await hardDelete(user.id, { deletedAt: { not: null } });
    res.json({ ok: true, count });
  } catch (err) { sendError(res, err, 'empty trash'); }
});

// ── Lịch sử phiên bản ───────────────────────────────────────────────────────────────────────
router.get('/pages/:id/revisions', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    await ownPage(user.id, req.params.id, { id: true });
    const revisions = await prisma.noteRevision.findMany({ where: { pageId: req.params.id }, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, createdAt: true } });
    res.json(revisions);
  } catch (err) { sendError(res, err, 'revisions'); }
});

router.get('/revisions/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const rev = await prisma.noteRevision.findUnique({ where: { id: req.params.id }, select: { id: true, title: true, contentJson: true, createdAt: true, page: { select: { userId: true } } } });
    if (!rev || rev.page.userId !== user.id) throw httpError(404, 'Không tìm thấy phiên bản');
    const { page, ...data } = rev;
    res.json(data);
  } catch (err) { sendError(res, err, 'revision'); }
});

// ── Việc cần làm & nhắc việc ────────────────────────────────────────────────────────────────
router.get('/tasks', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const filter = req.query.filter || 'open';
    const where = { userId: user.id, page: { deletedAt: null } };
    if (filter === 'open') where.done = false;
    if (filter === 'done') where.done = true;
    const tasks = await prisma.noteTask.findMany({
      where, take: 500,
      orderBy: [{ done: 'asc' }, { dueAt: { sort: 'asc', nulls: 'last' } }],
      select: { id: true, text: true, done: true, dueAt: true, tid: true, page: { select: { id: true, title: true } } },
    });
    res.json(tasks);
  } catch (err) { sendError(res, err, 'tasks'); }
});

router.post('/tasks/:id/toggle', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const task = await prisma.noteTask.findFirst({ where: { id: req.params.id, userId: user.id }, select: { id: true, tid: true, pageId: true } });
    if (!task) throw httpError(404, 'Không tìm thấy việc cần làm');
    const page = await prisma.notePage.findUnique({ where: { id: task.pageId }, select: { contentJson: true, version: true } });
    const doc = page.contentJson;
    const done = !!req.body.done;
    if (!doc || !setTaskChecked(doc, task.tid, done)) throw httpError(404, 'Việc này không còn trong trang');
    await prisma.$transaction([
      prisma.notePage.update({ where: { id: task.pageId }, data: { contentJson: doc, version: page.version + 1 } }),
      prisma.noteTask.update({ where: { id: task.id }, data: { done } }),
    ]);
    res.json({ ok: true, version: page.version + 1 });
  } catch (err) { sendError(res, err, 'toggle task'); }
});

// ── File đính kèm ───────────────────────────────────────────────────────────────────────────
router.post('/attachments', upload.single('file'), async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    if (!req.file) throw httpError(400, 'Thiếu file');
    const pageId = req.body.pageId ? (await ownPage(user.id, req.body.pageId, { id: true })).id : null;
    const kind = req.file.mimetype.startsWith('image/') ? 'IMAGE' : req.file.mimetype.startsWith('audio/') ? 'AUDIO' : 'FILE';
    const { url, storagePath } = await uploadNoteFile(user.id, req.file, kind.toLowerCase());
    const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);
    const att = await prisma.noteAttachment.create({
      data: { userId: user.id, pageId, kind, name, mime: req.file.mimetype, size: req.file.size, url, storagePath },
      select: { id: true, kind: true, name: true, mime: true, size: true, url: true, createdAt: true },
    });
    res.json(att);
  } catch (err) { sendError(res, err, 'upload'); }
});

// Chữ OCR (tesseract.js chạy trên trình duyệt) gửi lên để tìm được chữ trong ảnh
router.patch('/attachments/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const att = await prisma.noteAttachment.findFirst({ where: { id: req.params.id, userId: user.id }, select: { id: true, pageId: true } });
    if (!att) throw httpError(404, 'Không tìm thấy file');
    const data = {};
    if (req.body.ocrText !== undefined) data.ocrText = String(req.body.ocrText || '').slice(0, 50000);
    // Bản chép lời ghi âm (khi đưa ghi chú làm trên máy lên tài khoản — ghi âm của khách đã được chép lời sẵn)
    if (Array.isArray(req.body.transcript)) {
      data.transcript = req.body.transcript.slice(0, 5000).map((x) => ({ start: Number(x?.start) || 0, end: Number(x?.end) || 0, text: String(x?.text || '').slice(0, 2000) })).filter((x) => x.text);
    }
    if (req.body.pageId !== undefined) data.pageId = req.body.pageId ? (await ownPage(user.id, req.body.pageId, { id: true })).id : null;
    await prisma.noteAttachment.update({ where: { id: att.id }, data });
    const pageId = data.pageId ?? att.pageId;
    if (pageId) await refreshSearchText(pageId);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'update attachment'); }
});

router.delete('/attachments/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const att = await prisma.noteAttachment.findFirst({ where: { id: req.params.id, userId: user.id }, select: { id: true, storagePath: true, pageId: true } });
    if (!att) throw httpError(404, 'Không tìm thấy file');
    await removeNoteFiles([att.storagePath]);
    await prisma.noteAttachment.delete({ where: { id: att.id } });
    if (att.pageId) await refreshSearchText(att.pageId);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete attachment'); }
});

router.get('/attachments', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const [files, used] = await Promise.all([
      prisma.noteAttachment.findMany({
        where: { userId: user.id }, orderBy: { size: 'desc' }, take: 300,
        select: { id: true, kind: true, name: true, size: true, url: true, createdAt: true, page: { select: { id: true, title: true, deletedAt: true } } },
      }),
      storageUsed(user.id),
    ]);
    res.json({ files, used, quota: STORAGE_QUOTA_BYTES });
  } catch (err) { sendError(res, err, 'list attachments'); }
});

// ── Liên kết với lớp học ────────────────────────────────────────────────────────────────────
const nowDate = () => new Date();
function classIds(user) {
  return user.role === 'TEACHER' ? user.classroomsOwned.map((c) => c.id) : user.classroomsJoined.map((c) => c.id);
}
function canLink(user) {
  return user.role === 'TEACHER' ? true : user.classroomsJoined.length > 0;
}

// Điều kiện "người dùng được xem nội dung này" theo từng loại — dùng cho cả bộ chọn lẫn kiểm tra lại lúc đọc
function targetWhere(user, type) {
  const cls = classIds(user);
  const T = user.role === 'TEACHER';
  switch (type) {
    case 'CLASSROOM': return { model: prisma.classroom, where: { id: { in: cls } }, label: 'name' };
    case 'LESSON': return {
      model: prisma.lesson, label: 'title',
      where: T ? { OR: [{ uploadedById: user.id }, { classroomId: { in: cls } }] }
        : { classroomId: { in: cls }, OR: [{ publishTime: null }, { publishTime: { lte: nowDate() } }] },
    };
    case 'EXAM': return {
      model: prisma.exam, label: 'title',
      where: T ? { OR: [{ uploadedById: user.id }, { classroomId: { in: cls } }] } : { assignedStudents: { some: { id: user.id } } },
    };
    case 'IELTS_TEST': return {
      model: prisma.ieltsTest, label: 'title',
      where: T ? { book: { teacherId: user.id } }
        : { status: 'PUBLISHED', OR: [{ classrooms: { some: { id: { in: cls } } } }, { assignedStudents: { some: { id: user.id } } }] },
    };
    case 'DOCUMENT': return {
      model: prisma.document, label: 'title',
      where: T ? { OR: [{ uploadedById: user.id }, { classroomId: { in: cls } }] } : { classroomId: { in: cls } },
    };
    case 'STUDENT': return T ? {
      model: prisma.user, label: 'name',
      where: { role: 'STUDENT', OR: [{ classroomsJoined: { some: { teacherId: user.id } } }, { managerTeacherId: user.id }] },
    } : null;
    default: return null;
  }
}

async function accessibleIds(user, type, ids) {
  const t = targetWhere(user, type);
  if (!t) return new Set();
  const rows = await t.model.findMany({ where: { AND: [t.where, { id: { in: ids } }] }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

function linkHref(user, l) {
  const T = user.role === 'TEACHER';
  switch (l.targetType) {
    case 'LESSON': return `/lesson/${l.targetId}`;
    case 'EXAM': return T ? '/teacher' : `/exam/${l.targetId}`;
    case 'IELTS_TEST': return T ? `/teacher/ielts/${l.targetId}` : '/ielts';
    case 'CLASSROOM': case 'DOCUMENT': case 'STUDENT': return T ? '/teacher' : '/dashboard';
    default: return null;
  }
}

router.get('/link-targets', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    if (!canLink(user)) throw httpError(403, 'Tính năng liên kết dành cho thành viên lớp học');
    const type = String(req.query.type || '');
    const t = targetWhere(user, type);
    if (!t) throw httpError(400, 'Loại liên kết không hợp lệ');
    const q = String(req.query.q || '').trim();
    const select = { id: true, [t.label]: true };
    if (['LESSON', 'EXAM', 'DOCUMENT'].includes(type)) select.classroom = { select: { id: true, name: true } };
    if (type === 'STUDENT') select.email = true;
    const rows = await t.model.findMany({
      where: { AND: [t.where, ...(q ? [{ [t.label]: { contains: q, mode: 'insensitive' } }] : [])] },
      select, take: 30, orderBy: type === 'STUDENT' || type === 'CLASSROOM' ? { [t.label]: 'asc' } : { createdAt: 'desc' },
    });
    res.json(rows.map((r) => ({
      id: r.id, label: r[t.label], sub: r.classroom?.name || r.email || '', classroomId: r.classroom?.id || (type === 'CLASSROOM' ? r.id : null),
    })));
  } catch (err) { sendError(res, err, 'link targets'); }
});

router.post('/pages/:id/links', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    if (!canLink(user)) throw httpError(403, 'Tính năng liên kết dành cho thành viên lớp học');
    const page = await ownPage(user.id, req.params.id, { id: true, shares: { select: { id: true } } });
    const { targetType, targetId } = req.body;
    if (!LINK_TYPES.includes(targetType)) throw httpError(400, 'Loại liên kết không hợp lệ');
    if (targetType === 'STUDENT' && page.shares.length) throw httpError(400, 'Trang đang được chia sẻ — không thể gắn ghi chú về học viên (luôn riêng tư). Hãy ngừng chia sẻ trước.');
    const t = targetWhere(user, targetType);
    const row = t && await t.model.findFirst({
      where: { AND: [t.where, { id: String(targetId || '') }] },
      select: { id: true, [t.label]: true, ...(['LESSON', 'EXAM', 'DOCUMENT'].includes(targetType) ? { classroomId: true } : {}) },
    });
    if (!row) throw httpError(403, 'Bạn không có quyền truy cập nội dung này');
    const link = await prisma.noteLink.upsert({
      where: { pageId_targetType_targetId: { pageId: page.id, targetType, targetId: row.id } },
      create: { pageId: page.id, userId: user.id, targetType, targetId: row.id, label: String(row[t.label] || '').slice(0, 200), classroomId: row.classroomId || (targetType === 'CLASSROOM' ? row.id : null) },
      update: { label: String(row[t.label] || '').slice(0, 200) },
      select: { id: true, targetType: true, targetId: true, label: true, classroomId: true },
    });
    res.json({ ...link, accessible: true, href: linkHref(user, link) });
  } catch (err) { sendError(res, err, 'add link'); }
});

router.delete('/links/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const { count } = await prisma.noteLink.deleteMany({ where: { id: req.params.id, userId: user.id } });
    if (!count) throw httpError(404, 'Không tìm thấy liên kết');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete link'); }
});

// "Ghi chú của tôi" trên trang bài học/đề thi/lớp: trang của chính người dùng đã liên kết với nội dung đó
router.get('/linked', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const pages = await prisma.notePage.findMany({
      where: { userId: user.id, deletedAt: null, links: { some: { targetType: String(req.query.type || ''), targetId: String(req.query.id || '') } } },
      select: { id: true, title: true, excerpt: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 20,
    });
    res.json(pages);
  } catch (err) { sendError(res, err, 'linked'); }
});

// ── Chia sẻ ─────────────────────────────────────────────────────────────────────────────────
router.post('/pages/:id/shares', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const page = await ownPage(user.id, req.params.id, { id: true, links: { where: { targetType: 'STUDENT' }, select: { id: true } } });
    if (page.links.length) throw httpError(400, 'Trang có ghi chú về học viên nên luôn riêng tư, không chia sẻ được');
    const { scope } = req.body;
    let data;
    if (scope === 'CLASSROOM') {
      if (user.role !== 'TEACHER') throw httpError(403, 'Chỉ giáo viên chia sẻ được cho cả lớp');
      const cls = user.classroomsOwned.find((c) => c.id === req.body.classroomId);
      if (!cls) throw httpError(403, 'Bạn không dạy lớp này');
      data = { scope, classroomId: cls.id, allowCopy: !!req.body.allowCopy };
    } else if (scope === 'TEACHER') {
      if (user.role !== 'STUDENT') throw httpError(403, 'Chỉ học viên gửi trang cho giáo viên');
      const teacherIds = new Set([...user.classroomsJoined.map((c) => c.teacherId), user.managerTeacherId].filter(Boolean));
      if (!teacherIds.has(req.body.teacherId)) throw httpError(403, 'Bạn chỉ gửi được cho giáo viên của lớp mình hoặc giáo viên phụ trách');
      data = { scope, teacherId: req.body.teacherId };
    } else throw httpError(400, 'Phạm vi chia sẻ không hợp lệ');
    const existing = await prisma.noteShare.findFirst({ where: { pageId: page.id, scope, classroomId: data.classroomId || null, teacherId: data.teacherId || null } });
    const share = existing
      ? await prisma.noteShare.update({ where: { id: existing.id }, data: { allowCopy: data.allowCopy ?? existing.allowCopy } })
      : await prisma.noteShare.create({ data: { ...data, pageId: page.id, ownerId: user.id } });
    res.json(share);
  } catch (err) { sendError(res, err, 'share'); }
});

router.delete('/shares/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const { count } = await prisma.noteShare.deleteMany({ where: { id: req.params.id, ownerId: user.id } });
    if (!count) throw httpError(404, 'Không tìm thấy lượt chia sẻ');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'unshare'); }
});

// Danh sách giáo viên học viên gửi trang được (giáo viên các lớp + giáo viên phụ trách)
router.get('/share-teachers', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    if (user.role !== 'STUDENT') return res.json([]);
    const ids = [...new Set([...user.classroomsJoined.map((c) => c.teacherId), user.managerTeacherId].filter(Boolean))];
    const teachers = await prisma.user.findMany({ where: { id: { in: ids }, role: 'TEACHER' }, select: { id: true, name: true } });
    res.json(teachers);
  } catch (err) { sendError(res, err, 'share teachers'); }
});

function shareVisibleWhere(user) {
  return user.role === 'TEACHER'
    ? { scope: 'TEACHER', teacherId: user.id }
    : { scope: 'CLASSROOM', classroomId: { in: user.classroomsJoined.map((c) => c.id) } };
}

router.get('/shared', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const shares = await prisma.noteShare.findMany({
      where: { ...shareVisibleWhere(user), page: { deletedAt: null } }, orderBy: { createdAt: 'desc' }, take: 200,
      select: {
        id: true, scope: true, classroomId: true, allowCopy: true, feedback: true, feedbackAt: true, createdAt: true, ownerId: true,
        page: { select: { id: true, title: true, excerpt: true, updatedAt: true, wordCount: true, user: { select: { name: true } } } },
      },
    });
    const cName = Object.fromEntries([...user.classroomsOwned, ...user.classroomsJoined].map((c) => [c.id, c.name]));
    res.json(shares.map(({ page, ...s }) => ({
      ...s, ownerName: page.user.name, classroomName: s.classroomId ? cName[s.classroomId] : null,
      page: { id: page.id, title: page.title, excerpt: page.excerpt, updatedAt: page.updatedAt, wordCount: page.wordCount },
    })));
  } catch (err) { sendError(res, err, 'shared list'); }
});

async function loadShare(user, shareId) {
  const share = await prisma.noteShare.findFirst({
    where: { id: shareId, ...shareVisibleWhere(user) },
    select: {
      id: true, scope: true, allowCopy: true, feedback: true, feedbackAt: true, ownerId: true, classroomId: true,
      page: { select: { id: true, title: true, contentJson: true, style: true, plainText: true, tags: true, updatedAt: true, deletedAt: true, user: { select: { name: true } } } },
    },
  });
  if (!share || share.page.deletedAt) throw httpError(404, 'Trang không còn được chia sẻ với bạn');
  return share;
}

router.get('/shared/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const { page, ...share } = await loadShare(user, req.params.id);
    res.json({ ...share, ownerName: page.user.name, page: { id: page.id, title: page.title, contentJson: page.contentJson, style: page.style, tags: page.tags, updatedAt: page.updatedAt } });
  } catch (err) { sendError(res, err, 'shared page'); }
});

router.post('/shared/:id/feedback', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    if (user.role !== 'TEACHER') throw httpError(403, 'Chỉ giáo viên góp ý được');
    const share = await loadShare(user, req.params.id);
    const feedback = String(req.body.feedback || '').trim().slice(0, 5000);
    await prisma.noteShare.update({ where: { id: share.id }, data: { feedback: feedback || null, feedbackAt: feedback ? new Date() : null } });
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'feedback'); }
});

router.post('/shared/:id/copy', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const share = await loadShare(user, req.params.id);
    if (!share.allowCopy) throw httpError(403, 'Giáo viên không cho phép tạo bản sao trang này');
    const doc = share.page.contentJson ? sanitizeDoc(share.page.contentJson) : null;
    const title = share.page.title || 'Ghi chú từ giáo viên';
    const page = await prisma.notePage.create({
      data: { userId: user.id, title, contentJson: doc ?? undefined, style: jsonOrUndef(share.page.style), tags: share.page.tags, ...derived(title, doc, share.page.tags) },
      select: LIST_SELECT,
    });
    if (doc) await syncTasks(page.id, user.id, doc);
    res.json(page);
  } catch (err) { sendError(res, err, 'copy shared'); }
});

// ── Dọn dẹp: trang gần như trùng nhau (so sánh tập từ, không cần AI) ─────────────────────────
router.get('/cleanup/duplicates', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const pages = await prisma.notePage.findMany({
      where: { userId: user.id, deletedAt: null, wordCount: { gte: 20 } },
      select: { id: true, title: true, plainText: true, updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 600,
    });
    const sets = pages.map((p) => ({ ...p, words: new Set(normalizeSearch(p.plainText).match(/[a-z0-9]{2,}/g) || []) }));
    const pairs = [];
    for (let i = 0; i < sets.length; i += 1) {
      for (let j = i + 1; j < sets.length; j += 1) {
        const a = sets[i].words; const b = sets[j].words;
        const small = a.size < b.size ? a : b; const big = small === a ? b : a;
        if (!small.size || small.size / big.size < 0.6) continue;
        let inter = 0;
        for (const w of small) if (big.has(w)) inter += 1;
        const score = inter / (a.size + b.size - inter);
        if (score >= 0.75) pairs.push({ score: Math.round(score * 100), a: { id: sets[i].id, title: sets[i].title, updatedAt: sets[i].updatedAt }, b: { id: sets[j].id, title: sets[j].title, updatedAt: sets[j].updatedAt } });
      }
    }
    res.json(pairs.sort((x, y) => y.score - x.score).slice(0, 30));
  } catch (err) { sendError(res, err, 'duplicates'); }
});

// Gộp trang B vào cuối trang A rồi đưa B vào thùng rác
router.post('/cleanup/merge', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const [a, b] = await Promise.all([ownPage(user.id, req.body.keepId), ownPage(user.id, req.body.mergeId)]);
    if (a.id === b.id) throw httpError(400, 'Hai trang giống nhau');
    const doc = sanitizeDoc({
      type: 'doc',
      content: [
        ...(a.contentJson?.content || []),
        { type: 'horizontalRule' },
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: `Gộp từ: ${b.title || 'Không tiêu đề'}` }] },
        ...(b.contentJson?.content || []),
      ],
    });
    const tags = cleanTags([...a.tags, ...b.tags]);
    await prisma.$transaction([
      prisma.notePage.update({ where: { id: a.id }, data: { contentJson: doc, tags, version: a.version + 1, ...derived(a.title, doc, tags) } }),
      prisma.notePage.update({ where: { id: b.id }, data: { deletedAt: new Date() } }),
      prisma.noteAttachment.updateMany({ where: { pageId: b.id }, data: { pageId: a.id } }),
    ]);
    await syncTasks(a.id, user.id, doc);
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'merge'); }
});

// ── Xuất toàn bộ (ZIP Markdown + JSON ở trình duyệt) — 100 trang / lượt, phân trang theo id ───────────
router.get('/export', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const cursor = String(req.query.cursor || '');
    const [pages, total] = await Promise.all([
      prisma.notePage.findMany({
        where: { userId: user.id, deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) }, orderBy: { id: 'asc' }, take: 100,
        select: { id: true, title: true, contentJson: true, style: true, tags: true, createdAt: true, updatedAt: true, parentId: true, section: { select: { name: true, notebook: { select: { name: true } } } } },
      }),
      cursor ? Promise.resolve(null) : prisma.notePage.count({ where: { userId: user.id, deletedAt: null } }),
    ]);
    res.json({ pages, next: pages.length === 100 ? pages[pages.length - 1].id : null, total: total ?? undefined });
  } catch (err) { sendError(res, err, 'export'); }
});

// ── Mẫu của tôi (lưu trang thành mẫu) ────────────────────────────────────────────────────────
router.get('/templates', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const rows = await prisma.noteTemplate.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, description: true, contentJson: true, style: true, tags: true } });
    res.json(rows);
  } catch (err) { sendError(res, err, 'templates'); }
});

router.post('/templates', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const count = await prisma.noteTemplate.count({ where: { userId: user.id } });
    if (count >= 100) throw httpError(400, 'Tối đa 100 mẫu riêng. Hãy xoá bớt mẫu cũ.');
    const page = await ownPage(user.id, req.body.pageId, { contentJson: true, style: true, tags: true, title: true });
    const tpl = await prisma.noteTemplate.create({
      data: {
        userId: user.id, name: cleanName(req.body.name, page.title || 'Mẫu của tôi'), description: String(req.body.description || '').trim().slice(0, 200),
        contentJson: sanitizeDoc(page.contentJson || { type: 'doc', content: [{ type: 'paragraph' }] }), style: jsonOrUndef(page.style), tags: page.tags,
      },
      select: { id: true, name: true, description: true, contentJson: true, style: true, tags: true },
    });
    res.json(tpl);
  } catch (err) { sendError(res, err, 'create template'); }
});

router.delete('/templates/:id', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const { count } = await prisma.noteTemplate.deleteMany({ where: { id: req.params.id, userId: user.id } });
    if (!count) throw httpError(404, 'Không tìm thấy mẫu');
    res.json({ ok: true });
  } catch (err) { sendError(res, err, 'delete template'); }
});

// ── Gợi ý cho dashboard (không gọi AI) ──────────────────────────────────────────────────────
router.get('/insights', async (req, res) => {
  try {
    const user = await loadNoteUser(uid(req));
    const now = new Date();
    const monthAgo = new Date(Date.now() - 30 * 86400_000);
    const [studyDue, overdue, errors] = await Promise.all([
      prisma.notePage.count({ where: { userId: user.id, deletedAt: null, studyDueAt: { lte: now } } }),
      prisma.noteTask.count({ where: { userId: user.id, done: false, dueAt: { lt: now }, page: { deletedAt: null } } }),
      prisma.noteWritingError.groupBy({ by: ['category'], where: { userId: user.id, createdAt: { gte: monthAgo } }, _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 1 }),
    ]);
    res.json({ studyDue, overdue, topError: errors[0] ? { category: errors[0].category, count: errors[0]._count.id } : null });
  } catch (err) { sendError(res, err, 'insights'); }
});

module.exports = router;
module.exports.helpers = { derived, syncTasks, cleanTags, LIST_SELECT, refreshSearchText, accessibleIds, targetWhere };
