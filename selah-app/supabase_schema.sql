-- ==============================================================================
-- SELAH WORSHIP PLANNER - COMPLETE SUPABASE SCHEMA & ACCOUNT AUTHENTICATION FIX
-- ==============================================================================
-- Run this in your Supabase Dashboard:
-- https://hbcfvixqrwrckcbtghwn.supabase.co/project/_/sql (or your Supabase SQL Editor)
--
-- Fixes:
-- 1. "Email not confirmed": Installs auto-confirm trigger on auth.users and confirms all accounts.
-- 2. "Invalid login credentials" / Account lockouts: Provisions all 6 worship team accounts
--    in auth.users and auth.identities with matching UUIDs and initial password "Selah2026!".
-- 3. Registration: Enables church and profile creation for new signups without RLS blockage.
-- 4. Infinite Recursion: Zero recursive subqueries using JWT claims and SECURITY DEFINER.
-- ==============================================================================

BEGIN;

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Churches Table (Multi-tenancy)
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

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS quick_pin TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS accent_color TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_seed TEXT;

-- 4. Auto-Confirm Trigger for auth.users
-- Fixes "Email not confirmed" error on newly registered or imported users
CREATE OR REPLACE FUNCTION public.handle_auto_confirm_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    NEW.email_confirmed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_confirm_user ON auth.users;
CREATE TRIGGER trg_auto_confirm_user
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auto_confirm_user();

-- Auto-confirm all existing users in auth.users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 5. Auto-Create Profile Trigger for auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-create church tenancy if client provided a new church_id
  IF NEW.raw_user_meta_data->>'church_id' IS NOT NULL THEN
    INSERT INTO public.churches (id, name)
    VALUES (
      NEW.raw_user_meta_data->>'church_id',
      COALESCE(NEW.raw_user_meta_data->>'church_name', NEW.raw_user_meta_data->>'church_id')
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

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

-- 6. Provision All 6 Worship Team Accounts in auth.users & auth.identities
-- Initial Password for all 6 accounts: Selah2026!
-- (Users can change their password immediately in the app's Profile settings)
DO $$
DECLARE
  v_pass_hash TEXT;
BEGIN
  v_pass_hash := extensions.crypt('Selah2026!', extensions.gen_salt('bf', 10));

  -- 1) Kurt Robin Jalgalado (Superuser)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '7ff80def-3c9f-4fb3-a1ca-47a22a53402d',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'kurt.jalgalado@gmail.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Kurt Robin Jalgalado", "full_name": "Kurt Robin Jalgalado", "church_id": "JFCM-Mercedes", "role": "superuser"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 2) Christian Reyes (Admin)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '14bdbd15-7bb0-47d2-817a-17b79250b28f',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'christianuyreyes@gmail.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Christian Reyes", "full_name": "Christian Reyes", "church_id": "JFCM-Mercedes", "role": "admin"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 3) Louise Yanto (Worship Leader)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '9af4a67f-8a18-4c89-b426-9df52bfbc38e',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'louisetyanto@gmail.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Louise Yanto", "full_name": "Louise Yanto", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 4) Dezerie (Worship Leader)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '53888c9d-88ca-4941-acaa-55b9388fa3fc',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'tserriecapanang@yahoo.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Dezerie", "full_name": "Dezerie", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 5) Rica Zuzette Alzaga (Worship Team Member)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'alzagarica@gmail.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Rica Zuzette Alzaga", "full_name": "Rica Zuzette Alzaga", "church_id": "JFCM-Mercedes", "role": "worship_team_member"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- 6) Maria anna (Worship Leader)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '71835e00-0de7-4ea1-8997-cace9f519e56',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'annateope320@gmail.com',
    v_pass_hash,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Maria anna", "full_name": "Maria anna", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(),
    NOW(),
    '', '', '', ''
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    encrypted_password = EXCLUDED.encrypted_password,
    email_confirmed_at = NOW(),
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = NOW();

  -- Link auth.identities
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES
    ('7ff80def-3c9f-4fb3-a1ca-47a22a53402d', '7ff80def-3c9f-4fb3-a1ca-47a22a53402d', '{"sub":"7ff80def-3c9f-4fb3-a1ca-47a22a53402d","email":"kurt.jalgalado@gmail.com"}'::jsonb, 'email', '7ff80def-3c9f-4fb3-a1ca-47a22a53402d', NOW(), NOW(), NOW()),
    ('14bdbd15-7bb0-47d2-817a-17b79250b28f', '14bdbd15-7bb0-47d2-817a-17b79250b28f', '{"sub":"14bdbd15-7bb0-47d2-817a-17b79250b28f","email":"christianuyreyes@gmail.com"}'::jsonb, 'email', '14bdbd15-7bb0-47d2-817a-17b79250b28f', NOW(), NOW(), NOW()),
    ('9af4a67f-8a18-4c89-b426-9df52bfbc38e', '9af4a67f-8a18-4c89-b426-9df52bfbc38e', '{"sub":"9af4a67f-8a18-4c89-b426-9df52bfbc38e","email":"louisetyanto@gmail.com"}'::jsonb, 'email', '9af4a67f-8a18-4c89-b426-9df52bfbc38e', NOW(), NOW(), NOW()),
    ('53888c9d-88ca-4941-acaa-55b9388fa3fc', '53888c9d-88ca-4941-acaa-55b9388fa3fc', '{"sub":"53888c9d-88ca-4941-acaa-55b9388fa3fc","email":"tserriecapanang@yahoo.com"}'::jsonb, 'email', '53888c9d-88ca-4941-acaa-55b9388fa3fc', NOW(), NOW(), NOW()),
    ('95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', '{"sub":"95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4","email":"alzagarica@gmail.com"}'::jsonb, 'email', '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', NOW(), NOW(), NOW()),
    ('71835e00-0de7-4ea1-8997-cace9f519e56', '71835e00-0de7-4ea1-8997-cace9f519e56', '{"sub":"71835e00-0de7-4ea1-8997-cace9f519e56","email":"annateope320@gmail.com"}'::jsonb, 'email', '71835e00-0de7-4ea1-8997-cace9f519e56', NOW(), NOW(), NOW())
  ON CONFLICT (provider, provider_id) DO UPDATE SET
    identity_data = EXCLUDED.identity_data,
    updated_at = NOW();

