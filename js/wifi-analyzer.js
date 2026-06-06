// WiFi Analysis Engine
// Core intelligence layer: analyze scans, detect issues, generate feedback, calculate health score

// Data Models (TypeScript-style, implemented with JSDoc for .js)

/**
 * @typedef {Object} WiFiNetwork
 * @property {string} ssid
 * @property {string} bssid
 * @property {number} signalStrength - dBm
 * @property {number} frequency - MHz
 * @property {number} channel
 * @property {'2.4'|'5'|'6'} band
 * @property {number} channelWidth - MHz
 * @property {string} security
 * @property {boolean} isConnected
 */

/**
 * @typedef {Object} WiFiScanResult
 * @property {number} timestamp
 * @property {WiFiNetwork|null} currentNetwork
 * @property {WiFiNetwork[]} nearbyNetworks
 * @property {number} [healthScore]
 * @property {string[]} [issues]
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {number} healthScore
 * @property {string[]} issues
 * @property {string[]} feedback
 */

import { WIFI_THRESHOLDS } from './config.js';

/**
 * Analyze a scan result and return detected issues + health score
 * @param {WiFiScanResult} result
 * @returns {AnalysisResult}
 */
export function analyzeScan(result) {
  const issues = [];
  let score = 100;

  if (!result || !result.nearbyNetworks) {
    return { healthScore: 0, issues: ['no_data'], feedback: ['Unable to retrieve WiFi data.'] };
  }

  const { currentNetwork, nearbyNetworks } = result;

  // Rule 1: Weak signal on current network
  if (currentNetwork && currentNetwork.signalStrength < WIFI_THRESHOLDS.WEAK_SIGNAL_DBM) {
    issues.push('weak_signal');
    score -= 25;
  }

  // Rule 2: Channel congestion (count strong networks on same channel as current)
  if (currentNetwork) {
    const sameChannelStrong = nearbyNetworks.filter(n => 
      n.channel === currentNetwork.channel && 
      n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM &&
      n.bssid !== currentNetwork.bssid
    );
    if (sameChannelStrong.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
      issues.push('channel_congestion');
      score -= 20;
    }
  }

  // Rule 3: Using 2.4 GHz when decent 5 GHz is available
  if (currentNetwork && currentNetwork.band === '2.4') {
    const good5GHz = nearbyNetworks.find(n => 
      n.band === '5' && n.signalStrength > WIFI_THRESHOLDS.MIN_5GHZ_SIGNAL_FOR_RECOMMEND
    );
    if (good5GHz) {
      issues.push('using_2_4_when_5_available');
      score -= 15;
    }
  }

  // Rule 4: Connected to open/unsecured network
  if (currentNetwork && (currentNetwork.security === 'Open' || currentNetwork.security.toLowerCase().includes('open'))) {
    issues.push('open_network');
    score -= 30;
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks);

  return {
    healthScore: Math.round(score),
    issues,
    feedback
  };
}

/**
 * Generate plain English feedback from detected issues
 * @param {string[]} issues
 * @param {WiFiNetwork|null} current
 * @param {WiFiNetwork[]} nearby
 * @returns {string[]}
 */
export function generateFeedback(issues, current, nearby) {
  const feedback = [];

  if (issues.includes('weak_signal') && current) {
    feedback.push(`Your current network "${current.ssid}" has a weak signal (${current.signalStrength} dBm). Move closer to the router or consider a WiFi extender/mesh system.`);
  }

  if (issues.includes('channel_congestion') && current) {
    const sameChannel = nearby.filter(n => n.channel === current.channel).length;
    feedback.push(`Channel ${current.channel} is congested with ${sameChannel} networks. Consider switching your router to channel 1, 6, or 11 (2.4 GHz) or a less crowded 5 GHz channel.`);
  }

  if (issues.includes('using_2_4_when_5_available')) {
    feedback.push('You are connected to 2.4 GHz but a strong 5 GHz network is available. Switch to 5 GHz for better speed and less interference (if your device and router support it).');
  }

  if (issues.includes('open_network')) {
    feedback.push('Warning: You are connected to an open (unsecured) network. Avoid sensitive activities like banking or logging into accounts.');
  }

  if (issues.length === 0) {
    feedback.push('Your WiFi environment looks healthy. No major issues detected.');
  }

  return feedback;
}

/**
 * Calculate overall WiFi Health Score (0-100)
 * @param {WiFiScanResult} result
 * @returns {number}
 */
export function calculateHealthScore(result) {
  const analysis = analyzeScan(result);
  return analysis.healthScore;
}

// Re-export for convenience
export { analyzeScan, generateFeedback, calculateHealthScore };