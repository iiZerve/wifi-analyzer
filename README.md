# WiFi Analyzer

**Advanced local WiFi diagnostics for Android**

A clean, privacy-first network diagnostic tool that runs entirely on your device. No accounts, no tracking, no data collection.

## Features

- **Speed Test (Improved Accuracy)** — Multi-cycle (median of 3), 8+ adaptive parallel streams, first-chunk warmup timing, trimmed-mean aggregation, optional multi-endpoint averaging, plus concurrent under-load probes that report jitter, loss, and bufferbloat during the transfer. See RESEARCH_NATIVE_NETWORKING.md for why we stayed in the browser.
- **Multi-Server Ping** — Pings multiple global endpoints (Google, Cloudflare, AWS, Microsoft, Akamai, Quad9) for better geographic accuracy
- **Performance Charts** — Visual history of speed test results over time
- **Diagnostic Tools**
  - NSLookup
  - IP Config + Local IP detection
- **Activity Log** — Keeps the last 5 actions with export option
- **WiFi Analyzer** — Real scanning, Walking Survey with movement tracking, rogue detection, path optimizer guidance and recommendations.
- **Fully Local** — Everything runs in the browser with no backend or data sharing

## Privacy

WiFi Analyzer is designed with privacy as a core principle:
- No accounts or sign-in required
- No data is sent to any server owned by the developer
- All speed tests and diagnostics use public third-party endpoints
- No analytics, crash reporting, or telemetry
- Open source (recommended)

## Installation

### From Play Store (Recommended)
Coming soon.

### Build from Source

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. For Android:
   ```bash
   npx cap add android
   npm run prepare:web
   npx cap sync
   ```
4. Build and run on device.

See the Technical Implementation Plan for the phased features (real scanning stability, Walking Survey Phases 1-3, rogue detection, richer export).