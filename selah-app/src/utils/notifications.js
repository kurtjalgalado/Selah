// Notification Helper for Selah Worship Planner
// Integrates with @capacitor/local-notifications for native Android scheduled notifications,
// status bar notifications, badge clearance, and multi-day rehearsal reminders.
// Falls back gracefully to browser Notification API on Web.

import { LocalNotifications } from '@capacitor/local-notifications';
import { supabase } from '../supabase/client';
import { notificationDB } from '../db/dexie';

/**
 * Request notification permissions across native Android and Web
 */
export async function requestNotificationPermission() {
    try {
        // 1. Capacitor Native LocalNotifications
        const status = await LocalNotifications.requestPermissions();
        if (status?.display === 'granted') {
            return true;
        }
    } catch {
        // Fall back to web/Android bridge
    }

    // 2. Android native bridge (if custom WebView interface exists)
    if (window.AndroidNotify?.requestPermission) {
        try {
            const result = window.AndroidNotify.requestPermission();
            return result === 'granted' || result === true;
        } catch { return false; }
    }

    // 3. Web Notification API fallback
    if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'granted') return true;
        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
    }
    return false;
}

/**
 * Check if notification permissions are granted
 */
export async function isNotificationGranted() {
    try {
        const check = await LocalNotifications.checkPermissions();
        if (check?.display === 'granted') return true;
    } catch {}

    if (window.AndroidNotify?.isGranted) {
        try { return window.AndroidNotify.isGranted(); } catch {}
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission === 'granted';
    }
    return false;
}

// In-memory deduplication cache to prevent notification flooding
const recentNotifications = new Map();

function isDuplicateNotification(key) {
    if (!key) return false;
    const now = Date.now();
    const last = recentNotifications.get(key);
    if (last && now - last < 5000) {
        return true;
    }
    recentNotifications.set(key, now);
    if (recentNotifications.size > 100) {
        for (const [k, time] of recentNotifications.entries()) {
            if (now - time > 10000) recentNotifications.delete(k);
        }
    }
    return false;
}

/**
 * Send an immediate system notification (native + in-app)
 */
export async function sendSystemNotification(title, options = {}) {
    const notifId = options.id || Math.floor(Math.random() * 1000000);
    const body = options.body || '';

    // Deduplication check: throttle identical notifications within 5 seconds
    const dedupKey = options.id ? `id-${options.id}` : `${title}-${body}-${options.userId || ''}`;
    if (isDuplicateNotification(dedupKey)) {
        return;
    }

    // 1. Save to local Dexie notification database (unless skipped e.g. when synced from remote)
    if (!options.skipDbSave) {
        try {
            await notificationDB.add({
                id: String(notifId),
                userId: options.userId ? String(options.userId) : null,
                churchId: options.churchId || 'JFCM-Mercedes',
                title,
                body,
                type: options.type || 'system',
                data: options.data || {},
                isRead: false,
                createdAt: options.createdAt || new Date().toISOString()
            });
        } catch (e) {
            console.warn('Failed to save notification to Dexie:', e);
        }
    }

    // 2. Schedule immediate native Android notification via Capacitor
    try {
        await LocalNotifications.schedule({
            notifications: [
                {
                    id: typeof notifId === 'number' ? notifId : Math.abs(hashCode(String(notifId))),
                    title,
                    body,
                    schedule: { at: new Date(Date.now() + 1000) }, // in 1 second
                    sound: 'default',
                    smallIcon: 'ic_stat_icon_config_sample',
                    actionTypeId: '',
                    extra: options.data || null
                }
            ]
        });
        return;
    } catch {
        // Fallback below
    }

    // 3. Android WebView bridge fallback
    if (window.AndroidNotify?.show) {
        try {
            window.AndroidNotify.show(title, body);
            return;
        } catch {}
    }

    // 4. Web Notification API fallback
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
            const notif = new Notification(title, {
                icon: '/icon.png',
                badge: '/favicon.png',
                vibrate: [200, 100, 200],
                body,
                ...options,
            });
            notif.onclick = () => {
                window.focus();
                if (options.url) window.location.hash = options.url;
            };
        } catch (e) {
            console.warn('Web notification display error:', e);
        }
    }
}

/**
 * Schedule multi-stage minister assignment reminders:
 * 1. Immediate assignment notification
 * 2. 2 days before service date at 09:00 AM (Rehearsal Reminder)
 * 3. 1 day before service date at 09:00 AM (Service Reminder)
 */
