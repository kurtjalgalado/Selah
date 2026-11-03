-- ============================================================================
-- SELAH WORSHIP PLANNER - NOTIFICATION PREFERENCES & REMINDERS MIGRATION
-- ============================================================================

-- 1. Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  church_id TEXT REFERENCES public.churches(id) DEFAULT 'JFCM-Mercedes',
  in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add preference columns to profiles as instant fallback & migration ease
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT TRUE;

-- 3. Add status column to setlists for Sunday noon auto-completion
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 4. Minister Reminder Logs (Durable audit & idempotency log for scheduled reminder emails)
CREATE TABLE IF NOT EXISTS public.minister_reminder_logs (
  id TEXT PRIMARY KEY, -- Idempotency key: e.g. remind_1d_<schedule_id>_<assignment_id>_<service_date>
  schedule_id TEXT,
  minister_id TEXT,
  minister_email TEXT,
  service_date TEXT,
  service_time TEXT,
  role TEXT,
  status TEXT NOT NULL, -- 'pending', 'sent', 'suppressed', 'failed'
  suppression_reason TEXT,
  error_message TEXT,
  notes TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. RLS Policies for notification_preferences
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_preferences_all" ON public.notification_preferences;
CREATE POLICY "notification_preferences_all" ON public.notification_preferences
  FOR ALL TO authenticated, anon
  USING (
    user_id = auth.uid() OR
    auth.role() = 'service_role' OR
    get_auth_user_role() IN ('superuser', 'admin')
  )
  WITH CHECK (
    user_id = auth.uid() OR
    auth.role() = 'service_role' OR
    get_auth_user_role() IN ('superuser', 'admin')
  );

-- 6. RLS Policies for minister_reminder_logs
ALTER TABLE public.minister_reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minister_reminder_logs_all" ON public.minister_reminder_logs;
CREATE POLICY "minister_reminder_logs_all" ON public.minister_reminder_logs
  FOR ALL TO authenticated, anon
  USING (
    auth.role() = 'service_role' OR
    get_auth_user_role() IN ('superuser', 'admin', 'worship_leader') OR
    minister_id = auth.uid()::text
  )
  WITH CHECK (
    auth.role() = 'service_role' OR
    get_auth_user_role() IN ('superuser', 'admin', 'worship_leader')
  );

-- 7. Realtime Replica Identity & Publication
ALTER TABLE public.notification_preferences REPLICA IDENTITY FULL;
ALTER TABLE public.minister_reminder_logs    REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_preferences; EXCEPTION WHEN duplicate_object THEN END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.minister_reminder_logs; EXCEPTION WHEN duplicate_object THEN END;
END $$;

-- 8. Seed default notification preferences for all existing users
INSERT INTO public.notification_preferences (user_id, church_id, in_app_enabled, email_enabled, push_enabled)
SELECT 
  p.id, 
  COALESCE(p.church_id, 'JFCM-Mercedes'), 
  COALESCE(p.in_app_enabled, TRUE), 
  COALESCE(p.email_enabled, TRUE), 
  COALESCE(p.push_enabled, TRUE)
FROM public.profiles p
ON CONFLICT (user_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
