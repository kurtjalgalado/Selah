/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#0F1115',
        secondary: '#16213E',
        elevated: '#1A1D29',
        accent: '#D4AF37',
        'accent-soft': 'rgba(212, 175, 55, 0.15)',
        textmuted: '#8892B0',
        success: '#64FFDA',
        danger: '#FF6B6B',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'serif'],
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