END $$;

-- 7. Ensure Public Profiles Table Contains All 6 Team Members
INSERT INTO public.profiles (id, email, username, full_name, role, church_id, avatar_seed)
VALUES
  ('7ff80def-3c9f-4fb3-a1ca-47a22a53402d', 'kurt.jalgalado@gmail.com', 'Kurt Robin Jalgalado', 'Kurt Robin Jalgalado', 'superuser', 'JFCM-Mercedes', 'Felix'),
  ('14bdbd15-7bb0-47d2-817a-17b79250b28f', 'christianuyreyes@gmail.com', 'Christian Reyes', 'Christian Reyes', 'admin', 'JFCM-Mercedes', 'David'),
  ('9af4a67f-8a18-4c89-b426-9df52bfbc38e', 'louisetyanto@gmail.com', 'Louise Yanto', 'Louise Yanto', 'worship_leader', 'JFCM-Mercedes', 'Grace'),
  ('53888c9d-88ca-4941-acaa-55b9388fa3fc', 'tserriecapanang@yahoo.com', 'Dezerie', 'Dezerie', 'worship_leader', 'JFCM-Mercedes', 'Joy'),
  ('95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', 'alzagarica@gmail.com', 'Rica Zuzette Alzaga', 'Rica Zuzette Alzaga', 'worship_team_member', 'JFCM-Mercedes', 'Sarah'),
  ('71835e00-0de7-4ea1-8997-cace9f519e56', 'annateope320@gmail.com', 'Maria anna', 'Maria anna', 'worship_leader', 'JFCM-Mercedes', 'Hannah')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  username = COALESCE(profiles.username, EXCLUDED.username),
  full_name = COALESCE(profiles.full_name, EXCLUDED.full_name),
  role = EXCLUDED.role,
  church_id = COALESCE(profiles.church_id, EXCLUDED.church_id);

-- 8. Songs Table (Shared Chord Library)
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

-- 9. Setlists Table (Multi-tenant)
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

-- 10. Minister Schedules Table (Multi-tenant)
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

ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS service_time TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS setlist_id TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE minister_schedules ADD COLUMN IF NOT EXISTS assignments JSONB DEFAULT '[]'::jsonb;

-- 11. User Notifications Table (Multi-tenant)
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

ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'general';
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;

-- 12. Non-recursive RBAC Helper Functions
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
  v_church_id := (auth.jwt() -> 'user_metadata' ->> 'church_id');
  IF v_church_id IS NOT NULL AND v_church_id <> '' THEN
    RETURN v_church_id;
  END IF;

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
  v_email := (auth.jwt() ->> 'email');
  IF v_email = 'kurt.jalgalado@gmail.com' THEN
    RETURN 'superuser';
  END IF;

  SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  v_role := (auth.jwt() -> 'user_metadata' ->> 'role');
  IF v_role IS NOT NULL AND v_role <> '' THEN
    RETURN v_role;
  END IF;

  RETURN 'worship_team_member';
END;
$$;

-- 13. Grants
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;

-- 14. Enable Row Level Security (RLS)
ALTER TABLE churches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists            ENABLE ROW LEVEL SECURITY;
ALTER TABLE minister_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notifications  ENABLE ROW LEVEL SECURITY;

-- 15. Drop Legacy Policies Cleanly
DROP POLICY IF EXISTS "churches_read" ON churches;
DROP POLICY IF EXISTS "churches_modify" ON churches;
DROP POLICY IF EXISTS "churches_insert" ON churches;

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

-- 16. Install Clean, Non-recursive Policies

-- churches
CREATE POLICY "churches_read" ON churches
  FOR SELECT TO anon, authenticated 
  USING (true);

CREATE POLICY "churches_insert" ON churches
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "churches_modify" ON churches
  FOR UPDATE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    get_auth_user_role() = 'superuser'
  );

-- profiles
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    id = auth.uid() OR
    auth.uid() IS NULL OR
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

-- Guard Trigger: Non-superusers cannot escalate their role
CREATE OR REPLACE FUNCTION public.handle_profile_role_guard()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF (auth.jwt() ->> 'email') <> 'kurt.jalgalado@gmail.com' AND get_auth_user_role() <> 'superuser' THEN
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

-- Sync Trigger: Sync role updates in profiles to auth.users raw_user_meta_data
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

-- songs
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

-- setlists
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

-- minister_schedules
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

-- user_notifications
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

-- 17. Realtime Replica Identity & Publication
ALTER TABLE churches            REPLICA IDENTITY FULL;
ALTER TABLE profiles            REPLICA IDENTITY FULL;
ALTER TABLE songs               REPLICA IDENTITY FULL;
ALTER TABLE setlists            REPLICA IDENTITY FULL;
ALTER TABLE minister_schedules  REPLICA IDENTITY FULL;
ALTER TABLE user_notifications  REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE churches; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE profiles; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE songs; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE setlists; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE minister_schedules; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE user_notifications; EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- 18. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
