// WiFi Scanner Bridge Layer
// Real implementation using custom Capacitor native plugin (no mocks in main flow)

import { registerPlugin } from '@capacitor/core';

const WifiScanner = registerPlugin('WifiScanner');

export async function scanWifi() {
  try {
    const cap = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : null;
    if (!cap || !cap.Plugins || !cap.Plugins.WifiScanner) {
      // Browser / no native: clear error per plan (no simulated data)
      throw new Error('Real WiFi scanning requires the Android app (Capacitor native bridge). This feature is not available when running in browser or without the native plugin.');
    }

    const result = await WifiScanner.scanWifi();
    if (!result || result.success === false) {
      const msg = (result && (result.message || result.error)) || 'Unknown scan failure';
      throw new Error(msg);
    }

    // Normalize to target's expected fields (signalStrength) while keeping 'signal' for compatibility
    const normalized = {
      timestamp: result.lastScanTimestamp || Date.now(),
      lastScanTimestamp: result.lastScanTimestamp || Date.now(),
      count: result.count || 0,
      scanStarted: result.scanStarted || false,
      nearbyNetworks: (result.networks || []).map(n => ({
        ssid: n.ssid || '<hidden>',
        bssid: n.bssid || '',
        signalStrength: (typeof n.signal === 'number' ? n.signal : (n.signalStrength || -99)),
        signal: (typeof n.signal === 'number' ? n.signal : (n.signalStrength || -99)),
        frequency: n.frequency || 0,
        channel: n.channel || 0,
        channelWidth: n.channelWidth || 0,
        security: (n.capabilities || '').includes('WPA') || (n.capabilities || '').includes('WEP') || (n.capabilities || '').includes('SAE') ? 'Secured' : 'Open',
        capabilities: n.capabilities || ''
      }))
    };

    // For now, no currentNetwork auto-detect (can be added later); leave null or derive if needed by caller
    normalized.currentNetwork = null;

    return normalized;
  } catch (error) {
    console.error('WiFi scan failed:', error);
    throw error;
  }
}

/**
 * Check if WiFi is enabled (stub for future)
 */
export async function isWifiEnabled() {
  // TODO: implement via plugin or WifiManager
  return true;
}

// Web implementation stub removed per plan (no simulated/mock data in main flows).
// Browser will throw clear error above.