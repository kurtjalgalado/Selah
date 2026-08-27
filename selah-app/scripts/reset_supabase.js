import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://qplhtuxmbjyjvxzakkae.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseAnonKey) {
    console.error('Error: VITE_SUPABASE_ANON_KEY environment variable is required.');
    process.exit(1);
}

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
