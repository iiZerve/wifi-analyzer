// WiFi Analysis Engine (runtime copy) - Enhanced with real rogue detection (severity levels), no mocks

import { WIFI_THRESHOLDS } from './config.js';

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
    return {
      healthScore: 25,
      issues,
      feedback: ['No active WiFi connection detected.'],
      details
    };
  }

  // === Rule 1: Signal Strength (More Aggressive) ===
  const signal = currentNetwork.signalStrength;

  if (signal < -85) {
    score -= 65;
    issues.push('extremely_weak_signal');
    details.rulesTriggered.push({ rule: 'extremely_weak_signal', penalty: 65, signal });
  } 
  else if (signal < -79) {
    score -= 50;
    issues.push('very_weak_signal');
    details.rulesTriggered.push({ rule: 'very_weak_signal', penalty: 50, signal });
  } 
  else if (signal < -73) {
    score -= 30;
    issues.push('weak_signal');
    details.rulesTriggered.push({ rule: 'weak_signal', penalty: 30, signal });
  } 
  else if (signal < -66) {
    score -= 15;
    issues.push('below_average_signal');
    details.rulesTriggered.push({ rule: 'below_average_signal', penalty: 15, signal });
  }

  // === Rule 2: Channel Congestion ===
  const sameChannelStrong = nearbyNetworks.filter(n =>
    n.channel === currentNetwork.channel &&
    n.signalStrength > WIFI_THRESHOLDS.STRONG_NETWORK_DBM &&
    n.bssid !== currentNetwork.bssid
  );

  if (sameChannelStrong.length >= WIFI_THRESHOLDS.CONGESTION_THRESHOLD) {
    const penalty = 20 + (sameChannelStrong.length * 2);
    score -= penalty;
    issues.push('channel_congestion');
    details.rulesTriggered.push({ rule: 'channel_congestion', penalty, count: sameChannelStrong.length });
  }

  // === Rule 3: Weak Signal + Congestion Combo (New) ===
  if (signal < -75 && sameChannelStrong.length >= 4) {
    score -= 15;
    issues.push('weak_signal_with_congestion');
    details.rulesTriggered.push({ rule: 'weak_signal_with_congestion', penalty: 15 });
  }

  // === Rule 4: Using 2.4 GHz When Better Band is Available ===
  if (currentNetwork.band === '2.4') {
    const betterBandAvailable = nearbyNetworks.some(n =>
      (n.band === '5' || n.band === '6') &&
      n.signalStrength > WIFI_THRESHOLDS.MIN_5GHZ_SIGNAL_FOR_RECOMMEND
    );

    if (betterBandAvailable) {
      const penalty = signal < -70 ? 25 : 18;
      score -= penalty;
      issues.push('using_2_4_when_better_band_available');
      details.rulesTriggered.push({ rule: 'better_band_available', penalty });
    }
  }

  // === Rule 5: Open / Unsecured Network ===
  if (currentNetwork.security.toLowerCase().includes('open')) {
    score -= 35;
    issues.push('open_network');
    details.rulesTriggered.push({ rule: 'open_network', penalty: 35 });
  }

  // === Rule 6: Wide Channel in Crowded Environment ===
  if (currentNetwork.channelWidth >= 80 && nearbyNetworks.length > 6) {
    score -= 15;
    issues.push('wide_channel_in_crowded_env');
    details.rulesTriggered.push({ rule: 'wide_channel', penalty: 15 });
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Classify rogues for the UI (rogue list + survey) but do NOT apply extra score penalty here
  // (health score focuses on signal + environment per the improved rules)
  const rogues = classifyRogueNetworks(nearbyNetworks || []);

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks, rogues);

  return {
    healthScore: score,
    issues,
    feedback,
    rogues,
    details,
    connected: true
  };
}

