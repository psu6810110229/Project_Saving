import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goout.app',
  appName: 'GO-OUT',
  webDir: 'dist',
  android: {
    backgroundColor: '#FBF6F0',
  },
  // No server.url: the web bundle runs locally inside the APK (offline-capable).
  plugins: {
    // OTA Live Updates (Capgo). With autoUpdate the app checks for a newer
    // web bundle on launch/resume and applies it on the next cold start, so
    // UI/bug fixes ship without a new APK. The app MUST call
    // CapacitorUpdater.notifyAppReady() once booted (see lib/liveUpdate.ts),
    // otherwise Capgo rolls back to the bundled version after a timeout.
    // Channel + credentials are configured in the Capgo dashboard / via the
    // Capgo CLI (`npx @capgo/cli`); no secrets live in this repo.
    CapacitorUpdater: {
      autoUpdate: true,
      resetWhenUpdate: true,
      directUpdate: true,
    },
  },
};

export default config;
