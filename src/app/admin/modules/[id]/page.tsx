'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createAdminBrowserClient } from '@/lib/supabase-admin-client';
import dynamic from 'next/dynamic';

const BlockEditor = dynamic(() => import('@/components/BlockEditor'), { ssr: false });

type ModuleVideo = {
  id: string; module_id: string; title: string;
  video_url: string; drive_email: string; sort_order: number;
};

type ModuleData = {
  id: string; title: string; description: string;
  sort_order: number; content: string; status: 'draft' | 'published';
};

function getDriveEmbedUrl(url: string): string {
  const match = url.match(/\/file\/d\/([^/]+)/);
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
  return url;
}

export default function ModuleEditorPage() {
  const router = useRouter();
  const params = useParams();
  const moduleId = params.id as string;
  // Use admin client (isSingleton: false) — never reads stale student session
  const supabase = createAdminBrowserClient();

  const [mod, setMod] = useState<ModuleData | null>(null);
  const [videos, setVideos] = useState<ModuleVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState('');

  // FIX 3: admin video preview
  const [previewVideo, setPreviewVideo] = useState<ModuleVideo | null>(null);

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editStatus, setEditStatus] = useState<'draft' | 'published'>('draft');
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  const [editorContent, setEditorContent] = useState('');
  const [contentSaving, setContentSaving] = useState(false);
  const [contentMsg, setContentMsg] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showVideoForm, setShowVideoForm] = useState(false);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoProv, setVideoProv] = useState<'bunny' | 'paste'>('paste');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoMsg, setVideoMsg] = useState('');
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
    async function init() {
      try {
        // getUser() makes a fresh server-verified call — avoids stale session cache
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (!user) {
          setAuthError(`NO_USER: ${userError?.message ?? 'Auth session missing! Please log in again.'}`);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('users_extended').select('role').eq('id', user.id).single();

        if (!profile || profile.role !== 'admin') {
          setAuthError(`NOT_ADMIN: Profile role is ${profile?.role || 'None'}. ${profileError?.message ?? ''}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setAuthError(`ERROR: ${msg}`);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadModule = useCallback(async () => {
    const res = await fetch('/api/modules');
    const data = await res.json();
    const found = (data.modules || []).find((m: ModuleData) => m.id === moduleId);
    if (!found) { router.push('/admin'); return; }
    setMod(found);
    setEditTitle(found.title);
    setEditDesc(found.description || '');
    setEditStatus(found.status || 'draft');
    setEditorContent(found.content || '');
    setLoading(false);
  }, [moduleId, router]);

  const loadVideos = useCallback(async () => {
    const res = await fetch(`/api/module-videos?moduleId=${moduleId}`);
    const data = await res.json();
    setVideos(data.videos || []);
  }, [moduleId]);

  useEffect(() => { loadModule(); loadVideos(); }, [loadModule, loadVideos]);

  async function saveInfo() {
    setInfoSaving(true);
    const res = await fetch('/api/modules', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: moduleId, title: editTitle, description: editDesc, status: editStatus }),
    });
    setInfoSaving(false);
    setInfoMsg(res.ok ? '✅ Saved!' : '❌ Save failed');
    setTimeout(() => setInfoMsg(''), 2500);
  }

  function handleContentChange(html: string) {
    setEditorContent(html);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setContentSaving(true);
      await fetch('/api/modules', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: moduleId, content: html }),
      });
      setContentSaving(false);
      setContentMsg('✅ Auto-saved');
      setTimeout(() => setContentMsg(''), 2000);
    }, 1500);
  }

  async function handleAddVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!videoTitle.trim()) return;
    setVideoUploading(true); setVideoMsg('');
    let finalUrl = videoUrl;

    if (videoProv === 'bunny' && videoFile) {
      const fd = new FormData();
      fd.append('file', videoFile); fd.append('title', videoTitle);
      const res = await fetch('/api/bunny/upload-video', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setVideoMsg('❌ ' + (data.error || 'Upload failed')); setVideoUploading(false); return; }
      finalUrl = data.embedUrl;
    }

    if (!finalUrl.trim()) { setVideoMsg('❌ Please provide a video URL or upload a file'); setVideoUploading(false); return; }

    const res = await fetch('/api/module-videos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module_id: moduleId, title: videoTitle, video_url: finalUrl, sort_order: videos.length, drive_email: '' }),
    });

    if (res.ok) {
      setVideoMsg('✅ Video added!');
      setVideoTitle(''); setVideoUrl(''); setVideoFile(null); setShowVideoForm(false);
      loadVideos();
    } else {
      const d = await res.json(); setVideoMsg('❌ ' + d.error);
    }
    setVideoUploading(false);
    setTimeout(() => setVideoMsg(''), 3000);
  }

  async function deleteVideo(id: string) {
    if (!confirm('Delete this video?')) return;
    if (previewVideo?.id === id) setPreviewVideo(null);
    await fetch(`/api/module-videos?id=${id}`, { method: 'DELETE' });
    loadVideos();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  if (loading) {
    return (
      <div suppressHydrationWarning style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span className="loader" style={{ borderTopColor: '#FF2A55', borderColor: 'rgba(0,0,0,0.1)', width: 40, height: 40, borderWidth: 4 }} />
      </div>
    );
  }

  if (!mounted) return null;

  if (authError) {
    return (
      <div style={{ padding: 40, fontFamily: 'monospace', color: 'white', background: '#b91c1c', minHeight: '100vh', whiteSpace: 'pre-wrap' }}>
        <h1 style={{ marginBottom: 16 }}>Admin Authentication Failed</h1>
        <p style={{ fontSize: 16, marginBottom: 24 }}>{authError}</p>
        <button onClick={handleLogout} style={{ padding: '12px 24px', cursor: 'pointer', background: 'white', color: '#b91c1c', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 15 }}>
          Sign Out &amp; Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="module-editor-page" suppressHydrationWarning>
      <nav className="navbar">
        <a href="/admin" className="navbar-logo">
          <img src="/logo.png" alt="Pin Power" style={{ width: 120, height: 'auto', objectFit: 'contain' }} />
        </a>
        <div className="navbar-actions">
          <a href="/admin" className="btn btn-sm btn-ghost" style={{ color: 'rgba(255,255,255,0.7)' }}>← Admin</a>
          <span className="badge badge-admin">🛡️ Admin</span>
        </div>
      </nav>

      <div className="module-editor-layout">

        {/* ── Sidebar ── */}
        <aside className="module-editor-sidebar">

          {/* Module info */}
          <div className="module-editor-section">
            <h3 className="module-editor-section-title">📋 Module Info</h3>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Title</label>
              <input className="form-input" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Description</label>
              <textarea className="form-input" rows={3} style={{ resize: 'vertical' }} value={editDesc} onChange={e => setEditDesc(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Status</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className={`btn btn-sm ${editStatus === 'draft' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setEditStatus('draft')}>📝 Draft</button>
                <button className={`btn btn-sm ${editStatus === 'published' ? 'btn-primary' : 'btn-ghost'}`} style={{ flex: 1 }} onClick={() => setEditStatus('published')}>🚀 Published</button>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveInfo} disabled={infoSaving} style={{ width: '100%' }}>
              {infoSaving ? 'Saving…' : '💾 Save Info'}
            </button>
            {infoMsg && <div className={`alert ${infoMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: 8, fontSize: 13 }}>{infoMsg}</div>}
          </div>

          {/* Videos */}
          <div className="module-editor-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 className="module-editor-section-title" style={{ marginBottom: 0 }}>🎬 Videos ({videos.length})</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowVideoForm(v => !v)}>
                {showVideoForm ? '✕' : '+ Add'}
              </button>
            </div>

            {videoMsg && <div className={`alert ${videoMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 12, fontSize: 13 }}>{videoMsg}</div>}

            {showVideoForm && (
              <form onSubmit={handleAddVideo} className="video-add-form">
                <div className="form-group">
                  <label className="form-label">Video Title *</label>
                  <input className="form-input" placeholder="Lesson 1: Introduction" value={videoTitle} onChange={e => setVideoTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <label className="radio-label"><input type="radio" checked={videoProv === 'paste'} onChange={() => setVideoProv('paste')} /> Paste URL</label>
                    <label className="radio-label"><input type="radio" checked={videoProv === 'bunny'} onChange={() => setVideoProv('bunny')} /> Upload to Bunny</label>
                  </div>
                </div>
                {videoProv === 'paste' ? (
                  <div className="form-group">
                    <label className="form-label">Embed / Drive URL</label>
                    <input className="form-input" placeholder="https://iframe.mediadelivery.net/embed/... or Drive link" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label">Upload Video File</label>
                    <input ref={videoInputRef} type="file" accept="video/*" className="form-input" style={{ padding: 8 }} onChange={e => setVideoFile(e.target.files?.[0] || null)} />
                  </div>
                )}
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={videoUploading}>
                  {videoUploading ? '⏳ Uploading…' : '✅ Add Video'}
                </button>
              </form>
            )}

            {/* Video list — each row has a ▶ preview toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {videos.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No videos yet</div>
              ) : videos.map((v, i) => (
                <div key={v.id} style={{
                  border: `1.5px solid ${previewVideo?.id === v.id ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 10, overflow: 'hidden',
                  background: previewVideo?.id === v.id ? 'rgba(255,42,85,0.03)' : 'var(--bg)',
                }}>
                  {/* Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
                    <div className="video-list-num">{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{v.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                        {v.video_url.slice(0, 40)}…
                      </div>
                    </div>
                    {/* Preview toggle */}
                    <button
                      onClick={() => setPreviewVideo(previewVideo?.id === v.id ? null : v)}
                      title={previewVideo?.id === v.id ? 'Close preview' : 'Preview video'}
                      style={{
                        padding: '4px 9px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14,
                        background: previewVideo?.id === v.id ? 'var(--accent)' : 'rgba(29,75,115,0.12)',
                        color: previewVideo?.id === v.id ? '#fff' : 'var(--brand-blue)',
                        flexShrink: 0, fontWeight: 700,
                      }}
                    >
                      {previewVideo?.id === v.id ? '■' : '▶'}
                    </button>
                    <button onClick={() => deleteVideo(v.id)} className="video-delete-btn" title="Delete">🗑️</button>
                  </div>

                  {/* Inline player */}
                  {previewVideo?.id === v.id && (
                    <div style={{ borderTop: '1px solid var(--border)', background: '#0d1117' }}>
                      <iframe
                        src={getDriveEmbedUrl(v.video_url)}
                        allow="autoplay; fullscreen; encrypted-media"
                        allowFullScreen title={v.title}
                        style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
                      />
                      <div style={{ padding: '6px 12px', fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                        Admin preview · {v.title}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main editor ── */}
        <main className="module-editor-main">
          <div className="module-editor-content-header">
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{editTitle || mod?.title}</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Module content — visible to enrolled students</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {contentSaving && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>⏳ Saving…</span>}
              {contentMsg && <span style={{ fontSize: 13, color: 'var(--success)' }}>{contentMsg}</span>}
            </div>
          </div>

          {/* Video strip at top of main area — click any chip to preview */}
          {videos.length > 0 && (
            <div className="video-preview-strip">
              <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                🎬 {videos.length} video{videos.length > 1 ? 's' : ''} — click to preview
              </h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {videos.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => setPreviewVideo(previewVideo?.id === v.id ? null : v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: previewVideo?.id === v.id ? 'rgba(255,42,85,0.15)' : 'rgba(14,99,183,0.1)',
                      border: `1px solid ${previewVideo?.id === v.id ? 'rgba(255,42,85,0.4)' : 'rgba(14,99,183,0.2)'}`,
                      color: previewVideo?.id === v.id ? 'var(--accent)' : 'var(--brand-blue)',
                    }}
                  >
                    <span>{previewVideo?.id === v.id ? '⏸' : '▶'}</span>
                    <span>{i + 1}. {v.title}</span>
                  </button>
                ))}
              </div>

              {/* Preview pane in main area */}
              {previewVideo && (
                <div style={{ marginTop: 14, borderRadius: 12, overflow: 'hidden', background: '#0d1117', border: '1px solid var(--border)', boxShadow: 'var(--shadow-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: 600 }}>🎬 {previewVideo.title}</span>
                    <button onClick={() => setPreviewVideo(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                  </div>
                  <iframe
                    src={getDriveEmbedUrl(previewVideo.video_url)}
                    allow="autoplay; fullscreen; encrypted-media"
                    allowFullScreen title={previewVideo.title}
                    style={{ width: '100%', aspectRatio: '16/9', border: 'none', display: 'block' }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="block-editor-container">
            <BlockEditor content={editorContent} onChange={handleContentChange} placeholder="Write your module content here…" />
          </div>
        </main>
      </div>
    </div>
  );
}
