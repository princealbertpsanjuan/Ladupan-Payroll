const crypto = require("crypto");
const ShopDevice = require("../models/ShopDevice");
const Setting = require("../models/Setting");
const { logAudit } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");
const { normalizeIp, getClientIp, isValidNetwork, suggestNetworkFor } = require("../utils/ipUtils");
const { describeDevice } = require("../utils/deviceUtils");

const PAIR_CODE_MINUTES = 15;
const OFFLINE_AFTER_MINUTES = 15;

const hash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");

// ---------- address helpers ----------

const isPublicIpv4 = (ip) => {
  const value = normalizeIp(ip);
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(value) || !isValidNetwork(value)) return false;
  const [a, b] = value.split(".").map(Number);
  if (a === 10 || a === 127 || a === 0) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  return a < 224;
};

// Global IPv6 (2000::/3), saved as its /64 network so rotating addresses match
const isGlobalIpv6 = (ip) => {
  const value = normalizeIp(ip);
  return value.includes(":") && isValidNetwork(value) && /^[23]/.test(value);
};

// The addresses that should be allowed for this branch right now: what the
// server sees, plus the other address type the device found (shops can have
// both IPv4 and IPv6, and phones use either)
const branchAddresses = (seenIp, reported = {}) => {
  const set = new Set();
  const add = (ip) => {
    if (isPublicIpv4(ip)) set.add(normalizeIp(ip));
    else if (isGlobalIpv6(ip)) set.add(suggestNetworkFor(ip));
  };
  add(seenIp);
  add(reported.ipv4);
  add(reported.ipv6);
  return [...set].sort();
};

const sameList = (a = [], b = []) => a.length === b.length && a.every((value, i) => value === b[i]);

// Replace this device's entries in the allowed list
const syncNetworks = async (device, addresses) => {
  const settings = await Setting.getSettings();
  const others = settings.allowedNetworks.filter(
    (network) => String(network.shopDevice || "") !== String(device._id)
  );

  settings.allowedNetworks = [
    ...others,
    ...addresses.map((address) => ({
      address,
      label: device.label,
      addedAt: new Date(),
      shopDevice: device._id,
    })),
  ];
  await settings.save();
};

const deviceSummary = (device) => ({
  _id: device._id,
  label: device.label,
  paired: Boolean(device.tokenHash),
  pairedAt: device.pairedAt,
  pairCodeExpires: device.tokenHash ? null : device.pairCodeExpires,
  lastSeenAt: device.lastSeenAt,
  lastAddresses: device.lastAddresses,
  deviceInfo: device.deviceInfo,
  online: Boolean(
    device.lastSeenAt && Date.now() - new Date(device.lastSeenAt).getTime() < OFFLINE_AFTER_MINUTES * 60 * 1000
  ),
});

exports.deviceSummary = deviceSummary;

exports.listDevices = async () => {
  const devices = await ShopDevice.find().sort({ createdAt: 1 });
  return devices.map(deviceSummary);
};

// ---------- admin ----------

