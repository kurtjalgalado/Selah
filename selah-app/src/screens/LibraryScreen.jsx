import { useState, useMemo, useEffect, useContext, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { songDB, setlistDB } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { MagnifyingGlass as Search, Plus, MusicNotes as Music, Clock, CaretRight as ChevronRight, Trash as Trash2, ListPlus, SignOut as LogOut, CalendarBlank as Calendar, X, SlidersHorizontal, ArrowCounterClockwise as RotateCcw, SquaresFour as LayoutGrid, Stack as Layers, MicrophoneStage as Mic, TextT as Type, Lightning as Zap, List, Lock, Shield, User } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { pushSongToSupabase, pushSetlistToSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';
import TopBarNotificationBell from '../components/TopBarNotificationBell';
import EditSongModal from '../components/EditSongModal';
import AlphabeticalScrollBar from '../components/AlphabeticalScrollBar';
import QuickAddToSetlistModal from '../components/QuickAddToSetlistModal';
export { default as QuickAddToSetlistModal } from '../components/QuickAddToSetlistModal';
import AddSongModal from '../components/AddSongModal';
export { default as AddSongModal } from '../components/AddSongModal';
import { ModernSetlistCard, AddSetlistModal, PrintSetlistModal, SetlistDateBadge } from './SetlistScreen';
import { LibrarySkeletonCards } from '../components/SkeletonLoader';
import { KEYS, getKeyIndex, stripChords } from '../utils/chords';
import { haptic } from '../utils/haptics';

const ALPHABET = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','#'];

export default function LibraryScreen() {
    const navigate = useNavigate();
    const { user, profile, canManageSetlists } = useAuth();

    const headerRef = useRef(null);
    const [headerHeight, setHeaderHeight] = useState(154);

    const [search, setSearch] = useState('');

    // Grouping: 'alphabet' | 'tempo' | 'artist' | 'none'
    const [groupBy, setGroupBy] = useState('alphabet');

    // Separate independent filters for Tempo & Language
    const [tempoFilter, setTempoFilter] = useState('All'); // 'All' | 'Fast' | 'Slow'
    const [languageFilter, setLanguageFilter] = useState('All'); // 'All' | 'Tagalog' | 'English'
    const [showFilters, setShowFilters] = useState(false); // Collapsible filters

    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
    const [showAddSongModal, setShowAddSongModal] = useState(false);
    const [showAddSetlistModal, setShowAddSetlistModal] = useState(false);
    const [quickAddSong, setQuickAddSong] = useState(null);
    const [editingSong, setEditingSong] = useState(null);

    // Measure header height dynamically for pixel-perfect sticky positioning across all devices and filter states
    useEffect(() => {
        if (!headerRef.current) return;
        const updateHeight = () => {
            const h = headerRef.current?.offsetHeight;
            if (h && h > 0) setHeaderHeight(h);
        };
        updateHeight();
        const observer = new ResizeObserver(updateHeight);
        observer.observe(headerRef.current);
        window.addEventListener('resize', updateHeight);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', updateHeight);
        };
    }, [showFilters]);

    // Lock body scroll when modals are open
    useEffect(() => {
        if (showAddSongModal || showAddSetlistModal || quickAddSong || editingSong) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [showAddSongModal, showAddSetlistModal, quickAddSong, editingSong]);

    // Check if any filter is active
    const isFilterActive = languageFilter !== 'All' || tempoFilter !== 'All' || groupBy !== 'alphabet';

    // Load from SongCache
    const { songs, setlists, loading } = useSongCache();

    // Upcoming setlists (Tenancy-isolated)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const userChurchId = profile?.church_id || user?.user_metadata?.church_id || 'JFCM-Mercedes';

    const upcomingSetlists = useMemo(() => {
        if (!user) return [];
        return (setlists || [])
            .filter(s => (!s.churchId || s.churchId.toLowerCase() === userChurchId.toLowerCase() || userChurchId === 'JFCM-Mercedes') && (!s.date || s.date >= todayStr))
            .sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return a.date.localeCompare(b.date);
            });
    }, [setlists, todayStr, user, userChurchId]);

    // Filtered & Sorted songs
    const filteredSongs = useMemo(() => {
        if (!songs || songs.length === 0) return [];

        const uniqueMap = new Map();
        for (const s of songs) {
            if (!s) continue;
            const key = `${String(s.id || '').toLowerCase()}-${(s.title || '').toLowerCase().trim()}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, s);
            }
        }
        const uniqueSongs = Array.from(uniqueMap.values());

        const q = (search || '').toLowerCase().trim();

        const result = uniqueSongs.filter(song => {
            if (!song || !song.title || !song.title.trim()) return false;
            const songTitle = (song.title || '').toLowerCase();
            const songArtist = (song.artist || '').toLowerCase();
            const songCategory = (song.category || '').toLowerCase();
            const songLanguage = (song.language || '').toLowerCase();
            const songTags = (song.tags || []).map(t => String(t || '').toLowerCase());

            const isTagalog = songLanguage.includes('tagalog') || songCategory.includes('tagalog') || songTags.some(t => t.includes('tagalog'));
            const isEnglish = songLanguage.includes('english') || songCategory.includes('english') || songTags.some(t => t.includes('english'));
            const isFast = songCategory.includes('fast') || songTags.some(t => t.includes('fast')) || (song.tempo && song.tempo >= 100);
            const isSlow = songCategory.includes('slow') || songTags.some(t => t.includes('slow')) || (song.tempo && song.tempo < 100);

            const songLyrics = (song.lyrics || '').toLowerCase();
            const cleanLyrics = song.lyrics ? stripChords(song.lyrics).toLowerCase() : '';

            let matchesLanguage = true;
            if (languageFilter === 'Tagalog') matchesLanguage = isTagalog;
            else if (languageFilter === 'English') matchesLanguage = isEnglish;

            let matchesTempo = true;
            if (tempoFilter === 'Fast') matchesTempo = isFast;
            else if (tempoFilter === 'Slow') matchesTempo = isSlow;

            const matchesSearch = !q || 
                songTitle.includes(q) || 
                songArtist.includes(q) || 
                songLyrics.includes(q) || 
                cleanLyrics.includes(q);
            return matchesLanguage && matchesTempo && matchesSearch;
        });

        return result.sort((a, b) => {
            const titleA = (a.title || '').toLowerCase();
            const titleB = (b.title || '').toLowerCase();
            return sortOrder === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
        });
    }, [songs, languageFilter, tempoFilter, search, sortOrder]);

    // Grouping
    const groupedSections = useMemo(() => {
        if (groupBy === 'none') {
            return [{ id: 'all', title: null, songs: filteredSongs }];
        }
        if (groupBy === 'alphabet') {
            const map = {};
            for (const s of filteredSongs) {
                const char = ((s.title || '').trim()[0] || '#').toUpperCase();
                const key = /[A-Z]/.test(char) ? char : '#';
                if (!map[key]) map[key] = [];
                map[key].push(s);
            }
            const keys = Object.keys(map).sort((a, b) => {
                if (a === '#') return 1;
                if (b === '#') return -1;
                return a.localeCompare(b);
            });
            return keys.map(k => ({
                id: k,
                letter: k,
                title: k,
                songs: map[k]
            }));
        }
        if (groupBy === 'tempo') {
            const fast = [];
            const slow = [];
            const other = [];
            for (const s of filteredSongs) {
                const cat = (s.category || '').toLowerCase();
                const tags = (s.tags || []).map(t => String(t || '').toLowerCase());
                const isFast = cat.includes('fast') || tags.some(t => t.includes('fast')) || (s.tempo && s.tempo >= 100);
                const isSlow = cat.includes('slow') || tags.some(t => t.includes('slow')) || (s.tempo && s.tempo < 100);
                if (isFast) fast.push(s);
                else if (isSlow) slow.push(s);
                else other.push(s);
            }
            const res = [];
            if (fast.length > 0) res.push({ id: 'fast', title: 'Fast Praise Songs', iconType: 'fast', songs: fast });
            if (slow.length > 0) res.push({ id: 'slow', title: 'Slow Worship Songs', iconType: 'slow', songs: slow });
            if (other.length > 0) res.push({ id: 'other', title: 'Other Songs', iconType: 'other', songs: other });
            return res;
        }
        if (groupBy === 'artist') {
            const map = {};
            for (const s of filteredSongs) {
                const artist = (s.artist || '').trim() || 'Unknown Artist';
                if (!map[artist]) map[artist] = [];
                map[artist].push(s);
            }
            const sortedArtists = Object.keys(map).sort((a, b) => a.localeCompare(b));
            return sortedArtists.map(artist => {
                const char = (artist[0] || '#').toUpperCase();
                const letter = /[A-Z]/.test(char) ? char : '#';
                return {
                    id: artist,
                    letter,
                    title: artist,
                    songs: map[artist]
                };
            });
        }
        return [{ id: 'all', title: null, songs: filteredSongs }];
    }, [filteredSongs, groupBy]);

    // Active letters
    const activeLetters = useMemo(() => {
        const set = new Set();
        for (const s of filteredSongs) {
            const target = groupBy === 'artist' ? (s.artist || '') : (s.title || '');
            const char = (target.trim()[0] || '#').toUpperCase();
            set.add(/[A-Z]/.test(char) ? char : '#');
        }
        return set;
    }, [filteredSongs, groupBy]);

    const scrollToLetter = (letter) => {
        let el = document.getElementById(`letter-${letter}`);
        if (!el) {
            const firstMatch = filteredSongs.find(s => {
                const target = groupBy === 'artist' ? (s.artist || '') : (s.title || '');
                const char = (target.trim()[0] || '#').toUpperCase();
                const cleanChar = /[A-Z]/.test(char) ? char : '#';
                return cleanChar >= letter;
            });
            if (firstMatch) {
                el = document.getElementById(`song-${firstMatch.id}`);
            }
        }
        if (el) {
            const yOffset = -(headerHeight + 8);
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
        }
    };

    const handleResetFilters = () => {
        haptic('light');
        setLanguageFilter('All');
        setTempoFilter('All');
        setGroupBy('alphabet');
    };

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-28 animate-pageEnter">
                {/* ===== HEADER ===== */}
                <header ref={headerRef} className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-5 pt-10 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />
                            
                            <div className="flex items-center gap-2">
                                <TopBarNotificationBell />
                                
                                <div className="flex items-center gap-1 text-xs text-textmuted bg-secondary border border-themed px-3 py-1.5 rounded-2xl">
                                    <Music className="w-3.5 h-3.5 text-accent" />
                                    <span className="font-bold text-textprimary">{filteredSongs.length}</span>
                                    <span>{filteredSongs.length === 1 ? 'Song' : 'Songs'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Search & Filter Bar */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search title, artist, or lyrics..."
                                    className="w-full bg-secondary border border-themed rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors text-textprimary min-h-[44px]"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-textmuted hover:text-textprimary p-1"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Filter Button */}
                            <button
                                onClick={() => {
                                    haptic('light');
                                    setShowFilters(f => !f);
                                }}
                                className={`px-3.5 rounded-2xl border-0 flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 min-h-[44px] relative active:scale-95 ${
                                    showFilters || isFilterActive
                                        ? 'bg-accent text-onaccent shadow-sm'
                                        : 'bg-secondary hover:bg-surface-hover text-textmuted hover:text-textprimary'
                                }`}
                                title="Filter Songs"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span className="hidden xs:inline">Filter</span>
                                {isFilterActive && (
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                                )}
                            </button>
                        </div>

                        {/* Collapsible Filter Panel */}
                        {showFilters && (
                            <div className="pt-2 border-t border-themed space-y-3 animate-fadeIn">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-textprimary uppercase tracking-wider flex items-center gap-1.5">
                                        <SlidersHorizontal className="w-3.5 h-3.5 text-accent" /> Filter & Grouping
                                    </span>
                                    {isFilterActive && (
                                        <button
                                            onClick={handleResetFilters}
                                            className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 active:scale-95"
                                        >
                                            <RotateCcw className="w-3 h-3" /> Reset
                                        </button>
                                    )}
                                </div>

                                {/* Group By */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider block">Group Songs By</span>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        {[
                                            { id: 'alphabet', label: 'Alphabet', icon: Type },
                                            { id: 'tempo', label: 'Fast/Slow', icon: Zap },
                                            { id: 'artist', label: 'Artist', icon: Mic },
                                            { id: 'none', label: 'Flat List', icon: List },
                                        ].map(group => {
                                            const Icon = group.icon;
                                            const isActive = groupBy === group.id;
                                            return (
                                                <button
                                                    key={group.id}
                                                    onClick={() => {
                                                        haptic('light');
                                                        setGroupBy(group.id);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-0 whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${
                                                        isActive
                                                            ? 'bg-accent text-onaccent font-bold shadow-sm shadow-accent/20'
                                                            : 'text-textmuted hover:text-textprimary bg-secondary hover:bg-surface-hover'
                                                    }`}
                                                >
                                                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-onaccent' : 'text-accent'}`} />
                                                    <span>{group.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Language Filter */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider block">Language</span>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        {['All', 'Tagalog', 'English'].map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => {
                                                    haptic('light');
                                                    setLanguageFilter(lang);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-0 whitespace-nowrap transition-all ${
                                                    languageFilter === lang
                                                        ? 'bg-accent text-onaccent font-bold shadow-sm shadow-accent/20'
                                                        : 'text-textmuted hover:text-textprimary bg-secondary hover:bg-surface-hover'
                                                }`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tempo Filter */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider block">Tempo</span>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        {['All', 'Fast', 'Slow'].map(tempo => (
                                            <button
                                                key={tempo}
                                                onClick={() => {
                                                    haptic('light');
                                                    setTempoFilter(tempo);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-0 whitespace-nowrap transition-all ${
                                                    tempoFilter === tempo
                                                        ? 'bg-accent text-onaccent font-bold shadow-sm shadow-accent/20'
                                                        : 'text-textmuted hover:text-textprimary bg-secondary hover:bg-surface-hover'
                                                }`}
                                            >
                                                {tempo}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </header>

                {/* ===== SONG LIST ===== */}
                <div className="relative max-w-5xl mx-auto">
                    <div className="px-5 sm:px-8 py-5 pr-9 sm:pr-12 space-y-6">
                        {songs === undefined ? (
                            <LibrarySkeletonCards />
                        ) : filteredSongs.length === 0 ? (
                            <div className="text-center py-20 bg-secondary/50 rounded-3xl border border-themed p-8">
                                <Music className="w-12 h-12 mx-auto text-textmuted/30 mb-4" />
                                <p className="text-textmuted text-sm font-medium">
                                    No songs found {search ? `for "${search}"` : `matching the selected filters`}
                                </p>
                            </div>
                        ) : (
                            groupedSections.map((section) => (
                                <div 
                                    key={section.id} 
                                    id={`letter-${section.letter || section.id}`} 
                                    className="space-y-1"
                                    style={{ scrollMarginTop: `${headerHeight + 10}px` }}
                                >
                                    {section.title && (
                                        <div 
                                            className="flex items-center justify-between sticky z-10 bg-primary/95 backdrop-blur-md py-2.5 px-3 border-b border-themed transition-[top] duration-150"
                                            style={{ top: `${headerHeight}px` }}
                                        >
                                            <span className="text-xs font-bold uppercase tracking-wider text-accent flex items-center gap-1.5">
                                                {section.iconType === 'fast' && <Zap className="w-3.5 h-3.5 text-amber-400" />}
                                                {section.iconType === 'slow' && <Clock className="w-3.5 h-3.5 text-blue-400" />}
                                                {section.iconType === 'other' && <Music className="w-3.5 h-3.5 text-accent" />}
                                                {groupBy === 'artist' && <Mic className="w-3.5 h-3.5 text-purple-400" />}
                                                <span>{section.title}</span>
                                            </span>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-textmuted font-semibold border border-themed">
                                                {section.songs.length}
                                            </span>
                                        </div>
                                    )}

                                    {/* Spotify-style Backgroundless List Items */}
                                    <div className="space-y-0.5">
                                        {section.songs.map((song, idx) => (
                                            <SpotifySongItem
                                                key={song.id}
                                                song={song}
                                                index={idx + 1}
                                                onClick={() => {
                                                    haptic('light');
                                                    navigate(`/song/${song.id}`);
                                                }}
                                                onQuickAdd={(e) => {
                                                    e.stopPropagation();
                                                    haptic('light');
                                                    setQuickAddSong(song);
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Alphabetical Scroll Bar */}
                    {filteredSongs.length > 0 && (
                        <AlphabeticalScrollBar
                            validLetters={activeLetters}
                            onLetterChange={scrollToLetter}
                            topOffset={headerHeight + 8}
                        />
                    )}
                </div>

                {/* ===== FAB BUTTON ===== */}
                {typeof document !== 'undefined' && createPortal(
                    <button
                        onClick={() => {
                            haptic('light');
                            setShowAddSongModal(true);
                        }}
                        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-24 right-5 sm:right-6 w-14 h-14 rounded-full bg-accent text-onaccent flex items-center justify-center shadow-2xl shadow-black/80 glow-accent z-30 min-w-[56px] min-h-[56px] active:scale-95 transition-transform"
                        title="Add New Song"
                    >
                        <Plus className="w-6 h-6 stroke-[3]" />
                    </button>,
                    document.body
                )}

                {/* ===== ADD SONG MODAL ===== */}
                {showAddSongModal && <AddSongModal onClose={() => setShowAddSongModal(false)} />}

                {/* ===== ADD SETLIST MODAL ===== */}
                {showAddSetlistModal && <AddSetlistModal onClose={() => setShowAddSetlistModal(false)} />}

                {/* ===== EDIT SONG MODAL ===== */}
                {editingSong && (
                    <EditSongModal
                        song={editingSong}
                        onClose={() => setEditingSong(null)}
                    />
                )}

                {/* ===== QUICK ADD TO SETLIST MODAL ===== */}
                {quickAddSong && (
                    <QuickAddToSetlistModal
                        song={quickAddSong}
                        upcomingSetlists={upcomingSetlists}
                        user={user}
                        onClose={() => setQuickAddSong(null)}
                        onCreateSetlist={() => {
                            setQuickAddSong(null);
                            setShowAddSetlistModal(true);
                        }}
                    />
                )}
            </div>
        </PullToRefresh>
    );
}

// ── Spotify-Style Minimalist Song Item ──
function SpotifySongItem({ song, index, onClick, onQuickAdd }) {
    return (
        <div
            id={`song-${song.id}`}
            onClick={onClick}
            className="group py-2.5 px-2.5 rounded-xl flex items-center gap-3 hover:bg-surface-hover active:bg-surface-active transition-colors cursor-pointer select-none"
        >
            {/* Plain track number without any box */}
            <span className="w-5 text-center text-xs font-semibold text-textmuted/60 group-hover:text-accent select-none shrink-0">
                {index}
            </span>

            {/* Song Title and Artist Metadata */}
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-textprimary truncate text-sm sm:text-base leading-snug group-hover:text-accent transition-colors">
                    {song.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-textmuted mt-0.5">
                    <span className="truncate max-w-[140px] sm:max-w-[220px]">
                        {song.artist || 'Unknown Artist'}
                    </span>
                    <span className="text-textmuted/40">•</span>
                    <span className="font-mono text-accent font-semibold">
                        Key {song.originalKey || song.currentKey || 'C'}
                    </span>
                    {song.category && (
                        <>
                            <span className="text-textmuted/40 hidden xs:inline">•</span>
                            <span className="hidden xs:inline text-textmuted/80">
                                {song.category}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Quick Add Action Button */}
            <button
                onClick={onQuickAdd}
                className="w-9 h-9 rounded-full text-textmuted hover:text-accent hover:bg-accent/15 flex items-center justify-center active:scale-90 transition-all shrink-0"
                title="Add to Worship Setlist"
            >
                <ListPlus className="w-4.5 h-4.5" />
            </button>
        </div>
    );
}


