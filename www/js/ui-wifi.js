// UI Layer - Phase 4 additions (Export + Survey Mode UI)

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;
  container.innerHTML = '';

  const scoreDiv = document.createElement('div');
  scoreDiv.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <div style="font-size:13px;color:#888;">HEALTH SCORE</div>
      <div style="font-size:68px;font-weight:800;color:#4fc3f7;line-height:1;">${analysis.healthScore}</div>
    </div>
  `;
  container.appendChild(scoreDiv);

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

  const issuesDiv = document.createElement('div');
  issuesDiv.innerHTML = `<strong style="color:#ff9800;">Issues (${analysis.issues.length})</strong>`;
  analysis.issues.forEach(issue => {
    const pill = document.createElement('span');
    pill.style.cssText = 'background:#3a2a00;color:#ffcc80;padding:6px 12px;border-radius:20px;font-size:12px;margin:6px 6px 0 0;display:inline-block;';
    pill.textContent = issue.replace(/_/g, ' ');
    issuesDiv.appendChild(pill);
  });
  container.appendChild(issuesDiv);

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

export function exportScanReport(scanResult, analysis) {
  const report = {
    exportedAt: new Date().toISOString(),
    healthScore: analysis.healthScore,
    currentNetwork: scanResult.currentNetwork,
    issues: analysis.issues,
    feedback: analysis.feedback,
    nearbyNetworks: scanResult.nearbyNetworks
  };

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wifi-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function startSurveyMode(onUpdate) {
  console.log('%c[Survey Mode] Started recording signal samples...', 'color:#4fc3f7');
  return setInterval(() => {
    onUpdate({ timestamp: Date.now(), signal: Math.floor(Math.random() * 40) - 80 });
  }, 3000);
}

export function stopSurveyMode(intervalId) {
  clearInterval(intervalId);
  console.log('%c[Survey Mode] Stopped.', 'color:#ff9800');
}