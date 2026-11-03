---
name: ui-animation
description: >-
  Hardware-accelerated mobile animations, stage transitions, and physics-based micro-interactions.
  Enforces 60fps performance, GPU-friendly transforms/opacity, tactile haptic feedback,
  smooth auto-scrolling, drawer gestures, and prefers-reduced-motion safety.
---

# UI Animation: 60fps Mobile Stage & Micro-Interactions

This skill governs fluid, native-feeling motion and animation across Selah. It prevents animation stutter, layout thrashing, and disorientation during live stage performances.

## 1. Golden Rules of 60fps Motion

### Never Trigger Layout or Repaint in Animations
- **Allowed properties for animation:** `transform` (`translate3d`, `scale`, `rotate`) and `opacity`.
- **FORBIDDEN in animations:** `top`, `bottom`, `left`, `right`, `width`, `height`, `margin`, `padding`, `filter` (blur animations cause heavy mobile GPU thrashing).
- Always use `will-change: transform` or `transform: translateZ(0)` sparingly on actively animating elements to promote them to GPU layers, removing it once animation settles.

## 2. Selah Micro-Interactions & Physics

### A. Tactile Tap Feedback (`.btn-interact`)
- Every touchable card and button must respond instantly to touch:
  ```css
  .btn-interact {
    transition: transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.15s ease;
  }
  .btn-interact:active {
    transform: scale(0.96);
  }
  ```
- Pair with mobile haptics (`triggerHapticLight()`) on key actions like key transposition, favorite toggle, and chord-size adjustments.

### B. Stage Auto-Scroll Physics
- Continuous stage scrolling must use smooth `window.scrollBy({ top: speed, behavior: 'auto' })` on requestAnimationFrame intervals.
- Never use `behavior: 'smooth'` in repetitive 60hz intervals, as browser smoothing queues create laggy rubber-banding.
- Pauses must decelerate smoothly rather than snapping instantly.

### C. Bottom Sheet & Modal Entrances
- Bottom sheets slide in from `translateY(100%)` to `translateY(0)` with Apple-like spring cubic-bezier: `cubic-bezier(0.32, 0.72, 0, 1)`.
- Backdrop opacity transitions from `0` to `0.88` with backdrop blur.

### D. Accessibility & Reduced Motion
- ALWAYS respect users' motion preferences:
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
