import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabase/client';
import { requestNotificationPermission, getNotificationHistory, clearNotificationHistory } from '../utils/notifications';
import { X, User, Lock, KeyRound, Bell, Check, Save, ShieldCheck, Trash2 } from 'lucide-react';

export default function ProfileSettingsModal({ isOpen, onClose }) {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('credentials'); // 'credentials', 'pin', 'notifications'

    // Form state
    const [username, setUsername] = useState(user?.user_metadata?.username || user?.email?.split('@')[0] || '');
    const [password, setPassword] = useState('');
    const [credStatus, setCredStatus] = useState({ type: '', msg: '' });

    // Quick PIN state
    const [pin, setPin] = useState('');
    const [savedPin, setSavedPin] = useState('');
    const [pinStatus, setPinStatus] = useState('');

    // Notifications state
    const [notifGranted, setNotifGranted] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Load initial user data on mount
    useEffect(() => {
        if (!isOpen) return;

        // Check system notification state
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotifGranted(Notification.permission === 'granted');
        }

        setNotifications(getNotificationHistory());

        // Fetch user profile from Supabase (quick_pin, username)
        if (user) {
            supabase.from('profiles').select('id, username, email').eq('id', user.id).maybeSingle().then(({ data }) => {
                if (data && data.username) setUsername(data.username);
            }).catch(() => {});

            // Attempt custom fields safely
            supabase.from('profiles').select('quick_pin').eq('id', user.id).maybeSingle().then(({ data }) => {
                if (data && data.quick_pin) {
                    setSavedPin(data.quick_pin);
                    setPin(data.quick_pin);
                }
            }).catch(() => {});
        } else {
            // Local fallback PIN for guest/offline mode
            const localPin = localStorage.getItem('selah_guest_pin') || '';
            setSavedPin(localPin);
            setPin(localPin);
        }
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

    // Handle Quick PIN save
    const handleSavePin = async (e) => {
        e.preventDefault();
        const cleanPin = pin.trim();

        if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
            setPinStatus('PIN must be exactly 4 digits.');
            return;
        }

        try {
            if (user) {
                await supabase.from('profiles').upsert({
                    id: user.id,
                    quick_pin: cleanPin,
                    updated_at: new Date().toISOString()
                });
            }

            // Save locally for instant offline PIN login
            if (user?.id) {
                localStorage.setItem(`selah_pin_${user.id}`, cleanPin);
            } else {
                localStorage.setItem('selah_guest_pin', cleanPin);
            }

            setSavedPin(cleanPin);
            setPinStatus('Quick PIN saved & synced!');
            setTimeout(() => setPinStatus(''), 3000);
        } catch (err) {
            setPinStatus('Failed to sync PIN: ' + err.message);
        }
    };

    // Handle Request Notification Permission
    const handleEnableNotifications = async () => {
        const granted = await requestNotificationPermission();
        setNotifGranted(granted);
    };

    // Clear Notification Log
    const handleClearLog = () => {
        clearNotificationHistory();
        setNotifications([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
            <div className="bg-elevated border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-secondary/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
                            <User className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-serif font-bold text-lg text-white leading-tight">Profile & Preferences</h3>
                            <p className="text-xs text-textmuted">Manage account, PIN, and notifications</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-textmuted hover:text-white hover:bg-white/5 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Header */}
                <div className="flex border-b border-white/10 bg-secondary/40 shrink-0 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('credentials')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'credentials' ? 'border-accent text-accent bg-white/5' : 'border-transparent text-textmuted hover:text-white'
                        }`}
                    >
                        <User className="w-4 h-4" /> Account
                    </button>
                    <button
                        onClick={() => setActiveTab('pin')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'pin' ? 'border-accent text-accent bg-white/5' : 'border-transparent text-textmuted hover:text-white'
                        }`}
                    >
                        <KeyRound className="w-4 h-4" /> Quick PIN
                    </button>
                    <button
                        onClick={() => setActiveTab('notifications')}
                        className={`flex-1 py-3 px-4 text-xs font-bold border-b-2 flex items-center justify-center gap-2 whitespace-nowrap transition ${
                            activeTab === 'notifications' ? 'border-accent text-accent bg-white/5' : 'border-transparent text-textmuted hover:text-white'
                        }`}
                    >
                        <Bell className="w-4 h-4" /> Notifications
                    </button>
                </div>

                {/* Tab Content Area */}
                <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    {/* TAB 1: CREDENTIALS */}
                    {activeTab === 'credentials' && (
                        <form onSubmit={handleUpdateCredentials} className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Update Account Credentials</h4>
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
                                        className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
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
                                        className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full py-3 bg-accent text-primary font-bold text-sm rounded-xl hover:bg-accent/90 active:scale-98 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2 mt-4"
                            >
                                <Save className="w-4 h-4" /> Save Credentials
                            </button>
                        </form>
                    )}

                    {/* TAB 2: QUICK PIN */}
                    {activeTab === 'pin' && (
                        <form onSubmit={handleSavePin} className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Quick PIN 1-Step Login</h4>
                                <p className="text-xs text-textmuted mb-4">
                                    Set a 4-digit PIN for instant access on the login screen without typing your full password every time. This is synced with your Supabase account.
                                </p>
                            </div>

                            {pinStatus && (
                                <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-medium">
                                    {pinStatus}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-textmuted mb-1.5">4-Digit Numeric PIN</label>
                                <div className="relative">
                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                    <input
                                        type="password"
                                        maxLength={4}
                                        pattern="\d{4}"
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="e.g. 1234"
                                        className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-lg font-mono tracking-widest focus:outline-none focus:border-accent text-white"
                                    />
                                </div>
                            </div>

                            {savedPin && (
                                <div className="flex items-center gap-2 text-xs text-success bg-success/10 p-2.5 rounded-xl border border-success/20">
                                    <ShieldCheck className="w-4 h-4" /> Quick PIN is active for instant sign-in.
                                </div>
                            )}

                            <div className="flex gap-2 pt-2">
                                {savedPin && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPin('');
                                            setSavedPin('');
                                            if (user?.id) localStorage.removeItem(`selah_pin_${user.id}`);
                                            localStorage.removeItem('selah_guest_pin');
                                            if (user) supabase.from('profiles').upsert({ id: user.id, quick_pin: null });
                                            setPinStatus('PIN removed');
                                        }}
                                        className="py-3 px-4 border border-danger/30 text-danger rounded-xl text-xs font-bold hover:bg-danger/10"
                                    >
                                        Remove
                                    </button>
                                )}
                                <button
                                    type="submit"
                                    className="flex-1 py-3 bg-accent text-primary font-bold text-sm rounded-xl hover:bg-accent/90 active:scale-98 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                                >
                                    <Save className="w-4 h-4" /> Save Quick PIN
                                </button>
                            </div>
                        </form>
                    )}

                    {/* TAB 3: NOTIFICATIONS */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">Setlist & Team Schedule Notifications</h4>
                                <p className="text-xs text-textmuted mb-4">
                                    Get notified on this device whenever a worship setlist is scheduled by other team accounts.
                                </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary/60 border border-white/10 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-bold text-white">System Notifications</p>
                                    <p className="text-[10px] text-textmuted">
                                        {notifGranted ? 'Permission granted' : 'Notifications blocked/disabled'}
                                    </p>
                                </div>
                                <button
                                    onClick={handleEnableNotifications}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                                        notifGranted
                                            ? 'bg-success/20 text-success border border-success/30'
                                            : 'bg-accent text-primary hover:bg-accent/90'
                                    }`}
                                >
                                    {notifGranted ? 'Enabled' : 'Enable'}
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
                                    <div className="p-6 text-center bg-secondary/30 rounded-2xl border border-white/5 text-textmuted text-xs">
                                        No recent setlist notifications yet.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                                        {notifications.map((n, i) => (
                                            <div key={i} className="p-3 rounded-xl bg-secondary/50 border border-white/5 text-xs flex items-start gap-2.5">
                                                <Bell className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-bold text-white leading-snug">{n.title}</p>
                                                    <p className="text-textmuted text-[11px] mt-0.5">{n.body}</p>
                                                    <p className="text-[9px] text-textmuted/60 mt-1">{new Date(n.time).toLocaleString()}</p>
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
