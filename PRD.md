# Selah Worship Planner — Product Requirements Document (PRD)

> **Document Version:** 1.0.0  
> **Status:** Active / Source of Truth  
> **Scope:** Entire Selah Monorepo (`/`, `/selah-app`, Capacitor Android/iOS)  
> **Target Audience:** Worship Leaders, Band Musicians, Pastors, Technical Developers

---

## 1. Executive Summary & Vision

**Selah** is a stage-ready, mobile-first worship planning and live performance application tailored for church worship leaders, vocalists, and band musicians. 

Operating in high-pressure, low-light live stage environments, musicians need instant chord transposition, continuous hands-free auto-scroll, offline access to hundreds of songs, and seamless team scheduling. Selah fuses a reverent "Sacred & Tech" aesthetic with high-performance client-side reactivity (IndexedDB + Supabase real-time sync).

---

## 2. Target Users & Personas

| Persona | Role | Key Pain Points | Core Selah Solution |
|:---|:---|:---|:---|
| **Worship Leader** | Primary setlist planner & stage conductor | Needs to transpose songs on the fly to match vocal range; managing paper chord sheets is chaotic. | Instant chromatic key transposition, setlist drag-and-drop reordering, minister assignment, and 2-column print sheets. |
| **Stage Musician** (Guitarist / Keys / Bass) | Instrumentalist playing live on stage | Small screens, misaligned chords over lyrics, tablets going to sleep, screen glare blinding audience. | Pitch-black OLED stage player, monospaced chord alignment, hands-free auto-scroll, and 44px+ touch targets. |
| **Vocalist / Choir** | Backing or lead vocals | Unclear lyrics, lyrics cluttered with complex chord notations. | One-tap "Lyrics Only" toggle that strips chord annotations cleanly. |
| **Music Director / Admin** | Manages team scheduling and rehearsals | Miscommunications on service dates, team members forgetting rehearsals. | Service scheduling calendar, minister role assignments, automated email/in-app reminders, and RBAC permissions. |

---

## 3. Core Product Modules & Functional Requirements

### 3.1 Song Library & Discovery Engine
- **Pre-Seeded Library:** 422 pre-seeded, curated worship songs across English and Tagalog (CCLI / praise classics and modern anthems).
- **Search & Filtering:**
  - Full-text search across Title, Artist, and Lyrics with `<50ms` response time.
  - Quick filters: Category (`Fast` / `Slow`), Language (`English` / `Tagalog`).
  - Alphabetical scrollbar (A–Z) for rapid one-thumb library jumping.
- **Song Metadata:**
  - `title`, `artist`, `originalKey`, `currentKey`, `tempo` (BPM), `category`, `language`, `tags`, `lyrics`, `dateAdded`.
- **Chord Bracket Parsing:**
  - Notation format: chords enclosed in brackets inline with lyrics (e.g., `[G]Amazing [C]grace, how [D]sweet the sound`).
- **Custom Song CRUD:** Users can add, edit, or delete personal church worship songs.

### 3.2 Musical Transposition Engine
- **Chromatic Transposition:**
  - Complete 12-key transposition matrix (`C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B` / Enharmonics `Db`, `Eb`, `Gb`, `Ab`, `Bb`).
  - Transposes chords within brackets while keeping lyrics completely untouched.
  - Key normalization (e.g., converts flats/sharps consistently without breaking slashed bass chords like `[D/F#]`).
- **Transposition Persistence:**
  - Songs can be transposed locally in the library or assigned custom override keys within specific setlists.

### 3.3 Setlist Creation & Service Planning
- **Setlist Management:**
  - Setlist creation with Title, Date of Service, Prepared By, and Pastoral Notes.
  - Song selection modal with search and instant add.
  - Reordering songs within setlists via intuitive touch controls.
  - Service time tracking: calculated estimated service duration based on song tempos and counts.
- **Active Service Highlight:**
  - Real-time indicator for services scheduled for "Today" (Active Service Emerald glow and banner).
- **Print & Binder Export:**
  - Stage-ready print modal supporting **1-Column** (full width, large text) and **2-Column** (compact A4 paper-saver) chord chart layouts.
  - High-contrast black-on-white print formatting with screen chrome suppressed via `@media print`.

