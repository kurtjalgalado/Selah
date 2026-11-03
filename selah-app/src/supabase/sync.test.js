import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db/dexie';
import {
    reconcileSetlist,
    reconcileSchedule,
    reconcileSong,
    recordTombstone,
    isTombstoned,
    enqueueSyncOperation,
    getPendingOpForRecord,
    processSyncQueue,
    discreetBackgroundSync,
    pushSetlistToSupabase,
    deleteSetlistFromSupabase,
    pushScheduleToSupabase,
    deleteScheduleFromSupabase,
    isRemoteNewer
} from './sync';
import { supabase } from './client';

// In-memory simulated Supabase remote store
let remoteStore = {
    setlists: [],
    minister_schedules: [],
    songs: [],
    profiles: [],
    user_notifications: []
};

let currentUser = {
    id: 'user-account-a',
    email: 'kurt.jalgalado@gmail.com',
    user_metadata: { church_id: 'JFCM-Mercedes', username: 'Kurt' }
};

function createMockSupabaseBuilder(table) {
    let filters = [];
    return {
        select: vi.fn(function () { return this; }),
        order: vi.fn(function () { return this; }),
        eq: vi.fn(function (field, val) {
            filters.push({ field, op: 'eq', val });
            return this;
        }),
        or: vi.fn(function () { return this; }),
        limit: vi.fn(function () { return this; }),
        maybeSingle: vi.fn(async function () {
            const list = remoteStore[table] || [];
            const found = list.find(item => {
                return filters.every(f => f.op === 'eq' && String(item[f.field]) === String(f.val));
            });
            return { data: found || null, error: null };
        }),
        upsert: vi.fn(async function (payload) {
            const list = remoteStore[table] || [];
            const items = Array.isArray(payload) ? payload : [payload];
            for (const item of items) {
                const idx = list.findIndex(x => String(x.id) === String(item.id));
                if (idx >= 0) {
                    list[idx] = { ...list[idx], ...item };
                } else {
                    list.push({ ...item });
                }
            }
            return { data: items, error: null };
        }),
        insert: vi.fn(async function (payload) {
            const list = remoteStore[table] || [];
            const items = Array.isArray(payload) ? payload : [payload];
            for (const item of items) {
                list.push({ ...item });
            }
            return { data: items, error: null };
        }),
        update: vi.fn(function (payload) {
            return {
                eq: vi.fn(async function (field, val) {
                    const list = remoteStore[table] || [];
                    for (let i = 0; i < list.length; i++) {
                        if (String(list[i][field]) === String(val)) {
                            list[i] = { ...list[i], ...payload };
                        }
                    }
                    return { data: null, error: null };
                })
            };
        }),
        delete: vi.fn(function () {
            return {
                eq: vi.fn(async function (field, val) {
                    const list = remoteStore[table] || [];
                    remoteStore[table] = list.filter(item => String(item[field]) !== String(val));
                    return { data: null, error: null };
                })
            };
        }),
        then: function (resolve) {
            const list = remoteStore[table] ? [...remoteStore[table]] : [];
            resolve({ data: list, error: null });
        }
    };
}

