import { describe, it, expect } from 'vitest';
import {
    KEYS,
    FLAT_KEYS,
    SHARP_KEYS,
    FLAT_TO_SHARP,
    SHARP_TO_FLAT,
    ENHARMONIC_MAP,
    formatKey,
    normalizeKey,
    getKeyIndex,
    isSectionLabel,
    transposeChord,
    transposeLine,
    transposeLyrics,
    semitonesBetween,
    stripChords,
} from './chords.js';

describe('chords — scales & lookups', () => {
    it('exposes 12 chromatic keys in flat and sharp scales', () => {
        expect(KEYS).toHaveLength(12);
        expect(FLAT_KEYS).toHaveLength(12);
        expect(SHARP_KEYS).toHaveLength(12);
    });

    it('flat↔sharp mappings cover the 5 black keys bijectively', () => {
        // The 5 black-key sharp spellings map cleanly to flat spellings.
        const blackKeys = ['C#', 'D#', 'F#', 'G#', 'A#'];
        for (const sharp of blackKeys) {
            expect(SHARP_TO_FLAT[sharp]).toBeDefined();
            expect(FLAT_TO_SHARP[SHARP_TO_FLAT[sharp]]).toBe(sharp);
        }
        // Rare enharmonics (Cb→B, Fb→E, E#→F, B#→C) are present in only
        // one direction.
        expect(FLAT_TO_SHARP['Cb']).toBe('B');
        expect(FLAT_TO_SHARP['Fb']).toBe('E');
        expect(SHARP_TO_FLAT['E#']).toBe('F');
        expect(SHARP_TO_FLAT['B#']).toBe('C');
    });

    it('normalizeKey returns canonical flat form for any input', () => {
        expect(normalizeKey('C#')).toBe('Db');
        expect(normalizeKey('Db')).toBe('Db');
        expect(normalizeKey('F#')).toBe('Gb');
        expect(normalizeKey(null)).toBe('C');
        expect(normalizeKey('')).toBe('C');
    });

    it('getKeyIndex wraps around the octave', () => {
        expect(getKeyIndex('C')).toBe(0);
        expect(getKeyIndex('B')).toBe(11);
        expect(getKeyIndex('garbage')).toBe(0);
    });
});

describe('isSectionLabel', () => {
    it.each([
        'Verse 1', '[Verse 1]', 'CHORUS', 'Pre-Chorus', 'Bridge',
        'Intro', 'Outro', 'Tag', 'Ending', 'Interlude',
        'V1', 'C2', 'B1', 'Turnaround', 'Guitar Solo', 'vamp',
    ])('detects "%s" as a section label', (line) => {
        expect(isSectionLabel(line)).toBe(true);
    });

    it.each(['Am', 'G/B', 'C#maj7', '[Em]', 'D'])('does NOT treat "%s" as section', (line) => {
        expect(isSectionLabel(line)).toBe(false);
    });

    it('returns false on empty / null', () => {
        expect(isSectionLabel(null)).toBe(false);
        expect(isSectionLabel('')).toBe(false);
    });
});

describe('transposeChord', () => {
    it('transposes C → D (+2 semitones, sharp mode)', () => {
        expect(transposeChord('C', 2, 'sharp')).toBe('D');
    });

    it('transposes with flat output when accidentalMode=flat', () => {
        expect(transposeChord('C', 1, 'flat')).toBe('Db');
        expect(transposeChord('C', 3, 'flat')).toBe('Eb');
    });

    it('handles negative semitones correctly', () => {
        expect(transposeChord('C', -1, 'sharp')).toBe('B');
        expect(transposeChord('C', -2, 'sharp')).toBe('A#');
    });

    it('transposes slash chords (C/G → D/A after +2)', () => {
        expect(transposeChord('C/G', 2, 'sharp')).toBe('D/A');
    });

    it('preserves suffix (Am + 3 = Cm, since flat-scale A is at index 9, +3 wraps to C)', () => {
        expect(transposeChord('Am', 3, 'sharp')).toBe('Cm');
    });

    it('preserves 7th and extensions (G7 → A7 after +2)', () => {
        expect(transposeChord('G7', 2, 'sharp')).toBe('A7');
    });

    it('returns section labels unchanged', () => {
        expect(transposeChord('Verse 1', 5, 'sharp')).toBe('Verse 1');
    });

    it('returns garbage unchanged', () => {
        expect(transposeChord('garbage', 2, 'sharp')).toBe('garbage');
    });

    it('handles 12 semitones (octave) — wraps to same note class via the chosen scale', () => {
        expect(transposeChord('C', 12, 'sharp')).toBe('C');
        // F# in flat mode normalizes to Gb via ENHARMONIC_MAP, so the
        // octave wrap stays in flat form.
        expect(transposeChord('F#', 12, 'flat')).toBe('Gb');
    });
});

describe('transposeLine', () => {
    it('transposes every bracketed chord, leaves lyrics alone', () => {
        // Am is at index 9 in FLAT_KEYS, +2 → index 11 (B). So [Am]→[Bm].
        const input = '[Am]Amazing [C]grace';
        const out = transposeLine(input, 2, 'sharp');
        expect(out).toBe('[Bm]Amazing [D]grace');
    });

    it('does not transpose section labels in brackets', () => {
        const out = transposeLine('[Verse 1] [G]Hello', 2, 'sharp');
        expect(out).toBe('[Verse 1] [A]Hello');
    });
});

describe('transposeLyrics', () => {
    it('preserves line count and empty lines', () => {
        const input = '[Verse 1]\n[G]Line A\n\n[C]Line B\n';
        const out = transposeLyrics(input, 2, 'sharp');
        expect(out.split('\n')).toHaveLength(input.split('\n').length);
    });

    it('handles empty input', () => {
        expect(transposeLyrics('', 5, 'sharp')).toBe('');
        expect(transposeLyrics(null, 5, 'sharp')).toBe('');
    });
});

describe('semitonesBetween', () => {
    it('returns correct semitone distances', () => {
        expect(semitonesBetween('C', 'G')).toBe(7);
        expect(semitonesBetween('G', 'C')).toBe(5);
        expect(semitonesBetween('C', 'C')).toBe(0);
    });

    it('handles enharmonic equivalents', () => {
        expect(semitonesBetween('Db', 'C')).toBe(11);
    });
});

describe('formatKey', () => {
    it('returns flat input as flat', () => {
        expect(formatKey('Db', 'flat')).toBe('Db');
    });

    it('converts flat to sharp when accidentalMode=sharp', () => {
        expect(formatKey('Db', 'sharp')).toBe('C#');
    });
});

describe('stripChords', () => {
    it('removes bracketed chord markers', () => {
        const input = '[G]Amazing [Em]grace\n[C]How sweet the sound';
        const out = stripChords(input);
        expect(out).not.toContain('[');
        expect(out).toContain('Amazing');
        expect(out).toContain('How sweet the sound');
    });

    it('collapses extra blank lines', () => {
        const out = stripChords('[G]foo\n\n\n\n[Em]bar');
        expect(out).not.toMatch(/\n{3,}/);
    });
});
