import React from 'react';

// Reusable shimmer block with smooth pulse effect
export function SkeletonBlock({ className = '' }) {
    return (
        <div className={`bg-secondary/70 animate-pulse rounded-lg ${className}`} />
    );
}

// ── Song List Skeleton Rows (Spotify-style Minimalist List Shimmer) ──
// Strictly row-based without card outlines, backgrounds, divide-y lines, or shadows
export function LibrarySkeletonCards() {
    return (
        <div className="space-y-0.5 animate-fadeIn">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                <div
                    key={i}
                    className="py-2.5 px-2.5 rounded-xl flex items-center gap-3"
                >
                    {/* Track number shimmer */}
                    <SkeletonBlock className="w-5 h-3.5 rounded shrink-0 opacity-60" />

                    {/* Title and metadata shimmers */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                        <SkeletonBlock className="w-2/5 sm:w-1/3 h-4 rounded" />
                        <div className="flex items-center gap-2">
                            <SkeletonBlock className="w-28 h-3 rounded opacity-70" />
                            <SkeletonBlock className="w-12 h-3 rounded opacity-70" />
                        </div>
                    </div>

                    {/* Quick action button shimmer */}
                    <SkeletonBlock className="w-8 h-8 rounded-full shrink-0 opacity-50" />
                </div>
            ))}
        </div>
    );
}

// ── Full Library Screen Skeleton (For route-level loading only if needed) ──
export function LibrarySkeleton() {
    return (
        <div className="px-5 py-4">
            <LibrarySkeletonCards />
        </div>
    );
}

// ── Setlist Lineup Skeleton Cards (Matching SetlistScreen Current UI) ──
export function SetlistSkeletonCards() {
    return (
        <div className="space-y-4 animate-fadeIn">
            {[1, 2, 3].map((i) => (
                <div
                    key={i}
                    className="rounded-2xl border border-themed bg-secondary/40 p-4 space-y-3.5"
                >
                    {/* Top row: Date & status pill */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SkeletonBlock className="w-7 h-7 rounded-xl" />
                            <SkeletonBlock className="w-24 h-4 rounded-md" />
                        </div>
                        <SkeletonBlock className="w-16 h-5 rounded-full" />
                    </div>

                    {/* Title and prepared by */}
                    <div className="space-y-1.5">
                        <SkeletonBlock className="w-1/2 h-5 rounded-md" />
                        <SkeletonBlock className="w-1/4 h-3.5 rounded-md opacity-70" />
                    </div>

                    {/* Bottom actions row */}
                    <div className="pt-2 border-t border-themed/30 flex items-center justify-between">
                        <SkeletonBlock className="w-16 h-4 rounded-md opacity-70" />
                        <SkeletonBlock className="w-24 h-8 rounded-xl" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SetlistSkeleton() {
    return (
        <div className="px-5 py-4">
            <SetlistSkeletonCards />
        </div>
    );
}

// ── Song Detail Content Skeleton ──
export function SongDetailSkeleton() {
    return (
        <div className="px-5 py-6 space-y-6 max-w-2xl mx-auto animate-fadeIn">
            {/* Title & Artist Shimmer */}
            <div className="space-y-2 text-center">
                <SkeletonBlock className="w-1/2 h-7 rounded-xl mx-auto" />
                <SkeletonBlock className="w-1/4 h-4 rounded-md mx-auto opacity-70" />
                <div className="flex justify-center gap-2 pt-2">
                    <SkeletonBlock className="w-16 h-6 rounded-full" />
                    <SkeletonBlock className="w-16 h-6 rounded-full" />
                </div>
            </div>

            {/* Quick Action Toolbar */}
            <SkeletonBlock className="w-full h-12 rounded-2xl" />

            {/* Lyrics & Chords Shimmer Lines */}
            <div className="space-y-4 pt-4">
                <SkeletonBlock className="w-20 h-4 rounded" />
                <div className="space-y-2.5">
                    <SkeletonBlock className="w-3/4 h-4 rounded" />
                    <SkeletonBlock className="w-full h-4 rounded" />
                    <SkeletonBlock className="w-5/6 h-4 rounded" />
                    <SkeletonBlock className="w-2/3 h-4 rounded" />
                </div>

                <SkeletonBlock className="w-20 h-4 rounded pt-4" />
                <div className="space-y-2.5">
                    <SkeletonBlock className="w-4/5 h-4 rounded" />
                    <SkeletonBlock className="w-full h-4 rounded" />
                    <SkeletonBlock className="w-3/4 h-4 rounded" />
                </div>
            </div>
        </div>
    );
}

export default LibrarySkeletonCards;
