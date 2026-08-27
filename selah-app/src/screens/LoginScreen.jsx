import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppLogo from '../components/AppLogo';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle } = useAuth();

    // Standard Login form
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6 py-12 animate-fadeIn">
            {/* Main App Logo Header */}
            <div className="mb-10 text-center">
                <AppLogo size="xl" showText={true} textClassName="text-4xl" />
            </div>

            {/* Login Card */}
            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-3xl border border-themed p-7 shadow-2xl space-y-5">
                    <h2 className="text-xl font-bold text-textprimary text-center">
                        Welcome Back
                    </h2>

                    {error && (
                        <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-medium animate-fadeIn">
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
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Password</label>
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
                            className="w-full bg-accent text-onaccent font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-textmuted pt-2 border-t border-themed">
                        Don't have an account?{' '}
                        <button onClick={() => navigate('/register')} className="text-accent font-bold hover:underline">
                            Sign up
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}