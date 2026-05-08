'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

type Message = {
  id: string;
  student_id: string;
  student_email: string;
  message: string;
  sender_type: 'student' | 'admin';
  is_read: boolean;
  created_at: string;
};

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function groupByDate(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];
  let currentLabel = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    const label = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
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

  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Auth check
  useEffect(() => {
    async function init() {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      const { data: profile } = await supabase.from('users_extended').select('role, access_status').eq('id', u.id).single();
      if (!profile || profile.access_status !== 'approved') { router.push('/waiting-room'); return; }
      if (profile.role === 'admin') { router.push('/admin'); return; }
      setUser({ email: u.email!, id: u.id });
    }
    init();
  }, []);

  // Load messages
  const loadMessages = useCallback(async (userId: string) => {
    const res = await fetch(`/api/chat?studentId=${userId}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    loadMessages(user.id);
  }, [user, loadMessages]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`chat-student-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          setMessages(prev => {
            // Avoid duplicates and remove optimistic message with same content
            const incoming = payload.new as Message;
            const filtered = prev.filter(m => !(m.id.startsWith('optimistic-') && m.message === incoming.message));
            if (filtered.find(m => m.id === incoming.id)) return filtered;
            return [...filtered, incoming];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Auto scroll
  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  async function sendMessage() {
    if (!input.trim() || !user || sending) return;
    setSending(true);
    const text = input.trim();
    setInput('');

    // Optimistic UI
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      student_id: user.id,
      student_email: user.email,
      message: text,
      sender_type: 'student',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);

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

    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const grouped = groupByDate(messages);
  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="chat-page">
      {/* Navbar */}
      <nav className="navbar">
        <a href="/dashboard" className="navbar-logo">
          <Image src="/logo.png" alt="Pin Power" width={120} height={40} style={{ objectFit: 'contain' }} />
        </a>
        <div className="navbar-actions">
          <a href="/dashboard" className="btn btn-sm btn-ghost" style={{ color: 'rgba(255,255,255,0.7)' }}>
            ← Dashboard
          </a>
          <div className="navbar-user">
            <div className="navbar-avatar">{avatarLetter}</div>
            <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14 }}>{user?.email}</span>
          </div>
        </div>
      </nav>

      {/* Chat Container */}
      <div className="chat-container">
        {/* Chat Header */}
        <div className="chat-header">
          <div className="chat-header-avatar">
            <span>🛡️</span>
          </div>
          <div>
            <div className="chat-header-name">Pin Power Support</div>
            <div className="chat-header-status">
              <span className="online-dot"></span>
              Admin Team
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="chat-messages" id="chat-messages-area">
          {loading ? (
            <div className="chat-loading">
              <span className="loader" style={{ borderTopColor: '#FF2A55', borderColor: 'rgba(0,0,0,0.1)' }}></span>
              <p>Loading messages…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-empty">
              <div style={{ fontSize: 56, marginBottom: 12 }}>💬</div>
              <h3>Start a conversation</h3>
              <p>Ask us anything about your course. We typically reply within 24 hours.</p>
            </div>
          ) : (
            grouped.map(group => (
              <div key={group.label}>
                <div className="chat-date-divider">
                  <span>{group.label}</span>
                </div>
                {group.messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`chat-message-row ${msg.sender_type === 'student' ? 'student' : 'admin'}`}
                  >
                    {msg.sender_type === 'admin' && (
                      <div className="chat-avatar admin-avatar">🛡️</div>
                    )}
                    <div className="chat-bubble-wrap">
                      <div className={`chat-bubble ${msg.sender_type === 'student' ? 'bubble-student' : 'bubble-admin'}`}>
                        {msg.message}
                      </div>
                      <div className="chat-time">{formatTime(msg.created_at)}</div>
                    </div>
                    {msg.sender_type === 'student' && (
                      <div className="chat-avatar student-avatar">{avatarLetter}</div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Type your message… (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={sending}
          />
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            id="send-message-btn"
          >
            {sending ? <span className="loader" style={{ width: 18, height: 18, borderWidth: 2 }}></span> : '➤'}
          </button>
        </div>
      </div>
    </div>
  );
}
