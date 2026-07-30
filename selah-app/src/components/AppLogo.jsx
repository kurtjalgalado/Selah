import React from 'react';
import { Music } from 'lucide-react';

export default function AppLogo({ size = 'md', showText = false, textClassName = '', onClick }) {
    const sizeClasses = {
        sm: 'w-8 h-8 rounded-lg',
        md: 'w-10 h-10 rounded-xl',
        lg: 'w-16 h-16 rounded-2xl',
        xl: 'w-20 h-20 rounded-2xl',
    };

    const iconSizes = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-10 h-10',
    };

    return (
        <div
            className={`flex items-center gap-3 inline-flex ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
            onClick={onClick}
        >
            <div className={`${sizeClasses[size] || sizeClasses.md} flex items-center justify-center shrink-0 overflow-hidden`}>
                <img
                    src="/icon.png"
                    alt="Selah Logo"
                    className="w-full h-full object-cover rounded-xl"
                    onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'block';
                    }}
                />
                <Music className={`${iconSizes[size] || iconSizes.md} text-accent hidden`} strokeWidth={2.5} />
            </div>
            {showText && (
                <div>
                    <h1 className={`font-serif font-bold text-accent leading-none ${textClassName || 'text-2xl'}`}>Selah</h1>
                    <p className="text-[10px] text-textmuted tracking-widest uppercase mt-0.5">Worship Planner</p>
                </div>
            )}
        </div>
    );
}
