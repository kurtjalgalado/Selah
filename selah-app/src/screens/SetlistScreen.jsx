import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { setlistDB, scheduleDB, getSongByIdOrTitle } from '../db/dexie';
import { useSongCache } from '../context/SongCacheContext';
import { useAuth } from '../auth/AuthContext';
import { pushSetlistToSupabase, pushScheduleToSupabase, getUserChurchId, deleteSetlistFromSupabase, deleteScheduleFromSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import { KEYS, getKeyIndex, semitonesBetween, transposeLyrics, formatKey, stripChords } from '../utils/chords';
import { parseLyrics, isChordLine } from '../utils/lyrics';
import { DEFAULT_WORSHIP_ROLES } from '../utils/instruments';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';
import { List as Menu, Plus, CalendarBlank as Calendar, CaretLeft as ChevronLeft, Trash as Trash2, MusicNotes as Music, DotsSixVertical as GripVertical, X, Clock, MagnifyingGlass as Search, Stack as Layers, Play, Printer, Check, CaretUp as ChevronUp, CaretDown as ChevronDown, User, FloppyDisk as Save, PencilSimple as Edit3, Lock, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react';
import AppLogo from '../components/AppLogo';
import TopBarNotificationBell from '../components/TopBarNotificationBell';
import { SetlistSkeletonCards } from '../components/SkeletonLoader';
import ChordLineRenderer from '../components/ChordLineRenderer';
import PrintFrame from '../components/PrintFrame';

export default function SetlistScreen() {
    const navigate = useNavigate();
    const { user, canManageSetlists, isSuperuser, isAdmin } = useAuth();
    const [showAddModal, setShowAddModal] = useState(false);
    const [printSetlistData, setPrintSetlistData] = useState(null);

    useBackHandler(showAddModal, () => setShowAddModal(false));
    useBackHandler(Boolean(printSetlistData), () => setPrintSetlistData(null));

    const handleOpenAddModal = () => {
        if (!user) {
            navigate('/login');
            return;
        }
        if (!canManageSetlists) {
            return;
        }
        setShowAddModal(true);
    };

    const { setlists } = useSongCache();

    // Hydrate from Supabase on mount
    useEffect(() => { discreetBackgroundSync(); }, []);

    // Filter past and upcoming setlists based on local today date (YYYY-MM-DD)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const upcomingSetlists = (setlists || [])
        .filter(s => !s.date || s.date >= todayStr)
        .sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date.localeCompare(b.date);
        });

    const pastSetlists = (setlists || [])
        .filter(s => s.date && s.date < todayStr)
        .sort((a, b) => b.date.localeCompare(a.date));

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-28 animate-pageEnter">
                {/* Header */}
                <header className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-5 pt-10 pb-4">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />

                            <div className="flex items-center gap-2">
                                <TopBarNotificationBell />

                                {user && canManageSetlists && (
                                    <button
                                        onClick={handleOpenAddModal}
                                        className="hidden md:inline-flex items-center gap-1.5 bg-accent text-onaccent px-3.5 py-1.5 rounded-2xl text-xs font-bold shadow-md shadow-accent/20 hover:brightness-110 active:scale-95 transition"
                                        title="Create Worship Lineup"
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Create Lineup</span>
                                    </button>
                                )}

                                {user ? (
                                    <div className="flex items-center gap-1.5 text-xs text-textmuted bg-secondary border border-themed px-3 py-1.5 rounded-2xl">
                                        <Calendar className="w-3.5 h-3.5 text-accent" />
                                        <span className="font-bold text-textprimary">{upcomingSetlists.length}</span>
                                        <span>Upcoming</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            navigate('/login');
                                        }}
                                        className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/30 px-3 py-1.5 rounded-2xl hover:bg-accent/20 transition font-bold"
                                    >
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>Sign In</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Setlist List Container */}
                <div className="px-5 sm:px-8 py-5 space-y-6 max-w-5xl mx-auto">
                    {!user ? (
                        <div className="relative overflow-hidden rounded-3xl bg-elevated border border-themed p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl max-w-lg mx-auto mt-4 space-y-4">
                            <div className="absolute -top-12 -right-12 w-44 h-44 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10 space-y-4">
                                <div className="w-16 h-16 rounded-3xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto shadow-xl shadow-accent/15 glow-accent">
                                    <Lock className="w-8 h-8" />
                                </div>
                                <div className="space-y-1.5">
                                    <h3 className="text-lg font-bold text-textprimary tracking-wide">
                                        Sign In to See Worship Setlists
                                    </h3>
                                    <p className="text-xs text-textmuted leading-relaxed max-w-xs mx-auto">
                                        Worship service lineups, transposed chord charts, and rehearsal notes are private to your church team.
                                    </p>
                                </div>
                                <div className="pt-2">
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            navigate('/login');
                                        }}
                                        className="px-6 py-3.5 bg-accent text-onaccent rounded-2xl text-xs font-bold shadow-lg shadow-accent/20 active:scale-95 transition-all flex items-center gap-2 mx-auto"
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Sign In to Selah</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : !setlists ? (
                        <SetlistSkeletonCards />
                    ) : setlists.length === 0 ? (
                        <div className="text-center py-20 bg-elevated rounded-3xl border border-themed p-8">
                            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-4 text-accent">
                                <Calendar className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-textprimary mb-1">No Setlists Created</h3>
                            <p className="text-textmuted text-xs max-w-xs mx-auto mb-6">
                                Create your first setlist to arrange songs and print 2-songs-per-page A4 charts.
                            </p>
                            {canManageSetlists && (
                                <button
                                    onClick={handleOpenAddModal}
                                    className="px-6 py-3.5 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:bg-yellow-300 min-h-[44px] flex items-center gap-2 mx-auto"
                                >
                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                    <span>Create Worship Setlist</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Upcoming Setlists Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-xs font-semibold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-accent" /> Upcoming Services ({upcomingSetlists.length})
                                    </h2>
                                </div>
                                {upcomingSetlists.length === 0 ? (
                                    <div className="relative overflow-hidden rounded-3xl bg-elevated border border-themed p-8 text-center shadow-2xl backdrop-blur-xl">
                                        <div className="absolute -top-12 -right-12 w-40 h-40 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                                        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
                                        <div className="relative z-10 max-w-sm mx-auto space-y-4">
                                            <div className="w-16 h-16 rounded-3xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto shadow-xl shadow-accent/15 glow-accent">
                                                <Calendar className="w-8 h-8" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-bold text-textprimary tracking-wide">No Upcoming Service Lineup</h3>
                                                <p className="text-xs text-textmuted leading-relaxed mt-1">
                                                    Plan your worship service, arrange song keys, and print 2-songs-per-page A4 chord charts.
                                                </p>
                                            </div>
                                            {canManageSetlists && (
                                                <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                                                    <button
                                                        onClick={handleOpenAddModal}
                                                        className="px-5 py-2.5 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:scale-95 transition-all min-h-[40px] flex items-center gap-1.5"
                                                    >
                                                        <Plus className="w-4 h-4" strokeWidth={2.5} />
                                                        <span>Create Worship Lineup</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    upcomingSetlists.map(setlist => (
                                        <ModernSetlistCard
                                            key={setlist.id}
                                            setlist={setlist}
                                            isPast={false}
                                            onPrint={() => setPrintSetlistData(setlist)}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Past Setlists Section */}
                            {pastSetlists.length > 0 && (
                                <div className="space-y-3 pt-4 border-t border-themed">
                                    <div className="flex items-center justify-between px-1">
                                        <h2 className="text-xs font-semibold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-textmuted" /> Past Services ({pastSetlists.length})
                                        </h2>
                                    </div>
                                    <div className="space-y-3">
                                        {pastSetlists.map(setlist => (
                                            <ModernSetlistCard
                                                key={setlist.id}
                                                setlist={setlist}
                                                isPast={true}
                                                onPrint={() => setPrintSetlistData(setlist)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {user && canManageSetlists && typeof document !== 'undefined' && createPortal(
                    <button
                        onClick={handleOpenAddModal}
                        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-5 md:right-8 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-accent text-onaccent flex items-center justify-center shadow-2xl shadow-black/80 glow-accent z-40 active:scale-95 transition-transform"
                        title="Create Lineup"
                    >
                        <Plus className="w-6 h-6 stroke-[3]" />
                    </button>,
                    document.body
                )}

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

// ── Dynamic Date Badge Component (Day and Month) ──
export function SetlistDateBadge({ date, isToday = false, isPast = false, size = 'md', className = '' }) {
    // Parse scheduled date string (YYYY-MM-DD or standard date)
    const parseBadgeDate = (dStr) => {
        if (!dStr) {
            const now = new Date();
            return {
                month: now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                day: String(now.getDate())
            };
        }
        const parts = String(dStr).split('-');
        if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const monthIdx = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            const d = new Date(year, monthIdx, day);
            if (!isNaN(d.getTime())) {
                return {
                    month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                    day: String(day)
                };
            }
        }
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
            return {
                month: d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
                day: String(d.getDate())
            };
        }
        return { month: 'SET', day: '•' };
    };

    const { month, day } = parseBadgeDate(date);

    return (
        <div
            className={`rounded-2xl border flex flex-col items-center justify-between shrink-0 overflow-hidden text-center select-none transition-transform duration-200 shadow-sm ${
                size === 'sm' ? 'w-9 h-9' : 'w-11 h-11'
            } ${
                isToday
                    ? 'bg-activeservice-badge border-activeservice-border/70 text-activeservice-text ring-1 ring-activeservice-border/40'
                    : isPast
                    ? 'bg-secondary border-themed text-textmuted'
                    : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            } ${className}`}
            title={`Scheduled: ${date || 'Undated'}`}
        >
            <div
                className={`w-full text-center font-black uppercase tracking-wider leading-none ${
                    size === 'sm' ? 'text-[7.5px] py-0.5' : 'text-[8.5px] py-1'
                } ${
                    isToday
                        ? 'bg-activeservice-text/15 text-activeservice-text'
                        : isPast
                        ? 'bg-secondary text-textmuted/80'
                        : 'bg-emerald-500/20 text-emerald-400'
                }`}
            >
                {month}
            </div>
            <div
                className={`flex-1 flex items-center justify-center font-black leading-none pb-0.5 tracking-tight ${
                    size === 'sm' ? 'text-xs' : 'text-[15px]'
                }`}
            >
                {day}
            </div>
        </div>
    );
}

// ── Modernized Setlist Card ──
export function ModernSetlistCard({ setlist, isPast = false, onPrint }) {
    const navigate = useNavigate();
    const { user, canManageSetlists, isSuperuser, isAdmin } = useAuth();
    const [expanded, setExpanded] = useState(false);
    const [showSongPicker, setShowSongPicker] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    useBackHandler(showSongPicker, () => setShowSongPicker(false));
    useBackHandler(showEditModal, () => setShowEditModal(false));
    useBackHandler(showDeleteModal, () => setShowDeleteModal(false));

    // Lock body scroll when modals are open
    useEffect(() => {
        if (showSongPicker || showEditModal || showDeleteModal) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [showSongPicker, showEditModal, showDeleteModal]);

    // Creator permission check: Only creator or admins/superusers can edit setlist details, reorder, add/remove songs, delete, or change keys
    const isOwner = canManageSetlists && (!setlist.userId || (user && String(setlist.userId) === String(user.id)) || isSuperuser || isAdmin);

    // Active setlist check: matches today's date (YYYY-MM-DD)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = setlist?.date === todayStr;

    // Drag-and-drop state
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Swipe-to-delete state
    const [swipeX, setSwipeX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const swipeRef = useRef({ startX: 0, startY: 0, locked: false });
    const cardRef = useRef(null);

    const SWIPE_THRESHOLD = 0.30; // 30% of card width triggers delete

    const onSwipeTouchStart = useCallback((e) => {
        if (!isOwner) return;
        const touch = e.touches[0];
        swipeRef.current = { startX: touch.clientX, startY: touch.clientY, locked: false };
    }, [isOwner]);

    const onSwipeTouchMove = useCallback((e) => {
        if (!isOwner) return;
        const touch = e.touches[0];
        const dx = touch.clientX - swipeRef.current.startX;
        const dy = touch.clientY - swipeRef.current.startY;

        // Lock direction on first significant move
        if (!swipeRef.current.locked) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            swipeRef.current.locked = true;
            // If more vertical than horizontal, ignore (let page scroll)
            if (Math.abs(dy) > Math.abs(dx)) {
                swipeRef.current.startX = Infinity; // disable
                return;
            }
        }
        if (swipeRef.current.startX === Infinity) return;

        // Only allow left swipe (negative dx), clamp at 0 for right
        const clampedX = Math.min(0, dx);
        setSwipeX(clampedX);
        setIsSwiping(true);
        e.preventDefault(); // prevent scroll while swiping horizontally
    }, [isOwner]);

    const onSwipeTouchEnd = useCallback(() => {
        if (!isSwiping) return;
        if (!isOwner) {
            setSwipeX(0);
            setIsSwiping(false);
            return;
        }
        const cardWidth = cardRef.current?.offsetWidth || 300;
        if (Math.abs(swipeX) > cardWidth * SWIPE_THRESHOLD) {
            // Past threshold — show delete confirmation
            setSwipeX(0);
            setIsSwiping(false);
            setShowDeleteModal(true);
            haptic('warning');
        } else {
            // Snap back
            setSwipeX(0);
            setIsSwiping(false);
        }
    }, [swipeX, isSwiping, isOwner]);

    const confirmDelete = async () => {
        if (!isOwner) return;
        setShowDeleteModal(false);
        haptic('error');
        try {
            // Find and delete any associated minister schedule entry linked to this setlist
            const linkedSchedules = await scheduleDB.getAll().then(all => 
                (all || []).filter(s => s && (
                    String(s.setlistId) === String(setlist.id) ||
                    (!s.setlistId && s.serviceDate === setlist.date && (s.serviceTitle || '').trim().toLowerCase() === (setlist.title || '').trim().toLowerCase())
                ))
            );
            for (const sched of linkedSchedules) {
                await deleteScheduleFromSupabase(sched.id, user);
                await scheduleDB.delete(sched.id);
            }
        } catch (schedErr) {
            console.warn('Failed to delete associated schedule:', schedErr);
        }
        await deleteSetlistFromSupabase(setlist.id, user);
        await setlistDB.delete(setlist.id);
    };

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
        if (!isOwner) {
            setSaveStatus('Read Only');
            setTimeout(() => setSaveStatus(''), 2500);
            return;
        }
        try {
            await pushSetlistToSupabase(setlist, user);
            setSaveStatus('Saved!');
            setTimeout(() => setSaveStatus(''), 2500);
        } catch (err) {
            setSaveStatus('Saved locally');
            setTimeout(() => setSaveStatus(''), 2500);
        }
    };

    // Update Transposed Key for a specific song inside the setlist
    const handleSetSongKey = async (songId, newKey) => {
        if (!isOwner) return;
        const updatedKeys = { ...songKeys, [songId]: newKey };
        await setlistDB.update(setlist.id, { songKeys: updatedKeys });
        await pushSetlistToSupabase({ ...setlist, songKeys: updatedKeys }, user);
    };

    // Reorder song position logic
    const reorderSongs = async (fromIdx, toIdx) => {
        if (!isOwner) return;
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
        if (!isOwner) return;
        if (idx > 0) {
            await reorderSongs(idx, idx - 1);
        }
    };

    const moveSongDown = async (e, idx) => {
        e.stopPropagation();
        if (!isOwner) return;
        if (idx < (setlist.songIds || []).length - 1) {
            await reorderSongs(idx, idx + 1);
        }
    };

    // Drag Events
    const handleDragStart = (e, index) => {
        if (!isOwner) return;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', index.toString());
    };

    const handleDragOver = (e, index) => {
        if (!isOwner) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragOverIndex !== index) {
            setDragOverIndex(index);
        }
    };

    const handleDrop = async (e, targetIndex) => {
        if (!isOwner) return;
        e.preventDefault();
        const transferIdxStr = e.dataTransfer.getData('text/plain');
        const sourceIndex = transferIdxStr !== '' ? parseInt(transferIdxStr, 10) : draggedIndex;
        if (!isNaN(sourceIndex) && sourceIndex !== null) {
            await reorderSongs(sourceIndex, targetIndex);
        }
    };

    // Touch Events
    const handleTouchStart = (index) => {
        if (!isOwner) return;
        setDraggedIndex(index);
    };

    const handleTouchMove = (e) => {
        if (!isOwner || draggedIndex === null) return;
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
        if (!isOwner) return;
        if (draggedIndex !== null && dragOverIndex !== null) {
            await reorderSongs(draggedIndex, dragOverIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    };

    // Remove song from setlist
    const handleRemoveSong = async (e, songId) => {
        e.stopPropagation();
        if (!isOwner) return;
        const updatedIds = (setlist.songIds || []).filter(id => id !== songId);
        await setlistDB.update(setlist.id, { songIds: updatedIds });
        await pushSetlistToSupabase({ ...setlist, songIds: updatedIds }, user);
    };

    // Add song to setlist
    const handleAddSong = async (songId) => {
        if (!isOwner) return;
        const currentIds = setlist.songIds || [];
        if (!currentIds.includes(songId)) {
            const updatedIds = [...currentIds, songId];
            await setlistDB.update(setlist.id, { songIds: updatedIds });
            await pushSetlistToSupabase({ ...setlist, songIds: updatedIds }, user);
        }
        setShowSongPicker(false);
    };

    const filteredPickerSongs = (allSongs || []).filter(s => {
        const q = pickerSearch.toLowerCase().trim();
        if (!q) return true;
        const cleanLyrics = s.lyrics ? stripChords(s.lyrics).toLowerCase() : '';
        return (s.title || '').toLowerCase().includes(q) ||
            (s.artist || '').toLowerCase().includes(q) ||
            (s.lyrics || '').toLowerCase().includes(q) ||
            cleanLyrics.includes(q);
    });

    const swipeProgress = cardRef.current ? Math.min(Math.abs(swipeX) / (cardRef.current.offsetWidth * SWIPE_THRESHOLD), 1) : 0;

    return (
        <div className="relative rounded-2xl overflow-hidden" ref={cardRef}>
            {/* Delete reveal layer behind the card */}
            {isOwner && (
                <div
                    className="absolute inset-0 rounded-2xl flex items-center justify-end pr-6 gap-2"
                    style={{
                        background: `linear-gradient(90deg, transparent 40%, rgba(239,68,68,${0.15 + swipeProgress * 0.55}) 100%)`,
                        opacity: isSwiping ? 1 : 0,
                        transition: isSwiping ? 'none' : 'opacity 0.3s ease',
                    }}
                >
                    <Trash2
                        className="w-5 h-5"
                        style={{
                            color: `rgba(239,68,68,${0.4 + swipeProgress * 0.6})`,
                            transform: `scale(${0.8 + swipeProgress * 0.4})`,
                            transition: isSwiping ? 'none' : 'all 0.3s ease',
                        }}
                    />
                    <span
                        className="text-xs font-bold uppercase tracking-wide"
                        style={{
                            color: `rgba(239,68,68,${swipeProgress * 0.9})`,
                            transition: isSwiping ? 'none' : 'all 0.3s ease',
                        }}
                    >
                        Delete
                    </span>
                </div>
            )}

            {/* Swipeable card surface */}
            <div
                className={`rounded-2xl border shadow-xl overflow-hidden relative z-10 transition-all duration-300 transform-gpu ${
                    isToday
                        ? 'bg-activeservice-bg border-activeservice-border shadow-[var(--active-service-shadow)] ring-1 ring-activeservice-border/40'
                        : isPast
                        ? 'opacity-85 grayscale-[10%] bg-elevated hover:opacity-100 transition-opacity border-themed'
                        : 'bg-elevated border-themed'
                }`}
                style={{
                    transform: `translateX(${swipeX}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onTouchStart={onSwipeTouchStart}
                onTouchMove={onSwipeTouchMove}
                onTouchEnd={onSwipeTouchEnd}
            >
                {/* Setlist Header Card */}
                <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-surface-hover active:bg-surface-active active:scale-[0.995] transition-all duration-150 gap-3"
                    onClick={() => !isSwiping && setExpanded(!expanded)}
                >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <SetlistDateBadge date={setlist.date} isToday={isToday} isPast={isPast} />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base text-textprimary truncate leading-tight">{setlist.title}</h3>
                                {isToday && (
                                    <span className="px-2.5 py-0.5 rounded-full bg-activeservice-badge border border-activeservice-border/50 text-[10px] text-activeservice-text font-bold shrink-0 flex items-center gap-1.5 shadow-sm animate-pulse">
                                        <span className="w-1.5 h-1.5 rounded-full bg-activeservice-text" />
                                        ACTIVE TODAY
                                    </span>
                                )}
                                {isPast && !isToday && (
                                    <span className="px-2 py-0.5 rounded-full bg-secondary border border-themed text-[10px] text-textmuted font-semibold shrink-0">
                                        PAST SERVICE
                                    </span>
                                )}
                                {!isOwner && (
                                    <span className="px-2 py-0.5 rounded-full bg-secondary text-[10px] text-textmuted font-semibold flex items-center gap-1 shrink-0">
                                        <Lock className="w-3 h-3 text-textmuted" /> Read Only
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-textmuted flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span className={isToday ? "text-activeservice-text font-bold" : ""}>{setlist.date || 'Undated'}</span>
                                <span>•</span>
                                <span className={isToday ? "text-activeservice-text font-semibold" : "text-accent font-semibold"}>{setlistSongs.length} songs</span>
                                <span>•</span>
                                <span className="text-textmuted truncate">by <strong className="text-textprimary">{setlist.preparedBy || 'Worship Leader'}</strong></span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-textmuted min-w-[40px] min-h-[40px] transition-transform duration-200">
                            <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${expanded ? '-rotate-90 text-accent' : ''}`} />
                        </div>
                    </div>
                </div>

            {/* Notes banner if present */}
            {setlist.notes && (
                <div className="px-4 py-2 bg-secondary border-t border-themed text-xs text-textmuted italic">
                    "{setlist.notes}"
                </div>
            )}

            {/* Expanded Song Reordering & Key Selector List with Smooth Accordion Expansion */}
            {expanded && (
                <div className="animate-expandAccordion border-t border-themed bg-secondary/40 p-4 space-y-4">
                    {/* Full-width Prominent Primary CTA */}
                    <button
                        onClick={() => navigate(`/setlist-player/${setlist.id}`)}
                        className="w-full h-12 bg-accent text-onaccent rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-accent/25 active:bg-yellow-300 active:scale-[0.98] transition-all duration-150 min-h-[48px] btn-interact"
                        title="Open Live Setlist Player"
                    >
                        <Play className="w-4 h-4 fill-current" />
                        <span>Launch Live Setlist Player</span>
                    </button>

                    {/* Secondary Action Toolbar Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {isOwner && isPast && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="h-10 px-3 bg-accent/20 text-accent rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-accent/30 min-h-[40px] border-0 hover:bg-accent/25 transition-all"
                                title="Reuse Setlist for Upcoming Service"
                            >
                                <RotateCcw className="w-4 h-4 text-accent" />
                                <span>Reuse Setlist</span>
                            </button>
                        )}

                        {isOwner && (
                            <button
                                onClick={() => setShowSongPicker(true)}
                                className="h-10 px-3 bg-secondary hover:bg-surface-hover text-textprimary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-surface-active min-h-[40px] border-0 transition-all"
                            >
                                <Plus className="w-4 h-4 text-accent" strokeWidth={2.5} />
                                <span>Add Songs</span>
                            </button>
                        )}

                        {isOwner && (
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="h-10 px-3 bg-secondary hover:bg-surface-hover text-textprimary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-surface-active min-h-[40px] border-0 transition-all"
                                title="Edit Setlist Details"
                            >
                                <Edit3 className="w-4 h-4 text-accent" />
                                <span>Edit Details</span>
                            </button>
                        )}

                        <button
                            onClick={onPrint}
                            className="h-10 px-3 bg-secondary hover:bg-surface-hover text-textprimary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-surface-active min-h-[40px] border-0 transition-all"
                        >
                            <Printer className="w-4 h-4 text-accent" />
                            <span>Print Chart</span>
                        </button>

                        <button
                            onClick={handleSaveSetlist}
                            className="h-10 px-3 bg-secondary hover:bg-surface-hover text-textprimary rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:bg-surface-active min-h-[40px] border-0"
                            title="Force Sync Setlist to Cloud"
                        >
                            {saveStatus === 'Saved!' ? (
                                <>
                                    <Check className="w-4 h-4 text-accent" />
                                    <span>Synced</span>
                                </>
                            ) : saveStatus === 'Read Only' ? (
                                <>
                                    <Lock className="w-4 h-4 text-textmuted" />
                                    <span>Read Only</span>
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
                        <span className="text-[11px] font-bold uppercase tracking-wider text-textmuted block mb-2">
                            {isOwner ? 'Setlist Arrangement & Transposed Keys' : 'Setlist Arrangement (Read-Only View)'}
                        </span>

                        {setlistSongs.length === 0 ? (
                            <div className="text-center py-6 border border-dashed border-white/10 rounded-xl bg-secondary/40 p-4">
                                <p className="text-xs text-textmuted mb-2">No songs in this setlist yet.</p>
                                {isOwner && (
                                    <button
                                        onClick={() => setShowSongPicker(true)}
                                        className="text-xs text-accent font-bold underline"
                                    >
                                        Tap here to add songs
                                    </button>
                                )}
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
                                            draggable={isOwner}
                                            onDragStart={(e) => handleDragStart(e, idx)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDrop={(e) => handleDrop(e, idx)}
                                            className={`group py-2.5 px-2 rounded-xl transition-all duration-150 space-y-2 ${
                                                isBeingDragged
                                                    ? 'bg-accent/20 scale-[1.02] shadow-xl z-20 opacity-80'
                                                    : isTargetHover
                                                    ? 'bg-accent/10'
                                                    : 'hover:bg-surface-hover/60 active:bg-surface-active/60'
                                            }`}
                                        >
                                            {/* Top Row: Drag handle, track #, title/artist, and delete X button */}
                                            <div className="flex items-center gap-2.5">
                                                {/* Touch & Hold Drag Handle */}
                                                {isOwner && (
                                                    <div
                                                        onTouchStart={() => handleTouchStart(idx)}
                                                        className="w-7 h-7 rounded-lg text-textmuted hover:text-accent flex items-center justify-center cursor-grab active:cursor-grabbing touch-none shrink-0"
                                                        title="Touch and Hold to Drag"
                                                    >
                                                        <GripVertical className="w-4 h-4 text-textmuted/60" />
                                                    </div>
                                                )}

                                                {/* Plain Track Index */}
                                                <span className="w-5 text-center text-xs font-semibold text-textmuted/60 group-hover:text-accent select-none shrink-0">
                                                    {idx + 1}
                                                </span>

                                                {/* Song Info */}
                                                <div
                                                    className="flex-1 min-w-0 cursor-pointer"
                                                    onClick={() => navigate(`/song/${song.id}?setlistId=${setlist.id}&key=${encodeURIComponent(currentKey)}`)}
                                                >
                                                    <h4 className="text-sm font-medium text-textprimary truncate leading-snug group-hover:text-accent transition-colors">{song.title}</h4>
                                                    <p className="text-xs text-textmuted truncate">
                                                        {song.artist} • <span className="text-accent font-medium">{song.category}</span>
                                                    </p>
                                                </div>

                                                {/* Remove Button */}
                                                {isOwner && (
                                                    <button
                                                        onClick={(e) => handleRemoveSong(e, song.id)}
                                                        className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full text-textmuted hover:text-danger hover:bg-danger/15 flex items-center justify-center shrink-0 active:scale-90 transition"
                                                        title="Remove from Setlist"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Bottom Row: Spacious Reorder Arrows & Key Transposer */}
                                            <div className="flex items-center justify-between pl-7 pr-1 gap-2">
                                                {/* Reorder Buttons */}
                                                {isOwner ? (
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            onClick={(e) => moveSongUp(e, idx)}
                                                            disabled={idx === 0}
                                                            className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg text-textmuted hover:text-textprimary disabled:opacity-20 flex items-center gap-1 text-xs active:bg-secondary"
                                                            title="Move Up"
                                                        >
                                                            <ChevronUp className="w-4 h-4 text-accent" />
                                                            <span className="text-xs font-semibold">Up</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => moveSongDown(e, idx)}
                                                            disabled={idx === setlistSongs.length - 1}
                                                            className="min-h-[36px] min-w-[36px] px-2.5 py-1.5 rounded-lg text-textmuted hover:text-textprimary disabled:opacity-20 flex items-center gap-1 text-xs active:bg-secondary"
                                                            title="Move Down"
                                                        >
                                                            <ChevronDown className="w-4 h-4 text-accent" />
                                                            <span className="text-xs font-semibold">Down</span>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-textmuted italic">Track {idx + 1}</span>
                                                )}

                                                {/* Configured Key Transposer */}
                                                <div className="flex items-center gap-1.5 text-xs">
                                                    <span className="text-xs uppercase font-bold text-textmuted">Key</span>
                                                    {isOwner ? (
                                                        <div className="flex items-center bg-secondary/80 rounded-xl p-0.5 border border-themed">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const keys = KEYS;
                                                                    const curIdx = keys.indexOf(currentKey);
                                                                    const nextIdx = (curIdx - 1 + 12) % 12;
                                                                    handleSetSongKey(song.id, keys[nextIdx]);
                                                                }}
                                                                className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg text-sm font-bold text-textprimary flex items-center justify-center hover:bg-surface-hover active:scale-95"
                                                                title="Key Down"
                                                            >
                                                                −
                                                            </button>
                                                            <span className="px-2 font-mono text-xs font-bold text-accent min-w-[28px] text-center">
                                                                {currentKey}
                                                            </span>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const keys = KEYS;
                                                                    const curIdx = keys.indexOf(currentKey);
                                                                    const nextIdx = (curIdx + 1) % 12;
                                                                    handleSetSongKey(song.id, keys[nextIdx]);
                                                                }}
                                                                className="w-8 h-8 min-w-[32px] min-h-[32px] rounded-lg text-sm font-bold text-textprimary flex items-center justify-center hover:bg-surface-hover active:scale-95"
                                                                title="Key Up"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <span className="font-mono text-accent font-bold px-1.5 text-xs">{currentKey}</span>
                                                    )}
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

            </div>{/* end swipeable card surface */}

            {showEditModal && (
                <EditSetlistModal
                    setlist={setlist}
                    onClose={() => setShowEditModal(false)}
                />
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
                    onClick={() => setShowDeleteModal(false)}
                    style={{ animation: 'fadeIn 0.2s ease' }}
                >
                    <div
                        className="bg-elevated border border-themed rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                        style={{ animation: 'slideUpModal 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-textprimary">Delete Setlist</h3>
                                <p className="text-xs text-textmuted">This action cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-textmuted">
                            Are you sure you want to delete <strong className="text-textprimary">"{setlist.title}"</strong>?
                        </p>
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                className="flex-1 h-11 rounded-xl bg-secondary text-textprimary text-sm font-semibold hover:bg-surface-hover active:bg-surface-hover transition-colors border-0"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 h-11 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-500/25 active:bg-red-600 active:scale-[0.98] transition-all"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Song Selection Picker Modal */}
            {showSongPicker && (
                <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                    onClick={() => setShowSongPicker(false)}
                >
                    <div 
                        className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                        <div className="flex justify-between items-center px-6 py-3.5 border-b border-themed shrink-0">
                            <div>
                                <h3 className="text-base font-bold text-textprimary">Add Songs to Setlist</h3>
                                <p className="text-xs text-accent truncate">{setlist.title}</p>
                            </div>
                            <button onClick={() => setShowSongPicker(false)} className="text-textmuted hover:text-textprimary p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 border-b border-themed shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                                <input
                                    type="text"
                                    value={pickerSearch}
                                    onChange={(e) => setPickerSearch(e.target.value)}
                                    placeholder="Search title, artist, or lyrics..."
                                    className="w-full bg-secondary border border-themed rounded-xl pl-9 pr-4 py-2.5 text-xs text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent"
                                />
                            </div>
                        </div>
                        <div className="px-3 py-2 overflow-y-auto flex-1 overscroll-contain space-y-0.5">
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
                                            className={`w-full py-3 px-3.5 flex items-center justify-between text-left transition-colors rounded-xl border-0 shadow-none outline-none bg-transparent ${
                                                isAdded
                                                    ? 'opacity-35 cursor-not-allowed'
                                                    : 'hover:bg-surface-hover active:bg-surface-active'
                                            }`}
                                        >
                                            <div className="min-w-0 pr-3">
                                                <p className="font-semibold text-textprimary text-sm truncate leading-snug">{s.title}</p>
                                                <p className="text-xs text-textmuted truncate mt-0.5">{s.artist} • <span className="text-accent">{s.category}</span></p>
                                            </div>
                                            {isAdded ? (
                                                <span className="text-[10px] uppercase font-bold text-accent px-2 py-0.5 shrink-0">Added</span>
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-accent shrink-0">
                                                    <Plus className="w-4 h-4 text-accent" />
                                                </div>
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
export function PrintSetlistModal({ setlist, onClose }) {
    const { songs: allSongs } = useSongCache();
    const songKeys = setlist.songKeys || {};
    const [setlistSongs, setSetlistSongs] = useState([]);
    // Default to 1 song per page if setlist only has 1 song, else 2 songs per page
    const [columns, setColumns] = useState(() => (setlist?.songIds?.length === 1 ? 1 : 2));
    const [accidentalMode, setAccidentalMode] = useState(() => localStorage.getItem('selah_accidental_mode') || 'sharp');

    useBackHandler(true, onClose);

    const toggleAccidentalMode = () => {
        const next = accidentalMode === 'sharp' ? 'flat' : 'sharp';
        setAccidentalMode(next);
        try {
            localStorage.setItem('selah_accidental_mode', next);
        } catch {}
    };

    useEffect(() => {
        let isMounted = true;
        async function fetchSongs() {
            const songs = await Promise.all((setlist.songIds || []).map(id => getSongByIdOrTitle(id)));
            if (isMounted) setSetlistSongs(songs.filter(Boolean));
        }
        fetchSongs();
        return () => { isMounted = false; };
    }, [setlist.songIds?.join(','), allSongs]);

    // Chunk songs based on selected column layout (1 or 2 songs per page)
    const songsPerPage = columns === 1 ? 1 : 2;
    const pages = [];
    for (let i = 0; i < setlistSongs.length; i += songsPerPage) {
        pages.push(setlistSongs.slice(i, i + songsPerPage));
    }

    const handlePrintTrigger = () => {
        try {
            const oldTitle = document.title;
            document.title = `${setlist?.title || 'Setlist'} (Chord Chart)`;
            if (window.AndroidPrint && typeof window.AndroidPrint.print === 'function') {
                window.AndroidPrint.print();
            } else {
                window.print();
            }
            setTimeout(() => {
                document.title = oldTitle;
            }, 1000);
        } catch (e) {
            console.error('Print error:', e);
            if (typeof window.print === 'function') window.print();
        }
    };

    const modalContent = (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 overflow-y-auto p-3 sm:p-6 flex flex-col items-center animate-fadeIn print-modal-backdrop">
            {/* Solid Opaque High-Contrast Action Bar */}
            <div className="sticky top-2 sm:top-4 z-50 w-full max-w-4xl bg-zinc-900 border border-zinc-700/80 px-4 sm:px-6 py-3 rounded-2xl shadow-2xl flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden print-hidden">
                {/* Title & Metadata */}
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shrink-0">
                        <Printer className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-white text-sm sm:text-base truncate">{setlist.title}</h3>
                        <p className="text-[11px] text-zinc-400 truncate">
                            {setlistSongs.length} {setlistSongs.length === 1 ? 'song' : 'songs'} • {pages.length} {pages.length === 1 ? 'page' : 'pages'} A4
                        </p>
                    </div>
                </div>

                {/* Print Layout Segmented Toggle & Actions */}
                <div className="flex items-center gap-2.5 shrink-0 ml-auto flex-wrap">
                    {/* Flat / Sharp Accidental Toggle */}
                    <button
                        onClick={toggleAccidentalMode}
                        className={`h-9 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1 active:scale-95 ${
                            accidentalMode === 'sharp'
                                ? 'bg-zinc-800 text-accent border-zinc-700 hover:border-accent/40 shadow-sm'
                                : 'bg-zinc-800 text-amber-400 border-zinc-700 hover:border-amber-400/40 shadow-sm'
                        }`}
                        title={`Chord Notation: ${accidentalMode === 'sharp' ? 'Sharps (♯)' : 'Flats (♭)'}. Tap to toggle.`}
                    >
                        <span className={accidentalMode === 'flat' ? 'font-black text-amber-400 text-sm' : 'text-zinc-500'}>♭</span>
                        <span className="text-zinc-600 font-mono text-[10px]">/</span>
                        <span className={accidentalMode === 'sharp' ? 'font-black text-accent text-sm' : 'text-zinc-500'}>♯</span>
                    </button>

                    {/* 1-Col vs 2-Col Layout Switch */}
                    <div className="flex items-center bg-zinc-800 p-1 rounded-xl border border-zinc-700">
                        <button
                            onClick={() => setColumns(1)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                columns === 1 
                                    ? 'bg-accent text-zinc-950 shadow-md' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                            title="1 Song per Page (Full Width / Single Column)"
                        >
                            <span>1 Song/Page</span>
                        </button>
                        <button
                            onClick={() => setColumns(2)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                columns === 2 
                                    ? 'bg-accent text-zinc-950 shadow-md' 
                                    : 'text-zinc-400 hover:text-white'
                            }`}
                            title="2 Songs per Page (2-Column Compact)"
                        >
                            <span>2 Songs/Page</span>
                        </button>
                    </div>

                    {/* Print Button */}
                    <button
                        onClick={handlePrintTrigger}
                        className="px-4 h-10 rounded-xl bg-accent text-zinc-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-95 transition-all"
                        title="Print / Save as PDF"
                    >
                        <Printer className="w-4 h-4 fill-current" />
                        <span className="hidden xs:inline">Print Chart</span>
                    </button>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center border border-zinc-700 transition-colors"
                        title="Close Preview"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Print Pages Container */}
            <div className="printable-wrapper w-full max-w-4xl print:max-w-none flex flex-col items-center gap-6">
                {pages.map((pageSongs, pageIdx) => (
                    <div key={pageIdx} className={`w-full flex justify-center ${pageIdx > 0 ? 'print-page-break' : ''}`}>
                        <PrintFrame>
                            <div
                                className="print-sheet a4-page bg-white text-black rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between border border-gray-200 box-border print:p-0 print:border-none print:shadow-none print:rounded-none"
                            >
                                {/* Page Running Header */}
                                <div className="border-b-2 border-black pb-2 mb-4 flex items-center justify-between shrink-0">
                                    <div>
                                        <h1 className="text-xl font-black uppercase tracking-tight text-black">{setlist.title}</h1>
                                        <p className="text-[10px] text-gray-600 font-medium">
                                            {setlist.date ? `Date: ${setlist.date}` : ''}
                                            {setlist.date && setlist.preparedBy ? ' • ' : ''}
                                            {setlist.preparedBy ? <>Prepared by: <strong>{setlist.preparedBy}</strong></> : null}
                                        </p>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase bg-black text-white px-2.5 py-1 rounded">
                                        {columns === 1 
                                            ? `Song ${pageIdx + 1} of ${setlistSongs.length}`
                                            : `Songs ${pageIdx * 2 + 1}–${Math.min((pageIdx + 1) * 2, setlistSongs.length)} of ${setlistSongs.length}`
                                        }
                                    </span>
                                </div>

                                {setlist.notes && pageIdx === 0 && (
                                    <div className="mb-4 p-2.5 bg-gray-100 border-l-4 border-black rounded text-[11px] text-gray-800 italic shrink-0">
                                        <strong>Notes:</strong> {setlist.notes}
                                    </div>
                                )}

                                {/* Song Layout per Page (1-Column vs 2-Columns) */}
                                <div className={`grid ${columns === 1 ? 'grid-cols-1 w-full gap-6' : 'grid-cols-2 gap-5 w-full'} items-start flex-1 min-h-0`}>
                                    {pageSongs.map((song, songInPageIdx) => {
                                        const globalIdx = columns === 1 ? pageIdx : pageIdx * 2 + songInPageIdx;
                                        const targetKey = songKeys[song.id] || song.originalKey || song.currentKey || 'C';
                                        const semitones = semitonesBetween(song.originalKey || 'C', targetKey);
                                        const transposedLyrics = transposeLyrics(song.lyrics || '', semitones, accidentalMode);
                                        const sections = parseLyrics(transposedLyrics);
                                        const formattedTargetKey = formatKey(targetKey, accidentalMode);
                                        const formattedOrigKey = formatKey(song.originalKey || 'C', accidentalMode);

                                        return (
                                            <div
                                                key={song.id}
                                                className="song-print-card print-keep border border-gray-300 rounded-xl p-4 bg-gray-50/50 shadow-sm box-border max-w-full flex flex-col justify-between"
                                            >
                                                <div>
                                                    {/* Song Header */}
                                                    <div className="border-b-2 border-gray-300 pb-2 mb-3 flex items-start justify-between gap-2 shrink-0">
                                                        <div className="min-w-0 flex-1">
                                                            <h3 className="font-bold text-base text-black leading-tight break-words">
                                                                {globalIdx + 1}. {song.title}
                                                            </h3>
                                                            {song.artist && (
                                                                <p className="text-xs text-gray-600 font-medium truncate">{song.artist}</p>
                                                            )}
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="px-2.5 py-1 bg-black text-white rounded-lg font-bold text-xs inline-block shadow-sm">
                                                                Key: {formattedTargetKey}
                                                            </span>
                                                            {targetKey !== song.originalKey && (
                                                                <p className="text-[10px] text-gray-500 mt-0.5">Orig: {formattedOrigKey}</p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Song Sections */}
                                                    <div className="space-y-3 text-[12px] leading-snug">
                                                        {sections.map((sec, sIdx) => (
                                                            <div key={sIdx} className="song-section print-keep mb-3">
                                                                <div className="font-bold text-[11px] uppercase tracking-wider text-amber-900 border-b border-gray-200 pb-0.5 mb-1.5">
                                                                    {sec.label}
                                                                </div>
                                                                <div className="space-y-1">
                                                                    {sec.lines.map((line, lIdx) => (
                                                                        <ChordLineRenderer
                                                                            key={lIdx}
                                                                            line={line}
                                                                            fontSize={12}
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
                                        );
                                    })}
                                </div>
                            </div>
                        </PrintFrame>
                    </div>
                ))}
            </div>
        </div>
    );

    const printMount = typeof document !== 'undefined'
        ? (document.getElementById('print-root') || document.body)
        : null;

    if (!printMount) return modalContent;
    return createPortal(modalContent, printMount);
}

// ── Redesigned Material 3 Add Setlist Modal ──
export function AddSetlistModal({ onClose }) {
    const { user } = useAuth();
    if (!user) return null;

    useBackHandler(true, onClose);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [preparedBy, setPreparedBy] = useState(
        user?.user_metadata?.username || user?.user_metadata?.full_name || user?.email?.split('@')[0] || ''
    );
    const [notes, setNotes] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        haptic('light');
        const author = preparedBy.trim() || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Worship Leader';
        const now = new Date().toISOString();
        const churchId = await getUserChurchId(user);
        const newSetlist = {
            id: crypto.randomUUID(),
            userId: user?.id || null,
            churchId,
            title,
            date,
            preparedBy: author,
            notes,
            songIds: [],
            songKeys: {},
            created: now,
            updatedAt: now
        };

        await setlistDB.add(newSetlist);
        if (user) {
            await pushSetlistToSupabase(newSetlist, user);
        }

        // Deduplicate and link/create matching minister schedule entry
        try {
            const targetDate = date || now.split('T')[0];
            const allSchedules = await scheduleDB.getAll();
            const existingSched = allSchedules.find(s => 
                s.setlistId === newSetlist.id || 
                (s.serviceDate === targetDate && (!s.churchId || s.churchId.toLowerCase() === churchId.toLowerCase() || churchId === 'JFCM-Mercedes'))
            );

            if (existingSched) {
                // Link and update existing schedule to prevent duplication
                const updatedSchedule = {
                    ...existingSched,
                    setlistId: newSetlist.id,
                    serviceTitle: existingSched.serviceTitle || title,
                    updatedAt: now
                };
                await scheduleDB.put(updatedSchedule);
                if (user) {
                    await pushScheduleToSupabase(updatedSchedule, user);
                }
            } else {
                const schedId = crypto.randomUUID();
                const defaultAssignments = DEFAULT_WORSHIP_ROLES.map(role => ({
                    id: crypto.randomUUID(),
                    role_name: role.roleName,
                    icon: role.icon,
                    user_id: role.roleName.toLowerCase().includes('lead') ? (user?.id || null) : null,
                    user_name: role.roleName.toLowerCase().includes('lead') ? author : '',
                    user_avatar: role.roleName.toLowerCase().includes('lead') ? (user?.user_metadata?.avatar_seed || author) : '',
                    user_email: role.roleName.toLowerCase().includes('lead') ? (user?.email || '') : '',
                    status: 'assigned'
                }));

                const newSchedule = {
                    id: schedId,
                    churchId,
                    serviceTitle: title,
                    serviceDate: targetDate,
                    serviceTime: '09:00 AM',
                    setlistId: newSetlist.id,
                    notes: notes || '',
                    assignments: defaultAssignments,
                    createdBy: user?.id || null,
                    created: now,
                    updatedAt: now
                };

                await scheduleDB.add(newSchedule);
                if (user) {
                    await pushScheduleToSupabase(newSchedule, user);
                }
            }
        } catch (schedErr) {
            console.warn('Auto schedule creation failed:', schedErr);
        }

        haptic('success');
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                
                <div className="flex justify-between items-center px-6 py-3 border-b border-themed shrink-0 bg-secondary/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-textprimary">New Worship Setlist</h3>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Setlist Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. Sunday Worship - Dec 24"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Service Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Prepared By</label>
                        <input
                            type="text"
                            value={preparedBy}
                            onChange={(e) => setPreparedBy(e.target.value)}
                            placeholder="Worship Leader / Your Name"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            placeholder="Notes (optional)"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2 shrink-0">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-3 text-xs font-bold bg-secondary hover:bg-surface-hover text-textmuted rounded-2xl border-0 active:scale-95 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 text-xs font-bold bg-accent text-onaccent rounded-2xl hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-95 transition"
                        >
                            Create Setlist
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Redesigned Material 3 Edit Setlist Details Modal ──
function EditSetlistModal({ setlist, onClose }) {
    const { user } = useAuth();

    useBackHandler(true, onClose);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    const [title, setTitle] = useState(setlist.title || '');
    const [date, setDate] = useState(setlist.date || '');
    const [preparedBy, setPreparedBy] = useState(setlist.preparedBy || '');
    const [notes, setNotes] = useState(setlist.notes || '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        haptic('light');
        const now = new Date().toISOString();
        const updated = {
            ...setlist,
            title,
            date,
            preparedBy,
            notes,
            userId: setlist.userId || user?.id || null,
            updatedAt: now
        };
        await setlistDB.update(setlist.id, { title, date, preparedBy, notes, updatedAt: now });
        await pushSetlistToSupabase(updated, user);

        // Deduplicate and update linked schedule(s) for this lineup
        try {
            const allSchedules = await scheduleDB.getAll();
            const matchingSchedules = allSchedules.filter(s => 
                s.setlistId === setlist.id || 
                (s.serviceDate === (setlist.date || date) && s.serviceTitle === (setlist.title || title))
            );

            if (matchingSchedules.length > 0) {
                // If duplicates exist, pick the best schedule (most assigned ministers, then newest)
                matchingSchedules.sort((a, b) => {
                    const assignedA = (a.assignments || []).filter(x => x.user_id || x.user_name).length;
                    const assignedB = (b.assignments || []).filter(x => x.user_id || x.user_name).length;
                    if (assignedB !== assignedA) return assignedB - assignedA;
                    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
                });

                const [primarySched, ...duplicateScheds] = matchingSchedules;

                for (const dup of duplicateScheds) {
                    await scheduleDB.delete(dup.id);
                    if (user) {
                        await deleteScheduleFromSupabase(dup.id, user).catch(() => {});
                    }
                }

                const updatedPrimary = {
                    ...primarySched,
                    serviceTitle: title,
                    serviceDate: date || primarySched.serviceDate,
                    setlistId: setlist.id,
                    notes: notes || primarySched.notes,
                    updatedAt: now
                };
                await scheduleDB.put(updatedPrimary);
                if (user) {
                    await pushScheduleToSupabase(updatedPrimary, user);
                }
            }
        } catch (schedSyncErr) {
            console.warn('[Setlist] Failed to deduplicate/sync schedule on lineup update:', schedSyncErr);
        }

        haptic('success');
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-slideUp max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 sm:hidden shrink-0" />
                
                <div className="flex justify-between items-center px-6 py-3 border-b border-themed shrink-0 bg-secondary/40">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                            <Calendar className="w-4 h-4" />
                        </div>
                        <h3 className="text-base font-bold text-textprimary">Edit Setlist Details</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Setlist Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Service Date</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Prepared By</label>
                        <input
                            type="text"
                            value={preparedBy}
                            onChange={(e) => setPreparedBy(e.target.value)}
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-textmuted uppercase tracking-wider mb-1.5">Notes (Optional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows="2"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-accent text-textprimary resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2 shrink-0">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="flex-1 py-3 text-xs font-bold bg-secondary hover:bg-surface-hover text-textmuted rounded-2xl border-0 active:scale-95 transition"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 text-xs font-bold bg-accent text-onaccent rounded-2xl hover:bg-accent/90 shadow-md shadow-accent/20 active:scale-95 transition"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}