import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Mail, Lock, User, Music } from 'lucide-react';

export default function RegisterScreen() {
    const navigate = useNavigate();
    const { signUp, signInWithGoogle } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleSignIn = async () => {
        setError('');
        try {
            await signInWithGoogle();
        } catch (err) {
            const msg = err.message || '';
            if (msg.includes('provider is not enabled') || msg.includes('validation_failed')) {
                setError('Google Auth is disabled in your Supabase Dashboard. Enable "Google" under Auth -> Providers in Supabase, or create account with Email below.');
            } else {
                setError(msg || 'Google sign up failed');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            await signUp(email, password, username);
            navigate('/library');
        } catch (err) {
            setError(err.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6">
            <div className="mb-8 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-accent to-yellow-300 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-accent/30">
                    <Music className="w-10 h-10 text-primary" strokeWidth={2} />
                </div>
                <h1 className="text-4xl font-serif font-bold text-accent tracking-wide">Selah</h1>
            </div>

            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-2xl border border-white/5 p-6 shadow-2xl">
                    <h2 className="text-xl font-bold mb-6">Create Account</h2>

                    {error && (
                        <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Name</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textmuted" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Jordan Matthews"
                                    className="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textmuted" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@church.com"
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
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    className="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent text-primary font-bold py-3 rounded-xl glow-accent disabled:opacity-50"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-textmuted mt-6">
                        Already have an account?{' '}
                        <button onClick={() => navigate('/login')} className="text-accent font-medium">
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}