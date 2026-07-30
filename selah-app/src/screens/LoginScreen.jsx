import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabase/client';
import AppLogo from '../components/AppLogo';
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowRight, ShieldCheck } from 'lucide-react';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle, user } = useAuth();

    // Mode state: 'standard' or 'pin'
    const [loginMode, setLoginMode] = useState('standard');

    // Standard Login form
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Quick PIN Login form
    const [pin, setPin] = useState('');
    const [hasPinConfigured, setHasPinConfigured] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Check if user already has a Quick PIN configured on device or account
    useEffect(() => {
        const localGuestPin = localStorage.getItem('selah_guest_pin');
        let foundPin = !!localGuestPin;

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('selah_pin_')) {
                foundPin = true;
                break;
            }
        }

        if (foundPin) {
            setHasPinConfigured(true);
            setLoginMode('pin');
        }
    }, []);

    // Handle Standard Sign In
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(identifier, password);
            navigate('/library');
        } catch (err) {
            setError(err.message || 'Failed to sign in');
        } finally {
            setLoading(false);
        }
    };

    // Handle Quick PIN Login
    const handlePinSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (pin.length !== 4) {
            setError('Please enter your 4-digit Quick PIN');
            return;
        }

        setLoading(true);
        try {
            let valid = false;

            // 1. Check local guest PIN
            const guestPin = localStorage.getItem('selah_guest_pin');
            if (guestPin && guestPin === pin) {
                valid = true;
            }

            // 2. Check stored local user PINs
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('selah_pin_')) {
                    const storedPin = localStorage.getItem(key);
                    if (storedPin === pin) {
                        valid = true;
                        break;
                    }
                }
            }

            // 3. Check Supabase profile PIN if online
            if (!valid) {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, quick_pin')
                        .eq('quick_pin', pin)
                        .maybeSingle();

                    if (profile && profile.quick_pin === pin) {
                        valid = true;
                    }
                } catch (e) {
                    // Ignore column missing error on remote schema
                }
            }

            if (valid) {
                navigate('/library');
            } else {
                setError('Invalid Quick PIN. Try again or switch to standard password sign-in.');
            }
        } catch (err) {
            setError('PIN verification failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
                setError('Google Auth is disabled in Supabase Dashboard. Use Email or Offline Mode.');
            } else {
                setError(msg || 'Google sign in failed');
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6 py-12 animate-fadeIn">
            {/* Main App Logo Header */}
            <div className="mb-10 text-center">
                <AppLogo size="xl" showText={true} textClassName="text-4xl" />
            </div>

            {/* Login Card */}
            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-3xl border border-white/10 p-7 shadow-2xl space-y-5">
                    {/* Toggle Standard vs Quick PIN Login if PIN exists */}
                    {hasPinConfigured && (
                        <div className="flex bg-secondary p-1 rounded-xl border border-white/5">
                            <button
                                type="button"
                                onClick={() => { setLoginMode('pin'); setError(''); }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                                    loginMode === 'pin' ? 'bg-accent text-primary shadow-sm' : 'text-textmuted hover:text-white'
                                }`}
                            >
                                <KeyRound className="w-3.5 h-3.5" /> Quick PIN
                            </button>
                            <button
                                type="button"
                                onClick={() => { setLoginMode('standard'); setError(''); }}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${
                                    loginMode === 'standard' ? 'bg-accent text-primary shadow-sm' : 'text-textmuted hover:text-white'
                                }`}
                            >
                                <Lock className="w-3.5 h-3.5" /> Password
                            </button>
                        </div>
                    )}

                    <h2 className="text-xl font-bold text-white text-center">
                        {loginMode === 'pin' ? 'Quick PIN Sign-In' : 'Welcome Back'}
                    </h2>

                    {error && (
                        <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-medium animate-fadeIn">
                            {error}
                        </div>
                    )}

                    {/* QUICK PIN FORM */}
                    {loginMode === 'pin' ? (
                        <form onSubmit={handlePinSubmit} className="space-y-5">
                            <div className="text-center space-y-2">
                                <p className="text-xs text-textmuted">Enter your 4-digit security PIN</p>
                                <div className="relative max-w-[200px] mx-auto">
                                    <input
                                        type="password"
                                        maxLength={4}
                                        pattern="\d{4}"
                                        autoFocus
                                        value={pin}
                                        onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                        placeholder="••••"
                                        className="w-full bg-secondary border border-white/10 rounded-2xl py-3 text-center font-mono text-2xl tracking-[0.5em] text-accent focus:outline-none focus:border-accent"
                                        required
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || pin.length !== 4}
                                className="w-full bg-accent text-primary font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                            >
                                <span>{loading ? 'Verifying...' : 'Sign In with PIN'}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>

                            <button
                                type="button"
                                onClick={() => setLoginMode('standard')}
                                className="w-full text-xs text-textmuted hover:text-accent transition text-center block"
                            >
                                Use Password Sign-In instead
                            </button>
                        </form>
                    ) : (
                        /* STANDARD FORM */
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-textmuted mb-1.5">Username or Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                    <input
                                        type="text"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        placeholder="username or email@church.com"
                                        className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-textmuted mb-1.5">Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-white"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textmuted hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent text-primary font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20"
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    )}

                    <p className="text-center text-xs text-textmuted pt-2 border-t border-white/5">
                        Don't have an account?{' '}
                        <button onClick={() => navigate('/register')} className="text-accent font-bold hover:underline">
                            Sign up
                        </button>
                    </p>
                </div>

                <div className="text-center mt-6">
                    <button
                        onClick={() => navigate('/library')}
                        className="text-xs text-textmuted hover:text-accent transition-colors"
                    >
                        Continue Offline →
                    </button>
                </div>
            </div>
        </div>
    );
}