package com.zerve.wifianalyzer.plugins.discovery;

import android.content.Context;
import android.net.wifi.WifiInfo;
import android.net.wifi.WifiManager;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Set;
import java.util.concurrent.*;

import org.json.JSONObject;
import org.json.JSONException;

import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

/**
 * NetworkDiscoveryPlugin
 * Discovers other devices on the local WiFi network using ARP table + best-effort reachability sweep + mDNS + hostname resolution.
 *
 * Key improvements:
 * - Hostname Resolution (Phase 1): resolveHostname() with per-lookup timeout
 * - mDNS / Network Service Discovery (Phase 2): multiple service types, proper ResolveListener
 * - Intelligent merging (Phase 3): IP as key, mergeOrCreateDevice prefers mDNS/SSDP friendly names,
 *   accumulates detectionMethods, applies MAC vendor lookup.
 */
@CapacitorPlugin(name = "NetworkDiscovery")
public class NetworkDiscoveryPlugin extends Plugin {
    private static final String TAG = "NetworkDiscoveryPlugin";
    private WifiManager wifiManager;
    private Map<String, String> macVendorMap = new HashMap<>();

    @Override
    public void load() {
        Context context = getContext();
        wifiManager = (WifiManager) context.getSystemService(Context.WIFI_SERVICE);
        loadMacVendors();
        Log.d(TAG, "NetworkDiscoveryPlugin loaded. WifiManager: " + (wifiManager != null) + ", MAC vendors: " + macVendorMap.size());
    }

