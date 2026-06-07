package com.zerve.wifianalyzer;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.zerve.wifianalyzer.plugins.wifi.WifiScannerPlugin;
import com.zerve.wifianalyzer.plugins.discovery.NetworkDiscoveryPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int LOCATION_PERMISSION_REQUEST = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.d(TAG, "MainActivity.onCreate: BEFORE super - registering WifiScannerPlugin");
        // Register the custom WifiScanner plugin early (before super) so it is available to the Capacitor bridge.
        registerPlugin(WifiScannerPlugin.class);
        // Register NetworkDiscoveryPlugin for local device discovery (ARP-based)
        registerPlugin(NetworkDiscoveryPlugin.class);
        Log.d(TAG, "MainActivity.onCreate: AFTER registerPlugin, BEFORE super.onCreate");

        super.onCreate(savedInstanceState);
        Log.d(TAG, "MainActivity.onCreate: AFTER super.onCreate");

        // Request precise location permission (required for WiFi scanning on modern Android)
        boolean needsLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED;

        if (needsLocation) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    LOCATION_PERMISSION_REQUEST);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            Log.d(TAG, "Location permission result received for WiFi scanning.");
            // The plugin will surface clear error if still denied.
        }
    }
}
