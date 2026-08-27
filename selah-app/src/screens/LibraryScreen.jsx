import { useState, useMemo, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { songDB, setlistDB } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { Search, Plus, Music, Clock, ChevronRight, Trash2, ListPlus, LogOut, Calendar, X, SlidersHorizontal, RotateCcw, LayoutGrid, Layers, Mic, Type, Zap, List } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { pushSongToSupabase, pushSetlistToSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';
import EditSongModal from '../components/EditSongModal';
import AlphabeticalScrollBar from '../components/AlphabeticalScrollBar';
import { ModernSetlistCard, AddSetlistModal, PrintSetlistModal } from './SetlistScreen';
import { LibrarySkeletonCards } from '../components/SkeletonLoader';
import { KEYS, getKeyIndex } from '../utils/chords';
import { haptic } from '../utils/haptics';

const ALPHABET = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','#'];

export default function LibraryScreen() {
    const navigate = useNavigate();
    const { user } = useAuth();

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

    // Upcoming setlists
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
            if (!song) return false;
            const songTitle = (song.title || '').toLowerCase();
            const songArtist = (song.artist || '').toLowerCase();
            const songCategory = (song.category || '').toLowerCase();
            const songLanguage = (song.language || '').toLowerCase();
            const songTags = (song.tags || []).map(t => String(t || '').toLowerCase());

            const isTagalog = songLanguage.includes('tagalog') || songCategory.includes('tagalog') || songTags.some(t => t.includes('tagalog'));
            const isEnglish = songLanguage.includes('english') || songCategory.includes('english') || songTags.some(t => t.includes('english'));
            const isFast = songCategory.includes('fast') || songTags.some(t => t.includes('fast')) || (song.tempo && song.tempo >= 100);
            const isSlow = songCategory.includes('slow') || songTags.some(t => t.includes('slow')) || (song.tempo && song.tempo < 100);

            let matchesLanguage = true;
            if (languageFilter === 'Tagalog') matchesLanguage = isTagalog;
            else if (languageFilter === 'English') matchesLanguage = isEnglish;

            let matchesTempo = true;
            if (tempoFilter === 'Fast') matchesTempo = isFast;
            else if (tempoFilter === 'Slow') matchesTempo = isSlow;

            const matchesSearch = !q || songTitle.includes(q) || songArtist.includes(q);
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
            const yOffset = -140;
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
                <header className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-5 pt-10 pb-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />
                            <div className="flex items-center gap-1 text-xs text-textmuted bg-secondary border border-themed px-3 py-1.5 rounded-2xl">
                                <Music className="w-3.5 h-3.5 text-accent" />
                                <span className="font-bold text-textprimary">{filteredSongs.length}</span>
                                <span>{filteredSongs.length === 1 ? 'Song' : 'Songs'}</span>
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
                                    placeholder="Search song title, artist, or chords..."
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
                                className={`px-3.5 rounded-2xl border flex items-center gap-1.5 text-xs font-bold transition-all shrink-0 min-h-[44px] relative active:scale-95 ${
                                    showFilters || isFilterActive
                                        ? 'bg-accent/20 border-accent text-accent shadow-sm'
                                        : 'bg-secondary border-themed text-textmuted hover:text-textprimary'
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
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all flex items-center gap-1.5 active:scale-95 ${
                                                        isActive
                                                            ? 'bg-accent text-onaccent border-accent font-bold shadow-sm shadow-accent/20'
                                                            : 'border-themed text-textmuted hover:border-accent hover:text-textprimary bg-secondary'
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
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all ${
                                                    languageFilter === lang
                                                        ? 'bg-accent text-onaccent border-accent font-bold shadow-sm shadow-accent/20'
                                                        : 'border-themed text-textmuted hover:border-accent hover:text-textprimary bg-secondary'
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
                                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all ${
                                                    tempoFilter === tempo
                                                        ? 'bg-accent text-onaccent border-accent font-bold shadow-sm shadow-accent/20'
                                                        : 'border-themed text-textmuted hover:border-accent hover:text-textprimary bg-secondary'
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

                {/* ===== SPOTIFY-STYLE MINIMALIST SONG LIST ===== */}
                <div className="relative">
                    <div className="px-4 py-3 pr-9 sm:pr-10 space-y-6">
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
                                    className="space-y-1 scroll-mt-28"
                                >
                                    {section.title && (
                                        <div className="flex items-center justify-between sticky top-[138px] z-10 bg-primary/95 backdrop-blur-md py-1.5 px-2 border-b border-themed">
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
                            topOffset={showFilters ? 260 : 150}
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
                        className="fixed bottom-20 right-6 w-14 h-14 rounded-full bg-accent text-onaccent flex items-center justify-center shadow-xl shadow-accent/30 glow-accent z-30 min-w-[56px] min-h-[56px] active:scale-95 transition-transform"
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

// ── Redesigned Material 3 Expressive Add Song Modal ──
export function AddSongModal({ onClose }) {
    const { user } = useAuth();
    const [form, setForm] = useState({
        title: '',
        artist: '',
        originalKey: 'C',
        currentKey: 'C',
        tempo: 80,
        category: 'Fast',
        lyrics: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        haptic('light');
        try {
            const newSong = {
                id: crypto.randomUUID(),
                ...form,
                tempo: parseInt(form.tempo) || 80,
                dateAdded: new Date().toISOString(),
            };
            await songDB.add(newSong);
            await pushSongToSupabase(newSong, user);
            haptic('success');
            onClose();
        } catch (err) {
            console.error('Failed to add song:', err);
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Grab Handle Pill */}
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-themed shrink-0 bg-secondary/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                            <Music className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-textprimary">Add New Song</h3>
                            <p className="text-[11px] text-textmuted">Enter chords, lyrics & key details</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Fields */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Song Title</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g. King of Kings, Goodness of God"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Artist / Composer</label>
                        <input
                            type="text"
                            value={form.artist}
                            onChange={(e) => setForm({ ...form, artist: e.target.value })}
                            placeholder="e.g. Hillsong Worship, Bethel Music"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Key</label>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value, currentKey: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary font-mono"
                            >
                                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Tempo (BPM)</label>
                            <input
                                type="number"
                                value={form.tempo}
                                onChange={(e) => setForm({ ...form, tempo: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-2xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                            >
                                <option value="Fast">Fast</option>
                                <option value="Slow">Slow</option>
                                <option value="English">English</option>
                                <option value="Tagalog">Tagalog</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Lyrics & Chords</label>
                        <textarea
                            value={form.lyrics}
                            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                            rows="6"
                            placeholder="[Verse 1]&#10;[G]In the darkness we were [C]waiting..."
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none font-mono text-textprimary leading-relaxed"
                        />
                    </div>

                    <div className="flex gap-3 pt-2 shrink-0">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-3 text-xs font-bold border border-themed rounded-2xl hover:bg-surface-hover text-textmuted active:scale-95 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 text-xs font-bold bg-accent text-onaccent rounded-2xl hover:bg-accent/90 shadow-lg shadow-accent/20 active:scale-95 transition"
                        >
                            Save Song
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Redesigned Material 3 Quick Add to Setlist Modal ──
export function QuickAddToSetlistModal({ song, upcomingSetlists, user, onClose, onCreateSetlist }) {
    const [selectedKey, setSelectedKey] = useState(song.originalKey || song.currentKey || 'C');

    const transposeKey = (dir) => {
        haptic('light');
        const idx = getKeyIndex(selectedKey);
        let next = (idx + dir) % 12;
        if (next < 0) next += 12;
        setSelectedKey(KEYS[next]);
    };

    const handleAdd = async (setlist) => {
        haptic('light');
        const songIds = setlist.songIds || [];
        if (!songIds.includes(song.id)) {
            const updatedIds = [...songIds, song.id];
            const updatedKeys = { ...(setlist.songKeys || {}), [song.id]: selectedKey };
            await setlistDB.update(setlist.id, { songIds: updatedIds, songKeys: updatedKeys });
            await pushSetlistToSupabase({ ...setlist, songIds: updatedIds, songKeys: updatedKeys }, user);
        }
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                
                <div className="flex justify-between items-center px-6 py-3 border-b border-themed shrink-0 bg-secondary/40">
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-textprimary">Add to Worship Lineup</h3>
                        <p className="text-xs text-accent font-semibold truncate">{song.title}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-textmuted hover:text-textprimary rounded-xl">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Key Selector */}
                <div className="px-6 py-3 border-b border-themed flex items-center justify-between shrink-0 bg-secondary/20">
                    <span className="text-xs font-bold text-textmuted uppercase tracking-wider">Arrange Key</span>
                    <div className="flex items-center gap-1.5 bg-secondary rounded-2xl px-2 py-1 border border-themed">
                        <button
                            onClick={() => transposeKey(-1)}
                            className="w-7 h-7 rounded-xl bg-surface-hover active:bg-accent/20 text-sm font-bold text-textprimary flex items-center justify-center"
                        >−</button>
                        <span className="px-2.5 h-7 flex items-center justify-center text-xs font-bold font-mono text-accent min-w-[28px]">
                            {selectedKey}
                        </span>
                        <button
                            onClick={() => transposeKey(1)}
                            className="w-7 h-7 rounded-xl bg-surface-hover active:bg-accent/20 text-sm font-bold text-textprimary flex items-center justify-center"
                        >+</button>
                    </div>
                </div>

                <div className="p-4 space-y-2 overflow-y-auto flex-1 overscroll-contain">
                    {(!upcomingSetlists || upcomingSetlists.length === 0) ? (
                        <div className="text-center py-6 space-y-3">
                            <p className="text-textmuted text-xs">No upcoming setlists available</p>
                            <button
                                onClick={onCreateSetlist}
                                className="px-4 py-2.5 bg-accent text-onaccent rounded-2xl text-xs font-bold active:scale-95 transition"
                            >
                                Create New Setlist
                            </button>
                        </div>
                    ) : (
                        upcomingSetlists.map(setlist => (
                            <button
                                key={setlist.id}
                                onClick={() => handleAdd(setlist)}
                                className="w-full p-3.5 rounded-2xl bg-secondary border border-themed flex items-center justify-between text-left hover:border-accent active:scale-98 transition-all"
                            >
                                <div>
                                    <p className="font-semibold text-textprimary text-sm leading-tight">{setlist.title}</p>
                                    <p className="text-[11px] text-textmuted mt-0.5">{setlist.date || 'Undated'} • {setlist.songIds?.length || 0} songs</p>
                                </div>
                                <Plus className="w-4 h-4 text-accent shrink-0" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}