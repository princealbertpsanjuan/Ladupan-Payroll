const Setting = require("../models/Setting");
const User = require("../models/User");
const { getDeviceId, hashDeviceId, describeDevice } = require("../utils/deviceUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyAdmins } = require("../utils/notify");
const { getClientIp } = require("../utils/ipUtils");

// One admin alert per employee per 15 minutes
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;
const lastAlertAt = new Map();

// Works out whether this employee may time in / out from this device.
// Does not change anything: registering happens in requireBoundDevice.
// Returns { ok, enabled, registered, needsRegistering, code?, message?, otherEmployee? }
const checkDevice = async (req, settings) => {
  const appSettings = settings || (await Setting.getSettings());

  if (!appSettings.deviceBinding) {
    return { ok: true, enabled: false };
  }

  const deviceId = getDeviceId(req);

  if (!deviceId) {
    return {
      ok: false,
      enabled: true,
      code: "DEVICE_ID_MISSING",
      message: "Couldn't identify this phone. Refresh the page and try again.",
    };
  }

  const idHash = hashDeviceId(deviceId);
  const user = req.user;
  const bound = user.boundDevice?.idHash;

  if (bound) {
    if (bound === idHash) return { ok: true, enabled: true, registered: true };

    return {
      ok: false,
      enabled: true,
      registered: true,
      code: "DEVICE_MISMATCH",
      message:
        "Your account is registered to another phone. Use your registered phone, or ask the admin to reset your device if you changed phones.",
    };
  }

  // Not registered yet: this phone must not belong to another employee
  const other = await User.findOne({
    _id: { $ne: user._id },
    role: "employee",
    "boundDevice.idHash": idHash,
  }).select("firstName lastName");

  if (other) {
    return {
      ok: false,
      enabled: true,
      registered: false,
      code: "DEVICE_TAKEN",
      otherEmployee: fullName(other),
      message:
        "This phone is already registered to another employee. Each employee must time in on their own phone.",
    };
  }

  return { ok: true, enabled: true, registered: false, needsRegistering: true, idHash };
};

// Allows Time In / Time Out only from the employee's registered phone when
// device binding is on. The first phone used after it's turned on (or after
// the admin resets the device) becomes the registered phone.
const requireBoundDevice = (actionLabel) => async (req, res, next) => {
  try {
    const result = await checkDevice(req);

    if (result.ok) {
      if (result.needsRegistering) {
        const label = describeDevice(req.get("user-agent"));

        const updated = await User.updateOne(
          { _id: req.user._id, $or: [{ "boundDevice.idHash": null }, { boundDevice: null }] },
          { $set: { boundDevice: { idHash: result.idHash, label, boundAt: new Date() } } }
        );

        if (updated.modifiedCount === 1) {
          req.user.boundDevice = { idHash: result.idHash, label, boundAt: new Date() };

          await logAudit(req, {
            action: "DEVICE_REGISTERED",
            entityType: "Employee",
            entityId: req.user._id,
            description: `${fullName(req.user)} registered their phone (${label})`,
          });
        }
      }

      return next();
    }

    if (result.code === "DEVICE_ID_MISSING") {
      return res.status(400).json({ code: result.code, message: result.message });
    }

    const name = fullName(req.user);
    const label = describeDevice(req.get("user-agent"));
    const description =
      result.code === "DEVICE_TAKEN"
        ? `${name} tried to ${actionLabel} on ${result.otherEmployee}'s registered phone (${label})`
        : `${name} tried to ${actionLabel} on an unregistered phone (${label})`;

    await logAudit(req, {
      action: "ATTENDANCE_BLOCKED_DEVICE",
      entityType: "Attendance",
      entityId: null,
      description,
      details: { action: actionLabel, reason: result.code, device: label, ip: getClientIp(req) },
    });

    const key = String(req.user._id);
    const now = Date.now();

    if (!lastAlertAt.has(key) || now - lastAlertAt.get(key) > ALERT_COOLDOWN_MS) {
      lastAlertAt.set(key, now);

      await notifyAdmins({
        type: "device_blocked",
        level: "alert",
        title:
          result.code === "DEVICE_TAKEN"
            ? `${name} tried to ${actionLabel} on ${result.otherEmployee}'s phone`
            : `${name} tried to ${actionLabel} on a different phone`,
        message:
          result.code === "DEVICE_TAKEN"
            ? `Blocked. Each employee must use their own phone (${label}).`
            : `Blocked (${label}). If they changed phones, reset their device in Employees.`,
        link: "/admin/employees",
      });
    }

    return res.status(403).json({ code: result.code, message: result.message });
  } catch (error) {
    return res.status(500).json({
      message: "Could not verify this phone. Please try again.",
      error: error.message,
    });
  }
};

module.exports = { checkDevice, requireBoundDevice };
