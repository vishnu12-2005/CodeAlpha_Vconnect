import express from 'express';
import http from 'http';
import { Server } from 'socket.io'
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';
import meetingRoutes from './routes/meetings.js';
import fileRoutes from './routes/files.js';
import dmRoutes from './routes/dm.js';
import registerSocketHandlers from './socket/socket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const uploadDir = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadDir));

app.use('/api/auth', authRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/dm', dmRoutes);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.set('io', io);
registerSocketHandlers(io);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`V Connect server running on port ${PORT}`);
});
