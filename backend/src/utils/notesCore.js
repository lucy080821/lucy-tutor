// Tiện ích dùng chung cho Lucy Notes (notes.routes.js + notesAi.routes.js): xác thực người dùng theo
// mô hình phiên userId của app, xử lý JSON Tiptap (lọc node/mark, rút chữ, việc cần làm, liên kết trang),
// hạn mức AI lưu DB, upload file đính kèm, gọi Groq trả JSON. Xem CLAUDE.md mục "Lucy Notes".
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Groq } = require('groq-sdk');
const prisma = require('../lib/prisma');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');
const { computeAccessStatus } = require('./freeTrial');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const httpError = (status, message) => Object.assign(new Error(message), { status });

const removeAccents = (str) => String(str || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
const normalizeSearch = (str) => removeAccents(str).toLowerCase().replace(/\s+/g, ' ').trim();

// ── Người dùng ──────────────────────────────────────────────────────────────────────────────
// Chỉ STUDENT/TEACHER dùng Ghi chú (ADMIN là loại tài khoản riêng). Cache 60 giây vì mỗi lần lưu
// tự động đều đi qua đây — tránh thêm 1 truy vấn ~340ms vào mọi request.
const userCache = new Map();
async function loadNoteUser(userId) {
  if (!userId || typeof userId !== 'string') throw httpError(401, 'Bạn cần đăng nhập để dùng Ghi chú');
  const hit = userCache.get(userId);
  if (hit && hit.at > Date.now() - 60_000) return hit.user;
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, role: true, accessExpiresAt: true, targetScore: true, managerTeacherId: true,
      classroomsJoined: { select: { id: true, name: true, teacherId: true } },
      classroomsOwned: { select: { id: true, name: true } },
    },
  });
  // STUDENT/TEACHER dùng chung tài khoản app học; NOTES = tài khoản chỉ dành cho Ghi chú (notesAuth.routes.js)
  if (!row || !['STUDENT', 'TEACHER', 'NOTES'].includes(row.role)) throw httpError(401, 'Tài khoản không dùng được Ghi chú');
  const user = { ...row, ...computeAccessStatus(row) };
  userCache.set(userId, { user, at: Date.now() });
  return user;
}

// ── Tài liệu Tiptap ─────────────────────────────────────────────────────────────────────────
// Trình soạn chỉ biết các node/mark dưới đây; lọc ở server để JSON lạ (gửi tay qua API) không lọt
// vào trang chia sẻ/xuất file. Link chỉ nhận http(s)/mailto/đường dẫn nội bộ/mốc audio "#t=".
const NODE_TYPES = new Set([
  'doc', 'paragraph', 'text', 'heading', 'bulletList', 'orderedList', 'listItem', 'taskList', 'taskItem',
  'blockquote', 'codeBlock', 'horizontalRule', 'hardBreak', 'image', 'table', 'tableRow', 'tableCell',
  'tableHeader', 'callout', 'audioNote', 'mindmap',
]);
const MARK_TYPES = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link', 'highlight', 'textStyle']);
const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/)|#t=)/i;
const SAFE_SRC = /^https:\/\//i;
const MAX_DOC_BYTES = 1_500_000;

function sanitizeNode(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 60 || !NODE_TYPES.has(node.type)) return null;
  const out = { type: node.type };
  if (node.attrs && typeof node.attrs === 'object') {
    const attrs = { ...node.attrs };
    if (node.type === 'image' && !SAFE_SRC.test(String(attrs.src || ''))) return null;
    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v === 'string' && v.length > 20000) delete attrs[k];
    }
    out.attrs = attrs;
  }
  if (node.type === 'text') {
    out.text = String(node.text || '').slice(0, 100000);
    if (!out.text) return null;
  }
  if (Array.isArray(node.marks)) {
    const marks = node.marks.filter((m) => m && MARK_TYPES.has(m.type)).map((m) => {
      if (m.type !== 'link') return { type: m.type, ...(m.attrs ? { attrs: m.attrs } : {}) };
      // Giữ đủ các thuộc tính mà extension Link của trình soạn tạo ra (thiếu là mỗi lần mở trang trình soạn tự thêm
      // lại → bị coi là "đã sửa" và lưu thừa). Chỉ nhận chuỗi ngắn, target chỉ được null hoặc _blank.
      const href = String(m.attrs?.href || '');
      if (!SAFE_HREF.test(href)) return null;
      const s = (v) => (typeof v === 'string' ? v.slice(0, 200) : null);
      return { type: 'link', attrs: { href, target: m.attrs?.target === '_blank' ? '_blank' : null, rel: s(m.attrs?.rel), class: s(m.attrs?.class), title: s(m.attrs?.title) } };
    }).filter(Boolean);
    if (marks.length) out.marks = marks;
  }
  if (Array.isArray(node.content)) {
    out.content = node.content.map((c) => sanitizeNode(c, depth + 1)).filter(Boolean);
  }
  return out;
}

