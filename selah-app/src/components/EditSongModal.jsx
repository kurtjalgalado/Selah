import { useState } from 'react';
import { KEYS } from '../utils/chords';
import { songDB } from '../db/dexie';
import { pushSongToSupabase } from '../supabase/sync';
import { useAuth } from '../auth/AuthContext';
import { X, Save } from 'lucide-react';

const CATEGORY_OPTIONS = ['Fast', 'Slow', 'English', 'Tagalog'];

export default function EditSongModal({ song, onClose, onSaveSuccess }) {
    const { user } = useAuth();
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

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn">
            <div className="bg-elevated rounded-t-2xl sm:rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl animate-slideUp max-h-[90vh] flex flex-col">
                {/* Modal Header */}
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold font-serif text-accent">Edit Song & Chords</h3>
                        <p className="text-xs text-textmuted truncate">{song?.title}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg text-textmuted hover:text-white hover:bg-white/5 transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Song Title</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Artist / Composer</label>
                        <input
                            type="text"
                            value={form.artist}
                            onChange={(e) => setForm({ ...form, artist: e.target.value })}
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Key</label>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value })}
                                className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
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
                                className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
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
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent resize-none font-mono text-white leading-relaxed"
                            required
                        />
                    </div>

                    <div className="flex gap-3 pt-2 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 text-sm font-medium border border-white/10 rounded-xl hover:bg-white/5 active:bg-white/10 transition text-textmuted"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex-1 py-3 text-sm font-bold bg-accent text-primary rounded-xl hover:bg-accent/90 active:scale-95 transition shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
