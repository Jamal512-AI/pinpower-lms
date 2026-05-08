-- ============================================================
-- Pin Power LMS — Additional Tables for Course Modules
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. MODULES TABLE
CREATE TABLE IF NOT EXISTS modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. MODULE VIDEOS TABLE (Google Drive embed links)
CREATE TABLE IF NOT EXISTS module_videos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  drive_email TEXT DEFAULT '',  -- Google email that owns the Drive video
  video_url TEXT NOT NULL,      -- Google Drive embed URL or direct link
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. STUDENT QUERIES TABLE
CREATE TABLE IF NOT EXISTS student_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_email TEXT NOT NULL,
  module_name TEXT NOT NULL,
  query_text TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  admin_reply TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_queries ENABLE ROW LEVEL SECURITY;

-- Modules: All approved users can read; service role manages writes
DROP POLICY IF EXISTS "Approved users can view modules" ON modules;
CREATE POLICY "Approved users can view modules" ON modules FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users_extended 
    WHERE id = auth.uid() AND (role = 'admin' OR access_status = 'approved')
  )
);

DROP POLICY IF EXISTS "Service role full access on modules" ON modules;
CREATE POLICY "Service role full access on modules" ON modules FOR ALL USING (true);

-- Module videos: same permissions
DROP POLICY IF EXISTS "Approved users can view module_videos" ON module_videos;
CREATE POLICY "Approved users can view module_videos" ON module_videos FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM users_extended 
    WHERE id = auth.uid() AND (role = 'admin' OR access_status = 'approved')
  )
);

DROP POLICY IF EXISTS "Service role full access on module_videos" ON module_videos;
CREATE POLICY "Service role full access on module_videos" ON module_videos FOR ALL USING (true);

-- Student queries: students can insert; service role reads all
DROP POLICY IF EXISTS "Students can submit queries" ON student_queries;
CREATE POLICY "Students can submit queries" ON student_queries FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users_extended WHERE id = auth.uid() AND access_status = 'approved')
);

DROP POLICY IF EXISTS "Service role full access on student_queries" ON student_queries;
CREATE POLICY "Service role full access on student_queries" ON student_queries FOR ALL USING (true);
