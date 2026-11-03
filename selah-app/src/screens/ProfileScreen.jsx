import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSongCache } from '../context/SongCacheContext';
import { supabase } from '../supabase/client';
import { requestNotificationPermission, isNotificationGranted, getNotificationHistory } from '../utils/notifications';
import { getNotificationPreferences, updateNotificationPreferences, DEFAULT_NOTIFICATION_PREFERENCES } from '../utils/notificationPreferences';
import { isHapticEnabled, setHapticEnabled, haptic } from '../utils/haptics';
import { discreetBackgroundSync } from '../supabase/sync';
import { getRoleLabel, getRoleBadgeStyle } from '../utils/rbac';
import { 
    User, Moon, Sun, Bell, DeviceMobile as Smartphone, Lock, FloppyDisk as Save, 
    SignOut as LogOut, SignIn as LogIn, CaretRight as ChevronRight, Check, ArrowClockwise as RefreshCw, 
    Shield, Palette, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, Church, PencilSimple as Edit3, 
    Smiley as Smile, Crown, Users, EnvelopeSimple as Mail, Key, At as AtSign, Database, X, Eye, EyeSlash as EyeOff,
    Gear, Stack as Layers
} from '@phosphor-icons/react';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';
import UserAvatar from '../components/UserAvatar';
import AvatarCarouselChooser from '../components/AvatarCarouselChooser';
import ManageTeamModal from '../components/ManageTeamModal';
import TopBarNotificationBell from '../components/TopBarNotificationBell';

