const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Get questions by type
router.get('/', async (req, res) => {
  try {
    const { type, limit } = req.query;
    const whereClause = type ? { type } : {};
    const questions = await prisma.question.findMany({
      where: whereClause,
      take: limit ? parseInt(limit) : 10,
    });
    res.json(questions);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Seed some sample questions for testing
router.post('/seed', async (req, res) => {
  try {
    const sampleQuestions = [
      {
        content: 'She _____ to the store yesterday.',
        type: 'Grammar',
        difficulty: 'Easy',
        options: JSON.stringify(['go', 'goes', 'went', 'gone']),
        correctOption: 'C',
        explanation: 'The word "yesterday" indicates simple past tense.'
      },
      {
        content: 'If I _____ you, I would study harder.',
        type: 'Conditionals',
        difficulty: 'Medium',
        options: JSON.stringify(['am', 'was', 'were', 'had been']),
        correctOption: 'C',
        explanation: 'Type 2 conditional uses "were" for all subjects in the if-clause.'
      }
    ];
    
    await prisma.question.createMany({
      data: sampleQuestions
    });
    
    res.json({ message: 'Questions seeded successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
