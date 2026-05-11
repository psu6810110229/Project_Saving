# Task 2 — Minimal-Terracotta Design System in Tailwind

## Goal
Encode the visual language (colors, typography, spacing) once in `tailwind.config.ts` so every component pulls from semantic tokens — never hard-coded hex.

## Files Edited / Created
- `tailwind.config.ts` (extend theme)
- `src/styles/global.css` (base resets + body defaults — NO @import here)
- `index.html` (preconnect + `<link>` stylesheet for Google Fonts — do NOT use @import in CSS, PostCSS conflicts with @tailwind directives)
- `src/types/index.ts` (optional: shared `ColorToken` type if needed later)

## tailwind.config.ts — `theme.extend`
```ts
colors: {
  canvas:    '#FDFCFB',  // app background (warm off-white)
  surface:   '#F5F1EC',  // cards / elevated surface
  terracotta:{
    DEFAULT:'#D4651A',
    600:    '#B85614',
    400:    '#E08246',
  },
  ink: {
    DEFAULT:'#2A2520',   // primary text (dark charcoal, NOT pure black)
    muted:  '#7A6E66',
    dim:    '#403A34',
  },
  border:    '#E5DED6',
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
spacing: {
  // keep Tailwind defaults; only add if a real need arises
},
```

## src/styles/global.css
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root { height: 100%; }
  body {
    @apply bg-canvas text-ink font-sans antialiased;
  }
  h1,h2,h3 { @apply font-semibold; }
}
```

## index.html
- Add `<link rel="preconnect" href="https://fonts.googleapis.com">` and `gstatic` preconnect for faster font load.
- Set `<meta name="theme-color" content="#D4651A">` (used later for PWA too).

## Demo Update in App.tsx
Show one example of each token (canvas bg, terracotta button, ink/muted text) so the developer can visually verify tokens render correctly. Remove demo before Task 5 begins.

## Dependencies
- None new.

## Edge Cases / Risks
- Don't put tokens in CSS variables AND Tailwind theme — pick Tailwind theme as the single source. CSS vars only if a runtime theme switch is added later (out of scope).
- Inter font may flash on slow networks → `font-display: swap` (Google Fonts default) is fine.
- Tailwind purge: ensure `content` glob includes every place utilities can appear (already done in Task 1).

## Acceptance Criteria
- [ ] `bg-canvas`, `text-ink`, `bg-terracotta`, `text-ink-muted`, `font-sans` all work in JSX.
- [ ] No hardcoded hex colors anywhere except `tailwind.config.ts`.
- [ ] Inter font is rendered (visible in DevTools Network tab and on screen).
- [ ] Body background is warm off-white, not pure white.
- [ ] `theme-color` meta tag present.
