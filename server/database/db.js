import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'db.json');

// Initialize empty DB if it doesn't exist
if (!fs.existsSync(DB_PATH)) {
  fs.writeFileSync(DB_PATH, JSON.stringify({
    users: [],
    meetings: [],
    messages: [],
    files: [],
    dmMessages: [],
    friendships: []
  }, null, 2));
}

function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const parsed = JSON.parse(data);
    // Ensure new collections exist in older DBs
    if (!parsed.dmMessages) parsed.dmMessages = [];
    if (!parsed.friendships) parsed.friendships = [];
    return parsed;
  } catch (error) {
    console.error('Error reading DB:', error);
    return { users: [], meetings: [], messages: [], files: [], dmMessages: [], friendships: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing DB:', error);
  }
}

// Generate a readable 8-char user ID like VC-A3X9K2PL
function generateUserId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = 'VC-';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)]
  }
  return id;
}

export const db = {
  // Users
  getUserByEmail: (email) => {
    const data = readDB();
    return data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  },

  getUserById: (id) => {
    const data = readDB();
    return data.users.find(u => u.id === id);
  },

  getUserByUserId: (userId) => {
    const data = readDB();
    return data.users.find(u => u.userId === userId);
  },

  createUser: (user) => {
    const data = readDB();
    // Ensure unique userId
    let userId;
    do {
      userId = generateUserId();
    } while (data.users.find(u => u.userId === userId));

    const newUser = {
      id: crypto.randomUUID(),
      userId,
      avatarColor: ['#7F77DD', '#534AB7', '#1D9E75', '#E24B4A', '#E0A96D', '#20B2AA'][Math.floor(Math.random() * 6)],
      ...user
    };
    data.users.push(newUser);
    writeDB(data);
    return newUser;
  },

  // Update user fields by internal id
  updateUser: (id, updates) => {
    const data = readDB();
    const idx = data.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    data.users[idx] = { ...data.users[idx], ...updates };
    writeDB(data);
    return data.users[idx];
  },

  // Meetings
  getMeetingById: (id) => {
    const data = readDB();
    return data.meetings.find(m => m.id === id);
  },

  getMeetings: () => {
    const data = readDB();
    return data.meetings;
  },

  createMeeting: (meeting) => {
    const data = readDB();
    const newMeeting = {
      id: crypto.randomUUID().substring(0, 8),
      createdAt: new Date().toISOString(),
      ...meeting
    };
    data.meetings.push(newMeeting);
    writeDB(data);
    return newMeeting;
  },

  getMeetingsForUser: (userId) => {
    const data = readDB();
    return data.meetings;
  },

  // Room Messages (In-call Chat)
  getMessages: (roomId) => {
    const data = readDB();
    return data.messages.filter(m => m.roomId === roomId);
  },

  createMessage: (message) => {
    const data = readDB();
    const newMessage = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      ...message
    };
    data.messages.push(newMessage);
    writeDB(data);
    return newMessage;
  },

  // Files
  getFiles: (roomId) => {
    const data = readDB();
    if (roomId === 'all') {
      return data.files;
    }
    return data.files.filter(f => f.roomId === roomId);
  },

  createFile: (file) => {
    const data = readDB();
    const newFile = {
      id: crypto.randomUUID(),
      uploadTime: new Date().toISOString(),
      ...file
    };
    data.files.push(newFile);
    writeDB(data);
    return newFile;
  },

  // DM Messages (outside meetings, persisted, receiver can be offline)
  getDMMessages: (userA, userB) => {
    const data = readDB();
    return data.dmMessages.filter(m =>
      (m.senderId === userA && m.receiverId === userB) ||
      (m.senderId === userB && m.receiverId === userA)
    ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  },

  createDMMessage: (msg) => {
    const data = readDB();
    const newMsg = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      read: false,
      ...msg
    };
    data.dmMessages.push(newMsg);
    writeDB(data);
    return newMsg;
  },

  // Get all DM conversations for a user (list of unique partners)
  getDMConversations: (userId) => {
    const data = readDB();
    const msgs = data.dmMessages.filter(m => m.senderId === userId || m.receiverId === userId);
    const partnerIds = new Set();
    msgs.forEach(m => {
      if (m.senderId === userId) partnerIds.add(m.receiverId);
      else partnerIds.add(m.senderId);
    });
    return Array.from(partnerIds).map(pid => {
      const partner = data.users.find(u => u.id === pid);
      const lastMsg = msgs.filter(m => m.senderId === pid || m.receiverId === pid)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
      const unread = msgs.filter(m => m.senderId === pid && m.receiverId === userId && !m.read).length;
      return { partner, lastMsg, unread };
    }).filter(c => c.partner);
  },

  // Mark DMs as read
  markDMsRead: (senderId, receiverId) => {
    const data = readDB();
    data.dmMessages.forEach(m => {
      if (m.senderId === senderId && m.receiverId === receiverId && !m.read) {
        m.read = true;
      }
    });
    writeDB(data);
  },

  // Friendships (search by userId)
  getFriends: (userId) => {
    const data = readDB();
    const friendships = data.friendships.filter(f =>
      (f.userA === userId || f.userB === userId) && f.status === 'accepted'
    );
    return friendships.map(f => {
      const friendId = f.userA === userId ? f.userB : f.userA;
      return data.users.find(u => u.id === friendId);
    }).filter(Boolean);
  },

  // DM file attachments are stored as regular files with a dmContext flag
  getDMFiles: (userA, userB) => {
    const data = readDB();
    return data.files.filter(f => f.dmContext &&
      ((f.senderId === userA && f.receiverId === userB) ||
       (f.senderId === userB && f.receiverId === userA))
    );
  }
};
