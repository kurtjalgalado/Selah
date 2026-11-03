import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { scheduleDB } from '../db/dexie';
import { deleteScheduleFromSupabase, pushScheduleToSupabase, discreetBackgroundSync } from '../supabase/sync';
import PullToRefresh from '../components/PullToRefresh';
import AppLogo from '../components/AppLogo';
import UserAvatar from '../components/UserAvatar';
import ScheduleBottomSheet from '../components/ScheduleBottomSheet';
import AssignMinisterBottomSheet from '../components/AssignMinisterBottomSheet';
import ManageTeamModal from '../components/ManageTeamModal';
import TopBarNotificationBell from '../components/TopBarNotificationBell';
import AppleSegmentedControl from '../components/AppleSegmentedControl';
import { SetlistDateBadge } from './SetlistScreen';
import { InstrumentIcon } from '../utils/instruments';
import { haptic } from '../utils/haptics';
import { useBackHandler } from '../utils/backHandler';
import { 
    CalendarBlank as Calendar, Plus, Clock, Users, PencilSimple as Edit3, Trash as Trash2, 
    CaretDown as ChevronDown, CaretUp as ChevronUp, MusicNotes as Music, Shield, CheckCircle as CheckCircle2, 
    WarningCircle as AlertCircle, UserCheck, Play, ArrowUpRight,
    Lock, User, ArrowClockwise as RefreshCw
} from '@phosphor-icons/react';

