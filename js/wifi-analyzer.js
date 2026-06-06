// WiFi Analysis Engine - Enhanced with real rogue detection (severity levels), no mocks

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

  // === Enhanced Rogue Network Detection (High/Med/Low severity, evil twin heuristics) ===
  const rogues = classifyRogueNetworks(nearbyNetworks);
  if (rogues.length > 0) {
    const high = rogues.filter(r => r.risk === 'High').length;
    if (high > 0) {
      issues.push('possible_rogue_networks_high_risk');
      score -= 25;
    } else {
      issues.push('possible_rogue_networks');
      score -= 10;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const feedback = generateFeedback(issues, currentNetwork, nearbyNetworks, rogues);

  return { healthScore: score, issues, feedback, rogues };
}

export function generateFeedback(issues, current, nearby, rogues = []) {
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
  if (issues.includes('possible_rogue_networks_high_risk') || issues.includes('possible_rogue_networks')) {
    const high = rogues.filter(r => r.risk === 'High').length;
    feedback.push(`Warning: ${rogues.length} suspicious open networks detected. ${high > 0 ? high + ' high-risk (possible evil twin) — avoid.' : 'Be cautious.'}`);
  }
  if (issues.length === 0) {
    feedback.push('WiFi environment looks healthy.');
  }

  return feedback;
}

export function calculateHealthScore(result) {
  return analyzeScan(result).healthScore;
}

// --- Enhanced Rogue / Suspicious Open Network Detection (real data, severity levels) ---
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
      const commonOpen = /guest|public|free|wifi|airport|hotel|cafe|starbucks|airport|library/i.test(net.ssid);
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