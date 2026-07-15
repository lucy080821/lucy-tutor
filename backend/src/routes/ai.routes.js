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

const READING_LEVEL_LABELS = {
  A1: 'A1 - mới bắt đầu: câu đơn giản, từ vựng cơ bản nhất, chủ yếu thì hiện tại đơn',
  A2: 'A2 - sơ cấp: câu đơn giản, từ vựng thông dụng hàng ngày',
  B1: 'B1 - trung cấp: câu phức vừa phải, từ vựng đa dạng hơn',
  B2: 'B2 - trung cao cấp: câu phức, từ vựng học thuật nhẹ',
  C1: 'C1 - cao cấp: câu phức tạp, từ vựng học thuật/chuyên sâu, lập luận nhiều tầng'
};

const READING_TYPE_CATALOG = {
  MULTIPLE_CHOICE: `"type": "MULTIPLE_CHOICE", "question": "câu hỏi tiếng Anh", "options": ["A. ...","B. ...","C. ...","D. ..."], "correctIndex": số 0-3`,
  TRUE_FALSE: `"type": "TRUE_FALSE", "question": "một nhận định tiếng Anh cần xác định đúng/sai so với đoạn văn", "options": ["Đúng","Sai"], "correctIndex": 0 hoặc 1`,
  FILL_BLANK: `"type": "FILL_BLANK", "question": "câu trích/diễn giải từ đoạn văn có chỗ trống _____ (5 dấu gạch dưới) thay 1 từ/cụm từ ngắn (tối đa 3 từ) lấy NGUYÊN VĂN từ đoạn văn", "correctAnswer": "từ/cụm từ đúng, đúng chính tả từ đoạn văn"`,
  YES_NO_NOTGIVEN: `"type": "YES_NO_NOTGIVEN", "question": "một nhận định tiếng Anh cần xác định Yes/No/Not Given so với đoạn văn (Not Given nếu đoạn văn không đề cập)", "options": ["Yes","No","Not Given"], "correctIndex": 0-2`,
  MATCHING_HEADING: `"type": "MATCHING_HEADING", "question": "Chọn tiêu đề phù hợp nhất cho Đoạn [X]" (X là ký hiệu đoạn văn cụ thể trong bài, ví dụ Đoạn B), "options": ít nhất 4 tiêu đề tiếng Anh khác nhau (chỉ 1 đúng cho đoạn này), "correctIndex": chỉ số tiêu đề đúng`,
  MATCHING_INFORMATION: `"type": "MATCHING_INFORMATION", "question": "một thông tin/chi tiết cụ thể bằng tiếng Anh cần xác định nằm ở đoạn nào trong bài", "options": ["Đoạn A","Đoạn B","Đoạn C","Đoạn D"] (đúng số đoạn thực tế có trong bài), "correctIndex": chỉ số đoạn đúng chứa thông tin đó`,
  MATCHING_FEATURES: `"type": "MATCHING_FEATURES", "question": "một nhận định tiếng Anh cần xác định thuộc về đối tượng/nhân vật/mốc thời gian nào được nhắc trong bài", "options": tên các đối tượng liên quan xuất hiện trong bài, "correctIndex": chỉ số đúng`,
  SUMMARY_COMPLETION: `"type": "SUMMARY_COMPLETION", "question": "một câu tóm tắt nội dung bài đọc có chỗ trống _____, và NGAY TRONG question thêm dòng 'Ngân hàng từ: word1, word2, word3, word4'", "options": ["word1","word2","word3","word4"] (các lựa chọn trong ngân hàng từ, xáo trộn thứ tự, đúng 1 từ hợp câu), "correctIndex": chỉ số từ đúng trong options`,
  SENTENCE_COMPLETION: `"type": "SENTENCE_COMPLETION", "question": "câu có chỗ trống _____ cần hoàn thành bằng từ/cụm từ LẤY NGUYÊN VĂN từ đoạn văn", "wordLimit": "KHÔNG QUÁ 3 TỪ" (hoặc giới hạn phù hợp), "correctAnswer": "từ/cụm từ đúng nguyên văn từ bài"`,
  SHORT_ANSWER: `"type": "SHORT_ANSWER", "question": "câu hỏi Wh- (What/Who/When/Where/Why/How) cần trả lời ngắn gọn bằng từ/cụm từ LẤY NGUYÊN VĂN từ đoạn văn", "wordLimit": "KHÔNG QUÁ 3 TỪ", "correctAnswer": "từ/cụm từ đúng nguyên văn từ bài"`
};

