'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

type Tab = 'student' | 'admin';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Signup state
  const [showSignup, setShowSignup] = useState(false);
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

      // FingerprintJS device check
      const FingerprintJS = (await import('@fingerprintjs/fingerprintjs')).default;
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      const fingerprint = result.visitorId;

      // Call device check API
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

      // Check role/status
      const { data: profile } = await supabase
        .from('users_extended')
        .select('role, access_status')
        .eq('id', data.user.id)
        .single();

      if (!profile) { setError('Profile not found. Contact admin.'); setLoading(false); return; }
      if (tab === 'admin' && profile.role !== 'admin') {
        await supabase.auth.signOut();
        setError('This account does not have admin access.');
        setLoading(false);
        return;
      }
      if (profile.role === 'admin') { router.push('/admin'); return; }
      if (profile.access_status === 'pending') { router.push('/waiting-room'); return; }
      router.push('/dashboard');
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
      // Use our server-side API to create user (avoids "Error sending confirmation email")
      const signupRes = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: signupEmail, 
          password: signupPassword, 
          fullName: signupName 
        }),
      });
      
      const signupData = await signupRes.json();
      if (!signupRes.ok) throw new Error(signupData.error || 'Signup failed');

      // Notify admin
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

  if (signupSuccess) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <Image src="/logo.png" alt="Pin Power Logo" width={140} height={56} style={{ objectFit: 'contain' }} />
          </div>
          <div className="status-icon" style={{ textAlign: 'center' }}>🎉</div>
          <h2 className="auth-title">Registration Submitted!</h2>
          <p className="auth-subtitle" style={{ marginBottom: 24 }}>
            Your account is under review. You will be able to login once an admin approves your access.
            Check back soon!
          </p>
          <div className="alert alert-info">
            📧 We've notified our admin team. Approval usually takes 24–48 hours.
          </div>
          <button
            className="btn btn-outline btn-full"
            style={{ marginTop: 20 }}
            onClick={() => { setSignupSuccess(false); setShowSignup(false); }}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (showSignup) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">
            <Image src="/logo.png" alt="Pin Power Logo" width={140} height={56} style={{ objectFit: 'contain' }} />
            <span className="auth-logo-text">Pin <span>Power</span></span>
          </div>
          <h2 className="auth-title">Create Student Account</h2>
          <p className="auth-subtitle">Join Digital Dynasty. Admin approval required.</p>

          {signupError && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {signupError}</div>}

          <form className="auth-form" onSubmit={handleSignup}>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-name">Full Name</label>
              <input
                id="signup-name"
                type="text"
                className="form-input"
                placeholder="Your full name"
                value={signupName}
                onChange={e => setSignupName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-email">Email Address</label>
              <input
                id="signup-email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="signup-password">Password</label>
              <input
                id="signup-password"
                type="password"
                className="form-input"
                placeholder="Minimum 8 characters"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={signupLoading}>
              {signupLoading ? <><span className="loader"></span> Creating Account…</> : 'Create Account'}
            </button>
          </form>
          <div className="auth-footer">
            Already have an account?{' '}
            <a href="#" onClick={e => { e.preventDefault(); setShowSignup(false); }}>Sign in</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.png" alt="Pin Power Logo" width={140} height={56} style={{ objectFit: 'contain' }} />
          <span className="auth-logo-text">Pin <span>Power</span></span>
        </div>
        <p className="auth-subtitle">Sign in to access your Digital Dynasty courses</p>

        {/* Role Toggle */}
        <div className="auth-tabs">
          <button
            id="tab-student"
            className={`auth-tab ${tab === 'student' ? 'active' : ''}`}
            onClick={() => { setTab('student'); setError(''); }}
          >
            🎓 Student
          </button>
          <button
            id="tab-admin"
            className={`auth-tab ${tab === 'admin' ? 'active' : ''}`}
            onClick={() => { setTab('admin'); setError(''); }}
          >
            🛡️ Admin
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>⚠️ {error}</div>}

        <form className="auth-form" onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              {tab === 'admin' ? 'Admin Email' : 'Email Address'}
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder={tab === 'admin' ? 'admin@digitaldynasty.com' : 'you@example.com'}
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" id="login-btn" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <><span className="loader"></span> Signing in…</> : `Sign in as ${tab === 'admin' ? 'Admin' : 'Student'}`}
          </button>
        </form>

        {tab === 'student' && (
          <>
            <div className="auth-divider">or</div>
            <button
              id="signup-btn"
              className="btn btn-ghost btn-full"
              onClick={() => setShowSignup(true)}
            >
              Create a new student account
            </button>
          </>
        )}
      </div>
    </div>
  );
}
