-- ==============================================================================
-- IMMEDIATE FIX: INFINITE RECURSION ON PROFILES POLICY & RBAC ROLE SYNC
-- ==============================================================================
-- Copy & paste this directly into Supabase Dashboard -> SQL Editor -> Run
-- This drops the recursive self-referential subquery, installs recursion-free policies,
-- queries profiles table first for RBAC roles, and installs role guard + sync triggers.

BEGIN;

-- 1. Helper functions with SECURITY DEFINER to avoid policy recursion
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

-- 2. Drop the recursive policy and legacy policies on profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_church_select" ON profiles;
DROP POLICY IF EXISTS "profiles_self_modify" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;

-- 3. Create recursion-free profiles policies
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

-- Guard Trigger: Non-superusers cannot modify roles (prevents client syncs or unauthorized updates from reverting roles)
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

-- 4. Refresh other table policies for zero recursion
DROP POLICY IF EXISTS "songs_write" ON songs;
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

DROP POLICY IF EXISTS "setlists_modify" ON setlists;
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

DROP POLICY IF EXISTS "minister_schedules_church_all" ON minister_schedules;
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

DROP POLICY IF EXISTS "user_notifications_all" ON user_notifications;
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

-- 5. Replica Identity
ALTER TABLE churches            REPLICA IDENTITY FULL;
ALTER TABLE profiles            REPLICA IDENTITY FULL;
ALTER TABLE songs               REPLICA IDENTITY FULL;
ALTER TABLE setlists            REPLICA IDENTITY FULL;
ALTER TABLE minister_schedules  REPLICA IDENTITY FULL;
ALTER TABLE user_notifications  REPLICA IDENTITY FULL;

-- 6. Reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;
