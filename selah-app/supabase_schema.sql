-- ========================================================
-- SELAH WORSHIP PLANNER - SUPABASE PERMISSIONS & SCHEMA FIX
-- Paste and run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/qplhtuxmbjyjvxzakkae/sql/new
-- ========================================================

-- 1. Drop existing tables if present (COMPLETE RESET)
DROP TABLE IF EXISTS setlists CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. Create Profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  username TEXT,
  email TEXT,
  role TEXT DEFAULT 'worship_leader',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Songs table
CREATE TABLE songs (
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

-- 4. Create Setlists table
CREATE TABLE setlists (
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

-- 5. Grant explicit table permissions to anon and authenticated roles
GRANT ALL ON TABLE profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE songs TO anon, authenticated, service_role;
GRANT ALL ON TABLE setlists TO anon, authenticated, service_role;

-- 6. Disable Row Level Security (RLS) for open team sync
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlists DISABLE ROW LEVEL SECURITY;

-- 7. Create fallback permissive policies
CREATE POLICY "Public profiles access" ON profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public songs access" ON songs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public setlists access" ON setlists FOR ALL USING (true) WITH CHECK (true);

-- 8. Enable Supabase Realtime for collaborative updates across all devices
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE songs;
ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
