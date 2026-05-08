-- ============================================================
-- Pin Power LMS — Safe Re-runnable Setup
-- ============================================================

-- 1. ENUM TYPES
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE access_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. TABLES
CREATE TABLE IF NOT EXISTS users_extended (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'student',
  access_status access_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_fingerprint TEXT NOT NULL,
  last_login TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_fingerprint)
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sort_order INTEGER NOT NULL DEFAULT 0,
  section_name TEXT NOT NULL,
  lesson_title TEXT NOT NULL,
  vdocipher_video_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS ENABLE
ALTER TABLE users_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

-- 4. POLICIES (Drop first to avoid "Already Exists" error)
DROP POLICY IF EXISTS "Users can view own profile" ON users_extended;
CREATE POLICY "Users can view own profile" ON users_extended FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role full access on users_extended" ON users_extended;
CREATE POLICY "Service role full access on users_extended" ON users_extended FOR ALL USING (true);

DROP POLICY IF EXISTS "Users can view own devices" ON user_devices;
CREATE POLICY "Users can view own devices" ON user_devices FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access on user_devices" ON user_devices;
CREATE POLICY "Service role full access on user_devices" ON user_devices FOR ALL USING (true);

DROP POLICY IF EXISTS "Approved students can read lessons" ON lessons;
CREATE POLICY "Approved students can read lessons" ON lessons FOR SELECT USING (
    EXISTS (SELECT 1 FROM users_extended WHERE id = auth.uid() AND (role = 'admin' OR access_status = 'approved'))
);

DROP POLICY IF EXISTS "Admins can manage lessons" ON lessons;
CREATE POLICY "Admins can manage lessons" ON lessons FOR ALL USING (
    EXISTS (SELECT 1 FROM users_extended WHERE id = auth.uid() AND role = 'admin')
);

-- 5. TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users_extended (id, email, role, access_status)
  VALUES (NEW.id, NEW.email, 'student', 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. SEED ADMINS
UPDATE public.users_extended
SET role = 'admin', access_status = 'approved'
WHERE email IN ('team@luckynamepicker.com', 'david5127214@gmail.com');
