'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function WaitingRoomPage() {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="status-page">
      <div className="status-card">
        <div className="status-icon">⏳</div>
        <h1 className="status-title">Review in Progress</h1>
        <p className="status-message">
          Your account is currently being verified by the admin team.
          You will receive access once approved. This usually takes 24–48 hours.
        </p>
        <div className="alert alert-info" style={{ textAlign: 'left', marginBottom: 24 }}>
          📧 Our admin team has been notified of your registration. Please be patient while we verify your purchase.
        </div>
        <button id="logout-waiting-btn" className="btn btn-ghost btn-full" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    </div>
  );
}
