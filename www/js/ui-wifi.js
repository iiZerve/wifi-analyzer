// UI Layer (runtime copy) - Enhanced with real Walking Survey (movement + guidance + rich summary), rogue list, no mocks

import { scanWifi } from './wifi-scanner.js';
import { classifyRogueNetworks } from './wifi-analyzer.js';

function drawSpeedometer(canvas, score, showNumber = true) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;                 // true center for high-tech circular HUD gauge
  const radius = Math.min(w, h) * 0.40;

  ctx.clearRect(0, 0, w, h);

  const p = Math.max(0, Math.min(100, score)) / 100;

  // Health-based neon color (brighter to evoke the reference's glowing cyan/magenta)
  let color;
  if (score <= 50) {
    color = '#ff6b6b';
  } else if (score <= 74) {
    color = '#ff9f43';
  } else if (score <= 89) {
    color = '#feca57';
  } else {
    color = '#00e5ff';  // bright cyan like the reference
  }

  // === High-tech futuristic circular gauge (inspired by the reference PNG) ===
  // Outer industrial metal bezel + bolts + struts for 3D mechanical look
  // Glowing neon progress ring (thick band with simulated glow)
  // Inner HUD display panel
  // Big glowing percentage centered inside the ring (like the 67% in reference)

  // 1. Far outer dark metal frame (multiple rings for depth)
  ctx.strokeStyle = '#0a0f1a';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 22, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = '#1a2438';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2);
  ctx.stroke();

  // 2. Bolts / rivets around the outer rim (12 positions, industrial look)
  ctx.fillStyle = '#2a3548';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const bx = cx + Math.cos(a) * (radius + 18);
    const by = cy + Math.sin(a) * (radius + 18);
    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // small highlight
    ctx.fillStyle = '#3f4a5c';
    ctx.beginPath();
    ctx.arc(bx - 1, by - 1, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a3548';
  }

  // 3. Main dark gauge track ring (the housing)
  ctx.strokeStyle = '#111a28';
  ctx.lineWidth = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Glowing progress ring (thick neon band + glow layers to match reference's bright cyan-pink arc)
  const startAngle = -Math.PI * 0.9;
  const endAngle = startAngle + (p * Math.PI * 1.8);  // ~325 degree sweep for full high-tech ring feel

  // Outer soft glow
  ctx.strokeStyle = color;
  ctx.lineWidth = 36;
  ctx.globalAlpha = 0.15;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, false);
  ctx.stroke();

  // Mid glow
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, false);
  ctx.stroke();

  // Main bright band
  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, false);
  ctx.stroke();

  // Inner highlight edge
  ctx.strokeStyle = '#ffffff';
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle, false);
  ctx.stroke();

  ctx.globalAlpha = 1.0;

  // 5. Inner metal bezel / frame detail
  ctx.strokeStyle = '#2a3548';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
  ctx.stroke();

  // 6. Small radial tick / HUD marks on the inner ring (for tech detail, not full old labels)
  ctx.strokeStyle = 'rgba(100, 120, 150, 0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const ix = cx + Math.cos(a) * (radius - 18);
    const iy = cy + Math.sin(a) * (radius - 18);
    const ox = cx + Math.cos(a) * (radius - 10);
    const oy = cy + Math.sin(a) * (radius - 10);
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ox, oy);
    ctx.stroke();
  }

  if (showNumber) {
    // 7. Center dark HUD display panel (the "screen" where the number lives)
    ctx.fillStyle = '#0a111f';
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 22, 0, Math.PI * 2);
    ctx.fill();

    // Subtle inner ring on the display
    ctx.strokeStyle = 'rgba(60, 80, 110, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 26, 0, Math.PI * 2);
    ctx.stroke();

    // Very subtle HUD grid / data lines inside the center (scifi feel)
    ctx.strokeStyle = 'rgba(70, 95, 130, 0.25)';
    ctx.lineWidth = 0.8;
    for (let i = -2; i <= 2; i++) {
      const ly = cy + i * 8;
      ctx.beginPath();
      ctx.moveTo(cx - (radius - 40), ly);
      ctx.lineTo(cx + (radius - 40), ly);
      ctx.stroke();
    }
    // a couple vertical too
    for (let i = -1; i <= 1; i++) {
      const lx = cx + i * 12;
      ctx.beginPath();
      ctx.moveTo(lx, cy - (radius - 45));
      ctx.lineTo(lx, cy + (radius - 45));
      ctx.stroke();
    }

    // 8. Big glowing percentage in the exact center (the star of the reference image)
    const displayText = Math.round(score) + '%';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 52px system-ui, -apple-system, sans-serif';

    // Neon glow layers (multiple passes for brightness like the reference)
    ctx.shadowColor = color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#e0f7ff';
    ctx.fillText(displayText, cx, cy);

    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(displayText, cx, cy);

    // Main crisp text
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.fillText(displayText, cx, cy);

    // Small "HEALTH" label inside top of the display for extra HUD polish (optional but fits reference style)
    ctx.font = '10px system-ui';
    ctx.fillStyle = 'rgba(140, 170, 200, 0.7)';
    ctx.fillText('HEALTH', cx, cy - 28);
  } else {
    // For initial/empty state: draw a subtle empty center without the number or full inner HUD details
    // (keeps the outer gauge looking ready but no 0% text)
    ctx.fillStyle = 'rgba(10, 17, 31, 0.6)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 22, 0, Math.PI * 2);
    ctx.fill();
  }
}

