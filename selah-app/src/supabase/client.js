import { createClient } from '@supabase/supabase-js';

// Replace with your Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// ── SQL Schema for Supabase (run in Supabase SQL Editor) ──
/*
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT,
  role TEXT DEFAULT 'worship_leader',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  artist TEXT,
  original_key TEXT,
  tempo INTEGER,
  category TEXT,
  lyrics TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE setlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  date TEXT,
  notes TEXT,
  song_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own songs" ON songs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own setlists" ON setlists
  FOR ALL USING (auth.uid() = user_id);
*/