const PARAGRAPH_DEPENDENT_TYPES = ['MATCHING_HEADING', 'MATCHING_INFORMATION', 'MATCHING_FEATURES'];

router.post('/generate-reading-passage', async (req, res) => {
  try {
    const { topic, level, purpose, length, questionTypes, numQuestions } = req.body;

    const lengthLabel = { SHORT: 'ngắn (100-150 từ)', MEDIUM: 'trung bình (200-250 từ)', LONG: 'dài (300-380 từ)' }[length] || 'trung bình (200-250 từ)';
    const count = Math.min(15, Math.max(1, parseInt(numQuestions, 10) || 4));
    const levelLabel = READING_LEVEL_LABELS[level] || READING_LEVEL_LABELS.B1;
    const purposeLabel = purpose === 'IELTS'
      ? 'Đây là bài luyện đọc theo định hướng thi IELTS Reading — văn phong học thuật/trang trọng, chủ đề mang tính thông tin/khoa học/xã hội như đề thi IELTS thật.'
      : 'Đây là bài luyện đọc giao tiếp/đời sống — văn phong tự nhiên, gần gũi, chủ đề đời thường dễ liên hệ.';

    const types = Array.isArray(questionTypes) && questionTypes.length > 0
      ? questionTypes.filter((t) => READING_TYPE_CATALOG[t])
      : ['MULTIPLE_CHOICE'];
    const typeShapes = types.map((t, i) => `${i + 1}. ${READING_TYPE_CATALOG[t]}`).join('\n');
    const needsParagraphLabels = types.some((t) => PARAGRAPH_DEPENDENT_TYPES.includes(t));

    const prompt = `
Bạn là chuyên gia ra đề đọc hiểu tiếng Anh cho học viên Việt Nam.
Viết một đoạn văn tiếng Anh có độ dài ${lengthLabel} về chủ đề: "${topic || 'một chủ đề bất kỳ thú vị, phù hợp luyện đọc hiểu'}".
Trình độ: ${levelLabel}.
${purposeLabel}
${needsParagraphLabels ? 'QUAN TRỌNG: Đoạn văn PHẢI được chia thành ít nhất 4 đoạn (paragraph), mỗi đoạn bắt đầu bằng nhãn chữ cái in hoa và dấu chấm (ví dụ "A. ", "B. ", "C. ", "D. ") ngay đầu đoạn trong trường "passage" — đây là nhãn đoạn văn để học viên tra cứu, không phải đáp án trắc nghiệm.' : ''}

Sau đó tạo đúng ${count} câu hỏi dựa trên đoạn văn đó, PHÂN BỔ ĐỀU giữa các dạng câu hỏi sau (mỗi dạng xuất hiện ít nhất 1 lần nếu ${count} đủ lớn), mỗi câu trong mảng "questions" phải có trường "type" và đúng cấu trúc tương ứng:
${typeShapes}

BẮT BUỘC TRẢ VỀ CHỈ MỘT JSON với cấu trúc sau (không có markdown code blocks bọc ngoài JSON):
{
  "title": "Tiêu đề ngắn bằng tiếng Anh cho đoạn văn",
  "passage": "Toàn bộ đoạn văn tiếng Anh",
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "question": "Câu hỏi bằng tiếng Anh",
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "correctIndex": 0,
      "explanation": "Giải thích kỹ bằng tiếng Việt tại sao đáp án đó đúng — trích dẫn nguyên câu trong đoạn văn làm căn cứ, và giải thích ngắn vì sao các đáp án còn lại sai. Bọc phần từ khóa/câu trích dẫn quan trọng nhất trong dấu **hai dấu sao** để đánh dấu cần lưu ý."
    }
  ]
}

Phải có đúng ${count} câu hỏi trong mảng "questions", đúng theo các dạng đã liệt kê ở trên. Mọi câu hỏi phải có trường "explanation" bằng tiếng Việt dù thuộc dạng nào.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an English reading comprehension exercise generator. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let passage;
    try {
      passage = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }
    res.json(passage);
  } catch (error) {
    console.error('Generate reading passage error:', error);
    res.status(500).json({ error: 'Failed to generate reading passage' });
  }
});

const WRITING_LEVEL_LABELS = {
  A1: 'A1 - mới bắt đầu: câu đơn giản, từ vựng cơ bản nhất',
  A2: 'A2 - sơ cấp: câu đơn giản, từ vựng thông dụng hàng ngày',
  B1: 'B1 - trung cấp: câu phức vừa phải, từ vựng đa dạng hơn',
  B2: 'B2 - trung cao cấp: câu phức, lập luận rõ ràng, từ vựng học thuật nhẹ',
  C1: 'C1 - cao cấp: lập luận nhiều tầng, từ vựng học thuật/chuyên sâu'
};

router.post('/generate-writing-prompt', async (req, res) => {
  try {
    const { topic, format, level, purpose } = req.body;
    const formatLabel = { PARAGRAPH: 'một đoạn văn ngắn (80-120 từ)', EMAIL: 'một email/thư ngắn', ESSAY: 'một bài luận ngắn (150-200 từ)' }[format] || 'một đoạn văn ngắn (80-120 từ)';
    const levelLabel = WRITING_LEVEL_LABELS[level] || WRITING_LEVEL_LABELS.B1;
    const purposeLabel = purpose === 'IELTS'
      ? 'Đây là đề luyện viết theo định hướng thi IELTS Writing — ra đề theo phong cách IELTS Task 1/Task 2 (trình bày quan điểm, so sánh, giải quyết vấn đề...), yêu cầu lập luận rõ ràng.'
      : 'Đây là đề luyện viết giao tiếp/đời sống — chủ đề gần gũi, thực dụng (email, tin nhắn, đoạn văn kể chuyện...).';

    const prompt = `
Bạn là gia sư tiếng Anh. Hãy ra một đề bài luyện viết tiếng Anh cho học viên, yêu cầu học viên viết ${formatLabel}.
Chủ đề: "${topic || 'một chủ đề đời sống gần gũi, dễ viết'}".
Trình độ học viên: ${levelLabel}. Độ khó và độ phức tạp của yêu cầu trong đề bài phải phù hợp với trình độ này.
${purposeLabel}

Trả về JSON:
{
  "promptEn": "Đề bài bằng tiếng Anh, mô tả rõ học viên cần viết gì, có thể kèm 2-3 gợi ý ý chính cần đề cập",
  "promptVi": "Bản dịch tiếng Việt tương ứng của promptEn, cùng nội dung, cùng số gợi ý ý chính",
  "format": "${format || 'PARAGRAPH'}"
}
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an English writing exercise generator. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'AI response was not valid JSON' });
    }
    res.json(result);
  } catch (error) {
    console.error('Generate writing prompt error:', error);
    res.status(500).json({ error: 'Failed to generate writing prompt' });
  }
});