// Start pairing a device for a branch: returns a 6-digit code to type on it
exports.createPairing = async (req, res) => {
  try {
    const label = String(req.body.label || "").trim().slice(0, 60);
    if (!label) return res.status(400).json({ message: "Enter the branch name, e.g. Main branch" });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const device = await ShopDevice.create({
      label,
      pairCodeHash: hash(code),
      pairCodeExpires: new Date(Date.now() + PAIR_CODE_MINUTES * 60 * 1000),
      createdBy: req.user._id,
    });

    await logAudit(req, {
      action: "SHOP_DEVICE_PAIRING",
      entityType: "Setting",
      entityId: device._id,
      description: `Started pairing a shop device for ${label}`,
    });

    res.status(201).json({
      device: deviceSummary(device),
      code,
      expiresInMinutes: PAIR_CODE_MINUTES,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to start pairing", error: error.message });
  }
};

// Unpair: the device stops updating and its addresses are removed
exports.removeDevice = async (req, res) => {
  try {
    const device = await ShopDevice.findById(req.params.id);
    if (!device) return res.status(404).json({ message: "Device not found" });

    await syncNetworks(device, []);
    await device.deleteOne();

    await logAudit(req, {
      action: "SHOP_DEVICE_REMOVED",
      entityType: "Setting",
      entityId: device._id,
      description: `Unpaired the ${device.label} shop device${device.lastAddresses.length ? ` and removed ${device.lastAddresses.join(", ")}` : ""}`,
    });

    res.json({ message: `${device.label} shop device unpaired` });
  } catch (error) {
    res.status(500).json({ message: "Failed to unpair the device", error: error.message });
  }
};

// ---------- device (no user login) ----------

// Limit wrong pairing codes: 10 tries per 15 minutes per address
const failedTries = new Map();

exports.pair = async (req, res) => {
  try {
    const ip = getClientIp(req);
    const now = Date.now();
    const tries = (failedTries.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);

    if (tries.length >= 10) {
      return res.status(429).json({ message: "Too many wrong codes. Wait 15 minutes and try again." });
    }

    const code = String(req.body.code || "").replace(/\D/g, "");
    const device =
      code.length === 6
        ? await ShopDevice.findOne({
            pairCodeHash: hash(code),
            pairCodeExpires: { $gt: new Date() },
            tokenHash: null,
          })
        : null;

    if (!device) {
      failedTries.set(ip, [...tries, now]);
      return res.status(400).json({ message: "Wrong or expired code. Create a new code in Shop Network." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    device.tokenHash = hash(token);
    device.pairCodeHash = null;
    device.pairCodeExpires = null;
    device.pairedAt = new Date();
    device.deviceInfo = describeDevice(req.get("user-agent"));
    await device.save();

    await notifyAdmins({
      type: "shop_device",
      level: "success",
      title: `Shop device paired for ${device.label}`,
      message: `${device.deviceInfo}. It will keep ${device.label}'s internet address up to date.`,
      link: "/admin/settings",
    });

    res.json({ token, label: device.label });
  } catch (error) {
    res.status(500).json({ message: "Pairing failed", error: error.message });
  }
};

// Every minute: "I'm at <branch>, this is the shop's address"
exports.heartbeat = async (req, res) => {
  try {
    const token = String(req.get("x-shop-device-token") || "");
    const device = token ? await ShopDevice.findOne({ tokenHash: hash(token) }) : null;

    if (!device) {
      return res.status(401).json({ code: "DEVICE_UNPAIRED", message: "This device is not paired." });
    }

    const addresses = branchAddresses(getClientIp(req), req.body || {});

    if (addresses.length === 0) {
      return res.status(400).json({
        message: "Couldn't read a public internet address. Check the Wi-Fi connection.",
      });
    }

    const changed = !sameList(addresses, device.lastAddresses);
    const wasOffline = device.offlineAlerted;

    // Also restore entries removed by hand from the allowed list
    const settings = await Setting.getSettings();
    const saved = settings.allowedNetworks
      .filter((network) => String(network.shopDevice || "") === String(device._id))
      .map((network) => network.address)
      .sort();

    if (changed || !sameList(saved, addresses)) {
      await syncNetworks(device, addresses);
    }

    if (changed) {
      if (device.lastAddresses.length > 0) {
        await logAudit(req, {
          action: "NETWORK_AUTO_UPDATED",
          entityType: "Setting",
          entityId: device._id,
          description: `${device.label} address changed from ${device.lastAddresses.join(", ")} to ${addresses.join(", ")} (shop device)`,
        });

        await notifyAdmins({
          type: "shop_device",
          level: "info",
          title: `${device.label}'s internet address changed`,
          message: `Now ${addresses.join(", ")}. Updated automatically by the shop device, so employees there can still time in.`,
          link: "/admin/settings",
        });
      }

      device.lastAddresses = addresses;
    }

    device.lastSeenAt = new Date();
    device.offlineAlerted = false;
    await device.save();

    if (wasOffline) {
      await notifyAdmins({
        type: "shop_device",
        level: "success",
        title: `${device.label} shop device is back online`,
        message: `Address: ${addresses.join(", ")}.`,
        link: "/admin/settings",
      });
    }

    res.json({ label: device.label, addresses, nextCheckSeconds: 60 });
  } catch (error) {
    res.status(500).json({ message: "Check-in failed", error: error.message });
  }
};

// Runs every few minutes: alert once when a paired device stops checking in
exports.checkOfflineDevices = async () => {
  try {
    const cutoff = new Date(Date.now() - OFFLINE_AFTER_MINUTES * 60 * 1000);
    const devices = await ShopDevice.find({
      tokenHash: { $ne: null },
      offlineAlerted: false,
      lastSeenAt: { $lt: cutoff },
    });

    for (const device of devices) {
      device.offlineAlerted = true;
      await device.save();

      await notifyAdmins({
        type: "shop_device",
        level: "warning",
        title: `${device.label} shop device is offline`,
        message:
          "It hasn't checked in for 15 minutes. If the internet address changes now, employees there may be blocked. Check that it's on, plugged in, on the shop Wi-Fi, and the Ladupan shop screen is open.",
        link: "/admin/settings",
      });
    }
  } catch (error) {
    console.error("Shop device check failed:", error.message);
  }
};

exports._test = { isPublicIpv4, isGlobalIpv6, branchAddresses };
