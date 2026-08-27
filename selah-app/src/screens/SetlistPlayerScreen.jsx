import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { setlistDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics } from '../utils/chords';
import { parseLyrics, isChordLine, separateChords } from '../utils/lyrics';
import { useAuth } from '../auth/AuthContext';
import { pushSetlistToSupabase } from '../supabase/sync';
import {
    ChevronLeft, Play, Pause, ChevronUp, Tag, SlidersHorizontal,
    X, Music, Calendar, Clock, Volume2, Layers, List
} from 'lucide-react';

export default function SetlistPlayerScreen() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [fontSize, setFontSize] = useState(16);
    const [showChords, setShowChords] = useState(true);
    const [isAutoScrolling, setIsAutoScrolling] = useState(false);
    const [scrollSpeed, setScrollSpeed] = useState(2);
    const [showOptionsModal, setShowOptionsModal] = useState(false);

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

    const scrollToSong = (index) => {
        const el = songRefs.current[index];
        if (el) {
            const yOffset = -90; // Header offset
            const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-primary animate-pageEnter" style={{ paddingBottom: 'calc(10rem + env(safe-area-inset-bottom, 0px))' }}>
            {/* ===== STAGE HEADER ===== */}
            <header className="glass sticky top-0 z-30 border-b border-themed shadow-2xl backdrop-blur-xl">
                <div className="px-4 pt-8 pb-3">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => window.history.length > 1 ? navigate(-1) : navigate('/setlists')}
                            className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-textprimary shrink-0"
                            title="Back"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-accent/20 border border-accent/40 text-[9px] font-bold text-accent uppercase tracking-wider shrink-0 animate-pulse">
                                    LIVE PLAYER
                                </span>
                                <h1 className="text-base font-bold truncate leading-tight text-textprimary">{setlist.title}</h1>
                            </div>
                            <p className="text-xs text-textmuted truncate mt-0.5">
                                {setlist.date || 'Undated'} • <span className="text-accent font-medium">{loadedSongs.length} Songs</span> • by <strong className="text-textprimary">{setlist.preparedBy || 'Worship Leader'}</strong>
                            </p>
                        </div>

                        <button
                            onClick={() => setShowOptionsModal(true)}
                            className="w-10 h-10 rounded-xl bg-secondary border border-themed flex items-center justify-center text-textmuted hover:text-accent shrink-0"
                            title="Display Options"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Song Jump Index Bar */}
                    {loadedSongs.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pt-3 pb-1 border-t border-themed mt-2">
                            {loadedSongs.map((song, idx) => {
                                const targetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                                return (
                                    <button
                                        key={song.id || idx}
                                        onClick={() => scrollToSong(idx)}
                                        className="px-3 py-1.5 rounded-xl bg-secondary border border-themed hover:border-accent text-xs font-semibold whitespace-nowrap flex items-center gap-2 shrink-0 active:scale-95 transition-all"
                                    >
                                        <span className="w-4 h-4 rounded-md bg-accent/20 text-accent font-bold text-[10px] flex items-center justify-center">
                                            {idx + 1}
                                        </span>
                                        <span className="text-textprimary max-w-[120px] truncate">{song.title}</span>
                                        <span className="text-[10px] font-bold text-accent px-1.5 py-0.5 bg-accent/15 rounded">
                                            {targetKey}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </header>

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
                        const targetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                        const semitones = semitonesBetween(song.originalKey || 'C', targetKey);
                        const displayLyrics = semitones === 0 ? (song.lyrics || '') : transposeLyrics(song.lyrics || '', semitones);
                        const sections = parseLyrics(displayLyrics);

                        return (
                            <div
                                key={song.id || songIdx}
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
                                    <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 border border-themed shrink-0">
                                        <button
                                            onClick={() => {
                                                const keys = KEYS;
                                                const curIdx = keys.indexOf(targetKey);
                                                const nextIdx = (curIdx - 1 + 12) % 12;
                                                handleSetSongKey(song.id, keys[nextIdx]);
                                            }}
                                            className="w-8 h-8 rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-sm font-bold text-textprimary"
                                            title="Key Down"
                                        >
                                            −
                                        </button>
                                        <div className="px-3 h-8 flex items-center justify-center text-xs font-bold text-accent min-w-[36px]">
                                            {targetKey}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const keys = KEYS;
                                                const curIdx = keys.indexOf(targetKey);
                                                const nextIdx = (curIdx + 1) % 12;
                                                handleSetSongKey(song.id, keys[nextIdx]);
                                            }}
                                            className="w-8 h-8 rounded-lg bg-surface-hover active:bg-accent/20 flex items-center justify-center text-sm font-bold text-textprimary"
                                            title="Key Up"
                                        >
                                            +
                                        </button>
                                    </div>
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

                                                {/* Lines */}
                                                {section.lines.map((line, lIdx) => {
                                                    const cleanLyricLine = line.replace(/\[[^\]]+\]/g, '').trim();

                                                    if (!showChords || !isChordLine(line)) {
                                                        return (
                                                            <p key={lIdx} className="text-textprimary whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${fontSize}px` }}>
                                                                {cleanLyricLine || line || '\u00A0'}
                                                            </p>
                                                        );
                                                    }

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
                            </div>
                        );
                    })
                )}
            </div>

            {/* ===== FLOATING STAGE DOCK (PORTALED DIRECTLY TO DOCUMENT.BODY) ===== */}
            {typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed left-4 right-4 max-w-lg mx-auto z-40 transition-all duration-300 pointer-events-auto"
                    style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
                >
                    <div className="glass bg-elevated border border-themed p-2.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-2">
                        {/* Left: Chords Toggle */}
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

                        {/* Middle: Font Size Controls */}
                        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1 border border-themed">
                            <button
                                onClick={() => setFontSize(s => Math.max(12, s - 2))}
                                className="w-8 h-8 rounded-lg bg-surface-hover active:bg-surface-active text-xs font-bold text-textprimary flex items-center justify-center"
                                title="Decrease Font Size"
                            >
                                A−
                            </button>
                            <span className="px-2 text-[11px] font-bold text-textmuted min-w-[28px] text-center">
                                {fontSize}px
                            </span>
                            <button
                                onClick={() => setFontSize(s => Math.min(26, s + 2))}
                                className="w-8 h-8 rounded-lg bg-surface-hover active:bg-surface-active text-xs font-bold text-textprimary flex items-center justify-center"
                                title="Increase Font Size"
                            >
                                A+
                            </button>
                        </div>

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

                    {/* Speed Controls Selector bar when active */}
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
                                className="w-full py-3 rounded-xl border border-themed text-xs font-bold flex items-center justify-center gap-2 active:bg-surface-hover text-textprimary"
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
