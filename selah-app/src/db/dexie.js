import Dexie from 'dexie';
import scrapedSongs from './scraped_songs.json';

export const db = new Dexie('SelahWorshipDB');

db.version(1).stores({
    // Primary keys marked with ++, indexes with &
    songs: '++id, title, artist, category, language, originalKey, tempo, dateAdded',
    setlists: '++id, title, date, *songIds',
    settings: '&key', // Key-value store for app settings
    syncQueue: '++id, table, action, recordId, timestamp',
});

// ── Seed scraped songs on load & clean duplicates ──
export async function cleanupDuplicateSongs() {
    try {
        const allSongs = await db.songs.toArray();
        const seenKeys = new Set();
        const duplicatesToDelete = [];

        for (const s of allSongs) {
            const key = `${s.id}-${(s.title || '').toLowerCase()}`;
            if (seenKeys.has(key)) {
                duplicatesToDelete.push(s.id);
            } else {
                seenKeys.add(key);
            }
        }

        if (duplicatesToDelete.length > 0) {
            for (const idToDelete of duplicatesToDelete) {
                await db.songs.delete(idToDelete);
            }
            console.log(`Cleaned up ${duplicatesToDelete.length} duplicate song records from Dexie`);
        }
    } catch (e) { }
}

export async function seedDatabase() {
    try {
        const firstSong = await db.songs.toCollection().first();
        const count = await db.songs.count();

        // Re-seed if database is empty or contains legacy songs lacking accurate language tagging
        if (count < 50 || (firstSong && !firstSong.language)) {
            await db.songs.clear();
            const seededWithIds = scrapedSongs.map((s, idx) => ({ id: idx + 1, ...s }));
            await db.songs.bulkPut(seededWithIds);
            console.log(`Re-seeded IndexedDB with ${scrapedSongs.length} accurately retagged songs`);
        } else {
            // Clean up legacy duplicate string IDs if present
            await cleanupDuplicateSongs();
        }
    } catch (err) {
        console.warn('Safe seed database catch:', err);
    }
}

// ── CRUD Helpers ──
export const songDB = {
    getAll: () => db.songs.toArray(),
    getById: (id) => db.songs.get(id),
    add: (song) => db.songs.add({ ...song, dateAdded: new Date().toISOString() }),
    update: (id, changes) => db.songs.update(id, changes),
    delete: (id) => db.songs.delete(id),
    search: (query) => db.songs
        .filter(s =>
            s.title.toLowerCase().includes(query.toLowerCase()) ||
            s.artist.toLowerCase().includes(query.toLowerCase())
        )
        .toArray(),
};

export async function getSongByIdOrTitle(id) {
    if (!id && id !== 0) return null;
    const numId = Number(id);
    let s;
    if (!isNaN(numId)) {
        s = await db.songs.get(numId);
    }
    if (!s) {
        s = await db.songs.get(String(id));
    }
    if (!s) {
        const allSongs = await db.songs.toArray();
        s = allSongs.find(item => String(item.id) === String(id) || item.title?.toLowerCase() === String(id).toLowerCase());
    }
    if (!s) {
        // Fallback to local seed array scraped_songs.json
        if (!isNaN(numId) && numId > 0 && numId <= scrapedSongs.length) {
            s = { id: numId, ...scrapedSongs[numId - 1] };
        } else {
            const indexFound = scrapedSongs.findIndex(item => item.title?.toLowerCase() === String(id).toLowerCase());
            if (indexFound !== -1) {
                s = { id: indexFound + 1, ...scrapedSongs[indexFound] };
            }
        }
    }
    return s || null;
}

export const setlistDB = {
    getAll: () => db.setlists.toArray(),
    getById: (id) => db.setlists.get(id),
    add: (setlist) => db.setlists.add({
        ...setlist,
        created: new Date().toISOString()
    }),
    update: (id, changes) => db.setlists.update(id, changes),
    delete: (id) => db.setlists.delete(id),
};