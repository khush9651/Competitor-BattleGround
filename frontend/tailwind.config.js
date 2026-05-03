import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#0c1222',
          card: '#0f172a',
          raised: '#111c33',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(99, 102, 241, 0.25)',
        'glow-sm': '0 0 24px rgba(99, 102, 241, 0.2)',
        cta: '0 4px 24px rgba(99, 102, 241, 0.45)',
      },
      keyframes: {
        stepIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        'step-in': 'stepIn 0.5s ease-out forwards',
        'pulse-soft': 'pulseSoft 1.8s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [typography],
};
