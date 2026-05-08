'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

type Module = {
  id: string;
  title: string;
  description: string;
  sort_order: number;
};

type ModuleVideo = {
  id: string;
  module_id: string;
  title: string;
  video_url: string;
  drive_email: string;
  sort_order: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [videos, setVideos] = useState<Record<string, ModuleVideo[]>>({});
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<ModuleVideo | null>(null);
  const [loadingModules, setLoadingModules] = useState(true);

  // Security
  const [isMounted, setIsMounted] = useState(false);
  const [recordingDetected, setRecordingDetected] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<ModuleVideo | null>(null);
  const [wmPos, setWmPos] = useState({ x: 15, y: 20 });
  const wmInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Query form
  const [queryText, setQueryText] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryMsg, setQueryMsg] = useState('');

  useEffect(() => {
    async function loadUser() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }

      const { data: profile } = await supabase
        .from('users_extended')
        .select('role, access_status')
        .eq('id', u.id)
        .single();

      if (!profile || profile.access_status !== 'approved') { router.push('/waiting-room'); return; }
      if (profile.role === 'admin') { router.push('/admin'); return; }
      setUser({ email: u.email!, id: u.id });
    }
    loadUser();
  }, []);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    async function loadModules() {
      const res = await fetch('/api/modules');
      const data = await res.json();
      const mods: Module[] = data.modules || [];
      setModules(mods);
      setLoadingModules(false);
      if (mods.length > 0) setActiveModule(mods[0].id);

      // Load all videos for all modules
      const allVideos: Record<string, ModuleVideo[]> = {};
      await Promise.all(mods.map(async (m) => {
        const r = await fetch(`/api/module-videos?moduleId=${m.id}`);
        const d = await r.json();
        allVideos[m.id] = d.videos || [];
      }));
      setVideos(allVideos);
    }
    loadModules();
  }, []);

  // ── Security Suite ──────────────────────────────────────────
  useEffect(() => {
    if (!isMounted) return;
    const md = navigator.mediaDevices;
    if (md) {
      const original = md.getDisplayMedia;
      md.getDisplayMedia = async function () {
        setRecordingDetected(true);
        throw new Error('Screen capture blocked by DRM policy');
      };
      return () => { md.getDisplayMedia = original; };
    }
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;
    function blockKeys(e: KeyboardEvent) {
      if (e.key === 'PrintScreen') { e.preventDefault(); setRecordingDetected(true); return; }
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) { e.preventDefault(); setRecordingDetected(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'I') { e.preventDefault(); return; }
      if (e.key === 'F12') { e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') { e.preventDefault(); return; }
    }
    document.addEventListener('keydown', blockKeys, true);
    return () => document.removeEventListener('keydown', blockKeys, true);
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted || !activeVideo) return;
    function blockContext(e: MouseEvent) { e.preventDefault(); }
    document.addEventListener('contextmenu', blockContext, true);
    return () => document.removeEventListener('contextmenu', blockContext, true);
  }, [isMounted, activeVideo]);

  // Watermark movement
  useEffect(() => {
    if (activeVideo && isMounted) {
      wmInterval.current = setInterval(() => {
        setWmPos({ x: Math.floor(Math.random() * 65) + 5, y: Math.floor(Math.random() * 65) + 5 });
      }, 4000);
    } else {
      if (wmInterval.current) clearInterval(wmInterval.current);
    }
    return () => { if (wmInterval.current) clearInterval(wmInterval.current); };
  }, [activeVideo, isMounted]);

  useEffect(() => {
    if (recordingDetected) {
      setActiveVideo(null);
    }
  }, [recordingDetected]);

  const dismissRecordingWarning = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
  }, [supabase, router]);

  function handleVideoSelect(video: ModuleVideo) {
    setPendingVideo(video);
    setShowWarning(true);
  }

  function confirmAndPlayVideo() {
    if (!pendingVideo) return;
    setShowWarning(false);
    setActiveVideo(pendingVideo);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  async function submitQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!queryText.trim() || !activeModule) return;
    setQueryLoading(true);
    setQueryMsg('');

    const mod = modules.find(m => m.id === activeModule);
    const res = await fetch('/api/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail: user?.email,
        moduleName: mod?.title || activeModule,
        query: queryText,
      }),
    });

    if (res.ok) {
      setQueryMsg('✅ Your question has been submitted! We\'ll get back to you soon.');
      setQueryText('');
    } else {
      setQueryMsg('⚠️ Failed to submit. Please try again.');
    }
    setQueryLoading(false);
    setTimeout(() => setQueryMsg(''), 5000);
  }

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';
  const activeModuleVideos = activeModule ? (videos[activeModule] || []) : [];
  const activeModuleData = modules.find(m => m.id === activeModule);

  // Convert Google Drive share link to embed URL
  function getDriveEmbedUrl(url: string): string {
    // Convert https://drive.google.com/file/d/FILE_ID/view to embed
    const match = url.match(/\/file\/d\/([^/]+)/);
    if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
    // If already an embed link or other format, return as-is
    return url;
  }

  return (
    <div className="dashboard-page">
      {/* Navbar */}
      <nav className="navbar">
        <a href="/dashboard" className="navbar-logo">
          <Image src="/logo.png" alt="Pin Power" width={120} height={40} style={{ objectFit: 'contain' }} />
        </a>
        <div className="navbar-actions">
          <div className="navbar-user">
            <div className="navbar-avatar">{avatarLetter}</div>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{user?.email}</span>
          </div>
          <a href="/chat" className="btn btn-sm" style={{ background: 'rgba(255,42,85,0.25)', color: '#fff', border: '1px solid rgba(255,42,85,0.5)', borderRadius: 8 }}>
            💬 Chat
          </a>
          <button id="dashboard-logout-btn" className="btn btn-sm btn-ghost" style={{ color: 'rgba(255,255,255,0.6)' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      <div className="course-layout">
        {/* ── Sidebar: Module List ── */}
        <aside className="course-sidebar">
          <div className="sidebar-header">
            <h2>📚 Course Modules</h2>
            <p>{modules.length} Modules</p>
          </div>
          <nav className="module-nav">
            {loadingModules ? (
              <div style={{ padding: '20px', color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
                <span className="loader" style={{ borderTopColor: '#FF2A55', borderColor: 'rgba(255,255,255,0.2)' }}></span>
              </div>
            ) : modules.length === 0 ? (
              <div style={{ padding: '20px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>
                No modules yet. Check back soon!
              </div>
            ) : modules.map((m, i) => (
              <button
                key={m.id}
                className={`module-nav-item ${activeModule === m.id ? 'active' : ''}`}
                onClick={() => { setActiveModule(m.id); setActiveVideo(null); }}
              >
                <span className="module-nav-num">M{i + 1}</span>
                <span className="module-nav-title">{m.title}</span>
                <span className="module-nav-count">{videos[m.id]?.length || 0} 🎬</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="course-main">
          {activeModuleData ? (
            <>
              {/* Module Header */}
              <div className="module-header">
                <div>
                  <div className="module-badge">Module {modules.findIndex(m => m.id === activeModule) + 1}</div>
                  <h1 className="module-title">{activeModuleData.title}</h1>
                  {activeModuleData.description && (
                    <p className="module-desc">{activeModuleData.description}</p>
                  )}
                </div>
                <div className="module-stats">
                  <div className="module-stat">
                    <span className="module-stat-val">{activeModuleVideos.length}</span>
                    <span className="module-stat-label">Videos</span>
                  </div>
                  <div className="module-stat">
                    <span className="module-stat-val">🔒</span>
                    <span className="module-stat-label">Protected</span>
                  </div>
                </div>
              </div>

              {/* Video Player */}
              {activeVideo ? (
                <div className="video-player-container">
                  <div className="video-player-header">
                    <span style={{ fontSize: 22 }}>🎬</span>
                    <h3>{activeVideo.title}</h3>
                    <button
                      className="btn btn-sm btn-ghost"
                      style={{ marginLeft: 'auto', fontSize: 12 }}
                      onClick={() => setActiveVideo(null)}
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="video-player-body">
                    <div className="video-player-frame" style={{ position: 'relative' }}>
                      <iframe
                        id="course-video-player"
                        src={getDriveEmbedUrl(activeVideo.video_url)}
                        allowFullScreen
                        allow="encrypted-media; autoplay"
                        title={activeVideo.title}
                        style={{ width: '100%', height: '100%', border: 'none' }}
                      />
                      {/* Floating Watermark */}
                      {isMounted && (
                        <div
                          style={{
                            position: 'absolute',
                            top: `${wmPos.y}%`,
                            left: `${wmPos.x}%`,
                            pointerEvents: 'none',
                            zIndex: 10,
                            transition: 'top 2s ease-in-out, left 2s ease-in-out',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                            color: 'rgba(255, 255, 255, 0.38)',
                            fontSize: 13,
                            fontWeight: 700,
                            letterSpacing: 1,
                            textShadow: '0 1px 8px rgba(0,0,0,0.9)',
                            fontFamily: 'monospace',
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: 'rgba(0,0,0,0.25)',
                          }}
                        >
                          🔒 {user?.email}
                        </div>
                      )}
                    </div>
                    <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                      ⚠️ This content is exclusively licensed to {user?.email}. Recording or sharing is strictly prohibited.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="video-placeholder-large">
                  <div style={{ fontSize: 56 }}>▶️</div>
                  <p>Select a video below to start learning</p>
                </div>
              )}

              {/* Video List for this module */}
              <div style={{ marginTop: 28 }}>
                <h2 className="section-title">🎬 Lessons in this Module</h2>
                {activeModuleVideos.length === 0 ? (
                  <div className="empty-state">
                    <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                    <p>No videos uploaded yet for this module. Check back soon!</p>
                  </div>
                ) : (
                  <div className="lesson-list">
                    {activeModuleVideos.map((v, i) => (
                      <div
                        key={v.id}
                        className={`lesson-item ${activeVideo?.id === v.id ? 'active' : ''}`}
                        onClick={() => handleVideoSelect(v)}
                      >
                        <div className="lesson-num">{i + 1}</div>
                        <div className="lesson-info">
                          <div className="lesson-title">{v.title}</div>
                          <div className="lesson-meta">🔐 Protected · Click to play</div>
                        </div>
                        <button className="lesson-play-btn">▶</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Student Query Section */}
              <div className="query-section">
                <h2 className="section-title">💬 Ask a Question</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
                  Have a question about <strong>{activeModuleData.title}</strong>? Submit it below and our team will get back to you.
                </p>
                {queryMsg && (
                  <div className={`alert ${queryMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
                    {queryMsg}
                  </div>
                )}
                <form onSubmit={submitQuery} className="query-form">
                  <textarea
                    className="form-input query-textarea"
                    placeholder={`Type your question about "${activeModuleData.title}" here...`}
                    value={queryText}
                    onChange={e => setQueryText(e.target.value)}
                    rows={4}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={queryLoading}>
                    {queryLoading ? <><span className="loader"></span> Submitting…</> : '📤 Submit Question'}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {loadingModules ? (
                <span className="loader" style={{ borderTopColor: '#FF2A55', borderColor: 'rgba(0,0,0,0.1)', width: 40, height: 40, borderWidth: 4 }}></span>
              ) : (
                <>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
                  <p style={{ color: 'var(--text-muted)' }}>No course content available yet. Check back soon!</p>
                </>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Legal Warning Modal */}
      {showWarning && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div style={{
            background: '#1a1a2e', borderRadius: 20, padding: 40, maxWidth: 480,
            border: '1px solid rgba(255,42,85,0.4)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ color: '#FF2A55', marginBottom: 12, fontSize: 20 }}>Legal Notice</h2>
            <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.8, marginBottom: 28, fontSize: 14 }}>
              This video is <strong>exclusively licensed</strong> to your account (<strong>{user?.email}</strong>).
              Any screen recording, sharing, or redistribution is a <strong>violation of copyright law</strong>
              and may result in <strong>account termination and legal action</strong>.
              <br /><br />
              All sessions are logged and watermarked with your identity.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button onClick={() => setShowWarning(false)}
                style={{ padding: '11px 24px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={confirmAndPlayVideo}
                style={{ padding: '11px 24px', borderRadius: 10, background: '#FF2A55', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>
                I Understand — Play
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Detected Blocker */}
      {recordingDetected && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', padding: 24,
        }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>🚫</div>
          <h1 style={{ color: '#FF2A55', fontSize: 28, marginBottom: 12, textAlign: 'center' }}>
            Screen Recording Detected
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 480, textAlign: 'center', lineHeight: 1.8, marginBottom: 24, fontSize: 15 }}>
            Playback has been <strong style={{ color: '#fff' }}>terminated</strong>. This incident is logged against <strong style={{ color: '#fff' }}>{user?.email}</strong>.
          </p>
          <button onClick={dismissRecordingWarning}
            style={{ padding: '14px 36px', borderRadius: 10, background: '#FF2A55', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>
            I Understand — Log Me Out
          </button>
        </div>
      )}
    </div>
  );
}
