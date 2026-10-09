-- ==============================================================================
-- IMMEDIATE FIX: ACCOUNTS LOGIN & SUPABASE AUTH AUTO-CONFIRM
-- ==============================================================================
-- Copy & paste this directly into Supabase Dashboard -> SQL Editor -> Run:
-- https://hbcfvixqrwrckcbtghwn.supabase.co/project/_/sql
--
-- What this does:
-- 1. Installs an auto-confirm trigger on auth.users so new and existing signups
--    are immediately confirmed without requiring email confirmation links.
-- 2. Provisions/Updates all 6 worship team accounts in auth.users and auth.identities
--    with initial password "Selah2026!" and matching UUIDs, ensuring existing
--    setlists, songs, and schedules stay connected.
-- 3. Configures non-recursive RLS policies across all tables.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Auto-Confirm Trigger for auth.users
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

-- 2. Auto-Create Profile Trigger for auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

-- 3. Provision / Reset Accounts in auth.users & auth.identities
-- Initial Password: Selah2026!
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
    'authenticated', 'authenticated', 'kurt.jalgalado@gmail.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Kurt Robin Jalgalado", "full_name": "Kurt Robin Jalgalado", "church_id": "JFCM-Mercedes", "role": "superuser"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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
    'authenticated', 'authenticated', 'christianuyreyes@gmail.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Christian Reyes", "full_name": "Christian Reyes", "church_id": "JFCM-Mercedes", "role": "admin"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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
    'authenticated', 'authenticated', 'louisetyanto@gmail.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Louise Yanto", "full_name": "Louise Yanto", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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
    'authenticated', 'authenticated', 'tserriecapanang@yahoo.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Dezerie", "full_name": "Dezerie", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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
    'authenticated', 'authenticated', 'alzagarica@gmail.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Rica Zuzette Alzaga", "full_name": "Rica Zuzette Alzaga", "church_id": "JFCM-Mercedes", "role": "worship_team_member"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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
    'authenticated', 'authenticated', 'annateope320@gmail.com', v_pass_hash, NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"username": "Maria anna", "full_name": "Maria anna", "church_id": "JFCM-Mercedes", "role": "worship_leader"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
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

-- 4. Sync Profiles Table
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

-- 5. Set up clean RLS policies for profiles & churches
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    id = auth.uid() OR
    auth.uid() IS NULL OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  );

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  )
  WITH CHECK (
    id = auth.uid() OR
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  );

CREATE POLICY "profiles_delete" ON profiles
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser'
  );

-- churches permissions
DROP POLICY IF EXISTS "churches_read" ON churches;
DROP POLICY IF EXISTS "churches_insert" ON churches;
DROP POLICY IF EXISTS "churches_modify" ON churches;

CREATE POLICY "churches_read" ON churches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "churches_insert" ON churches FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "churches_modify" ON churches FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser')
  WITH CHECK ((auth.jwt() ->> 'email') = 'kurt.jalgalado@gmail.com' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'superuser');

NOTIFY pgrst, 'reload schema';

COMMIT;
