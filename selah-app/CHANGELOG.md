# Changelog

All notable changes to the **Selah Worship Planner** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-11-03

### 🚀 Added
- **Unified Obsidian-Glass Action Capsule**:
  - Replaced disparate top-right header action buttons in `SongDetailScreen` and `SetlistPlayerScreen` with a sleek, unified `.action-capsule` bar.
  - Integrated Phosphor icons (`Maximize2`, `ListPlus`, `SlidersHorizontal`, `Edit3`, `Printer`) with active gold glow dots, subtle borders, and smooth spring micro-interactions.
- **Revamped Stage Display Options Bottomsheet**:
  - Bespoke Liturgical Gold interactive slider (`.slider-sacred`) featuring dynamic track gradient fill (`--slider-pct`), 8 discrete step ticks (`12px` to `26px`), gold-rimmed thumb scaling, and `A−` / `A+` steppers.
  - Quick-preset chips (`Compact 14px`, `Stage 18px`, `Large 22px`).
  - **Live Stage Preview strip** rendering a real-time chord/lyric preview line based on the active key, font size, and chord visibility settings.
  - Structured Stage Control Bento cards for accidentals (`♯ Sharps` vs `♭ Flats`), stage HUD toggle, single-column print trigger, and lyric sharing.
- **Enhanced Multi-Song Setlist Picker**:
  - Transformed the setlist song selector bottomsheet into a multi-select modal with animated Liturgical Gold checkmark badges, live key badges, and a sticky *"Done"* footer bar.
  - Added quick filter pills (`All`, `Fast`, `Slow`, `Tagalog`, `English`).
  - Pre-indexed `useMemo` search caching for instantaneous filter responses across 420+ songs without input lag.
- **Global 60fps Micro-Animations**:
  - Added hardware-composited list item staggered entrances (`.animate-list-item`), spring bottomsheet appearances (`.animate-sheetSpring`), and tactile press states (`.btn-icon-action`, `.btn-interact`).
- **Complete React Portal Architecture**:
  - Portaled all bottomsheets and modals (`showSongPicker`, `showOptionsModal`, `AddSetlistModal`, `EditSetlistModal`, `QuickAddToSetlistModal`, `ScheduleBottomSheet`, `EditSongModal`, `DeleteConfirm`) to `document.body` (`z-[120]`), eliminating CSS containing-block traps.

### 🎨 Changed
- Standardized all "Add to Setlist" buttons across `LibraryScreen` and `HomeScreen` (Featured Songs, Newly Added, Favorites) with bold Phosphor `<ListPlus />` icons on sculpted 44x44px touch targets.
- Reorganized `MinisterScheduleCard` to move `Edit Schedule` and `Delete Schedule` inside the expanded card accordion, keeping the collapsed view uncluttered.
- Updated all CSS entrance keyframes (`tabContentEnter`, `trayPop`, `trayDrop`, `slideLeft`) to end at `transform: none` so `position: fixed` descendants are never trapped inside transformed cards.
- Expanded automated unit test suite to **131 tests passing** across 10 test suites.

### 🐛 Fixed
- **Setlist Song Picker Clipping Bug**: Fixed containing-block trap where `showSongPicker` was trapped inside parent `.animate-tabContent` and card container.
- **Setlist Song Search Lag**: Eliminated repeated on-render `stripChords()` regex execution on all 422 songs by pre-indexing search terms.
- **Type Error in Song Search**: Handled numeric `tempo` BPM values alongside string values to prevent `(s.tempo || '').toLowerCase is not a function`.
- **Live Player Settings Crash**: Resolved `formattedActiveKey is not defined` when opening player settings in `SetlistPlayerScreen`.
- **Red Flash on Tap**: Removed accidental red active highlight triggered during card taps on setlist and schedule cards.
- **Flat/Minor Key Transposition in Setlists**: Replaced sharp-only array indexing with `getKeyIndex()` from `utils/chords.js` so flat (`Bb`, `Eb`) and minor (`F#m`, `Em`) keys transpose accurately.
- **Windows Gradle Build Command**: Fixed Windows path resolution for `.\gradlew.bat assembleDebug` in `build_and_deploy.js` and `build_apk.js`.

---

## [1.0.0] — 2026-10-09

### 🚀 Added
- **Cross-Platform Native Print Engine**:
  - **`PrintFrame` Component**: Implemented semantic table-based printing spacers (`thead` and `tfoot`) ensuring Android WebViews enforce consistent **12mm hardware margins** across all pages without clipping.
  - **Native Android Print Configuration**: Configured `MainActivity.java` with `ISO_A4` default media size and `NO_MARGINS` delegator, enabling pixel-perfect margin control from HTML/CSS.
  - **Zero-Drift `ChordLineRenderer`**: Tokenized chord and syllable alignment across single-song and multi-song setlist print layouts.
  - **Adaptive Page Sizing**: Default optimized for ISO A4 while maintaining fluid layout adaptability for US Letter, Legal, and A5 paper sizes.
