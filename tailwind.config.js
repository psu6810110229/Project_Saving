/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Canvas + surfaces (warm cream / peach)
        bg: '#FBF6F0',   // page canvas, very warm off-white
        surface: '#FFFFFF',   // raised neumorphic card
        surfaceAlt: '#FDF2E9',   // peach inset / "well" / accent card
        well: '#F1E7DC',   // recessed input track
        // Ink scale (dark cocoa — NOT pure black)
        ink: {
          DEFAULT: '#2A1A0E',
          muted: '#7A6A5E',
          dim: '#B5A496',
          inverse: '#FFFFFF',
        },
        // Brand: warm terracotta / orange
        brand: {
          50: '#FDF2E9',
          100: '#FAD9BD',
          200: '#F4B98A',
          300: '#ED9659',
          400: '#E08246',
          500: '#F26B1A',   // bright "action" orange (Confirm CTA)
          600: '#D4651A',   // PWA theme_color (preserved)
          700: '#B85614',
          800: '#8E3F0D',   // deep terracotta-brown (logotype, primary CTA)
          900: '#5C2807',
        },
        accent: {
          gold: '#C99B3E',
          leaf: '#7A8C5A',
          slate: '#5C6B7A',   // alt theme swatch
          teal: '#2EA079',   // alt theme swatch
        },
        danger: {
          DEFAULT: '#B3331E',
          soft: '#FBE3DF',
        },
      },
      fontFamily: {
        // Typewriter slab face for headings + branded surfaces (matches mockups).
        // IBM Plex Sans Thai is included in the stack so Thai characters
        // inside headings (room name, display name) get native glyphs
        // instead of falling back to the browser default.
        mono: ['"IBM Plex Mono"', '"IBM Plex Sans Thai"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        // Sans fallback for long-form body text + Thai labels.
        sans: ['"IBM Plex Sans"', '"IBM Plex Sans Thai"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '14px',
        xl: '20px',
        '2xl': '24px',
        '3xl': '32px',
        pill: '9999px',
      },
      boxShadow: {
        // Soft warm cocoa-tinted shadows
        soft: '0 1px 2px rgba(58,42,31,0.06), 0 4px 12px rgba(58,42,31,0.05)',
        // Neumorphic raised card (dual: warm cocoa down-right + white inner light)
        neuRaised: '6px 6px 14px rgba(58,42,31,0.08), -4px -4px 12px rgba(255,255,255,0.85)',
        // Neumorphic pressed input
        neuPressed: 'inset 4px 4px 8px rgba(58,42,31,0.08), inset -3px -3px 6px rgba(255,255,255,0.9)',
        // Halo glow around active "Confirm" CTA in deposit flow
        haloOrange: '0 12px 32px -8px rgba(242,107,26,0.50), 0 4px 12px -4px rgba(242,107,26,0.35)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.94)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'fill-bar': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--target-width, 100%)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.35s ease-out both',
        'scale-in': 'scale-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fill-bar': 'fill-bar 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
