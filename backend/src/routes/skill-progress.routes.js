const express = require('express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const router = express.Router();

const SKILLS = ['READING', 'LISTENING', 'SPEAKING', 'WRITING'];
const RECENT_WINDOW = 10;

// Log one completed practice attempt's score estimate (0-10). Called by every
// practice tool (reading/writing/conversation/listening) right after it
// finishes grading — this is the only thing that feeds the student
// dashboard's 4-skill radar chart. Stored on the Prisma model's "band" column
// (legacy internal name) but exposed over the API as "score" — plain 0-10,
// no exam-specific grading scale.
router.post('/log', async (req, res) => {
  try {
    const { userId, skill, score, source } = req.body;
    if (!userId || !SKILLS.includes(skill) || typeof score !== 'number' || !source) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId/skill/score/source' });
    }
    const clampedScore = Math.max(0, Math.min(10, score));
    const result = await prisma.skillPracticeResult.create({
      data: { userId, skill, band: clampedScore, source }
    });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Aggregated score per skill for the radar chart — average of the most recent
// attempts per skill, so the chart reflects current level rather than being
// diluted by attempts from a long time ago.
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const out = {};
    for (const skill of SKILLS) {
      const recent = await prisma.skillPracticeResult.findMany({
        where: { userId, skill },
        orderBy: { createdAt: 'desc' },
        take: RECENT_WINDOW
      });
      out[skill] = recent.length > 0
        ? { score: Math.round((recent.reduce((s, r) => s + r.band, 0) / recent.length) * 10) / 10, hasData: true }
        : { score: 0, hasData: false };
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