export { drawSpeedometer };

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;
  container.innerHTML = '';

  // High-tech futuristic gauge (big % drawn inside the canvas center like the reference PNG).
  const hs = (analysis && typeof analysis.healthScore === 'number') ? analysis.healthScore : 0;
  if (hs > 0) {
    const scoreHTML = `
      <div style="text-align:center; margin-bottom:8px;">
        <div style="font-size:12px; color:#4fc3f7; font-weight:600; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase;">Health Score</div>
        <canvas id="healthGauge" width="240" height="240" style="display:block; margin:0 auto;"></canvas>
      </div>
    `;
    container.innerHTML = scoreHTML;

    const gaugeCanvas = container.querySelector('#healthGauge');
    if (gaugeCanvas) {
      let currentProgress = 0;
      const target = hs;
      const duration = 4200;
      const startTime = Date.now();
      const animateGauge = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(elapsed / duration, 1);
        currentProgress = target * (1 - Math.pow(1 - t, 3));
        drawSpeedometer(gaugeCanvas, currentProgress, true);
        if (t < 1) {
          requestAnimationFrame(animateGauge);
        } else {
          drawSpeedometer(gaugeCanvas, target, true);
        }
      };
      animateGauge();
    }
  }

  // Current Network
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    const netHTML = `
      <div style="background:#252525; padding:16px; border-radius:12px; margin-bottom:16px;">
        <div style="font-weight:700; font-size:18px;">${net.ssid}</div>
        <div style="margin-top:8px; color:#aaa; font-size:14px; line-height:1.6;">
          ${net.band} GHz • Channel ${net.channel} (${net.channelWidth} MHz)<br>
          Signal: <strong>${net.signalStrength} dBm</strong><br>
          ${net.linkSpeed ? `Link Speed: <strong>${net.linkSpeed} Mbps</strong><br>` : ''}
          Security: <strong>${net.security}</strong>
        </div>
      </div>
    `;
    container.innerHTML += netHTML;
  }

  // Best Alternative
  if (scanResult.bestAlternativeNetwork) {
    const alt = scanResult.bestAlternativeNetwork;
    const altHTML = `
      <div style="margin-bottom:16px; color:#aaa;">
        Best alternative: <strong>${alt.ssid}</strong> (${alt.signalStrength} dBm)
      </div>
    `;
    container.innerHTML += altHTML;
  }

  // Environment Overview
  const totalNets = scanResult.totalNearbyNetworks || (scanResult.nearbyNetworks?.length || 0);
  const bandSplit = scanResult.bandSplit || { '2.4': 0, '5': 0, '6': 0 };
  const congestion = scanResult.channelCongestionLevel || 'Low';
  const onChannel = scanResult.networksOnCurrentChannel || 0;
  const envHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-weight:600; margin-bottom:8px;">Environment</div>
      <div style="color:#aaa;">${totalNets} nearby networks detected<br>
      ${bandSplit['2.4']} on 2.4 GHz • ${bandSplit['5'] + bandSplit['6']} on 5/6 GHz<br>
      ${onChannel} networks on your channel (${congestion} congestion)</div>
    </div>
  `;
  container.innerHTML += envHTML;

  // Issues
  let issuesHTML = `<div style="font-weight:600; margin-bottom:8px;">Issues (${analysis.issues.length})</div>`;
  if (analysis.issues.length === 0) {
    issuesHTML += `<div style="color:#81c784;">No major issues found</div>`;
  } else {
    analysis.issues.forEach(issue => {
      issuesHTML += `<span style="background:#3a2a00; color:#ffcc80; padding:6px 12px; border-radius:20px; font-size:13px; margin:4px 6px 4px 0; display:inline-block;">
        ${issue.replace(/_/g, ' ')}
      </span>`;
    });
  }
  container.innerHTML += issuesHTML;

  // Recommendations
  let recHTML = `<div style="margin-top:20px; font-weight:600; margin-bottom:8px;">Recommendations</div>`;
  analysis.feedback.forEach(text => {
    recHTML += `<div style="background:transparent; padding:14px; border-radius:10px; margin-bottom:10px; line-height:1.5;">${text}</div>`;
  });
  container.innerHTML += recHTML;

  // Current Network Card - styled to match reference
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    const netDiv = document.createElement('div');
    netDiv.className = 'network-card';
    netDiv.innerHTML = `
      <div class="network-title">Connected to</div>
      <div class="network-ssid">${net.ssid}</div>
      <div class="network-details">
        ${net.band || '?'} GHz • Ch ${net.channel || '?'} • ${net.signalStrength} dBm • ${net.security || ''}
      </div>
    `;
    container.appendChild(netDiv);
  } else {
    const note = document.createElement('div');
    note.className = 'network-note';
    note.textContent = 'Not connected. Showing nearby networks from real scan.';
    container.appendChild(note);
  }

  // Issues section - clean pills
  if (analysis.issues && analysis.issues.length > 0) {
    const issuesDiv = document.createElement('div');
    issuesDiv.className = 'issues-section';
    issuesDiv.innerHTML = `<div class="section-title">Issues (${analysis.issues.length})</div>`;
    const pillsWrap = document.createElement('div');
    pillsWrap.className = 'issues-pills';
    analysis.issues.forEach(issue => {
      const pill = document.createElement('span');
      pill.className = 'issue-pill';
      pill.textContent = issue.replace(/_/g, ' ');
      pillsWrap.appendChild(pill);
    });
    issuesDiv.appendChild(pillsWrap);
    container.appendChild(issuesDiv);
  }

  // Recommendations / Feedback - clean cards matching reference
  if (analysis.feedback && analysis.feedback.length > 0) {
    const fbDiv = document.createElement('div');
    fbDiv.className = 'recommendations-section';
    fbDiv.innerHTML = `<div class="section-title">Recommendations</div>`;
    analysis.feedback.forEach(text => {
      const rec = document.createElement('div');
      rec.className = 'recommendation';
      rec.textContent = text;
      fbDiv.appendChild(rec);
    });
    container.appendChild(fbDiv);
  }
}

export function renderHistory(container, history) {
  if (!container) return;
  container.innerHTML = '';
  if (history.length === 0) {
    container.innerHTML = '<div style="color:#666; font-size:12px;">No scans yet</div>';
    return;
  }
  history.slice(0,6).forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const hs = (item && typeof item.healthScore === 'number') ? item.healthScore : '--';
    el.innerHTML = `<div>${time} - ${item.currentNetwork?.ssid || 'No connection'}</div><div style="font-weight:700;color:#4fc3f7;">${hs}</div>`;
    container.appendChild(el);
  });
}

export async function exportScanReport(scanResult, analysis) {
  const report = {
    exportedAt: new Date().toISOString(),
    healthScore: analysis.healthScore,
    currentNetwork: scanResult.currentNetwork,
    issues: analysis.issues,
    feedback: analysis.feedback,
    nearbyNetworks: scanResult.nearbyNetworks,
    rogues: analysis.rogues || []
  };
  const json = JSON.stringify(report, null, 2);
  const filename = `wifi-report-${Date.now()}.json`;

  const cap = (typeof window !== 'undefined' && window.Capacitor) ? window.Capacitor : null;
  if (cap && cap.Plugins && cap.Plugins.Filesystem) {
    try {
      await cap.Plugins.Filesystem.writeFile({
        path: filename,
        data: json,
        directory: 'DOCUMENTS',
        encoding: 'utf8'
      });
      // Show success in UI if possible (the caller can handle alert)
      alert('Report saved to Documents/' + filename);
      return;
    } catch (e) {
      console.error('Filesystem export failed, falling back to download', e);
    }
  }

  // Fallback to browser download (works in some WebViews)
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Real Walking Survey implementation (no mocks, real scans + movement + guidance + rich summary + rogues with severity)
let _surveyState = { intervalId: null, samples: [], roguesSeen: [], guidanceLog: [], startTs: 0, onUpdate: null };
let _motionListener = null;
let _motionSamples = [];
let _lastMotionTs = 0;

function startMotionTracking() {
  if (_motionListener) return;
  if (!('DeviceMotionEvent' in window)) { console.log('[Survey] Motion unavailable'); return; }
  _motionSamples = []; _lastMotionTs = Date.now();
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
  if (_motionListener) { window.removeEventListener('devicemotion', _motionListener); _motionListener = null; }
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
    if (mags[i] > mags[i-1] + 0.9 && mags[i] > 10.5) stepDelta++;
  }
  return { moved, stepDelta };
}

function computeGuidance(current, prev, rogues) {
  if (!prev || !current) return null;
  const msgs = [];
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
  console.log('%c[Survey Mode] Started real scanning + movement (no mocks)', 'color:#4fc3f7');
  _surveyState = { intervalId: null, samples: [], roguesSeen: [], guidanceLog: [], startTs: Date.now(), onUpdate };
  startMotionTracking();
  const doRealSample = async () => {
    try {
      const scan = await scanWifi();
      const analysis = (typeof window.analyzeScan === 'function') ? window.analyzeScan(scan) : { rogues: [] };
      const mov = detectMovement();
      const guidance = computeGuidance(scan, _surveyState.samples.length > 0 ? _surveyState.samples[_surveyState.samples.length-1].scan : null, analysis.rogues || []);
      const sample = { timestamp: Date.now(), scan, analysis, moved: mov.moved, stepDelta: mov.stepDelta, guidance };
      _surveyState.samples.push(sample);
      if (analysis.rogues && analysis.rogues.length) {
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
  await doRealSample();
  _surveyState.intervalId = setInterval(doRealSample, 5000);
  return _surveyState;
}

export function stopSurveyMode() {
  if (_surveyState.intervalId) { clearInterval(_surveyState.intervalId); _surveyState.intervalId = null; }
  stopMotionTracking();
  const samples = _surveyState.samples;
  const rogues = _surveyState.roguesSeen || [];
  const duration = Math.floor((Date.now() - _surveyState.startTs) / 1000);
  let summary = `Survey complete: ${samples.length} real scans, ${duration}s, ${rogues.length} suspicious opens.\n`;

  if (samples.length > 0) {
    // Best location by strongest single network observed
    const best = samples.reduce((best, s) => {
      const strong = (s.scan.nearbyNetworks || []).sort((a,b) => (b.signalStrength||-999) - (a.signalStrength||-999))[0];
      if (strong && (!best || strong.signalStrength > best.signalStrength)) return strong;
      return best;
    }, null);
    if (best) summary += `Strongest observed: ${best.ssid} @ ${best.signalStrength} dBm\n`;

    // Average signal of the top network per sample (real movement data)
    const topSignals = samples.map(s => {
      const t = (s.scan.nearbyNetworks || []).sort((a,b) => (b.signalStrength||-999)-(a.signalStrength||-999))[0];
      return t ? t.signalStrength : null;
    }).filter(v => typeof v === 'number');
    if (topSignals.length) {
      const avg = Math.round(topSignals.reduce((a,b)=>a+b,0) / topSignals.length);
      summary += `Average top-network signal: ${avg} dBm across ${topSignals.length} samples\n`;
    }
  }

  if (rogues.length) {
    const high = rogues.filter(r => r.risk === 'High').length;
    summary += `${high} high-risk (evil-twin candidates).\n`;
  }
  summary += 'All data from real device scans + accelerometer. No simulated data.';
  if (typeof _surveyState.onUpdate === 'function') _surveyState.onUpdate({ summary, samples, rogues });
  return { samples, rogues, summary, duration };
}

export function getSurveySamples() {
  return _surveyState.samples || [];
}

export function renderRogueListInContainer(container, rogues) {
  renderRogueList(container, rogues);
}

// === Network Discovery device list rendering helper (supports manufacturer + good hostname display)
export function renderDiscoveredDeviceRow(device) {
  const div = document.createElement('div');
  const highlight = device.isCurrentDevice ? ' style="background:#1a2a1a; padding:4px; border-radius:4px;"' : '';
  const bestName = device.hostname && device.hostname !== device.ipAddress ? device.hostname : null;
  let html = `<div${highlight}>`;
  if (bestName) {
    html += `<strong style="color:#4fc3f7;">${bestName}</strong> <small style="color:#888;">${device.ipAddress || ''}</small>`;
  } else {
    html += `<strong>${device.ipAddress || ''}</strong>`;
  }
  if (device.macAddress && device.macAddress !== "N/A (self)") html += ` — ${device.macAddress}`;

  const methods = (device.detectionMethods || []).join(', ');
  html += ` <small style="color:#888;">[${methods || 'unknown'}]</small>`;

  const mfr = (device.manufacturer && device.manufacturer !== "Unknown") ? device.manufacturer : null;
  const dtype = (device.deviceType && device.deviceType !== "Unknown Device") ? device.deviceType : null;
  if (mfr || dtype) {
    const label = [mfr, dtype].filter(Boolean).join(" ");
    html += ` <span style="color:#f59e0b; font-size:11px;">${label}</span>`;
  }
  if (device.confidence) html += ` <small>(${device.confidence})</small>`;
  if (device.isCurrentDevice) html += ' <strong>(this device)</strong>';
  html += '</div>';
  div.innerHTML = html;
  return div.firstElementChild || div;
}
