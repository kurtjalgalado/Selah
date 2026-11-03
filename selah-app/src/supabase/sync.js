import { supabase } from './client';
import { db, profileDB } from '../db/dexie';
import { sendSystemNotification } from '../utils/notifications';

// ── State & Concurrency Controls ──
let realtimeChannel = null;
let backgroundSyncTimer = null;
let currentSyncPromise = null;
let syncQueued = false;

// ── Resolve Church Tenancy ID for User ──
export async function getUserChurchId(user) {
    if (!user) return 'JFCM-Mercedes';
    if (user.user_metadata?.church_id) return user.user_metadata.church_id;
    try {
        const { data } = await supabase.from('profiles').select('church_id').eq('id', user.id).maybeSingle();
        if (data?.church_id) return data.church_id;
    } catch {
        // Fallback on error
    }
    return 'JFCM-Mercedes';
}

function matchesChurch(recordChurchId, activeChurchId) {
    if (!recordChurchId) return true;
    if (!activeChurchId) return true;
    const rec = recordChurchId.trim().toLowerCase();
    const act = activeChurchId.trim().toLowerCase();
    if (rec === act) return true;
    if (act === 'jfcm-mercedes' && rec === 'jfcm-mercedes') return true;
    return false;
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

// ── Timestamp Conflict Helper ──
export function isRemoteNewer(localUpdatedAt, remoteUpdatedAt) {
    if (!localUpdatedAt) return true;
    if (!remoteUpdatedAt) return false;
    return new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAt).getTime();
}

// ── Tombstone Management (Stored in Dexie settings) ──
export async function recordTombstone(table, recordId, churchId, deletedAt = new Date().toISOString()) {
    try {
        await db.settings.put({
            key: `tombstone:${table}:${String(recordId)}`,
            table,
            recordId: String(recordId),
            churchId: churchId || 'JFCM-Mercedes',
            deletedAt
        });
    } catch (e) {
        console.warn('[Selah Sync] Failed to record tombstone:', e);
    }
}

