/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        rounded: ['SF Pro Rounded', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        glass: {
          50: 'rgba(255,255,255,0.05)',
          100: 'rgba(255,255,255,0.08)',
          200: 'rgba(255,255,255,0.12)',
          300: 'rgba(255,255,255,0.18)',
          400: 'rgba(255,255,255,0.25)',
        },
        snake: {
          primary: '#00ff88',
          accent: '#00d4ff',
          danger: '#ff3b6b',
          warn: '#ffb800',
          bg: '#0a0a0f',
          surface: '#111118',
          elevated: '#1a1a24',
        },
      },
      backdropBlur: {
        xs: '4px',
        '2xl': '40px',
        '3xl': '60px',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
        'glass-lg': '0 16px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)',
        'glow-green': '0 0 20px rgba(0,255,136,0.3), 0 0 60px rgba(0,255,136,0.1)',
        'glow-red': '0 0 20px rgba(255,59,107,0.3), 0 0 60px rgba(255,59,107,0.1)',
        'glow-blue': '0 0 20px rgba(0,212,255,0.3), 0 0 60px rgba(0,212,255,0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'card-deal': 'cardDeal 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        cardDeal: {
          '0%': { transform: 'translateY(-100px) rotate(-15deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
