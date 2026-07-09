const express = require('express');
const { Groq } = require('groq-sdk');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' });

const MODEL = 'llama-3.3-70b-versatile';

// ---- Teacher: topic management ----

// Teacher creates a conversation topic/persona, scoped to a classroom or a single student
router.post('/topics', async (req, res) => {
  try {
    const { title, description, aiPersona, openingLine, teacherId, classroomId, studentId } = req.body;

    if (!title || !aiPersona || !teacherId) return res.status(400).json({ error: 'Thiếu tiêu đề, persona AI hoặc teacherId' });
    if (!classroomId && !studentId) return res.status(400).json({ error: 'Phải chọn lớp học hoặc học sinh cụ thể' });
    if (classroomId && studentId) return res.status(400).json({ error: 'Chỉ được chọn 1 trong 2: lớp học hoặc học sinh' });

    const topic = await prisma.speakingTopic.create({
      data: {
        title,
        description: description || null,
        aiPersona,
        openingLine: openingLine || null,
        teacherId,
        classroomId: classroomId || null,
        studentId: studentId || null
      }
    });

    res.json({ message: 'Tạo chủ đề thành công', topic });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Teacher's own topics (for the management list)
router.get('/topics', async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!teacherId) return res.status(400).json({ error: 'Missing teacherId' });

    const topics = await prisma.speakingTopic.findMany({
      where: { teacherId },
      include: {
        classroom: { select: { name: true } },
        student: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, aiPersona, openingLine, classroomId, studentId } = req.body;

    const topic = await prisma.speakingTopic.findUnique({ where: { id } });
    if (!topic) return res.status(404).json({ error: 'Not found' });

    if (!classroomId && !studentId) return res.status(400).json({ error: 'Phải chọn lớp học hoặc học sinh cụ thể' });
    if (classroomId && studentId) return res.status(400).json({ error: 'Chỉ được chọn 1 trong 2: lớp học hoặc học sinh' });

    const updated = await prisma.speakingTopic.update({
      where: { id },
      data: {
        title: title || topic.title,
        description: description !== undefined ? description : topic.description,
        aiPersona: aiPersona || topic.aiPersona,
        openingLine: openingLine !== undefined ? openingLine : topic.openingLine,
        classroomId: classroomId || null,
        studentId: studentId || null
      }
    });

    res.json({ message: 'Cập nhật thành công', topic: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/topics/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await prisma.speakingTopic.findUnique({ where: { id } });
    if (!topic) return res.status(404).json({ error: 'Not found' });

    await prisma.speakingTopic.delete({ where: { id } });
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Student: available topics ----

// Topics assigned to the student's classroom(s) or directly to them
router.get('/topics/available/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { classroomsJoined: { select: { id: true } } }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const classroomIds = user.classroomsJoined.map((c) => c.id);

    const topics = await prisma.speakingTopic.findMany({
      where: {
        OR: [
          { studentId: userId },
          ...(classroomIds.length ? [{ classroomId: { in: classroomIds } }] : [])
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(topics);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Conversation sessions ----

// Start a session: AI opens the conversation using the topic's persona
router.post('/sessions', async (req, res) => {
  try {
    const { userId, topicId } = req.body;
    if (!userId || !topicId) return res.status(400).json({ error: 'Thiếu userId hoặc topicId' });

    const topic = await prisma.speakingTopic.findUnique({ where: { id: topicId } });
    if (!topic) return res.status(404).json({ error: 'Không tìm thấy chủ đề' });

    let openingMessage = topic.openingLine;
    if (!openingMessage) {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: topic.aiPersona },
          { role: 'user', content: 'Hãy mở đầu cuộc hội thoại bằng 1-2 câu ngắn gọn, tự nhiên, đúng với vai trò của bạn.' }
        ],
        model: MODEL,
        temperature: 0.8
      });
      openingMessage = chatCompletion.choices[0]?.message?.content?.trim() || 'Xin chào! Chúng ta bắt đầu nhé.';
    }

    const messages = [{ role: 'assistant', content: openingMessage }];

    const session = await prisma.speakingSession.create({
      data: {
        userId,
        topicId,
        messages: JSON.stringify(messages)
      }
    });

    res.json({ session, firstMessage: openingMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// One turn: student's spoken transcript in, AI's natural reply out
router.post('/sessions/:id/turn', async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript } = req.body;
    if (!transcript || !transcript.trim()) return res.status(400).json({ error: 'Thiếu nội dung transcript' });

    const session = await prisma.speakingSession.findUnique({ where: { id }, include: { topic: true } });
    if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên hội thoại' });
    if (session.status === 'COMPLETED') return res.status(400).json({ error: 'Phiên hội thoại đã kết thúc' });

    const messages = JSON.parse(session.messages);
    messages.push({ role: 'user', content: transcript.trim() });

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: session.topic.aiPersona },
        ...messages
      ],
      model: MODEL,
      temperature: 0.8
    });

    const reply = chatCompletion.choices[0]?.message?.content?.trim() || 'Xin lỗi, bạn có thể nói lại được không?';
    messages.push({ role: 'assistant', content: reply });

    await prisma.speakingSession.update({
      where: { id },
      data: { messages: JSON.stringify(messages) }
    });

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// End the session: generate friendly coaching feedback from the full transcript
router.post('/sessions/:id/finish', async (req, res) => {
  try {
    const { id } = req.params;
    const session = await prisma.speakingSession.findUnique({ where: { id }, include: { topic: true } });
    if (!session) return res.status(404).json({ error: 'Không tìm thấy phiên hội thoại' });

    const messages = JSON.parse(session.messages);
    const transcriptText = messages
      .map((m) => `${m.role === 'user' ? 'Học sinh' : 'AI'}: ${m.content}`)
      .join('\n');

    const prompt = `
Bạn là một gia sư tiếng Anh thân thiện, đang nhận xét một buổi luyện nói (hội thoại tự do, không phải bài thi) giữa học sinh và AI đóng vai theo tình huống: "${session.topic.title}".

Toàn bộ hội thoại:
${transcriptText}

Hãy đưa ra nhận xét mang tính khích lệ, cụ thể, dựa trên câu chữ thực tế học sinh đã nói. Đây KHÔNG phải bài thi, KHÔNG chấm điểm/band số, chỉ là góp ý luyện tập.

Trả về JSON với cấu trúc:
{
  "overall": "1-2 câu nhận xét tổng quan, khích lệ",
  "fluency": "Nhận xét về độ trôi chảy, phản xạ trong hội thoại",
  "vocabulary": "Nhận xét về từ vựng đã dùng, gợi ý từ hay hơn nếu có",
  "grammar": "Nhận xét về ngữ pháp, chỉ ra lỗi cụ thể nếu có (kèm ví dụ câu đã nói)",
  "suggestions": ["2-3 gợi ý cải thiện cụ thể, dễ áp dụng"],
  "internalScore": "Ước tính chất lượng hội thoại (số 0-10, có thể lẻ .5) dựa trên độ trôi chảy/từ vựng/ngữ pháp thể hiện qua hội thoại — CHỈ dùng nội bộ để theo dõi tiến độ học tập, KHÔNG được nhắc đến trong bất kỳ trường text nào ở trên"
}

Tất cả nội dung bằng tiếng Việt. Các trường "overall"/"fluency"/"vocabulary"/"grammar"/"suggestions" TUYỆT ĐỐI không được nhắc đến thang điểm hay điểm số — chỉ "internalScore" mới là số.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a friendly, encouraging English speaking coach. Respond only in valid JSON. The only numeric score allowed anywhere is the "internalScore" field — never mention a score inside the other text fields.' },
        { role: 'user', content: prompt }
      ],
      model: MODEL,
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch {
      feedback = {
        overall: 'Không thể phân tích lúc này. Vui lòng thử lại.',
        fluency: '', vocabulary: '', grammar: '', suggestions: []
      };
    }

    const updated = await prisma.speakingSession.update({
      where: { id },
      data: { status: 'COMPLETED', feedback: JSON.stringify(feedback) }
    });

    res.json({ session: updated, feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Session history for a student (optional past-sessions list)
router.get('/sessions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await prisma.speakingSession.findMany({
      where: { userId },
      include: { topic: { select: { title: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
