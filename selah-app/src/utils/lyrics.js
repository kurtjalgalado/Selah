const SECTION_TAG_REGEX = /^\[?(verse|chorus|bridge|intro|outro|pre-?chorus|refrain|tag|ending|instrumental|interlude|hook|part|\d+)[^\]:]*:?\]?$/i;

export function parseLyrics(lyrics) {
    if (!lyrics) return [];

    const lines = lyrics.split('\n');
    const sections = [];
    let currentSection = null;

    for (const line of lines) {
        const trimmed = line.trim();
        const tagMatch = trimmed.match(/^\[?([A-Za-z0-9\s-]+?):?\]?$/);

        // A section header is a bracketed tag [Chorus] or title line Chorus: / Verse 1:
        const isSectionHeader = trimmed.length > 0 && trimmed.length < 30 && (
            SECTION_TAG_REGEX.test(trimmed) ||
            /^(verse|chorus|bridge|intro|outro|pre-?chorus|refrain|tag|ending|instrumental|interlude|hook)/i.test(trimmed)
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
    return /\[([A-G][#b]?[a-zA-Z0-9\/\-+]*)\]/.test(line);
}

/**
 * Separate chords from lyrics for dual-line display
 */
export function separateChords(line) {
    const chords = [];
    const lyrics = [];
    let lastIndex = 0;

    const regex = /\[([^\]]+)\]/g;
    let match;
    let lyricText = '';

    while ((match = regex.exec(line)) !== null) {
        // Add spaces to align chord position
        const spaces = ' '.repeat(match.index - lastIndex);
        chords.push(spaces + match[1]);
        lyricText += line.substring(lastIndex, match.index);
        lastIndex = match.index + match[0].length;
    }

    lyricText += line.substring(lastIndex);

    return {
        chordLine: chords.join(' '),
        lyricLine: lyricText.trim(),
    };
}