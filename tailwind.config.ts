import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'headline': ['"Space Grotesk"', ...defaultTheme.fontFamily.sans],
        'body': ['"Manrope"', ...defaultTheme.fontFamily.sans],
        'label': ['"Space Grotesk"', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        primary: '#a1faff',
        secondary: '#c3f400',
        tertiary: '#ac89ff',
        error: '#ff716c',
        surface: '#0c0e12',
        'surface-container': '#171a1f',
        'surface-bright': '#292c33',
        'surface-variant': '#23262c',
        'outline-variant': '#46484d',
      },
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.8s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out infinite 1s',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-once': 'pulse 0.5s cubic-bezier(0.4, 0, 0.6, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(30px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.02)' },
        },
      },
      backdropBlur: {
        'xl': '20px',
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(0deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(255, 255, 255, 0.05) 25%, rgba(255, 255, 255, 0.05) 26%, transparent 27%, transparent 74%, rgba(255, 255, 255, 0.05) 75%, rgba(255, 255, 255, 0.05) 76%, transparent 77%, transparent)',
        'grid-pattern-size': '50px 50px',
      },
      backgroundSize: {
        'grid-pattern-size': '50px 50px',
      },
    },
  },
  plugins: [],
} satisfies Config;
