/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        'bg-base': '#0d0d12',
        'bg-surface': '#16162a',
        'bg-hover': '#1e1e30',
        border: '#2a2a40',
        'text-primary': '#c8c8e8',
        'text-secondary': '#8888aa',
        'text-muted': '#5a5a80',
        'accent-gold': '#EF9F27',
        'accent-red': '#ff4444',
      },
    },
  },
  plugins: [],
}
