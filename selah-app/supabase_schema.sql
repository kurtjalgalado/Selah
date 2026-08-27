-- ========================================================
-- SELAH WORSHIP PLANNER - SUPABASE PERMISSIONS & SCHEMA FIX
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qplhtuxmbjyjvxzakkae/sql/new
-- ========================================================

-- 1. Create or Update Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY,
  username TEXT,
  email TEXT,
  role TEXT DEFAULT 'worship_leader',
  quick_pin TEXT,
  accent_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns if profiles table already exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_pin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Create Songs table
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  artist TEXT,
  original_key TEXT,
  tempo INTEGER,
  category TEXT,
  lyrics TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Setlists table
CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY,
  user_id UUID,
  title TEXT NOT NULL,
  date TEXT,
  notes TEXT,
  prepared_by TEXT,
  song_ids JSONB DEFAULT '[]'::jsonb,
  song_keys JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Grant table-level permissions (PostgREST requires base grants; RLS enforces access)
GRANT ALL ON TABLE profiles TO authenticated, service_role;
GRANT ALL ON TABLE songs TO authenticated, service_role;
GRANT ALL ON TABLE setlists TO authenticated, service_role;
-- Anon needs base grants so PostgREST can route requests; RLS blocks unauthorized access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE songs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE setlists TO anon;

-- 5. Enable Row Level Security (RLS) & add access policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;

-- Profiles: anon can SELECT (username lookup during sign-in), authenticated gets full access
DROP POLICY IF EXISTS "Allow all on profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated access on profiles" ON profiles;
DROP POLICY IF EXISTS "Anon read profiles" ON profiles;
CREATE POLICY "Authenticated access on profiles" ON profiles
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Anon read profiles" ON profiles
  FOR SELECT TO anon
  USING (true);

-- Songs: anon can SELECT (read/hydrate), authenticated gets full access
DROP POLICY IF EXISTS "Allow all on songs" ON songs;
DROP POLICY IF EXISTS "Authenticated access on songs" ON songs;
DROP POLICY IF EXISTS "Anon read songs" ON songs;
CREATE POLICY "Authenticated access on songs" ON songs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Anon read songs" ON songs
  FOR SELECT TO anon
  USING (true);

-- Setlists: anon can SELECT (read/hydrate), authenticated gets full access
DROP POLICY IF EXISTS "Allow all on setlists" ON setlists;
DROP POLICY IF EXISTS "Authenticated access on setlists" ON setlists;
DROP POLICY IF EXISTS "Anon read setlists" ON setlists;
CREATE POLICY "Authenticated access on setlists" ON setlists
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
CREATE POLICY "Anon read setlists" ON setlists
  FOR SELECT TO anon
  USING (true);

-- 6. Enable Supabase Realtime for collaborative updates across all devices
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'profiles') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'songs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE songs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'setlists') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
  END IF;
END $$;
