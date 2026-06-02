const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const results = await prisma.examResult.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      exam: {
        include: { questions: { include: { question: true } } }
      }
    }
  });

  for (const r of results) {
    console.log(`\n--- Result ID: ${r.id} ---`);
    console.log("Score:", r.score);
    console.log("Created At:", r.createdAt);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
