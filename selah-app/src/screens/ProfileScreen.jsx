import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSongCache } from '../context/SongCacheContext';
import { supabase } from '../supabase/client';
import { requestNotificationPermission, isNotificationGranted, getNotificationHistory, clearNotificationHistory } from '../utils/notifications';
import { isHapticEnabled, setHapticEnabled, haptic } from '../utils/haptics';
import { discreetBackgroundSync } from '../supabase/sync';
import { 
    User, Moon, Sun, Bell, Smartphone, Lock, Save, Trash2, 
    LogOut, LogIn, ChevronRight, Check, Sparkles, RefreshCw, 
    Shield, Palette, Info, CheckCircle2, AlertCircle
} from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';

export default function ProfileScreen() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { theme, setTheme } = useTheme();
    const { songs, setlists } = useSongCache();

    // Form state
    const [username, setUsername] = useState(user?.user_metadata?.username || user?.email?.split('@')[0] || '');
    const [password, setPassword] = useState('');
    const [credStatus, setCredStatus] = useState({ type: '', msg: '' });
    const [showEditCredentials, setShowEditCredentials] = useState(false);

    // Notifications state
    const [notifGranted, setNotifGranted] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Haptics state
    const [hapticOn, setHapticOn] = useState(isHapticEnabled());

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        setNotifGranted(isNotificationGranted());
        setNotifications(getNotificationHistory());

        if (user) {
            supabase.from('profiles').select('id, username, email').eq('id', user.id).maybeSingle().then(({ data }) => {
                if (data && data.username) setUsername(data.username);
            }).catch(() => {});
        }
    }, [user]);

    const displayName = username.trim() || 
                        user?.user_metadata?.username || 
                        user?.user_metadata?.full_name || 
                        user?.email?.split('@')[0] || 
                        'Guest Worship Leader';

    const handleUpdateCredentials = async (e) => {
        e.preventDefault();
        setCredStatus({ type: 'loading', msg: 'Updating credentials...' });
        haptic('light');

        try {
            const updatePayload = {};
            if (username.trim()) {
                updatePayload.data = { username: username.trim() };
            }
            if (password) {
                if (password.length < 6) {
                    throw new Error('Password must be at least 6 characters.');
                }
                updatePayload.password = password;
            }

            if (user) {
                const { error } = await supabase.auth.updateUser(updatePayload);
                if (error) throw error;

                await supabase.from('profiles').upsert({
                    id: user.id,
                    username: username.trim(),
                    email: user.email,
                    updated_at: new Date().toISOString()
                });
            }

            setCredStatus({ type: 'success', msg: 'Profile updated successfully!' });
            setPassword('');
            setTimeout(() => {
                setCredStatus({ type: '', msg: '' });
                setShowEditCredentials(false);
            }, 2500);
        } catch (err) {
            setCredStatus({ type: 'error', msg: err.message || 'Failed to update credentials.' });
        }
    };

    const handleEnableNotifications = async () => {
        haptic('light');
        const result = await requestNotificationPermission();
        if (result === 'pending' || result === true) {
            setTimeout(() => setNotifGranted(isNotificationGranted()), 1500);
        }
        setNotifGranted(result === true);
    };

    const handleToggleHaptic = () => {
        const next = !hapticOn;
        setHapticEnabled(next);
        setHapticOn(next);
        if (next) haptic('medium');
    };

    const handleManualSync = async () => {
        haptic('light');
        setIsSyncing(true);
        try {
            await discreetBackgroundSync();
            haptic('success');
        } catch (err) {
            console.error(err);
        } finally {
            setTimeout(() => setIsSyncing(false), 800);
        }
    };

    const handleSignOut = async () => {
        haptic('medium');
        await signOut();
        navigate('/login');
    };

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-28 animate-pageEnter text-textprimary">
                {/* Header */}
                <header className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-5 pt-10 pb-4">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />
                            <h2 className="text-sm font-bold text-textprimary tracking-wide">Profile & Settings</h2>
                        </div>
                    </div>
                </header>

                <main className="px-5 py-6 space-y-6 max-w-xl mx-auto">
                    {/* ===== SPOTIFY-STYLE PROFILE HERO ===== */}
                    <div className="flex flex-col items-center text-center space-y-4 pt-2">
                        {/* Large Avatar */}
                        <div className="relative">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-accent via-amber-500 to-yellow-200 p-1 shadow-2xl shadow-accent/20">
                                <div className="w-full h-full rounded-full bg-elevated border-2 border-themed flex items-center justify-center text-accent">
                                    <span className="text-3xl sm:text-4xl font-serif font-bold uppercase select-none">
                                        {displayName.charAt(0)}
                                    </span>
                                </div>
                            </div>
                            <span className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-elevated flex items-center justify-center" title="Online Sync Active">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            </span>
                        </div>

                        {/* Name & Email Info */}
                        <div className="space-y-1">
                            <h1 className="text-2xl font-serif font-bold text-textprimary tracking-tight">
                                {displayName}
                            </h1>
                            <p className="text-xs text-textmuted">
                                {user?.email || 'Local Offline Mode'}
                            </p>
                            <div className="pt-1 flex items-center justify-center gap-2">
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30">
                                    Worship Leader
                                </span>
                            </div>
                        </div>

                        {/* Quick Stats Bar */}
                        <div className="grid grid-cols-3 gap-2 w-full max-w-md bg-secondary/80 border border-themed rounded-2xl p-3 shadow-inner">
                            <div className="text-center">
                                <p className="text-base font-bold text-textprimary">{setlists?.length || 0}</p>
                                <p className="text-[10px] text-textmuted font-medium">Setlists</p>
                            </div>
                            <div className="text-center border-x border-themed/60">
                                <p className="text-base font-bold text-textprimary">{songs?.length || 0}</p>
                                <p className="text-[10px] text-textmuted font-medium">Songs</p>
                            </div>
                            <div className="text-center">
                                <p className="text-base font-bold text-emerald-400">Active</p>
                                <p className="text-[10px] text-textmuted font-medium">Cloud Sync</p>
                            </div>
                        </div>
                    </div>

                    {/* ===== SETTINGS SECTION 1: APPEARANCE & DISPLAY ===== */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted px-1 flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-accent" /> Appearance & Stage Theme
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            {/* AMOLED Dark Mode */}
                            <button
                                onClick={() => {
                                    setTheme('dark');
                                    haptic('light');
                                }}
                                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-32 transition-all relative ${
                                    theme === 'dark'
                                        ? 'bg-black border-accent ring-1 ring-accent/40 shadow-xl'
                                        : 'bg-black/60 border-themed opacity-70 hover:opacity-100'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                                        <Moon className="w-4 h-4" />
                                    </div>
                                    {theme === 'dark' && (
                                        <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs shadow">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-xs text-white">AMOLED Dark</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">True Black (#000000)</p>
                                </div>
                            </button>

                            {/* Light Mode */}
                            <button
                                onClick={() => {
                                    setTheme('light');
                                    haptic('light');
                                }}
                                className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-32 transition-all relative ${
                                    theme === 'light'
                                        ? 'bg-white border-accent ring-1 ring-accent/40 shadow-xl text-gray-900'
                                        : 'bg-white/90 border-themed opacity-70 hover:opacity-100 text-gray-900'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                                        <Sun className="w-4 h-4" />
                                    </div>
                                    {theme === 'light' && (
                                        <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs shadow">
                                            <Check className="w-3 h-3 stroke-[3]" />
                                        </span>
                                    )}
                                </div>
                                <div>
                                    <p className="font-bold text-xs text-gray-900">Light Mode</p>
                                    <p className="text-[10px] text-gray-500 mt-0.5">Pure White (#FFFFFF)</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* ===== SETTINGS SECTION 2: ACCOUNT CREDENTIALS ===== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-accent" /> Account & Security
                            </h3>
                            {user && (
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        setShowEditCredentials(prev => !prev);
                                    }}
                                    className="text-[11px] font-semibold text-accent hover:underline"
                                >
                                    {showEditCredentials ? 'Close' : 'Edit Credentials'}
                                </button>
                            )}
                        </div>

                        {showEditCredentials && user ? (
                            <form onSubmit={handleUpdateCredentials} className="p-5 rounded-2xl bg-secondary/80 border border-themed space-y-4 animate-fadeIn">
                                {credStatus.msg && (
                                    <div className={`p-3 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                                        credStatus.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
                                        credStatus.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
                                        'bg-accent/10 border-accent/30 text-accent'
                                    }`}>
                                        {credStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                        <span>{credStatus.msg}</span>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-medium text-textmuted mb-1.5">Username / Worship Leader Name</label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Worship Leader Name"
                                            className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-textmuted mb-1.5">New Password (leave blank to keep current)</label>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full py-2.5 bg-accent text-onaccent font-bold text-xs rounded-xl hover:bg-accent/90 active:scale-98 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-1.5"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>Save Credentials</span>
                                </button>
                            </form>
                        ) : (
                            <div className="p-4 rounded-2xl bg-secondary/80 border border-themed flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                                        <User className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-textprimary">{displayName}</p>
                                        <p className="text-[10px] text-textmuted">{user ? user.email : 'Signed in as Guest'}</p>
                                    </div>
                                </div>
                                {user && (
                                    <button
                                        onClick={() => setShowEditCredentials(true)}
                                        className="text-xs font-semibold text-accent hover:underline flex items-center gap-0.5"
                                    >
                                        <span>Edit</span>
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ===== SETTINGS SECTION 3: NOTIFICATIONS & HAPTICS ===== */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted px-1 flex items-center gap-1.5">
                            <Bell className="w-3.5 h-3.5 text-accent" /> System Preferences
                        </h3>

                        <div className="space-y-2">
                            {/* Notification Permission Item */}
                            <div className="p-4 rounded-2xl bg-secondary/80 border border-themed flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-textprimary">Setlist Notifications</p>
                                    <p className="text-[10px] text-textmuted">
                                        {notifGranted ? 'Notifications active' : 'Get alerts when team setlists are scheduled'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleEnableNotifications}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                                        notifGranted
                                            ? 'bg-success/15 text-success border border-success/30'
                                            : 'bg-accent text-onaccent hover:bg-accent/90 active:scale-95'
                                    }`}
                                >
                                    {notifGranted ? 'Enabled' : 'Enable'}
                                </button>
                            </div>

                            {/* Haptic Feedback Toggle */}
                            <div className="p-4 rounded-2xl bg-secondary/80 border border-themed flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                                        <Smartphone className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-textprimary">Haptic Vibration Feedback</p>
                                        <p className="text-[10px] text-textmuted">
                                            {hapticOn ? 'Tactile vibration on tap' : 'Vibration disabled'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleHaptic}
                                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                        hapticOn ? 'bg-accent' : 'bg-surface-active'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                                            hapticOn ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ===== SETTINGS SECTION 4: CLOUD SYNC ===== */}
                    <div className="space-y-3">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-textmuted px-1 flex items-center gap-1.5">
                            <RefreshCw className="w-3.5 h-3.5 text-accent" /> Cloud Sync & Database
                        </h3>

                        <div className="p-4 rounded-2xl bg-secondary/80 border border-themed flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-textprimary">Manual Cloud Sync</p>
                                <p className="text-[10px] text-textmuted">
                                    Sync local Dexie DB with Supabase cloud
                                </p>
                            </div>
                            <button
                                onClick={handleManualSync}
                                disabled={isSyncing}
                                className="px-3.5 py-1.5 rounded-xl bg-secondary border border-themed hover:border-accent text-xs font-semibold text-textprimary flex items-center gap-1.5 active:scale-95 transition"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 text-accent ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                            </button>
                        </div>
                    </div>

                    {/* ===== LOGOUT / LOGIN ACTION ===== */}
                    <div className="pt-2 space-y-3">
                        {user ? (
                            <button
                                onClick={handleSignOut}
                                className="w-full py-3.5 px-4 rounded-2xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 active:scale-98 text-xs font-bold transition flex items-center justify-center gap-2"
                            >
                                <LogOut className="w-4 h-4" />
                                <span>Sign Out ({displayName})</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full py-3.5 px-4 rounded-2xl bg-accent text-onaccent active:scale-98 text-xs font-bold transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                            >
                                <LogIn className="w-4 h-4" />
                                <span>Sign In / Create Team Account</span>
                            </button>
                        )}

                        <p className="text-center text-[10px] text-textmuted/60">
                            Selah Worship Planner • Version 1.0.0
                        </p>
                    </div>
                </main>
            </div>
        </PullToRefresh>
    );
}
