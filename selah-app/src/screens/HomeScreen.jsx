import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { 
    Calendar, Music, Plus, Play, Sparkles, ChevronRight, 
    Zap, Clock, ListPlus, Flame, Heart, Layers, ArrowUpRight
} from 'lucide-react';
import PullToRefresh from '../components/PullToRefresh';
import { discreetBackgroundSync } from '../supabase/sync';
import AppLogo from '../components/AppLogo';
import { AddSetlistModal } from './SetlistScreen';
import { AddSongModal, QuickAddToSetlistModal } from './LibraryScreen';
import { haptic } from '../utils/haptics';

export default function HomeScreen() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { songs, setlists } = useSongCache();

    const [showAddSetlist, setShowAddSetlist] = useState(false);
    const [showAddSong, setShowAddSong] = useState(false);
    const [quickAddSong, setQuickAddSong] = useState(null);

    // Dynamic Time-based Greeting
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 18) return 'Good afternoon';
        return 'Good evening';
    }, []);

    // Formatted current date
    const dateFormatted = useMemo(() => {
        return new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
        });
    }, []);

    // User display name
    const displayName = user?.user_metadata?.username || 
                        user?.user_metadata?.full_name || 
                        user?.email?.split('@')[0] || 
                        'Worship Leader';

    // Dates & Setlists filtering
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const upcomingSetlists = useMemo(() => {
        return (setlists || [])
            .filter(s => !s.date || s.date >= todayStr)
            .sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return a.date.localeCompare(b.date);
            });
    }, [setlists, todayStr]);

    const nextSetlist = upcomingSetlists[0] || null;

    // Featured Daily Songs (Deterministic daily pseudo-random refresh)
    const featuredSongs = useMemo(() => {
        if (!songs || songs.length === 0) return [];
        const d = new Date();
        const str = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        let seed = Math.abs(hash);
        const shuffled = [...songs];
        for (let i = shuffled.length - 1; i > 0; i--) {
            seed = (seed * 9301 + 49297) % 233280;
            const rnd = seed / 233280;
            const j = Math.floor(rnd * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, 6);
    }, [songs]);

    // Favorite Songs based on frequency across all synced setlists
    const favoriteSongs = useMemo(() => {
        if (!songs || !setlists || songs.length === 0 || setlists.length === 0) return [];
        const usageCounts = {};
        for (const setlist of setlists) {
            if (Array.isArray(setlist.songIds)) {
                for (const sId of setlist.songIds) {
                    const idStr = String(sId);
                    usageCounts[idStr] = (usageCounts[idStr] || 0) + 1;
                }
            }
        }

        return songs
            .map(song => ({
                ...song,
                usageCount: usageCounts[String(song.id)] || 0,
            }))
            .filter(s => s.usageCount > 0)
            .sort((a, b) => b.usageCount - a.usageCount || (a.title || '').localeCompare(b.title || ''))
            .slice(0, 5);
    }, [songs, setlists]);

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-28 animate-pageEnter text-textprimary">
                {/* ===== HEADER & GREETING ===== */}
                <header className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-5 pt-10 pb-4">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />
                            
                            {/* Profile quick access avatar button */}
                            <button
                                onClick={() => {
                                    haptic('light');
                                    navigate('/profile');
                                }}
                                className="w-10 h-10 rounded-full bg-secondary border border-themed hover:border-accent flex items-center justify-center text-accent active:scale-95 transition-all shadow-sm"
                                title="Go to Profile"
                            >
                                <span className="text-xs font-bold uppercase">
                                    {displayName.charAt(0)}
                                </span>
                            </button>
                        </div>
                    </div>
                </header>

                <main className="px-5 py-5 space-y-6 max-w-2xl mx-auto">
                    {/* ===== USER GREETING BANNER ===== */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-bold text-accent tracking-widest uppercase flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {dateFormatted}
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-textprimary tracking-tight">
                            {greeting}, <span className="text-accent">{displayName}</span>
                        </h1>
                        <p className="text-xs text-textmuted">
                            Welcome to Selah. Plan services, rehearse songs, and worship with joy.
                        </p>
                    </div>

                    {/* ===== QUICK ACTION CHIPS ===== */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <button
                            onClick={() => {
                                haptic('light');
                                if (!user) navigate('/login');
                                else setShowAddSetlist(true);
                            }}
                            className="p-3.5 rounded-2xl bg-secondary/80 border border-themed hover:border-accent/40 active:scale-95 transition-all text-left flex flex-col justify-between group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-textprimary leading-tight">Create Setlist</p>
                                <p className="text-[10px] text-textmuted">Plan new lineup</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                haptic('light');
                                setShowAddSong(true);
                            }}
                            className="p-3.5 rounded-2xl bg-secondary/80 border border-themed hover:border-accent/40 active:scale-95 transition-all text-left flex flex-col justify-between group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                                <Music className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-textprimary leading-tight">Add Song</p>
                                <p className="text-[10px] text-textmuted">New lyrics & key</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                haptic('light');
                                navigate('/library');
                            }}
                            className="p-3.5 rounded-2xl bg-secondary/80 border border-themed hover:border-accent/40 active:scale-95 transition-all text-left flex flex-col justify-between group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                                <Layers className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-textprimary leading-tight">Song Library</p>
                                <p className="text-[10px] text-textmuted">{songs?.length || 0} songs</p>
                            </div>
                        </button>

                        <button
                            onClick={() => {
                                haptic('light');
                                navigate('/setlists');
                            }}
                            className="p-3.5 rounded-2xl bg-secondary/80 border border-themed hover:border-accent/40 active:scale-95 transition-all text-left flex flex-col justify-between group"
                        >
                            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                                <Calendar className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-textprimary leading-tight">Song Lineup</p>
                                <p className="text-[10px] text-textmuted">{upcomingSetlists.length} scheduled</p>
                            </div>
                        </button>
                    </div>

                    {/* ===== UPCOMING SERVICE SPOTLIGHT ===== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-accent" /> Upcoming Worship Service
                            </h2>
                            {nextSetlist && (
                                <button
                                    onClick={() => navigate('/setlists')}
                                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                                >
                                    <span>All Lineups</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {nextSetlist ? (
                            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary via-elevated to-secondary border border-accent/30 p-5 shadow-xl">
                                <div className="absolute -top-12 -right-12 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                                
                                <div className="relative z-10 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent/20 text-accent border border-accent/30 mb-1.5">
                                                {nextSetlist.date || 'Upcoming'}
                                            </span>
                                            <h3 className="text-lg font-bold font-serif text-textprimary leading-tight">
                                                {nextSetlist.title}
                                            </h3>
                                            <p className="text-xs text-textmuted mt-0.5">
                                                Prepared by <span className="text-textprimary font-medium">{nextSetlist.preparedBy || 'Worship Leader'}</span>
                                            </p>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-extrabold text-accent bg-accent/10 px-2.5 py-1 rounded-xl border border-accent/20 inline-block">
                                                {nextSetlist.songIds?.length || 0} Songs
                                            </span>
                                        </div>
                                    </div>

                                    {nextSetlist.notes && (
                                        <p className="text-xs text-textmuted/90 bg-primary/60 p-2.5 rounded-xl border border-themed italic line-clamp-2">
                                            "{nextSetlist.notes}"
                                        </p>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="pt-1 flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                haptic('light');
                                                navigate(`/setlist-player/${nextSetlist.id}`);
                                            }}
                                            className="flex-1 py-2.5 px-4 bg-accent text-onaccent font-bold text-xs rounded-xl shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-98 transition flex items-center justify-center gap-1.5"
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                            <span>Start Live Jam</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                haptic('light');
                                                navigate('/setlists');
                                            }}
                                            className="py-2.5 px-4 bg-secondary border border-themed text-textprimary hover:border-accent font-semibold text-xs rounded-xl active:scale-98 transition flex items-center gap-1"
                                        >
                                            <span>View Details</span>
                                            <ArrowUpRight className="w-3.5 h-3.5 text-textmuted" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-secondary/50 border border-themed p-6 text-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-textprimary">No Upcoming Setlist Planned</h3>
                                    <p className="text-xs text-textmuted mt-1 max-w-xs mx-auto">
                                        Prepare your song lineup, arrange keys, and organize your praise and worship set.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        if (!user) navigate('/login');
                                        else setShowAddSetlist(true);
                                    }}
                                    className="px-5 py-2.5 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-md shadow-accent/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                    <span>Plan Worship Setlist</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ===== FEATURED WORSHIP SONGS (SPOTIFY STYLE MINIMALIST LIST) ===== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-amber-400" /> Featured Songs
                            </h2>
                            <button
                                onClick={() => navigate('/library')}
                                className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                            >
                                <span>See All</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {songs === undefined ? (
                            <div className="space-y-0.5 animate-fadeIn">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="py-2.5 px-2.5 rounded-xl flex items-center gap-3">
                                        <div className="w-5 h-3.5 bg-secondary/70 animate-pulse rounded shrink-0 opacity-60" />
                                        <div className="flex-1 space-y-1.5 min-w-0">
                                            <div className="w-1/3 h-4 bg-secondary/70 animate-pulse rounded" />
                                            <div className="w-1/5 h-3 bg-secondary/70 animate-pulse rounded opacity-70" />
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-secondary/70 animate-pulse shrink-0 opacity-50" />
                                    </div>
                                ))}
                            </div>
                        ) : featuredSongs.length === 0 ? (
                            <div className="text-center py-8 text-xs text-textmuted bg-secondary/40 rounded-2xl border border-themed">
                                No songs in library yet. Add your first song to get started.
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {featuredSongs.map((song, index) => (
                                    <div
                                        key={song.id}
                                        onClick={() => {
                                            haptic('light');
                                            navigate(`/song/${song.id}`);
                                        }}
                                        className="group py-3 px-2 flex items-center gap-3 hover:bg-surface-hover active:bg-surface-active rounded-xl transition-all cursor-pointer"
                                    >
                                        {/* Track Number / Icon */}
                                        <span className="w-5 text-center text-xs font-bold text-textmuted group-hover:text-accent select-none">
                                            {index + 1}
                                        </span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-textprimary truncate text-sm sm:text-base leading-snug group-hover:text-accent transition-colors">
                                                {song.title}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-xs text-textmuted mt-0.5">
                                                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                                                    {song.artist}
                                                </span>
                                                <span className="text-textmuted/40">•</span>
                                                <span className="font-mono text-accent font-semibold">
                                                    Key {song.originalKey || song.currentKey || 'C'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quick Add Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                haptic('light');
                                                setQuickAddSong(song);
                                            }}
                                            className="w-9 h-9 rounded-full text-textmuted hover:text-accent hover:bg-accent/15 flex items-center justify-center active:scale-90 transition-all shrink-0"
                                            title="Add to Worship Setlist"
                                        >
                                            <ListPlus className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ===== FAVORITES SECTION (MOST PLAYED ACROSS ALL SETLISTS) ===== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> Favorites (Most Used)
                            </h2>
                            {favoriteSongs.length > 0 && (
                                <span className="text-[11px] font-semibold text-rose-400/90">
                                    Top {favoriteSongs.length}
                                </span>
                            )}
                        </div>

                        {songs === undefined || setlists === undefined ? (
                            <div className="space-y-0.5 animate-fadeIn">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="py-2.5 px-2.5 rounded-xl flex items-center gap-3">
                                        <div className="w-5 h-3.5 bg-secondary/70 animate-pulse rounded shrink-0 opacity-60" />
                                        <div className="flex-1 space-y-1.5 min-w-0">
                                            <div className="w-1/3 h-4 bg-secondary/70 animate-pulse rounded" />
                                            <div className="w-1/4 h-3 bg-secondary/70 animate-pulse rounded opacity-70" />
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-secondary/70 animate-pulse shrink-0 opacity-50" />
                                    </div>
                                ))}
                            </div>
                        ) : favoriteSongs.length === 0 ? (
                            <div className="text-center py-6 text-xs text-textmuted bg-secondary/40 rounded-2xl border border-themed px-4">
                                No favorite songs yet. Add songs to your worship setlists to build your most-used songs rank.
                            </div>
                        ) : (
                            <div className="space-y-0.5">
                                {favoriteSongs.map((song, index) => (
                                    <div
                                        key={song.id}
                                        onClick={() => {
                                            haptic('light');
                                            navigate(`/song/${song.id}`);
                                        }}
                                        className="group py-3 px-2 flex items-center gap-3 hover:bg-surface-hover active:bg-surface-active rounded-xl transition-all cursor-pointer"
                                    >
                                        {/* Rank Number */}
                                        <span className="w-5 text-center text-xs font-bold text-rose-400/80 group-hover:text-rose-400 select-none">
                                            {index + 1}
                                        </span>

                                        {/* Song Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-textprimary truncate text-sm sm:text-base leading-snug group-hover:text-rose-400 transition-colors">
                                                {song.title}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-xs text-textmuted mt-0.5">
                                                <span className="truncate max-w-[130px] sm:max-w-[190px]">
                                                    {song.artist}
                                                </span>
                                                <span className="text-textmuted/40">•</span>
                                                <span className="font-mono text-accent font-semibold">
                                                    Key {song.originalKey || song.currentKey || 'C'}
                                                </span>
                                                <span className="text-textmuted/40">•</span>
                                                <span className="text-rose-400 font-semibold text-[11px] flex items-center gap-0.5">
                                                    {song.usageCount} {song.usageCount === 1 ? 'setlist' : 'setlists'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quick Add Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                haptic('light');
                                                setQuickAddSong(song);
                                            }}
                                            className="w-9 h-9 rounded-full text-textmuted hover:text-accent hover:bg-accent/15 flex items-center justify-center active:scale-90 transition-all shrink-0"
                                            title="Add to Worship Setlist"
                                        >
                                            <ListPlus className="w-4.5 h-4.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ===== RECENT SETLISTS / LINEUPS (MATCHING FEATURED SONGS STYLE) ===== */}
                    {setlists && setlists.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-accent" /> Recent Setlists
                                </h2>
                                <button
                                    onClick={() => navigate('/setlists')}
                                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                                >
                                    <span>See All ({setlists.length})</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            <div className="space-y-0.5">
                                {setlists.slice(0, 5).map((setlist, index) => (
                                    <div
                                        key={setlist.id}
                                        onClick={() => {
                                            haptic('light');
                                            navigate(`/setlist-player/${setlist.id}`);
                                        }}
                                        className="group py-3 px-2 flex items-center gap-3 hover:bg-surface-hover active:bg-surface-active rounded-xl transition-all cursor-pointer select-none"
                                    >
                                        {/* Number Index */}
                                        <span className="w-5 text-center text-xs font-bold text-textmuted group-hover:text-accent select-none">
                                            {index + 1}
                                        </span>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-medium text-textprimary truncate text-sm sm:text-base leading-snug group-hover:text-accent transition-colors">
                                                {setlist.title} {setlist.preparedBy ? `— ${setlist.preparedBy}` : ''}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-xs text-textmuted mt-0.5">
                                                <span className="truncate max-w-[120px] sm:max-w-[180px]">
                                                    {setlist.date || 'Undated'}
                                                </span>
                                                <span className="text-textmuted/40">•</span>
                                                <span className="text-accent font-medium">
                                                    {setlist.songIds?.length || 0} Songs
                                                </span>
                                                {setlist.preparedBy && (
                                                    <>
                                                        <span className="text-textmuted/40 hidden xs:inline">•</span>
                                                        <span className="hidden xs:inline text-textmuted truncate max-w-[120px]">
                                                            Leader: {setlist.preparedBy}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Quick Play Button */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                haptic('light');
                                                navigate(`/setlist-player/${setlist.id}`);
                                            }}
                                            className="w-9 h-9 rounded-full text-textmuted hover:text-accent hover:bg-accent/15 flex items-center justify-center active:scale-90 transition-all shrink-0"
                                            title="Launch Live Jam"
                                        >
                                            <Play className="w-4 h-4 fill-current" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </main>

                {/* ===== MODALS ===== */}
                {showAddSetlist && (
                    <AddSetlistModal onClose={() => setShowAddSetlist(false)} />
                )}

                {showAddSong && (
                    <AddSongModal onClose={() => setShowAddSong(false)} />
                )}

                {quickAddSong && (
                    <QuickAddToSetlistModal
                        song={quickAddSong}
                        upcomingSetlists={upcomingSetlists}
                        user={user}
                        onClose={() => setQuickAddSong(null)}
                        onCreateSetlist={() => {
                            setQuickAddSong(null);
                            setShowAddSetlist(true);
                        }}
                    />
                )}
            </div>
        </PullToRefresh>
    );
}
