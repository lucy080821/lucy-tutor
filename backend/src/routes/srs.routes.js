const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

// Calculate next review date and SM-2 parameters
function calculateSM2(quality, prevRepetitions, prevEaseFactor, prevInterval) {
  let repetitions = prevRepetitions;
  let interval = prevInterval;
  let easeFactor = prevEaseFactor;

  // Quality: 1 (Lại/Again), 3 (Khó/Hard), 4 (Tốt/Good), 5 (Dễ/Easy)
  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  // Update easeFactor
  easeFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return {
    repetitions,
    interval,
    easeFactor,
    nextReviewDate
  };
}

// 1. Add flipped vocabularies to SRS from lesson
router.post('/add-from-lesson', async (req, res) => {
  try {
    const { userId, vocabIds } = req.body;
    if (!userId || !vocabIds || !Array.isArray(vocabIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = [];
    for (const vocabId of vocabIds) {
      // Upsert: Add if not exists, do nothing if already exists
      const existing = await prisma.userVocabProgress.findUnique({
        where: {
          userId_vocabId: { userId, vocabId }
        }
      });

      if (!existing) {
        const progress = await prisma.userVocabProgress.create({
          data: {
            userId,
            vocabId,
            status: 'LEARNING',
            nextReviewDate: new Date(), // Due immediately
            interval: 0,
            easeFactor: 2.5,
            repetitions: 0
          }
        });
        created.push(progress);
      }
    }

    res.json({ message: 'Added to SRS successfully', count: created.length });
  } catch (error) {
    console.error('Error adding to SRS:', error);
    res.status(500).json({ error: 'Failed to add to SRS' });
  }
});

// 2. Fetch due vocabularies for today
router.get('/due/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const now = new Date();

    const dueVocabs = await prisma.userVocabProgress.findMany({
      where: {
        userId,
        nextReviewDate: {
          lte: now
        }
      },
      include: {
        vocab: true
      },
      orderBy: {
        nextReviewDate: 'asc'
      }
    });

    res.json(dueVocabs);
  } catch (error) {
    console.error('Error fetching due vocabs:', error);
    res.status(500).json({ error: 'Failed to fetch due vocabs' });
  }
});

// 3. Review a vocabulary (Submit grade)
router.post('/review/:progressId', async (req, res) => {
  try {
    const { progressId } = req.params;
    const { quality } = req.body; // 1: Again, 3: Hard, 4: Good, 5: Easy

    if (![1, 3, 4, 5].includes(quality)) {
      return res.status(400).json({ error: 'Invalid quality score. Use 1, 3, 4, or 5.' });
    }

    const progress = await prisma.userVocabProgress.findUnique({
      where: { id: progressId }
    });

    if (!progress) {
      return res.status(404).json({ error: 'Progress not found' });
    }

    const { repetitions, interval, easeFactor, nextReviewDate } = calculateSM2(
      quality,
      progress.repetitions,
      progress.easeFactor,
      progress.interval
    );

    let status = progress.status;
    if (quality < 3) status = 'LEARNING';
    else if (interval > 21) status = 'MASTERED';
    else status = 'REVIEWING';

    const updatedProgress = await prisma.userVocabProgress.update({
      where: { id: progressId },
      data: {
        repetitions,
        interval,
        easeFactor,
        nextReviewDate,
        status,
        lastReviewedAt: new Date()
      }
    });

    res.json(updatedProgress);
  } catch (error) {
    console.error('Error reviewing vocab:', error);
    res.status(500).json({ error: 'Failed to review vocab' });
  }
});

// 4. Fetch statistics for charts
router.get('/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Pie chart: Status distribution
    const statusCounts = await prisma.userVocabProgress.groupBy({
      by: ['status'],
      where: { userId },
      _count: { id: true }
    });

    const statusMap = { LEARNING: 0, REVIEWING: 0, MASTERED: 0 };
    statusCounts.forEach(s => {
      statusMap[s.status] = s._count.id;
    });

    // Bar chart: Future workload (next 7 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const workloads = [];
    
    for (let i = 0; i < 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + i);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await prisma.userVocabProgress.count({
        where: {
          userId,
          nextReviewDate: {
            gte: targetDate,
            lt: nextDate
          }
        }
      });

      workloads.push({
        date: targetDate.toLocaleDateString('vi-VN', { month: '2-digit', day: '2-digit' }),
        count
      });
    }

    // Due Today Total
    const dueTodayCount = await prisma.userVocabProgress.count({
      where: {
        userId,
        nextReviewDate: {
          lte: new Date()
        }
      }
    });

    res.json({
      statusCounts: [
        { name: 'Đang học', value: statusMap.LEARNING, color: '#ef4444' }, // red
        { name: 'Cần ôn tập', value: statusMap.REVIEWING, color: '#f59e0b' }, // amber
        { name: 'Đã thành thạo', value: statusMap.MASTERED, color: '#10b981' } // green
      ],
      workloads,
      dueTodayCount
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
