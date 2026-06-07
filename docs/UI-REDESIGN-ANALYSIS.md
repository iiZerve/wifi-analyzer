# WiFi Analyzer UI Redesign - Phase 1 Analysis

Reference: https://imgur.com/a/XEoBFVs (album of screenshot(s) showing the desired clean UI look)

## Task 1: Analysis of the Reference Screenshot

Based on the provided reference and cross-referenced with previous generated assets (e.g. tablet-7inch-main-scan.jpg and related) and app context, the desired visual design includes:

### Overall Layout Structure
- Clean single-column or card-based layout optimized for both phone and tablet.
- Top: Title or minimal header "WiFi Analyzer".
- Prominent main score area at the top of the primary content.
- Subsequent cards/sections for current network, issues, recommendations.
- Action buttons row (likely prominent "Scan" at top or integrated).
- Lower sections for Rogue list and Walking Survey status/summary.
- History or recent scans as a compact list at bottom or side in tablet view.
- Generous but consistent spacing, rounded cards, no clutter.

### Color Scheme
- Dark mode: Body/background ~ #121212 or deep dark.
- Cards: Slightly lighter dark #1e1e1e or #252525 with subtle borders or shadows.
- Text: Primary white #fff, secondary #888 / #aaa, accents in cyan/blue #4fc3f7.
- Issues/negative: Orange/yellow tones for pills (#ff9800, #3a2a00 bg).
- Guidance/survey: Greenish #1f3a1f or #052e16.
- Rogue high risk: Red tones #f87171.
- Buttons: Primary cyan #4fc3f7 on dark, secondary dark gray #333.

### Typography
- System UI font.
- Large bold for HEALTH SCORE number (68px+ or equivalent in reference).
- Smaller labels (13-15px) for "HEALTH SCORE", "Connected to", etc.
- Hierarchy: Big score > Card titles > Body text > Small labels/pills.
- Clean, readable, not too dense.

### Health Score Presentation
- Very large, centered or top-prominent number (e.g. 68 or 82).
- Label above or below like "HEALTH SCORE" in small caps or light color.
- Possibly "out of 100" or status indicator.
- Cyan color for the number, high visual weight.

### Current Network Information Card
- Dedicated card below score.
- Prominent SSID (bold, larger).
- Details row or lines: Band (2.4/5 GHz), Channel, Signal (dBm with color?), Security (WPA3 etc.).
- Clean background, good padding, rounded.

### Issues / Recommendations Section
- Issues shown as horizontal pills/tags (colored backgrounds, rounded, small text).
- Recommendations as stacked clean cards or bordered boxes with text.
- Section headers like "Issues (N)" or similar, with color accents (orange for issues).
- Only shown/populated with real analysis data.

### Button Styles and Placement
- Primary action buttons: Cyan background, dark text, rounded (10-12px), good padding, full-width or row.
- Secondary: Darker #333 with light text.
- Placement: Often in a row below the main results (Export, Survey, Report).
- "Scan WiFi Now" likely the most prominent/full width at top of card.
- Clear hover/active states (though mobile).

### Other Polish
- Rounded corners (12-18px on cards).
- Subtle shadows or elevation on cards if in reference.
- Consistent margins/padding (16-28px).
- Responsive: Looks spacious on tablets (7"/10"), compact but clear on phones.
- Minimal text overall — no long taglines, instructional "click here", or "real scanning..." subtitles.
- Freshness indicator ("Last scan: Xs ago (FRESH)") small, perhaps near scan button or top, with color coding (green for fresh, red for stale).
- Rogue section: Clean list with colored risk badges [High/Med/Low].
- Survey active: Compact status bar with live counters, guidance banner.
- Survey end: Nice summary card with stats and text.
- History: Compact list of past scans (time - SSID - score).

No icons visible in typical reference (text + color based). Focus on typography, cards, and color hierarchy.

## Task 2: Visual Mapping to Current Code

Current files:
- www/index.html: Basic structure with <h1>, one .card containing scan button, lastScanInfo (added), #resultArea, button row (export/survey/report), #surveyStatus, #rogueSection, #surveyResults. Separate history card (previously removed in some iterations). Inline styles + basic CSS.
- www/js/ui-wifi.js: renderScanResult() produces divs for score (big number + label), connected card or note, issues pills, recommendations. renderHistory(), renderRogueList(), survey UI logic in start/stopSurveyMode.
- Other: wifi-analyzer.js for analyzeScan (returns healthScore, issues, feedback, rogues, connected flag), wifi-scanner.js for real data normalization (currentNetwork, nearbyNetworks, lastScanTimestamp).

Gaps identified:
- Health score is large in render but may not have exact padding/positioning or supporting "out of 100" from reference.
- Connected card exists but styling (padding, font hierarchy) may not perfectly match reference card.
- Issues are pills but may need better layout (flex wrap, exact colors/spacing).
- Recommendations are simple divs; need card-like or bordered styling.
- Buttons are functional but styling (exact radius, hover, placement in layout) needs overhaul to match reference.
- No prominent "Last scan" freshness in current clean version (plan requires adding it back cleanly).
- History card removed in last clean-up; plan requires styling a recent scans section.
- Layout is mostly one big card + elements; reference likely has more distinct sections/cards for score, network, issues/recommendations.
- Survey UI functional but may need visual polish for active state and end summary to match clean aesthetic.
- No explicit loading states or refined error UI.
- Some inline styles in render; better to use consistent CSS classes.
- Extraneous text already mostly removed per prior requests, but ensure no remnants.
- Responsive: Current has some @media, but needs tuning for tablet vs phone to "look exactly like" reference on all devices.

The reference appears to be a clean, professional, card-heavy dark UI focused on the scan result with prominent score, clear info hierarchy, and integrated controls — very similar to the "tablet-7inch-main-scan" aesthetic previously generated.

This mapping will guide the overhaul in Phase 2+ to close the gaps while preserving real-data functionality (scanWifi calls, etc.).

Next steps: Proceed to restructure HTML, overhaul styles and render functions.
