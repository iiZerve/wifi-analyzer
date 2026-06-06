import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zerve.wifianalyzer',
  appName: 'WiFi Analyzer',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  },
  // Plugins will be registered here after implementation
  plugins: {}
};

export default config;