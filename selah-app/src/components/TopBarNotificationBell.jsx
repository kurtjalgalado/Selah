import React, { useState } from 'react';
import { useSongCache } from '../context/SongCacheContext';
import { haptic } from '../utils/haptics';
import NotificationTray from './NotificationTray';
import { Bell } from '@phosphor-icons/react';

export default function TopBarNotificationBell({ className = '' }) {
    const { unreadCount } = useSongCache();
    const [isOpen, setIsOpen] = useState(false);

    const handleToggle = () => {
        haptic('light');
        setIsOpen(prev => !prev);
    };

    return (
        <>
            <button
                onClick={handleToggle}
                className={`relative w-10 h-10 rounded-full bg-secondary border border-themed hover:border-accent/50 flex items-center justify-center text-textmuted hover:text-textprimary active:scale-95 transition-all shadow-sm ${className} ${isOpen ? 'border-accent text-accent ring-1 ring-accent/30' : ''}`}
                title={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
                aria-label="Open Notifications"
            >
                <Bell className="w-4 h-4" />

                {/* Unread indicator dot */}
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-accent ring-2 ring-primary" />
                    </span>
                )}
            </button>

            {/* Sliding Sidebar from the right rendered at top level */}
            <NotificationTray
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
            />
        </>
    );
}
