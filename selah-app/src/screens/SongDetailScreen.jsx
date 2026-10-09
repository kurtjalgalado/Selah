import { useState, useMemo, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { songDB, setlistDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics, transposeChord, stripChords, formatKey } from '../utils/chords';
import { parseLyrics, isChordLine, separateChords } from '../utils/lyrics';
import { CaretLeft as ChevronLeft, Plus, Minus, ListPlus, Trash as Trash2, PencilSimple as Edit3, Clock, Tag, Share, Play, Pause, CaretUp as ChevronUp, SlidersHorizontal, X, Printer, Lock, Shield, CornersOut as Maximize2, CornersIn as Minimize2 } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { UIContext } from '../App';
import { deleteSongFromSupabase, pushSetlistToSupabase } from '../supabase/sync';
import { useBackHandler } from '../utils/backHandler';
import EditSongModal from '../components/EditSongModal';
import QuickAddToSetlistModal from '../components/QuickAddToSetlistModal';
import ChordLineRenderer from '../components/ChordLineRenderer';
import PrintFrame from '../components/PrintFrame';
import { useStagePedals } from '../utils/useStagePedals';
import { haptic } from '../utils/haptics';
import { SongDetailSkeleton } from '../components/SkeletonLoader';

export default function SongDetailScreen() {
    const { user, profile, canManageSetlists, isSuperuser, isAdmin } = useAuth();
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryKey = searchParams.get('key');
    const querySetlistId = searchParams.get('setlistId');

    const [transposeAmount, setTransposeAmount] = useState(0);
    const [showChords, setShowChords] = useState(true);
    const [accidentalMode, setAccidentalMode] = useState(() => localStorage.getItem('selah_accidental_mode') || 'sharp');
    const [fontSize, setFontSize] = useState(16);
    const [showAddToSetlist, setShowAddToSetlist] = useState(false);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isStageMode, setIsStageMode] = useState(false);

    // Register all modals with LIFO back handler stack
    useBackHandler(showOptionsModal, () => setShowOptionsModal(false));
    useBackHandler(showPrintModal, () => setShowPrintModal(false));
    useBackHandler(showAddToSetlist, () => setShowAddToSetlist(false));
    useBackHandler(isEditing, () => setIsEditing(false));

    const toggleAccidentalMode = () => {
        const next = accidentalMode === 'sharp' ? 'flat' : 'sharp';
        setAccidentalMode(next);
        localStorage.setItem('selah_accidental_mode', next);
    };

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

    // Initialize transpose key from setlist, song's saved key, or query params
    useEffect(() => {
        if (!song) return;
        const targetKey = queryKey || (querySetlistId ? allSetlists?.find(s => String(s.id) === String(querySetlistId))?.songKeys?.[song.id] : (song.currentKey || null));
        if (targetKey) {
            const semitones = semitonesBetween(song.originalKey || 'C', targetKey);
            setTransposeAmount(semitones);
        }
    }, [song?.id, song?.originalKey, song?.currentKey, queryKey, querySetlistId, allSetlists]);

    const handleTranspose = async (delta) => {
        const nextAmount = transposeAmount + delta;
        setTransposeAmount(nextAmount);
        haptic('light');

        const origKey = song?.originalKey || 'C';
        const origIdx = getKeyIndex(origKey);
        const newKeyIdx = (origIdx + nextAmount + 120) % 12;
        const newKey = formatKey(KEYS[newKeyIdx], accidentalMode);

        // Persist transposed key to Dexie song table
        if (song?.id) {
            await songDB.update(song.id, { currentKey: newKey });
        }

        if (querySetlistId && song) {
            const targetSetlist = allSetlists?.find(s => String(s.id) === String(querySetlistId));
            if (targetSetlist) {
                const updatedKeys = { ...(targetSetlist.songKeys || {}), [song.id]: newKey };
                await setlistDB.update(targetSetlist.id, { songKeys: updatedKeys });
                if (user) {
                    await pushSetlistToSupabase({ ...targetSetlist, songKeys: updatedKeys }, user);
                }
            }
        }
    };

    const handleResetTranspose = async () => {
        setTransposeAmount(0);
        haptic('light');
        if (song?.id) {
            await songDB.update(song.id, { currentKey: song.originalKey || 'C' });
        }
        if (querySetlistId && song) {
            const origKey = song.originalKey || 'C';
            const targetSetlist = allSetlists?.find(s => String(s.id) === String(querySetlistId));
            if (targetSetlist) {
                const updatedKeys = { ...(targetSetlist.songKeys || {}), [song.id]: origKey };
                await setlistDB.update(targetSetlist.id, { songKeys: updatedKeys });
                if (user) {
                    await pushSetlistToSupabase({ ...targetSetlist, songKeys: updatedKeys }, user);
                }
            }
        }
    };

    // Bluetooth foot pedals and keyboard controls
    useStagePedals({
        onTogglePlay: () => {
            haptic('light');
            setIsAutoScrolling(p => !p);
        },
        onToggleStageMode: () => {
            haptic('light');
            setIsStageMode(p => !p);
        },
        onScrollDown: () => window.scrollBy({ top: window.innerHeight * 0.75, behavior: 'smooth' }),
        onScrollUp: () => window.scrollBy({ top: -window.innerHeight * 0.75, behavior: 'smooth' }),
        enabled: true,
    });

    // Current key calculation formatted with preferred accidental
    const currentKeyIdx = getKeyIndex(originalKey);
    const newKeyIdx = (currentKeyIdx + transposeAmount + 12) % 12;
    const currentKey = formatKey(KEYS[newKeyIdx], accidentalMode);

    // Transposed and accidental-formatted lyrics
    const displayLyrics = useMemo(() => {
        return transposeLyrics(lyrics, transposeAmount, accidentalMode);
    }, [lyrics, transposeAmount, accidentalMode]);

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
                            className="w-10 h-10 rounded-xl bg-secondary border-0 flex items-center justify-center text-textmuted hover:text-textprimary hover:bg-surface-hover shrink-0"
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
            {/* ===== DISTRACTION-FREE STAGE MODE FLOATING HUD PILL ===== */}
            {isStageMode && (
                <div className="fixed top-3 right-4 z-50 flex items-center gap-2 animate-fadeIn">
                    <div className="glass bg-elevated/95 border border-accent/40 rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className="font-bold text-textprimary max-w-[160px] truncate">
                            {song.title} • {currentKey}
                        </span>
                        <button
                            onClick={() => {
                                haptic('light');
                                setIsStageMode(false);
                            }}
                            className="w-6 h-6 rounded-full bg-accent/20 hover:bg-accent text-accent hover:text-onaccent flex items-center justify-center transition active:scale-90"
                            title="Exit Stage Mode (Press F or Tap)"
                        >
                            <Minimize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ===== MINIMALIST CLEAN HEADER (HIDDEN IN STAGE MODE) ===== */}
            {!isStageMode && (
                <header className="glass sticky top-0 z-20 border-b border-themed shadow-sm">
                    <div className="px-3 sm:px-4 pt-6 sm:pt-8 pb-3 flex items-center justify-between gap-2 sm:gap-3">
                        <button
                            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/library')}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-textprimary active:scale-95 transition-all shrink-0 border-0"
                            title="Back"
                            aria-label="Back"
                        >
                            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>

                        <div className="flex-1 min-w-0 px-1">
                            <h1 className="text-sm sm:text-base font-bold truncate leading-tight text-textprimary">{song.title}</h1>
                            <p className="text-[11px] sm:text-xs text-textmuted truncate mt-0.5">
                                {song.artist} • <span className="text-accent font-medium">{song.category}</span>
                            </p>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                            {/* Stage Mode Toggle */}
                            <button
                                onClick={() => {
                                    haptic('light');
                                    setIsStageMode(true);
                                }}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-accent active:scale-95 transition-all border-0"
                                title="Enter Full-Screen Stage Mode"
                                aria-label="Enter Stage Mode"
                            >
                                <Maximize2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                            </button>

                            {/* Edit Song Button (Direct on sm+, in Display Options on mobile) */}
                            <button
                                onClick={() => setIsEditing(true)}
                                className="hidden sm:flex w-10 h-10 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent items-center justify-center active:scale-95 transition-all border-0"
                                title="Edit Song Lyrics & Chords"
                                aria-label="Edit Song"
                            >
                                <Edit3 className="w-4.5 h-4.5" />
                            </button>

                            {/* Print Chord Chart Button (Direct on sm+, in Display Options on mobile) */}
                            <button
                                onClick={() => setShowPrintModal(true)}
                                className="hidden sm:flex w-10 h-10 rounded-xl bg-secondary hover:bg-surface-hover items-center justify-center text-textmuted hover:text-accent active:scale-95 transition-all border-0"
                                title="Print Chord Chart (Single Column)"
                                aria-label="Print Chord Chart"
                            >
                                <Printer className="w-4.5 h-4.5" />
                            </button>

                            {/* Add to Setlist Button */}
                            <button
                                onClick={() => {
                                    if (!user) {
                                        navigate('/login');
                                        return;
                                    }
                                    setShowAddToSetlist(true);
                                }}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-accent active:scale-95 transition-all border-0"
                                title="Add to Setlist"
                                aria-label="Add to Setlist"
                            >
                                <ListPlus className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                            </button>

                            {/* Display & Song Options */}
                            <button
                                onClick={() => setShowOptionsModal(true)}
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-secondary hover:bg-surface-hover flex items-center justify-center text-textmuted hover:text-accent active:scale-95 transition-all border-0"
                                title="Display Options"
                                aria-label="Display Options"
                            >
                                <SlidersHorizontal className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                            </button>
                        </div>
                    </div>
                </header>
            )}

            {/* ===== FLOATING STAGE DOCK (PORTALED DIRECTLY TO DOCUMENT.BODY) ===== */}
            {typeof document !== 'undefined' && createPortal(
                <div
                    data-no-print="true"
                    className="no-print print-hidden fixed bottom-3 sm:bottom-6 left-0 right-0 z-40 flex flex-col items-center pointer-events-none px-2 sm:px-4"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                    {/* Auto-Scroll Speed Selector Floating Pill */}
                    {isAutoScrolling && (
                        <div className="mb-2 pointer-events-auto bg-elevated/95 dark:bg-[#16161a]/95 backdrop-blur-2xl ring-1 ring-black/5 dark:ring-white/[0.08] shadow-[0_8px_30px_rgba(0,0,0,0.25)] rounded-full px-2.5 py-1 flex items-center gap-1.5 sm:gap-2 animate-slideUp text-xs">
                            <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider pl-1">Speed</span>
                            <div className="inline-flex rounded-full bg-surface-hover/70 dark:bg-white/[0.06] p-0.5">
                                {[1, 2, 3, 4].map(speed => (
                                    <button
                                        key={speed}
                                        onClick={() => {
                                            haptic('light');
                                            setScrollSpeed(speed);
                                        }}
                                        className={`w-6 sm:w-7 h-5 sm:h-6 rounded-full text-[10px] sm:text-[11px] font-bold transition-all ${
                                            scrollSpeed === speed
                                                ? 'bg-accent text-onaccent shadow-sm'
                                                : 'text-textmuted hover:text-textprimary'
                                        }`}
                                    >
                                        {speed}x
                                    </button>
                                ))}
                            </div>
                            <div className="h-3.5 w-px bg-themed dark:bg-white/[0.08]" />
                            <button
                                onClick={() => {
                                    haptic('light');
                                    scrollToTop();
                                }}
                                className="w-5 sm:w-6 h-5 sm:h-6 rounded-full bg-surface-hover/70 dark:bg-white/[0.06] hover:bg-surface-active dark:hover:bg-white/10 flex items-center justify-center text-textmuted hover:text-textprimary transition-colors active:scale-90"
                                title="Scroll to Top"
                                aria-label="Scroll to Top"
                            >
                                <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Apple HIG Floating Stage Pill Dock */}
                    <div className="pointer-events-auto max-w-full bg-elevated/95 dark:bg-[#16161a]/95 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-black/5 dark:ring-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.35)] rounded-full p-1 sm:p-1.5 flex items-center justify-between sm:justify-center gap-1 sm:gap-1.5">

                        {/* Segmented Key Transposer Stepper */}
                        <div className="inline-flex items-center rounded-full bg-surface-hover/70 dark:bg-white/[0.06] p-0.5 shrink-0">
                            <button
                                onClick={() => handleTranspose(-1)}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-textprimary hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 transition-all"
                                title="Transpose Down (Semitone)"
                                aria-label="Transpose Down"
                            >
                                <Minus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                            </button>
                            <div className="min-w-[32px] sm:min-w-[36px] h-8 sm:h-9 px-1.5 sm:px-2 flex items-center justify-center rounded-full bg-accent text-onaccent font-mono font-bold text-xs sm:text-sm shadow-sm select-none">
                                {currentKey}
                            </div>
                            <button
                                onClick={() => handleTranspose(1)}
                                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-textprimary hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 transition-all"
                                title="Transpose Up (Semitone)"
                                aria-label="Transpose Up"
                            >
                                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Flat / Sharp Accidental Toggle */}
                        <button
                            onClick={toggleAccidentalMode}
                            className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full text-xs font-bold transition-all flex items-center justify-center active:scale-95 shrink-0 ${
                                accidentalMode === 'sharp'
                                    ? 'bg-surface-hover/70 dark:bg-white/[0.06] text-accent hover:bg-surface-active dark:hover:bg-white/10'
                                    : 'bg-surface-hover/70 dark:bg-white/[0.06] text-amber-400 hover:bg-surface-active dark:hover:bg-white/10'
                            }`}
                            title={`Chord Notation: ${accidentalMode === 'sharp' ? 'Sharps (♯)' : 'Flats (♭)'}. Tap to switch.`}
                            aria-label="Toggle Flat or Sharp Notation"
                        >
                            <span className="text-xs sm:text-sm font-black leading-none">
                                {accidentalMode === 'sharp' ? '♯' : '♭'}
                            </span>
                        </button>

                        <div className="h-4 w-px bg-themed dark:bg-white/[0.08] shrink-0" />

                        {/* Chords Toggle Pill */}
                        <button
                            onClick={() => {
                                haptic('light');
                                setShowChords(!showChords);
                            }}
                            className={`h-8 sm:h-9 px-2 sm:px-3 rounded-full text-xs font-semibold transition-all flex items-center gap-1 active:scale-95 shrink-0 ${
                                showChords
                                    ? 'bg-accent/15 text-accent'
                                    : 'bg-surface-hover/70 dark:bg-white/[0.06] text-textmuted hover:text-textprimary hover:bg-surface-active dark:hover:bg-white/10'
                            }`}
                            title={showChords ? 'Hide Chords (Lyrics Only)' : 'Show Chords'}
                            aria-label="Toggle Chords Visibility"
                        >
                            <Tag className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] sm:text-xs font-semibold">Chords</span>
                        </button>

                        <div className="h-4 w-px bg-themed dark:bg-white/[0.08] shrink-0" />

                        {/* Auto-Scroll Action Pill */}
                        <button
                            onClick={() => {
                                haptic('light');
                                setIsAutoScrolling(!isAutoScrolling);
                            }}
                            className={`h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 shrink-0 ${
                                isAutoScrolling
                                    ? 'bg-accent text-onaccent shadow-md shadow-accent/25 animate-pulse'
                                    : 'bg-surface-hover/70 dark:bg-white/[0.06] text-textprimary hover:bg-surface-active dark:hover:bg-white/10'
                            }`}
                            title={isAutoScrolling ? 'Pause Auto-Scroll' : 'Start Auto-Scroll'}
                            aria-label="Toggle Auto-Scroll"
                        >
                            {isAutoScrolling ? (
                                <Pause className="w-3.5 h-3.5 fill-current shrink-0" />
                            ) : (
                                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                            )}
                            <span className="text-[11px] sm:text-xs font-semibold">
                                {isAutoScrolling ? 'Pause' : 'Scroll'}
                            </span>
                        </button>

                    </div>
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

                            {/* Chord Accidental Notation (Flats vs Sharps) */}
                            <div>
                                <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-2">
                                    Chord Notation (Flats vs Sharps)
                                </label>
                                <div className="grid grid-cols-2 gap-2 bg-secondary p-1 rounded-xl border border-themed">
                                    <button
                                        onClick={() => {
                                            setAccidentalMode('sharp');
                                            localStorage.setItem('selah_accidental_mode', 'sharp');
                                        }}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            accidentalMode === 'sharp'
                                                ? 'bg-accent text-onaccent shadow-sm'
                                                : 'text-textmuted hover:text-textprimary'
                                        }`}
                                    >
                                        <span className="text-sm font-bold">♯</span> Sharps (C♯, F♯, G♯)
                                    </button>
                                    <button
                                        onClick={() => {
                                            setAccidentalMode('flat');
                                            localStorage.setItem('selah_accidental_mode', 'flat');
                                        }}
                                        className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                                            accidentalMode === 'flat'
                                                ? 'bg-accent text-onaccent shadow-sm'
                                                : 'text-textmuted hover:text-textprimary'
                                        }`}
                                    >
                                        <span className="text-sm font-bold">♭</span> Flats (D♭, G♭, A♭)
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
                                        onClick={handleResetTranspose}
                                        className="min-h-[40px] px-3.5 py-1.5 bg-accent/15 text-accent rounded-xl text-xs font-bold active:bg-accent/30 flex items-center"
                                    >
                                        Reset to {originalKey}
                                    </button>
                                </div>
                            )}

                            {/* Print Song Button */}
                            <button
                                onClick={() => {
                                    setShowOptionsModal(false);
                                    setShowPrintModal(true);
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-secondary border-0 text-textprimary font-bold text-xs flex items-center justify-center gap-2 active:scale-98 hover:bg-surface-hover"
                            >
                                <Printer className="w-4 h-4 text-accent" /> Print Song Chord Chart (Single Column)
                            </button>

                            {/* Share & Delete Actions */}
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    onClick={handleShare}
                                    className="py-3 px-4 rounded-xl bg-secondary border-0 text-xs font-bold flex items-center justify-center gap-2 active:scale-98 hover:bg-surface-hover text-textprimary"
                                >
                                    <Share className="w-4 h-4 text-accent" /> Share Lyrics
                                </button>
                                <button
                                    onClick={() => { setShowOptionsModal(false); handleDelete(); }}
                                    className="py-3 px-4 rounded-xl bg-danger/10 text-danger border-0 text-xs font-bold flex items-center justify-center gap-2 active:scale-98 hover:bg-danger/20"
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

                            {/* Zero-Drift Tokenized Chord Lines */}
                            {section.lines.map((line, lIdx) => (
                                <ChordLineRenderer
                                    key={lIdx}
                                    line={line}
                                    fontSize={fontSize}
                                    showChords={showChords}
                                    chordColorClass="text-accent"
                                    lyricColorClass="text-textprimary"
                                />
                            ))}
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
                <QuickAddToSetlistModal
                    song={{ ...song, currentKey }}
                    user={user}
                    onClose={() => setShowAddToSetlist(false)}
                    onCreateSetlist={() => {
                        setShowAddToSetlist(false);
                        navigate('/setlists');
                    }}
                />
            )}
            {/* ===== QUICK PRINT SONG CHORD MODAL ===== */}
            {showPrintModal && (
                <SongPrintModal
                    song={song}
                    currentKey={currentKey}
                    originalKey={originalKey}
                    transposeAmount={transposeAmount}
                    accidentalMode={accidentalMode}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}

// ── Single Song Print Preview Modal (Single Column Layout) ──
export function SongPrintModal({ song, currentKey, originalKey, transposeAmount, accidentalMode = 'sharp', onClose }) {
    const [localAccidentalMode, setLocalAccidentalMode] = useState(accidentalMode);
    const semitones = transposeAmount || 0;
    const transposedLyrics = transposeLyrics(song?.lyrics || '', semitones, localAccidentalMode);
    const sections = parseLyrics(transposedLyrics);

    const formattedCurrentKey = formatKey(currentKey, localAccidentalMode);
    const formattedOrigKey = formatKey(originalKey || song?.key || 'C', localAccidentalMode);

    const toggleAccidentalMode = () => {
        const next = localAccidentalMode === 'sharp' ? 'flat' : 'sharp';
        setLocalAccidentalMode(next);
        try {
            localStorage.setItem('selah_accidental_mode', next);
        } catch (_) {}
    };

    const handlePrint = () => {
        try {
            const oldTitle = document.title;
            const jobTitle = `${song?.title || 'Song'} - ${formattedCurrentKey}`;
            document.title = jobTitle;
            if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
                window.AndroidPrint.print();
            } else if (typeof window.print === 'function') {
                window.print();
            } else {
                alert('Printing is not supported on this device. Please use a web browser to print or export as PDF.');
            }
            setTimeout(() => {
                document.title = oldTitle;
            }, 1000);
        } catch (e) {
            console.error('Print error:', e);
            alert('Failed to trigger print: ' + (e?.message || e));
        }
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto p-3 sm:p-6 flex flex-col items-center animate-fadeIn print-modal-backdrop">
            {/* Solid Opaque High-Contrast Action Bar */}
            <div className="sticky top-2 sm:top-4 z-50 w-full max-w-3xl bg-zinc-900 border border-zinc-700/80 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden print-hidden">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
                        <Printer className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">{song?.title}</h3>
                        <p className="text-[11px] text-zinc-400 truncate">
                            Key: {formattedCurrentKey} • A4 Printable Chord Chart
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 ml-auto">
                    {/* Flat / Sharp Accidental Toggle */}
                    <button
                        onClick={toggleAccidentalMode}
                        className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                            localAccidentalMode === 'sharp'
                                ? 'bg-zinc-800 text-accent border-zinc-700 hover:border-accent/40 shadow-sm'
                                : 'bg-zinc-800 text-amber-400 border-zinc-700 hover:border-amber-400/40 shadow-sm'
                        }`}
                        title={`Chord Notation: ${localAccidentalMode === 'sharp' ? 'Sharps (♯)' : 'Flats (♭)'}. Tap to toggle.`}
                    >
                        <span className={localAccidentalMode === 'flat' ? 'font-black text-amber-400 text-sm' : 'text-zinc-500'}>♭</span>
                        <span className="text-zinc-600 font-mono text-[10px]">/</span>
                        <span className={localAccidentalMode === 'sharp' ? 'font-black text-accent text-sm' : 'text-zinc-500'}>♯</span>
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-4 h-10 rounded-xl bg-accent text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-95 transition-all"
                        title="Print / Save PDF"
                    >
                        <Printer className="w-4 h-4 fill-current" />
                        <span>Print Chart</span>
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-700 transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Adaptable Single Column Printable Document */}
            <div className="printable-wrapper w-full max-w-3xl print:max-w-none flex flex-col items-center">
                <PrintFrame>
                    <div className="print-sheet a4-page bg-white text-black p-6 sm:p-10 rounded-xl shadow-2xl w-full max-w-[210mm] text-left flex flex-col justify-between box-border">
                        <div>
                            {/* Song Header */}
                            <div className="border-b-2 border-black pb-3 mb-4 flex justify-between items-start shrink-0">
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-black uppercase tracking-wide break-words">
                                        {song?.title}
                                    </h1>
                                    {song?.artist && (
                                        <p className="text-xs text-gray-700 mt-1 font-medium">
                                            {song.artist}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right shrink-0 ml-4">
                                    <span className="px-3 py-1.5 bg-black text-white rounded-lg font-bold text-sm inline-block shadow-sm">
                                        Key: {formattedCurrentKey}
                                    </span>
                                    {formattedCurrentKey !== formattedOrigKey && (
                                        <p className="text-[10px] text-gray-500 mt-1">Orig: {formattedOrigKey}</p>
                                    )}
                                </div>
                            </div>

                            {/* Single Column Chords & Lyrics */}
                            <div className="space-y-4 text-[13px] leading-relaxed w-full">
                                {sections.map((sec, sIdx) => (
                                    <div key={sIdx} className="song-section print-keep mb-4">
                                        <div className="font-bold text-xs uppercase tracking-wider text-amber-900 border-b border-gray-200 pb-0.5 mb-2">
                                            {sec.label}
                                        </div>
                                        <div className="space-y-1">
                                            {sec.lines.map((line, lIdx) => (
                                                <ChordLineRenderer
                                                    key={lIdx}
                                                    line={line}
                                                    fontSize={13}
                                                    showChords={true}
                                                    chordColorClass="text-amber-950 font-black"
                                                    lyricColorClass="text-gray-900"
                                                    isPrint={true}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </PrintFrame>
            </div>
        </div>
    );

    const printMount = typeof document !== 'undefined'
        ? (document.getElementById('print-root') || document.body)
        : null;

    if (!printMount) return modalContent;
    return createPortal(modalContent, printMount);
}