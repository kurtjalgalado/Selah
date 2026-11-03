import React from 'react';
import { haptic } from '../utils/haptics';

/**
 * AppleSegmentedControl
 * 
 * An Apple Human Interface Guidelines (HIG) compliant segmented control
 * featuring:
 * - Fluid sliding indicator thumb with physical spring easing
 * - Recessed pill container with subtle backdrop blur
 * - High-contrast active state and subtle depth shadows
 * - Adaptive count badge pills
 * - Tactile haptic feedback on selection
 * - Accessibility (role="tablist" / role="tab" / aria-selected)
 */
export default function AppleSegmentedControl({
    tabs = [],
    activeTab,
    onChange,
    className = '',
}) {
    const activeIndex = tabs.findIndex(t => t.id === activeTab);
    const resolvedIndex = activeIndex >= 0 ? activeIndex : 0;
    const tabWidthPercent = 100 / Math.max(tabs.length, 1);

    const handleSelect = (tabId) => {
        if (tabId === activeTab) return;
        haptic('light');
        if (onChange) onChange(tabId);
    };

    return (
        <div
            role="tablist"
            className={`relative flex items-center p-1 sm:p-1.5 rounded-2xl bg-secondary/80 border border-themed backdrop-blur-xl shadow-inner select-none ${className}`}
        >
            {/* Apple HIG Hardware-Accelerated Sliding Indicator Thumb */}
            <div
                className="absolute top-0 bottom-0 left-0 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none will-change-transform"
                style={{
                    width: `${tabWidthPercent}%`,
                    transform: `translate3d(${resolvedIndex * 100}%, 0, 0)`,
                }}
            >
                <div className="h-full p-1 sm:p-1.5">
                    <div className="w-full h-full rounded-xl bg-elevated border border-themed/80 shadow-md shadow-black/25" />
                </div>
            </div>

            {/* Segment Buttons */}
            {tabs.map((tab) => {
                const isActive = tab.id === activeTab;
                const Icon = tab.icon;

                return (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleSelect(tab.id)}
                        className={`relative z-10 flex-1 min-h-[44px] py-2 sm:py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
                            isActive
                                ? 'text-textprimary font-bold'
                                : 'text-textmuted hover:text-textprimary active:scale-[0.98]'
                        }`}
                    >
                        {Icon && (
                            <Icon
                                className={`w-4 h-4 transition-colors shrink-0 ${
                                    isActive ? (tab.accentColor || 'text-accent') : 'text-textmuted'
                                }`}
                                weight={isActive ? 'bold' : 'regular'}
                            />
                        )}
                        <span className="truncate">{tab.label}</span>

                        {typeof tab.count === 'number' && (
                            <span
                                className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-all shrink-0 ${
                                    isActive
                                        ? 'bg-accent/15 text-accent border border-accent/20'
                                        : 'bg-primary/50 text-textmuted border border-themed/50'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
