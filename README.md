# Selah — Worship Planner

[![Tests](https://img.shields.io/badge/tests-102%20passed-brightgreen.svg)](file:///c:/Users/Admin/Desktop/Selah/Selah/selah-app)
[![Vercel Deployment](https://img.shields.io/badge/deployed%20on-Vercel-black?logo=vercel)](https://jfcm-selah.vercel.app)
[![Android](https://img.shields.io/badge/platform-Android%20%7C%20Web%20%7C%20iOS-blue?logo=android)](file:///c:/Users/Admin/Desktop/Selah/Selah/selah-app/selah-app-debug.apk)
[![Icons](https://img.shields.io/badge/icons-Phosphor%20Icons-purple)](https://phosphoricons.com)

A modern, mobile-first worship planning and live performance application for churches and worship teams. Designed with **Apple Human Interface Guidelines (HIG)** aesthetic principles, offline-first IndexedDB storage, real-time Supabase cloud synchronization, and native cross-platform chord printing.

---

## 🌟 Key Features

### 🎵 Song Library & Smart Chords
- **420+ Pre-seeded Worship Songs** with accurate chords, sections, key tags, and lyrics.
- **Real-Time Key Transposition**: Instantly transpose songs by semitones with sharp (♯) and flat (♭) enharmonic preference toggles.
- **Zero-Drift Chord Alignment**: Tokenized chord and lyric rendering via `ChordLineRenderer` preventing drift across varying screen widths and print viewports.
- **Personal & Church Additions**: Add, edit, or customize songs locally with instant remote upsert.

### 📋 Setlist Builder & Active Services
- **Drag-and-Drop Order Management**: Organize lineups for Sunday Worship, Midweek Services, and Prayer Meetings.
- **Per-Song Key Customization**: Set custom keys per setlist without altering the global master song key.
- **Active Today Service Indicator**: Visual indicator highlighting lineups scheduled for the current date.

### 🎸 Live Stage Player
- **Full-Screen Stage Mode**: High-contrast, scrollable lyric and chord charts optimized for live worship leading.
- **Bluetooth Stage Pedals**: Hands-free page turns and continuous scrolling via `PageDown`/`PageUp` and arrow pedal triggers (`useStagePedals`).
- **Dynamic Font & Notation Scaling**: Quick font size slider and accidental switches on the stage action pill.

### 📅 Minister Scheduling & Team Roster
- **Role Assignment**: Assign ministers to roles including Worship Leader, Vocals, Acoustic Guitar, Electric Guitar, Bass, Keys, Drums, and Multimedia/AV.
- **Quick Preset Carousel**: Horizontal service picker (Sunday Worship Service, Midweek Service, Prayer Meeting) designed for rapid scheduling without modal clutter.
- **Role-Based Access Control (RBAC)**: Distinct permissions for Admins, Worship Leaders, and Team Members.

### 🖨️ Cross-Platform Native Print Engine
- **Android Native Print Services**: Resolves Chromium WebView's 0-margin clipping using table-based `PrintFrame` spacers, enforcing consistent **12mm hardware margins** across all Android devices.
- **Apple AirPrint & Desktop**: Direct `@page { size: auto; margin: 12mm; }` styling supporting **ISO A4 (default)**, US Letter, Legal, and A5 paper sizes.
- **Clean Printout Aesthetics**: Strips away unnecessary text, redundant headers/footers, and drop-shadow artifacts for clean, razor-sharp paper charts and PDF exports.

### 🎨 Apple HIG-Inspired Minimal UI
- **Phosphor Icons System**: Native Phosphor icons with light and dark mode adaptation.
- **Borderless Elevation & Subtle Surfaces**: Removed harsh white outlines and high-contrast card borders in favor of smooth translucent layers and ergonomic 44px+ touch targets.
- **Curated Avatar System**: 24 distinct hand-crafted SVG avatars for worship team members.

### ☁️ Cloud Sync & Offline Reliability
- **Offline-First Storage**: Local persistence with **Dexie.js (IndexedDB)** ensures full stage functionality without internet connectivity.
- **Supabase Cloud Sync**: Instant remote synchronization, background heartbeat sync, and pull-to-refresh hydration.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | React 18, Vite 6 |
| **Styling & Design** | Tailwind CSS 3, Vanilla CSS, Apple HIG tokens |
| **Iconography** | Phosphor Icons (`@phosphor-icons/react`) |
| **Local Database** | Dexie.js v4 (IndexedDB) |
| **Backend & Auth** | Supabase (PostgreSQL, Row Level Security, Realtime Channels) |
| **Mobile Runtime** | Capacitor 6 (Android native shell) |
| **Testing** | Vitest 2, JSDOM (102 tests passed) |
| **Deployment** | Vercel (Web), Gradle (Android APK) |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- Android Studio / Android SDK (for mobile APK builds)

### 1. Installation
```bash
git clone https://github.com/kurtjalgalado/Selah.git
cd Selah/selah-app
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Run Automated Tests
```bash
npm test
```
Executes all 102 unit tests verifying chord transposition, RBAC, avatar management, notification triggers, and Dexie database seeding.

---

## 📱 Android Build & Deployment

### One-Command Pipeline
Run the integrated build, test, Vercel deployment, and APK generator:
```bash
npm run deploy:all
```

### Manual Android Build
```bash
# Compile web bundle and sync Capacitor Android assets
npm run android:sync

# Build Android Debug APK
npm run build:apk
```
The compiled APK is placed at:
```
selah-app/selah-app-debug.apk
```

---

## 📂 Project Structure

```
Selah/
├── selah-app/
│   ├── android/                  # Native Android Capacitor Gradle project
│   ├── public/
│   │   └── avatars/              # 24 custom SVG team avatars
│   ├── scripts/
│   │   ├── build_and_deploy.js   # Automated test + Vercel + APK pipeline
│   │   ├── build_apk.js          # Gradle APK build runner
│   │   ├── deploy_vercel.js      # Production Vercel deploy script
│   │   └── sync_supabase_schema.js # Supabase schema and table validator
│   ├── src/
│   │   ├── auth/                 # Supabase authentication context
│   │   ├── components/
│   │   │   ├── ChordLineRenderer.jsx  # Tokenized zero-drift chord renderer
│   │   │   ├── PrintFrame.jsx         # Cross-platform 12mm print table frame
│   │   │   ├── BottomNavBar.jsx       # Apple HIG bottom navigation
│   │   │   ├── TopBarNotificationBell.jsx
│   │   │   ├── AssignMinisterBottomSheet.jsx
│   │   │   └── ...
│   │   ├── db/                   # Dexie schema and seed logic
│   │   ├── screens/
│   │   │   ├── HomeScreen.jsx
│   │   │   ├── LibraryScreen.jsx
│   │   │   ├── SongDetailScreen.jsx
│   │   │   ├── SetlistScreen.jsx
│   │   │   ├── SetlistPlayerScreen.jsx
│   │   │   ├── ScheduleScreen.jsx
│   │   │   └── ProfileScreen.jsx
│   │   ├── supabase/             # Client & realtime synchronization
│   │   └── utils/                # Chords, lyrics, stage pedals, RBAC, backhandler
│   ├── supabase_schema.sql       # Complete PostgreSQL schema
│   ├── vitest.config.js          # Unit testing configuration
│   └── package.json
├── CHANGELOG.md                  # Comprehensive version history
└── README.md
```

---

## 📄 License & Team

Developed for **JFCM Missions** and church worship teams worldwide.  
Repository: [kurtjalgalado/Selah](https://github.com/kurtjalgalado/Selah.git)
