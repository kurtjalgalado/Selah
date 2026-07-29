import { supabase } from './client';
import { db } from '../db/dexie';

let realtimeChannel = null;
let backgroundSyncTimer = null;

export async function migrateDataToSupabase(user) {
    if (!user) return;
    try {
        // Migrate local setlists to Supabase
        const localSetlists = await db.setlists.toArray();
        if (localSetlists && localSetlists.length > 0) {
            const setlistsToInsert = localSetlists.map(list => ({
                id: list.id ? String(list.id) : crypto.randomUUID(),
                user_id: user.id,
                title: list.title,
                date: list.date,
                notes: list.notes,
                prepared_by: list.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
                song_ids: list.songIds || [],
                song_keys: typeof list.songKeys === 'string' ? JSON.parse(list.songKeys) : (list.songKeys || {}),
                updated_at: new Date().toISOString()
            }));
            await supabase.from('setlists').upsert(setlistsToInsert);
        }
    } catch (err) {
        // Silent catch
    }
}

async function syncSetlistToDexie(list) {
    if (!list || !list.title) return;
    const songKeysObj = typeof list.song_keys === 'string'
        ? JSON.parse(list.song_keys)
        : (list.song_keys || list.songKeys || {});

    await db.setlists.put({
        id: list.id,
        title: list.title,
        date: list.date,
        notes: list.notes,
        preparedBy: list.prepared_by || list.preparedBy || 'Worship Leader',
        songIds: list.song_ids || list.songIds || [],
        songKeys: songKeysObj,
        created: list.created_at || new Date().toISOString()
    });
}

// ── Discreet Background Hydration ──
export async function discreetBackgroundSync() {
    try {
        const { data: remoteSetlists, error: setlistErr } = await supabase.from('setlists').select('*');
        if (!setlistErr && remoteSetlists && remoteSetlists.length > 0) {
            for (const list of remoteSetlists) {
                await syncSetlistToDexie(list);
            }
        }
    } catch (err) {
        // Silent catch
    }
}

export async function initRealtimeSync(user) {
    if (!user) {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
        if (backgroundSyncTimer) {
            clearInterval(backgroundSyncTimer);
            backgroundSyncTimer = null;
        }
        return;
    }

    // 1. Sync User Profile / Account info across devices
    try {
        await supabase.from('profiles').upsert({
            id: user.id,
            username: user.user_metadata?.username || user.user_metadata?.full_name || user.email?.split('@')[0],
            email: user.email,
            role: 'worship_leader',
            created_at: new Date().toISOString()
        });
    } catch (err) {
        // Silent catch
    }

    // 2. Data Migration: Push local setlists (including songIds, songKeys, title, date, creator)
    await migrateDataToSupabase(user);

    // 3. Initial fetch & hydration for setlists
    await discreetBackgroundSync();

    // 4. Start background sync interval every 30 seconds
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    backgroundSyncTimer = setInterval(() => {
        discreetBackgroundSync();
    }, 30000);

    // 5. Subscribe to Supabase Realtime changes for setlists across accounts & devices
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase.channel('public:selah_collaborative')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'setlists' }, async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await syncSetlistToDexie(payload.new);
            } else if (payload.eventType === 'DELETE') {
                await db.setlists.delete(payload.old.id);
            }
        })
        .subscribe();
}

// ── Auto sync when internet connection is restored ──
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        const user = supabase.auth.getUser();
        if (user) {
            initRealtimeSync(user);
        }
    });
}

// ── Helpers to push local user setlist actions to Supabase ──
export async function pushSetlistToSupabase(setlist, user) {
    if (!user) return;
    try {
        const songKeysObj = typeof setlist.songKeys === 'string'
            ? JSON.parse(setlist.songKeys)
            : (setlist.songKeys || {});

        await supabase.from('setlists').upsert({
            id: String(setlist.id),
            user_id: user.id,
            title: setlist.title,
            date: setlist.date,
            notes: setlist.notes,
            prepared_by: setlist.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
            song_ids: setlist.songIds || [],
            song_keys: songKeysObj,
            updated_at: new Date().toISOString()
        });
    } catch (err) {
        // Silent catch
    }
}

export async function deleteSetlistFromSupabase(setlistId, user) {
    if (!user) return;
    try {
        await supabase.from('setlists').delete().eq('id', String(setlistId));
    } catch (err) {
        // Silent catch
    }
}

export async function pushSongToSupabase(song, user) {
    // Song lyrics pull from local seed / Dexie
}

export async function deleteSongFromSupabase(songId, user) {
    // Song lyrics pull from local seed / Dexie
}
