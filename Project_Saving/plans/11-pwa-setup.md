# Task 11 — PWA Setup (vite-plugin-pwa)

## Goal
Make the app installable to home screen with a custom icon, splash, and standalone display mode (no URL bar).

## Files Created / Edited
- `vite.config.ts` — register `VitePWA` plugin.
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` — branded icons.
- `public/apple-touch-icon.png` (180×180).
- `public/splash/*.png` — iOS splash screens (one per common size).
- `index.html` — `<link>` tags for apple-touch-icon and splash screens, theme-color meta.
- `src/main.tsx` — register service worker via plugin's virtual module.

## Dependencies (ask before installing)
- `vite-plugin-pwa`
- `workbox-window` (peer)

## vite.config.ts (sketch)
```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'splash/*.png'],
  manifest: {
    name: 'Project Saving',
    short_name: 'Saving',
    description: 'Gamified savings battle for our Japan trip 2027.',
    theme_color: '#D4651A',
    background_color: '#FDFCFB',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    scope: '/',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    navigateFallback: '/index.html',
    globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
  },
}),
```

## Icon Production Checklist
- Source: a single 1024×1024 PNG with safe area for maskable.
- Export 192, 512 (any), 512 (maskable with padding).
- 180×180 apple-touch-icon (iOS).
- Splash screens for at least: 1290×2796, 1179×2556, 828×1792, 750×1334.

## index.html additions
```html
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-startup-image" href="/splash/1290x2796.png" media="(...)">
<!-- repeat per size with media queries -->
```

## Service Worker Strategy
- `autoUpdate` so users get new versions on next reload without a prompt.
- Precache built assets; runtime cache Supabase API calls? **No** — auth+realtime data should NOT be cached. Configure Workbox to skip `*.supabase.co` URLs.

## Edge Cases / Risks
- iOS does not honor `manifest.json` for splash — must use `apple-touch-startup-image` link tags.
- Maskable icon must have safe-area padding (~10%) or it gets cropped on Android.
- Service worker caching can serve stale `index.html` on update → `autoUpdate` + `skipWaiting: true` handles it; users may see one flash of old content first.
- Don't cache Supabase auth responses — risk of leaking session across reinstalls.
- Test on actual iOS Safari + Android Chrome; desktop Lighthouse PWA audit alone is insufficient.

## Acceptance Criteria
- [ ] Lighthouse PWA audit ≥ 90.
- [ ] "Add to Home Screen" shows custom icon (Android + iOS).
- [ ] Launched from home screen runs in standalone mode (no URL bar).
- [ ] iOS shows custom splash on launch.
- [ ] Service worker does NOT cache Supabase API responses.
- [ ] Updating the deployed site causes installed PWA to refresh on next open.
