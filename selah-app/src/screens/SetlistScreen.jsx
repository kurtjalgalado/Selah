import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setlistDB } from '../db/dexie';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics } from '../utils/chords';
import { parseLyrics, isChordLine, separateChords } from '../utils/lyrics';
import {
    Plus, Calendar, ChevronLeft, Trash2, Music, GripVertical,
    X, Clock, Search, Layers, Play, Printer, Check, ChevronUp, ChevronDown
} from 'lucide-react';

export default function SetlistScreen() {
    const navigate = useNavigate();
    const [showAddModal, setShowAddModal] = useState(false);
    const [printSetlistData, setPrintSetlistData] = useState(null);

    const setlists = useLiveQuery(() => db.setlists.toArray(), [], []);

    return (
        <div className="min-h-screen bg-primary pb-24">
            {/* Header */}
            <header className="glass sticky top-0 z-10 border-b border-white/5 shadow-md">
                <div className="px-5 pt-12 pb-4">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => navigate('/library')}
                            className="w-10 h-10 rounded-xl bg-secondary border border-white/10 flex items-center justify-center text-textmuted active:text-white"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="text-center">
                            <h1 className="text-xl font-bold text-white leading-none">Worship Setlists</h1>
                            <p className="text-[10px] text-textmuted tracking-widest uppercase mt-1">2 Songs Per Page A4 Print Format</p>
                        </div>
                        <div className="w-10" />
                    </div>
                </div>
            </header>

            {/* Setlist List */}
            <div className="px-5 py-5 space-y-4 max-w-xl mx-auto">
                {setlists.length === 0 ? (
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
                            className="px-5 py-3 bg-accent text-primary rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:bg-yellow-300"
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
                className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-accent text-primary flex items-center justify-center shadow-lg shadow-accent/40 glow-accent z-20 active:scale-95 transition-transform"
                title="Create Setlist"
            >
                <Plus className="w-6 h-6" strokeWidth={3} />
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
    );
}

// ── Modernized Setlist Card ──
function ModernSetlistCard({ setlist, onPrint }) {
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState(false);
    const [showSongPicker, setShowSongPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Fetch songs in exact setlist.songIds order
    const allSongs = useLiveQuery(() => db.songs.toArray(), [], []);

    const setlistSongs = (setlist.songIds || [])
        .map(id => (allSongs || []).find(s => s.id === id))
        .filter(Boolean);

    const songKeys = setlist.songKeys || {};

    const handleDeleteSetlist = async (e) => {
        e.stopPropagation();
        if (confirm(`Delete setlist "${setlist.title}"?`)) {
            await setlistDB.delete(setlist.id);
        }
    };

    // Update Transposed Key for a specific song inside the setlist
    const handleSetSongKey = async (songId, newKey) => {
        const updatedKeys = { ...songKeys, [songId]: newKey };
        await setlistDB.update(setlist.id, { songKeys: updatedKeys });
    };

    // Reorder song position logic
    const reorderSongs = async (fromIdx, toIdx) => {
        if (fromIdx === null || toIdx === null || fromIdx === toIdx) return;
        const currentSongIds = [...(setlist.songIds || [])];
        const [movedId] = currentSongIds.splice(fromIdx, 1);
        currentSongIds.splice(toIdx, 0, movedId);

        await setlistDB.update(setlist.id, { songIds: currentSongIds });
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Drag Events
    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = async (e, targetIndex) => {
        e.preventDefault();
        await reorderSongs(draggedIndex, targetIndex);
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
    };

    // Add song to setlist
    const handleAddSong = async (songId) => {
        const currentIds = setlist.songIds || [];
        if (!currentIds.includes(songId)) {
            await setlistDB.update(setlist.id, { songIds: [...currentIds, songId] });
        }
        setShowSongPicker(false);
    };

    const filteredPickerSongs = (allSongs || []).filter(s =>
        s.title.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        s.artist.toLowerCase().includes(pickerSearch.toLowerCase())
    );

    return (
        <div className="bg-elevated/90 rounded-2xl border border-white/10 overflow-hidden shadow-xl transition-all duration-200">
            {/* Card Header */}
            <div
                className="p-4 flex items-center justify-between active:bg-white/5 cursor-pointer"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-secondary border border-white/10 flex items-center justify-center text-accent shrink-0 shadow-md">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-base truncate">{setlist.title}</h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-textmuted">
                            <span>{setlist.date || 'No date'}</span>
                            <span>•</span>
                            <span className="text-accent font-semibold">{setlistSongs.length} songs</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Print Setlist Button */}
                    <button
                        onClick={(e) => { e.stopPropagation(); onPrint(); }}
                        className="px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-xs flex items-center gap-1.5 active:bg-accent/30 shadow-sm"
                        title="Print 2-Column Setlist"
                    >
                        <Printer className="w-4 h-4" />
                        <span className="hidden sm:inline">Print</span>
                    </button>

                    <button
                        onClick={handleDeleteSetlist}
                        className="w-9 h-9 rounded-xl bg-white/5 active:bg-danger/20 text-textmuted active:text-danger flex items-center justify-center"
                        title="Delete Setlist"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-textmuted">
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
                <div className="border-t border-white/10 bg-secondary/20 p-4 space-y-3">
                    <div className="flex items-center justify-between pb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-textmuted">Setlist Order & Key Configuration</span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onPrint}
                                className="px-2.5 py-1 bg-white/10 border border-white/15 text-white rounded-lg text-xs font-bold flex items-center gap-1 active:bg-white/20"
                            >
                                <Printer className="w-3.5 h-3.5 text-accent" /> Print Chart
                            </button>
                            <button
                                onClick={() => setShowSongPicker(true)}
                                className="px-3 py-1 bg-accent text-primary rounded-lg text-xs font-bold flex items-center gap-1 active:bg-yellow-300"
                            >
                                <Plus className="w-3.5 h-3.5" strokeWidth={3} /> Add Songs
                            </button>
                        </div>
                    </div>

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
                        <div className="space-y-2 relative" onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
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
                                        className={`group flex items-center gap-3 p-3 rounded-xl border transition-all duration-150 ${
                                            isBeingDragged
                                                ? 'bg-accent/20 border-accent scale-[1.02] shadow-2xl z-20 opacity-80'
                                                : isTargetHover
                                                ? 'bg-accent/10 border-accent border-dashed scale-[1.01]'
                                                : 'bg-elevated border-white/10 hover:border-accent/40 active:bg-white/5'
                                        }`}
                                    >
                                        {/* Touch & Hold Drag Handle */}
                                        <div
                                            onTouchStart={() => handleTouchStart(idx)}
                                            className="w-8 h-8 rounded-lg bg-white/5 active:bg-accent/20 flex items-center justify-center text-textmuted active:text-accent cursor-grab active:cursor-grabbing shrink-0 touch-none"
                                            title="Touch and Hold to Drag"
                                        >
                                            <GripVertical className="w-4 h-4 text-accent/70" />
                                        </div>

                                        {/* Track Index Badge */}
                                        <span className="w-6 h-6 rounded-lg bg-secondary text-textmuted text-xs font-bold flex items-center justify-center shrink-0">
                                            {idx + 1}
                                        </span>

                                        {/* Song Info */}
                                        <div
                                            className="flex-1 min-w-0 cursor-pointer"
                                            onClick={() => navigate(`/song/${song.id}`)}
                                        >
                                            <h4 className="text-sm font-semibold text-white truncate">{song.title}</h4>
                                            <p className="text-xs text-textmuted truncate">
                                                {song.artist} • <span className="text-accent font-medium">{song.category}</span>
                                            </p>
                                        </div>

                                        {/* Configured Key Transposer for Setlist */}
                                        <div className="flex items-center gap-1 shrink-0 bg-secondary/80 rounded-lg p-0.5 border border-white/10">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const keys = KEYS;
                                                    const curIdx = keys.indexOf(currentKey);
                                                    const nextIdx = (curIdx - 1 + 12) % 12;
                                                    handleSetSongKey(song.id, keys[nextIdx]);
                                                }}
                                                className="w-6 h-6 rounded bg-white/5 active:bg-white/15 text-xs font-bold text-white flex items-center justify-center"
                                                title="Key Down"
                                            >
                                                −
                                            </button>
                                            <div className="px-2 h-6 flex items-center justify-center text-[11px] font-bold text-accent min-w-[28px]">
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
                                                className="w-6 h-6 rounded bg-white/5 active:bg-white/15 text-xs font-bold text-white flex items-center justify-center"
                                                title="Key Up"
                                            >
                                                +
                                            </button>
                                        </div>

                                        {/* Remove Button */}
                                        <button
                                            onClick={(e) => handleRemoveSong(e, song.id)}
                                            className="w-7 h-7 rounded-lg bg-white/5 active:bg-danger/20 text-textmuted active:text-danger flex items-center justify-center shrink-0"
                                            title="Remove from Setlist"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
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

                        {/* Search */}
                        <div className="p-4 border-b border-white/5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Search song title or artist..."
                                    className="w-full bg-secondary border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-accent text-white"
                                />
                            </div>
                        </div>

                        {/* Song List */}
                        <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                            {filteredPickerSongs.length === 0 ? (
                                <p className="text-center text-textmuted text-xs py-4">No matching songs found</p>
                            ) : (
                                filteredPickerSongs.map(song => {
                                    const isAdded = (setlist.songIds || []).includes(song.id);

                                    return (
                                        <div
                                            key={song.id}
                                            onClick={() => handleAddSong(song.id)}
                                            className={`w-full p-3 rounded-xl border flex items-center justify-between text-left cursor-pointer transition-colors ${
                                                isAdded
                                                    ? 'bg-accent/15 border-accent/40 text-white'
                                                    : 'bg-secondary border-white/5 hover:border-white/20 active:bg-white/10'
                                            }`}
                                        >
                                            <div className="min-w-0 flex-1 pr-3">
                                                <p className="font-semibold text-xs text-white truncate">{song.title}</p>
                                                <p className="text-[10px] text-textmuted truncate">{song.artist} • <span className="text-accent">{song.category}</span></p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="key-badge px-2 py-0.5 rounded text-[10px] font-bold">{song.originalKey}</span>
                                                {isAdded ? (
                                                    <span className="text-[10px] font-bold text-accent px-2 py-0.5 bg-accent/20 rounded">Added</span>
                                                ) : (
                                                    <Plus className="w-4 h-4 text-accent" />
                                                )}
                                            </div>
                                        </div>
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

// ── Print Setlist Modal (EXACTLY 2 SONGS PER A4 PAGE, WRAPPED TEXT) ──
function PrintSetlistModal({ setlist, onClose }) {
    const allSongs = useLiveQuery(() => db.songs.toArray(), [], []);
    const songKeys = setlist.songKeys || {};

    const setlistSongs = (setlist.songIds || [])
        .map(id => (allSongs || []).find(s => s.id === id))
        .filter(Boolean);

    // Chunk songs into groups of EXACTLY 2 songs per page
    const pages = [];
    for (let i = 0; i < setlistSongs.length; i += 2) {
        pages.push(setlistSongs.slice(i, i + 2));
    }

    const handlePrintTrigger = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 overflow-y-auto p-4 flex flex-col items-center">
            {/* Action Bar (Hidden during printing) */}
            <div className="sticky top-4 z-50 w-full max-w-4xl bg-elevated border border-white/15 p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 mb-6 print:hidden">
                <div>
                    <h3 className="font-bold text-white text-base">Print Setlist Chart</h3>
                    <p className="text-xs text-textmuted">2 Songs Per A4 Sheet • Wrapped Text • Preserved Transposed Keys</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white/10 text-textmuted rounded-xl text-xs font-bold active:bg-white/20"
                    >
                        Close
                    </button>
                    <button
                        onClick={handlePrintTrigger}
                        className="px-5 py-2.5 bg-accent text-primary rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-accent/20 active:bg-yellow-300"
                    >
                        <Printer className="w-4 h-4" /> Print / Save PDF
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
                                <p className="text-[10px] text-gray-600">Selah Worship Planner • Date: {setlist.date || 'Undated'}</p>
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
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .printable-wrapper, .printable-wrapper * {
                        visibility: visible !important;
                    }
                    .printable-wrapper {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }
                    .a4-page {
                        width: 210mm !important;
                        height: 297mm !important;
                        padding: 10mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        box-sizing: border-box !important;
                        page-break-after: always !important;
                        break-after: page !important;
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
            `}</style>
        </div>
    );
}

// ── Add Setlist Modal ──
function AddSetlistModal({ onClose }) {
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        await setlistDB.add({
            title,
            date,
            notes,
            songIds: [],
            songKeys: {}
        });
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