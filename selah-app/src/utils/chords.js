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
 * Normalize chords placed inside words (e.g. from column-aligned chord scraper)
 * Moves chords to word boundaries so syllables and words never split apart or have artificial spaces.
 */
export function normalizeChordLine(line) {
    if (!line || !line.includes('[')) return line;

    // Do not alter section headers like [Chorus] or [Verse 1]
    if (/^\s*\[(verse|chorus|bridge|intro|outro|instrumental|pre-?chorus|tag)/i.test(line)) {
        return line;
    }

    // Pure chord lines (e.g. "[G]  [D]  [Em]  [C]") must preserve original chord progression spacing
    if (/^(\[[^\]]+\]\s*)+$/.test(line.trim())) {
        return line;
    }

    // Pass 1: Chord between two words with space after chord:
    // e.g. 'not[C7] owe' -> 'not [C7]owe'
    // e.g. 'to[Am7] wash' -> 'to [Am7]wash'
    let res = line.replace(/([a-zA-Z0-9’']+)\[([A-G][#b]?[^\]]*)\]\s+([a-zA-Z0-9’']+)/g, '$1 [$2]$3');

    // Pass 2: Trailing chord right after word characters before whitespace, punctuation, or end of line:
    // e.g. 'away[G7]' -> 'away [G7]'
    // e.g. 'hanggan[Am]' -> 'hanggan [Am]'
    // e.g. 'so[D]ng[A7]' -> 'so[D]ng [A7]'
    res = res.replace(/([a-zA-Z0-9’']+)(\[[A-G][#b]?[^\]]*\])(?=[,\.!\?;:\s]|$)/g, '$1 $2');

    // Pass 3: Chord embedded inside a word (letters before AND letters after chord):
    // e.g. 'b[F#m]less' -> '[F#m]bless'
    // e.g. 'd[F]ebt' -> '[F]debt'
    // e.g. 'wa[C]lang' -> '[C]walang'
    // e.g. 'g[D]oo[F#]d' -> '[D]good [F#]'
    // e.g. 'pra[D]is[F#]ed' -> '[D]praised [F#]'
    // e.g. 'luwalha[Em]tiin' -> '[Em]luwalhatiin'
    // e.g. 'forgi[G]ven' -> '[G]forgiven'
    res = res.replace(/\b([a-zA-Z0-9’']+)((\[[A-G][#b]?[^\]]*\][a-zA-Z0-9’']*)+)/g, (match, prefix, rest) => {
        const chords = [];
        const chordMatches = [...rest.matchAll(/\[([A-G][#b]?[^\]]*)\]/g)];
        for (const cm of chordMatches) {
            chords.push(cm[1]);
        }
        const cleanWord = prefix + rest.replace(/\[[^\]]+\]/g, '');
        if (chords.length === 1) {
            return `[${chords[0]}]${cleanWord}`;
        }
        return `[${chords[0]}]${cleanWord} ` + chords.slice(1).map(c => `[${c}]`).join(' ');
    });

    // Pass 4: Clean up any accidental double spaces (except leading indentation)
    res = res.replace(/([^\s])\s{2,}/g, '$1 ');

    return res;
}

/**
 * Normalize all chord lines in a full lyrics block
 */
export function normalizeLyrics(lyrics) {
    if (!lyrics) return '';
    return lyrics.split('\n').map(normalizeChordLine).join('\n');
}

/**
 * Strip bracketed chords from lyrics for clean sharing/copying
 */
export function stripChords(lyrics) {
    if (!lyrics) return '';
    return lyrics
        .split('\n')
        .map(line => normalizeChordLine(line).replace(/\[[^\]]+\]/g, '').replace(/[ \t]{2,}/g, ' ').trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}