export async function isTombstoned(table, recordId, remoteUpdatedAt = null) {
    try {
        const item = await db.settings.get(`tombstone:${table}:${String(recordId)}`);
        if (!item) return false;
        // If remote record was updated AFTER the deletion timestamp,
        // it was legitimately resurrected/recreated on the server.
        if (remoteUpdatedAt && new Date(remoteUpdatedAt).getTime() > new Date(item.deletedAt).getTime()) {
            await db.settings.delete(`tombstone:${table}:${String(recordId)}`);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

export async function clearTombstone(table, recordId) {
    try {
        await db.settings.delete(`tombstone:${table}:${String(recordId)}`);
    } catch (e) {
        console.warn('[Selah Sync] Failed to clear tombstone:', e);
    }
}

// ── Durable Sync Queue Management ──
export async function enqueueSyncOperation({ table, action, recordId, payload, baseUpdatedAt, clientUpdatedAt, churchId, user }) {
    try {
        const recordIdStr = String(recordId);
        const now = new Date().toISOString();
        const effectiveClientTime = clientUpdatedAt || now;

        // Check if there is already a pending operation for this record
        const allPending = await db.syncQueue.toArray();
        const existing = allPending.find(item => item.table === table && String(item.recordId) === recordIdStr);

        if (existing) {
            if (action === 'delete') {
                // If existing was an un-synced local insert, simply remove it completely
                if (existing.action === 'upsert' && !existing.baseUpdatedAt) {
                    await db.syncQueue.delete(existing.id);
                    await recordTombstone(table, recordIdStr, churchId || existing.churchId, effectiveClientTime);
                    return;
                }
                // Otherwise replace with a pending delete
                await db.syncQueue.put({
                    ...existing,
                    action: 'delete',
                    payload: null,
                    clientUpdatedAt: effectiveClientTime,
                    retries: 0,
                    status: 'pending'
                });
                return;
            }

            // Existing was upsert, new is upsert: merge and retain original baseUpdatedAt
            await db.syncQueue.put({
                ...existing,
                action: 'upsert',
                payload: { ...(existing.payload || {}), ...(payload || {}) },
                baseUpdatedAt: existing.baseUpdatedAt || baseUpdatedAt || null,
                clientUpdatedAt: effectiveClientTime,
                retries: 0,
                status: 'pending'
            });
            return;
        }

        // New queue entry
        await db.syncQueue.put({
            id: crypto.randomUUID?.() || `${Date.now()}_${Math.random()}`,
            table,
            action,
            recordId: recordIdStr,
            payload: payload || null,
            baseUpdatedAt: baseUpdatedAt || null,
            clientUpdatedAt: effectiveClientTime,
            churchId: churchId || 'JFCM-Mercedes',
            userId: user?.id || null,
            createdAt: now,
            retries: 0,
            status: 'pending'
        });
    } catch (e) {
        console.error('[Selah Sync] Failed to enqueue operation:', e);
    }
}

export async function getPendingOpForRecord(table, recordId) {
    try {
        const all = await db.syncQueue.toArray();
        return all.find(item => item.table === table && String(item.recordId) === String(recordId)) || null;
    } catch {
        return null;
    }
}

// ── Deterministic Field-Level Conflict Resolution ──

export function reconcileSetlist(remoteRecord, localPending) {
    const remoteSongIds = Array.isArray(remoteRecord.song_ids) ? remoteRecord.song_ids : [];
    const localSongIds = Array.isArray(localPending.payload?.songIds) ? localPending.payload.songIds : [];

    // 1. Merge song IDs preserving unique items and local additions
    const combinedSongIds = Array.from(new Set([...remoteSongIds, ...localSongIds]));

    // 2. Merge song keys
    const remoteKeys = typeof remoteRecord.song_keys === 'string'
        ? JSON.parse(remoteRecord.song_keys)
        : (remoteRecord.song_keys || {});
    const localKeys = typeof localPending.payload?.songKeys === 'string'
        ? JSON.parse(localPending.payload.songKeys)
        : (localPending.payload?.songKeys || {});
    const combinedSongKeys = { ...remoteKeys, ...localKeys };

    // 3. Merge notes (preserve independent thoughts if both modified)
    let combinedNotes = localPending.payload?.notes || remoteRecord.notes || '';
    if (localPending.payload?.notes && remoteRecord.notes && localPending.payload.notes !== remoteRecord.notes) {
        if (!remoteRecord.notes.includes(localPending.payload.notes)) {
            combinedNotes = `${remoteRecord.notes}\n[Local update]: ${localPending.payload.notes}`.trim();
        } else {
            combinedNotes = remoteRecord.notes;
        }
    }

    // 4. Title & Date (Deterministic timestamp check)
    const isLocalNewer = localPending.clientUpdatedAt && remoteRecord.updated_at
        ? new Date(localPending.clientUpdatedAt).getTime() > new Date(remoteRecord.updated_at).getTime()
        : true;

    const resolvedTitle = isLocalNewer ? (localPending.payload?.title || remoteRecord.title) : remoteRecord.title;
    const resolvedDate = isLocalNewer ? (localPending.payload?.date || remoteRecord.date) : (remoteRecord.date || localPending.payload?.date);

    return {
        ...localPending.payload,
        id: String(remoteRecord.id),
        churchId: remoteRecord.church_id || localPending.churchId || 'JFCM-Mercedes',
        userId: remoteRecord.user_id || localPending.userId,
        title: resolvedTitle,
        date: resolvedDate,
        notes: combinedNotes,
        preparedBy: localPending.payload?.preparedBy || remoteRecord.prepared_by || 'Worship Leader',
        songIds: combinedSongIds,
        songKeys: combinedSongKeys,
        status: localPending.payload?.status === 'done' || remoteRecord.status === 'done'
            ? 'done'
            : (isLocalNewer ? (localPending.payload?.status || remoteRecord.status || 'active') : (remoteRecord.status || localPending.payload?.status || 'active')),
        updatedAt: new Date().toISOString(),
        baseUpdatedAt: remoteRecord.updated_at
    };
}

export function reconcileSchedule(remoteRecord, localPending) {
    const remoteAssignments = typeof remoteRecord.assignments === 'string'
        ? JSON.parse(remoteRecord.assignments)
        : (remoteRecord.assignments || []);
    const localAssignments = typeof localPending.payload?.assignments === 'string'
        ? JSON.parse(localPending.payload.assignments)
        : (localPending.payload?.assignments || []);

    // Merge minister assignments by role_name without dropping independent assignments
    const assignmentMap = new Map();
    for (const a of remoteAssignments) {
        const key = (a.role_name || a.role || a.id || '').toLowerCase().trim();
        if (key) assignmentMap.set(key, { ...a });
    }
    for (const a of localAssignments) {
        const key = (a.role_name || a.role || a.id || '').toLowerCase().trim();
        if (key) {
            const existing = assignmentMap.get(key);
            if (!existing) {
                assignmentMap.set(key, { ...a });
            } else {
                // If local assigned a person and remote was empty, prefer the assignment
                if ((a.user_id || a.user_name) && (!existing.user_id && !existing.user_name)) {
                    assignmentMap.set(key, { ...existing, ...a });
                } else if (localPending.clientUpdatedAt && remoteRecord.updated_at && new Date(localPending.clientUpdatedAt).getTime() > new Date(remoteRecord.updated_at).getTime()) {
                    assignmentMap.set(key, { ...existing, ...a });
                }
            }
        }
    }
    const combinedAssignments = Array.from(assignmentMap.values());

    const isLocalNewer = localPending.clientUpdatedAt && remoteRecord.updated_at
        ? new Date(localPending.clientUpdatedAt).getTime() > new Date(remoteRecord.updated_at).getTime()
        : true;

    return {
        ...localPending.payload,
        id: String(remoteRecord.id),
        churchId: remoteRecord.church_id || localPending.churchId || 'JFCM-Mercedes',
        serviceTitle: isLocalNewer ? (localPending.payload?.serviceTitle || remoteRecord.service_title) : remoteRecord.service_title,
        serviceDate: isLocalNewer ? (localPending.payload?.serviceDate || remoteRecord.service_date) : (remoteRecord.service_date || localPending.payload?.serviceDate),
        serviceTime: isLocalNewer ? (localPending.payload?.serviceTime ?? remoteRecord.service_time) : (remoteRecord.service_time ?? localPending.payload?.serviceTime),
        setlistId: localPending.payload?.setlistId || remoteRecord.setlist_id || null,
        notes: isLocalNewer ? (localPending.payload?.notes || remoteRecord.notes) : (remoteRecord.notes || localPending.payload?.notes),
        assignments: combinedAssignments,
        createdBy: remoteRecord.created_by || localPending.userId,
        updatedAt: new Date().toISOString(),
        baseUpdatedAt: remoteRecord.updated_at
    };
}

export function reconcileSong(remoteRecord, localPending) {
    const isLocalNewer = localPending.clientUpdatedAt && remoteRecord.updated_at
        ? new Date(localPending.clientUpdatedAt).getTime() > new Date(remoteRecord.updated_at).getTime()
        : true;

    return {
        ...localPending.payload,
        id: remoteRecord.id,
        title: isLocalNewer ? (localPending.payload?.title || remoteRecord.title) : remoteRecord.title,
        artist: isLocalNewer ? (localPending.payload?.artist || remoteRecord.artist) : remoteRecord.artist,
        originalKey: isLocalNewer ? (localPending.payload?.originalKey || remoteRecord.original_key) : remoteRecord.original_key,
        currentKey: isLocalNewer ? (localPending.payload?.currentKey || remoteRecord.original_key) : remoteRecord.original_key,
        tempo: isLocalNewer ? (localPending.payload?.tempo || remoteRecord.tempo) : remoteRecord.tempo,
        category: isLocalNewer ? (localPending.payload?.category || remoteRecord.category) : remoteRecord.category,
        lyrics: isLocalNewer ? (localPending.payload?.lyrics || remoteRecord.lyrics) : remoteRecord.lyrics,
        language: localPending.payload?.language || remoteRecord.language || 'English',
        tags: localPending.payload?.tags || remoteRecord.tags || [],
        updatedAt: new Date().toISOString(),
        baseUpdatedAt: remoteRecord.updated_at
    };
}

// ── Profile Synchronization (Safe & Non-Destructive) ──
export async function migrateDataToSupabase(user) {
    if (!user) return;
    try {
        const churchId = await getUserChurchId(user);

        // Sync Profile info with church_id safely without overwriting existing role
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
            // NEVER overwrite role! Only sync church_id, username, email
            await withRetry(() => supabase.from('profiles').update({
                church_id: churchId,
                username: user.user_metadata?.username || user.email?.split('@')[0],
                email: user.email,
                updated_at: new Date().toISOString()
            }).eq('id', user.id));
        }

        const localAccent = localStorage.getItem('selah_accent_color');
        let accentHex = null;
        if (localAccent) {
            try { accentHex = JSON.parse(localAccent).hex; } catch {}
        }
        if (accentHex) {
            await withRetry(() => supabase.from('profiles').update({
                accent_color: accentHex,
            }).eq('id', user.id));
        }
    } catch (err) {
        console.warn('[Selah Sync] Profile sync warning:', err?.message || err);
    }
}

// ── Dexie Hydration Helpers ──
export async function syncSetlistToDexie(list, currentChurchId = null) {
    if (!list || !list.title || !list.id) return;
    const targetId = String(list.id);
    const itemChurchId = list.church_id || list.churchId || 'JFCM-Mercedes';

    if (currentChurchId && list.church_id && !matchesChurch(list.church_id, currentChurchId)) {
        return;
    }

    const songKeysObj = typeof list.song_keys === 'string'
        ? JSON.parse(list.song_keys)
        : (list.song_keys || list.songKeys || {});

    const existing = await db.setlists.get(targetId);
    if (existing && !isRemoteNewer(existing.updatedAt, list.updated_at)) {
        return;
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
        status: list.status || existing?.status || 'active',
        updatedAt: list.updated_at || new Date().toISOString(),
        baseUpdatedAt: list.updated_at || new Date().toISOString(),
        created: list.created_at || new Date().toISOString()
    });
}

export async function syncScheduleToDexie(sched, currentChurchId = null) {
    if (!sched || !sched.id) return;
    const targetId = String(sched.id);
    const itemChurchId = sched.church_id || sched.churchId || currentChurchId || 'JFCM-Mercedes';

    if (currentChurchId && sched.church_id && !matchesChurch(sched.church_id, currentChurchId)) {
        return;
    }

    const existing = await db.schedules.get(targetId);
    if (existing && !isRemoteNewer(existing.updatedAt, sched.updated_at)) {
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
        baseUpdatedAt: sched.updated_at || sched.updatedAt || new Date().toISOString(),
        created: sched.created_at || sched.created || new Date().toISOString()
    });
}

