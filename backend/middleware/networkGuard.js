const Setting = require("../models/Setting");
const { getClientIp, isAllowedIp } = require("../utils/ipUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");
const { getCurrentTime } = require("../utils/timeUtils");

// Limit admin alerts to one per employee per 15 minutes, so repeated
// taps on Time In do not flood the admin's notifications.
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const lastAlertAt = new Map();

// Is this request coming from the shop network? (no side effects)
const getNetworkCheck = async (req, settings) => {
  const appSettings = settings || (await Setting.getSettings());
  const ip = getClientIp(req);
  const restricted = Boolean(appSettings.restrictAttendanceNetwork);

  return {
    restricted,
    allowed: !restricted || isAllowedIp(ip, appSettings.allowedNetworks),
    ip,
  };
};

// Allows Time In / Time Out only from the shop's network when the
// restriction is turned on. Viewing records is never restricted.
const requireShopNetwork = (actionLabel) => async (req, res, next) => {
  try {
    const settings = await Setting.getSettings();

    if (!settings.restrictAttendanceNetwork) {
      return next();
    }

    const ip = getClientIp(req);

    if (isAllowedIp(ip, settings.allowedNetworks)) {
      return next();
    }

    const name = fullName(req.user);
    const time = getCurrentTime();

    await logAudit(req, {
      action: "ATTENDANCE_BLOCKED_NETWORK",
      entityType: "Attendance",
      entityId: null,
      description: `${name} tried to ${actionLabel} outside the shop network (IP ${ip || "unknown"})`,
      details: { ip, action: actionLabel, time, userAgent: req.get("user-agent") || "" },
    });

    const key = String(req.user._id);
    const now = Date.now();

    if (!lastAlertAt.has(key) || now - lastAlertAt.get(key) > ALERT_COOLDOWN_MS) {
      lastAlertAt.set(key, now);

      await notifyAdmins({
        type: "network_blocked",
        level: "alert",
        title: `${name} tried to ${actionLabel} outside the shop`,
        message: `Blocked at ${time} from IP ${ip || "unknown"}. Time in/out is only allowed on the shop Wi-Fi.`,
        link: "/admin/audit-log?action=ATTENDANCE_BLOCKED_NETWORK",
      });
    }

    return res.status(403).json({
      code: "OUTSIDE_SHOP_NETWORK",
      message: `You can only ${actionLabel} while connected to the shop Wi-Fi. The admin has been notified of this attempt.`,
    });
  } catch (error) {
    // Could not check the network: refuse rather than allow, and say why
    return res.status(500).json({
      message: "Could not verify the shop network. Please try again.",
      error: error.message,
    });
  }
};

module.exports = { requireShopNetwork, getNetworkCheck };