    private void loadMacVendors() {
        try {
            InputStream is = getContext().getAssets().open("mac-vendors.json");
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder json = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                json.append(line);
            }
            reader.close();
            is.close();

            JSONObject vendors = new JSONObject(json.toString());
            java.util.Iterator<String> keys = vendors.keys();
            while (keys.hasNext()) {
                String oui = keys.next();
                macVendorMap.put(oui.toUpperCase(), vendors.getString(oui));
            }
            Log.d(TAG, "Loaded " + macVendorMap.size() + " MAC vendor entries");
        } catch (Exception e) {
            Log.e(TAG, "Failed to load MAC vendors from assets/mac-vendors.json", e);
        }
    }

    private String getManufacturerFromMac(String macAddress) {
        if (macAddress == null || macAddress.length() < 8) return null;

        // Normalize: support "aa:bb:cc:...", "aa-bb-cc-...", mixed case
        String normalized = macAddress.toUpperCase().replace('-', ':').replace('.', ':');
        // Take first 8 chars (e.g. "AC:DE:48" or "ACDE48XX" after strip)
        String oui;
        if (normalized.contains(":")) {
            // Expect "AC:DE:48:xx:xx:xx" → first 8 chars keeps "AC:DE:48"
            oui = normalized.substring(0, Math.min(8, normalized.length()));
        } else {
            // No separators, e.g. "ACDE48xxxxxx" → "AC:DE:48" style or direct key
            String hex = normalized.replace(":", "");
            if (hex.length() >= 6) {
                // Try both "AC:DE:48" and "ACDE48" forms
                String withColons = hex.substring(0, 2) + ":" + hex.substring(2, 4) + ":" + hex.substring(4, 6);
                String vendor = macVendorMap.get(withColons);
                if (vendor != null) return vendor;
                vendor = macVendorMap.get(hex.substring(0, 6));
                if (vendor != null) return vendor;
            }
            return null;
        }

        String vendor = macVendorMap.get(oui);
        if (vendor != null) return vendor;

        // Fallback: try 6-hex no-colon form (first 3 octets)
        String hex6 = normalized.replace(":", "").substring(0, Math.min(6, normalized.replace(":", "").length()));
        return macVendorMap.get(hex6);
    }

    /**
     * Resolve IP to hostname using InetAddress.getHostName().
     * Runs with a timeout so we don't block the discovery for too long on unresponsive devices.
     */
    private String resolveHostname(String ipAddress) {
        if (ipAddress == null) return null;
        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<String> future = executor.submit(() -> {
                try {
                    InetAddress inetAddress = InetAddress.getByName(ipAddress);
                    String name = inetAddress.getHostName();
                    if (name != null && !name.equals(ipAddress) && name.length() > 0) {
                        return name;
                    }
                } catch (Exception ignored) {}
                return null;
            });
            // Short timeout per lookup — many devices (iOS especially) won't respond usefully
            return future.get(800, TimeUnit.MILLISECONDS);
        } catch (TimeoutException te) {
            return null;
        } catch (Exception e) {
            return null;
        } finally {
            executor.shutdownNow();
        }
    }

    /**
     * Merge or create a device entry by IP address.
     * Prefers richer data (e.g. mDNS hostnames are usually friendlier than reverse-DNS).
     * Always accumulates detection methods.
     */
    private void mergeOrCreateDevice(Map<String, JSObject> devicesByIp, String ip, String mac,
                                     String hostname, String method, boolean isCurrent) {
        if (ip == null) return;

        JSObject device = devicesByIp.get(ip);
        boolean isNew = (device == null);

        if (isNew) {
            device = new JSObject();
            device.put("ipAddress", ip);
            device.put("isCurrentDevice", isCurrent);
            devicesByIp.put(ip, device);
        }

        // MAC: only set if we have one and didn't have one (or improve)
        if (mac != null && !mac.isEmpty() && !"00:00:00:00:00:00".equals(mac)) {
            if (!device.has("macAddress") || "N/A (self)".equals(device.getString("macAddress"))) {
                device.put("macAddress", mac.toLowerCase());
                // Apply vendor lookup when we (re)get a MAC
                String mfr = getManufacturerFromMac(mac);
                if (mfr != null) {
                    device.put("manufacturer", mfr);
                }
            }
        }

        // Hostname: prefer non-null, and prefer names that look "friendly" (from mDNS/SSDP)
        // Simple heuristic: if we don't have a hostname yet, or the new one is from mDNS and current is reverse-DNS like, take it.
        if (hostname != null && !hostname.isEmpty() && !hostname.equals(ip)) {
            String existing = device.has("hostname") ? device.getString("hostname") : null;
            boolean shouldSet = (existing == null) || existing.equals(ip);

            // mDNS and SSDP names are usually much better (e.g. "Living Room TV", "John's iPhone")
            if ("mdns".equals(method) || "ssdp".equals(method)) {
                // Always prefer mDNS/SSDP friendly names
                shouldSet = true;
            }

            if (shouldSet) {
                device.put("hostname", hostname);
            }
        }

        // Merge detection method (keep as array, avoid duplicates)
        JSArray methods;
        try {
            methods = device.has("detectionMethods") ? (JSArray) device.get("detectionMethods") : new JSArray();
        } catch (Exception e) {
            methods = new JSArray();
        }
        boolean hasMethod = false;
        for (int i = 0; i < methods.length(); i++) {
            try {
                if (method.equals(methods.getString(i))) {
                    hasMethod = true;
                    break;
                }
            } catch (Exception ignored) {}
        }
        if (!hasMethod) {
            methods.put(method);
            device.put("detectionMethods", methods);
        }

        if (isCurrent) {
            device.put("isCurrentDevice", true);
        }
    }

    @PluginMethod
    public void discoverDevices(PluginCall call) {
        if (wifiManager == null) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "WIFI_MANAGER_UNAVAILABLE");
            ret.put("message", "WiFi manager is not available.");
            ret.put("devices", new JSArray());
            call.resolve(ret);
            return;
        }

        WifiInfo wifiInfo = wifiManager.getConnectionInfo();
        if (wifiInfo == null || wifiInfo.getIpAddress() == 0) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", "NOT_CONNECTED_TO_WIFI");
            ret.put("message", "Device is not connected to a WiFi network.");
            ret.put("devices", new JSArray());
            call.resolve(ret);
            return;
        }

        String ipAddress = intToIp(wifiInfo.getIpAddress());
        String subnet = getSubnet(ipAddress);
        String currentIp = ipAddress;

        Log.d(TAG, "Current device IP: " + currentIp + " subnet prefix: " + subnet);

        // Best-effort: attempt reachability to populate ARP table (short timeouts)
        Set<String> pingResponded = populateArpTable(subnet, currentIp);

        List<JSObject> deviceList = new ArrayList<>();
        Map<String, JSObject> devicesByIp = new java.util.HashMap<>();

        // Primary: use 'ip neigh' command (more reliable on modern Android, bypasses some proc restrictions)
        List<JSObject> fromNeigh = readArpFromIpNeigh(currentIp);
        for (JSObject d : fromNeigh) {
            String ip = d.getString("ipAddress");
            String mac = d.getString("macAddress");
            if (ip != null) {
                mergeOrCreateDevice(devicesByIp, ip, mac, null, "arp", ip.equals(currentIp));
            }
        }

        // Fallback / supplement: try /proc/net/arp via shell (direct File often denied by SELinux; shell may have different context)
        try {
            Process p = Runtime.getRuntime().exec(new String[]{"cat", "/proc/net/arp"});
            BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String line;
            boolean headerSkipped = false;
            while ((line = br.readLine()) != null) {
                if (!headerSkipped) {
                    headerSkipped = true;
                    continue;
                }
                String[] tokens = line.split("\\s+");
                if (tokens.length >= 4) {
                    String ip = tokens[0];
                    String mac = tokens[3];
                    if (mac.equals("00:00:00:00:00:00") || mac.equals("0.0.0.0") || ip.equals("IP")) {
                        continue;
                    }
                    boolean isCurrent = ip.equals(currentIp);
                    // Use merge helper so we get proper method accumulation + vendor lookup
                    mergeOrCreateDevice(devicesByIp, ip, mac, null, "arp", isCurrent);
                }
            }
            br.close();
            p.waitFor();
        } catch (Exception e) {
            Log.w(TAG, "shell cat /proc/net/arp failed: " + e.getMessage());
        }

        // Note: direct /proc/net/arp often causes SELinux denial on modern Android; we rely on ip neigh + shell cat above.

        // Credit devices discovered via ping sweep (even without MAC/ARP entry) - secondary method for max visibility
        for (String ip : pingResponded) {
            mergeOrCreateDevice(devicesByIp, ip, null, null, "ping", ip.equals(currentIp));
        }

        // Add mDNS discovered devices (high quality names for Apple, smart TVs, printers, etc.)
        addMdnsDevices(devicesByIp, currentIp);

        // Optional SSDP for smart devices (often gives excellent friendlyName)
        discoverSsdp(devicesByIp, currentIp);

        // Ensure current device exists (merge will create it cleanly)
        if (currentIp != null) {
            mergeOrCreateDevice(devicesByIp, currentIp, "N/A (self)", null, "self", true);
        }

        // Phase 1 improvement: Best-effort hostname resolution using dedicated method + timeout.
        // Only resolve for devices that don't already have a good hostname from mDNS/SSDP.
        // This is the "Hostname Resolution" quick win.
        for (JSObject device : devicesByIp.values()) {
            String ip = device.getString("ipAddress");
            boolean hasGoodHostname = device.has("hostname") &&
                    !ip.equals(device.getString("hostname"));
            if (ip != null && !hasGoodHostname) {
                String resolved = resolveHostname(ip);
                if (resolved != null) {
                    // Only set if we still don't have a better name (mDNS may have arrived late)
                    if (!device.has("hostname") || ip.equals(device.getString("hostname"))) {
                        device.put("hostname", resolved);
                    }
                }
            }
        }

        // Final pass: ensure every device has detectionMethods, run classification (MAC + hostname hints),
        // and build a clean device list (no duplicates).
        deviceList.clear();
        for (JSObject d : devicesByIp.values()) {
            if (!d.has("detectionMethods")) {
                String method = d.has("macAddress") ? "arp" : "unknown";
                JSArray methods = new JSArray();
                methods.put(method);
                d.put("detectionMethods", methods);
            }
            classifyDevice(d);
            deviceList.add(d);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("devices", new JSArray(deviceList));
        ret.put("currentDeviceIp", currentIp);
        ret.put("subnet", subnet);
        ret.put("count", deviceList.size());

        // Add router IP for quick link
        try {
            android.net.DhcpInfo dhcp = wifiManager.getDhcpInfo();
            if (dhcp != null && dhcp.gateway != 0) {
                ret.put("routerIp", intToIp(dhcp.gateway));
            }
        } catch (Exception ignored) {}

        call.resolve(ret);
    }

    private String intToIp(int ip) {
        return (ip & 0xFF) + "." +
               ((ip >> 8) & 0xFF) + "." +
               ((ip >> 16) & 0xFF) + "." +
               ((ip >> 24) & 0xFF);
    }

    private String getSubnet(String ip) {
        String[] parts = ip.split("\\.");
        if (parts.length >= 3) {
            return parts[0] + "." + parts[1] + "." + parts[2] + ".";
        }
        return "192.168.1.";
    }

    private Set<String> populateArpTable(String subnet, String currentIp) {
        // Parallel reachability sweep + TCP connect probes on common ports to force ARP population.
        // This is much faster than sequential and works even if ICMP is blocked (many devices block ping but respond to TCP).
        ExecutorService executor = Executors.newFixedThreadPool(40);
        List<Future<?>> futures = new ArrayList<>();
        int[] commonPorts = {80, 443, 22, 445, 139, 8080}; // common ports that can trigger ARP
        Set<String> respondedIps = ConcurrentHashMap.newKeySet();

        for (int i = 1; i <= 254; i++) {
            final String testIp = subnet + i;
            if (testIp.equals(currentIp)) continue;
            futures.add(executor.submit(() -> {
                try {
                    InetAddress addr = InetAddress.getByName(testIp);
                    boolean responded = false;
                    // ICMP (may be blocked)
                    if (addr.isReachable(120)) responded = true;
                    // Try TCP connects to common ports (often succeeds in populating ARP even if no response)
                    for (int port : commonPorts) {
                        try (java.net.Socket s = new java.net.Socket()) {
                            s.connect(new java.net.InetSocketAddress(addr, port), 80);
                            responded = true;
                            break;
                        } catch (Exception ignored) {}
                    }
                    if (responded) {
                        respondedIps.add(testIp);
                    }
                } catch (Exception ignored) {}
            }));
        }
        for (Future<?> f : futures) {
            try { f.get(); } catch (Exception ignored) {}
        }
        executor.shutdown();

        // Credit ping discovered devices (will be added with detectionMethod "ping" if no MAC later)
        return respondedIps;
    }

    private List<JSObject> readArpFromIpNeigh(String currentIp) {
        List<JSObject> list = new ArrayList<>();
        String[] commands = {"ip -4 neigh show", "ip neigh show", "ip neigh"};
        for (String cmd : commands) {
            try {
                Process process = Runtime.getRuntime().exec(cmd);
                BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.contains("lladdr")) {
                        String[] parts = line.split("\\s+");
                        String ip = null;
                        String mac = null;
                        for (String p : parts) {
                            if (p.matches("\\d+\\.\\d+\\.\\d+\\.\\d+")) ip = p;
                            if (p.matches("([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}")) mac = p.toLowerCase();
                        }
                        if (ip != null && mac != null && !mac.equals("00:00:00:00:00:00")) {
                            boolean isCurrent = ip.equals(currentIp);
                            JSObject device = new JSObject();
                            device.put("ipAddress", ip);
                            device.put("macAddress", mac);
                            device.put("isCurrentDevice", isCurrent);
                            JSArray methods = new JSArray();
                            methods.put("arp");
                            device.put("detectionMethods", methods);

                            // MAC vendor lookup (Step 4 integration)
                            String mfr = getManufacturerFromMac(mac);
                            if (mfr != null) device.put("manufacturer", mfr);

                            list.add(device);
                        }
                    }
                }
                reader.close();
                process.waitFor();
                if (!list.isEmpty()) break; // if we got entries, good
            } catch (Exception e) {
                Log.w(TAG, "Command " + cmd + " failed: " + e.getMessage());
            }
        }
        return list;
    }

    private void addMdnsDevices(Map<String, JSObject> devicesByIp, String currentIp) {
        try {
            NsdManager nsdManager = (NsdManager) getContext().getSystemService(Context.NSD_SERVICE);
            // Broad but practical set of service types. _services._dns-sd._udp helps discover others.
            String[] serviceTypes = {
                "_services._dns-sd._udp",
                "_http._tcp",
                "_https._tcp",
                "_airplay._tcp",
                "_raop._tcp",
                "_googlecast._tcp",
                "_hap._tcp",
                "_ipp._tcp",
                "_printer._tcp",
                "_smb._tcp",
                "_device-info._tcp"
            };

            final List<NsdManager.DiscoveryListener> listeners = new ArrayList<>();

            for (String type : serviceTypes) {
                final String serviceType = type; // capture for logging/hints

                NsdManager.DiscoveryListener listener = new NsdManager.DiscoveryListener() {
                    @Override
                    public void onDiscoveryStarted(String serviceType) {
                        Log.d(TAG, "mDNS discovery started for " + serviceType);
                    }

                    @Override
                    public void onServiceFound(NsdServiceInfo serviceInfo) {
                        // Resolve to get IP + better name
                        nsdManager.resolveService(serviceInfo, new NsdManager.ResolveListener() {
                            @Override
                            public void onResolveFailed(NsdServiceInfo serviceInfo, int errorCode) {
                                Log.w(TAG, "mDNS resolve failed for " + serviceInfo.getServiceName() + " code=" + errorCode);
                            }

                            @Override
                            public void onServiceResolved(NsdServiceInfo serviceInfo) {
                                InetAddress host = serviceInfo.getHost();
                                if (host != null) {
                                    String ip = host.getHostAddress();
                                    if (ip != null) {
                                        String name = serviceInfo.getServiceName();
                                        // mDNS service names are often the best human-readable names we can get
                                        boolean isCurrent = ip.equals(currentIp);
                                        mergeOrCreateDevice(devicesByIp, ip, null, name, "mdns", isCurrent);

                                        // Optional: store service type for future device type inference
                                        // (we keep it simple for now — hostname + later classifyDevice is powerful)
                                    }
                                }
                            }
                        });
                    }

                    @Override
                    public void onServiceLost(NsdServiceInfo serviceInfo) {}

                    @Override
                    public void onDiscoveryStopped(String serviceType) {}

                    @Override
                    public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                        Log.w(TAG, "mDNS start failed for " + serviceType + " code=" + errorCode);
                    }

                    @Override
                    public void onStopDiscoveryFailed(String serviceType, int errorCode) {}
                };

                try {
                    nsdManager.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener);
                    listeners.add(listener);
                } catch (Exception e) {
                    Log.w(TAG, "mDNS discover for " + type + " failed: " + e.getMessage());
                }
            }

            // Give mDNS some time to discover services (typical sweet spot 3.5-5s)
            try {
                Thread.sleep(4000);
            } catch (InterruptedException ignored) {}

            // Stop listeners
            for (NsdManager.DiscoveryListener l : listeners) {
                try {
                    nsdManager.stopServiceDiscovery(l);
                } catch (Exception ignored) {}
            }
        } catch (Exception e) {
            Log.w(TAG, "mDNS discovery failed: " + e.getMessage());
        }
    }

    private void discoverSsdp(Map<String, JSObject> devicesByIp, String currentIp) {
        try {
            java.net.MulticastSocket socket = new java.net.MulticastSocket(1900);
            socket.setTimeToLive(4);
            socket.setSoTimeout(4000);
            java.net.InetAddress group = java.net.InetAddress.getByName("239.255.255.250");
            socket.joinGroup(group);

            String msearch = "M-SEARCH * HTTP/1.1\r\n" +
                    "HOST: 239.255.255.250:1900\r\n" +
                    "MAN: \"ssdp:discover\"\r\n" +
                    "MX: 3\r\n" +
                    "ST: ssdp:all\r\n\r\n";
            byte[] sendData = msearch.getBytes("UTF-8");
            java.net.DatagramPacket sendPacket = new java.net.DatagramPacket(sendData, sendData.length, group, 1900);
            socket.send(sendPacket);

            byte[] receiveData = new byte[2048];
            long start = System.currentTimeMillis();
            while (System.currentTimeMillis() - start < 4500) {
                java.net.DatagramPacket receivePacket = new java.net.DatagramPacket(receiveData, receiveData.length);
                try {
                    socket.receive(receivePacket);
                    String response = new String(receivePacket.getData(), 0, receivePacket.getLength(), "UTF-8");
                    java.util.regex.Matcher m = java.util.regex.Pattern.compile("http://([0-9.]+)").matcher(response);
                    if (m.find()) {
                        String ip = m.group(1);
                        if (ip != null) {
                            // Try to extract friendly name (very useful for smart TVs, etc.)
                            String friendly = null;
                            java.util.regex.Matcher nameM = java.util.regex.Pattern.compile("friendlyName>([^<]+)").matcher(response);
                            if (nameM.find()) {
                                friendly = nameM.group(1);
                            }
                            boolean isCurrent = ip.equals(currentIp);
                            mergeOrCreateDevice(devicesByIp, ip, null, friendly, "ssdp", isCurrent);
                        }
                    }
                } catch (java.net.SocketTimeoutException ste) {
                    break;
                }
            }
            socket.leaveGroup(group);
            socket.close();
        } catch (Exception e) {
            Log.w(TAG, "SSDP discovery failed: " + e.getMessage());
        }
    }

    private void classifyDevice(JSObject device) {
        String mac = device.has("macAddress") ? device.getString("macAddress") : null;
        String host = device.has("hostname") ? device.getString("hostname") : null;
        String manufacturer = "Unknown";
        String deviceType = "Unknown Device";
        String confidence = "Low";

        // Primary: use the external mac-vendors.json database (loaded at plugin init)
        if (mac != null && mac.length() >= 8) {
            String lookedUp = getManufacturerFromMac(mac);
            if (lookedUp != null && !lookedUp.isEmpty()) {
                manufacturer = lookedUp;
                confidence = "High";
            }
        }

        // Fallback / supplemental prefix logic for partial coverage (kept for robustness)
        if (manufacturer.equals("Unknown") && mac != null && mac.length() >= 8) {
            String normalized = mac.toUpperCase().replace(":", "").replace("-", "");
            if (normalized.length() >= 6) {
                String shortOui = normalized.substring(0, 6);
                if (shortOui.startsWith("001B") || shortOui.startsWith("001E") || shortOui.startsWith("ACBC") ||
                    shortOui.startsWith("F018") || shortOui.startsWith("8866") || shortOui.startsWith("A483") ||
                    shortOui.startsWith("3C5A") || shortOui.startsWith("404D") || shortOui.startsWith("40")) {
                    manufacturer = "Apple";
                    confidence = "Medium";
                } else if (shortOui.startsWith("001A") || shortOui.startsWith("0024") || shortOui.startsWith("B803") ||
                           shortOui.startsWith("787B") || shortOui.startsWith("1803")) {
                    manufacturer = "Dell";
                    confidence = "Medium";
                } else if (shortOui.startsWith("001F") || shortOui.startsWith("0026") || shortOui.startsWith("3C4A") ||
                           shortOui.startsWith("B499")) {
                    manufacturer = "HP";
                    confidence = "Medium";
                } else if (shortOui.startsWith("50C7") || shortOui.startsWith("14CC") || shortOui.startsWith("1C61")) {
                    manufacturer = "TP-Link";
                    confidence = "Medium";
                }
            }
        }

        // Determine deviceType from manufacturer + hostname hints
        if (manufacturer != null && !manufacturer.equals("Unknown")) {
            if (manufacturer.equals("Apple")) {
                if (host != null) {
                    String h = host.toLowerCase();
                    if (h.contains("iphone")) deviceType = "iPhone";
                    else if (h.contains("ipad")) deviceType = "iPad";
                    else if (h.contains("macbook") || h.contains("mac")) deviceType = "Mac";
                    else deviceType = "Apple Device";
                } else {
                    deviceType = "Apple Device";
                }
            } else if (manufacturer.equals("Samsung")) {
                deviceType = (host != null && host.toLowerCase().contains("tv")) ? "Smart TV" : "Samsung Device";
            } else if (manufacturer.equals("Dell") || manufacturer.equals("HP")) {
                deviceType = "Windows Laptop/PC";
            } else if (manufacturer.equals("TP-Link")) {
                deviceType = "Router / Access Point";
            } else if (manufacturer.equals("Google")) {
                deviceType = "Google / Nest Device";
            } else if (manufacturer.equals("Amazon")) {
                deviceType = "Amazon Echo / Smart Device";
            } else if (manufacturer.equals("Intel")) {
                deviceType = "Intel Device / PC Component";
            }
        }

        // Fallback deviceType from hostname only (common patterns)
        if ((deviceType == null || deviceType.equals("Unknown Device")) && host != null) {
            String h = host.toLowerCase();
            if (h.contains("iphone")) {
                manufacturer = "Apple";
                deviceType = "iPhone";
                confidence = "Medium";
            } else if (h.contains("ipad")) {
                manufacturer = "Apple";
                deviceType = "iPad";
                confidence = "Medium";
            } else if (h.contains("mac")) {
                manufacturer = "Apple";
                deviceType = "Mac";
                confidence = "Medium";
            } else if (h.contains("android") || h.contains("samsung")) {
                manufacturer = "Samsung / Android";
                deviceType = "Android Device";
                confidence = "Medium";
            } else if (h.contains("tv") || h.contains("roku") || h.contains("fire")) {
                deviceType = "Smart TV / Streaming";
                confidence = "Medium";
            } else if (h.contains("printer") || h.contains("hp") || h.contains("epson")) {
                deviceType = "Printer";
                confidence = "Medium";
            } else if (h.contains("laptop") || h.contains("pc") || h.contains("desktop")) {
                deviceType = "Laptop / PC";
                confidence = "Low";
            }
        }

        if (manufacturer == null) manufacturer = "Unknown";
        if (deviceType == null) deviceType = "Unknown Device";

        device.put("manufacturer", manufacturer);
        device.put("deviceType", deviceType);
        device.put("confidence", confidence);
    }
}
