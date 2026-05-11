'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createAdminBrowserClient } from '@/lib/supabase-admin-client';
import { forceLogout } from '@/lib/auth-utils';

type Message = {
  id: string;
  student_id: string;
  student_email: string;
  message: string;
  sender_type: 'student' | 'admin';
  is_read: boolean;
  created_at: string;
};

type ChatStudent = {
  student_id: string;
  student_email: string;
  last_message: string;
  last_sender: string;
  last_time: string;
  unread_count: number;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFullTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1)
    return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return (
    d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  );
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const label =
      diffDays === 0
        ? 'Today'
        : diffDays === 1
        ? 'Yesterday'
        : d.toLocaleDateString([], {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          });
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

export default function AdminChatPage() {
  const router = useRouter();
  // Must use admin client (isSingleton:false) so it never reads the student session cache
  const supabase = createAdminBrowserClient();

  const [adminEmail, setAdminEmail] = useState('');
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState('');

  const [students, setStudents] = useState<ChatStudent[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<ChatStudent | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [search, setSearch] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Auth: verify admin ─────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // getUser() makes a fresh network call — avoids stale singleton session
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (!user) {
          setAuthError(`NO_USER: ${userError?.message ?? 'No session found. Please log in.'}`);
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('users_extended')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          setAuthError(
            `NOT_ADMIN: Profile role is ${profile?.role ?? 'None'}. ${profileError?.message ?? 'Unknown'}`
          );
          return;
        }

        setAdminEmail(user.email ?? '');
        setAuthChecked(true);
      } catch (err: any) {
        setAuthError(`ERROR: ${err.message}`);
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load student list from API ─────────────────────────────
  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/students');
      const data = await res.json();
      setStudents(data.students || []);
    } catch {
      setStudents([]);
    } finally {
      setLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked) return;
    loadStudents();
  }, [authChecked, loadStudents]);

  // Poll every 10s for new student messages / unread counts
  useEffect(() => {
    if (!authChecked) return;
    const interval = setInterval(loadStudents, 10_000);
    return () => clearInterval(interval);
  }, [authChecked, loadStudents]);

  // ── Load messages for selected student ─────────────────────
  const loadMessages = useCallback(async (studentId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat?studentId=${studentId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedStudent) return;
    loadMessages(selectedStudent.student_id);
  }, [selectedStudent, loadMessages]);

  // ── Realtime: new messages for selected student ────────────
  useEffect(() => {
    if (!selectedStudent) return;

    const channel = supabase
      .channel(`admin-chat-${selectedStudent.student_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${selectedStudent.student_id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as Message;
            const filtered = prev.filter(
              (m) =>
                !(m.id.startsWith('optimistic-') && m.message === incoming.message)
            );
            if (filtered.find((m) => m.id === incoming.id)) return filtered;
            return [...filtered, incoming];
          });
          loadStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudent]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Send reply ─────────────────────────────────────────────
  async function sendReply() {
    if (!input.trim() || !selectedStudent || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      student_id: selectedStudent.student_id,
      student_email: selectedStudent.student_email,
      message: text,
      sender_type: 'admin',
      is_read: true,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudent.student_id,
          studentEmail: selectedStudent.student_email,
          message: text,
          senderType: 'admin',
        }),
      });
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  async function selectStudent(s: ChatStudent) {
    setSelectedStudent(s);
    setMessages([]);
    setInput('');
    // Optimistically clear unread badge
    setStudents((prev) =>
      prev.map((st) =>
        st.student_id === s.student_id ? { ...st, unread_count: 0 } : st
      )
    );
    // Mark messages as read in DB
    if (s.unread_count > 0) {
      await fetch('/api/chat', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: s.student_id }),
      });
    }
  }

  async function handleLogout() {
    await forceLogout();
    window.location.href = '/login';
  }

  // ── Loading spinner while auth resolves ───────────────────
  if (!authChecked && !authError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        <span
          className="loader"
          style={{
            width: 40,
            height: 40,
            borderWidth: 4,
            borderTopColor: '#FF2A55',
            borderColor: 'rgba(0,0,0,0.1)',
          }}
        />
      </div>
    );
  }

  // ── Auth error screen ─────────────────────────────────────
  if (authError) {
    return (
      <div
        style={{
          padding: 40,
          fontFamily: 'monospace',
          color: 'white',
          background: '#b91c1c',
          minHeight: '100vh',
          whiteSpace: 'pre-wrap',
        }}
      >
        <h1 style={{ marginBottom: 16 }}>Admin Authentication Failed</h1>
        <p style={{ fontSize: 16, marginBottom: 24 }}>{authError}</p>
        <button
          onClick={handleLogout}
          style={{
            marginTop: 20,
            padding: '12px 24px',
            cursor: 'pointer',
            background: 'white',
            color: '#b91c1c',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          Sign Out &amp; Try Again
        </button>
      </div>
    );
  }

  const filteredStudents = students.filter((s) =>
    s.student_email.toLowerCase().includes(search.toLowerCase())
  );
  const grouped = groupByDate(messages);
  const totalUnread = students.reduce((acc, s) => acc + s.unread_count, 0);

  return (
    <div className="admin-chat-page">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <a href="/admin" className="navbar-logo">
          <img
            src="/logo.png"
            alt="Pin Power"
            style={{ width: 120, height: 'auto', objectFit: 'contain' }}
          />
        </a>
        <div className="navbar-actions">
          <a
            href="/admin"
            className="btn btn-sm btn-ghost"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            ← Admin Dashboard
          </a>
          <span className="badge badge-admin">🛡️ Admin</span>
          <div className="navbar-user">
            <div
              className="navbar-avatar"
              style={{ background: 'var(--brand-blue)' }}
            >
              {adminEmail[0]?.toUpperCase()}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
              {adminEmail}
            </span>
          </div>
          <button
            className="btn btn-sm btn-ghost"
            style={{ color: 'rgba(255,255,255,0.6)' }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="admin-chat-layout">
        {/* ── Left sidebar: student list ── */}
        <aside className="admin-chat-sidebar">
          <div className="admin-chat-sidebar-header">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 14,
              }}
            >
              <h2 style={{ color: '#fff', fontSize: 17, fontWeight: 700 }}>
                💬 Student Chats
              </h2>
              {totalUnread > 0 && (
                <span className="unread-badge">{totalUnread}</span>
              )}
            </div>
            <input
              className="admin-chat-search"
              placeholder="🔍 Search students…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="admin-chat-student-list">
            {loadingStudents ? (
              <div style={{ padding: 24, textAlign: 'center' }}>
                <span
                  className="loader"
                  style={{
                    borderTopColor: '#FF2A55',
                    borderColor: 'rgba(255,255,255,0.2)',
                  }}
                />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 14,
                }}
              >
                {search ? 'No students match your search' : 'No student chats yet'}
              </div>
            ) : (
              filteredStudents.map((s) => (
                <div
                  key={s.student_id}
                  className={`admin-chat-student-item ${
                    selectedStudent?.student_id === s.student_id ? 'active' : ''
                  }`}
                  onClick={() => selectStudent(s)}
                >
                  <div className="admin-chat-student-avatar">
                    {s.student_email[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span className="admin-chat-student-email">
                        {s.student_email.split('@')[0]}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.4)',
                          flexShrink: 0,
                        }}
                      >
                        {formatTime(s.last_time)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: 2,
                      }}
                    >
                      <span className="admin-chat-last-msg">
                        {s.last_sender === 'admin' ? '🛡️ You: ' : ''}
                        {s.last_message.slice(0, 36)}
                        {s.last_message.length > 36 ? '…' : ''}
                      </span>
                      {s.unread_count > 0 && (
                        <span className="unread-badge">{s.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* ── Right: chat window ── */}
        <main className="admin-chat-main">
          {selectedStudent ? (
            <>
              {/* Window header */}
              <div className="admin-chat-window-header">
                <div
                  className="admin-chat-student-avatar"
                  style={{ width: 42, height: 42, fontSize: 18 }}
                >
                  {selectedStudent.student_email[0].toUpperCase()}
                </div>
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      fontSize: 16,
                    }}
                  >
                    {selectedStudent.student_email}
                  </div>
                  <div
                    style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}
                  >
                    {messages.length} messages in this conversation
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div
                className="chat-messages admin-messages"
                id="admin-chat-messages"
              >
                {loadingMessages ? (
                  <div className="chat-loading">
                    <span
                      className="loader"
                      style={{
                        borderTopColor: '#FF2A55',
                        borderColor: 'rgba(0,0,0,0.1)',
                      }}
                    />
                    <p>Loading conversation…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty">
                    <div style={{ fontSize: 48 }}>💬</div>
                    <p>No messages yet from this student.</p>
                  </div>
                ) : (
                  grouped.map((group) => (
                    <div key={group.label}>
                      <div className="chat-date-divider">
                        <span>{group.label}</span>
                      </div>
                      {group.messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`chat-message-row ${
                            msg.sender_type === 'admin' ? 'student' : 'admin'
                          }`}
                        >
                          {msg.sender_type === 'student' && (
                            <div
                              className="chat-avatar admin-avatar"
                              style={{
                                background: 'rgba(255,42,85,0.15)',
                                fontSize: 14,
                              }}
                            >
                              {msg.student_email[0].toUpperCase()}
                            </div>
                          )}
                          <div className="chat-bubble-wrap">
                            <div
                              className={`chat-bubble ${
                                msg.sender_type === 'admin'
                                  ? 'bubble-student'
                                  : 'bubble-admin'
                              }`}
                            >
                              {msg.sender_type === 'admin' && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    opacity: 0.7,
                                    display: 'block',
                                    marginBottom: 2,
                                  }}
                                >
                                  🛡️ Admin
                                </span>
                              )}
                              {msg.message}
                            </div>
                            <div className="chat-time">
                              {formatFullTime(msg.created_at)}
                            </div>
                          </div>
                          {msg.sender_type === 'admin' && (
                            <div
                              className="chat-avatar student-avatar"
                              style={{
                                background: 'var(--brand-blue)',
                                fontSize: 12,
                              }}
                            >
                              🛡️
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Reply input */}
              <div className="chat-input-area">
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder={`Reply to ${selectedStudent.student_email}… (Enter to send)`}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={sending}
                />
                <button
                  className="chat-send-btn"
                  onClick={sendReply}
                  disabled={!input.trim() || sending}
                  id="admin-send-reply-btn"
                >
                  {sending ? (
                    <span
                      className="loader"
                      style={{ width: 18, height: 18, borderWidth: 2 }}
                    />
                  ) : (
                    '➤'
                  )}
                </button>
              </div>
            </>
          ) : (
            /* No student selected placeholder */
            <div className="admin-chat-placeholder">
              <div style={{ fontSize: 72, marginBottom: 20 }}>💬</div>
              <h2>Select a student chat</h2>
              <p>
                Click on any student from the left panel to view and reply to
                their messages.
              </p>
              {totalUnread > 0 && (
                <div className="admin-chat-unread-hint">
                  <span>🔴</span> {totalUnread} unread message
                  {totalUnread !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
