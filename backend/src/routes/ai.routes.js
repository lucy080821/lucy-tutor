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

${type === 'MULTIPLE_CHOICE' ? `Các đáp án:\nA. ${options[0]}\nB. ${options[1]}\nC. ${options[2]}\nD. ${options[3]}\n\nYêu cầu trả về JSON có dạng:\n{\n  "correctOption": "A hoặc B hoặc C hoặc D",\n  "explanation": "Giải thích ngắn gọn tại sao..."\n}` : `Đây là câu hỏi Tự luận.\nYêu cầu trả về JSON có dạng:\n{\n  "correctOption": "Từ khóa / Đáp án đúng ngắn gọn nhất (ví dụ: book, apple, can)",\n  "explanation": "Câu trả lời mẫu và giải thích chi tiết..."\n}`}
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

router.post('/study-plan', async (req, res) => {
  try {
    const { goal, currentLevel, deadline, timePerDay, weakAreas, name } = req.body;
    if (!goal || !currentLevel) return res.status(400).json({ error: 'Missing fields' });

    const weeksUntilDeadline = deadline
      ? Math.max(1, Math.ceil((new Date(deadline) - Date.now()) / (7 * 24 * 60 * 60 * 1000)))
      : 8;

    const prompt = `
You are an expert IELTS/English tutor building a personalized study plan for a Vietnamese student.

Student profile:
- Name: ${name || 'Student'}
- Goal: ${goal}
- Current level: ${currentLevel}
- Study time per day: ${timePerDay} minutes
- Weeks until exam: ${weeksUntilDeadline}
- Weak areas: ${weakAreas?.join(', ') || 'General English'}

Create a realistic, week-by-week study plan. Respond ONLY with valid JSON:
{
  "summary": "One paragraph summary of the plan in Vietnamese",
  "targetDate": "${deadline || 'N/A'}",
  "weeklySchedule": [
    {
      "week": 1,
      "focus": "Main focus topic in Vietnamese",
      "skills": ["Reading", "Grammar"],
      "dailyTasks": ["Task 1 in Vietnamese", "Task 2 in Vietnamese", "Task 3 in Vietnamese"]
    }
  ],
  "resources": [
    {
      "title": "Resource name in Vietnamese",
      "type": "Practice|Reading|Listening|Speaking|Writing|Flashcard|Grammar",
      "priority": "High|Medium|Low"
    }
  ],
  "tips": ["Tip 1 in Vietnamese", "Tip 2 in Vietnamese", "Tip 3 in Vietnamese", "Tip 4 in Vietnamese", "Tip 5 in Vietnamese"]
}

Create ${Math.min(weeksUntilDeadline, 8)} weeks. Make tasks specific, actionable, and time-bounded to ${timePerDay} minutes per day.
Focus heavily on: ${weakAreas?.join(', ') || 'all skills'}.
All content must be in Vietnamese.
`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an English education expert. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.6,
      response_format: { type: 'json_object' }
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Failed to parse plan' });
    }
    res.json(plan);
  } catch (error) {
    console.error('Study plan error:', error);
    res.status(500).json({ error: 'Failed to generate study plan' });
  }
});

router.post('/speaking-feedback', async (req, res) => {
  try {
    const { transcript, prompt: topicPrompt, part } = req.body;
    if (!transcript) return res.status(400).json({ error: 'Missing transcript' });

    const systemPrompt = `You are an IELTS Speaking examiner. Evaluate the student's spoken response and return a JSON object with IELTS band score criteria. Respond only in valid JSON.`;

    const userPrompt = `
You are grading an IELTS Speaking response. The student was asked:
"${topicPrompt || 'Speak freely on a given topic'}"

The student said (Speech-to-Text transcript):
"${transcript}"

Evaluate using IELTS Speaking band descriptors. Return a JSON object with:
{
  "bandScore": <number 1-9 with .5 increments, e.g. 6.5>,
  "fluency": "1-2 sentence evaluation of fluency and coherence with specific examples from transcript",
  "lexical": "1-2 sentence evaluation of vocabulary range and accuracy with specific examples",
  "grammar": "1-2 sentence evaluation of grammatical range and accuracy",
  "pronunciation": "1-2 sentence evaluation of pronunciation clarity and intelligibility",
  "suggestions": ["3 specific improvement suggestions tailored to this student's response"]
}

All text fields must be in Vietnamese.
Be constructive, specific, and encouraging. Reference actual words/phrases from their transcript.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.4,
      response_format: { type: "json_object" }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch {
      feedback = { fluency: 'Không thể phân tích. Vui lòng thử lại.', suggestions: [] };
    }
    res.json(feedback);
  } catch (error) {
    console.error('Speaking feedback error:', error);
    res.status(500).json({ error: 'Failed to generate feedback' });
  }
});

module.exports = router;
