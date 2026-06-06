package com.zerve.wifianalyzer.plugins.wifi;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.List;

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

    private static final String PERMISSION_ALIAS = "location";

    @PluginMethod
    public void scanWifi(PluginCall call) {
        if (ActivityCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias(PERMISSION_ALIAS, call, "locationPermissionCallback");
            return;
        }
        performRealScan(call);
    }

    @PermissionCallback
    private void locationPermissionCallback(PluginCall call) {
        if (call.getPermissionState(PERMISSION_ALIAS) == com.getcapacitor.PermissionState.GRANTED) {
            performRealScan(call);
        } else {
            call.reject("Location permission is required for WiFi scanning.");
        }
    }

    private void performRealScan(PluginCall call) {
        Context context = getContext();
        WifiManager wifiManager = (WifiManager) context.getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        ConnectivityManager connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);

        if (wifiManager == null) {
            call.reject("WiFi service is not available on this device.");
            return;
        }

        JSObject result = new JSObject();
        result.put("timestamp", System.currentTimeMillis());

        // Current connected network
        JSObject currentNetwork = getCurrentConnectedNetwork(connectivityManager, wifiManager);
        result.put("currentNetwork", currentNetwork);

        // Nearby networks
        JSArray nearbyNetworks = new JSArray();

        if (ActivityCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {

            List<ScanResult> scanResults = wifiManager.getScanResults();

            for (ScanResult sr : scanResults) {
                JSObject network = new JSObject();
                network.put("ssid", sr.SSID != null ? sr.SSID : "");
                network.put("bssid", sr.BSSID != null ? sr.BSSID : "");
                network.put("signalStrength", sr.level);
                network.put("frequency", sr.frequency);
                network.put("channel", getChannelFromFrequency(sr.frequency));
                network.put("band", getBandFromFrequency(sr.frequency));
                network.put("channelWidth", getChannelWidth(sr));
                network.put("security", getSecurityType(sr));
                network.put("isConnected", currentNetwork != null &&
                        sr.BSSID != null && sr.BSSID.equalsIgnoreCase(currentNetwork.getString("bssid", "")));

                nearbyNetworks.put(network);
            }
        }

        result.put("nearbyNetworks", nearbyNetworks);
        call.resolve(result);
    }

    private JSObject getCurrentConnectedNetwork(ConnectivityManager cm, WifiManager wm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Network network = cm.getActiveNetwork();
            if (network != null) {
                NetworkCapabilities caps = cm.getNetworkCapabilities(network);
                if (caps != null && caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
                    WifiInfo wifiInfo = wm.getConnectionInfo();
                    if (wifiInfo != null && wifiInfo.getNetworkId() != -1) {
                        return createNetworkObject(wifiInfo, true);
                    }
                }
            }
        } else {
            WifiInfo wifiInfo = wm.getConnectionInfo();
            if (wifiInfo != null && wifiInfo.getNetworkId() != -1) {
                return createNetworkObject(wifiInfo, true);
            }
        }
        return null;
    }

    private JSObject createNetworkObject(WifiInfo wifiInfo, boolean isConnected) {
        JSObject obj = new JSObject();
        obj.put("ssid", wifiInfo.getSSID() != null ? wifiInfo.getSSID().replace("\"", "") : "");
        obj.put("bssid", wifiInfo.getBSSID() != null ? wifiInfo.getBSSID() : "");
        obj.put("signalStrength", wifiInfo.getRssi());
        obj.put("frequency", wifiInfo.getFrequency());
        obj.put("channel", getChannelFromFrequency(wifiInfo.getFrequency()));
        obj.put("band", getBandFromFrequency(wifiInfo.getFrequency()));
        obj.put("channelWidth", 20); // Default, can be improved with newer APIs
        obj.put("security", "Unknown"); // Can be enhanced later
        obj.put("isConnected", isConnected);
        return obj;
    }

    private int getChannelFromFrequency(int frequency) {
        if (frequency >= 2412 && frequency <= 2484) {
            return (frequency - 2412) / 5 + 1;
        } else if (frequency >= 5170 && frequency <= 5825) {
            return (frequency - 5170) / 5 + 34;
        }
        return 0;
    }

    private String getBandFromFrequency(int frequency) {
        if (frequency >= 2412 && frequency <= 2484) return "2.4";
        if (frequency >= 5170 && frequency <= 5825) return "5";
        if (frequency >= 5925 && frequency <= 7125) return "6";
        return "unknown";
    }

    private int getChannelWidth(ScanResult sr) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return sr.channelWidth * 20; // MHz
        }
        return 20;
    }

    private String getSecurityType(ScanResult sr) {
        String cap = sr.capabilities;
        if (cap.contains("WPA3")) return "WPA3";
        if (cap.contains("WPA2")) return "WPA2";
        if (cap.contains("WPA")) return "WPA/WPA2";
        if (cap.contains("WEP")) return "WEP";
        return "Open";
    }
}