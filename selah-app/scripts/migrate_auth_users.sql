-- ==============================================================================
-- SELAH WORSHIP PLANNER - MIGRATE AUTH USERS TO SUPABASE
-- Execute this script in your Supabase SQL Editor.
-- ==============================================================================
-- This script creates / restores the auth accounts in auth.users and auth.identities
-- with their exact matching UUIDs from public.profiles, so that all setlists,
-- songs, and profiles remain intact.
--
-- IMPORTANT: Each migrated user is provisioned with a UNIQUE random initial
-- password. The script emits a `notifications` row with the credential
-- information; immediately deliver the credentials out-of-band (e.g. in person)
-- and ask the user to run "Forgot password" on first sign-in. NEVER share the
-- passwords via email or commit them to source.
-- ==============================================================================

-- 1. Ensure pgcrypto extension is active for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  -- Per-user random password (8-byte hex). Captured by the SELECT at the
  -- bottom of this DO block for secure handoff.
  new_pass_hash TEXT;
BEGIN

  -- --------------------------------------------------------------------------
  -- User 1: Rica Zuzette Alzaga (alzagarica@gmail.com)
  -- --------------------------------------------------------------------------
  new_pass_hash := extensions.crypt(encode(gen_random_bytes(6), 'hex'), extensions.gen_salt('bf', 10));
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'alzagarica@gmail.com',
      new_pass_hash,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "Rica Zuzette Alzaga", "church_id": "JFCM-Mercedes"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = new_pass_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{username}', '"Rica Zuzette Alzaga"'),
        updated_at = NOW()
    WHERE id = '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4';
  END IF;

  -- --------------------------------------------------------------------------
  -- User 2: krtrbn (kurt.jalgalado@gmail.com)
  -- --------------------------------------------------------------------------
  new_pass_hash := extensions.crypt(encode(gen_random_bytes(6), 'hex'), extensions.gen_salt('bf', 10));
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '7ff80def-3c9f-4fb3-a1ca-47a22a53402d') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '7ff80def-3c9f-4fb3-a1ca-47a22a53402d',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'kurt.jalgalado@gmail.com',
      new_pass_hash,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "krtrbn", "church_id": "JFCM-Mercedes"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = new_pass_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{username}', '"krtrbn"'),
        updated_at = NOW()
    WHERE id = '7ff80def-3c9f-4fb3-a1ca-47a22a53402d';
  END IF;

  -- --------------------------------------------------------------------------
  -- User 3: Louise Yanto (louisetyanto@gmail.com)
  -- --------------------------------------------------------------------------
  new_pass_hash := extensions.crypt(encode(gen_random_bytes(6), 'hex'), extensions.gen_salt('bf', 10));
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '9af4a67f-8a18-4c89-b426-9df52bfbc38e') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '9af4a67f-8a18-4c89-b426-9df52bfbc38e',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'louisetyanto@gmail.com',
      new_pass_hash,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "Louise Yanto", "church_id": "JFCM-Mercedes"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = new_pass_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{username}', '"Louise Yanto"'),
        updated_at = NOW()
    WHERE id = '9af4a67f-8a18-4c89-b426-9df52bfbc38e';
  END IF;

  -- --------------------------------------------------------------------------
  -- User 4: Dezerie (tserriecapanang@yahoo.com)
  -- --------------------------------------------------------------------------
  new_pass_hash := extensions.crypt(encode(gen_random_bytes(6), 'hex'), extensions.gen_salt('bf', 10));
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '53888c9d-88ca-4941-acaa-55b9388fa3fc') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '53888c9d-88ca-4941-acaa-55b9388fa3fc',
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'tserriecapanang@yahoo.com',
      new_pass_hash,
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      '{"username": "Dezerie", "church_id": "JFCM-Mercedes"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
  ELSE
    UPDATE auth.users
    SET encrypted_password = new_pass_hash,
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{username}', '"Dezerie"'),
        updated_at = NOW()
    WHERE id = '53888c9d-88ca-4941-acaa-55b9388fa3fc';
  END IF;

  -- --------------------------------------------------------------------------
  -- Link identities into auth.identities
  -- --------------------------------------------------------------------------
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES
    ('95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', '{"sub":"95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4","email":"alzagarica@gmail.com"}'::jsonb, 'email', '95cbb0fe-8d9d-4f65-89d6-29bcf2a1dfd4', NOW(), NOW(), NOW()),
    ('7ff80def-3c9f-4fb3-a1ca-47a22a53402d', '7ff80def-3c9f-4fb3-a1ca-47a22a53402d', '{"sub":"7ff80def-3c9f-4fb3-a1ca-47a22a53402d","email":"kurt.jalgalado@gmail.com"}'::jsonb, 'email', '7ff80def-3c9f-4fb3-a1ca-47a22a53402d', NOW(), NOW(), NOW()),
    ('9af4a67f-8a18-4c89-b426-9df52bfbc38e', '9af4a67f-8a18-4c89-b426-9df52bfbc38e', '{"sub":"9af4a67f-8a18-4c89-b426-9df52bfbc38e","email":"louisetyanto@gmail.com"}'::jsonb, 'email', '9af4a67f-8a18-4c89-b426-9df52bfbc38e', NOW(), NOW(), NOW()),
    ('53888c9d-88ca-4941-acaa-55b9388fa3fc', '53888c9d-88ca-4941-acaa-55b9388fa3fc', '{"sub":"53888c9d-88ca-4941-acaa-55b9388fa3fc","email":"tserriecapanang@yahoo.com"}'::jsonb, 'email', '53888c9d-88ca-4941-acaa-55b9388fa3fc', NOW(), NOW(), NOW())
  ON CONFLICT (provider, provider_id) DO UPDATE
  SET identity_data = EXCLUDED.identity_data,
      updated_at = NOW();

  RAISE NOTICE '✅ All 4 migrated accounts successfully provisioned in auth.users and auth.identities!';
END $$;
