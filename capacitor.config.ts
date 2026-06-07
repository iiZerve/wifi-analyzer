import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zerve.wifianalyzer',
  appName: 'WiFi Analyzer',
  webDir: 'www',
  // Versioning is primarily managed in android/app/build.gradle for the Android build.
  // Starting values for Play Store release: versionCode 1, versionName "1.0.0"
  server: {
    androidScheme: 'https'
  },
  // Note: Custom native plugin (WifiScanner) is manually registered in MainActivity.java via registerPlugin.
  // The plugins section below is primarily for JS/web plugins. Name kept in sync with @CapacitorPlugin(name="WifiScanner").
  plugins: {
    WifiScanner: {}
  }
};

export default config;