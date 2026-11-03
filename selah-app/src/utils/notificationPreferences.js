// Persistent Account-Level Notification Preferences Manager
// Coordinates Supabase persistent records, Dexie offline caching, and cross-device sync.

import { supabase } from '../supabase/client';
import { db } from '../db/dexie';

export const DEFAULT_NOTIFICATION_PREFERENCES = {
    in_app_enabled: true,
    email_enabled: true,
    push_enabled: true
};

// In-memory cache keyed by userId to prevent redundant queries
const memoryPreferencesCache = new Map();

// Concurrency mutex queue per userId to avoid out-of-order race conditions
const inFlightSaves = new Map();

/**
 * Get notification preferences for an account.
 * Resolution priority:
 * 1. Memory cache (if valid)
 * 2. Dexie settings cache (immediate startup & offline fallback)
 * 3. Remote Supabase `notification_preferences` table
 * 4. Fallback to `profiles` table columns
 * 5. Documented defaults ({ in_app_enabled: true, email_enabled: true, push_enabled: true })
 */
export async function getNotificationPreferences(userId) {
    if (!userId) return { ...DEFAULT_NOTIFICATION_PREFERENCES };

    const cacheKey = String(userId);

    // 1. Check in-memory cache
    if (memoryPreferencesCache.has(cacheKey)) {
        return { ...memoryPreferencesCache.get(cacheKey) };
    }

    // 2. Check Dexie offline cache
    let localPreferences = null;
    try {
        const stored = await db.settings.get(`notif_prefs:${cacheKey}`);
        if (stored?.preferences) {
            localPreferences = {
                in_app_enabled: stored.preferences.in_app_enabled !== false,
                email_enabled: stored.preferences.email_enabled !== false,
                push_enabled: stored.preferences.push_enabled !== false
            };
            memoryPreferencesCache.set(cacheKey, localPreferences);
        }
    } catch (e) {
        // Continue to remote fetch
    }

    // 3. Fetch from Supabase
    try {
        const { data, error } = await supabase
            .from('notification_preferences')
            .select('in_app_enabled, email_enabled, push_enabled')
            .eq('user_id', cacheKey)
            .maybeSingle();

        if (!error && data) {
            const confirmed = {
                in_app_enabled: data.in_app_enabled !== false,
                email_enabled: data.email_enabled !== false,
                push_enabled: data.push_enabled !== false
            };
            memoryPreferencesCache.set(cacheKey, confirmed);
            await persistLocalPreferences(cacheKey, confirmed);
            return confirmed;
        }

        // 4. Fallback: check profiles table if notification_preferences is not yet initialized
        const { data: profData } = await supabase
            .from('profiles')
            .select('in_app_enabled, email_enabled, push_enabled')
            .eq('id', cacheKey)
            .maybeSingle();

        if (profData && (profData.in_app_enabled !== undefined || profData.email_enabled !== undefined)) {
            const profPrefs = {
                in_app_enabled: profData.in_app_enabled !== false,
                email_enabled: profData.email_enabled !== false,
                push_enabled: profData.push_enabled !== false
            };
            memoryPreferencesCache.set(cacheKey, profPrefs);
            await persistLocalPreferences(cacheKey, profPrefs);

            // Safely seed into notification_preferences table
            supabase.from('notification_preferences').upsert({
                user_id: cacheKey,
                ...profPrefs,
                updated_at: new Date().toISOString()
            }).then(() => {});

            return profPrefs;
        }

        // 5. If no record exists at all, seed with defaults
        const defaults = localPreferences || { ...DEFAULT_NOTIFICATION_PREFERENCES };
        memoryPreferencesCache.set(cacheKey, defaults);
        await persistLocalPreferences(cacheKey, defaults);

        // Ensure record is saved on Supabase
        supabase.from('notification_preferences').upsert({
            user_id: cacheKey,
            ...defaults,
            updated_at: new Date().toISOString()
        }).then(() => {});

        return defaults;
    } catch (err) {
        console.warn('[NotificationPreferences] Supabase fetch error, using local/default:', err);
        return localPreferences || { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
}

/**
 * Persist preferences safely locally in Dexie
 */
async function persistLocalPreferences(userId, prefs) {
    try {
        await db.settings.put({
            key: `notif_prefs:${String(userId)}`,
            userId: String(userId),
            preferences: prefs,
            updatedAt: new Date().toISOString()
        });
    } catch (e) {
        // Dexie error non-fatal
    }
}

/**
 * Update notification preferences for the authenticated account.
 * Queues in-flight promises to prevent older requests from overwriting newer changes.
 */
export async function updateNotificationPreferences(userId, updates, churchId = 'JFCM-Mercedes') {
    if (!userId) throw new Error('Cannot update notification preferences: User ID is required.');

    const cacheKey = String(userId);
    const existing = await getNotificationPreferences(cacheKey);

    const merged = {
        in_app_enabled: updates.in_app_enabled !== undefined ? Boolean(updates.in_app_enabled) : existing.in_app_enabled,
        email_enabled: updates.email_enabled !== undefined ? Boolean(updates.email_enabled) : existing.email_enabled,
        push_enabled: updates.push_enabled !== undefined ? Boolean(updates.push_enabled) : existing.push_enabled,
    };

    // Update in-memory and local cache immediately (optimistic UI)
    memoryPreferencesCache.set(cacheKey, merged);
    await persistLocalPreferences(cacheKey, merged);

    // Chain in-flight updates to maintain deterministic sequence
    const previousPromise = inFlightSaves.get(cacheKey) || Promise.resolve();
    const savePromise = previousPromise.then(async () => {
        const now = new Date().toISOString();
        const payload = {
            user_id: cacheKey,
            church_id: churchId || 'JFCM-Mercedes',
            in_app_enabled: merged.in_app_enabled,
            email_enabled: merged.email_enabled,
            push_enabled: merged.push_enabled,
            updated_at: now
        };

        const { error } = await supabase
            .from('notification_preferences')
            .upsert(payload, { onConflict: 'user_id' });

        if (error) {
            // Also attempt updating profiles columns as fallback
            const { error: profErr } = await supabase
                .from('profiles')
                .update({
                    in_app_enabled: merged.in_app_enabled,
                    email_enabled: merged.email_enabled,
                    push_enabled: merged.push_enabled
                })
                .eq('id', cacheKey);

            if (profErr) {
                // Revert local and memory state on failure
                memoryPreferencesCache.set(cacheKey, existing);
                await persistLocalPreferences(cacheKey, existing);
                throw new Error(`Failed to save notification preferences: ${error.message || profErr.message}`);
            }
        } else {
            // Sync profiles columns in background to keep both tables consistent
            supabase.from('profiles').update({
                in_app_enabled: merged.in_app_enabled,
                email_enabled: merged.email_enabled,
                push_enabled: merged.push_enabled
            }).eq('id', cacheKey).then(() => {});
        }

        // Dispatch local event for instant component synchronization
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('selah:preferences-updated', {
                detail: { userId: cacheKey, preferences: merged }
            }));
        }

        return merged;
    });

    inFlightSaves.set(cacheKey, savePromise);
    try {
        return await savePromise;
    } finally {
        if (inFlightSaves.get(cacheKey) === savePromise) {
            inFlightSaves.delete(cacheKey);
        }
    }
}

/**
 * Check if a specific notification channel is enabled for a given account.
 * Channel can be 'in_app', 'email', or 'push'.
 */
export async function isNotificationChannelEnabled(userId, channel) {
    if (!userId) return false;
    const prefs = await getNotificationPreferences(userId);
    const key = `${channel}_enabled`;
    return prefs[key] !== false;
}

/**
 * Clear in-memory preferences cache (e.g. on logout).
 * NOTE: DOES NOT delete the saved preferences from Supabase or Dexie.
 */
export function clearPreferencesMemoryCache() {
    memoryPreferencesCache.clear();
    inFlightSaves.clear();
}

/**
 * Get synchronously from memory cache if already populated
 */
export function getCachedNotificationPreferences(userId) {
    if (!userId) return null;
    return memoryPreferencesCache.get(String(userId)) || null;
}

