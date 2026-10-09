import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSongCache } from '../context/SongCacheContext';
import { setlistDB } from '../db/dexie';
import { pushSetlistToSupabase } from '../supabase/sync';
import { KEYS, getKeyIndex } from '../utils/chords';
import { haptic } from '../utils/haptics';
import { SetlistDateBadge } from '../screens/SetlistScreen';
import { Lock, Shield, X, Plus } from '@phosphor-icons/react';

export default function QuickAddToSetlistModal({ song, upcomingSetlists: propSetlists, user: propUser, onClose, onCreateSetlist }) {
    const navigate = useNavigate();
    const { user: authUser, profile, canManageSetlists, isSuperuser, isAdmin } = useAuth();
    const { setlists: cacheSetlists } = useSongCache();
    const currentUser = propUser || authUser;

    const [selectedKey, setSelectedKey] = useState(song?.originalKey || song?.currentKey || 'C');

    const transposeKey = (dir) => {
        haptic('light');
        const idx = getKeyIndex(selectedKey);
        let next = (idx + dir) % 12;
        if (next < 0) next += 12;
        setSelectedKey(KEYS[next]);
    };

    const handleAdd = async (setlist) => {
        haptic('light');
        if (!currentUser) {
            navigate('/login');
            return;
        }
        if (!canManageSetlists) {
            return;
        }
        const songIds = setlist.songIds || [];
        if (!songIds.includes(song.id)) {
            const updatedIds = [...songIds, song.id];
            const updatedKeys = { ...(setlist.songKeys || {}), [song.id]: selectedKey };
            await setlistDB.update(setlist.id, { songIds: updatedIds, songKeys: updatedKeys });
            await pushSetlistToSupabase({ ...setlist, songIds: updatedIds, songKeys: updatedKeys }, currentUser);
        }
        onClose();
    };

    // Unauthenticated state
    if (!currentUser) {
        return (
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                onClick={onClose}
            >
                <div 
                    className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-md shadow-2xl animate-slideUp p-6 sm:p-8 text-center space-y-4"
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
                            className="flex-1 py-2.5 text-xs font-bold border border-themed rounded-xl text-textmuted"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                onClose();
                                navigate('/login');
                            }}
                            className="flex-1 py-2.5 text-xs font-bold bg-accent text-onaccent rounded-xl shadow-md active:scale-95 transition"
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
        return (
            <div 
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
                onClick={onClose}
            >
                <div 
                    className="bg-elevated rounded-t-[32px] sm:rounded-3xl border-t sm:border border-themed w-full sm:max-w-md shadow-2xl animate-slideUp p-6 sm:p-8 text-center space-y-4"
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
                        className="w-full py-2.5 text-xs font-bold bg-secondary border border-themed rounded-xl text-textprimary hover:bg-surface-hover transition"
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
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-textprimary">Add to Setlist</h3>
                        <p className="text-xs text-accent font-semibold truncate">{song?.title}</p>
                    </div>
                    <button onClick={onClose} className="p-1 text-textmuted hover:text-textprimary rounded-xl" aria-label="Close">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Key Selector */}
                <div className="px-6 py-3 border-b border-themed flex items-center justify-between shrink-0 bg-secondary/20">
                    <span className="text-xs font-bold text-textmuted uppercase tracking-wider">Arrange Key</span>
                    <div className="flex items-center gap-1.5 bg-secondary rounded-2xl px-2 py-1 border border-themed">
                        <button
                            type="button"
                            onClick={() => transposeKey(-1)}
                            className="w-7 h-7 rounded-xl bg-surface-hover active:bg-accent/20 text-sm font-bold text-textprimary flex items-center justify-center"
                            aria-label="Lower key"
                        >−</button>
                        <span className="px-2.5 h-7 flex items-center justify-center text-xs font-bold font-mono text-accent min-w-[28px]">
                            {selectedKey}
                        </span>
                        <button
                            type="button"
                            onClick={() => transposeKey(1)}
                            className="w-7 h-7 rounded-xl bg-surface-hover active:bg-accent/20 text-sm font-bold text-textprimary flex items-center justify-center"
                            aria-label="Raise key"
                        >+</button>
                    </div>
                </div>

                <div className="p-4 space-y-2 overflow-y-auto flex-1 overscroll-contain">
                    {tenantSetlists.length === 0 ? (
                        <div className="text-center py-6 space-y-3">
                            <p className="text-textmuted text-xs">No upcoming setlists available</p>
                            {canManageSetlists && onCreateSetlist && (
                                <button
                                    onClick={onCreateSetlist}
                                    className="px-4 py-2.5 bg-accent text-onaccent rounded-2xl text-xs font-bold active:scale-95 transition"
                                >
                                    Create New Setlist
                                </button>
                            )}
                        </div>
                    ) : (
                        tenantSetlists.map(setlist => {
                            const isOwner = !setlist.userId || (currentUser && String(setlist.userId) === String(currentUser.id)) || isSuperuser || isAdmin;

                            return (
                                <button
                                    key={setlist.id}
                                    onClick={() => isOwner && handleAdd(setlist)}
                                    disabled={!isOwner}
                                    className={`w-full p-3 rounded-2xl border flex items-center justify-between text-left transition-all gap-3 ${
                                        isOwner
                                            ? 'bg-secondary border-themed hover:border-accent active:scale-98 cursor-pointer'
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
                                        <Plus className="w-4 h-4 text-accent shrink-0" />
                                    ) : (
                                        <Lock className="w-3.5 h-3.5 text-textmuted shrink-0" />
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