function sanitizeDoc(doc) {
  if (doc === null || doc === undefined) return null;
  if (JSON.stringify(doc).length > MAX_DOC_BYTES) throw httpError(413, 'Trang quá dài (tối đa khoảng 1,5MB). Hãy tách thành nhiều trang.');
  const clean = sanitizeNode(doc);
  return clean && clean.type === 'doc' ? clean : { type: 'doc', content: [{ type: 'paragraph' }] };
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote', 'codeBlock', 'tableRow', 'callout']);
function walk(node, fn, parents = []) {
  if (!node) return;
  fn(node, parents);
  if (Array.isArray(node.content)) node.content.forEach((c) => walk(c, fn, [...parents, node]));
}

/** Chữ thuần của 1 node (gồm cả transcript của khối ghi âm và nhãn sơ đồ tư duy). */
function nodeText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'audioNote') return '';
  if (node.type === 'mindmap') {
    const labels = [];
    const visit = (n) => { if (!n) return; labels.push(n.label || ''); (n.children || []).forEach(visit); };
    try { visit(JSON.parse(node.attrs?.data || '{}')); } catch { /* bỏ qua */ }
    return labels.filter(Boolean).join(' · ');
  }
  const inner = (node.content || []).map(nodeText);
  if (node.type === 'tableRow') return inner.join(' | ');
  return inner.join(BLOCK_TYPES.has(node.type) || node.type === 'doc' ? '' : '');
}

/** Các khối văn bản theo thứ tự (dùng cho tìm kiếm có trích dẫn + plainText). */
function docBlocks(doc) {
  const blocks = [];
  walk(doc, (node, parents) => {
    if (!BLOCK_TYPES.has(node.type) && node.type !== 'mindmap') return;
    // listItem/taskItem chứa paragraph → chỉ lấy ở paragraph trong cùng để không lặp chữ
    if (['listItem', 'taskItem', 'blockquote', 'callout'].includes(node.type)) return;
    if (node.type === 'paragraph' && parents.some((p) => p.type === 'tableRow')) return;
    const text = nodeText(node).trim();
    if (text) blocks.push({ type: node.type, text });
  });
  return blocks;
}

function docPlainText(doc) {
  return docBlocks(doc).map((b) => b.text).join('\n');
}

function docTasks(doc) {
  const tasks = [];
  walk(doc, (node) => {
    if (node.type !== 'taskItem') return;
    const tid = String(node.attrs?.tid || '');
    if (!tid) return;
    const text = (node.content || []).filter((c) => c.type === 'paragraph').map(nodeText).join(' ').trim();
    const due = node.attrs?.due ? new Date(node.attrs.due) : null;
    tasks.push({ tid, text: text.slice(0, 500) || '(việc chưa đặt tên)', done: !!node.attrs?.checked, dueAt: due && !isNaN(due) ? due : null });
  });
  return tasks;
}

const PAGE_LINK = /^\/notes\?p=([0-9a-f-]{36})/i;
function docLinkedPageIds(doc) {
  const ids = new Set();
  walk(doc, (node) => {
    for (const m of node.marks || []) {
      const hit = m.type === 'link' && PAGE_LINK.exec(String(m.attrs?.href || ''));
      if (hit) ids.add(hit[1]);
    }
  });
  return [...ids].slice(0, 200);
}

/** Đổi trạng thái 1 taskItem theo tid (dùng ở view "Việc cần làm" để tick mà không mở trang). */
function setTaskChecked(doc, tid, checked) {
  let found = false;
  walk(doc, (node) => {
    if (node.type === 'taskItem' && node.attrs?.tid === tid) { node.attrs.checked = checked; found = true; }
  });
  return found;
}

