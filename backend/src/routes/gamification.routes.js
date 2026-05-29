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
    const lastActive = user.lastActive ? new Date(user.lastActive) : new Date(0);
    
    // Normalize to dates without time for accurate calendar day difference
    const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const lastActiveDate = new Date(lastActive.getFullYear(), lastActive.getMonth(), lastActive.getDate());
    
    const diffTime = nowDate - lastActiveDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 
    
    // If they already checked in today, do nothing
    if (diffDays === 0 && user.lastActive) {
      return res.json({ message: 'Already checked in today', user, bonusXP: 0, checkedIn: false });
    }
    
    let newStreak = user.streakCount || 0;
    if (diffDays === 1) {
      newStreak += 1;
    } else {
      newStreak = 1; // reset streak
    }
    
    let xpToAdd = 10;
    let bonusXP = 0;
    // If streak is multiple of 6, give bonus
    if (newStreak > 0 && newStreak % 6 === 0) {
      bonusXP = 50;
      xpToAdd += bonusXP;
    }
    
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        streakCount: newStreak,
        lastActive: now,
        totalXP: { increment: xpToAdd }
      }
    });
    
    res.json({ message: 'Checked in successfully', user: updatedUser, bonusXP, checkedIn: true, xpAdded: xpToAdd });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
