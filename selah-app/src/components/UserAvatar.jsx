import React from 'react';
import { getAvatarData } from '../utils/avatar';

/**
 * Offline User Avatar — renders a bundled DiceBear SVG via <img src>.
 * No dangerouslySetInnerHTML, no inline SVG payloads.
 */
export default function UserAvatar({
    seed,
    alt = 'User Avatar',
    size = 'md', // 'xs', 'sm', 'md', 'lg', 'xl', '2xl'
    className = '',
    animated = true,
    fallbackInitial = 'S',
    showRing = false,
}) {
    const sizeClasses = {
        xs: 'w-7 h-7 text-[10px]',
        sm: 'w-9 h-9 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-14 h-14 text-lg',
        xl: 'w-20 h-20 text-2xl',
        '2xl': 'w-24 h-24 sm:w-28 sm:h-28 text-3xl sm:text-4xl',
    };

    const dimensionClass = sizeClasses[size] || sizeClasses.md;
    const avatar = getAvatarData(seed || fallbackInitial);
    const fallback = fallbackInitial.charAt(0).toUpperCase();

    return (
        <div
            className={`relative rounded-full overflow-hidden shrink-0 flex items-center justify-center select-none bg-secondary ${dimensionClass} ${
                showRing ? 'ring-2 ring-accent/40 shadow-md shadow-accent/15' : ''
            } ${className}`}
            title={avatar?.label || alt}
        >
            <img
                src={avatar.file}
                alt={avatar.label || alt}
                width="96"
                height="96"
                loading="lazy"
                decoding="async"
                className={`w-full h-full object-cover ${
                    animated ? 'animate-floatSlow hover:scale-105 transition-transform' : ''
                }`}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-bold text-accent uppercase -z-10">
                {fallback}
            </span>
        </div>
    );
}
