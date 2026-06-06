// WiFi Scanner Bridge
// This file acts as the interface between the UI and the native plugin.
// It currently uses a web mock for browser testing.
// When running on Android, the real WifiScanner plugin will be used automatically.

import { registerPlugin } from '@capacitor/core';

const WifiScanner = registerPlugin('WifiScanner', {
  web: () => import('./wifi-scanner-web').then(m => new m.WifiScannerWeb()),
});

/**
 * Perform a WiFi scan.
 * On Android: calls the native plugin
 * In browser: returns mock data
 */
export async function scanWifi() {
  try {
    const result = await WifiScanner.scanWifi();

    // Normalize data to ensure consistent structure
    if (!result.timestamp) result.timestamp = Date.now();

    // Ensure currentNetwork and nearbyNetworks exist
    if (!result.currentNetwork) result.currentNetwork = null;
    if (!Array.isArray(result.nearbyNetworks)) result.nearbyNetworks = [];

    return result;
  } catch (error) {
    console.error('WiFi scan failed:', error);
    throw new Error('Failed to scan WiFi. Please check permissions and try again.');
  }
}

/**
 * Check if WiFi is enabled (placeholder for future native implementation)
 */
export async function isWifiEnabled() {
  // TODO: Implement via native plugin when needed
  return true;
}