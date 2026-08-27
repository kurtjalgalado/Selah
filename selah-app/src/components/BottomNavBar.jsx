import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Music, Calendar, User } from 'lucide-react';
import { haptic } from '../utils/haptics';

export default function BottomNavBar() {
    const location = useLocation();
    const navigate = useNavigate();

    const pathname = location.pathname;

    // Hide Bottom Nav on full-screen performance / auth routes
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
            label: 'Song List',
            icon: Music,
            path: '/library',
            isActive: pathname === '/library',
        },
        {
            id: 'setlists',
            label: 'Lineup',
            icon: Calendar,
            path: '/setlists',
            isActive: pathname === '/setlists',
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
        <nav 
            className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-themed pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 px-3 shadow-2xl transition-all duration-300"
            role="navigation"
            aria-label="Main Navigation"
        >
            <div className="max-w-md mx-auto flex items-center justify-around">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = item.isActive;

                    return (
                        <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className="group flex flex-col items-center justify-center flex-1 py-1 px-1 relative transition-all duration-200 active:scale-95 focus:outline-none min-h-[48px]"
                        >
                            {/* Material 3 Expressive Active Indicator Pill */}
                            <div 
                                className={`relative w-14 h-8 rounded-full flex items-center justify-center transition-all duration-300 ease-out ${
                                    active 
                                        ? 'bg-accent text-onaccent shadow-md shadow-accent/25 scale-100' 
                                        : 'bg-transparent text-textmuted hover:text-textprimary hover:bg-surface-hover scale-90'
                                }`}
                            >
                                <Icon 
                                    className={`w-5 h-5 transition-transform duration-200 ${
                                        active ? 'scale-105 stroke-[2.4]' : 'stroke-[1.8]'
                                    }`} 
                                />
                            </div>

                            {/* Label */}
                            <span 
                                className={`text-[10px] mt-1 tracking-tight transition-all duration-200 select-none ${
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
    );
}
