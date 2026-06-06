package com.iiZerve.networkdoctor.plugins.wifi;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiManager;
import android.os.Build;
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
     * Returns:
     * {
     *   success: boolean,
     *   error?: string,
     *   message?: string,
     *   scanStarted: boolean,
     *   lastScanTimestamp: number (ms since epoch),
     *   count: number,
     *   networks: Array<{ ssid, bssid, signal, frequency, channel, channelWidth, capabilities }>
     * }
     */
    @PluginMethod
    public void scanWifi(PluginCall call) {
        if (wifiManager == null) {
            rejectWithError(call, "WIFI_MANAGER_UNAVAILABLE", "WiFi manager is not available on this device.");
            return;
        }

        // Robust permission check (ACCESS_FINE_LOCATION is mandatory for getScanResults on modern Android)
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
            call.resolve(ret);
            return;
        }

        // Try to force a fresh scan. This call is best-effort and often throttled or ignored on Android 9+.
        boolean scanStarted = false;
        try {
            scanStarted = wifiManager.startScan();
            Log.d(TAG, "startScan() returned: " + scanStarted);
        } catch (SecurityException se) {
            Log.w(TAG, "startScan SecurityException: " + se.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "startScan failed: " + e.getMessage());
        }

        // Retrieve the latest results the system has (this is what actually gets delivered to apps)
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
        if (results != null) {
            for (ScanResult r : results) {
                JSObject net = new JSObject();
                net.put("ssid", r.SSID != null ? r.SSID : "<hidden>");
                net.put("bssid", r.BSSID != null ? r.BSSID : "");
                net.put("signal", r.level);                 // dBm, e.g. -67
                net.put("frequency", r.frequency);          // MHz
                net.put("channelWidth", r.channelWidth);
                net.put("capabilities", r.capabilities != null ? r.capabilities : "");
                net.put("channel", frequencyToChannel(r.frequency));
                networks.put(net);
            }
        }
        ret.put("networks", networks);

        call.resolve(ret);
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