import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import AppLogo from './AppLogo';
import { Library, Calendar, User, LogOut, LogIn, X, ChevronRight, Sparkles } from 'lucide-react';

export default function Sidebar({ isOpen, onClose, onOpenProfileSettings }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, signOut } = useAuth();

    const handleNav = (path) => {
        onClose();
        setTimeout(() => navigate(path), 150);
    };

    const handleSignOut = async () => {
        onClose();
        await signOut();
        navigate('/login');
    };

    const isLibraryActive = location.pathname === '/library' || location.pathname.startsWith('/song/');
    const isSetlistActive = location.pathname === '/setlists' || location.pathname.startsWith('/setlist-player/');

    return (
        <div className={`fixed inset-0 z-50 ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Backdrop Blur Overlay with Smooth Fade */}
            <div
                className={`fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ease-out ${
                    isOpen ? 'opacity-100' : 'opacity-0'
                }`}
                onClick={onClose}
            />

            {/* Sidebar Content Drawer with Smooth Slide-in / Slide-out */}
            <div
                className={`fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] h-full bg-elevated border-r border-white/10 flex flex-col justify-between p-5 shadow-2xl z-10 transform-gpu transition-transform duration-300 cubic-bezier(0.16,1,0.3,1) ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                {/* Top Section */}
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between pt-4 pb-2 border-b border-white/10">
                        <AppLogo size="md" showText={true} />
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-textmuted hover:text-white hover:bg-white/5 active:scale-95 transition"
                            title="Close Sidebar"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation Links */}
                    <nav className="space-y-2">
                        <p className="text-[10px] font-bold text-textmuted tracking-widest uppercase px-3 mb-2">
                            Menu Navigation
                        </p>

                        {/* Song Library */}
                        <button
                            onClick={() => handleNav('/library')}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all min-h-[48px] ${
                                isLibraryActive
                                    ? 'bg-accent text-primary font-bold shadow-lg shadow-accent/20'
                                    : 'text-textprimary hover:bg-white/5 active:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Library className="w-5 h-5" />
                                <span>Song Library</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 opacity-60 ${isLibraryActive ? 'text-primary' : 'text-textmuted'}`} />
                        </button>

                        {/* Song Lineup */}
                        <button
                            onClick={() => handleNav('/setlists')}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-sm font-semibold transition-all min-h-[48px] ${
                                isSetlistActive
                                    ? 'bg-accent text-primary font-bold shadow-lg shadow-accent/20'
                                    : 'text-textprimary hover:bg-white/5 active:bg-white/10'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5" />
                                <span>Song Lineup</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 opacity-60 ${isSetlistActive ? 'text-primary' : 'text-textmuted'}`} />
                        </button>
                    </nav>
                </div>

                {/* Bottom Section */}
                <div className="space-y-3 pt-6 border-t border-white/10">
                    <p className="text-[10px] font-bold text-textmuted tracking-widest uppercase px-3">
                        Account & App
                    </p>

                    {/* Profile Settings Entry */}
                    <button
                        onClick={() => {
                            onClose();
                            onOpenProfileSettings();
                        }}
                        className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-secondary/70 border border-white/10 hover:border-accent text-textprimary hover:text-white transition-all min-h-[48px] active:scale-98"
                    >
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-accent" />
                            <div className="text-left">
                                <p className="text-xs font-bold leading-tight">Profile Settings</p>
                                {user?.email && (
                                    <p className="text-[10px] text-textmuted truncate max-w-[140px]">
                                        {user.email}
                                    </p>
                                )}
                            </div>
                        </div>
                        <Sparkles className="w-4 h-4 text-accent" />
                    </button>

                    {/* Logout / Login Button */}
                    {user ? (
                        <button
                            onClick={handleSignOut}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-danger/10 border border-danger/20 text-danger hover:bg-danger/20 active:scale-98 text-xs font-bold transition-all min-h-[48px]"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Sign Out ({user.user_metadata?.username || user.email?.split('@')[0]})</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => handleNav('/login')}
                            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 active:scale-98 text-xs font-bold transition-all min-h-[48px]"
                        >
                            <LogIn className="w-5 h-5" />
                            <span>Sign In / Register</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
