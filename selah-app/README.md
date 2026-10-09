# Selah — Worship Planner (App Package)

[![Tests](https://img.shields.io/badge/tests-102%20passed-brightgreen.svg)](./)
[![Vercel Deployment](https://img.shields.io/badge/deployed%20on-Vercel-black?logo=vercel)](https://jfcm-selah.vercel.app)
[![Android](https://img.shields.io/badge/platform-Android%20%7C%20Web%20%7C%20iOS-blue?logo=android)](./selah-app-debug.apk)
[![Icons](https://img.shields.io/badge/icons-Phosphor%20Icons-purple)](https://phosphoricons.com)

A modern, mobile-first worship planning and live performance application for churches and worship teams. Designed with **Apple Human Interface Guidelines (HIG)** aesthetic principles, offline-first IndexedDB storage, real-time Supabase cloud synchronization, and native cross-platform chord printing.

---

## 🌟 Key Features

- **420+ Pre-seeded Worship Songs**: Accurate chords, sections, key tags, and full lyrics.
- **Zero-Drift Chord Alignment**: `ChordLineRenderer` tokenizes chords and lyric syllables to eliminate alignment drift across varying screen widths and print viewports.
- **Setlist Builder & Active Lineups**: Quick drag-and-drop arrangement with per-song transposition and active date highlighting.
- **Live Stage Player**: High-contrast full-screen view with Bluetooth stage pedal integration (`useStagePedals.js`).
- **Minister Scheduling**: Role assignment sheet with streamlined service presets carousel (Sunday Worship Service, Midweek Service, Prayer Meeting).
- **Cross-Platform Native Print Engine**: Table-based `PrintFrame` enforcing **12mm hardware margins** across Android native print services, Apple AirPrint, and desktop printers. Default optimized for **ISO A4**.
- **Phosphor Icons**: Native `@phosphor-icons/react` icons adapting seamlessly to light and dark themes.
- **Apple HIG-Inspired Surfaces**: Borderless cards, subtle backgrounds, and 44px+ ergonomic touch targets.
- **Cloud & Offline Sync**: Dual-layer architecture with **Dexie.js (IndexedDB)** for instant local loading and **Supabase Realtime** for cloud sync.

---

## 🛠️ Scripts & Commands

| Command | Action |
|---|---|
| `npm run dev` | Start Vite development server at `http://localhost:5173` |
| `npm run build` | Build production web bundle to `dist/` |
| `npm test` | Run Vitest test suite (102 unit tests) |
| `npm run test:watch` | Run Vitest in interactive watch mode |
| `npm run android:sync` | Build web bundle and sync Capacitor Android assets |
| `npm run build:apk` | Compile Android Debug APK to `selah-app-debug.apk` |
| `npm run deploy:vercel` | Deploy production bundle live to Vercel |
| `npm run deploy:all` | Run complete pipeline: Supabase sync, tests, build, Vercel, and APK build |
| `npm run supabase:sync` | Verify connection to Supabase tables and schema status |

---

## 🚀 Live Demo & Artifacts

- **Production Web**: [https://jfcm-selah.vercel.app](https://jfcm-selah.vercel.app)
- **Android APK**: [`selah-app-debug.apk`](./selah-app-debug.apk) (5.60 MB)
- **Database**: Supabase PostgreSQL (`https://hbcfvixqrwrckcbtghwn.supabase.co`)
