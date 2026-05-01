/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // PlayGuard brand colors (purple/cyan от твоя сайт)
        brand: {
          purple: '#8b5cf6',
          cyan: '#06b6d4'
        },
        bg: {
          DEFAULT: '#0a0a0f',
          panel: '#13131a',
          elevated: '#1a1a24'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}