import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// Short build id so a tester can read which build is actually running on
// their device (commit sha + build date). Falls back gracefully if git or
// the CI env var is unavailable.
function buildId(): string {
  const sha =
    process.env.GITHUB_SHA ??
    (() => {
      try {
        return execSync('git rev-parse HEAD').toString().trim()
      } catch {
        return 'nogit'
      }
    })()
  const shortSha = sha.slice(0, 7)
  const date = new Date().toISOString().slice(0, 10)
  return `${shortSha}·${date}`
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_BUILD_MODE__: JSON.stringify(mode),
    __APP_BUILD_ID__: JSON.stringify(buildId()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon-32.png', 'favicon-64.png', 'apple-touch-icon.png', 'splash/*.png'],
      manifest: {
        name: 'GO-OUT',
        short_name: 'GO-OUT',
        description: 'Gamified savings battle for our Japan trip 2027.',
        theme_color: '#FBF6F0',
        background_color: '#FBF6F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
}))
