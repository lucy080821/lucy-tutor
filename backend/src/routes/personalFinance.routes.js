const express = require('express');
const { Groq } = require('groq-sdk');

const prisma = require('../lib/prisma');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');

// Thu chi cá nhân (/personal-finance) — mount dưới /api/admin/personal-finance, SAU requireAdmin nên chỉ tài khoản ADMIN
// (token đăng nhập của /administrator) gọi được. Mỗi admin 1 sổ riêng: mọi truy vấn lọc theo ownerId = req.admin.uid.
// Sổ bắt đầu từ 01/11/2026 — giao dịch/số dư trước mốc này bị từ chối.
//
// Frontend tải toàn bộ (danh mục + giao dịch + số dư đầu tháng) bằng 1 request GET /data rồi tự tính biểu đồ — dữ liệu cá
// nhân nhỏ (vài nghìn dòng/năm), đổi lại mọi thao tác thêm/sửa/xoá cập nhật giao diện tức thì không cần refetch.

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const START_MONTH = '2026-11';
const START_DATE = '2026-11-01';
const TYPES = ['INCOME', 'EXPENSE'];
const MAX_AMOUNT = 1e12;

const httpError = (status, message) => Object.assign(new Error(message), { status });
const sendError = (res, err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[personal-finance]', err);
  res.status(500).json({ error: 'Lỗi máy chủ, vui lòng thử lại' });
};

