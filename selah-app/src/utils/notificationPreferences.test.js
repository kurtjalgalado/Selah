import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '../db/dexie';
import {
    DEFAULT_NOTIFICATION_PREFERENCES,
    getNotificationPreferences,
    updateNotificationPreferences,
    clearPreferencesMemoryCache,
    getCachedNotificationPreferences
} from './notificationPreferences';
import { sendSystemNotification, dispatchAssignmentEmail } from './notifications';

// Mock Supabase
vi.mock('../supabase/client', () => {
    return {
        supabase: {
            from: vi.fn((table) => {
                const chain = {
                    select: vi.fn().mockReturnThis(),
                    eq: vi.fn().mockReturnThis(),
                    update: vi.fn().mockReturnThis(),
                    upsert: vi.fn().mockResolvedValue({ error: null }),
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: {
                            in_app_enabled: false,
                            email_enabled: false,
                            push_enabled: true
                        },
                        error: null
                    }),
                    then: (resolve) => resolve({ error: null })
                };
                return chain;
            })
        }
    };
});

describe('Notification Preferences Manager', () => {
    const testUserId = 'user-test-uuid-12345';

    beforeEach(async () => {
        clearPreferencesMemoryCache();
        await db.settings.clear();
        await db.notifications.clear();
        vi.clearAllMocks();
    });

    it('returns default preferences when no user or anonymous session', async () => {
        const prefs = await getNotificationPreferences(null);
        expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
        expect(prefs.in_app_enabled).toBe(true);
        expect(prefs.email_enabled).toBe(true);
        expect(prefs.push_enabled).toBe(true);
    });

    it('fetches and caches preferences in Dexie and memory', async () => {
        const prefs = await getNotificationPreferences(testUserId);
        expect(prefs.in_app_enabled).toBe(false);
        expect(prefs.email_enabled).toBe(false);
        expect(prefs.push_enabled).toBe(true);

        // Verify it was cached in Dexie under db.settings
        const savedRecord = await db.settings.get(`notif_prefs:${testUserId}`);
        expect(savedRecord).toBeDefined();
        expect(savedRecord.preferences.in_app_enabled).toBe(false);

        // Memory cache should immediately return without remote lookup
        const memCached = getCachedNotificationPreferences(testUserId);
        expect(memCached).toEqual(prefs);
    });

    it('updates preferences and persists to local Dexie cache and Supabase', async () => {
        const updated = await updateNotificationPreferences(testUserId, {
            email_enabled: true
        });

        expect(updated.email_enabled).toBe(true);

        const cached = await db.settings.get(`notif_prefs:${testUserId}`);
        expect(cached.preferences.email_enabled).toBe(true);
    });

    it('clears memory cache on logout to prevent session cross-leakage while keeping Dexie/Supabase', async () => {
        await updateNotificationPreferences(testUserId, { in_app_enabled: false });
        expect(getCachedNotificationPreferences(testUserId).in_app_enabled).toBe(false);

        clearPreferencesMemoryCache();
        expect(getCachedNotificationPreferences(testUserId)).toBeNull();

        // But local storage persists
        const cached = await db.settings.get(`notif_prefs:${testUserId}`);
        expect(cached.preferences.in_app_enabled).toBe(false);
    });

    it('suppresses in-app notification creation when in_app_enabled is disabled', async () => {
        // Set in_app_enabled = false
        await updateNotificationPreferences(testUserId, { in_app_enabled: false });

        await sendSystemNotification('Test Setlist Created', {
            userId: testUserId,
            body: 'A new worship lineup was scheduled.'
        });

        // Verify nothing was saved to Dexie notifications table
        const count = await db.notifications.count();
        expect(count).toBe(0);
    });

    it('suppresses assignment email dispatch when email_enabled is disabled', async () => {
        // Set email_enabled = false
        await updateNotificationPreferences(testUserId, { email_enabled: false });

        const result = await dispatchAssignmentEmail({
            toEmail: 'minister@selahworship.org',
            recipientName: 'Brother John',
            targetUserId: testUserId,
            serviceTitle: 'Sunday Celebration Service',
            serviceDate: '2026-10-18',
            roleName: 'Worship Leader'
        });

        expect(result.status).toBe('suppressed');
        expect(result.reason).toBe('email_disabled');
    });
});