const contentHash = (title, plainText) => crypto.createHash('sha1').update(`${title}\n${plainText}`).digest('hex');

// ── Hạn mức AI ──────────────────────────────────────────────────────────────────────────────
const LIMITS = {
  TEXT: Number(process.env.NOTES_AI_DAILY) || 40, // lệnh AI chữ / người / ngày
  AUDIO: Number(process.env.NOTES_AUDIO_DAILY) || 6, // bản ghi âm chuyển thành ghi chú / người / ngày
};
const vnDay = (d = new Date()) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);

// Khách chưa đăng nhập (ghi chú lưu trên trình duyệt) vẫn dùng được AI với hạn mức thấp hơn theo IP + trần tổng mỗi ngày
const GUEST_LIMITS = {
  TEXT: Number(process.env.NOTES_GUEST_AI_DAILY) || 10,
  AUDIO: Number(process.env.NOTES_GUEST_AUDIO_DAILY) || 1,
};
const GUEST_TOTAL_CAP = { TEXT: Number(process.env.NOTES_GUEST_DAILY_CAP) || 500, AUDIO: Number(process.env.NOTES_GUEST_AUDIO_CAP) || 60 };
const GUEST_ALL = 'guest:*';
const limitsFor = (user) => (user.guest ? GUEST_LIMITS : LIMITS);

function clientIp(req) {
  // Server không bật trust proxy → lấy IP gốc từ x-forwarded-for (giống freeTools/passwordReset)
  return String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim() || 'unknown';
}

/** Người dùng đăng nhập (userId) hoặc khách (nhận diện bằng IP đã băm, không lưu IP gốc). */
async function loadNoteActor(req) {
  const userId = req.query.userId || req.body?.userId;
  if (userId) return loadNoteUser(userId);
  const ipHash = crypto.createHash('sha256').update(`lucy-notes:${clientIp(req)}`).digest('hex').slice(0, 24);
  return { id: `guest:${ipHash}`, guest: true, role: 'GUEST', name: 'Khách', accessLocked: false, classroomsJoined: [], classroomsOwned: [] };
}

function requireAccount(user, what = 'Tính năng này') {
  if (user.guest) throw httpError(401, `${what} cần đăng nhập (nối với dữ liệu trong tài khoản Lucy Tutor). Ghi chú thường vẫn dùng miễn phí không cần đăng nhập.`);
}

async function aiUsage(userIdOrUser) {
  const user = typeof userIdOrUser === 'string' ? { id: userIdOrUser } : userIdOrUser;
  const limits = limitsFor(user);
  const rows = await prisma.noteAiUsage.findMany({ where: { userId: user.id, day: vnDay() }, select: { kind: true, count: true } });
  const used = Object.fromEntries(rows.map((r) => [r.kind, r.count]));
  return Object.fromEntries(Object.entries(limits).map(([k, limit]) => [k, { used: used[k] || 0, limit, left: Math.max(0, limit - (used[k] || 0)) }]));
}

/** Kiểm tra + trừ 1 lượt trước khi gọi AI; gọi refund() nếu AI lỗi (lượt lỗi không bị tính). */
async function bump(userId, kind, amount, limit) {
  const day = vnDay();
  const row = await prisma.noteAiUsage.upsert({
    where: { userId_day_kind: { userId, day, kind } },
    create: { userId, day, kind, count: amount },
    update: { count: { increment: amount } },
  });
  const undo = () => prisma.noteAiUsage.update({ where: { id: row.id }, data: { count: { decrement: amount } } }).catch(() => {});
  return { over: row.count > limit, undo };
}

async function consumeAi(user, kind = 'TEXT', amount = 1) {
  if (user.accessLocked) throw httpError(403, 'Tài khoản đang bị khoá — AI tạm ngưng. Ghi chú của bạn vẫn xem và sửa được bình thường.');
  const limits = limitsFor(user);
  const mine = await bump(user.id, kind, amount, limits[kind]);
  if (mine.over) {
    await mine.undo();
    const tail = user.guest ? ' Đăng nhập (miễn phí) để có thêm lượt AI mỗi ngày.' : ' Quay lại vào ngày mai nhé.';
    throw httpError(429, kind === 'AUDIO'
      ? `Bạn đã dùng hết ${limits.AUDIO} lượt chuyển ghi âm thành ghi chú hôm nay.${tail}`
      : `Bạn đã dùng hết ${limits.TEXT} lượt AI hôm nay.${tail}`);
  }
  let all = null;
  if (user.guest) {
    all = await bump(GUEST_ALL, kind, amount, GUEST_TOTAL_CAP[kind]);
    if (all.over) {
      await Promise.all([mine.undo(), all.undo()]);
      throw httpError(429, 'AI miễn phí cho khách đã hết lượt hôm nay. Đăng nhập để tiếp tục dùng AI, hoặc quay lại vào ngày mai.');
    }
  }
  return async () => { await Promise.all([mine.undo(), all?.undo()]); };
}