export async function cleanDuplicateSchedules(churchId) {
    // Only cleans strictly local duplicated records with duplicate IDs.
    // NEVER issues remote deletes to Supabase in the background!
    try {
        const all = await db.schedules.toArray();
        const seen = new Set();
        const duplicateLocalIds = [];
        for (const s of all) {
            if (seen.has(s.id)) {
                duplicateLocalIds.push(s.id);
            } else {
                seen.add(s.id);
            }
        }
        if (duplicateLocalIds.length > 0) {
            await db.schedules.bulkDelete(duplicateLocalIds);
        }
    } catch (e) {
        console.warn('[Selah Sync] cleanDuplicateSchedules warning:', e);
    }
}

export async function syncNotificationToDexie(notif, currentChurchId = null, currentUserId = null) {
    if (!notif || !notif.id) return;
    const targetUserId = notif.user_id || notif.userId;
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

// ── Step 4 & 5: Upload Only Valid Pending Changes ──
export async function processSyncQueue(currentUser = null) {
    const pendingItems = await db.syncQueue.toArray();
    if (!pendingItems || pendingItems.length === 0) return { processed: 0, failed: 0 };

    let processed = 0;
    let failed = 0;

    for (const item of pendingItems) {
        try {
            const table = item.table || (item.operation?.type ? item.operation.type.replace(/^(push|delete)/, '').toLowerCase() + 's' : null);
            const action = item.action || (item.operation?.type?.startsWith('delete') ? 'delete' : 'upsert');
            const recordId = item.recordId || item.operation?.id || item.operation?.payload?.id;
            const payload = item.payload || item.operation?.payload;
            const user = currentUser || item.user || { id: item.userId };
            const now = new Date().toISOString();

            if (action === 'delete') {
                if (table === 'setlists') {
                    await withRetry(() => supabase.from('setlists').delete().eq('id', String(recordId)));
                } else if (table === 'minister_schedules') {
                    await withRetry(() => supabase.from('minister_schedules').delete().eq('id', String(recordId)));
                } else if (table === 'songs') {
                    await withRetry(() => supabase.from('songs').delete().eq('id', String(recordId)));
                } else if (table === 'user_notifications') {
                    await withRetry(() => supabase.from('user_notifications').delete().eq('id', String(recordId)));
                }
                await db.syncQueue.delete(item.id);
                processed++;
                continue;
            }

            if (action === 'upsert' && payload) {
                if (table === 'setlists') {
                    const churchId = payload.churchId || payload.church_id || 'JFCM-Mercedes';
                    const songKeysObj = typeof payload.songKeys === 'string'
                        ? JSON.parse(payload.songKeys)
                        : (payload.songKeys || payload.song_keys || {});
                    const setlistUserId = payload.userId || payload.user_id || user?.id;

                    await withRetry(() => supabase.from('setlists').upsert({
                        id: String(payload.id),
                        church_id: churchId,
                        user_id: setlistUserId,
                        title: payload.title,
                        date: payload.date,
                        notes: payload.notes,
                        prepared_by: payload.preparedBy || payload.prepared_by || 'Worship Leader',
                        song_ids: payload.songIds || payload.song_ids || [],
                        song_keys: songKeysObj,
                        status: payload.status || 'active',
                        updated_at: now
                    }));

                    await db.setlists.update(String(payload.id), {
                        updatedAt: now,
                        baseUpdatedAt: now,
                        status: payload.status || 'active',
                        userId: setlistUserId,
                        churchId
                    });
                } else if (table === 'minister_schedules') {
                    const churchId = payload.churchId || payload.church_id || 'JFCM-Mercedes';
                    const createdBy = payload.createdBy || payload.created_by || user?.id;

                    await withRetry(() => supabase.from('minister_schedules').upsert({
                        id: String(payload.id),
                        church_id: churchId,
                        service_title: payload.serviceTitle || payload.service_title,
                        service_date: payload.serviceDate || payload.service_date,
                        service_time: payload.serviceTime || payload.service_time || '',
                        setlist_id: payload.setlistId || payload.setlist_id || null,
                        notes: payload.notes || '',
                        assignments: payload.assignments || [],
                        created_by: createdBy,
                        updated_at: now
                    }));

                    await db.schedules.update(String(payload.id), {
                        updatedAt: now,
                        baseUpdatedAt: now,
                        createdBy,
                        churchId
                    });
                } else if (table === 'songs') {
                    await withRetry(() => supabase.from('songs').upsert({
                        id: String(payload.id),
                        user_id: user?.id,
                        title: payload.title,
                        artist: payload.artist,
                        original_key: payload.originalKey || payload.original_key || payload.currentKey || 'C',
                        tempo: payload.tempo || 80,
                        category: payload.category || 'Slow',
                        lyrics: payload.lyrics || '',
                        language: payload.language || 'English',
                        tags: payload.tags || [],
                        updated_at: now
                    }));

                    const numId = Number(payload.id);
                    const targetId = !isNaN(numId) ? numId : String(payload.id);
                    await db.songs.update(targetId, {
                        updatedAt: now,
                        baseUpdatedAt: now
                    });
                } else if (table === 'user_notifications') {
                    const churchId = payload.churchId || payload.church_id || 'JFCM-Mercedes';
                    await withRetry(() => supabase.from('user_notifications').upsert({
                        id: String(payload.id),
                        church_id: churchId,
                        user_id: payload.userId || payload.user_id || user?.id,
                        title: payload.title,
                        body: payload.body || '',
                        type: payload.type || 'assignment',
                        data: payload.data || {},
                        is_read: Boolean(payload.isRead || payload.is_read),
                        created_at: payload.createdAt || payload.created_at || now
                    }));
                }

                await db.syncQueue.delete(item.id);
                processed++;
            }
        } catch (err) {
            console.error('[Selah Sync] Error processing sync item:', item.id, err?.message || err);
            await db.syncQueue.update(item.id, {
                retries: (item.retries || 0) + 1,
                status: 'failed',
                error: err?.message || String(err)
            });
            failed++;
        }
    }

    return { processed, failed };
}

// ── Bi-directional Server-Authoritative Synchronization ──
async function doDiscreetBackgroundSync() {
    try {
        // Step 1: Verify Connection & Current Account
        const { data: { user } } = await supabase.auth.getUser();
        const churchId = await getUserChurchId(user);

        // Step 2 & 3: Hydrate from Supabase and Reconcile with local changes
        // A. Setlists Hydration & Reconciliation
        try {
            const { data: remoteSetlists, error: setlistErr } = await supabase
                .from('setlists')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!setlistErr && remoteSetlists) {
                const remoteMap = new Map();
                for (const list of remoteSetlists) {
                    if (matchesChurch(list.church_id, churchId)) {
                        remoteMap.set(String(list.id), list);
                    }
                }

                // Remote inserts & updates
                for (const remote of remoteMap.values()) {
                    if (await isTombstoned('setlists', remote.id, remote.updated_at)) {
                        continue;
                    }

                    const pending = await getPendingOpForRecord('setlists', remote.id);
                    if (!pending) {
                        await syncSetlistToDexie(remote, churchId);
                    } else if (pending.action === 'upsert') {
                        if (isRemoteNewer(pending.baseUpdatedAt, remote.updated_at)) {
                            // Concurrent edit conflict: Reconcile!
                            const reconciled = reconcileSetlist(remote, pending);
                            pending.payload = reconciled;
                            pending.baseUpdatedAt = remote.updated_at;
                            await db.syncQueue.put(pending);
                            await db.setlists.put(reconciled);
                        }
                    }
                }

                // Detect remote deletions
                const localSetlists = (await db.setlists.toArray()).filter(s => matchesChurch(s.churchId, churchId));
                for (const local of localSetlists) {
                    const localId = String(local.id);
                    if (!remoteMap.has(localId)) {
                        const pending = await getPendingOpForRecord('setlists', localId);
                        // If it's a pending offline create, keep it!
                        if (pending && pending.action === 'upsert' && !pending.baseUpdatedAt) {
                            continue;
                        }
                        // Otherwise, it was deleted on the server
                        await db.setlists.delete(localId);
                        await recordTombstone('setlists', localId, churchId);
                    }
                }
            }
        } catch (e) {
            console.warn('[Selah Sync] Setlist hydration error:', e?.message || e);
        }

        // B. Minister Schedules Hydration & Reconciliation
        try {
            const { data: remoteSchedules, error: schedErr } = await supabase
                .from('minister_schedules')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!schedErr && remoteSchedules) {
                const remoteMap = new Map();
                for (const s of remoteSchedules) {
                    if (matchesChurch(s.church_id, churchId)) {
                        remoteMap.set(String(s.id), s);
                    }
                }

                // Remote inserts & updates
                for (const remote of remoteMap.values()) {
                    if (await isTombstoned('minister_schedules', remote.id, remote.updated_at)) {
                        continue;
                    }

                    const pending = await getPendingOpForRecord('minister_schedules', remote.id);
                    if (!pending) {
                        await syncScheduleToDexie(remote, churchId);
                    } else if (pending.action === 'upsert') {
                        if (isRemoteNewer(pending.baseUpdatedAt, remote.updated_at)) {
                            // Concurrent edit conflict: Reconcile!
                            const reconciled = reconcileSchedule(remote, pending);
                            pending.payload = reconciled;
                            pending.baseUpdatedAt = remote.updated_at;
                            await db.syncQueue.put(pending);
                            await db.schedules.put(reconciled);
                        }
                    }
                }

                // Detect remote deletions
                const localSchedules = (await db.schedules.toArray()).filter(s => matchesChurch(s.churchId, churchId));
                for (const local of localSchedules) {
                    const localId = String(local.id);
                    if (!remoteMap.has(localId)) {
                        const pending = await getPendingOpForRecord('minister_schedules', localId);
                        if (pending && pending.action === 'upsert' && !pending.baseUpdatedAt) {
                            continue;
                        }
                        await db.schedules.delete(localId);
                        await recordTombstone('minister_schedules', localId, churchId);
                    }
                }
            }
        } catch (e) {
            console.warn('[Selah Sync] Schedule hydration error:', e?.message || e);
        }

        // Clean purely local ID collisions
        await cleanDuplicateSchedules(churchId);

        // C. Songs Hydration & Reconciliation
        try {
            const { data: remoteSongs, error: songErr } = await supabase.from('songs').select('*');
            if (!songErr && remoteSongs && remoteSongs.length > 0) {
                const songsToUpdate = [];
                for (const song of remoteSongs) {
                    if (song.id) {
                        const targetId = !isNaN(Number(song.id)) ? Number(song.id) : song.id;
                        const existing = await db.songs.get(typeof targetId === 'number' ? targetId : String(targetId));
                        const pending = await getPendingOpForRecord('songs', song.id);

                        if (pending && pending.action === 'upsert') {
                            if (isRemoteNewer(pending.baseUpdatedAt, song.updated_at)) {
                                const reconciled = reconcileSong(song, pending);
                                pending.payload = reconciled;
                                pending.baseUpdatedAt = song.updated_at;
                                await db.syncQueue.put(pending);
                                songsToUpdate.push(reconciled);
                            }
                            continue;
                        }

                        if (existing && !isRemoteNewer(existing.updatedAt, song.updated_at)) {
                            continue;
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
                            createdAt: song.created_at || existing?.createdAt || song.date_added || existing?.dateAdded || song.updated_at,
                            dateAdded: song.created_at || existing?.dateAdded || existing?.createdAt || song.date_added || song.updated_at,
                            createdBy: song.created_by || existing?.createdBy || null,
                            createdByName: song.created_by_name || existing?.createdByName || null,
                            updatedAt: song.updated_at,
                            baseUpdatedAt: song.updated_at,
                            language: song.language || existing?.language || 'English',
                            tags: song.tags || existing?.tags || [song.category || 'Slow']
                        });
                    }
                }
                if (songsToUpdate.length > 0) {
                    await db.songs.bulkPut(songsToUpdate);
                }
            }
        } catch (e) {
            console.warn('[Selah Sync] Song hydration error:', e?.message || e);
        }

        // D. Church Team Profiles Hydration
        try {
            const { data: remoteProfiles, error: profErr } = await supabase
                .from('profiles')
                .select('id, username, email, full_name, role, avatar_seed, church_id, updated_at');

            if (!profErr && remoteProfiles && remoteProfiles.length > 0) {
                const filtered = remoteProfiles.filter(p => matchesChurch(p.church_id, churchId));
                await profileDB.bulkPut(filtered.length > 0 ? filtered : remoteProfiles);
            }
        } catch (e) {
            console.warn('[Selah Sync] Profiles hydration error:', e?.message || e);
        }

        // E. User Notifications Hydration
        if (user) {
            try {
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
            } catch (e) {
                console.warn('[Selah Sync] Notifications hydration error:', e?.message || e);
            }
        }

        // Step 4 & 5: Flush offline queued actions
        await processSyncQueue(user);

        // Step 6: Automatically evaluate and mark eligible Sunday worship setlists as Done at/after 12:00 noon (Asia/Manila)
        await evaluateSundayNoonSetlists(user);

    } catch (err) {
        console.warn('[Selah Sync] Background sync warning:', err?.message || err);
    }
}

