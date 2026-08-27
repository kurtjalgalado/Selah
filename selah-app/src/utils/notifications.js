// Notification Helper for Selah Worship Planner
// On Android WebView, uses native bridge (AndroidNotify) since browser Notification API is unsupported.
// On web, falls back to browser Notification API.

export async function requestNotificationPermission() {
    // Android native bridge — permission handled on native side
    if (window.AndroidNotify?.requestPermission) {
        try {
            const result = window.AndroidNotify.requestPermission();
            return result === 'granted' || result === true;
        } catch { return false; }
    }

    // Web fallback
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    return false;
}

export function isNotificationGranted() {
    if (window.AndroidNotify?.isGranted) {
        try { return window.AndroidNotify.isGranted(); } catch {}
    }
    if (typeof window !== 'undefined' && 'Notification' in window) {
        return Notification.permission === 'granted';
    }
    return false;
}

export async function sendSystemNotification(title, options = {}) {
    // 1. Store in local notification history
    addNotificationToHistory({
        id: crypto.randomUUID(),
        title,
        body: options.body || '',
        timestamp: new Date().toISOString(),
        read: false,
    });

    // 2. Try Android native bridge first
    if (window.AndroidNotify?.show) {
        try {
            window.AndroidNotify.show(title, options.body || '');
            return;
        } catch {}
    }

    // 3. Web Notification API fallback
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
            const notif = new Notification(title, {
                icon: '/icon.png',
                badge: '/favicon.png',
                vibrate: [200, 100, 200],
                ...options,
            });
            notif.onclick = () => {
                window.focus();
                if (options.url) window.location.hash = options.url;
            };
        } catch (e) {
            console.warn('Notification display error:', e);
        }
    }
}

export function getNotificationHistory() {
    try {
        const saved = localStorage.getItem('selah_notifications');
        return saved ? JSON.parse(saved) : [];
    } catch {
        return [];
    }
}

export function addNotificationToHistory(notification) {
    try {
        const history = getNotificationHistory();
        const updated = [notification, ...history].slice(0, 50);
        localStorage.setItem('selah_notifications', JSON.stringify(updated));
    } catch (err) {
        console.error('Error saving notification:', err);
    }
}

export function clearNotificationHistory() {
    localStorage.removeItem('selah_notifications');
}
