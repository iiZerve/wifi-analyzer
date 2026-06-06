// UI Layer - Phase 4

let surveySamples = [];

export function renderScanResult(container, scanResult, analysis) {
  if (!container) return;
  container.innerHTML = '';

  // Health Score
  container.innerHTML = `
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:13px;color:#888;">WI-FI HEALTH SCORE</div>
      <div style="font-size:68px;font-weight:800;color:#4fc3f7;">${analysis.healthScore}</div>
    </div>
  `;

  // Current Network
  if (scanResult.currentNetwork) {
    const net = scanResult.currentNetwork;
    container.innerHTML += `
      <div style="background:#1e1e1e;padding:16px;border-radius:12px;margin-bottom:20px;">
        <strong>Connected to:</strong> ${net.ssid}<br>
        <span style="color:#aaa;font-size:13px;">
          ${net.band} GHz • Ch ${net.channel} • ${net.signalStrength} dBm • ${net.security}
        </span>
      </div>
    `;
  }

  // Issues
  let issuesHTML = `<div style="font-weight:600;color:#ff9800;margin-bottom:8px;">Issues (${analysis.issues.length})</div>`;
  if (analysis.issues.length === 0) {
    issuesHTML += `<div style="background:#1e3a1e;color:#81c784;padding:10px;border-radius:8px;">No major issues</div>`;
  } else {
    analysis.issues.forEach(i => {
      issuesHTML += `<span style="background:#3a2a00;color:#ffcc80;padding:5px 12px;border-radius:20px;font-size:12px;margin-right:6px;display:inline-block;">${i.replace(/_/g,' ')}</span>`;
    });
  }
  container.innerHTML += issuesHTML;

  // Rogue Networks (if any)
  if (analysis.details && analysis.details.suspiciousNetworks && analysis.details.suspiciousNetworks.length > 0) {
    let rogueHTML = `<div style="margin-top:16px;font-weight:600;color:#ff5252;">Suspicious Networks Detected</div>`;
    analysis.details.suspiciousNetworks.forEach(n => {
      rogueHTML += `<div style="background:#2a1a1a;padding:8px 12px;border-radius:6px;margin-top:6px;font-size:13px;">
        ${n.ssid} (${n.signalStrength} dBm, Ch ${n.channel})
      </div>`;
    });
    container.innerHTML += rogueHTML;
  }

  // Feedback
  let fbHTML = `<div style="margin-top:20px;font-weight:600;margin-bottom:8px;">Recommendations</div>`;
  analysis.feedback.forEach(text => {
    fbHTML += `<div style="background:#252525;padding:13px 15px;border-radius:10px;margin-bottom:8px;line-height:1.5;">${text}</div>`;
  });
  container.innerHTML += fbHTML;
}

export function renderHistory(container, history) {
  if (!container) return;
  container.innerHTML = '';
  if (!history?.length) {
    container.innerHTML = '<div style="color:#666;">No history yet</div>';
    return;
  }
  history.slice(0,5).forEach(item => {
    const el = document.createElement('div');
    el.style.cssText = 'background:#1e1e1e;padding:10px 14px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;';
    const time = new Date(item.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    el.innerHTML = `<div>${time} - ${item.currentNetwork?.ssid || 'No connection'}</div><div style="font-weight:700;color:#4fc3f7;font-size:22px;">${item.healthScore ?? '--'}</div>`;
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
    suspiciousNetworks: analysis.details?.suspiciousNetworks || [],
    rulesTriggered: analysis.details?.rulesTriggered || []
  };
  const blob = new Blob([JSON.stringify(report, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `wifi-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function startSurveyMode(onSample) {
  surveySamples = [];
  return setInterval(() => {
    const sample = { timestamp: Date.now(), signalStrength: Math.floor(Math.random()*35)-75 };
    surveySamples.push(sample);
    if (onSample) onSample(sample);
  }, 3000);
}

export function stopSurveyMode(interval) {
  clearInterval(interval);
  return surveySamples;
}