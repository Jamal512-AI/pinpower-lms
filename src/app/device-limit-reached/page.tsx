'use client';

import { useRouter } from 'next/navigation';

export default function DeviceLimitPage() {
  const router = useRouter();

  return (
    <div className="status-page">
      <div className="status-card">
        <div className="status-icon">🚫</div>
        <h1 className="status-title" style={{ color: 'var(--error)' }}>Device Limit Reached</h1>
        <p className="status-message">
          Your account is already registered on <strong>2 devices</strong> — the maximum allowed.
          For security reasons, no additional devices can be added.
        </p>
        <div className="alert alert-error" style={{ textAlign: 'left', marginBottom: 24 }}>
          ⚠️ If you believe this is an error, please contact the admin team at{' '}
          <strong>david5127214@gmail.com</strong>.
        </div>
        <button
          id="back-to-login-btn"
          className="btn btn-primary btn-full"
          onClick={() => router.push('/login')}
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