export async function scheduleMinisterReminders({
    scheduleId,
    serviceTitle,
    serviceDate,
    serviceTime,
    assignment,
    notes,
    churchId,
    targetUserId,
    targetEmail
}) {
    if (!serviceDate || !assignment) return;

    const roleName = assignment.role_name || 'Worship Minister';
    const notesExcerpt = notes ? `\nNotes: ${notes}` : '';
    const timeFormatted = serviceTime ? ` at ${serviceTime}` : '';

    // A. Immediate Assignment Notification
    const immediateTitle = `Worship Assignment: ${roleName}`;
    const immediateBody = `You are scheduled for "${serviceTitle}" on ${serviceDate}${timeFormatted}.${notesExcerpt}`;

    await sendSystemNotification(immediateTitle, {
        id: `assign-${scheduleId}-${assignment.id}`,
        userId: targetUserId,
        churchId,
        body: immediateBody,
        type: 'assignment',
        data: { scheduleId, serviceDate, roleName, notes, serviceTitle }
    });

    // Parse service date YYYY-MM-DD
    const parts = String(serviceDate).split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);

        // B. Rehearsal Reminder: 2 days before service at 09:00 AM
        const twoDaysBefore = new Date(year, month, day - 2, 9, 0, 0);
        if (twoDaysBefore.getTime() > Date.now()) {
            const reminderId = Math.abs(hashCode(`remind-2d-${scheduleId}-${assignment.id}`));
            try {
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            id: reminderId,
                            title: `Rehearsal Reminder: ${serviceTitle}`,
                            body: `Upcoming service in 2 days (${serviceDate}). Role: ${roleName}.${notesExcerpt}`,
                            schedule: { at: twoDaysBefore },
                            sound: 'default',
                            extra: { scheduleId, serviceDate, roleName }
                        }
                    ]
                });
            } catch (e) {
                console.warn('Failed to schedule 2-day reminder:', e);
            }
        }

        // C. Service Reminder: 1 day before service at 09:00 AM
        const oneDayBefore = new Date(year, month, day - 1, 9, 0, 0);
        if (oneDayBefore.getTime() > Date.now()) {
            const reminderId = Math.abs(hashCode(`remind-1d-${scheduleId}-${assignment.id}`));
            try {
                await LocalNotifications.schedule({
                    notifications: [
                        {
                            id: reminderId,
                            title: `Tomorrow's Service: ${serviceTitle}`,
                            body: `Get ready to minister as ${roleName} tomorrow${timeFormatted}.${notesExcerpt}`,
                            schedule: { at: oneDayBefore },
                            sound: 'default',
                            extra: { scheduleId, serviceDate, roleName }
                        }
                    ]
                });
            } catch (e) {
                console.warn('Failed to schedule 1-day reminder:', e);
            }
        }
    }

    // D. Dispatch Email Notification if email is present
    if (targetEmail) {
        await dispatchAssignmentEmail({
            toEmail: targetEmail,
            recipientName: assignment.user_name || targetEmail.split('@')[0],
            serviceTitle,
            serviceDate,
            serviceTime,
            roleName,
            notes
        });
    }
}

/**
 * Dispatch an email notification to the assigned minister
 */
export async function dispatchAssignmentEmail({
    toEmail,
    recipientName = 'Worship Minister',
    serviceTitle,
    serviceDate,
    serviceTime = '',
    roleName,
    notes = ''
}) {
    if (!toEmail) return;

    try {
        // Try Supabase edge function if available
        const { error } = await supabase.functions.invoke('send-assignment-email', {
            body: {
                to: toEmail,
                name: recipientName,
                serviceTitle,
                serviceDate,
                serviceTime,
                roleName,
                notes
            }
        });

        if (error) {
            console.log(`[Email Dispatch] Note: Edge function not deployed, simulated email to ${toEmail}:`, {
                serviceTitle,
                roleName,
                serviceDate
            });
        } else {
            console.log(`[Email Dispatch] Email sent successfully to ${toEmail}`);
        }
    } catch (err) {
        console.log(`[Email Dispatch] Local email simulated to ${toEmail} for ${serviceTitle}`);
    }
}

/**
 * Clear delivered native notifications from the Android notification shade
 */
export async function clearAllNativeNotifications() {
    try {
        await LocalNotifications.removeAllDeliveredNotifications();
    } catch (e) {
        // Ignored if not in native app
    }
}

/**
 * Hash string to positive 32-bit integer for notification IDs
 */
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash) % 2147483647;
}

export function getNotificationHistory() {
    try {
        const saved = localStorage.getItem('selah_notifications');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

export function clearNotificationHistory() {
    recentNotifications.clear();
    try {
        localStorage.removeItem('selah_notifications');
    } catch {}
    clearAllNativeNotifications();
}
