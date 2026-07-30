import { createContext, useContext } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/dexie';

const SongCacheContext = createContext(null);

export function SongCacheProvider({ children }) {
  const songs = useLiveQuery(() => db.songs.toArray(), [], []);
  const setlists = useLiveQuery(() => db.setlists.toArray(), [], []);

  return (
    <SongCacheContext.Provider value={{ songs, setlists }}>
      {children}
    </SongCacheContext.Provider>
  );
}

export function useSongCache() {
  const ctx = useContext(SongCacheContext);
  if (!ctx) throw new Error('useSongCache must be used within SongCacheProvider');
  return ctx;
}
