// js/wifi.js
// Real WiFi Analyzer module for the new Wifi Analyzer app
// - ONLY real data via native WifiScannerPlugin (Capacitor)
// - No random numbers, no mock networks, no simulated fallbacks in main flow.
// - Provides single real scan + full Walking Survey with live freshness, movement (accelerometer), guidance, rogue detection (High/Med/Low), rich summary and report.
// - Full surveyHistory preserved for export.

(function () {
  'use strict';

  let lastScanTimestamp = null;
  let currentNetworks = [];
  let freshnessTimer = null;
  let surveyInterval = null;
  let surveyScanCount = 0;
  let surveyUnique = new Set();
  let surveyStartTs = 0;
  let scanInProgress = false;

  // Phase 2/3 state
  let surveyHistory = [];
  let surveyTarget = null;
  let surveyStepsTotal = 0;
  let surveyMovedScans = 0;
  let currentRogues = [];
  let surveyRogues = new Map();

  // Motion
  let motionListener = null;
  let motionSamples = [];
  let lastMotionCheckTs = 0;

  const SCAN_INTERVAL_MS = 5000;
  const MOTION_VARIANCE_THRESHOLD = 1.4;
  const CONGESTION_THRESHOLD = 10;

  function el(id) { return document.getElementById(id); }

  function logLine(text, cls) {
    if (typeof window.logLine === 'function') {
      window.logLine(text, cls);
    } else {
      const log = el('log');
      if (log) {
        const d = document.createElement('div');
        d.className = 'history-item ' + (cls || '');
        d.textContent = '[' + (window.timeStamp ? window.timeStamp() : new Date().toLocaleTimeString()) + '] ' + text;
        log.appendChild(d);
        log.scrollTop = log.scrollHeight;
      }
    }
  }

  function showWifiError(msg) {
    const container = el('wifi-results');
    if (container) {
      container.innerHTML = `<div class="wifi-error" style="color:#f87171;padding:8px 0;">${escapeHtml(msg)}</div>`;
    }
    logLine('WiFi scan error: ' + msg, 'muted');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
  }

  function signalToBars(dBm) {
    if (typeof dBm !== 'number' || isNaN(dBm)) return '—';
    const pct = Math.max(0, Math.min(100, ((dBm + 90) / 60) * 100));
    if (pct >= 80) return '▁▂▄▆█';
    if (pct >= 60) return '▁▂▄▆ ';
    if (pct >= 40) return '▁▂▄  ';
    if (pct >= 20) return '▁▂   ';
    return '▁    ';
  }

  function signalQuality(dBm) {
    if (typeof dBm !== 'number' || isNaN(dBm)) return 'Unknown';
    if (dBm >= -50) return 'Excellent';
    if (dBm >= -60) return 'Good';
    if (dBm >= -70) return 'Fair';
    if (dBm >= -80) return 'Weak';
    return 'Very weak';
  }

  function formatFreshness(ts) {
    if (!ts) return { text: 'Never', status: 'stale' };
    const ageSec = Math.floor((Date.now() - ts) / 1000);
    let status = 'stale';
    if (ageSec < 20) status = 'fresh';
    else if (ageSec < 90) status = 'recent';
    const ago = ageSec < 60 ? `${ageSec}s ago` : `${Math.floor(ageSec / 60)}m ago`;
    return { text: ago, status, ageSec };
  }

  function updateFreshnessUI() {
    const info = el('wifi-last-scan');
    if (!info) return;
    const f = formatFreshness(lastScanTimestamp);
    let badge = '';
    if (f.status === 'fresh') badge = '<span style="background:#052e16;color:#4ade80;padding:1px 6px;border-radius:999px;font-size:10px;margin-left:6px;">FRESH</span>';
    else if (f.status === 'recent') badge = '<span style="background:#3f2a00;color:#facc15;padding:1px 6px;border-radius:999px;font-size:10px;margin-left:6px;">RECENT</span>';
    else badge = '<span style="background:#3f1f1f;color:#f87171;padding:1px 6px;border-radius:999px;font-size:10px;margin-left:6px;">STALE</span>';
    info.innerHTML = `Last scan: ${f.text} ${badge}`;
  }

  function startFreshnessTimer() {
    if (freshnessTimer) clearInterval(freshnessTimer);
    freshnessTimer = setInterval(() => { updateFreshnessUI(); }, 1000);
  }

  function renderNetworks(networks) {
    const container = el('wifi-results');
    if (!container) return;
    if (!networks || networks.length === 0) {
      container.innerHTML = '<div class="muted" style="padding:6px 0;">No networks found in last scan (or WiFi off / location restricted).</div>';
      return;
    }
    const sorted = [...networks].sort((a, b) => (b.signal || -999) - (a.signal || -999));
    let html = '<div class="wifi-list" style="margin-top:8px;">';
    for (const n of sorted) {
      const bars = signalToBars(n.signal);
      const qual = signalQuality(n.signal);
      const sec = (n.capabilities || '').includes('WPA') || (n.capabilities || '').includes('WEP') || (n.capabilities || '').includes('SAE') ? 'Secured' : 'Open';
      const ch = n.channel ? `Ch ${n.channel}` : `${Math.round((n.frequency || 0)/1000)}GHz`;
      html += `
        <div class="wifi-net" style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:8px 10px;margin:4px 0;border:1px solid var(--border);border-radius:12px;background:rgba(24,24,27,.25);">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(n.ssid || '<hidden>')}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:1px;">${escapeHtml(n.bssid || '')} • ${ch}</div>
          </div>
          <div style="text-align:right;white-space:nowrap;">
            <div style="font-family:monospace;font-size:15px;letter-spacing:1px;">${bars}</div>
            <div style="font-size:12px;">${n.signal} dBm <span style="color:var(--muted);">(${qual})</span></div>
            <div style="font-size:10px;color:var(--muted);">${sec}</div>
          </div>
        </div>`;
    }
    html += '</div>';
    html += `<div style="font-size:11px;color:var(--muted);margin-top:6px;">${sorted.length} network${sorted.length === 1 ? '' : 's'} visible</div>`;
    container.innerHTML = html;
  }

  function updateSurveyUI() {
    const status = el('survey-status');
    const countEl = el('survey-count');
    if (!status) return;
    if (surveyInterval) {
      const elapsed = Math.floor((Date.now() - surveyStartTs) / 1000);
      status.style.display = 'flex';
      if (countEl) countEl.textContent = String(surveyScanCount);
      const elapsedEl = el('survey-elapsed');
      if (elapsedEl) elapsedEl.textContent = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
      const uniqEl = el('survey-unique');
      if (uniqEl) uniqEl.textContent = String(surveyUnique.size);
      const movedEl = el('survey-moved');
      if (movedEl) movedEl.textContent = (surveyMovedScans > 0 || surveyStepsTotal > 0) ? 'yes' : 'no';
      const stepsEl = el('survey-steps');
      if (stepsEl) stepsEl.textContent = String(surveyStepsTotal);
    } else {
      status.style.display = 'none';
    }
  }

  // Motion (Phase 2)
  function startMotionTracking() {
    if (motionListener) return;
    if (!('DeviceMotionEvent' in window)) {
      logLine('Device motion sensors unavailable — movement tracking disabled for this survey');
      return;
    }
    motionSamples = [];
    lastMotionCheckTs = Date.now();
    motionListener = function (event) {
      const acc = event.accelerationIncludingGravity || event.acceleration;
      if (!acc) return;
      const mag = Math.sqrt((acc.x||0)**2 + (acc.y||0)**2 + (acc.z||0)**2);
      motionSamples.push({ t: Date.now(), mag });
      if (motionSamples.length > 120) motionSamples.shift();
    };
    window.addEventListener('devicemotion', motionListener, { passive: true });
    logLine('Motion tracking started (accelerometer)');
  }

  function stopMotionTracking() {
    if (motionListener) {
      window.removeEventListener('devicemotion', motionListener);
      motionListener = null;
    }
  }

  function detectMovementSinceLastScan() {
    const now = Date.now();
    const cutoff = lastMotionCheckTs || (now - SCAN_INTERVAL_MS * 1.5);
    const recent = motionSamples.filter(s => s.t > cutoff);
    lastMotionCheckTs = now;
    if (recent.length < 4) return { moved: false, stepDelta: 0, variance: 0 };
    const mags = recent.map(s => s.mag);
    const variance = Math.max(...mags) - Math.min(...mags);
    const moved = variance >= MOTION_VARIANCE_THRESHOLD;
    let stepDelta = 0;
    for (let i = 2; i < mags.length; i++) {
      if (mags[i] > mags[i-1] + 0.9 && mags[i] > 10.5) stepDelta++;
    }
    return { moved, stepDelta, variance: Math.round(variance * 100) / 100 };
  }

  // Guidance + recs (Phase 3)
  function pickPrimaryNetwork(networks) {
    if (!networks || networks.length === 0) return null;
    const candidates = networks.filter(n => n.ssid && n.ssid !== '<hidden>').sort((a, b) => (b.signal || -999) - (a.signal || -999));
    if (candidates.length === 0) return null;
    const best = candidates[0];
    return { bssid: best.bssid, ssid: best.ssid, signal: best.signal };
  }

  function computeGuidance(currentSnapshot, history) {
    if (!currentSnapshot || !currentSnapshot.networks || history.length < 1) return null;
    const prev = history.length >= 2 ? history[history.length - 2] : null;
    if (!prev) return null;
    let targetSignalNow = null;
    let targetSignalPrev = null;
    const targetBssid = surveyTarget && surveyTarget.bssid;
    if (targetBssid) {
      const nowNet = currentSnapshot.networks.find(n => n.bssid === targetBssid);
      const prevNet = prev.networks.find(n => n.bssid === targetBssid);
      if (nowNet) targetSignalNow = nowNet.signal;
      if (prevNet) targetSignalPrev = prevNet.signal;
    } else {
      const nowStrong = [...currentSnapshot.networks].sort((a,b)=>(b.signal||-999)-(a.signal||-999))[0];
      const prevStrong = [...prev.networks].sort((a,b)=>(b.signal||-999)-(a.signal||-999))[0];
      if (nowStrong) targetSignalNow = nowStrong.signal;
      if (prevStrong) targetSignalPrev = prevStrong.signal;
    }
    const msgs = [];
    if (targetSignalNow != null && targetSignalPrev != null) {
      const delta = targetSignalNow - targetSignalPrev;
      if (delta >= 4) msgs.push('Signal improving – keep walking');
      else if (delta <= -5) msgs.push('Signal dropped – try a different direction or slower pace');
    }
    const netCount = currentSnapshot.networks.length;
    if (netCount >= CONGESTION_THRESHOLD) {
      msgs.push(`High congestion detected in this area (${netCount} networks visible)`);
    }
    if (currentSnapshot.moved && netCount > 6) {
      msgs.push('Area changing while moving – good data for path mapping');
    }
    return msgs.length ? msgs.join(' • ') : null;
  }

  function showGuidance(text) {
    const g = el('survey-guidance');
    if (!g) return;
    if (!text) {
      g.style.display = 'none';
      return;
    }
    g.style.display = 'block';
    const isGood = /improving|keep walking/i.test(text);
    const isWarn = /dropped|congestion/i.test(text);
    g.style.background = isGood ? 'rgba(16,185,129,.1)' : (isWarn ? 'rgba(245,158,11,.1)' : 'rgba(24,24,27,.4)');
    g.style.borderColor = isGood ? '#166534' : (isWarn ? '#92400e' : 'var(--border)');
    g.innerHTML = `<strong>Guidance:</strong> ${escapeHtml(text)}`;
  }

  function updateSurveyMovementUI(motionInfo) {
    const movedEl = el('survey-moved');
    const stepsEl = el('survey-steps');
    if (movedEl && motionInfo) {
      if (motionInfo.moved) {
        movedEl.textContent = 'yes';
        movedEl.style.color = '#4ade80';
      }
    }
    if (stepsEl) stepsEl.textContent = String(surveyStepsTotal);
  }

  function analyzeSurveyForRecommendations(history) {
    if (!history || history.length === 0) return { summaryLines: [], recommendations: [] };
    const lines = [];
    const recs = [];
    const movedCount = history.filter(h => h.moved).length;
    const totalSteps = history.reduce((sum, h) => sum + (h.stepDelta || 0), 0);
    lines.push(`Movement: ${movedCount}/${history.length} scans showed movement, ~${totalSteps} steps estimated.`);
    let bestSample = null;
    let bestSignal = -999;
    let bestSsid = '';
    history.forEach(sample => {
      const sorted = [...sample.networks].sort((a, b) => (b.signal || -999) - (a.signal || -999));
      if (sorted.length && (sorted[0].signal || -999) > bestSignal) {
        bestSignal = sorted[0].signal;
        bestSample = sample;
        bestSsid = sorted[0].ssid || '<hidden>';
      }
    });
    if (bestSample) {
      lines.push(`Strongest signal observed: ${bestSsid} at ${bestSignal} dBm (scan #${bestSample.scanNum}).`);
      recs.push(`Best physical location observed: around scan #${bestSample.scanNum} where ${bestSsid} reached ${bestSignal} dBm. This is a strong candidate area for router or primary device placement.`);
    }
    const congested = history.filter(h => h.networks.length >= CONGESTION_THRESHOLD);
    if (congested.length > 0) {
      const spots = congested.map(h => `#${h.scanNum}`).join(', ');
      lines.push(`High-density areas: ${congested.length} scan(s) with ≥${CONGESTION_THRESHOLD} networks (${spots}).`);
      recs.push(`High congestion detected in scans ${spots}. Consider a mesh node or additional AP in/near these areas to reduce contention.`);
    }
    const signalsForTop = [];
    if (history[0] && history[0].networks.length) {
      const topBssid = [...history[0].networks].sort((a,b)=>(b.signal||-999)-(a.signal||-999))[0].bssid;
      history.forEach(h => {
        const n = h.networks.find(x => x.bssid === topBssid);
        if (n && typeof n.signal === 'number') signalsForTop.push(n.signal);
      });
      if (signalsForTop.length > 2) {
        const range = Math.max(...signalsForTop) - Math.min(...signalsForTop);
        lines.push(`Signal range for primary network across walk: ${range} dBm variation.`);
      }
    }
    const uniqueTotal = new Set();
    history.forEach(h => h.networks.forEach(n => { if (n.bssid) uniqueTotal.add(n.bssid); }));
    lines.push(`Total unique networks discovered during walk: ${uniqueTotal.size}.`);
    if (recs.length === 0) {
      recs.push('Walk a bit further or into different rooms for more placement recommendations.');
    }
    return { summaryLines: lines, recommendations: recs };
  }

  // Rogue (Task 7)
  function isOpenNetwork(net) {
    if (!net) return false;
    const caps = String(net.capabilities || '').toUpperCase();
    const hasSecurity = caps.includes('WPA') || caps.includes('RSN') || caps.includes('WEP') || caps.includes('SAE') || caps.includes('OWE') || caps.includes('EAP');
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

  function classifyRogueNetworks(networks) {
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
        if ((typeof net.signal === 'number' && net.signal >= -55) || commonOpen) {
          risk = 'Medium';
          reason = commonOpen ? 'Open network with common public-style name' : 'Open network with strong signal';
        }
      }
      rogues.push({ ssid: net.ssid, bssid: net.bssid, signal: net.signal, frequency: net.frequency, channel: net.channel, risk, reason });
    });
    const riskOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
    rogues.sort((a, b) => {
      const r = (riskOrder[b.risk] || 0) - (riskOrder[a.risk] || 0);
      return r !== 0 ? r : ((b.signal || -999) - (a.signal || -999));
    });
    return rogues;
  }

  function renderRogueList(rogues) {
    const container = el('rogue-list');
    const countEl = el('rogue-count');
    if (!container) return;
    currentRogues = rogues || [];
    if (!rogues || rogues.length === 0) {
      container.innerHTML = '<div class="muted" style="font-size:11px;">No suspicious open networks detected in last scan.</div>';
      if (countEl) countEl.textContent = '';
      return;
    }
    if (countEl) countEl.textContent = `${rogues.length} flagged`;
    let html = '';
    rogues.forEach(r => {
      const color = r.risk === 'High' ? '#f87171' : (r.risk === 'Medium' ? '#facc15' : '#a1a1aa');
      const bars = signalToBars(r.signal);
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:4px 6px; margin:3px 0; border:1px solid var(--border); border-radius:8px; background:rgba(24,24,27,.2);">
          <div style="min-width:0; flex:1;">
            <span style="font-weight:600;">${escapeHtml(r.ssid)}</span>
            <span style="color:var(--muted); font-size:10px; margin-left:4px;">${escapeHtml(r.bssid || '')}</span>
          </div>
          <div style="text-align:right; white-space:nowrap; font-size:11px;">
            <span style="color:${color}; font-weight:700; margin-right:6px;">${r.risk}</span>
            <span style="font-family:monospace;">${bars}</span> ${r.signal} dBm
          </div>
        </div>
        <div style="font-size:10px; color:var(--muted); margin:-2px 0 4px 4px;">${escapeHtml(r.reason)}</div>
      `;
    });
    container.innerHTML = html;
  }

  function updateSurveyRogues(rogues) {
    if (!rogues) return;
    rogues.forEach(r => {
      const existing = surveyRogues.get(r.bssid);
      const newRiskVal = ({High:3, Medium:2, Low:1})[r.risk] || 1;
      const oldRiskVal = existing ? ({High:3, Medium:2, Low:1})[existing.risk] || 1 : 0;
      if (!existing || newRiskVal > oldRiskVal) {
        surveyRogues.set(r.bssid, { ...r });
      }
    });
  }

  async function performRealScan(isSurveyScan = false) {
    if (scanInProgress) return currentNetworks;
    scanInProgress = true;
    const scanBtn = el('wifi-scan-btn');
    const origScanText = scanBtn ? scanBtn.textContent : '';
    if (scanBtn && !isSurveyScan) scanBtn.textContent = 'Scanning...';
    if (scanBtn) scanBtn.disabled = true;
    try {
      const cap = window.Capacitor;
      if (!cap || !cap.Plugins || !cap.Plugins.WifiScanner) {
        showWifiError('Real WiFi scanning requires the Android app (Capacitor native bridge). This feature is not available when opening index.html directly in a browser.');
        return [];
      }
      const result = await cap.Plugins.WifiScanner.scanWifi();
      if (!result || result.success === false) {
        const errMsg = result && result.message ? result.message : (result && result.error) || 'Unknown scan failure';
        showWifiError(errMsg);
        return [];
      }
      lastScanTimestamp = result.lastScanTimestamp || Date.now();
      currentNetworks = Array.isArray(result.networks) ? result.networks : [];
      renderNetworks(currentNetworks);
      const rogues = classifyRogueNetworks(currentNetworks);
      renderRogueList(rogues);
      updateFreshnessUI();
      startFreshnessTimer();
      if (isSurveyScan) {
        for (const net of currentNetworks) {
          if (net.bssid) surveyUnique.add(net.bssid);
        }
        if (!surveyTarget && currentNetworks.length > 0) {
          surveyTarget = pickPrimaryNetwork(currentNetworks);
          if (surveyTarget) logLine(`Path Optimizer target: ${surveyTarget.ssid} (strongest at start)`);
        }
        const motionInfo = detectMovementSinceLastScan();
        if (motionInfo.moved) surveyMovedScans++;
        surveyStepsTotal += (motionInfo.stepDelta || 0);
        const snapshot = {
          scanNum: surveyScanCount,
          timestamp: lastScanTimestamp || Date.now(),
          networks: currentNetworks.slice(),
          moved: !!motionInfo.moved,
          stepDelta: motionInfo.stepDelta || 0
        };
        const guidanceText = computeGuidance(snapshot, surveyHistory);
        if (guidanceText) {
          snapshot.guidance = guidanceText;
          showGuidance(guidanceText);
        }
        surveyHistory.push(snapshot);
        updateSurveyRogues(rogues);
        updateSurveyMovementUI(motionInfo);
        const msg = `Survey scan #${surveyScanCount} — ${currentNetworks.length} networks` + (motionInfo.moved ? ` (moved, ~${motionInfo.stepDelta} steps)` : '');
        logLine(msg);
      } else {
        logLine(`WiFi scan complete — ${currentNetworks.length} networks`);
      }
      window.AppState = window.AppState || {};
      window.AppState.lastWifiScan = { timestamp: lastScanTimestamp, networks: currentNetworks.slice() };
      return currentNetworks;
    } catch (err) {
      showWifiError('Scan failed: ' + (err && err.message ? err.message : err));
      return [];
    } finally {
      scanInProgress = false;
      if (scanBtn) {
        scanBtn.textContent = origScanText || 'Scan Now';
        scanBtn.disabled = false;
      }
      updateSurveyUI();
    }
  }

  async function scanWifiNetworks() {
    const container = el('wifi-results');
    if (container) container.innerHTML = '<div class="muted">Scanning…</div>';
    await performRealScan(false);
  }

  function startWalkingSurvey() {
    if (surveyInterval) return;
    const startBtn = el('start-survey-btn');
    const stopBtn = el('stop-survey-btn');
    const status = el('survey-status');
    const guidance = el('survey-guidance');
    surveyScanCount = 0;
    surveyUnique = new Set();
    surveyStartTs = Date.now();
    surveyHistory = [];
    surveyTarget = null;
    surveyStepsTotal = 0;
    surveyMovedScans = 0;
    surveyRogues.clear();
    currentRogues = [];
    motionSamples = [];
    lastMotionCheckTs = Date.now();
    if (guidance) guidance.style.display = 'none';
    if (status) status.style.display = 'flex';
    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-block';
    startMotionTracking();
    logLine('Walking Survey + Path Optimizer started (real scans + motion, 5s interval)');
    surveyScanCount = 1;
    performRealScan(true).then(() => { updateSurveyUI(); });
    surveyInterval = setInterval(() => {
      surveyScanCount++;
      performRealScan(true).then(() => { updateSurveyUI(); });
    }, SCAN_INTERVAL_MS);
    updateSurveyUI();
  }

  function stopWalkingSurvey() {
    if (!surveyInterval) return;
    clearInterval(surveyInterval);
    surveyInterval = null;
    stopMotionTracking();
    const startBtn = el('start-survey-btn');
    const stopBtn = el('stop-survey-btn');
    const status = el('survey-status');
    const guidance = el('survey-guidance');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (stopBtn) stopBtn.style.display = 'none';
    if (status) status.style.display = 'none';
    if (guidance) guidance.style.display = 'none';
    const durationSec = Math.floor((Date.now() - surveyStartTs) / 1000);
    const baseSummary = `Walking Survey ended — ${surveyScanCount} scans, ${surveyUnique.size} unique networks, ${Math.floor(durationSec / 60)}m ${durationSec % 60}s.`;
    logLine(baseSummary);
    const analysis = analyzeSurveyForRecommendations(surveyHistory);
    const roguesSeen = Array.from(surveyRogues.values()).sort((a,b) => {
      const order = {High:3,Medium:2,Low:1};
      return (order[b.risk]||0) - (order[a.risk]||0);
    });
    const container = el('wifi-results');
    if (container) {
      const sumDiv = document.createElement('div');
      sumDiv.style.cssText = 'margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(16,185,129,.06);';
      let html = `<div style="font-weight:600;margin-bottom:6px;">Path Optimizer – Survey Summary</div><div style="font-size:13px;line-height:1.45;margin-bottom:8px;">Scans: <strong>${surveyScanCount}</strong> • Unique networks: <strong>${surveyUnique.size}</strong> • Duration: <strong>${Math.floor(durationSec / 60)}m ${durationSec % 60}s</strong><br>Movement detected in <strong>${surveyMovedScans}</strong> scans • ~<strong>${surveyStepsTotal}</strong> steps estimated<br><span style="color:var(--muted);font-size:11px;">100% real device data (WiFi scans + accelerometer)</span></div>`;
      if (analysis.summaryLines.length) {
        html += `<div style="margin:6px 0 4px;font-weight:600;font-size:12px;">Observations</div><ul style="margin:2px 0 8px 16px;padding:0;font-size:12px;line-height:1.4;">`;
        analysis.summaryLines.forEach(line => { html += `<li>${escapeHtml(line)}</li>`; });
        html += `</ul>`;
      }
      if (analysis.recommendations.length) {
        html += `<div style="margin:6px 0 4px;font-weight:600;font-size:12px;color:#4ade80;">Recommendations</div><ul style="margin:2px 0 4px 16px;padding:0;font-size:12px;line-height:1.4;color:#a1a1aa;">`;
        analysis.recommendations.forEach(r => { html += `<li>${escapeHtml(r)}</li>`; });
        html += `</ul>`;
      }
      if (roguesSeen.length > 0) {
        html += `<div style="margin:8px 0 4px;font-weight:600;font-size:12px;color:#f87171;">Suspicious Open Networks Seen</div><div style="font-size:11px;">`;
        roguesSeen.slice(0, 6).forEach(r => { html += `${escapeHtml(r.ssid)} <span style="color:${r.risk==='High'?'#f87171':r.risk==='Medium'?'#facc15':'#a1a1aa'};">[${r.risk}]</span> — ${escapeHtml(r.reason)}<br>`; });
        if (roguesSeen.length > 6) html += `... and ${roguesSeen.length-6} more<br>`;
        html += `</div>`;
      }
      if (surveyHistory.length > 0) {
        html += `<div style="margin-top:8px;font-size:11px;color:var(--muted);">Scan log (signal of strongest network at each point):</div><div style="font-family:monospace;font-size:11px;margin-top:2px;line-height:1.3;color:#a1a1aa;">`;
        surveyHistory.forEach(s => {
          const strongest = [...s.networks].sort((a,b)=>(b.signal||-999)-(a.signal||-999))[0];
          const sig = strongest ? `${strongest.signal} dBm` : '—';
          const move = s.moved ? ' +move' : '';
          html += `#${s.scanNum}: ${sig}${move}${s.guidance ? ' • guidance' : ''}<br>`;
        });
        html += `</div>`;
      }
      container.appendChild(sumDiv);
      sumDiv.innerHTML = html;
    }
    logLine('Path Optimizer analysis complete (real data only).');
    window.AppState = window.AppState || {};
    window.AppState.lastSurvey = {
      started: surveyStartTs,
      ended: Date.now(),
      scanCount: surveyScanCount,
      uniqueCount: surveyUnique.size,
      history: surveyHistory.slice(),
      target: surveyTarget,
      steps: surveyStepsTotal,
      movedScans: surveyMovedScans,
      rogues: Array.from(surveyRogues.values())
    };
    surveyScanCount = 0;
    surveyUnique.clear();
    surveyHistory = [];
    surveyTarget = null;
    surveyStepsTotal = 0;
    surveyMovedScans = 0;
    motionSamples = [];
  }

  function wireWifiControls() {
    const scanBtn = el('wifi-scan-btn');
    if (scanBtn) scanBtn.addEventListener('click', () => scanWifiNetworks());
    const startBtn = el('start-survey-btn');
    if (startBtn) startBtn.addEventListener('click', () => startWalkingSurvey());
    const stopBtn = el('stop-survey-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => stopWalkingSurvey());
      stopBtn.style.display = 'none';
    }
    const reportBtn = el('wifi-show-report-btn');
    if (reportBtn) reportBtn.addEventListener('click', () => showWifiReport());
    const info = el('wifi-last-scan');
    if (info) info.textContent = 'Last scan: never';
    console.log('[wifi] WiFi Analyzer controls wired (real scanning only)');
  }

  function showWifiReport() {
    const box = el('results-box');
    if (!box) { alert('No results area available'); return; }
    const last = window.AppState && window.AppState.lastWifiScan;
    const survey = window.getCurrentSurveyData ? window.getCurrentSurveyData() : null;
    const lastSurvey = window.AppState && window.AppState.lastSurvey;
    const activeSurvey = survey && survey.active;
    const dataSource = activeSurvey ? survey : (lastSurvey || {});
    let text = '=== WiFi Analyzer Report (real data only) ===\n';
    text += `Generated: ${new Date().toISOString()}\n\n`;
    if (last && last.networks) {
      text += `Last Scan: ${last.networks.length} networks @ ${new Date(last.timestamp).toLocaleString()}\n`;
      const rogues = classifyRogueNetworks(last.networks);
      if (rogues.length) {
        text += `Suspicious opens in last scan: ${rogues.length}\n`;
        rogues.slice(0,5).forEach(r => text += `  - ${r.ssid} [${r.risk}] ${r.signal}dBm — ${r.reason}\n`);
      }
    }
    const hist = (activeSurvey ? dataSource.history : (lastSurvey && lastSurvey.history)) || [];
    if (hist.length) {
      text += `\nSurvey Session (${hist.length} scans):\n`;
      text += `  Unique networks: ${dataSource.unique || (lastSurvey && lastSurvey.uniqueCount) || '?'}\n`;
      text += `  Steps/movement: ${dataSource.steps || (lastSurvey && lastSurvey.steps) || 0} steps, moved in ${dataSource.movedScans || (lastSurvey && lastSurvey.movedScans) || 0} scans\n`;
      const rogues = (activeSurvey ? dataSource.rogues : (lastSurvey && lastSurvey.rogues)) || [];
      if (rogues.length) text += `  Rogue/suspicious opens seen: ${rogues.length}\n`;
    }
    if (hist.length > 0) {
      const analysis = analyzeSurveyForRecommendations(hist);
      if (analysis.recommendations && analysis.recommendations.length) {
        text += `\nRecommendations:\n`;
        analysis.recommendations.forEach(r => { text += `  • ${r}\n`; });
      }
    }
    text += `\n(Full structured data available via getCurrentSurveyData() and AppState.lastSurvey)\n`;
    text += '=== End WiFi Report ===\n';
    if (typeof clearResults === 'function') clearResults();
    if (typeof appendResult === 'function') {
      appendResult(text);
    } else {
      box.value = (box.value ? box.value + '\n\n' : '') + text;
    }
    logLine('WiFi Report generated (on-screen summary)');
    if (confirm('WiFi Report shown in results. Export detailed JSON now?')) {
      if (typeof window.exportWifiReport === 'function') window.exportWifiReport();
    }
  }

  window.scanWifiNetworks = scanWifiNetworks;
  window.startWalkingSurvey = startWalkingSurvey;
  window.stopWalkingSurvey = stopWalkingSurvey;
  window.getLastWifiScan = () => ({ timestamp: lastScanTimestamp, networks: currentNetworks.slice() });
  window.getCurrentSurveyData = () => ({
    active: !!surveyInterval,
    history: surveyHistory.slice(),
    target: surveyTarget,
    steps: surveyStepsTotal,
    movedScans: surveyMovedScans,
    unique: surveyUnique.size,
    rogues: Array.from(surveyRogues.values())
  });
  window.showWifiReport = showWifiReport;
  window.classifyRogueNetworks = classifyRogueNetworks;
  window.exportWifiReport = function() {
    const wifiPayload = {
      generated: new Date().toISOString(),
      lastScan: window.AppState && window.AppState.lastWifiScan ? window.AppState.lastWifiScan : null,
      lastSurvey: window.AppState && window.AppState.lastSurvey ? window.AppState.lastSurvey : null,
      currentSurvey: (typeof window.getCurrentSurveyData === 'function') ? window.getCurrentSurveyData() : null
    };
    if (wifiPayload.lastScan && wifiPayload.lastScan.networks && typeof window.classifyRogueNetworks === 'function') {
      try { wifiPayload.lastScan.rogueAnalysis = window.classifyRogueNetworks(wifiPayload.lastScan.networks); } catch(e){}
    }
    const json = JSON.stringify(wifiPayload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wifi-analyzer-report.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireWifiControls);
  } else {
    wireWifiControls();
  }
  setTimeout(() => {
    if (lastScanTimestamp && !freshnessTimer) startFreshnessTimer();
  }, 1200);
  console.log('[wifi] wifi.js loaded — real scanning + Walking Survey + Path Optimizer ready (no mocks) for Wifi Analyzer app');
})();