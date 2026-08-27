import { createContext, useContext, useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { supabase } from '../supabase/client';
import { initRealtimeSync } from '../supabase/sync';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
            setLoading(false);
            initRealtimeSync(currentUser).catch(() => {});
        });

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            const currentUser = session?.user ?? null;
            setUser(currentUser);
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
                    initRealtimeSync(sessionData.session.user).catch(() => {});
                }
            }
        }).then(l => { deepLinkListener = l; });

        return () => {
            subscription.unsubscribe();
            if (deepLinkListener) deepLinkListener.remove();
        };
    }, []);

    const signUp = async (email, password, username) => {
        const cleanUsername = username.trim();
        const cleanEmail = email.trim();
        const isNative = window.Capacitor?.isNativePlatform?.();
        const redirectUrl = isNative
            ? 'com.selah.worship://auth-callback'
            : `${window.location.origin}/#/login`;

        const { data, error } = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
                data: { username: cleanUsername },
                emailRedirectTo: redirectUrl
            },
        });
        if (error) throw error;

        // Create profile entry with username and email
        if (data.user) {
            await supabase.from('profiles').upsert({
                id: data.user.id,
                username: cleanUsername,
                email: cleanEmail,
                role: 'worship_leader',
                created_at: new Date().toISOString()
            });
        }
        return data;
    };

    const signIn = async (identifier, password) => {
        let targetEmail = identifier.trim();

        // If identifier does not contain '@', look up username in profiles
        if (!targetEmail.includes('@')) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('email')
                .ilike('username', targetEmail)
                .maybeSingle();

            if (profile && profile.email) {
                targetEmail = profile.email;
            } else {
                throw new Error('Username not found. Please enter a valid username or email.');
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
        await supabase.auth.signOut();
        initRealtimeSync(null);
    };

    const resetPassword = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
    };

    const signInWithGoogle = async () => {
        const isNative = window.Capacitor?.isNativePlatform?.();
        const redirectUrl = isNative
            ? 'com.selah.worship://auth-callback'
            : `${window.location.origin}/#/library`;

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

    return (
        <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPassword, signInWithGoogle }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}