router.post('/writing-feedback', async (req, res) => {
  try {
    const { promptEn, promptVi, submission, level, purpose } = req.body;
    if (!submission || !submission.trim()) return res.status(400).json({ error: 'Thiếu bài viết' });
    const levelLabel = WRITING_LEVEL_LABELS[level] || WRITING_LEVEL_LABELS.B1;
    const purposeNote = purpose === 'IELTS' ? 'Học viên đang luyện theo định hướng IELTS Writing — góp ý theo hướng cải thiện band điểm (task response, coherence, lexical resource, grammar range).' : 'Học viên đang luyện viết cho mục đích giao tiếp/đời sống — góp ý theo hướng viết tự nhiên, dễ hiểu, đúng ngữ cảnh thực tế.';

    const prompt = `
Bạn là một gia sư tiếng Anh thân thiện, đang góp ý chi tiết cho một bài luyện viết (không phải bài thi, không chấm điểm/band số).

Đề bài (English): "${promptEn || 'Viết tự do'}"
Đề bài (Tiếng Việt): "${promptVi || ''}"
Trình độ học viên: ${levelLabel}. ${purposeNote}

Bài viết của học viên:
"${submission.trim()}"

Hãy đưa ra nhận xét mang tính khích lệ nhưng PHÂN TÍCH THẬT KỸ, dựa trên câu chữ thực tế học viên đã viết. Với phần ngữ pháp và từ vựng, bắt buộc phải phân tích cấu trúc câu cụ thể (chủ ngữ - động từ - tân ngữ, thì gì, mệnh đề gì), không chỉ nói chung chung.

Trả về JSON với cấu trúc:
{
  "overall": "1-2 câu nhận xét tổng quan, khích lệ",
  "grammar": "Phân tích ngữ pháp THẬT KỸ (tối thiểu 4-6 câu): với MỖI lỗi tìm thấy, trích nguyên câu học viên viết sai, chỉ rõ đó là lỗi gì (thì, chia động từ, mạo từ, giới từ, cấu trúc câu...), giải thích TẠI SAO sai (phân tích cấu trúc ngữ pháp), và đưa ra câu đã sửa đúng. Nếu câu đúng ngữ pháp, phân tích cấu trúc câu đó để học viên hiểu vì sao đúng. Bọc phần lỗi sai và phần đã sửa trong dấu **hai dấu sao** để đánh dấu cần lưu ý.",
  "vocabulary": "Phân tích từ vựng chi tiết (tối thiểu 3-4 câu): nhận xét về mức độ phong phú/chính xác của từ vựng đã dùng, với TỪNG từ/cụm từ tiếng Anh có thể dùng hay hơn, trích từ gốc tiếng Anh học viên dùng và đề xuất từ/cụm từ TIẾNG ANH thay thế hay hơn (KHÔNG dịch sang tiếng Việt — luôn đề xuất từ tiếng Anh khác, chỉ giải thích nghĩa bằng tiếng Việt trong ngoặc). Bọc từ gốc và từ tiếng Anh đề xuất thay thế trong dấu **hai dấu sao**.",
  "organization": "Nhận xét về bố cục, mạch ý, sự liên kết giữa các câu/đoạn",
  "clarity": "Đánh giá độ dễ đọc/rõ ràng cho người đọc: câu văn có mạch lạc, dễ theo dõi, truyền đạt đủ ý không, có đoạn nào tối nghĩa/lủng củng khiến người đọc phải đọc lại không. Đây là góc nhìn của NGƯỜI ĐỌC, khác với phần ngữ pháp/từ vựng.",
  "suggestions": ["2-3 gợi ý cải thiện cụ thể, dễ áp dụng"],
  "internalScore": "Ước tính chất lượng bài viết (số 0-10, có thể lẻ .5) dựa trên độ chính xác ngữ pháp, độ phong phú từ vựng, mạch lạc bố cục và độ dễ đọc — CHỈ dùng nội bộ để theo dõi tiến độ học tập, KHÔNG được nhắc đến trong bất kỳ trường text nào ở trên"
}

Tất cả nội dung bằng tiếng Việt (trích dẫn câu/từ tiếng Anh của học viên khi cần). Các trường "overall"/"grammar"/"vocabulary"/"organization"/"clarity"/"suggestions" TUYỆT ĐỐI không được nhắc đến thang điểm hay điểm số — chỉ "internalScore" mới là số.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a friendly, encouraging English writing coach who gives thorough, structural grammar analysis. Respond only in valid JSON. The only numeric score allowed anywhere is the "internalScore" field — never mention a score inside the other text fields.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let feedback;
    try {
      feedback = JSON.parse(raw);
    } catch {
      feedback = { overall: 'Không thể phân tích lúc này. Vui lòng thử lại.', grammar: '', vocabulary: '', organization: '', clarity: '', suggestions: [] };
    }
    res.json(feedback);
  } catch (error) {
    console.error('Writing feedback error:', error);
    res.status(500).json({ error: 'Failed to generate writing feedback' });
  }
});

// ---- Writing: history & saved prompts ----

router.post('/writing-submissions', async (req, res) => {
  try {
    const { userId, prompt, format, level, purpose, essay, feedback } = req.body;
    if (!userId || !prompt || !essay) return res.status(400).json({ error: 'Thiếu dữ liệu bài viết' });

    const submission = await prisma.writingSubmission.create({
      data: {
        userId, prompt,
        format: format || 'ESSAY',
        level: level || 'B1',
        purpose: purpose || 'GENERAL',
        essay,
        feedback: feedback ? JSON.stringify(feedback) : null
      }
    });
    res.json(submission);
  } catch (error) {
    console.error('Save writing submission error:', error);
    res.status(500).json({ error: 'Failed to save writing submission' });
  }
});

router.get('/writing-submissions/:userId', async (req, res) => {
  try {
    const submissions = await prisma.writingSubmission.findMany({
      where: { userId: req.params.userId },
      orderBy: { practicedAt: 'desc' }
    });
    res.json(submissions);
  } catch (error) {
    console.error('Fetch writing submissions error:', error);
    res.status(500).json({ error: 'Failed to fetch writing submissions' });
  }
});

router.post('/writing-saved-prompts', async (req, res) => {
  try {
    const { userId, prompt, format, level, purpose } = req.body;
    if (!userId || !prompt) return res.status(400).json({ error: 'Thiếu dữ liệu đề bài' });

    const saved = await prisma.savedWritingPrompt.create({
      data: { userId, prompt, format: format || 'ESSAY', level: level || 'B1', purpose: purpose || 'GENERAL' }
    });
    res.json(saved);
  } catch (error) {
    console.error('Save writing prompt error:', error);
    res.status(500).json({ error: 'Failed to save writing prompt' });
  }
});

router.get('/writing-saved-prompts/:userId', async (req, res) => {
  try {
    const saved = await prisma.savedWritingPrompt.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(saved);
  } catch (error) {
    console.error('Fetch saved writing prompts error:', error);
    res.status(500).json({ error: 'Failed to fetch saved writing prompts' });
  }
});

router.delete('/writing-saved-prompts/:id', async (req, res) => {
  try {
    await prisma.savedWritingPrompt.delete({ where: { id: req.params.id } });
    res.json({ message: 'Đã xóa đề đã lưu' });
  } catch (error) {
    console.error('Delete saved writing prompt error:', error);
    res.status(500).json({ error: 'Failed to delete saved writing prompt' });
  }
});

// ---- Reading: post-submit AI analysis & history ----

router.post('/reading-analysis', async (req, res) => {
  try {
    const { passage, questions, results, level } = req.body;
    if (!passage || !Array.isArray(questions) || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Thiếu dữ liệu bài đọc/câu hỏi/kết quả' });
    }

    const byType = {};
    results.forEach((r, i) => {
      const type = questions[i]?.type || 'UNKNOWN';
      if (!byType[type]) byType[type] = { correct: 0, total: 0 };
      byType[type].total += 1;
      if (r.correct) byType[type].correct += 1;
    });
    const typeSummary = Object.entries(byType).map(([type, s]) => `${type}: ${s.correct}/${s.total} đúng`).join('; ');

    const prompt = `
Bạn là gia sư luyện đọc hiểu tiếng Anh, đang phân tích kết quả một bài luyện đọc của học viên (trình độ ${level || 'B1'}).

Đoạn văn: "${passage}"

Kết quả theo từng dạng câu hỏi: ${typeSummary}

Chi tiết từng câu (đúng/sai):
${results.map((r, i) => `Câu ${i + 1} (${questions[i]?.type}): ${r.correct ? 'ĐÚNG' : 'SAI'} — câu hỏi: "${questions[i]?.question}"`).join('\n')}

Hãy phân tích và đưa ra chiến thuật làm bài phù hợp với TỪNG DẠNG câu hỏi học viên đã làm, đặc biệt các dạng còn sai. Trả về JSON:
{
  "overall": "1-2 câu nhận xét tổng quan về kết quả bài đọc",
  "byType": [
    { "type": "tên dạng câu hỏi (đúng với type gốc, ví dụ MULTIPLE_CHOICE)", "note": "Nhận xét + chiến thuật làm dạng này (ví dụ: kỹ thuật skimming/scanning, cách loại trừ đáp án nhiễu, cách xác định Not Given...), dựa trên kết quả thực tế của học viên ở dạng này" }
  ],
  "suggestions": ["2-3 gợi ý luyện tập cụ thể tiếp theo"]
}
Tất cả bằng tiếng Việt.
`;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are an English reading strategy coach. Respond only in valid JSON.' },
        { role: 'user', content: prompt }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.5,
      response_format: { type: 'json_object' }
    });

    const raw = chatCompletion.choices[0]?.message?.content || '{}';
    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch {
      analysis = { overall: 'Không thể phân tích lúc này. Vui lòng thử lại.', byType: [], suggestions: [] };
    }
    res.json(analysis);
  } catch (error) {
    console.error('Reading analysis error:', error);
    res.status(500).json({ error: 'Failed to generate reading analysis' });
  }
});

router.post('/reading-attempts', async (req, res) => {
  try {
    const { userId, topic, passage, level, purpose, questions, answers, score, analysis } = req.body;
    if (!userId || !passage || !questions) return res.status(400).json({ error: 'Thiếu dữ liệu bài đọc' });

    const attempt = await prisma.readingAttempt.create({
      data: {
        userId,
        topic: topic || null,
        passage,
        level: level || 'B1',
        purpose: purpose || 'GENERAL',
        questions: JSON.stringify(questions),
        answers: JSON.stringify(answers || {}),
        score: parseFloat(score) || 0,
        analysis: analysis ? JSON.stringify(analysis) : null
      }
    });
    res.json(attempt);
  } catch (error) {
    console.error('Save reading attempt error:', error);
    res.status(500).json({ error: 'Failed to save reading attempt' });
  }
});

router.patch('/reading-attempts/:id', async (req, res) => {
  try {
    const { analysis } = req.body;
    const attempt = await prisma.readingAttempt.update({
      where: { id: req.params.id },
      data: { analysis: analysis ? JSON.stringify(analysis) : null }
    });
    res.json(attempt);
  } catch (error) {
    console.error('Update reading attempt analysis error:', error);
    res.status(500).json({ error: 'Failed to update reading attempt' });
  }
});

router.get('/reading-attempts/:userId', async (req, res) => {
  try {
    const attempts = await prisma.readingAttempt.findMany({
      where: { userId: req.params.userId },
      orderBy: { practicedAt: 'desc' }
    });
    res.json(attempts);
  } catch (error) {
    console.error('Fetch reading attempts error:', error);
    res.status(500).json({ error: 'Failed to fetch reading attempts' });
  }
});

module.exports = router;
