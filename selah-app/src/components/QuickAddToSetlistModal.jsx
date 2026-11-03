import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { setlistDB } from '../db/dexie';
import { pushSetlistToSupabase } from '../supabase/sync';
import { KEYS, getKeyIndex } from '../utils/chords';
import { haptic } from '../utils/haptics';
import { SetlistDateBadge } from '../screens/SetlistScreen';
import { Lock, Shield, X, Plus, Check } from '@phosphor-icons/react';

export default function QuickAddToSetlistModal({ song, upcomingSetlists: propSetlists, user: propUser, onClose, onCreateSetlist }) {
    const navigate = useNavigate();
    const { user: authUser, profile, canManageSetlists, isSuperuser, isAdmin } = useAuth();
    const { setlists: cacheSetlists } = useSongCache();
    const currentUser = propUser || authUser;

    const [selectedKey, setSelectedKey] = useState(song?.originalKey || song?.currentKey || 'C');

    const transposeKey = (dir) => {
        haptic('light');
        const keyStr = String(selectedKey || 'C').trim();
        const isMinor = keyStr.endsWith('m') && !keyStr.endsWith('dim');
        const idx = getKeyIndex(keyStr);
        const baseIdx = idx === -1 ? 0 : idx;
        const next = (baseIdx + dir + 12) % 12;
        setSelectedKey(KEYS[next] + (isMinor ? 'm' : ''));
    };

    const handleAdd = async (setlist) => {
        haptic('success');
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (!canManageSetlists) {
            return;
        }
        const songIds = setlist.songIds || [];
        const alreadyExists = songIds.some(id => String(id) === String(song.id));
        const updatedIds = alreadyExists ? songIds : [...songIds, song.id];
        const updatedKeys = { ...(setlist.songKeys || {}), [song.id]: selectedKey };
        await setlistDB.update(setlist.id, { songIds: updatedIds, songKeys: updatedKeys });
        await pushSetlistToSupabase({ ...setlist, songIds: updatedIds, songKeys: updatedKeys }, currentUser);
        onClose();
    };

    const wrapPortal = (node) => (typeof document !== 'undefined' ? createPortal(node, document.body) : node);

    // Unauthenticated state
    if (!currentUser) {
        return wrapPortal(
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                onClick={onClose}
            >
                <div 
                    className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-md shadow-2xl animate-sheetSpring p-6 sm:p-8 text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-12 h-12 rounded-2xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto">
                        <Lock className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-textprimary">Sign In Required</h3>
                        <p className="text-xs text-textmuted max-w-xs mx-auto leading-relaxed">
                            Sign in to add songs to setlists.
                        </p>
                    </div>
                    <div className="flex gap-2.5 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 min-h-[44px] py-2.5 text-xs font-bold border border-themed rounded-xl text-textmuted btn-interact"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onClose();
                                navigate('/login');
                            }}
                            className="flex-1 min-h-[44px] py-2.5 text-xs font-bold bg-accent text-onaccent rounded-xl shadow-md btn-primary-interact"
                        >
                            Sign In
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // RBAC Role Check: Read-only member guard
    if (!canManageSetlists) {
        return wrapPortal(
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                onClick={onClose}
            >
                <div 
                    className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-md shadow-2xl animate-sheetSpring p-6 sm:p-8 text-center space-y-4"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center mx-auto">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div className="space-y-1.5">
                        <h3 className="text-base font-bold text-textprimary">Permission Required</h3>
                        <p className="text-xs text-textmuted max-w-xs mx-auto leading-relaxed">
                            Only worship leaders and admins can edit setlists.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full min-h-[44px] py-2.5 text-xs font-bold bg-secondary border border-themed rounded-xl text-textprimary hover:bg-surface-hover btn-interact"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    // Filter setlists by active church tenancy
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const userChurchId = profile?.church_id || currentUser?.user_metadata?.church_id || 'JFCM-Mercedes';

    const baseList = propSetlists || cacheSetlists || [];
    const sourceSetlists = baseList
        .filter(s => s && (!s.date || s.date >= todayStr))
        .sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date.localeCompare(b.date);
        });
    const tenantSetlists = sourceSetlists.filter(s => {
        if (!s.churchId || s.churchId.toLowerCase() === userChurchId.toLowerCase() || userChurchId === 'JFCM-Mercedes') {
            return true;
        }
        return false;
    });

    return wrapPortal(
        <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-xl shadow-2xl animate-sheetSpring max-h-[88vh] sm:max-h-[90vh] flex flex-col pb-[max(1.2rem,env(safe-area-inset-bottom))] sm:pb-0 overflow-hidden relative"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-accent/55 to-transparent shrink-0" />
                <div className="w-11 h-1.5 bg-textmuted/30 rounded-full mx-auto mt-3 mb-1 sm:hidden shrink-0" />
                
                <div className="flex justify-between items-center px-5 py-3.5 border-b border-themed shrink-0 bg-secondary/40">
                    <div className="min-w-0 pr-3">
                        <h3 className="text-base font-bold text-textprimary">Add to Setlist</h3>
                        <p className="text-xs text-accent font-semibold truncate">{song?.title}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-secondary border border-themed text-textmuted hover:text-textprimary flex items-center justify-center btn-icon-action shrink-0"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Key Selector */}
                <div className="px-5 py-3 border-b border-themed flex items-center justify-between shrink-0 bg-secondary/20">
                    <div>
                        <span className="text-xs font-bold text-textmuted uppercase tracking-wider block">Arrange Key</span>
                        <span className="text-[11px] text-textmuted">Saved specifically for this lineup</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-secondary rounded-2xl p-1 border border-themed">
                        <button
                            type="button"
                            onClick={() => transposeKey(-1)}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-elevated hover:bg-surface-hover active:bg-accent/20 font-mono text-sm font-bold text-textprimary flex items-center justify-center btn-icon-action"
                            aria-label="Lower key"
                        >−</button>
                        <span key={selectedKey} className="px-3 h-10 flex items-center justify-center text-sm font-bold font-mono text-accent min-w-[40px] animate-badgePop">
                            {selectedKey}
                        </span>
                        <button
                            type="button"
                            onClick={() => transposeKey(1)}
                            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-xl bg-elevated hover:bg-surface-hover active:bg-accent/20 font-mono text-sm font-bold text-textprimary flex items-center justify-center btn-icon-action"
                            aria-label="Raise key"
                        >+</button>
                    </div>
                </div>

                <div className="p-4 space-y-2 overflow-y-auto flex-1 overscroll-contain">
                    {tenantSetlists.length === 0 ? (
                        <div className="text-center py-8 space-y-3">
                            <p className="text-textmuted text-xs">No upcoming setlists available</p>
                            {canManageSetlists && onCreateSetlist && (
                                <button
                                    onClick={onCreateSetlist}
                                    className="px-5 py-2.5 min-h-[44px] bg-accent text-onaccent rounded-2xl text-xs font-bold btn-primary-interact"
                                >
                                    Create New Setlist
                                </button>
                            )}
                        </div>
                    ) : (
                        tenantSetlists.map((setlist, idx) => {
                            const isOwner = !setlist.userId || (currentUser && String(setlist.userId) === String(currentUser.id)) || isSuperuser || isAdmin;
                            const isAlreadyIn = (setlist.songIds || []).some(id => String(id) === String(song?.id));

                            return (
                                <button
                                    key={setlist.id}
                                    onClick={() => isOwner && handleAdd(setlist)}
                                    disabled={!isOwner}
                                    style={{ '--stagger-idx': idx }}
                                    className={`animate-list-item w-full p-3.5 rounded-2xl border flex items-center justify-between text-left transition-all gap-3 min-h-[60px] ${
                                        isOwner
                                            ? isAlreadyIn
                                                ? 'bg-accent/12 border-accent/45 hover:border-accent btn-interact cursor-pointer'
                                                : 'bg-secondary border-themed hover:border-accent btn-interact cursor-pointer'
                                            : 'bg-secondary/40 border-themed opacity-60 cursor-not-allowed'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <SetlistDateBadge date={setlist.date} size="sm" />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-textprimary text-sm leading-tight truncate">{setlist.title}</p>
                                                {!isOwner && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] bg-secondary text-textmuted border border-themed font-medium shrink-0 flex items-center gap-0.5">
                                                        <Lock className="w-2.5 h-2.5" /> Read Only
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-textmuted mt-0.5">{setlist.date || 'Undated'} • {setlist.songIds?.length || 0} songs</p>
                                        </div>
                                    </div>
                                    {isOwner ? (
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isAlreadyIn ? 'bg-accent text-onaccent' : 'bg-elevated border border-themed text-accent'}`}>
                                            {isAlreadyIn ? <Check className="w-4 h-4" weight="bold" /> : <Plus className="w-4 h-4" weight="bold" />}
                                        </div>
                                    ) : (
                                        <Lock className="w-4 h-4 text-textmuted shrink-0" />
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
