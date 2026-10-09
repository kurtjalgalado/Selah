// Chromatic scales
export const FLAT_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const SHARP_KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const KEYS = FLAT_KEYS;

// Flat to Sharp and Sharp to Flat mappings
export const FLAT_TO_SHARP = {
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
    'Cb': 'B', 'Fb': 'E'
};

export const SHARP_TO_FLAT = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
    'E#': 'F', 'B#': 'C'
};

// Map flat/sharp equivalents
const ENHARMONIC_MAP = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
    'Cb': 'B', 'Fb': 'E', 'E#': 'F', 'B#': 'C',
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
};

/**
 * Format a Key or Root according to the preferred accidental ('sharp' | 'flat')
 */
export function formatKey(key, accidentalMode = 'sharp') {
    if (!key) return 'C';
    if (accidentalMode === 'sharp' && FLAT_TO_SHARP[key]) return FLAT_TO_SHARP[key];
    if (accidentalMode === 'flat' && SHARP_TO_FLAT[key]) return SHARP_TO_FLAT[key];
    return key;
}

/**
 * Normalize key to standard chromatic scale representation
 */
export function normalizeKey(key) {
    if (!key) return 'C';
    if (KEYS.includes(key)) return key;
    if (ENHARMONIC_MAP[key]) return ENHARMONIC_MAP[key];
    return key;
}

/**
 * Safely get 0-11 chromatic index for any key
 */
export function getKeyIndex(key) {
    const norm = normalizeKey(key);
    const idx = KEYS.indexOf(norm);
    return idx === -1 ? 0 : idx;
}

// Section labels that should NOT be transposed as chords
const SECTION_LABEL_REGEX = /^(verse|chorus|bridge|intro|outro|pre-?\s*chorus|post-?\s*chorus|refrain|tag|ending|end|instrumental|inst|interlude|hook|part|solo|guitar\s*solo|turnaround|turn\s*around|vamp|riff|break|coda|v\d+|c\d+|b\d+)([\s:()\-_/\.].*)?$/i;

export function isSectionLabel(text) {
    if (!text) return false;
    const clean = text.replace(/^\[|\]$/g, '').trim();
    if (!clean) return false;
    if (SECTION_LABEL_REGEX.test(clean)) return true;
    if (/^(guitar|piano|keyboard|acoustic|electric|synth|bass|drum|final|last|ending|outer|inner)\s+(solo|intro|outro|chorus|bridge|verse|part|riff|break)/i.test(clean)) {
        return true;
    }
    return false;
}

// Valid chord suffix elements (modifiers/extensions after root note)
const VALID_CHORD_SUFFIX_REGEX = /^(maj|maj7|maj9|maj11|maj13|min|min7|m|m7|m9|m11|m13|dim|dim7|aug|sus|sus2|sus4|add|add9|add11|\/|-|\+|\d|\.|\(|\)|#|b|7|9|11|13|6|2|4|5)*$/i;

/**
 * Transpose a single chord by a number of semitones and format with preferred accidental
 */
export function transposeChord(chord, semitones = 0, accidentalMode = 'sharp') {
    if (!chord) return chord;
    if (isSectionLabel(chord)) return chord;

    // Handle slash chords like C/G or Db/F
    if (chord.includes('/')) {
        const [bass, treble] = chord.split('/');
        if (isSectionLabel(bass) || isSectionLabel(treble)) return chord;
        return `${transposeChord(bass, semitones, accidentalMode)}/${transposeChord(treble, semitones, accidentalMode)}`;
    }

    // Match root note (including sharps/flats) and suffix
    const match = chord.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chord;

    const [, root, suffix] = match;

    // Reject non-chord words starting with A-G
    if (suffix && !VALID_CHORD_SUFFIX_REGEX.test(suffix)) {
        return chord;
    }

    // Normalize root for index lookup
    let normalizedRoot = root;
    if (ENHARMONIC_MAP[root] && !KEYS.includes(root)) {
        normalizedRoot = ENHARMONIC_MAP[root];
    }

    let idx = KEYS.indexOf(normalizedRoot);
    if (idx === -1) {
        idx = KEYS.indexOf(ENHARMONIC_MAP[root] || root);
    }
    if (idx === -1) return chord;

    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;

    const targetScale = accidentalMode === 'flat' ? FLAT_KEYS : SHARP_KEYS;
    const newRoot = targetScale[newIdx];
    return newRoot + suffix;
}

/**
 * Transpose all chords in a line of text
 * Assumes chords are in [brackets] format: [Am] [C/G] [F]
 */
export function transposeLine(line, semitones = 0, accidentalMode = 'sharp') {
    return line.replace(/\[([^\]]+)\]/g, (match, chord) => {
        if (isSectionLabel(chord)) return `[${chord}]`;
        return `[${transposeChord(chord, semitones, accidentalMode)}]`;
    });
}

/**
 * Transpose entire lyrics block with embedded chords and apply accidental formatting
 */
export function transposeLyrics(lyrics, semitones = 0, accidentalMode = 'sharp') {
    if (!lyrics) return '';
    return lyrics
        .split('\n')
        .map(line => transposeLine(line, semitones, accidentalMode))
        .join('\n');
}

/**
 * Calculate semitones between two keys
 */
export function semitonesBetween(fromKey, toKey) {
    const fromIdx = getKeyIndex(fromKey);
    const toIdx = getKeyIndex(toKey);
    if (fromIdx === -1 || toIdx === -1) return 0;
    return (toIdx - fromIdx + 12) % 12;
}

/**
 * Strip bracketed chords from lyrics for clean sharing/copying
 */
export function stripChords(lyrics) {
    if (!lyrics) return '';
    return lyrics
        .split('\n')
        .map(line => line.replace(/\[[^\]]+\]/g, '').trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}