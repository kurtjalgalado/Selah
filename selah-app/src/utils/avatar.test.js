import { describe, it, expect } from 'vitest';
import {
    AVATAR_PRESETS,
    AVATAR_LIST,
    getAvatarData,
    getLocalAvatar,
    getRandomAvatarSeed,
    idFor,
} from './avatar.js';

describe('avatar catalog', () => {
    it('AVATAR_PRESETS matches AVATAR_LIST (both exports same data)', () => {
        expect(AVATAR_PRESETS).toBe(AVATAR_LIST);
    });

    it('every preset points to a real bundled SVG path', () => {
        for (const p of AVATAR_PRESETS) {
            expect(p.file).toMatch(/^\/avatars\/[a-z]+\.svg$/);
        }
    });

    it('getAvatarData / getLocalAvatar resolve known seeds', () => {
        const felix = getAvatarData('Felix');
        expect(felix.id).toBe('felix');
        expect(felix.file).toBe('/avatars/felix.svg');
    });

    it('getAvatarData picks deterministically for unknown custom seeds', () => {
        const a = getAvatarData('Zorblax');
        const b = getAvatarData('zorblax');
        const c = getAvatarData('ZORBLAX');
        expect(a.id).toBe(b.id);
        expect(b.id).toBe(c.id);
        expect(AVATAR_PRESETS.some(p => p.id === a.id)).toBe(true);
    });

    it('falls back to felix on empty seed', () => {
        expect(getAvatarData(null).id).toBe('felix');
        expect(getAvatarData('').id).toBe('felix');
    });

    it('getRandomAvatarSeed returns a known preset', () => {
        const seed = getRandomAvatarSeed();
        expect(AVATAR_PRESETS.some(p => p.seed === seed)).toBe(true);
    });
});
