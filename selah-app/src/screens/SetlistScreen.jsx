import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setlistDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { useAuth } from '../auth/AuthContext';
import { pushSetlistToSupabase, deleteSetlistFromSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics } from '../utils/chords';
import { parseLyrics, isChordLine, separateChords } from '../utils/lyrics';
import { Menu, Plus, Calendar, ChevronLeft, Trash2, Music, GripVertical, X, Clock, Search, Layers, Play, Printer, Check, ChevronUp, ChevronDown, User, Save } from 'lucide-react';
import { useContext } from 'react';
import { UIContext } from '../App';
import AppLogo from '../components/AppLogo';
import { SetlistSkeletonCards } from '../components/SkeletonLoader';

export default function SetlistScreen() {
    const navigate = useNavigate();
    const { openSidebar } = useContext(UIContext);
    const [showAddModal, setShowAddModal] = useState(false);
    const [printSetlistData, setPrintSetlistData] = useState(null);

    const { setlists } = useSongCache();

    // Hydrate from Supabase on mount
    useEffect(() => { discreetBackgroundSync(); }, []);

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-24">
                {/* Header */}
                <header className="glass sticky top-0 z-10 border-b border-white/5 shadow-md">
                    <div className="px-5 pt-10 pb-4">
                        <div className="flex items-center justify-between">
                            {/* App Logo opens Sidebar on click */}
                            <AppLogo size="md" showText={true} onClick={openSidebar} />

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigate('/library')}
                                    className="px-3.5 py-2 rounded-xl bg-secondary border border-white/10 flex items-center gap-1.5 text-xs font-bold text-textmuted hover:text-white active:scale-95 transition-colors shrink-0"
                                    title="Back to Library"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Library</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Setlist List Container */}
                <div className="px-5 py-4 space-y-4">
                    {!setlists ? (
                        <SetlistSkeletonCards />
                    ) : setlists.length === 0 ? (
                        <div className="text-center py-20 bg-elevated/40 rounded-3xl border border-white/5 p-8">
                            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-white mb-1">No Setlists Created</h3>
                            <p className="text-textmuted text-xs max-w-xs mx-auto mb-6">
                                Create your first setlist to arrange songs and print 2-songs-per-page A4 charts.
                            </p>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="px-6 py-3.5 bg-accent text-primary rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:bg-yellow-300 min-h-[44px]"
                            >
                                Create Worship Setlist
                            </button>
                        </div>
                    ) : (
                        setlists.map(setlist => (
                            <ModernSetlistCard
                                key={setlist.id}
                                setlist={setlist}
                                onPrint={() => setPrintSetlistData(setlist)}
                            />
                        ))
                    )}
                </div>

                {/* Floating Action Button */}
                <button
                    onClick={() => setShowAddModal(true)}
                    className="fixed bottom-6 right-6 w-16 h-16 min-w-[56px] min-h-[56px] rounded-full bg-accent text-primary flex items-center justify-center shadow-lg shadow-accent/40 glow-accent z-20 active:scale-95 transition-transform"
                    title="Create Setlist"
                >
                    <Plus className="w-7 h-7" strokeWidth={3} />
                </button>

                {showAddModal && <AddSetlistModal onClose={() => setShowAddModal(false)} />}

                {/* Print Modal / Document Preview */}
                {printSetlistData && (
                    <PrintSetlistModal
                        setlist={printSetlistData}
                        onClose={() => setPrintSetlistData(null)}
                    />
                )}
            </div>
        </PullToRefresh>
    );
}

