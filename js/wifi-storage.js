// WiFi Storage Layer - Enhanced for Phase 3 (History)

const STORAGE_KEYS = {
  SCAN_HISTORY: 'wifi_scan_history',
  SETTINGS: 'wifi_settings',
  LAST_SCAN: 'wifi_last_scan'
};

export function saveScan(scanResult, analysis = null) {
  try {
    const history = getScanHistory();

    const record = {
      ...scanResult,
      healthScore: analysis ? analysis.healthScore : null,
      savedAt: Date.now()
    };

    history.unshift(record);
    const trimmed = history.slice(0, 25); // keep last 25 scans
    localStorage.setItem(STORAGE_KEYS.SCAN_HISTORY, JSON.stringify(trimmed));
    localStorage.setItem(STORAGE_KEYS.LAST_SCAN, JSON.stringify(record));
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

export function clearHistory() {
  localStorage.removeItem(STORAGE_KEYS.SCAN_HISTORY);
  localStorage.removeItem(STORAGE_KEYS.LAST_SCAN);
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

export function getSettings() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? JSON.parse(data) : { autoScan: false };
  } catch (e) {
    return { autoScan: false };
  }
}