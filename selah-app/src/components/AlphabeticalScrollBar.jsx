import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '../utils/haptics';

const DEFAULT_ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'];
const MAGNIFICATION_CURVE = [1, 0.75, 0.5, 0.25, 0];

export default function AlphabeticalScrollBar({
    alphabet = DEFAULT_ALPHABET,
    validLetters = new Set(),
    onLetterChange,
    magnificationMultiplier = 1.75,
    letterMagnification = true,
    overflowDivider = '·',
    topOffset = 154,
    bottomOffset = 88,
}) {
    const [isInteracting, setIsInteracting] = useState(false);
    const [activeIndex, setActiveIndex] = useState(null);
    const [bubbleY, setBubbleY] = useState(0);
    const [viewportHeight, setViewportHeight] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
    const [mounted, setMounted] = useState(false);

    const containerRef = useRef(null);
    const lastLetterRef = useRef(null);
    const hideTimerRef = useRef(null);

    useEffect(() => {
        setMounted(true);
        const handleResize = () => {
            setViewportHeight(window.innerHeight);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Condense list with overflow dividers only if viewport is extremely short (< 400px)
    const displayList = useMemo(() => {
        const availableHeight = viewportHeight - (topOffset + bottomOffset + 24);
        const requiredMinHeight = alphabet.length * 14; // 14px absolute min per letter

        if (availableHeight < requiredMinHeight && overflowDivider) {
            const step = availableHeight < 320 ? 3 : 2;
            const condensed = [];
            for (let i = 0; i < alphabet.length; i++) {
                if (i % step === 0 || i === alphabet.length - 1) {
                    condensed.push({ letter: alphabet[i], isDivider: false, originalIndex: i });
                } else if (condensed.length > 0 && !condensed[condensed.length - 1].isDivider) {
                    condensed.push({ letter: overflowDivider, isDivider: true, originalIndex: i });
                }
            }
            return condensed;
        }

        return alphabet.map((letter, idx) => ({
            letter,
            isDivider: false,
            originalIndex: idx,
        }));
    }, [alphabet, viewportHeight, overflowDivider]);

    // Handle coordinates with smooth letter interpolation
    const handleCoordinate = useCallback((clientY) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        const clampedY = Math.max(0, Math.min(rect.height, relativeY));
        const ratio = clampedY / (rect.height || 1);

        const fullIndex = Math.min(alphabet.length - 1, Math.max(0, Math.floor(ratio * alphabet.length)));
        const targetLetter = alphabet[fullIndex];

        setActiveIndex(fullIndex);
        setBubbleY(clampedY);

        if (targetLetter !== lastLetterRef.current) {
            lastLetterRef.current = targetLetter;
            haptic('light');
            if (onLetterChange) {
                onLetterChange(targetLetter);
            }
        }
    }, [alphabet, onLetterChange]);

    const handlePointerDown = (e) => {
        clearTimeout(hideTimerRef.current);
        setIsInteracting(true);
        try { containerRef.current?.setPointerCapture?.(e.pointerId); } catch {}
        handleCoordinate(e.clientY);
    };

    const handlePointerMove = (e) => {
        if (!isInteracting) return;
        e.preventDefault();
        handleCoordinate(e.clientY);
    };

    const handlePointerUp = (e) => {
        setIsInteracting(false);
        try { containerRef.current?.releasePointerCapture?.(e.pointerId); } catch {}

        hideTimerRef.current = setTimeout(() => {
            setActiveIndex(null);
            lastLetterRef.current = null;
        }, 500);
    };

    useEffect(() => {
        return () => clearTimeout(hideTimerRef.current);
    }, []);

    if (!mounted || typeof document === 'undefined') return null;

    const activeLetter = activeIndex !== null ? alphabet[activeIndex] : null;

    const scrollbarContent = (
        <aside
            className="fixed right-0 sm:right-1.5 z-40 flex items-center select-none pointer-events-auto touch-none transition-all duration-300 ease-out"
            style={{
                top: `calc(${topOffset}px + env(safe-area-inset-top, 0px))`,
                bottom: `calc(${bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
            }}
            aria-label="Alphabetical fast scroll bar"
        >
            {/* Magnifier Letter Bubble */}
            {(isInteracting || activeIndex !== null) && activeLetter && (
                <div
                    className="absolute right-10 sm:right-12 -translate-y-1/2 flex items-center justify-center pointer-events-none transition-all duration-75 ease-out animate-fadeIn"
                    style={{ top: `${bubbleY}px` }}
                >
                    <div className="w-11 h-11 rounded-2xl bg-accent text-onaccent flex items-center justify-center font-bold text-lg shadow-2xl shadow-black/80 border border-accent/30">
                        {activeLetter}
                    </div>
                </div>
            )}

            {/* Scroll Bar Track Container (100% Transparent, No Background) */}
            <div
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="flex flex-col justify-between items-center py-1 px-0.5 sm:px-1 select-none cursor-pointer h-full bg-transparent border-0 outline-none w-6 sm:w-7"
            >
                {displayList.map((item, idx) => {
                    const isDivider = item.isDivider;
                    const letter = item.letter;
                    const origIdx = item.originalIndex;
                    const isValid = validLetters.has(letter);
                    const isCurrent = activeIndex === origIdx;

                    // Magnification curve calculations
                    let scale = 1;
                    let translateX = 0;
                    if (letterMagnification && activeIndex !== null && isInteracting) {
                        const distance = Math.abs(origIdx - activeIndex);
                        if (distance < MAGNIFICATION_CURVE.length) {
                            const curveValue = MAGNIFICATION_CURVE[distance];
                            scale = 1 + curveValue * (magnificationMultiplier - 1);
                            translateX = -curveValue * (typeof window !== 'undefined' && window.innerWidth < 640 ? 8 : 12);
                        }
                    }

                    return (
                        <div
                            key={`${letter}-${idx}`}
                            className="flex-1 relative flex items-center justify-center w-full min-h-[15px] sm:min-h-[18px] transition-transform duration-75 ease-out"
                            style={{
                                transform: `translateX(${translateX}px) scale(${scale})`,
                                zIndex: isCurrent ? 20 : 10,
                            }}
                        >
                            {isDivider ? (
                                <span className="text-[9px] text-accent/40 font-black leading-none select-none">
                                    {overflowDivider}
                                </span>
                            ) : (
                                <span
                                    className={`text-[9.5px] sm:text-[11px] font-bold leading-none select-none transition-all duration-100 ${
                                        isCurrent
                                            ? 'text-accent font-black drop-shadow-[0_0_8px_rgba(212,175,55,0.85)] scale-110'
                                            : isValid
                                            ? 'text-accent opacity-95 hover:opacity-100 font-extrabold'
                                            : 'text-accent/30 font-medium'
                                    }`}
                                >
                                    {letter}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );

    return createPortal(scrollbarContent, document.body);
}
