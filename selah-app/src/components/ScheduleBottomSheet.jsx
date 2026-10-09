import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { scheduleDB, setlistDB, notificationDB } from '../db/dexie';
import { 
    pushScheduleToSupabase, 
    pushSetlistToSupabase, 
    pushNotificationToSupabase,
    getUserChurchId 
} from '../supabase/sync';
import { 
    DEFAULT_WORSHIP_ROLES, 
    AVAILABLE_INSTRUMENT_ICONS, 
    InstrumentIcon 
} from '../utils/instruments';
import { scheduleMinisterReminders, sendSystemNotification, dispatchAssignmentEmail } from '../utils/notifications';
import { haptic } from '../utils/haptics';
import { useBackHandler } from '../utils/backHandler';
import UserAvatar from './UserAvatar';
import { 
    X, CalendarBlank as Calendar, Clock, Plus, Trash as Trash2, Check, MusicNotes as Music, 
    CaretDown as ChevronDown, UserCheck, WarningCircle as AlertCircle, 
    CaretUp as ChevronUp, Users, Info
} from '@phosphor-icons/react';

const SERVICE_TITLE_PRESETS = [
    'Sunday Worship Service',
    'Midweek Service',
    'Prayer Meeting'
];

export default function ScheduleBottomSheet({ schedule = null, onClose }) {
    const { user, profile, church, fetchChurchMembers, isSuperuser } = useAuth();
    const { setlists } = useSongCache();

    useBackHandler(true, onClose);

    // Form fields
    const [serviceTitle, setServiceTitle] = useState(schedule?.serviceTitle || 'Sunday Worship Service');
    const [serviceDate, setServiceDate] = useState(schedule?.serviceDate || new Date().toISOString().split('T')[0]);
    const [serviceTime, setServiceTime] = useState(schedule?.serviceTime || '09:00 AM');
    const [setlistId, setSetlistId] = useState(schedule?.setlistId || '');
    const [notes, setNotes] = useState(schedule?.notes || '');

    // Assignments
    const [assignments, setAssignments] = useState(
        schedule?.assignments?.length > 0 
            ? schedule.assignments 
            : DEFAULT_WORSHIP_ROLES.map(role => ({
                id: crypto.randomUUID(),
                role_name: role.roleName,
                icon: role.icon,
                user_id: null,
                user_name: '',
                user_avatar: '',
                user_email: '',
                status: 'assigned' // 'assigned' | 'confirmed'
            }))
    );

    // Church team members for dropdown assignment
    const [churchMembers, setChurchMembers] = useState([]);
    const [customRoleName, setCustomRoleName] = useState('');
    const [customRoleIcon, setCustomRoleIcon] = useState('Mic');
    const [showCustomRoleForm, setShowCustomRoleForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        let mounted = true;
        fetchChurchMembers().then(members => {
            if (mounted && members) {
                setChurchMembers(members);
            }
        });
        return () => { mounted = false; };
    }, [fetchChurchMembers]);

    // Auto-assign setlist creator to Worship Leader role on initial mount if unassigned
    useEffect(() => {
        if (schedule) return;
        const wlIdx = assignments.findIndex(a => a.role_name.toLowerCase().includes('lead'));
        if (wlIdx === -1 || assignments[wlIdx].user_id) return;

        let creatorMember = null;
        if (setlistId) {
            const linked = setlists?.find(s => String(s.id) === String(setlistId));
            if (linked) {
                creatorMember = churchMembers.find(m => m.id === linked.userId || m.username === linked.preparedBy);
            }
        }
        if (!creatorMember && user) {
            creatorMember = churchMembers.find(m => m.id === user.id) || {
                id: user.id,
                username: user.user_metadata?.username || user.email?.split('@')[0],
                avatar_seed: profile?.avatar_seed || user.user_metadata?.username,
                email: user.email
            };
        }

        if (creatorMember) {
            setAssignments(prev => {
                if (prev[wlIdx]?.user_id) return prev;
                const next = [...prev];
                next[wlIdx] = {
                    ...next[wlIdx],
                    user_id: creatorMember.id,
                    user_name: creatorMember.username || creatorMember.email?.split('@')[0],
                    user_avatar: creatorMember.avatar_seed || creatorMember.username,
                    user_email: creatorMember.email || '',
                    status: 'assigned'
                };
                return next;
            });
        }
    }, [churchMembers, user, setlistId, setlists, schedule]);

    // Handle Setlist dropdown change and auto-assign its creator
    const handleSetlistChange = (newSetlistId) => {
        setSetlistId(newSetlistId);
        if (!newSetlistId) return;

        const selectedSetlist = setlists?.find(s => String(s.id) === String(newSetlistId));
        if (selectedSetlist) {
            const creatorMember = churchMembers.find(m => m.id === selectedSetlist.userId || m.username === selectedSetlist.preparedBy)
                || (user && user.id === selectedSetlist.userId ? {
                    id: user.id,
                    username: user.user_metadata?.username || user.email?.split('@')[0],
                    avatar_seed: profile?.avatar_seed || user.user_metadata?.username,
                    email: user.email
                } : null);

            if (creatorMember) {
                setAssignments(prev => {
                    const wlIdx = prev.findIndex(a => a.role_name.toLowerCase().includes('lead'));
                    if (wlIdx === -1) return prev;
                    const next = [...prev];
                    next[wlIdx] = {
                        ...next[wlIdx],
                        user_id: creatorMember.id,
                        user_name: creatorMember.username || creatorMember.email?.split('@')[0],
                        user_avatar: creatorMember.avatar_seed || creatorMember.username,
                        user_email: creatorMember.email || '',
                        status: 'assigned'
                    };
                    return next;
                });
            }
        }
    };

    // Add another Backup Singer slot
    const handleAddBackupSinger = () => {
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
        setAssignments(prev => {
            const lastSingerIdx = prev.map(a => a.role_name).lastIndexOf('Backup Singers');
            if (lastSingerIdx !== -1) {
                const next = [...prev];
                next.splice(lastSingerIdx + 1, 0, newSinger);
                return next;
            }
            return [...prev, newSinger];
        });
    };

    // Handle Assigning member to role
    const handleAssignMember = (index, memberId) => {
        haptic('light');
        const selectedMember = churchMembers.find(m => m.id === memberId);
        
        setAssignments(prev => {
            const updated = [...prev];
            if (selectedMember) {
                updated[index] = {
                    ...updated[index],
                    user_id: selectedMember.id,
                    user_name: selectedMember.username || selectedMember.email?.split('@')[0],
                    user_avatar: selectedMember.avatar_seed || selectedMember.username,
                    user_email: selectedMember.email || '',
                    status: 'assigned'
                };
            } else {
                updated[index] = {
                    ...updated[index],
                    user_id: null,
                    user_name: '',
                    user_avatar: '',
                    user_email: '',
                    status: 'assigned'
                };
            }
            return updated;
        });
    };

    // Toggle confirmed status
    const handleToggleStatus = (index) => {
        haptic('light');
        setAssignments(prev => {
            const updated = [...prev];
            const curr = updated[index].status;
            updated[index] = {
                ...updated[index],
                status: curr === 'confirmed' ? 'assigned' : 'confirmed'
            };
            return updated;
        });
    };

    // Remove role from schedule
    const handleRemoveRole = (index) => {
        haptic('light');
        setAssignments(prev => prev.filter((_, i) => i !== index));
    };

    // Add custom role / instrument
    const handleAddCustomRole = () => {
        if (!customRoleName.trim()) return;
        haptic('medium');
        setAssignments(prev => [
            ...prev,
            {
                id: crypto.randomUUID(),
                role_name: customRoleName.trim(),
                icon: customRoleIcon,
                user_id: null,
                user_name: '',
                user_avatar: '',
                user_email: '',
                status: 'assigned'
            }
        ]);
        setCustomRoleName('');
        setShowCustomRoleForm(false);
    };

    // Save schedule & Auto-generate Setlist if needed
    const handleSave = async () => {
        if (!serviceTitle.trim()) {
            setErrorMsg('Please provide a service title');
            return;
        }
        if (!serviceDate) {
            setErrorMsg('Please select a service date');
            return;
        }

        haptic('medium');
        setSaving(true);
        setErrorMsg('');

        try {
            const churchId = church?.id || await getUserChurchId(user);
            const now = new Date().toISOString();
            const schedId = schedule?.id || crypto.randomUUID();

            let targetSetlistId = setlistId;

            // Find assigned worship leader (if any)
            const worshipLeaderAssignment = assignments.find(
                a => a.role_name.toLowerCase().includes('lead') && (a.user_name || a.user_id)
            );

            // ── Auto-create setlist entry if no song lineup is linked (or reuse existing on same date) ──
            if (!targetSetlistId) {
                const allSetlists = await setlistDB.getAll();
                const existingSetlist = allSetlists.find(s => 
                    s.date === serviceDate && (!s.churchId || s.churchId.toLowerCase() === churchId.toLowerCase() || churchId === 'JFCM-Mercedes')
                );

                if (existingSetlist) {
                    targetSetlistId = existingSetlist.id;
                } else {
                    const autoSetlistId = crypto.randomUUID();
                    const worshipLeaderName = worshipLeaderAssignment?.user_name || user?.user_metadata?.username || user?.email?.split('@')[0] || 'Worship Leader';
                    const worshipLeaderUserId = worshipLeaderAssignment?.user_id || user?.id;

                    const newSetlist = {
                        id: autoSetlistId,
                        title: `${serviceTitle} Lineup`,
                        date: serviceDate,
                        notes: notes ? `Service Notes: ${notes}` : `Worship Lineup for ${serviceTitle}`,
                        preparedBy: worshipLeaderName,
                        userId: worshipLeaderUserId,
                        churchId,
                        songIds: [],
                        created: now,
                        updatedAt: now
                    };

                    // Save setlist to local Dexie & push to Supabase
                    await setlistDB.add(newSetlist);
                    if (user) {
                        await pushSetlistToSupabase(newSetlist, user);
                    }

                    targetSetlistId = autoSetlistId;

                    // Notify the Worship Leader to add songs to the newly created setlist!
                    if (worshipLeaderUserId && worshipLeaderUserId !== user?.id) {
                        const wlNotifTitle = `Lineup Needed: ${serviceTitle}`;
                        const wlNotifBody = `A new setlist has been generated for ${serviceDate}. Please add songs to complete the lineup!`;
                        
                        const notifRecord = {
                            id: `setlist-req-${autoSetlistId}`,
                            userId: worshipLeaderUserId,
                            churchId,
                            title: wlNotifTitle,
                            body: wlNotifBody,
                            type: 'setlist_request',
                            data: { setlistId: autoSetlistId, serviceTitle, serviceDate },
                            isRead: false,
                            createdAt: now
                        };

                        if (user) {
                            await pushNotificationToSupabase(notifRecord, user);
                        }
                    }
                }
            }

            // Deduplicate: Clean any duplicate schedules sharing this setlistId or serviceDate + serviceTitle
            try {
                const allSchedules = await scheduleDB.getAll();
                const duplicateSchedules = allSchedules.filter(s => 
                    s.id !== schedId && (
                        (targetSetlistId && s.setlistId === targetSetlistId) ||
                        (s.serviceDate === serviceDate && s.serviceTitle?.trim().toLowerCase() === serviceTitle.trim().toLowerCase() && (!s.churchId || s.churchId.toLowerCase() === churchId.toLowerCase() || churchId === 'JFCM-Mercedes'))
                    )
                );

                for (const dup of duplicateSchedules) {
                    await scheduleDB.delete(dup.id);
                    if (user) {
                        await deleteScheduleFromSupabase(dup.id, user).catch(() => {});
                    }
                }
            } catch (dedupErr) {
                console.warn('[Schedule] Deduplication warning:', dedupErr);
            }

            const schedulePayload = {
                id: schedId,
                churchId,
                serviceTitle: serviceTitle.trim(),
                serviceDate,
                serviceTime,
                setlistId: targetSetlistId,
                notes: notes.trim(),
                assignments,
                createdBy: schedule?.createdBy || user?.id,
                created: schedule?.created || now,
                updatedAt: now
            };

            // 1. Save to local Dexie (put handles both create and edit)
            await scheduleDB.put(schedulePayload);

            // 2. Push to Supabase Cloud
            if (user) {
                await pushScheduleToSupabase(schedulePayload, user);
            }

            // 3. Dispatch & Schedule Multi-Day Notifications for assigned ministers
            for (const assign of assignments) {
                if (assign.user_id || assign.user_email) {
                    const isCurrentUser = Boolean(user && assign.user_id === user.id);
                    const notifId = `assign-${schedId}-${assign.id || assign.role_name}`;

                    if (isCurrentUser || !user) {
                        // Current user was assigned this role (or offline/guest mode):
                        // Schedule multi-day reminder and in-app notification on THIS device
                        await scheduleMinisterReminders({
                            scheduleId: schedId,
                            serviceTitle: serviceTitle.trim(),
                            serviceDate,
                            serviceTime,
                            assignment: assign,
                            notes: notes.trim(),
                            churchId,
                            targetUserId: user?.id || null,
                            targetEmail: assign.user_email
                        });
                    } else if (assign.user_id) {
                        // Assigned to another team member:
                        // ONLY push notification to Supabase so THEY receive it on their device.
                        // Do NOT schedule local alarms or save in current creator's local tray!
                        const notifRecord = {
                            id: notifId,
                            userId: assign.user_id,
                            churchId,
                            title: `Worship Assignment: ${assign.role_name}`,
                            body: `You are scheduled for "${serviceTitle.trim()}" on ${serviceDate} (${serviceTime}). Notes: ${notes.trim() || 'None'}`,
                            type: 'assignment',
                            data: { scheduleId: schedId, serviceDate, serviceTime, roleName: assign.role_name, notes: notes.trim() },
                            isRead: false,
                            createdAt: now
                        };
                        if (user) {
                            await pushNotificationToSupabase(notifRecord, user);
                        }
                        if (assign.user_email) {
                            await dispatchAssignmentEmail({
                                toEmail: assign.user_email,
                                recipientName: assign.user_name || assign.user_email.split('@')[0],
                                serviceTitle: serviceTitle.trim(),
                                serviceDate,
                                serviceTime,
                                roleName: assign.role_name,
                                notes: notes.trim()
                            });
                        }
                    }
                }
            }

            haptic('success');
            onClose();
        } catch (err) {
            console.error('Failed to save minister schedule:', err);
            setErrorMsg(err?.message || 'Failed to save schedule');
            haptic('error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-md animate-fadeIn">
            {/* Click outside to close backdrop */}
            <div className="flex-1" onClick={onClose} />

            {/* Bottom Sheet Container */}
            <div className="bg-elevated border-t border-x border-themed rounded-t-[32px] w-full max-w-2xl mx-auto max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-slideUp">
                {/* Drag Handle Bar */}
                <div className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
                    <div className="w-12 h-1.5 rounded-full bg-themed/80" />
                </div>

                {/* Header */}
                <div className="px-5 py-3.5 border-b border-themed flex items-center justify-between bg-secondary/40">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shadow-sm">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-textprimary">
                                {schedule ? 'Edit Minister Schedule' : 'Schedule Worship Ministers'}
                            </h2>
                            <p className="text-xs text-textmuted">
                                Assign musicians, vocalists & send rehearsal notifications
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-secondary border border-themed text-textmuted hover:text-textprimary flex items-center justify-center active:scale-95 transition min-h-[44px] min-w-[44px]"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Error Banner */}
                    {errorMsg && (
                        <div className="p-3.5 rounded-2xl bg-danger/10 border border-danger/30 text-danger text-xs sm:text-sm flex items-center gap-2 font-medium">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Section 1: Service Title & Presets */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-textmuted">
                            Service Title
                        </label>
                        <input
                            type="text"
                            value={serviceTitle}
                            onChange={(e) => setServiceTitle(e.target.value)}
                            placeholder="e.g. Sunday Worship Service"
                            className="w-full bg-secondary border border-themed rounded-2xl px-4 py-3 min-h-[44px] text-sm text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent font-medium shadow-inner"
                        />

                        {/* Title Preset Quick Chips (Apple HIG Carousel) */}
                        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth snap-x">
                            {SERVICE_TITLE_PRESETS.map((preset) => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => {
                                        setServiceTitle(preset);
                                        haptic('light');
                                    }}
                                    className={`shrink-0 snap-start whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 flex items-center select-none ${
                                        serviceTitle === preset
                                            ? 'bg-accent text-onaccent shadow-sm shadow-accent/25'
                                            : 'bg-surface-hover/70 dark:bg-white/[0.06] text-textmuted hover:text-textprimary hover:bg-surface-active dark:hover:bg-white/10'
                                    }`}
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 2: Date & Service Time */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-accent" /> Date
                            </label>
                            <input
                                type="date"
                                value={serviceDate}
                                onChange={(e) => setServiceDate(e.target.value)}
                                className="w-full bg-secondary border border-themed rounded-2xl px-3.5 py-2.5 min-h-[44px] text-sm text-textprimary focus:outline-none focus:border-accent font-medium"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-accent" /> Time
                            </label>
                            <input
                                type="text"
                                value={serviceTime}
                                onChange={(e) => setServiceTime(e.target.value)}
                                placeholder="09:00 AM"
                                className="w-full bg-secondary border border-themed rounded-2xl px-3.5 py-2.5 min-h-[44px] text-sm text-textprimary focus:outline-none focus:border-accent font-medium"
                            />
                        </div>
                    </div>

                    {/* Section 3: Linked Song Lineup (Optional or Auto-created) */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1">
                                <Music className="w-3.5 h-3.5 text-accent" /> Link Song Lineup / Setlist
                            </label>
                            <span className="text-xs text-accent font-medium">
                                {!setlistId ? 'Auto-creates if unlinked' : 'Linked'}
                            </span>
                        </div>
                        <div className="relative">
                            <select
                                value={setlistId}
                                onChange={(e) => handleSetlistChange(e.target.value)}
                                className="w-full bg-secondary border border-themed rounded-2xl px-3.5 py-2.5 min-h-[44px] text-sm text-textprimary focus:outline-none focus:border-accent appearance-none pr-8 font-medium"
                            >
                                <option value="">Auto-create new setlist lineup for assigned Worship Leader</option>
                                {(setlists || []).map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.title} ({s.date || 'Undated'}) • {s.songIds?.length || 0} songs
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted pointer-events-none" />
                        </div>
                    </div>

                    {/* Section 4: Minister Assignments Roster */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold uppercase tracking-wider text-textprimary flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-accent" />
                                <span>Assigned Ministers ({assignments.length})</span>
                            </label>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={handleAddBackupSinger}
                                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1 min-h-[44px] px-2"
                                    title="Add another Backup Singer slot"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Backup Singer</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCustomRoleForm(prev => !prev);
                                        haptic('light');
                                    }}
                                    className="text-xs font-bold text-accent hover:underline flex items-center gap-1 min-h-[44px] px-2"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Add Custom Role</span>
                                </button>
                            </div>
                        </div>

                        {/* Add Custom Role Sub-form */}
                        {showCustomRoleForm && (
                            <div className="p-4 rounded-2xl bg-secondary/80 border border-accent/40 space-y-3 animate-fadeIn">
                                <p className="text-xs font-bold text-textprimary">Add Custom Instrument or Role</p>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={customRoleName}
                                        onChange={(e) => setCustomRoleName(e.target.value)}
                                        placeholder="Role Name (e.g. Violin, Sound Tech, PPT)"
                                        className="flex-1 bg-elevated border border-themed rounded-xl px-3 py-2 min-h-[44px] text-sm text-textprimary focus:outline-none focus:border-accent"
                                    />
                                    <div className="relative">
                                        <select
                                            value={customRoleIcon}
                                            onChange={(e) => setCustomRoleIcon(e.target.value)}
                                            className="bg-elevated border border-themed rounded-xl px-3 py-2 min-h-[44px] text-sm text-textprimary focus:outline-none pr-7 appearance-none"
                                        >
                                            {AVAILABLE_INSTRUMENT_ICONS.map(i => (
                                                <option key={i.name} value={i.name}>{i.label}</option>
                                            ))}
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-textmuted pointer-events-none" />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => setShowCustomRoleForm(false)}
                                        className="px-3.5 py-2 min-h-[40px] rounded-xl bg-secondary border border-themed text-xs text-textmuted font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleAddCustomRole}
                                        className="px-4 py-2 min-h-[40px] rounded-xl bg-accent text-onaccent font-bold text-xs shadow-sm"
                                    >
                                        Add to Roster
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Assignment List */}
                        <div className="space-y-2.5">
                            {assignments.map((assignment, idx) => {
                                const isAssigned = Boolean(assignment.user_name || assignment.user_id);
                                return (
                                    <div
                                        key={assignment.id}
                                        className="p-3.5 rounded-2xl bg-secondary/80 border border-themed flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                                    >
                                        {/* Role Icon & Name */}
                                        <div className="flex items-center gap-3 min-w-[150px]">
                                            <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/25 text-accent flex items-center justify-center shrink-0">
                                                <InstrumentIcon name={assignment.icon} className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-textprimary truncate">
                                                        {assignment.role_name}
                                                    </p>
                                                    {assignment.role_name === 'Backup Singers' && (
                                                        <button
                                                            type="button"
                                                            onClick={handleAddBackupSinger}
                                                            className="px-1.5 py-0.5 rounded-lg bg-accent/10 border border-accent/25 text-accent text-[10px] font-bold hover:bg-accent/20 active:scale-95 transition flex items-center gap-0.5 shrink-0"
                                                            title="Add another backup singer slot"
                                                        >
                                                            <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                                            <span>Singer</span>
                                                        </button>
                                                    )}
                                                </div>
                                                <p className="text-xs text-textmuted capitalize">
                                                    {assignment.status}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Member Selector & Status Toggle */}
                                        <div className="flex items-center gap-2 flex-1 justify-end">
                                            <div className="relative flex-1 max-w-xs">
                                                <select
                                                    value={assignment.user_id || ''}
                                                    onChange={(e) => handleAssignMember(idx, e.target.value)}
                                                    className="w-full bg-elevated border border-themed rounded-xl px-3 py-2 min-h-[44px] text-xs sm:text-sm text-textprimary focus:outline-none focus:border-accent appearance-none pr-8 font-medium"
                                                >
                                                    <option value="">-- Unassigned (Open) --</option>
                                                    {churchMembers.map((m) => (
                                                        <option key={m.id} value={m.id}>
                                                            {m.username || m.email?.split('@')[0]}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted pointer-events-none" />
                                            </div>

                                            {isAssigned && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(idx)}
                                                    className={`w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl border text-xs flex items-center justify-center transition active:scale-95 ${
                                                        assignment.status === 'confirmed'
                                                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                                                            : 'bg-secondary border-themed text-textmuted hover:text-textprimary'
                                                    }`}
                                                    title={assignment.status === 'confirmed' ? 'Marked Confirmed' : 'Mark as Confirmed'}
                                                >
                                                    <Check className="w-4 h-4 stroke-[2.5]" />
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRole(idx)}
                                                className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl bg-secondary border border-themed text-textmuted hover:text-danger hover:border-danger/40 transition active:scale-95 flex items-center justify-center"
                                                title="Remove Role"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Section 5: Rehearsal Notes & Reminders */}
                    <div className="space-y-1.5 pt-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-textmuted flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-accent" /> Call Time & Rehearsal Notes
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Call time, rehearsal notes, dress code..."
                            className="w-full bg-secondary border border-themed rounded-2xl p-3.5 text-xs sm:text-sm text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent font-medium resize-none shadow-inner"
                        />
                        <p className="text-xs text-textmuted/80 flex items-center gap-1">
                            <Info className="w-3.5 h-3.5 text-accent shrink-0" />
                            <span>Notes will be included in the automated 2-day rehearsal and 1-day service reminders.</span>
                        </p>
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="p-4 border-t border-themed bg-secondary/50 flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="min-h-[48px] py-2.5 px-5 rounded-2xl bg-secondary border border-themed text-textmuted hover:text-textprimary font-bold text-xs sm:text-sm transition"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={handleSave}
                        className="min-h-[48px] py-2.5 px-6 rounded-2xl bg-accent text-onaccent font-bold text-xs sm:text-sm shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? (
                            <span>Scheduling...</span>
                        ) : (
                            <>
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>{schedule ? 'Save Changes' : 'Publish & Notify Ministers'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
