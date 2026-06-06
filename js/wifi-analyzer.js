// WiFi Analysis Engine - Phases 2+ Implementation
// Enhanced with additional detection rules and better scoring

import { WIFI_THRESHOLDS } from './config.js';

/**
 * @typedef {Object} WiFiNetwork
 * @property {string} ssid
 * @property {string} bssid
 * @property {number} signalStrength
 * @property {number} frequency
 * @property {number} channel
 * @property {'2.4'|'5'|'6'} band
 * @property {number} channelWidth
 * @property {string} security
 * @property {boolean} isConnected
 */

/**
 * @typedef {Object} WiFiScanResult
 * @property {number} timestamp
 * @property {WiFiNetwork|null} currentNetwork
 * @property {WiFiNetwork[]} nearbyNetworks
 */

/**
 * @typedef {Object} AnalysisResult
 * @property {number} healthScore
 * @property {string[]} issues
 * @property {string[]} feedback
 * @property {Object} [details]
 */

/**
 * Main analysis function
 */
export function analyzeScan(result) {
  if (!result || !result.nearbyNetworks) {
    return { healthScore: 0, issues: ['no_data'], feedback: ['Unable to retrieve scan data.'] };
  }

  const { currentNetwork, nearbyNetworks } = result;
  const issues = [];
  let score = 100;
  const details = {};

  if (!currentNetwork) {
    issues.push('no_current_connection');
    score -= 40;
    return { healthScore: Math.max(0, score), issues, feedback: generateFeedback(issues, null, nearbyNetworks), details };
  }

  // === Rule 1: Weak Signal ===
  if (currentNetwork.signalStrength < WIFI_THRESHOLDS.WEAK_SIGNAL_DBM) {
    issues.push('weak_signal');
    score -= (currentNetwork.signalStrength < -80 ? 35 : 22);
  }

  // === Rule 2: Channel Congestion ===
  const sameChannelStrong = nearbyNetworks.filter(n => 
    n.channel === currentNetwork.channel && 
    n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM &&
    n.bssid !== currentNetwork.bssid
  );
  if (sameChannelStrong.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
    issues.push('channel_congestion');
    score -= 18 + (sameChannelStrong.length * 2);
  }

  // === Rule 3: Using 2.4 GHz when 5/6 GHz is better ===
  if (currentNetwork.band === '2.4') {
    const betterBandAvailable = nearbyNetworks.find(n => 
      (n.band === '5' || n.band === '6') && n.signalStrength > WIFI_THRESHOLDS.MIN_5GHZ_SIGNAL_FOR_RECOMMEND
    );
    if (betterBandAvailable) {
      issues.push('using_2_4_when_better_band_available');
      score -= 15;
    }
  }

  // === Rule 4: Open / Unsecured Network ===
  if (currentNetwork.security.toLowerCase().includes('open')) {
    issues.push('open_network');
    score -= 35;
  }

  // === Rule 5: Very Wide Channel in Crowded Environment (new Phase 2) ===
  if (currentNetwork.channelWidth >= 80 && nearbyNetworks.length > 8) {
    issues.push('wide_channel_in_crowded_env');
    score -= 12;
  }

  // === Rule 6: Many Strong Networks Overall (high interference) ===
  const strongNetworks = nearbyNetworks.filter(n => n.signalStrength > -60);
  if (strongNetworks.length >= 6) {
    issues.push('high_interference');
    score -= 10;
  }

  // === Rule 7: No 5/6 GHz networks visible at all (Phase 2) ===
  const hasModernBand = nearbyNetworks.some(n => n.band === '5' || n.band === '6');
  if (!hasModernBand && currentNetwork.band === '2.4') {
    issues.push('only_2_4ghz_available');
    score -= 8;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks);

  return { healthScore: score, issues, feedback, details };
}

/**
 * Generate plain English, actionable feedback
 */
export function generateFeedback(issues, current, nearby) {
  const feedback = [];

  if (issues.includes('weak_signal') && current) {
    feedback.push(`Your current network "${current.ssid}" has a weak signal (${current.signalStrength} dBm). Try moving closer to the router or adding a mesh node.`);
  }

  if (issues.includes('channel_congestion') && current) {
    const count = nearby.filter(n => n.channel === current.channel).length;
    feedback.push(`Channel ${current.channel} is congested (${count} networks). Switch your router to channel 1, 6, or 11 (2.4 GHz) or a clearer 5/6 GHz channel.`);
  }

  if (issues.includes('using_2_4_when_better_band_available')) {
    feedback.push('A stronger 5 GHz or 6 GHz network is available. Switch to it for significantly better speed and less interference.');
  }

  if (issues.includes('open_network')) {
    feedback.push('You are connected to an open network. This is insecure — avoid banking, shopping, or logging into important accounts.');
  }

  if (issues.includes('wide_channel_in_crowded_env')) {
    feedback.push('You are using a very wide channel (80MHz+) in a crowded area. Consider narrowing the channel width for better stability.');
  }

  if (issues.includes('high_interference')) {
    feedback.push('There are many strong networks nearby. This can cause interference. Consider using the 5 GHz or 6 GHz band if available.');
  }

  if (issues.includes('only_2_4ghz_available')) {
    feedback.push('No 5 GHz or 6 GHz networks were detected. Your environment may only support 2.4 GHz — consider upgrading your router for better performance.');
  }

  if (issues.length === 0) {
    feedback.push('Your WiFi environment looks healthy. No major issues detected right now.');
  }

  return feedback;
}

/**
 * Calculate health score (wrapper)
 */
export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}

// Re-export everything
export { analyzeScan, generateFeedback, calculateHealthScore };