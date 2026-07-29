import { useState, useRef, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const touchStartY = useRef(0);
    const isPulling = useRef(false);

    const THRESHOLD = 65;

    const handleTouchStart = (e) => {
        if (window.scrollY === 0) {
            touchStartY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    };

    const handleTouchMove = (e) => {
        if (!isPulling.current || isRefreshing) return;
        const currentY = e.touches[0].clientY;
        const deltaY = currentY - touchStartY.current;

        if (deltaY > 0 && window.scrollY === 0) {
            // Apply rubber-band resistance damping
            const dist = Math.min(deltaY * 0.45, 90);
            setPullDistance(dist);
        } else {
            setPullDistance(0);
        }
    };

    const handleTouchEnd = async () => {
        if (!isPulling.current || isRefreshing) return;
        isPulling.current = false;

        if (pullDistance >= THRESHOLD) {
            setIsRefreshing(true);
            setPullDistance(THRESHOLD);
            try {
                if (onRefresh) await onRefresh();
            } finally {
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }, 600);
            }
        } else {
            setPullDistance(0);
        }
    };

    return (
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="relative min-h-screen"
        >
            {/* Pull to Refresh Header Indicator */}
            <div
                className="w-full flex items-center justify-center transition-all duration-200 overflow-hidden pointer-events-none"
                style={{
                    height: `${pullDistance}px`,
                    opacity: pullDistance > 10 ? 1 : 0
                }}
            >
                <div className="flex items-center gap-2 text-xs font-bold text-accent bg-elevated/90 px-4 py-2 rounded-full border border-white/10 shadow-lg">
                    <RefreshCw
                        className={`w-4 h-4 text-accent transition-transform ${
                            isRefreshing ? 'animate-spin' : ''
                        }`}
                        style={{
                            transform: isRefreshing ? undefined : `rotate(${pullDistance * 3}deg)`
                        }}
                    />
                    <span>
                        {isRefreshing
                            ? 'Syncing with cloud...'
                            : pullDistance >= THRESHOLD
                            ? 'Release to sync'
                            : 'Pull to refresh'}
                    </span>
                </div>
            </div>

            {/* Main Content */}
            <div
                className="transition-transform duration-200"
                style={{
                    transform: isRefreshing ? `translateY(${THRESHOLD / 2}px)` : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
}
