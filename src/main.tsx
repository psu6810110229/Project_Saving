import { createRoot } from 'react-dom/client'
import './styles/global.css'

const isWidgetCapture = window.location.pathname.startsWith('/widget/')
const root = createRoot(document.getElementById('root')!)

if (isWidgetCapture) {
  console.log('[Widget] JS bundle executing:', window.location.pathname)
  // The widget route is rendered in a hidden WebView and captured to a bitmap.
  // index.html (and global.css) paint html/body/#root with an opaque #FBF6F0,
  // which fills the entire capture rectangle with sharp 90° corners. That solid
  // backing sits behind the rounded card, so the card's rounded corners reveal
  // cream instead of transparency — showing as a sharp-cornered light backing
  // on any launcher/size where the bitmap doesn't fully fill the cell. Force the
  // page surfaces transparent so only the card (with its baked-in rounded
  // corners) is captured; everything else stays transparent and reveals the
  // wallpaper. Inline styles override the stylesheet rules (none use !important).
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'
  const widgetRootEl = document.getElementById('root')
  if (widgetRootEl) widgetRootEl.style.background = 'transparent'
}

async function bootstrap() {
  if (isWidgetCapture) {
    const { WidgetCapture } = await import('./pages/WidgetCapture.tsx')
    root.render(<WidgetCapture />)
    return
  }

  const [
    { default: App },
    { registerAppServiceWorker },
    { notifyLiveUpdateReady },
  ] = await Promise.all([
    import('./App.tsx'),
    import('./lib/pwaUpdate.ts'),
    import('./lib/liveUpdate.ts'),
  ])

  registerAppServiceWorker()
  // Confirm the (possibly OTA-updated) bundle booted, so Capgo doesn't roll back.
  void notifyLiveUpdateReady()

  root.render(<App />)
}

void bootstrap()
