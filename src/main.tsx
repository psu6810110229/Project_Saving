import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { WidgetCapture } from './pages/WidgetCapture.tsx'
import { registerAppServiceWorker } from './lib/pwaUpdate.ts'
import { notifyLiveUpdateReady } from './lib/liveUpdate.ts'

const isWidgetCapture = window.location.pathname.startsWith('/widget/')

if (isWidgetCapture) {
  console.log('[Widget] JS bundle executing:', window.location.pathname)
}

if (!isWidgetCapture) {
  registerAppServiceWorker()
  // Confirm the (possibly OTA-updated) bundle booted, so Capgo doesn't roll back.
  void notifyLiveUpdateReady()
}

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    isWidgetCapture ? <WidgetCapture /> : <App />
  // </StrictMode>
)
