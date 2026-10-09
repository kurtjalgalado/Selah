import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../supabase/client';
import AppLogo from '../components/AppLogo';
import { EnvelopeSimple as Mail, Lock, Eye, EyeSlash as EyeOff, ArrowLeft, Key as KeyRound, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle, resetPassword } = useAuth();

    // Standard Login form
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Forgot password state
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmailOrUser, setResetEmailOrUser] = useState('');
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState('');
    const [resetError, setResetError] = useState('');

    // Handle Standard Sign In
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signIn(identifier, password);
            navigate('/library');
        } catch (err) {
            const msg = err.message || 'Failed to sign in';
            if (msg.includes('Invalid login credentials')) {
                setError('Invalid email/username or password. Initial default password for migrated worship team accounts is "Selah2026!" or tap "Forgot password" below.');
            } else if (msg.includes('Email not confirmed')) {
                setError('Email not confirmed. Please execute the updated Supabase SQL schema in your Supabase SQL Editor to auto-confirm accounts.');
            } else {
                setError(msg);
            }
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
                setError('Google Auth is disabled in Supabase Dashboard. Use Email sign-in.');
            } else {
                setError(msg || 'Google sign in failed');
            }
        }
    };

    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setResetError('');
        setResetSuccess('');
        setResetLoading(true);

        try {
            let targetEmail = resetEmailOrUser.trim();
            if (!targetEmail) {
                throw new Error('Please enter your email or username');
            }

            // If identifier does not contain '@', look up email in profiles table
            if (!targetEmail.includes('@')) {
                let { data: prof } = await supabase
                    .from('profiles')
                    .select('email')
                    .or(`username.ilike.${targetEmail},full_name.ilike.${targetEmail}`)
                    .maybeSingle();

                if (!prof?.email) {
                    const { data: fuzzy } = await supabase
                        .from('profiles')
                        .select('email')
                        .or(`username.ilike.%${targetEmail}%,full_name.ilike.%${targetEmail}%`)
                        .limit(2);
                    if (fuzzy && fuzzy.length === 1) prof = fuzzy[0];
                }

                if (prof?.email) {
                    targetEmail = prof.email;
                } else {
                    throw new Error(`Account "${targetEmail}" not found. Please enter your email address.`);
                }
            }

            await resetPassword(targetEmail);
            setResetSuccess(`Password reset instructions sent to ${targetEmail}. Please check your inbox.`);
        } catch (err) {
            setResetError(err.message || 'Failed to send password reset email.');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6 py-12 animate-fadeIn">
            {/* Main App Logo Header */}
            <div className="mb-10 text-center">
                <AppLogo size="xl" showText={true} textClassName="text-4xl" />
            </div>

            {/* Login / Reset Card */}
            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-3xl border border-themed p-7 shadow-2xl space-y-5">
                    {!showForgotPassword ? (
                        <>
                            <h2 className="text-xl font-bold text-textprimary text-center">
                                Welcome Back
                            </h2>

                            {error && (
                                <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-medium animate-fadeIn leading-relaxed">
                                    {error}
                                </div>
                            )}

                            {/* STANDARD LOGIN FORM */}
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
                                            className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary"
                                            required
                                        />
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="block text-xs font-medium text-textmuted">Password</label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowForgotPassword(true);
                                                setResetEmailOrUser(identifier);
                                                setResetError('');
                                                setResetSuccess('');
                                            }}
                                            className="text-[11px] text-accent hover:underline font-semibold"
                                        >
                                            Forgot password?
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary"
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-textmuted hover:text-textprimary"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-accent text-onaccent font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20 cursor-pointer"
                                >
                                    {loading ? 'Signing in...' : 'Sign In'}
                                </button>
                            </form>

                            <p className="text-center text-xs text-textmuted pt-2 border-t border-themed">
                                Don't have an account?{' '}
                                <button onClick={() => navigate('/register')} className="text-accent font-bold hover:underline cursor-pointer">
                                    Sign up
                                </button>
                            </p>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={() => setShowForgotPassword(false)}
                                    className="p-1.5 rounded-lg hover:bg-secondary text-textmuted hover:text-textprimary transition-colors cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                </button>
                                <h2 className="text-lg font-bold text-textprimary">
                                    Reset Password
                                </h2>
                            </div>

                            <p className="text-xs text-textmuted leading-relaxed">
                                Enter your registered username or email to receive a password reset link.
                            </p>

                            {resetError && (
                                <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-medium animate-fadeIn">
                                    {resetError}
                                </div>
                            )}

                            {resetSuccess && (
                                <div className="p-3.5 bg-success/10 border border-success/30 rounded-xl text-success text-xs font-medium flex items-start space-x-2.5 animate-fadeIn">
                                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                    <span>{resetSuccess}</span>
                                </div>
                            )}

                            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-textmuted mb-1.5">Username or Email</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                        <input
                                            type="text"
                                            value={resetEmailOrUser}
                                            onChange={(e) => setResetEmailOrUser(e.target.value)}
                                            placeholder="username or email@church.com"
                                            className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={resetLoading}
                                    className="w-full bg-accent text-onaccent font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20 flex items-center justify-center space-x-2 cursor-pointer"
                                >
                                    <KeyRound className="w-4 h-4" />
                                    <span>{resetLoading ? 'Sending...' : 'Send Reset Link'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setShowForgotPassword(false)}
                                    className="w-full text-xs text-textmuted hover:text-textprimary text-center py-2 transition-colors cursor-pointer"
                                >
                                    Back to Sign In
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}