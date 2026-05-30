const express = require('express');
const multer = require('multer');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const prisma = new PrismaClient();
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' && ext !== '.doc' && ext !== '.docx') {
      return cb(new Error('Chỉ cho phép file PDF và Word (.pdf, .doc, .docx)'));
    }
    cb(null, true);
  }
});

// Init Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { title, classroomId, visibility, uploadedById } = req.body;
    
    if (!req.file) return res.status(400).json({ error: 'Missing file' });
    if (!supabase) return res.status(500).json({ error: 'Supabase credentials not configured in backend' });

    const file = req.file;
    const removeVietnameseAccents = (str) => {
       return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    };
    const sanitizedName = removeVietnameseAccents(file.originalname).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${Date.now()}-${sanitizedName}`;

    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName);

    const doc = await prisma.document.create({
      data: {
        title: title || file.originalname,
        fileUrl: publicUrlData.publicUrl,
        fileType: path.extname(file.originalname).toLowerCase(),
        size: file.size,
        visibility: visibility || 'PUBLIC',
        classroomId: (visibility === 'CLASS' && classroomId) ? classroomId : null,
        uploadedById
      }
    });

    res.json({ message: 'Upload thành công', document: doc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { classroomId, teacherId } = req.query;
    let whereClause = { visibility: 'PUBLIC' };
    
    if (classroomId) {
      whereClause = {
        OR: [
          { visibility: 'PUBLIC' },
          { visibility: 'CLASS', classroomId }
        ]
      };
    }
    
    // For teacher, they see all their own files
    if (teacherId) {
       whereClause = { uploadedById: teacherId };
    }

    const docs = await prisma.document.findMany({
      where: whereClause,
      include: {
        classroom: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    
    if (supabase) {
       const fileName = doc.fileUrl.split('/').pop();
       if (fileName) {
          await supabase.storage.from('documents').remove([fileName]);
       }
    }
    
    await prisma.document.delete({ where: { id } });
    res.json({ message: 'Xóa thành công' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { visibility, classroomId } = req.body;
    
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    
    const updatedDoc = await prisma.document.update({
      where: { id },
      data: {
        visibility,
        classroomId: (visibility === 'CLASS' && classroomId) ? classroomId : null
      }
    });
    
    res.json({ message: 'Cập nhật thành công', document: updatedDoc });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
