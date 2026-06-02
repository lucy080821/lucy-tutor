const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEssaySubmit() {
  // Get an ESSAY exam
  const exam = await prisma.exam.findFirst({
    where: { questions: { some: { question: { type: 'ESSAY' } } } },
    include: { questions: { include: { question: true } } }
  });

  if (!exam) { console.log("No ESSAY exams found"); return; }
  console.log("Testing exam:", exam.title);
  exam.questions.forEach(eq => {
    const q = eq.question;
    console.log(`  Q: type=${q.type}, correctOption='${q.correctOption}'`);
  });

  const user = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  if (!user) { console.log("No student found"); return; }

  // Simulate submit with correct answers
  const selectedAnswers = {};
  for (const eq of exam.questions) {
    const q = eq.question;
    if (q.type === 'MULTIPLE_CHOICE') {
      selectedAnswers[q.id] = q.correctOption;
    } else if (q.type === 'ESSAY') {
      // Answer exactly matching correctOption
      selectedAnswers[q.id] = q.correctOption && q.correctOption !== 'A' ? q.correctOption : 'test answer';
    }
  }

  console.log("\nSelected Answers:", JSON.stringify(selectedAnswers, null, 2));

  // Try creating result
  try {
    const result = await prisma.examResult.create({
      data: {
        userId: user.id,
        examId: exam.id,
        selectedAnswers: JSON.stringify(selectedAnswers),
        score: 10,
        timeSpent: 60,
        gradingDetails: JSON.stringify([{ questionId: 'test', pointsEarned: 1, maxPoints: 1, feedback: 'OK' }]),
        cheatLogs: null
      }
    });
    console.log("\nResult created successfully:", result.id);
    await prisma.examResult.delete({ where: { id: result.id } });
    console.log("Test result cleaned up.");
  } catch (e) {
    console.error("\nERROR creating result:", e.message);
    console.error(e.stack);
  }
}

testEssaySubmit().catch(console.error).finally(() => prisma.$disconnect());
