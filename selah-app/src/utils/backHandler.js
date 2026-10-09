import { useEffect } from 'react';

// Simple LIFO stack of back handlers
const backHandlers = [];

/**
 * Register a back button handler. Returns unregister function.
 * When hardware/gesture back is pressed, the topmost handler executes.
 */
export function pushBackHandler(handler) {
    backHandlers.push(handler);
    return () => {
        const idx = backHandlers.lastIndexOf(handler);
        if (idx !== -1) {
            backHandlers.splice(idx, 1);
        }
    };
}

/**
 * Execute topmost back handler if one exists.
 * Returns true if handled, false if stack is empty.
 */
export function handleBack() {
    if (backHandlers.length > 0) {
        const handler = backHandlers[backHandlers.length - 1];
        const res = handler();
        return res !== false;
    }
    return false;
}

/**
 * Get count of currently open modals/handlers
 */
export function getBackHandlerCount() {
    return backHandlers.length;
}

/**
 * React hook to register a modal or bottom sheet with the back button stack.
 */
export function useBackHandler(isOpen, onClose) {
    useEffect(() => {
        if (!isOpen || typeof onClose !== 'function') return;
        return pushBackHandler(() => {
            onClose();
            return true;
        });
    }, [isOpen, onClose]);
}
