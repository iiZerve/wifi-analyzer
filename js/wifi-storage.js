// WiFi Storage Layer
// Handles saving/loading scan history and settings using localStorage (can be upgraded to Capacitor Preferences later)

const STORAGE_KEYS = {
  SCAN_HISTORY: 'wifi_scan_history',
  SETTINGS: 'wifi_settings',
  LAST_SCAN: 'wifi_last_scan'
};

/**
 * Save a new scan result to history
 * @param {Object} scanResult - WiFiScanResult object
 */
export function saveScan(scanResult) {
  try {
    const history = getScanHistory();
    history.unshift(scanResult); // newest first
    // Limit to last 20 scans
    const trimmed = history.slice(0, 20);
    localStorage.setItem(STORAGE_KEYS.SCAN_HISTORY, JSON.stringify(trimmed));
    localStorage.setItem(STORAGE_KEYS.LAST_SCAN, JSON.stringify(scanResult));
  } catch (e) {
    console.error('Failed to save scan:', e);
  }
}

export function getScanHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SCAN_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

export function getLastScan() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LAST_SCAN);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { autoScan: false, notifications: true };
  } catch (e) {
    return { autoScan: false, notifications: true };
  }
}

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEYS.SCAN_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.LAST_SCAN);
}