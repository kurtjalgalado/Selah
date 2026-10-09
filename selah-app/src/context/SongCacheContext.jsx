import { createContext, useContext, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';
import { useAuth } from '../auth/AuthContext';

const SongCacheContext = createContext(null);

export function SongCacheProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;

  const songs = useLiveQuery(() => db.songs.toArray(), [], undefined);
  const setlists = useLiveQuery(() => db.setlists.toArray(), [], undefined);
  const rawSchedules = useLiveQuery(() => db.schedules.toArray(), [], undefined);
  const rawNotifications = useLiveQuery(() => db.notifications.toArray(), [], []);

  // Deduplicate schedules (by setlistId or churchId + serviceDate + serviceTitle)
  const schedules = useMemo(() => {
    if (!rawSchedules) return rawSchedules;
    const map = new Map();
    for (const s of rawSchedules) {
      if (!s) continue;
      const key = s.setlistId 
        ? `setlist:${s.setlistId}` 
        : `date:${(s.churchId || 'default').toLowerCase()}_${s.serviceDate}_${(s.serviceTitle || '').trim().toLowerCase()}`;
      
      if (!map.has(key)) {
        map.set(key, s);
      } else {
        const existing = map.get(key);
        const assignedExisting = (existing.assignments || []).filter(x => x.user_id || x.user_name).length;
        const assignedCurrent = (s.assignments || []).filter(x => x.user_id || x.user_name).length;
        if (assignedCurrent > assignedExisting || (assignedCurrent === assignedExisting && new Date(s.updatedAt || 0) > new Date(existing.updatedAt || 0))) {
          map.set(key, s);
        }
      }
    }
    return Array.from(map.values());
  }, [rawSchedules]);

  const notifications = useMemo(() => {
    if (!rawNotifications) return [];
    return rawNotifications
      .filter(n => {
        // If logged in: show notifications targeted to this user OR unassigned general/system notifications
        if (userId) {
          return !n.userId || String(n.userId) === userId;
        }
        // If guest / offline: show unassigned notifications
        return !n.userId;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [rawNotifications, userId]);

  const unreadCount = useMemo(() => {
    if (!notifications) return 0;
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  return (
    <SongCacheContext.Provider value={{ songs, setlists, schedules, notifications, unreadCount }}>
      {children}
    </SongCacheContext.Provider>
  );
}

export function useSongCache() {
  const ctx = useContext(SongCacheContext);
  if (!ctx) throw new Error('useSongCache must be used within SongCacheProvider');
  return ctx;
}
