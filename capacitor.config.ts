import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.leosaquetto.statslc',
  appName: 'stats.lc',
  webDir: 'dist',
  backgroundColor: '#000000',
  loggingBehavior: 'debug',
  server: {
    hostname: 'localhost',
    iosScheme: 'statslc',
  },
  ios: {
    backgroundColor: '#000000',
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: false,
      style: 'DARK',
      backgroundColor: '#000000',
    },
  },
};

export default config;