/**
 * Automatically mark eligible active Sunday worship service setlists as Done at or after 12:00 noon (Asia/Manila).
 * Idempotent, resilient, and guarantees status propagation without reverting.
 */
export async function evaluateSundayNoonSetlists(userOrNow = null, optionalNow = null) {
    try {
        let user = null;
        let overrideNow = null;
        if (userOrNow instanceof Date) {
            overrideNow = userOrNow;
        } else if (optionalNow instanceof Date) {
            user = userOrNow;
            overrideNow = optionalNow;
        } else {
            user = userOrNow;
        }

        const baseDate = overrideNow || new Date();
        const manilaStr = baseDate.toLocaleString('en-US', { timeZone: 'Asia/Manila' });
        const manilaNow = new Date(manilaStr);
        const manilaYear = manilaNow.getFullYear();
        const manilaMonth = manilaNow.getMonth();
        const manilaDay = manilaNow.getDate();
        const manilaHour = manilaNow.getHours();
        const manilaDateStr = `${manilaYear}-${String(manilaMonth + 1).padStart(2, '0')}-${String(manilaDay).padStart(2, '0')}`;

        const allSetlists = await db.setlists.toArray();
        const completedList = [];

        for (const s of allSetlists) {
            if (s.status === 'done' || s.status === 'archived' || s.status === 'cancelled') {
                continue;
            }
            if (!s.date) continue;

            const parts = String(s.date).split('-');
            if (parts.length !== 3) continue;

            const sYear = parseInt(parts[0], 10);
            const sMonth = parseInt(parts[1], 10) - 1;
            const sDay = parseInt(parts[2], 10);
            const dateObj = new Date(Date.UTC(sYear, sMonth, sDay, 0, 0, 0));
            const isSunday = dateObj.getUTCDay() === 0;
            const titleLower = (s.title || '').toLowerCase();
            const isSundayService = isSunday || titleLower.includes('sunday') || titleLower.includes('worship service');

            if (!isSundayService) continue;

            let eligible = false;
            if (s.date < manilaDateStr) {
                eligible = true;
            } else if (s.date === manilaDateStr) {
                if (manilaHour >= 12) {
                    eligible = true;
                }
            }

            if (eligible) {
                const updated = {
                    ...s,
                    status: 'done',
                    updatedAt: new Date().toISOString()
                };
                await db.setlists.put(updated);
                if (user) {
                    await pushSetlistToSupabase(updated, user, { skipSync: true });
                }
                completedList.push(updated);
            }
        }

        return completedList;
    } catch (err) {
        console.warn('[Selah Sync] evaluateSundayNoonSetlists error:', err);
        return [];
    }
}

