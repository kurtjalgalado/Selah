import { isSectionLabel } from './chords.js';

const SECTION_TAG_REGEX = /^\[?(verse|chorus|bridge|intro|outro|pre-?\s*chorus|post-?\s*chorus|refrain|tag|ending|end|instrumental|inst|interlude|hook|part|solo|turnaround|turn\s*around|vamp|riff|break|coda|v\d+|c\d+|b\d+|\d+)[^\]]*\]?:?$/i;

export function parseLyrics(lyrics) {
    if (!lyrics) return [];

    const lines = lyrics.split('\n');
    const sections = [];
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const tagMatch = trimmed.match(/^\[?([A-Za-z0-9\s-]+?):?\]?$/);

        // A section header is a bracketed tag [Chorus] or title line Chorus: / Verse 1:
        const isSectionHeader = trimmed.length > 0 && trimmed.length < 40 && (
            SECTION_TAG_REGEX.test(trimmed) ||
            /^(verse|chorus|bridge|intro|outro|pre-?\s*chorus|post-?\s*chorus|refrain|tag|ending|end|instrumental|inst|interlude|hook|solo|turnaround|vamp|coda)/i.test(trimmed)
        ) && !isChordLine(line);

        if (isSectionHeader) {
            if (currentSection && currentSection.lines.length > 0) {
                sections.push(currentSection);
            }

            const label = trimmed.replace(/^\[|\]$:?/g, '').trim();
            let type = 'verse';
            if (/chorus/i.test(label)) type = 'chorus';
            else if (/bridge/i.test(label)) type = 'bridge';
            else if (/verse/i.test(label)) type = 'verse';
            else if (/intro|outro|instrument/i.test(label)) type = 'instrumental';
            else if (/pre-?chorus|refrain/i.test(label)) type = 'prechorus';
            else if (/tag|ending/i.test(label)) type = 'tag';

            currentSection = { type, label, lines: [] };
        } else {
            if (!currentSection) {
                currentSection = { type: 'verse', label: 'Verse 1', lines: [] };
            }
            currentSection.lines.push(line);
        }
    }

    if (currentSection && currentSection.lines.length > 0) {
        sections.push(currentSection);
    }
    return sections;
}

/**
 * Check if a line contains chords (in brackets)
 */
export function isChordLine(line) {
    if (!line) return false;
    const matches = line.match(/\[([^\]]+)\]/g);
    if (!matches) return false;
    return matches.some(match => {
        const content = match.slice(1, -1).trim();
        return !isSectionLabel(content) && /^([A-G][#b]?)(.*)/.test(content);
    });
}

/**
 * Separate chords from lyrics for dual-line display
 */
export function separateChords(line) {
    const regex = /\[([^\]]+)\]/g;
    let match;
    let lyricText = '';
    let chordLine = '';
    let lyricPos = 0;
    let lastIndex = 0;

    while ((match = regex.exec(line)) !== null) {
        // Append lyrics before this chord marker
        const textBefore = line.substring(lastIndex, match.index);
        lyricText += textBefore;
        lyricPos += textBefore.length;

        // Pad chord line to current lyric position, then append chord
        while (chordLine.length < lyricPos) chordLine += ' ';
        chordLine += match[1];

        lastIndex = match.index + match[0].length;
    }

    lyricText += line.substring(lastIndex);

    return {
        chordLine,
        lyricLine: lyricText.trim(),
    };
}