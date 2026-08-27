import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../supabase/client';
import { requestNotificationPermission, isNotificationGranted, getNotificationHistory, clearNotificationHistory } from '../utils/notifications';
import { isHapticEnabled, setHapticEnabled, haptic } from '../utils/haptics';
import { X, User, Lock, Bell, Save, Trash2, Smartphone, Moon, Sun, Palette, Check } from 'lucide-react';

export default function ProfileSettingsModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const { theme, setTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('appearance'); // 'appearance', 'credentials', 'notifications'

    // Form state
    const [username, setUsername] = useState(user?.user_metadata?.username || user?.email?.split('@')[0] || '');
    const [password, setPassword] = useState('');
    const [credStatus, setCredStatus] = useState({ type: '', msg: '' });

    // Notifications state
    const [notifGranted, setNotifGranted] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Haptics state
    const [hapticOn, setHapticOn] = useState(isHapticEnabled());

    // Load initial user data on mount & lock body scroll
    useEffect(() => {
        if (!isOpen) return;

        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Check system notification state via bridge-aware helper
        setNotifGranted(isNotificationGranted());

        setNotifications(getNotificationHistory());

        // Fetch user profile from Supabase (username)
        if (user) {
            supabase.from('profiles').select('id, username, email').eq('id', user.id).maybeSingle().then(({ data }) => {
                if (data && data.username) setUsername(data.username);
            }).catch(() => {});
        }

        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen, user]);

    if (!isOpen) return null;

    // Handle credentials update
    const handleUpdateCredentials = async (e) => {
        e.preventDefault();
        setCredStatus({ type: 'loading', msg: 'Updating credentials...' });

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
                // Update Supabase auth
                const { error } = await supabase.auth.updateUser(updatePayload);
                if (error) throw error;

                // Upsert profiles table
                await supabase.from('profiles').upsert({
                    id: user.id,
                    username: username.trim(),
                    email: user.email,
                    updated_at: new Date().toISOString()
                });
            }

            setCredStatus({ type: 'success', msg: 'Profile credentials updated successfully!' });
            setPassword('');
            setTimeout(() => setCredStatus({ type: '', msg: '' }), 4000);
        } catch (err) {
            setCredStatus({ type: 'error', msg: err.message || 'Failed to update credentials.' });
        }
    };

    // Handle Request Notification Permission
    const handleEnableNotifications = async () => {
        const result = await requestNotificationPermission();
        if (result === 'pending' || result === true) {
            setTimeout(() => setNotifGranted(isNotificationGranted()), 1500);
        }
        setNotifGranted(result === true);
        haptic('light');
    };

    // Toggle Haptic Feedback
    const handleToggleHaptic = () => {
        const next = !hapticOn;
        setHapticEnabled(next);
        setHapticOn(next);
        if (next) haptic('medium');
    };

    // Clear Notification Log
    const handleClearLog = () => {
        clearNotificationHistory();
        setNotifications([]);
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated border-t sm:border border-themed rounded-t-3xl sm:rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[90vh] pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-2.5 sm:hidden shrink-0" />
                {/* Modal Header */}
                <div className="px-6 py-3.5 border-b border-themed flex items-center justify-between bg-secondary/60 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-serif font-bold text-lg text-textprimary leading-tight">Profile & Preferences</h3>
                            <p className="text-xs text-textmuted">Manage theme, account, and notifications</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Header */}
                <div className="flex border-b border-themed bg-secondary/40 shrink-0 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('appearance')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'appearance' ? 'border-accent text-accent bg-surface-hover' : 'border-transparent text-textmuted hover:text-textprimary'
                        }`}
                    >
                        <Palette className="w-4 h-4" /> Appearance
                    </button>
                    <button
                        onClick={() => setActiveTab('credentials')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'credentials' ? 'border-accent text-accent bg-surface-hover' : 'border-transparent text-textmuted hover:text-textprimary'
                        }`}
                    >
                        <User className="w-4 h-4" /> Account
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'notifications' ? 'border-accent text-accent bg-surface-hover' : 'border-transparent text-textmuted hover:text-textprimary'
                        }`}
                    >
                        <Bell className="w-4 h-4" /> Notifications
                    </button>
                </div>

                {/* Tab Content Area */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* TAB 1: APPEARANCE / THEME */}
                    {activeTab === 'appearance' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-textprimary mb-1">Display Theme</h4>
                                <p className="text-xs text-textmuted mb-4">
                                    Choose your preferred visual theme. AMOLED Dark utilizes true black (#000000) for OLED battery conservation and stage reading.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {/* AMOLED Dark Theme Option */}
                                <button
                                    onClick={() => {
                                        setTheme('dark');
                                        haptic('light');
                                    }}
                                    className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-32 ${
                                        theme === 'dark'
                                            ? 'bg-black border-accent ring-1 ring-accent/30 shadow-lg'
                                            : 'bg-black/80 border-themed hover:border-accent/40 opacity-80 hover:opacity-100'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-8 h-8 rounded-xl bg-accent/20 text-accent flex items-center justify-center">
                                            <Moon className="w-4 h-4" />
                                        </div>
                                        {theme === 'dark' && (
                                            <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-white">AMOLED Dark</h5>
                                        <p className="text-[10px] text-gray-400 mt-0.5">True Black (#000000)</p>
                                    </div>
                                </button>

                                {/* Light Theme Option */}
                                <button
                                    onClick={() => {
                                        setTheme('light');
                                        haptic('light');
                                    }}
                                    className={`relative p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-32 ${
                                        theme === 'light'
                                            ? 'bg-white border-accent ring-1 ring-accent/30 shadow-lg text-gray-900'
                                            : 'bg-white/90 border-themed hover:border-accent/40 opacity-80 hover:opacity-100 text-gray-900'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center">
                                            <Sun className="w-4 h-4" />
                                        </div>
                                        {theme === 'light' && (
                                            <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <h5 className="font-bold text-xs text-gray-900">Light Mode</h5>
                                        <p className="text-[10px] text-gray-500 mt-0.5">Pure White (#FFFFFF)</p>
                                    </div>
                                </button>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary border border-themed text-xs space-y-1">
                                <p className="font-bold text-textprimary">AMOLED Display Optimization</p>
                                <p className="text-textmuted text-[11px] leading-relaxed">
                                    Pixels are completely powered off in pure black areas on AMOLED screens, saving up to 40% battery during extended live worship performances.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: CREDENTIALS */}
                    {activeTab === 'credentials' && (
                        <form onSubmit={handleUpdateCredentials} className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-textprimary mb-1">Update Account Credentials</h4>
                                <p className="text-xs text-textmuted mb-4">
                                    Change your public Worship Leader display name or update your account password.
                                </p>
                            </div>

                            {credStatus.msg && (
                                <div className={`p-3 rounded-xl text-xs font-medium border ${
                                    credStatus.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
                                    credStatus.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
                                    'bg-accent/10 border-accent/30 text-accent'
                                }`}>
                                    {credStatus.msg}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-textmuted mb-1.5">Username / Display Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        placeholder="e.g. Worship Leader Alex"
                                        className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-textmuted mb-1.5">New Password (leave blank to keep current)</label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-accent text-onaccent font-bold text-sm rounded-xl hover:bg-accent/90 active:scale-98 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 mt-4"
                            >
                                <Save className="w-4 h-4" /> Save Credentials
                            </button>
                        </form>
                    )}

                    {/* TAB 3: NOTIFICATIONS */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-textprimary mb-1">Setlist & Team Schedule Notifications</h4>
                                <p className="text-xs text-textmuted mb-4">
                                    Get notified on this device whenever a worship setlist is scheduled by other team accounts.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary border border-themed flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-textprimary">System Notifications</p>
                                    <p className="text-[10px] text-textmuted">
                                        {notifGranted ? 'Permission granted' : 'Notifications blocked/disabled'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleEnableNotifications}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                        notifGranted
                                            ? 'bg-success/20 text-success border border-success/30'
                                            : 'bg-accent text-onaccent hover:bg-accent/90'
                                    }`}
                                >
                                    {notifGranted ? 'Enabled' : 'Enable'}
                                </button>
                            </div>

                            {/* Haptic Feedback Toggle */}
                            <div className="p-4 rounded-2xl bg-secondary border border-themed flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-4 h-4 text-accent" />
                                    <div>
                                        <p className="text-xs font-bold text-textprimary">Haptic Feedback</p>
                                        <p className="text-[10px] text-textmuted">
                                            {hapticOn ? 'Vibration on tap actions' : 'Disabled'}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleToggleHaptic}
                                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                                        hapticOn ? 'bg-accent' : 'bg-surface-active'
                                    }`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform duration-200 ${
                                            hapticOn ? 'translate-x-5' : 'translate-x-0'
                                        }`}
                                    />
                                </button>
                            </div>

                            {/* Notification History Log */}
                            <div className="pt-2">
                                <div className="flex items-center justify-between mb-2">
                                    <h5 className="text-xs font-bold text-textmuted uppercase tracking-wider">Scheduled History Log</h5>
                                    {notifications.length > 0 && (
                                        <button onClick={handleClearLog} className="text-[10px] text-danger hover:underline flex items-center gap-1">
                                            <Trash2 className="w-3 h-3" /> Clear
                                        </button>
                                    )}
                                </div>

                                {notifications.length === 0 ? (
                                    <div className="p-6 text-center bg-secondary rounded-2xl border border-themed text-textmuted text-xs">
                                        No recent setlist notifications yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                                        {notifications.map((n, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-secondary border border-themed text-xs flex items-start gap-2.5">
                                                <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-textprimary leading-snug">{n.title}</p>
                                                    <p className="text-textmuted text-[11px] mt-0.5">{n.body}</p>
                                                    <p className="text-[9px] text-textmuted/60 mt-1">{new Date(n.timestamp || n.time || Date.now()).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
