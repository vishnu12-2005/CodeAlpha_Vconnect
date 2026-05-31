import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { socket } from '../utils/socket';
import {
  Search, Send, Paperclip, ArrowLeft, UserPlus, MessageSquare,
  FileText, Download, X, ChevronLeft, Home, Video, Calendar, Folder, Settings, LogOut
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Chat() {
  const { user, token, isAuthenticated, activeDMPartner, setActiveDMPartner, dmMessages, setDMMessages, addDMMessage, dmConversations, setDMConversations, logout } = useAppStore();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [addFriendId, setAddFriendId] = useState('');
  const [foundUser, setFoundUser] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const fileInputRef = useRef();
  const messagesEndRef = useRef();
  const [activePartner, setActivePartner] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }
    fetchConversations();

    // Register for real-time DMs
    socket.emit('register-user', { userId: user.id });
    socket.on('dm-message', (msg) => {
      setMessages(prev => {
        if (activePartner && (msg.senderId === activePartner.id || msg.receiverId === activePartner.id)) {
          return [...prev, msg];
        }
        return prev;
      });
      fetchConversations();
    });

    return () => { socket.off('dm-message'); };
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/dm/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) { console.error(e); }
  };

  const openConversation = async (partner) => {
    setActivePartner(partner);
    setLoadingMsgs(true);
    try {
      const res = await fetch(`${API_BASE}/dm/messages/${partner.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const { messages: msgs } = await res.json();
        setMessages(msgs);
      }
    } catch (e) { console.error(e); }
    setLoadingMsgs(false);
  };

  const handleSearchUser = async () => {
    setSearchError('');
    setFoundUser(null);
    if (!addFriendId.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/auth/search/${addFriendId.trim().toUpperCase()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id === user.id) { setSearchError("That's your own ID!"); return; }
        setFoundUser(data);
      } else {
        const err = await res.json();
        setSearchError(err.message || 'User not found.');
      }
    } catch (e) {
      setSearchError('Search failed. Try again.');
    }
  };

  const handleStartChat = (partner) => {
    setFoundUser(null);
    setAddFriendId('');
    setShowAddFriend(false);
    openConversation(partner);
  };

  const handleSendText = async (e) => {
    e.preventDefault();
    if (!textInput.trim() || !activePartner) return;
    try {
      const res = await fetch(`${API_BASE}/dm/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activePartner.id, text: textInput.trim() })
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setTextInput('');
        fetchConversations();
      }
    } catch (e) { console.error(e); }
  };

  const handleFileShare = async (e) => {
    const file = e.target.files[0];
    if (!file || !activePartner) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiverId', activePartner.id);
    try {
      const res = await fetch(`${API_BASE}/dm/share-file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        const { msg } = await res.json();
        setMessages(prev => [...prev, msg]);
        fetchConversations();
      }
    } catch (e) { console.error(e); }
    e.target.value = '';
  };

  const filteredConvs = conversations.filter(c =>
    c.partner?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.partner?.userId?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar nav (same style as Dashboard) */}
      <aside style={{ width: '220px', flexShrink: 0, borderRight: '0.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
        <div style={{ height: '70px', display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '0.5px solid var(--border-color)' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-accent)' }}>V Connect</span>
        </div>
        <ul className="sidebar-menu">
          <li className="sidebar-item" onClick={() => navigate('/dashboard')}><Home size={18} /><span>Home</span></li>
          <li className="sidebar-item" onClick={() => navigate('/scheduler')}><Calendar size={18} /><span>Schedule</span></li>
          <li className="sidebar-item"><Video size={18} /><span>Join Meeting</span></li>
          <li className="sidebar-item"><Folder size={18} /><span>Files</span></li>
          <li className="sidebar-item active"><MessageSquare size={18} /><span>Chat</span></li>
          <li className="sidebar-item"><Settings size={18} /><span>Settings</span></li>
        </ul>
        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="avatar" style={{ background: user?.avatarColor || 'var(--primary-accent)', color: 'white', flexShrink: 0 }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{user?.userId}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><LogOut size={16} /></button>
        </div>
      </aside>

      {/* Conversations List */}
      <div style={{ width: '300px', flexShrink: 0, borderRight: '0.5px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-panel)' }}>
        <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>Messages</h2>
            <button
              onClick={() => setShowAddFriend(!showAddFriend)}
              className="btn btn-primary"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              title="Find someone by User ID"
            >
              <UserPlus size={14} />
              <span>New Chat</span>
            </button>
          </div>

          {/* Search conversation */}
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '32px', height: '36px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Find user by ID panel */}
        {showAddFriend && (
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border-color)', background: 'var(--soft-fill)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Enter a User ID to start chatting:</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. VC-A3X9K2PL"
                value={addFriendId}
                onChange={(e) => setAddFriendId(e.target.value.toUpperCase())}
                style={{ flex: 1, height: '34px', fontSize: '13px', fontFamily: 'monospace' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
              />
              <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={handleSearchUser}>
                <Search size={13} />
              </button>
            </div>
            {searchError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{searchError}</p>}
            {foundUser && (
              <div style={{ marginTop: '10px', padding: '10px', background: 'var(--bg-panel)', borderRadius: '8px', border: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="avatar" style={{ background: foundUser.avatarColor, color: 'white', width: '32px', height: '32px', fontSize: '13px' }}>{foundUser.name[0]}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{foundUser.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{foundUser.userId}</div>
                </div>
                <button className="btn btn-primary" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => handleStartChat(foundUser)}>
                  Chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Conversation items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filteredConvs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <MessageSquare size={32} style={{ marginBottom: '8px', opacity: 0.4 }} />
              <p style={{ fontSize: '13px' }}>No conversations yet.</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Search by User ID to start chatting.</p>
            </div>
          ) : filteredConvs.map(({ partner, lastMsg, unread }) => (
            <div
              key={partner.id}
              onClick={() => openConversation(partner)}
              style={{
                padding: '14px 16px',
                cursor: 'pointer',
                borderBottom: '0.5px solid var(--border-color)',
                background: activePartner?.id === partner.id ? 'var(--soft-fill)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div className="avatar" style={{ background: partner.avatarColor, color: 'white', flexShrink: 0 }}>{partner.name[0]}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{partner.name}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatTime(lastMsg?.timestamp)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {lastMsg?.text || 'Start a conversation'}
                  </span>
                  {unread > 0 && (
                    <span style={{ background: 'var(--primary-accent)', color: 'white', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 600 }}>{unread}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      {activePartner ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Chat Header */}
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-panel)' }}>
            <div className="avatar" style={{ background: activePartner.avatarColor, color: 'white' }}>{activePartner.name[0]}</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600 }}>{activePartner.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{activePartner.userId}</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {loadingMsgs ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>Loading messages...</div>
            ) : messages.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 20px' }}>
                <MessageSquare size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                <p style={{ fontSize: '14px' }}>Say hello to {activePartner.name}!</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Files you share will appear here even if they're offline.</p>
              </div>
            ) : messages.map((msg) => {
              const isMine = msg.senderId === user.id;
              const isFile = msg.fileId || msg.filePath;
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', gap: '8px', alignItems: 'flex-end' }}>
                  {!isMine && (
                    <div className="avatar" style={{ background: activePartner.avatarColor, color: 'white', width: '28px', height: '28px', fontSize: '11px', flexShrink: 0 }}>
                      {activePartner.name[0]}
                    </div>
                  )}
                  <div style={{
                    maxWidth: '65%',
                    padding: isFile ? '10px 12px' : '10px 14px',
                    borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isMine ? 'var(--primary-accent)' : 'var(--bg-panel)',
                    border: isMine ? 'none' : '0.5px solid var(--border-color)',
                    color: isMine ? 'white' : 'var(--text-primary)'
                  }}>
                    {isFile ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: isMine ? 'rgba(255,255,255,0.2)' : 'var(--soft-fill)', padding: '6px', borderRadius: '6px' }}>
                          <FileText size={16} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {msg.fileName || msg.text.replace('📎 Shared a file: ', '')}
                          </div>
                          {msg.fileSize && <div style={{ fontSize: '11px', opacity: 0.75 }}>{formatFileSize(msg.fileSize)}</div>}
                        </div>
                        {msg.filePath && (
                          <a href={`http://localhost:5000${msg.filePath}`} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', opacity: 0.8 }}>
                            <Download size={14} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '14px', lineHeight: '1.4' }}>{msg.text}</span>
                    )}
                    <div style={{ fontSize: '10px', opacity: 0.6, marginTop: '4px', textAlign: isMine ? 'right' : 'left' }}>
                      {formatTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 16px', borderTop: '0.5px solid var(--border-color)', background: 'var(--bg-panel)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px' }}
              title="Share a file"
            >
              <Paperclip size={18} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileShare} style={{ display: 'none' }} />
            <form onSubmit={handleSendText} style={{ flex: 1, display: 'flex', gap: '8px' }}>
              <input
                type="text"
                className="form-input"
                placeholder={`Message ${activePartner.name}...`}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                style={{ flex: 1, height: '40px', fontSize: '14px' }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '10px' }} disabled={!textInput.trim()}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: '12px' }}>
          <MessageSquare size={48} style={{ opacity: 0.2 }} />
          <p style={{ fontSize: '15px' }}>Select a conversation or start a new one</p>
          <p style={{ fontSize: '13px' }}>Share your User ID <strong style={{ fontFamily: 'monospace', color: 'var(--primary-accent)' }}>{user?.userId}</strong> so friends can find you</p>
        </div>
      )}
    </div>
  );
}
