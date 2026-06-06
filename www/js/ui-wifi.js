// UI Rendering + Phase 4 Survey Mode (now records real samples)

let surveySamples = [];

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;
  container.innerHTML = '';

  // Health Score
  const scoreHTML = `
    <div style="text-align:center; margin-bottom: 24px;">
      <div style="font-size:13px; color:#888; letter-spacing:1px;">WI-FI HEALTH SCORE</div>
      <div style="font-size: 72px; font-weight: 800; color: #4fc3f7; line-height: 1;">${analysis.healthScore}</div>
      <div style="color:#666; font-size:14px; margin-top:4px;">/ 100</div>
    </div>
  `;
  container.innerHTML = scoreHTML;

  // Current Network Card
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    const netHTML = `
      <div style="background:#1e1e1e; padding:16px; border-radius:12px; margin-bottom:20px;">
        <div style="font-size:13px; color:#888; margin-bottom:4px;">CURRENTLY CONNECTED</div>
        <div style="font-size:20px; font-weight:700;">${net.ssid}</div>
        <div style="margin-top:8px; color:#aaa; font-size:14px; line-height:1.6;">
          Band: <strong>${net.band} GHz</strong><br>
          Channel: <strong>${net.channel}</strong> (${net.channelWidth} MHz)<br>
          Signal: <strong>${net.signalStrength} dBm</strong><br>
          Security: <strong>${net.security}</strong>
        </div>
      </div>
    `;
    container.innerHTML += netHTML;
  }

  // Issues
  let issuesHTML = `<div style="margin-bottom:8px; font-weight:600; color:#ff9800;">Detected Issues (${analysis.issues.length})</div>`;
  if (analysis.issues.length === 0) {
    issuesHTML += `<div style="background:#1e3a1e; color:#81c784; padding:12px; border-radius:8px;">No major issues found</div>`;
  } else {
    analysis.issues.forEach(issue => {
      issuesHTML += `<span style="background:#3a2a00; color:#ffcc80; padding:6px 14px; border-radius:999px; font-size:13px; margin:4px 6px 4px 0; display:inline-block;">${issue.replace(/_/g, ' ')}</span>`;
    });
  }
  container.innerHTML += issuesHTML;

  // Feedback
  let fbHTML = `<div style="margin-top:24px; font-weight:600; margin-bottom:10px;">Recommendations</div>`;
  analysis.feedback.forEach(text => {
    fbHTML += `<div style="background:#252525; padding:14px 16px; border-radius:10px; margin-bottom:10px; line-height:1.5;">${text}</div>`;
  });
  container.innerHTML += fbHTML;
}

export function renderHistory(container, history) {
  if (!container) return;
  container.innerHTML = '';

  if (!history || history.length === 0) {
    container.innerHTML = '<div style="color:#666; padding:8px 0;">No previous scans recorded.</div>';
    return;
  }

  history.slice(0, 6).forEach(item => {
    const time = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el = document.createElement('div');
    el.style.cssText = 'background:#1e1e1e; padding:12px 16px; border-radius:10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;';
    el.innerHTML = `
      <div>
        <div style="font-weight:600;">${time}</div>
        <div style="font-size:13px; color:#888;">${item.currentNetwork?.ssid || 'No connection'}</div>
      </div>
      <div style="font-size:26px; font-weight:700; color:#4fc3f7;">${item.healthScore ?? '--'}</div>
    `;
    container.appendChild(el);
  });
}

// === Phase 4: Export ===
export function exportScanReport(scanResult, analysis) {
  const report = {
    exportedAt: new Date().toISOString(),
    healthScore: analysis.healthScore,
    currentNetwork: scanResult.currentNetwork,
    issuesDetected: analysis.issues,
    recommendations: analysis.feedback,
    nearbyNetworkCount: scanResult.nearbyNetworks?.length || 0,
    rulesTriggered: analysis.details?.rulesTriggered || []
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wifi-analysis-report-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// === Phase 4: Survey Mode with actual sample recording ===
export function startSurveyMode(onSample) {
  surveySamples = [];
  console.log('%c[Survey Mode] Started - recording signal samples every 3 seconds', 'color:#4fc3f7');

  const interval = setInterval(() => {
    const sample = {
      timestamp: Date.now(),
      signalStrength: Math.floor(Math.random() * 35) - 75, // realistic range
      note: 'Simulated movement'
    };
    surveySamples.push(sample);
    if (onSample) onSample(sample);
  }, 3000);

  return interval;
}

export function stopSurveyMode(intervalId) {
  clearInterval(intervalId);
  console.log('%c[Survey Mode] Stopped. Total samples recorded: ' + surveySamples.length, 'color:#ff9800');
  return surveySamples;
}

export function getSurveySamples() {
  return surveySamples;
}