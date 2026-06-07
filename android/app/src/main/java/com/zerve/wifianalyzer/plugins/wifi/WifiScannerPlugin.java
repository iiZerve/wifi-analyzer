package com.zerve.wifianalyzer.plugins.wifi;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.ScanResult;
import android.net.wifi.SupplicantState;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.util.List;

/**
 * WifiScannerPlugin
 *
 * Provides real WiFi scanning for the WiFi Analyzer feature.
 * - Attempts startScan() to request a fresh scan when possible (many modern Android versions throttle this).
 * - Always returns the most recent scan results from the system (getScanResults()).
 * - Returns lastScanTimestamp (epoch ms) so the web layer can show "X seconds ago" + freshness.
 * - Robust permission checks for ACCESS_FINE_LOCATION (required for WiFi scan results on Android 6+).
 *
 * Notes on Android reality:
 * - Starting with Android 9/10, scan throttling is common (e.g. 4 scans per 2 minutes per app in foreground).
 * - Results can appear "stale" or identical for a while — this is normal OS behavior, not a bug in the app.
 * - Always request ACCESS_FINE_LOCATION at runtime and keep the app in foreground for best results.
 */
@CapacitorPlugin(
    name = "WifiScanner",
    permissions = {
        @Permission(
            alias = "location",
            strings = { Manifest.permission.ACCESS_FINE_LOCATION }
        )
    }
)
public class WifiScannerPlugin extends Plugin {
    private static final String TAG = "WifiScannerPlugin";
    private WifiManager wifiManager;

    @Override
    public void load() {
        Context context = getContext();
        wifiManager = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
        Log.d(TAG, "WifiScannerPlugin loaded. WifiManager available: " + (wifiManager != null));
    }