describe('Bidirectional Synchronization & Conflict Resolution', () => {
    beforeEach(async () => {
        await db.setlists.clear();
        await db.schedules.clear();
        await db.songs.clear();
        await db.notifications.clear();
        await db.settings.clear();
        await db.syncQueue.clear();

        remoteStore = {
            setlists: [],
            minister_schedules: [],
            songs: [],
            profiles: [
                { id: 'user-account-a', church_id: 'JFCM-Mercedes', username: 'Kurt', role: 'superuser' },
                { id: 'user-account-b', church_id: 'JFCM-Mercedes', username: 'Christian', role: 'admin' }
            ],
            user_notifications: []
        };

        currentUser = {
            id: 'user-account-a',
            email: 'kurt.jalgalado@gmail.com',
            user_metadata: { church_id: 'JFCM-Mercedes', username: 'Kurt' }
        };

        vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({
            data: { user: currentUser },
            error: null
        });

        vi.spyOn(supabase, 'from').mockImplementation((table) => {
            return createMockSupabaseBuilder(table);
        });
    });

    describe('Scenario A: Remote Update Protection', () => {
        it('Account B hydrates server updates without reverting or clobbering Account A changes', async () => {
            // Initial server state: Setlist S1 created by Account A
            const t0 = '2026-10-11T10:00:00.000Z';
            const t1 = '2026-10-11T11:00:00.000Z';

            remoteStore.setlists.push({
                id: 'setlist-1',
                church_id: 'JFCM-Mercedes',
                user_id: 'user-account-a',
                title: 'Sunday Worship Service',
                date: '2099-10-18',
                notes: 'Initial notes',
                song_ids: [1, 2],
                song_keys: { '1': 'G', '2': 'C' },
                updated_at: t0
            });

            // Account B loads initial state into its local Dexie
            await db.setlists.put({
                id: 'setlist-1',
                churchId: 'JFCM-Mercedes',
                userId: 'user-account-a',
                title: 'Sunday Worship Service',
                date: '2099-10-18',
                notes: 'Initial notes',
                songIds: [1, 2],
                songKeys: { '1': 'G', '2': 'C' },
                updatedAt: t0,
                baseUpdatedAt: t0
            });

            // Account A updates the title on the server to "Sunday Celebration" at t1
            remoteStore.setlists[0].title = 'Sunday Celebration';
            remoteStore.setlists[0].notes = 'Account A updated notes';
            remoteStore.setlists[0].updated_at = t1;

            // Account B (acting as currentUser user-account-b) synchronizes with its older session
            currentUser = {
                id: 'user-account-b',
                email: 'christianuyreyes@gmail.com',
                user_metadata: { church_id: 'JFCM-Mercedes', username: 'Christian' }
            };

            await discreetBackgroundSync();

            // Account B local Dexie MUST have Account A's latest update
            const accountBLocal = await db.setlists.get('setlist-1');
            expect(accountBLocal.title).toBe('Sunday Celebration');
            expect(accountBLocal.notes).toBe('Account A updated notes');
            expect(accountBLocal.updatedAt).toBe(t1);

            // Server MUST still have Account A's title (not reverted)
            const serverRecord = remoteStore.setlists.find(s => s.id === 'setlist-1');
            expect(serverRecord.title).toBe('Sunday Celebration');
        });
    });

    describe('Scenario B: Changes from Multiple Accounts', () => {
        it('Account A creates Record 1, Account B creates Record 2; both records coexist after sync', async () => {
            const now = new Date().toISOString();

            // Account A creates Setlist 1
            const userA = { id: 'user-account-a', user_metadata: { church_id: 'JFCM-Mercedes' } };
            await pushSetlistToSupabase({
                id: 'setlist-A',
                churchId: 'JFCM-Mercedes',
                title: 'Lineup by Account A',
                date: '2026-10-25',
                songIds: [10],
                updatedAt: now
            }, userA);

            // Run sync to push Account A's setlist to remote
            await discreetBackgroundSync();

            expect(remoteStore.setlists.some(s => s.id === 'setlist-A')).toBe(true);

            // Now Account B creates Setlist B locally while acting as user B
            currentUser = { id: 'user-account-b', user_metadata: { church_id: 'JFCM-Mercedes' } };
            await pushSetlistToSupabase({
                id: 'setlist-B',
                churchId: 'JFCM-Mercedes',
                title: 'Lineup by Account B',
                date: '2026-11-01',
                songIds: [20],
                updatedAt: now
            }, currentUser);

            // Run sync for Account B
            await discreetBackgroundSync();

            // Server must have BOTH setlists
            expect(remoteStore.setlists.some(s => s.id === 'setlist-A')).toBe(true);
            expect(remoteStore.setlists.some(s => s.id === 'setlist-B')).toBe(true);

            // Account B's local Dexie must contain BOTH setlists
            const localA = await db.setlists.get('setlist-A');
            const localB = await db.setlists.get('setlist-B');
            expect(localA).toBeDefined();
            expect(localB).toBeDefined();
            expect(localA.title).toBe('Lineup by Account A');
            expect(localB.title).toBe('Lineup by Account B');
        });
    });

    describe('Scenario C: Concurrent Edits and Field-Level Merge', () => {
        it('reconcileSetlist merges independent field changes (notes from A, songs from B)', () => {
            const baseTime = '2026-10-11T12:00:00.000Z';
            const serverTime = '2026-10-11T12:05:00.000Z';
            const clientTime = '2026-10-11T12:06:00.000Z';

            // Server record: Account A updated notes and song_keys
            const remoteRecord = {
                id: 'setlist-1',
                church_id: 'JFCM-Mercedes',
                user_id: 'user-a',
                title: 'Sunday Worship',
                date: '2026-10-18',
                notes: 'Practice on Saturday at 4 PM',
                song_ids: [1, 2],
                song_keys: { '1': 'D', '2': 'E' },
                updated_at: serverTime
            };

            // Local pending: Account B added songs 3 and 4, and changed key for song 3
            const localPending = {
                table: 'setlists',
                recordId: 'setlist-1',
                baseUpdatedAt: baseTime,
                clientUpdatedAt: clientTime,
                churchId: 'JFCM-Mercedes',
                userId: 'user-b',
                payload: {
                    id: 'setlist-1',
                    title: 'Sunday Worship',
                    date: '2026-10-18',
                    notes: '',
                    songIds: [1, 2, 3, 4],
                    songKeys: { '3': 'G' }
                }
            };

            const reconciled = reconcileSetlist(remoteRecord, localPending);

            // Both changes must be preserved:
            // 1. All songs: [1, 2, 3, 4]
            expect(reconciled.songIds).toEqual([1, 2, 3, 4]);
            // 2. Merged keys: 1: 'D', 2: 'E', 3: 'G'
            expect(reconciled.songKeys).toEqual({ '1': 'D', '2': 'E', '3': 'G' });
            // 3. Notes from server preserved
            expect(reconciled.notes).toBe('Practice on Saturday at 4 PM');
        });

        it('reconcileSchedule merges independent minister role assignments', () => {
            const baseTime = '2026-10-11T12:00:00.000Z';
            const serverTime = '2026-10-11T12:05:00.000Z';
            const clientTime = '2026-10-11T12:06:00.000Z';

            // Server: Account A assigned Vocalist
            const remoteRecord = {
                id: 'sched-1',
                church_id: 'JFCM-Mercedes',
                service_title: 'Sunday Service',
                service_date: '2026-10-18',
                service_time: '09:00 AM',
                assignments: [
                    { role_name: 'Lead Vocalist', user_name: 'Maria anna', user_id: 'user-anna' }
                ],
                updated_at: serverTime
            };

            // Local: Account B assigned Drummer and Acoustic Guitarist
            const localPending = {
                table: 'minister_schedules',
                recordId: 'sched-1',
                baseUpdatedAt: baseTime,
                clientUpdatedAt: clientTime,
                churchId: 'JFCM-Mercedes',
                userId: 'user-b',
                payload: {
                    id: 'sched-1',
                    serviceTitle: 'Sunday Service',
                    serviceDate: '2026-10-18',
                    serviceTime: '09:00 AM',
                    assignments: [
                        { role_name: 'Drummer', user_name: 'Christian', user_id: 'user-christian' },
                        { role_name: 'Acoustic Guitarist', user_name: 'Kurt', user_id: 'user-kurt' }
                    ]
                }
            };

            const reconciled = reconcileSchedule(remoteRecord, localPending);

            // All 3 assignments must exist in the merged schedule
            expect(reconciled.assignments.length).toBe(3);
            const roles = reconciled.assignments.map(a => a.role_name).sort();
            expect(roles).toEqual(['Acoustic Guitarist', 'Drummer', 'Lead Vocalist'].sort());
        });
    });

    describe('Scenario D: Remote Deletion and Tombstones', () => {
        it('Account A deletes a record; Account B syncs and removes local copy without resurrecting', async () => {
            const t0 = '2026-10-11T09:00:00.000Z';

            // Initial state: S1 exists on server and locally on Account B
            remoteStore.setlists.push({
                id: 'setlist-to-delete',
                church_id: 'JFCM-Mercedes',
                title: 'Obsolete Setlist',
                updated_at: t0
            });

            await db.setlists.put({
                id: 'setlist-to-delete',
                churchId: 'JFCM-Mercedes',
                title: 'Obsolete Setlist',
                updatedAt: t0,
                baseUpdatedAt: t0
            });

            // Account A deletes the setlist from Supabase
            remoteStore.setlists = [];

            // Account B synchronizes
            await discreetBackgroundSync();

            // S1 must be deleted from Account B's local Dexie
            const localRecord = await db.setlists.get('setlist-to-delete');
            expect(localRecord).toBeUndefined();

            // Tombstone must be recorded
            const tombstoned = await isTombstoned('setlists', 'setlist-to-delete');
            expect(tombstoned).toBe(true);

            // S1 must NOT be restored on Supabase
            expect(remoteStore.setlists.length).toBe(0);
        });

        it('stale local session cannot restore a deleted record', async () => {
            // Tombstone exists for a deleted record
            await recordTombstone('setlists', 'setlist-deleted-1', 'JFCM-Mercedes', '2026-10-11T12:00:00.000Z');

            // If a stale fetch returns a record with updated_at <= tombstone deletedAt:
            const isStale = await isTombstoned('setlists', 'setlist-deleted-1', '2026-10-11T11:00:00.000Z');
            expect(isStale).toBe(true);

            // But if remote updated_at is newer (intentional re-creation on server):
            const isNewer = await isTombstoned('setlists', 'setlist-deleted-1', '2026-10-11T13:00:00.000Z');
            expect(isNewer).toBe(false);
        });
    });

    describe('Scenario E: Offline Recovery', () => {
        it('preserves offline changes in syncQueue, pulls remote state first, then pushes pending changes', async () => {
            const t0 = '2026-10-11T10:00:00.000Z';
            const t1 = '2026-10-11T10:30:00.000Z';

            // Server already has Setlist 1 updated by Account A at t1
            remoteStore.setlists.push({
                id: 'setlist-remote-1',
                church_id: 'JFCM-Mercedes',
                title: 'Account A Remote Edit',
                updated_at: t1
            });

            // Device went offline and created a new Setlist locally:
            const offlineSetlist = {
                id: 'setlist-offline-created',
                churchId: 'JFCM-Mercedes',
                title: 'Created While Offline',
                date: '2026-11-15',
                songIds: [5, 6],
                updatedAt: '2026-10-11T10:45:00.000Z'
            };
            await db.setlists.put(offlineSetlist);
            await enqueueSyncOperation({
                table: 'setlists',
                action: 'upsert',
                recordId: 'setlist-offline-created',
                payload: offlineSetlist,
                churchId: 'JFCM-Mercedes',
                user: currentUser
            });

            // Verify queue holds the pending change
            const pendingBefore = await db.syncQueue.toArray();
            expect(pendingBefore.length).toBe(1);
            expect(pendingBefore[0].recordId).toBe('setlist-offline-created');

            // Device reconnects and runs sync
            await discreetBackgroundSync();

            // 1. Pending queue must be processed and cleared
            const pendingAfter = await db.syncQueue.toArray();
            expect(pendingAfter.length).toBe(0);

            // 2. Server must contain BOTH the remote setlist and the newly uploaded offline setlist
            expect(remoteStore.setlists.some(s => s.id === 'setlist-remote-1')).toBe(true);
            expect(remoteStore.setlists.some(s => s.id === 'setlist-offline-created')).toBe(true);

            // 3. Local Dexie has both records
            const localRemote = await db.setlists.get('setlist-remote-1');
            const localOffline = await db.setlists.get('setlist-offline-created');
            expect(localRemote).toBeDefined();
            expect(localRemote.title).toBe('Account A Remote Edit');
            expect(localOffline).toBeDefined();
            expect(localOffline.title).toBe('Created While Offline');
        });
    });

    describe('Scenario F: Mutex & Idempotency', () => {
        it('concurrent sync executions do not corrupt data or produce duplicate records', async () => {
            // Queue a schedule create
            await pushScheduleToSupabase({
                id: 'sched-concurrent-1',
                churchId: 'JFCM-Mercedes',
                serviceTitle: 'Concurrent Test Service',
                serviceDate: '2026-12-01',
                assignments: []
            }, currentUser);

            // Fire 3 simultaneous sync calls
            await Promise.all([
                discreetBackgroundSync(),
                discreetBackgroundSync(),
                discreetBackgroundSync()
            ]);

            // Server must have exactly ONE copy
            const matching = remoteStore.minister_schedules.filter(s => s.id === 'sched-concurrent-1');
            expect(matching.length).toBe(1);

            // Queue must be empty
            const queueItems = await db.syncQueue.toArray();
            expect(queueItems.length).toBe(0);
        });
    });
});
