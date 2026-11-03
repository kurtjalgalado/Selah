import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { KEYS } from '../utils/chords';
import { songDB } from '../db/dexie';
import { pushSongToSupabase } from '../supabase/sync';
import { useAuth } from '../auth/AuthContext';
import { X, FloppyDisk as Save } from '@phosphor-icons/react';

const CATEGORY_OPTIONS = ['Fast', 'Slow', 'English', 'Tagalog'];

export default function EditSongModal({ song, onClose, onSaveSuccess }) {
    const { user } = useAuth();

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);
    const [form, setForm] = useState({
        title: song?.title || '',
        artist: song?.artist || '',
        originalKey: song?.originalKey || song?.currentKey || 'C',
        tempo: song?.tempo || 80,
        category: song?.category || 'Slow',
        lyrics: song?.lyrics || '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!song) return;

        setSaving(true);
        try {
            const updatedFields = {
                title: form.title.trim(),
                artist: form.artist.trim(),
                originalKey: form.originalKey,
                currentKey: form.originalKey,
                tempo: parseInt(form.tempo) || 80,
                category: form.category,
                tags: Array.from(new Set([form.category, ...(song.tags || [])])),
                lyrics: form.lyrics,
                updatedAt: new Date().toISOString(),
            };

            await songDB.update(song.id, updatedFields);
            const fullUpdatedSong = { ...song, ...updatedFields };
            await pushSongToSupabase(fullUpdatedSong, user);

            if (onSaveSuccess) onSaveSuccess(fullUpdatedSong);
            onClose();
        } catch (err) {
            console.error('Failed to update song:', err);
            alert('Error updating song: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const modalNode = (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-sheetSpring max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-accent/55 to-transparent shrink-0" />
                <div className="w-11 h-1.5 bg-textmuted/30 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
                {/* Modal Header */}
                <div className="flex justify-between items-center px-5 py-3.5 border-b border-themed shrink-0">
                    <div className="min-w-0 pr-3">
                        <h3 className="text-base font-bold text-accent">Edit Song & Chords</h3>
                        <p className="text-xs text-textmuted truncate">{song?.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-secondary border border-themed text-textmuted hover:text-textprimary flex items-center justify-center btn-icon-action shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Song Title</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full bg-secondary border border-themed rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary min-h-[44px]"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Artist / Composer</label>
                        <input
                            type="text"
                            value={form.artist}
                            onChange={(e) => setForm({ ...form, artist: e.target.value })}
                            className="w-full bg-secondary border border-themed rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary min-h-[44px]"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Key</label>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-accent text-textprimary min-h-[44px]"
                            >
                                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Tempo (BPM)</label>
                            <input
                                type="number"
                                value={form.tempo}
                                onChange={(e) => setForm({ ...form, tempo: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-accent text-textprimary min-h-[44px]"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full bg-secondary border border-themed rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary min-h-[44px]"
                            >
                                {CATEGORY_OPTIONS.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-xs font-medium text-textmuted">Lyrics & Chords</label>
                            <span className="text-[11px] text-accent/80 font-mono">Wrap chords in [ ] e.g. [G] [Em]</span>
                        </div>
                        <textarea
                            value={form.lyrics}
                            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                            rows="10"
                            placeholder="[Verse 1]&#10;[G]Si Hesu[C]s, Haring wa[C]lang hanggan..."
                            className="w-full bg-secondary border border-themed rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none font-mono text-textprimary leading-relaxed"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 min-h-[44px] py-3 text-sm font-semibold bg-secondary hover:bg-surface-hover text-textmuted rounded-xl border border-themed btn-interact"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 min-h-[44px] py-3 text-sm font-bold bg-accent text-onaccent rounded-xl shadow-lg shadow-accent/20 flex items-center justify-center gap-2 btn-primary-interact"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}
