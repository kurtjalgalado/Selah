import { useState, useMemo, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { songDB, setlistDB } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { KEYS, getKeyIndex } from '../utils/chords';
import { Search, Plus, Music, Clock, ChevronRight, Trash2, ListPlus, LogOut, Calendar, ArrowUpDown, X, Menu, Edit3, User, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { UIContext } from '../App';
import { pushSongToSupabase, pushSetlistToSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';
import EditSongModal from '../components/EditSongModal';
import { LibrarySkeletonCards } from '../components/SkeletonLoader';

export default function LibraryScreen() {
    const navigate = useNavigate();
    const { user, signOut } = useAuth();
    const { openSidebar } = useContext(UIContext);
    const [search, setSearch] = useState('');

    // Separate independent filters for Tempo & Language
    const [tempoFilter, setTempoFilter] = useState('All'); // 'All' | 'Fast' | 'Slow'
    const [languageFilter, setLanguageFilter] = useState('All'); // 'All' | 'Tagalog' | 'English'
    const [showFilters, setShowFilters] = useState(false); // Collapsible filters hidden by default

    const [sortOrder, setSortOrder] = useState('asc'); // 'asc' = Title A-Z, 'desc' = Title Z-A
    const [showAddModal, setShowAddModal] = useState(false);
    const [quickAddSong, setQuickAddSong] = useState(null);
    const [editingSong, setEditingSong] = useState(null);

    // Check if any filter is active
    const isFilterActive = languageFilter !== 'All' || tempoFilter !== 'All';

    // Load from SongCache
    const { songs, setlists, loading } = useSongCache();

    // Filtered & Sorted songs with deduplication
    const filteredSongs = useMemo(() => {
        if (!songs || songs.length === 0) return [];

        // Deduplicate songs by ID/title to prevent duplicate React keys
        const uniqueMap = new Map();
        for (const s of songs) {
            const key = `${String(s.id).toLowerCase()}-${(s.title || '').toLowerCase().trim()}`;
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, s);
            }
        }
        const uniqueSongs = Array.from(uniqueMap.values());

        const result = uniqueSongs.filter(song => {
            const songCategory = (song.category || '').toLowerCase();
            const songLanguage = (song.language || '').toLowerCase();
            const songTags = (song.tags || []).map(t => String(t).toLowerCase());

            const isTagalog = songLanguage.includes('tagalog') || songCategory.includes('tagalog') || songTags.includes('tagalog');
            const isEnglish = songLanguage.includes('english') || songCategory.includes('english') || songTags.includes('english');
            const isFast = songCategory.includes('fast') || songTags.includes('fast') || (song.tempo && song.tempo >= 100);
            const isSlow = songCategory.includes('slow') || songTags.includes('slow') || (song.tempo && song.tempo < 100);

            // Match language
            let matchesLanguage = true;
            if (languageFilter === 'Tagalog') matchesLanguage = isTagalog;
            else if (languageFilter === 'English') matchesLanguage = isEnglish;

            // Match tempo
            let matchesTempo = true;
            if (tempoFilter === 'Fast') matchesTempo = isFast;
            else if (tempoFilter === 'Slow') matchesTempo = isSlow;

            const matchesSearch =
                song.title.toLowerCase().includes(search.toLowerCase()) ||
                song.artist.toLowerCase().includes(search.toLowerCase());
            return matchesLanguage && matchesTempo && matchesSearch;
        });

        return result.sort((a, b) => {
            const titleA = a.title.toLowerCase();
            const titleB = b.title.toLowerCase();
            return sortOrder === 'asc' ? titleA.localeCompare(titleB) : titleB.localeCompare(titleA);
        });
    }, [songs, languageFilter, tempoFilter, search, sortOrder]);

    const handleSignOut = async () => {
        await signOut();
        navigate('/login');
    };

    const handleResetFilters = () => {
        setLanguageFilter('All');
        setTempoFilter('All');
    };

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-24">
                {/* ===== HEADER ===== */}
                <header className="glass sticky top-0 z-10 border-b border-white/5 shadow-md">
                    <div className="px-5 pt-10 pb-4">
                        {/* Top Row: App Logo (Click opens sidebar) + Song Lineup Action */}
                        <div className="flex items-center justify-between mb-4">
                            {/* App Logo opens Sidebar on click */}
                            <AppLogo size="md" showText={true} onClick={openSidebar} />

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/setlists')}
                                    className="px-4 py-2.5 rounded-xl bg-accent/15 border border-accent/30 text-accent hover:bg-accent/25 active:scale-95 text-xs font-bold flex items-center gap-2 shadow-md shadow-accent/10 transition-all min-h-[44px]"
                                    title="Song Lineup"
                                >
                                    <Calendar className="w-4 h-4 text-accent" />
                                    <span>Song Lineup</span>
                                </button>
                            </div>
                        </div>

                        {/* Search, Filter Toggle & Sort Controls */}
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search songs or artists..."
                                    className="w-full bg-secondary border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors text-white min-h-[44px]"
                                />
                            </div>

                            {/* Filter Button with Active Indicator */}
                            <button
                                onClick={() => setShowFilters(f => !f)}
                                className={`px-3.5 rounded-xl border flex items-center gap-2 text-xs font-bold transition-all shrink-0 min-h-[44px] relative active:scale-95 ${
                                    showFilters || isFilterActive
                                        ? 'bg-accent/20 border-accent text-accent shadow-md shadow-accent/10'
                                        : 'bg-secondary border-white/10 text-textmuted hover:text-white'
                                }`}
                                title="Filter Songs"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                <span className="hidden xs:inline">Filter</span>
                                {isFilterActive && (
                                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse shrink-0" />
                                )}
                            </button>

                            {/* Sort Button */}
                            <button
                                onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
                                className="px-3.5 rounded-xl bg-secondary border border-white/10 flex items-center gap-1.5 text-xs font-bold text-accent active:bg-white/10 shrink-0 min-h-[44px]"
                                title="Sort by Title"
                            >
                                <ArrowUpDown className="w-4 h-4 text-accent" />
                                <span>{sortOrder === 'asc' ? 'A–Z' : 'Z–A'}</span>
                            </button>
                        </div>

                        {/* Collapsible Dual Filter Dropdown Panel */}
                        {showFilters && (
                            <div className="mt-3 pt-3 border-t border-white/10 space-y-3.5 animate-fadeIn">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                                        <SlidersHorizontal className="w-3.5 h-3.5 text-accent" /> Filter Options
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

                                {/* Language Filter Pills */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider block">Language</span>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        {['All', 'Tagalog', 'English'].map(lang => (
                                            <button
                                                key={lang}
                                                onClick={() => setLanguageFilter(lang)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all min-h-[36px] ${
                                                    languageFilter === lang
                                                        ? 'bg-accent text-primary border-accent font-bold shadow-md shadow-accent/20'
                                                        : 'border-white/10 text-textmuted hover:border-accent hover:text-white bg-secondary/60'
                                                }`}
                                            >
                                                {lang}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Tempo Filter Pills */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold text-textmuted uppercase tracking-wider block">Tempo</span>
                                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                                        {['All', 'Fast', 'Slow'].map(tempo => (
                                            <button
                                                key={tempo}
                                                onClick={() => setTempoFilter(tempo)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border whitespace-nowrap transition-all min-h-[36px] ${
                                                    tempoFilter === tempo
                                                        ? 'bg-accent text-primary border-accent font-bold shadow-md shadow-accent/20'
                                                        : 'border-white/10 text-textmuted hover:border-accent hover:text-white bg-secondary/60'
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
                <div className="px-5 py-4 space-y-3">
                    {(!songs || songs.length === 0) ? (
                        <LibrarySkeletonCards />
                    ) : filteredSongs.length === 0 ? (
                        <div className="text-center py-20 bg-elevated/40 rounded-3xl border border-white/5 p-8">
                            <Music className="w-12 h-12 mx-auto text-textmuted/30 mb-4" />
                            <p className="text-textmuted text-sm font-medium">
                                No songs found {search ? `for "${search}"` : `matching the selected filters`}
                            </p>
                        </div>
                    ) : (
                        filteredSongs.map((song, idx) => (
                            <SongCard
                                key={`${song.id}-${idx}`}
                                song={song}
                                onClick={() => navigate(`/song/${song.id}`)}
                                onEdit={(e) => {
                                    e.stopPropagation();
                                    setEditingSong(song);
                                }}
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
                    className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-accent text-primary flex items-center justify-center shadow-lg shadow-accent/40 glow-accent z-20 min-w-[56px] min-h-[56px] active:scale-95 transition-transform"
                    title="Add New Song"
                >
                    <Plus className="w-7 h-7" strokeWidth={3} />
                </button>

                {/* ===== ADD SONG MODAL ===== */}
                {showAddModal && <AddSongModal onClose={() => setShowAddModal(false)} />}

                {/* ===== EDIT SONG MODAL ===== */}
                {editingSong && (
                    <EditSongModal
                        song={editingSong}
                        onClose={() => setEditingSong(null)}
                    />
                )}

                {/* ===== QUICK ADD TO SETLIST MODAL ===== */}
                {quickAddSong && (
                    <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
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
function SongCard({ song, onClick, onEdit, onQuickAdd }) {
    const [currentKey, setCurrentKey] = useState(song.originalKey || song.currentKey || 'C');

    const transpose = (direction) => {
        const idx = getKeyIndex(currentKey);
        let newIdx = (idx + direction) % 12;
        if (newIdx < 0) newIdx += 12;
        setCurrentKey(KEYS[newIdx]);
    };

    return (
        <div
            className="bg-elevated rounded-2xl border border-white/5 p-4 active:scale-[0.98] hover:border-white/15 transition-all shadow-md"
            onClick={onClick}
        >
            <div className="flex items-center gap-3">
                {/* Icon */}
                <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center border border-white/5 flex-shrink-0">
                    <Music className="w-5 h-5 text-accent" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white truncate text-sm leading-snug">{song.title}</h3>
                    <p className="text-xs text-textmuted truncate">{song.artist}</p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] px-2.5 py-0.5 bg-accent/10 border border-accent/20 rounded-full text-accent font-semibold">
                            {song.category}
                        </span>
                        <span className="text-[10px] text-textmuted flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {song.tempo} BPM
                        </span>
                    </div>
                </div>

                {/* Actions: Edit, Quick Add, Transpose Key */}
                <div className="flex items-center gap-1.5 shrink-0">
                    {/* Edit Song Button */}
                    <button
                        onClick={onEdit}
                        className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-textmuted hover:text-white flex items-center justify-center active:scale-95 transition-all"
                        title="Edit Song Lyrics & Chords"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>

                    {/* Quick Add Button */}
                    <button
                        onClick={onQuickAdd}
                        className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center active:scale-95 transition-all"
                        title="Quick Add to Setlist"
                    >
                        <ListPlus className="w-4 h-4" />
                    </button>

                    {/* Key Transposer */}
                    <div className="flex items-center gap-0.5 bg-secondary/80 rounded-lg p-0.5 border border-white/5">
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
        category: 'Fast',
        lyrics: '',
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newSong = {
            id: crypto.randomUUID(),
            ...form,
            tempo: parseInt(form.tempo) || 80,
            dateAdded: new Date().toISOString(),
        };
        await songDB.add(newSong);
        await pushSongToSupabase(newSong, user);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4 animate-fadeIn">
            <div className="bg-elevated rounded-t-2xl sm:rounded-2xl border border-white/10 w-full max-w-lg shadow-2xl animate-slideUp max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-elevated flex justify-between items-center px-6 py-4 border-b border-white/10 z-10">
                    <h3 className="text-lg font-bold font-serif text-accent">Add New Song</h3>
                    <button onClick={onClose} className="text-textmuted active:text-white p-1">
                        <X className="w-5 h-5" />
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
                            placeholder="Hillsong Worship"
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-textmuted mb-1.5">Key</label>
                            <select
                                value={form.originalKey}
                                onChange={(e) => setForm({ ...form, originalKey: e.target.value, currentKey: e.target.value })}
                                className="w-full bg-secondary border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
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
                                <option value="Fast">Fast</option>
                                <option value="Slow">Slow</option>
                                <option value="English">English</option>
                                <option value="Tagalog">Tagalog</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-textmuted mb-1.5">Lyrics & Chords</label>
                        <textarea
                            value={form.lyrics}
                            onChange={(e) => setForm({ ...form, lyrics: e.target.value })}
                            rows="6"
                            placeholder="[Verse 1]&#10;[G]Praise the [C]Lord..."
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent resize-none font-mono text-white"
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 text-sm font-medium border border-white/10 rounded-xl active:bg-white/5 text-textmuted">
                            Cancel
                        </button>
                        <button type="submit" className="flex-1 py-2.5 text-sm font-bold bg-accent text-primary rounded-xl active:bg-accent/90 shadow-lg shadow-accent/20">
                            Save Song
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}