export async function discreetBackgroundSync() {
    if (currentSyncPromise) {
        syncQueued = true;
        return currentSyncPromise;
    }

    currentSyncPromise = (async () => {
        try {
            await doDiscreetBackgroundSync();
        } finally {
            currentSyncPromise = null;
            if (syncQueued) {
                syncQueued = false;
                await discreetBackgroundSync();
            }
        }
    })();

    return currentSyncPromise;
}

// ── Initialize Realtime Synchronization ──
export async function initRealtimeSync(user = null) {
    const churchId = await getUserChurchId(user);

    // 1. Sync User Profile if authenticated (safe non-destructive)
    if (user) {
        await migrateDataToSupabase(user);
    }

    // 2. Initial bidirectional sync (pull server authoritative state, then push valid queue)
    await discreetBackgroundSync();

    // 3. Start background sync timer (every 30s)
    if (backgroundSyncTimer) {
        clearInterval(backgroundSyncTimer);
    }
    backgroundSyncTimer = setInterval(() => {
        discreetBackgroundSync().catch(() => {});
    }, 30000);

    // 4. Subscribe to Supabase Realtime changes
    if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
    }

    realtimeChannel = supabase.channel('public:selah_collaborative')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id;
            if (churchId && itemChurchId && !matchesChurch(itemChurchId, churchId)) {
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
            if (itemChurchId && !matchesChurch(itemChurchId, churchId)) {
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const targetId = String(payload.new.id);
                if (await isTombstoned('setlists', targetId, payload.new.updated_at)) {
                    return;
                }

                const pending = await getPendingOpForRecord('setlists', targetId);
                if (!pending) {
                    await syncSetlistToDexie(payload.new, churchId);
                } else if (pending.action === 'upsert' && isRemoteNewer(pending.baseUpdatedAt, payload.new.updated_at)) {
                    const reconciled = reconcileSetlist(payload.new, pending);
                    pending.payload = reconciled;
                    pending.baseUpdatedAt = payload.new.updated_at;
                    await db.syncQueue.put(pending);
                    await db.setlists.put(reconciled);
                }

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
            } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                await db.setlists.delete(String(payload.old.id));
                await recordTombstone('setlists', payload.old.id, churchId);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'minister_schedules' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id;
            if (churchId && itemChurchId && !matchesChurch(itemChurchId, churchId)) {
                return;
            }

            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                const targetId = String(payload.new.id);
                if (await isTombstoned('minister_schedules', targetId, payload.new.updated_at)) {
                    return;
                }

                const pending = await getPendingOpForRecord('minister_schedules', targetId);
                if (!pending) {
                    await syncScheduleToDexie(payload.new, churchId);
                } else if (pending.action === 'upsert' && isRemoteNewer(pending.baseUpdatedAt, payload.new.updated_at)) {
                    const reconciled = reconcileSchedule(payload.new, pending);
                    pending.payload = reconciled;
                    pending.baseUpdatedAt = payload.new.updated_at;
                    await db.syncQueue.put(pending);
                    await db.schedules.put(reconciled);
                }

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
                await recordTombstone('minister_schedules', payload.old.id, churchId);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_notifications' }, async (payload) => {
            const itemChurchId = payload.new?.church_id || payload.old?.church_id;
            if (churchId && itemChurchId && !matchesChurch(itemChurchId, churchId)) {
                return;
            }

            const targetUserId = payload.new?.user_id;
            const isForCurrentUser = Boolean(user && targetUserId === user.id);
            const isBroadcast = !targetUserId;

            if (!isForCurrentUser && !isBroadcast && payload.eventType !== 'DELETE') {
                return;
            }

            if (payload.eventType === 'INSERT') {
                await syncNotificationToDexie(payload.new, churchId, user?.id);
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
                const pending = await getPendingOpForRecord('songs', songId);

                if (pending && pending.action === 'upsert' && isRemoteNewer(pending.baseUpdatedAt, payload.new.updated_at)) {
                    const reconciled = reconcileSong(payload.new, pending);
                    pending.payload = reconciled;
                    pending.baseUpdatedAt = payload.new.updated_at;
                    await db.syncQueue.put(pending);
                    await db.songs.put(reconciled);
                    return;
                }

                if (existing && !isRemoteNewer(existing.updatedAt, payload.new.updated_at)) {
                    return;
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
                    baseUpdatedAt: payload.new.updated_at,
                    language: payload.new.language || existing?.language || 'English',
                    tags: payload.new.tags || existing?.tags || [payload.new.category || 'Slow']
                });
            } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                const songId = !isNaN(Number(payload.old.id)) ? Number(payload.old.id) : payload.old.id;
                await db.songs.delete(songId);
                await recordTombstone('songs', songId);
            }
        })
        .subscribe();
}

