import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { socket } from '../utils/socket';
import {
  Home, Video, Calendar, Folder, Settings, Search, Bell, LogOut,
  Plus, VideoOff, FileText, ChevronLeft, ChevronRight, Copy, Check,
  MessageSquare, Upload, IdCard, UserPlus, X, User, Lock, Camera,
  Edit2, ChevronDown, Sun, Moon
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myFiles, setMyFiles] = useState([]);
  const [showFilesModal, setShowFilesModal] = useState(false);
  const [showShareFileModal, setShowShareFileModal] = useState(false);
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedUserId, setCopiedUserId] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Profile dropdown + edit modal
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPicture, setEditPicture] = useState(null);     // base64 data URL preview
  const [editPictureFile, setEditPictureFile] = useState(null);
  const [editCurrentPwd, setEditCurrentPwd] = useState('');
  const [editNewPwd, setEditNewPwd] = useState('');
  const [editConfirmPwd, setEditConfirmPwd] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [editSuccess, setEditSuccess] = useState('');
  const [editError, setEditError] = useState('');
  const profileMenuRef = useRef(null);
  const pictureInputRef = useRef(null);

  // Share file state
  const [shareReceiverInput, setShareReceiverInput] = useState('');
  const [shareFoundUser, setShareFoundUser] = useState(null);
  const [shareSearchError, setShareSearchError] = useState('');
  const [shareFile, setShareFile] = useState(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const fileShareInputRef = useRef();

  // Meeting invite notification
  const { pendingInvite, setPendingInvite, clearPendingInvite } = useAppStore();

  const { user, token, logout, isAuthenticated, updateUser, theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();

  // Close profile menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/'); return; }

    socket.emit('register-user', { userId: user.id });
    socket.on('meeting-invite', (invite) => { setPendingInvite(invite); });

    fetchDashboardData();
    return () => { socket.off('meeting-invite'); };
  }, [isAuthenticated]);

  // Pre-fill name when edit modal opens
  useEffect(() => {
    if (showEditProfile) {
      setEditName(user?.name || '');
      setEditPicture(user?.profilePicture || null);
      setEditPictureFile(null);
      setEditCurrentPwd('');
      setEditNewPwd('');
      setEditConfirmPwd('');
      setEditSuccess('');
      setEditError('');
    }
  }, [showEditProfile]);

  const fetchDashboardData = async () => {
    try {
      const meetingsRes = await fetch(`${API_BASE}/meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (meetingsRes.ok) {
        const data = await meetingsRes.json();
        setMeetings(data.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)));
      }

      const filesRes = await fetch(`${API_BASE}/files/my-files`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (filesRes.ok) {
        setMyFiles(await filesRes.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = (meetingId) => {
    navigator.clipboard.writeText(`http://localhost:5173/room/${meetingId}`);
    setCopiedId(meetingId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(user?.userId || '');
    setCopiedUserId(true);
    setTimeout(() => setCopiedUserId(false), 2000);
  };

  const handleStartInstantMeeting = () => {
    navigate(`/room/${Math.random().toString(36).substring(2, 10)}`);
  };

  const handleJoinMeetingSubmit = (e) => {
    e.preventDefault();
    if (joinRoomId.trim()) navigate(`/room/${joinRoomId.trim()}`);
  };

  const formatMeetingDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  // ── Profile Picture picker ────────────────────────────────────────────────
  const handlePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setEditPictureFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setEditPicture(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── Save profile ─────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    setEditError('');
    setEditSuccess('');

    if (editNewPwd && editNewPwd !== editConfirmPwd) {
      setEditError('New passwords do not match.');
      return;
    }
    if (editNewPwd && editNewPwd.length < 6) {
      setEditError('New password must be at least 6 characters.');
      return;
    }

    setEditLoading(true);
    try {
      const body = {};
      if (editName.trim() && editName.trim() !== user?.name) body.name = editName.trim();
      if (editPicture !== (user?.profilePicture || null)) body.profilePicture = editPicture;
      if (editNewPwd) {
        body.currentPassword = editCurrentPwd;
        body.newPassword = editNewPwd;
      }

      if (Object.keys(body).length === 0) {
        setEditError('No changes to save.');
        setEditLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed.');

      updateUser(data.user);
      setEditSuccess('Profile updated successfully!');
      setEditCurrentPwd('');
      setEditNewPwd('');
      setEditConfirmPwd('');
      setTimeout(() => setShowEditProfile(false), 1200);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ── Share File (outside meeting) ──────────────────────────────────────────
  const handleShareFileSearch = async () => {
    setShareSearchError('');
    setShareFoundUser(null);
    if (!shareReceiverInput.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/auth/search/${shareReceiverInput.trim().toUpperCase()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.id === user.id) { setShareSearchError("That's your own ID!"); return; }
        setShareFoundUser(data);
      } else {
        const err = await res.json();
        setShareSearchError(err.message || 'User not found.');
      }
    } catch (e) { setShareSearchError('Search failed.'); }
  };

  const handleShareFileSubmit = async () => {
    if (!shareFile || !shareFoundUser) return;
    setShareLoading(true);
    const formData = new FormData();
    formData.append('file', shareFile);
    formData.append('receiverId', shareFoundUser.id);
    try {
      const res = await fetch(`${API_BASE}/dm/share-file`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        setShareSuccess(true);
        fetchDashboardData();
        setTimeout(() => {
          setShowShareFileModal(false);
          setShareFile(null);
          setShareFoundUser(null);
          setShareReceiverInput('');
          setShareSuccess(false);
        }, 1500);
      }
    } catch (e) { console.error(e); }
    setShareLoading(false);
  };

  const filteredMeetings = meetings;
  const filteredFiles = myFiles.filter(f =>
    f.originalName?.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  // Avatar display helper
  const avatarContent = user?.profilePicture
    ? <img src={user.profilePicture} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
    : (user?.name?.[0]?.toUpperCase() || 'U');

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <div style={{ height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: '0.5px solid var(--border-color)' }}>
          {!collapsed && <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary-accent)' }}>V Connect</span>}
          <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        <ul className="sidebar-menu">
          <li className="sidebar-item active"><Home size={18} />{!collapsed && <span>Home</span>}</li>
          <li className="sidebar-item" onClick={() => navigate('/scheduler')}><Calendar size={18} />{!collapsed && <span>Schedule</span>}</li>
          <li className="sidebar-item" onClick={() => setShowJoinModal(true)}><Video size={18} />{!collapsed && <span>Join Meeting</span>}</li>
          <li className="sidebar-item" onClick={() => setShowFilesModal(true)} style={{ cursor: 'pointer' }}><Folder size={18} />{!collapsed && <span>Files</span>}</li>
          <li className="sidebar-item" onClick={() => navigate('/chat')} style={{ cursor: 'pointer' }}><MessageSquare size={18} />{!collapsed && <span>Chat</span>}</li>
          <li className="sidebar-item" onClick={() => setShowSettingsModal(true)} style={{ cursor: 'pointer' }}><Settings size={18} />{!collapsed && <span>Settings</span>}</li>
        </ul>

        <div style={{ marginTop: 'auto', padding: '16px', borderTop: '0.5px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="avatar" style={{ background: user?.profilePicture ? 'transparent' : (user?.avatarColor || 'var(--primary-accent)'), color: 'white', flexShrink: 0, overflow: 'hidden' }}>
              {avatarContent}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.userId}</div>
              </div>
            )}
            <button onClick={logout} title="Log Out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '4px' }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col" style={{ overflowY: 'auto' }}>
        {/* Top Navbar */}
        <nav className="top-navbar" style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div className="flex items-center gap-4">
            <button className="btn btn-outline btn-icon" style={{ borderRadius: '50%' }}><Bell size={18} /></button>

            {/* ── Profile Button with Dropdown ── */}
            <div ref={profileMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setShowProfileMenu(prev => !prev)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: 'var(--soft-fill)', border: '1px solid var(--border-color)',
                  borderRadius: '40px', padding: '4px 12px 4px 4px',
                  cursor: 'pointer', transition: 'background 0.15s'
                }}
              >
                <div
                  className="avatar"
                  style={{
                    width: '32px', height: '32px', fontSize: '13px',
                    background: user?.profilePicture ? 'transparent' : (user?.avatarColor || 'var(--primary-accent)'),
                    color: 'white', overflow: 'hidden', flexShrink: 0
                  }}
                >
                  {avatarContent}
                </div>
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name?.split(' ')[0] || 'Profile'}
                </span>
                <ChevronDown size={14} style={{ color: 'var(--text-secondary)', transform: showProfileMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-panel)', border: '1px solid var(--border-color)',
                  borderRadius: '12px', minWidth: '200px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 200,
                  overflow: 'hidden'
                }}>
                  {/* User info header */}
                  <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      className="avatar"
                      style={{
                        width: '38px', height: '38px', fontSize: '15px',
                        background: user?.profilePicture ? 'transparent' : (user?.avatarColor || 'var(--primary-accent)'),
                        color: 'white', overflow: 'hidden', flexShrink: 0
                      }}
                    >
                      {avatarContent}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{user?.userId}</div>
                    </div>
                  </div>

                  {/* Edit Profile */}
                  <button
                    onClick={() => { setShowProfileMenu(false); setShowEditProfile(true); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '11px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--text-primary)', fontSize: '14px',
                      textAlign: 'left', transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-fill)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <Edit2 size={15} style={{ color: 'var(--primary-accent)' }} />
                    Edit Profile
                  </button>

                  {/* Log Out */}
                  <button
                    onClick={() => { setShowProfileMenu(false); logout(); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '11px 16px', background: 'none', border: 'none',
                      cursor: 'pointer', color: 'var(--danger)', fontSize: '14px',
                      textAlign: 'left', borderTop: '0.5px solid var(--border-color)',
                      transition: 'background 0.1s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-fill)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    <LogOut size={15} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* Dashboard Content */}
        <main style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

          {/* Greeting */}
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 500, marginBottom: '6px' }}>Hello, {user?.name || 'User'}!</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Welcome to V Connect — Start, join, or schedule collaboration rooms.</p>
          </div>

          {/* User ID Card */}
          <div style={{ background: 'var(--soft-fill)', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', border: '0.5px solid var(--border-color)' }}>
            <div style={{ background: 'var(--primary-accent)', borderRadius: '10px', padding: '10px', color: 'white' }}>
              <IdCard size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>Your Unique User ID — share this so friends can find & message you</p>
              <span style={{ fontFamily: 'monospace', fontSize: '20px', fontWeight: 700, color: 'var(--primary-accent)', letterSpacing: '0.05em' }}>{user?.userId}</span>
            </div>
            <button onClick={handleCopyUserId} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              {copiedUserId ? <Check size={18} style={{ color: 'var(--success)' }} /> : <Copy size={18} />}
            </button>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', color: 'var(--text-secondary)' }}>Quick Actions</h2>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
              <button className="btn btn-primary" style={{ height: '100px', flexDirection: 'column', borderRadius: '12px' }} onClick={handleStartInstantMeeting}>
                <Plus size={24} /><span style={{ fontSize: '14px', marginTop: '8px' }}>New Meeting</span>
              </button>
              <button className="btn btn-secondary" style={{ height: '100px', flexDirection: 'column', borderRadius: '12px' }} onClick={() => setShowJoinModal(true)}>
                <Video size={24} /><span style={{ fontSize: '14px', marginTop: '8px' }}>Join Meeting</span>
              </button>
              <button className="btn btn-outline" style={{ height: '100px', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)' }} onClick={() => navigate('/scheduler')}>
                <Calendar size={24} /><span style={{ fontSize: '14px', marginTop: '8px' }}>Schedule Meeting</span>
              </button>
              <button className="btn btn-outline" style={{ height: '100px', flexDirection: 'column', borderRadius: '12px', border: '1px solid var(--border-color)' }} onClick={() => setShowShareFileModal(true)}>
                <Upload size={24} /><span style={{ fontSize: '14px', marginTop: '8px' }}>Share File</span>
              </button>
            </div>
          </div>

          {/* Bottom Grid */}
          <div className="grid" style={{ gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'start' }}>
            {/* Upcoming Meetings */}
            <div className="card">
              <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '20px' }}>Upcoming Meetings</h3>
              {loading ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
              ) : filteredMeetings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0' }}>
                  <VideoOff size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>No scheduled meetings found.</p>
                  <button className="btn btn-primary" onClick={() => navigate('/scheduler')}>Schedule one now</button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filteredMeetings.map((meet) => (
                    <div key={meet.id} className="flex justify-between items-center" style={{ padding: '16px', border: '0.5px solid var(--border-color)', borderRadius: '10px', background: 'var(--bg-base)' }}>
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px' }}>{meet.title}</h4>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', gap: '10px' }}>
                          <span>{formatMeetingDate(meet.dateTime)}</span>
                          <span>•</span>
                          <span>{meet.duration} mins</span>
                          <span>•</span>
                          <span className="mono" style={{ background: 'var(--soft-fill)', color: 'var(--active-state)', padding: '0px 6px', borderRadius: '4px', fontSize: '11px' }}>ID: {meet.id}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleCopyLink(meet.id)} className="btn btn-outline" style={{ padding: '8px 12px', fontSize: '12px' }}>
                          {copiedId === meet.id ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                        </button>
                        <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={() => navigate(`/room/${meet.id}`)}>
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Files */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 500 }}>My Files</h3>
                <button className="btn btn-outline" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => setShowFilesModal(true)}>View All</button>
              </div>
              <div className="flex flex-col gap-3">
                {myFiles.slice(0, 5).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                    <Folder size={28} style={{ marginBottom: '8px', opacity: 0.4 }} />
                    <p style={{ fontSize: '13px' }}>No files yet.</p>
                  </div>
                ) : myFiles.slice(0, 5).map((file) => (
                  <div key={file.id} className="flex items-center gap-3" style={{ padding: '10px', border: '0.5px solid var(--border-color)', borderRadius: '10px' }}>
                    <div style={{ background: 'var(--soft-fill)', padding: '7px', borderRadius: '8px', color: 'var(--active-state)' }}>
                      <FileText size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {file.uploaderId === user.id ? `Sent to ${file.receiverId ? '...' : 'room'}` : `From ${file.uploaderName}`} • {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── Meeting Invite Notification ── */}
      {pendingInvite && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', background: 'var(--bg-panel)', border: '1px solid var(--primary-accent)', borderRadius: '16px', padding: '20px', width: '320px', boxShadow: '0 8px 30px rgba(83,74,183,0.2)', zIndex: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: 'var(--soft-fill)', borderRadius: '8px', padding: '8px', color: 'var(--primary-accent)' }}>
                <Video size={18} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>Meeting Invite</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>from {pendingInvite.hostName}</div>
              </div>
            </div>
            <button onClick={clearPendingInvite} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={16} /></button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            You've been invited to join <strong>{pendingInvite.meetingTitle}</strong>
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline" style={{ flex: 1, fontSize: '13px' }} onClick={clearPendingInvite}>Decline</button>
            <button className="btn btn-primary" style={{ flex: 1, fontSize: '13px' }} onClick={() => { navigate(`/room/${pendingInvite.roomId}`); clearPendingInvite(); }}>
              Join Meeting
            </button>
          </div>
        </div>
      )}

      {/* ── Join Meeting Modal ── */}
      {showJoinModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>Join a Meeting</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>Enter the room ID to join.</p>
            <form onSubmit={handleJoinMeetingSubmit}>
              <div className="form-group">
                <label className="form-label">Meeting Room ID</label>
                <input type="text" className="form-input" placeholder="e.g. 3a7f8e12" value={joinRoomId} onChange={(e) => setJoinRoomId(e.target.value)} autoFocus required />
              </div>
              <div className="flex justify-between" style={{ marginTop: '24px' }}>
                <button type="button" className="btn btn-outline" onClick={() => { setShowJoinModal(false); setJoinRoomId(''); }}>Cancel</button>
                <button type="submit" className="btn btn-primary">Join Room</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Files Modal ── */}
      {showFilesModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '0.5px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 500 }}>My Files</h3>
              <button className="btn btn-outline btn-icon" onClick={() => setShowFilesModal(false)} style={{ width: '28px', height: '28px' }}>✕</button>
            </div>
            <input type="text" className="form-input" placeholder="Search files..." value={fileSearchQuery} onChange={(e) => setFileSearchQuery(e.target.value)} style={{ marginBottom: '12px' }} />
            <div style={{ flex: 1, overflowY: 'auto' }} className="flex flex-col gap-3">
              {filteredFiles.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Folder size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <p>No files found.</p>
                </div>
              ) : filteredFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3" style={{ padding: '12px', border: '0.5px solid var(--border-color)', borderRadius: '10px' }}>
                  <div style={{ background: 'var(--soft-fill)', padding: '8px', borderRadius: '8px', color: 'var(--active-state)' }}><FileText size={18} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.originalName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {file.uploaderId === user.id ? 'Sent by you' : `From ${file.uploaderName}`} • {formatFileSize(file.size)}
                    </div>
                  </div>
                  {file.path && (
                    <a href={`http://localhost:5000${file.path}`} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Download</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Share File Modal ── */}
      {showShareFileModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 500 }}>Share a File</h3>
              <button className="btn btn-outline btn-icon" onClick={() => { setShowShareFileModal(false); setShareFile(null); setShareFoundUser(null); setShareReceiverInput(''); }} style={{ width: '28px', height: '28px' }}>✕</button>
            </div>

            {shareSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Check size={40} style={{ color: 'var(--success)', marginBottom: '12px' }} />
                <p style={{ fontWeight: 500 }}>File shared successfully!</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>They'll see it in their Files and Chat when they next open the app.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Share a file to any user by their ID. Files are delivered immediately — or waiting for them when they come online.
                </p>

                <div className="form-group">
                  <label className="form-label">Recipient's User ID</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. VC-A3X9K2PL"
                      value={shareReceiverInput}
                      onChange={(e) => setShareReceiverInput(e.target.value.toUpperCase())}
                      style={{ fontFamily: 'monospace' }}
                    />
                    <button className="btn btn-outline" style={{ padding: '8px 12px', whiteSpace: 'nowrap' }} onClick={handleShareFileSearch}>
                      <Search size={14} />
                    </button>
                  </div>
                  {shareSearchError && <p style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '6px' }}>{shareSearchError}</p>}
                </div>

                {shareFoundUser && (
                  <div style={{ background: 'var(--soft-fill)', borderRadius: '10px', padding: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div className="avatar" style={{ background: shareFoundUser.avatarColor, color: 'white', width: '32px', height: '32px', fontSize: '13px' }}>{shareFoundUser.name[0]}</div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 500 }}>{shareFoundUser.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{shareFoundUser.userId}</div>
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">File to Share</label>
                  <div
                    style={{ border: '1.5px dashed var(--border-color)', borderRadius: '10px', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-base)' }}
                    onClick={() => fileShareInputRef.current?.click()}
                  >
                    {shareFile ? (
                      <div>
                        <FileText size={24} style={{ color: 'var(--active-state)', marginBottom: '4px' }} />
                        <p style={{ fontSize: '13px', fontWeight: 500 }}>{shareFile.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatFileSize(shareFile.size)}</p>
                      </div>
                    ) : (
                      <div>
                        <Upload size={24} style={{ color: 'var(--text-muted)', marginBottom: '4px' }} />
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Click to pick a file</p>
                      </div>
                    )}
                  </div>
                  <input type="file" ref={fileShareInputRef} onChange={(e) => setShareFile(e.target.files[0])} style={{ display: 'none' }} />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowShareFileModal(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleShareFileSubmit}
                    disabled={!shareFile || !shareFoundUser || shareLoading}
                  >
                    {shareLoading ? 'Sharing...' : 'Share File'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Edit Profile Modal ── */}
      {showEditProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
          <div className="card" style={{ width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Edit Profile</h3>
              <button className="btn btn-outline btn-icon" onClick={() => setShowEditProfile(false)} style={{ width: '28px', height: '28px' }}><X size={14} /></button>
            </div>

            {/* Profile picture */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div
                style={{
                  width: '88px', height: '88px', borderRadius: '50%', overflow: 'hidden',
                  background: editPicture ? 'transparent' : (user?.avatarColor || 'var(--primary-accent)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '32px', fontWeight: 600,
                  border: '3px solid var(--border-color)', position: 'relative', cursor: 'pointer'
                }}
                onClick={() => pictureInputRef.current?.click()}
                title="Click to change picture"
              >
                {editPicture
                  ? <img src={editPicture} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (user?.name?.[0]?.toUpperCase() || 'U')
                }
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  opacity: 0, transition: 'opacity 0.15s', borderRadius: '50%'
                }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1}
                  onMouseLeave={e => e.currentTarget.style.opacity = 0}
                >
                  <Camera size={22} color="white" />
                </div>
              </div>
              <button
                onClick={() => pictureInputRef.current?.click()}
                style={{ marginTop: '10px', background: 'none', border: 'none', color: 'var(--primary-accent)', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Camera size={13} /> Change Photo
              </button>
              {editPicture && (
                <button
                  onClick={() => { setEditPicture(null); setEditPictureFile(null); }}
                  style={{ marginTop: '4px', background: 'none', border: 'none', color: 'var(--danger)', fontSize: '12px', cursor: 'pointer' }}
                >
                  Remove Photo
                </button>
              )}
              <input type="file" accept="image/*" ref={pictureInputRef} onChange={handlePictureChange} style={{ display: 'none' }} />
            </div>

            {/* Name */}
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={13} /> Display Name
              </label>
              <input
                type="text"
                className="form-input"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Divider */}
            <div style={{ borderTop: '0.5px solid var(--border-color)', margin: '20px 0' }} />

            {/* Password section */}
            <div style={{ marginBottom: '4px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Lock size={13} /> Change Password <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(leave blank to keep current)</span>
              </p>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Current Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={editCurrentPwd}
                  onChange={e => setEditCurrentPwd(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </div>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={editNewPwd}
                  onChange={e => setEditNewPwd(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={editConfirmPwd}
                  onChange={e => setEditConfirmPwd(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Status messages */}
            {editError && (
              <div style={{ background: 'rgba(226,75,74,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '10px 14px', marginTop: '16px', color: 'var(--danger)', fontSize: '13px' }}>
                {editError}
              </div>
            )}
            {editSuccess && (
              <div style={{ background: 'rgba(29,158,117,0.1)', border: '1px solid var(--success)', borderRadius: '8px', padding: '10px 14px', marginTop: '16px', color: 'var(--success)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} /> {editSuccess}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowEditProfile(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={handleSaveProfile}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ── */}
      {showSettingsModal && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 300
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSettingsModal(false); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Settings size={18} style={{ color: 'var(--primary-accent)' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Settings</h3>
              </div>
              <button
                className="btn btn-outline btn-icon"
                onClick={() => setShowSettingsModal(false)}
                style={{ width: '28px', height: '28px' }}
              >
                <X size={14} />
              </button>
            </div>

            {/* ── Appearance Section ── */}
            <div style={{ marginBottom: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Appearance
              </p>

              {/* Theme toggle row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px', borderRadius: '10px',
                border: '0.5px solid var(--border-color)',
                background: 'var(--bg-base)', marginBottom: '10px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'var(--soft-fill)', borderRadius: '8px', padding: '8px', color: 'var(--primary-accent)' }}>
                    {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {theme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme'}
                    </div>
                  </div>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={toggleTheme}
                  style={{
                    width: '48px', height: '26px', borderRadius: '13px', border: 'none',
                    background: theme === 'dark' ? 'var(--primary-accent)' : 'var(--border-color)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.25s', flexShrink: 0
                  }}
                  title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  <span style={{
                    position: 'absolute', top: '3px',
                    left: theme === 'dark' ? '25px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                    transition: 'left 0.25s'
                  }} />
                </button>
              </div>

              {/* Quick-switch buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { const { setTheme } = useAppStore.getState(); setTheme('light'); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    border: `1.5px solid ${theme === 'light' ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                    background: theme === 'light' ? 'var(--soft-fill)' : 'var(--bg-base)',
                    color: theme === 'light' ? 'var(--primary-accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Sun size={14} /> Light
                </button>
                <button
                  onClick={() => { const { setTheme } = useAppStore.getState(); setTheme('dark'); }}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    padding: '10px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
                    border: `1.5px solid ${theme === 'dark' ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                    background: theme === 'dark' ? 'var(--soft-fill)' : 'var(--bg-base)',
                    color: theme === 'dark' ? 'var(--primary-accent)' : 'var(--text-secondary)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Moon size={14} /> Dark
                </button>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '0.5px solid var(--border-color)', margin: '20px 0' }} />

            {/* ── Account Section ── */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>
                Account
              </p>

              {/* User info row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '14px 16px', borderRadius: '10px',
                border: '0.5px solid var(--border-color)',
                background: 'var(--bg-base)', marginBottom: '10px'
              }}>
                <div
                  className="avatar"
                  style={{
                    width: '40px', height: '40px', fontSize: '16px', flexShrink: 0,
                    background: user?.profilePicture ? 'transparent' : (user?.avatarColor || 'var(--primary-accent)'),
                    color: 'white', overflow: 'hidden'
                  }}
                >
                  {user?.profilePicture
                    ? <img src={user.profilePicture} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    : (user?.name?.[0]?.toUpperCase() || 'U')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{user?.userId}</div>
                </div>
              </div>

              {/* Edit Profile shortcut */}
              <button
                onClick={() => { setShowSettingsModal(false); setShowEditProfile(true); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
                  border: '0.5px solid var(--border-color)', background: 'var(--bg-base)',
                  color: 'var(--text-primary)', marginBottom: '10px', transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--soft-fill)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-base)'}
              >
                <div style={{ background: 'var(--soft-fill)', borderRadius: '8px', padding: '8px', color: 'var(--primary-accent)' }}>
                  <Edit2 size={15} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 500 }}>Edit Profile</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Change name, photo, or password</div>
                </div>
              </button>

              {/* Logout */}
              <button
                onClick={() => { setShowSettingsModal(false); logout(); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
                  border: '0.5px solid var(--danger)', background: 'rgba(226,75,74,0.06)',
                  color: 'var(--danger)', transition: 'background 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(226,75,74,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(226,75,74,0.06)'}
              >
                <div style={{ background: 'rgba(226,75,74,0.12)', borderRadius: '8px', padding: '8px' }}>
                  <LogOut size={15} style={{ color: 'var(--danger)' }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 500 }}>Log Out</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', color: 'rgba(226,75,74,0.7)' }}>Sign out of your account</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
