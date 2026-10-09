import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { ROLES, getRoleLabel, getRoleBadgeStyle, SUPERUSER_EMAIL } from '../utils/rbac';
import { haptic } from '../utils/haptics';
import UserAvatar from './UserAvatar';
import { 
    X, Shield, CheckCircle as CheckCircle2, WarningCircle as AlertCircle, 
    Crown, Users, ArrowClockwise as RefreshCw, CaretDown as ChevronDown 
} from '@phosphor-icons/react';

export default function ManageTeamModal({ isOpen, onClose }) {
    const { user, profile, fetchChurchMembers, updateMemberRole, canManageRoles } = useAuth();
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updatingId, setUpdatingId] = useState(null);
    const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

    const loadMembers = async () => {
        setLoading(true);
        try {
            const list = await fetchChurchMembers();
            setMembers(list);
        } catch (err) {
            console.error('Failed to load church members:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadMembers();
            setStatusMsg({ type: '', text: '' });
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleRoleChange = async (memberId, memberEmail, newRole) => {
        if (!canManageRoles) {
            setStatusMsg({ type: 'error', text: 'Permission denied: Superuser only.' });
            return;
        }

        // Guard: owner kurt.jalgalado@gmail.com stays superuser
        if (memberEmail?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase() && newRole !== ROLES.SUPERUSER) {
            setStatusMsg({ type: 'error', text: 'Primary account cannot be demoted.' });
            return;
        }

        haptic('medium');
        setUpdatingId(memberId);
        setStatusMsg({ type: '', text: '' });

        try {
            await updateMemberRole(memberId, newRole);
            setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
            setStatusMsg({ type: 'success', text: `Updated ${memberEmail}'s role to ${getRoleLabel(newRole)}!` });
            haptic('success');
            setTimeout(() => setStatusMsg({ type: '', text: '' }), 3000);
        } catch (err) {
            console.error('Role update failed:', err);
            setStatusMsg({ type: 'error', text: err?.message || 'Failed to update role.' });
            haptic('error');
        } finally {
            setUpdatingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="bg-elevated border border-themed rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-themed flex items-center justify-between bg-secondary/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                            <Shield className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-textprimary flex items-center gap-1.5">
                                <span>Church Team & RBAC Roles</span>
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                            </h2>
                            <p className="text-[11px] text-textmuted">
                                Superuser control panel for worship roles & permissions
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-secondary border border-themed text-textmuted hover:text-textprimary flex items-center justify-center active:scale-95 transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Status alert */}
                {statusMsg.text && (
                    <div className={`p-3 mx-4 mt-3 rounded-2xl border text-xs font-medium flex items-center gap-2 animate-fadeIn ${
                        statusMsg.type === 'error'
                            ? 'bg-danger/10 border-danger/30 text-danger'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    }`}>
                        {statusMsg.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                        <span>{statusMsg.text}</span>
                    </div>
                )}

                {/* Member List */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
                    {loading ? (
                        <div className="py-12 text-center text-textmuted flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                            <p className="text-xs">Loading church members...</p>
                        </div>
                    ) : members.length === 0 ? (
                        <div className="py-12 text-center text-textmuted space-y-2">
                            <Users className="w-8 h-8 mx-auto text-textmuted/50" />
                            <p className="text-xs">No registered members found in this church tenancy.</p>
                        </div>
                    ) : (
                        members.map((member) => {
                            const isSuper = member.role === ROLES.SUPERUSER || member.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase();
                            const currentRole = isSuper ? ROLES.SUPERUSER : (member.role || ROLES.WORSHIP_TEAM_MEMBER);
                            const isCurrentUpdating = updatingId === member.id;

                            return (
                                <div
                                    key={member.id}
                                    className="p-3.5 rounded-2xl bg-secondary/80 border border-themed space-y-2.5 transition"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-secondary border border-themed flex items-center justify-center shrink-0 overflow-hidden">
                                                <UserAvatar
                                                    seed={member.avatar_seed || member.username || 'Felix'}
                                                    size="sm"
                                                    animated={false}
                                                    fallbackInitial={member.username?.charAt(0) || member.email?.charAt(0) || '?'}
                                                    className="w-full h-full"
                                                />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-textprimary flex items-center gap-1.5">
                                                    <span>{member.username || member.email?.split('@')[0]}</span>
                                                    {isSuper && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                                                </p>
                                                <p className="text-[10px] text-textmuted">{member.email}</p>
                                            </div>
                                        </div>

                                        {/* Current Role Badge */}
                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getRoleBadgeStyle(currentRole)}`}>
                                            {getRoleLabel(currentRole)}
                                        </span>
                                    </div>

                                    {/* Role Selector */}
                                    <div className="pt-1 flex items-center gap-2">
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-textmuted shrink-0">
                                            Assign Role:
                                        </label>
                                        <div className="relative flex-1">
                                            <select
                                                value={currentRole}
                                                disabled={isCurrentUpdating || (member.email?.toLowerCase() === SUPERUSER_EMAIL.toLowerCase())}
                                                onChange={(e) => handleRoleChange(member.id, member.email, e.target.value)}
                                                className="w-full bg-elevated border border-themed rounded-xl px-3 py-1.5 text-xs text-textprimary focus:outline-none focus:border-accent appearance-none pr-8 disabled:opacity-50 font-medium"
                                            >
                                                <option value={ROLES.SUPERUSER}>Superuser (Full Admin & Role Elevation)</option>
                                                <option value={ROLES.ADMIN}>Admin (Schedule Ministers & Lineups)</option>
                                                <option value={ROLES.WORSHIP_LEADER}>Worship Leader (Manage Setlists)</option>
                                                <option value={ROLES.WORSHIP_TEAM_MEMBER}>Worship Team Member (Read-Only)</option>
                                            </select>
                                            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-textmuted pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-themed bg-secondary/60 flex items-center justify-between">
                    <span className="text-[10px] text-textmuted">
                        Total {members.length} church account{members.length === 1 ? '' : 's'}
                    </span>
                    <button
                        onClick={onClose}
                        className="py-2 px-4 rounded-xl bg-accent text-onaccent font-bold text-xs hover:bg-accent/90 transition shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}
