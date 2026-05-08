-- ============================================================
-- Add rich content column to modules table
-- Run this in your Supabase SQL editor
-- ============================================================

ALTER TABLE modules ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '';

-- Also update module_videos to support bunny.net fields
ALTER TABLE module_videos ADD COLUMN IF NOT EXISTS bunny_video_id TEXT DEFAULT '';
ALTER TABLE module_videos ADD COLUMN IF NOT EXISTS video_provider TEXT DEFAULT 'bunny';
-- video_url now stores the Bunny Stream embed URL
