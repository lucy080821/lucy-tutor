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

// 5. Student self-adds a custom vocabulary word (no Lesson/classroom required) — the only
// path a classless student has to ever get a word into their deck, since VocabItem previously
// could only be created as a child of a teacher's classroom-scoped Lesson.
router.post('/vocab/custom', async (req, res) => {
  try {
    const { userId, word, meaning, phonetic, pos, example } = req.body;
    if (!userId || !word || !meaning) {
      return res.status(400).json({ error: 'Thiếu từ hoặc nghĩa của từ.' });
    }

    const vocab = await prisma.vocabItem.create({
      data: { word, meaning, phonetic: phonetic || null, pos: pos || null, example: example || null, addedByUserId: userId }
    });

    const progress = await prisma.userVocabProgress.create({
      data: {
        userId,
        vocabId: vocab.id,
        status: 'LEARNING',
        nextReviewDate: new Date(),
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0
      },
      include: { vocab: true }
    });

    res.json(progress);
  } catch (error) {
    console.error('Error adding custom vocab:', error);
    res.status(500).json({ error: 'Failed to add custom vocab' });
  }
});

// 6. List words a student added themselves (so they can review/delete them)
router.get('/vocab/custom/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const vocab = await prisma.vocabItem.findMany({
      where: { addedByUserId: userId },
      orderBy: { id: 'desc' }
    });
    res.json(vocab);
  } catch (error) {
    console.error('Error fetching custom vocab:', error);
    res.status(500).json({ error: 'Failed to fetch custom vocab' });
  }
});

// 7. Delete a self-added word — only the student who added it may delete it (teacher-assigned
// VocabItem rows have addedByUserId === null and can never be targeted through this route).
router.delete('/vocab/custom/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.query;
    const vocab = await prisma.vocabItem.findUnique({ where: { id } });
    if (!vocab || vocab.addedByUserId !== userId) {
      return res.status(403).json({ error: 'Không thể xóa từ này.' });
    }
    await prisma.vocabItem.delete({ where: { id } }); // cascades to UserVocabProgress
    res.json({ message: 'Đã xóa từ' });
  } catch (error) {
    console.error('Error deleting custom vocab:', error);
    res.status(500).json({ error: 'Failed to delete custom vocab' });
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
