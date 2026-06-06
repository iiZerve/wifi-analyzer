// Web implementation for browser testing (mock data)
export class WifiScannerWeb {
  async scanWifi() {
    // Return realistic mock data for development
    return {
      timestamp: Date.now(),
      currentNetwork: {
        ssid: "DemoNet-5G",
        bssid: "AA:BB:CC:12:34:56",
        signalStrength: -58,
        frequency: 5745,
        channel: 149,
        band: "5",
        channelWidth: 80,
        security: "WPA3",
        isConnected: true
      },
      nearbyNetworks: Array.from({ length: 8 }, (_, i) => ({
        ssid: `Neighbor${i}`,
        bssid: `AA:BB:CC:00:00:${i}`,
        signalStrength: -45 - (i * 4),
        frequency: 5745,
        channel: 149,
        band: "5",
        channelWidth: 20,
        security: "WPA2",
        isConnected: false
      }))
    };
  }
}