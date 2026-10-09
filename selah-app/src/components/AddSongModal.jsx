import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth/AuthContext';
import { songDB } from '../db/dexie';
import { pushSongToSupabase } from '../supabase/sync';
import { KEYS } from '../utils/chords';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';
import { 
    X, ArrowLeft, Check, MusicNotes as Music, 
    MicrophoneStage as Mic, Sliders, Hash, Tag, Globe, 
    ArrowBendDownLeft as CornerDownLeft, Plus, Minus
} from '@phosphor-icons/react';

export default function AddSongModal({ onClose }) {
    const { user } = useAuth();
    const textareaRef = useRef(null);

    const [form, setForm] = useState({
        title: '',
        artist: '',
        originalKey: 'C',
        currentKey: 'C',
        tempo: 80,
        category: 'Fast',
        language: 'English',
        lyrics: '',
    });

    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const hasUnsavedChanges = Boolean(
        form.title.trim() || 
        form.artist.trim() || 
        form.lyrics.trim()
    );

    const handleCancel = () => {
        haptic('light');
        if (hasUnsavedChanges) {
            if (window.confirm('Discard unsaved song?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    useBackHandler(true, handleCancel);

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!form.title.trim()) {
            setErrorMsg('Song title is required.');
            return;
        }

        setSaving(true);
        setErrorMsg('');
        haptic('light');

        try {
            const newSong = {
                id: crypto.randomUUID(),
                title: form.title.trim(),
                artist: form.artist.trim() || 'Unknown Artist',
                originalKey: form.originalKey || 'C',
                currentKey: form.originalKey || 'C',
                tempo: parseInt(form.tempo) || 80,
                category: form.category || 'Fast',
                language: form.language || 'English',
                lyrics: form.lyrics.trim(),
                tags: [form.category, form.language].filter(Boolean),
                dateAdded: new Date().toISOString(),
            };

            await songDB.add(newSong);
            if (user) {
                await pushSongToSupabase(newSong, user);
            }

            haptic('success');
            onClose();
        } catch (err) {
            console.error('Failed to add song:', err);
            setErrorMsg(err.message || 'Failed to save song. Please check input.');
        } finally {
            setSaving(false);
        }
    };

    // Quick insertion of section headers and chord markers at cursor
    const insertSnippet = (snippet) => {
        haptic('light');
        const textarea = textareaRef.current;
        if (!textarea) {
            setForm(prev => ({ ...prev, lyrics: prev.lyrics + snippet }));
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const text = form.lyrics;
        const before = text.substring(0, start);
        const after = text.substring(end);

        const newText = before + snippet + after;
        setForm(prev => ({ ...prev, lyrics: newText }));

        // Move cursor inside or after snippet
        setTimeout(() => {
            textarea.focus();
            const newPos = start + snippet.length;
            textarea.setSelectionRange(newPos, newPos);
        }, 10);
    };

    const adjustTempo = (delta) => {
        haptic('light');
        setForm(prev => {
            const current = parseInt(prev.tempo) || 80;
            const next = Math.max(40, Math.min(220, current + delta));
            return { ...prev, tempo: next };
        });
    };

    const fullScreenContent = (
        <div className="fixed inset-0 z-[99999] bg-primary flex flex-col text-textprimary animate-pageEnter overflow-hidden">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-30 bg-secondary/80 backdrop-blur-xl border-b border-themed px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 shrink-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="w-10 h-10 rounded-2xl bg-secondary border-0 flex items-center justify-center text-textmuted hover:text-textprimary hover:bg-surface-hover active:scale-95 transition shrink-0"
                        title="Cancel"
                        aria-label="Cancel"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-base font-bold text-textprimary truncate leading-tight">
                            Add New Song
                        </h1>
                        <p className="text-[11px] text-textmuted truncate">
                            Worship repertoire & chord chart
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-3 py-2 rounded-xl text-xs font-semibold text-textmuted hover:text-textprimary hidden sm:inline-flex"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={saving || !form.title.trim()}
                        className="px-4 py-2 min-h-[42px] rounded-xl bg-accent text-onaccent font-bold text-xs shadow-md shadow-accent/25 hover:bg-accent/90 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>{saving ? 'Saving...' : 'Save Song'}</span>
                    </button>
                </div>
            </header>

            {/* Error banner if any */}
            {errorMsg && (
                <div className="px-4 py-2.5 bg-danger/15 border-b border-danger/30 text-danger text-xs font-semibold flex items-center justify-between shrink-0">
                    <span>{errorMsg}</span>
                    <button onClick={() => setErrorMsg('')} className="p-1 text-danger hover:opacity-75">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Full-Screen Layout */}
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Compact Metadata Controls Area */}
                <div className="p-4 sm:p-5 bg-secondary/30 border-b border-themed shrink-0 space-y-3">
                    {/* Song Title & Artist Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-textmuted mb-1">
                                Song Title <span className="text-accent">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={(e) => {
                                    setForm({ ...form, title: e.target.value });
                                    if (errorMsg) setErrorMsg('');
                                }}
                                placeholder="e.g. Goodness of God, Way Maker..."
                                autoFocus
                                required
                                className="w-full bg-secondary border border-themed rounded-xl px-3.5 py-2.5 text-sm sm:text-base font-semibold text-textprimary placeholder:text-textmuted/60 focus:outline-none focus:border-accent"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-textmuted mb-1">
                                Artist / Composer
                            </label>
                            <input
                                type="text"
                                value={form.artist}
                                onChange={(e) => setForm({ ...form, artist: e.target.value })}
                                placeholder="e.g. Bethel Music, Sinach, Hillsong..."
                                className="w-full bg-secondary border border-themed rounded-xl px-3.5 py-2.5 text-sm text-textprimary placeholder:text-textmuted/60 focus:outline-none focus:border-accent"
                            />
                        </div>
                    </div>

                    {/* Metadata Selector Chips (Key, Tempo, Category, Language) */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                        {/* Key Picker */}
                        <div className="bg-secondary/70 border border-themed rounded-xl p-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-textmuted uppercase tracking-wider">Key</span>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value, currentKey: e.target.value })}
                                className="bg-elevated border border-themed rounded-lg px-2 py-1 text-xs font-bold font-mono text-accent focus:outline-none cursor-pointer"
                            >
                                {KEYS.map(k => (
                                    <option key={k} value={k}>{k}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tempo Stepper */}
                        <div className="bg-secondary/70 border border-themed rounded-xl p-2 flex items-center justify-between gap-1.5">
                            <span className="text-[11px] font-bold text-textmuted uppercase tracking-wider">BPM</span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => adjustTempo(-4)}
                                    className="w-6 h-6 rounded-md bg-secondary border-0 hover:bg-surface-hover active:scale-95 flex items-center justify-center text-xs font-bold text-textmuted"
                                >
                                    -
                                </button>
                                <span className="font-mono text-xs font-bold text-textprimary w-7 text-center">
                                    {form.tempo}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => adjustTempo(4)}
                                    className="w-6 h-6 rounded-md bg-secondary border-0 hover:bg-surface-hover active:scale-95 flex items-center justify-center text-xs font-bold text-textmuted"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        {/* Category */}
                        <div className="bg-secondary/70 border border-themed rounded-xl p-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-textmuted uppercase tracking-wider">Tempo</span>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="bg-elevated border border-themed rounded-lg px-2 py-1 text-xs font-semibold text-textprimary focus:outline-none cursor-pointer"
                            >
                                <option value="Fast">Fast</option>
                                <option value="Slow">Slow</option>
                                <option value="Mid">Mid-Tempo</option>
                                <option value="Special">Special / Offertory</option>
                            </select>
                        </div>

                        {/* Language */}
                        <div className="bg-secondary/70 border border-themed rounded-xl p-2 flex items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-textmuted uppercase tracking-wider">Lang</span>
                            <select
                                value={form.language}
                                onChange={(e) => setForm({ ...form, language: e.target.value })}
                                className="bg-elevated border border-themed rounded-lg px-2 py-1 text-xs font-semibold text-textprimary focus:outline-none cursor-pointer"
                            >
                                <option value="English">English</option>
                                <option value="Tagalog">Tagalog</option>
                                <option value="Bilingual">Bilingual</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section Insert Toolbar & Chord Helper */}
                <div className="px-4 py-2 border-b border-themed bg-secondary/50 shrink-0 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-textmuted mr-1 shrink-0">
                        Quick Tags:
                    </span>
                    {[
                        '[Intro]',
                        '[Verse 1]',
                        '[Verse 2]',
                        '[Chorus]',
                        '[Bridge]',
                        '[Outro]',
                        '[G]',
                        '[C]',
                        '[D]',
                        '[Em]',
                        '[Am]',
                        '[]'
                    ].map(tag => (
                        <button
                            key={tag}
                            type="button"
                            onClick={() => insertSnippet(tag === '[]' ? '[]' : `${tag}\n`)}
                            className="px-2 py-1 rounded-lg bg-secondary border-0 hover:bg-surface-hover text-[11px] font-mono font-semibold text-accent shrink-0 active:scale-95 transition"
                        >
                            {tag}
                        </button>
                    ))}
                </div>

                {/* Massive Full-Screen Lyrics & Chords Text Entry */}
                <div className="flex-1 flex flex-col p-4 sm:p-6 min-h-0 relative">
                    <textarea
                        ref={textareaRef}
                        value={form.lyrics}
                        onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                        placeholder={`Type or paste chords & lyrics here...\n\nExample ChordPro format:\n[Verse 1]\n[G]I love You, Lord\nFor Your [C]mercy never [G]fails me\nAll my [Em]days, I've been [C]held in Your [D]hands\n\n[Chorus]\nAnd all my life You have been [C]faithful\nAnd all my life You have been [G]so, so [D]good\n\n(Standard line-over-line chords are also supported)`}
                        className="w-full flex-1 min-h-[300px] resize-none bg-secondary/40 border border-themed rounded-2xl p-4 sm:p-5 font-mono text-sm sm:text-base leading-relaxed text-textprimary placeholder:text-textmuted/40 focus:outline-none focus:border-accent/80 focus:ring-1 focus:ring-accent/40 transition-all overscroll-contain"
                        spellCheck={false}
                        autoCapitalize="sentences"
                    />

                    {/* Footer word/line counter & Safe Area Spacer */}
                    <div className="mt-2.5 flex items-center justify-between text-[11px] text-textmuted shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
                        <span>
                            {form.lyrics.split('\n').filter(Boolean).length} lines • {form.lyrics.trim().split(/\s+/).filter(Boolean).length} words
                        </span>
                        <span className="italic">
                            Monospace editor • Auto-formats on save
                        </span>
                    </div>
                </div>
            </form>
        </div>
    );

    return createPortal(fullScreenContent, document.body);
}
