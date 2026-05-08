-- ============================================================
-- Pin Power LMS — Chat System Table
-- Run this in your Supabase SQL editor
-- ============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL,
  student_email TEXT NOT NULL,
  message TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('student', 'admin')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast per-student lookups
CREATE INDEX IF NOT EXISTS chat_messages_student_id_idx ON chat_messages(student_id);
CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON chat_messages(created_at DESC);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Students can read/write their own messages; service role manages admin writes
DROP POLICY IF EXISTS "Students can read their own chat" ON chat_messages;
CREATE POLICY "Students can read their own chat" ON chat_messages
  FOR SELECT USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can send messages" ON chat_messages;
CREATE POLICY "Students can send messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = student_id AND sender_type = 'student');

-- Service role (admin) has full access
DROP POLICY IF EXISTS "Service role full access on chat_messages" ON chat_messages;
CREATE POLICY "Service role full access on chat_messages" ON chat_messages
  FOR ALL USING (true);

-- Enable Realtime on this table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
