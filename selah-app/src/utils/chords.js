// Chromatic scale with sharps/flats for transposition
export const KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Chord suffixes that might appear after root note
const CHORD_SUFFIXES = /^(maj|min|m|dim|aug|sus|add|\/|-|\+|\d|\.|\(|\)|#|b)*/;

// Sharp/flat preference by key
const KEY_PREFERENCES = {
    'C': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'Db': ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
    'D': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'Eb': ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
    'E': ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'],
    'F': ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    'Gb': ['Gb', 'Ab', 'Bb', 'Cb', 'Db', 'Eb', 'F'],
    'G': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'Ab': ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'],
    'A': ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
    'Bb': ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'],
    'B': ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
};

// Map flat/sharp equivalents
const ENHARMONIC_MAP = {
    'C#': 'Db', 'D#': 'Eb', 'F#': 'Gb', 'G#': 'Ab', 'A#': 'Bb',
    'Cb': 'B', 'Fb': 'E', 'E#': 'F', 'B#': 'C',
    'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#', 'Bb': 'A#',
};

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

/**
 * Transpose a single chord by a number of semitones
 */
export function transposeChord(chord, semitones) {
    if (!chord) return chord;

    // Match root note (including sharps/flats) and suffix
    const match = chord.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chord;

    const [, root, suffix] = match;

    // Normalize root for lookup
    let normalizedRoot = root;
    if (ENHARMONIC_MAP[root] && !KEYS.includes(root)) {
        normalizedRoot = ENHARMONIC_MAP[root];
    }

    let idx = KEYS.indexOf(normalizedRoot);
    if (idx === -1) {
        // Try the reverse mapping
        idx = KEYS.indexOf(ENHARMONIC_MAP[root] || root);
    }
    if (idx === -1) return chord; // Can't transpose unknown chord

    let newIdx = (idx + semitones) % 12;
    if (newIdx < 0) newIdx += 12;

    let newRoot = KEYS[newIdx];
    return newRoot + suffix;
}

/**
 * Transpose all chords in a line of text
 * Assumes chords are in [brackets] format: [Am] [C/G] [F]
 */
export function transposeLine(line, semitones) {
    return line.replace(/\[([^\]]+)\]/g, (match, chord) => {
        // Handle slash chords like C/G
        if (chord.includes('/')) {
            const [bass, treble] = chord.split('/');
            return `[${transposeChord(bass, semitones)}/${transposeChord(treble, semitones)}]`;
        }
        return `[${transposeChord(chord, semitones)}]`;
    });
}

/**
 * Transpose entire lyrics block with embedded chords
 */
export function transposeLyrics(lyrics, semitones) {
    if (semitones === 0) return lyrics;
    return lyrics
        .split('\n')
        .map(line => transposeLine(line, semitones))
        .join('\n');
}

/**
 * Calculate semitones between two keys
 */
export function semitonesBetween(fromKey, toKey) {
    const fromIdx = KEYS.indexOf(fromKey);
    const toIdx = KEYS.indexOf(toKey);
    if (fromIdx === -1 || toIdx === -1) return 0;
    return (toIdx - fromIdx + 12) % 12;
}