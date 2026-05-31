import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.goout.app',
  appName: 'GO-OUT',
  webDir: 'dist',
  android: {
    backgroundColor: '#FBF6F0',
  },
  // No server.url: the web bundle runs locally inside the APK (offline-capable).
};

export default config;
