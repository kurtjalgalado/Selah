-- ==============================================================================
-- SELAH WORSHIP PLANNER - COMPLETE SUPABASE SCHEMA & RLS MIGRATION
-- ==============================================================================
-- Safe to run in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- Fixes: Infinite recursion on profiles RLS policy by using JWT claims and SECURITY DEFINER

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Churches Table
CREATE TABLE IF NOT EXISTS churches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO churches (id, name)
VALUES ('JFCM-Mercedes', 'Jesus First Christian Ministries - Mercedes')
ON CONFLICT (id) DO NOTHING;

-- 3. Profiles Table (RBAC Roles: superuser, admin, worship_leader, worship_team_member)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  email TEXT,
  role TEXT DEFAULT 'worship_team_member',
  church_id TEXT REFERENCES churches(id) DEFAULT 'JFCM-Mercedes',
  avatar_seed TEXT,
  quick_pin TEXT,
  accent_color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure optional columns exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_pin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- Auto-create profile trigger on auth.users insertion
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role, church_id, avatar_seed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email = 'kurt.jalgalado@gmail.com' THEN 'superuser'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'worship_team_member')
    END,
    COALESCE(NEW.raw_user_meta_data->>'church_id', 'JFCM-Mercedes'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_seed', NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    username = COALESCE(profiles.username, EXCLUDED.username),
    full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
    church_id = COALESCE(profiles.church_id, EXCLUDED.church_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users in auth.users that are not yet in profiles
INSERT INTO public.profiles (id, email, username, role, church_id, avatar_seed)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data->>'username', split_part(email, '@', 1)),
  CASE 
    WHEN email = 'kurt.jalgalado@gmail.com' THEN 'superuser'
    ELSE COALESCE(raw_user_meta_data->>'role', 'worship_team_member')
  END,
  COALESCE(raw_user_meta_data->>'church_id', 'JFCM-Mercedes'),
  COALESCE(raw_user_meta_data->>'avatar_seed', raw_user_meta_data->>'username', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(profiles.username, EXCLUDED.username),
  church_id = COALESCE(profiles.church_id, EXCLUDED.church_id);

-- Discreetly ensure kurt.jalgalado@gmail.com is superuser
UPDATE profiles SET role = 'superuser' WHERE email = 'kurt.jalgalado@gmail.com';

-- 4. Songs Table (Shared Chord Library)
CREATE TABLE IF NOT EXISTS songs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT,
  original_key TEXT,
  tempo INTEGER,
  category TEXT,
  lyrics TEXT,
  language TEXT DEFAULT 'English',
  tags JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Setlists Table (Multi-tenant)
CREATE TABLE IF NOT EXISTS setlists (
  id TEXT PRIMARY KEY,
  church_id TEXT REFERENCES churches(id) DEFAULT 'JFCM-Mercedes',
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  date TEXT,
  notes TEXT,
  prepared_by TEXT,
  song_ids JSONB DEFAULT '[]'::jsonb,
  song_keys JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Minister Schedules Table (Multi-tenant Minister Scheduling)
CREATE TABLE IF NOT EXISTS minister_schedules (
  id TEXT PRIMARY KEY,
  church_id TEXT REFERENCES churches(id) DEFAULT 'JFCM-Mercedes',
  service_title TEXT NOT NULL,
  service_date TEXT NOT NULL,
  service_time TEXT DEFAULT '',
  setlist_id TEXT,
  notes TEXT DEFAULT '',
  assignments JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. User Notifications Table (Multi-tenant Team Alerts & Reminders)
CREATE TABLE IF NOT EXISTS user_notifications (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id TEXT REFERENCES churches(id) DEFAULT 'JFCM-Mercedes',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'general',
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all required columns exist
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS service_time TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS setlist_id TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS assignments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 8. Non-recursive Helper Functions
-- Uses JWT claims first; PLPGSQL with SECURITY DEFINER and search_path to prevent recursion.
CREATE OR REPLACE FUNCTION get_auth_user_church_id()
RETURNS TEXT 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_church_id TEXT;
BEGIN
  -- 1. Try JWT user_metadata first (instant, 0 DB queries, immune to recursion)
  v_church_id := (auth.jwt() -> 'user_metadata' ->> 'church_id');
  IF v_church_id IS NOT NULL AND v_church_id <> '' THEN
    RETURN v_church_id;
  END IF;

  -- 2. Fallback to profiles table (SECURITY DEFINER runs with table owner privileges)
  SELECT p.church_id INTO v_church_id FROM public.profiles p WHERE p.id = auth.uid();
  RETURN COALESCE(v_church_id, 'JFCM-Mercedes');
END;
$$;

CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT 
LANGUAGE plpgsql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_email TEXT;
BEGIN
  -- 1. Superuser shortcut directly from JWT email
  v_email := (auth.jwt() ->> 'email');
  IF v_email = 'kurt.jalgalado@gmail.com' THEN
    RETURN 'superuser';
  END IF;

  -- 2. Query profiles table FIRST (Source of truth for elevated/demoted roles)
  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  -- 3. Fallback to JWT user_metadata
  v_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  RETURN 'worship_team_member';
END;
$$;

-- 9. Privileges: Grant SELECT to anon & authenticated, ALL to authenticated & service_role
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- 10. Enable RLS on every table
ALTER TABLE churches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE minister_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications  ENABLE ROW LEVEL SECURITY;

-- 11. Clean Drop of Legacy Policies
DROP POLICY IF EXISTS "churches_read" ON churches;
DROP POLICY IF EXISTS "churches_modify" ON churches;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_church_select" ON profiles;
DROP POLICY IF EXISTS "profiles_self_modify" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

DROP POLICY IF EXISTS "songs_read" ON songs;
DROP POLICY IF EXISTS "songs_write" ON songs;
DROP POLICY IF EXISTS "songs_all" ON songs;

DROP POLICY IF EXISTS "setlists_church" ON setlists;
DROP POLICY IF EXISTS "setlists_select" ON setlists;
DROP POLICY IF EXISTS "setlists_modify" ON setlists;

DROP POLICY IF EXISTS "minister_schedules_church_select" ON minister_schedules;
DROP POLICY IF EXISTS "minister_schedules_church_modify" ON minister_schedules;
DROP POLICY IF EXISTS "minister_schedules_church_all" ON minister_schedules;

DROP POLICY IF EXISTS "user_notifications_all" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_select" ON user_notifications;
DROP POLICY IF EXISTS "user_notifications_modify" ON user_notifications;

-- 12. Recursion-Free RLS Policies

-- churches: Everyone can read; superuser can modify
CREATE POLICY "churches_read" ON churches
  FOR SELECT TO anon, authenticated 
  USING (true);

CREATE POLICY "churches_modify" ON churches
  FOR ALL TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  );

-- profiles: NO SUBQUERIES ON PROFILES (Eliminates infinite recursion completely)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  )
  WITH CHECK (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  );

-- Guard Trigger: Non-superusers cannot modify roles (prevents client syncs or demotions reverting)
CREATE OR REPLACE FUNCTION public.handle_profile_role_guard()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF (auth.jwt() ->> 'email') <> 'kurt.jalgalado@gmail.com' AND get_auth_user_role() <> 'superuser' THEN
      -- Silently preserve the existing role
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_profile_role_guard();

-- Sync Trigger: Sync role updates in profiles to auth.users raw_user_meta_data so new JWTs reflect changes
CREATE OR REPLACE FUNCTION public.sync_profile_role_to_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(NEW.role)
    )
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_role ON profiles;
CREATE TRIGGER trg_sync_profile_role
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_role_to_auth_user();


-- songs: Shared library with author and superuser write access
CREATE POLICY "songs_read" ON songs
  FOR SELECT TO anon, authenticated 
  USING (true);

CREATE POLICY "songs_write" ON songs
  FOR ALL TO authenticated
  USING (
    created_by = auth.uid() OR 
    created_by IS NULL OR 
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR 
    get_auth_user_role() IN ('superuser', 'admin')
  )
  WITH CHECK (
    created_by = auth.uid() OR 
    created_by IS NULL OR 
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR 
    get_auth_user_role() IN ('superuser', 'admin')
  );

-- setlists: Multi-tenant isolated by church
CREATE POLICY "setlists_select" ON setlists
  FOR SELECT TO anon, authenticated
  USING (
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    church_id IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  );

CREATE POLICY "setlists_modify" ON setlists
  FOR ALL TO authenticated
  USING (
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    church_id IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  )
  WITH CHECK (
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    church_id IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  );

-- minister_schedules: Multi-tenant isolated by church
CREATE POLICY "minister_schedules_church_all" ON minister_schedules
  FOR ALL TO anon, authenticated
  USING (
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    church_id IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  )
  WITH CHECK (
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    church_id IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  );

-- user_notifications: User & Church isolated
CREATE POLICY "user_notifications_all" ON user_notifications
  FOR ALL TO anon, authenticated
  USING (
    user_id = auth.uid() OR
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  )
  WITH CHECK (
    user_id = auth.uid() OR
    church_id = get_auth_user_church_id() OR
    church_id = 'JFCM-Mercedes' OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com'
  );

-- 13. Enable Full Replica Identity for Realtime Payloads
ALTER TABLE churches            REPLICA IDENTITY FULL;
ALTER TABLE profiles            REPLICA IDENTITY FULL;
ALTER TABLE songs               REPLICA IDENTITY FULL;
ALTER TABLE setlists            REPLICA IDENTITY FULL;
ALTER TABLE minister_schedules  REPLICA IDENTITY FULL;
ALTER TABLE user_notifications  REPLICA IDENTITY FULL;

-- 14. Realtime Publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE churches;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE songs;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE setlists;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE minister_schedules;
  EXCEPTION WHEN duplicate_object THEN END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications;
  EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- 15. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
