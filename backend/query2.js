const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestResult = await prisma.examResult.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      exam: {
        include: { questions: { include: { question: true } } }
      }
    }
  });

  console.log("Score:", latestResult.score);
  console.log("Selected Answers:", latestResult.selectedAnswers);
  console.log("Grading Details:", latestResult.gradingDetails);
  
  const details = JSON.parse(latestResult.gradingDetails);
  for (const d of details) {
    const q = latestResult.exam.questions.find(eq => eq.question.id === d.questionId).question;
    console.log(`\nQuestion: ${q.content}`);
    console.log(`Type: ${q.type}`);
    console.log(`CorrectOption: '${q.correctOption}'`);
    console.log(`Explanation: '${q.explanation}'`);
    console.log(`User Answer: '${JSON.parse(latestResult.selectedAnswers)[q.id]}'`);
    console.log(`Earned Points: ${d.pointsEarned}/${d.maxPoints}`);
    console.log(`Feedback: ${d.feedback}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