export function generateFeedback(issues, current, nearby, rogues = []) {
  const feedback = [];

  if (issues.includes('extremely_weak_signal') || issues.includes('very_weak_signal')) {
    feedback.push('Signal is very weak. Move significantly closer to the router or consider a mesh system.');
  } 
  else if (issues.includes('weak_signal')) {
    feedback.push('Signal is weak. Performance may be unreliable.');
  }

  if (issues.includes('weak_signal_with_congestion')) {
    feedback.push('Weak signal combined with channel congestion. This is likely causing poor speeds.');
  }

  if (issues.includes('channel_congestion')) {
    feedback.push('Your channel is congested. Try switching to a less crowded channel.');
  }

  if (issues.includes('using_2_4_when_better_band_available')) {
    feedback.push('You are on 2.4 GHz while a stronger 5 GHz or 6 GHz network is available nearby.');
  }

  if (issues.includes('open_network')) {
    feedback.push('Connected to an open network. This is a security risk.');
  }

  if (issues.includes('wide_channel_in_crowded_env')) {
    feedback.push('Using a wide channel width in a busy environment can reduce stability.');
  }

  if (issues.includes('possible_rogue_networks_high_risk') || issues.includes('possible_rogue_networks')) {
    const high = rogues.filter(r => r.risk === 'High').length;
    feedback.push(`Warning: ${rogues.length} suspicious open networks detected. ${high > 0 ? high + ' high-risk (possible evil twin) — avoid.' : 'Be cautious.'}`);
  }

  if (issues.length === 0) {
    feedback.push('Your WiFi environment looks healthy.');
  }

  return feedback;
}

export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}

// Expose for survey mode fallback (window.analyzeScan check in ui)
window.analyzeScan = analyzeScan;

export function isOpenNetwork(net) {
  if (!net) return false;
  const sec = String(net.security || net.capabilities || '').toUpperCase();
  const hasSecurity = sec.includes('WPA') || sec.includes('RSN') || sec.includes('WEP') ||
                      sec.includes('SAE') || sec.includes('OWE') || sec.includes('EAP');
  return !hasSecurity;
}

function simpleSsidSimilarity(a, b) {
  if (!a || !b) return false;
  const aa = a.toLowerCase().trim();
  const bb = b.toLowerCase().trim();
  if (aa === bb) return true;
  if (aa.includes(bb) || bb.includes(aa)) return true;
  if (Math.abs(aa.length - bb.length) <= 3) {
    let matches = 0;
    const len = Math.min(aa.length, bb.length);
    for (let i = 0; i < len; i++) if (aa[i] === bb[i]) matches++;
    if (matches / len > 0.85) return true;
  }
  return false;
}

export function classifyRogueNetworks(networks) {
  if (!networks || networks.length === 0) return [];
  const secured = networks.filter(n => !isOpenNetwork(n) && n.ssid && n.ssid !== '<hidden>');
  const securedSsids = secured.map(n => n.ssid);
  const rogues = [];
  networks.forEach(net => {
    if (!isOpenNetwork(net)) return;
    if (!net.ssid || net.ssid === '<hidden>') return;
    let risk = 'Low';
    let reason = 'Open network — no encryption detected';
    const isMatch = securedSsids.some(sec => simpleSsidSimilarity(net.ssid, sec));
    if (isMatch) {
      risk = 'High';
      reason = 'SSID matches (or very similar to) a secured network seen in this scan — high evil twin risk';
    } else {
      const commonOpen = /guest|public|free|wifi|airport|hotel|cafe|starbucks|library/i.test(net.ssid);
      const sig = (typeof net.signalStrength === 'number' ? net.signalStrength : net.signal);
      if ((typeof sig === 'number' && sig >= -55) || commonOpen) {
        risk = 'Medium';
        reason = commonOpen ? 'Open network with common public-style name' : 'Open network with strong signal';
      }
    }
    rogues.push({
      ssid: net.ssid,
      bssid: net.bssid,
      signalStrength: (typeof net.signalStrength === 'number' ? net.signalStrength : (net.signal || -99)),
      frequency: net.frequency || 0,
      channel: net.channel || 0,
      risk,
      reason
    });
  });
  const riskOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
  rogues.sort((a, b) => {
    const r = (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0);
    const sa = (typeof a.signalStrength === 'number' ? a.signalStrength : -999);
    const sb = (typeof b.signalStrength === 'number' ? b.signalStrength : -999);
    return r !== 0 ? r : (sb - sa);
  });
  return rogues;
}
