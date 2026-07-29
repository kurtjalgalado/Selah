# Selah — Worship Planner

A mobile-first worship setlist planner for churches and worship teams. Built with React + Vite, deployed as an Android app via Capacitor.

## Features

- **Song Library** — 200+ pre-seeded worship songs with chords, lyrics, and metadata from selah.jfcm-missions.com
- **Setlist Builder** — Create worship setlists with drag-and-drop song ordering, per-song key transposition, and A4 print charts
- **Live Setlist Player** — Full-screen scrollable chord chart for stage use with adjustable font size
- **Chord Transposition** — Real-time key transposition with Nashville/standard chord notation
- **A4 Print / PDF** — 2-songs-per-page formatted charts with print-optimized CSS (works on Android via `PrintManager`)
- **Supabase Sync** — Setlists, keys, dates, and arrangement sync across devices via Supabase Realtime + periodic background sync
- **Pull to Refresh** — Manual database sync from Supabase
- **Google Auth** — Login via Supabase Google OAuth

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19, Vite, Tailwind CSS |
| Local DB | Dexie.js (IndexedDB) |
| Cloud Sync | Supabase (Postgres, Realtime, Auth) |
| Mobile | Capacitor 7 (Android) |
| Icons | Lucide React |

## Getting Started

```bash
cd selah-app
npm install
npm run dev
```

### Android Build

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## Project Structure

```
selah-app/
├── src/
│   ├── screens/          # SetlistScreen, LibraryScreen, SongDetailScreen, SetlistPlayerScreen
│   ├── components/       # PullToRefresh
│   ├── auth/             # AuthContext (Supabase Google OAuth)
│   ├── db/               # Dexie schema, scraped_songs.json seed
│   ├── supabase/         # client.js, sync.js (realtime + background sync)
│   └── utils/            # chords.js, lyrics.js
├── android/              # Capacitor Android project
├── public/               # Icons, favicon
└── supabase_schema.sql   # Database schema
```

## License

Private — JFCM Missions
