# Selah — Mobile Chord Chart App: Comprehensive UI/UX Audit Report

**Date:** August 7, 2026  
**Scope:** Selah is a mobile-first PWA (Capacitor) + web app for church worship leaders to manage chord charts, arrange setlists, and display lyrics during live worship.  
**Heuristic Framework:** Nielsen's 10 Usability Heuristics + Mobile/Touch Ergonomics (thumb-friendly placement, reachability, safe-area handling).  

---

## ⭐ Executive Summary

Selah's dark theme with gold accents and serif display typography creates an appropriate "sacred/tech" atmosphere. The stage-focused design (auto-scroll, chord transposition, setlist player) is genuinely useful. However, several **flow-blocking** issues and numerous **stage-use regressions** prevent the app from being reliable in a live worship environment.

### 🔥 Flow Blockers (P0 — Must Fix Before Stage Use)

| # | Issue | Severity | Heuristic | File | 
|---|-------|----------|-----------|------|
| 1 | **Auto-scroll stops at bottom of single song** | Critical | System Status / User Control | `SetlistPlayerScreen.jsx` |
| 2 | **Chords overlap lyrics in chord-line rendering** | Critical | Recognition > Recall | `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx` |
| 3 | **Stage-mode dock has no "Full Screen" toggle** | High | Aesthetic / Minimalist | Both player screens |
| 4 | **No way to navigate between songs in stage mode** | High | Flexibility & Efficiency | `SetlistPlayerScreen.jsx` |

---

## 🐝 Full Issue List

### 1. CRITICAL: Auto-Scroll Behavior Is Stage-Unviable

**File:** `SetlistPlayerScreen.jsx` (line 55–67), `SongDetailScreen.jsx` (line 67–80)

**Problem:**  
The auto-scroll stops the entire page when it reaches the **bottom of the screen** (`window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 15`), not the bottom of the **current song**. In a setlist player, this means the scroll stops mid-song. There is no "next song" navigation.

**Heuristics Violated:**  
- Visibility of system status (no progress indicator)  
- User control and freedom (no pause-to-skip, no song boundary awareness)

**Suggestion:**  
- Implement per-section auto-scroll that resets between songs.  
- Add a swipe-up/down gesture or a fixed "Next/Prev Song" button in the dock.  
- Add a visual progress ring or percentage indicator.

---

### 2. CRITICAL: Chord/Lyric Separation Has Alignment Issues

**File:** `lyrics.js` (`separateChords` function), used in `SongDetailScreen.jsx:line 401` and `SetlistPlayerScreen.jsx:line 279`

**Problem:**  
`separateChords()` strips spaces between chord placements to align chords with lyrics. However, the algorithm does not correctly offset when chords appear near the start of a line or when chords and lyrics have different font sizes. In SongDetail, chords are rendered at `fontSize * 1.3`, but in the player they remain the same size — this causes visual misalignment and makes real-time reading impossible.

**Heuristics Violated:**  
- Match between system and real-world (chords should align with syllables)  
- Aesthetic and minimalist design (misaligned chords break readability)

**Suggestion:**  
- Use fixed-width font pairing (JetBrains Mono for chords) and render chords as absolutely-positioned overlays with percentage-based `left` offsets instead of space-based alignment.  
- Ensure chord font scaling is consistent across both screens.

---

### 3. HIGH: No "Stage Mode" / Full-Screen Toggle

**File:** `SongDetailScreen.jsx`, `SetlistPlayerScreen.jsx`

**Problem:**  
Both screens have a floating stage dock, but there's no true full-screen mode. The dock itself occupies screen real estate even during performance. A worship leader needs a distraction-free view.

**Heuristics Violated:**  
- Aesthetic and minimalist design  
- Flexibility and efficiency of use (expert users need shortcuts)

**Suggestion:**  
- Add a "Stage Mode" toggle that hides all docks and toolbars, leaving only scrolling lyrics/chords.  
- Trigger via double-tap or a long-press gesture.

---

### 4. HIGH: No In-Stage Setlist Navigation

**File:** `SetlistPlayerScreen.jsx` (lines 187–304)

**Problem:**  
Once in the setlist player, there is no way to jump to a different song mid-set. The scroll-to-top button and quick-jump index bar exist, but are visually heavy and not stage-friendly.

**Heuristics Violated:**  
- Flexibility and efficiency of use  
- Recognition rather than recall

**Suggestion:**  
- Add a minimalist "Song Navigator" overlay toggled by a floating button — shows a vertical list of songs with a highlighted current item.  
- Support a hardware keyboard shortcut (left/right arrow) for foot-pedal compatibility.

---

### 5. HIGH: Inconsistent Chord Display Between Editor and Player

**File:** `SongDetailScreen.jsx` (line 406), `SetlistPlayerScreen.jsx` (line 285)

