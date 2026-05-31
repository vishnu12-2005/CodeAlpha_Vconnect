import express from 'express';
import { db } from '../database/db.js';
import { upload } from '../middleware/upload.js';
import { authGuard } from '../middleware/auth.js';

const router = express.Router();

// Get all DM conversations for the logged-in user
router.get('/conversations', authGuard, (req, res) => {
  try {
    const conversations = db.getDMConversations(req.userId);
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching conversations.' });
  }
});

// Get DM messages between current user and another user (by internal id)
router.get('/messages/:partnerId', authGuard, (req, res) => {
  try {
    const messages = db.getDMMessages(req.userId, req.params.partnerId);
    // Also fetch any file attachments
    const files = db.getDMFiles(req.userId, req.params.partnerId);
    // Mark as read
    db.markDMsRead(req.params.partnerId, req.userId);
    res.json({ messages, files });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching DM messages.' });
  }
});

// Send a DM (text)
router.post('/send', authGuard, (req, res) => {
  try {
    const { receiverId, text } = req.body;
    if (!receiverId || !text?.trim())
      return res.status(400).json({ message: 'receiverId and text are required.' });

    const sender = db.getUserById(req.userId);
    const receiver = db.getUserById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'Recipient not found.' });

    const msg = db.createDMMessage({
      senderId: req.userId,
      senderName: sender.name,
      senderColor: sender.avatarColor,
      receiverId,
      text: text.trim()
    });

    // Push real-time notification via socket if receiver is online
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiverId}`).emit('dm-message', msg);
    }

    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: 'Error sending DM.' });
  }
});

// Share a file via DM (works offline — file saved, receiver sees it when they open chat)
router.post('/share-file', authGuard, upload.single('file'), (req, res) => {
  try {
    const { receiverId } = req.body;
    if (!receiverId) return res.status(400).json({ message: 'receiverId is required.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const sender = db.getUserById(req.userId);
    const receiver = db.getUserById(receiverId);
    if (!receiver) return res.status(404).json({ message: 'Recipient not found.' });

    // Save file with DM context
    const fileData = db.createFile({
      dmContext: true,
      senderId: req.userId,
      senderName: sender.name,
      receiverId,
      roomId: null,
      name: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      uploaderName: sender.name,
      path: `/uploads/${req.file.filename}`
    });

    // Also create a DM message referencing the file
    const msg = db.createDMMessage({
      senderId: req.userId,
      senderName: sender.name,
      senderColor: sender.avatarColor,
      receiverId,
      text: `📎 Shared a file: ${req.file.originalname}`,
      fileId: fileData.id,
      fileName: req.file.originalname,
      filePath: `/uploads/${req.file.filename}`,
      fileSize: req.file.size
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${receiverId}`).emit('dm-message', msg);
    }

    res.status(201).json({ msg, file: fileData });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error sharing file via DM.' });
  }
});

export default router;
