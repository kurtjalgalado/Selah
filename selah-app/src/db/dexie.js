import Dexie from 'dexie';
import scrapedSongs from './scraped_songs.json';

// Clean, unified Dexie database schema (v2 without conflicting primary key upgrades)
export const db = new Dexie('SelahWorshipDB_v2');

db.version(1).stores({
    songs: 'id, title, artist, category, language, originalKey, tempo, tags, dateAdded',
    setlists: 'id, title, date, *songIds',
    settings: '&key',
    syncQueue: 'id, createdAt, retries',
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
            await db.songs.bulkDelete(duplicatesToDelete);
        }
    } catch (e) {
        // Ignored
    }
}

export async function seedDatabase() {
    try {
        // Safely delete legacy DB that had failed schema migration
        if (typeof indexedDB !== 'undefined') {
            try {
                indexedDB.deleteDatabase('SelahWorshipDB');
            } catch (e) {
                // Ignore cleanup error
            }
        }

        const count = await db.songs.count();
        if (count === 0) {
            console.log('[Selah DB] Database empty, seeding initial songs...');
            const seededWithIds = scrapedSongs.map((s, idx) => ({ id: idx + 1, ...s }));
            await db.songs.bulkPut(seededWithIds);
            console.log('[Selah DB] Seeded', seededWithIds.length, 'songs successfully');
        } else {
            await cleanupDuplicateSongs();
        }
    } catch (err) {
        console.error('[Selah DB] seedDatabase failed:', err);
    }
}

// ── CRUD Helpers ──
export const songDB = {
    getAll: () => db.songs.toArray(),
    getById: (id) => db.songs.get(!isNaN(Number(id)) ? Number(id) : String(id)),
    add: async (song) => {
        const id = song.id || crypto.randomUUID();
        const record = {
            ...song,
            id,
            dateAdded: song.dateAdded || new Date().toISOString()
        };
        await db.songs.put(record);
        return id;
    },
    update: (id, changes) => db.songs.update(!isNaN(Number(id)) ? Number(id) : String(id), changes),
    delete: (id) => db.songs.delete(!isNaN(Number(id)) ? Number(id) : String(id)),
    search: (query) => db.songs
        .filter(s =>
            (s.title || '').toLowerCase().includes(query.toLowerCase()) ||
            (s.artist || '').toLowerCase().includes(query.toLowerCase())
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
    getById: (id) => db.setlists.get(String(id)),
    add: async (setlist) => {
        const id = String(setlist.id || crypto.randomUUID());
        const record = {
            ...setlist,
            id,
            created: setlist.created || new Date().toISOString()
        };
        await db.setlists.put(record);
        return id;
    },
    update: (id, changes) => db.setlists.update(String(id), changes),
    delete: (id) => db.setlists.delete(String(id)),
};