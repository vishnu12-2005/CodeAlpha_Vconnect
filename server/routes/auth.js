import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/db.js';
import { authGuard } from '../middleware/auth.js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'syncspace_super_jwt_secret_key_2026';

const safeUser = (user) => ({
  id: user.id,
  userId: user.userId,
  name: user.name,
  email: user.email,
  avatarColor: user.avatarColor,
  profilePicture: user.profilePicture || null
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Name, email, and password are required.' });

    const existingUser = db.getUserByEmail(email);
    if (existingUser)
      return res.status(400).json({ message: 'User already exists with this email.' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = db.createUser({ name, email, passwordHash });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = db.getUserByEmail(email);
    if (!user) return res.status(400).json({ message: 'Invalid credentials.' });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials.' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// Google Login
router.post('/google', async (req, res) => {
  try {
    const { name, email, googleId } = req.body;
    if (!email || !name)
      return res.status(400).json({ message: 'Google profile information missing.' });

    let user = db.getUserByEmail(email);
    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      user = db.createUser({ name, email, passwordHash, googleId });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(500).json({ message: 'Server error during Google login.' });
  }
});

// Get current user
router.get('/me', authGuard, async (req, res) => {
  try {
    const user = db.getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(safeUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching user details.' });
  }
});

// Search user by their unique userId (e.g. VC-A3X9K2PL)
router.get('/search/:userId', authGuard, async (req, res) => {
  try {
    const found = db.getUserByUserId(req.params.userId.toUpperCase());
    if (!found) return res.status(404).json({ message: 'No user found with that ID.' });
    res.json({ id: found.id, userId: found.userId, name: found.name, avatarColor: found.avatarColor });
  } catch (error) {
    res.status(500).json({ message: 'Server error searching user.' });
  }
});

// Update profile (name, profilePicture as base64, password reset)
router.put('/profile', authGuard, async (req, res) => {
  try {
    const { name, profilePicture, currentPassword, newPassword } = req.body;
    const user = db.getUserById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const updates = {};

    if (name && name.trim()) {
      updates.name = name.trim();
    }

    // profilePicture is a base64 data URL (e.g. "data:image/jpeg;base64,...")
    if (profilePicture !== undefined) {
      updates.profilePicture = profilePicture;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }
      // Skip current password check for Google-only accounts (no real password)
      if (user.passwordHash) {
        const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
      }
      updates.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'Nothing to update.' });
    }

    const updatedUser = db.updateUser(req.userId, updates);
    res.json({ message: 'Profile updated successfully.', user: safeUser(updatedUser) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ message: 'Server error updating profile.' });
  }
});

export default router;
