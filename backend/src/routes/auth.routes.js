const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được sử dụng. Vui lòng chọn email khác.' });
    }
    const user = await prisma.user.create({
      data: { name, email, password, role: role || 'STUDENT' },
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update Avatar
router.put('/avatar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { avatar } = req.body; // Base64 string
    const user = await prisma.user.update({
      where: { id },
      data: { avatar }
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Submit placement test score
router.post('/placement', async (req, res) => {
  try {
    const { userId, score } = req.body;
    const level = score > 80 ? 'Target 9+' : score > 50 ? 'Target 7+' : 'Lost Roots';
    const user = await prisma.user.update({
      where: { id: userId },
      data: { currentLevel: level },
    });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to get the current user
router.get('/me', async (req, res) => {
  try {
    const { userId } = req.query;
    let user;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId }, include: { classroomJoined: true, assignedExams: true, notebooks: true } });
    } else {
      user = await prisma.user.findFirst({ where: { role: 'STUDENT' }, include: { classroomJoined: true, assignedExams: true, notebooks: true } });
    }
    
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: 'Nguyễn Văn Học Sinh',
          email: 'student@example.com',
          password: 'password123',
          role: 'STUDENT',
        }
      });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Route to update user settings
router.put('/me', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    
    const { targetScore, phone } = req.body;
    
    const user = await prisma.user.update({
      where: { id: userId },
      data: { 
        ...(targetScore && { targetScore: parseFloat(targetScore) }),
        ...(phone !== undefined && { phone })
      }
    });
    
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
