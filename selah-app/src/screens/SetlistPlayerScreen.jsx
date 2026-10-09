import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { setlistDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics, formatKey, FLAT_KEYS, SHARP_KEYS } from '../utils/chords';
import { parseLyrics } from '../utils/lyrics';
import { useAuth } from '../auth/AuthContext';
import { pushSetlistToSupabase } from '../supabase/sync';
import ChordLineRenderer from '../components/ChordLineRenderer';
import { useStagePedals } from '../utils/useStagePedals';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';
import {
    CaretLeft as ChevronLeft, CaretRight as ChevronRight, Play, Pause, CaretUp as ChevronUp, Tag, SlidersHorizontal,
    X, MusicNotes as Music, CalendarBlank as Calendar, Clock, SpeakerHigh as Volume2, Stack as Layers, List, CornersOut as Maximize2, CornersIn as Minimize2, SkipBack, SkipForward
} from '@phosphor-icons/react';

export default function SetlistPlayerScreen() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [fontSize, setFontSize] = useState(16);
    const [showChords, setShowChords] = useState(true);
    const [accidentalMode, setAccidentalMode] = useState(() => localStorage.getItem('selah_accidental_mode') || 'sharp');
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(2);
    const [showOptionsModal, setShowOptionsModal] = useState(false);
    const [isStageMode, setIsStageMode] = useState(false);
    const [activeSongIndex, setActiveSongIndex] = useState(0);

    // Register modals and stage mode with LIFO back handler stack
    useBackHandler(showOptionsModal, () => setShowOptionsModal(false));
    useBackHandler(isStageMode, () => setIsStageMode(false));

    const toggleAccidentalMode = () => {
        const next = accidentalMode === 'sharp' ? 'flat' : 'sharp';
        setAccidentalMode(next);
        localStorage.setItem('selah_accidental_mode', next);
    };

    const songRefs = useRef({});

    // Fetch setlist from cache
    const { songs: allSongs, setlists } = useSongCache();
    const setlist = setlists?.find(s => s.id == id);

    // Live state of setlist songs with fallback to local seed
    const [loadedSongs, setLoadedSongs] = useState([]);

    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }, [id]);

    useEffect(() => {
        if (!setlist || !setlist.songIds) return;
        let isMounted = true;

        async function fetchAllSetlistSongs() {
            const results = await Promise.all(
                (setlist.songIds || []).map(async (sId) => {
                    const songObj = await getSongByIdOrTitle(sId);
                    return songObj;
                })
            );
            if (isMounted) {
                setLoadedSongs(results.filter(Boolean));
            }
        }

        fetchAllSetlistSongs();
        return () => { isMounted = false; };
    }, [setlist?.songIds?.join(','), allSongs]);

    // Auto-scroll loop
    useEffect(() => {
        if (!isAutoScrolling) return;

        const interval = setInterval(() => {
            window.scrollBy({ top: scrollSpeed, behavior: 'smooth' });

            if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 15)) {
                setIsAutoScrolling(false);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [isAutoScrolling, scrollSpeed]);

    // Lock body scroll when options modal is open
    useEffect(() => {
        if (showOptionsModal) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [showOptionsModal]);

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-primary p-6 text-center">
                <div className="bg-elevated border border-themed rounded-3xl p-8 max-w-sm w-full space-y-4 shadow-xl">
                    <h2 className="text-lg font-bold text-textprimary">Sign In Required</h2>
                    <p className="text-textmuted text-xs leading-relaxed">Please sign in with your account to access and launch live worship setlists.</p>
                    <button onClick={() => navigate('/login')} className="w-full py-3 bg-accent text-onaccent font-bold rounded-xl text-xs shadow-md active:scale-95 transition">
                        Sign In to Selah
                    </button>
                </div>
            </div>
        );
    }

    if (setlist === undefined) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-primary">
                <div className="text-center">
                    <h1 className="text-2xl font-serif font-bold text-accent animate-pulse">Selah</h1>
                    <p className="text-textmuted text-xs mt-2 uppercase tracking-widest">Loading Setlist Player...</p>
                </div>
            </div>
        );
    }

    if (setlist === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-primary p-4 text-center">
                <div>
                    <p className="text-textmuted mb-4">Setlist not found</p>
                    <button onClick={() => navigate('/setlists')} className="px-4 py-2 bg-accent text-onaccent font-bold rounded-xl text-xs">
                        Back to Setlists
                    </button>
                </div>
            </div>
        );
    }

    const songKeys = setlist.songKeys || {};

    const handleSetSongKey = async (songId, newKey) => {
        const updatedKeys = { ...songKeys, [songId]: newKey };
        await setlistDB.update(setlist.id, { songKeys: updatedKeys });
        await pushSetlistToSupabase({ ...setlist, songKeys: updatedKeys }, user);
    };

    const scrollToSong = useCallback((index) => {
        if (index < 0 || index >= loadedSongs.length) return;
        setActiveSongIndex(index);
        const el = songRefs.current[index];
        if (el) {
            const yOffset = isStageMode ? -24 : -90; // Header offset
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
        haptic('light');
    }, [loadedSongs.length, isStageMode]);

    // Active song tracking via viewport intersection
    useEffect(() => {
        if (!loadedSongs.length) return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const idx = Number(entry.target.getAttribute('data-song-idx'));
                    if (!isNaN(idx)) setActiveSongIndex(idx);
                }
            });
        }, { rootMargin: '-20% 0px -55% 0px' });

        Object.values(songRefs.current).forEach(el => {
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [loadedSongs]);

    // Foot pedal and keyboard shortcuts for live performance
    useStagePedals({
        onNext: () => scrollToSong(Math.min(loadedSongs.length - 1, activeSongIndex + 1)),
        onPrev: () => scrollToSong(Math.max(0, activeSongIndex - 1)),
        onTogglePlay: () => {
            haptic('light');
            setIsAutoScrolling(p => !p);
        },
        onToggleStageMode: () => {
            haptic('light');
            setIsStageMode(p => !p);
        },
        enabled: true,
    });

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div
            className="min-h-screen bg-primary animate-pageEnter select-text"
            style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}
        >
            {/* ===== DISTRACTION-FREE STAGE MODE FLOATING HUD PILL ===== */}
            {isStageMode && (
                <div className="fixed top-3 right-4 z-50 flex items-center gap-2 animate-fadeIn">
                    <div className="glass bg-elevated/95 border border-accent/40 rounded-full px-3.5 py-1.5 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        <span className="font-bold text-textprimary max-w-[150px] sm:max-w-[220px] truncate">
                            #{activeSongIndex + 1} {loadedSongs[activeSongIndex]?.title}
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

            {/* ===== STAGE HEADER (HIDDEN IN STAGE MODE) ===== */}
            {!isStageMode && (
                <header className="glass sticky top-0 z-30 border-b border-themed shadow-2xl backdrop-blur-xl">
                    <div className="px-4 pt-8 pb-3">
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/setlists')}
                                className="w-10 h-10 rounded-xl bg-secondary border-0 flex items-center justify-center text-textmuted hover:text-textprimary hover:bg-surface-hover shrink-0"
                                title="Back"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-full bg-accent/20 text-[9px] font-bold text-accent uppercase tracking-wider shrink-0 animate-pulse">
                                        LIVE PLAYER
                                    </span>
                                    <h1 className="text-base font-bold truncate leading-tight text-textprimary">{setlist.title}</h1>
                                </div>
                                <p className="text-xs text-textmuted truncate mt-0.5">
                                    {setlist.date || 'Undated'} • <span className="text-accent font-medium">{loadedSongs.length} Songs</span> • by <strong className="text-textprimary">{setlist.preparedBy || 'Worship Leader'}</strong>
                                </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={() => {
                                        haptic('light');
                                        setIsStageMode(true);
                                    }}
                                    className="w-10 h-10 rounded-xl bg-secondary border-0 flex items-center justify-center text-textmuted hover:text-accent hover:bg-surface-hover active:scale-95"
                                    title="Enter Full-Screen Stage Mode"
                                >
                                    <Maximize2 className="w-4.5 h-4.5" />
                                </button>

                                <button
                                    onClick={() => setShowOptionsModal(true)}
                                    className="w-10 h-10 rounded-xl bg-secondary border-0 flex items-center justify-center text-textmuted hover:text-accent hover:bg-surface-hover"
                                    title="Display Options"
                                >
                                    <SlidersHorizontal className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Quick Song Jump Index Bar */}
                        {loadedSongs.length > 0 && (
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3 pb-1 border-t border-themed mt-2">
                                {loadedSongs.map((song, idx) => {
                                    const targetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                                    const isActive = idx === activeSongIndex;
                                    return (
                                        <button
                                            key={song.id || idx}
                                            onClick={() => scrollToSong(idx)}
                                            className={`px-3 py-1.5 rounded-xl border-0 text-xs font-semibold whitespace-nowrap flex items-center gap-2 shrink-0 active:scale-95 transition-all ${
                                                isActive
                                                    ? 'bg-accent text-onaccent shadow-md shadow-accent/25'
                                                    : 'bg-secondary hover:bg-surface-hover text-textprimary'
                                            }`}
                                        >
                                            <span className={`w-4 h-4 rounded-md font-bold text-[10px] flex items-center justify-center ${
                                                isActive ? 'bg-black/20 text-onaccent' : 'bg-accent/20 text-accent'
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <span className="max-w-[120px] truncate">{song.title}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                isActive ? 'bg-black/20 text-onaccent' : 'bg-accent/15 text-accent'
                                            }`}>
                                                {targetKey}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </header>
            )}

            {/* ===== SINGLE SCROLLABLE MASTER CHORD CHART ===== */}
            <div className="px-4 py-6 space-y-10 max-w-2xl mx-auto" style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}>
                {loadedSongs.length === 0 ? (
                    <div className="text-center py-20 bg-elevated rounded-3xl border border-themed p-8">
                        <Music className="w-12 h-12 text-textmuted/40 mx-auto mb-3" />
                        <h3 className="text-base font-bold text-textprimary mb-1">No Songs in Setlist</h3>
                        <p className="text-xs text-textmuted mb-4">Add songs to this setlist to view the single scrollable chord chart.</p>
                        <button onClick={() => navigate('/setlists')} className="px-4 py-2 bg-accent text-onaccent font-bold rounded-xl text-xs">
                            Manage Setlist Songs
                        </button>
                    </div>
                ) : (
                    loadedSongs.map((song, songIdx) => {
                        const rawTargetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                        const semitones = semitonesBetween(song.originalKey || 'C', rawTargetKey);
                        const displayLyrics = transposeLyrics(song.lyrics || '', semitones, accidentalMode);
                        const sections = parseLyrics(displayLyrics);
                        const formattedTargetKey = formatKey(rawTargetKey, accidentalMode);

                        return (
                            <div
                                key={song.id || songIdx}
                                data-song-idx={songIdx}
                                ref={(el) => (songRefs.current[songIdx] = el)}
                                className="bg-elevated rounded-2xl border border-themed p-5 shadow-2xl space-y-4 scroll-mt-28"
                            >
                                {/* Song Banner Header */}
                                <div className="border-b border-themed pb-4 flex items-center justify-between gap-3 flex-wrap">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-accent text-onaccent font-extrabold text-base flex items-center justify-center shadow-lg shadow-accent/20 shrink-0">
                                            #{songIdx + 1}
                                        </div>
                                        <div className="min-w-0">
                                            <h2 className="text-lg font-bold text-textprimary truncate leading-snug">{song.title}</h2>
                                            <p className="text-xs text-textmuted truncate">
                                                {song.artist} • <span className="text-accent font-medium">{song.category}</span> {song.tempo ? `• ${song.tempo} BPM` : ''}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Per-Song Transposer Control */}
                                    {!isStageMode ? (
                                        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 border border-themed shrink-0">
                                            <button
                                                onClick={() => {
                                                    const keys = accidentalMode === 'flat' ? FLAT_KEYS : SHARP_KEYS;
                                                    const curIdx = getKeyIndex(rawTargetKey);
                                                    const nextIdx = (curIdx - 1 + 12) % 12;
                                                    handleSetSongKey(song.id, keys[nextIdx]);
                                                    haptic('light');
                                                }}
                                                className="w-9 h-9 min-w-[36px] rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-base font-bold text-textprimary active:scale-95 transition-all"
                                                title="Key Down"
                                            >
                                                −
                                            </button>
                                            <div className="px-2.5 h-9 flex items-center justify-center text-xs font-bold text-accent min-w-[36px]">
                                                {formattedTargetKey}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const keys = accidentalMode === 'flat' ? FLAT_KEYS : SHARP_KEYS;
                                                    const curIdx = getKeyIndex(rawTargetKey);
                                                    const nextIdx = (curIdx + 1) % 12;
                                                    handleSetSongKey(song.id, keys[nextIdx]);
                                                    haptic('light');
                                                }}
                                                className="w-9 h-9 min-w-[36px] rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-base font-bold text-textprimary active:scale-95 transition-all"
                                                title="Key Up"
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="px-3 py-1 rounded-xl bg-accent/15 border border-accent/30 text-accent text-xs font-bold shrink-0">
                                            Key: {formattedTargetKey}
                                        </div>
                                    )}
                                </div>

                                {/* Lyrics & Chords Body */}
                                <div className="pt-2">
                                    {sections.length === 0 ? (
                                        displayLyrics ? (
                                            <pre className="text-textprimary whitespace-pre-wrap font-sans leading-relaxed">
                                                {showChords ? displayLyrics : displayLyrics.replace(/\[[^\]]+\]/g, '')}
                                            </pre>
                                        ) : (
                                            <p className="text-textmuted text-center py-6 text-xs italic">No lyrics available for this song.</p>
                                        )
                                    ) : (
                                        sections.map((section, sIdx) => (
                                            <div key={sIdx} className="mb-6">
                                                {/* Section Label */}
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${
                                                        section.type === 'chorus' ? 'text-accent' : 'text-textmuted'
                                                    }`}>
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
                            </div>
                        );
                    })
                )}
            </div>

            {/* ===== FLOATING STAGE DOCK (PORTALED DIRECTLY TO DOCUMENT.BODY) ===== */}
            {typeof document !== 'undefined' && createPortal(
                <div
                    data-no-print="true"
                    className="no-print print-hidden fixed bottom-3 sm:bottom-6 left-0 right-0 z-40 flex flex-col items-center pointer-events-none px-2 sm:px-4"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                >
                    {/* In Fullscreen Stage Mode: Hide other controls and ONLY show Next and Previous buttons */}
                    {isStageMode ? (
                        <div className="pointer-events-auto bg-elevated/95 dark:bg-[#16161a]/95 backdrop-blur-2xl backdrop-saturate-150 ring-1 ring-black/5 dark:ring-white/[0.08] shadow-[0_12px_40px_rgba(0,0,0,0.35)] rounded-full p-1.5 flex items-center gap-2 sm:gap-3 animate-fadeIn">
                            {/* Previous Song Button */}
                            <button
                                onClick={() => scrollToSong(Math.max(0, activeSongIndex - 1))}
                                disabled={activeSongIndex <= 0}
                                className="h-10 px-3.5 sm:px-4 rounded-full bg-surface-hover/70 dark:bg-white/[0.06] hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1.5 text-xs font-bold text-textprimary transition-all shadow-sm"
                                title="Previous Song (Left Arrow / PageUp)"
                                aria-label="Previous Song"
                            >
                                <SkipBack className="w-4 h-4" />
                                <span className="hidden xs:inline">Prev</span>
                            </button>

                            {/* Song Index Indicator */}
                            <div className="px-3 h-10 rounded-full bg-accent text-onaccent font-mono font-bold text-xs flex items-center justify-center shadow-sm select-none min-w-[56px]">
                                {activeSongIndex + 1} / {loadedSongs.length || 1}
                            </div>

                            {/* Next Song Button */}
                            <button
                                onClick={() => scrollToSong(Math.min(loadedSongs.length - 1, activeSongIndex + 1))}
                                disabled={activeSongIndex >= loadedSongs.length - 1}
                                className="h-10 px-3.5 sm:px-4 rounded-full bg-surface-hover/70 dark:bg-white/[0.06] hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 disabled:opacity-25 disabled:pointer-events-none flex items-center gap-1.5 text-xs font-bold text-textprimary transition-all shadow-sm"
                                title="Next Song (Right Arrow / PageDown)"
                                aria-label="Next Song"
                            >
                                <span className="hidden xs:inline">Next</span>
                                <SkipForward className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Floating Auto-Scroll Speed Selector */}
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
                                    <div className="h-3.5 w-px bg-themed/30 dark:bg-white/[0.08]" />
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

                                {/* Song Navigation Stepper */}
                                <div className="inline-flex items-center rounded-full bg-surface-hover/70 dark:bg-white/[0.06] p-0.5 shrink-0">
                                    <button
                                        onClick={() => scrollToSong(Math.max(0, activeSongIndex - 1))}
                                        disabled={activeSongIndex <= 0}
                                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-textprimary hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all"
                                        title="Previous Song (Left Arrow / PageUp)"
                                        aria-label="Previous Song"
                                    >
                                        <SkipBack className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    </button>
                                    <div className="min-w-[34px] sm:min-w-[38px] h-8 sm:h-9 px-1.5 flex items-center justify-center text-[10px] sm:text-xs font-mono font-bold text-textprimary select-none">
                                        {activeSongIndex + 1}/{loadedSongs.length || 1}
                                    </div>
                                    <button
                                        onClick={() => scrollToSong(Math.min(loadedSongs.length - 1, activeSongIndex + 1))}
                                        disabled={activeSongIndex >= loadedSongs.length - 1}
                                        className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-textprimary hover:bg-surface-active dark:hover:bg-white/10 active:bg-accent/20 active:scale-95 disabled:opacity-25 disabled:pointer-events-none transition-all"
                                        title="Next Song (Right Arrow / PageDown)"
                                        aria-label="Next Song"
                                    >
                                        <SkipForward className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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

                                <div className="h-4 w-px bg-themed/30 dark:bg-white/[0.08] shrink-0" />

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

                                <div className="h-4 w-px bg-themed/30 dark:bg-white/[0.08] shrink-0" />

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
                        </>
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
                        className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                        <div className="flex justify-between items-center px-6 py-3.5 border-b border-themed shrink-0">
                            <h3 className="text-base font-bold flex items-center gap-2 text-textprimary">
                                <SlidersHorizontal className="w-5 h-5 text-accent" /> Player Settings
                            </h3>
                            <button onClick={() => setShowOptionsModal(false)} className="text-textmuted hover:text-textprimary p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5 overflow-y-auto flex-1 overscroll-contain">
                            {/* Full-Screen Stage Mode Button */}
                            <button
                                onClick={() => {
                                    setShowOptionsModal(false);
                                    setIsStageMode(true);
                                }}
                                className="w-full py-3 px-4 rounded-xl bg-accent text-onaccent font-bold text-xs flex items-center justify-center gap-2 active:scale-98 shadow-sm"
                            >
                                <Maximize2 className="w-4 h-4" /> Enter Full-Screen Stage Mode
                            </button>

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

                            <button
                                onClick={() => {
                                    scrollToTop();
                                    setShowOptionsModal(false);
                                }}
                                className="w-full py-3 rounded-xl bg-secondary border-0 text-xs font-bold flex items-center justify-center gap-2 hover:bg-surface-hover active:bg-surface-active text-textprimary"
                            >
                                <ChevronUp className="w-4 h-4 text-accent" /> Scroll to Top
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
