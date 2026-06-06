# WiFi Analyzer

**Capacitor-based Android WiFi Analyzer**

Scan nearby networks, analyze the WiFi environment, detect common problems (weak signal, channel congestion, band issues, etc.), and receive clear, actionable advice in plain English.

## Goals
- High-density information display
- Custom native plugin for reliable modern Android WiFi scanning
- Intelligent analysis engine with health scoring
- Clean, dark-themed UI with plain English feedback

## Current Status
Initialized with Phase 0 foundation files (config, storage, scanner interface, analyzer stubs, and Capacitor plugin project structure).

Full implementation follows the phased plan below (see chat history or docs for complete Technical Implementation Plan).

## Tech Stack
- Frontend: Capacitor + TypeScript/JavaScript
- Native: Custom Android plugin (WifiScannerPlugin)
- Analysis: Pure JS/TS logic for issue detection and feedback generation

## Repository Structure (Initial)
```
js/
  config.js
  wifi-storage.js
  wifi-scanner.js
  wifi-analyzer.js
android/
  app/src/main/java/com/zerve/wifianalyzer/plugins/wifi/WifiScannerPlugin.java
capacitor.config.ts
package.json
README.md
```

## Next Steps
1. Clone repo
2. `npm install`
3. `npx cap add android`
4. Implement Phase 1 scanner and permissions
5. Build and test on device

Built following the detailed Technical Implementation Plan.