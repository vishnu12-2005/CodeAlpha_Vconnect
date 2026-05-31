import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { Calendar, Clock, Users, RefreshCw, Copy, Check, ChevronLeft, ArrowRight } from 'lucide-react';

export default function Scheduler() {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [duration, setDuration] = useState('30');
  const [inviteeInput, setInviteeInput] = useState('');
  const [invitees, setInvitees] = useState([]);
  const [recurrence, setRecurrence] = useState('once');
  const [loading, setLoading] = useState(false);
  const [scheduledMeeting, setScheduledMeeting] = useState(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const { token, isAuthenticated } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const handleAddInvitee = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const email = inviteeInput.trim().toLowerCase();
      // Basic email regex validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email && emailRegex.test(email) && !invitees.includes(email)) {
        setInvitees([...invitees, email]);
        setInviteeInput('');
      }
    }
  };

  const handleRemoveInvitee = (index) => {
    setInvitees(invitees.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!title || !dateTime) {
      setErrorMsg('Please enter a title and select a date/time.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/meetings/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          dateTime,
          duration: parseInt(duration),
          invitees,
          recurrence
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to schedule meeting.');
      }

      setScheduledMeeting(data);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!scheduledMeeting) return;
    const link = `http://localhost:5173/room/${scheduledMeeting.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col bg-pattern" style={{ minHeight: '100vh', padding: '24px' }}>
      
      {/* Top Navbar */}
      <header className="flex items-center gap-4" style={{ marginBottom: '32px' }}>
        <button className="btn btn-outline btn-icon" onClick={() => navigate('/dashboard')}>
          <ChevronLeft size={18} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: '20px' }}>
          Schedule a Meeting
        </h1>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center">
        <div className="card" style={{ width: '100%', maxWidth: '540px', boxShadow: '0 4px 20px rgba(83, 74, 183, 0.04)' }}>
          
          {!scheduledMeeting ? (
            <form onSubmit={handleSubmit}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '20px' }}>Meeting Details</h2>

              {errorMsg && (
                <div style={{ color: 'var(--danger)', background: '#FDEEEE', padding: '10px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
                  {errorMsg}
                </div>
              )}

              {/* Title */}
              <div className="form-group">
                <label className="form-label" htmlFor="meetTitle">Meeting Title</label>
                <input
                  id="meetTitle"
                  type="text"
                  className="form-input"
                  placeholder="V Connect Weekly Sync"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* Date & Time Picker + Duration */}
              <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="meetDateTime">Date & Time</label>
                  <input
                    id="meetDateTime"
                    type="datetime-local"
                    className="form-input"
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="meetDuration">Duration (Minutes)</label>
                  <select
                    id="meetDuration"
                    className="form-input"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  >
                    <option value="15">15 Minutes</option>
                    <option value="30">30 Minutes</option>
                    <option value="45">45 Minutes</option>
                    <option value="60">1 Hour</option>
                    <option value="90">1.5 Hours</option>
                    <option value="120">2 Hours</option>
                  </select>
                </div>
              </div>

              {/* Invite Participants (Tags) */}
              <div className="form-group">
                <label className="form-label" htmlFor="meetInvitees">Invite Participants (Type email and press Enter)</label>
                <input
                  id="meetInvitees"
                  type="text"
                  className="form-input"
                  placeholder="colleague@company.com"
                  value={inviteeInput}
                  onChange={(e) => setInviteeInput(e.target.value)}
                  onKeyDown={handleAddInvitee}
                />
                
                {invitees.length > 0 && (
                  <div className="flex" style={{ flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {invitees.map((email, idx) => (
                      <span 
                        key={idx} 
                        style={{ background: 'var(--soft-fill)', color: 'var(--active-state)', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {email}
                        <button 
                          type="button" 
                          onClick={() => handleRemoveInvitee(idx)} 
                          style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--active-state)', fontWeight: 'bold', fontSize: '10px' }}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Recurrence Toggle */}
              <div className="form-group" style={{ marginBottom: '28px' }}>
                <label className="form-label" htmlFor="meetRecurrence">Recurrence</label>
                <div className="flex gap-4">
                  {['once', 'daily', 'weekly'].map((option) => (
                    <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                      <input
                        type="radio"
                        name="recurrence"
                        value={option}
                        checked={recurrence === option}
                        onChange={(e) => setRecurrence(e.target.value)}
                        style={{ accentColor: 'var(--primary-accent)' }}
                      />
                      <span style={{ textTransform: 'capitalize' }}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex justify-between" style={{ marginTop: '32px' }}>
                <button type="button" className="btn btn-outline" onClick={() => navigate('/dashboard')}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px', color: 'var(--success)' }}>Meeting Scheduled!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
                Your meeting "{scheduledMeeting.title}" has been successfully scheduled.
              </p>

              {/* Link Box */}
              <div className="mono" style={{ background: 'var(--bg-base)', border: '0.5px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                <span style={{ color: 'var(--active-state)', fontSize: '13px', wordBreak: 'break-all' }}>
                  http://localhost:5173/room/{scheduledMeeting.id}
                </span>
                <button className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '12px' }} onClick={handleCopyLink}>
                  {copied ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex justify-center gap-4">
                <button className="btn btn-outline" onClick={() => navigate('/dashboard')}>
                  Go to Dashboard
                </button>
                <button className="btn btn-primary" onClick={() => navigate(`/room/${scheduledMeeting.id}`)}>
                  Join Room
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
