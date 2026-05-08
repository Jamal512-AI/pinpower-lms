'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      if (!data.user) throw new Error('Login failed');

      // Strictly verify admin role
      const { data: profile } = await supabase
        .from('users_extended')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (!profile || profile.role !== 'admin') {
        await supabase.auth.signOut();
        setError('Access denied. This portal is for administrators only.');
        setLoading(false);
        return;
      }

      router.push('/admin');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1D4B73 100%)' }}>
      <div className="auth-card" style={{ borderTop: '4px solid var(--accent)', position: 'relative', overflow: 'hidden' }}>
        {/* Admin watermark */}
        <div style={{
          position: 'absolute', top: 0, right: 0, background: 'var(--accent)',
          color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 12px',
          borderBottomLeftRadius: 8, letterSpacing: 1, textTransform: 'uppercase'
        }}>
          Admin Portal
        </div>

        <div className="auth-logo">
          <img src="/logo.png" alt="Pin Power Logo" style={{ width: 140, height: 'auto', objectFit: 'contain' }} />
        </div>

        <h2 className="auth-title" style={{ color: '#0f172a' }}>Admin Sign In</h2>
        <p className="auth-subtitle">Restricted access — authorized personnel only</p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: 16 }}>
            🚫 {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleAdminLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-email">Admin Email</label>
            <input
              id="admin-email"
              type="email"
              className="form-input"
              placeholder="admin@viralpinpower.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              className="form-input"
              placeholder="Enter admin password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            id="admin-login-btn"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
          >
            {loading ? <><span className="loader" />Authenticating…</> : '🛡️ Sign in as Admin'}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>
          Are you a student?{' '}
          <a href="/login" style={{ color: 'var(--accent)', fontWeight: 600 }}>Go to Student Login →</a>
        </div>
      </div>
    </div>
  );
}
