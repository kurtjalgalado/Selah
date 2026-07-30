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

-- 4. Grant explicit table permissions to anon and authenticated roles
GRANT ALL ON TABLE profiles TO anon, authenticated, service_role;
GRANT ALL ON TABLE songs TO anon, authenticated, service_role;
GRANT ALL ON TABLE setlists TO anon, authenticated, service_role;

-- 5. Disable Row Level Security (RLS) for open team sync
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE songs DISABLE ROW LEVEL SECURITY;
ALTER TABLE setlists DISABLE ROW LEVEL SECURITY;

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
