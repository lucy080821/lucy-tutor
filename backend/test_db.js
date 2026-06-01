const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function main() { 
  const count = await prisma.examResult.count(); 
  console.log('Total ExamResults in DB:', count); 
} 
main().catch(console.error).finally(()=>prisma.$disconnect());
