# Selah Worship Planner - Release Notes (v1.0.0)

## 🚀 What's New in v1.0.0

### 🖨️ Universal Native Print Engine
- **Android Print 12mm Margin Frame**: Built a semantic `PrintFrame` with table headers and footers that enforces consistent 12mm margins per page on native Android WebViews, preventing edge clipping.
- **ISO A4 Default & Multi-Format Fluid Scaling**: Print sheets are calibrated for ISO A4 as primary default while scaling fluidly to US Letter, Legal, and A5.
- **AirPrint & Desktop Support**: Native `@page { margin: 12mm }` optimization for Apple OS (macOS/iOS AirPrint) and desktop web browsers.
- **Zero-Drift Chord Alignment**: Tokenized chord and lyrics rendering via `ChordLineRenderer` with drop-shadow removal for crisp printer output.
- **Streamlined Printouts**: Stripped out redundant footers, category labels, and header text for clean chord sheets.

### 🎨 Apple HIG UI Overhaul & Phosphor Icons
- **Phosphor Icons**: Upgraded entire app iconography to Phosphor icons with dynamic light and dark theme adaptation.
- **Harsh Border Removal**: Replaced high-contrast white card and button borders with subtle, translucent layers and 44px+ ergonomic touch targets conforming to Apple Human Interface Guidelines.
- **Preset Service Carousel**: Replaced cluttered bottom sheet buttons with a smooth horizontal carousel for quick selection (*Sunday Worship Service*, *Midweek Service*, *Prayer Meeting*).

### 🎸 Live Stage Features & Scheduling
- **Minister Scheduling**: Full scheduling workflow with role assignments across all worship ministry positions.
- **Bluetooth Stage Pedals**: Hands-free scrolling and page turns via Bluetooth foot switches (`useStagePedals`).
- **24 Custom Team Avatars**: Expressive SVG team avatars with an interactive avatar selector.

### 🛡️ Security, Reliability & Quality Assurance
- **Supabase RLS Hardening**: Validated Row Level Security policies with automated schema verification and recursive policy fixes.
- **Offline-First Resilience**: Dexie.js (IndexedDB) database pre-seeded with 420+ worship songs.
- **Automated Testing Suite**: 102/102 passing unit tests across RBAC, chords, lyrics, avatars, and database operations.
- **One-Command CI/CD**: `npm run deploy:all` validates Supabase, runs tests, creates production web bundle, deploys to Vercel, and compiles the Android APK.

---

### 🌐 Live Links
- **Vercel Web App**: [https://jfcm-selah.vercel.app](https://jfcm-selah.vercel.app)
- **GitHub Repository**: [kurtjalgalado/Selah](https://github.com/kurtjalgalado/Selah)
