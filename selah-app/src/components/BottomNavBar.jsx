import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { House as Home, MusicNotes as Music, CalendarBlank as Calendar, Users, User } from '@phosphor-icons/react';
import { haptic } from '../utils/haptics';
import AppLogo from './AppLogo';

export default function BottomNavBar() {
    const location = useLocation();
    const navigate = useNavigate();

    const pathname = location.pathname;

    // Hide Navigation on full-screen performance / auth routes
    const hiddenRoutes = ['/login', '/register'];
    const isHidden = hiddenRoutes.includes(pathname) || 
                     pathname.startsWith('/song/') || 
                     pathname.startsWith('/setlist-player/');

    if (isHidden) return null;

    const navItems = [
        {
            id: 'home',
            label: 'Home',
            icon: Home,
            path: '/home',
            isActive: pathname === '/' || pathname === '/home',
        },
        {
            id: 'library',
            label: 'Songs',
            icon: Music,
            path: '/library',
            isActive: pathname === '/library',
        },
        {
            id: 'setlists',
            label: 'Setlists',
            icon: Calendar,
            path: '/setlists',
            isActive: pathname === '/setlists',
        },
        {
            id: 'schedule',
            label: 'Schedule',
            icon: Users,
            path: '/schedule',
            isActive: pathname === '/schedule',
        },
        {
            id: 'profile',
            label: 'Profile',
            icon: User,
            path: '/profile',
            isActive: pathname === '/profile',
        },
    ];

    const handleSelect = (item) => {
        if (!item.isActive) {
            haptic('light');
            navigate(item.path);
        }
    };

    return (
        <>
            {/* ======================================================== */}
            {/* MOBILE BOTTOM NAVIGATION BAR (< 768px)                   */}
            {/* ======================================================== */}
            <nav 
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass border-t border-themed pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 px-3 shadow-2xl transition-all duration-300"
                role="navigation"
                aria-label="Mobile Navigation"
            >
                <div className="max-w-md mx-auto flex items-center justify-around">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = item.isActive;

                        return (
                            <button
                                key={item.id}
                                onClick={() => handleSelect(item)}
                                className="group flex flex-col items-center justify-center flex-1 py-1 px-1 relative transition-all duration-200 active:scale-95 border-0 outline-none focus:outline-none focus-visible:outline-none focus:ring-0 select-none min-h-[48px]"
                                style={{ WebkitTapHighlightColor: 'transparent' }}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                {/* Material 3 Expressive Active Indicator Pill */}
                                <div 
                                    className={`relative w-14 h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-out border-0 outline-none select-none ${
                                        active 
                                            ? 'bg-accent text-onaccent shadow-md shadow-accent/25 scale-100' 
                                            : 'bg-transparent text-textmuted hover:text-textprimary hover:bg-surface-hover scale-90'
                                    }`}
                                >
                                    <Icon 
                                        weight={active ? 'bold' : 'regular'}
                                        className={`w-5 h-5 transition-transform duration-200 ${
                                            active ? 'scale-105' : ''
                                        }`} 
                                    />
                                </div>

                                {/* Label */}
                                <span 
                                    className={`text-[10px] mt-1 tracking-tight transition-all duration-200 select-none border-0 outline-none ${
                                        active 
                                            ? 'font-bold text-accent scale-100' 
                                            : 'font-medium text-textmuted group-hover:text-textprimary scale-95'
                                    }`}
                                >
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </nav>

            {/* ======================================================== */}
            {/* TABLET / DESKTOP ADAPTIVE NAVIGATION RAIL (>= 768px)     */}
            {/* ======================================================== */}
            <aside 
                className="hidden md:flex fixed top-0 left-0 bottom-0 w-20 lg:w-60 z-40 flex-col justify-between py-6 px-3 bg-secondary/90 backdrop-blur-2xl border-r border-themed shadow-2xl select-none transition-all duration-300"
                role="navigation"
                aria-label="Desktop Navigation Rail"
            >
                {/* Brand / Logo Top */}
                <div className="space-y-6">
                    <div className="flex items-center justify-center lg:justify-start px-1">
                        <div className="hidden lg:block">
                            <AppLogo onClick={() => navigate('/home')} />
                        </div>
                        <div 
                            className="block lg:hidden cursor-pointer active:scale-95 transition-transform"
                            onClick={() => navigate('/home')}
                            title="Selah Home"
                        >
                            <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-serif font-bold text-xl shadow-sm">
                                S
                            </div>
                        </div>
                    </div>

                    {/* Nav Items List */}
                    <div className="space-y-1.5">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = item.isActive;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelect(item)}
                                    className={`w-full flex flex-col lg:flex-row items-center lg:items-center gap-1 lg:gap-3.5 py-3 px-1.5 lg:px-4 rounded-2xl transition-all duration-200 active:scale-[0.98] outline-none min-h-[50px] ${
                                        active 
                                            ? 'bg-accent/15 text-accent border border-accent/35 shadow-md shadow-accent/10 font-semibold' 
                                            : 'text-textmuted hover:text-textprimary hover:bg-surface-hover border border-transparent'
                                    }`}
                                    aria-current={active ? 'page' : undefined}
                                    title={item.label}
                                >
                                    <Icon 
                                        weight={active ? 'bold' : 'regular'}
                                        className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                                            active ? 'text-accent scale-105' : ''
                                        }`} 
                                    />
                                    <span className="text-[10px] lg:text-sm tracking-tight truncate max-w-[62px] lg:max-w-none">
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Bottom Status / Mode Pill */}
                <div className="pt-4 border-t border-themed flex flex-col items-center lg:items-start px-1.5">
                    <div className="hidden lg:flex items-center gap-2 text-xs text-textmuted">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="font-medium text-textprimary truncate">Offline Ready</span>
                    </div>
                    <div 
                        className="block lg:hidden w-2.5 h-2.5 rounded-full bg-emerald-500" 
                        title="Offline Ready" 
                    />
                </div>
            </aside>
        </>
    );
}