// ===== Tiện ích ngày/tiền =====
const todayVN = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const isRealDate = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};
const isMonth = (s) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const prevMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, '0')}`;
};
const nextMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
};
const daysInMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
};
const money = (n) => `${Math.round(n).toLocaleString('vi-VN')} đ`;

function parseAmount(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0 || n > MAX_AMOUNT) throw httpError(400, 'Số tiền phải là số dương hợp lệ');
  return n;
}
function parseDate(value) {
  const s = String(value || '');
  if (!isRealDate(s)) throw httpError(400, 'Ngày không hợp lệ');
  if (s < START_DATE) throw httpError(400, 'Sổ thu chi chỉ tính từ ngày 01/11/2026');
  return s;
}
const cleanText = (value, max) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

// ===== Dữ liệu =====
const ownerWhere = (req) => ({ ownerId: req.admin.uid });

async function loadAll(ownerId) {
  const [categories, transactions, balances] = await Promise.all([
    prisma.pfCategory.findMany({ where: { ownerId }, orderBy: { createdAt: 'asc' } }),
    prisma.pfTransaction.findMany({ where: { ownerId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] }),
    prisma.pfMonthBalance.findMany({ where: { ownerId }, orderBy: { month: 'asc' } }),
  ]);
  return { categories, transactions, balances };
}

router.get('/data', async (req, res) => {
  try {
    const data = await loadAll(req.admin.uid);
    res.json({ startMonth: START_MONTH, today: todayVN(), ...data });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Danh mục =====
router.post('/categories', async (req, res) => {
  try {
    const name = cleanText(req.body?.name, 60);
    if (!name) throw httpError(400, 'Vui lòng nhập tên danh mục');
    let type = String(req.body?.type || '');
    let parentId = req.body?.parentId ? String(req.body.parentId) : null;

    if (parentId) {
      const parent = await prisma.pfCategory.findFirst({ where: { id: parentId, ...ownerWhere(req) } });
      if (!parent) throw httpError(404, 'Không tìm thấy danh mục lớn');
      if (parent.parentId) throw httpError(400, 'Chỉ chia danh mục lớn thành danh mục nhỏ (tối đa 2 cấp)');
      type = parent.type; // danh mục nhỏ luôn cùng loại với danh mục lớn
    } else {
      parentId = null;
    }
    if (!TYPES.includes(type)) throw httpError(400, 'Loại danh mục không hợp lệ');

    const sameLevel = await prisma.pfCategory.findMany({
      where: { ...ownerWhere(req), type, parentId },
      select: { name: true },
    });
    if (sameLevel.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw httpError(409, `Danh mục "${name}" đã tồn tại`);

    const category = await prisma.pfCategory.create({ data: { ownerId: req.admin.uid, type, name, parentId } });
    res.status(201).json(category);
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/categories/:id', async (req, res) => {
  try {
    const category = await prisma.pfCategory.findFirst({ where: { id: req.params.id, ...ownerWhere(req) } });
    if (!category) throw httpError(404, 'Không tìm thấy danh mục');
    const data = {};
    if (req.body?.name !== undefined) {
      const name = cleanText(req.body.name, 60);
      if (!name) throw httpError(400, 'Tên danh mục không được để trống');
      const siblings = await prisma.pfCategory.findMany({
        where: { ...ownerWhere(req), type: category.type, parentId: category.parentId, NOT: { id: category.id } },
        select: { name: true },
      });
      if (siblings.some((c) => c.name.toLowerCase() === name.toLowerCase())) throw httpError(409, `Danh mục "${name}" đã tồn tại`);
      data.name = name;
    }
    if (req.body?.budget !== undefined) {
      if (category.parentId || category.type !== 'EXPENSE') throw httpError(400, 'Chỉ đặt hạn mức cho danh mục chi lớn');
      const b = req.body.budget;
      data.budget = b === null || b === '' ? null : parseAmount(b);
    }
    const updated = await prisma.pfCategory.update({ where: { id: category.id }, data });
    res.json(updated);
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/categories/:id', async (req, res) => {
  try {
    const category = await prisma.pfCategory.findFirst({ where: { id: req.params.id, ...ownerWhere(req) } });
    if (!category) throw httpError(404, 'Không tìm thấy danh mục');
    const children = await prisma.pfCategory.findMany({ where: { parentId: category.id }, select: { id: true } });
    const ids = [category.id, ...children.map((c) => c.id)];
    const used = await prisma.pfTransaction.count({ where: { categoryId: { in: ids } } });
    if (used > 0) throw httpError(409, `Danh mục đang có ${used} giao dịch — hãy xoá hoặc chuyển các giao dịch đó sang danh mục khác trước`);
    await prisma.pfCategory.delete({ where: { id: category.id } }); // danh mục nhỏ xoá theo (cascade)
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

// Bộ danh mục gợi ý cho sổ trống (1 lần bấm thay vì tạo tay hàng chục danh mục)
const DEFAULT_CATEGORIES = {
  EXPENSE: {
    'Ăn uống': ['Đi chợ / siêu thị', 'Ăn ngoài', 'Cà phê & trà sữa'],
    'Nhà ở': ['Tiền thuê nhà', 'Điện', 'Nước', 'Internet & điện thoại'],
    'Di chuyển': ['Xăng xe', 'Gửi xe', 'Grab / Taxi'],
    'Sức khỏe': ['Khám chữa bệnh', 'Thuốc & vitamin'],
    'Mua sắm': ['Quần áo', 'Đồ dùng cá nhân'],
    'Giải trí': ['Xem phim / game', 'Du lịch'],
    'Học tập & phát triển': ['Khóa học', 'Sách'],
    'Gia đình & quà tặng': ['Biếu bố mẹ', 'Quà tặng', 'Từ thiện'],
    'Khác': [],
  },
  INCOME: {
    'Lương': ['Lương chính', 'Thưởng'],
    'Thu nhập khác': ['Làm thêm', 'Lãi tiết kiệm', 'Được tặng'],
  },
};

router.post('/categories/seed', async (req, res) => {
  try {
    if (await prisma.pfCategory.count({ where: ownerWhere(req) })) throw httpError(409, 'Sổ đã có danh mục, không thể tạo bộ gợi ý');
    const creates = [];
    for (const [type, groups] of Object.entries(DEFAULT_CATEGORIES)) {
      for (const [name, subs] of Object.entries(groups)) {
        creates.push(prisma.pfCategory.create({
          data: { ownerId: req.admin.uid, type, name, children: { create: subs.map((s) => ({ ownerId: req.admin.uid, type, name: s })) } },
        }));
      }
    }
    await prisma.$transaction(creates);
    res.status(201).json({ categories: await prisma.pfCategory.findMany({ where: ownerWhere(req), orderBy: { createdAt: 'asc' } }) });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Giao dịch =====
async function readTransactionBody(req) {
  const category = await prisma.pfCategory.findFirst({ where: { id: String(req.body?.categoryId || ''), ...ownerWhere(req) } });
  if (!category) throw httpError(400, 'Vui lòng chọn danh mục');
  return {
    type: category.type,
    categoryId: category.id,
    amount: parseAmount(req.body?.amount),
    date: parseDate(req.body?.date),
    detail: cleanText(req.body?.detail, 200) || null,
  };
}

router.post('/transactions', async (req, res) => {
  try {
    const data = await readTransactionBody(req);
    const tx = await prisma.pfTransaction.create({ data: { ownerId: req.admin.uid, ...data } });
    res.status(201).json(tx);
  } catch (err) {
    sendError(res, err);
  }
});

router.put('/transactions/:id', async (req, res) => {
  try {
    const existing = await prisma.pfTransaction.findFirst({ where: { id: req.params.id, ...ownerWhere(req) }, select: { id: true } });
    if (!existing) throw httpError(404, 'Không tìm thấy giao dịch');
    const data = await readTransactionBody(req);
    res.json(await prisma.pfTransaction.update({ where: { id: existing.id }, data }));
  } catch (err) {
    sendError(res, err);
  }
});

router.delete('/transactions/:id', async (req, res) => {
  try {
    const { count } = await prisma.pfTransaction.deleteMany({ where: { id: req.params.id, ...ownerWhere(req) } });
    if (!count) throw httpError(404, 'Không tìm thấy giao dịch');
    res.status(204).end();
  } catch (err) {
    sendError(res, err);
  }
});

// ===== Số dư đầu tháng =====
router.put('/balance', async (req, res) => {
  try {
    const month = String(req.body?.month || '');
    if (!isMonth(month) || month < START_MONTH) throw httpError(400, 'Chỉ nhập số dư cho các tháng từ 11/2026');
    const where = { ownerId_month: { ownerId: req.admin.uid, month } };
    if (req.body?.opening === null || req.body?.opening === '') {
      await prisma.pfMonthBalance.deleteMany({ where: { ownerId: req.admin.uid, month } });
      return res.json({ month, opening: null });
    }
    const opening = Math.round(Number(req.body?.opening));
    if (!Number.isFinite(opening) || Math.abs(opening) > MAX_AMOUNT * 10) throw httpError(400, 'Số dư không hợp lệ');
    const row = await prisma.pfMonthBalance.upsert({
      where,
      update: { opening },
      create: { ownerId: req.admin.uid, month, opening },
    });
    res.json({ month: row.month, opening: row.opening });
  } catch (err) {
    sendError(res, err);
  }
});

// ===== AI: phân tích + hỏi đáp =====

// Tính lại số dư từng tháng (bản chép logic ở frontend/src/lib/personalFinance.ts: đầu kỳ nhập tay, không có thì lấy cuối kỳ tháng trước)
function computeMonths({ transactions, balances }, upToMonth) {
  const manual = new Map(balances.map((b) => [b.month, b.opening]));
  const sums = new Map();
  let last = upToMonth;
  for (const t of transactions) {
    const m = t.date.slice(0, 7);
    const s = sums.get(m) || { income: 0, expense: 0 };
    if (t.type === 'INCOME') s.income += t.amount; else s.expense += t.amount;
    sums.set(m, s);
    if (m > last) last = m;
  }
  const rows = [];
  let carry = 0;
  for (let m = START_MONTH; m <= last; m = nextMonth(m)) {
    const s = sums.get(m) || { income: 0, expense: 0 };
    const opening = manual.has(m) ? manual.get(m) : carry;
    const closing = opening + s.income - s.expense;
    rows.push({ month: m, opening, manual: manual.has(m), ...s, closing });
    carry = closing;
  }
  return rows;
}

function buildContext(all, month) {
  const { categories, transactions } = all;
  const byId = new Map(categories.map((c) => [c.id, c]));
  const bigOf = (c) => (c.parentId ? byId.get(c.parentId) || c : c);
  const label = (c) => (c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId).name} > ${c.name}` : c.name);

  const today = todayVN();
  const months = computeMonths(all, month);
  const cur = months.find((m) => m.month === month);
  const lines = [];
  lines.push(`Hôm nay: ${today}. Sổ thu chi tính từ 01/11/2026. Đơn vị tiền: VND.`);
  lines.push(`\n## Tổng hợp theo tháng`);
  for (const m of months) {
    lines.push(`- ${m.month}: đầu kỳ ${money(m.opening)}${m.manual ? ' (nhập tay)' : ' (chuyển từ tháng trước)'}, thu ${money(m.income)}, chi ${money(m.expense)}, cuối kỳ ${money(m.closing)}`);
  }

  const monthTx = transactions.filter((t) => t.date.startsWith(month));
  const prevTx = transactions.filter((t) => t.date.startsWith(prevMonth(month)));
  const sumBy = (list, type) => {
    const map = new Map();
    for (const t of list) {
      if (t.type !== type) continue;
      const c = byId.get(t.categoryId);
      if (!c) continue;
      const big = bigOf(c);
      const e = map.get(big.id) || { big, total: 0, subs: new Map() };
      e.total += t.amount;
      e.subs.set(c.id, (e.subs.get(c.id) || 0) + t.amount);
      map.set(big.id, e);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  };

  const elapsed = month === today.slice(0, 7) ? Number(today.slice(8, 10)) : month < today.slice(0, 7) ? daysInMonth(month) : 0;
  lines.push(`\n## Tháng ${month} (${elapsed}/${daysInMonth(month)} ngày đã qua)`);
  if (cur) {
    const savingRate = cur.income > 0 ? Math.round(((cur.income - cur.expense) / cur.income) * 100) : null;
    lines.push(`Thu ${money(cur.income)}; chi ${money(cur.expense)}; tiết kiệm ròng ${money(cur.income - cur.expense)}${savingRate === null ? '' : ` (${savingRate}% thu nhập)`}; số dư cuối kỳ hiện tại ${money(cur.closing)}`);
    if (elapsed > 0) lines.push(`Chi trung bình mỗi ngày: ${money(cur.expense / elapsed)}; nếu giữ nhịp này, cả tháng chi khoảng ${money((cur.expense / elapsed) * daysInMonth(month))}`);
  }

  const prevExp = new Map(sumBy(prevTx, 'EXPENSE').map((e) => [e.big.id, e.total]));
  const expenses = sumBy(monthTx, 'EXPENSE');
  lines.push(`\nChi theo danh mục lớn (kèm hạn mức tháng nếu có, và so với tháng trước):`);
  if (!expenses.length) lines.push('- (chưa có khoản chi)');
  for (const e of expenses) {
    const budget = e.big.budget ? `, hạn mức ${money(e.big.budget)} đã dùng ${Math.round((e.total / e.big.budget) * 100)}%` : '';
    const prev = prevExp.get(e.big.id);
    const cmp = prev ? `, tháng trước ${money(prev)}` : '';
    const subs = [...e.subs.entries()].map(([id, v]) => `${byId.get(id)?.name}: ${money(v)}`).join('; ');
    lines.push(`- ${e.big.name}: ${money(e.total)}${budget}${cmp}${e.subs.size > 1 || (e.subs.size === 1 && !e.subs.has(e.big.id)) ? ` [${subs}]` : ''}`);
  }
  const noBudget = categories.filter((c) => !c.parentId && c.type === 'EXPENSE' && c.budget && !expenses.some((e) => e.big.id === c.id));
  for (const c of noBudget) lines.push(`- ${c.name}: ${money(0)}, hạn mức ${money(c.budget)} đã dùng 0%`);

  lines.push(`\nThu theo danh mục:`);
  const incomes = sumBy(monthTx, 'INCOME');
  if (!incomes.length) lines.push('- (chưa có khoản thu)');
  for (const e of incomes) lines.push(`- ${e.big.name}: ${money(e.total)}`);

  const detailLines = [...monthTx]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 150)
    .map((t) => {
      const c = byId.get(t.categoryId);
      return `${t.date} | ${t.type === 'INCOME' ? 'THU' : 'CHI'} | ${c ? label(c) : '?'} | ${money(t.amount)}${t.detail ? ` | ${t.detail}` : ''}`;
    });
  lines.push(`\n## Chi tiết giao dịch tháng ${month} (mới nhất trước${monthTx.length > 150 ? `, hiện 150/${monthTx.length}` : ''})`);
  lines.push(detailLines.length ? detailLines.join('\n') : '(chưa có giao dịch)');
  return lines.join('\n');
}

