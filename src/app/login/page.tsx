'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

type RoleTab = 'student' | 'admin';
type View = 'login' | 'signup';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [roleTab, setRoleTab] = useState<RoleTab>('student');
  const [view, setView] = useState<View>('login');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Signup state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!data.user) throw new Error('Login failed');

      const { data: profile } = await supabase
        .from('users_extended')
        .select('role, access_status')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        setError('Profile not found. Contact support.');
        setLoading(false);
        return;
      }

      // Role check based on tab
      if (roleTab === 'admin' && profile.role !== 'admin') {
        await supabase.auth.signOut();
        setError('You do not have admin privileges.');
        setLoading(false);
        return;
      }

      if (profile.role === 'admin') {
        window.location.href = '/admin';
        return;
      }

      // Student device check
      const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const fingerprint = result.visitorId;

      const res = await fetch('/api/device-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id, fingerprint }),
      });
      const deviceData = await res.json();

      if (deviceData.blocked) {
        await supabase.auth.signOut();
        router.push('/device-limit-reached');
        return;
      }

      if (profile.access_status === 'pending') { window.location.href = '/waiting-room'; return; }
      window.location.href = '/dashboard';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setSignupLoading(true);
    setSignupError('');

    try {
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail, password: signupPassword, fullName: signupName }),
      });
      const signupData = await signupRes.json();
      if (!signupRes.ok) throw new Error(signupData.error || 'Signup failed');

      await fetch('/api/notify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: signupEmail }),
      });

      setSignupSuccess(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Signup failed. Try again.';
      setSignupError(message);
    } finally {
      setSignupLoading(false);
    }
  }

  // ── Success screen ──────────────────────────────────────────
  if (signupSuccess) {
    return (
      <div className="lp-bg">
        <Orbs />
        <div className="lp-card">
          <div className="lp-success-icon">🎉</div>
          <h2 className="lp-success-title">You&apos;re on the list!</h2>
          <p className="lp-success-sub">
            Your account is under review. We&apos;ll notify you once an admin approves your access.
          </p>
          <div className="lp-info-box">
            📧 Admin has been notified. Approval usually takes <strong>24–48 hours</strong>.
          </div>
          <button
            className="lp-btn lp-btn-outline"
            style={{ marginTop: 24 }}
            onClick={() => { setSignupSuccess(false); setView('login'); }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-bg">
      <Orbs />

      <div className="lp-card">
        {/* Logo */}
        <div className="lp-logo">
          <img src="/logo.png" alt="Pin Power" className="lp-logo-img" />
          <div className="lp-logo-wordmark">
            Pin <span>Power</span>
          </div>
          <p className="lp-logo-tagline">Sign in to access your Digital Dynasty courses</p>
        </div>

        {view === 'login' && (
          <>
            {/* Role Tabs */}
            <div className="lp-tabs">
              <button
                type="button"
                className={`lp-tab ${roleTab === 'student' ? 'active' : ''}`}
                onClick={() => { setRoleTab('student'); setError(''); }}
              >
                🎓 Student
              </button>
              <button
                type="button"
                className={`lp-tab ${roleTab === 'admin' ? 'active' : ''}`}
                onClick={() => { setRoleTab('admin'); setError(''); }}
              >
                🛡️ Admin
              </button>
            </div>

            {/* ── LOGIN FORM ── */}
            <form className="lp-form" onSubmit={handleLogin}>
              {error && (
                <div className="lp-alert lp-alert-error">
                  <span>⚠️</span> {error}
                </div>
              )}

              <div className="lp-field">
                <label className="lp-label" htmlFor="login-email" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Email Address</label>
                <div className="lp-input-wrap">
                  <input
                    id="login-email"
                    type="email"
                    className="lp-input"
                    style={{ paddingLeft: '16px' }}
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="login-password" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Password</label>
                <div className="lp-input-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="lp-input"
                    style={{ paddingLeft: '16px' }}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    tabIndex={-1}
                    onClick={() => setShowPassword(v => !v)}
                    aria-label="Toggle password"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button
                id="login-btn"
                type="submit"
                className="lp-btn"
                style={{ background: 'var(--accent)', color: 'white', marginTop: '16px', boxShadow: '0 4px 12px rgba(255,42,85,0.3)' }}
                disabled={loading}
              >
                {loading ? <><span className="lp-spinner" /> Signing in…</> : `Sign in as ${roleTab === 'student' ? 'Student' : 'Admin'}`}
              </button>
            </form>

            {roleTab === 'student' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0', color: 'var(--border)' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <span style={{ padding: '0 12px', fontSize: '12px', color: 'var(--text-muted)' }}>or</span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>

                <button
                  type="button"
                  className="lp-btn lp-btn-outline"
                  style={{ width: '100%', borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
                  onClick={() => setView('signup')}
                >
                  Create a new student account
                </button>
              </>
            )}
          </>
        )}

        {view === 'signup' && (
          <>
            {/* ── SIGNUP FORM ── */}
            <form className="lp-form" onSubmit={handleSignup}>
              <h3 style={{ textAlign: 'center', marginBottom: '8px', color: 'var(--brand-blue-dark)' }}>Create Student Account</h3>
              
              {signupError && (
                <div className="lp-alert lp-alert-error">
                  <span>⚠️</span> {signupError}
                </div>
              )}

              <div className="lp-field">
                <label className="lp-label" htmlFor="signup-name" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Full Name</label>
                <div className="lp-input-wrap">
                  <input
                    id="signup-name"
                    type="text"
                    className="lp-input"
                    style={{ paddingLeft: '16px' }}
                    placeholder="Your full name"
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="signup-email" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Email Address</label>
                <div className="lp-input-wrap">
                  <input
                    id="signup-email"
                    type="email"
                    className="lp-input"
                    style={{ paddingLeft: '16px' }}
                    placeholder="you@example.com"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="lp-field">
                <label className="lp-label" htmlFor="signup-password" style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Password</label>
                <div className="lp-input-wrap">
                  <input
                    id="signup-password"
                    type={showSignupPassword ? 'text' : 'password'}
                    className="lp-input"
                    style={{ paddingLeft: '16px' }}
                    placeholder="Minimum 8 characters"
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="lp-eye-btn"
                    tabIndex={-1}
                    onClick={() => setShowSignupPassword(v => !v)}
                    aria-label="Toggle password"
                  >
                    {showSignupPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="lp-info-box" style={{ fontSize: 13, marginTop: -4 }}>
                🛡️ Admin approval required before you can access courses.
              </div>

              <button
                id="signup-btn"
                type="submit"
                className="lp-btn"
                style={{ background: 'var(--accent)', color: 'white', marginTop: '8px', boxShadow: '0 4px 12px rgba(255,42,85,0.3)' }}
                disabled={signupLoading}
              >
                {signupLoading ? <><span className="lp-spinner" /> Creating Account…</> : 'Create Account'}
              </button>
              
              <button
                type="button"
                className="lp-btn lp-btn-outline"
                style={{ width: '100%', borderColor: 'transparent', color: 'var(--text-secondary)', marginTop: '0' }}
                onClick={() => setView('login')}
              >
                ← Back to Sign In
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Orbs() {
  return (
    <>
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />
    </>
  );
}
