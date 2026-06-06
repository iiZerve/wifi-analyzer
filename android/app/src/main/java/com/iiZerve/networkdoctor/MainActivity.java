package com.iiZerve.networkdoctor;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.iiZerve.networkdoctor.plugins.wifi.WifiScannerPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 1001;
    private static final int LOCATION_PERMISSION_REQUEST = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register custom Capacitor plugin for real WiFi scanning (for the new Wifi Analyzer app)
        registerPlugin(WifiScannerPlugin.class);

        // For Android 13+ (API 33+), POST_NOTIFICATIONS must be granted at runtime
        // before starting a foreground service that posts a notification.
        boolean needsNotification = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                needsNotification = true;
            }
        }

        // Request precise location for WiFi scanning (required on modern Android for the Wifi Analyzer feature)
        boolean needsLocation = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED;

        if (needsNotification || needsLocation) {
            java.util.List<String> toRequest = new java.util.ArrayList<>();
            if (needsNotification) {
                toRequest.add(Manifest.permission.POST_NOTIFICATIONS);
            }
            if (needsLocation) {
                toRequest.add(Manifest.permission.ACCESS_FINE_LOCATION);
            }
            ActivityCompat.requestPermissions(this,
                    toRequest.toArray(new String[0]),
                    needsNotification ? NOTIFICATION_PERMISSION_REQUEST : LOCATION_PERMISSION_REQUEST);
            return;
        }

        startMonitoringService();
    }

    private void startMonitoringService() {
        Intent serviceIntent = new Intent(this, MonitoringForegroundService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == NOTIFICATION_PERMISSION_REQUEST || requestCode == LOCATION_PERMISSION_REQUEST) {
            // Even if location or notification was denied, we still start the service.
            // WiFi scanning will surface a clear "permission required" error via the plugin if needed.
            startMonitoringService();
            Log.d(TAG, "Permissions result received for requestCode=" + requestCode + ", continuing startup.");
        }
    }
}