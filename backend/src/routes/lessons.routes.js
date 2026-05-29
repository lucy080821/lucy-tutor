const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// Create a new lesson
router.post('/create', async (req, res) => {
  try {
    const { title, description, classroomId, uploadedById, publishTime, deadline, vocabularies, grammars } = req.body;

    const lesson = await prisma.lesson.create({
      data: {
        title,
        description,
        classroomId: classroomId || null,
        uploadedById: uploadedById || null,
        publishTime: publishTime ? new Date(publishTime) : null,
        deadline: deadline ? new Date(deadline) : null,
        vocabularies: {
          create: vocabularies || []
        },
        grammars: {
          create: grammars || []
        }
      },
      include: {
        vocabularies: true,
        grammars: true
      }
    });

    res.status(201).json(lesson);
  } catch (error) {
    console.error('Error creating lesson:', error);
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

// Get all lessons for a specific classroom
router.get('/classroom/:classroomId', async (req, res) => {
  try {
    const { classroomId } = req.params;
    const lessons = await prisma.lesson.findMany({
      where: { classroomId },
      include: {
        vocabularies: true,
        grammars: true,
        progress: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching classroom lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Get all lessons created by a teacher
router.get('/teacher/:teacherId', async (req, res) => {
  try {
    const { teacherId } = req.params;
    const lessons = await prisma.lesson.findMany({
      where: { uploadedById: teacherId },
      include: {
        vocabularies: true,
        grammars: true,
        progress: true,
        classroom: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(lessons);
  } catch (error) {
    console.error('Error fetching teacher lessons:', error);
    res.status(500).json({ error: 'Failed to fetch lessons' });
  }
});

// Get a specific lesson by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const lesson = await prisma.lesson.findUnique({
      where: { id },
      include: {
        vocabularies: true,
        grammars: true
      }
    });

    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json(lesson);
  } catch (error) {
    console.error('Error fetching lesson:', error);
    res.status(500).json({ error: 'Failed to fetch lesson' });
  }
});

// Update or create lesson progress for a student
router.post('/:id/progress', async (req, res) => {
  try {
    const { id } = req.params; // lessonId
    const { userId, status } = req.body;

    if (!userId || !status) {
      return res.status(400).json({ error: 'Missing userId or status' });
    }

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: {
          userId: userId,
          lessonId: id
        }
      },
      update: {
        status
      },
      create: {
        userId,
        lessonId: id,
        status
      }
    });
    
    // If completed, add some XP (e.g. 5 XP)
    if (status === 'COMPLETED') {
      await prisma.user.update({
        where: { id: userId },
        data: { totalXP: { increment: 5 } }
      });
    }

    res.json(progress);
  } catch (error) {
    console.error('Error updating lesson progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
});

// Delete a lesson
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.lesson.delete({
      where: { id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lesson:', error);
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

module.exports = router;
