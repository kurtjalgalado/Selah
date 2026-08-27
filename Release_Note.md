# Selah Worship Planner - Release Notes

## 🚀 Features

- **Row Level Security (RLS)**: Enforced strict Supabase RLS policies restricting read/write database access to authenticated accounts (`profiles`, `songs`, `setlists`).
- **Active Setlist Indicator**: Highlighted setlists matching today's date with an emerald green border, background glow, and `ACTIVE TODAY` pulse badge.
- **Authenticated Setlist Creation**: Guarded setlist creation buttons and modals to require user authentication before creating service lineups.
- **Cloud & Offline Sync**: Added pull-to-refresh hydration, instant remote upsert on save/edit/delete, and offline IndexedDB browser caching.
- **Vercel Deployment**: Live production deployment hosted at [selah-app-theta.vercel.app](https://selah-app-theta.vercel.app).
- **Mobile Android APK**: Rebuilt latest Android debug binary (`app-debug.apk`).

## 🐛 Bug Fixes

- **Unauthenticated Database Writes**: Blocked anonymous database mutations by revoking `anon` role table grants.
- **Setlist Duplication**: Normalized string ID keys across local Dexie DB and Supabase to prevent duplicate setlist entries.
- **Remote Deletion Sync**: Synchronized setlist deletion so deleting locally cleans up records in Supabase tables.
