import express from 'express';
import { db } from '../database/db.js';
import { upload } from '../middleware/upload.js';
import { authGuard } from '../middleware/auth.js';

const router = express.Router();

// Upload file to a room OR globally (roomId = 'global' for outside meeting)
router.post('/upload', authGuard, upload.single('file'), (req, res) => {
  try {
    const { roomId, uploaderName, receiverId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded or file format not supported.' });
    }

    const fileData = db.createFile({
      roomId: roomId || 'global',
      name: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploaderName: uploaderName || 'Anonymous',
      uploaderId: req.userId,
      receiverId: receiverId || null,
      path: `/uploads/${req.file.filename}`
    });

    const io = req.app.get('io');
    if (io && roomId && roomId !== 'global') {
      // Notify room in real-time
      io.to(roomId).emit('file-shared', fileData);
    }
    if (io && receiverId) {
      // Notify receiver even if they are offline — they'll get it via REST, but push if online
      io.to(`user:${receiverId}`).emit('file-shared', fileData);
    }

    res.status(201).json(fileData);
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ message: error.message || 'Server error uploading file.' });
  }
});

// Get files for a room (or 'all')
router.get('/room/:roomId', authGuard, (req, res) => {
  try {
    const files = db.getFiles(req.params.roomId);
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching files.' });
  }
});

// Get all files sent/received by current user (for Dashboard Files panel)
router.get('/my-files', authGuard, (req, res) => {
  try {
    const data = db.getFiles('all');
    const myFiles = data.filter(f =>
      f.uploaderId === req.userId || f.receiverId === req.userId
    );
    res.json(myFiles);
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user files.' });
  }
});

export default router;
