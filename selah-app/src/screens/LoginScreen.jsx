import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Mail, Lock, Eye, EyeOff, Music } from 'lucide-react';

export default function LoginScreen() {
    const navigate = useNavigate();
    const { signIn, signInWithGoogle } = useAuth();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
                setError('Google Auth is disabled in your Supabase Dashboard. Enable "Google" under Auth -> Providers in Supabase, or sign in with Email / Offline Mode.');
            } else {
                setError(msg || 'Google sign in failed');
            }
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6">
            {/* Logo */}
            <div className="mb-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-accent to-yellow-300 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
                    <Music className="w-10 h-10 text-primary" strokeWidth={2} />
                </div>
                <h1 className="text-4xl font-serif font-bold text-accent tracking-wide">Selah</h1>
                <p className="text-textmuted text-sm mt-1 tracking-widest uppercase">Worship Planner</p>
            </div>

            {/* Form Card */}
            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-2xl border border-white/5 p-6 shadow-2xl">
                    <h2 className="text-xl font-bold mb-6">Welcome Back</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Username or Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textmuted" />
                                <input
                                    type="text"
                                    value={identifier}
                                    onChange={(e) => setIdentifier(e.target.value)}
                                    placeholder="username or email@church.com"
                                    className="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textmuted" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-10 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-textmuted"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent text-primary font-bold py-3 rounded-xl glow-accent disabled:opacity-50"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-textmuted mt-6">
                        Don't have an account?{' '}
                        <button onClick={() => navigate('/register')} className="text-accent font-medium">
                            Sign up
                        </button>
                    </p>
                </div>

                <p className="text-center text-xs text-textmuted mt-6">
                    Skip login to use offline mode
                </p>
                <button
                    onClick={() => navigate('/library')}
                    className="block mx-auto mt-2 text-sm text-accent/70 hover:text-accent transition-colors"
                >
                    Continue Offline →
                </button>
            </div>
        </div>
    );
}