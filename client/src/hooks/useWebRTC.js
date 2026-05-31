import { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../utils/socket';
import { useAppStore } from '../store/useAppStore';
import { useNoiseSuppression } from './useNoiseSuppression';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC(roomId) {
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});

  const peerConnections = useRef({});  // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const pendingCandidates = useRef({}); // socketId -> [candidates] buffered before remote desc

  const {
    user,
    token,
    setParticipants,
    addParticipant,
    removeParticipant,
    updateParticipantStatus,
    localAudioActive,
    localVideoActive,
    localScreenSharing,
    localHandRaised,
    noiseSuppressionActive,
    setLocalAudioActive,
    setLocalVideoActive,
    setLocalScreenSharing,
    setLocalHandRaised,
    setNoiseSuppressionActive,
  } = useAppStore();

  const { applyNoiseSuppression, cleanupAudioGraph } = useNoiseSuppression();

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const createPeerConnection = useCallback((remoteSocketId) => {
    if (peerConnections.current[remoteSocketId]) {
      return peerConnections.current[remoteSocketId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[remoteSocketId] = pc;

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-ice-candidate', {
          to: remoteSocketId,
          candidate: event.candidate
        });
      }
    };

    // Incoming remote stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStreams(prev => ({ ...prev, [remoteSocketId]: remoteStream }));
    };

    pc.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
        closePeer(remoteSocketId);
      }
    };

    return pc;
  }, []);

  const closePeer = useCallback((remoteSocketId) => {
    const pc = peerConnections.current[remoteSocketId];
    if (pc) {
      pc.close();
      delete peerConnections.current[remoteSocketId];
    }
    delete pendingCandidates.current[remoteSocketId];
    setRemoteStreams(prev => {
      const next = { ...prev };
      delete next[remoteSocketId];
      return next;
    });
  }, []);

  const flushPendingCandidates = useCallback(async (remoteSocketId) => {
    const pc = peerConnections.current[remoteSocketId];
    const candidates = pendingCandidates.current[remoteSocketId] || [];
    for (const candidate of candidates) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    }
    pendingCandidates.current[remoteSocketId] = [];
  }, []);

  // ─── Media setup ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId || !user) return;

    let mounted = true;

    const initMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Connect socket and join room
        if (!socket.connected) socket.connect();
        socket.emit('register-user', { userId: user.id });
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          userName: user.name,
          userColor: user.avatarColor
        });
      } catch (err) {
        console.error('Failed to get user media:', err);
        // Still join the room without media
        if (!socket.connected) socket.connect();
        socket.emit('register-user', { userId: user.id });
        socket.emit('join-room', {
          roomId,
          userId: user.id,
          userName: user.name,
          userColor: user.avatarColor
        });
      }
    };

    initMedia();
    return () => { mounted = false; };
  }, [roomId, user]);

  // ─── Socket signaling ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!roomId) return;

    // Existing participants snapshot when we join
    const onRoomParticipants = async (participants) => {
      setParticipants(participants);
      // Initiate offers to all existing peers
      for (const p of participants) {
        const pc = createPeerConnection(p.socketId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', { to: p.socketId, sdp: offer });
      }
    };

    // New peer joins after us
    const onUserJoined = (participant) => {
      addParticipant(participant);
      // They will send us an offer; just prepare the PC
      createPeerConnection(participant.socketId);
    };

    // Receive offer
    const onOffer = async ({ from, sdp }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushPendingCandidates(from);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc-answer', { to: from, sdp: answer });
    };

    // Receive answer
    const onAnswer = async ({ from, sdp }) => {
      const pc = peerConnections.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(from);
      }
    };

    // ICE candidate
    const onIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnections.current[from];
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
      } else {
        if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
        pendingCandidates.current[from].push(candidate);
      }
    };

    // Peer left
    const onUserLeft = (socketId) => {
      removeParticipant(socketId);
      closePeer(socketId);
    };

    // Media status change from another participant
    const onUserMediaStatus = ({ socketId, ...updates }) => {
      updateParticipantStatus(socketId, updates);
    };

    socket.on('room-participants', onRoomParticipants);
    socket.on('user-joined', onUserJoined);
    socket.on('webrtc-offer', onOffer);
    socket.on('webrtc-answer', onAnswer);
    socket.on('webrtc-ice-candidate', onIceCandidate);
    socket.on('user-left', onUserLeft);
    socket.on('user-media-status', onUserMediaStatus);

    return () => {
      socket.off('room-participants', onRoomParticipants);
      socket.off('user-joined', onUserJoined);
      socket.off('webrtc-offer', onOffer);
      socket.off('webrtc-answer', onAnswer);
      socket.off('webrtc-ice-candidate', onIceCandidate);
      socket.off('user-left', onUserLeft);
      socket.off('user-media-status', onUserMediaStatus);
    };
  }, [roomId, createPeerConnection, closePeer, flushPendingCandidates,
      addParticipant, removeParticipant, updateParticipantStatus, setParticipants]);

  // ─── Controls ─────────────────────────────────────────────────────────────

  const toggleLocalAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setLocalAudioActive(audioTrack.enabled);
      socket.emit('media-status-change', { audioActive: audioTrack.enabled });
    }
  }, [setLocalAudioActive]);

  const toggleLocalVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setLocalVideoActive(videoTrack.enabled);
      socket.emit('media-status-change', { videoActive: videoTrack.enabled });
    }
  }, [setLocalVideoActive]);

  const stopScreenShare = useCallback(async () => {
    // Stop the screen stream tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenStream(null);
    }

    // The camera track may have been stopped by the browser during screen share;
    // re-acquire it so the local preview and peer senders both get a live track.
    let cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    if (!cameraTrack || cameraTrack.readyState === 'ended') {
      try {
        const newCamStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraTrack = newCamStream.getVideoTracks()[0];
        // Replace the stale track in the local stream
        if (localStreamRef.current) {
          const oldTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldTrack) localStreamRef.current.removeTrack(oldTrack);
          localStreamRef.current.addTrack(cameraTrack);
        }
        // Trigger a re-render of the local video element
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
      } catch (err) {
        console.error('Failed to re-acquire camera after screen share:', err);
      }
    }

    // Restore the camera track's enabled state to match the video toggle
    if (cameraTrack) {
      cameraTrack.enabled = localVideoActive;
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(cameraTrack);
      });
    }

    setLocalScreenSharing(false);
    socket.emit('media-status-change', { screenSharing: false, videoActive: localVideoActive });
  }, [localVideoActive, setLocalScreenSharing]);

  const toggleScreenShare = useCallback(async () => {
    if (localScreenSharing) {
      await stopScreenShare();
    } else {
      try {
        const sStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = sStream;
        setScreenStream(sStream);
        const screenTrack = sStream.getVideoTracks()[0];

        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        // Use a direct ref-based handler so it doesn't capture a stale closure
        screenTrack.onended = () => stopScreenShare();
        setLocalScreenSharing(true);
        socket.emit('media-status-change', { screenSharing: true });
      } catch (err) {
        console.error('Screen share failed:', err);
      }
    }
  }, [localScreenSharing, stopScreenShare, setLocalScreenSharing]);

  const toggleRaiseHand = useCallback(() => {
    const next = !localHandRaised;
    setLocalHandRaised(next);
    socket.emit('media-status-change', { handRaised: next });
  }, [localHandRaised, setLocalHandRaised]);

  const toggleNoiseSuppression = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    if (!noiseSuppressionActive) {
      const processedTrack = applyNoiseSuppression(stream);
      if (processedTrack) {
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) sender.replaceTrack(processedTrack);
        });
        setNoiseSuppressionActive(true);
      }
    } else {
      cleanupAudioGraph();
      const originalAudioTrack = stream.getAudioTracks()[0];
      if (originalAudioTrack) {
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
          if (sender) sender.replaceTrack(originalAudioTrack);
        });
      }
      setNoiseSuppressionActive(false);
    }
  }, [noiseSuppressionActive, applyNoiseSuppression, cleanupAudioGraph, setNoiseSuppressionActive]);

  const cleanupCall = useCallback(() => {
    // Stop all local tracks
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current = null;
    setLocalStream(null);
    setScreenStream(null);

    // Close all peer connections
    Object.keys(peerConnections.current).forEach(closePeer);

    cleanupAudioGraph();
    socket.disconnect();
  }, [closePeer, cleanupAudioGraph]);

  return {
    localStream,
    screenStream,
    remoteStreams,
    toggleLocalAudio,
    toggleLocalVideo,
    toggleScreenShare,
    toggleRaiseHand,
    toggleNoiseSuppression,
    cleanupCall
  };
}