export default function ProfileScreen() {
    const navigate = useNavigate();
    const { 
        user, 
        profile, 
        church, 
        signOut, 
        updateAvatar, 
        updateProfileName, 
        updateCredentials,
        canManageRoles, 
        isSuperuser 
    } = useAuth();
    const { theme, setTheme } = useTheme();
    const { songs, setlists, schedules } = useSongCache();

    // Profile Display Name (separate from login username handle)
    const currentProfileName = useMemo(() => {
        return user?.user_metadata?.full_name || 
               profile?.full_name || 
               user?.user_metadata?.display_name || 
               profile?.username || 
               user?.user_metadata?.username || 
               user?.email?.split('@')[0] || 
               'Worship Leader';
    }, [user, profile]);

    // Account Username Handle (credential used to sign in)
    const currentUsernameHandle = useMemo(() => {
        return profile?.username || 
               user?.user_metadata?.username || 
               user?.email?.split('@')[0] || 
               'worshipper';
    }, [user, profile]);

    // Avatar state (integrated carousel chooser, hidden by default)
    const [isAvatarChooserOpen, setIsAvatarChooserOpen] = useState(false);
    const [isSavingAvatar, setIsSavingAvatar] = useState(false);

    // Edit Profile Name Modal state
    const [showEditProfileModal, setShowEditProfileModal] = useState(false);
    const [editFullName, setEditFullName] = useState(currentProfileName);
    const [profileNameStatus, setProfileNameStatus] = useState({ type: '', msg: '' });
    const [isSavingProfileName, setIsSavingProfileName] = useState(false);

    // Edit Credentials Modal state
    const [showEditCredentialsModal, setShowEditCredentialsModal] = useState(false);
    const [editUsername, setEditUsername] = useState(currentUsernameHandle);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswordText, setShowPasswordText] = useState(false);
    const [credStatus, setCredStatus] = useState({ type: '', msg: '' });
    const [isSavingCreds, setIsSavingCreds] = useState(false);

    // Sign Out Confirmation Modal state
    const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

    // Manage Team State
    const [showManageTeam, setShowManageTeam] = useState(false);

    // Notifications state
    const [notifGranted, setNotifGranted] = useState(false);
    const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
    const [loadingPrefs, setLoadingPrefs] = useState(true);
    const [savingPrefKey, setSavingPrefKey] = useState(null);
    const [prefError, setPrefError] = useState(null);

    // Haptics state
    const [hapticOn, setHapticOn] = useState(isHapticEnabled());

    // Sync state
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccessToast, setSyncSuccessToast] = useState(false);

    useEffect(() => {
        setNotifGranted(isNotificationGranted());
    }, []);

    // Load account-specific notification preferences from Supabase with Dexie fallback
    useEffect(() => {
        let isMounted = true;
        if (!user?.id) {
            setLoadingPrefs(false);
            return;
        }

        async function loadPrefs() {
            try {
                setLoadingPrefs(true);
                setPrefError(null);
                const loaded = await getNotificationPreferences(user.id);
                if (isMounted) {
                    setPreferences(loaded);
                }
            } catch (err) {
                console.warn('[ProfileScreen] Failed to load preferences:', err);
            } finally {
                if (isMounted) setLoadingPrefs(false);
            }
        }

        loadPrefs();

        const handleSyncEvent = (e) => {
            if (e.detail?.userId === String(user.id) && e.detail?.preferences) {
                setPreferences(e.detail.preferences);
            }
        };

        window.addEventListener('selah:preferences-updated', handleSyncEvent);
        return () => {
            isMounted = false;
            window.removeEventListener('selah:preferences-updated', handleSyncEvent);
        };
    }, [user?.id]);

    useEffect(() => {
        setEditFullName(currentProfileName);
    }, [currentProfileName]);

    useEffect(() => {
        setEditUsername(currentUsernameHandle);
    }, [currentUsernameHandle]);

    // Handle updating profile name (strictly personal display name, zero credential impact)
    const handleSaveProfileName = async (e) => {
        e?.preventDefault();
        const cleanName = editFullName.trim();
        if (!cleanName) {
            setProfileNameStatus({ type: 'error', msg: 'Profile name cannot be blank.' });
            return;
        }

        setIsSavingProfileName(true);
        setProfileNameStatus({ type: 'loading', msg: 'Updating profile name...' });
        haptic('light');

        try {
            if (updateProfileName) {
                await updateProfileName(cleanName);
            } else {
                await supabase.auth.updateUser({
                    data: { full_name: cleanName, display_name: cleanName }
                });
            }
            haptic('success');
            setProfileNameStatus({ type: 'success', msg: 'Profile name updated!' });
            setTimeout(() => {
                setShowEditProfileModal(false);
                setProfileNameStatus({ type: '', msg: '' });
            }, 1000);
        } catch (err) {
            haptic('error');
            setProfileNameStatus({ type: 'error', msg: err?.message || 'Failed to update name.' });
        } finally {
            setIsSavingProfileName(false);
        }
    };

    // Handle updating login credentials (username handle and/or password)
    const handleSaveCredentials = async (e) => {
        e?.preventDefault();
        const cleanUsername = editUsername.trim().toLowerCase();

        if (cleanUsername) {
            if (!/^[a-z0-9_.-]+$/.test(cleanUsername)) {
                setCredStatus({
                    type: 'error',
                    msg: 'Username can only contain lowercase letters, numbers, underscores, and hyphens (no spaces).'
                });
                return;
            }
        }

        if (newPassword) {
            if (newPassword.length < 6) {
                setCredStatus({ type: 'error', msg: 'Password must be at least 6 characters long.' });
                return;
            }
            if (newPassword !== confirmPassword) {
                setCredStatus({ type: 'error', msg: 'Passwords do not match.' });
                return;
            }
        }

        if (!cleanUsername && !newPassword) {
            setCredStatus({ type: 'error', msg: 'No credential changes specified.' });
            return;
        }

        setIsSavingCreds(true);
        setCredStatus({ type: 'loading', msg: 'Updating login credentials...' });
        haptic('light');

        try {
            if (updateCredentials) {
                await updateCredentials({
                    username: cleanUsername !== currentUsernameHandle ? cleanUsername : undefined,
                    password: newPassword || undefined
                });
            } else {
                const payload = {};
                if (cleanUsername && cleanUsername !== currentUsernameHandle) {
                    payload.data = { username: cleanUsername };
                }
                if (newPassword) payload.password = newPassword;

                if (Object.keys(payload).length > 0) {
                    const { error } = await supabase.auth.updateUser(payload);
                    if (error) throw error;
                }
                if (cleanUsername) {
                    await supabase.from('profiles').upsert({
                        id: user.id,
                        username: cleanUsername,
                        email: user.email,
                        updated_at: new Date().toISOString()
                    });
                }
            }

            haptic('success');
            setCredStatus({ type: 'success', msg: 'Account credentials saved!' });
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => {
                setShowEditCredentialsModal(false);
                setCredStatus({ type: '', msg: '' });
            }, 1200);
        } catch (err) {
            haptic('error');
            setCredStatus({ type: 'error', msg: err?.message || 'Failed to update credentials.' });
        } finally {
            setIsSavingCreds(false);
        }
    };

    const handleEnableNotifications = async () => {
        haptic('light');
        const result = await requestNotificationPermission();
        if (result === 'pending' || result === true) {
            setTimeout(() => setNotifGranted(isNotificationGranted()), 1200);
        }
        setNotifGranted(result === true);
    };

    const handleTogglePreference = async (channelKey) => {
        if (!user?.id) return;
        const prevVal = preferences[channelKey] !== false;
        const nextVal = !prevVal;

        // If turning on push and system permissions not yet granted, request OS permission
        if (channelKey === 'push_enabled' && nextVal && !notifGranted) {
            const granted = await requestNotificationPermission();
            setNotifGranted(granted);
        }

        // Optimistic UI update
        setPreferences(prev => ({ ...prev, [channelKey]: nextVal }));
        setSavingPrefKey(channelKey);
        setPrefError(null);
        haptic('light');

        try {
            await updateNotificationPreferences(user.id, { [channelKey]: nextVal }, church?.id);
            haptic('success');
        } catch (err) {
            // Revert on error
            setPreferences(prev => ({ ...prev, [channelKey]: prevVal }));
            setPrefError(err?.message || 'Failed to save notification preference.');
            haptic('error');
        } finally {
            setSavingPrefKey(null);
        }
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
            setSyncSuccessToast(true);
            setTimeout(() => setSyncSuccessToast(false), 2400);
        } catch (err) {
            console.error(err);
        } finally {
            setTimeout(() => setIsSyncing(false), 600);
        }
    };

    const handleSignOut = async () => {
        haptic('medium');
        setShowSignOutConfirm(false);
        await signOut();
        navigate('/login');
    };

    // Active Segmented Tab ('profile' | 'settings')
    const [activeTab, setActiveTab] = useState('profile');

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-32 animate-pageEnter text-textprimary selection:bg-accent/20">
                {/* =========================================================================
                    CANONICAL STICKY HEADER (Matches Home, Library & Schedule screens)
                   ========================================================================= */}
                <header className="glass sticky top-0 z-30 border-b border-themed backdrop-blur-xl">
                    <div className="px-3.5 sm:px-5 pt-10 pb-4 flex items-center justify-between">
                        <AppLogo size="md" showText={true} />
                        <div className="flex items-center gap-2">
                            <TopBarNotificationBell />
                        </div>
                    </div>
                </header>

                {/* =========================================================================
                    SEGMENTED PILL SWITCHER (Profile vs Settings)
                   ========================================================================= */}
                <div className="px-3.5 sm:px-8 pt-4 pb-1 max-w-xl mx-auto">
                    <div className="p-1 rounded-2xl bg-secondary/80 border border-themed flex items-center gap-1 backdrop-blur-md shadow-inner">
                        <button
                            type="button"
                            onClick={() => {
                                haptic('light');
                                setActiveTab('profile');
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px] ${
                                activeTab === 'profile'
                                    ? 'bg-elevated text-accent shadow-sm border border-accent/25 ring-1 ring-accent/15'
                                    : 'text-textmuted hover:text-textprimary hover:bg-surface-hover'
                            }`}
                        >
                            <User size={16} className={activeTab === 'profile' ? 'text-accent' : 'text-textmuted'} />
                            <span>Profile</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                haptic('light');
                                setActiveTab('settings');
                            }}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 min-h-[44px] ${
                                activeTab === 'settings'
                                    ? 'bg-elevated text-accent shadow-sm border border-accent/25 ring-1 ring-accent/15'
                                    : 'text-textmuted hover:text-textprimary hover:bg-surface-hover'
                            }`}
                        >
                            <Gear size={16} className={activeTab === 'settings' ? 'text-accent' : 'text-textmuted'} />
                            <span>Settings</span>
                        </button>
                    </div>
                </div>

                <main className="px-3.5 sm:px-8 py-4 space-y-6 max-w-xl mx-auto">
                    {/* =========================================================================
                        TAB 1: PROFILE & MINISTRY IDENTITY
                       ========================================================================= */}
                    {activeTab === 'profile' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* USER PROFILE HERO PRESENTATION */}
                            <section className="pt-2 pb-1 space-y-4">
                                <div className="flex flex-col items-center text-center space-y-3">
                                    {/* Sprouts Avatar with Golden Aura */}
                                    <div 
                                        className="relative cursor-pointer group"
                                        onClick={() => {
                                            haptic('light');
                                            setIsAvatarChooserOpen(prev => !prev);
                                        }}
                                    >
                                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-secondary border border-themed shadow-xl group-hover:scale-105 active:scale-95 transition-all duration-300 ring-2 ring-accent/25">
                                            <div className="w-full h-full rounded-full overflow-hidden bg-primary p-0.5">
                                                <UserAvatar
                                                    seed={profile?.avatar_seed || user?.user_metadata?.avatar_seed || currentProfileName}
                                                    size="2xl"
                                                    animated={true}
                                                    className="w-full h-full object-cover"
                                                    fallbackInitial={currentProfileName.charAt(0)}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                haptic('light');
                                                setIsAvatarChooserOpen(prev => !prev);
                                            }}
                                            className={`absolute bottom-0 right-0 w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center shadow-md hover:scale-110 active:scale-90 transition-all ${
                                                isAvatarChooserOpen ? 'bg-accent text-onaccent ring-2 ring-accent/40' : 'bg-accent text-onaccent'
                                            }`}
                                            title={isAvatarChooserOpen ? "Close Avatar Chooser" : "Choose Avatar"}
                                        >
                                            <Smile className="w-4 h-4 stroke-[2.5]" />
                                        </button>
                                    </div>

                                    {/* Name, Handle & Affiliation */}
                                    <div className="space-y-1">
                                        <h1 className="text-2xl sm:text-3xl font-bold text-textprimary tracking-tight">
                                            {currentProfileName}
                                        </h1>
                                        <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-textmuted">
                                            <span className="text-accent font-mono font-semibold">@{currentUsernameHandle}</span>
                                            <span>•</span>
                                            <span className="truncate max-w-[220px]">{user?.email || 'Local Offline'}</span>
                                        </div>

                                        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                                            {/* Role Badge */}
                                            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-accent/15 text-accent flex items-center gap-1.5 border border-accent/20">
                                                {isSuperuser ? <Crown size={14} className="text-amber-400" /> : <Shield size={14} className="text-accent" />}
                                                <span>{getRoleLabel(profile?.role)}</span>
                                            </span>

                                            {/* Church Badge */}
                                            <span className="text-xs font-medium px-3 py-1 rounded-full bg-secondary text-textmuted flex items-center gap-1.5 border border-themed">
                                                <Church size={14} className="text-accent" />
                                                <span className="truncate max-w-[170px]">{church?.name || (church?.id === 'JFCM-Mercedes' ? 'Jesus First Christian Ministries' : (church?.id || 'Jesus First Christian Ministries'))}</span>
                                            </span>

                                            {/* Email Verification Chip */}
                                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center gap-1 border border-emerald-500/20">
                                                <CheckCircle2 size={12} />
                                                <span>{user ? 'Verified' : 'Offline Mode'}</span>
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Action Buttons */}
                                <div className="flex items-center justify-center gap-2.5 pt-1">
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            setEditFullName(currentProfileName);
                                            setShowEditProfileModal(true);
                                        }}
                                        className="btn-interact flex-1 max-w-[180px] py-2.5 px-3.5 rounded-full bg-secondary hover:bg-surface-hover active:bg-surface-active transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold text-textprimary border border-themed min-h-[44px]"
                                    >
                                        <Edit3 size={15} className="text-accent shrink-0" />
                                        <span>Edit Name</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            setIsAvatarChooserOpen(prev => !prev);
                                        }}
                                        className={`btn-interact flex-1 max-w-[180px] py-2.5 px-3.5 rounded-full transition-all flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold border min-h-[44px] ${
                                            isAvatarChooserOpen 
                                                ? 'bg-accent text-onaccent border-accent shadow-md shadow-accent/20' 
                                                : 'bg-secondary hover:bg-surface-hover active:bg-surface-active text-accent border-themed'
                                        }`}
                                    >
                                        <Smile size={15} className={`shrink-0 ${isAvatarChooserOpen ? 'text-onaccent' : 'text-accent'}`} />
                                        <span>{isAvatarChooserOpen ? 'Done' : 'Change Avatar'}</span>
                                    </button>
                                </div>

                                {/* Collapsible Sprouts Avatar Chooser */}
                                <AvatarCarouselChooser
                                    isOpen={isAvatarChooserOpen}
                                    onClose={() => setIsAvatarChooserOpen(false)}
                                    currentSeed={profile?.avatar_seed || user?.user_metadata?.avatar_seed || currentProfileName}
                                    onSelect={async (seed) => {
                                        setIsSavingAvatar(true);
                                        try {
                                            await updateAvatar(seed);
                                        } catch (err) {
                                            console.error('Failed to save avatar:', err);
                                        } finally {
                                            setIsSavingAvatar(false);
                                        }
                                    }}
                                    isSaving={isSavingAvatar}
                                />
                            </section>

                            {/* MINISTRY OVERVIEW STATS TRIO */}
                            <div className="grid grid-cols-3 gap-2.5">
                                {/* Cached Songs */}
                                <div className="card-interact p-3 sm:p-3.5 rounded-2xl bg-secondary/80 border border-themed flex flex-col justify-between min-h-[82px] shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                                            <Database size={15} />
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-emerald-400">Ready</span>
                                    </div>
                                    <div className="mt-2">
                                        <p className="font-mono text-base sm:text-lg font-bold text-textprimary leading-tight">
                                            {songs?.length || 0}
                                        </p>
                                        <p className="text-[11px] text-textmuted truncate font-medium">Cached Songs</p>
                                    </div>
                                </div>

                                {/* Setlists Count */}
                                <div className="card-interact p-3 sm:p-3.5 rounded-2xl bg-secondary/80 border border-themed flex flex-col justify-between min-h-[82px] shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                                            <Layers size={15} />
                                        </div>
                                        <span className="text-[10px] uppercase font-bold text-accent">Active</span>
                                    </div>
                                    <div className="mt-2">
                                        <p className="font-mono text-base sm:text-lg font-bold text-textprimary leading-tight">
                                            {setlists?.length || 0}
                                        </p>
                                        <p className="text-[11px] text-textmuted truncate font-medium">Setlists</p>
                                    </div>
                                </div>

                                {/* Ministry Tier */}
                                <div className="card-interact p-3 sm:p-3.5 rounded-2xl bg-secondary/80 border border-themed flex flex-col justify-between min-h-[82px] shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <div className="w-7 h-7 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                                            {isSuperuser ? <Crown size={15} className="text-amber-400" /> : <Shield size={15} className="text-accent" />}
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <p className="text-xs sm:text-sm font-bold text-textprimary truncate leading-tight">
                                            {getRoleLabel(profile?.role)}
                                        </p>
                                        <p className="text-[11px] text-textmuted truncate font-medium">Ministry Role</p>
                                    </div>
                                </div>
                            </div>

                            {/* GROUPED INSET CARD: PERSONAL MINISTRY DETAILS */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <User size={14} className="text-accent" /> Ministry Identity
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-secondary/70 border border-themed divide-y divide-border/40 overflow-hidden shadow-sm">
                                    {/* Display Name Row */}
                                    <div
                                        onClick={() => {
                                            haptic('light');
                                            setEditFullName(currentProfileName);
                                            setShowEditProfileModal(true);
                                        }}
                                        className="group p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover active:bg-surface-active transition-all cursor-pointer min-h-[52px]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <User size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Worship Leader Name</h3>
                                                <p className="text-xs text-textmuted mt-0.5">Visible on schedules & setlists</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-medium text-textprimary">{currentProfileName}</span>
                                            <ChevronRight size={16} className="text-textmuted group-hover:text-accent transition-colors" />
                                        </div>
                                    </div>

                                    {/* Church Affiliation Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Church size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Home Church</h3>
                                                <p className="text-xs text-textmuted mt-0.5">{church?.name || (church?.id === 'JFCM-Mercedes' ? 'Jesus First Christian Ministries' : (church?.id || 'Jesus First Christian Ministries'))}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Ministry Role Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Crown size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Assigned Privileges</h3>
                                                <p className="text-xs text-textmuted mt-0.5">{getRoleLabel(profile?.role)} permissions active</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-accent/15 text-accent border border-accent/20">
                                            {profile?.role?.toUpperCase() || 'MEMBER'}
                                        </span>
                                    </div>

                                    {/* Superuser Team & RBAC Management (Conditional) */}
                                    {canManageRoles && (
                                        <div 
                                            onClick={() => {
                                                haptic('light');
                                                setShowManageTeam(true);
                                            }}
                                            className="group p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover active:bg-surface-active transition-all cursor-pointer min-h-[52px]"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-textprimary text-sm leading-snug">Church Team & RBAC Roles</h3>
                                                    <p className="text-xs text-textmuted mt-0.5">Manage permissions and elevate ministers</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-accent">Manage</span>
                                                <ChevronRight size={16} className="text-textmuted group-hover:text-accent transition-colors" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* FAST SWITCH PROMPT TO SETTINGS */}
                            <div 
                                onClick={() => {
                                    haptic('light');
                                    setActiveTab('settings');
                                }}
                                className="card-interact p-3.5 rounded-2xl bg-secondary/50 border border-themed/70 flex items-center justify-between cursor-pointer hover:bg-secondary transition"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-secondary text-accent flex items-center justify-center border border-themed">
                                        <Gear size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-textprimary">App & Stage Settings</p>
                                        <p className="text-[11px] text-textmuted">Audio haptics, dark theme & notifications</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-xs font-semibold text-accent">
                                    <span>Configure</span>
                                    <ChevronRight size={14} />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* =========================================================================
                        TAB 2: SETTINGS & SYSTEM CONFIGURATION
                       ========================================================================= */}
                    {activeTab === 'settings' && (
                        <div className="space-y-6 animate-fadeIn">
                            {/* SECTION 1: APPEARANCE & STAGE THEME */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Palette size={14} className="text-accent" /> Appearance & Theme
                                    </h2>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5">
                                    {/* AMOLED Dark Mode Card */}
                                    <button
                                        onClick={() => {
                                            setTheme('dark');
                                            haptic('light');
                                        }}
                                        className={`btn-interact p-3.5 rounded-2xl bg-secondary/80 hover:bg-surface-hover transition-all text-left flex flex-col justify-between min-h-[92px] ${
                                            theme === 'dark'
                                                ? 'border border-accent ring-1 ring-accent/30 shadow-md'
                                                : 'border border-themed'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                                                <Moon size={16} />
                                            </div>
                                            {theme === 'dark' && (
                                                <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs shadow-sm">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-xs sm:text-sm text-textprimary">AMOLED Dark</p>
                                            <p className="text-[11px] text-textmuted mt-0.5">True Pitch Black (#000000)</p>
                                        </div>
                                    </button>

                                    {/* Apple Light Mode Card */}
                                    <button
                                        onClick={() => {
                                            setTheme('light');
                                            haptic('light');
                                        }}
                                        className={`btn-interact p-3.5 rounded-2xl bg-secondary/80 hover:bg-surface-hover transition-all text-left flex flex-col justify-between min-h-[92px] ${
                                            theme === 'light'
                                                ? 'border border-accent ring-1 ring-accent/30 shadow-md'
                                                : 'border border-themed'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                                                <Sun size={16} />
                                            </div>
                                            {theme === 'light' && (
                                                <span className="w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center text-xs shadow-sm">
                                                    <Check size={12} strokeWidth={3} />
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-xs sm:text-sm text-textprimary">Light Mode</p>
                                            <p className="text-[11px] text-textmuted mt-0.5">Clean White (#FFFFFF)</p>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* SECTION 2: NOTIFICATIONS & COMMUNICATION */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Bell size={14} className="text-accent" /> Notification Channels
                                    </h2>
                                    {savingPrefKey && (
                                        <span className="text-[11px] font-semibold text-accent animate-pulse flex items-center gap-1">
                                            <RefreshCw size={11} className="animate-spin" /> Saving...
                                        </span>
                                    )}
                                </div>

                                {prefError && (
                                    <div className="p-2.5 rounded-xl bg-danger/10 border border-danger/25 text-danger text-xs flex items-center gap-2">
                                        <AlertCircle size={14} className="shrink-0" />
                                        <span className="flex-1">{prefError}</span>
                                    </div>
                                )}

                                <div className="rounded-2xl bg-secondary/70 border border-themed divide-y divide-border/40 overflow-hidden shadow-sm">
                                    {/* In-app Notifications Toggle Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Bell size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug truncate">
                                                    In-app notifications
                                                </h3>
                                                <p className="text-xs text-textmuted mt-0.5 leading-snug">
                                                    Receive updates & ministry assignments inside the app.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleTogglePreference('in_app_enabled')}
                                            role="switch"
                                            aria-checked={preferences.in_app_enabled !== false}
                                            aria-label="Toggle in-app notifications"
                                            disabled={loadingPrefs}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none shrink-0 min-h-[28px] ${
                                                preferences.in_app_enabled !== false ? 'bg-emerald-500' : 'bg-surface-active'
                                            } ${loadingPrefs ? 'opacity-50' : ''}`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                    preferences.in_app_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Email Notifications Toggle Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Mail size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug truncate">
                                                    Email notifications
                                                </h3>
                                                <p className="text-xs text-textmuted mt-0.5 leading-snug">
                                                    Receive assignments and service reminders by email.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleTogglePreference('email_enabled')}
                                            role="switch"
                                            aria-checked={preferences.email_enabled !== false}
                                            aria-label="Toggle email notifications"
                                            disabled={loadingPrefs}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none shrink-0 min-h-[28px] ${
                                                preferences.email_enabled !== false ? 'bg-emerald-500' : 'bg-surface-active'
                                            } ${loadingPrefs ? 'opacity-50' : ''}`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                    preferences.email_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Push Notifications Toggle Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Smartphone size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug truncate">
                                                    Push notifications
                                                </h3>
                                                <p className="text-xs text-textmuted mt-0.5 leading-snug">
                                                    Receive alerts on mobile devices even when closed.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleTogglePreference('push_enabled')}
                                            role="switch"
                                            aria-checked={preferences.push_enabled !== false}
                                            aria-label="Toggle push notifications"
                                            disabled={loadingPrefs}
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none shrink-0 min-h-[28px] ${
                                                preferences.push_enabled !== false ? 'bg-emerald-500' : 'bg-surface-active'
                                            } ${loadingPrefs ? 'opacity-50' : ''}`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                    preferences.push_enabled !== false ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 3: SYSTEM & DEVICE ERGONOMICS */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Smartphone size={14} className="text-accent" /> System & Stage Ergonomics
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-secondary/70 border border-themed divide-y divide-border/40 overflow-hidden shadow-sm">
                                    {/* Device OS Permission Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Bell size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Device OS Permission</h3>
                                                <p className="text-xs text-textmuted mt-0.5">
                                                    {notifGranted ? 'Operating system permission granted' : 'Operating system permission required for alerts'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleEnableNotifications}
                                            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 shrink-0 min-h-[36px] ${
                                                notifGranted
                                                    ? 'bg-success/15 text-success border border-success/30'
                                                    : 'bg-accent text-onaccent hover:bg-accent/90 shadow-sm'
                                            }`}
                                        >
                                            {notifGranted ? 'Allowed' : 'Allow'}
                                        </button>
                                    </div>

                                    {/* Apple Cupertino Haptic Switch Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Smartphone size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Haptic Vibration Feedback</h3>
                                                <p className="text-xs text-textmuted mt-0.5">
                                                    {hapticOn ? 'Tactile vibration on tap & scroll' : 'Vibrations disabled'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleToggleHaptic}
                                            role="switch"
                                            aria-checked={hapticOn}
                                            aria-label="Toggle haptic vibration"
                                            className={`relative w-12 h-7 rounded-full transition-colors duration-200 focus:outline-none shrink-0 min-h-[28px] ${
                                                hapticOn ? 'bg-emerald-500' : 'bg-surface-active'
                                            }`}
                                        >
                                            <span
                                                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ${
                                                    hapticOn ? 'translate-x-5' : 'translate-x-0'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 4: DATA & CLOUD SYNCHRONIZATION */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Database size={14} className="text-accent" /> Data & Offline Storage
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-secondary/70 border border-themed divide-y divide-border/40 overflow-hidden shadow-sm">
                                    {/* Cloud Sync Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Cloud Synchronization</h3>
                                                <p className="text-xs text-textmuted mt-0.5">
                                                    {syncSuccessToast ? 'Sync complete!' : 'Sync offline Dexie DB with cloud'}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleManualSync}
                                            disabled={isSyncing}
                                            className="btn-interact px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-surface-hover text-xs font-semibold text-textprimary flex items-center gap-1.5 border border-themed min-h-[36px]"
                                        >
                                            <RefreshCw size={14} className={`text-accent ${isSyncing ? 'animate-spin' : ''}`} />
                                            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                                        </button>
                                    </div>

                                    {/* Offline Song Cache Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Database size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Offline Song Cache</h3>
                                                <p className="text-xs text-textmuted mt-0.5">IndexedDB storage active</p>
                                            </div>
                                        </div>
                                        <span className="text-xs sm:text-sm font-mono font-medium text-accent">
                                            {songs?.length || 0} songs • {setlists?.length || 0} setlists
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 5: ACCOUNT CREDENTIALS & SECURITY */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Lock size={14} className="text-accent" /> Account Security & Credentials
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-secondary/70 border border-themed divide-y divide-border/40 overflow-hidden shadow-sm">
                                    {/* Login Username Handle Row */}
                                    <div
                                        onClick={() => {
                                            if (!user) return;
                                            haptic('light');
                                            setEditUsername(currentUsernameHandle);
                                            setShowEditCredentialsModal(true);
                                        }}
                                        className="group p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover active:bg-surface-active transition-all cursor-pointer min-h-[52px]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <AtSign size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Sign-in Handle</h3>
                                                <p className="text-xs text-textmuted mt-0.5">Used to log into Selah across devices</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-mono font-medium text-accent">@{currentUsernameHandle}</span>
                                            <ChevronRight size={16} className="text-textmuted group-hover:text-accent transition-colors" />
                                        </div>
                                    </div>

                                    {/* Email Address Row */}
                                    <div className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover transition-all min-h-[52px]">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Mail size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Registered Email</h3>
                                                <p className="text-xs text-textmuted mt-0.5">{user?.email || 'Guest Offline'}</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                            {user ? 'Verified' : 'Offline'}
                                        </span>
                                    </div>

                                    {/* Password Row */}
                                    <div
                                        onClick={() => {
                                            if (!user) return;
                                            haptic('light');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                            setShowEditCredentialsModal(true);
                                        }}
                                        className="group p-3.5 sm:p-4 flex items-center justify-between hover:bg-surface-hover active:bg-surface-active transition-all cursor-pointer min-h-[52px]"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                                                <Key size={18} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-textprimary text-sm leading-snug">Account Password</h3>
                                                <p className="text-xs text-textmuted mt-0.5">Encrypted with Supabase Auth</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs sm:text-sm font-semibold text-accent">Change Password</span>
                                            <ChevronRight size={16} className="text-textmuted group-hover:text-accent transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 6: SESSION & SIGN OUT */}
                            <div className="pt-2 space-y-3">
                                {user ? (
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            setShowSignOutConfirm(true);
                                        }}
                                        className="btn-interact w-full py-3.5 px-4 rounded-2xl bg-danger/10 hover:bg-danger/20 text-danger text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 border border-danger/20 min-h-[48px]"
                                    >
                                        <LogOut size={18} />
                                        <span>Sign Out ({currentProfileName})</span>
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="btn-primary-interact w-full py-3.5 px-4 rounded-2xl bg-accent text-onaccent text-xs sm:text-sm font-bold shadow-md shadow-accent/20 transition flex items-center justify-center gap-2 border-0 min-h-[48px]"
                                    >
                                        <LogIn size={18} />
                                        <span>Sign In / Create Team Account</span>
                                    </button>
                                )}

                                <div className="text-center pt-2">
                                    <p className="text-xs text-textmuted font-medium">
                                        Selah Worship Planner • Version 1.0.0
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* =========================================================================
                    MODAL: EDIT PROFILE NAME (Pure Display Name / Zero Credential Impact)
                   ========================================================================= */}
                {showEditProfileModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                        <div className="w-full max-w-sm rounded-3xl bg-secondary border border-themed p-5 shadow-2xl space-y-4 animate-slideUpModal">
                            <div className="flex items-center justify-between border-b border-themed pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-textprimary">Edit Profile Name</h3>
                                    <p className="text-xs text-textmuted">Your team worship leader name</p>
                                </div>
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        setShowEditProfileModal(false);
                                    }}
                                    className="w-8 h-8 rounded-full bg-elevated hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-textprimary transition border-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {profileNameStatus.msg && (
                                <div className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                                    profileNameStatus.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
                                    profileNameStatus.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
                                    'bg-accent/10 border-accent/30 text-accent'
                                }`}>
                                    {profileNameStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                    <span>{profileNameStatus.msg}</span>
                                </div>
                            )}

                            <form onSubmit={handleSaveProfileName} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-textmuted mb-1.5 uppercase tracking-wider">
                                        Display Name / Worship Leader
                                    </label>
                                    <div className="relative">
                                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type="text"
                                            value={editFullName}
                                            onChange={(e) => setEditFullName(e.target.value)}
                                            placeholder="e.g. Kurt Jalgalado or Bro. Kurt"
                                            className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm text-textprimary focus:outline-none focus:border-accent"
                                            autoFocus
                                            required
                                        />
                                    </div>
                                    <p className="text-xs text-textmuted mt-1.5">
                                        Does NOT alter your account login username or password.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditProfileModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-elevated hover:bg-surface-hover text-textmuted text-sm font-semibold transition border-0"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingProfileName}
                                        className="flex-1 py-2.5 rounded-xl bg-accent text-onaccent text-sm font-bold hover:bg-accent/90 active:scale-95 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-1.5 border-0"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{isSavingProfileName ? 'Saving...' : 'Save Name'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    MODAL: EDIT ACCOUNT CREDENTIALS (Login Username & Password)
                   ========================================================================= */}
                {showEditCredentialsModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                        <div className="w-full max-w-sm rounded-3xl bg-secondary border border-themed p-5 shadow-2xl space-y-4 animate-slideUpModal">
                            <div className="flex items-center justify-between border-b border-themed pb-3">
                                <div>
                                    <h3 className="text-base font-bold text-textprimary">Account Credentials</h3>
                                    <p className="text-xs text-textmuted">Sign-in username handle & password</p>
                                </div>
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        setShowEditCredentialsModal(false);
                                    }}
                                    className="w-8 h-8 rounded-full bg-elevated hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-textprimary transition border-0"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {credStatus.msg && (
                                <div className={`p-2.5 rounded-xl text-xs font-medium border flex items-center gap-2 ${
                                    credStatus.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
                                    credStatus.type === 'success' ? 'bg-success/10 border-success/30 text-success' :
                                    'bg-accent/10 border-accent/30 text-accent'
                                }`}>
                                    {credStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                    <span>{credStatus.msg}</span>
                                </div>
                            )}

                            <form onSubmit={handleSaveCredentials} className="space-y-3.5">
                                {/* Username Handle */}
                                <div>
                                    <label className="block text-xs font-semibold text-textmuted mb-1.5 uppercase tracking-wider">
                                        Sign-in Handle (Username)
                                    </label>
                                    <div className="relative">
                                        <AtSign className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type="text"
                                            value={editUsername}
                                            onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                                            placeholder="e.g. krtrbn"
                                            className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-textprimary focus:outline-none focus:border-accent"
                                        />
                                    </div>
                                    <p className="text-xs text-textmuted mt-1">
                                        Used to log into Selah across devices.
                                    </p>
                                </div>

                                <div className="border-t border-themed pt-3 space-y-3">
                                    <p className="text-xs font-semibold text-textmuted uppercase tracking-wider">
                                        Change Password (Optional)
                                    </p>

                                    {/* New Password */}
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type={showPasswordText ? "text" : "password"}
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            placeholder="New password (min 6 chars)"
                                            className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-10 py-2.5 text-sm text-textprimary focus:outline-none focus:border-accent"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPasswordText(!showPasswordText)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-textmuted hover:text-textprimary"
                                        >
                                            {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>

                                    {/* Confirm Password */}
                                    {newPassword && (
                                        <div className="relative animate-fadeIn">
                                            <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                            <input
                                                type={showPasswordText ? "text" : "password"}
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Confirm new password"
                                                className="w-full bg-elevated border border-themed rounded-xl pl-10 pr-4 py-2.5 text-sm text-textprimary focus:outline-none focus:border-accent"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowEditCredentialsModal(false)}
                                        className="flex-1 py-2.5 rounded-xl bg-elevated hover:bg-surface-hover text-textmuted text-sm font-semibold transition border-0"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingCreds}
                                        className="flex-1 py-2.5 rounded-xl bg-accent text-onaccent text-sm font-bold hover:bg-accent/90 active:scale-95 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-1.5 border-0"
                                    >
                                        <Save className="w-4 h-4" />
                                        <span>{isSavingCreds ? 'Updating...' : 'Save Credentials'}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* =========================================================================
                    MODAL: SIGN OUT CONFIRMATION (Apple HIG Destructive Action Sheet)
                   ========================================================================= */}
                {showSignOutConfirm && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                        <div className="w-full max-w-sm rounded-3xl bg-secondary border border-themed p-5 shadow-2xl space-y-4 animate-slideUp">
                            <div className="text-center space-y-1.5">
                                <div className="w-12 h-12 rounded-full bg-danger/10 text-danger flex items-center justify-center mx-auto mb-2">
                                    <LogOut className="w-6 h-6" />
                                </div>
                                <h3 className="text-base font-bold text-textprimary">Sign Out of Selah?</h3>
                                <p className="text-xs text-textmuted leading-relaxed">
                                    You will need to sign in again to sync church setlists and access online schedules.
                                </p>
                            </div>

                            <div className="space-y-2 pt-2">
                                <button
                                    onClick={handleSignOut}
                                    className="w-full py-3 rounded-xl bg-danger hover:bg-danger/90 text-white font-bold text-sm active:scale-98 transition shadow-lg shadow-danger/20 border-0"
                                >
                                    Sign Out
                                </button>
                                <button
                                    onClick={() => setShowSignOutConfirm(false)}
                                    className="w-full py-2.5 rounded-xl bg-elevated hover:bg-surface-hover text-textmuted text-sm font-semibold transition border-0"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}



                {/* =========================================================================
                    MODAL: MANAGE TEAM RBAC ROLES (Superuser)
                   ========================================================================= */}
                {showManageTeam && (
                    <ManageTeamModal
                        isOpen={showManageTeam}
                        onClose={() => setShowManageTeam(false)}
                    />
                )}
            </div>
        </PullToRefresh>
    );
}
