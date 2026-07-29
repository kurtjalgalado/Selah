# Changelog

## [0.2.0] — 2026-07-29

### Added
- **Setlist Live Player** — Full-screen scrollable chord chart at `/setlist-player/:id` with all songs in a single view
- **Pull to Refresh** — Touch-based pull-down sync on Setlist and Library screens
- **Supabase Realtime Sync** — Auto-sync setlists across devices via realtime channel + 30s background interval
- **Auto-hydrate on mount** — Setlist screen fetches from Supabase on navigation, not just on pull
- **Android Print** — `@JavascriptInterface` bridge from WebView to Android `PrintManager`
- **PullToRefresh component** — Reusable touch gesture component with rubber-band indicator

### Changed
- **Chord font scaling** — Chord `<pre>` elements now scale with the font-size slider (1.05× multiplier, bold monospace)
- **Setlist card redesign** — 2-tier mobile layout: full-width Live Player CTA, 3-column action grid, spacious song rows with 44px+ touch targets
- **Print preview header** — Removed subtitle clutter, minimalist `<Printer />` icon button
- **App icon** — Custom Selah launcher icon across all mipmap densities
- **Song lyrics source** — Lyrics resolve from local seed (`scraped_songs.json` / Dexie), not Supabase

### Fixed
- **Empty setlist screen** — `handleAddSong` was missing closing `};`, causing the entire render to be inside a callback
- **Stuck loading song** — Song detail via setlist now resolves from local DB via `getSongByIdOrTitle()`
- **Print CSS parse error** — Replaced `<style>{...}</style>` with `dangerouslySetInnerHTML` to avoid JSX brace collision

## [0.1.0] — 2026-07-28

### Added
- Initial commit: Song library, setlist builder, chord transposition, Supabase auth, Capacitor Android shell
