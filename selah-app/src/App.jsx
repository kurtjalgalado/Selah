import { useEffect, useState, createContext } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuth } from './auth/AuthContext';
import { db, seedDatabase, songDB, setlistDB } from './db/dexie';
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import LibraryScreen from './screens/LibraryScreen';
import SongDetailScreen from './screens/SongDetailScreen';
import SetlistScreen from './screens/SetlistScreen';
import Toast from './components/Toast';

export const ToastContext = createContext(() => { });

export default function App() {
  const { user, loading } = useAuth();
  const [toast, setToast] = useState(null);
  const [seeded, setSeeded] = useState(false);

  // Seed database on first launch
  useEffect(() => {
    seedDatabase().then(() => setSeeded(true));
  }, []);

  // Toast helper
  const showToast = (message, type = 'success') => {
    setToast({ message, type, id: Date.now() });
  };

  if (loading || !seeded) {
    return (
      <div className="flex items-center justify-center h-screen bg-primary">
        <div className="text-center">
          <h1 className="text-4xl font-serif font-bold text-accent animate-pulse">Selah</h1>
          <p className="text-textmuted text-sm mt-2 tracking-widest uppercase">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <ToastContext.Provider value={showToast}>
        <Routes>
          {/* Auth routes */}
          <Route path="/login" element={<LoginScreen />} />
          <Route path="/register" element={<RegisterScreen />} />

          {/* App routes (guest/offline access enabled) */}
          <Route path="/library" element={<LibraryScreen />} />
          <Route path="/song/:id" element={<SongDetailScreen />} />
          <Route path="/setlists" element={<SetlistScreen />} />

          {/* Default redirect to library */}
          <Route path="*" element={<Navigate to="/library" />} />
        </Routes>
        {toast && <Toast key={toast.id} {...toast} onClose={() => setToast(null)} />}
      </ToastContext.Provider>
    </HashRouter>
  );
}