import express from 'express';
import { db } from '../database/db.js';
import { authGuard } from '../middleware/auth.js';

const router = express.Router();

// Schedule a meeting
router.post('/schedule', authGuard, (req, res) => {
  try {
    const { title, dateTime, duration, invitees, recurrence } = req.body;

    if (!title || !dateTime || !duration) {
      return res.status(400).json({ message: 'Title, date/time, and duration are required.' });
    }

    const meeting = db.createMeeting({
      title,
      dateTime,
      duration,
      invitees: invitees || [],
      recurrence: recurrence || 'once',
      creatorId: req.userId
    });

    res.status(201).json(meeting);
  } catch (error) {
    console.error('Schedule meeting error:', error);
    res.status(500).json({ message: 'Server error scheduling meeting.' });
  }
});

// List meetings for dashboard
router.get('/', authGuard, (req, res) => {
  try {
    const meetings = db.getMeetingsForUser(req.userId);
    res.json(meetings);
  } catch (error) {
    console.error('Fetch meetings error:', error);
    res.status(500).json({ message: 'Server error fetching meetings.' });
  }
});

// Get single meeting detail
router.get('/:id', (req, res) => {
  try {
    const meeting = db.getMeetingById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found.' });
    }
    res.json(meeting);
  } catch (error) {
    console.error('Fetch meeting error:', error);
    res.status(500).json({ message: 'Server error fetching meeting details.' });
  }
});

export default router;
