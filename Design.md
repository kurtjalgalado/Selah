# Selah Design System — "Sacred & Tech"

> **Version:** 1.0.0  
> **Status:** Active / Source of Truth  
> **Governing Skill:** Impeccable & UI-UX-Pro-Max  
> **Target:** Stage-Ready Ergonomics | 60fps Micro-Motion | WCAG AAA Contrast

---

## 1. Design Philosophy: "Sacred & Tech"

Selah's visual identity balances **liturgical reverence** (sacred, warm, contemplative) with **high-performance modern technology** (sleek, precise, Apple/Spotify-grade fluidity). 

The application is built primarily for worship leaders and musicians operating in dim, high-pressure live stage environments. Every design decision must serve glanceability, thumb ergonomics, zero distraction, and stage battery efficiency.

---

## 2. Color Token Architecture

The color system uses CSS custom properties (`:root`) with full dark/light mode switching and OLED stage optimization.

### A. Dark Mode Palette (Default / Stage Performance)

```css
:root {
  /* Surfaces */
  --bg-primary: #000000;          /* True Stage OLED Pitch Black: zero ambient light, max battery savings */
  --bg-secondary: #0A0A0C;        /* Deep Obsidian: secondary background, card base */
  --bg-elevated: #111114;         /* Elevated Obsidian: modals, dropdowns, floating sheets */
  
  /* Brand Accents */
  --accent: #D4AF37;              /* Liturgical Gold: primary CTA, active tab, key badges, chord highlights */
  --accent-soft: rgba(212, 175, 55, 0.15); /* Soft Gold Wash: selected item background, chip fills */
  --text-onaccent: #000000;       /* High-contrast black on bright gold buttons */

  /* Active Service Status */
  --active-service-bg: rgba(6, 78, 59, 0.35); /* Service in session background */
  --active-service-border: rgba(16, 185, 129, 0.5); /* Emerald border highlight */
  --active-service-text: #34D399; /* Vibrant emerald status indicator */
  --active-service-badge: rgba(16, 185, 129, 0.2);

  /* Typography & Contrast */
  --text-primary: #F0F0F5;        /* Crisp stage white: effortless glanceability under stage lighting */
  --text-muted: #8892B0;          /* Slate secondary: metadata, tempos, artist names, subtitles */

  /* Functional States */
  --success: #64FFDA;             /* Soft cyan / green: confirm, success toast */
  --danger: #FF6B6B;              /* Warm coral / red: delete, error alert */

  /* Borders & Glass */
  --border: rgba(255, 255, 255, 0.07); /* Ultra-fine divider: structure without visual noise */
  --glass-bg: rgba(0, 0, 0, 0.88);     /* Translucent blur backdrop for stage docks and navigation */
  --surface-hover: rgba(255, 255, 255, 0.06);
  --surface-active: rgba(255, 255, 255, 0.12);
}
```

### B. Light Mode Adaptation (Office / Planning Mode)

```css
:root.light {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F4F4F7;
  --bg-elevated: #FFFFFF;
  --accent: #9E7A12;
  --accent-soft: rgba(158, 122, 18, 0.12);
  --text-primary: #111118;
  --text-muted: #626A84;
  --success: #0D9668;
  --danger: #E53E3E;
  --border: rgba(0, 0, 0, 0.06);
  --glass-bg: rgba(255, 255, 255, 0.88);
  --surface-hover: rgba(0, 0, 0, 0.04);
  --surface-active: rgba(0, 0, 0, 0.08);
  --text-onaccent: #FFFFFF;
}
```

---

## 3. The Three-Tier Typography System

Typography must strictly follow these tier assignments. Mixing these roles is strictly forbidden.

| Tier | Font Family | Fallback | Scope & Rules |
|:---|:---|:---|:---|
| **1. Sacred / Hymnal** | **Cormorant Garamond** (`font-serif`) | `Georgia, serif` | **Used for:** App logo text, song titles in detail headers, modal title banners, hymnal section dividers. Brings liturgical warmth and dignity. |
| **2. UI Controls & Body** | **Inter** (`font-sans`) | `system-ui, sans-serif` | **Used for:** Navigation bars, search inputs, list items, buttons, artist names, badge labels, settings. Optimized for high-density mobile scanning. |
| **3. Chords & Notation** | **JetBrains Mono** (`font-mono`) | `Courier New, monospace` | **NON-NEGOTIABLE:** Strictly used for ALL chord annotations (`[G]`, `[Em7]`, `[D/F#]`), musical keys (`Key of D`), transposer controls, tempo BPM, time signatures (`4/4`). Fixed-width monospace guarantees chords align syllable-by-syllable over lyrics without drift. |

