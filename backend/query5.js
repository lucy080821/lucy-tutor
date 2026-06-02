const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const allResults = await prisma.examResult.findMany({
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Total results: ${allResults.length}`);
  for (const r of allResults) {
    if (r.score === null || isNaN(r.score) || r.score === 0) {
      console.log(`\n--- WEIRD Result ID: ${r.id} ---`);
      console.log("Score:", r.score);
      console.log("Created At:", r.createdAt);
    } else {
      console.log(`Result ID: ${r.id} | Score: ${r.score}`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
