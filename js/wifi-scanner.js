// WiFi Scanner Bridge Layer
// Interface to the custom Capacitor native plugin

import { registerPlugin } from '@capacitor/core';

/**
 * WifiScanner plugin interface
 * This will be implemented by the native Android plugin in Phase 1
 */
const WifiScanner = registerPlugin('WifiScanner', {
  web: () => import('./wifi-scanner-web').then(m => new m.WifiScannerWeb()),
});

/**
 * Perform a WiFi scan
 * @returns {Promise<WiFiScanResult>}
 */
export async function scanWifi() {
  try {
    const result = await WifiScanner.scanWifi();
    // Add timestamp if not present
    if (!result.timestamp) {
      result.timestamp = Date.now();
    }
    return result;
  } catch (error) {
    console.error('WiFi scan failed:', error);
    throw error;
  }
}

/**
 * Check if WiFi is enabled (stub for future)
 */
export async function isWifiEnabled() {
  // TODO: implement via plugin
  return true;
}

// Web implementation stub (for browser testing)
export class WifiScannerWeb {
  async scanWifi() {
    // In browser, return mock data for development
    return {
      timestamp: Date.now(),
      currentNetwork: null,
      nearbyNetworks: [
        { ssid: 'MockNet-5G', bssid: '00:11:22:33:44:55', signalStrength: -45, frequency: 5745, channel: 149, band: '5', channelWidth: 80, security: 'WPA3', isConnected: false },
        { ssid: 'MockNet-2.4', bssid: '00:11:22:33:44:66', signalStrength: -62, frequency: 2437, channel: 6, band: '2.4', channelWidth: 20, security: 'WPA2', isConnected: true }
      ]
    };
  }
}