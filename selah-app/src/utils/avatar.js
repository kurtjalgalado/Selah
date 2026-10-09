// Lightweight avatar catalog. Renders via <img src> from /avatars/*.svg
// bundled in `public/avatars/`. No dangerouslySetInnerHTML, no inline SVG.

const AVATAR_FILES = [
    'basil', 'clover', 'coco', 'daisy', 'david', 'ethan', 'felix',
    'grace', 'hannah', 'hope', 'jasper', 'joy', 'milo', 'mocha',
    'noah', 'oliver', 'peanut', 'pip', 'sage', 'sarah', 'sunny',
    'willow', 'zion', 'zoe',
];

function idFor(seed) {
    const s = String(seed || '').toLowerCase().trim();
    if (!s) return 'felix';
    if (AVATAR_FILES.includes(s)) return s;
    // Deterministic pick for unknown custom seeds
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
    }
    return AVATAR_FILES[Math.abs(hash) % AVATAR_FILES.length];
}

export const AVATAR_PRESETS = AVATAR_FILES.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    seed: id.charAt(0).toUpperCase() + id.slice(1),
    file: `/avatars/${id}.svg`,
}));
export const SPROUTS_PRESETS = AVATAR_PRESETS;
export const AVATAR_LIST = AVATAR_PRESETS;

export function getLocalAvatar(seedOrId) {
    const id = idFor(seedOrId);
    return {
        id,
        label: id.charAt(0).toUpperCase() + id.slice(1),
        seed: id.charAt(0).toUpperCase() + id.slice(1),
        file: `/avatars/${id}.svg`,
    };
}

export function getAvatarData(seedOrId) {
    return getLocalAvatar(seedOrId);
}

export function getRandomAvatarSeed() {
    return AVATAR_PRESETS[Math.floor(Math.random() * AVATAR_PRESETS.length)].seed;
}

export function getRandomSproutsSeed() {
    return getRandomAvatarSeed();
}
