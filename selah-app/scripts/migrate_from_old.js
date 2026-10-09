import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// Read credentials from a local .env (this file is git-ignored) so that
// no secrets live in committed source. Copy `.env.example` to `.env` and
// add the four SUPABASE_OLD_* / SUPABASE_NEW_* keys before running.

function loadEnv(path) {
    try {
        const out = {};
        for (const line of readFileSync(path, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
            if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
        }
        return out;
    } catch {
        return {};
    }
}

const env = { ...loadEnv('.env'), ...loadEnv('scripts/.migrate.env') };
const oldUrl = env.SUPABASE_OLD_URL;
const oldKey = env.SUPABASE_OLD_SERVICE_KEY;
const newUrl = env.SUPABASE_NEW_URL || env.VITE_SUPABASE_URL;
const newKey = env.SUPABASE_NEW_SERVICE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!oldUrl || !oldKey || !newUrl || !newKey) {
    throw new Error(
        '[migrate_from_old] Missing credentials. Set SUPABASE_OLD_URL, ' +
        'SUPABASE_OLD_SERVICE_KEY, SUPABASE_NEW_URL, SUPABASE_NEW_SERVICE_KEY ' +
        'in selah-app/.env (or scripts/.migrate.env).'
    );
}

const oldClient = createClient(oldUrl, oldKey);
const newClient = createClient(newUrl, newKey);

async function runMigration() {
  console.log('🚀 Starting Data Migration to New Supabase Database...\n');

  try {
    // 1. Fetch from Old DB
    console.log('📦 1. Fetching data from previous Supabase instance...');
    const { data: profiles, error: pFetchErr } = await oldClient.from('profiles').select('*');
    const { data: setlists, error: setFetchErr } = await oldClient.from('setlists').select('*');
    const { data: songs, error: sFetchErr } = await oldClient.from('songs').select('*');

    if (pFetchErr || setFetchErr || sFetchErr) {
      console.warn('⚠️ Warning during fetch:', { pFetchErr, setFetchErr, sFetchErr });
    }

    console.log(`   - Profiles found: ${profiles?.length || 0}`);
    console.log(`   - Setlists found: ${setlists?.length || 0}`);
    console.log(`   - Songs found: ${songs?.length || 0}\n`);

    // 2. Ensure JFCM-Mercedes Church in New DB
    console.log('⛪ 2. Seeding default Church tenancy (JFCM-Mercedes)...');
    const { error: chErr } = await newClient.from('churches').upsert({
      id: 'JFCM-Mercedes',
      name: 'JFCM - Mercedes',
      created_at: new Date().toISOString()
    });
    if (chErr) {
      console.error('❌ Church tenancy insertion failed:', chErr.message);
      console.error('👉 Make sure you have executed the updated supabase_schema.sql in your Supabase SQL Editor!');
      return;
    }
    console.log('   ✅ JFCM-Mercedes church ready.\n');

    // 3. Migrate Profiles
    if (profiles && profiles.length > 0) {
      console.log(`👥 3. Migrating ${profiles.length} user profiles...`);
      const formattedProfiles = profiles.map(p => ({
        id: p.id,
        church_id: p.church_id || 'JFCM-Mercedes',
        username: p.username,
        email: p.email,
        role: p.role || 'worship_leader',
        quick_pin: p.quick_pin || null,
        accent_color: p.accent_color || null,
        created_at: p.created_at,
        updated_at: p.updated_at || new Date().toISOString()
      }));
      const { error: pErr } = await newClient.from('profiles').upsert(formattedProfiles);
      if (pErr) console.error('   ❌ Profiles error:', pErr.message);
      else console.log('   ✅ Profiles migrated successfully.');
    }

    // 4. Migrate Setlists
    if (setlists && setlists.length > 0) {
      console.log(`📅 4. Migrating ${setlists.length} setlists...`);
      const formattedSetlists = setlists.map(s => ({
        id: String(s.id),
        church_id: s.church_id || 'JFCM-Mercedes',
        user_id: s.user_id,
        title: s.title,
        date: s.date,
        notes: s.notes,
        prepared_by: s.prepared_by,
        song_ids: s.song_ids || [],
        song_keys: s.song_keys || {},
        created_at: s.created_at,
        updated_at: s.updated_at || new Date().toISOString()
      }));
      const { error: setErr } = await newClient.from('setlists').upsert(formattedSetlists);
      if (setErr) console.error('   ❌ Setlists error:', setErr.message);
      else console.log('   ✅ Setlists migrated successfully.');
    }

    // 5. Migrate Songs
    if (songs && songs.length > 0) {
      console.log(`🎵 5. Migrating ${songs.length} songs...`);
      const formattedSongs = songs.map(s => ({
        id: String(s.id),
        user_id: s.user_id,
        title: s.title,
        artist: s.artist,
        original_key: s.original_key,
        tempo: s.tempo,
        category: s.category,
        lyrics: s.lyrics,
        created_at: s.created_at,
        updated_at: s.updated_at || new Date().toISOString()
      }));
      const { error: sErr } = await newClient.from('songs').upsert(formattedSongs);
      if (sErr) console.error('   ❌ Songs error:', sErr.message);
      else console.log('   ✅ Songs migrated successfully.');
    }

    console.log('\n🎉 --- Migration Complete! ---');
  } catch (e) {
    console.error('Fatal migration error:', e);
  }
}

runMigration();
