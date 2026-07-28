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
            setError(err.message || 'Google sign up failed');
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

                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        className="w-full bg-secondary border border-white/10 hover:border-accent text-white font-medium py-3 rounded-xl flex items-center justify-center gap-3 transition-colors mb-4 text-sm"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
                            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 10.8 0 12.5s.7 2.8 1.9 5.2l3.7-2.9z"/>
                            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
                        </svg>
                        Continue with Google
                    </button>

                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="text-xs text-textmuted uppercase tracking-wider">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

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