### 3.4 Live On-Stage Performance Player
- **Distraction-Free Stage View:**
  - OLED True Pitch Black (`#000000`) background to eliminate stage glare.
  - Minimalist floating Stage Dock positioned in the comfortable bottom thumb-zone.
- **Continuous Auto-Scroll:**
  - RequestAnimationFrame-driven continuous vertical scroll with configurable speed slider (1x to 5x).
  - Tap-to-pause and tap-to-resume without layout jumping.
- **Dynamic Text Scaling:**
  - Real-time font size scaling slider to adjust chord and lyric glanceability based on stage tablet distance (mic stand mount).
- **Chords vs. Lyrics Toggle:**
  - Instant toggle between Full Chord Chart and Clean Lyrics View.
- **Quick Song Jump:**
  - In-stage song index drawer to switch songs mid-service without leaving performance mode.

### 3.5 Team Scheduling & Role-Based Access Control (RBAC)
- **Service Schedules:**
  - Schedule services with Rehearsal Date/Time and Main Service Date/Time.
- **Minister Assignment:**
  - Assign team members to distinct stage roles:
    - *Worship Leader*, *Acoustic Guitar*, *Electric Guitar*, *Bass*, *Keyboards*, *Drums*, *Backing Vocals*.
- **Role Permissions:**
  - `Admin`: Full access (CRUD songs, manage team, setlist overrides).
  - `Worship Leader`: Manage setlists, create schedules, assign musicians.
  - `Musician` / `Vocalist`: View setlists, access live player, transpose keys locally.
- **Notification & Reminder Engine:**
  - Cross-platform notification dispatch (In-App notification tray, Dexie local store, and Vercel email endpoint).
  - Preference controls: Toggle email vs. in-app notification channels per user.

### 3.6 Offline-First Architecture & Cloud Sync
- **Local Database (Dexie.js / IndexedDB):**
  - Primary source of truth. All reads and writes occur against local IndexedDB instantly.
  - Zero UI blocking on network status.
- **Cloud Sync (Supabase):**
  - Asynchronous write-through background sync.
  - Offline queue (`syncQueue`) with exponential backoff retry on reconnect (`window.addEventListener('online')`).
  - Real-time cloud subscriptions (`postgres_changes`) to broadcast setlist changes across band members' tablets.

### 3.7 Native Mobile Integration (Capacitor)
- **Cross-Platform Target:** Android (SDK 22–34) and iOS (Simulator / TestFlight).
- **Hardware Bridges:**
  - `AndroidPrint`: Intercepts browser `window.print()` and routes to native Android print spooler.
  - `Haptics`: Physical vibration feedback on key stage interactions (transposing, toggling auto-scroll).
  - `BackHandler`: Hardware back-button handling prevents accidental exit during live stage performance.
  - `LocalNotifications`: System-level reminders for upcoming worship rehearsals.

---

## 4. Non-Functional Requirements (NFR)

### 4.1 Performance & Latency
- **Search Response:** Filter 422+ songs in `<50ms` on mid-tier mobile hardware.
- **Auto-Scroll Smoothness:** Maintain rock-solid **60fps** during auto-scroll (zero layout thrashing; transform/scrollBy only).
- **Cold Boot Time:** App ready to browse songs in `<1.2s` from local IndexedDB cache.

### 4.2 Reliability & Offline Resilience
- **Offline Stage Guarantee:** The app must be 100% operational in sanctuaries without Wi-Fi or cellular reception.
- **Zero Data Loss:** Any setlist created offline must queue locally and safely reconcile upon network return.

### 4.3 Accessibility & Stage Ergonomics
- **Touch Target Standard:** Every interactive button, icon, and card must meet minimum `44x44px` dimensions.
- **WCAG Stage Contrast:** Chords and lyrics must achieve WCAG AAA contrast ratio (`>7:1`) on OLED black backgrounds.
- **Typography Alignment:** Chords must use fixed-width monospace fonts to prevent syllable drift when transposed.

---

## 5. Success Metrics & KPIs

1. **Stage Reliability:** Zero app crashes or freezing during live worship services.
2. **Offline Uptime:** 100% feature availability for setlist playback without internet access.
3. **Transposition Accuracy:** 100% pass rate across musical chord transposition test suites (45+ chromatic tests).
4. **Test Suite Health:** All 126+ automated tests passing before any release or deployment.
