import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { notificationDB } from '../db/dexie';
import { 
    markAllNotificationsReadInSupabase, 
    clearAllNotificationsInSupabase,
    deleteNotificationInSupabase
} from '../supabase/sync';
import { clearAllNativeNotifications } from '../utils/notifications';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';
import { 
    X, Bell, Trash as Trash2, MusicNotes as Music, 
    Clock, Users, CaretRight as ChevronRight, Tray as Inbox,
    Checks as CheckCheck, CalendarBlank as Calendar
} from '@phosphor-icons/react';

export default function NotificationTray({ isOpen, onClose }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { notifications, unreadCount } = useSongCache();
    const [filter, setFilter] = useState('all'); // 'all' | 'unread'

    // Register back button handler
    useBackHandler(isOpen, onClose);

    // Automatically mark unread notifications as read when tray opens
    useEffect(() => {
        if (isOpen && user && unreadCount > 0) {
            notificationDB.markAllAsRead(user.id);
            markAllNotificationsReadInSupabase(user.id);
            clearAllNativeNotifications();
        }
    }, [isOpen, user, unreadCount]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleClearAll = async (e) => {
        e.stopPropagation();
        haptic('medium');
        if (user) {
            await notificationDB.clearAll(user.id);
            await clearAllNotificationsInSupabase(user.id);
        } else {
            await notificationDB.clearAll();
        }
        // Sweep all currently displayed notifications out of local store
        if (notifications && notifications.length > 0) {
            for (const notif of notifications) {
                await notificationDB.delete(notif.id);
            }
        }
        clearAllNativeNotifications();
    };

    const handleDeleteOne = async (e, notifId) => {
        e.stopPropagation();
        haptic('light');
        await notificationDB.delete(notifId);
        if (user) {
            await deleteNotificationInSupabase(notifId);
        }
    };

    const handleNotificationClick = (notif) => {
        haptic('light');
        onClose();
        if (notif.type === 'assignment' || notif.type === 'reminder') {
            navigate('/schedule');
        } else if (notif.type === 'setlist_request' && notif.data?.setlistId) {
            navigate(`/setlist-player/${notif.data.setlistId}`);
        } else if (notif.type === 'setlist') {
            navigate('/setlists');
        }
    };

    const formatTimestamp = (dateStr) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays === 1) return 'Yesterday';
            if (diffDays < 7) return `${diffDays}d ago`;
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return '';
        }
    };

    const getTypeMeta = (type) => {
        switch (type) {
            case 'assignment':
                return {
                    icon: <Users className="w-4 h-4 text-purple-400" />,
                    badge: 'Assignment',
                    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                };
            case 'reminder':
                return {
                    icon: <Clock className="w-4 h-4 text-amber-400" />,
                    badge: 'Reminder',
                    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                };
            case 'setlist_request':
                return {
                    icon: <Music className="w-4 h-4 text-emerald-400" />,
                    badge: 'Lineup Request',
                    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                };
            case 'setlist':
                return {
                    icon: <Music className="w-4 h-4 text-accent" />,
                    badge: 'Setlist',
                    badgeClass: 'bg-accent/15 text-accent border-accent/30'
                };
            default:
                return {
                    icon: <Bell className="w-4 h-4 text-textmuted" />,
                    badge: 'System',
                    badgeClass: 'bg-secondary text-textmuted border-themed'
                };
        }
    };

    const displayedNotifications = (notifications || []).filter(n => {
        if (filter === 'unread') return !n.isRead;
        return true;
    });

    const bottomSheetContent = (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99998] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            {/* Bottom Sheet Card */}
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-lg shadow-2xl animate-slideUp max-h-[85vh] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden z-[99999]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Grab handle pill */}
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 shrink-0 sm:hidden" />

                {/* Header */}
                <div className="px-5 py-3.5 border-b border-themed flex items-center justify-between bg-secondary/40 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center">
                            <Bell className="w-4 h-4" />
                        </div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-textprimary">
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent border border-accent/30">
                                    {unreadCount} new
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {notifications?.length > 0 && (
                            <button
                                onClick={handleClearAll}
                                className="px-3 py-1.5 rounded-xl text-textmuted hover:text-danger hover:bg-danger/10 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                                title="Clear All Notifications"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Clear All</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover active:scale-95 transition"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Filter pills if notifications exist */}
                {notifications?.length > 0 && (
                    <div className="px-5 py-2 border-b border-themed bg-secondary/20 flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                filter === 'all'
                                    ? 'bg-accent/20 text-accent border border-accent/30'
                                    : 'text-textmuted hover:text-textprimary hover:bg-secondary'
                            }`}
                        >
                            All ({notifications.length})
                        </button>
                        <button
                            onClick={() => setFilter('unread')}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                filter === 'unread'
                                    ? 'bg-accent/20 text-accent border border-accent/30'
                                    : 'text-textmuted hover:text-textprimary hover:bg-secondary'
                            }`}
                        >
                            Unread ({unreadCount})
                        </button>
                    </div>
                )}

                {/* Notifications List */}
                <div className="overflow-y-auto p-4 space-y-2 flex-1 overscroll-contain">
                    {!displayedNotifications || displayedNotifications.length === 0 ? (
                        <div className="py-14 text-center space-y-2 text-textmuted">
                            <div className="w-12 h-12 rounded-2xl bg-secondary border border-themed flex items-center justify-center mx-auto text-textmuted/50">
                                <Inbox className="w-6 h-6" />
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xs font-bold text-textprimary">
                                    {filter === 'unread' ? 'No Unread Notifications' : 'No Notifications'}
                                </p>
                                <p className="text-[11px] text-textmuted">
                                    {filter === 'unread' ? 'You have read all your alerts' : 'All caught up! Alerts will appear here.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        displayedNotifications.map((notif) => {
                            const meta = getTypeMeta(notif.type);
                            return (
                                <div
                                    key={notif.id}
                                    onClick={() => handleNotificationClick(notif)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleNotificationClick(notif); }}
                                    className={`w-full text-left p-3.5 rounded-2xl border transition-all active:scale-[0.99] flex items-start gap-3 cursor-pointer group ${
                                        !notif.isRead
                                            ? 'bg-accent/10 border-accent/40 shadow-sm ring-1 ring-accent/20'
                                            : 'bg-secondary/60 hover:bg-secondary border-themed'
                                    }`}
                                >
                                    <div className="w-8 h-8 rounded-xl bg-elevated border border-themed flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                                        {meta.icon}
                                    </div>

                                    <div className="min-w-0 flex-1 space-y-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border shrink-0 ${meta.badgeClass}`}>
                                                    {meta.badge}
                                                </span>
                                                <h4 className="text-xs font-bold text-textprimary truncate">
                                                    {notif.title}
                                                </h4>
                                            </div>
                                            <span className="text-[10px] text-textmuted shrink-0 font-medium">
                                                {formatTimestamp(notif.createdAt)}
                                            </span>
                                        </div>

                                        <p className="text-xs text-textmuted leading-relaxed line-clamp-2">
                                            {notif.body}
                                        </p>

                                        {/* Optional context tag */}
                                        {notif.data?.serviceDate && (
                                            <div className="flex items-center gap-1 text-[10px] text-textmuted/80 pt-0.5">
                                                <Calendar className="w-3 h-3 text-accent/70" />
                                                <span>{notif.data.serviceDate}</span>
                                                {notif.data.roleName && <span>• {notif.data.roleName}</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1 self-center shrink-0">
                                        <button
                                            onClick={(e) => handleDeleteOne(e, notif.id)}
                                            className="p-1.5 rounded-lg text-textmuted/40 hover:text-danger hover:bg-danger/10 transition active:scale-90"
                                            title="Dismiss notification"
                                            aria-label="Dismiss notification"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                        <ChevronRight className="w-4 h-4 text-textmuted/40 group-hover:text-textprimary transition" />
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                {notifications?.length > 0 && (
                    <div className="px-5 py-3 border-t border-themed bg-secondary/30 flex items-center justify-between text-xs text-textmuted shrink-0">
                        <span>{notifications.length} notification{notifications.length === 1 ? '' : 's'}</span>
                        <button
                            onClick={onClose}
                            className="font-bold text-accent hover:underline py-1 px-2"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(bottomSheetContent, document.body);
}