export default function ScheduleScreen() {
    const navigate = useNavigate();
    const { user, profile, canManageSchedule, canManageRoles } = useAuth();
    const { schedules, setlists } = useSongCache();

    const [showAddModal, setShowAddModal] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState(null);
    const [showManageTeam, setShowManageTeam] = useState(false);
    const [scheduleToDelete, setScheduleToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [assigningSlot, setAssigningSlot] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'past'

    useBackHandler(Boolean(scheduleToDelete), () => setScheduleToDelete(null));
    useBackHandler(showManageTeam, () => setShowManageTeam(false));
    useBackHandler(Boolean(assigningSlot), () => setAssigningSlot(null));

    const handleAddBackupSingerToSchedule = async (sched) => {
        haptic('medium');
        const newSinger = {
            id: crypto.randomUUID(),
            role_name: 'Backup Singers',
            icon: 'Users',
            user_id: null,
            user_name: '',
            user_avatar: '',
            user_email: '',
            status: 'assigned'
        };
        const currentAssignments = sched.assignments || [];
        const lastIdx = currentAssignments.map(a => a.role_name).lastIndexOf('Backup Singers');
        const updated = [...currentAssignments];
        if (lastIdx !== -1) {
            updated.splice(lastIdx + 1, 0, newSinger);
        } else {
            updated.push(newSinger);
        }
        const updatedSchedule = {
            ...sched,
            assignments: updated,
            updatedAt: new Date().toISOString()
        };
        await scheduleDB.update(sched.id, { assignments: updated });
        if (user) {
            await pushScheduleToSupabase(updatedSchedule, user);
        }
        setAssigningSlot({ schedule: updatedSchedule, assignment: newSinger });
    };

    // Initial background sync
    useEffect(() => {
        discreetBackgroundSync();
    }, []);

    // Filter upcoming vs past services (today is YYYY-MM-DD)
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const upcomingSchedules = (schedules || [])
        .filter(s => !s.serviceDate || s.serviceDate >= todayStr)
        .sort((a, b) => {
            if (!a.serviceDate) return 1;
            if (!b.serviceDate) return -1;
            return a.serviceDate.localeCompare(b.serviceDate);
        });

    const pastSchedules = (schedules || [])
        .filter(s => s.serviceDate && s.serviceDate < todayStr)
        .sort((a, b) => b.serviceDate.localeCompare(a.serviceDate));

    const handleOpenCreate = () => {
        if (!user) {
            navigate('/login');
            return;
        }
        setEditingSchedule(null);
        setShowAddModal(true);
        haptic('light');
    };

    const handleEditSchedule = (sched) => {
        setEditingSchedule(sched);
        setShowAddModal(true);
        haptic('light');
    };

    const handleDeleteConfirm = async () => {
        if (!scheduleToDelete || isDeleting) return;
        haptic('error');
        const schedId = scheduleToDelete.id;
        setIsDeleting(true);
        try {
            await deleteScheduleFromSupabase(schedId, user);
            await scheduleDB.delete(schedId);
            setScheduleToDelete(null);
        } catch (err) {
            console.warn('Failed to delete schedule:', err);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <PullToRefresh onRefresh={discreetBackgroundSync}>
            <div className="min-h-screen bg-primary pb-28 animate-pageEnter text-textprimary">
                {/* Header */}
                <header className="glass sticky top-0 z-30 border-b border-themed">
                    <div className="px-3.5 sm:px-5 pt-10 pb-4">
                        <div className="flex items-center justify-between">
                            <AppLogo size="md" showText={true} />

                            <div className="flex items-center gap-2">
                                {/* Top Bar Notification Bell */}
                                <TopBarNotificationBell />

                                {canManageRoles && (
                                    <button
                                        onClick={() => {
                                            haptic('light');
                                            setShowManageTeam(true);
                                        }}
                                        className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 border border-accent/25 px-3 py-1.5 rounded-2xl hover:bg-accent/20 active:scale-95 transition font-bold min-h-[44px]"
                                        title="Manage Team & Roles"
                                    >
                                        <Shield className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline">Team Roles</span>
                                    </button>
                                )}

                                {canManageSchedule && (
                                    <button
                                        onClick={handleOpenCreate}
                                        className="hidden md:inline-flex items-center gap-1.5 bg-accent text-onaccent px-3.5 py-1.5 rounded-2xl text-xs font-bold shadow-md shadow-accent/20 hover:brightness-110 active:scale-95 transition"
                                        title="Schedule Worship Ministers"
                                    >
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                        <span>Create Schedule</span>
                                    </button>
                                )}

                                {user ? (
                                    <div className="flex items-center gap-1.5 text-xs text-textmuted bg-secondary border border-themed px-3 py-1.5 rounded-2xl">
                                        <Calendar className="w-3.5 h-3.5 text-accent" />
                                        <span className="font-bold text-textprimary">
                                            {activeTab === 'upcoming' ? upcomingSchedules.length : pastSchedules.length}
                                        </span>
                                        <span>{activeTab === 'upcoming' ? 'Upcoming' : 'Past'}</span>
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

                {/* Main Schedule Content */}
                <main className="px-3.5 sm:px-8 py-5 space-y-6 max-w-5xl mx-auto">
                    {/* Unauthenticated State */}
                    {!user ? (
                        <div className="relative overflow-hidden rounded-3xl bg-elevated border border-themed p-8 sm:p-10 text-center shadow-2xl backdrop-blur-xl max-w-lg mx-auto mt-4 space-y-4">
                            <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="absolute -bottom-12 -left-12 w-44 h-44 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
                            <div className="relative z-10 space-y-4">
                                <Lock className="w-10 h-10 text-accent mx-auto" />
                                <div className="space-y-1.5">
                                    <h3 className="text-lg font-bold text-textprimary tracking-wide">
                                        Sign In to See Ministry Schedule
                                    </h3>
                                    <p className="text-xs text-textmuted leading-relaxed max-w-xs mx-auto">
                                        Musician rosters, worship leader assignments, and call times are private to your church worship team.
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
                    ) : !schedules || schedules.length === 0 ? (
                        <div className="text-center py-16 bg-elevated rounded-3xl border border-themed p-8 space-y-4 shadow-xl">
                            <Users className="w-10 h-10 text-accent mx-auto" />
                            <div className="space-y-1">
                                <h3 className="text-base font-bold text-textprimary">No Minister Schedules</h3>
                                <p className="text-textmuted text-xs max-w-xs mx-auto leading-relaxed">
                                    Schedule worship ministers (Worship Leader, Guitar, Bass, Keyboard, Drums, Back Up Singers) for upcoming services.
                                </p>
                            </div>
                            {canManageSchedule && (
                                <button
                                    onClick={handleOpenCreate}
                                    className="px-5 py-3 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-lg shadow-accent/20 active:scale-95 transition flex items-center gap-2 mx-auto"
                                >
                                    <Plus className="w-4 h-4 stroke-[3]" />
                                    <span>Schedule Worship Ministers</span>
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Apple HIG Segmented Control Tabs */}
                            <div className="max-w-md mx-auto sm:mx-0">
                                <AppleSegmentedControl
                                    tabs={[
                                        {
                                            id: 'upcoming',
                                            label: 'Upcoming Rosters',
                                            count: upcomingSchedules.length,
                                            icon: Calendar,
                                            accentColor: 'text-accent',
                                        },
                                        {
                                            id: 'past',
                                            label: 'Past Rosters',
                                            count: pastSchedules.length,
                                            icon: Clock,
                                            accentColor: 'text-textmuted',
                                        },
                                    ]}
                                    activeTab={activeTab}
                                    onChange={setActiveTab}
                                />
                            </div>

                            {/* Tab Content Panel with Smooth Animation */}
                            <div key={activeTab} className="animate-tabContent space-y-3">
                                {activeTab === 'upcoming' ? (
                                    upcomingSchedules.length === 0 ? (
                                        <div className="rounded-3xl bg-elevated border border-themed p-8 text-center shadow-xl space-y-3">
                                            <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto text-accent">
                                                <Calendar className="w-7 h-7" />
                                            </div>
                                            <h3 className="text-base font-bold text-textprimary">No Upcoming Schedules Planned</h3>
                                            <p className="text-xs text-textmuted max-w-xs mx-auto leading-relaxed">
                                                Schedule worship ministers and assign team musicians for your next service.
                                            </p>
                                            {canManageSchedule && (
                                                <button
                                                    onClick={handleOpenCreate}
                                                    className="px-5 py-2.5 bg-accent text-onaccent rounded-xl text-xs font-bold shadow-md shadow-accent/20 active:scale-95 transition flex items-center gap-1.5 mx-auto"
                                                >
                                                    <Plus className="w-4 h-4 stroke-[2.5]" />
                                                    <span>Plan Next Service</span>
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        upcomingSchedules.map((schedule, idx) => (
                                            <div key={schedule.id} className="animate-list-item" style={{ '--stagger-idx': idx }}>
                                                <MinisterScheduleCard
                                                    schedule={schedule}
                                                    isPast={false}
                                                    canManage={canManageSchedule}
                                                    onEdit={() => handleEditSchedule(schedule)}
                                                    onDelete={() => setScheduleToDelete(schedule)}
                                                    onAssignSlot={(assignment) => setAssigningSlot({ schedule, assignment })}
                                                    onAddBackupSinger={() => handleAddBackupSingerToSchedule(schedule)}
                                                    allSetlists={setlists || []}
                                                />
                                            </div>
                                        ))
                                    )
                                ) : (
                                    pastSchedules.length === 0 ? (
                                        <div className="rounded-3xl bg-elevated border border-themed p-8 text-center shadow-xl space-y-3">
                                            <div className="w-14 h-14 rounded-2xl bg-secondary border border-themed flex items-center justify-center mx-auto text-textmuted">
                                                <Clock className="w-7 h-7" />
                                            </div>
                                            <h3 className="text-base font-bold text-textprimary">No Past Schedules Recorded</h3>
                                            <p className="text-xs text-textmuted max-w-xs mx-auto leading-relaxed">
                                                Ministry assignments and past call rosters from previous services will appear here.
                                            </p>
                                        </div>
                                    ) : (
                                        pastSchedules.map((schedule, idx) => (
                                            <div key={schedule.id} className="animate-list-item" style={{ '--stagger-idx': idx }}>
                                                <MinisterScheduleCard
                                                    schedule={schedule}
                                                    isPast={true}
                                                    canManage={canManageSchedule}
                                                    onEdit={() => handleEditSchedule(schedule)}
                                                    onDelete={() => setScheduleToDelete(schedule)}
                                                    onAssignSlot={(assignment) => setAssigningSlot({ schedule, assignment })}
                                                    onAddBackupSinger={() => handleAddBackupSingerToSchedule(schedule)}
                                                    allSetlists={setlists || []}
                                                />
                                            </div>
                                        ))
                                    )
                                )}
                            </div>
                        </>
                    )}
                </main>

                {/* Floating Add Schedule Button for Admins/Superusers */}
                {canManageSchedule && typeof document !== 'undefined' && createPortal(
                    <button
                        onClick={handleOpenCreate}
                        className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px))] md:bottom-8 right-5 md:right-8 w-14 h-14 min-w-[56px] min-h-[56px] rounded-full bg-accent text-onaccent flex items-center justify-center shadow-2xl shadow-black/80 glow-accent z-40 btn-primary-interact"
                        title="Schedule Ministers"
                    >
                        <Plus className="w-6 h-6 stroke-[3]" />
                    </button>,
                    document.body
                )}

                {/* Add/Edit Schedule Modal */}
                {showAddModal && (
                    <ScheduleBottomSheet
                        schedule={editingSchedule}
                        onClose={() => {
                            setShowAddModal(false);
                            setEditingSchedule(null);
                        }}
                    />
                )}

                {/* Manage Team RBAC Modal (Superuser) */}
                {showManageTeam && (
                    <ManageTeamModal
                        isOpen={showManageTeam}
                        onClose={() => setShowManageTeam(false)}
                    />
                )}

                {/* Delete Confirmation Modal (Portaled) */}
                {scheduleToDelete && typeof document !== 'undefined' && createPortal(
                    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
                        <div className="bg-elevated border border-themed rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center animate-slideUpModal">
                            <Trash2 className="w-10 h-10 text-danger mx-auto" />
                            <h3 className="text-base font-bold text-textprimary">Delete Minister Schedule?</h3>
                            <p className="text-textmuted text-xs">
                                Are you sure you want to remove the schedule for <strong>"{scheduleToDelete.serviceTitle}"</strong>?
                            </p>
                            <div className="flex justify-center gap-3 pt-2">
                                <button
                                    disabled={isDeleting}
                                    onClick={() => setScheduleToDelete(null)}
                                    className="flex-1 min-h-[44px] py-2.5 px-4 text-xs font-medium text-textmuted bg-secondary border border-themed rounded-xl btn-interact disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    disabled={isDeleting}
                                    onClick={handleDeleteConfirm}
                                    className="flex-1 min-h-[44px] py-2.5 px-4 text-xs font-bold text-white bg-danger hover:bg-danger/90 rounded-xl shadow-lg shadow-danger/20 btn-interact disabled:opacity-50 flex items-center justify-center gap-1.5"
                                >
                                    {isDeleting ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Deleting...</span>
                                        </>
                                    ) : (
                                        <span>Delete</span>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}

                {/* Account Chooser Bottomsheet for assigning a specific minister slot */}
                {assigningSlot && (
                    <AssignMinisterBottomSheet
                        schedule={assigningSlot.schedule}
                        assignment={assigningSlot.assignment}
                        onClose={() => setAssigningSlot(null)}
                        onUpdate={() => setAssigningSlot(null)}
                    />
                )}
            </div>
        </PullToRefresh>
    );
}

// ── Minister Schedule Expandable Card Component ──
function MinisterScheduleCard({ schedule, isPast = false, canManage = false, onEdit, onDelete, onAssignSlot, onAddBackupSinger, allSetlists = [] }) {
    const navigate = useNavigate();
    // Collapsed by default to reduce visual clutter on initial load / refresh
    const [expanded, setExpanded] = useState(false);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = schedule.serviceDate === todayStr;

    const assignments = schedule.assignments || [];
    const assignedCount = assignments.filter(a => a.user_name || a.user_id).length;
    const totalCount = assignments.length;
    const allFilled = totalCount > 0 && assignedCount === totalCount;

    // Find linked setlist
    const linkedSetlist = schedule.setlistId ? allSetlists.find(s => String(s.id) === String(schedule.setlistId)) : null;

    return (
        <div
            className={`rounded-3xl border transition-all duration-200 overflow-hidden shadow-lg ${
                isToday
                    ? 'bg-elevated border-accent/50 ring-1 ring-accent/30'
                    : isPast
                    ? 'bg-elevated/70 border-themed opacity-80 hover:opacity-100'
                    : 'bg-elevated border-themed hover:border-accent/40'
            }`}
        >
            {/* Card Header (Click to expand) */}
            <div
                onClick={() => {
                    haptic('light');
                    setExpanded(prev => !prev);
                }}
                className="p-3.5 sm:p-5 flex items-center justify-between cursor-pointer select-none gap-2.5 sm:gap-3 hover:bg-surface-hover/50 transition-colors"
            >
                <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    {/* Date Badge */}
                    <SetlistDateBadge
                        date={schedule.serviceDate}
                        isToday={isToday}
                        isPast={isPast}
                        size="md"
                    />

                    {/* Title & Timing Info */}
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm sm:text-base font-bold text-textprimary truncate">
                                {schedule.serviceTitle}
                            </h3>
                            {isToday && (
                                <span className="text-[10px] sm:text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-accent text-onaccent shadow-sm animate-pulse">
                                    Today
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2.5 text-xs text-textmuted flex-wrap">
                            {schedule.serviceTime && (
                                <span className="flex items-center gap-1 font-medium">
                                    <Clock className="w-3.5 h-3.5 text-accent" />
                                    <span>{schedule.serviceTime}</span>
                                </span>
                            )}
                            <span className="flex items-center gap-1 font-medium">
                                <Users className="w-3.5 h-3.5 text-accent" />
                                <span className={allFilled ? 'text-emerald-400 font-bold' : ''}>
                                    {assignedCount}/{totalCount} Assigned
                                </span>
                            </span>
                        </div>

                        {/* Collapsed overview: Show assigned ministers and roles concisely */}
                        {!expanded && assignments.length > 0 && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-[11px] text-textmuted">
                                {assignments.filter(a => a.user_name).slice(0, 3).map((a, i) => (
                                    <span key={a.id || i} className="inline-flex items-center gap-1 bg-secondary/80 border border-themed px-2 py-0.5 rounded-lg truncate max-w-[150px]">
                                        <span className="font-semibold text-textprimary truncate">{a.role_name}:</span>
                                        <span className="truncate">{a.user_name}</span>
                                    </span>
                                ))}
                                {assignments.filter(a => a.user_name).length > 3 && (
                                    <span className="text-[10px] text-textmuted font-semibold">
                                        +{assignments.filter(a => a.user_name).length - 3} more
                                    </span>
                                )}
                                {assignments.filter(a => a.user_name).length === 0 && (
                                    <span className="text-[11px] text-textmuted/60 italic">No ministers assigned yet</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right actions: Expand toggle */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={() => {
                            haptic('light');
                            setExpanded(prev => !prev);
                        }}
                        className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-secondary border border-themed text-textmuted hover:text-textprimary flex items-center justify-center btn-icon-action"
                        title={expanded ? "Collapse" : "Expand"}
                    >
                        {expanded ? <ChevronUp className="w-5 h-5 text-accent" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            {/* Linked Setlist Pill (if attached) */}
            {linkedSetlist && (
                <div className="px-4 sm:px-5 pb-3">
                    <div 
                        onClick={() => {
                            haptic('light');
                            navigate(`/setlist-player/${linkedSetlist.id}`);
                        }}
                        className="p-3 rounded-2xl bg-secondary/80 border border-themed hover:border-accent/50 flex items-center justify-between text-xs sm:text-sm cursor-pointer transition active:scale-98 group"
                    >
                        <div className="flex items-center gap-2.5 text-textprimary font-medium truncate">
                            <Music className="w-5 h-5 text-accent shrink-0" />
                            <span className="truncate">Setlist Lineup: <strong>{linkedSetlist.title}</strong> ({linkedSetlist.songIds?.length || 0} songs)</span>
                        </div>
                        <span className="text-xs text-accent font-bold group-hover:underline flex items-center gap-1 shrink-0 ml-2">
                            <span>Open</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </span>
                    </div>
                </div>
            )}

            {/* Expanded Minister Roster with Smooth Accordion Animation */}
            <div className={`accordion-grid ${expanded ? 'is-expanded' : ''}`}>
                <div className="accordion-grid-inner">
                    <div className="px-4 sm:px-5 pb-5 pt-3 border-t border-themed space-y-4">
                        {canManage && (
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={onEdit}
                                    className="h-11 min-h-[44px] px-3 rounded-xl bg-secondary border border-themed text-textprimary hover:border-accent/40 text-xs font-bold flex items-center justify-center gap-1.5 btn-interact"
                                    title="Edit Schedule"
                                >
                                    <Edit3 className="w-4 h-4 text-accent" />
                                    <span>Edit Schedule</span>
                                </button>
                                <button
                                    onClick={onDelete}
                                    className="h-11 min-h-[44px] px-3 rounded-xl bg-secondary border border-themed text-textmuted hover:text-danger hover:border-danger/40 text-xs font-bold flex items-center justify-center gap-1.5 btn-interact"
                                    title="Delete Schedule"
                                >
                                    <Trash2 className="w-4 h-4 text-danger" />
                                    <span>Delete Schedule</span>
                                </button>
                            </div>
                        )}
                    {/* Minister Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {assignments.map((assignment) => {
                            const isAssigned = Boolean(assignment.user_name || assignment.user_id);

                            return (
                                <div
                                    key={assignment.id}
                                    className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition min-h-[58px] ${
                                        isAssigned
                                            ? 'bg-secondary/70 border-themed'
                                            : 'bg-secondary/30 border-themed border-dashed'
                                    }`}
                                >
                                    {/* Left: Instrument icon & Role title */}
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-6 h-6 shrink-0 flex items-center justify-center">
                                            <InstrumentIcon 
                                                name={assignment.icon} 
                                                className={`w-5 h-5 ${isAssigned ? 'text-accent' : 'text-textmuted'}`} 
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-bold text-textprimary leading-tight truncate">
                                                    {assignment.role_name}
                                                </p>
                                                {assignment.role_name === 'Backup Singers' && canManage && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onAddBackupSinger?.();
                                                        }}
                                                        className="px-1.5 py-0.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-[10px] font-bold hover:bg-accent/20 active:scale-95 transition flex items-center gap-0.5 shrink-0"
                                                        title="Add another backup singer slot"
                                                    >
                                                        <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                                        <span>Singer</span>
                                                    </button>
                                                )}
                                            </div>
                                            <p className={`text-xs truncate mt-0.5 ${isAssigned ? 'text-textmuted font-medium' : 'text-textmuted/60 italic'}`}>
                                                {assignment.user_name || 'Unassigned'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Right: Minister Avatar & Status */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isAssigned ? (
                                            <div
                                                onClick={() => {
                                                    if (canManage && onAssignSlot) {
                                                        haptic('light');
                                                        onAssignSlot(assignment);
                                                    }
                                                }}
                                                className={`flex items-center gap-2 ${canManage ? 'cursor-pointer hover:opacity-80 active:scale-95 transition' : ''}`}
                                                title={canManage ? "Change assigned minister" : undefined}
                                            >
                                                {assignment.status === 'confirmed' && (
                                                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center" title="Confirmed">
                                                        <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                                    </span>
                                                )}
                                                <div className="w-8 h-8 rounded-full bg-secondary border border-themed overflow-hidden">
                                                    <UserAvatar
                                                        seed={assignment.user_avatar || assignment.user_name}
                                                        size="xs"
                                                        animated={false}
                                                        fallbackInitial={assignment.user_name?.charAt(0) || '?'}
                                                        className="w-full h-full"
                                                    />
                                                </div>
                                            </div>
                                        ) : canManage ? (
                                            <button
                                                onClick={() => {
                                                    haptic('light');
                                                    if (onAssignSlot) {
                                                        onAssignSlot(assignment);
                                                    } else {
                                                        onEdit();
                                                    }
                                                }}
                                                className="px-3.5 py-2 min-h-[44px] rounded-xl bg-accent/10 hover:bg-accent/20 text-accent border border-accent/25 text-xs font-bold active:scale-95 transition flex items-center"
                                            >
                                                + Assign
                                            </button>
                                        ) : (
                                            <span className="text-xs text-textmuted/50 font-medium">Open</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Notes & Reminders */}
                    {schedule.notes && (
                        <div className="p-3.5 rounded-2xl bg-secondary/50 border border-themed text-xs space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-accent" /> Call Time & Reminders
                            </p>
                            <p className="text-textmuted text-xs sm:text-sm leading-relaxed whitespace-pre-line mt-1">
                                {schedule.notes}
                            </p>
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );
}
