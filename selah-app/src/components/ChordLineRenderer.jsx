import React, { useMemo } from 'react';
import { isChordLine, parseChordLineTokens } from '../utils/lyrics';

/**
 * Universal Zero-Drift Chord Line Renderer
 * Locks chords directly above their corresponding lyrics tokens using flexbox columns.
 * Prevents horizontal drift across dynamic font scaling, zoom, responsive viewports, and print.
 */
export default function ChordLineRenderer({
    line = '',
    fontSize = 16,
    showChords = true,
    chordColorClass = 'text-accent',
    lyricColorClass = 'text-textprimary',
    isPrint = false,
}) {
    if (!line && line !== '') return null;

    const hasChords = isChordLine(line);

    // If chords are disabled or this line is plain text/lyrics
    if (!showChords || !hasChords) {
        const cleanLyricLine = line.replace(/\[[^\]]+\]/g, '');
        return (
            <p
                className={`whitespace-pre-wrap leading-relaxed ${lyricColorClass}`}
                style={{ fontSize: `${fontSize}px` }}
            >
                {cleanLyricLine || '\u00A0'}
            </p>
        );
    }

    const tokens = useMemo(() => parseChordLineTokens(line), [line]);

    if (!tokens || tokens.length === 0) {
        return (
            <p
                className={`whitespace-pre-wrap leading-relaxed ${lyricColorClass}`}
                style={{ fontSize: `${fontSize}px` }}
            >
                {'\u00A0'}
            </p>
        );
    }

    const chordFontSize = Math.round(fontSize * (isPrint ? 1.05 : 1.15));

    return (
        <div className="flex flex-wrap items-end my-1 break-inside-avoid leading-none">
            {tokens.map((token, idx) => {
                const hasChord = Boolean(token.chord && token.chord.trim());
                const textContent = token.text || '';

                return (
                    <span
                        key={idx}
                        className="inline-flex flex-col items-start align-bottom select-text whitespace-pre"
                    >
                        {/* Chord Tier */}
                        <span
                            className={`font-mono font-bold leading-tight select-none tracking-normal ${isPrint ? '' : 'drop-shadow-sm'} ${
                                hasChord ? 'opacity-100 pr-1.5' : 'opacity-0 pointer-events-none'
                            } ${chordColorClass}`}
                            style={{
                                fontSize: `${chordFontSize}px`,
                                minHeight: `${Math.round(chordFontSize * 1.2)}px`,
                            }}
                            aria-hidden={!hasChord}
                        >
                            {hasChord ? token.chord : '\u00A0'}
                        </span>

                        {/* Lyric Tier */}
                        <span
                            className={`font-sans leading-snug ${lyricColorClass}`}
                            style={{
                                fontSize: `${fontSize}px`,
                                minHeight: `${Math.round(fontSize * 1.2)}px`,
                            }}
                        >
                            {textContent || '\u00A0'}
                        </span>
                    </span>
                );
            })}
        </div>
    );
}
