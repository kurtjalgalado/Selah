import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppLogo from '../components/AppLogo';
import { Mail, Lock, User } from 'lucide-react';

export default function RegisterScreen() {
    const navigate = useNavigate();
    const { signUp, signInWithGoogle } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

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
        <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-6 py-12 animate-fadeIn">
            <div className="mb-10 text-center">
                <AppLogo size="xl" showText={true} textClassName="text-4xl" />
            </div>

            <div className="w-full max-w-sm">
                <div className="bg-elevated rounded-3xl border border-white/10 p-7 shadow-2xl space-y-4">
                    <h2 className="text-xl font-bold text-white text-center">Create Worship Leader Account</h2>

                    {error && (
                        <div className="p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-xs font-medium">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Username / Name</label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Jordan Matthews"
                                    className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-white"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@church.com"
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
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                    className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-white"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent text-primary font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20"
                        >
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-textmuted pt-2 border-t border-white/5">
                        Already have an account?{' '}
                        <button onClick={() => navigate('/login')} className="text-accent font-bold hover:underline">
                            Sign in
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}