- **Phosphor Icons Suite**:
  - Migrated entire iconography system from Lucide React to Phosphor Icons (`@phosphor-icons/react`).
  - Dynamic light and dark theme adaptation across all navigation items, action pills, modals, and screen headers.
- **Minister Scheduling & Roster Management**:
  - Dedicated **Schedule Screen** with minister role assignments (Worship Leader, Vocals, Acoustic Guitar, Electric Guitar, Bass, Keys, Drums, Multimedia/AV).
  - Streamlined service preset carousel featuring quick horizontal selection for *Sunday Worship Service*, *Midweek Service*, and *Prayer Meeting*.
- **Live Stage Hardware & Pedal Support**:
  - Added `useStagePedals.js` for Bluetooth foot pedals (`PageDown`, `PageUp`, `ArrowDown`, `ArrowUp`) enabling hands-free sheet scrolling.
- **Curated Avatar System**:
  - Added 24 custom SVG team avatars in `/public/avatars` with interactive `AvatarChooserModal`.
- **Integrated DevOps Pipeline**:
  - Added `npm run deploy:all` script coordinating Supabase schema verification, Vitest suite execution, Vite production bundling, Vercel deployment, and Android APK generation.
  - Vitest test suite with 102 unit tests (`vitest run`).

### 🎨 Changed
- **Apple HIG-Inspired UI Overhaul**:
  - Eliminated harsh card borders and white outlines on cards, buttons, and chord viewer pills in dark mode in favor of subtle translucent surfaces.
  - Refactored Profile Screen cards to match Home screen design language with balanced icon sizing and typography.
  - Standardized minimum 44px touch targets across all interactive buttons and bottom navigation bars.
- **Printout Aesthetics & Typography**:
  - Removed unnecessary clutter from printed chord sheets: eliminated redundant footers (*"Single Column Chord Chart"*, *"Selah Worship Planner"*), placeholder category labels, and unknown artist tags.
  - Removed drop-shadow filters from chord text during print rendering to prevent blurry printer rasterization.
  - Added dynamic document title updating during print operations for clean PDF and print queue file naming.

### 🐛 Fixed
- **Android Print 0-Margin Clipping**: Solved Android Chromium WebView ignoring `@page { margin }` rules by utilizing `PrintFrame` spacer tables and runtime Android detection.
- **Supabase RLS Infinite Recursion**: Resolved PostgreSQL policy recursion on `profiles` and team tables via `supabase_fix_infinite_recursion.sql`.
- **Accidental Key Transposition**: Corrected formatting between sharp (♯) and flat (♭) enharmonic representations during live key switching and print export.
- **Duplicate Setlist IDs**: Normalized ID resolution between Dexie IndexedDB local caching and Supabase remote synchronization.

---

## [0.2.0] — 2026-07-29

### Added
- **Setlist Live Player** — Full-screen scrollable chord chart at `/setlist-player/:id` with all songs in a single view.
- **Pull to Refresh** — Touch-based pull-down sync on Setlist and Library screens.
- **Supabase Realtime Sync** — Auto-sync setlists across devices via realtime channel + 30s background interval.
- **Auto-hydrate on Mount** — Setlist screen fetches from Supabase on navigation, not just on pull.
- **Android Print Bridge** — `@JavascriptInterface` bridge from WebView to Android `PrintManager`.
- **PullToRefresh Component** — Reusable touch gesture component with rubber-band indicator.

### Changed
- **Chord Font Scaling** — Chord `<pre>` elements scale with font-size slider.
- **Setlist Card Redesign** — 2-tier mobile layout: full-width Live Player CTA, 3-column action grid, spacious song rows.
- **Print Preview Header** — Removed subtitle clutter, minimalist `<Printer />` icon button.
- **App Icon** — Custom Selah launcher icon across all mipmap densities.
- **Song Lyrics Source** — Lyrics resolve from local seed (`scraped_songs.json` / Dexie), not Supabase.

### Fixed
- **Empty Setlist Screen** — `handleAddSong` was missing closing `};`, causing the entire render to be inside a callback.
- **Stuck Loading Song** — Song detail via setlist resolves from local DB via `getSongByIdOrTitle()`.
- **Print CSS Parse Error** — Replaced `<style>{...}</style>` with `dangerouslySetInnerHTML` to avoid JSX brace collision.

---

## [0.1.0] — 2026-07-28

### Added
- Initial commit: Song library, setlist builder, chord transposition, Supabase auth, Capacitor Android shell.
