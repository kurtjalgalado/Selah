/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: 'var(--bg-primary)',
        secondary: 'var(--bg-secondary)',
        elevated: 'var(--bg-elevated)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        textprimary: 'var(--text-primary)',
        textmuted: 'var(--text-muted)',
        success: 'var(--success)',
        danger: 'var(--danger)',
        themed: 'var(--border)',
        'surface-hover': 'var(--surface-hover)',
        'surface-active': 'var(--surface-active)',
        onaccent: 'var(--text-onaccent)',

        // Active Service Highlight colors
        'activeservice-bg': 'var(--active-service-bg)',
        'activeservice-border': 'var(--active-service-border)',
        'activeservice-text': 'var(--active-service-text)',
        'activeservice-badge': 'var(--active-service-badge)',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

