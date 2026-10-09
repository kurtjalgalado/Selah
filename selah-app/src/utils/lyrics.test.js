import { describe, it, expect } from 'vitest';
import { parseLyrics, isChordLine, separateChords, parseChordLineTokens } from './lyrics.js';

describe('parseLyrics', () => {
    it('returns empty array on empty input', () => {
        expect(parseLyrics('')).toEqual([]);
        expect(parseLyrics(null)).toEqual([]);
    });

    it('groups lines into sections', () => {
        const input = '[Verse 1]\n[G]Line A\n[C]Line B\n\n[Chorus]\n[Em]Glory';
        const sections = parseLyrics(input);
        expect(sections).toHaveLength(2);
        expect(sections[0].type).toBe('verse');
        expect(sections[1].type).toBe('chorus');
        expect(sections[1].lines.some(l => l.includes('Glory'))).toBe(true);
    });

    it('handles unbracketed section labels', () => {
        const input = 'Verse 1:\nLine A\n\nChorus:\nGlory';
        const sections = parseLyrics(input);
        expect(sections.length).toBeGreaterThanOrEqual(2);
        expect(sections.some(s => s.type === 'chorus')).toBe(true);
    });
});

describe('isChordLine', () => {
    it('returns true when line contains chord-like tokens', () => {
        expect(isChordLine('[G]Amazing grace')).toBe(true);
        expect(isChordLine('[C]    [G]')).toBe(true);
    });

    it('returns false for plain lyrics', () => {
        expect(isChordLine('Amazing grace')).toBe(false);
        expect(isChordLine('How sweet the sound')).toBe(false);
    });

    it('returns false for section labels in brackets', () => {
        expect(isChordLine('[Verse 1]')).toBe(false);
        expect(isChordLine('[Chorus]')).toBe(false);
    });

    it('returns false for empty / null', () => {
        expect(isChordLine('')).toBe(false);
        expect(isChordLine(null)).toBe(false);
    });
});

describe('separateChords', () => {
    it('separates inline [chord] tokens from lyrics', () => {
        const { chordLine, lyricLine } = separateChords('[G]Amazing [Em]grace');
        expect(chordLine).toContain('G');
        expect(chordLine).toContain('Em');
        expect(lyricLine).toContain('Amazing');
        expect(lyricLine).toContain('grace');
    });

    it('returns empty chord line when no brackets', () => {
        const { chordLine, lyricLine } = separateChords('plain lyrics only');
        expect(chordLine).toBe('');
        expect(lyricLine).toBe('plain lyrics only');
    });
});

describe('parseChordLineTokens', () => {
    it('returns empty array on empty input or null', () => {
        expect(parseChordLineTokens('')).toEqual([]);
        expect(parseChordLineTokens(null)).toEqual([]);
    });

    it('returns single text token when line has no chords', () => {
        const tokens = parseChordLineTokens('Plain text without chords');
        expect(tokens).toEqual([{ chord: '', text: 'Plain text without chords' }]);
    });

    it('parses standard chord line starting with a chord', () => {
        const tokens = parseChordLineTokens('[G]Amazing [C]grace, how [G]sweet the sound');
        expect(tokens).toEqual([
            { chord: 'G', text: 'Amazing ' },
            { chord: 'C', text: 'grace, how ' },
            { chord: 'G', text: 'sweet the sound' }
        ]);
    });

    it('handles line with text before the first chord', () => {
        const tokens = parseChordLineTokens('This is [G]Amazing grace');
        expect(tokens).toEqual([
            { chord: '', text: 'This is ' },
            { chord: 'G', text: 'Amazing grace' }
        ]);
    });

    it('handles pure chord lines with spacing', () => {
        const tokens = parseChordLineTokens('[G]  [D]  [Em]  [C]');
        expect(tokens).toEqual([
            { chord: 'G', text: '  ' },
            { chord: 'D', text: '  ' },
            { chord: 'Em', text: '  ' },
            { chord: 'C', text: '' }
        ]);
    });

    it('handles chord at the very end of the line', () => {
        const tokens = parseChordLineTokens('Like a wretch like [D]me [G]');
        expect(tokens).toEqual([
            { chord: '', text: 'Like a wretch like ' },
            { chord: 'D', text: 'me ' },
            { chord: 'G', text: '' }
        ]);
    });
});
