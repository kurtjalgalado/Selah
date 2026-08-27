# Selah Worship Planner — Full Codebase Audit

**Date:** August 2026
**Version:** v1.0.0 (as per `selah-app/package.json`)
**Auditor:** opencode

---

## Table of Contents

1. [App Overview](#1-app-overview)
2. [Directory Structure](#2-directory-structure)
3. [Tech Stack](#3-tech-stack)
4. [Business Logic](#4-business-logic)
5. [Backend System](#5-backend-system)
6. [Frontend System](#6-frontend-system)
7. [UI & UX Implementation](#7-ui--ux-implementation)
8. [Identified Issues](#8-identified-issues)
9. [Summary & Prioritized Action Items](#9-summary--prioritized-action-items)

---

## 1. App Overview

**Selah** is a worship planner application built for church worship teams. It manages a song library (422 pre-seeded worship songs in English and Tagalog), setlists for services, and provides a live chord-chart player for on-stage use. The app runs as:

- **Web SPA** (Vercel deployment)
- **Android native app** (Capacitor 6)
- **iOS simulator build** (GitHub Actions CI)

Core user flows: browse/search songs, create/edit setlists, transpose chords to any key, display chord charts on-screen during worship, and print setlist summaries. Offline-first architecture with Supabase cloud sync.

---

## 2. Directory Structure

```
Selah/
├── .agents/skills/              # 27 AI agent skill directories
├── .github/workflows/
│   └── ios-build.yml            # GitHub Actions iOS simulator build
├── .vscode/settings.json        # Java/Gradle auto-build config
├── .gitignore
├── design.html                  # Standalone design mockup (root)
├── package.json                 # Root monorepo wrapper
├── README.md
└── selah-app/                   # Main application
    ├── .env                     # Supabase credentials (committed!)
    ├── capacitor.config.json    # Capacitor native config (appId: com.selah.worship)
    ├── CHANGELOG.md             # v0.1.0, v0.2.0
    ├── eslint.config.js
    ├── index.html               # Entry HTML (Google Fonts: Cormorant Garamond, Inter, JetBrains Mono)
    ├── package.json
    ├── postcss.config.js
    ├── supabase_schema.sql      # Cloud DB schema
    ├── tailwind.config.js
    ├── vercel.json              # Vercel deploy config (SPA rewrite)
    ├── vite.config.js
    ├── android/                 # Capacitor Android project (Gradle 8.2.1, minSdk 22, targetSdk 34)
    ├── public/                  # Static assets (favicon, icons)
    ├── scripts/                 # Utility scripts (Python icon processing, Supabase reset)
    └── src/
        ├── main.jsx             # React 18 entry, AndroidPrint bridge override
        ├── App.jsx              # Root: HashRouter, lazy routes, contexts, Capacitor back button
        ├── App.css              # Legacy Vite boilerplate CSS (UNUSED)
        ├── index.css            # Tailwind imports, CSS vars, animations, glassmorphism
        ├── auth/
        │   └── AuthContext.jsx  # Supabase auth provider
        ├── components/
        │   ├── AppLogo.jsx
        │   ├── EditSongModal.jsx
        │   ├── ErrorBoundary.jsx
        │   ├── ProfileSettingsModal.jsx
        │   ├── PullToRefresh.jsx
        │   ├── Sidebar.jsx
        │   ├── SkeletonLoader.jsx
        │   └── Toast.jsx
        ├── context/
        │   └── SongCacheContext.jsx  # Live Dexie queries
        ├── db/
        │   ├── dexie.js             # Dexie schema, seed, CRUD
        │   └── scraped_songs.json   # 422 seed songs
        ├── screens/
        │   ├── LibraryScreen.jsx    # Song library (669 lines)
        │   ├── LoginScreen.jsx
        │   ├── RegisterScreen.jsx
        │   ├── SetlistPlayerScreen.jsx  # Live chord player (449 lines)
        │   ├── SetlistScreen.jsx    # Setlist management (1297 lines, 5 components)
        │   └── SongDetailScreen.jsx # Song view (469 lines)
        ├── supabase/
        │   ├── client.js            # Supabase client init
        │   └── sync.js              # Bidirectional sync engine (343 lines)
        └── utils/
            ├── chords.js            # Chord transposition engine
            ├── haptics.js           # Vibration API wrapper
            ├── lyrics.js            # Lyrics section parser
            └── notifications.js     # Cross-platform notification system
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | React | 18.3.1 |
| **Build Tool** | Vite | 6.1.0 |
| **Language** | JavaScript (JSX) | ES2022+ (no TypeScript) |
| **Styling** | Tailwind CSS | 3.4.17 |
| **Routing** | react-router-dom | 6.28.2 (HashRouter) |
| **Local DB** | Dexie.js (IndexedDB) | 4.0.11 |
| **Cloud DB** | Supabase (Postgres) | supabase-js 2.48.1 |
| **Auth** | Supabase Auth | Email/password + Google OAuth |
| **Realtime** | Supabase Realtime | Postgres changes subscription |
| **Icons** | lucide-react | 0.475.0 |
| **Mobile** | Capacitor | 6.2.0 (Android, iOS) |
| **Deployment** | Vercel | SPA with rewrites |
| **CI/CD** | GitHub Actions | iOS simulator build |

**Notable absences:** No TypeScript, no component library (shadcn/Radix), no form library (Formik/RHF), no state library (Redux/Zustand), no test framework, no CSS-in-JS.

---

## 4. Business Logic

### 4.1 Song Management
- **Seed data:** 422 worship songs loaded from `scraped_songs.json` on first launch
- **Re-seeding logic:** Triggers if song count < 50 or if songs lack `language` field
- **Fields:** title, artist, originalKey, currentKey, tempo, category (Fast/Slow), language (English/Tagalog), tags, lyrics, dateAdded
- **Search:** Client-side filter across title, artist, category, language

### 4.2 Chord Transposition Engine (`utils/chords.js`)
- 12-key chromatic scale with enharmonic normalization
- `transposeChord()`, `transposeLine()`, `transposeLyrics()` — transposes `[bracketed]` chord annotations
- `stripChords()` — removes all chords for clean lyric sharing
- `isSectionLabel()` — identifies section headers vs chord lines

### 4.3 Setlist Management
- Create/edit/delete setlists with title, date, prepared_by, notes
- Add songs to setlists, reorder via drag-and-drop
- Per-song key transposition within setlists
- Print view: 2-songs-per-page A4 chord chart layout

### 4.4 Live Performance Player (`SetlistPlayerScreen`)
- Full-screen scrollable chord chart display
- Auto-scroll with configurable speed
- Font size control
- Quick song jump index bar
- Stage dock controls (chords toggle, scroll, font)

### 4.5 Sync Architecture (`supabase/sync.js`)
- **Write-through:** Every local CRUD also pushes to Supabase
- **Offline queue:** Failed ops stored in Dexie `syncQueue`, retried with exponential backoff
- **Background hydration:** 30-second polling interval fetches remote data
- **Realtime:** Supabase `postgres_changes` subscription on `setlists` and `songs`
- **Conflict resolution:** Timestamp-based — remote wins if newer
- **Online recovery:** `window.addEventListener('online')` triggers queue processing

### 4.6 Notification System (`utils/notifications.js`)
- Android native bridge (`AndroidNotify`) + Web Notification API fallback
- Notification history stored in localStorage (max 50)

### 4.7 Haptic Feedback (`utils/haptics.js`)
- Android native bridge (`AndroidHaptic.vibrate`) + Web Vibration API fallback
- Patterns: light (10ms), medium (25ms), heavy (50ms), success, warning, error

---

## 5. Backend System

### Architecture: Backend-as-a-Service (No Custom Server)

There is **no server-side code**. All backend operations go through the **Supabase JS client** directly from the browser.

### 5.1 Supabase Tables

| Table | Columns | RLS |
|-------|---------|-----|
| `profiles` | id (UUID PK), username, email, role, quick_pin, accent_color, created_at, updated_at | Users can CRUD own |
| `songs` | id (UUID PK), user_id, title, artist, original_key, tempo, category, lyrics, created_at, updated_at | Users can CRUD own |
| `setlists` | id (UUID PK), user_id, title, date, notes, prepared_by, song_ids (JSONB), song_keys (JSONB), created_at, updated_at | Users can CRUD own |

### 5.2 Authentication

| Method | Implementation |
|--------|---------------|
| Email/Password | `supabase.auth.signUp()` / `signInWithPassword()` |
| Username Lookup | Queries `profiles` table by `ilike('username',...)` to resolve email |
| Google OAuth | `supabase.auth.signInWithOAuth('google')` |
| Quick PIN | 4-digit PIN stored in `profiles.quick_pin` + localStorage cache |
| Password Reset | `supabase.auth.resetPasswordForEmail()` (defined but never exposed in UI) |
| Session | Persisted in `localStorage`, auto-refresh enabled |

### 5.3 Client-Side Database (Dexie/IndexedDB)

| Table | Schema | Purpose |
|-------|--------|---------|
| `songs` | `++id, title, artist, category, language, originalKey, tempo, dateAdded` | Local song cache |
| `setlists` | `++id, title, date, *songIds` | Local setlist cache |
| `settings` | `&key` | App settings KV store |
| `syncQueue` | `++id, table, action, recordId, timestamp` | Offline operation queue |

### 5.4 Data Flow

```
User Action → Dexie (local write) → Push to Supabase → Realtime broadcast → Other devices
                   ↓
         syncQueue (if offline) → Retry on reconnect
```

### 5.5 External Integrations

| Integration | Purpose |
|-------------|---------|
| Supabase (hosted) | Auth, Postgres DB, Realtime |
| Supabase Google OAuth | Google sign-in |
| Android Native Bridges | Notifications, haptics, print |
| Web Notification API | Browser notifications |
| Web Vibration API | Haptic fallback |
| Web Share API | Share lyrics |

---

## 6. Frontend System

### 6.1 Routing

| Route | Component | File |
|-------|-----------|------|
| `/login` | `LoginScreen` | `screens/LoginScreen.jsx` |
| `/register` | `RegisterScreen` | `screens/RegisterScreen.jsx` |
| `/library` | `LibraryScreen` | `screens/LibraryScreen.jsx` |
| `/song/:id` | `SongDetailScreen` | `screens/SongDetailScreen.jsx` |
| `/setlists` | `SetlistScreen` | `screens/SetlistScreen.jsx` |
| `/setlist-player/:id` | `SetlistPlayerScreen` | `screens/SetlistPlayerScreen.jsx` |
| `*` | Redirect to `/library` | `App.jsx` |

All 6 screens are **lazy-loaded** via `React.lazy()` with `<Suspense>` fallback.

### 6.2 Components

| Component | File | Purpose |
|-----------|------|---------|
| `AppLogo` | `components/AppLogo.jsx` | Brand logo (sm/md/lg/xl sizes) |
| `Sidebar` | `components/Sidebar.jsx` | Left slide-in nav drawer |
| `Toast` | `components/Toast.jsx` | Auto-dismiss notification toast |
| `ErrorBoundary` | `components/ErrorBoundary.jsx` | Class-based error boundary |
| `SkeletonLoader` | `components/SkeletonLoader.jsx` | 5 shimmer loading variants |
| `PullToRefresh` | `components/PullToRefresh.jsx` | Touch pull-to-refresh gesture |
| `EditSongModal` | `components/EditSongModal.jsx` | Song edit form modal |
| `ProfileSettingsModal` | `components/ProfileSettingsModal.jsx` | Profile/PIN/notifications settings |

**Inline components** (defined inside screen files):
- `SongCard`, `AddSongModal` — in `LibraryScreen.jsx`
- `ModernSetlistCard`, `PrintSetlistModal`, `AddSetlistModal`, `EditSetlistModal` — in `SetlistScreen.jsx`

### 6.3 State Management

| Context | File | Purpose |
|---------|------|---------|
| `AuthContext` | `auth/AuthContext.jsx` | User session, sign in/out/up |
| `SongCacheContext` | `context/SongCacheContext.jsx` | Live Dexie queries (songs, setlists) |
| `ToastContext` | `App.jsx` | `showToast(message, type)` |
| `UIContext` | `App.jsx` | `openSidebar()`, `openProfileSettings()` |

No Redux, Zustand, or other state libraries. All state is local `useState` + Context + Dexie `useLiveQuery`.

### 6.4 Data Fetching

- **Primary:** Dexie IndexedDB via `useLiveQuery` (reactive, automatic)
- **Cloud sync:** Supabase client-side queries + Realtime subscriptions
- **Pattern:** Write-through (local first, then push to cloud)

### 6.5 Forms

No form library. All forms are controlled components with `useState` + HTML5 validation.

| Form | Validation |
|------|-----------|
| Login (standard) | HTML `required` |
| Login (PIN) | `pattern="\d{4}"`, `maxLength=4` |
| Register | `required`, password min 6 chars |
| Add/Edit Song | `required` on title/artist/tempo |
| Add/Edit Setlist | `required` on title |
| Profile Settings | Password min 6 chars, PIN `pattern="\d{4}"` |

---

## 7. UI & UX Implementation

### 7.1 Design System

**Color palette (dark theme):**
| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#0F1115` | Main background |
| `secondary` | `#16213E` | Cards, panels |
| `elevated` | `#1A1D29` | Modals, elevated surfaces |
| `accent` | `#D4AF37` | Gold — primary CTA color |
| `accent-soft` | `rgba(212,175,55,0.15)` | Accent backgrounds |
| `textmuted` | `#8892B0` | Secondary text |
| `success` | `#64FFDA` | Teal success states |
| `danger` | `#FF6B6B` | Red danger states |

**Typography:**
- **Headings/Brand:** Cormorant Garamond (serif, 500/600/700)
- **Body:** Inter (sans, 400/500/600/700)
- **Chords:** JetBrains Mono (mono, 500/700)

**Effects:**
- Glassmorphism (`.glass` class: `backdrop-filter: blur(12px)`)
- Gold glow accent (`.glow-accent`)
- Fade-in, slide-up, slide-in-right/left animations

### 7.2 UX Patterns

| Pattern | Implementation |
|---------|---------------|
| **Loading states** | Shimmer skeleton loaders for every screen |
| **Pull-to-refresh** | Custom touch gesture with rubber-band damping |
| **Toast notifications** | Auto-dismiss success/error toasts (3s) |
| **Error boundary** | Graceful crash recovery with reload |
| **Offline support** | IndexedDB local-first + sync queue |
| **Print view** | 2-songs-per-page A4 chord charts |
| **Stage mode** | Full-screen chord player with auto-scroll |
| **Android back button** | Custom Capacitor handler with exit confirmation |
| **Haptic feedback** | Vibration on key interactions |

### 7.3 Print System

`PrintSetlistModal` in `SetlistScreen.jsx` generates print-ready A4 layouts with:
- 2 songs per page
- Black-on-white high-contrast chords
- Hidden UI chrome via `@media print`
- Key info and section labels preserved

---

## 8. Identified Issues

### CRITICAL — Security

| # | File | Line | Issue |
|---|------|------|-------|
| C1 | `scripts/reset_supabase.js` | 3-4 | **Hardcoded Supabase URL and full JWT anon key committed to git.** Rotate immediately. |
| C2 | `screens/LoginScreen.jsx` | 96-100 | **PIN brute-force vulnerability.** 4-digit PIN (10K possibilities) queried directly against `profiles` table. No rate limiting on client side. |
| C3 | `screens/LoginScreen.jsx` | 110-111 | **PIN login bypasses real auth.** Successful PIN login navigates to `/library` but `AuthContext.user` remains `null`. No Supabase session is created. |
| C4 | `components/ProfileSettingsModal.jsx`, `screens/LoginScreen.jsx` | 120-123, 82-91 | **PIN stored in plaintext in localStorage.** `selah_pin_*` and `selah_guest_pin` readable by any JS (XSS) or physical device access. |
| C5 | `index.html` | 6 | **`user-scalable=no`** prevents pinch-to-zoom. WCAG accessibility violation. |

### HIGH — Bugs

| # | File | Line | Issue |
|---|------|------|-------|
| B1 | `screens/SongDetailScreen.jsx` | 75-88 | **Duplicate unreachable `if (song === undefined)` check.** Second block (line 86-88) is dead code — `SongDetailSkeleton` import used only in unreachable path. |
| B2 | `components/ProfileSettingsModal.jsx` | 407 | **`n.time` should be `n.timestamp`.** Notification history renders `Invalid Date` because property name mismatch (`notifications.js` creates `timestamp`, modal reads `time`). |
| B3 | `src/db/dexie.js` | 44-45 | **Fragile re-seed threshold.** If user has < 50 total songs, `seedDatabase()` wipes and re-seeds. User-created songs can be lost. |
| B4 | `supabase/client.js` | 4-5 | **Fallback placeholder credentials.** If env vars missing, app silently connects to dead endpoint instead of throwing. |

### MEDIUM — Orphaned / Unused Code

| # | File | Line | Issue |
|---|------|------|-------|
| O1 | `src/App.css` | all | **Entire file is unused Vite boilerplate.** 184 lines of `.counter`, `.hero`, `#docs` CSS never imported. |
| O2 | `src/assets/react.svg`, `src/assets/vite.svg` | — | **Unused Vite scaffold assets.** Not referenced by any component. |
| O3 | `src/App.jsx` | 23 | **`ToastContext` created/provided but never consumed.** `useContext(ToastContext)` is never called. Toast works via direct state. |
| O4 | `auth/AuthContext.jsx` | 117 | **`resetPassword` defined but never called.** No "Forgot Password?" UI exists. |
| O5 | `utils/chords.js` | 33, 108 | **`normalizeKey` and `transposeLine` exported but only used internally** within same file. |
| O6 | `components/SkeletonLoader.jsx` | 69 | **`SetlistSkeleton` exported but never imported** by any file. |
| O7 | `components/AppLogo.jsx`, `Sidebar.jsx`, `SkeletonLoader.jsx`, `main.jsx` | 1 | **Unnecessary `import React from 'react'`.** React 17+ JSX transform makes this redundant (Vite). |
| O8 | `screens/SongDetailScreen.jsx` | 18 | **`openProfileSettings` destructured but never called.** |
| O9 | `screens/SetlistPlayerScreen.jsx` | 1 | **`useMemo` imported but never used** in 449-line file. |
| O10 | `screens/RegisterScreen.jsx` | 9 | **`signInWithGoogle` destructured but never called.** No Google sign-in button on register form. |
| O11 | 5 locations | — | **`no-scrollbar` CSS class used but never defined.** Not in Tailwind config, not in any CSS file. Scrollbar hiding does not work. |

### MEDIUM — Stale / Dead Code

| # | File | Line | Issue |
|---|------|------|-------|
| S1 | `supabase/client.js` | 16-56 | **40 lines of commented-out SQL DDL schema** embedded in JS source. Belongs in migration file. |
| S2 | `screens/SongDetailScreen.jsx` | 86-88 | **Unreachable code** after duplicate `song === undefined` check. |
| S3 | `src/db/dexie.js` | 34, 49 | **`console.log` statements** ("Cleaned up duplicate songs", "Re-seeded IndexedDB") in production code. |
| S4 | `src/db/dexie.js` | 55 | **`console.warn`** in production code. |
| S5 | 4 locations | — | **`console.error`** in `ErrorBoundary.jsx`, `EditSongModal.jsx`, `notifications.js`, `sync.js`. |

### MEDIUM — Missing Error Handling

| # | File | Line | Issue |
|---|------|------|-------|
| E1 | `src/db/dexie.js` | 36 | **Empty `catch (e) { }`** silently swallowing errors. |
| E2 | `supabase/sync.js` | 112, 183 | **Silent catch blocks** with no logging or user feedback. |
| E3 | `src/App.jsx` | 86 | **Unhandled promise rejection.** `seedDatabase().then(() => setSeeded(true))` has no `.catch()`. App hangs on loading skeleton if seed fails. |
| E4 | `auth/AuthContext.jsx` | 21, 32, 44 | **`initRealtimeSync()` called without `.catch()`.** Unhandled if Supabase connection fails. |
| E5 | `screens/LibraryScreen.jsx` | 568-569 | **No try/catch around `songDB.add()` + `pushSongToSupabase()`.** Local/remote state diverges silently on failure. |
| E6 | `components/ProfileSettingsModal.jsx` | 42, 50 | **Empty `.catch(() => {})`** swallowing profile fetch errors. |
| E7 | `supabase/sync.js` | 301-309 | **`deleteSetlistFromSupabase` missing `if (!user) return` guard** (other functions have it). |
| E8 | `screens/SongDetailScreen.jsx` | 131 | **`navigator.clipboard.writeText()`** has no try/catch. Fails silently in insecure contexts. |

### MEDIUM — Duplicate Code

| # | Files | Issue |
|---|-------|-------|
| D1 | `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx`, `SetlistScreen.jsx` | **Song lyrics rendering logic duplicated 3 times** (~50 lines each). Same parse/render pattern with `parseLyrics()`, `separateChords()`, chord line detection. |
| D2 | `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx` | **Auto-scroll useEffect duplicated.** Identical interval-based scroll logic. |
| D3 | `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx` | **Floating stage dock controls duplicated.** Chords toggle, font size, auto-scroll buttons. |
| D4 | `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx` | **Display options modal duplicated.** Font size slider and scroll-to-top. |
| D5 | `LibraryScreen.jsx`, `SetlistScreen.jsx`, `SongDetailScreen.jsx` | **Setlist filtering (upcoming/past) logic duplicated** in 3 files. |
| D6 | `LibraryScreen.jsx`, `SongDetailScreen.jsx`, `SetlistScreen.jsx` | **Song-to-setlist addition logic duplicated** in 3 files. |
| D7 | `EditSongModal.jsx`, `LibraryScreen.jsx` | **Category options `['Fast', 'Slow', 'English', 'Tagalog']` defined independently** in 2 places. |
| D8 | `SetlistScreen.jsx`, `SetlistPlayerScreen.jsx` | **Chord transposer UI (minus/key/plus buttons) duplicated.** |

### LOW — Inconsistent Patterns

| # | Issue |
|---|-------|
| P1 | `SetlistScreen.jsx` (1297 lines) exports 5 components from one file. Should be separate files. |
| P2 | Mixed indentation: `AuthContext.jsx` uses 4-space, `ErrorBoundary.jsx` uses 2-space, others use no indent. |
| P3 | Import style inconsistency: `SetlistScreen.jsx` has separate React import on line 12. |
| P4 | Property naming mismatch: `timestamp` in `notifications.js` vs `.time` in `ProfileSettingsModal.jsx`. |
| P5 | Dual CSS token systems: `--text-primary` (CSS vars) vs `textmuted` (Tailwind config) with no `textprimary` Tailwind color defined yet used as `text-textprimary`. |
| P6 | `alert()` and `confirm()` used for user feedback in `EditSongModal.jsx` and `SongDetailScreen.jsx`. Blocking native dialogs are poor mobile UX. Existing `Toast` system should be used instead. |

### ADDITIONAL — Schema Mismatch

| # | Issue |
|---|-------|
| A1 | **`tags` field** read/written in `EditSongModal.jsx` and `LibraryScreen.jsx` but **not in Dexie or Supabase schemas**. Data exists only in memory, never persisted to cloud. |
| A2 | **`design.html`** at repo root — standalone design mockup, unclear if still needed. |
| A3 | **Supabase GRANT ALL to `anon`** role on all tables — anyone with the anon key can read/write. Combined with committed credentials (C1), this is a significant data exposure risk. |

---

## 9. Summary & Prioritized Action Items

### Issue Counts

| Severity | Count |
|----------|-------|
| Critical (Security) | 5 |
| High (Bugs) | 4 |
| Medium (Orphaned/Stale/Dupes/Error Handling) | 27 |
| Low (Patterns/UX) | 6 |
| Additional | 3 |
| **Total** | **45** |

### Priority 1 — Immediate (Security)

1. **Rotate Supabase credentials** — the anon key in `scripts/reset_supabase.js` is committed to git
2. **Restrict Supabase `anon` role** — remove `GRANT ALL`, use proper RLS policies instead
3. **Fix PIN authentication** — PIN login should create a real Supabase session, not just navigate
4. **Remove `user-scalable=no`** from viewport meta tag
5. **Hash/encrypt PINs** in localStorage or use Supabase sessions instead

### Priority 2 — This Sprint (Bugs)

6. **Fix `n.time` → `n.timestamp`** in `ProfileSettingsModal.jsx` line 407
7. **Remove duplicate `if (song === undefined)` check** in `SongDetailScreen.jsx` lines 86-88
8. **Add `.catch()` to `seedDatabase()`** in `App.jsx` line 86
9. **Define `no-scrollbar` CSS class** or remove all usages
10. **Fix re-seed threshold** — don't wipe user data when count < 50

### Priority 3 — Next Sprint (Code Quality)

11. **Extract duplicate lyrics rendering** into shared `LyricsDisplay` component
12. **Extract duplicate auto-scroll** into shared `useAutoScroll` hook
13. **Extract duplicate stage dock** into shared `StageDock` component
14. **Split `SetlistScreen.jsx`** (1297 lines) into 5 separate component files
15. **Split `LibraryScreen.jsx`** (669 lines) into `SongCard`, `AddSongModal` as separate files
16. **Delete orphaned files:** `App.css`, `react.svg`, `vite.svg`
17. **Remove unused imports:** `useMemo`, `signInWithGoogle`, `openProfileSettings`
18. **Remove `console.log`/`console.warn`** from production code
19. **Add error handling** to all silent catch blocks
20. **Replace `alert()`/`confirm()`** with Toast/Modal components

### Priority 4 — Tech Debt

21. **Add TypeScript** — zero type safety currently
22. **Add testing** — no test framework or tests exist
23. **Add `tags` to database schemas** or remove the field entirely
24. **Consolidate CSS token systems** — choose Tailwind config OR CSS vars, not both
25. **Move commented SQL schema** from `client.js` to a migration file
26. **Remove unused exported functions** (`normalizeKey`, `transposeLine`, `SetlistSkeleton`)

---

*End of audit.*
