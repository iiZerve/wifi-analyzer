// WiFi Analysis Engine
// Focus: Accuracy and transparency in scoring + reporting

import { WIFI_THRESHOLDS } from './config.js';

/**
 * Converts frequency (MHz) to approximate WiFi channel
 */
export function frequencyToChannel(frequency) {
  if (frequency >= 2412 && frequency <= 2484) {
    return Math.round((frequency - 2412) / 5) + 1;
  }
  if (frequency >= 5170 && frequency <= 5825) {
    return Math.round((frequency - 5170) / 5) + 34;
  }
  if (frequency >= 5925 && frequency <= 7125) {
    return Math.round((frequency - 5955) / 5) + 1; // 6 GHz rough estimate
  }
  return 0;
}

/**
 * Determines band from frequency
 */
export function frequencyToBand(frequency) {
  if (frequency >= 2412 && frequency <= 2484) return '2.4';
  if (frequency >= 5170 && frequency <= 5825) return '5';
  if (frequency >= 5925 && frequency <= 7125) return '6';
  return 'unknown';
}

/**
 * Main analysis function - designed for accuracy and explainable scoring
 */
export function analyzeScan(result) {
  if (!result || !Array.isArray(result.nearbyNetworks)) {
    return {
      healthScore: 0,
      issues: ['no_data'],
      feedback: ['Unable to retrieve valid scan data.'],
      details: {}
    };
  }

  const { currentNetwork, nearbyNetworks } = result;
  const issues = [];
  let score = 100;
  const details = { rulesTriggered: [] };

  if (!currentNetwork) {
    issues.push('no_current_connection');
    return { healthScore: 35, issues, feedback: ['No active WiFi connection detected.'], details };
  }

  // === Rule 1: Signal Strength ===
  if (currentNetwork.signalStrength < WIFI_THRESHOLDS.WEAK_SIGNAL_DBM) {
    const penalty = currentNetwork.signalStrength < WIFI_THRESHOLDS.VERY_WEAK_SIGNAL_DBM ? 32 : 20;
    score -= penalty;
    issues.push('weak_signal');
    details.rulesTriggered.push({ rule: 'weak_signal', penalty, value: currentNetwork.signalStrength });
  }

  // === Rule 2: Channel Congestion ===
  const sameChannel = nearbyNetworks.filter(n => 
    n.channel === currentNetwork.channel && n.bssid !== currentNetwork.bssid
  );
  const strongOnSameChannel = sameChannel.filter(n => n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM);

  if (strongOnSameChannel.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
    const penalty = 15 + (strongOnSameChannel.length * 2);
    score -= penalty;
    issues.push('channel_congestion');
    details.rulesTriggered.push({ rule: 'channel_congestion', penalty, count: strongOnSameChannel.length });
  }

  // === Rule 3: Better band available ===
  if (currentNetwork.band === '2.4') {
    const betterBand = nearbyNetworks.find(n => 
      (n.band === '5' || n.band === '6') && n.signalStrength > WIFI_THRESHOLDS.MIN_5GHZ_SIGNAL_FOR_RECOMMEND
    );
    if (betterBand) {
      score -= 14;
      issues.push('using_2_4_when_better_band_available');
      details.rulesTriggered.push({ rule: 'better_band_available', recommendedBand: betterBand.band });
    }
  }

  // === Rule 4: Security ===
  if (currentNetwork.security.toLowerCase().includes('open')) {
    score -= 30;
    issues.push('open_network');
    details.rulesTriggered.push({ rule: 'open_network' });
  }

  // === Rule 5: Wide channel penalty in dense environment ===
  if (currentNetwork.channelWidth >= 80 && nearbyNetworks.length > 6) {
    score -= 10;
    issues.push('wide_channel_in_crowded_env');
    details.rulesTriggered.push({ rule: 'wide_channel', channelWidth: currentNetwork.channelWidth });
  }

  // === Rule 6: Rogue / Suspicious Networks (Phase 4) ===
  const suspicious = nearbyNetworks.filter(n => {
    const name = (n.ssid || '').toLowerCase();
    return (name.includes('free') || name.includes('public') || name.includes('guest')) &&
           n.security.toLowerCase().includes('open');
  });

  if (suspicious.length >= 2) {
    score -= 12;
    issues.push('possible_rogue_networks');
    details.rulesTriggered.push({ rule: 'rogue_networks', count: suspicious.length });
  }

  // Final clamping
  score = Math.max(0, Math.min(100, Math.round(score)));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks, suspicious, details);

  return { healthScore: score, issues, feedback, details };
}

export function generateFeedback(issues, current, nearby, suspicious = [], details = {}) {
  const feedback = [];

  if (issues.includes('weak_signal') && current) {
    feedback.push(`Weak signal detected (${current.signalStrength} dBm). Consider moving closer to the router or adding a WiFi extender.`);
  }

  if (issues.includes('channel_congestion') && current) {
    feedback.push(`Your channel (${current.channel}) has significant competition. Try channels 1, 6, or 11 on 2.4 GHz or a less crowded 5/6 GHz channel.`);
  }

  if (issues.includes('using_2_4_when_better_band_available')) {
    feedback.push('A stronger 5 GHz or 6 GHz network is available nearby. Switching bands can improve speed and reduce interference.');
  }

  if (issues.includes('open_network')) {
    feedback.push('You are connected to an open network. This poses security risks. Avoid accessing sensitive information.');
  }

  if (issues.includes('wide_channel_in_crowded_env')) {
    feedback.push('Using a wide channel width in a busy environment can reduce stability. Consider narrowing it.');
  }

  if (issues.includes('possible_rogue_networks')) {
    feedback.push(`Detected ${suspicious.length} suspicious open networks (free/public/guest). Be cautious of potential evil twin attacks.`);
  }

  if (issues.length === 0) {
    feedback.push('Your current WiFi environment appears healthy with no major issues detected.');
  }

  return feedback;
}

export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}