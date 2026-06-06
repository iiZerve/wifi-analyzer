// WiFi Analysis Engine - Phase 4
// Emphasis on accurate detection and transparent reporting

import { WIFI_THRESHOLDS } from './config.js';

export function analyzeScan(result) {
  if (!result || !Array.isArray(result.nearbyNetworks)) {
    return { healthScore: 0, issues: ['no_data'], feedback: ['Invalid scan data.'], details: {} };
  }

  const { currentNetwork, nearbyNetworks } = result;
  const issues = [];
  let score = 100;
  const details = { rulesTriggered: [], suspiciousNetworks: [] };

  if (!currentNetwork) {
    issues.push('no_current_connection');
    return { healthScore: 35, issues, feedback: ['No active connection.'], details };
  }

  // Rule 1: Weak Signal
  if (currentNetwork.signalStrength < WIFI_THRESHOLDS.WEAK_SIGNAL_DBM) {
    const penalty = currentNetwork.signalStrength < -80 ? 32 : 20;
    score -= penalty;
    issues.push('weak_signal');
    details.rulesTriggered.push({ rule: 'weak_signal', penalty, signal: currentNetwork.signalStrength });
  }

  // Rule 2: Channel Congestion
  const sameChannelStrong = nearbyNetworks.filter(n => 
    n.channel === currentNetwork.channel && 
    n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM && n.bssid !== currentNetwork.bssid
  );
  if (sameChannelStrong.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
    const penalty = 15 + (sameChannelStrong.length * 2);
    score -= penalty;
    issues.push('channel_congestion');
    details.rulesTriggered.push({ rule: 'channel_congestion', penalty, count: sameChannelStrong.length });
  }

  // Rule 3: Better band available
  if (currentNetwork.band === '2.4') {
    const better = nearbyNetworks.find(n => (n.band === '5' || n.band === '6') && n.signalStrength > -65);
    if (better) {
      score -= 14;
      issues.push('using_2_4_when_better_band_available');
      details.rulesTriggered.push({ rule: 'better_band_available' });
    }
  }

  // Rule 4: Open network
  if (currentNetwork.security.toLowerCase().includes('open')) {
    score -= 30;
    issues.push('open_network');
    details.rulesTriggered.push({ rule: 'open_network' });
  }

  // Rule 5: Wide channel in crowded area
  if (currentNetwork.channelWidth >= 80 && nearbyNetworks.length > 6) {
    score -= 10;
    issues.push('wide_channel_in_crowded_env');
    details.rulesTriggered.push({ rule: 'wide_channel' });
  }

  // === Phase 4: Rogue Network Detection ===
  const suspicious = nearbyNetworks.filter(n => {
    const name = (n.ssid || '').toLowerCase();
    return (name.includes('free') || name.includes('public') || name.includes('guest')) &&
           n.security.toLowerCase().includes('open');
  });

  if (suspicious.length > 0) {
    details.suspiciousNetworks = suspicious.map(n => ({
      ssid: n.ssid,
      signalStrength: n.signalStrength,
      channel: n.channel
    }));

    if (suspicious.length >= 2) {
      score -= 12;
      issues.push('possible_rogue_networks');
      details.rulesTriggered.push({ rule: 'rogue_networks', count: suspicious.length });
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks, suspicious);

  return { healthScore: score, issues, feedback, details };
}

export function generateFeedback(issues, current, nearby, suspicious = []) {
  const feedback = [];

  if (issues.includes('weak_signal')) {
    feedback.push(`Weak signal (${current.signalStrength} dBm). Move closer to the router.`);
  }
  if (issues.includes('channel_congestion')) {
    feedback.push(`Channel ${current.channel} is congested. Try a different channel.`);
  }
  if (issues.includes('using_2_4_when_better_band_available')) {
    feedback.push('A stronger 5/6 GHz network is available. Consider switching bands.');
  }
  if (issues.includes('open_network')) {
    feedback.push('Connected to an open network. Avoid sensitive activities.');
  }
  if (issues.includes('wide_channel_in_crowded_env')) {
    feedback.push('Wide channel in busy environment. Narrow the channel width.');
  }
  if (issues.includes('possible_rogue_networks')) {
    feedback.push(`${suspicious.length} suspicious open networks detected nearby. Exercise caution.`);
  }
  if (issues.length === 0) {
    feedback.push('WiFi environment looks healthy.');
  }

  return feedback;
}

export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}