### Typography Scale & Utility Hierarchy
- **Display 1 (Song Title Header):** `text-2xl md:text-3xl font-serif font-bold text-textprimary`
- **Section Heading:** `text-xs font-sans uppercase tracking-widest text-textmuted font-semibold`
- **Body Regular:** `text-sm font-sans text-textprimary leading-relaxed`
- **Chord Sheet Lyrics:** `text-base font-sans text-textprimary leading-loose`
- **Chord Notation:** `text-base font-mono font-bold text-accent tracking-wide`
- **Badge / Chip Text:** `text-xs font-mono font-semibold`

---

## 4. Spacing, Ergonomics & Touch Targets

### A. 44px Minimum Touch Targets (Non-Negotiable)
Every interactive element (buttons, tabs, icons, quick-action chips) must maintain at least `min-h-[44px] min-w-[44px]` bounding boxes. Small icon buttons must pad their clickable area even if visual icon size is 20px–24px.

### B. Thumb-Zone Hierarchy
- **Primary Stage Controls:** Placed at the bottom edge within effortless single-hand thumb reach (Floating Stage Dock, Auto-Scroll toggle, Transpose buttons, Next/Prev song).
- **Secondary Actions:** Centered or anchored to slide-out drawers.
- **Destructive / Rare Actions:** Shifted to upper corners or inside confirmation modals.

### C. Safe Area Insets (Capacitor Mobile Standard)
- Top Navbars: `pt-[max(env(safe-area-inset-top),16px)]`
- Bottom Navigation & Stage Dock: `pb-[max(env(safe-area-inset-bottom),16px)]`
- Left/Right Margins: `px-4 sm:px-6`

---

## 5. Component Design Standards

### 5.1 Floating Stage Dock (`SetlistPlayerScreen`, `SongDetailScreen`)
- **Container:** Glassmorphic pill/dock anchored `bottom-4 inset-x-4 max-w-lg mx-auto`.
- **Styling:** `background: var(--glass-bg)`, `backdrop-filter: blur(12px)`, `border: 1px solid var(--border)`.
- **Controls:** Auto-scroll play/pause button (large liturgical gold circle), speed slider, font-size stepper (`A-` / `A+`), transpose toggle, and lyrics-only mode switch.

### 5.2 Chord Line Renderer (`ChordLineRenderer.jsx`)
- Chords render directly above lyrics with optical baseline alignment.
- Always use `font-mono text-accent font-bold`.
- Lyrics render in `font-sans text-textprimary`.
- Never wrap chords onto multiple lines independent of their corresponding lyric syllables.

### 5.3 Apple-Style Segmented Control (`AppleSegmentedControl.jsx`)
- Enclosed rounded pill track with smooth animated indicator pill sliding beneath the active tab.
- Active tab text: `text-textprimary font-medium`.
- Inactive tab text: `text-textmuted hover:text-textprimary`.

### 5.4 Bottom Sheets & Modals (`ScheduleBottomSheet.jsx`, `AssignMinisterBottomSheet.jsx`)
- Touch handle at top center: `w-12 h-1.5 rounded-full bg-border mx-auto mb-4`.
- Rounded top corners: `rounded-t-3xl`.
- Background: Elevated obsidian (`--bg-elevated`).

### 5.5 Skeleton Loaders (`SkeletonLoader.jsx`)
- Replace blank screens with pulsing shimmer skeletons matching exact component geometries (SongCard skeleton, Player skeleton, Detail skeleton).
- Background: `bg-secondary animate-pulse rounded-xl`.

---

## 6. Motion & Micro-Interaction Guidelines

### 6.1 Hardware-Accelerated 60fps Motion
- **Allowed properties for animations:** ONLY `transform` (`translate3d`, `scale`) and `opacity`.
- **Strictly Forbidden:** Animating `top`, `bottom`, `left`, `right`, `width`, `height`, `margin`, or `padding` directly (causes mobile layout thrashing).

### 6.2 Tactile Tap States (`.btn-interact`)
- All touch buttons must implement immediate tactile scale compression:
  ```css
  .btn-interact {
    transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease;
    will-change: transform;
  }
  .btn-interact:active {
    transform: scale(0.96);
  }
  ```

### 6.3 Auto-Scroll Physics
- Continuous stage scrolling uses `window.scrollBy({ top: speed, behavior: 'auto' })` on requestAnimationFrame intervals.
- Never use `behavior: 'smooth'` inside repetitive frame loops to avoid laggy event queue buildup.

### 6.4 Reduced Motion Safety
- Always respect `@media (prefers-reduced-motion: reduce)`:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```

---

## 7. Print System Design (`@media print`)

When worship leaders print setlists for traditional music binders:
- **Background:** Pure White `#FFFFFF` (ink-saving).
- **Text & Chords:** Pitch Black `#000000` with high-contrast bold chords.
- **Layouts Supported:**
  - **1-Column:** Wide chord charts for single complex songs.
  - **2-Column:** Compact dual-column A4 format to fit 2 songs per sheet.
- **Suppression:** Hide all navigation bars, stage docks, floating action buttons, and backdrops.
