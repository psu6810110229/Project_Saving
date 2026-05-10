/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas:  '#FDFCFB',
        surface: '#F5F1EC',
        border:  '#E5DED6',
        terracotta: {
          DEFAULT: '#D4651A',
          600:     '#B85614',
          400:     '#E08246',
        },
        ink: {
          DEFAULT: '#2A2520',
          muted:   '#7A6E66',
          dim:     '#403A34',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: '12px',
        xl: '20px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(42,37,32,0.05), 0 4px 12px rgba(42,37,32,0.04)',
      },
    },
  },
  plugins: [],
}
