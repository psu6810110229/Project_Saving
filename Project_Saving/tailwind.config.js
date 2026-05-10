/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas:  '#161311',
        surface: 'rgba(255, 255, 255, 0.05)',
        border:  'rgba(255, 255, 255, 0.1)',
        terracotta: {
          DEFAULT: 'rgba(212, 101, 26, 0.3)',
          600:     '#B85614',
          400:     '#E08246',
        },
        ink: {
          DEFAULT: '#FFFFFF',
          muted:   'rgba(255, 255, 255, 0.6)',
          dim:     'rgba(255, 255, 255, 0.4)',
        },
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '20px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42,37,32,0.05), 0 4px 12px rgba(42,37,32,0.04)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        }
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-right': 'slide-in-right 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
      }
    },
  },
  plugins: [],
}
