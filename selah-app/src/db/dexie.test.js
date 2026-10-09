import { describe, it, expect, beforeEach } from 'vitest';
import { db, songDB, setlistDB, scheduleDB, profileDB, notificationDB, getSongByIdOrTitle, cleanupDuplicateSongs, seedDatabase } from '../db/dexie.js';
import scrapedSongs from '../db/scraped_songs.json' with { type: 'json' };

async function reset() {
    await db.delete();
    await db.open();
}

beforeEach(reset);

describe('Dexie schema', () => {
    it('opens with v2 schema and exposes expected tables', () => {
        expect(db.name).toBe('SelahWorshipDB_v2');
        expect(db.tables.map(t => t.name).sort()).toEqual(
            ['songs', 'setlists', 'schedules', 'profiles', 'notifications', 'settings', 'syncQueue'].sort()
        );
    });
});

describe('seedDatabase', () => {
    it('seeds songs on first run', async () => {
        const before = await db.songs.count();
        expect(before).toBe(0);
        await seedDatabase();
        const after = await db.songs.count();
        expect(after).toBe(scrapedSongs.length);
    });

    it('does NOT wipe existing data on re-run', async () => {
        await seedDatabase();
        const initial = await db.songs.count();
        // Add a custom song
        await songDB.add({ title: 'My Test Song', artist: 'Test', originalKey: 'C' });
        await seedDatabase();
        const after = await db.songs.count();
        expect(after).toBe(initial + 1);
    });
});

describe('songDB', () => {
    it('getById handles numeric and string IDs', async () => {
        await seedDatabase();
        const num = await songDB.getById(1);
        const str = await songDB.getById('1');
        expect(num?.id).toBeDefined();
        expect(str?.id).toBeDefined();
    });

    it('getById returns undefined for unknown ID', async () => {
        const result = await songDB.getById('does-not-exist');
        expect(result).toBeUndefined();
    });

    it('add assigns a UUID when id is missing', async () => {
        const id = await songDB.add({ title: 'New Song', artist: 'X', originalKey: 'C' });
        expect(id).toMatch(/^[0-9a-f-]{36}$/i);
        const fetched = await db.songs.get(id);
        expect(fetched.title).toBe('New Song');
    });

    it('search filters by title, artist, or lyrics case-insensitively', async () => {
        await seedDatabase();
        const r = await songDB.search('amazing');
        expect(r.length).toBeGreaterThan(0);
        for (const s of r) {
            const t = (s.title || '').toLowerCase();
            const a = (s.artist || '').toLowerCase();
            const l = (s.lyrics || '').toLowerCase();
            expect(t.includes('amazing') || a.includes('amazing') || l.includes('amazing')).toBe(true);
        }

        // Test lyrics-only match
        await songDB.add({ title: 'Unique Title 123', artist: 'Unknown', lyrics: 'Sing hallelujah to the righteous King', originalKey: 'G' });
        const lyricsMatch = await songDB.search('righteous King');
        expect(lyricsMatch.some(s => s.title === 'Unique Title 123')).toBe(true);
    });
});

describe('setlistDB', () => {
    it('getAll returns [] when empty', async () => {
        expect(await setlistDB.getAll()).toEqual([]);
    });

    it('add + getById roundtrip with UUID id', async () => {
        const id = await setlistDB.add({ title: 'Sunday Service', songIds: [] });
        expect(typeof id).toBe('string');
        const fetched = await setlistDB.getById(id);
        expect(fetched.title).toBe('Sunday Service');
    });
});

describe('getSongByIdOrTitle', () => {
    beforeEach(async () => {
        await seedDatabase();
    });

    it('finds song by numeric id from seed', async () => {
        const song = await getSongByIdOrTitle(1);
        expect(song).toBeTruthy();
        expect(song.id).toBe(1);
    });

    it('finds song by title fallback', async () => {
        const first = scrapedSongs[0];
        const song = await getSongByIdOrTitle(first.title);
        expect(song).toBeTruthy();
        expect(song.title.toLowerCase()).toBe(first.title.toLowerCase());
    });

    it('returns null for missing id/title or blank strings', async () => {
        expect(await getSongByIdOrTitle('zzzz-no-such-song')).toBeNull();
        expect(await getSongByIdOrTitle('')).toBeNull();
        expect(await getSongByIdOrTitle('   ')).toBeNull();
        expect(await getSongByIdOrTitle(null)).toBeNull();
        expect(await getSongByIdOrTitle(undefined)).toBeNull();
    });

    it('rejects adding song with empty title', async () => {
        await expect(songDB.add({ title: '', artist: 'A' })).rejects.toThrow();
        await expect(songDB.add({ title: '   ', artist: 'A' })).rejects.toThrow();
    });
});