// ── Modernized Setlist Card ──
function ModernSetlistCard({ setlist, onPrint }) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [showSongPicker, setShowSongPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Fetch songs in exact setlist.songIds order with fallback to local seed
    const { songs: allSongs } = useSongCache();
    const [setlistSongs, setSetlistSongs] = useState([]);

    useEffect(() => {
        let isMounted = true;
        async function fetchSongs() {
            const songs = await Promise.all((setlist.songIds || []).map(id => getSongByIdOrTitle(id)));
            if (isMounted) setSetlistSongs(songs.filter(Boolean));
        }
        fetchSongs();
        return () => { isMounted = false; };
    }, [setlist.songIds?.join(','), allSongs]);

    const songKeys = setlist.songKeys || {};
    const [saveStatus, setSaveStatus] = useState('');

    const handleSaveSetlist = async (e) => {
        e?.stopPropagation();
        try {
            await pushSetlistToSupabase(setlist, user);
            setSaveStatus('Saved!');
            setTimeout(() => setSaveStatus(''), 2500);
        } catch (err) {
            setSaveStatus('Saved locally');
            setTimeout(() => setSaveStatus(''), 2500);
        }
    };

    const handleDeleteSetlist = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete setlist "${setlist.title}"?`)) {
            await deleteSetlistFromSupabase(setlist.id, user);
            await setlistDB.delete(setlist.id);
        }
    };

    // Update Transposed Key for a specific song inside the setlist
    const handleSetSongKey = async (songId, newKey) => {
        const updatedKeys = { ...songKeys, [songId]: newKey };
        await setlistDB.update(setlist.id, { songKeys: updatedKeys });
        await pushSetlistToSupabase({ ...setlist, songKeys: updatedKeys }, user);
    };

    // Reorder song position logic
    const reorderSongs = async (fromIdx, toIdx) => {
        if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
        const currentSongIds = [...(setlist.songIds || [])];
        if (fromIdx < 0 || fromIdx >= currentSongIds.length || toIdx < 0 || toIdx >= currentSongIds.length) return;
        
        const [movedId] = currentSongIds.splice(fromIdx, 1);
        currentSongIds.splice(toIdx, 0, movedId);

        await setlistDB.update(setlist.id, { songIds: currentSongIds });
        await pushSetlistToSupabase({ ...setlist, songIds: currentSongIds }, user);
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    const moveSongUp = async (e, idx) => {
        e.stopPropagation();
        if (idx > 0) {
            await reorderSongs(idx, idx - 1);
        }
    };

    const moveSongDown = async (e, idx) => {
        e.stopPropagation();
        if (idx < (setlist.songIds || []).length - 1) {
            await reorderSongs(idx, idx + 1);
        }
    };

    // Drag Events
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = async (e, targetIndex) => {
        e.preventDefault();
        const transferIdxStr = e.dataTransfer.getData('text/plain');
        const sourceIndex = transferIdxStr !== '' ? parseInt(transferIdxStr, 10) : draggedIndex;
        if (!isNaN(sourceIndex) && sourceIndex !== null) {
            await reorderSongs(sourceIndex, targetIndex);
        }
    };

    // Touch Events
    const handleTouchStart = (index) => {
        setDraggedIndex(index);
    };

    const handleTouchMove = (e) => {
        if (draggedIndex === null) return;
        const touch = e.touches[0];
        const targetElement = document.elementFromPoint(touch.clientX, touch.clientY);
        const itemElement = targetElement?.closest('[data-song-index]');
        if (itemElement) {
            const hoverIndex = Number(itemElement.getAttribute('data-song-index'));
            if (!isNaN(hoverIndex) && hoverIndex !== dragOverIndex) {
                setDragOverIndex(hoverIndex);
            }
        }
    };

    const handleTouchEnd = async () => {
        if (draggedIndex !== null && dragOverIndex !== null) {
            await reorderSongs(draggedIndex, dragOverIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Remove song from setlist
    const handleRemoveSong = async (e, songId) => {
        e.stopPropagation();
        const updatedIds = (setlist.songIds || []).filter(id => id !== songId);
        await setlistDB.update(setlist.id, { songIds: updatedIds });
        await pushSetlistToSupabase({ ...setlist, songIds: updatedIds }, user);
    };

    // Add song to setlist
    const handleAddSong = async (songId) => {
        const currentIds = setlist.songIds || [];
        if (!currentIds.includes(songId)) {
            const updatedIds = [...currentIds, songId];
            await setlistDB.update(setlist.id, { songIds: updatedIds });
            await pushSetlistToSupabase({ ...setlist, songIds: updatedIds }, user);
        }
        setShowSongPicker(false);
    };

    const filteredPickerSongs = (allSongs || []).filter(s =>
        s.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        s.artist.toLowerCase().includes(pickerSearch.toLowerCase())
    );

    return (
        <div className="bg-elevated rounded-2xl border border-white/5 shadow-xl overflow-hidden transition-all duration-200">
            {/* Setlist Header Card */}
            <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 active:bg-white/10 transition-colors gap-3"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent shrink-0">
                        <Calendar className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-base text-white truncate leading-tight">{setlist.title}</h3>
                        <p className="text-xs text-textmuted flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span>{setlist.date || 'Undated'}</span>
                            <span>•</span>
                            <span className="text-accent font-semibold">{setlistSongs.length} songs</span>
                            <span>•</span>
                            <span className="text-textmuted truncate">by <strong className="text-white">{setlist.preparedBy || 'Worship Leader'}</strong></span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleDeleteSetlist}
                        className="w-10 h-10 rounded-xl bg-white/5 active:bg-danger/20 text-textmuted active:text-danger flex items-center justify-center min-w-[40px] min-h-[40px]"
                        title="Delete Setlist"
                    >
                        <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-textmuted min-w-[40px] min-h-[40px]">
                        <ChevronLeft className={`w-5 h-5 transition-transform duration-200 ${expanded ? '-rotate-90' : ''}`} />
                    </div>
                </div>
            </div>

            {/* Notes banner if present */}
            {setlist.notes && (
                <div className="px-4 py-2 bg-secondary/40 border-t border-white/5 text-xs text-textmuted italic">
                    "{setlist.notes}"
                </div>
            )}

            {/* Expanded Song Reordering & Key Selector List */}
            {expanded && (
                <div className="border-t border-white/10 bg-secondary/20 p-4 space-y-4">
                    {/* Full-width Prominent Primary CTA */}
                    <button
                        onClick={() => navigate(`/setlist-player/${setlist.id}`)}
                        className="w-full h-12 bg-accent text-primary rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/25 active:bg-yellow-300 active:scale-[0.99] transition-all min-h-[48px]"
                        title="Open Live Setlist Player"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Launch Live Setlist Player</span>
                    </button>

                    {/* Secondary Action Toolbar Grid */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            onClick={() => setShowSongPicker(true)}
                            className="h-10 px-3 bg-secondary border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-white/20 min-h-[40px]"
                        >
                            <Plus className="w-4 h-4 text-accent" strokeWidth={2.5} />
                            <span>Add Songs</span>
                        </button>

                        <button
                            onClick={onPrint}
                            className="h-10 px-3 bg-secondary border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-white/20 min-h-[40px]"
                        >
                            <Printer className="w-4 h-4 text-accent" />
                            <span>Print Chart</span>
                        </button>

                        <button
                            onClick={handleSaveSetlist}
                            className="h-10 px-3 bg-secondary border border-white/10 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-white/20 min-h-[40px]"
                            title="Force Sync Setlist to Cloud"
                        >
                            {saveStatus === 'Saved!' ? (
                                <>
                                    <Check className="w-4 h-4 text-accent" />
                                    <span>Synced</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 text-accent" />
                                    <span>Save Sync</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Song List in Setlist */}
                    <div className="pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-textmuted block mb-2">Setlist Arrangement & Transposed Keys</span>

                        {setlistSongs.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-secondary/40 p-4">
                                <p className="text-xs text-textmuted mb-2">No songs in this setlist yet.</p>
                                <button
                                    onClick={() => setShowSongPicker(true)}
                                    className="text-xs text-accent font-bold underline"
                                >
                                    Tap here to add songs
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2.5 relative" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
                                {setlistSongs.map((song, idx) => {
                                    const isBeingDragged = draggedIndex === idx;
                                    const isTargetHover = dragOverIndex === idx;
                                    const currentKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';

                                    return (
                                        <div
                                            key={song.id}
                                            data-song-index={idx}
                                            draggable={true}
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            className={`group p-3.5 rounded-xl border transition-all duration-150 space-y-2.5 ${
                                                isBeingDragged
                                                    ? 'bg-accent/20 border-accent scale-[1.02] shadow-2xl z-20 opacity-80'
                                                    : isTargetHover
                                                    ? 'bg-accent/10 border-accent border-dashed scale-[1.01]'
                                                    : 'bg-elevated border-white/10 hover:border-accent/40 active:bg-white/5'
                                            }`}
                                        >
                                            {/* Top Row: Drag handle, track #, title/artist, and delete X button */}
                                            <div className="flex items-center gap-3">
                                                {/* Touch & Hold Drag Handle */}
                                                <div
                                                    onTouchStart={() => handleTouchStart(idx)}
                                                    className="w-9 h-9 rounded-xl bg-white/5 active:bg-accent/20 flex items-center justify-center text-textmuted active:text-accent cursor-grab active:cursor-grabbing touch-none shrink-0"
                                                    title="Touch and Hold to Drag"
                                                >
                                                    <GripVertical className="w-4 h-4 text-accent/70" />
                                                </div>

                                                {/* Track Index Badge */}
                                                <span className="w-7 h-7 rounded-lg bg-secondary text-accent text-xs font-bold flex items-center justify-center shrink-0 border border-white/5">
                                                    {idx + 1}
                                                </span>

                                                {/* Song Info */}
                                                <div
                                                    className="flex-1 min-w-0 cursor-pointer"
                                                    onClick={() => navigate(`/song/${song.id}`)}
                                                >
                                                    <h4 className="text-sm font-bold text-white truncate leading-tight">{song.title}</h4>
                                                    <p className="text-xs text-textmuted truncate mt-0.5">
                                                        {song.artist} • <span className="text-accent font-medium">{song.category}</span>
                                                    </p>
                                                </div>

                                                {/* Remove Button */}
                                                <button
                                                    onClick={(e) => handleRemoveSong(e, song.id)}
                                                    className="w-9 h-9 rounded-xl bg-white/5 active:bg-danger/20 text-textmuted active:text-danger flex items-center justify-center shrink-0 min-w-[36px] min-h-[36px]"
                                                    title="Remove from Setlist"
                                                >
                                                    <X className="w-4.5 h-4.5" />
                                                </button>
                                            </div>

                                            {/* Bottom Row: Spacious Reorder Arrows & Key Transposer */}
                                            <div className="flex items-center justify-between pt-2 border-t border-white/5 gap-2">
                                                {/* Reorder Buttons */}
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={(e) => moveSongUp(e, idx)}
                                                        disabled={idx === 0}
                                                        className="px-2.5 h-8 rounded-lg bg-secondary border border-white/5 text-textmuted active:text-white disabled:opacity-20 flex items-center gap-1 text-xs font-medium"
                                                        title="Move Up"
                                                    >
                                                        <ChevronUp className="w-4 h-4 text-accent" />
                                                        <span className="text-[10px] font-semibold">Up</span>
                                                    </button>
                                                    <button
                                                        onClick={(e) => moveSongDown(e, idx)}
                                                        disabled={idx === setlistSongs.length - 1}
                                                        className="px-2.5 h-8 rounded-lg bg-secondary border border-white/5 text-textmuted active:text-white disabled:opacity-20 flex items-center gap-1 text-xs font-medium"
                                                        title="Move Down"
                                                    >
                                                        <ChevronDown className="w-4 h-4 text-accent" />
                                                        <span className="text-[10px] font-semibold">Down</span>
                                                    </button>
                                                </div>

                                                {/* Configured Key Transposer */}
                                                <div className="flex items-center gap-1.5 bg-secondary rounded-lg px-2.5 py-1 border border-white/10">
                                                    <span className="text-[10px] uppercase font-bold text-textmuted mr-0.5">Key</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const keys = KEYS;
                                                            const curIdx = keys.indexOf(currentKey);
                                                            const nextIdx = (curIdx - 1 + 12) % 12;
                                                            handleSetSongKey(song.id, keys[nextIdx]);
                                                        }}
                                                        className="w-7 h-7 rounded-md bg-white/10 active:bg-accent/20 text-sm font-bold text-white flex items-center justify-center min-w-[28px]"
                                                        title="Key Down"
                                                    >
                                                        −
                                                    </button>
                                                    <div className="px-2 h-7 flex items-center justify-center text-xs font-bold text-accent min-w-[28px]">
                                                        {currentKey}
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const keys = KEYS;
                                                            const curIdx = keys.indexOf(currentKey);
                                                            const nextIdx = (curIdx + 1) % 12;
                                                            handleSetSongKey(song.id, keys[nextIdx]);
                                                        }}
                                                        className="w-7 h-7 rounded-md bg-white/10 active:bg-accent/20 text-sm font-bold text-white flex items-center justify-center min-w-[28px]"
                                                        title="Key Up"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Song Selection Picker Modal */}
            {showSongPicker && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
                    <div className="bg-elevated rounded-t-3xl sm:rounded-2xl border border-white/10 w-full max-w-md shadow-2xl animate-slideUp">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                            <div>
                                <h3 className="text-base font-bold text-white">Add Songs to Setlist</h3>
                                <p className="text-xs text-accent truncate">{setlist.title}</p>
                            </div>
                            <button onClick={() => setShowSongPicker(false)} className="text-textmuted active:text-white p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Search song title or artist..."
                                    className="w-full bg-secondary border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-textmuted focus:outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                            {filteredPickerSongs.length === 0 ? (
                                <p className="text-textmuted text-center py-6 text-xs italic">No matching songs found</p>
                            ) : (
                                filteredPickerSongs.map(s => {
                                    const isAdded = (setlist.songIds || []).includes(s.id);
                                    return (
                                        <button
                                            key={s.id}
                                            disabled={isAdded}
                                            onClick={() => handleAddSong(s.id)}
                                            className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition-colors ${
                                                isAdded
                                                    ? 'bg-secondary/40 border-white/5 opacity-50 cursor-not-allowed'
                                                    : 'bg-secondary border-white/5 hover:border-accent active:bg-white/10'
                                            }`}
                                        >
                                            <div className="min-w-0 pr-2">
                                                <p className="font-semibold text-white text-sm truncate">{s.title}</p>
                                                <p className="text-xs text-textmuted truncate">{s.artist} • <span className="text-accent">{s.category}</span></p>
                                            </div>
                                            {isAdded ? (
                                                <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 px-2 py-1 rounded">Added</span>
                                            ) : (
                                                <Plus className="w-4 h-4 text-accent shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Print Preview Modal Component ──
function PrintSetlistModal({ setlist, onClose }) {
    const { songs: allSongs } = useSongCache();
    const songKeys = setlist.songKeys || {};
    const [setlistSongs, setSetlistSongs] = useState([]);

    useEffect(() => {
        let isMounted = true;
        async function fetchSongs() {
            const songs = await Promise.all((setlist.songIds || []).map(id => getSongByIdOrTitle(id)));
            if (isMounted) setSetlistSongs(songs.filter(Boolean));
        }
        fetchSongs();
        return () => { isMounted = false; };
    }, [setlist.songIds?.join(','), allSongs]);

    // Chunk songs into groups of EXACTLY 2 songs per page
    const pages = [];
    for (let i = 0; i < setlistSongs.length; i += 2) {
        pages.push(setlistSongs.slice(i, i + 2));
    }

    const handlePrintTrigger = () => {
        if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
            window.AndroidPrint.print();
        } else {
            window.print();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto p-4 flex flex-col items-center">
            {/* Minimalist Action Bar */}
            <div className="sticky top-4 z-50 w-full max-w-4xl bg-elevated/95 border border-white/15 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center justify-between gap-4 mb-6 print:hidden">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                        <Printer className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-bold text-white text-base truncate">Print Preview</h3>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-white/10 text-textmuted active:text-white flex items-center justify-center transition-colors min-w-[40px] min-h-[40px]"
                        title="Close Preview"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handlePrintTrigger}
                        className="w-12 h-10 rounded-xl bg-accent text-primary flex items-center justify-center shadow-lg shadow-accent/25 active:bg-yellow-300 active:scale-95 transition-all min-w-[48px] min-h-[40px]"
                        title="Print / Save PDF"
                    >
                        <Printer className="w-5 h-5 fill-current" />
                    </button>
                </div>
            </div>

            {/* Printable Document Container */}
            <div className="printable-wrapper w-full max-w-4xl space-y-8 print:space-y-0">
                {pages.map((pageSongs, pageIdx) => (
                    <div
                        key={pageIdx}
                        className="a4-page bg-white text-black p-8 rounded-xl shadow-2xl w-full min-h-[1080px] text-left flex flex-col justify-between box-border overflow-hidden"
                        style={{
                            pageBreakAfter: pageIdx < pages.length - 1 ? 'always' : 'auto',
                            breakAfter: pageIdx < pages.length - 1 ? 'page' : 'auto'
                        }}
                    >
                        {/* Page Header */}
                        <div className="border-b-2 border-black/20 pb-3 mb-4 flex justify-between items-center shrink-0">
                            <div>
                                <h1 className="text-xl font-bold font-serif text-black uppercase tracking-wide">
                                    {setlist.title} {pages.length > 1 ? `(Page ${pageIdx + 1} of ${pages.length})` : ''}
                                </h1>
                                <p className="text-[10px] text-gray-600">
                                    Selah Worship Planner • Date: {setlist.date || 'Undated'} • Prepared by: <strong>{setlist.preparedBy || 'Worship Leader'}</strong>
                                </p>
                            </div>
                            <span className="text-[10px] font-bold uppercase bg-black text-white px-2.5 py-1 rounded">
                                Songs {pageIdx * 2 + 1}–{Math.min((pageIdx + 1) * 2, setlistSongs.length)} of {setlistSongs.length}
                            </span>
                        </div>

                        {setlist.notes && pageIdx === 0 && (
                            <div className="mb-4 p-2.5 bg-gray-100 border-l-4 border-black rounded text-[11px] text-gray-800 italic shrink-0">
                                <strong>Notes:</strong> {setlist.notes}
                            </div>
                        )}

                        {/* 2-Column Song Layout per Page */}
                        <div className="grid grid-cols-2 gap-5 items-start flex-1 min-h-0">
                            {pageSongs.map((song, songInPageIdx) => {
                                const globalIdx = pageIdx * 2 + songInPageIdx;
                                const targetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                                const semitones = semitonesBetween(song.originalKey || 'C', targetKey);
                                const transposedLyrics = transposeLyrics(song.lyrics || '', semitones);
                                const sections = parseLyrics(transposedLyrics);

                                return (
                                    <div
                                        key={song.id}
                                        className="border border-gray-300 rounded-xl p-3.5 bg-gray-50/50 shadow-sm overflow-hidden box-border max-w-full h-full flex flex-col justify-between"
                                    >
                                        <div>
                                            {/* Song Header */}
                                            <div className="border-b-2 border-gray-300 pb-2 mb-3 flex items-start justify-between gap-2 shrink-0">
                                                <div className="min-w-0 flex-1">
                                                    <h3 className="font-bold text-base text-black leading-tight break-words">
                                                        {globalIdx + 1}. {song.title}
                                                    </h3>
                                                    <p className="text-xs text-gray-600 font-medium truncate">{song.artist}</p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="px-2.5 py-1 bg-black text-white rounded-lg font-bold text-xs inline-block shadow-sm">
                                                        Key: {targetKey}
                                                    </span>
                                                    {targetKey !== song.originalKey && (
                                                        <p className="text-[10px] text-gray-500 mt-0.5">Orig: {song.originalKey}</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Song Sections with 12px Legible Chords/Lyrics */}
                                            <div className="space-y-2.5 text-[12px] leading-snug">
                                                {sections.map((sec, sIdx) => (
                                                    <div key={sIdx} className="mb-2">
                                                        <div className="font-bold text-[11px] uppercase tracking-wider text-amber-900 border-b border-gray-200 pb-0.5 mb-0.5">
                                                            {sec.label}
                                                        </div>
                                                        {sec.lines.map((line, lIdx) => {
                                                            const cleanLyricLine = line.replace(/\[[^\]]+\]/g, '').trim();

                                                            if (!isChordLine(line)) {
                                                                return (
                                                                    <p key={lIdx} className="text-gray-900 font-sans text-[12px] leading-snug my-0.5 whitespace-pre-wrap break-words max-w-full">
                                                                        {cleanLyricLine || line || '\u00A0'}
                                                                    </p>
                                                                );
                                                            }

                                                            const { chordLine, lyricLine } = separateChords(line);
                                                            return (
                                                                <div key={lIdx} className="my-1 overflow-hidden">
                                                                    <pre className="font-mono text-amber-900 font-bold text-[12px] leading-tight mb-0.5 whitespace-pre-wrap break-words max-w-full">
                                                                        {chordLine}
                                                                    </pre>
                                                                    <p className="text-gray-900 font-sans text-[12px] leading-snug my-0 whitespace-pre-wrap break-words max-w-full">
                                                                        {lyricLine || '\u00A0'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Global Print CSS Styles for Multi-Sheet A4 Printing */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    html, body {
                        background: #ffffff !important;
                        color: #000000 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    /* Unset modal overflow and container restrictions during print */
                    .fixed.inset-0 {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        background: transparent !important;
                        backdrop-filter: none !important;
                        overflow: visible !important;
                        padding: 0 !important;
                        display: block !important;
                    }
                    button, header, nav {
                        display: none !important;
                    }
                    .printable-wrapper {
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .a4-page {
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        padding: 12mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        page-break-before: auto !important;
                        page-break-after: always !important;
                        break-after: page !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        overflow: hidden !important;
                    }
                    .a4-page:last-child {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                    .a4-page pre {
                        font-size: 12px !important;
                        line-height: 1.2 !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                        max-width: 100% !important;
                    }
                    .a4-page p {
                        font-size: 12px !important;
                        line-height: 1.3 !important;
                        white-space: pre-wrap !important;
                        word-break: break-word !important;
                        overflow-wrap: anywhere !important;
                        max-width: 100% !important;
                    }
                }
            ` }} />
        </div>
    );
}

// ── Add Setlist Modal ──
function AddSetlistModal({ onClose }) {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [preparedBy, setPreparedBy] = useState(
        user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
    );
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const author = preparedBy.trim() || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Worship Leader';
        const newSetlist = {
            id: crypto.randomUUID(),
            title,
            date,
            preparedBy: author,
            notes,
            songIds: [],
            songKeys: {},
            created: new Date().toISOString()
        };

        await setlistDB.add(newSetlist);
        await pushSetlistToSupabase(newSetlist, user);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-elevated rounded-t-3xl sm:rounded-2xl border border-white/10 w-full max-w-sm shadow-2xl animate-slideUp">
                <div className="flex justify-between items-center px-6 py-4 border-b border-white/10">
                    <h3 className="text-lg font-bold text-white">New Worship Setlist</h3>
                    <button onClick={onClose} className="text-textmuted active:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Setlist Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Sunday Worship - Dec 24"
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Service Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Prepared By</label>
                        <input
                            type="text"
                            value={preparedBy}
                            onChange={(e) => setPreparedBy(e.target.value)}
                            placeholder="Worship Leader / Your Name"
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            placeholder="Worship Leader, Theme, Keys..."
                            className="w-full bg-secondary border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-white resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-3 text-xs font-bold border border-white/10 rounded-xl active:bg-white/5 text-textmuted">
                            Cancel
                        </button>
                        <button type="submit" className="flex-1 py-3 text-xs font-bold bg-accent text-primary rounded-xl active:bg-yellow-300 shadow-md shadow-accent/20">
                            Create Setlist
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}