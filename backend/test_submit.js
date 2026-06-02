const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSubmit() {
  // Get a real exam with ESSAY questions
  const exam = await prisma.exam.findFirst({
    include: { questions: { include: { question: true } } }
  });

  if (!exam) { console.log("No exams found"); return; }
  console.log("Testing exam:", exam.title);
  console.log("Questions:", exam.questions.map(eq => ({ id: eq.question.id, type: eq.question.type, correctOption: eq.question.correctOption })));

  // Get a real user
  const user = await prisma.user.findFirst({ where: { role: 'STUDENT' } });
  if (!user) { console.log("No student found"); return; }
  console.log("Student:", user.name, user.id);

  // Simulate submit
  const selectedAnswers = {};
  for (const eq of exam.questions) {
    const q = eq.question;
    if (q.type === 'MULTIPLE_CHOICE') {
      selectedAnswers[q.id] = q.correctOption; // answer correctly
    } else if (q.type === 'ESSAY') {
      selectedAnswers[q.id] = q.correctOption || 'test'; // answer correctly
    }
  }

  console.log("Selected Answers:", selectedAnswers);

  // Simulate grading
  let earnedPoints = 0;
  let totalPossiblePoints = 0;
  const gradingDetails = [];

  exam.questions.forEach(eq => {
    const q = eq.question;
    const userAnswer = selectedAnswers[q.id];
    const qPoints = q.points !== undefined ? parseFloat(q.points) : 1.0;
    totalPossiblePoints += qPoints;

    if (q.type === 'MULTIPLE_CHOICE') {
      if (userAnswer === q.correctOption) {
        earnedPoints += qPoints;
        console.log(`MC Q ${q.id}: CORRECT`);
      }
    } else if (q.type === 'ESSAY' && userAnswer) {
      const cleanAnswer = userAnswer.trim().toLowerCase();
      const rawCorrectOpt = q.correctOption ? q.correctOption.trim() : '';
      const hasCorrectAnswer = rawCorrectOpt && rawCorrectOpt.toLowerCase() !== 'a';

      console.log(`ESSAY Q ${q.id}: cleanAnswer='${cleanAnswer}', rawCorrectOpt='${rawCorrectOpt}', hasCorrectAnswer=${hasCorrectAnswer}`);

      if (hasCorrectAnswer) {
        const isCorrect = cleanAnswer === rawCorrectOpt.toLowerCase();
        console.log(`  isCorrect: ${isCorrect}`);
        if (isCorrect) earnedPoints += qPoints;
      }
    }
  });

  const score = totalPossiblePoints > 0 ? (earnedPoints / totalPossiblePoints) * 10 : 0;
  console.log(`\nFinal score: ${score}/10 (${earnedPoints}/${totalPossiblePoints} points)`);

  // Now try the actual prisma create
  try {
    const result = await prisma.examResult.create({
      data: {
        userId: user.id,
        examId: exam.id,
        selectedAnswers: JSON.stringify(selectedAnswers),
        score,
        timeSpent: 60,
        gradingDetails: JSON.stringify(gradingDetails),
        cheatLogs: null
      }
    });
    console.log("\nResult created successfully:", result.id, "score:", result.score);
    // Clean up test result
    await prisma.examResult.delete({ where: { id: result.id } });
    console.log("Test result cleaned up.");
  } catch (e) {
    console.error("\nERROR creating result:", e.message);
    console.error(e.stack);
  }
}

testSubmit().catch(console.error).finally(() => prisma.$disconnect());
