/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // Neutral surface palette tuned for a photo-viewer chrome
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          panel: 'var(--app-panel)',
          border: 'var(--app-border)',
          hover: 'var(--app-hover)',
          active: 'var(--app-active)',
          text: 'var(--app-text)',
          muted: 'var(--app-muted)',
          accent: 'var(--app-accent)'
        }
      },
      fontFamily: {
        sans: [
          '"Segoe UI"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Microsoft YaHei"',
          '"PingFang SC"',
          'system-ui',
          'sans-serif'
        ]
      }
    }
  },
  plugins: []
}
