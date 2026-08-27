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
            {/* Pull to Refresh Indicator — fixed overlay below header */}
            {(pullDistance > 0 || isRefreshing) && (
                <div
                    className="fixed left-0 right-0 flex justify-center pointer-events-none transition-all duration-200"
                    style={{
                        top: '80px',
                        zIndex: 50,
                        opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
                        transform: `translateY(${Math.min(pullDistance, THRESHOLD) * 0.5}px)`
                    }}
                >
                    <div className="flex items-center gap-2 text-xs font-bold text-accent bg-elevated px-4 py-2 rounded-full border border-themed shadow-lg backdrop-blur-sm">
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
            )}

            {/* Main Content — no transform, renders normally */}
            {children}
        </div>
    );
}
