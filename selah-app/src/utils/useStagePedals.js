import { useEffect } from 'react';

/**
 * Stage Foot Pedal & Keyboard Controller Hook
 * Listens for standard Bluetooth pedal keystrokes (AirTurn, Donner, PageFlip)
 * and hardware keyboard events for hands-free live stage performance navigation.
 */
export function useStagePedals({
    onNext,
    onPrev,
    onTogglePlay,
    onScrollDown,
    onScrollUp,
    onToggleStageMode,
    enabled = true,
}) {
    useEffect(() => {
        if (!enabled) return;

        const handleKeyDown = (e) => {
            // Ignore if active element is a form input or modal textarea
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) || e.target?.isContentEditable) {
                return;
            }

            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault();
                onTogglePlay?.();
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                onNext?.();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                onPrev?.();
            } else if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowDown')) {
                e.preventDefault();
                if (onScrollDown) onScrollDown();
                else window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' });
            } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowUp')) {
                e.preventDefault();
                if (onScrollUp) onScrollUp();
                else window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' });
            } else if (e.key === 'f' || e.key === 'F') {
                onToggleStageMode?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, onNext, onPrev, onTogglePlay, onScrollDown, onScrollUp, onToggleStageMode]);
}
