import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.tsx'
import { registerAppServiceWorker } from './lib/pwaUpdate.ts'
import { notifyLiveUpdateReady } from './lib/liveUpdate.ts'

registerAppServiceWorker()
// Confirm the (possibly OTA-updated) bundle booted, so Capgo doesn't roll back.
void notifyLiveUpdateReady()

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
    <App />
  // </StrictMode>
)