describe('scheduleDB', () => {
    it('getAll returns [] when empty', async () => {
        expect(await scheduleDB.getAll()).toEqual([]);
    });

    it('add + getById roundtrip with UUID id', async () => {
        const id = await scheduleDB.add({ 
            serviceTitle: 'Sunday Worship Service', 
            serviceDate: '2026-08-30',
            assignments: [{ role_name: 'Worship Leader', user_name: 'Kurt' }] 
        });
        expect(typeof id).toBe('string');
        const fetched = await scheduleDB.getById(id);
        expect(fetched.serviceTitle).toBe('Sunday Worship Service');
        expect(fetched.assignments.length).toBe(1);
    });

    it('update modifies schedule record', async () => {
        const id = await scheduleDB.add({ 
            serviceTitle: 'Midweek Service', 
            serviceDate: '2026-09-02',
            assignments: [] 
        });
        await scheduleDB.update(id, { serviceTitle: 'Youth Service' });
        const updated = await scheduleDB.getById(id);
        expect(updated.serviceTitle).toBe('Youth Service');
    });

    it('delete removes schedule record', async () => {
        const id = await scheduleDB.add({ 
            serviceTitle: 'To Delete', 
            serviceDate: '2026-09-05' 
        });
        await scheduleDB.delete(id);
        expect(await scheduleDB.getById(id)).toBeUndefined();
    });
});

describe('notificationDB', () => {
    it('add + getById roundtrip', async () => {
        const notifId = await notificationDB.add({
            userId: 'user-123',
            churchId: 'JFCM-Mercedes',
            title: 'Worship Assignment',
            body: 'You are assigned as Guitarist',
            type: 'assignment'
        });
        expect(typeof notifId).toBe('string');
        const fetched = await notificationDB.getById(notifId);
        expect(fetched.title).toBe('Worship Assignment');
        expect(fetched.isRead).toBe(false);
    });

    it('markAsRead updates notification status', async () => {
        const notifId = await notificationDB.add({
            userId: 'user-123',
            title: 'Test',
            body: 'Body'
        });
        await notificationDB.markAsRead(notifId);
        const fetched = await notificationDB.getById(notifId);
        expect(fetched.isRead).toBe(true);
    });

    it('markAllAsRead marks all user notifications as read', async () => {
        await notificationDB.add({ userId: 'user-123', title: '1', body: '1' });
        await notificationDB.add({ userId: 'user-123', title: '2', body: '2' });
        await notificationDB.add({ userId: 'user-456', title: '3', body: '3' });

        await notificationDB.markAllAsRead('user-123');

        const unreadUser1 = await notificationDB.getUnreadByUser('user-123');
        const unreadUser2 = await notificationDB.getUnreadByUser('user-456');

        expect(unreadUser1.length).toBe(0);
        expect(unreadUser2.length).toBe(1);
    });

    it('clearAll removes user notifications', async () => {
        await notificationDB.add({ userId: 'user-123', title: '1' });
        await notificationDB.add({ userId: 'user-456', title: '2' });

        await notificationDB.clearAll('user-123');

        const user1Items = await notificationDB.getByUser('user-123');
        const user2Items = await notificationDB.getByUser('user-456');

        expect(user1Items.length).toBe(0);
        expect(user2Items.length).toBe(1);
    });

    it('clearAll removes user notifications and unassigned notifications while keeping other users', async () => {
        await db.notifications.clear();
        await notificationDB.add({ userId: 'user-123', title: '1' });
        await notificationDB.add({ userId: null, title: 'Broadcast' });
        await notificationDB.add({ userId: 'user-456', title: '2' });

        await notificationDB.clearAll('user-123');

        const allRemaining = await db.notifications.toArray();
        expect(allRemaining.length).toBe(1);
        expect(allRemaining[0].userId).toBe('user-456');
    });
});

describe('profileDB', () => {
    it('put and getAll profiles by churchId', async () => {
        await profileDB.put({ id: 'p1', username: 'kurt', email: 'kurt@example.com', church_id: 'JFCM-Mercedes', role: 'superuser' });
        await profileDB.put({ id: 'p2', username: 'worship-leader', email: 'wl@example.com', church_id: 'JFCM-Mercedes', role: 'worship_leader' });
        await profileDB.put({ id: 'p3', username: 'other-church', email: 'other@example.com', church_id: 'Other-Church', role: 'admin' });

        const churchMembers = await profileDB.getAll('JFCM-Mercedes');
        expect(churchMembers.length).toBe(2);

        const all = await profileDB.getAll();
        expect(all.length).toBe(3);

        const p1 = await profileDB.getById('p1');
        expect(p1.username).toBe('kurt');
        expect(p1.role).toBe('superuser');
    });

    it('bulkPut saves multiple profiles', async () => {
        await profileDB.bulkPut([
            { id: 'b1', username: 'Singer 1', role: 'worship_team_member' },
            { id: 'b2', username: 'Drummer', role: 'admin' }
        ]);

        const all = await profileDB.getAll();
        expect(all.length).toBe(2);
    });
});

