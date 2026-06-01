const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Get mistake bank for a user
router.get('/mistakes/:userId', async (req, res) => {
  try {
    const mistakes = await prisma.mistakeBank.findMany({
      where: { userId: req.params.userId },
      include: { question: true },
      orderBy: { wrongAnswerCount: 'desc' }
    });
    res.json(mistakes);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get weakness analysis (basic logic)
router.get('/weakness/:userId', async (req, res) => {
  try {
    // A more advanced version would calculate failure rate per topic.
    // Here we just count which topics have the most mistakes in the bank.
    const mistakes = await prisma.mistakeBank.findMany({
      where: { userId: req.params.userId },
      include: { question: true }
    });
    
    const topicCounts = {};
    mistakes.forEach(m => {
      const type = m.question.type;
      topicCounts[type] = (topicCounts[type] || 0) + m.wrongAnswerCount;
    });
    
    // Sort topics by mistake count
    const sortedWeaknesses = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => ({ topic: entry[0], errorCount: entry[1] }));
      
    res.json(sortedWeaknesses);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get user exam history
router.get('/history/:userId', async (req, res) => {
  try {
    const results = await prisma.examResult.findMany({
      where: { userId: req.params.userId },
      include: { exam: true },
      orderBy: { createdAt: 'asc' } // Oldest first for charting progression
    });
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update MistakeNotebook progress
router.post('/notebook/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body; // "CORRECT" or "MISTAKE"
    
    const notebook = await prisma.mistakeNotebook.findUnique({ where: { id } });
    if (!notebook) return res.status(404).json({ error: 'Notebook not found' });
    
    let updateData = {};
    if (action === 'CORRECT') {
      updateData.correctCount = { increment: 1 };
      updateData.mistakeCount = { decrement: notebook.mistakeCount > 0 ? 1 : 0 };
    } else if (action === 'MISTAKE') {
      updateData.mistakeCount = { increment: 1 };
    }
    
    const updated = await prisma.mistakeNotebook.update({
      where: { id },
      data: updateData
    });
    
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
