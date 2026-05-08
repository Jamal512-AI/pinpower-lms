'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminBrowserClient } from '@/lib/supabase-admin-client';
import Image from 'next/image';
import Link from 'next/link';

type Student = { id: string; email: string; role: string; access_status: string; created_at: string; };
type Module = { id: string; title: string; description: string; sort_order: number; status?: string; };
type ModuleVideo = { id: string; module_id: string; title: string; video_url: string; drive_email: string; sort_order: number; };
type Query = { id: string; student_email: string; module_name: string; query_text: string; is_resolved: boolean; created_at: string; };

type Tab = 'students' | 'modules' | 'queries';

export default function AdminPage() {
  const router = useRouter();
  const supabase = createAdminBrowserClient();

  const [tab, setTab] = useState<Tab>('students');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Students
  const [students, setStudents] = useState<Student[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modules
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [moduleVideos, setModuleVideos] = useState<ModuleVideo[]>([]);
  const [newModule, setNewModule] = useState({ title: '', description: '', sort_order: 0 });
  const [moduleMsg, setModuleMsg] = useState('');
  const [newVideo, setNewVideo] = useState({ title: '', drive_email: '', video_url: '', sort_order: 0 });
  const [videoMsg, setVideoMsg] = useState('');
  const [showAddModule, setShowAddModule] = useState(false);
  const [showAddVideo, setShowAddVideo] = useState(false);

  // Queries
  const [queries, setQueries] = useState<Query[]>([]);
  const [queryFilter, setQueryFilter] = useState<string>('all');

  // ── Load Functions ──────────────────────────────────────────
  const loadStudents = useCallback(async () => {
    const res = await fetch('/api/admin/students');
    const data = await res.json();
    setStudents(data.students || []);
    setLoading(false);
  }, []);

  const loadModules = useCallback(async () => {
    const res = await fetch('/api/modules');
    const data = await res.json();
    setModules(data.modules || []);
  }, []);

  const loadModuleVideos = useCallback(async (moduleId: string) => {
    const res = await fetch(`/api/module-videos?moduleId=${moduleId}`);
    const data = await res.json();
    setModuleVideos(data.videos || []);
  }, []);

  const loadQueries = useCallback(async () => {
    const res = await fetch('/api/queries');
    const data = await res.json();
    setQueries(data.queries || []);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/admin-login'); return; }
      const { data: profile } = await supabase.from('users_extended').select('role').eq('id', user.id).single();
      if (!profile || profile.role !== 'admin') { router.push('/admin-login'); return; }
      setUserEmail(user.email!);
      loadStudents();
      loadModules();
      loadQueries();
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, loadStudents, loadModules, loadQueries]);

  // ── Student Actions ─────────────────────────────────────────
  async function approveStudent(studentId: string) {
    setActionLoading(studentId + '-approve');
    await fetch('/api/admin/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, action: 'approve' }) });
    await loadStudents();
    setActionLoading(null);
  }

  async function rejectStudent(studentId: string) {
    setActionLoading(studentId + '-reject');
    await fetch('/api/admin/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, action: 'reject' }) });
    await loadStudents();
    setActionLoading(null);
  }

  // ── Module Actions ──────────────────────────────────────────
  async function addModule(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/modules', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newModule),
    });
    const data = await res.json();
    if (!res.ok) { setModuleMsg('❌ ' + data.error); return; }
    setModuleMsg('✅ Module added!');
    setNewModule({ title: '', description: '', sort_order: 0 });
    setShowAddModule(false);
    loadModules();
    setTimeout(() => setModuleMsg(''), 3000);
  }

  async function deleteModule(id: string) {
    if (!confirm('Delete this module and all its videos?')) return;
    await fetch(`/api/modules?id=${id}`, { method: 'DELETE' });
    if (selectedModule?.id === id) { setSelectedModule(null); setModuleVideos([]); }
    loadModules();
  }

  async function selectModule(m: Module) {
    setSelectedModule(m);
    setShowAddVideo(false);
    setNewVideo({ title: '', drive_email: '', video_url: '', sort_order: 0 });
    await loadModuleVideos(m.id);
  }

  // ── Video Actions ───────────────────────────────────────────
  async function addVideo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedModule) return;
    const res = await fetch('/api/module-videos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newVideo, module_id: selectedModule.id }),
    });
    const data = await res.json();
    if (!res.ok) { setVideoMsg('❌ ' + data.error); return; }
    setVideoMsg('✅ Video added!');
    setNewVideo({ title: '', drive_email: '', video_url: '', sort_order: 0 });
    setShowAddVideo(false);
    loadModuleVideos(selectedModule.id);
    setTimeout(() => setVideoMsg(''), 3000);
  }

  async function deleteVideo(id: string) {
    await fetch(`/api/module-videos?id=${id}`, { method: 'DELETE' });
    if (selectedModule) loadModuleVideos(selectedModule.id);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/admin-login');
  }

  // ── Derived ─────────────────────────────────────────────────
  const pending = students.filter(s => s.access_status === 'pending');
  const approved = students.filter(s => s.access_status === 'approved');
  const filteredQueries = queryFilter === 'all' ? queries : queries.filter(q => q.module_name === queryFilter);
  const uniqueModuleNames = [...new Set(queries.map(q => q.module_name))];

  return (
    <div className="admin-layout">
      {/* Navbar */}
      <nav className="navbar">
        <a href="/admin" className="navbar-logo">
          <img src="/logo.png" alt="Pin Power" style={{ width: 120, height: 'auto', objectFit: 'contain' }} />
        </a>
        <div className="navbar-actions">
          <span className="badge badge-admin">🛡️ Admin</span>
          <div className="navbar-user">
            <div className="navbar-avatar" style={{ background: 'var(--brand-blue)' }}>
              {userEmail[0]?.toUpperCase()}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{userEmail}</span>
          </div>
          <a href="/admin/chat" className="btn btn-sm" style={{ background: 'rgba(255,42,85,0.25)', color: '#fff', border: '1px solid rgba(255,42,85,0.5)', borderRadius: 8 }}>
            💬 Live Chat
          </a>
          <button id="admin-logout-btn" className="btn btn-sm btn-ghost" style={{ color: 'rgba(255,255,255,0.6)' }} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, var(--brand-blue-dark) 0%, var(--brand-blue) 100%)', padding: '40px 24px' }}>
        <div className="container">
          <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 8 }}>Admin Dashboard</h1>
          <p style={{ color: 'rgba(255,255,255,0.7)' }}>Manage students, course modules, videos, and student queries.</p>
          <div style={{ display: 'flex', gap: 16, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { val: pending.length, label: 'Pending Approvals' },
              { val: approved.length, label: 'Active Students' },
              { val: modules.length, label: 'Course Modules' },
              { val: queries.length, label: 'Student Queries' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '12px 20px', color: '#fff', minWidth: 110 }}>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{stat.val}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-content">
        {/* Tabs */}
        <div className="admin-tabs" style={{ maxWidth: 700 }}>
          {([
            { key: 'students', label: '👥 Students' },
            { key: 'modules', label: '📚 Course Modules' },
            { key: 'queries', label: `💬 Queries (${queries.length})` },
          ] as { key: Tab; label: string }[]).map(t => (
            <button
              key={t.key}
              id={`tab-${t.key}`}
              className={`admin-tab ${tab === t.key ? 'active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Students Tab ── */}
        {tab === 'students' && (
          <div>
            {pending.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h2 className="section-title">⏳ Pending Approvals ({pending.length})</h2>
                <div style={{ overflowX: 'auto' }}>
                  <table className="student-table">
                    <thead><tr><th>Email</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {pending.map(s => (
                        <tr key={s.id}>
                          <td style={{ fontWeight: 500 }}>{s.email}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                          <td><span className="badge badge-pending">Pending</span></td>
                          <td>
                            <div className="table-actions">
                              <button id={`approve-${s.id}`} className="btn btn-sm btn-primary" onClick={() => approveStudent(s.id)} disabled={actionLoading === s.id + '-approve'}>
                                {actionLoading === s.id + '-approve' ? <span className="loader"></span> : '✅ Approve'}
                              </button>
                              <button id={`reject-${s.id}`} className="btn btn-sm btn-ghost" onClick={() => rejectStudent(s.id)} style={{ color: 'var(--error)' }}>
                                ✕ Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <h2 className="section-title">✅ Approved Students ({approved.length})</h2>
            {loading ? (
              <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : approved.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No approved students yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="student-table">
                  <thead><tr><th>Email</th><th>Registered</th><th>Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {approved.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 500 }}>{s.email}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                        <td><span className="badge badge-approved">Approved</span></td>
                        <td>
                          <button id={`revoke-${s.id}`} className="btn btn-sm btn-ghost" onClick={() => { if (window.confirm('Are you sure you want to revoke access for this student?')) rejectStudent(s.id); }} style={{ color: 'var(--error)' }}>
                            Revoke
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Modules Tab ── */}
        {tab === 'modules' && (
          <div className="modules-layout">
            {/* Left: Module List */}
            <div className="modules-list-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 className="section-title" style={{ marginBottom: 0 }}>📦 Modules ({modules.length})</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddModule(!showAddModule)}>
                  {showAddModule ? '✕ Cancel' : '➕ New Module'}
                </button>
              </div>

              {moduleMsg && (
                <div className={`alert ${moduleMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
                  {moduleMsg}
                </div>
              )}

              {showAddModule && (
                <div className="card" style={{ marginBottom: 20, padding: 20 }}>
                  <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Add New Module</h3>
                  <form onSubmit={addModule} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Module Title *</label>
                      <input className="form-input" placeholder="e.g. Module 1: Introduction to Pin Power" value={newModule.title} onChange={e => setNewModule({ ...newModule, title: e.target.value })} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Description</label>
                      <textarea className="form-input" style={{ resize: 'vertical' }} rows={2} placeholder="Brief description of this module..." value={newModule.description} onChange={e => setNewModule({ ...newModule, description: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sort Order</label>
                      <input className="form-input" type="number" value={newModule.sort_order} onChange={e => setNewModule({ ...newModule, sort_order: parseInt(e.target.value) || 0 })} />
                    </div>
                    <button type="submit" className="btn btn-primary">✅ Create Module</button>
                  </form>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {modules.length === 0 ? (
                  <div className="empty-state"><p>No modules yet. Create your first module!</p></div>
                ) : modules.map((m, i) => (
                  <div
                    key={m.id}
                    className={`admin-module-item ${selectedModule?.id === m.id ? 'active' : ''}`}
                    onClick={() => selectModule(m)}
                  >
                    <div className="admin-module-num">M{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                        {m.status === 'published' ? (
                          <span style={{ fontSize: 10, background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Published</span>
                        ) : (
                          <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Draft</span>
                        )}
                      </div>
                      {m.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{m.description.slice(0, 60)}{m.description.length > 60 ? '…' : ''}</div>}
                    </div>
                    <Link
                      href={`/admin/modules/${m.id}`}
                      onClick={e => e.stopPropagation()}
                      style={{ padding: '4px 10px', background: 'rgba(14,99,183,0.12)', border: '1px solid rgba(14,99,183,0.25)', borderRadius: 6, color: 'var(--brand-blue)', cursor: 'pointer', fontSize: 12, flexShrink: 0, textDecoration: 'none', fontWeight: 600 }}
                    >
                      ✏️ Edit
                    </Link>
                    <button
                      onClick={e => { e.stopPropagation(); deleteModule(m.id); }}
                      style={{ padding: '4px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, color: 'var(--error)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Selected Module Videos */}
            <div className="modules-videos-panel">
              {selectedModule ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{selectedModule.title}</h2>
                      {selectedModule.description && <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{selectedModule.description}</p>}
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddVideo(!showAddVideo)}>
                      {showAddVideo ? '✕ Cancel' : '📤 Add Video'}
                    </button>
                  </div>

                  {videoMsg && (
                    <div className={`alert ${videoMsg.startsWith('✅') ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 16 }}>
                      {videoMsg}
                    </div>
                  )}

                  {showAddVideo && (
                    <div className="card" style={{ marginBottom: 24, padding: 24 }}>
                      <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>📤 Upload Video to This Module</h3>
                      <form onSubmit={addVideo} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div className="form-group">
                          <label className="form-label">Video Title *</label>
                          <input className="form-input" placeholder="e.g. Lesson 1: Getting Started" value={newVideo.title} onChange={e => setNewVideo({ ...newVideo, title: e.target.value })} required />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Google Account Email (Drive Owner)</label>
                          <input className="form-input" type="email" placeholder="yourname@gmail.com — owner of the Drive video" value={newVideo.drive_email} onChange={e => setNewVideo({ ...newVideo, drive_email: e.target.value })} />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            This is the Gmail that owns the video on Google Drive. The video must be shared publicly or as "Anyone with the link can view".
                          </span>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Google Drive Video Link *</label>
                          <input className="form-input" placeholder="https://drive.google.com/file/d/FILE_ID/view" value={newVideo.video_url} onChange={e => setNewVideo({ ...newVideo, video_url: e.target.value })} required />
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                            Share the file from Google Drive → "Copy link". Make sure it's set to "Anyone with the link".
                          </span>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Sort Order</label>
                          <input className="form-input" type="number" value={newVideo.sort_order} onChange={e => setNewVideo({ ...newVideo, sort_order: parseInt(e.target.value) || 0 })} />
                        </div>
                        <button type="submit" className="btn btn-primary">✅ Add Video to Module</button>
                      </form>
                    </div>
                  )}

                  <h3 className="section-title">🎬 Videos ({moduleVideos.length})</h3>
                  {moduleVideos.length === 0 ? (
                    <div className="empty-state">
                      <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                      <p>No videos in this module. Click "Add Video" to upload one!</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {moduleVideos.map((v, i) => (
                        <div key={v.id} className="admin-video-item">
                          <div className="admin-video-num">{i + 1}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{v.title}</div>
                            {v.drive_email && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>📧 {v.drive_email}</div>}
                            <div style={{ fontSize: 12, color: 'var(--brand-blue)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🔗 {v.video_url.slice(0, 55)}…
                            </div>
                          </div>
                          <button
                            onClick={() => deleteVideo(v.id)}
                            style={{ padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--error)', cursor: 'pointer', fontSize: 13, flexShrink: 0 }}
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ minHeight: 300 }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>👈</div>
                  <p>Select a module from the left to manage its videos.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Queries Tab ── */}
        {tab === 'queries' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 className="section-title" style={{ marginBottom: 0 }}>💬 Student Queries ({filteredQueries.length})</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Filter by Module:</label>
                <select
                  className="form-input"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 13 }}
                  value={queryFilter}
                  onChange={e => setQueryFilter(e.target.value)}
                >
                  <option value="all">All Modules</option>
                  {uniqueModuleNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredQueries.length === 0 ? (
              <div className="empty-state">
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <p>No student queries yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {filteredQueries.map(q => (
                  <div key={q.id} className="query-card">
                    <div className="query-card-header">
                      <div>
                        <span className="query-student-email">👤 {q.student_email}</span>
                        <span className="query-module-badge">{q.module_name}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(q.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="query-text">{q.query_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
