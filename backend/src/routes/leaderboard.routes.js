const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/leaderboard
router.get('/', async (req, res) => {
  try {
    const { classroomId, currentUserId } = req.query;

    let users = [];

    if (classroomId && classroomId !== 'null' && classroomId !== 'undefined') {
      // Class leaderboard
      const classroom = await prisma.classroom.findUnique({
        where: { id: classroomId },
        include: {
          students: {
            where: { role: 'STUDENT' },
            select: { id: true, name: true, avatar: true, totalXP: true, targetScore: true }
          }
        }
      });
      if (!classroom) return res.status(404).json({ error: 'Classroom not found' });
      users = classroom.students;
    } else {
      // Global leaderboard
      users = await prisma.user.findMany({
        where: { role: 'STUDENT' },
        select: { id: true, name: true, avatar: true, totalXP: true, targetScore: true }
      });
    }

    // Sort by totalXP descending
    users.sort((a, b) => (b.totalXP || 0) - (a.totalXP || 0));

    // Calculate rank for each user
    let currentRank = 1;
    for (let i = 0; i < users.length; i++) {
      if (i > 0 && users[i].totalXP < users[i - 1].totalXP) {
        currentRank = i + 1;
      }
      users[i].rank = currentRank;
    }

    // Find current user's rank if currentUserId is provided
    let currentUserData = null;
    if (currentUserId && currentUserId !== 'null' && currentUserId !== 'undefined') {
      currentUserData = users.find(u => u.id === currentUserId);
    }

    // Take top 50 for the list
    const top50 = users.slice(0, 50);

    res.json({
      leaderboard: top50,
      currentUser: currentUserData
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
