import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qplhtuxmbjyjvxzakkae.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbGh0dXhtYmp5anZ4emFra2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjYwMTYsImV4cCI6MjEwMDg0MjAxNn0.ckxexmkDSipQuG_1sF2hy7CZH_-Deiuzt1Oe2oEdA_U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: localStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});