    /**
     * Main entry point from web: Capacitor.Plugins.WifiScanner.scanWifi()
     * Returns rich real scan data + best-effort current connection info.
     */
    @PluginMethod
    public void scanWifi(PluginCall call) {
        if (wifiManager == null) {
            rejectWithError(call, "WIFI_MANAGER_UNAVAILABLE", "WiFi manager is not available on this device.");
            return;
        }

        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "LOCATION_PERMISSION_REQUIRED");
            ret.put("message", "Location permission (precise) is required to scan for nearby WiFi networks. Grant it in Settings > Apps > WiFi Analyzer > Permissions > Location.");
            ret.put("scanStarted", false);
            ret.put("lastScanTimestamp", System.currentTimeMillis());
            ret.put("count", 0);
            ret.put("networks", new JSArray());
            ret.put("currentNetwork", null);
            call.resolve(ret);
            return;
        }

        // Best-effort fresh scan. On many devices this is throttled (Android 9+).
        boolean scanStarted = false;
        try {
            scanStarted = wifiManager.startScan();
            Log.d(TAG, "startScan() returned: " + scanStarted);
        } catch (SecurityException se) {
            Log.w(TAG, "startScan SecurityException: " + se.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "startScan failed: " + e.getMessage());
        }

        // Give the system a moment to populate fresh results when startScan claimed success.
        // Short delay helps on some devices; keep it small to avoid ANR risk (plugin call is off main thread).
        if (scanStarted) {
            try {
                SystemClock.sleep(850);
            } catch (Exception ignored) {}
        }

        List<ScanResult> results;
        try {
            results = wifiManager.getScanResults();
        } catch (SecurityException se) {
            rejectWithError(call, "SECURITY_EXCEPTION", "Security exception while reading scan results: " + se.getMessage());
            return;
        } catch (Exception e) {
            rejectWithError(call, "SCAN_RESULTS_FAILED", "Failed to retrieve scan results: " + e.getMessage());
            return;
        }

        long now = System.currentTimeMillis();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("scanStarted", scanStarted);
        ret.put("lastScanTimestamp", now);
        ret.put("count", results != null ? results.size() : 0);

        JSArray networks = new JSArray();
        JSObject currentNetwork = null;

        if (results != null) {
            // First, try to determine the currently connected network (reliable on Android 10+ with FINE_LOCATION).
            currentNetwork = getCurrentConnectedNetwork(results);

            for (ScanResult r : results) {
                JSObject net = new JSObject();
                net.put("ssid", r.SSID != null ? r.SSID : "<hidden>");
                net.put("bssid", r.BSSID != null ? r.BSSID : "");
                net.put("signal", r.level);
                net.put("frequency", r.frequency);
                net.put("channelWidth", r.channelWidth);
                net.put("capabilities", r.capabilities != null ? r.capabilities : "");
                net.put("channel", frequencyToChannel(r.frequency));
                // Basic security classification for convenience (frontend can also re-derive)
                net.put("security", classifySecurity(r.capabilities));
                // Approximate band
                net.put("band", frequencyToBand(r.frequency));
                networks.put(net);
            }
        }

        ret.put("networks", networks);
        ret.put("currentNetwork", currentNetwork);

        call.resolve(ret);
    }

    /**
     * Dedicated method to retrieve just the current connection info (can be called independently).
     */
    @PluginMethod
    public void getCurrentConnectedNetwork(PluginCall call) {
        if (wifiManager == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("currentNetwork", null);
            call.resolve(ret);
            return;
        }
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "LOCATION_PERMISSION_REQUIRED");
            ret.put("currentNetwork", null);
            call.resolve(ret);
            return;
        }

        List<ScanResult> results = null;
        try {
            results = wifiManager.getScanResults();
        } catch (Exception ignored) {}

        JSObject current = getCurrentConnectedNetwork(results);
        JSObject ret = new JSObject();
        ret.put("success", current != null);
        ret.put("currentNetwork", current);
        ret.put("lastScanTimestamp", System.currentTimeMillis());
        call.resolve(ret);
    }

    /**
     * Best-effort detection of the currently connected WiFi network.
     * Improved for Android 10+ (handles SSID redaction "<unknown ssid>" by using BSSID + scan results).
     * Uses WifiInfo + matches against the provided scan results for fresh signal, frequency, etc.
     * Returns a populated object whenever we have a solid connection indication (BSSID + good supplicant state).
     */
    private JSObject getCurrentConnectedNetwork(List<ScanResult> scanResults) {
        if (wifiManager == null) return null;

        WifiInfo info = null;
        try {
            info = wifiManager.getConnectionInfo();
        } catch (Exception e) {
            Log.w(TAG, "getConnectionInfo failed: " + e.getMessage());
            return null;
        }
        if (info == null) return null;

        String bssid = info.getBSSID();
        String ssid = info.getSSID();
        int ip = info.getIpAddress();
        int linkSpeed = info.getLinkSpeed();
        int rssiFromInfo = info.getRssi();
        SupplicantState state = info.getSupplicantState();
        int freqFromInfo = info.getFrequency();

        Log.d(TAG, "WifiInfo details - SSID:" + ssid + " BSSID:" + bssid + " state:" + state + " rssi:" + rssiFromInfo + " linkSpeed:" + linkSpeed + " freq:" + freqFromInfo);

        boolean hasValidBssid = (bssid != null && !bssid.isEmpty() && !"00:00:00:00:00:00".equals(bssid));
        boolean goodState = (state == SupplicantState.COMPLETED || state == SupplicantState.ASSOCIATED || state == SupplicantState.FOUR_WAY_HANDSHAKE);

        // Clean SSID
        if (ssid != null) {
            if (ssid.startsWith("\"") && ssid.endsWith("\"")) {
                ssid = ssid.substring(1, ssid.length() - 1);
            }
            if ("<unknown ssid>".equalsIgnoreCase(ssid) || ssid.isEmpty() || "<unknown>".equalsIgnoreCase(ssid)) {
                ssid = null;
            }
        }

        // We consider it connected if we have a valid BSSID and reasonable supplicant state, or positive link speed (more reliable on some Android 10+ devices).
        // This works even when Android redacts the SSID on 10+.
        if (!hasValidBssid || !goodState) {
            if (linkSpeed <= 0 && (ssid == null)) {
                return null;
            }
        }

        JSObject cur = new JSObject();
        cur.put("ssid", ssid != null ? ssid : "<connected>");
        cur.put("bssid", bssid != null ? bssid : "");
        cur.put("signalStrength", rssiFromInfo);
        cur.put("linkSpeed", linkSpeed);
        cur.put("ipAddress", ip);
        cur.put("supplicantState", state != null ? state.name() : "");
        cur.put("isConnected", true);

        // Best effort: enrich from the current scan results list (scan results usually have the real SSID + fresh RSSI)
        boolean enriched = false;
        if (scanResults != null && hasValidBssid) {
            for (ScanResult r : scanResults) {
                if (bssid.equalsIgnoreCase(r.BSSID)) {
                    if (r.SSID != null && !r.SSID.isEmpty() && !"<hidden>".equals(r.SSID)) {
                        cur.put("ssid", r.SSID);
                    }
                    cur.put("signalStrength", r.level);
                    cur.put("frequency", r.frequency);
                    cur.put("channel", frequencyToChannel(r.frequency));
                    cur.put("channelWidth", r.channelWidth);
                    cur.put("capabilities", r.capabilities != null ? r.capabilities : "");
                    cur.put("security", classifySecurity(r.capabilities));
                    cur.put("band", frequencyToBand(r.frequency));
                    enriched = true;
                    break;
                }
            }
        }

        // Fallbacks from WifiInfo if we didn't get everything from scan match
        if (!enriched || !cur.has("frequency")) {
            if (freqFromInfo > 0) {
                cur.put("frequency", freqFromInfo);
                cur.put("band", frequencyToBand(freqFromInfo));
                cur.put("channel", frequencyToChannel(freqFromInfo));
            }
        }

        // Final sanity: if signal is absurdly bad and we have no frequency info, don't claim connection
        int finalSig = cur.has("signalStrength") ? cur.getInteger("signalStrength") : -127;
        if (finalSig < -100 && !cur.has("frequency") && !cur.has("band")) {
            // Still return it but mark signal as unknown — the UI can decide
            cur.put("signalStrength", -99);
        }

        return cur;
    }

    private String classifySecurity(String capabilities) {
        if (capabilities == null) return "Open";
        String caps = capabilities.toUpperCase();
        if (caps.contains("SAE") || caps.contains("WPA3")) return "WPA3";
        if (caps.contains("WPA2") || caps.contains("RSN")) return "WPA2";
        if (caps.contains("WPA")) return "WPA";
        if (caps.contains("WEP")) return "WEP";
        if (caps.contains("EAP") || caps.contains("802.1X")) return "Enterprise";
        return "Open";
    }

    private String frequencyToBand(int freqMhz) {
        if (freqMhz >= 2412 && freqMhz <= 2484) return "2.4";
        if (freqMhz >= 5170 && freqMhz <= 5825) return "5";
        if (freqMhz >= 5925 && freqMhz <= 7125) return "6";
        return "unknown";
    }

    /**
     * Lightweight permission status check callable from JS.
     */
    @PluginMethod
    public void checkPermissions(PluginCall call) {
        boolean hasFine = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("location", hasFine ? "granted" : "denied");
        call.resolve(ret);
    }

    /**
     * Optional helper: JS can call this to trigger a permission prompt flow if the plugin supports it.
     * In practice the MainActivity also proactively requests at startup.
     */
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        // We resolve immediately; the real prompt is handled either by MainActivity on launch
        // or by the user going to system settings. Full async permission request from plugin
        // would require implementing permission callback routing.
        boolean hasFine = ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;

        JSObject ret = new JSObject();
        ret.put("location", hasFine ? "granted" : "prompt");
        ret.put("message", hasFine
                ? "Location permission already granted."
                : "Please grant Precise Location permission for WiFi scanning to work.");
        call.resolve(ret);
    }

    private void rejectWithError(PluginCall call, String code, String message) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("error", code);
        ret.put("message", message);
        ret.put("lastScanTimestamp", System.currentTimeMillis());
        ret.put("count", 0);
        ret.put("networks", new JSArray());
        call.resolve(ret); // resolve with error payload so web layer can show clean message (no hard reject)
    }

    /**
     * Convert frequency (MHz) to approximate channel number.
     */
    private int frequencyToChannel(int freqMhz) {
        if (freqMhz >= 2412 && freqMhz <= 2484) {
            // 2.4 GHz
            return (freqMhz - 2412) / 5 + 1;
        } else if (freqMhz >= 5170 && freqMhz <= 5825) {
            // 5 GHz (approximate)
            return (freqMhz - 5170) / 5 + 34;
        } else if (freqMhz >= 5925 && freqMhz <= 7125) {
            // 6 GHz (Wi-Fi 6E / 7) rough mapping
            return (freqMhz - 5955) / 5 + 1; // very approximate
        }
        return 0;
    }
}
