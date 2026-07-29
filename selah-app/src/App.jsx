import { useEffect, useState, createContext, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { App as CapApp } from '@capacitor/app';
import { useAuth } from './auth/AuthContext';
import { db, seedDatabase, songDB, setlistDB } from './db/dexie';
import Toast from './components/Toast';

// Lazy-loaded screen modules
const LoginScreen = lazy(() => import('./screens/LoginScreen'));
const RegisterScreen = lazy(() => import('./screens/RegisterScreen'));
const LibraryScreen = lazy(() => import('./screens/LibraryScreen'));
const SongDetailScreen = lazy(() => import('./screens/SongDetailScreen'));
const SetlistScreen = lazy(() => import('./screens/SetlistScreen'));
const SetlistPlayerScreen = lazy(() => import('./screens/SetlistPlayerScreen'));

export const ToastContext = createContext(() => { });

function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-primary">
      <div className="text-center">
        <h1 className="text-3xl font-serif font-bold text-accent animate-pulse">Selah</h1>
        <p className="text-textmuted text-xs mt-2 tracking-widest uppercase">Loading screen...</p>
      </div>
    </div>
  );
}

function BackButtonHandler() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    let listener;
    CapApp.addListener('backButton', ({ canGoBack }) => {
      const isTopLevel = location.pathname === '/library' || location.pathname === '/login' || location.pathname === '/';
      if (!isTopLevel && (canGoBack || window.history.length > 1)) {
        navigate(-1);
      } else {
        setShowExitModal(true);
      }
    }).then(l => { listener = l; });

    return () => {
      if (listener) listener.remove();
    };
  }, [location.pathname, navigate]);

  if (!showExitModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-elevated border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
        <h3 className="text-xl font-serif font-bold text-white">Exit Selah?</h3>
        <p className="text-textmuted text-sm">Are you sure you want to exit the application?</p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => setShowExitModal(false)}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-textmuted hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            onClick={() => CapApp.exitApp()}
            className="flex-1 py-2.5 px-4 text-sm font-semibold text-black bg-accent hover:bg-accent/90 rounded-xl transition shadow-lg shadow-accent/20"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  );
}

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
      <BackButtonHandler />
      <ToastContext.Provider value={showToast}>
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            {/* Auth routes */}
            <Route path="/login" element={<LoginScreen />} />
            <Route path="/register" element={<RegisterScreen />} />

            {/* App routes (guest/offline access enabled) */}
            <Route path="/library" element={<LibraryScreen />} />
            <Route path="/song/:id" element={<SongDetailScreen />} />
            <Route path="/setlists" element={<SetlistScreen />} />
            <Route path="/setlist-player/:id" element={<SetlistPlayerScreen />} />

            {/* Default redirect to library */}
            <Route path="*" element={<Navigate to="/library" />} />
          </Routes>
        </Suspense>
        {toast && <Toast key={toast.id} {...toast} onClose={() => setToast(null)} />}
      </ToastContext.Provider>
    </HashRouter>
  );
}