async function askGroq(messages, maxTokens) {
  const completion = await groq.chat.completions.create({
    model: GROQ_TEXT_MODEL,
    messages,
    temperature: 0.3,
    max_completion_tokens: maxTokens,
    ...(GROQ_TEXT_MODEL.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {}),
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw httpError(502, 'AI chưa trả lời được, vui lòng thử lại');
  return text;
}

const COACH_RULES = `Bạn là trợ lý tài chính cá nhân cho chủ sổ thu chi, trả lời bằng tiếng Việt, ngắn gọn, thẳng thắn, thực tế.
Quy tắc: CHỈ dùng số liệu trong dữ liệu được cung cấp, không bịa số; thiếu dữ liệu thì nói rõ là chưa đủ dữ liệu. Tiền định dạng như "1.250.000 đ". Không đưa lời khuyên đầu tư cụ thể (mã cổ phiếu, coin...). Đây là gợi ý quản lý chi tiêu, không phải tư vấn tài chính chuyên nghiệp.`;

async function ensureMonth(req) {
  const month = String(req.body?.month || '');
  if (!isMonth(month) || month < START_MONTH) throw httpError(400, 'Tháng không hợp lệ (từ 11/2026)');
  return month;
}

router.post('/ai/analyze', async (req, res) => {
  try {
    const month = await ensureMonth(req);
    const all = await loadAll(req.admin.uid);
    const context = buildContext(all, month);
    const answer = await askGroq([
      { role: 'system', content: COACH_RULES },
      {
        role: 'user',
        content: `Dưới đây là dữ liệu thu chi của tôi.\n\n${context}\n\nHãy phân tích và giúp tôi kiểm soát chi tiêu tháng ${month}, trình bày bằng Markdown gồm các mục:\n## Tổng quan (2-3 câu: dòng tiền, tỷ lệ tiết kiệm, số dư)\n## Điểm đáng chú ý (các danh mục chi lớn nhất, tăng/giảm so với tháng trước)\n## Cảnh báo (vượt hoặc sắp vượt hạn mức, khoản chi bất thường, nhiều khoản nhỏ lặp lại; nếu không có thì ghi "Chưa phát hiện vấn đề")\n## Dự báo cuối tháng (dựa trên nhịp chi hiện tại)\n## Việc nên làm (tối đa 5 hành động cụ thể, có con số gợi ý)`,
      },
    ], 2200);
    res.json({ month, answer });
  } catch (err) {
    if (!err.status) console.error('[personal-finance ai]', err.message);
    sendError(res, err.status ? err : httpError(502, 'Không gọi được AI lúc này, vui lòng thử lại'));
  }
});

router.post('/ai/chat', async (req, res) => {
  try {
    const month = await ensureMonth(req);
    const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const messages = history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!messages.length || messages[messages.length - 1].role !== 'user') throw httpError(400, 'Vui lòng nhập câu hỏi');

    const all = await loadAll(req.admin.uid);
    const answer = await askGroq([
      { role: 'system', content: `${COACH_RULES}\nNgười dùng đang xem tháng ${month}. Nếu câu hỏi nói về tháng khác, dùng bảng "Tổng hợp theo tháng"; nếu cần chi tiết mà không có thì nói rõ.\n\nDỮ LIỆU THU CHI:\n${buildContext(all, month)}` },
      ...messages,
    ], 1500);
    res.json({ answer });
  } catch (err) {
    if (!err.status) console.error('[personal-finance ai]', err.message);
    sendError(res, err.status ? err : httpError(502, 'Không gọi được AI lúc này, vui lòng thử lại'));
  }
});

module.exports = router;
