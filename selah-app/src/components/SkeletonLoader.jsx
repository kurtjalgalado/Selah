import React from 'react';

// Reusable shimmer block
export function SkeletonBlock({ className = '' }) {
    return (
        <div className={`bg-white/10 animate-pulse rounded-xl ${className}`} />
    );
}

// ── Library Skeleton Cards Only (Ignoring Title Bar Header) ──
export function LibrarySkeletonCards() {
    return (
        <div className="space-y-3 animate-fadeIn">
            {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                    key={i}
                    className="bg-elevated/70 border border-white/5 rounded-2xl p-4 flex items-center justify-between space-x-3 shadow-md"
                >
                    <div className="space-y-2.5 flex-1">
                        <SkeletonBlock className="w-3/4 h-4 rounded-md" />
                        <SkeletonBlock className="w-1/2 h-3 rounded-md" />
                        <div className="flex items-center gap-2 pt-1">
                            <SkeletonBlock className="w-12 h-4 rounded-md" />
                            <SkeletonBlock className="w-16 h-4 rounded-md" />
                        </div>
                    </div>
                    <SkeletonBlock className="w-10 h-10 rounded-xl" />
                </div>
            ))}
        </div>
    );
}

// ── Full Library Screen Skeleton (Fallback) ──
export function LibrarySkeleton() {
    return (
        <div className="min-h-screen bg-primary text-textprimary pb-24 animate-fadeIn">
            <div className="px-5 py-4">
                <LibrarySkeletonCards />
            </div>
        </div>
    );
}

// ── Setlist Screen Skeleton Cards Only ──
export function SetlistSkeletonCards() {
    return (
        <div className="space-y-4 animate-fadeIn">
            {[1, 2, 3, 4].map((i) => (
                <div
                    key={i}
                    className="bg-elevated/70 border border-white/5 rounded-3xl p-5 space-y-4 shadow-md"
                >
                    <div className="flex items-center justify-between">
                        <SkeletonBlock className="w-40 h-5 rounded-lg" />
                        <SkeletonBlock className="w-16 h-6 rounded-full" />
                    </div>
                    <SkeletonBlock className="w-28 h-3 rounded-md" />
                    <div className="space-y-2 pt-2 border-t border-white/5">
                        <SkeletonBlock className="w-full h-3 rounded-md" />
                        <SkeletonBlock className="w-4/5 h-3 rounded-md" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function SetlistSkeleton() {
    return (
        <div className="min-h-screen bg-primary text-textprimary pb-24 animate-fadeIn">
            <div className="px-5 py-4">
                <SetlistSkeletonCards />
            </div>
        </div>
    );
}

// ── Song Detail Skeleton ──
export function SongDetailSkeleton() {
    return (
        <div className="min-h-screen bg-primary text-textprimary pb-24 animate-fadeIn">
            <div className="px-5 py-6 space-y-6 max-w-2xl mx-auto">
                {/* Title & Artist Shimmer */}
                <div className="space-y-3 text-center">
                    <SkeletonBlock className="w-2/3 h-8 rounded-xl mx-auto" />
                    <SkeletonBlock className="w-1/3 h-4 rounded-md mx-auto" />
                    <div className="flex justify-center gap-2 pt-2">
                        <SkeletonBlock className="w-16 h-6 rounded-full" />
                        <SkeletonBlock className="w-16 h-6 rounded-full" />
                    </div>
                </div>

                {/* Toolbar */}
                <SkeletonBlock className="w-full h-14 rounded-2xl" />

                {/* Lyrics / Chords Shimmer Lines */}
                <div className="bg-elevated/60 border border-white/5 rounded-3xl p-6 space-y-4">
                    <SkeletonBlock className="w-24 h-4 rounded-md" />
                    <div className="space-y-2">
                        <SkeletonBlock className="w-full h-4 rounded-md" />
                        <SkeletonBlock className="w-5/6 h-4 rounded-md" />
                        <SkeletonBlock className="w-4/6 h-4 rounded-md" />
                    </div>

                    <SkeletonBlock className="w-24 h-4 rounded-md pt-4" />
                    <div className="space-y-2">
                        <SkeletonBlock className="w-full h-4 rounded-md" />
                        <SkeletonBlock className="w-3/4 h-4 rounded-md" />
                        <SkeletonBlock className="w-5/6 h-4 rounded-md" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default LibrarySkeleton;
