import { db } from '../database/db.js';

// In-memory tracking of active room participants
const roomParticipants = {};

// Map userId (internal UUID) -> socketId for real-time DM delivery
const onlineUsers = {};

export default function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Register user as online for DM routing
    socket.on('register-user', ({ userId }) => {
      if (userId) {
        onlineUsers[userId] = socket.id;
        socket.userId = userId;
        socket.join(`user:${userId}`);
        console.log(`User ${userId} registered online`);
      }
    });

    // Join room
    socket.on('join-room', ({ roomId, userId, userName, userColor }) => {
      socket.join(roomId);
      socket.roomId = roomId;

      const isHost = !roomParticipants[roomId] || roomParticipants[roomId].length === 0;
      const participant = {
        socketId: socket.id,
        userId,
        userName,
        userColor,
        isHost,
        audioActive: true,
        videoActive: true,
        handRaised: false
      };

      if (!roomParticipants[roomId]) roomParticipants[roomId] = [];

      // FIX: Remove any stale entry for the same userId (happens on page refresh —
      // the old socket may not have sent 'disconnect' yet when the new one joins).
      const staleIndex = roomParticipants[roomId].findIndex(p => p.userId === userId);
      if (staleIndex !== -1) {
        const staleSocketId = roomParticipants[roomId][staleIndex].socketId;
        roomParticipants[roomId].splice(staleIndex, 1);
        // Tell everyone to drop the stale tile
        io.to(roomId).emit('user-left', staleSocketId);
      }

      roomParticipants[roomId].push(participant);

      // Send existing participants to the joiner
      const existingParticipants = roomParticipants[roomId].filter(p => p.socketId !== socket.id);
      socket.emit('room-participants', existingParticipants);

      // Notify others
      socket.to(roomId).emit('user-joined', participant);

      const sysMessage = db.createMessage({
        roomId,
        senderName: 'System',
        senderColor: '#534AB7',
        text: `${userName} joined the room.`
      });
      io.to(roomId).emit('new-message', sysMessage);
    });

    // WebRTC Signaling
    socket.on('webrtc-offer', ({ to, sdp }) => {
      io.to(to).emit('webrtc-offer', { from: socket.id, sdp });
    });
    socket.on('webrtc-answer', ({ to, sdp }) => {
      io.to(to).emit('webrtc-answer', { from: socket.id, sdp });
    });
    socket.on('webrtc-ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('webrtc-ice-candidate', { from: socket.id, candidate });
    });

    // Media status sync
    socket.on('media-status-change', ({ audioActive, videoActive, screenSharing, handRaised }) => {
      const roomId = socket.roomId;
      if (!roomId || !roomParticipants[roomId]) return;

      const participant = roomParticipants[roomId].find(p => p.socketId === socket.id);
      if (participant) {
        if (audioActive !== undefined) participant.audioActive = audioActive;
        if (videoActive !== undefined) participant.videoActive = videoActive;
        if (screenSharing !== undefined) participant.screenSharing = screenSharing;
        if (handRaised !== undefined) participant.handRaised = handRaised;

        socket.to(roomId).emit('user-media-status', { socketId: socket.id, ...participant });
      }
    });

    // Room chat message
    socket.on('send-message', ({ text, senderName, senderColor }) => {
      const roomId = socket.roomId;
      if (!roomId) return;

      const message = db.createMessage({ roomId, senderName, senderColor, text });
      io.to(roomId).emit('new-message', message);
    });

    // Whiteboard
    socket.on('draw', (drawData) => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('draw', drawData);
    });
    socket.on('whiteboard-clear', () => {
      const roomId = socket.roomId;
      if (!roomId) return;
      socket.to(roomId).emit('whiteboard-clear');
    });

    // ─── MEETING INVITES (host invites friend to join) ────────────────────────
    // host sends: { roomId, targetUserId, hostName, meetingTitle }
    socket.on('invite-to-meeting', ({ roomId, targetUserId, hostName, meetingTitle }) => {
      io.to(`user:${targetUserId}`).emit('meeting-invite', {
        roomId,
        hostName,
        meetingTitle: meetingTitle || roomId,
        fromSocketId: socket.id
      });
    });

    // ─── JOIN REQUEST (friend asks host to let them in) ───────────────────────
    // requester sends: { roomId, requesterName, requesterUserId }
    socket.on('request-join-meeting', ({ roomId, requesterName, requesterUserId, requesterColor }) => {
      // Notify host/participants of that room
      socket.to(roomId).emit('join-request', {
        requesterSocketId: socket.id,
        requesterUserId,
        requesterName,
        requesterColor: requesterColor || '#7F77DD'
      });
    });

    // ─── HOST RESPONDS TO JOIN REQUEST ───────────────────────────────────────
    // host sends: { requesterSocketId, accepted }
    socket.on('respond-join-request', ({ requesterSocketId, accepted, roomId }) => {
      io.to(requesterSocketId).emit('join-request-response', { accepted, roomId });
    });

    // ─── DM MESSAGES (real-time delivery; persistence handled via REST) ───────
    socket.on('dm-message', ({ receiverId, messageData }) => {
      io.to(`user:${receiverId}`).emit('dm-message', messageData);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);

      // Remove from online users map
      if (socket.userId) {
        delete onlineUsers[socket.userId];
      }

      const roomId = socket.roomId;
      if (roomId && roomParticipants[roomId]) {
        const pIndex = roomParticipants[roomId].findIndex(p => p.socketId === socket.id);
        if (pIndex !== -1) {
          const participant = roomParticipants[roomId][pIndex];
          roomParticipants[roomId].splice(pIndex, 1);
          socket.to(roomId).emit('user-left', socket.id);

          const sysMessage = db.createMessage({
            roomId,
            senderName: 'System',
            senderColor: '#534AB7',
            text: `${participant.userName} left the room.`
          });
          io.to(roomId).emit('new-message', sysMessage);

          if (roomParticipants[roomId].length === 0) {
            delete roomParticipants[roomId];
          }
        }
      }
    });
  });
}