// Auto-sync when internet connection is restored
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
                discreetBackgroundSync().catch(() => {});
                initRealtimeSync(user).catch(() => {});
            }
        }).catch(() => {});
    });
}

// ── Application Push & Delete Actions ──

export async function pushSetlistToSupabase(setlist, user, opts = {}) {
    if (!setlist) return;
    try {
        const churchId = setlist.churchId || (user ? await getUserChurchId(user) : 'JFCM-Mercedes') || 'JFCM-Mercedes';
        const now = new Date().toISOString();
        const setlistUserId = setlist.userId || user?.id || null;
        const targetId = String(setlist.id);

        const localRecord = {
            ...setlist,
            id: targetId,
            churchId,
            userId: setlistUserId,
            status: setlist.status || 'active',
            updatedAt: now,
            baseUpdatedAt: setlist.baseUpdatedAt || setlist.updatedAt || now
        };
        await db.setlists.put(localRecord);

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'setlists',
                action: 'upsert',
                recordId: targetId,
                payload: localRecord,
                baseUpdatedAt: setlist.baseUpdatedAt || setlist.updatedAt,
                clientUpdatedAt: now,
                churchId,
                user
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] pushSetlistToSupabase error:', err?.message || err);
    }
}

export async function deleteSetlistFromSupabase(setlistId, user, opts = {}) {
    if (!setlistId) return;
    try {
        const idStr = String(setlistId);
        const churchId = user ? await getUserChurchId(user) : 'JFCM-Mercedes';
        const now = new Date().toISOString();

        await db.setlists.delete(idStr);
        await recordTombstone('setlists', idStr, churchId, now);

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'setlists',
                action: 'delete',
                recordId: idStr,
                churchId,
                user,
                clientUpdatedAt: now
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] deleteSetlistFromSupabase error:', err?.message || err);
    }
}

