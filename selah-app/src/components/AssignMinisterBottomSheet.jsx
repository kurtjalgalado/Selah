import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../auth/AuthContext';
import { scheduleDB } from '../db/dexie';
import { pushScheduleToSupabase } from '../supabase/sync';
import { InstrumentIcon } from '../utils/instruments';
import { useBackHandler } from '../utils/backHandler';
import { haptic } from '../utils/haptics';
import UserAvatar from './UserAvatar';
import { X, MagnifyingGlass as Search, Check, UserMinus as UserX, Crown } from '@phosphor-icons/react';

export default function AssignMinisterBottomSheet({ 
    schedule, 
    assignment, 
    onClose, 
    onUpdate 
}) {
    const { user, churchMembers: cachedMembers, fetchChurchMembers, isSuperuser } = useAuth();
    const [members, setMembers] = useState(cachedMembers || []);
    const [search, setSearch] = useState('');
    const [saving, setSaving] = useState(false);

    useBackHandler(true, onClose);

    useEffect(() => {
        let mounted = true;
        fetchChurchMembers().then(list => {
            if (mounted && list) {
                setMembers(list);
            }
        });
        return () => { mounted = false; };
    }, [fetchChurchMembers]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const filteredMembers = useMemo(() => {
        const q = (search || '').toLowerCase().trim();
        if (!q) return members;
        return members.filter(m => {
            const name = (m.username || m.email?.split('@')[0] || '').toLowerCase();
            const email = (m.email || '').toLowerCase();
            return name.includes(q) || email.includes(q);
        });
    }, [members, search]);

    const handleSelectMember = async (selectedMember) => {
        if (saving || !schedule || !assignment) return;
        setSaving(true);
        haptic('light');

        try {
            const updatedAssignments = (schedule.assignments || []).map(a => {
                if (a.id === assignment.id) {
                    if (selectedMember) {
                        return {
                            ...a,
                            user_id: selectedMember.id,
                            user_name: selectedMember.username || selectedMember.email?.split('@')[0] || '',
                            user_avatar: selectedMember.avatar_seed || selectedMember.username || '',
                            user_email: selectedMember.email || '',
                            status: 'assigned'
                        };
                    } else {
                        // Unassign
                        return {
                            ...a,
                            user_id: null,
                            user_name: '',
                            user_avatar: '',
                            user_email: '',
                            status: 'assigned'
                        };
                    }
                }
                return a;
            });

            const updatedSchedule = {
                ...schedule,
                assignments: updatedAssignments,
                updatedAt: new Date().toISOString()
            };

            await scheduleDB.update(schedule.id, { assignments: updatedAssignments });
            if (user) {
                await pushScheduleToSupabase(updatedSchedule, user);
            }

            haptic('success');
            if (onUpdate) onUpdate(updatedSchedule);
            onClose();
        } catch (err) {
            console.error('Failed to assign minister:', err);
        } finally {
            setSaving(false);
        }
    };

    if (!schedule || !assignment) return null;

    const currentUserId = assignment.user_id;

    const sheetContent = (
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99998] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-md shadow-2xl animate-slideUp max-h-[85vh] flex flex-col pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden z-[99999]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Grab handle pill */}
                <div className="w-12 h-1.5 bg-textmuted/30 rounded-full mx-auto my-3 shrink-0 sm:hidden" />

                {/* Header */}
                <div className="px-5 py-3.5 border-b border-themed flex items-center justify-between bg-secondary/40 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center shrink-0">
                            <InstrumentIcon name={assignment.icon} className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-bold text-textprimary truncate">
                                Assign {assignment.role_name}
                            </h3>
                            <p className="text-xs text-textmuted truncate">
                                {schedule.serviceTitle}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-textmuted hover:text-textprimary hover:bg-surface-hover active:scale-95 transition"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search Input */}
                <div className="p-3.5 border-b border-themed shrink-0">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-textmuted" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search team member..."
                            className="w-full bg-secondary border border-themed rounded-xl pl-9 pr-4 py-2.5 min-h-[44px] text-xs text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Member List */}
                <div className="overflow-y-auto p-3 space-y-1.5 flex-1 overscroll-contain">
                    {/* Unassign option if currently assigned */}
                    {currentUserId && (
                        <button
                            type="button"
                            onClick={() => handleSelectMember(null)}
                            disabled={saving}
                            className="w-full p-3 rounded-2xl border border-dashed border-themed hover:border-danger/40 bg-secondary/30 hover:bg-danger/10 text-textmuted hover:text-danger flex items-center gap-3 transition active:scale-[0.99] text-left"
                        >
                            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                <UserX className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold leading-tight">Leave Unassigned</p>
                                <p className="text-[11px] text-textmuted mt-0.5">Remove current minister from this role</p>
                            </div>
                        </button>
                    )}

                    {filteredMembers.length === 0 ? (
                        <p className="text-center text-textmuted text-xs py-8 italic">
                            No team members found
                        </p>
                    ) : (
                        filteredMembers.map(member => {
                            const isSelected = String(member.id) === String(currentUserId);
                            const memberName = member.username || member.email?.split('@')[0] || 'Member';

                            return (
                                <button
                                    key={member.id}
                                    type="button"
                                    onClick={() => handleSelectMember(member)}
                                    disabled={saving}
                                    className={`w-full p-3 rounded-2xl border flex items-center justify-between gap-3 transition min-h-[52px] text-left active:scale-[0.99] ${
                                        isSelected
                                            ? 'bg-accent/15 border-accent text-textprimary shadow-sm'
                                            : 'bg-secondary/70 hover:bg-secondary border-themed'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="w-9 h-9 rounded-full bg-secondary border border-themed overflow-hidden shrink-0">
                                            <UserAvatar
                                                seed={member.avatar_seed || memberName}
                                                size="sm"
                                                animated={false}
                                                fallbackInitial={memberName.charAt(0)}
                                                className="w-full h-full"
                                            />
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className="text-xs font-bold text-textprimary truncate">
                                                {memberName}
                                            </p>
                                            <p className="text-[11px] text-textmuted truncate mt-0.5">
                                                {member.email || 'Team member'}
                                            </p>
                                        </div>
                                    </div>

                                    {isSelected && (
                                        <div className="w-6 h-6 rounded-full bg-accent text-onaccent flex items-center justify-center shrink-0">
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(sheetContent, document.body);
}
