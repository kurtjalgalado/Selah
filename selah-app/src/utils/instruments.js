import React from 'react';
import {
    MicrophoneStage as Mic,
    Guitar,
    SpeakerHigh as Volume2,
    PianoKeys as Piano,
    Waveform as Drum,
    Users,
    MusicNotes as Music,
    Microphone as Mic2,
    Headphones,
    Sliders,
    Desktop as Monitor,
    Radio,
    Sparkle as Sparkles,
    Pulse as Activity,
    Wind,
    UserCheck,
    Disc
} from '@phosphor-icons/react';

export const DEFAULT_WORSHIP_ROLES = [
    { id: 'role-wl', roleName: 'Worship Leader', icon: 'Mic', color: 'emerald' },
    { id: 'role-backup', roleName: 'Backup Singers', icon: 'Users', color: 'purple' },
    { id: 'role-keys', roleName: 'Keyboard', icon: 'Piano', color: 'cyan' },
    { id: 'role-bass', roleName: 'Bass Guitar', icon: 'Volume2', color: 'indigo' },
    { id: 'role-ac-gtr', roleName: 'Acoustic Guitar', icon: 'Music', color: 'amber' },
    { id: 'role-el-gtr', roleName: 'Electric Guitar', icon: 'Guitar', color: 'orange' },
    { id: 'role-drums', roleName: 'Drums', icon: 'Drum', color: 'rose' },
];

export const AVAILABLE_INSTRUMENT_ICONS = [
    { name: 'Mic', label: 'Vocals / Mic', icon: Mic },
    { name: 'Guitar', label: 'Guitar', icon: Guitar },
    { name: 'Piano', label: 'Keys / Piano', icon: Piano },
    { name: 'Drum', label: 'Drums', icon: Drum },
    { name: 'Volume2', label: 'Bass / Amp', icon: Volume2 },
    { name: 'Users', label: 'Choir / Singers', icon: Users },
    { name: 'Mic2', label: 'Vocal Duo', icon: Mic2 },
    { name: 'Music', label: 'Acoustic', icon: Music },
    { name: 'Headphones', label: 'Audio / Sound', icon: Headphones },
    { name: 'Sliders', label: 'Sound Engineer', icon: Sliders },
    { name: 'Monitor', label: 'Multimedia / Slides', icon: Monitor },
    { name: 'Wind', label: 'Wind / Brass', icon: Wind },
    { name: 'Activity', label: 'Strings / Violin', icon: Activity },
    { name: 'Radio', label: 'Broadcast / Stream', icon: Radio },
    { name: 'UserCheck', label: 'Service Lead', icon: UserCheck },
    { name: 'Sparkles', label: 'Special Ministry', icon: Sparkles },
];

const ICON_MAP = {
    Mic,
    Guitar,
    Volume2,
    Piano,
    Drum,
    Users,
    Music,
    Mic2,
    Headphones,
    Sliders,
    Monitor,
    Radio,
    Activity,
    Wind,
    UserCheck,
    Disc,
    Sparkles,
};

/**
 * Render instrument icon dynamically using React.createElement
 */
export function InstrumentIcon({ name, className = 'w-4 h-4', strokeWidth = 2 }) {
    const IconComponent = ICON_MAP[name] || Music;
    return React.createElement(IconComponent, { className, strokeWidth });
}

/**
 * Get role icon name by role title
 */
export function getRoleIconName(roleName = '') {
    const lower = roleName.toLowerCase();
    if (lower.includes('lead') || lower.includes('worship leader')) return 'Mic';
    if (lower.includes('acoustic')) return 'Music';
    if (lower.includes('electric')) return 'Guitar';
    if (lower.includes('bass')) return 'Volume2';
    if (lower.includes('guitar')) return 'Guitar';
    if (lower.includes('key') || lower.includes('piano') || lower.includes('synth')) return 'Piano';
    if (lower.includes('drum') || lower.includes('cajon') || lower.includes('percussion')) return 'Drum';
    if (lower.includes('sing') || lower.includes('back') || lower.includes('vocal') || lower.includes('choir')) return 'Users';
    if (lower.includes('sound') || lower.includes('audio') || lower.includes('tech')) return 'Sliders';
    if (lower.includes('media') || lower.includes('visual') || lower.includes('ppt') || lower.includes('slide')) return 'Monitor';
    if (lower.includes('violin') || lower.includes('string') || lower.includes('cell')) return 'Activity';
    if (lower.includes('sax') || lower.includes('flute') || lower.includes('horn')) return 'Wind';
    return 'Music';
}
