import { useState, useMemo, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { songDB, setlistDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics, transposeChord, stripChords } from '../utils/chords';
import { parseLyrics, isChordLine, separateChords } from '../utils/lyrics';
import { ChevronLeft, Plus, Minus, ListPlus, Trash2, Edit3, Clock, Tag, Share, Play, Pause, ChevronUp, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UIContext } from '../App';
import { deleteSongFromSupabase, pushSetlistToSupabase } from '../supabase/sync';
import EditSongModal from '../components/EditSongModal';
import { SongDetailSkeleton } from '../components/SkeletonLoader';

export default function SongDetailScreen() {
    const { user } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();

    const [transposeAmount, setTransposeAmount] = useState(0);
    const [showChords, setShowChords] = useState(true);
    const [fontSize, setFontSize] = useState(16);
    const [showAddToSetlist, setShowAddToSetlist] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Auto-scroll logic
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(1);

    // Fetch song from Dexie reactive cache
    const { songs: cachedSongs, setlists: allSetlists } = useSongCache();

    // Fast sync lookup from cache, fallback to async db query for scraped fallback
    const [asyncSong, setAsyncSong] = useState(undefined);

    const songFromCache = useMemo(() => {
        if (!cachedSongs || cachedSongs.length === 0) return undefined;
        return cachedSongs.find(s => String(s.id) === String(id));
    }, [cachedSongs, id]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [id]);

    useEffect(() => {
        if (songFromCache === undefined) {
            getSongByIdOrTitle(id).then(found => setAsyncSong(found || null));
        }
    }, [id, songFromCache]);

    const song = songFromCache !== undefined ? songFromCache : asyncSong;

    const lyrics = song?.lyrics || '';
    const originalKey = song?.originalKey || 'C';

    // Current key calculation
    const currentKeyIdx = getKeyIndex(originalKey);
    const newKeyIdx = (currentKeyIdx + transposeAmount + 12) % 12;
    const currentKey = KEYS[newKeyIdx];

    // Transposed lyrics
    const displayLyrics = useMemo(() => {
        if (transposeAmount === 0) return lyrics;
        return transposeLyrics(lyrics, transposeAmount);
    }, [lyrics, transposeAmount]);

    // Parsed sections
    const sections = useMemo(() => parseLyrics(displayLyrics), [displayLyrics]);

    // Auto-scroll smooth interval
    useEffect(() => {
        if (!isAutoScrolling) return;

        const interval = setInterval(() => {
            window.scrollBy({ top: scrollSpeed, behavior: 'smooth' });

            // Stop at bottom of page
            if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 15)) {
                setIsAutoScrolling(false);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [isAutoScrolling, scrollSpeed]);

    // Lock body scroll when any modal/sheet is open
    useEffect(() => {
        if (showOptionsModal || showAddToSetlist || isEditing) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [showOptionsModal, showAddToSetlist, isEditing]);

    // Loading state while Dexie query resolves (header remains visible)
    if (song === undefined) {
        return (
            <div className="min-h-screen bg-primary pb-28 animate-fadeIn">
                <header className="glass sticky top-0 z-20 border-b border-themed">
                    <div className="px-4 pt-8 pb-3 flex items-center justify-between gap-3">
                        <button
                            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/library')}
                            className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-textprimary shrink-0"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        <div className="flex-1 min-w-0 px-1 space-y-1">
                            <div className="w-1/3 h-4 bg-secondary/70 animate-pulse rounded" />
                            <div className="w-1/5 h-3 bg-secondary/70 animate-pulse rounded opacity-70" />
                        </div>
                    </div>
                </header>
                <SongDetailSkeleton />
            </div>
        );
    }

    // Not found state after query completes
    if (song === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-primary">
                <div className="text-center">
                    <p className="text-textmuted">Song not found</p>
                    <button onClick={() => navigate('/library')} className="text-accent mt-4 text-sm font-medium">
                        Back to Library
                    </button>
                </div>
            </div>
        );
    }

    const handleDelete = async () => {
        if (confirm(`Delete "${song.title}"?`)) {
            await songDB.delete(song.id);
            await deleteSongFromSupabase(song.id, user);
            navigate('/library');
        }
    };

    const handleAddToSetlist = async (setlistId) => {
        const setlist = allSetlists?.find(s => s.id === setlistId);
        if (setlist) {
            const songIds = [...(setlist.songIds || []), song.id];
            await setlistDB.update(setlistId, { songIds });
            await pushSetlistToSupabase({ ...setlist, songIds }, user);
        }
        setShowAddToSetlist(false);
        navigate('/setlists');
    };

    const handleShare = async () => {
        const cleanLyricsText = stripChords(displayLyrics);
        const text = `${song.title} by ${song.artist}\nKey: ${currentKey}\nTempo: ${song.tempo ? `${song.tempo} BPM` : 'N/A'}\n\n${cleanLyricsText}`;
        if (navigator.share) {
            try {
                await navigator.share({ title: song.title, text });
            } catch (e) { /* user cancelled */ }
        } else {
            try {
                await navigator.clipboard.writeText(text);
                alert('Lyrics copied to clipboard (chords excluded)!');
            } catch (e) {
                // Clipboard fallback
            }
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-primary animate-pageEnter" style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}>
            {/* ===== MINIMALIST CLEAN HEADER ===== */}
            <header className="glass sticky top-0 z-20 border-b border-themed shadow-lg">
                <div className="px-4 pt-8 pb-3 flex items-center justify-between gap-3">
                    <button
                        onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/library')}
                        className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-textprimary shrink-0"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </button>

                    <div className="flex-1 min-w-0 px-1">
                        <h1 className="text-base font-bold truncate leading-tight text-textprimary">{song.title}</h1>
                        <p className="text-xs text-textmuted truncate mt-0.5">
                            {song.artist} • <span className="text-accent font-medium">{song.category}</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {/* Edit Song Button */}
                        <button
                            onClick={() => setIsEditing(true)}
                            className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center active:scale-95 transition-all"
                            title="Edit Song Lyrics & Chords"
                        >
                            <Edit3 className="w-4.5 h-4.5" />
                        </button>

                        <button
                            onClick={() => setShowAddToSetlist(true)}
                            className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-accent"
                            title="Add to Setlist"
                        >
                            <ListPlus className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setShowOptionsModal(true)}
                            className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-accent"
                            title="Display Options"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ===== FLOATING STAGE DOCK (PORTALED DIRECTLY TO DOCUMENT.BODY) ===== */}
            {typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed left-4 right-4 max-w-lg mx-auto z-40 transition-all duration-300 pointer-events-auto"
                    style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <div className="glass bg-elevated border border-themed p-2 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2">

                        {/* Left: Key Transposer */}
                        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 border border-themed">
                            <button
                                onClick={() => setTransposeAmount(t => t - 1)}
                                className="w-10 h-10 rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-base font-bold text-textprimary"
                                title="Transpose Down"
                            >
                                −
                            </button>
                            <div className="px-3 h-10 flex items-center justify-center rounded-lg bg-accent text-onaccent font-bold text-sm min-w-[42px]">
                                {currentKey}
                            </div>
                            <button
                                onClick={() => setTransposeAmount(t => t + 1)}
                                className="w-10 h-10 rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-base font-bold text-textprimary"
                                title="Transpose Up"
                            >
                                +
                            </button>
                        </div>

                        <div className="h-6 w-px bg-themed" />

                        {/* Middle: Chords Toggle */}
                        <button
                            onClick={() => setShowChords(!showChords)}
                            className={`h-10 px-3.5 rounded-xl text-xs font-bold uppercase border transition-all flex items-center gap-1.5 ${
                                showChords
                                    ? 'bg-accent/20 text-accent border-accent/40 shadow-sm'
                                    : 'bg-secondary text-textmuted border-themed'
                            }`}
                        >
                            <Tag className="w-3.5 h-3.5" />
                            {showChords ? 'Chords ON' : 'Chords OFF'}
                        </button>

                        <div className="h-6 w-px bg-themed" />

                        {/* Right: Auto Scroll Play/Pause */}
                        <button
                            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
                            className={`h-10 px-4 rounded-xl text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                                isAutoScrolling
                                    ? 'bg-accent text-onaccent shadow-lg shadow-accent/30 animate-pulse'
                                    : 'bg-secondary text-textprimary active:bg-surface-active border border-themed'
                            }`}
                        >
                            {isAutoScrolling ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                            <span>{isAutoScrolling ? 'Pause' : 'Scroll'}</span>
                        </button>
                    </div>

                    {/* Expanded Auto-Scroll Speed Selector */}
                    {isAutoScrolling && (
                        <div className="mt-2 glass bg-elevated border border-accent/40 p-2 rounded-xl shadow-xl flex items-center justify-between px-4 animate-slideUp text-xs">
                            <span className="text-[11px] font-bold text-textmuted uppercase tracking-wider">Scroll Speed:</span>
                            <div className="flex items-center gap-1.5">
                                {[1, 2, 3, 4].map(speed => (
                                    <button
                                        key={speed}
                                        onClick={() => setScrollSpeed(speed)}
                                        className={`w-9 h-8 rounded-lg text-xs font-bold transition-colors ${
                                            scrollSpeed === speed ? 'bg-accent text-onaccent font-extrabold shadow-sm' : 'bg-secondary text-textmuted'
                                        }`}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={scrollToTop}
                                className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-textmuted hover:text-textprimary ml-2"
                                title="Scroll to Top"
                            >
                                <ChevronUp className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>,
                document.body
            )}

            {/* ===== DISPLAY OPTIONS MODAL DRAWER ===== */}
            {showOptionsModal && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                    onClick={() => setShowOptionsModal(false)}
                >
                    <div 
                        className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-lg shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                        <div className="flex justify-between items-center px-6 py-3.5 border-b border-themed shrink-0">
                            <h3 className="text-base font-bold flex items-center gap-2 text-textprimary">
                                <SlidersHorizontal className="w-5 h-5 text-accent" /> Display Options
                            </h3>
                            <button onClick={() => setShowOptionsModal(false)} className="text-textmuted hover:text-textprimary p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
                            {/* Edit Song Button inside Display Options */}
                            <button
                                onClick={() => {
                                    setShowOptionsModal(false);
                                    setIsEditing(true);
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center gap-2 active:scale-98"
                            >
                                <Edit3 className="w-4 h-4" /> Edit Song Lyrics & Chords
                            </button>

                            {/* Font Size Adjuster */}
                            <div>
                                <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-2">
                                    Font Size ({fontSize}px)
                                </label>
                                <div className="flex items-center gap-3 bg-secondary rounded-xl p-2 border border-themed">
                                    <button
                                        onClick={() => setFontSize(s => Math.max(12, s - 2))}
                                        className="w-11 h-11 rounded-lg bg-surface-hover active:bg-surface-active flex items-center justify-center text-sm font-bold text-textprimary"
                                    >
                                        A−
                                    </button>
                                    <input
                                        type="range"
                                        min="12"
                                        max="26"
                                        step="2"
                                        value={fontSize}
                                        onChange={(e) => setFontSize(Number(e.target.value))}
                                        className="flex-1 accent-accent h-2 bg-secondary rounded-lg cursor-pointer"
                                    />
                                    <button
                                        onClick={() => setFontSize(s => Math.min(26, s + 2))}
                                        className="w-11 h-11 rounded-lg bg-surface-hover active:bg-surface-active flex items-center justify-center text-sm font-bold text-textprimary"
                                    >
                                        A+
                                    </button>
                                </div>
                            </div>

                            {/* Reset Key Transposition */}
                            {transposeAmount !== 0 && (
                                <div className="flex items-center justify-between bg-secondary rounded-xl p-3 border border-themed">
                                    <span className="text-xs text-textmuted">
                                        Transposed: {originalKey} → <span className="font-bold text-accent">{currentKey}</span>
                                    </span>
                                    <button
                                        onClick={() => setTransposeAmount(0)}
                                        className="px-3 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-bold active:bg-accent/30"
                                    >
                                        Reset to {originalKey}
                                    </button>
                                </div>
                            )}

                            {/* Share & Delete Actions */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={handleShare}
                                    className="py-3 px-4 rounded-xl border border-themed text-xs font-bold flex items-center justify-center gap-2 active:bg-surface-hover text-textprimary"
                                >
                                    <Share className="w-4 h-4 text-accent" /> Share Lyrics
                                </button>
                                <button
                                    onClick={() => { setShowOptionsModal(false); handleDelete(); }}
                                    className="py-3 px-4 rounded-xl border border-danger/30 text-danger text-xs font-bold flex items-center justify-center gap-2 active:bg-danger/10"
                                >
                                    <Trash2 className="w-4 h-4" /> Delete Song
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===== LYRICS DISPLAY ===== */}
            <div className="px-5 py-6" style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}>
                {sections.length === 0 ? (
                    displayLyrics ? (
                        <pre className="text-textprimary whitespace-pre-wrap font-sans leading-relaxed">
                            {showChords ? displayLyrics : displayLyrics.replace(/\[[^\]]+\]/g, '')}
                        </pre>
                    ) : (
                        <p className="text-textmuted text-center py-8">No lyrics added yet.</p>
                    )
                ) : (
                    sections.map((section, sIdx) => (
                        <div key={sIdx} className="mb-6">
                            {/* Section Label */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className={`text-xs font-bold uppercase tracking-wider ${section.type === 'chorus' ? 'text-accent' : 'text-textmuted'}`}>
                                    {section.label}
                                </span>
                                <div className="flex-1 h-px bg-themed" />
                            </div>

                            {/* Lines */}
                            {section.lines.map((line, lIdx) => {
                                const cleanLyricLine = line.replace(/\[[^\]]+\]/g, '').trim();

                                if (!showChords || !isChordLine(line)) {
                                    // Pure lyrics line
                                    return (
                                        <p key={lIdx} className="text-textprimary whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
                                            {cleanLyricLine || line || '\u00A0'}
                                        </p>
                                    );
                                }

                                // Chord line
                                const { chordLine, lyricLine } = separateChords(line);
                                return (
                                    <div key={lIdx} className="mb-2">
                                        <pre
                                            className="text-accent font-mono font-extrabold whitespace-pre-wrap leading-tight tracking-wide drop-shadow-sm"
                                            style={{ fontSize: `${Math.round(fontSize * 1.30)}px` }}
                                        >
                                            {chordLine}
                                        </pre>
                                        <p
                                            className="text-textprimary whitespace-pre-wrap leading-snug"
                                            style={{ fontSize: `${fontSize}px` }}
                                        >
                                            {lyricLine || '\u00A0'}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ))
                )}
            </div>

            {/* EDIT SONG MODAL */}
            {isEditing && (
                <EditSongModal
                    song={song}
                    onClose={() => setIsEditing(false)}
                />
            )}

            {/* ===== ADD TO SETLIST MODAL ===== */}
            {showAddToSetlist && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                    onClick={() => setShowAddToSetlist(false)}
                >
                    <div 
                        className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-lg shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                        <div className="flex justify-between items-center px-6 py-3.5 border-b border-themed shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-textprimary">Add to Setlist</h3>
                                <p className="text-xs text-accent truncate">{song.title}</p>
                            </div>
                            <button onClick={() => setShowAddToSetlist(false)} className="text-textmuted hover:text-textprimary p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2 overflow-y-auto flex-1 overscroll-contain">
                            {allSetlists?.length === 0 ? (
                                <p className="text-center text-textmuted text-sm py-4">No upcoming setlists available</p>
                            ) : (
                                allSetlists?.map(sl => (
                                    <button
                                        key={sl.id}
                                        onClick={() => handleAddToSetlist(sl.id)}
                                        className="w-full text-left p-3 bg-secondary rounded-xl border border-themed active:border-accent hover:border-accent transition-colors"
                                    >
                                        <p className="font-medium text-sm text-textprimary">{sl.title}</p>
                                        <p className="text-xs text-textmuted mt-0.5">
                                            {sl.date || 'No date'} • {sl.songIds?.length || 0} songs
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="p-4 border-t border-themed shrink-0">
                            <button
                                onClick={() => setShowAddToSetlist(false)}
                                className="w-full py-2.5 text-sm border border-themed rounded-xl active:bg-surface-hover text-textmuted"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}