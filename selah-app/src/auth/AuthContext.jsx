import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../supabase/client';
import { initRealtimeSync } from '../supabase/sync';
import { db, profileDB } from '../db/dexie';
import { 
    isSuperuser, 
    isAdmin, 
    isWorshipLeader, 
    canManageSchedule, 
    canManageRoles, 
    canManageSetlists,
    ROLES,
    SUPERUSER_EMAIL 
} from '../utils/rbac';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [church, setChurch] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadUserProfile = useCallback(async (currentUser) => {
        if (!currentUser) {
            setProfile(null);
            setChurch(null);
            return;
        }

        try {
            const { data: prof } = await supabase
                .from('profiles')
                .select('id, username, email, role, church_id, accent_color, avatar_seed')
                .eq('id', currentUser.id)
                .maybeSingle();

            const isOwner = currentUser.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase();

            if (prof) {
                const resolvedRole = isOwner ? ROLES.SUPERUSER : (prof.role || ROLES.WORSHIP_TEAM_MEMBER);
                const resolvedFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.display_name || prof.full_name || prof.username || currentUser.email?.split('@')[0];
                const finalProfile = {
                    ...prof,
                    full_name: resolvedFullName,
                    role: resolvedRole,
                    avatar_seed: prof.avatar_seed || currentUser.user_metadata?.avatar_seed || prof.username || currentUser.email?.split('@')[0] || 'Felix',
                    church_id: prof.church_id || currentUser.user_metadata?.church_id || 'JFCM-Mercedes'
                };
                setProfile(finalProfile);
                await profileDB.put(finalProfile);
                const churchId = finalProfile.church_id;
                
                // Discreetly ensure superuser in DB if owner
                if (isOwner && prof.role !== ROLES.SUPERUSER) {
                    supabase.from('profiles').update({ role: ROLES.SUPERUSER }).eq('id', currentUser.id).then(() => {});
                }

                // Fetch church details
                const { data: churchData } = await supabase
                    .from('churches')
                    .select('id, name')
                    .eq('id', churchId)
                    .maybeSingle();

                setChurch(churchData || { id: churchId, name: churchId });
            } else {
                const defaultChurchId = currentUser.user_metadata?.church_id || 'JFCM-Mercedes';
                const defaultSeed = currentUser.user_metadata?.avatar_seed || currentUser.user_metadata?.username || currentUser.email?.split('@')[0] || 'Felix';
                const resolvedRole = isOwner ? ROLES.SUPERUSER : ROLES.WORSHIP_TEAM_MEMBER;
                const resolvedFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.display_name || currentUser.user_metadata?.username || currentUser.email?.split('@')[0];
                const newProfile = {
                    id: currentUser.id,
                    username: currentUser.user_metadata?.username || currentUser.email?.split('@')[0],
                    full_name: resolvedFullName,
                    email: currentUser.email,
                    role: resolvedRole,
                    church_id: defaultChurchId,
                    avatar_seed: defaultSeed
                };
                setProfile(newProfile);
                await profileDB.put(newProfile);
                setChurch({ id: defaultChurchId, name: defaultChurchId });

                // Create profile in Supabase
                supabase.from('profiles').upsert(newProfile).then(() => {});
            }
        } catch (e) {
            console.warn('[AuthContext] Failed to load profile:', e?.message || e);
        }
    }, []);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            loadUserProfile(currentUser);
            setLoading(false);
            initRealtimeSync(currentUser).catch(() => {});
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            loadUserProfile(currentUser);
            setLoading(false);
            initRealtimeSync(currentUser).catch(() => {});
        });

        // Handle Capacitor In-App Deep Linking for OAuth Callback
        let deepLinkListener;
        CapApp.addListener('appUrlOpen', async (data) => {
            if (data.url && (data.url.includes('auth-callback') || data.url.includes('access_token'))) {
                const { data: sessionData } = await supabase.auth.getSession();
                if (sessionData?.session) {
                    setSession(sessionData.session);
                    setUser(sessionData.session.user);
                    loadUserProfile(sessionData.session.user);
                    initRealtimeSync(sessionData.session.user).catch(() => {});
                }
            }
        }).then(l => { deepLinkListener = l; });

        return () => {
            subscription.unsubscribe();
            if (deepLinkListener) deepLinkListener.remove();
        };
    }, [loadUserProfile]);

    // Listen for realtime role updates across tabs or from superuser elevations
    useEffect(() => {
        const handleRoleUpdated = (e) => {
            const { userId: updatedId, role: newRole } = e.detail || {};
            if (user && String(updatedId) === String(user.id)) {
                setProfile(prev => prev ? ({ ...prev, role: newRole }) : null);
            }
        };
        window.addEventListener('selah:role-updated', handleRoleUpdated);
        return () => window.removeEventListener('selah:role-updated', handleRoleUpdated);
    }, [user]);

    const getAuthRedirectUrl = (path = '/#/login') => {
        if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
            return 'com.selah.worship://auth-callback';
        }
        const origin = typeof window !== 'undefined' && window.location?.origin && !window.location.origin.includes('localhost')
            ? window.location.origin
            : 'https://jfcm-selah.vercel.app';
        return `${origin}${path}`;
    };

    const signUp = async (email, password, username, churchId = 'JFCM-Mercedes', newChurchName = null) => {
        const cleanUsername = username.trim();
        const cleanEmail = email.trim();
        const redirectUrl = getAuthRedirectUrl('/#/login');

        let finalChurchId = churchId?.trim() || 'JFCM-Mercedes';

        // If creating a brand new church tenancy
        if (newChurchName && newChurchName.trim()) {
            finalChurchId = (churchId || newChurchName.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '')) || 'Church';
            await supabase.from('churches').upsert({
                id: finalChurchId,
                name: newChurchName.trim(),
                created_at: new Date().toISOString()
            });
        }

        const isOwner = cleanEmail.toLowerCase() === SUPERUSER_EMAIL.toLowerCase();
        const assignedRole = isOwner ? ROLES.SUPERUSER : ROLES.WORSHIP_TEAM_MEMBER;

        const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: {
                    username: cleanUsername,
                    church_id: finalChurchId,
                    role: assignedRole
                },
                emailRedirectTo: redirectUrl
            },
        });
        if (error) throw error;

        // Create profile entry with church tenancy
        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                church_id: finalChurchId,
                username: cleanUsername,
                email: cleanEmail,
                role: assignedRole,
                created_at: new Date().toISOString()
            });
        }
        return data;
    };

    const signIn = async (identifier, password) => {
        let targetEmail = identifier.trim();

        // If identifier does not contain '@', look up username or full name in profiles
        if (!targetEmail.includes('@')) {
            // 1. Exact match on username or full_name
            let { data: profileRecord } = await supabase
                .from('profiles')
                .select('email')
                .or(`username.ilike.${targetEmail},full_name.ilike.${targetEmail}`)
                .maybeSingle();

            // 2. Fallback to fuzzy prefix or substring match
            if (!profileRecord?.email) {
                const { data: fuzzyRecords } = await supabase
                    .from('profiles')
                    .select('email')
                    .or(`username.ilike.%${targetEmail}%,full_name.ilike.%${targetEmail}%`)
                    .limit(2);

                if (fuzzyRecords && fuzzyRecords.length === 1) {
                    profileRecord = fuzzyRecords[0];
                }
            }

            if (profileRecord && profileRecord.email) {
                targetEmail = profileRecord.email;
            } else {
                throw new Error(`Account "${targetEmail}" not found. Please enter a valid email or username.`);
            }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password,
        });
        if (error) throw error;
        return data;
    };

    const signOut = async () => {
        try {
            await db.setlists.clear();
            await db.schedules.clear();
        } catch (e) {
            console.warn('Failed to clear local setlists & schedules on signOut:', e);
        }
        await supabase.auth.signOut();
        setProfile(null);
        setChurch(null);
        initRealtimeSync(null);
    };

    const resetPassword = async (email) => {
        const redirectUrl = getAuthRedirectUrl('/#/profile');
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        const redirectUrl = getAuthRedirectUrl('/#/library');

        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: redirectUrl,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                },
            },
        });
        if (error) throw error;
        return data;
    };

    const updateAvatar = async (avatarSeed) => {
        if (!user) return;
        const cleanSeed = (avatarSeed || 'Felix').trim();

        // Optimistically update local profile state
        setProfile(prev => ({
            ...(prev || {}),
            avatar_seed: cleanSeed
        }));

        try {
            // Update auth user metadata
            await supabase.auth.updateUser({
                data: { avatar_seed: cleanSeed }
            });

            // Update profiles table
            await supabase.from('profiles').upsert({
                id: user.id,
                avatar_seed: cleanSeed,
                email: user.email,
                username: profile?.username || user.email?.split('@')[0],
                updated_at: new Date().toISOString()
            });
        } catch (e) {
            console.error('[AuthContext] Failed to persist avatar:', e);
            throw e;
        }
    };

    /**
     * Updates only the display/profile name without altering username credentials.
     */
    const updateProfileName = async (fullName) => {
        if (!user) throw new Error('No authenticated user found.');
        const cleanName = (fullName || '').trim();
        if (!cleanName) throw new Error('Profile name cannot be empty.');

        // Optimistically update profile state
        setProfile(prev => ({
            ...(prev || {}),
            full_name: cleanName
        }));

        // 1. Update Supabase Auth user metadata
        const { data: authData, error: authErr } = await supabase.auth.updateUser({
            data: { 
                full_name: cleanName,
                display_name: cleanName
            }
        });
        if (authErr) throw authErr;
        if (authData?.user) setUser(authData.user);

        // 2. Persist to Dexie cache
        const existing = await profileDB.getById(user.id);
        if (existing) {
            await profileDB.put({ ...existing, full_name: cleanName });
        }

        // 3. Update public.profiles table (safe catch if column missing)
        try {
            await supabase.from('profiles').update({
                full_name: cleanName,
                updated_at: new Date().toISOString()
            }).eq('id', user.id);
        } catch (e) {
            // Ignore if column full_name doesn't exist yet
        }
    };

    /**
     * Updates login credentials (username handle and/or password) safely.
     */
    const updateCredentials = async ({ username: newUsername, password: newPassword }) => {
        if (!user) throw new Error('No authenticated user found.');
        const cleanUsername = (newUsername || '').trim();
        const updatePayload = {};

        if (cleanUsername) {
            if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
                throw new Error('Username can only contain letters, numbers, underscores, dots, and hyphens (no spaces).');
            }
            updatePayload.data = { username: cleanUsername };
        }

        if (newPassword) {
            if (newPassword.length < 6) {
                throw new Error('Password must be at least 6 characters.');
            }
            updatePayload.password = newPassword;
        }

        if (Object.keys(updatePayload).length > 0) {
            const { data: authData, error: authErr } = await supabase.auth.updateUser(updatePayload);
            if (authErr) throw authErr;
            if (authData?.user) setUser(authData.user);
        }

        if (cleanUsername) {
            const { error: profErr } = await supabase.from('profiles').upsert({
                id: user.id,
                username: cleanUsername,
                email: user.email,
                updated_at: new Date().toISOString()
            });
            if (profErr) throw profErr;

            setProfile(prev => ({
                ...(prev || {}),
                username: cleanUsername
            }));

            const existing = await profileDB.getById(user.id);
            if (existing) {
                await profileDB.put({ ...existing, username: cleanUsername });
            }
        }
    };

    /**
     * Superuser capability: Elevate or change RBAC role of a church member.
     */
    const updateMemberRole = async (targetUserId, newRole) => {
        if (!canManageRoles(user, profile)) {
            throw new Error('Only a Superuser can elevate or change member roles.');
        }
        const now = new Date().toISOString();
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole, updated_at: now })
            .eq('id', targetUserId);

        if (error) throw error;

        // Also update local Dexie cache
        const existing = await profileDB.getById(targetUserId);
        if (existing) {
            await profileDB.put({ ...existing, role: newRole, updatedAt: now });
        }

        // If targetUserId is the logged-in user, update in-memory profile immediately
        if (user && String(targetUserId) === String(user.id)) {
            setProfile(prev => prev ? ({ ...prev, role: newRole }) : null);
        }

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('selah:role-updated', {
                detail: { userId: targetUserId, role: newRole }
            }));
        }
    };

    /**
     * Fetch all members belonging to the current church tenancy.
     */
    const fetchChurchMembers = useCallback(async () => {
        const churchId = profile?.church_id || profile?.churchId || user?.user_metadata?.church_id || 'JFCM-Mercedes';
        let members = [];
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, email, role, avatar_seed, church_id, updated_at')
                .order('username', { ascending: true });

            if (!error && data && data.length > 0) {
                const targetChurch = (churchId || 'JFCM-Mercedes').trim().toLowerCase();
                const tenantMembers = data.filter(p => {
                    const pChurch = (p.church_id || '').trim().toLowerCase();
                    return !pChurch || pChurch === targetChurch || pChurch === 'jfcm-mercedes' || targetChurch === 'jfcm-mercedes';
                });
                members = tenantMembers.length > 0 ? tenantMembers : data;
                await profileDB.bulkPut(members);
            }
        } catch (err) {
            console.warn('[AuthContext] fetchChurchMembers network warning:', err);
        }

        // Fallback to local Dexie profiles cache if Supabase returned empty/offline
        if (members.length === 0) {
            try {
                members = await profileDB.getAll(churchId);
            } catch (e) {
                // Ignore
            }
        }

        // Ensure current authenticated user is included
        if (user && profile && !members.some(m => m.id === user.id || m.email?.toLowerCase() === user.email?.toLowerCase())) {
            members = [profile, ...members];
            await profileDB.put(profile);
        }

        return members;
    }, [user, profile]);

    const refreshProfile = () => loadUserProfile(user);

    // Permission flags memoized
    const userIsSuperuser = useMemo(() => isSuperuser(user, profile), [user, profile]);
    const userIsAdmin = useMemo(() => isAdmin(user, profile), [user, profile]);
    const userIsWorshipLeader = useMemo(() => isWorshipLeader(user, profile), [user, profile]);
    const userCanManageSchedule = useMemo(() => canManageSchedule(user, profile), [user, profile]);
    const userCanManageRoles = useMemo(() => canManageRoles(user, profile), [user, profile]);
    const userCanManageSetlists = useMemo(() => canManageSetlists(user, profile), [user, profile]);

    return (
        <AuthContext.Provider value={{
            user,
            profile,
            church,
            session,
            loading,
            // RBAC role helpers
            isSuperuser: userIsSuperuser,
            isAdmin: userIsAdmin,
            isWorshipLeader: userIsWorshipLeader,
            canManageSchedule: userCanManageSchedule,
            canManageRoles: userCanManageRoles,
            canManageSetlists: userCanManageSetlists,
            // Actions
            signUp,
            signIn,
            signOut,
            resetPassword,
            signInWithGoogle,
            refreshProfile,
            updateAvatar,
            updateProfileName,
            updateCredentials,
            updateMemberRole,
            fetchChurchMembers,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}