// ── Groq ────────────────────────────────────────────────────────────────────────────────────
async function askJson(system, prompt, { temperature = 0.4, maxTokens } = {}) {
  const ask = () => groq.chat.completions.create({
    messages: [{ role: 'system', content: `${system} Always respond in valid JSON.` }, { role: 'user', content: prompt }],
    model: GROQ_TEXT_MODEL,
    temperature,
    response_format: { type: 'json_object' },
    ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
    ...(GROQ_TEXT_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
  });
  let completion;
  try {
    completion = await ask();
  } catch (err) {
    // gpt-oss thỉnh thoảng trả rỗng ở chế độ JSON → thử lại 1 lần
    if (err?.error?.error?.code !== 'json_validate_failed') throw err;
    completion = await ask();
  }
  try { return JSON.parse(completion.choices[0]?.message?.content || '{}'); } catch { return {}; }
}

// ── Lưu file đính kèm ───────────────────────────────────────────────────────────────────────
const STORAGE_QUOTA_BYTES = (Number(process.env.NOTES_STORAGE_MB) || 200) * 1024 * 1024;
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY) : null;

async function storageUsed(userId) {
  const agg = await prisma.noteAttachment.aggregate({ where: { userId }, _sum: { size: true } });
  return agg._sum.size || 0;
}

async function uploadNoteFile(userId, file, folder) {
  if (!supabase) throw httpError(500, 'Chưa cấu hình Supabase Storage trên backend');
  const used = await storageUsed(userId);
  if (used + file.size > STORAGE_QUOTA_BYTES) {
    throw httpError(413, `Đã dùng hết dung lượng ${Math.round(STORAGE_QUOTA_BYTES / 1048576)}MB cho file đính kèm. Hãy xoá bớt file cũ.`);
  }
  const ext = (removeAccents(file.originalname).match(/\.[a-z0-9]{1,8}$/i) || [''])[0].toLowerCase();
  const storagePath = `notes/${userId}/${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`;
  const { error } = await supabase.storage.from('documents').upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
  if (error) throw httpError(502, `Không tải được file lên kho lưu trữ: ${error.message}`);
  const url = supabase.storage.from('documents').getPublicUrl(storagePath).data.publicUrl;
  return { url, storagePath };
}

async function removeNoteFiles(paths) {
  if (!supabase || !paths.length) return;
  await supabase.storage.from('documents').remove(paths).catch(() => {});
}

// ── Truy cập ────────────────────────────────────────────────────────────────────────────────
async function ownPage(userId, pageId, select) {
  const page = await prisma.notePage.findFirst({ where: { id: pageId, userId }, ...(select ? { select } : {}) });
  if (!page) throw httpError(404, 'Không tìm thấy trang ghi chú');
  return page;
}

/** Sổ tay của trang có bật "Tắt AI cho sổ này" không. */
async function aiDisabledForPage(page) {
  if (!page.sectionId) return false;
  const section = await prisma.noteSection.findUnique({ where: { id: page.sectionId }, select: { notebook: { select: { aiDisabled: true } } } });
  return !!section?.notebook?.aiDisabled;
}

const sendError = (res, err, tag) => {
  if (!err.status) console.error(`[notes] ${tag}:`, err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Có lỗi xảy ra, vui lòng thử lại' });
};

module.exports = {
  prisma, groq, httpError, removeAccents, normalizeSearch, loadNoteUser, loadNoteActor, requireAccount,
  sanitizeDoc, docBlocks, docPlainText, docTasks, docLinkedPageIds, setTaskChecked, contentHash, walk,
  aiUsage, consumeAi, askJson, uploadNoteFile, removeNoteFiles, storageUsed, STORAGE_QUOTA_BYTES,
  ownPage, aiDisabledForPage, sendError, vnDay, LIMITS,
};