export async function pushScheduleToSupabase(schedule, user, opts = {}) {
    if (!schedule) return;
    try {
        const churchId = schedule.churchId || (user ? await getUserChurchId(user) : 'JFCM-Mercedes') || 'JFCM-Mercedes';
        const now = new Date().toISOString();
        const createdBy = schedule.createdBy || user?.id || null;
        const targetId = String(schedule.id);

        const localRecord = {
            ...schedule,
            id: targetId,
            churchId,
            createdBy,
            updatedAt: now,
            baseUpdatedAt: schedule.baseUpdatedAt || schedule.updatedAt || now
        };
        await db.schedules.put(localRecord);

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'minister_schedules',
                action: 'upsert',
                recordId: targetId,
                payload: localRecord,
                baseUpdatedAt: schedule.baseUpdatedAt || schedule.updatedAt,
                clientUpdatedAt: now,
                churchId,
                user
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] pushScheduleToSupabase error:', err?.message || err);
    }
}

export async function deleteScheduleFromSupabase(scheduleId, user, opts = {}) {
    if (!scheduleId) return;
    try {
        const idStr = String(scheduleId);
        const churchId = user ? await getUserChurchId(user) : 'JFCM-Mercedes';
        const now = new Date().toISOString();

        await db.schedules.delete(idStr);
        await recordTombstone('minister_schedules', idStr, churchId, now);

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'minister_schedules',
                action: 'delete',
                recordId: idStr,
                churchId,
                user,
                clientUpdatedAt: now
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] deleteScheduleFromSupabase error:', err?.message || err);
    }
}

