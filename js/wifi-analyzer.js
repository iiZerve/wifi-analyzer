// WiFi Analysis Engine - Phase 4 Enhancements

import { WIFI_THRESHOLDS } from './config.js';

export function analyzeScan(result) {
  if (!result || !result.nearbyNetworks) {
    return { healthScore: 0, issues: ['no_data'], feedback: ['Unable to retrieve scan data.'] };
  }

  const { currentNetwork, nearbyNetworks } = result;
  const issues = [];
  let score = 100;

  if (!currentNetwork) {
    issues.push('no_current_connection');
    return { healthScore: 40, issues, feedback: ['No active WiFi connection detected.'] };
  }

  // Rule 1: Weak Signal
  if (currentNetwork.signalStrength < WIFI_THRESHOLDS.WEAK_SIGNAL_DBM) {
    issues.push('weak_signal');
    score -= (currentNetwork.signalStrength < -80 ? 35 : 22);
  }

  // Rule 2: Channel Congestion
  const sameChannelStrong = nearbyNetworks.filter(n => 
    n.channel === currentNetwork.channel && 
    n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM && n.bssid !== currentNetwork.bssid
  );
  if (sameChannelStrong.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
    issues.push('channel_congestion');
    score -= 18;
  }

  // Rule 3: Better band available
  if (currentNetwork.band === '2.4') {
    const betterBand = nearbyNetworks.find(n => (n.band === '5' || n.band === '6') && n.signalStrength > -65);
    if (betterBand) {
      issues.push('using_2_4_when_better_band_available');
      score -= 15;
    }
  }

  // Rule 4: Open network
  if (currentNetwork.security.toLowerCase().includes('open')) {
    issues.push('open_network');
    score -= 35;
  }

  // Rule 5: Wide channel in crowded area
  if (currentNetwork.channelWidth >= 80 && nearbyNetworks.length > 7) {
    issues.push('wide_channel_in_crowded_env');
    score -= 12;
  }

  // === Phase 4: Rogue Network Detection ===
  const suspiciousNetworks = nearbyNetworks.filter(n => {
    const name = n.ssid.toLowerCase();
    return (name.includes('free') || name.includes('public') || name.includes('guest')) && 
           n.security.toLowerCase().includes('open');
  });
  if (suspiciousNetworks.length > 0 && currentNetwork) {
    issues.push('possible_rogue_networks');
    score -= 10;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks, suspiciousNetworks);

  return { healthScore: score, issues, feedback };
}

export function generateFeedback(issues, current, nearby, suspicious = []) {
  const feedback = [];

  if (issues.includes('weak_signal') && current) {
    feedback.push(`Weak signal on "${current.ssid}" (${current.signalStrength} dBm). Move closer or add a mesh extender.`);
  }
  if (issues.includes('channel_congestion') && current) {
    feedback.push(`Channel ${current.channel} is congested. Change to channel 1, 6, or 11.`);
  }
  if (issues.includes('using_2_4_when_better_band_available')) {
    feedback.push('Switch to 5 GHz or 6 GHz for better speed and less interference.');
  }
  if (issues.includes('open_network')) {
    feedback.push('Connected to an open network. Avoid sensitive activities.');
  }
  if (issues.includes('wide_channel_in_crowded_env')) {
    feedback.push('Using wide channel in crowded area. Narrow channel width for stability.');
  }
  if (issues.includes('possible_rogue_networks')) {
    feedback.push(`Warning: ${suspicious.length} suspicious open "free/public/guest" networks detected nearby. Be cautious of evil twin attacks.`);
  }
  if (issues.length === 0) {
    feedback.push('WiFi environment looks healthy.');
  }

  return feedback;
}

export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}