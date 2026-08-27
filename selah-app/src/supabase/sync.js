import { supabase } from './client';
import { db } from '../db/dexie';
import { sendSystemNotification } from '../utils/notifications';

let realtimeChannel = null;
let backgroundSyncTimer = null;

// ── Retry with exponential backoff ──
async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn();
      if (res && res.error) {
        throw res.error;
      }
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      const backoff = delay * Math.pow(2, i) + Math.random() * delay;
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

// ── Queue failed operations to Dexie syncQueue ──
async function queueFailedOperation(operation) {
  try {
    await db.syncQueue.put({
      id: crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`,
      operation,
      createdAt: new Date().toISOString(),
      retries: 0,
    });
  } catch (e) {
    console.error('Failed to queue operation:', e);
  }
}

// ── Process queued operations (called on connectivity restore) ──
export async function processSyncQueue() {
  const pending = await db.syncQueue.toArray();
  for (const item of pending) {
    try {
      const op = item.operation;
      if (op.type === 'pushSong') {
        await pushSongToSupabase(op.payload, op.user, { skipQueue: true });
      } else if (op.type === 'pushSetlist') {
        await pushSetlistToSupabase(op.payload, op.user, { skipQueue: true });
      } else if (op.type === 'deleteSong') {
        await deleteSongFromSupabase(op.id, op.user, { skipQueue: true });
      } else if (op.type === 'deleteSetlist') {
        await deleteSetlistFromSupabase(op.id, op.user, { skipQueue: true });
      }
      await db.syncQueue.delete(item.id);
    } catch (err) {
      await db.syncQueue.update(item.id, { retries: (item.retries || 0) + 1 });
    }
  }
}

// ── Timestamp-based conflict helpers ──
function isRemoteNewer(localUpdatedAt, remoteUpdatedAt) {
  if (!localUpdatedAt) return true;
  if (!remoteUpdatedAt) return false;
  return new Date(remoteUpdatedAt) > new Date(localUpdatedAt);
}

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
            await withRetry(() => supabase.from('setlists').upsert(setlistsToInsert));
        }

        // Sync Profile info safely
        try {
            await withRetry(() => supabase.from('profiles').upsert({
                id: user.id,
                username: user.user_metadata?.username || user.email?.split('@')[0],
                email: user.email,
                role: 'worship_leader',
                created_at: new Date().toISOString()
            }));

            // Attempt optional custom columns sync if schema supports them
            const localAccent = localStorage.getItem('selah_accent_color');
            let accentHex = null;
            if (localAccent) {
                try { accentHex = JSON.parse(localAccent).hex; } catch (e) { }
            }

            if (accentHex) {
                await withRetry(() => supabase.from('profiles').update({
                    accent_color: accentHex,
                }).eq('id', user.id));
            }
        } catch (e) {
            console.warn('[Selah Sync] Profile sync error:', e?.message || e);
        }
    } catch (err) {
        console.error('[Selah Sync] migrateDataToSupabase failed:', err?.message || err);
    }
}

async function syncSetlistToDexie(list) {
    if (!list || !list.title || !list.id) return;
    const targetId = String(list.id);
    const songKeysObj = typeof list.song_keys === 'string'
        ? JSON.parse(list.song_keys)
        : (list.song_keys || list.songKeys || {});

    const existing = await db.setlists.get(targetId);
    if (existing && !isRemoteNewer(existing.updatedAt, list.updated_at)) {
      return; // local is newer or equal, skip remote overwrite
    }

    await db.setlists.put({
        id: targetId,
        userId: list.user_id || list.userId || null,
        title: list.title,
        date: list.date,
        notes: list.notes,
        preparedBy: list.prepared_by || list.preparedBy || 'Worship Leader',
        songIds: list.song_ids || list.songIds || [],
        songKeys: songKeysObj,
        updatedAt: list.updated_at || new Date().toISOString(),
        created: list.created_at || new Date().toISOString()
    });
}

// ── Discreet Background Hydration (bi-directional) ──
export async function discreetBackgroundSync() {
    try {
        // Get current authenticated user for push operations
        const { data: { user } } = await supabase.auth.getUser();

        // ── PUSH: Upload local setlists to Supabase ──
        if (user) {
            const localSetlists = await db.setlists.toArray();
            for (const list of localSetlists) {
                if (!list.id || !list.title) continue;
                try {
                    const songKeysObj = typeof list.songKeys === 'string'
                        ? JSON.parse(list.songKeys)
                        : (list.songKeys || {});

                    await withRetry(() => supabase.from('setlists').upsert({
                        id: String(list.id),
                        user_id: list.userId || user.id,
                        title: list.title,
                        date: list.date,
                        notes: list.notes,
                        prepared_by: list.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
                        song_ids: list.songIds || [],
                        song_keys: songKeysObj,
                        updated_at: list.updatedAt || new Date().toISOString()
                    }));
                } catch (pushErr) {
                    console.warn('[Selah Sync] Push setlist failed:', list.title, pushErr?.message);
                }
            }
        }

        // ── PULL: Hydrate from Supabase into Dexie ──
        const { data: remoteSetlists, error: setlistErr } = await supabase.from('setlists').select('*');
        if (setlistErr) {
            console.error('[Selah Sync] Fetch setlists error:', setlistErr.message);
        }
        if (!setlistErr && remoteSetlists) {
            for (const list of remoteSetlists) {
                await syncSetlistToDexie(list);
            }
        }

        // Hydrate remote song edits if present safely without duplicate records
        const { data: remoteSongs, error: songErr } = await supabase.from('songs').select('*');
        if (!songErr && remoteSongs && remoteSongs.length > 0) {
            for (const song of remoteSongs) {
                if (song.id) {
                    const targetId = !isNaN(Number(song.id)) ? Number(song.id) : song.id;
                    const existing = await db.songs.get(typeof targetId === 'number' ? targetId : String(targetId));
                    if (existing && !isRemoteNewer(existing.updatedAt, song.updated_at)) {
                      continue; // local is newer or equal, skip
                    }
                    if (typeof targetId === 'number') {
                        await db.songs.delete(targetId);
                    }
                    await db.songs.put({
                        id: targetId,
                        title: song.title,
                        artist: song.artist,
                        originalKey: song.original_key,
                        currentKey: song.original_key,
                        tempo: song.tempo,
                        category: song.category,
                        lyrics: song.lyrics,
                        updatedAt: song.updated_at,
                        language: song.language || existing?.language || 'English',
                        tags: song.tags || existing?.tags || [song.category || 'Slow']
                    });
                }
            }
        }

        // Retry queued operations after successful fetch
        await processSyncQueue();
        console.log('[Selah Sync] Background sync complete');
    } catch (err) {
        console.error('[Selah Sync] discreetBackgroundSync failed:', err?.message || err);
    }
}

export async function initRealtimeSync(user = null) {
    // 1. Sync User Profile if authenticated
    if (user) {
        await migrateDataToSupabase(user);
    }

    // 2. Initial fetch & hydration for setlists & songs (works for both guests & logged in users)
    await discreetBackgroundSync();

    // 3. Start background sync interval every 30 seconds
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    backgroundSyncTimer = setInterval(() => {
        discreetBackgroundSync();
    }, 30000);

    // 4. Subscribe to Supabase Realtime changes for setlists across accounts & devices
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase.channel('public:selah_collaborative')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'setlists' }, async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await syncSetlistToDexie(payload.new);
                
                // NOTIFICATION: Notify other accounts when a setlist is created/scheduled!
                if (user && payload.new.user_id && payload.new.user_id !== user.id) {
                    const title = `📅 Worship Setlist Scheduled!`;
                    const body = `"${payload.new.title}" setlist scheduled for ${payload.new.date || 'upcoming service'} by ${payload.new.prepared_by || 'Worship Leader'}`;
                    sendSystemNotification(title, { body, url: '/setlists' });
                }
            } else if (payload.eventType === 'DELETE') {
                await db.setlists.delete(payload.old.id);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const songId = !isNaN(Number(payload.new.id)) ? Number(payload.new.id) : payload.new.id;
                const existing = await db.songs.get(songId);
                if (existing && isRemoteNewer(existing.updatedAt, payload.new.updated_at)) {
                  return; // local is newer, skip
                }
                await db.songs.put({
                    id: songId,
                    title: payload.new.title,
                    artist: payload.new.artist,
                    originalKey: payload.new.original_key,
                    currentKey: payload.new.original_key,
                    tempo: payload.new.tempo,
                    category: payload.new.category,
                    lyrics: payload.new.lyrics,
                    updatedAt: payload.new.updated_at,
                    language: payload.new.language || existing?.language || 'English',
                    tags: payload.new.tags || existing?.tags || [payload.new.category || 'Slow']
                });
            } else if (payload.eventType === 'DELETE') {
                const songId = !isNaN(Number(payload.old.id)) ? Number(payload.old.id) : payload.old.id;
                await db.songs.delete(songId);
            }
        })
        .subscribe();
}

// ── Auto sync when internet connection is restored ──
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        const { data: { user } } = supabase.auth.getUser();
        if (user) {
            processSyncQueue();
            initRealtimeSync(user);
        }
    });
}

// ── Helpers to push local user setlist actions to Supabase ──
export async function pushSetlistToSupabase(setlist, user, opts = {}) {
    if (!user) return;
    try {
        const songKeysObj = typeof setlist.songKeys === 'string'
            ? JSON.parse(setlist.songKeys)
            : (setlist.songKeys || {});

        const now = new Date().toISOString();
        const setlistUserId = setlist.userId || user.id;

        await withRetry(() => supabase.from('setlists').upsert({
            id: String(setlist.id),
            user_id: setlistUserId,
            title: setlist.title,
            date: setlist.date,
            notes: setlist.notes,
            prepared_by: setlist.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
            song_ids: setlist.songIds || [],
            song_keys: songKeysObj,
            updated_at: now
        }));

        console.log('[Selah Sync] Setlist pushed to Supabase:', setlist.title);
        // Update local Dexie to stay in sync with remote timestamp and userId
        await db.setlists.update(String(setlist.id), { updatedAt: now, userId: setlistUserId });
    } catch (err) {
        console.error('[Selah Sync] pushSetlistToSupabase FAILED:', err?.message || err);
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'pushSetlist', payload: setlist, user });
        }
    }
}

export async function deleteSetlistFromSupabase(setlistId, user, opts = {}) {
    if (!user || !setlistId) return;
    try {
        const idStr = String(setlistId);
        await withRetry(() => supabase.from('setlists').delete().eq('id', idStr));
    } catch (err) {
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'deleteSetlist', id: setlistId, user });
        }
    }
}

export async function pushSongToSupabase(song, user, opts = {}) {
    if (!user || !song) return;
    try {
        const now = new Date().toISOString();
        await withRetry(() => supabase.from('songs').upsert({
            id: String(song.id),
            user_id: user.id,
            title: song.title,
            artist: song.artist,
            original_key: song.originalKey || song.currentKey || 'C',
            tempo: song.tempo || 80,
            category: song.category || 'Slow',
            lyrics: song.lyrics || '',
            updated_at: now
        }));
    } catch (err) {
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'pushSong', payload: song, user });
        }
    }
}

export async function deleteSongFromSupabase(songId, user, opts = {}) {
    if (!user || !songId) return;
    try {
        await withRetry(() => supabase.from('songs').delete().eq('id', String(songId)));
    } catch (err) {
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'deleteSong', id: songId, user });
        }
    }
}
