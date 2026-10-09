import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { 
    CalendarBlank as Calendar, MusicNotes as Music, Plus, Play, CaretRight as ChevronRight, 
    Lightning as Zap, Clock, ListPlus, Flame, Heart, Stack as Layers, ArrowUpRight, Users, Lock, SignIn as LogIn
} from '@phosphor-icons/react';
import PullToRefresh from '../components/PullToRefresh';
import { discreetBackgroundSync } from '../supabase/sync';
import AppLogo from '../components/AppLogo';
import { AddSetlistModal, SetlistDateBadge } from './SetlistScreen';
import { AddSongModal, QuickAddToSetlistModal } from './LibraryScreen';
import { haptic } from '../utils/haptics';
import UserAvatar from '../components/UserAvatar';
import TopBarNotificationBell from '../components/TopBarNotificationBell';

export default function HomeScreen() {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const { songs, setlists, schedules } = useSongCache();

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
    const displayName = user?.user_metadata?.full_name || 
                        profile?.full_name ||
                        user?.user_metadata?.display_name ||
                        profile?.username ||
                        user?.user_metadata?.username || 
                        user?.email?.split('@')[0] || 
                        'Worship Leader';

    // Dates & Setlists filtering (Only upcoming within the next 7 days / this week)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // 7 days ahead for "within the week" filter
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekAheadStr = `${weekAhead.getFullYear()}-${String(weekAhead.getMonth() + 1).padStart(2, '0')}-${String(weekAhead.getDate()).padStart(2, '0')}`;
    const userChurchId = profile?.church_id || user?.user_metadata?.church_id || 'JFCM-Mercedes';

    const upcomingSetlists = useMemo(() => {
        if (!user) return [];
        return (setlists || [])
            .filter(s => (!s.churchId || s.churchId.toLowerCase() === userChurchId.toLowerCase() || userChurchId === 'JFCM-Mercedes') && (s.date && s.date >= todayStr && s.date <= weekAheadStr))
            .sort((a, b) => a.date.localeCompare(b.date));
    }, [setlists, todayStr, weekAheadStr, user, userChurchId]);

    const nextSetlist = upcomingSetlists[0] || null;
    const isToday = nextSetlist?.date === todayStr;

    // Upcoming Schedule for this week
    const upcomingSchedule = useMemo(() => {
        return (schedules || [])
            .filter(s => s.serviceDate && s.serviceDate >= todayStr)
            .sort((a, b) => a.serviceDate.localeCompare(b.serviceDate))[0] || null;
    }, [schedules, todayStr]);

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
                            
                            <div className="flex items-center gap-2">
                                {/* Top Bar Notification Bell */}
                                <TopBarNotificationBell />

                                {/* Profile quick access avatar button */}
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        navigate('/profile');
                                    }}
                                    className="w-10 h-10 rounded-full bg-secondary border border-themed hover:border-emerald-500/50 flex items-center justify-center text-accent active:scale-95 transition-all shadow-sm overflow-hidden p-0.5"
                                    title="Go to Profile"
                                >
                                    <UserAvatar
                                        seed={profile?.avatar_seed || user?.user_metadata?.avatar_seed || displayName}
                                        size="sm"
                                        animated={true}
                                        fallbackInitial={displayName.charAt(0)}
                                        className="w-full h-full"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="px-5 sm:px-8 py-5 space-y-6 max-w-5xl mx-auto">
                    {/* ===== USER GREETING BANNER ===== */}
                    <div className="space-y-1">
                        <p className="text-[11px] font-semibold text-accent tracking-widest uppercase flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-accent" />
                            {dateFormatted}
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-textprimary tracking-tight">
                            {greeting}, <span className="text-accent">{displayName}</span>
                        </h1>
                    </div>

                    {/* ===== QUICK ACTIONS ===== */}
                    <div className="grid grid-cols-3 gap-2.5">
                        <button
                            onClick={() => {
                                haptic('light');
                                if (!user) navigate('/login');
                                else setShowAddSetlist(true);
                            }}
                            className="p-3.5 rounded-2xl bg-secondary hover:bg-surface-hover active:scale-[0.98] transition-all text-left flex flex-col justify-between group shadow-sm min-h-[82px] border-0"
                        >
                            <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <p className="text-xs font-bold text-textprimary truncate leading-tight">New Setlist</p>
                        </button>

                        <button
                            onClick={() => {
                                haptic('light');
                                navigate('/schedule');
                            }}
                            className="p-3.5 rounded-2xl bg-secondary hover:bg-surface-hover active:scale-[0.98] transition-all text-left flex flex-col justify-between group shadow-sm min-h-[82px] border-0"
                        >
                            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Users className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <p className="text-xs font-bold text-textprimary truncate leading-tight">Ministers</p>
                        </button>

                        <button
                            onClick={() => {
                                haptic('light');
                                setShowAddSong(true);
                            }}
                            className="p-3.5 rounded-2xl bg-secondary hover:bg-surface-hover active:scale-[0.98] transition-all text-left flex flex-col justify-between group shadow-sm min-h-[82px] border-0"
                        >
                            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                <Music className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <p className="text-xs font-bold text-textprimary truncate leading-tight">Add Song</p>
                        </button>
                    </div>

                    {/* ===== UPCOMING SERVICE SPOTLIGHT ===== */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-accent" /> Upcoming Worship Service
                            </h2>
                            {user && nextSetlist && (
                                <button
                                    onClick={() => navigate('/setlists')}
                                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-0.5"
                                >
                                    <span>All Lineups</span>
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {!user ? (
                            <div className="relative overflow-hidden rounded-3xl bg-secondary/80 backdrop-blur-xl border border-themed p-6 text-center space-y-3.5 shadow-xl">
                                <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent mx-auto">
                                    <Lock className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-bold text-textprimary">Worship Service & Schedule</h3>
                                    <p className="text-xs text-textmuted max-w-xs mx-auto">
                                        Sign in to view your church's upcoming worship service lineup and ministry schedule.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        navigate('/login');
                                    }}
                                    className="px-5 py-2.5 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-md shadow-accent/20 active:scale-95 transition-all inline-flex items-center gap-1.5"
                                >
                                    <LogIn className="w-3.5 h-3.5" />
                                    <span>Sign In to View Schedule</span>
                                </button>
                            </div>
                        ) : nextSetlist ? (
                            <div className="relative overflow-hidden rounded-3xl bg-secondary/80 backdrop-blur-xl border border-themed hover:border-emerald-500/30 p-5 shadow-xl transition-all group">
                                {/* Subtle Ambient Glow */}
                                <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-emerald-500/15 transition-all" />
                                <div className="absolute -bottom-10 -left-10 w-28 h-28 bg-accent/5 rounded-full blur-2xl pointer-events-none" />
                                
                                <div className="relative z-10 space-y-3.5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <SetlistDateBadge date={nextSetlist.date} isToday={isToday} />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 mb-0.5">
                                                    {isToday ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                                            Today's Service
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-emerald-400 tracking-wider uppercase">
                                                            This Week
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-lg font-bold text-textprimary leading-tight truncate">
                                                    {nextSetlist.title}
                                                </h3>
                                                <p className="text-xs text-textmuted mt-0.5 truncate">
                                                    Prepared by <span className="text-textprimary font-medium">{nextSetlist.preparedBy || 'Worship Leader'}</span>
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                            <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-xl border border-emerald-500/20 inline-block">
                                                {nextSetlist.songIds?.length || 0} {nextSetlist.songIds?.length === 1 ? 'Song' : 'Songs'}
                                            </span>
                                        </div>
                                    </div>

                                    {nextSetlist.notes && (
                                        <p className="text-xs text-textmuted bg-primary/40 p-2.5 rounded-xl border border-themed italic line-clamp-2">
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
                                            <span>Open Setlist</span>
                                        </button>

                                        <button
                                            onClick={() => {
                                                haptic('light');
                                                navigate('/setlists');
                                            }}
                                            className="py-2.5 px-4 bg-secondary hover:bg-surface-hover text-textprimary font-semibold text-xs rounded-xl active:scale-98 transition flex items-center gap-1 border-0"
                                        >
                                            <span>View Details</span>
                                            <ArrowUpRight className="w-3.5 h-3.5 text-textmuted" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl bg-secondary/60 backdrop-blur-md border border-themed p-6 text-center space-y-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent mx-auto">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-textprimary">No Service Scheduled This Week</h3>
                                    <p className="text-xs text-textmuted mt-1 max-w-xs mx-auto">
                                        Plan your song lineup, arrange keys, and organize your praise and worship set.
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
                                                if (!user) {
                                                    navigate('/login');
                                                    return;
                                                }
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
                            <h2 className="text-xs font-semibold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" /> Favorites
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
                                                if (!user) {
                                                    navigate('/login');
                                                    return;
                                                }
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
                    {user && setlists && setlists.length > 0 && (
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
                                            title="Open Setlist"
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
