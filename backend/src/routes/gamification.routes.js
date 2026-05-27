const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const topUsers = await prisma.user.findMany({
      orderBy: { totalXP: 'desc' },
      take: 10,
      select: { id: true, name: true, totalXP: true, streakCount: true }
    });
    res.json(topUsers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update streak (should be called on daily login)
router.post('/checkin', async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    const now = new Date();
    const lastActive = new Date(user.lastActive);
    const diffTime = Math.abs(now - lastActive);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    
    let newStreak = user.streakCount;
    if (diffDays === 1) {
      newStreak += 1;
    } else if (diffDays > 1) {
      newStreak = 1; // reset streak
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        streakCount: newStreak,
        lastActive: now,
        totalXP: { increment: 10 } // give 10 XP for check-in
      }
    });
    
    res.json(updatedUser);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
