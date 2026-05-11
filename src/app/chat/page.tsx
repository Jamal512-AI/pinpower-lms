'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
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
        : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    if (label !== currentLabel) {
      groups.push({ label, messages: [] });
      currentLabel = label;
    }
    groups[groups.length - 1].messages.push(msg);
  }
  return groups;
}

export default function StudentChatPage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // ── Auth: verify approved student ──────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Use getUser() for a fresh server-verified session
        const { data: { user: u } } = await supabase.auth.getUser();

        if (!u) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('users_extended')
          .select('role, access_status')
          .eq('id', u.id)
          .single();

        if (!profile) {
          router.push('/login');
          return;
        }

        // Admins get redirected to admin chat
        if (profile.role === 'admin') {
          router.push('/admin/chat');
          return;
        }

        // Students must be approved
        if (profile.access_status !== 'approved') {
          router.push('/waiting-room');
          return;
        }

        setUser({ id: u.id, email: u.email! });
        setAuthChecked(true);
      } catch {
        router.push('/login');
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load messages once user is known ──────────────────────
  const loadMessages = useCallback(async (studentId: string) => {
    try {
      const res = await fetch(`/api/chat?studentId=${studentId}`);
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadMessages(user.id);
  }, [user, loadMessages]);

  // ── Realtime: listen for new messages in this thread ──────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`student-chat-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${user.id}`,
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
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function sendMessage() {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    // Optimistic insert
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      student_id: user.id,
      student_email: user.email,
      message: text,
      sender_type: 'student',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.id,
          studentEmail: user.email,
          message: text,
          senderType: 'student',
        }),
      });
    } catch {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    }

    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  async function handleLogout() {
    await forceLogout();
    window.location.href = '/login';
  }

  const grouped = groupByDate(messages);
  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';

  // Show nothing while auth is resolving (prevents flash of red screen)
  if (!authChecked && loading) {
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

  return (
    <div className="chat-page">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <a href="/dashboard" className="navbar-logo">
          <img
            src="/logo.png"
            alt="Pin Power"
            style={{ width: 120, height: 'auto', objectFit: 'contain' }}
          />
        </a>
        <div className="navbar-actions">
          <a
            href="/dashboard"
            className="btn btn-sm btn-ghost"
            style={{ color: 'rgba(255,255,255,0.7)' }}
          >
            ← Dashboard
          </a>
          <div className="navbar-user">
            <div className="navbar-avatar">{avatarLetter}</div>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>
              {user?.email}
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

      {/* ── Chat container ── */}
      <div className="chat-container">
        {/* Header */}
        <div className="chat-header">
          <div className="chat-header-avatar">🛡️</div>
          <div>
            <div className="chat-header-name">Pin Power Support</div>
            <div className="chat-header-status">
              <span className="online-dot" />
              Admin team · usually replies within a few hours
            </div>
          </div>
        </div>

        {/* Messages area */}
        <div className="chat-messages" id="student-chat-messages">
          {loading ? (
            <div className="chat-loading">
              <span
                className="loader"
                style={{
                  borderTopColor: '#FF2A55',
                  borderColor: 'rgba(0,0,0,0.1)',
                }}
              />
              <p>Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <div style={{ fontSize: 56, marginBottom: 8 }}>💬</div>
              <h3>Start a conversation</h3>
              <p>
                Have a question about a module or need help? Send us a message
                and our admin team will get back to you!
              </p>
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
                      msg.sender_type === 'student' ? 'student' : 'admin'
                    }`}
                  >
                    {msg.sender_type === 'admin' && (
                      <div className="chat-avatar admin-avatar">🛡️</div>
                    )}
                    <div className="chat-bubble-wrap">
                      <div
                        className={`chat-bubble ${
                          msg.sender_type === 'student'
                            ? 'bubble-student'
                            : 'bubble-admin'
                        }`}
                      >
                        {msg.sender_type === 'admin' && (
                          <span
                            style={{
                              fontSize: 11,
                              opacity: 0.65,
                              display: 'block',
                              marginBottom: 3,
                              fontWeight: 700,
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
                    {msg.sender_type === 'student' && (
                      <div className="chat-avatar student-avatar">
                        {avatarLetter}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending || !user}
          />
          <button
            id="student-send-btn"
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || sending || !user}
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
      </div>
    </div>
  );
}
