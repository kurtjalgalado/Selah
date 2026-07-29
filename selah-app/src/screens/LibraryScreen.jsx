import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, songDB, setlistDB } from '../db/dexie';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics } from '../utils/chords';
import { Search, Plus, Music, Clock, Tag, ChevronRight, Trash2, ListPlus, LogOut, Library, Calendar, ArrowUpDown, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { pushSongToSupabase, pushSetlistToSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';

const CATEGORIES = ['All', 'Fast', 'Slow', 'English', 'Tagalog'];

export default function LibraryScreen() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const [search, setSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('All');
    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = Title A-Z, 'desc' = Title Z-A
    const [showAddModal, setShowAddModal] = useState(false);
    const [quickAddSong, setQuickAddSong] = useState(null);

    // Live query from Dexie
    const songs = useLiveQuery(() => db.songs.toArray(), [], []);
    const setlists = useLiveQuery(() => db.setlists.toArray(), [], []);

    // Filtered & Sorted songs
    const filteredSongs = useMemo(() => {
        if (!songs) return [];
        const result = songs.filter(song => {
            const songCategory = (song.category || '').toLowerCase();
            const songLanguage = (song.language || '').toLowerCase();
            const songTags = (song.tags || []).map(t => t.toLowerCase());

            const matchesFilter = activeFilter === 'All' ||
                songCategory === activeFilter.toLowerCase() ||
                songLanguage === activeFilter.toLowerCase() ||
                songTags.includes(activeFilter.toLowerCase()) ||
                songCategory.includes(activeFilter.toLowerCase());

            const matchesSearch =
                song.title.toLowerCase().includes(search.toLowerCase()) ||
                song.artist.toLowerCase().includes(search.toLowerCase());
            return matchesFilter && matchesSearch;
        });

        return result.sort((a, b) => {
            const titleA = a.title.toLowerCase();
            const titleB = b.title.toLowerCase();
            return sortOrder === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
        });
    }, [songs, activeFilter, search, sortOrder]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-24">
                {/* ===== HEADER ===== */}
                <header className="glass sticky top-0 z-10 border-b border-white/5">
                    <div className="px-5 pt-12 pb-4">
                        {/* Top Row */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-accent to-yellow-300 flex items-center justify-center shadow-lg shadow-accent/20">
                                    <Music className="w-6 h-6 text-primary" strokeWidth={2} />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-serif font-bold text-accent leading-none">Selah</h1>
                                    <p className="text-[10px] text-textmuted tracking-widest uppercase mt-0.5">Worship Planner</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/setlists')}
                                    className="px-3.5 py-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 active:scale-95 text-xs font-bold flex items-center gap-2 shadow-md shadow-accent/10 transition-all min-h-[44px]"
                                    title="Song Lineup"
                                >
                                    <Calendar className="w-4 h-4 text-accent" />
                                    <span>Song Lineup</span>
                                </button>
                                {user ? (
                                    <button
                                        onClick={handleSignOut}
                                        className="w-11 h-11 rounded-xl bg-secondary border border-white/5 flex items-center justify-center text-textmuted hover:text-danger transition-colors min-w-[44px]"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => navigate('/login')}
                                        className="px-4 py-2.5 rounded-xl bg-accent/10 border border-accent/30 text-accent text-xs font-semibold hover:bg-accent/20 transition-colors min-h-[44px]"
                                    >
                                        Sign In
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Title */}
                        <h2 className="text-3xl font-bold mb-4">Song Library</h2>

                        {/* Search & Sort Controls */}
                        <div className="flex gap-2 mb-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-textmuted" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search songs or artists..."
                                    className="w-full bg-secondary border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors min-h-[44px]"
                                />
                            </div>
                            <button
                                onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                                className="px-3.5 rounded-xl bg-secondary border border-white/10 flex items-center gap-2 text-xs font-bold text-accent active:bg-white/10 shrink-0 min-h-[44px]"
                                title="Sort by Title"
                            >
                                <ArrowUpDown className="w-4 h-4 text-accent" />
                                <span>{sortOrder === 'asc' ? 'Title A–Z' : 'Title Z–A'}</span>
                            </button>
                        </div>

                        {/* Filter Pills */}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveFilter(cat)}
                                    className={`px-4 py-2 rounded-full text-xs font-medium border whitespace-nowrap transition-colors min-h-[36px] ${activeFilter === cat
                                            ? 'bg-accent text-primary border-accent font-bold'
                                            : 'border-white/5 text-textmuted hover:border-accent'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ===== SONG LIST ===== */}
                <div className="px-5 py-4 space-y-3">
                    {filteredSongs.length === 0 ? (
                        <div className="text-center py-20">
                            <Music className="w-12 h-12 mx-auto text-textmuted/30 mb-4" />
                            <p className="text-textmuted text-sm">No songs found</p>
                        </div>
                    ) : (
                        filteredSongs.map(song => (
                            <SongCard
                                key={song.id}
                                song={song}
                                onClick={() => navigate(`/song/${song.id}`)}
                                onQuickAdd={(e) => {
                                    e.stopPropagation();
                                    setQuickAddSong(song);
                                }}
                            />
                        ))
                    )}
                </div>

                {/* ===== FAB ===== */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-accent text-primary flex items-center justify-center shadow-lg shadow-accent/40 glow-accent z-20 min-w-[56px] min-h-[56px]"
                >
                    <Plus className="w-7 h-7" strokeWidth={3} />
                </button>

                {/* ===== ADD SONG MODAL ===== */}
                {showAddModal && <AddSongModal onClose={() => setShowAddModal(false)} />}

                {/* ===== QUICK ADD TO SETLIST MODAL ===== */}
                {quickAddSong && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
                        <div className="bg-elevated rounded-t-3xl sm:rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl animate-slideUp">
                            <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                                <div>
                                    <h3 className="text-base font-bold">Add to Setlist</h3>
                                    <p className="text-xs text-accent truncate">{quickAddSong.title}</p>
                                </div>
                                <button onClick={() => setQuickAddSong(null)} className="text-textmuted active:text-white p-1">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                                {(!setlists || setlists.length === 0) ? (
                                    <div className="text-center py-6">
                                        <p className="text-textmuted text-xs mb-3">No setlists created yet</p>
                                        <button
                                            onClick={() => { setQuickAddSong(null); navigate('/setlists'); }}
                                            className="px-4 py-2 bg-accent text-primary rounded-xl text-xs font-bold"
                                        >
                                            Create New Setlist
                                        </button>
                                    </div>
                                ) : (
                                    setlists.map(setlist => (
                                        <button
                                            key={setlist.id}
                                            onClick={async () => {
                                                const songIds = setlist.songIds || [];
                                                if (!songIds.includes(quickAddSong.id)) {
                                                    const updatedIds = [...songIds, quickAddSong.id];
                                                    await setlistDB.update(setlist.id, { songIds: updatedIds });
                                                    await pushSetlistToSupabase({ ...setlist, songIds: updatedIds }, user);
                                                }
                                                setQuickAddSong(null);
                                            }}
                                            className="w-full p-3 rounded-xl bg-secondary border border-white/5 flex items-center justify-between text-left hover:border-accent active:bg-white/10 transition-colors"
                                        >
                                            <div>
                                                <p className="font-medium text-white text-sm">{setlist.title}</p>
                                                <p className="text-xs text-textmuted">{setlist.date || 'No date'} • {setlist.songIds?.length || 0} songs</p>
                                            </div>
                                            <Plus className="w-4 h-4 text-accent" />
                                        </button>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PullToRefresh>
    );
}

// ── Song Card Component ──
function SongCard({ song, onClick, onQuickAdd }) {
    const [currentKey, setCurrentKey] = useState(song.originalKey || song.currentKey || 'C');

    const transpose = (direction) => {
        const idx = getKeyIndex(currentKey);
        let newIdx = (idx + direction) % 12;
        if (newIdx < 0) newIdx += 12;
        setCurrentKey(KEYS[newIdx]);
    };

    return (
        <div
            className="bg-elevated rounded-xl border border-white/5 p-4 active:scale-[0.98] transition-transform"
            onClick={onClick}
        >
            <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center border border-white/5 flex-shrink-0">
                    <Music className="w-5 h-5 text-accent" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate text-sm">{song.title}</h3>
                    <p className="text-xs text-textmuted truncate">{song.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2 py-0.5 bg-white/5 rounded-full text-accent font-medium">
                            {song.category}
                        </span>
                        <span className="text-[10px] text-textmuted flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {song.tempo}
                        </span>
                    </div>
                </div>

                {/* Controls & Key Display */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Quick Add Button */}
                    <button
                        onClick={onQuickAdd}
                        className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center active:scale-95 transition-all"
                        title="Quick Add to Setlist"
                    >
                        <ListPlus className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 bg-secondary/80 rounded-lg p-0.5 border border-white/5">
                        <button
                            onClick={(e) => { e.stopPropagation(); transpose(-1); }}
                            className="w-6 h-6 rounded bg-white/5 active:bg-white/10 flex items-center justify-center text-textmuted"
                        >
                            <span className="text-xs">−</span>
                        </button>
                        <span className="key-badge px-1.5 h-6 flex items-center justify-center rounded text-[11px] font-bold">
                            {currentKey}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); transpose(1); }}
                            className="w-6 h-6 rounded bg-white/5 active:bg-white/10 flex items-center justify-center text-textmuted"
                        >
                            <span className="text-xs">+</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Add Song Modal ──
function AddSongModal({ onClose }) {
    const { user } = useAuth();
    const [form, setForm] = useState({
        title: '',
        artist: '',
        originalKey: 'C',
        currentKey: 'C',
        tempo: 80,
        category: 'Modern',
        lyrics: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newSong = {
            id: crypto.randomUUID(),
            ...form,
            tempo: parseInt(form.tempo),
            dateAdded: new Date().toISOString(),
        };
        await songDB.add(newSong);
        await pushSongToSupabase(newSong, user);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-elevated rounded-t-2xl sm:rounded-2xl border border-white/5 w-full max-w-lg shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-elevated flex justify-between items-center px-6 py-4 border-b border-white/5">
                    <h3 className="text-lg font-bold font-serif">Add New Song</h3>
                    <button onClick={onClose} className="text-textmuted active:text-white">
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Title</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="King of Kings"
                            className="w-full bg-secondary border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Artist / Composer</label>
                        <input
                            type="text"
                            value={form.artist}
                            onChange={(e) => setForm({ ...form, artist: e.target.value })}
                            placeholder="Hillsong Worship"
                            className="w-full bg-secondary border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Key</label>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value, currentKey: e.target.value })}
                                className="w-full bg-secondary border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                            >
                                {KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Tempo</label>
                            <input
                                type="number"
                                value={form.tempo}
                                onChange={(e) => setForm({ ...form, tempo: e.target.value })}
                                className="w-full bg-secondary border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Category</label>
                            <select
                                value={form.category}
                                onChange={(e) => setForm({ ...form, category: e.target.value })}
                                className="w-full bg-secondary border border-white/5 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent"
                            >
                                <option>Modern</option>
                                <option>Hymn</option>
                                <option>Praise</option>
                                <option>Chorus</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Lyrics</label>
                        <textarea
                            value={form.lyrics}
                            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                            rows="6"
                            placeholder="[Verse 1]&#10;Lyrics here...&#10;&#10;[Chorus]&#10;Chorus lyrics..."
                            className="w-full bg-secondary border border-white/5 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none font-mono"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium border border-white/5 rounded-lg active:bg-white/5">
                            Cancel
                        </button>
                        <button type="submit" className="flex-1 py-2.5 text-sm font-bold bg-accent text-primary rounded-lg active:bg-yellow-300">
                            Save Song
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}