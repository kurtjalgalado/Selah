import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Check, DiceFive as Dices, X, CaretLeft, CaretRight, Sparkle } from '@phosphor-icons/react';
import { AVATAR_PRESETS, getRandomAvatarSeed, getAvatarData } from '../utils/avatar';
import { haptic } from '../utils/haptics';

/**
 * AvatarCarouselChooser
 * 
 * An integrated, non-modal avatar chooser for the Profile Screen.
 * Features:
 * - Subtle slide-down expansion when opened
 * - Smooth collapse closing animation when an avatar is chosen
 * - Pure circular frames (eliminating rounded-square corner spaces)
 * - Modern horizontal carousel with snap scroll & desktop chevron controls
 * - Quick 'Surprise Me' randomizer roll
 * - Auto-scroll to currently active avatar on open
 */
export default function AvatarCarouselChooser({
    isOpen,
    onClose,
    currentSeed,
    onSelect,
    isSaving = false,
}) {
    const [selectedSeed, setSelectedSeed] = useState(currentSeed || 'Felix');
    const [isClosing, setIsClosing] = useState(false);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(true);
    const [customInput, setCustomInput] = useState('');
    const [showCustomBar, setShowCustomBar] = useState(false);

    const scrollContainerRef = useRef(null);

    // Sync seed when opening
    useEffect(() => {
        if (isOpen) {
            setSelectedSeed(currentSeed || 'Felix');
            setIsClosing(false);
        }
    }, [isOpen, currentSeed]);

    // Update scroll arrow indicators
    const checkScrollBounds = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const { scrollLeft, scrollWidth, clientWidth } = el;
        setCanScrollLeft(scrollLeft > 6);
        setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }, []);

    // Auto-scroll to selected avatar when opened
    useEffect(() => {
        if (isOpen && !isClosing) {
            const timer = setTimeout(() => {
                const el = scrollContainerRef.current;
                if (!el) return;
                const activeCard = el.querySelector('[data-selected="true"]');
                if (activeCard) {
                    activeCard.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center',
                    });
                }
                checkScrollBounds();
            }, 120);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isClosing, selectedSeed, checkScrollBounds]);

    // Manual scroll step via buttons
    const handleScrollStep = (direction) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        haptic('light');
        const offset = direction === 'left' ? -220 : 220;
        el.scrollBy({ left: offset, behavior: 'smooth' });
    };

    // User chooses an avatar -> highlight -> smooth closing animation -> commit
    const handlePickAvatar = async (seed) => {
        if (isClosing || isSaving) return;
        haptic('success');
        setSelectedSeed(seed);
        setIsClosing(true);

        try {
            if (onSelect) {
                await onSelect(seed);
            }
        } catch (err) {
            console.error('[AvatarCarouselChooser] Failed to update avatar:', err);
        }

        // Wait for the slide-up collapse animation to finish before closing
        setTimeout(() => {
            setIsClosing(false);
            if (onClose) onClose();
        }, 290);
    };

    // Random roll
    const handleSurpriseMe = () => {
        haptic('medium');
        const nextSeed = getRandomAvatarSeed();
        setSelectedSeed(nextSeed);

        // Scroll newly rolled avatar into center view
        const el = scrollContainerRef.current;
        if (el) {
            setTimeout(() => {
                const target = el.querySelector(`[data-seed="${nextSeed.toLowerCase()}"]`);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center',
                    });
                }
            }, 60);
        }
    };

    // Manual cancel/close with smooth collapse
    const handleCancel = () => {
        if (isClosing) return;
        haptic('light');
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            if (onClose) onClose();
        }, 270);
    };

    // Custom seed submission
    const handleCustomSubmit = (e) => {
        e.preventDefault();
        const trimmed = customInput.trim();
        if (trimmed) {
            handlePickAvatar(trimmed);
            setCustomInput('');
        }
    };

    const isVisible = isOpen && !isClosing;
    const currentAvatarData = getAvatarData(selectedSeed);

    return (
        <div
            className={`avatar-chooser-container ${isVisible ? 'is-expanded' : ''}`}
            aria-hidden={!isVisible}
        >
            <div className="avatar-chooser-inner pt-2 pb-1">
                <div className="relative rounded-3xl bg-secondary border border-themed shadow-xl overflow-hidden backdrop-blur-xl">
                    {/* Top ambient highlight gradient */}
                    <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-accent/50 to-transparent pointer-events-none" />

                    {/* Header Row */}
                    <div className="px-4 pt-3.5 pb-2 flex items-center justify-between border-b border-themed/60">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-textprimary">
                                Choose Avatar
                            </h3>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                                {AVATAR_PRESETS.length} Styles
                            </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Surprise Me / Random Roll */}
                            <button
                                type="button"
                                onClick={handleSurpriseMe}
                                className="px-2.5 py-1.5 rounded-full bg-primary/70 hover:bg-surface-hover text-accent text-xs font-semibold flex items-center gap-1.5 transition-all border border-themed active:scale-95"
                                title="Pick a random avatar"
                            >
                                <Dices className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Surprise Me</span>
                            </button>

                            {/* Custom Seed Toggle */}
                            <button
                                type="button"
                                onClick={() => {
                                    haptic('light');
                                    setShowCustomBar(!showCustomBar);
                                }}
                                className={`p-1.5 rounded-full transition-all border text-xs ${
                                    showCustomBar
                                        ? 'bg-accent text-onaccent border-accent'
                                        : 'bg-primary/70 text-textmuted hover:text-textprimary border-themed hover:bg-surface-hover'
                                }`}
                                title="Type custom name"
                            >
                                <Sparkle className="w-3.5 h-3.5" />
                            </button>

                            {/* Close / Dismiss */}
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="p-1.5 rounded-full bg-primary/70 hover:bg-surface-hover text-textmuted hover:text-textprimary transition-all border border-themed active:scale-95"
                                title="Close avatar chooser"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Optional Custom Seed Input */}
                    {showCustomBar && (
                        <form
                            onSubmit={handleCustomSubmit}
                            className="px-4 py-2.5 bg-primary/40 border-b border-themed/60 flex items-center gap-2 animate-fadeIn"
                        >
                            <input
                                type="text"
                                value={customInput}
                                onChange={(e) => setCustomInput(e.target.value)}
                                placeholder="Type custom name (e.g. Grace, Pastor Dave)..."
                                className="flex-1 px-3 py-1.5 bg-secondary border border-themed rounded-xl text-xs text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!customInput.trim()}
                                className="px-3 py-1.5 rounded-xl bg-accent text-onaccent text-xs font-bold disabled:opacity-40 active:scale-95 transition"
                            >
                                Apply
                            </button>
                        </form>
                    )}

                    {/* Carousel Area */}
                    <div className="relative px-2 py-3">
                        {/* Desktop Left Scroll Button */}
                        {canScrollLeft && (
                            <button
                                type="button"
                                onClick={() => handleScrollStep('left')}
                                className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-secondary/90 hover:bg-secondary border border-themed text-textprimary shadow-lg items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md"
                                title="Scroll left"
                            >
                                <CaretLeft className="w-4 h-4" />
                            </button>
                        )}

                        {/* Desktop Right Scroll Button */}
                        {canScrollRight && (
                            <button
                                type="button"
                                onClick={() => handleScrollStep('right')}
                                className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-secondary/90 hover:bg-secondary border border-themed text-textprimary shadow-lg items-center justify-center transition-all hover:scale-110 active:scale-95 backdrop-blur-md"
                                title="Scroll right"
                            >
                                <CaretRight className="w-4 h-4" />
                            </button>
                        )}

                        {/* Horizontal Scroll Track */}
                        <div
                            ref={scrollContainerRef}
                            onScroll={checkScrollBounds}
                            className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-2 snap-x snap-mandatory"
                        >
                            {AVATAR_PRESETS.map((p) => {
                                const isSelected = selectedSeed.toLowerCase() === p.seed.toLowerCase();

                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        data-seed={p.seed.toLowerCase()}
                                        data-selected={isSelected}
                                        onClick={() => handlePickAvatar(p.seed)}
                                        className="group flex flex-col items-center gap-1.5 shrink-0 focus:outline-none snap-center cursor-pointer select-none"
                                        title={p.label}
                                    >
                                        {/* Pure Round Circular Frame - No square edges or corner gaps */}
                                        <div
                                            className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full aspect-square transition-all duration-200 p-0.5 flex items-center justify-center ${
                                                isSelected
                                                    ? 'ring-2 sm:ring-[3px] ring-accent ring-offset-2 ring-offset-secondary scale-105 shadow-lg shadow-accent/25'
                                                    : 'ring-1 ring-themed hover:ring-accent/50 hover:scale-105 active:scale-95 bg-primary/40'
                                            }`}
                                        >
                                            {/* Edge-to-edge Circular Avatar Content */}
                                            <div className="w-full h-full rounded-full overflow-hidden bg-primary flex items-center justify-center">
                                                <img
                                                    src={p.file}
                                                    alt={p.label}
                                                    width="80"
                                                    height="80"
                                                    loading="lazy"
                                                    decoding="async"
                                                    className="w-full h-full object-cover rounded-full select-none pointer-events-none group-hover:scale-108 transition-transform duration-300"
                                                />
                                            </div>

                                            {/* Selection Indicator Badge */}
                                            {isSelected && (
                                                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent text-onaccent flex items-center justify-center shadow-md border-2 border-secondary animate-fadeIn">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Avatar Label */}
                                        <span
                                            className={`text-[11px] sm:text-xs font-semibold tracking-tight transition-colors truncate max-w-[68px] ${
                                                isSelected
                                                    ? 'text-accent font-bold'
                                                    : 'text-textmuted group-hover:text-textprimary'
                                            }`}
                                        >
                                            {p.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Bottom Status Hint */}
                    <div className="px-4 py-2 bg-primary/30 border-t border-themed/40 flex items-center justify-between text-[11px] text-textmuted">
                        <span>
                            Selected: <strong className="text-textprimary">{currentAvatarData?.label || selectedSeed}</strong>
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-accent/80">
                            Tap to apply
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
