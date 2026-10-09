import { supabase } from './client';
import { db, profileDB } from '../db/dexie';
import { sendSystemNotification } from '../utils/notifications';

let realtimeChannel = null;
let backgroundSyncTimer = null;

// ── Resolve Church Tenancy ID for User ──
export async function getUserChurchId(user) {
  if (!user) return 'JFCM-Mercedes';
  if (user.user_metadata?.church_id) return user.user_metadata.church_id;
  try {
    const { data } = await supabase.from('profiles').select('church_id').eq('id', user.id).maybeSingle();
    if (data?.church_id) return data.church_id;
  } catch (e) {
    // Fallback on error
  }
  return 'JFCM-Mercedes';
}

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
      } else if (op.type === 'pushSchedule') {
        await pushScheduleToSupabase(op.payload, op.user, { skipQueue: true });
      } else if (op.type === 'deleteSong') {
        await deleteSongFromSupabase(op.id, op.user, { skipQueue: true });
      } else if (op.type === 'deleteSetlist') {
        await deleteSetlistFromSupabase(op.id, op.user, { skipQueue: true });
      } else if (op.type === 'deleteSchedule') {
        await deleteScheduleFromSupabase(op.id, op.user, { skipQueue: true });
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
        const churchId = await getUserChurchId(user);

        // Migrate local setlists to Supabase with church_id
        const localSetlists = await db.setlists.toArray();
        if (localSetlists && localSetlists.length > 0) {
            const setlistsToInsert = localSetlists.map(list => ({
                id: list.id ? String(list.id) : crypto.randomUUID(),
                church_id: list.churchId || churchId,
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

        // Sync Profile info with church_id safely without overwriting existing role
        try {
            const { data: existingProf } = await supabase
                .from('profiles')
                .select('id, role')
                .eq('id', user.id)
                .maybeSingle();

            if (!existingProf) {
                const isOwner = user.email?.toLowerCase() === 'kurt.jalgalado@gmail.com';
                const initialRole = isOwner ? 'superuser' : (user.user_metadata?.role || 'worship_team_member');
                await withRetry(() => supabase.from('profiles').insert({
                    id: user.id,
                    church_id: churchId,
                    username: user.user_metadata?.username || user.email?.split('@')[0],
                    email: user.email,
                    role: initialRole,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }));
            } else {
                // If profile already exists, NEVER overwrite role! Only sync church_id, username, email
                await withRetry(() => supabase.from('profiles').update({
                    church_id: churchId,
                    username: user.user_metadata?.username || user.email?.split('@')[0],
                    email: user.email,
                    updated_at: new Date().toISOString()
                }).eq('id', user.id));
            }

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

async function syncSetlistToDexie(list, currentChurchId = null) {
    if (!list || !list.title || !list.id) return;
    const targetId = String(list.id);
    const itemChurchId = list.church_id || list.churchId || 'JFCM-Mercedes';

    // Tenant isolation: if a church is active, ignore remote setlists from other churches
    if (currentChurchId && list.church_id && list.church_id !== currentChurchId) {
        return;
    }

    const songKeysObj = typeof list.song_keys === 'string'
        ? JSON.parse(list.song_keys)
        : (list.song_keys || list.songKeys || {});

    const existing = await db.setlists.get(targetId);
    if (existing && !isRemoteNewer(existing.updatedAt, list.updated_at)) {
      return; // local is newer or equal, skip remote overwrite
    }

    await db.setlists.put({
        id: targetId,
        churchId: itemChurchId,
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

export async function syncScheduleToDexie(sched, currentChurchId) {
    if (!sched || !sched.id) return;
    const targetId = String(sched.id);
    const itemChurchId = sched.church_id || sched.churchId || currentChurchId || 'JFCM-Mercedes';

    // Tenant isolation: if a church is active, ignore remote schedules from different non-default churches
    if (currentChurchId && sched.church_id && sched.church_id.toLowerCase() !== currentChurchId.toLowerCase() && currentChurchId !== 'JFCM-Mercedes') {
        return;
    }

    const assignmentsArr = typeof sched.assignments === 'string'
        ? JSON.parse(sched.assignments)
        : (sched.assignments || []);

    await db.schedules.put({
        id: targetId,
        churchId: itemChurchId,
        serviceTitle: sched.service_title || sched.serviceTitle,
        serviceDate: sched.service_date || sched.serviceDate,
        serviceTime: sched.service_time || sched.serviceTime || '',
        setlistId: sched.setlist_id || sched.setlistId || null,
        notes: sched.notes || '',
        assignments: assignmentsArr,
        createdBy: sched.created_by || sched.createdBy || null,
        updatedAt: sched.updated_at || sched.updatedAt || new Date().toISOString(),
        created: sched.created_at || sched.created || new Date().toISOString()
    });
}

// ── Deduplicate minister schedules ──
export async function cleanDuplicateSchedules(churchId, user = null) {
    try {
        const all = await db.schedules.toArray();
        const churchSchedules = all.filter(s => !churchId || !s.churchId || s.churchId.toLowerCase() === churchId.toLowerCase() || churchId === 'JFCM-Mercedes');
        
        // Group by setlistId (if present) OR by churchId + serviceDate + serviceTitle normalized
        const groups = new Map();
        for (const s of churchSchedules) {
            let key = null;
            if (s.setlistId) {
                key = `setlist:${s.setlistId}`;
            } else if (s.serviceDate) {
                key = `date:${(s.churchId || churchId || 'default').toLowerCase()}_${s.serviceDate}_${(s.serviceTitle || '').trim().toLowerCase()}`;
            }
            if (key) {
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(s);
            }
        }

        const idsToDelete = [];
        for (const group of groups.values()) {
            if (group.length > 1) {
                // Pick the best schedule to keep:
                // 1. One with the most assigned ministers
                // 2. Newer updatedAt
                group.sort((a, b) => {
                    const assignedA = (a.assignments || []).filter(x => x.user_id || x.user_name).length;
                    const assignedB = (b.assignments || []).filter(x => x.user_id || x.user_name).length;
                    if (assignedB !== assignedA) return assignedB - assignedA;
                    return new Date(b.updatedAt || b.created || 0) - new Date(a.updatedAt || a.created || 0);
                });

                const [, ...duplicates] = group;
                for (const dup of duplicates) {
                    idsToDelete.push(dup.id);
                }
            }
        }

        if (idsToDelete.length > 0) {
            console.info('[Selah Sync] Deduplicating schedules, deleting duplicate IDs:', idsToDelete);
            await db.schedules.bulkDelete(idsToDelete);
            if (user) {
                for (const id of idsToDelete) {
                    await deleteScheduleFromSupabase(id, user).catch(() => {});
                }
            }
        }
    } catch (e) {
        console.warn('[Selah Sync] cleanDuplicateSchedules warning:', e);
    }
}

export async function syncNotificationToDexie(notif, currentChurchId = null, currentUserId = null) {
    if (!notif || !notif.id) return;
    const targetUserId = notif.user_id || notif.userId;
    // Isolation: only sync to local Dexie if intended for current user or broadcast
    if (currentUserId && targetUserId && String(targetUserId) !== String(currentUserId)) {
        return;
    }

    const targetId = String(notif.id);
    let parsedData = {};
    if (typeof notif.data === 'string') {
        try { parsedData = JSON.parse(notif.data); } catch { parsedData = {}; }
    } else if (notif.data) {
        parsedData = notif.data;
    }

    await db.notifications.put({
        id: targetId,
        userId: targetUserId ? String(targetUserId) : null,
        churchId: notif.church_id || notif.churchId || currentChurchId || 'JFCM-Mercedes',
        title: notif.title || 'Notification',
        body: notif.body || '',
        type: notif.type || 'assignment',
        data: parsedData,
        isRead: Boolean(notif.is_read || notif.isRead),
        createdAt: notif.created_at || notif.createdAt || new Date().toISOString()
    });
}

// ── Discreet Background Hydration (bi-directional & church-isolated) ──
export async function discreetBackgroundSync() {
    try {
        // Get current authenticated user for push operations
        const { data: { user } } = await supabase.auth.getUser();
        const churchId = await getUserChurchId(user);

        // ── PUSH: Flush offline queued actions if any ──
        await processSyncQueue();

        // ── PULL: Hydrate Setlists from Supabase into Dexie (filtered by church_id) ──
        const { data: remoteSetlists, error: setlistErr } = await supabase
            .from('setlists')
            .select('*')
            .order('updated_at', { ascending: false });

        if (setlistErr) {
            if (setlistErr.status !== 401) {
                console.warn('[Selah Sync] Fetch setlists:', setlistErr.message);
            }
        } else if (remoteSetlists) {
            for (const list of remoteSetlists) {
                if (!list.church_id || list.church_id === churchId || churchId === 'JFCM-Mercedes') {
                    await syncSetlistToDexie(list, churchId);
                }
            }
        }

        // ── PULL: Hydrate Minister Schedules from Supabase into Dexie (filtered by church_id) ──
        const { data: remoteSchedules, error: schedErr } = await supabase
            .from('minister_schedules')
            .select('*')
            .order('updated_at', { ascending: false });

        if (schedErr) {
            if (schedErr.code === 'PGRST204' || schedErr.code === 'PGRST200' || schedErr.message?.includes('schema cache')) {
                console.info('[Selah Sync] Minister schedules table pending Supabase SQL migration.');
            } else if (schedErr.status !== 401) {
                console.warn('[Selah Sync] Fetch schedules:', schedErr.message);
            }
        } else if (remoteSchedules) {
            for (const sched of remoteSchedules) {
                if (!sched.church_id || sched.church_id === churchId || churchId === 'JFCM-Mercedes') {
                    await syncScheduleToDexie(sched, churchId);
                }
            }
        }
        const foreignOrStaleSched = (await db.schedules.toArray()).filter(s => (s.churchId && s.churchId !== churchId));
        if (foreignOrStaleSched.length > 0) {
            await db.schedules.bulkDelete(foreignOrStaleSched.map(s => s.id));
        }

        // Deduplicate schedules if there are duplicated schedules
        await cleanDuplicateSchedules(churchId, user);
        
        // Hydrate remote song edits if present safely without duplicate records or flickering
        const { data: remoteSongs, error: songErr } = await supabase.from('songs').select('*');
        if (!songErr && remoteSongs && remoteSongs.length > 0) {
            const songsToUpdate = [];
            for (const song of remoteSongs) {
                if (song.id) {
                    const targetId = !isNaN(Number(song.id)) ? Number(song.id) : song.id;
                    const existing = await db.songs.get(typeof targetId === 'number' ? targetId : String(targetId));
                    if (existing && !isRemoteNewer(existing.updatedAt, song.updated_at)) {
                      continue; // local is newer or equal, skip
                    }
                    songsToUpdate.push({
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
            if (songsToUpdate.length > 0) {
                await db.songs.bulkPut(songsToUpdate);
            }
        }

        // 4. Sync Church Team Profiles into Dexie
        const { data: remoteProfiles, error: profErr } = await supabase
            .from('profiles')
            .select('id, username, email, role, avatar_seed, church_id, updated_at');

        if (!profErr && remoteProfiles && remoteProfiles.length > 0) {
            const targetChurch = (churchId || 'JFCM-Mercedes').trim().toLowerCase();
            const filtered = remoteProfiles.filter(p => {
                const pChurch = (p.church_id || '').trim().toLowerCase();
                return !pChurch || pChurch === targetChurch || pChurch === 'jfcm-mercedes' || targetChurch === 'jfcm-mercedes';
            });
            await profileDB.bulkPut(filtered.length > 0 ? filtered : remoteProfiles);
        }

        // 5. Sync User Notifications (Scoped to current church & specific user)
        if (user) {
            const { data: notifsData } = await supabase
                .from('user_notifications')
                .select('*')
                .eq('church_id', churchId)
                .or(`user_id.eq.${user.id},user_id.is.null`)
                .order('created_at', { ascending: false })
                .limit(40);

            if (notifsData && notifsData.length > 0) {
                for (const notif of notifsData) {
                    await syncNotificationToDexie(notif, churchId, user.id);
                }
            }
        }

        // 6. Process offline queued actions if any
        await processSyncQueue();
    } catch (err) {
        console.warn('[Selah Sync] Background sync warning:', err.message);
    }
}

export async function initRealtimeSync(user = null) {
    const churchId = await getUserChurchId(user);

    // 1. Sync User Profile if authenticated
    if (user) {
        await migrateDataToSupabase(user);
    }

    // 2. Initial fetch & hydration for setlists, schedules, notifications & songs
    await discreetBackgroundSync();

    // 3. Start background sync interval every 30 seconds
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    backgroundSyncTimer = setInterval(() => {
        discreetBackgroundSync();
    }, 30000);

    // 4. Subscribe to Supabase Realtime changes across accounts & devices
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase.channel('public:selah_collaborative')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id || 'JFCM-Mercedes';
            if (churchId && itemChurchId && itemChurchId.toLowerCase() !== churchId.toLowerCase() && churchId !== 'JFCM-Mercedes') {
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await profileDB.put(payload.new);
                if (typeof window !== 'undefined' && payload.new?.id && payload.new?.role) {
                    window.dispatchEvent(new CustomEvent('selah:role-updated', {
                        detail: { userId: payload.new.id, role: payload.new.role }
                    }));
                }
            } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                await db.profiles.delete(String(payload.old.id));
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'setlists' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id;
            // Tenant isolation: only react if setlist belongs to current church
            if (itemChurchId && itemChurchId !== churchId) {
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await syncSetlistToDexie(payload.new, churchId);
                
                // NOTIFICATION: Only notify on NEW insertion by another account in the SAME church!
                if (payload.eventType === 'INSERT' && user && payload.new.user_id && payload.new.user_id !== user.id) {
                    const createdAt = new Date(payload.new.created_at || payload.new.updated_at || Date.now()).getTime();
                    const isRecent = (Date.now() - createdAt) < 10 * 60 * 1000;
                    const notifId = `notif-setlist-${payload.new.id}`;
                    const existingNotif = await db.notifications.get(notifId);

                    if (!existingNotif && isRecent) {
                        const title = `Worship Setlist Scheduled`;
                        const body = `"${payload.new.title}" setlist scheduled for ${payload.new.date || 'upcoming service'} by ${payload.new.prepared_by || 'Worship Leader'}`;
                        sendSystemNotification(title, {
                            id: notifId,
                            body,
                            url: '/setlists',
                            userId: user.id,
                            churchId,
                            type: 'setlist',
                            data: { setlistId: payload.new.id }
                        });
                    }
                }
            } else if (payload.eventType === 'DELETE') {
                await db.setlists.delete(String(payload.old.id));
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'minister_schedules' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id || 'JFCM-Mercedes';
            if (churchId && itemChurchId && itemChurchId.toLowerCase() !== churchId.toLowerCase() && churchId !== 'JFCM-Mercedes') {
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                await syncScheduleToDexie(payload.new, churchId);
                
                // NOTIFICATION: Only notify on NEW insertion by another account in the SAME church!
                if (payload.eventType === 'INSERT' && user && payload.new.created_by && payload.new.created_by !== user.id) {
                    const createdAt = new Date(payload.new.created_at || payload.new.updated_at || Date.now()).getTime();
                    const isRecent = (Date.now() - createdAt) < 10 * 60 * 1000;
                    const notifId = `notif-schedule-${payload.new.id}`;
                    const existingNotif = await db.notifications.get(notifId);

                    if (!existingNotif && isRecent) {
                        const title = `Worship Ministers Scheduled`;
                        const body = `Ministers scheduled for "${payload.new.service_title}" on ${payload.new.service_date}`;
                        sendSystemNotification(title, {
                            id: notifId,
                            body,
                            url: '/schedule',
                            userId: user.id,
                            churchId,
                            type: 'reminder',
                            data: { scheduleId: payload.new.id }
                        });
                    }
                }
            } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                await db.schedules.delete(String(payload.old.id));
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id || 'JFCM-Mercedes';
            if (churchId && itemChurchId && itemChurchId.toLowerCase() !== churchId.toLowerCase() && churchId !== 'JFCM-Mercedes') {
                return;
            }

            const targetUserId = payload.new?.user_id;
            const isForCurrentUser = Boolean(user && targetUserId === user.id);
            const isBroadcast = !targetUserId;

            // Strict recipient isolation: only process if addressed to current user or general broadcast
            if (!isForCurrentUser && !isBroadcast && payload.eventType !== 'DELETE') {
                return;
            }

            if (payload.eventType === 'INSERT') {
                await syncNotificationToDexie(payload.new, churchId, user?.id);

                // Show native/web banner without creating duplicate Dexie entry
                sendSystemNotification(payload.new.title, {
                    id: String(payload.new.id),
                    body: payload.new.body,
                    userId: user ? user.id : null,
                    churchId,
                    type: payload.new.type || 'assignment',
                    data: payload.new.data,
                    skipDbSave: true
                });
            } else if (payload.eventType === 'UPDATE') {
                if (payload.new) {
                    await syncNotificationToDexie(payload.new, churchId, user?.id);
                }
            } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                await db.notifications.delete(String(payload.old.id));
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
        const churchId = setlist.churchId || await getUserChurchId(user);
        const songKeysObj = typeof setlist.songKeys === 'string'
            ? JSON.parse(setlist.songKeys)
            : (setlist.songKeys || {});

        const now = new Date().toISOString();
        const setlistUserId = setlist.userId || user.id;

        await withRetry(() => supabase.from('setlists').upsert({
            id: String(setlist.id),
            church_id: churchId,
            user_id: setlistUserId,
            title: setlist.title,
            date: setlist.date,
            notes: setlist.notes,
            prepared_by: setlist.preparedBy || user.user_metadata?.username || user.email?.split('@')[0] || 'Worship Leader',
            song_ids: setlist.songIds || [],
            song_keys: songKeysObj,
            updated_at: now
        }));

        console.log('[Selah Sync] Setlist pushed to Supabase for church', churchId, ':', setlist.title);
        // Update local Dexie to stay in sync with remote timestamp, churchId, and userId
        await db.setlists.update(String(setlist.id), { updatedAt: now, userId: setlistUserId, churchId });
    } catch (err) {
        console.error('[Selah Sync] pushSetlistToSupabase FAILED:', err?.message || err);
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'pushSetlist', payload: { ...setlist, churchId: setlist.churchId }, user });
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

// ── Helpers to push local minister schedule actions to Supabase ──
export async function pushScheduleToSupabase(schedule, user, opts = {}) {
    if (!schedule) return;
    try {
        const churchId = schedule.churchId || (user ? await getUserChurchId(user) : 'JFCM-Mercedes') || 'JFCM-Mercedes';
        const now = new Date().toISOString();
        const createdBy = schedule.createdBy || user?.id || null;

        await withRetry(() => supabase.from('minister_schedules').upsert({
            id: String(schedule.id),
            church_id: churchId,
            service_title: schedule.serviceTitle,
            service_date: schedule.serviceDate,
            service_time: schedule.serviceTime || '',
            setlist_id: schedule.setlistId || null,
            notes: schedule.notes || '',
            assignments: schedule.assignments || [],
            created_by: createdBy,
            updated_at: now
        }));

        console.log('[Selah Sync] Schedule pushed to Supabase for church', churchId, ':', schedule.serviceTitle);
        await db.schedules.update(String(schedule.id), { updatedAt: now, createdBy, churchId });
    } catch (err) {
        console.error('[Selah Sync] pushScheduleToSupabase FAILED:', err?.message || err);
        if (!opts.skipQueue && user) {
          await queueFailedOperation({ type: 'pushSchedule', payload: { ...schedule, churchId: schedule.churchId || 'JFCM-Mercedes' }, user });
        }
    }
}

export async function deleteScheduleFromSupabase(scheduleId, user, opts = {}) {
    if (!user || !scheduleId) return;
    try {
        const idStr = String(scheduleId);
        await withRetry(() => supabase.from('minister_schedules').delete().eq('id', idStr));
    } catch (err) {
        if (!opts.skipQueue) {
          await queueFailedOperation({ type: 'deleteSchedule', id: scheduleId, user });
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

export async function pushNotificationToSupabase(notification, user, opts = {}) {
    if (!user || !notification) return;
    try {
        const churchId = await getUserChurchId(user);
        const now = new Date().toISOString();
        await withRetry(() => supabase.from('user_notifications').upsert({
            id: String(notification.id),
            church_id: notification.churchId || churchId,
            user_id: notification.userId || user.id,
            title: notification.title,
            body: notification.body || '',
            type: notification.type || 'assignment',
            data: notification.data || {},
            is_read: Boolean(notification.isRead),
            created_at: notification.createdAt || now
        }));
    } catch (err) {
        if (!opts.skipQueue) {
            await queueFailedOperation({ type: 'pushNotification', payload: notification, user });
        }
    }
}

export async function markNotificationReadInSupabase(notificationId, user) {
    if (!user || !notificationId) return;
    try {
        await withRetry(() => supabase.from('user_notifications').update({ is_read: true }).eq('id', String(notificationId)));
    } catch (err) {
        console.warn('Failed to mark notification as read in Supabase:', err);
    }
}

export async function markAllNotificationsReadInSupabase(userId) {
    if (!userId) return;
    try {
        await withRetry(() => supabase.from('user_notifications').update({ is_read: true }).eq('user_id', String(userId)));
    } catch (err) {
        console.warn('Failed to mark all notifications read in Supabase:', err);
    }
}

export async function clearAllNotificationsInSupabase(userId) {
    if (!userId) return;
    try {
        await withRetry(() => supabase.from('user_notifications').delete().eq('user_id', String(userId)));
    } catch (err) {
        console.warn('Failed to clear notifications in Supabase:', err);
    }
}

export async function deleteNotificationInSupabase(notificationId) {
    if (!notificationId) return;
    try {
        await withRetry(() => supabase.from('user_notifications').delete().eq('id', String(notificationId)));
    } catch (err) {
        console.warn('Failed to delete notification in Supabase:', err);
    }
}

