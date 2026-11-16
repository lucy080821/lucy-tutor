// Nông Trại Qilin — GIAO TIẾP: thư tiếng Anh giữa bạn bè (AI sửa lỗi), nhờ giúp/đổi hàng, NPC ghé thăm để trò chuyện/mua bán.
// Gắn vào router của farm.routes.js (cùng prefix /api/farm). Mọi phần thưởng tính ở server; thư chỉ là văn bản thuần (client escape).
// An toàn cho học viên nhỏ tuổi: chỉ nhắn được bạn CÙNG LỚP (hoặc cùng giáo viên phụ trách với học viên tự do), giới hạn độ dài/số thư,
// chặn chửi thề, số điện thoại/email/liên kết/mạng xã hội, và AI kiểm tra nội dung trước khi gửi.
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const C = require('../lib/farmCatalog');
const { GROQ_TEXT_MODEL } = require('../lib/aiModel');

module.exports = function mountSocial(router, h) {
  const { groq, parseJSON, jsonObj, buildState, ensureDaily, bumpStats } = h;

  // ─── Kiểm duyệt đơn giản (quy tắc) ─────────────────────────────────────────
  const BAD_WORDS = /\b(fuck|fucking|shit|bitch|asshole|dick|pussy|slut|whore|nigg\w*|cunt|porn|sex|kill yourself|kys)\b/i;
  const BAD_VI = /(^|[^a-zà-ỹ])(đm|dm|đmm|vcl|vkl|cc|clgt|lồn|loz|cặc|cak|địt|đụ má|đéo|đần độn|óc chó|mẹ mày|con chó)([^a-zà-ỹ]|$)/i;
  const CONTACT = /(https?:\/\/|www\.|\S+@\S+\.\S+|\.com\b|\.vn\b|zalo|facebook|\bfb\b|tiktok|instagram|telegram|discord|messenger|snapchat|\+?\d[\d\s.-]{7,}\d)/i;
  function moderate(text) {
    if (BAD_WORDS.test(text) || BAD_VI.test(text.toLowerCase())) return 'Tin nhắn có từ không phù hợp. Hãy dùng lời lẽ lịch sự nhé.';
    if (CONTACT.test(text)) return 'Không chia sẻ số điện thoại, email, liên kết hay tài khoản mạng xã hội trong game nhé.';
    return null;
  }
  const tidy = (s) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const wordsOf = (s) => (s.match(/[A-Za-zÀ-ỹ']+/g) || []);
  // Tên nông sản bằng TIẾNG ANH (khoá cây chính là từ tiếng Anh) — thư/NPC viết bằng tiếng Anh nên không dùng tên tiếng Việt
  const enCrop = (key, n = 1) => (n === 1 ? key : key === 'strawberry' ? 'strawberries' : key === 'tomato' ? 'tomatoes' : `${key}s`);
  const levelOf = (farm) => C.levelFor(farm.harvestCount);
  const cefrFor = (lv) => (lv < 4 ? 'A1-A2 (very simple words and short sentences)' : lv < 9 ? 'A2-B1' : 'B1-B2');

  // gpt-oss đôi khi trả `json_validate_failed` (hết token khi còn đang suy luận) → thử lại 1 lần, suy luận ít + dư token
  async function askAi(system, user, maxTokens = 400) {
    if (!groq) return null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await groq.chat.completions.create({
          model: GROQ_TEXT_MODEL, temperature: 0.4, response_format: { type: 'json_object' }, max_tokens: maxTokens + 700, reasoning_effort: 'low',
          messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        });
        const out = parseJSON(r.choices?.[0]?.message?.content || '', null);
        if (out && typeof out === 'object') return out;
      } catch (e) { console.error('[farm] social ai', attempt, String(e.message).slice(0, 120)); }
    }
    return null;
  }

  // ─── Người nhắn được ─────────────────────────────────────────────────────────
  async function contactsOf(userId) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { managerTeacherId: true, classroomsJoined: { select: { id: true } } } });
    if (!me) return null;
    const classIds = me.classroomsJoined.map((c) => c.id);
    const or = [];
    if (classIds.length) or.push({ classroomsJoined: { some: { id: { in: classIds } } } });
    if (me.managerTeacherId && !classIds.length) or.push({ managerTeacherId: me.managerTeacherId, classroomsJoined: { none: {} } });
    if (!or.length) return [];
    const users = await prisma.user.findMany({
      where: { id: { not: userId }, role: 'STUDENT', farmState: { isNot: null }, OR: or },
      select: { id: true, name: true, farmState: { select: { harvestCount: true, petName: true } } }, orderBy: { name: 'asc' }, take: 80,
    });
    return users.map((u) => ({ id: u.id, name: u.name, level: C.levelFor(u.farmState.harvestCount), petName: u.farmState.petName }));
  }

  const mailOf = (farm) => (Array.isArray(farm.mail) ? farm.mail : parseJSON(farm.mail, []));
  const publicMail = (m) => ({ id: m.id, from: m.from, fromName: m.fromName, text: m.text, type: m.type, ask: m.ask || null, at: m.at, read: !!m.read, helped: !!m.helped });

  async function appendMail(toId, msg) {
    await prisma.$executeRaw`UPDATE "FarmState" SET mail = (CASE WHEN jsonb_array_length(COALESCE(mail, '[]'::jsonb)) >= ${C.MAIL.keep} THEN COALESCE(mail, '[]'::jsonb) - 0 ELSE COALESCE(mail, '[]'::jsonb) END) || ${JSON.stringify([msg])}::jsonb WHERE "userId" = ${toId}`;
  }

  router.get('/mail/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const farm = await prisma.farmState.findUnique({ where: { userId } });
      if (!farm) return res.status(404).json({ error: 'Chưa có nông trại' });
      const { daily } = await ensureDaily(farm);
      const contacts = await contactsOf(userId);
      const mail = mailOf(farm).slice().reverse().map(publicMail);
      res.json({
        mail, unread: mail.filter((m) => !m.read).length, contacts: contacts || [], aiOn: !!groq,
        limits: { sent: daily.mailSent || 0, maxSend: C.MAIL.sendPerDay, asks: daily.asksSent || 0, maxAsks: C.MAIL.asksPerDay, maxLen: C.MAIL.maxLen },
      });
    } catch (e) { console.error('[farm] mail box', e); res.status(500).json({ error: 'Không mở được hộp thư' }); }
  });

  // AI kiểm tra câu trước khi gửi: sửa lỗi + mẹo (không trừ lượt gửi)
  router.post('/mail/check', async (req, res) => {
    try {
      const { userId } = req.body; const text = tidy(req.body.text);
      const farm = await prisma.farmState.findUnique({ where: { userId } });
      if (!farm) return res.status(404).json({ error: 'Chưa có nông trại' });
      if (!text) return res.status(400).json({ error: 'Hãy viết nội dung bằng tiếng Anh' });
      if (text.length > C.MAIL.maxLen) return res.status(400).json({ error: `Tối đa ${C.MAIL.maxLen} ký tự` });
      const bad = moderate(text); if (bad) return res.json({ ok: false, safe: false, corrected: '', tip: bad });
      const ai = await askAi(
        `You are a kind English teacher for Vietnamese students (level ${cefrFor(levelOf(farm))}). A student wants to send a short message to a classmate inside a farm game. Reply with JSON only: {"safe": boolean, "ok": boolean, "corrected": string, "tip": string}. safe=false only if the text is rude, bullying, sexual or shares personal contact info. ok=true if the English is already correct and natural. corrected = the corrected/natural version of the message (same as input if ok). tip = ONE short friendly sentence in Vietnamese (max 30 words) explaining the main mistake, or praising if ok.`,
        `Message: "${text}"`, 300);
      if (!ai) return res.json({ ok: wordsOf(text).length >= C.MAIL.minWords, safe: true, corrected: text, tip: 'AI đang bận, bạn vẫn gửi được. Hãy đọc lại câu một lần nữa nhé.', ai: false });
      res.json({ ok: !!ai.ok, safe: ai.safe !== false, corrected: tidy(ai.corrected || text).slice(0, C.MAIL.maxLen), tip: String(ai.tip || '').slice(0, 300), ai: true });
    } catch (e) { console.error('[farm] mail check', e); res.status(500).json({ error: 'Không kiểm tra được' }); }
  });

  // Gửi thư: { userId, toId, text, type: 'MSG'|'ASK', ask?: {crop, n} }
  router.post('/mail/send', async (req, res) => {
    try {
      const { userId, toId } = req.body; const type = req.body.type === 'ASK' ? 'ASK' : 'MSG';
      const text = tidy(req.body.text);
      if (!toId || toId === userId) return res.status(400).json({ error: 'Chọn người nhận' });
      if (wordsOf(text).length < C.MAIL.minWords) return res.status(400).json({ error: 'Viết ít nhất 2 từ tiếng Anh nhé' });
      if (text.length > C.MAIL.maxLen) return res.status(400).json({ error: `Tối đa ${C.MAIL.maxLen} ký tự` });
      const bad = moderate(text); if (bad) return res.status(400).json({ error: bad });
      let ask = null;
      if (type === 'ASK') {
        const crop = String(req.body.ask?.crop || ''); const n = Math.floor(Number(req.body.ask?.n));
        if (!C.CROPS[crop] || !(n >= 1 && n <= C.MAIL.askMax)) return res.status(400).json({ error: 'Chọn loại nông sản và số lượng hợp lệ' });
        ask = { crop, n };
      }
      const farm = await prisma.farmState.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
      if (!farm) return res.status(404).json({ error: 'Chưa có nông trại' });
      const contacts = await contactsOf(userId);
      const target = (contacts || []).find((c) => c.id === toId);
      if (!target) return res.status(403).json({ error: 'Chỉ nhắn được bạn cùng lớp (hoặc cùng giáo viên phụ trách).' });
      const { farm: farm2, daily } = await ensureDaily(farm);
      if ((daily.mailSent || 0) >= C.MAIL.sendPerDay) return res.status(400).json({ error: `Hôm nay bạn đã gửi đủ ${C.MAIL.sendPerDay} thư rồi, mai gửi tiếp nhé` });
      if (type === 'ASK' && (daily.asksSent || 0) >= C.MAIL.asksPerDay) return res.status(400).json({ error: `Mỗi ngày chỉ nhờ giúp tối đa ${C.MAIL.asksPerDay} lần` });
      const sentCount = daily.mailSent || 0;
      const rewarded = sentCount < C.MAIL.sendReward.perDay;
      const lock = await prisma.farmState.updateMany({
        where: { userId, updatedAt: farm2.updatedAt },
        data: { daily: { ...daily, mailSent: sentCount + 1, asksSent: (daily.asksSent || 0) + (type === 'ASK' ? 1 : 0) }, ...(rewarded ? { coins: { increment: C.MAIL.sendReward.coins } } : {}) },
      });
      if (!lock.count) return res.status(409).json({ error: 'Thử lại nhé' });
      await appendMail(toId, { id: crypto.randomUUID(), from: userId, fromName: farm.user.name, text, type, ...(ask ? { ask } : {}), at: new Date().toISOString(), read: false });
      await Promise.all([
        bumpStats(userId, { msgs: 1 }),
        rewarded ? prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: C.MAIL.sendReward.xp } }, select: { id: true } }) : null,
      ]);
      res.json(await buildState(userId, { mailSent: { to: target.name, type, coins: rewarded ? C.MAIL.sendReward.coins : 0, xp: rewarded ? C.MAIL.sendReward.xp : 0 } }));
    } catch (e) { console.error('[farm] mail send', e); res.status(500).json({ error: 'Không gửi được thư' }); }
  });

  router.post('/mail/read', async (req, res) => {
    try {
      const { userId } = req.body;
      await prisma.$executeRaw`UPDATE "FarmState" SET mail = (SELECT COALESCE(jsonb_agg(jsonb_set(e, '{read}', 'true'::jsonb)), '[]'::jsonb) FROM jsonb_array_elements(COALESCE(mail, '[]'::jsonb)) e) WHERE "userId" = ${userId}`;
      res.json({ ok: true });
    } catch (e) { console.error('[farm] mail read', e); res.status(500).json({ error: 'Không cập nhật được' }); }
  });

  // Giúp bạn: người NHẬN thư nhờ giúp gửi nông sản từ kho của mình sang kho người nhờ
  router.post('/mail/help', async (req, res) => {
    try {
      const { userId, mailId } = req.body;
      const me = await prisma.farmState.findUnique({ where: { userId }, include: { user: { select: { name: true } } } });
      if (!me) return res.status(404).json({ error: 'Chưa có nông trại' });
      const msg = mailOf(me).find((m) => m.id === mailId);
      if (!msg || msg.type !== 'ASK' || !msg.ask) return res.status(404).json({ error: 'Không tìm thấy lời nhờ giúp' });
      if (msg.helped) return res.status(400).json({ error: 'Bạn đã giúp rồi' });
      const { crop, n } = msg.ask;
      if (!C.CROPS[crop]) return res.status(400).json({ error: 'Lời nhờ giúp không hợp lệ' });
      const contacts = await contactsOf(userId);
      if (!(contacts || []).some((c) => c.id === msg.from)) return res.status(403).json({ error: 'Bạn này không còn trong danh sách bạn cùng lớp' });
      const asker = await prisma.farmState.findUnique({ where: { userId: msg.from } });
      if (!asker) return res.status(404).json({ error: 'Bạn này không còn nông trại' });
      const myInv = parseJSON(me.inventory, {}); const hisInv = parseJSON(asker.inventory, {});
      if ((myInv[crop] || 0) < n) return res.status(400).json({ error: `Kho của bạn chưa đủ ${n} ${C.CROPS[crop].name.toLowerCase()} (đang có ${myInv[crop] || 0})` });
      const hisUsed = Object.values(hisInv).reduce((a, b) => a + b, 0);
      if (hisUsed + n > asker.barnCapacity) return res.status(400).json({ error: 'Kho của bạn ấy đã đầy, thử lại sau nhé' });
      const { daily } = await ensureDaily(me);
      const helps = daily.helps || 0; const paid = helps < C.MAIL.helpsRewardedPerDay;
      const coins = paid ? Math.round(C.PRODUCE_PRICE[crop] * n * 1.25) + 5 : 0;
      myInv[crop] -= n; if (myInv[crop] <= 0) delete myInv[crop];
      hisInv[crop] = (hisInv[crop] || 0) + n;
      const newMail = mailOf(me).map((m) => (m.id === mailId ? { ...m, helped: true, read: true } : m));
      try {
        await prisma.$transaction(async (tx) => {
          const a = await tx.farmState.updateMany({ where: { userId, updatedAt: me.updatedAt }, data: { inventory: JSON.stringify(myInv), mail: newMail, daily: { ...daily, helps: helps + 1 }, coins: { increment: coins } } });
          if (!a.count) throw new Error('RETRY');
          const b = await tx.farmState.updateMany({ where: { userId: msg.from, updatedAt: asker.updatedAt }, data: { inventory: JSON.stringify(hisInv) } });
          if (!b.count) throw new Error('RETRY');
        });
      } catch (e) { if (e.message === 'RETRY') return res.status(409).json({ error: 'Thử lại nhé' }); throw e; }
      await Promise.all([
        appendMail(msg.from, { id: crypto.randomUUID(), from: userId, fromName: me.user.name, type: 'THANKS', text: `Here you are! I sent you ${n} ${enCrop(crop, n)}. Good luck with your farm!`, at: new Date().toISOString(), read: false }),
        bumpStats(userId, { helps: 1, gifts: 1 }),
        paid ? prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: 5 } }, select: { id: true } }) : null,
      ]);
      res.json(await buildState(userId, { helped: { to: msg.fromName, crop, n, coins, xp: paid ? 5 : 0 } }));
    } catch (e) { console.error('[farm] mail help', e); res.status(500).json({ error: 'Không giúp được' }); }
  });

  // ─── NPC ghé thăm ────────────────────────────────────────────────────────────
  const vnNow = () => new Date(Date.now() + 7 * 3600e3);
  const hashInt = (s) => parseInt(crypto.createHash('sha1').update(s).digest('hex').slice(0, 8), 16);
  // Khung hiện tại (3 giờ) → có khách hay không, là NPC nào (xác định theo userId+ngày+khung nên không cần lưu/cron)
  function npcNow(userId) {
    const d = vnNow(); const slot = Math.floor(d.getUTCHours() / C.NPC_SLOT_HOURS);
    const key = `${C.vnDay()}:${slot}`; const hv = hashInt(`${userId}|${key}`);
    const forced = process.env.FARM_NPC_FORCE && C.NPCS[process.env.FARM_NPC_FORCE] ? process.env.FARM_NPC_FORCE : null; // chỉ để kiểm thử
    if (!forced && hv % 100 >= C.NPC_PRESENT_PCT) return null;
    const kind = forced || C.NPC_KEYS[Math.floor(hv / 100) % C.NPC_KEYS.length];
    const endsAt = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (slot + 1) * C.NPC_SLOT_HOURS) - 7 * 3600e3).toISOString();
    const out = { key, kind, endsAt };
    if (kind === 'merchant') { const crops = Object.keys(C.CROPS); out.wants = { crop: crops[Math.floor(hv / 1000) % crops.length], n: 2 + (Math.floor(hv / 7) % 4) }; }
    return out;
  }
  function npcView(userId, daily) {
    const now = npcNow(userId); if (!now) return null;
    const st = jsonObj(jsonObj(daily?.npc)[now.key]); const def = C.NPCS[now.kind];
    return {
      key: now.key, kind: now.kind, name: def.name, role: def.role, greeting: def.greeting, goalVi: def.goalVi, endsAt: now.endsAt,
      wants: now.wants || null, price: now.wants ? Math.round(C.PRODUCE_PRICE[now.wants.crop] * now.wants.n * C.NPC_TRADE_BONUS) : null,
      turns: st.turns || 0, turnsMax: C.NPC_TURNS_PER_VISIT, goalDone: !!st.goal, rewarded: !!st.rewarded, traded: !!st.traded,
      turnsToday: daily?.npcTurns || 0, turnsTodayMax: C.NPC_TURNS_PER_DAY, reward: def.reward,
    };
  }

  const FALLBACK_REPLY = {
    merchant: ['Hmm, how many can you sell me?', 'That sounds good! Tell me the price, please.', 'Great, thank you!'],
    grandma: ['Oh, how wonderful! Do you like them?', 'That sounds lovely, dear.', 'I love fresh vegetables!'],
    traveler: ['I see. Is it far from here?', 'Thank you so much for helping me!', 'Go straight, then turn left? Great!'],
    kid: ['Wow! Can I pat it?', 'It looks so happy!', 'I want a pet dragon too!'],
  };
  function ruleGoal(kind, text, wants) {
    const w = wordsOf(text); if (w.length < 4) return false;
    const low = text.toLowerCase();
    if (kind === 'merchant') return /(sell|offer|have|deal|sure|price|for|can)/.test(low) && (/\d/.test(low) || /\b(one|two|three|four|five|six|some|few)\b/.test(low) || (wants && low.includes(wants.crop)));
    if (kind === 'traveler') return /(straight|left|right|turn|next to|near|opposite|walk|cross)/.test(low);
    return w.length >= 5;
  }

  router.post('/npc/talk', async (req, res) => {
    try {
      const { userId } = req.body; const text = tidy(req.body.message);
      const farm = await prisma.farmState.findUnique({ where: { userId } });
      if (!farm) return res.status(404).json({ error: 'Chưa có nông trại' });
      const { farm: farm2, daily } = await ensureDaily(farm);
      const now = npcNow(userId);
      if (!now) return res.status(400).json({ error: 'Hiện không có khách nào ghé thăm' });
      const store = jsonObj(daily.npc); const st = jsonObj(store[now.key]);
      if ((st.turns || 0) >= C.NPC_TURNS_PER_VISIT) return res.status(400).json({ error: 'Khách đã nói chuyện đủ rồi, hẹn lần ghé sau nhé' });
      if ((daily.npcTurns || 0) >= C.NPC_TURNS_PER_DAY) return res.status(400).json({ error: 'Hôm nay bạn đã trò chuyện nhiều rồi, mai nói tiếp nhé' });
      if (wordsOf(text).length < 1 || text.length > C.MAIL.maxLen) return res.status(400).json({ error: `Viết 1 câu tiếng Anh (tối đa ${C.MAIL.maxLen} ký tự)` });
      const bad = moderate(text); if (bad) return res.status(400).json({ error: bad });
      const def = C.NPCS[now.kind];
      const history = (Array.isArray(req.body.history) ? req.body.history : []).slice(-6).map((m) => `${m.who === 'me' ? 'Student' : def.name}: ${tidy(m.text).slice(0, 200)}`).join('\n');
      const wantsLine = now.wants ? ` The merchant wants to buy ${now.wants.n} ${enCrop(now.wants.crop, now.wants.n)}.` : '';
      const goalEn = {
        merchant: 'the student makes a clear polite offer to sell (or agrees to sell) the produce',
        grandma: 'the student tells you what they grow or like on the farm in a full sentence',
        traveler: 'the student gives simple directions (go straight, turn left/right, next to…)',
        kid: 'the student describes their pet dragon (name, colour, or what it does) in a full sentence',
      }[now.kind];
      const ai = await askAi(
        `You role-play ${def.name}, ${def.persona}, visiting a student's farm in a language-learning game. The student is Vietnamese, level ${cefrFor(levelOf(farm))}. Stay in character, be warm and child-safe, never ask for personal information, and keep replies to 1-2 short sentences using simple words.${wantsLine} Reply with JSON only: {"reply": string, "correction": string, "tip": string, "goalDone": boolean}. "correction" = corrected version of the student's LAST message if it had mistakes, otherwise "". "tip" = ONE short friendly sentence in Vietnamese (max 25 words) about the main mistake or a compliment. "goalDone" = true if ${goalEn} (the goal may be completed by the last message or earlier messages).`,
        `Conversation so far:\n${history || '(none)'}\nStudent: ${text}`, 350);
      const reply = ai ? { reply: tidy(ai.reply || '').slice(0, 300) || 'I see!', correction: tidy(ai.correction || '').slice(0, 300), tip: tidy(ai.tip || '').slice(0, 300), goalDone: !!ai.goalDone, ai: true }
        : { reply: FALLBACK_REPLY[now.kind][Math.min(st.turns || 0, 2)], correction: '', tip: 'AI đang bận nên mình chấm theo quy tắc đơn giản.', goalDone: ruleGoal(now.kind, text, now.wants), ai: false };
      const goalNow = !!st.goal || reply.goalDone;
      const reward = goalNow && !st.rewarded ? def.reward : null;
      const next = { ...st, turns: (st.turns || 0) + 1, goal: goalNow, rewarded: !!st.rewarded || !!reward };
      const lock = await prisma.farmState.updateMany({
        where: { userId, updatedAt: farm2.updatedAt },
        data: { daily: { ...daily, npc: { ...store, [now.key]: next }, npcTurns: (daily.npcTurns || 0) + 1 }, ...(reward ? { coins: { increment: reward.coins + levelOf(farm) * 2 }, gems: { increment: reward.gems } } : {}) },
      });
      if (!lock.count) return res.status(409).json({ error: 'Thử lại nhé' });
      await Promise.all([bumpStats(userId, { npcChats: 1 }), reward ? prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: reward.xp } }, select: { id: true } }) : null]);
      res.json(await buildState(userId, { npcReply: { ...reply, goalDone: goalNow, reward: reward ? { coins: reward.coins + levelOf(farm) * 2, gems: reward.gems, xp: reward.xp } : null } }));
    } catch (e) { console.error('[farm] npc talk', e); res.status(500).json({ error: 'Khách chưa nghe rõ, thử lại nhé' }); }
  });

  // Thương nhân mua nông sản (sau khi bạn đã đề nghị bán bằng tiếng Anh)
  router.post('/npc/trade', async (req, res) => {
    try {
      const { userId } = req.body;
      const farm = await prisma.farmState.findUnique({ where: { userId } });
      if (!farm) return res.status(404).json({ error: 'Chưa có nông trại' });
      const { farm: farm2, daily } = await ensureDaily(farm);
      const now = npcNow(userId);
      if (!now || now.kind !== 'merchant' || !now.wants) return res.status(400).json({ error: 'Hiện không có thương nhân' });
      const store = jsonObj(daily.npc); const st = jsonObj(store[now.key]);
      if (!st.goal) return res.status(400).json({ error: 'Hãy đề nghị bán cho ông ấy bằng tiếng Anh trước nhé' });
      if (st.traded) return res.status(400).json({ error: 'Ông ấy đã mua rồi' });
      const inv = parseJSON(farm2.inventory, {}); const { crop, n } = now.wants;
      if ((inv[crop] || 0) < n) return res.status(400).json({ error: `Kho chưa đủ ${n} ${C.CROPS[crop].name.toLowerCase()} (đang có ${inv[crop] || 0})` });
      inv[crop] -= n; if (inv[crop] <= 0) delete inv[crop];
      const coins = Math.round(C.PRODUCE_PRICE[crop] * n * C.NPC_TRADE_BONUS);
      const lock = await prisma.farmState.updateMany({ where: { userId, updatedAt: farm2.updatedAt }, data: { inventory: JSON.stringify(inv), coins: { increment: coins }, daily: { ...daily, npc: { ...store, [now.key]: { ...st, traded: true } } } } });
      if (!lock.count) return res.status(409).json({ error: 'Thử lại nhé' });
      await prisma.user.update({ where: { id: userId }, data: { totalXP: { increment: 6 } }, select: { id: true } });
      res.json(await buildState(userId, { npcTrade: { crop, n, coins, xp: 6 } }));
    } catch (e) { console.error('[farm] npc trade', e); res.status(500).json({ error: 'Không bán được' }); }
  });

  return { npcView };
};
