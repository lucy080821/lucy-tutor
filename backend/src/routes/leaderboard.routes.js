const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
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
      // Global leaderboard — sort + cap in the DB instead of pulling every student (with
      // their base64 avatar) into memory. Rank uses standard competition ranking, identical
      // to the loop below: rank = 1 + number of students with strictly more XP.
      const LEADER_SELECT = { id: true, name: true, avatar: true, totalXP: true, targetScore: true };
      const wantsCurrent = currentUserId && currentUserId !== 'null' && currentUserId !== 'undefined';
      const [top, me] = await Promise.all([
        prisma.user.findMany({
          where: { role: 'STUDENT' },
          select: LEADER_SELECT,
          orderBy: [{ totalXP: 'desc' }, { id: 'asc' }],
          take: 50
        }),
        wantsCurrent
          ? prisma.user.findFirst({ where: { id: currentUserId, role: 'STUDENT' }, select: LEADER_SELECT })
          : Promise.resolve(null)
      ]);

      let currentRank = 1;
      for (let i = 0; i < top.length; i++) {
        if (i > 0 && top[i].totalXP < top[i - 1].totalXP) currentRank = i + 1;
        top[i].rank = currentRank;
      }

      let currentUserData;
      if (me) {
        const inTop = top.find(u => u.id === me.id);
        if (inTop) {
          currentUserData = inTop;
        } else {
          const higher = await prisma.user.count({ where: { role: 'STUDENT', totalXP: { gt: me.totalXP } } });
          currentUserData = { ...me, rank: higher + 1 };
        }
      }

      return res.json({ leaderboard: top, currentUser: currentUserData });
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
