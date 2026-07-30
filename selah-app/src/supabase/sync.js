import { supabase } from './client';
import { db } from '../db/dexie';
import { sendSystemNotification } from '../utils/notifications';

let realtimeChannel = null;
let backgroundSyncTimer = null;

// ── Retry with exponential backoff ──
async function withRetry(fn, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
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
            const localPin = localStorage.getItem(`selah_pin_${user.id}`);
            const localAccent = localStorage.getItem('selah_accent_color');
            let accentHex = null;
            if (localAccent) {
                try { accentHex = JSON.parse(localAccent).hex; } catch (e) { }
            }

            if (localPin || accentHex) {
                await withRetry(() => supabase.from('profiles').update({
                    quick_pin: localPin || null,
                    accent_color: accentHex || null,
                }).eq('id', user.id));
            }
        } catch (e) {
            // Ignore schema column mismatches gracefully
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

    const existing = await db.setlists.get(list.id);
    if (existing && isRemoteNewer(existing.updatedAt, list.updated_at)) {
      return; // local is newer, skip
    }

    await db.setlists.put({
        id: list.id,
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

// ── Discreet Background Hydration ──
export async function discreetBackgroundSync() {
    try {
        const { data: remoteSetlists, error: setlistErr } = await supabase.from('setlists').select('*');
        if (!setlistErr && remoteSetlists) {
            // Hydrate remote setlists
            for (const list of remoteSetlists) {
                await syncSetlistToDexie(list);
            }

            // Remove local setlists that no longer exist on the remote
            const remoteIds = new Set(remoteSetlists.map(l => String(l.id)));
            const localSetlists = await db.setlists.toArray();
            for (const local of localSetlists) {
                if (!remoteIds.has(String(local.id))) {
                    await db.setlists.delete(local.id);
                }
            }
        }

        // Hydrate remote song edits if present safely without duplicate records
        const { data: remoteSongs, error: songErr } = await supabase.from('songs').select('*');
        if (!songErr && remoteSongs && remoteSongs.length > 0) {
            for (const song of remoteSongs) {
                if (song.id) {
                    const targetId = !isNaN(Number(song.id)) ? Number(song.id) : song.id;
                    const existing = await db.songs.get(String(targetId));
                    if (existing && isRemoteNewer(existing.updatedAt, song.updated_at)) {
                      continue; // local is newer, skip
                    }
                    if (typeof targetId === 'number') {
                        await db.songs.delete(String(targetId));
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
                        updatedAt: song.updated_at
                    });
                }
            }
        }

        // Retry queued operations after successful fetch
        await processSyncQueue();
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

    // 1. Sync User Profile
    await migrateDataToSupabase(user);

    // 2. Initial fetch & hydration for setlists & songs
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
                if (payload.new.user_id && payload.new.user_id !== user.id) {
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
                const existing = await db.songs.get(payload.new.id);
                if (existing && isRemoteNewer(existing.updatedAt, payload.new.updated_at)) {
                  return; // local is newer, skip
                }
                await db.songs.put({
                    id: payload.new.id,
                    title: payload.new.title,
                    artist: payload.new.artist,
                    originalKey: payload.new.original_key,
                    currentKey: payload.new.original_key,
                    tempo: payload.new.tempo,
                    category: payload.new.category,
                    lyrics: payload.new.lyrics,
                    updatedAt: payload.new.updated_at
                });
            } else if (payload.eventType === 'DELETE') {
                await db.songs.delete(payload.old.id);
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
        await withRetry(() => supabase.from('setlists').upsert({
            id: String(setlist.id),
            user_id: user.id,
            title: setlist.title,
            date: setlist.date,
            notes: setlist.notes,
            prepared_by: setlist.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
            song_ids: setlist.songIds || [],
            song_keys: songKeysObj,
            updated_at: now
        }));
    } catch (err) {
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'pushSetlist', payload: setlist, user });
        }
    }
}

export async function deleteSetlistFromSupabase(setlistId, user, opts = {}) {
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
