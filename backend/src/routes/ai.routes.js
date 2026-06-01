const express = require('express');
const { Groq } = require('groq-sdk');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || 'fake_key_for_now' 
});

router.post('/explain', async (req, res) => {
  try {
    const { questionContent, options, studentAnswer, correctAnswer, userId } = req.body;

    if (!questionContent || !studentAnswer || !correctAnswer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const prompt = `
Bạn tên là Lucy, một gia sư Tiếng Anh nhiệt tình, thông minh và thân thiện.
Học sinh vừa làm sai một câu hỏi trắc nghiệm tiếng Anh.

Nhiệm vụ của bạn:
1. Phân loại câu hỏi này thuộc mảng nào trong 3 mảng: GRAMMAR, VOCABULARY, hoặc READING. Trả về đúng 1 từ tiếng Anh in hoa trong trường "category".
2. Xác định "topic" (chủ đề ngữ pháp/từ vựng) của lỗi sai này bằng SONG NGỮ (Ví dụ: "Câu điều kiện (Conditional Sentences)").
3. Viết "explanation": Giải thích ngắn gọn tại sao học sinh sai và đáp án đúng là gì. TRÌNH BÀY GỌN GÀNG, KHÔNG SỬ DỤNG MARKDOWN.
4. Viết "theoryContent": Một bài giảng chi tiết (Sổ tay) giải thích toàn bộ lý thuyết, công thức, cách dùng liên quan đến "topic" này bằng tiếng Việt. CÓ THỂ sử dụng Markdown cho phần theoryContent này để bài giảng đẹp và rõ ràng.

Câu hỏi: "${questionContent}"
Các đáp án: ${JSON.stringify(options)}
Học sinh chọn: "${studentAnswer}"
Đáp án đúng là: "${correctAnswer}"

BẮT BUỘC trả về dữ liệu dưới định dạng JSON nguyên chất (không có markdown code blocks bọc ngoài JSON), với cấu trúc sau:
{
  "category": "GRAMMAR",
  "topic": "Tên chủ đề",
  "explanation": "Giải thích ngắn gọn cho câu này...",
  "theoryContent": "Lý thuyết chi tiết (có thể dùng markdown) về chủ đề này..."
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful English tutor AI. You must respond in valid JSON format.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: "json_object" }
    });

    const aiResponseStr = chatCompletion.choices[0]?.message?.content || '{}';
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseStr);
    } catch (e) {
      aiResponse = {
        explanation: 'Xin lỗi, AI đang gặp sự cố và không thể giải thích lúc này.',
        topic: 'Lỗi không xác định',
        theoryContent: 'Không thể tải lý thuyết.'
      };
    }

    // Save to Database if userId is provided
    if (userId && aiResponse.topic) {
      // Check if this topic already exists for this user
      const existingNotebook = await prisma.mistakeNotebook.findUnique({
        where: {
          userId_topic: {
            userId: userId,
            topic: aiResponse.topic
          }
        }
      });

      if (existingNotebook) {
        await prisma.mistakeNotebook.update({
          where: { id: existingNotebook.id },
          data: { 
            mistakeCount: existingNotebook.mistakeCount + 1,
            // Optionally update the theory if we want the latest explanation
          }
        });
      } else {
        await prisma.mistakeNotebook.create({
          data: {
            userId: userId,
            topic: aiResponse.topic,
            category: aiResponse.category || 'GRAMMAR',
            theoryContent: aiResponse.theoryContent || 'Đang cập nhật...',
            mistakeCount: 1
          }
        });
      }
    }

    res.json(aiResponse);
  } catch (error) {
    console.error('Groq AI Error:', error);
    res.status(500).json({ error: 'Failed to generate explanation', details: error.message });
  }
});

router.get('/notebook/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const notebooks = await prisma.mistakeNotebook.findMany({
      where: { userId: userId },
      orderBy: { updatedAt: 'desc' }
    });
    res.json(notebooks);
  } catch (error) {
    console.error('Fetch Notebook Error:', error);
    res.status(500).json({ error: 'Failed to fetch notebook' });
  }
});



router.post('/solve-question', async (req, res) => {
  try {
    const { heading, content, options, type } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Missing question content' });
    }

    const prompt = `
Bạn là một chuyên gia giáo dục Tiếng Anh.
Nhiệm vụ của bạn là giải quyết câu hỏi sau và cung cấp đáp án cùng giải thích ngắn gọn, dễ hiểu.

${heading ? `Đoạn văn chung / Tiêu đề:\n"${heading}"\n` : ''}
Câu hỏi:\n"${content}"

${type === 'MULTIPLE_CHOICE' ? `Các đáp án:\nA. ${options[0]}\nB. ${options[1]}\nC. ${options[2]}\nD. ${options[3]}\n\nYêu cầu trả về JSON có dạng:\n{\n  "correctOption": "A hoặc B hoặc C hoặc D",\n  "explanation": "Giải thích ngắn gọn tại sao..."\n}` : `Đây là câu hỏi Tự luận.\nYêu cầu trả về JSON có dạng:\n{\n  "explanation": "Câu trả lời mẫu và giải thích ngắn gọn..."\n}`}
`;

    // Real API Call
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a helpful English tutor AI. You must respond in valid JSON format.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const aiResponseStr = chatCompletion.choices[0]?.message?.content || '{}';
    console.log('AI Response String:', aiResponseStr);
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseStr);
      console.log('Parsed AI Response:', aiResponse);
    } catch (e) {
      console.error('Failed to parse JSON:', e);
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }

    res.json(aiResponse);
  } catch (error) {
    console.error('Groq AI Error:', error);
    res.status(500).json({ error: 'Failed to solve question', details: error.message });
  }
});

router.post('/generate-grammar-exercise', async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Missing topic' });
    }

    const prompt = `
Bạn là chuyên gia ra đề thi tiếng Anh.
Tạo 3 câu hỏi thực hành ngữ pháp tiếng Anh về chủ đề: "${topic}".
Phải có đủ 3 dạng (mỗi dạng 1 câu):
1. type: "FIND_FIX" (Sửa lỗi sai): Cho một câu sai ngữ pháp (incorrectSentence), học sinh cần viết lại câu đúng (correctSentence).
2. type: "BUILDING" (Sắp xếp câu): Cho một mảng các từ xáo trộn (scrambledWords), học sinh cần sắp xếp thành câu đúng (correctSentence).
3. type: "TRANSFORM" (Biến đổi câu): Cho một câu gốc (originalSentence) và từ gợi ý (hint), học sinh cần viết lại câu (correctSentence) giữ nguyên nghĩa.

BẮT BUỘC TRẢ VỀ CHỈ MỘT JSON VỚI CẤU TRÚC SAU (không có markdown code blocks bọc ngoài JSON):
{
  "questions": [
    {
      "type": "FIND_FIX",
      "incorrectSentence": "Câu sai tiếng Anh",
      "correctSentence": "Câu đúng tiếng Anh",
      "explanation": "Giải thích ngắn gọn tiếng Việt"
    },
    {
      "type": "BUILDING",
      "scrambledWords": ["word1", "word2", "word3"],
      "correctSentence": "Câu đúng hoàn chỉnh tiếng Anh",
      "explanation": "Giải thích ngắn gọn tiếng Việt"
    },
    {
      "type": "TRANSFORM",
      "originalSentence": "Câu gốc tiếng Anh",
      "hint": "Gợi ý (ví dụ 'If I...')",
      "correctSentence": "Câu hoàn chỉnh tiếng Anh",
      "explanation": "Giải thích ngắn gọn tiếng Việt"
    }
  ]
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You must respond in valid JSON format only.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const aiResponseStr = chatCompletion.choices[0]?.message?.content || '{"questions":[]}';
    let aiResponse;
    try {
      aiResponse = JSON.parse(aiResponseStr);
    } catch (e) {
      console.error('Failed to parse AI exercise:', e);
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }

    res.json(aiResponse);
  } catch (error) {
    console.error('Groq AI Error (Exercise):', error);
    res.status(500).json({ error: 'Failed to generate exercise' });
  }
});

module.exports = router;
