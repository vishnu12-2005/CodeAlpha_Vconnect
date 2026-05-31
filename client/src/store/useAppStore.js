import { create } from 'zustand';

const API_BASE = 'http://localhost:5000/api';

// Apply saved theme immediately on load
const savedTheme = localStorage.getItem('theme') || 'light';
if (savedTheme === 'dark') {
  document.documentElement.classList.add('dark');
} else {
  document.documentElement.classList.remove('dark');
}

export const useAppStore = create((set, get) => ({
  // Theme State
  theme: savedTheme,
  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    set({ theme });
  },
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(next);
  },

  // Authentication State
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user')) || null,
  isAuthenticated: !!localStorage.getItem('token'),
  authLoading: false,
  authError: null,

  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, authError: null, authLoading: false });
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, currentRoom: null });
  },

  // Update user in store + localStorage after profile edit
  updateUser: (updatedUser) => {
    const merged = { ...get().user, ...updatedUser };
    localStorage.setItem('user', JSON.stringify(merged));
    set({ user: merged });
  },

  registerUser: async (name, email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');
      get().setAuth(data.user, data.token);
      return true;
    } catch (err) {
      set({ authError: err.message, authLoading: false });
      return false;
    }
  },

  loginUser: async (email, password) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      get().setAuth(data.user, data.token);
      return true;
    } catch (err) {
      set({ authError: err.message, authLoading: false });
      return false;
    }
  },

  googleLogin: async (name, email, googleId) => {
    set({ authLoading: true, authError: null });
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, googleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Google login failed');
      get().setAuth(data.user, data.token);
      return true;
    } catch (err) {
      set({ authError: err.message, authLoading: false });
      return false;
    }
  },

  // Active Call State
  currentRoom: null,
  setCurrentRoom: (room) => set({ currentRoom: room }),

  localAudioActive: true,
  localVideoActive: true,
  localScreenSharing: false,
  localHandRaised: false,
  noiseSuppressionActive: false,

  setLocalAudioActive: (active) => set({ localAudioActive: active }),
  setLocalVideoActive: (active) => set({ localVideoActive: active }),
  setLocalScreenSharing: (active) => set({ localScreenSharing: active }),
  setLocalHandRaised: (active) => set({ localHandRaised: active }),
  setNoiseSuppressionActive: (active) => set({ noiseSuppressionActive: active }),

  participants: [],
  setParticipants: (participants) => set({ participants }),
  addParticipant: (p) => set((state) => ({ participants: [...state.participants, p] })),
  removeParticipant: (socketId) => set((state) => ({
    participants: state.participants.filter((p) => p.socketId !== socketId)
  })),
  updateParticipantStatus: (socketId, updates) => set((state) => ({
    participants: state.participants.map((p) =>
      p.socketId === socketId ? { ...p, ...updates } : p
    )
  })),

  // Panel toggles
  chatPanelOpen: false,
  filesPanelOpen: false,
  whiteboardPanelOpen: false,
  participantsPanelOpen: true,

  setChatPanelOpen: (open) => set({ chatPanelOpen: open }),
  setFilesPanelOpen: (open) => set({ filesPanelOpen: open }),
  setWhiteboardPanelOpen: (open) => set({ whiteboardPanelOpen: open }),
  setParticipantsPanelOpen: (open) => set({ participantsPanelOpen: open }),

  // Room chat
  chatMessages: [],
  unreadChatCount: 0,
  addChatMessage: (msg) => set((state) => {
    const isChatClosed = !state.chatPanelOpen;
    return {
      chatMessages: [...state.chatMessages, msg],
      unreadChatCount: isChatClosed ? state.unreadChatCount + 1 : 0
    };
  }),
  clearUnreadChat: () => set({ unreadChatCount: 0 }),
  setChatMessages: (messages) => set({ chatMessages: messages }),

  // Shared Files
  sharedFiles: [],
  unreadFilesCount: 0,
  addSharedFile: (file) => set((state) => {
    const isFilesClosed = !state.filesPanelOpen;
    return {
      sharedFiles: [...state.sharedFiles, file],
      unreadFilesCount: isFilesClosed ? state.unreadFilesCount + 1 : 0
    };
  }),
  clearUnreadFiles: () => set({ unreadFilesCount: 0 }),
  setSharedFiles: (files) => set({ sharedFiles: files }),

  // ── DMs ──────────────────────────────────────────────────────────────────────
  dmConversations: [],      // [{ partner, lastMsg, unread }]
  activeDMPartner: null,    // { id, name, userId, avatarColor }
  dmMessages: [],           // messages for active DM thread
  dmUnreadTotal: 0,

  setDMConversations: (convs) => set({ dmConversations: convs }),
  setActiveDMPartner: (partner) => set({ activeDMPartner: partner, dmMessages: [] }),
  setDMMessages: (msgs) => set({ dmMessages: msgs }),
  addDMMessage: (msg) => set((state) => ({
    dmMessages: [...state.dmMessages, msg],
    dmUnreadTotal: state.activeDMPartner?.id === msg.senderId
      ? state.dmUnreadTotal
      : state.dmUnreadTotal + 1
  })),
  clearDMUnread: () => set({ dmUnreadTotal: 0 }),

  // ── Meeting Invites / Join Requests ──────────────────────────────────────────
  pendingInvite: null,       // { roomId, hostName, meetingTitle }
  pendingJoinRequests: [],   // [{ requesterSocketId, requesterName, requesterColor, requesterUserId }]

  setPendingInvite: (invite) => set({ pendingInvite: invite }),
  clearPendingInvite: () => set({ pendingInvite: null }),
  addJoinRequest: (req) => set((state) => ({
    pendingJoinRequests: [...state.pendingJoinRequests, req]
  })),
  removeJoinRequest: (socketId) => set((state) => ({
    pendingJoinRequests: state.pendingJoinRequests.filter(r => r.requesterSocketId !== socketId)
  })),

  resetCallState: () => set({
    participants: [],
    chatMessages: [],
    sharedFiles: [],
    unreadChatCount: 0,
    unreadFilesCount: 0,
    localAudioActive: true,
    localVideoActive: true,
    localScreenSharing: false,
    localHandRaised: false,
    noiseSuppressionActive: false,
    chatPanelOpen: false,
    filesPanelOpen: false,
    whiteboardPanelOpen: false,
    participantsPanelOpen: true,
    pendingJoinRequests: []
  })
}));
