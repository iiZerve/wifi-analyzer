// WiFi Scanner Bridge Layer
// Real implementation using custom Capacitor native plugin (no mocks in main flow).
// Relies on the global window.Capacitor injected by the native bridge.

export async function scanWifi() {
  try {
    const cap = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : null;

    let result;

    if (cap && typeof cap.nativePromise === 'function') {
      result = await cap.nativePromise('WifiScanner', 'scanWifi', {});
    } else if (cap && cap.Plugins && cap.Plugins.WifiScanner && typeof cap.Plugins.WifiScanner.scanWifi === 'function') {
      result = await cap.Plugins.WifiScanner.scanWifi();
    } else if (cap && typeof cap.registerPlugin === 'function') {
      const proxy = cap.registerPlugin('WifiScanner');
      if (proxy && typeof proxy.scanWifi === 'function') {
        result = await proxy.scanWifi();
      }
    }

    if (!result) {
      throw new Error('Real WiFi scanning requires the Android app (Capacitor native bridge).');
    }

    if (result.success === false) {
      const msg = result.message || result.error || 'Unknown failure from native WiFi scan';
      throw new Error(msg);
    }

    // Normalize (real data only). Native provides currentNetwork when the device is connected.
    const rawNetworks = (result.networks || []).map(n => ({
      ssid: n.ssid || '<hidden>',
      bssid: n.bssid || '',
      signalStrength: (typeof n.signal === 'number' ? n.signal : (n.signalStrength || -99)),
      signal: (typeof n.signal === 'number' ? n.signal : (n.signalStrength || -99)),
      frequency: n.frequency || 0,
      channel: n.channel || 0,
      channelWidth: n.channelWidth || 0,
      security: n.security || ((n.capabilities || '').includes('WPA') || (n.capabilities || '').includes('WEP') || (n.capabilities || '').includes('SAE') ? 'Secured' : 'Open'),
      capabilities: n.capabilities || '',
      band: n.band || (n.frequency >= 5170 && n.frequency <= 5825 ? '5' : (n.frequency >= 5925 ? '6' : (n.frequency >= 2412 && n.frequency <= 2484 ? '2.4' : 'unknown')))
    }));

    let currentNetwork = result.currentNetwork || null;

    // Enrich / normalize currentNetwork from native (handles Android 10+ redacted SSID cases like "<unknown ssid>" or "<connected>")
    if (currentNetwork && currentNetwork.bssid) {
      const match = rawNetworks.find(n => n.bssid && n.bssid.toLowerCase() === String(currentNetwork.bssid).toLowerCase());
      if (match) {
        currentNetwork = { 
          ...match, 
          ...currentNetwork, 
          signalStrength: (typeof currentNetwork.signalStrength === 'number' ? currentNetwork.signalStrength : match.signalStrength),
          ssid: (currentNetwork.ssid && currentNetwork.ssid !== '<connected>' && currentNetwork.ssid !== '<unknown>') 
                ? currentNetwork.ssid 
                : (match.ssid || currentNetwork.ssid || '<connected>')
        };
      }
      if (currentNetwork.isConnected !== false) {
        currentNetwork.isConnected = true;
      }
    }

    const normalized = {
      timestamp: result.lastScanTimestamp || Date.now(),
      lastScanTimestamp: result.lastScanTimestamp || Date.now(),
      count: result.count || 0,
      scanStarted: result.scanStarted || false,
      nearbyNetworks: rawNetworks,
      currentNetwork: currentNetwork || null,
      // New data points
      totalNearbyNetworks: rawNetworks.length,
      networksOnCurrentChannel: 0,
      bestAlternativeNetwork: null,
      bandSplit: { '2.4': 0, '5': 0, '6': 0 },
      channelCongestionLevel: 'Low'
    };

    if (currentNetwork && currentNetwork.channel) {
      const ch = currentNetwork.channel;
      const onCh = rawNetworks.filter(n => n.channel === ch && n.bssid !== currentNetwork.bssid);
      normalized.networksOnCurrentChannel = onCh.length;

      const others = rawNetworks.filter(n => n.bssid !== (currentNetwork.bssid || ''));
      if (others.length > 0) {
        normalized.bestAlternativeNetwork = others.reduce((a, b) => (b.signalStrength > a.signalStrength ? b : a), others[0]);
      }

      if (normalized.networksOnCurrentChannel >= 5) normalized.channelCongestionLevel = 'High';
      else if (normalized.networksOnCurrentChannel >= 3) normalized.channelCongestionLevel = 'Medium';
    }

    rawNetworks.forEach(n => {
      if (n.band === '2.4') normalized.bandSplit['2.4']++;
      else if (n.band === '5') normalized.bandSplit['5']++;
      else if (n.band === '6') normalized.bandSplit['6']++;
    });

    return normalized;
  } catch (error) {
    // Keep one clean error path for user-visible messages
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
