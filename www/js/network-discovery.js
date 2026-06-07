// Network Discovery Bridge Layer
// Uses the NetworkDiscovery native plugin (ARP table + reachability sweep).

export async function discoverDevices() {
  try {
    const cap = (typeof window !== "undefined" && window.Capacitor) ? window.Capacitor : null;

    let result;

    if (cap && typeof cap.nativePromise === "function") {
      result = await cap.nativePromise("NetworkDiscovery", "discoverDevices", {});
    } else if (cap && cap.Plugins && cap.Plugins.NetworkDiscovery && typeof cap.Plugins.NetworkDiscovery.discoverDevices === "function") {
      result = await cap.Plugins.NetworkDiscovery.discoverDevices();
    } else if (cap && typeof cap.registerPlugin === "function") {
      const proxy = cap.registerPlugin("NetworkDiscovery");
      if (proxy && typeof proxy.discoverDevices === "function") {
        result = await proxy.discoverDevices();
      }
    }

    if (!result) {
      throw new Error("Device discovery requires the Android app (Capacitor native bridge).");
    }

    if (result.success === false) {
      const msg = result.message || result.error || "Unknown failure from native device discovery";
      throw new Error(msg);
    }

    // Normalize devices (hostname + manufacturer + multi-source detectionMethods)
    const devices = (result.devices || []).map(d => ({
      ipAddress: d.ipAddress || "",
      macAddress: d.macAddress || "",
      hostname: d.hostname || null,
      detectionMethods: Array.isArray(d.detectionMethods)
        ? d.detectionMethods
        : (d.detectionMethod ? [d.detectionMethod] : ["unknown"]),
      manufacturer: d.manufacturer || "Unknown",
      deviceType: d.deviceType || "Unknown Device",
      confidence: d.confidence || "Low",
      isCurrentDevice: !!d.isCurrentDevice
    }));

    // Sort so current device is first, then by IP for stable display
    devices.sort((a, b) => {
      if (a.isCurrentDevice) return -1;
      if (b.isCurrentDevice) return 1;
      return (a.ipAddress || "").localeCompare(b.ipAddress || "", undefined, { numeric: true });
    });

    return {
      success: true,
      devices,
      currentDeviceIp: result.currentDeviceIp || null,
      subnet: result.subnet || null,
      count: result.count || devices.length
    };
  } catch (e) {
    console.error("[NetworkDiscovery] error:", e);
    throw e;
  }
}
