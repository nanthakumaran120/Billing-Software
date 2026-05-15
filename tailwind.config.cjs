// tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // enable class-based dark mode
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb', // indigo-600
          dark: '#1d4ed8', // indigo-700
        },
        background: {
          light: '#f8fafc',
          lighter: '#eef2ff',
          DEFAULT: '#ffffff',
        },
        text: {
          dark: '#0f172a',
          muted: '#334155',
          subtle: '#64748b',
        },
        border: '#e2e8f0',
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        premium: '0 4px 6px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
};