export async function pushSongToSupabase(song, user, opts = {}) {
    if (!song) return;
    try {
        const now = new Date().toISOString();
        const songId = String(song.id);

        const localRecord = {
            ...song,
            updatedAt: now,
            baseUpdatedAt: song.baseUpdatedAt || song.updatedAt || now
        };
        const numId = Number(song.id);
        await db.songs.put({
            ...localRecord,
            id: !isNaN(numId) ? numId : songId
        });

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'songs',
                action: 'upsert',
                recordId: songId,
                payload: localRecord,
                baseUpdatedAt: song.baseUpdatedAt || song.updatedAt,
                clientUpdatedAt: now,
                user
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] pushSongToSupabase error:', err?.message || err);
    }
}

export async function deleteSongFromSupabase(songId, user, opts = {}) {
    if (!songId) return;
    try {
        const idStr = String(songId);
        const now = new Date().toISOString();
        const numId = Number(songId);

        await db.songs.delete(!isNaN(numId) ? numId : idStr);
        await recordTombstone('songs', idStr, 'JFCM-Mercedes', now);

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'songs',
                action: 'delete',
                recordId: idStr,
                user,
                clientUpdatedAt: now
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] deleteSongFromSupabase error:', err?.message || err);
    }
}

export async function pushNotificationToSupabase(notification, user, opts = {}) {
    if (!notification) return;
    try {
        const churchId = notification.churchId || (user ? await getUserChurchId(user) : 'JFCM-Mercedes') || 'JFCM-Mercedes';
        const now = new Date().toISOString();
        const notifId = String(notification.id);

        await db.notifications.put({
            ...notification,
            id: notifId,
            churchId,
            createdAt: notification.createdAt || now
        });

        if (!opts.skipQueue) {
            await enqueueSyncOperation({
                table: 'user_notifications',
                action: 'upsert',
                recordId: notifId,
                payload: notification,
                churchId,
                user,
                clientUpdatedAt: now
            });
        }

        if (!opts.skipSync) {
            await discreetBackgroundSync();
        }
    } catch (err) {
        console.error('[Selah Sync] pushNotificationToSupabase error:', err?.message || err);
    }
}

export async function markNotificationReadInSupabase(notificationId, user) {
    if (!notificationId) return;
    try {
        await db.notifications.update(String(notificationId), { isRead: true });
        if (user) {
            await withRetry(() => supabase.from('user_notifications').update({ is_read: true }).eq('id', String(notificationId)));
        }
    } catch (err) {
        console.warn('Failed to mark notification as read in Supabase:', err);
    }
}

export async function markAllNotificationsReadInSupabase(userId) {
    if (!userId) return;
    try {
        await db.notifications.filter(n => !n.userId || String(n.userId) === String(userId)).modify({ isRead: true });
        await withRetry(() => supabase.from('user_notifications').update({ is_read: true }).eq('user_id', String(userId)));
    } catch (err) {
        console.warn('Failed to mark all notifications read in Supabase:', err);
    }
}

export async function clearAllNotificationsInSupabase(userId) {
    if (!userId) return;
    try {
        const itemsToDelete = await db.notifications
            .filter(n => !n.userId || String(n.userId) === String(userId))
            .primaryKeys();
        if (itemsToDelete.length > 0) {
            await db.notifications.bulkDelete(itemsToDelete);
        }
        await withRetry(() => supabase.from('user_notifications').delete().eq('user_id', String(userId)));
    } catch (err) {
        console.warn('Failed to clear notifications in Supabase:', err);
    }
}

export async function deleteNotificationInSupabase(notificationId) {
    if (!notificationId) return;
    try {
        await db.notifications.delete(String(notificationId));
        await withRetry(() => supabase.from('user_notifications').delete().eq('id', String(notificationId)));
    } catch (err) {
        console.warn('Failed to delete notification in Supabase:', err);
    }
}
