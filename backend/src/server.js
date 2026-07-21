const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

const path = require('path');

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Basic Route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Lucy Tutor API' });
});

// Import routes
const authRoutes = require('./routes/auth.routes');
const questionRoutes = require('./routes/questions.routes');
const examRoutes = require('./routes/exams.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const gamificationRoutes = require('./routes/gamification.routes');
const uploadRoutes = require('./routes/upload.routes');
const classroomRoutes = require('./routes/classroom.routes');
const aiRoutes = require('./routes/ai.routes');
const calendarRoutes = require('./routes/calendar.routes');
const lessonRoutes = require('./routes/lessons.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const documentRoutes = require('./routes/document.routes');
const srsRoutes = require('./routes/srs.routes');
const leaderboardRoutes = require('./routes/leaderboard.routes');
const listeningRoutes = require('./routes/listening.routes');
const speakingConversationRoutes = require('./routes/speaking-conversation.routes');
const skillProgressRoutes = require('./routes/skill-progress.routes');
const freeStudentRoutes = require('./routes/freeStudent.routes');
const pronunciationRoutes = require('./routes/pronunciation.routes');
const mockTestRoutes = require('./routes/mockTest.routes');

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/classroom', classroomRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/lessons', lessonRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/srs', srsRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/listening', listeningRoutes);
app.use('/api/speaking-conversation', speakingConversationRoutes);
app.use('/api/skill-progress', skillProgressRoutes);
app.use('/api/free-students', freeStudentRoutes);
app.use('/api/pronunciation', pronunciationRoutes);
app.use('/api/mock-test', mockTestRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
