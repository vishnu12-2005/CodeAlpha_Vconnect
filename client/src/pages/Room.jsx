import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { socket } from '../utils/socket';
import CanvasBoard from '../components/CanvasBoard';
import { 
  Users, MessageSquare, Folder, Edit, Mic, MicOff, Video as CamIcon, VideoOff, 
  Monitor, HelpCircle, Hand, Disc, Settings as SettingsIcon, PhoneOff, 
  Send, Smile, Upload, Paperclip, Crown, Pin, FileText, Check, Copy,
  UserPlus, X, Search, Bell
} from 'lucide-react';

// Video rendering component helper
function VideoTile({ stream, name, muted, isMuted, isCamOff, isHandRaised, isHost, activeSpeaker, isScreenShare }) {
  const videoRef = useRef();

  // FIX 1: Use a callback ref so srcObject is always assigned the moment the
  //         <video> element mounts — including when isCamOff flips false and
  //         React creates a brand-new <video> node.
  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el && stream) {
      el.srcObject = stream;
    }
  };

  // FIX 2: Also watch `stream` so if the MediaStream object itself ever changes
  //         (e.g. after re-acquiring camera) the element gets refreshed.
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`video-tile ${activeSpeaker ? 'active-speaker' : ''}`}>
      {isCamOff ? (
        <div className="video-avatar-fallback">
          {name ? name[0].toUpperCase() : 'U'}
        </div>
      ) : (
        <video 
          ref={setVideoRef}
          autoPlay 
          playsInline 
          muted={muted} 
          className="video-element"
        />
      )}
      
      {/* Name Label */}
      <div className="video-tile-name flex items-center gap-2">
        {isHost && <Crown size={12} style={{ color: 'gold' }} />}
        <span>{name} {muted ? '(You)' : ''}</span>
        {isScreenShare && <span style={{ fontSize: '10px', background: 'var(--active-state)', padding: '2px 4px', borderRadius: '4px' }}>Screen Sharing</span>}
      </div>

      {/* Top right status indicators */}
      <div className="video-tile-status">
        {isMuted && (
          <div className="video-status-icon" style={{ backgroundColor: 'var(--danger)' }}>
            <MicOff size={12} />
          </div>
        )}
        {isHandRaised && (
          <div className="video-status-icon" style={{ backgroundColor: 'var(--warning)' }}>
            <Hand size={12} />
          </div>
        )}
      </div>

      {/* Pin button on hover */}
      <button className="video-status-icon absolute" style={{ bottom: '12px', right: '12px', opacity: 0, transition: 'opacity 0.2s', border: 'none', cursor: 'pointer' }} title="Pin Tile">
        <Pin size={12} />
      </button>
    </div>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  
  const { 
    user,
    token,
    participants,
    localAudioActive,
    localVideoActive,
    localScreenSharing,
    localHandRaised,
    noiseSuppressionActive,
    chatPanelOpen,
    filesPanelOpen,
    whiteboardPanelOpen,
    participantsPanelOpen,
    chatMessages,
    sharedFiles,
    unreadChatCount,
    unreadFilesCount,
    setChatPanelOpen,
    setFilesPanelOpen,
    setWhiteboardPanelOpen,
    setParticipantsPanelOpen,
    addChatMessage,
    addSharedFile,
    clearUnreadChat,
    clearUnreadFiles,
    setChatMessages,
    setSharedFiles,
    resetCallState,
    isAuthenticated,
    pendingJoinRequests,
    addJoinRequest,
    removeJoinRequest
  } = useAppStore();

  // Invite friends state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSearchId, setInviteSearchId] = useState('');
  const [inviteFoundUser, setInviteFoundUser] = useState(null);
  const [inviteSearchError, setInviteSearchError] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  // Join request (as a non-participant wanting to join)
  const [joinRequestSent, setJoinRequestSent] = useState(false);
  const [joinRequestStatus, setJoinRequestStatus] = useState(null); // 'pending'|'accepted'|'rejected'

  const {
    localStream,
    screenStream,
    remoteStreams,
    toggleLocalAudio,
    toggleLocalVideo,
    toggleScreenShare,
    toggleRaiseHand,
    toggleNoiseSuppression,
    cleanupCall
  } = useWebRTC(roomId);

  const [activeTab, setActiveTab] = useState('chat'); // chat, files, whiteboard
  const [chatInput, setChatInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const fileInputRef = useRef();
  const chatBottomRef = useRef();

  // Redirect if not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Load past history for chat & files
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const filesRes = await fetch(`http://localhost:5000/api/files/room/${roomId}`);
        if (filesRes.ok) {
          const filesData = await filesRes.json();
          setSharedFiles(filesData);
        }
      } catch (err) {
        console.error('Error fetching room files:', err);
      }
    };

    if (roomId) {
      fetchHistory();
    }
  }, [roomId, setSharedFiles]);

  // Setup sockets listener for live chat & file shares
  useEffect(() => {
    socket.on('new-message', (message) => {
      addChatMessage(message);
    });

    socket.on('file-shared', (file) => {
      addSharedFile(file);
    });

    // Join requests from others wanting to enter this room
    socket.on('join-request', (reqData) => {
      addJoinRequest(reqData);
    });

    // Response to our own join request
    socket.on('join-request-response', ({ accepted, roomId: targetRoom }) => {
      if (accepted) {
        setJoinRequestStatus('accepted');
      } else {
        setJoinRequestStatus('rejected');
      }
    });

    // Meeting invite while in meeting (dismiss silently or show toast)
    socket.on('meeting-invite', () => {});

    return () => {
      socket.off('new-message');
      socket.off('file-shared');
      socket.off('join-request');
      socket.off('join-request-response');
    };
  }, [addChatMessage, addSharedFile, addJoinRequest]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatPanelOpen, activeTab]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim()) {
      socket.emit('send-message', {
        text: chatInput.trim(),
        senderName: user.name,
        senderColor: user.avatarColor
      });
      setChatInput('');
    }
  };

  const handleFileUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileUploadSubmit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Enforce 25MB size limit
    if (file.size > 25 * 1024 * 1024) {
      alert('File is too large. Maximum size allowed is 25MB.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);
    formData.append('uploaderName', user.name);

    try {
      const response = await fetch('http://localhost:5000/api/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'File upload failed');
      }

      console.log('File uploaded successfully!');
    } catch (err) {
      console.error('File share error:', err);
      alert(err.message || 'Error sharing file');
    }
  };

  const handleSearchInviteUser = async () => {
    setInviteSearchError('');
    setInviteFoundUser(null);
    if (!inviteSearchId.trim()) return;
    try {
      const res = await fetch(`http://localhost:5000/api/auth/search/${inviteSearchId.trim().toUpperCase()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id === user.id) { setInviteSearchError("That's your own ID!"); return; }
        setInviteFoundUser(data);
      } else {
        const err = await res.json();
        setInviteSearchError(err.message || 'User not found.');
      }
    } catch (e) { setInviteSearchError('Search failed.'); }
  };

  const handleSendInvite = () => {
    if (!inviteFoundUser) return;
    socket.emit('invite-to-meeting', {
      roomId,
      targetUserId: inviteFoundUser.id,
      hostName: user.name,
      meetingTitle: `Room ${roomId}`
    });
    setInviteSent(true);
    setTimeout(() => {
      setInviteSent(false);
      setInviteFoundUser(null);
      setInviteSearchId('');
      setShowInviteModal(false);
    }, 1500);
  };

  const handleAcceptJoinRequest = (req) => {
    socket.emit('respond-join-request', {
      requesterSocketId: req.requesterSocketId,
      accepted: true,
      roomId
    });
    removeJoinRequest(req.requesterSocketId);
  };

  const handleRejectJoinRequest = (req) => {
    socket.emit('respond-join-request', {
      requesterSocketId: req.requesterSocketId,
      accepted: false,
      roomId
    });
    removeJoinRequest(req.requesterSocketId);
  };

  const handleInviteCopy = () => {
    const link = `http://localhost:5173/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleLeaveMeeting = () => {
    cleanupCall();
    resetCallState();
    navigate('/dashboard');
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimestamp = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
  };

  // Determine Three-column classes
  const getLayoutClass = () => {
    const rightOpen = chatPanelOpen || filesPanelOpen || whiteboardPanelOpen;
    if (participantsPanelOpen && rightOpen) return 'in-call-layout';
    if (!participantsPanelOpen && rightOpen) return 'in-call-layout no-sidebar-left';
    if (participantsPanelOpen && !rightOpen) return 'in-call-layout no-sidebar-right';
    return 'in-call-layout no-sidebars';
  };

  const activeRightPanel = () => {
    if (chatPanelOpen) return 'chat';
    if (filesPanelOpen) return 'files';
    if (whiteboardPanelOpen) return 'whiteboard';
    return null;
  };

  const handleTabToggle = (tab) => {
    if (tab === 'chat') {
      if (chatPanelOpen) {
        setChatPanelOpen(false);
      } else {
        setChatPanelOpen(true);
        setFilesPanelOpen(false);
        setWhiteboardPanelOpen(false);
        clearUnreadChat();
      }
    } else if (tab === 'files') {
      if (filesPanelOpen) {
        setFilesPanelOpen(false);
      } else {
        setChatPanelOpen(false);
        setFilesPanelOpen(true);
        setWhiteboardPanelOpen(false);
        clearUnreadFiles();
      }
    } else if (tab === 'whiteboard') {
      if (whiteboardPanelOpen) {
        setWhiteboardPanelOpen(false);
      } else {
        setChatPanelOpen(false);
        setFilesPanelOpen(false);
        setWhiteboardPanelOpen(true);
      }
    }
  };

  // Build grid styles based on total tiles
  const totalParticipants = 1 + participants.length; // Local + remote
  const getGridStyle = () => {
    if (totalParticipants === 1) return { gridTemplateColumns: '1fr', maxWidth: '640px' };
    if (totalParticipants === 2) return { gridTemplateColumns: '1fr 1fr', maxWidth: '1100px' };
    if (totalParticipants <= 4) return { gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', maxWidth: '1100px' };
    return { gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' };
  };

  return (
    <div className="flex flex-col" style={{ height: '100vh', width: '100vw' }}>
      
      {/* Main Core Section */}
      <div className={getLayoutClass()}>
        
        {/* Left Panel: Participants */}
        {participantsPanelOpen && (
          <aside className="call-panel-left">
            <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 500 }}>Participants ({totalParticipants})</h3>
            </div>
            
            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }} className="flex flex-col gap-2">
              {/* Local User */}
              <div className="flex items-center gap-3" style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-base)' }}>
                <div className="avatar" style={{ background: user?.avatarColor || 'var(--primary-accent)', color: 'white', fontSize: '12px' }}>
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user?.name} (You)
                  </div>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Host</span>
                </div>
                <div className="flex gap-2">
                  {!localAudioActive && <MicOff size={14} style={{ color: 'var(--danger)' }} />}
                  {localHandRaised && <Hand size={14} style={{ color: 'var(--warning)' }} />}
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map((peer) => (
                <div key={peer.socketId} className="flex items-center gap-3" style={{ padding: '8px', borderRadius: '8px' }}>
                  <div className="avatar" style={{ background: peer.userColor || 'var(--primary-accent)', color: 'white', fontSize: '12px' }}>
                    {peer.userName ? peer.userName[0].toUpperCase() : 'P'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {peer.userName}
                    </div>
                    {peer.isHost && <span style={{ fontSize: '10px', color: 'var(--active-state)' }}>Host</span>}
                  </div>
                  <div className="flex gap-2">
                    {!peer.audioActive && <MicOff size={14} style={{ color: 'var(--danger)' }} />}
                    {peer.handRaised && <Hand size={14} style={{ color: 'var(--warning)' }} />}
                  </div>
                </div>
              ))}
            </div>

            {/* Invite Buttons */}
            <div style={{ padding: '16px', borderTop: '0.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setShowInviteModal(true)}>
                <UserPlus size={14} />
                <span>Invite Friend by ID</span>
              </button>
              <button className="btn btn-outline" style={{ width: '100%' }} onClick={handleInviteCopy}>
                {copiedLink ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                <span>{copiedLink ? 'Link Copied' : 'Copy Meeting Link'}</span>
              </button>
            </div>
          </aside>
        )}

        {/* Center Panel: Video Grid */}
        <main className="video-grid-container flex-1">
          <div className="video-grid" style={getGridStyle()}>
            {/* Local Video Tile */}
            <VideoTile
              stream={localScreenSharing && screenStream ? screenStream : localStream}
              name={user?.name}
              muted={true}
              isMuted={!localAudioActive}
              isCamOff={!localScreenSharing && !localVideoActive}
              isHandRaised={localHandRaised}
              isHost={true}
              isScreenShare={localScreenSharing}
              activeSpeaker={false}
            />

            {/* Remote Video Tiles */}
            {participants.map((peer) => (
              <VideoTile
                key={peer.socketId}
                stream={remoteStreams[peer.socketId]}
                name={peer.userName}
                muted={false}
                isMuted={!peer.audioActive}
                isCamOff={!peer.videoActive}
                isHandRaised={peer.handRaised}
                isHost={peer.isHost}
                isScreenShare={peer.screenSharing}
                activeSpeaker={peer.audioActive && !peer.screenSharing && Math.random() > 0.7} // Simulated voice highlight
              />
            ))}
          </div>
        </main>

        {/* Right Panel: Tabs Panel (Chat, Files, Whiteboard) */}
        {activeRightPanel() && (
          <aside className="call-panel-right">
            {/* Tabs Header */}
            <div className="tab-header">
              <button 
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => { setActiveTab('chat'); clearUnreadChat(); }}
              >
                Chat
              </button>
              <button 
                className={`tab-btn ${activeTab === 'files' ? 'active' : ''}`}
                onClick={() => { setActiveTab('files'); clearUnreadFiles(); }}
              >
                Files
              </button>
              <button 
                className={`tab-btn ${activeTab === 'whiteboard' ? 'active' : ''}`}
                onClick={() => setActiveTab('whiteboard')}
              >
                Whiteboard
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              
              {/* Chat View */}
              {activeTab === 'chat' && (
                <div className="chat-container">
                  <div className="chat-messages">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className="chat-bubble">
                        <div className="avatar" style={{ background: msg.senderColor || 'var(--primary-accent)', color: 'white', width: '28px', height: '28px', fontSize: '11px' }}>
                          {msg.senderName[0].toUpperCase()}
                        </div>
                        <div className="chat-bubble-content">
                          <div className="chat-bubble-header">
                            <span className="chat-sender">{msg.senderName}</span>
                            <span className="chat-time mono">{formatTimestamp(msg.timestamp)}</span>
                          </div>
                          {msg.senderName === 'System' ? (
                            <span className="chat-text system-text">{msg.text}</span>
                          ) : (
                            <span className="chat-text">{msg.text}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    <div ref={chatBottomRef} />
                  </div>
                  
                  <form onSubmit={handleSendChat} className="chat-input-area">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Type a message..."
                      style={{ padding: '8px 12px', fontSize: '13px' }}
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                    />
                    <button type="submit" className="btn btn-primary btn-icon" style={{ width: '36px', height: '36px', borderRadius: '8px' }}>
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              )}

              {/* Files View */}
              {activeTab === 'files' && (
                <div className="chat-container" style={{ padding: '16px' }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 500 }}>Shared Files</h4>
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleFileUploadClick}>
                      <Upload size={12} />
                      <span>Share File</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUploadSubmit} 
                      style={{ display: 'none' }} 
                    />
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }} className="flex flex-col gap-3">
                    {sharedFiles.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                        <Folder size={32} style={{ marginBottom: '8px', opacity: 0.5 }} />
                        <p style={{ fontSize: '13px' }}>No files shared yet in this room.</p>
                      </div>
                    ) : (
                      sharedFiles.map((file) => (
                        <div key={file.id} className="flex items-center gap-3" style={{ padding: '10px', border: '0.5px solid var(--border-color)', borderRadius: '8px', background: 'var(--bg-base)' }}>
                          <div style={{ background: 'var(--soft-fill)', padding: '6px', borderRadius: '6px', color: 'var(--active-state)' }}>
                            <FileText size={16} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <a 
                              href={`http://localhost:5000${file.path}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ fontSize: '12px', fontWeight: 500, color: 'var(--active-state)', textDecoration: 'none', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                            >
                              {file.originalName}
                            </a>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {file.uploaderName} • {formatFileSize(file.size)}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Whiteboard View */}
              {activeTab === 'whiteboard' && (
                <div style={{ height: '100%' }}>
                  <CanvasBoard roomId={roomId} />
                </div>
              )}

            </div>
          </aside>
        )}

      </div>

      {/* Bottom Control Bar */}
      <footer className="bottom-controls">
        
        {/* Left Side: Sidebars toggle triggers */}
        <div className="flex gap-2">
          <button 
            className={`control-btn ${participantsPanelOpen ? 'active' : ''}`}
            onClick={() => setParticipantsPanelOpen(!participantsPanelOpen)}
            title="Toggle Participants Panel"
          >
            <Users size={18} />
          </button>
          
          <button 
            className={`control-btn ${chatPanelOpen ? 'active' : ''}`}
            onClick={() => handleTabToggle('chat')}
            title="Toggle Chat Panel"
            style={{ position: 'relative' }}
          >
            <MessageSquare size={18} />
            {unreadChatCount > 0 && <span className="badge">{unreadChatCount}</span>}
          </button>

          <button 
            className={`control-btn ${filesPanelOpen ? 'active' : ''}`}
            onClick={() => handleTabToggle('files')}
            title="Toggle Files Panel"
            style={{ position: 'relative' }}
          >
            <Folder size={18} />
            {unreadFilesCount > 0 && <span className="badge">{unreadFilesCount}</span>}
          </button>

          <button 
            className={`control-btn ${whiteboardPanelOpen ? 'active' : ''}`}
            onClick={() => handleTabToggle('whiteboard')}
            title="Toggle Whiteboard"
          >
            <Edit size={18} />
          </button>
        </div>

        {/* Center Side: Media Stream controllers */}
        <div className="flex gap-2" style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
          
          {/* Mute Mic */}
          <button 
            className={`control-btn ${!localAudioActive ? 'danger' : ''}`}
            onClick={toggleLocalAudio}
            title={localAudioActive ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {localAudioActive ? <Mic size={18} /> : <MicOff size={18} />}
          </button>

          {/* Start Camera */}
          <button 
            className={`control-btn ${!localVideoActive ? 'danger' : ''}`}
            onClick={toggleLocalVideo}
            title={localVideoActive ? 'Stop Camera' : 'Start Camera'}
          >
            {localVideoActive ? <CamIcon size={18} /> : <VideoOff size={18} />}
          </button>

          {/* Screen Share */}
          <button 
            className={`control-btn ${localScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={localScreenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <Monitor size={18} />
          </button>

          {/* Noise Suppression */}
          <button 
            className={`control-btn ${noiseSuppressionActive ? 'active' : ''}`}
            onClick={toggleNoiseSuppression}
            title={noiseSuppressionActive ? 'Disable Noise Suppression' : 'Enable Noise Suppression'}
          >
            <HelpCircle size={18} />
          </button>

          {/* Raise Hand */}
          <button 
            className={`control-btn ${localHandRaised ? 'active' : ''}`}
            onClick={toggleRaiseHand}
            title="Raise Hand"
          >
            <Hand size={18} />
          </button>
        </div>

        {/* Right Side: Extras and Terminate */}
        <div className="flex gap-2">
          
          {/* Mock Record */}
          <button 
            className={`control-btn ${isRecording ? 'active' : ''}`}
            onClick={toggleRecording}
            title={isRecording ? 'Stop Recording' : 'Record Session'}
            style={{ color: isRecording ? 'var(--danger)' : 'var(--active-state)' }}
          >
            <Disc size={18} />
          </button>

          <button className="control-btn" title="Settings">
            <SettingsIcon size={18} />
          </button>

          {/* End Call */}
          <button 
            className="control-btn danger"
            onClick={handleLeaveMeeting}
            title="Leave Meeting"
          >
            <PhoneOff size={18} />
          </button>
        </div>

      </footer>

      {/* ── Invite Friend to Meeting Modal ── */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div className="card" style={{ width: '100%', maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Invite Friend</h3>
              <button onClick={() => { setShowInviteModal(false); setInviteFoundUser(null); setInviteSearchId(''); setInviteSent(false); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {inviteSent ? (
              <div style={{ textAlign: 'center', padding: '16px' }}>
                <Check size={36} style={{ color: 'var(--success)', marginBottom: '8px' }} />
                <p style={{ fontWeight: 500 }}>Invite sent!</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>They'll get a notification to join.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Enter a friend's User ID to send them a meeting invite.
                </p>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. VC-A3X9K2PL"
                    value={inviteSearchId}
                    onChange={(e) => setInviteSearchId(e.target.value.toUpperCase())}
                    style={{ fontFamily: 'monospace', flex: 1 }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchInviteUser()}
                  />
                  <button className="btn btn-outline" style={{ padding: '8px 12px' }} onClick={handleSearchInviteUser}>
                    <Search size={14} />
                  </button>
                </div>
                {inviteSearchError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginBottom: '8px' }}>{inviteSearchError}</p>}
                {inviteFoundUser && (
                  <div style={{ background: 'var(--soft-fill)', borderRadius: '10px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <div className="avatar" style={{ background: inviteFoundUser.avatarColor, color: 'white', width: '32px', height: '32px', fontSize: '13px' }}>{inviteFoundUser.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{inviteFoundUser.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{inviteFoundUser.userId}</div>
                    </div>
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleSendInvite}>
                      Invite
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Join Requests (people knocking at the door) ── */}
      {pendingJoinRequests.length > 0 && (
        <div style={{ position: 'fixed', top: '80px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 200, maxWidth: '320px' }}>
          {pendingJoinRequests.map((req) => (
            <div key={req.requesterSocketId} style={{ background: 'var(--bg-panel)', border: '1px solid var(--primary-accent)', borderRadius: '14px', padding: '16px', boxShadow: '0 6px 24px rgba(83,74,183,0.18)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div className="avatar" style={{ background: req.requesterColor, color: 'white', width: '32px', height: '32px', fontSize: '13px' }}>{req.requesterName[0]}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600 }}>{req.requesterName}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>wants to join this meeting</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline" style={{ flex: 1, fontSize: '12px' }} onClick={() => handleRejectJoinRequest(req)}>Decline</button>
                <button className="btn btn-primary" style={{ flex: 1, fontSize: '12px' }} onClick={() => handleAcceptJoinRequest(req)}>Admit</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Join Request Status (for the person requesting) ── */}
      {joinRequestStatus && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', background: joinRequestStatus === 'accepted' ? 'var(--success)' : 'var(--danger)', color: 'white', borderRadius: '12px', padding: '14px 24px', zIndex: 200, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          {joinRequestStatus === 'accepted'
            ? '✅ Your join request was accepted!'
            : '❌ Your join request was declined.'}
        </div>
      )}
    </div>
  );
}
