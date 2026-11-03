import React, { useState, useEffect } from 'react';
import { X, Check, DiceFive as Dices, User, CheckCircle as CheckCircle2 } from '@phosphor-icons/react';
import { AVATAR_PRESETS, getRandomAvatarSeed, getAvatarData } from '../utils/avatar';
import UserAvatar from './UserAvatar';
import { haptic } from '../utils/haptics';

export default function AvatarChooserModal({
    isOpen,
    onClose,
    currentSeed,
    onSave,
    isSaving = false
}) {
    const [selectedSeed, setSelectedSeed] = useState(currentSeed || 'Felix');
    const [customSeedInput, setCustomSeedInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            setSelectedSeed(currentSeed || 'Felix');
            setCustomSeedInput('');
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = prev;
            };
        }
    }, [isOpen, currentSeed]);

    if (!isOpen) return null;

    const handleSelectPreset = (seed) => {
        haptic('light');
        setSelectedSeed(seed);
    };

    const handleRandomRoll = () => {
        haptic('medium');
        const newSeed = getRandomAvatarSeed();
        setSelectedSeed(newSeed);
        setCustomSeedInput(newSeed);
    };

    const handleCustomChange = (e) => {
        const val = e.target.value;
        setCustomSeedInput(val);
        if (val.trim()) {
            setSelectedSeed(val.trim());
        }
    };

    const handleSave = async () => {
        haptic('success');
        await onSave(selectedSeed.trim() || 'Felix');
        onClose();
    };

    const activeAvatarData = getAvatarData(selectedSeed);

    return (
        <div 
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="w-full max-w-lg bg-elevated border border-themed rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-slideUp text-textprimary"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-themed flex items-center justify-between shrink-0 bg-elevated">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                            <User className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-textprimary leading-tight">Choose Avatar</h3>
                            <p className="text-[11px] text-textmuted">Select profile avatar</p>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            haptic('light');
                            onClose();
                        }}
                        className="p-2 rounded-full text-textmuted hover:text-textprimary hover:bg-secondary transition-colors"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content Body */}
                <div className="p-5 overflow-y-auto space-y-5 flex-1 overscroll-contain bg-elevated">
                    {/* Live Animated Preview */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-secondary border border-themed relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                        <div className="relative z-10 flex flex-col items-center space-y-2.5">
                            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-300 p-1 shadow-xl shadow-emerald-500/20">
                                <UserAvatar
                                    seed={selectedSeed}
                                    size="2xl"
                                    animated={true}
                                    className="w-full h-full"
                                    fallbackInitial={selectedSeed.charAt(0)}
                                />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-textprimary tracking-wide flex items-center justify-center gap-1.5">
                                    <span>{activeAvatarData?.label || selectedSeed}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold uppercase tracking-wider border border-emerald-500/30">
                                        Selected
                                    </span>
                                </p>
                                <p className="text-xs text-textmuted">Offline Vector Avatar</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Randomizer & Custom Seed Bar */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={customSeedInput}
                                onChange={handleCustomChange}
                                placeholder="Type custom name (e.g. Grace)..."
                                className="w-full px-3.5 py-2.5 bg-secondary border border-themed rounded-xl text-sm text-textprimary placeholder:text-textmuted focus:outline-none focus:border-accent"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleRandomRoll}
                            className="px-3.5 py-2.5 bg-secondary border-0 hover:bg-secondary/80 active:scale-95 transition-all text-accent rounded-xl text-sm font-semibold flex items-center gap-1.5 shrink-0"
                            title="Generate Random Avatar"
                        >
                            <Dices className="w-4 h-4" />
                            <span>Surprise Me</span>
                        </button>
                    </div>

                    {/* Presets Grid */}
                    <div className="space-y-2.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-textmuted">
                            Avatar Collection ({AVATAR_PRESETS.length})
                        </p>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 py-1">
                            {AVATAR_PRESETS.map((p) => {
                                const isSelected = selectedSeed.toLowerCase() === p.seed.toLowerCase();
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => handleSelectPreset(p.seed)}
                                        className="group flex flex-col items-center gap-1.5 focus:outline-none transition-transform"
                                        title={p.label}
                                    >
                                        <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full aspect-square transition-all duration-200 p-0.5 flex items-center justify-center ${
                                            isSelected
                                                ? 'ring-2 sm:ring-[3px] ring-accent ring-offset-2 ring-offset-elevated scale-105 shadow-lg shadow-accent/20'
                                                : 'ring-1 ring-themed hover:ring-accent/50 hover:scale-105 active:scale-95 bg-primary/40'
                                        }`}>
                                            <div className="w-full h-full rounded-full overflow-hidden bg-primary flex items-center justify-center">
                                                <img
                                                    src={p.file}
                                                    alt={p.label}
                                                    width="64"
                                                    height="64"
                                                    loading="lazy"
                                                    className="w-full h-full object-cover rounded-full select-none pointer-events-none group-hover:scale-110 transition-transform duration-300"
                                                />
                                            </div>
                                            {isSelected && (
                                                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-onaccent flex items-center justify-center shadow-md border-2 border-elevated animate-fadeIn">
                                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                                </div>
                                            )}
                                        </div>
                                        <span className={`text-[11px] font-semibold truncate max-w-full leading-none transition-colors ${
                                            isSelected ? 'text-accent font-bold' : 'text-textmuted group-hover:text-textprimary'
                                        }`}>
                                            {p.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-themed bg-elevated flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 bg-secondary border-0 text-textprimary hover:bg-secondary/80 font-semibold text-sm rounded-xl active:scale-98 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={isSaving}
                        onClick={handleSave}
                        className="flex-1 py-3 bg-accent text-onaccent font-bold text-sm rounded-xl shadow-lg shadow-accent/25 hover:bg-accent/90 active:scale-98 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <span>Saving...</span>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>Save Avatar</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
