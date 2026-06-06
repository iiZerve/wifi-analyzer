// WiFi Analyzer Configuration & Thresholds
// Phase 0 Foundation

const WIFI_THRESHOLDS = {
  WEAK_SIGNAL_DBM: -70,           // Below this = weak signal warning
  VERY_WEAK_SIGNAL_DBM: -80,      // Critical weak
  CONGESTION_THRESHOLD: 5,        // Number of strong networks on same channel to flag congestion
  STRONG_NETWORK_DBM: -60,        // dBm considered 'strong'
  MIN_5GHZ_SIGNAL_FOR_RECOMMEND: -65, // If 5GHz available and signal better than this, recommend switching from 2.4
};

const WIFI_BANDS = {
  BAND_2_4: '2.4',
  BAND_5: '5',
  BAND_6: '6'
};

const SECURITY_TYPES = {
  OPEN: 'Open',
  WEP: 'WEP',
  WPA: 'WPA/WPA2',
  WPA3: 'WPA3',
  ENTERPRISE: 'Enterprise'
};

export { WIFI_THRESHOLDS, WIFI_BANDS, SECURITY_TYPES };