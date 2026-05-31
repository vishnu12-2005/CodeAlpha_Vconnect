import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { LogIn, UserPlus, AlertCircle, Copy, Check, IdCard } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [newUserId, setNewUserId] = useState(null); // shown after signup
  const [copiedId, setCopiedId] = useState(false);

  const { loginUser, registerUser, googleLogin, isAuthenticated, authLoading, authError, user } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !newUserId) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, newUserId, navigate]);

  useEffect(() => {
    if (authError) setErrorMsg(authError);
  }, [authError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setNewUserId(null);

    if (!email || !password || (!isLogin && !name)) {
      setErrorMsg('Please fill in all fields.');
      return;
    }

    let success;
    if (isLogin) {
      success = await loginUser(email, password);
      if (success) navigate('/dashboard');
    } else {
      success = await registerUser(name, email, password);
      if (success) {
        // Show the new unique user ID before redirecting
        const store = useAppStore.getState();
        setNewUserId(store.user?.userId);
      }
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    const mockGoogleProfile = {
      name: 'Google User',
      email: 'user.google@gmail.com',
      googleId: 'g_' + Math.random().toString(36).substr(2, 9)
    };
    const success = await googleLogin(mockGoogleProfile.name, mockGoogleProfile.email, mockGoogleProfile.googleId);
    if (success) navigate('/dashboard');
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(newUserId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // ── Post-signup screen: show unique ID ─────────────────────────────────────
  if (newUserId) {
    return (
      <div className="flex flex-col bg-pattern" style={{ minHeight: '100vh', padding: '24px', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--soft-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <IdCard size={32} style={{ color: 'var(--primary-accent)' }} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '8px' }}>Welcome to V Connect! 🎉</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '24px' }}>
            Your account has been created. Share your unique <strong>User ID</strong> so friends can find and message you.
          </p>

          <div style={{ background: 'var(--soft-fill)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Your Unique User ID</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '26px', fontWeight: 700, color: 'var(--primary-accent)', letterSpacing: '0.08em' }}>{newUserId}</span>
              <button onClick={handleCopyId} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px' }}>
                {copiedId ? <Check size={18} style={{ color: 'var(--success)' }} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            You can always find your ID again in your profile settings.
          </p>

          <button className="btn btn-primary" style={{ width: '100%', padding: '12px' }} onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-pattern" style={{ minHeight: '100vh', padding: '24px' }}>
      <header style={{ marginBottom: '40px' }}>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--primary-accent)', fontSize: '24px' }}>
          V Connect
        </h1>
      </header>

      <main className="flex-1 flex items-center justify-center">
        <div className="card" style={{ width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(83, 74, 183, 0.04)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '8px', textAlign: 'center' }}>
            {isLogin ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center' }}>
            {isLogin ? 'Connect, collaborate, and create in real-time.' : 'Join V Connect and get your unique User ID.'}
          </p>

          {errorMsg && (
            <div className="flex items-center gap-2" style={{ background: '#FDEEEE', color: 'var(--danger)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group">
                <label className="form-label" htmlFor="name">Full Name</label>
                <input id="name" type="text" className="form-input" placeholder="Alex Rivers" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input id="email" type="email" className="form-input" placeholder="alex@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input id="password" type="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '8px' }} disabled={authLoading}>
              {authLoading ? 'Please wait...' : isLogin ? (
                <><LogIn size={16} /><span>Sign In</span></>
              ) : (
                <><UserPlus size={16} /><span>Sign Up & Get My ID</span></>
              )}
            </button>
          </form>

          <div style={{ margin: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border-color)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border-color)' }} />
          </div>

          <button onClick={handleGoogleLogin} className="btn btn-outline" style={{ width: '100%', padding: '12px' }}>
            <svg viewBox="0 0 24 24" width="16" height="16" style={{ marginRight: '8px' }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <p style={{ marginTop: '24px', fontSize: '13px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setErrorMsg(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
