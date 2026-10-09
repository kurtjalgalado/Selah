import Dexie from 'dexie';
import scrapedSongs from './scraped_songs.json';

// Clean, unified Dexie database schema (v2 without conflicting primary key upgrades)
export const db = new Dexie('SelahWorshipDB_v2');

db.version(1).stores({
    songs: 'id, title, artist, category, language, originalKey, tempo, tags, dateAdded',
    setlists: 'id, title, date, churchId, *songIds',
    schedules: 'id, churchId, serviceDate, setlistId, updatedAt',
    profiles: 'id, email, username, churchId, role, updatedAt',
    notifications: 'id, userId, churchId, isRead, createdAt',
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
            // Prune invalid or blank songs (empty title or corrupt lineup/service entries without artist or lyrics)
            if (!s.title || !s.title.trim() || (!s.artist && !s.lyrics && (s.title.toLowerCase().includes('lineup') || s.title.toLowerCase().includes('worship service')))) {
                duplicatesToDelete.push(s.id);
                continue;
            }
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
    getById: (id) => {
        const numId = Number(id);
        if (!isNaN(numId)) {
            return db.songs.get(numId).then(res => res || db.songs.get(String(id)));
        }
        return db.songs.get(String(id));
    },
    getByCategory: (category) => db.songs.where('category').equals(category).toArray(),
    getByLanguage: (language) => db.songs.where('language').equals(language).toArray(),
    search: async (query) => {
        const q = (query || '').toLowerCase().trim();
        if (!q) return db.songs.toArray();
        return db.songs.filter(s =>
            Boolean(
                (s.title && s.title.toLowerCase().includes(q)) ||
                (s.artist && s.artist.toLowerCase().includes(q)) ||
                (s.lyrics && s.lyrics.toLowerCase().includes(q))
            )
        ).toArray();
    },
    add: async (song) => {
        if (!song || !song.title || !song.title.trim()) {
            throw new Error('Song title is required and cannot be blank.');
        }
        const id = song.id || crypto.randomUUID();
        const record = {
            ...song,
            title: song.title.trim(),
            id,
            tags: song.tags || [],
            dateAdded: song.dateAdded || new Date().toISOString()
        };
        await db.songs.put(record);
        return id;
    },
    update: (id, changes) => {
        const numId = Number(id);
        const targetId = !isNaN(numId) ? numId : String(id);
        return db.songs.update(targetId, changes);
    },
    delete: (id) => {
        const numId = Number(id);
        const targetId = !isNaN(numId) ? numId : String(id);
        return db.songs.delete(targetId);
    },
};

export async function getSongByIdOrTitle(id) {
    if (!id && id !== 0) return null;
    if (typeof id === 'string' && !id.trim()) return null;
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

export const scheduleDB = {
    getAll: () => db.schedules.toArray(),
    getById: (id) => db.schedules.get(String(id)),
    getByChurch: (churchId) => db.schedules.where('churchId').equals(churchId).toArray(),
    add: async (schedule) => {
        const id = String(schedule.id || crypto.randomUUID());
        const record = {
            ...schedule,
            id,
            churchId: schedule.churchId || 'JFCM-Mercedes',
            created: schedule.created || new Date().toISOString(),
            updatedAt: schedule.updatedAt || new Date().toISOString()
        };
        await db.schedules.put(record);
        return id;
    },
    update: (id, changes) => db.schedules.update(String(id), {
        ...changes,
        updatedAt: new Date().toISOString()
    }),
    delete: (id) => db.schedules.delete(String(id)),
};

export const profileDB = {
    getAll: async (churchId = null) => {
        const all = await db.profiles.toArray();
        if (!churchId) return all;
        const target = churchId.trim().toLowerCase();
        return all.filter(p => {
            const c = (p.churchId || p.church_id || '').trim().toLowerCase();
            return !c || c === target;
        });
    },
    getById: (id) => db.profiles.get(String(id)),
    put: (profile) => {
        const church = profile.church_id || profile.churchId || 'JFCM-Mercedes';
        const seed = profile.avatar_seed || profile.avatarSeed || profile.username || 'Felix';
        const updated = profile.updated_at || profile.updatedAt || new Date().toISOString();
        return db.profiles.put({
            id: String(profile.id),
            email: profile.email || '',
            username: profile.username || profile.email?.split('@')[0] || '',
            full_name: profile.full_name || profile.fullName || profile.username || '',
            role: profile.role || 'worship_team_member',
            churchId: church,
            church_id: church,
            avatar_seed: seed,
            avatarSeed: seed,
            updatedAt: updated,
            updated_at: updated
        });
    },
    bulkPut: (profiles) => {
        const records = (profiles || []).map(p => {
            const church = p.church_id || p.churchId || 'JFCM-Mercedes';
            const seed = p.avatar_seed || p.avatarSeed || p.username || 'Felix';
            const updated = p.updated_at || p.updatedAt || new Date().toISOString();
            return {
                id: String(p.id),
                email: p.email || '',
                username: p.username || p.email?.split('@')[0] || '',
                full_name: p.full_name || p.fullName || p.username || '',
                role: p.role || 'worship_team_member',
                churchId: church,
                church_id: church,
                avatar_seed: seed,
                avatarSeed: seed,
                updatedAt: updated,
                updated_at: updated
            };
        });
        return db.profiles.bulkPut(records);
    }
};

export const notificationDB = {
    getAll: () => db.notifications.toArray().then(items => items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))),
    getByUser: (userId) => db.notifications.where('userId').equals(String(userId)).toArray().then(items => items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))),
    getUnreadByUser: (userId) => db.notifications.where('userId').equals(String(userId)).filter(n => !n.isRead).toArray(),
    getById: (id) => db.notifications.get(String(id)),
    add: async (notification) => {
        const id = String(notification.id || crypto.randomUUID());
        const record = {
            ...notification,
            id,
            userId: notification.userId ? String(notification.userId) : null,
            isRead: Boolean(notification.isRead),
            createdAt: notification.createdAt || new Date().toISOString()
        };
        await db.notifications.put(record);
        return id;
    },
    bulkPut: (items) => db.notifications.bulkPut(items),
    markAsRead: (id) => db.notifications.update(String(id), { isRead: true }),
    markAllAsRead: async (userId) => {
        if (userId) {
            const uid = String(userId);
            await db.notifications.filter(n => !n.userId || String(n.userId) === uid).modify({ isRead: true });
        } else {
            await db.notifications.toCollection().modify({ isRead: true });
        }
    },
    clearAll: async (userId) => {
        if (userId) {
            const uid = String(userId);
            const itemsToDelete = await db.notifications
                .filter(n => !n.userId || String(n.userId) === uid)
                .primaryKeys();
            if (itemsToDelete.length > 0) {
                await db.notifications.bulkDelete(itemsToDelete);
            }
        } else {
            await db.notifications.clear();
        }
    },
    delete: (id) => db.notifications.delete(String(id)),
};