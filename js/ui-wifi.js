// UI Layer - Phases 2 & 3
// Renders health score, issues, feedback, and history

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;

  container.innerHTML = '';

  // Health Score
  const scoreEl = document.createElement('div');
  scoreEl.className = 'health-score-card';
  scoreEl.innerHTML = `
    <div style="font-size:13px; color:#aaa; margin-bottom:4px;">WI-FI HEALTH SCORE</div>
    <div style="font-size:72px; font-weight:700; line-height:1; color:#4fc3f7;">${analysis.healthScore}</div>
    <div style="font-size:14px; color:#888;">out of 100</div>
  `;
  container.appendChild(scoreEl);

  // Current Network Info
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    const netEl = document.createElement('div');
    netEl.className = 'current-network-card';
    netEl.style.cssText = 'margin-top:20px; background:#1e1e1e; padding:16px; border-radius:10px;';
    netEl.innerHTML = `
      <div style="font-weight:600; margin-bottom:8px;">Currently Connected</div>
      <div style="font-size:18px; font-weight:600;">${net.ssid}</div>
      <div style="color:#aaa; font-size:13px; margin-top:4px;">
        ${net.band} GHz • Channel ${net.channel} • ${net.signalStrength} dBm • ${net.security}
      </div>
    `;
    container.appendChild(netEl);
  }

  // Issues Section
  const issuesEl = document.createElement('div');
  issuesEl.style.marginTop = '24px';
  issuesEl.innerHTML = `<div style="font-weight:600; margin-bottom:12px; color:#ff9800;">Detected Issues (${analysis.issues.length})</div>`;

  if (analysis.issues.length === 0) {
    const good = document.createElement('div');
    good.style.cssText = 'background:#1e3a1e; padding:12px 16px; border-radius:8px; color:#81c784;';
    good.textContent = '✓ No major issues found';
    issuesEl.appendChild(good);
  } else {
    analysis.issues.forEach(issue => {
      const pill = document.createElement('div');
      pill.style.cssText = 'background:#3a2a00; color:#ffcc80; padding:8px 14px; border-radius:20px; display:inline-block; margin:4px 6px 4px 0; font-size:13px;';
      pill.textContent = issue.replace(/_/g, ' ');
      issuesEl.appendChild(pill);
    });
  }
  container.appendChild(issuesEl);

  // Feedback Section
  const fbEl = document.createElement('div');
  fbEl.style.marginTop = '24px';
  fbEl.innerHTML = `<div style="font-weight:600; margin-bottom:12px;">Recommendations</div>`;

  analysis.feedback.forEach(text => {
    const item = document.createElement('div');
    item.style.cssText = 'background:#1e1e1e; padding:14px 16px; border-radius:10px; margin-bottom:10px; line-height:1.5; font-size:14.5px;';
    item.textContent = text;
    fbEl.appendChild(item);
  });

  container.appendChild(fbEl);
}

export function renderHistory(container, history) {
  if (!container) return;
  container.innerHTML = '';

  if (history.length === 0) {
    container.innerHTML = '<div style="color:#666; padding:12px 0;">No previous scans yet.</div>';
    return;
  }

  history.slice(0, 5).forEach((scan, index) => {
    const item = document.createElement('div');
    item.style.cssText = 'background:#1e1e1e; padding:12px 16px; border-radius:10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;';
    
    const date = new Date(scan.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    const score = scan.healthScore || '—';

    item.innerHTML = `
      <div>
        <div style="font-weight:600;">${date}</div>
        <div style="font-size:13px; color:#888;">${scan.currentNetwork ? scan.currentNetwork.ssid : 'No connection'}</div>
      </div>
      <div style="font-size:22px; font-weight:700; color:#4fc3f7;">${score}</div>
    `;
    container.appendChild(item);
  });
}