// Haptic feedback utility — uses Web Vibration API (works in Android WebView)
// Falls back to native bridge if available, no-ops silently otherwise

const PATTERNS = {
  light: [10],
  medium: [25],
  heavy: [50],
  success: [10, 50, 10],
  warning: [30, 40, 30],
  error: [50, 30, 50, 30, 50],
};

export function isHapticEnabled() {
  try {
    return localStorage.getItem('selah_haptic') !== 'off';
  } catch {
    return true;
  }
}

export function setHapticEnabled(enabled) {
  localStorage.setItem('selah_haptic', enabled ? 'on' : 'off');
}

export function haptic(type = 'light') {
  if (!isHapticEnabled()) return;

  const pattern = PATTERNS[type] || PATTERNS.light;

  // Try native bridge first (richer haptics on Android)
  if (window.AndroidHaptic?.vibrate) {
    try { window.AndroidHaptic.vibrate(JSON.stringify(pattern)); return; } catch {}
  }

  // Web Vibration API fallback (widely supported in Android WebView)
  if (navigator.vibrate) {
    try { navigator.vibrate(pattern); } catch {}
  }
}
