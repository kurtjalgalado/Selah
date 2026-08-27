import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppLogo from '../components/AppLogo';
import { Mail, Lock, User } from 'lucide-react';

export default function RegisterScreen() {
    const navigate = useNavigate();
    const { signUp } = useAuth();
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmationSent, setConfirmationSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        try {
            const data = await signUp(email, password, username);
            if (data?.session) {
                navigate('/library');
            } else {
                setConfirmationSent(true);
            }
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
                <div className="bg-elevated rounded-3xl border border-themed p-7 shadow-2xl space-y-4">
                    {confirmationSent ? (
                        <div className="text-center py-4 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center mx-auto shadow-lg shadow-accent/20 glow-accent">
                                <Mail className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-textprimary">Confirm Your Email</h3>
                                <p className="text-xs text-textmuted leading-relaxed mt-2">
                                    We sent a verification link to <span className="text-accent font-semibold">{email}</span>. Please check your inbox and click the link to confirm your account.
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full bg-accent text-onaccent font-bold py-3 rounded-xl glow-accent shadow-lg shadow-accent/20 transition active:scale-95 text-xs"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-textprimary text-center">Create Worship Leader Account</h2>

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
                                            className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary"
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
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Min. 6 characters"
                                            className="w-full bg-secondary border border-themed rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary"
                                            required
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-accent text-onaccent font-bold py-3.5 rounded-xl glow-accent disabled:opacity-50 transition shadow-lg shadow-accent/20"
                                >
                                    {loading ? 'Creating account...' : 'Create Account'}
                                </button>
                            </form>

                            <p className="text-center text-xs text-textmuted pt-2 border-t border-themed">
                                Already have an account?{' '}
                                <button onClick={() => navigate('/login')} className="text-accent font-bold hover:underline">
                                    Sign in
                                </button>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}