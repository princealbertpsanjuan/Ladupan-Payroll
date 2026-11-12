const Setting = require("../models/Setting");
const AuditLog = require("../models/AuditLog");
const {
  getClientIp,
  isAllowedIp,
  isValidNetwork,
  normalizeIp,
  suggestNetworkFor,
} = require("../utils/ipUtils");
const { logAudit } = require("../utils/auditLogger");

const toResponse = (settings, req) => {
  const currentIp = getClientIp(req);

  return {
    restrictAttendanceNetwork: settings.restrictAttendanceNetwork,
    allowedNetworks: settings.allowedNetworks,
    currentIp,
    currentIpAllowed: isAllowedIp(currentIp, settings.allowedNetworks),
    // What "Add this network" saves (IPv6 devices get their /64 network)
    suggestedNetwork: currentIp ? suggestNetworkFor(currentIp) : "",
  };
};

// ADMIN: shop network settings + the admin's current IP
exports.getNetworkSettings = async (req, res) => {
  try {
    const settings = await Setting.getSettings();

    const recentBlocked = await AuditLog.find({ action: "ATTENDANCE_BLOCKED_NETWORK" })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ ...toResponse(settings, req), recentBlocked });
  } catch (error) {
    res.status(500).json({ message: "Failed to load settings", error: error.message });
  }
};

// ADMIN: turn the restriction on or off
exports.setRestriction = async (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be true or false" });
    }

    const settings = await Setting.getSettings();

    if (enabled && settings.allowedNetworks.length === 0) {
      return res.status(400).json({
        message: "Add the shop network first, otherwise nobody could time in.",
      });
    }

    settings.restrictAttendanceNetwork = enabled;
    await settings.save();

    await logAudit(req, {
      action: enabled ? "NETWORK_RESTRICTION_ON" : "NETWORK_RESTRICTION_OFF",
      entityType: "Setting",
      description: enabled
        ? "Turned ON: time in/out only from the shop network"
        : "Turned OFF: time in/out allowed from any network",
      details: { allowedNetworks: settings.allowedNetworks.map((n) => n.address) },
    });

    res.json(toResponse(settings, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to update settings", error: error.message });
  }
};

// ADMIN: add an allowed network (IP or IPv4 range)
exports.addNetwork = async (req, res) => {
  try {
    const address = normalizeIp(req.body.address);
    const label = String(req.body.label || "").trim();

    if (!isValidNetwork(address)) {
      return res.status(400).json({
        message:
          "Enter a valid IP address (e.g. 203.0.113.5) or range (e.g. 192.168.1.0/24 or 2001:db8:1:2::/64).",
      });
    }

    const settings = await Setting.getSettings();

    if (settings.allowedNetworks.some((network) => network.address === address)) {
      return res.status(400).json({ message: "This network is already in the list." });
    }

    settings.allowedNetworks.push({ address, label: label || "Shop Wi-Fi" });
    await settings.save();

    await logAudit(req, {
      action: "NETWORK_ADDED",
      entityType: "Setting",
      description: `Added allowed network ${address}${label ? ` (${label})` : ""}`,
    });

    res.status(201).json(toResponse(settings, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to add network", error: error.message });
  }
};

// ADMIN: remove an allowed network
exports.removeNetwork = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    const network = settings.allowedNetworks.id(req.params.id);

    if (!network) {
      return res.status(404).json({ message: "Network not found" });
    }

    if (settings.restrictAttendanceNetwork && settings.allowedNetworks.length === 1) {
      return res.status(400).json({
        message: "This is the only allowed network. Turn the restriction off first, or add another network.",
      });
    }

    const address = network.address;
    settings.allowedNetworks.pull(network._id);
    await settings.save();

    await logAudit(req, {
      action: "NETWORK_REMOVED",
      entityType: "Setting",
      description: `Removed allowed network ${address}`,
    });

    res.json(toResponse(settings, req));
  } catch (error) {
    res.status(500).json({ message: "Failed to remove network", error: error.message });
  }
};

// EMPLOYEE: can I time in from where I am right now?
exports.getMyNetworkStatus = async (req, res) => {
  try {
    const settings = await Setting.getSettings();
    const ip = getClientIp(req);

    res.json({
      restricted: settings.restrictAttendanceNetwork,
      allowed:
        !settings.restrictAttendanceNetwork || isAllowedIp(ip, settings.allowedNetworks),
      ip,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to check network", error: error.message });
  }
};
