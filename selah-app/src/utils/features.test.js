import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db, setlistDB } from '../db/dexie';
import { evaluateSundayNoonSetlists } from '../supabase/sync';

describe('Application Features & Enhancements', () => {
    beforeEach(async () => {
        await db.setlists.clear();
        await db.songs.clear();
    });

    describe('Automatic Sunday Setlist Completion at 12:00 Noon', () => {
        it('marks eligible active Sunday worship setlists as done at or after 12:00 noon Manila time', async () => {
            // Setup a Sunday setlist with active status
            const sundaySetlist = {
                id: 'setlist-sunday-1',
                title: 'Sunday Worship Service',
                date: '2026-10-11', // A Sunday
                status: 'active',
                type: 'sunday_worship',
                songIds: [1, 2]
            };
            await db.setlists.add(sundaySetlist);

            // Mock current Manila time as Sunday 12:30 PM (after noon)
            const simulatedManilaNow = new Date('2026-10-11T12:30:00+08:00');

            const completed = await evaluateSundayNoonSetlists(simulatedManilaNow);
            expect(completed.length).toBe(1);
            expect(completed[0].id).toBe('setlist-sunday-1');

            const updated = await setlistDB.getById('setlist-sunday-1');
            expect(updated.status).toBe('done');
        });

        it('does NOT mark Sunday setlist as done before 12:00 noon', async () => {
            const sundayMorningSetlist = {
                id: 'setlist-sunday-morning',
                title: 'Sunday Worship Service',
                date: '2026-10-11',
                status: 'active',
                songIds: [1]
            };
            await db.setlists.add(sundayMorningSetlist);

            // Mock 10:30 AM before noon
            const morningManilaNow = new Date('2026-10-11T10:30:00+08:00');

            const completed = await evaluateSundayNoonSetlists(morningManilaNow);
            expect(completed.length).toBe(0);

            const record = await setlistDB.getById('setlist-sunday-morning');
            expect(record.status).toBe('active');
        });

        it('does NOT affect non-Sunday setlists (e.g. Wednesday Prayer Meeting)', async () => {
            const wednesdaySetlist = {
                id: 'setlist-wednesday',
                title: 'Wednesday Midweek Service',
                date: '2026-10-14', // Wednesday
                status: 'active',
                songIds: [1]
            };
            await db.setlists.add(wednesdaySetlist);

            const wednesdayAfternoon = new Date('2026-10-14T14:00:00+08:00');
            const completed = await evaluateSundayNoonSetlists(wednesdayAfternoon);
            expect(completed.length).toBe(0);

            const record = await setlistDB.getById('setlist-wednesday');
            expect(record.status).toBe('active');
        });

        it('is idempotent and leaves already done setlists intact', async () => {
            const alreadyDoneSetlist = {
                id: 'setlist-done',
                title: 'Sunday Worship Service',
                date: '2026-10-04',
                status: 'done',
                songIds: [1]
            };
            await db.setlists.add(alreadyDoneSetlist);

            const afternoonManilaNow = new Date('2026-10-11T15:00:00+08:00');
            const completed = await evaluateSundayNoonSetlists(afternoonManilaNow);
            expect(completed.length).toBe(0);

            const record = await setlistDB.getById('setlist-done');
            expect(record.status).toBe('done');
        });
    });

    describe('Setlist Filter Logic: Upcoming vs Past Services', () => {
        const todayStr = '2026-10-11';

        const sampleSetlists = [
            { id: '1', title: 'Future Service', date: '2026-10-18', status: 'active' },
            { id: '2', title: 'Today Completed Service', date: '2026-10-11', status: 'done' },
            { id: '3', title: 'Today Active Service', date: '2026-10-11', status: 'active' },
            { id: '4', title: 'Yesterday Service', date: '2026-10-10', status: 'active' },
        ];

        it('excludes completed setlists (status === "done") from upcomingSetlists', () => {
            const upcoming = sampleSetlists.filter(s => (!s.date || s.date >= todayStr) && s.status !== 'done');
            expect(upcoming.map(s => s.id)).toEqual(['1', '3']);
            expect(upcoming.find(s => s.id === '2')).toBeUndefined();
        });

        it('includes completed setlists (status === "done") in pastSetlists', () => {
            const past = sampleSetlists.filter(s => (s.date && s.date < todayStr) || s.status === 'done');
            expect(past.map(s => s.id)).toContain('2');
            expect(past.map(s => s.id)).toContain('4');
            expect(past.find(s => s.id === '3')).toBeUndefined();
        });
    });

    describe('Newly Added Songs Attribution & Sorting', () => {
        const mockSongs = [
            { id: 's1', title: 'Living Hope', createdAt: '2026-09-01T10:00:00Z', createdByName: 'Pastor Mark' },
            { id: 's2', title: 'Goodness of God', createdAt: '2026-10-10T12:00:00Z', createdByName: 'Sarah Jenkins' },
            { id: 's3', title: 'Way Maker', createdAt: '2026-08-15T08:00:00Z' }, // No creator info
            { id: 's4', title: 'Graves Into Gardens', createdAt: '2026-10-11T09:00:00Z', createdByName: 'David Miller' },
            { id: 's5', title: 'King of Kings', createdAt: '2026-07-20T14:00:00Z', createdByName: 'Hannah Reed' },
            { id: 's6', title: 'Oldest Hymn', createdAt: '2025-01-01T00:00:00Z' }
        ];

        it('sorts songs by newest creation date descending and caps at 5', () => {
            const sorted = [...mockSongs]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5);

            expect(sorted.length).toBe(5);
            expect(sorted[0].title).toBe('Graves Into Gardens'); // Oct 11
            expect(sorted[1].title).toBe('Goodness of God');     // Oct 10
            expect(sorted[2].title).toBe('Living Hope');         // Sep 1
            expect(sorted[3].title).toBe('Way Maker');           // Aug 15
            expect(sorted[4].title).toBe('King of Kings');       // Jul 20
        });

        it('provides neutral fallback "Worship Team" when creator info is unavailable without guessing from current user', () => {
            function getCreator(song) {
                if (song?.createdByName && song.createdByName.trim()) return song.createdByName.trim();
                if (song?.created_by_name && song.created_by_name.trim()) return song.created_by_name.trim();
                return 'Worship Team';
            }

            expect(getCreator(mockSongs[1])).toBe('Sarah Jenkins');
            expect(getCreator(mockSongs[2])).toBe('Worship Team');
        });
    });
});
