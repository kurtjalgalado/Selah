import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
    requestNotificationPermission, 
    isNotificationGranted, 
    sendSystemNotification,
    scheduleMinisterReminders,
    clearNotificationHistory 
} from './notifications';
import { db } from '../db/dexie';

describe('Notification Utilities', () => {
    beforeEach(async () => {
        await db.notifications.clear();
        clearNotificationHistory();
    });

    it('sendSystemNotification saves notification to Dexie store', async () => {
        await sendSystemNotification('Test Alert', {
            body: 'Worship practice starts at 7PM',
            userId: 'user-abc',
            type: 'reminder'
        });

        const stored = await db.notifications.toArray();
        expect(stored.length).toBe(1);
        expect(stored[0].title).toBe('Test Alert');
        expect(stored[0].body).toBe('Worship practice starts at 7PM');
        expect(stored[0].userId).toBe('user-abc');
        expect(stored[0].isRead).toBe(false);
    });

    it('scheduleMinisterReminders creates immediate assignment notification in Dexie', async () => {
        await scheduleMinisterReminders({
            scheduleId: 'sched-101',
            serviceTitle: 'Sunday Worship Service',
            serviceDate: '2026-09-20',
            serviceTime: '09:00 AM',
            assignment: { id: 'assign-1', role_name: 'Lead Guitarist', user_name: 'David' },
            notes: 'Bring acoustic capo',
            churchId: 'JFCM-Mercedes',
            targetUserId: 'user-david'
        });

        const stored = await db.notifications.toArray();
        expect(stored.length).toBeGreaterThanOrEqual(1);
        const assignNotif = stored.find(n => n.type === 'assignment');
        expect(assignNotif).toBeDefined();
        expect(assignNotif.title).toContain('Lead Guitarist');
        expect(assignNotif.body).toContain('Sunday Worship Service');
        expect(assignNotif.body).toContain('Bring acoustic capo');
    });

    it('sendSystemNotification deduplicates rapid identical notifications', async () => {
        await sendSystemNotification('Duplicate Alert', {
            body: 'Identical content',
            userId: 'user-abc',
            type: 'reminder'
        });
        // Immediate second call with identical content
        await sendSystemNotification('Duplicate Alert', {
            body: 'Identical content',
            userId: 'user-abc',
            type: 'reminder'
        });

        const stored = await db.notifications.toArray();
        expect(stored.length).toBe(1);
    });

    it('sendSystemNotification respects skipDbSave flag without polluting Dexie', async () => {
        await sendSystemNotification('Banner Only', {
            id: 'banner-123',
            body: 'Should not be in Dexie',
            skipDbSave: true
        });

        const stored = await db.notifications.toArray();
        expect(stored.length).toBe(0);
    });

    it('syncNotificationToDexie stores notifications for current user and ignores other users', async () => {
        const { syncNotificationToDexie } = await import('../supabase/sync');
        
        // 1. Notification for user-123
        await syncNotificationToDexie({
            id: 'notif-1',
            user_id: 'user-123',
            title: 'For User 123',
            body: 'Hello User 123'
        }, 'JFCM-Mercedes', 'user-123');

        // 2. Notification for user-999 (different user)
        await syncNotificationToDexie({
            id: 'notif-2',
            user_id: 'user-999',
            title: 'For User 999',
            body: 'Hello User 999'
        }, 'JFCM-Mercedes', 'user-123');

        // 3. General broadcast notification (user_id is null)
        await syncNotificationToDexie({
            id: 'notif-3',
            user_id: null,
            title: 'General Church Alert',
            body: 'All Church Notice'
        }, 'JFCM-Mercedes', 'user-123');

        const stored = await db.notifications.toArray();
        expect(stored.length).toBe(2);
        expect(stored.find(n => n.id === 'notif-1')).toBeDefined();
        expect(stored.find(n => n.id === 'notif-2')).toBeUndefined();
        expect(stored.find(n => n.id === 'notif-3')).toBeDefined();
    });
});
