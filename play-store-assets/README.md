# WiFi Analyzer - Play Store Assets

This folder contains the visual assets and supporting text for the Google Play Store listing.

## Generated Assets (from AI image generation)

The following files were generated on 2026-06-06:

- `1.jpg` and `6.jpg` — App Icon candidates (use 512x512 PNG recommended — convert if needed)
- `2.jpg` — Feature Graphic (1024 x 500 px)
- `3.jpg`, `4.jpg`, `5.jpg` — Phone screenshots (portrait 9:16, ~1080x1920 or similar)

**Recommended final files (after any conversion/editing):**
- `icon.png` (512 × 512 px, PNG, no text)
- `feature-graphic.png` or `.jpg` (1024 × 500 px)
- `screenshot-01-main-scan.png`
- `screenshot-02-survey-active.png`
- `screenshot-03-survey-complete.png`
- `screenshot-04-rogues.png` (optional additional)
- etc.

## Screenshot Compositions (Recommended to Capture/Use)

Capture these on a real device running the release build for the most authentic look:

1. **Main Scan Screen (Connected)**  
   Big "HEALTH SCORE" number, "Connected to: [Real SSID]" card showing band/channel/signal/security, list of nearby networks with dBm and channels, "Last scan: Xs ago (FRESH)" visible at top. Clean, positive result.

2. **Main Scan Screen (Not Connected)**  
   "NO CONNECTION" or "—" health score, explanatory note ("Not connected to any WiFi network..."), list of nearby networks from a real scan. Shows the app is still useful when not joined.

3. **Walking Survey Active**  
   Survey status bar ("Scans: N • Moved: yes (steps: M)"), prominent guidance banner (e.g. "Signal improving – keep walking" or "High congestion..."), live rogue list or updating results. Shows movement + real-time features.

4. **Survey Complete / Path Optimizer Summary**  
   "Walking Survey Complete" with real stats (scans count, duration, suspicious opens), "Strongest observed", "Average top-network signal", list of rogues with severity, and the rich text summary. This is a key unique feature screen.

5. **Rogue / Suspicious Networks Focused**  
   The "Suspicious Open Networks (Rogue Risk)" section expanded, showing High/Med/Low badges with reasons. Good for demonstrating safety features.

6. **Freshness Indicator Close-up** (optional)  
   The "Last scan: Xs ago (FRESH/RECENT/STALE)" line after a scan, perhaps with the orange TEST button removed (production view).

**Tips for best screenshots:**
- Use a physical phone (not emulator).
- Real WiFi environment with multiple networks.
- Dark theme is already the app's default.
- Crop out system status bar / navigation for cleaner store images if desired.
- Show actual data (not blurred).

## Tablet Screenshots (7" and 10")

New tablet-optimized screenshots were generated based directly on the actual app screenshot you provided (https://imgur.com/a/9CKPymt).

Files added:
- `tablet-7inch-main-scan.jpg`
- `tablet-7inch-main-scan-alt.jpg`
- `tablet-7inch-survey-active.jpg`
- `tablet-10inch-main-scan.jpg`
- `tablet-10inch-survey-active.jpg`

These recreate the exact UI (health score, connected network card, network list, freshness indicator, survey guidance, rogue section, buttons) but composed for larger tablet displays with appropriate scaling, padding, and more content visible at once. 

**For Google Play:**
- 7-inch tablet screenshots are important for the "7-inch tablet" slot.
- 10-inch for the "10-inch tablet" slot.
- Use portrait orientation primarily. You may also want one or two in landscape if the app supports it well.
- Convert to PNG if preferred, ensure minimum resolution (Play recommends at least 1200px on the shortest side for tablets).

## Image Prompts Used

These prompts were used to generate the initial assets (you can reuse or vary them):

**App Icon (1:1):**
"Modern clean app icon for "WiFi Analyzer" Android app. Dark navy/black background, vibrant cyan/blue WiFi symbol with subtle radar/scan circle waves emanating from it, minimalist flat design, professional tech feel, high contrast, no text, square icon, 512x512 style. High quality vector-like illustration."

Another variant: "App icon for WiFi Analyzer. Stylized blue WiFi icon with three curved signal arcs and a central radar ping circle on a dark gradient square background. Modern, minimal, high-end tech style suitable for Google Play. No text, perfect for 512x512. Professional and trustworthy."

**Feature Graphic (wide / ~2:1):**
"Play Store feature graphic 1024x500 for WiFi Analyzer app. Dark modern gradient background (deep blue to black), large title "WiFi Analyzer" in clean white sans-serif font, subtitle "Real Scans • Walking Survey • Rogue Detection", subtle stylized WiFi signal waves and phone mockup showing scan results with blue health score, professional and trustworthy tech aesthetic. Wide banner style."

**Screenshots (9:16 portrait phone):**
- "Realistic phone screenshot of WiFi Analyzer Android app in dark theme. Shows main scan screen: big centered "HEALTH SCORE 87" in cyan, "Connected to: MyHomeWiFi" card with details (5 GHz • Ch 36 • -62 dBm • WPA3), list of nearby networks with signal bars and channel numbers. Top shows "Last scan: 4s ago (FRESH)". Clean modern UI with blue accents on black background. Phone bezel optional, focus on app content."
- "Realistic phone screenshot of WiFi Analyzer app during active Walking Survey. Dark theme. Top status: "Walking Survey active • Scans: 12 • Moved: yes (steps: 47)". Prominent green guidance banner "Signal improving – keep walking". Live updating network list and small rogue warning. Bottom shows "Last scan: 2s ago (FRESH)". Professional diagnostic app look."
- "Phone screenshot of WiFi Analyzer showing survey complete summary screen in dark theme. "Walking Survey Complete" header. Stats: Scans 18, Duration 92s, Suspicious opens 2. Rich text summary with "Strongest observed: MyMesh-5G @ -48 dBm" and "Average top-network signal: -61 dBm". List of 2 high-risk rogues with reasons. Blue accents, clean card layout."

## Next Steps for Assets
- Review the JPGs.
- Convert icon to PNG at exact 512x512 if required by Play.
- Optionally edit in an image editor (add subtle polish, ensure no personal SSIDs visible if you want generic examples).
- Upload to Play Console under "Store listing" > Graphics.

All assets were generated to match the current app's dark theme (#121212 bg, #4fc3f7 blue accents, card-based UI).

---
Generated as part of WiFi Analyzer Release Preparation - June 2026.