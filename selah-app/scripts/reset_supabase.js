import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qplhtuxmbjyjvxzakkae.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwbGh0dXhtYmp5anZ4emFra2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjYwMTYsImV4cCI6MjEwMDg0MjAxNn0.ckxexmkDSipQuG_1sF2hy7CZH_-Deiuzt1Oe2oEdA_U';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function resetSupabase() {
    console.log('Resetting Supabase database tables...');

    try {
        // Delete all setlists
        const { error: err1 } = await supabase.from('setlists').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('Setlists clear result:', err1 ? err1.message : 'SUCCESS');

        // Delete all songs
        const { error: err2 } = await supabase.from('songs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('Songs clear result:', err2 ? err2.message : 'SUCCESS');

        // Delete all profiles
        const { error: err3 } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        console.log('Profiles clear result:', err3 ? err3.message : 'SUCCESS');

        console.log('Supabase database reset operation completed.');
    } catch (err) {
        console.error('Error resetting database:', err);
    }
}

resetSupabase();
