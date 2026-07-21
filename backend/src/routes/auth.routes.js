const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const router = express.Router();
const { isCutoffReached, addDays, TRIAL_DAYS, computeAccessStatus } = require('../utils/freeTrial');

const BCRYPT_ROUNDS = 10;

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, classCode, managerTeacherId } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email đã được sử dụng. Vui lòng chọn email khác.' });
    }

    const data = { name, email, password: await bcrypt.hash(password, BCRYPT_ROUNDS), role: role || 'STUDENT' };

    // Only STUDENT signups branch into "joined a class" vs "free-standing student".
    // Teachers, and students who supply a valid join code, never get a trial lock.
    if (data.role === 'STUDENT') {
      const trimmedCode = (classCode || '').trim();
      if (trimmedCode) {
        const classroom = await prisma.classroom.findUnique({ where: { joinCode: trimmedCode } });
        if (!classroom) {
          return res.status(400).json({ error: 'Mã lớp học không hợp lệ.' });
        }
        data.classroomsJoined = { connect: { id: classroom.id } };
      } else {
        if (!managerTeacherId) {
          return res.status(400).json({ error: 'Vui lòng chọn giáo viên phụ trách hoặc nhập mã lớp học.' });
        }
        const teacher = await prisma.user.findUnique({ where: { id: managerTeacherId } });
        if (!teacher || teacher.role !== 'TEACHER') {
          return res.status(400).json({ error: 'Giáo viên phụ trách không hợp lệ.' });
        }
        data.managerTeacherId = managerTeacherId;
        if (isCutoffReached()) {
          data.accessExpiresAt = addDays(new Date(), TRIAL_DAYS);
        }
      }
    }

    const user = await prisma.user.create({ data });
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// List of all teachers — used by the signup form's "Giáo viên phụ trách" picker for
// free-standing students who don't enter a class join code.
router.get('/teachers', async (req, res) => {
  try {
    const teachers = await prisma.user.findMany({
      where: { role: 'TEACHER' },
      select: { id: true, name: true, email: true, phone: true },
      orderBy: { name: 'asc' }
    });
    res.json(teachers);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/signin', async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // One account is locked to the role it registered with — a student picking "Giáo Viên"
    // (or vice versa) on the login toggle must not be let in under the wrong role.
    if (role && user.role !== role) {
      const actualLabel = user.role === 'TEACHER' ? 'Giáo Viên' : 'Học Viên';
      return res.status(403).json({ error: `Tài khoản này đã đăng ký với vai trò ${actualLabel}. Vui lòng chọn đúng vai trò để đăng nhập.` });
    }
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Change password — verifies the current password before setting a new (hashed) one.
router.put('/change-password', async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Thiếu thông tin' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.password) return res.status(404).json({ error: 'Không tìm thấy tài khoản' });

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng' });

    await prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }
    });
    res.json({ message: 'Đổi mật khẩu thành công' });
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

const USER_SELECT = {
  id: true, name: true, email: true, role: true, avatar: true,
  totalXP: true, streakCount: true, targetScore: true, phone: true, currentLevel: true,
  accessExpiresAt: true,
  managerTeacher: { select: { id: true, name: true, email: true, phone: true } },
  classroomsJoined: {
    select: { id: true, name: true, joinCode: true, scheduleDays: true, startTime: true, endTime: true, feePerLesson: true, enabledFeatures: true }
  },
  assignedExams: {
    select: { id: true, title: true, totalQuestions: true, duration: true, maxAttempts: true, deadline: true, notes: true, examType: true }
  },
  notebooks: {
    select: { id: true, topic: true, mistakeCount: true, updatedAt: true }
  }
};

// Route to get the current user
router.get('/me', async (req, res) => {
  try {
    const { userId } = req.query;
    let user;
    if (userId) {
      user = await prisma.user.findUnique({ where: { id: userId }, select: USER_SELECT });
    } else {
      user = await prisma.user.findFirst({ where: { role: 'STUDENT' }, select: USER_SELECT });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ ...user, ...computeAccessStatus(user) });
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
