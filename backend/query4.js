const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const zeroResults = await prisma.examResult.findMany({
    where: { score: 0 },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${zeroResults.length} zero results.`);
  for (const r of zeroResults) {
    console.log(`\n--- Result ID: ${r.id} ---`);
    console.log("Created At:", r.createdAt);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
