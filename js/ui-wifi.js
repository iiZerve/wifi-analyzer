// UI Layer - Enhanced with real Walking Survey (movement + guidance + rich summary), rogue list, no mocks

import { scanWifi } from './wifi-scanner.js';
import { classifyRogueNetworks } from './wifi-analyzer.js';

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;
  container.innerHTML = '';

  // Health Score
  const scoreDiv = document.createElement('div');
  scoreDiv.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:13px;color:#888;">HEALTH SCORE</div>
      <div style="font-size:68px;font-weight:800;color:#4fc3f7;line-height:1;">${analysis.healthScore}</div>
    </div>
  `;
  container.appendChild(scoreDiv);

  // Current Network
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    const netDiv = document.createElement('div');
    netDiv.style.cssText = 'background:#1e1e1e;padding:16px;border-radius:12px;margin-bottom:20px;';
    netDiv.innerHTML = `
      <strong>Connected to:</strong> ${net.ssid}<br>
      <span style="color:#aaa;font-size:13px;">${net.band} GHz • Ch ${net.channel} • ${net.signalStrength} dBm • ${net.security}</span>
    `;
    container.appendChild(netDiv);
  }

  // Issues
  const issuesDiv = document.createElement('div');
  issuesDiv.innerHTML = `<strong style="color:#ff9800;">Issues (${analysis.issues.length})</strong>`;
  analysis.issues.forEach(issue => {
    const pill = document.createElement('span');
    pill.style.cssText = 'background:#3a2a00;color:#ffcc80;padding:6px 12px;border-radius:20px;font-size:12px;margin:6px 6px 0 0;display:inline-block;';
    pill.textContent = issue.replace(/_/g, ' ');
    issuesDiv.appendChild(pill);
  });
  container.appendChild(issuesDiv);

  // Feedback
  const fbDiv = document.createElement('div');
  fbDiv.style.marginTop = '20px';
  fbDiv.innerHTML = '<strong>Recommendations</strong>';
  analysis.feedback.forEach(text => {
    const p = document.createElement('div');
    p.style.cssText = 'background:#252525;padding:14px 16px;border-radius:10px;margin-top:10px;line-height:1.5;';
    p.textContent = text;
    fbDiv.appendChild(p);
  });
  container.appendChild(fbDiv);
}

export function renderHistory(container, history) {
  if (!container) return;
  container.innerHTML = '';
  if (history.length === 0) {
    container.innerHTML = '<div style="color:#666;">No scans yet</div>';
    return;
  }
  history.slice(0,6).forEach(item => {
    const el = document.createElement('div');
    el.style.cssText = 'background:#1e1e1e;padding:10px 14px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    el.innerHTML = `<div>${time} - ${item.currentNetwork?.ssid || 'No connection'}</div><div style="font-weight:700;color:#4fc3f7;">${item.healthScore || '--'}</div>`;
    container.appendChild(el);
  });
}

// Phase 4: Export report as JSON (richer)
export function exportScanReport(scanResult, analysis) {
  const report = {
    exportedAt: new Date().toISOString(),
    healthScore: analysis.healthScore,
    currentNetwork: scanResult.currentNetwork,
    issues: analysis.issues,
    feedback: analysis.feedback,
    nearbyNetworks: scanResult.nearbyNetworks,
    rogues: analysis.rogues || []
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wifi-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// === Real Walking Survey (ported/enhanced from implementation: real repeated scans, movement via accelerometer, rogues with severity, guidance, rich summary, no random/mocks) ===

let _surveyState = {
  intervalId: null,
  samples: [],
  roguesSeen: [],
  guidanceLog: [],
  startTs: 0,
  onUpdate: null
};

let _motionListener = null;
let _motionSamples = [];
let _lastMotionTs = 0;

function startMotionTracking() {
  if (_motionListener) return;
  if (!('DeviceMotionEvent' in window)) {
    console.log('[Survey] Motion sensors unavailable');
    return;
  }
  _motionSamples = [];
  _lastMotionTs = Date.now();
  _motionListener = function (event) {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    const mag = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
    _motionSamples.push({ t: Date.now(), mag });
    if (_motionSamples.length > 120) _motionSamples.shift();
  };
  window.addEventListener('devicemotion', _motionListener, { passive: true });
}

function stopMotionTracking() {
  if (_motionListener) {
    window.removeEventListener('devicemotion', _motionListener);
    _motionListener = null;
  }
}

function detectMovement() {
  const now = Date.now();
  const cutoff = _lastMotionTs || (now - 6000);
  const recent = _motionSamples.filter(s => s.t > cutoff);
  _lastMotionTs = now;
  if (recent.length < 4) return { moved: false, stepDelta: 0 };
  const mags = recent.map(s => s.mag);
  const variance = Math.max(...mags) - Math.min(...mags);
  const moved = variance >= 1.4;
  let stepDelta = 0;
  for (let i = 2; i < mags.length; i++) {
    const prev = mags[i - 1];
    const curr = mags[i];
    if (curr > prev + 0.9 && curr > 10.5) {
      stepDelta++;
    }
  }
  return { moved, stepDelta };
}

function computeGuidance(current, prev, rogues) {
  if (!prev || !current) return null;
  const msgs = [];
  // simple signal trend on strongest
  const curStrong = [...(current.nearbyNetworks || [])].sort((a,b) => (b.signalStrength||-999) - (a.signalStrength||-999))[0];
  const prevStrong = [...(prev.nearbyNetworks || [])].sort((a,b) => (b.signalStrength||-999) - (a.signalStrength||-999))[0];
  if (curStrong && prevStrong) {
    const delta = (curStrong.signalStrength || 0) - (prevStrong.signalStrength || 0);
    if (delta >= 4) msgs.push('Signal improving – keep walking');
    else if (delta <= -5) msgs.push('Signal dropped – try a different direction');
  }
  const netCount = (current.nearbyNetworks || []).length;
  if (netCount >= 10) msgs.push(`High congestion detected in this area (${netCount} networks visible)`);
  if (rogues && rogues.length > 0) msgs.push(`${rogues.length} suspicious open networks here`);
  return msgs.length ? msgs.join(' • ') : null;
}

export function renderRogueList(container, rogues) {
  if (!container) return;
  container.innerHTML = '';
  if (!rogues || rogues.length === 0) {
    container.innerHTML = '<div style="color:#666;font-size:12px;">No suspicious open networks in this scan.</div>';
    return;
  }
  rogues.forEach(r => {
    const div = document.createElement('div');
    const color = r.risk === 'High' ? '#f87171' : (r.risk === 'Medium' ? '#facc15' : '#aaa');
    div.style.cssText = 'background:#1e1e1e;padding:6px 8px;border-radius:6px;margin:3px 0;font-size:12px;';
    div.innerHTML = `<strong style="color:${color}">[${r.risk}]</strong> ${r.ssid} <span style="color:#888;">${r.signalStrength} dBm</span> — ${r.reason}`;
    container.appendChild(div);
  });
}

export async function startSurveyMode(onUpdate) {
  console.log('%c[Survey Mode] Started real scanning + movement tracking (no mocks)', 'color:#4fc3f7');
  _surveyState = { intervalId: null, samples: [], roguesSeen: [], guidanceLog: [], startTs: Date.now(), onUpdate };
  startMotionTracking();

  const doRealSample = async () => {
    try {
      const scan = await scanWifi();
      const analysis = (typeof window.analyzeScan === 'function') ? window.analyzeScan(scan) : { rogues: [] };
      const mov = detectMovement();
      const guidance = computeGuidance(scan, _surveyState.samples.length > 0 ? _surveyState.samples[_surveyState.samples.length-1].scan : null, analysis.rogues || []);
      const sample = {
        timestamp: Date.now(),
        scan,
        analysis,
        moved: mov.moved,
        stepDelta: mov.stepDelta,
        guidance
      };
      _surveyState.samples.push(sample);
      if (analysis.rogues && analysis.rogues.length) {
        // accumulate highest risk
        analysis.rogues.forEach(r => {
          const existing = _surveyState.roguesSeen.find(x => x.bssid === r.bssid);
          if (!existing || (r.risk === 'High' && existing.risk !== 'High')) {
            _surveyState.roguesSeen = _surveyState.roguesSeen.filter(x => x.bssid !== r.bssid);
            _surveyState.roguesSeen.push(r);
          }
        });
      }
      if (guidance) _surveyState.guidanceLog.push(guidance);
      if (typeof onUpdate === 'function') onUpdate(sample);
    } catch (e) {
      console.warn('[Survey] real sample failed:', e.message);
    }
  };

  // first immediate real scan
  await doRealSample();
  _surveyState.intervalId = setInterval(doRealSample, 5000);
  return _surveyState;
}

export function stopSurveyMode() {
  if (_surveyState.intervalId) {
    clearInterval(_surveyState.intervalId);
    _surveyState.intervalId = null;
  }
  stopMotionTracking();
  console.log('%c[Survey Mode] Stopped. Samples:', 'color:#ff9800', _surveyState.samples.length);

  // Rich summary (ported from implementation)
  const samples = _surveyState.samples;
  const rogues = _surveyState.roguesSeen || [];
  const duration = Math.floor((Date.now() - _surveyState.startTs) / 1000);
  let summary = `Survey complete: ${samples.length} real scans, ${duration}s, ${rogues.length} suspicious opens.\n`;
  if (samples.length > 0) {
    const best = samples.reduce((best, s) => {
      const strong = (s.scan.nearbyNetworks || []).sort((a,b)=>(b.signalStrength||-999)-(a.signalStrength||-999))[0];
      if (strong && (!best || strong.signalStrength > best.signalStrength)) return strong;
      return best;
    }, null);
    if (best) summary += `Strongest observed: ${best.ssid} @ ${best.signalStrength} dBm\n`;
  }
  if (rogues.length) {
    const high = rogues.filter(r => r.risk === 'High').length;
    summary += `${high} high-risk (evil-twin candidates). See list.\n`;
  }
  summary += 'All data from real device scans + accelerometer.';

  // If onUpdate or global, surface it
  if (typeof _surveyState.onUpdate === 'function') {
    _surveyState.onUpdate({ summary, samples, rogues });
  }
  return { samples, rogues, summary, duration };
}

export function getSurveySamples() {
  return _surveyState.samples || [];
}

// Optional: render rogue list in a passed container (for UI integration)
export function renderRogueListInContainer(container, rogues) {
  renderRogueList(container, rogues);
}