**Problem:**  
In SongDetail, chords are sized at `Math.round(fontSize * 1.30)` with `drop-shadow-sm`. In the player, chords use the same size but no shadow, creating visual inconsistency. The color is also slightly different (accent vs. default).

**Heuristics Violated:**  
- Consistency and standards

**Suggestion:**  
- Extract a shared `<ChordLine>` component to ensure consistent chord rendering.  
- Use the same CSS classes and font scaling logic in both contexts.

---

### 6. MEDIUM: Song Card Key Transposer Doesn't Persist

**File:** `LibraryScreen.jsx` (line 462–539, `SongCard`)

**Problem:**  
The `SongCard` component has a built-in key transposer (`transpose` function), but it only updates local state (`setCurrentKey`). The transposed key is lost when navigating away or refreshing. The user must re-transpose every time.

**Heuristics Violated:**  
- Recognition rather than recall  
- Flexibility and efficiency of use

**Suggestion:**  
- Persist transposed key preference to IndexedDB (`Dexie` song record `currentKey` field).  
- Show a small "★" indicator if a song has been transposed from its original key.

---

### 7. MEDIUM: Pull-to-Refresh Indicator Placement Is Not Thumb-Friendly

**File:** `PullToRefresh.jsx` (line 60–89)

**Problem:**  
The pull-to-refresh indicator appears at `top: 80px`, which is at the top of the screen. On large phones (>6.5"), this requires a two-handed interaction.

**Heuristics Violated:**  
- Mobile-specific: reachability, touch ergonomics

**Suggestion:**  
- Allow the indicator to be anchored to the bottom of the screen in settings.  
- Alternatively, make it a small floating button at the bottom-right corner.

---

### 8. MEDIUM: Setlist Card Swipe-to-Delete Conflicts with Scroll

**File:** `SetlistScreen.jsx` (lines 242–292, `onSwipeTouchStart/Move/End`)

**Problem:**  
While the swipe logic includes directional lock, the `touch-action` is not explicitly set. On some Android devices, this causes jank or accidental vertical scroll cancellation when swiping horizontally.

**Heuristics Violated:**  
- Flexibility and efficiency of use  
- Consistency and standards (iOS-style swipe works, Android may differ)

**Suggestion:**  
- Add CSS `touch-action: pan-y` on the card container to explicitly allow vertical scroll while blocking horizontal.  
- Consider replacing swipe-to-delete with a more explicit "Delete" button for better accessibility.

---

### 9. LOW: Search Has No Recent History

**File:** `LibraryScreen.jsx` (line 164–204), `SetlistScreen.jsx` (line 871–882)

**Problem:**  
Search fields in both library and setlist picker are stateless. If a user searches, navigates away, and comes back, the search is cleared.

**Heuristics Violated:**  
- Recognition rather than recall (user must re-type searches)

**Suggestion:**  
- Store recent searches in localStorage and display as a horizontal list of chips below the search bar.  
- Limit to 5 recent searches.

---

### 10. LOW: Print Preview Modal Has Fixed A4 Height

**File:** `SetlistScreen.jsx` (line 984)

**Problem:**  
The printable pages have `min-h-[1080px]` hardcoded, which is designed for 1080p screens. But on mobile devices or high-DPI screens, this causes massive vertical overflow and scrolling issues.

**Heuristics Violated:**  
- Match between system and real-world (print should be WYSIWYG)

**Suggestion:**  
- Use CSS `@page` media queries and `@media print` to define proper A4 page breaks.  
- Add a "Fit to Page" toggle for print preview.

---

### 11. LOW: Empty State for Library Is Uninformative

**File:** `LibraryScreen.jsx` (lines 271–278)

**Problem:**  
When no songs match a search, the empty state simply says "No songs found for '{search}'." This doesn't help the user recover.

**Heuristics Violated:**  
- Recovery from errors  
- Help, onboarding, and empty-state guidance

**Suggestion:**  
```tsx
// Enhanced empty state
<div className="text-center py-20">
  <Music className="w-12 h-12 mx-auto text-accent/30 mb-4" />
  <h3 className="text-base font-bold text-white">No Songs Found</h3>
  <p className="text-xs text-textmuted mt-2 max-w-xs mx-auto">
    Try adjusting your search term or removing filters. 
    You can add songs by tapping the <Plus className="inline w-3 h-3" /> button.
  </p>
</div>
```

---

## ✅ Positives (What Works Well)

| Feature | Strength |
|---------|----------|
| **Theme & Typography** | Dark background + gold accent + Cormorant Garamond serif is atmospheric and stage-appropriate |
| **Floating Stage Dock** | Fixed at safe-area-inset bottom with safe-area-aware positioning |
| **Pull to Refresh + Sync** | Integrated with Supabase background sync — great for team collaboration |
| **Chord Transposition** | Clean implementation with proper sharps/flats handling |
| **Skeleton Loaders** | Proper shimmer states on all screens reduce perceived loading time |
| **Haptic Feedback** | Tied to touch events (warning for delete, error, light) |
| **Section Label Detection** | Smart chord parser ignores `[Verse 1]` as a chord — prevents transposition glitches |

---

## 📱 Stage-Use Readiness Scorecard

| Category | Rating | Notes |
|----------|--------|-------|
| **Readability** | ⚠️ 6/10 | Chords sometimes misalign with lyrics at larger font sizes |
| **Navigation** | ❌ 4/10 | No song-to-song navigation in setlist player |
| **Performance Mode** | ❌ 3/10 | No full-screen / distraction-free mode |
| **Error Prevention** | ⚠️ 7/10 | Confirm dialogs on delete, but auto-scroll lacks boundary control |
| **Accessibility** | ⚠️ 6/10 | Good contrast, but lacks VoiceOver/talkback labels for chord lines |
| **Offline Capability** | ✅ 9/10 | Dexie local DB means full functionality without internet |
| **Overall Readiness** | ⚠️ 5/10 | Useable for solo rehearsal; not yet reliable for live stage |

---

## 📝 Prioritized Implementation Plan

### Priority 0 (Before Any Live Stage Use)
1. Implement **per-song auto-scroll boundary** in `SetlistPlayerScreen.jsx`.
2. Fix **chord/lyric alignment** — use position-absolute chord overlays instead of space-based alignment.
3. Add a **"Stage Mode" toggle** that hides all floating controls and enables true full-screen scroll.
4. Add **next/prev song controls** in setlist player.

### Priority 1 (Next Sprint)
5. Persist SongCard key transpose to local DB.
6. Replace swipe-to-delete on setlist cards with an explicit button action.
7. Extract a shared `<ChordLine>` component to unify chord display.
8. Add `@media print` styles to the print preview modal.

### Priority 2 (Polish)
9. Add recent searches history (localStorage chip list).
10. Move P2R indicator to a more thumb-friendly position.
11. Add VoiceOver/talkback labels to chord lines (`aria-label="Chord: G"`).
12. Add a keyboard shortcut map for pedal/FOOTSWITH users.

---

## 📁 File References Summary

| File | Lines / Components Reviewed | Key Issues |
|------|----------------------------|------------|
| `selah-app/src/App.jsx` | 1–146 | Route structure, back button handler |
| `selah-app/src/screens/LibraryScreen.jsx` | 1–667 | Song cards, add song modal, FAB |
| `selah-app/src/screens/SongDetailScreen.jsx` | 1–470 | Chord display, stage dock, transpose |
| `selah-app/src/screens/SetlistScreen.jsx` | 1–1347 | Setlist card, drag-drop reorder, print |
| `selah-app/src/screens/SetlistPlayerScreen.jsx` | 1–449 | Stage header, chord chart, dock |
| `selah-app/src/components/Sidebar.jsx` | 1–146 | Navigation, account management |
| `selah-app/src/components/EditSongModal.jsx` | 1–165 | Song editing form |
| `selah-app/src/components/ProfileSettingsModal.jsx` | 1–296 | Settings tabs, notification perms |
| `selah-app/src/components/SkeletonLoader.jsx` | 1–118 | Shimmer states |
| `selah-app/src/components/PullToRefresh.jsx` | 1–95 | Touch-scroll indicator |
| `selah-app/src/utils/chords.js` | 1–153 | Transpose logic, key normalization |
| `selah-app/src/utils/lyrics.js` | 1–90 | Parse/format/separate chords |
| `selah-app/src/index.css` | 1–151 | Dark theme vars, glassmorphism, animations |
| `selah-app/tailwind.config.js` | 1–23 | Color palette, font stack |
| `selah-app/index.html` | 1–16 | Viewport, PWA meta, fonts |
| `MainActivity.java` | 1–151 | Android bridge: print, notifications, haptics |

---

## 🎯 Recommendation Summary

**Does the UI match the purpose and users?**

✅ **Yes, mostly.**  
The dark theme, serif font, gold accent, and chord-centric features align perfectly with the needs of worship leaders who need a distraction-free, high-contrast chord chart viewer. Offline-first Dexie storage + Supabase sync is an excellent architecture for churches with unreliable WiFi.

⚠️ **But it is not yet production-ready for live stage use.**  
The auto-scroll logic, chord alignment, and navigation flow need critical fixes before leading a worship set. A worship leader cannot afford a scroll that stops mid-song or chords that don't align with syllables.

**Immediate action: Address the 3 critical issues first. Then proceed to stage-mode enhancements.**

---

*Report generated by UI/UX heuristic audit based on Nielsen's 10 Heuristics + mobile touch ergonomics review. This is a static-code-based evaluation; real-user testing on stage is recommended for validation.*
