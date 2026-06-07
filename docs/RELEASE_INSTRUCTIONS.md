# WiFi Analyzer - Release Preparation & Build Instructions

**Package name:** `com.zerve.wifianalyzer`  
**Current version:** 1.0.0 (versionCode 1)  
**Target:** Google Play Store

All work is done exclusively in `C:\Users\ccars\Projects\wifi-analyzer`.

## Phase 1 Status (Completed)
- All mock / simulated data removed from main flows (scan, Walking Survey, analysis, rogues, exports).
- "No Current Connection" logic significantly improved (better Android 10+ handling via BSSID + scan result enrichment).
- Scan reliability improved (short delay after `startScan()`, `lastScanTimestamp`, freshness UI).
- Core features stabilized (main scan button, repeated real survey scans every ~5s, rich export with real data).
- Debug / development artifacts removed:
  - Orange TEST button and all related diagnostic code removed.
  - Verbose `[SCANNER]` console dumps removed.
  - Global error listeners and "for diagnosis" comments cleaned up.
- Versioning set to 1 / "1.0.0".
- Real-only guarantee enforced in `wifi-scanner.js`, `wifi-analyzer.js`, `ui-wifi.js`, and native plugin.

## Phase 2: Visual Assets (Files Generated)
See `play-store-assets/README.md` for details.

Generated files are already copied into:
- `play-store-assets/1.jpg` to `6.jpg` (icons + feature graphic + screenshots)

**Recommended actions:**
1. Review the images.
2. Convert the best icon (`1.jpg` or `6.jpg`) to exact 512×512 PNG.
3. Prepare final set of 2–8 screenshots (use the compositions in `play-store-assets/README.md`).
4. Create 1024×500 feature graphic from `2.jpg` (or regenerate).

## Phase 3 & 4: Store Listing & Legal

### App Title
`WiFi Analyzer`

### Short Description (≤ 80 chars)
Real WiFi scans, walking surveys with movement, rogue detection, and placement guidance. No simulated data.

### Full Description
See `play-store-assets/play-store-text.md` (to be created in follow-up if needed) or use the polished version from the release plan session.

### Privacy Policy
- File: `privacy-policy.html` (ready to host)
- Host this file publicly (GitHub Pages, Netlify, Firebase Hosting, etc.).
- Put the public URL in the Play Console under "Store listing > Privacy Policy".

**Hosting tip:** You can host `privacy-policy.html` directly or convert it to a Markdown page.

## Phase 5: Build Signed App Bundle (.aab)

### 1. One-time: Generate Release Keystore
From the `android` directory:

```powershell
keytool -genkey -v -keystore ..\wifi-analyzer-release.keystore -alias wifi-analyzer-key -keyalg RSA -keysize 2048 -validity 10000
```

Store the `.keystore` file in a safe location (outside the repo is ideal). Remember the passwords and alias.

### 2. Configure Signing (Safe Way)
Edit `android/gradle.properties` (this file is already prepared with a template).

Uncomment and fill in (example):

```properties
RELEASE_STORE_FILE=../wifi-analyzer-release.keystore
RELEASE_STORE_PASSWORD=your-keystore-password-here
RELEASE_KEY_ALIAS=wifi-analyzer-key
RELEASE_KEY_PASSWORD=your-key-password-here
```

**Important:** Never commit real passwords or the keystore to Git. Add the keystore and any local properties overrides to `.gitignore` if they are not already.

### 3. Build the Release App Bundle
From the project root (`C:\Users\ccars\Projects\wifi-analyzer`):

```powershell
# Ensure correct JDK
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.17.10-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version   # Must show 17.x

npx cap sync android

cd android
.\gradlew clean
.\gradlew bundleRelease
```

**Output location:**
`android\app\build\outputs\bundle\release\app-release.aab`

This is the file you upload to the Play Console.

### 4. Pre-Upload Testing (Strongly Recommended)
1. `adb uninstall com.zerve.wifianalyzer` (or uninstall via Settings).
2. Install the AAB (you can use `bundletool` or upload to an internal test track first).
3. Test thoroughly:
   - Real scans while connected and not connected.
   - Walking Survey (multiple real scans + movement detection).
   - Freshness indicator.
   - Rogue detection.
   - Export.
   - No debug UI or noisy console messages visible to users.

## Full Release Checklist

- [x] Phase 1 code & technical prep (mocks removed, current connection fixed, debug stripped, versioning set)
- [x] Privacy policy file created (`privacy-policy.html`)
- [x] Play Store text drafted
- [x] Visual assets generated and placed in `play-store-assets/`
- [ ] Convert icon to 512×512 PNG
- [ ] Capture / finalize 2–8 high-quality screenshots on real device
- [ ] Generate / finalize 1024×500 feature graphic
- [ ] Host `privacy-policy.html` and get public URL
- [ ] Generate release keystore (one time)
- [ ] Populate `android/gradle.properties` with keystore details (locally only)
- [ ] `npx cap sync android`
- [ ] Clean JDK 17 build: `.\gradlew clean bundleRelease`
- [ ] Test the release AAB on physical device (uninstall debug version first)
- [ ] Create new app in Google Play Console using package `com.zerve.wifianalyzer`
- [ ] Upload `app-release.aab`
- [ ] Fill Store listing (title, short desc, full desc, graphics, privacy URL)
- [ ] Complete Content Rating questionnaire
- [ ] Set up pricing & distribution / countries
- [ ] Submit for review

## Additional Files Generated for Release
- `play-store-assets/README.md` — Asset inventory + screenshot compositions + prompts
- `privacy-policy.html` — Full, hostable privacy policy
- `docs/RELEASE_INSTRUCTIONS.md` — This document
- Updated `android/app/build.gradle` (signing config)
- Updated `android/gradle.properties` (signing template + instructions)
- `capacitor.config.ts` (version documentation)
- All debug artifacts removed from `www/`, `js/`, and Java source

## Notes
- The app uses only real device data for all user-facing features.
- Minimum supported Android version and permissions are already declared in `AndroidManifest.xml`.
- For future releases, increment `versionCode` and `versionName` in `android/app/build.gradle`.

Good luck with the Play Store submission!

---
Prepared June 2026 as part of the WiFi Analyzer Release Plan.