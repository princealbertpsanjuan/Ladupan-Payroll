const AuditLog = require("../models/AuditLog");
const { isValidDate, TIMEZONE } = require("../utils/timeUtils");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Converts a local (Philippine) calendar date to the UTC instant it starts at
const localDayStart = (date) => {
  // Asia/Manila has no daylight saving, so a fixed +08:00 offset is exact.
  const offset = TIMEZONE === "Asia/Manila" ? "+08:00" : "Z";
  return new Date(`${date}T00:00:00${offset}`);
};

// ADMIN: AUDIT LOG
// Query: page, limit, action, entityType, search, from (YYYY-MM-DD), to (YYYY-MM-DD)
exports.getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);

    const filter = {};

    if (req.query.action) {
      filter.action = req.query.action;
    }

    if (req.query.entityType) {
      filter.entityType = req.query.entityType;
    }

    if (req.query.search && req.query.search.trim()) {
      const pattern = new RegExp(escapeRegex(req.query.search.trim()), "i");
      filter.$or = [{ description: pattern }, { actorName: pattern }];
    }

    const createdAt = {};

    if (isValidDate(req.query.from)) {
      createdAt.$gte = localDayStart(req.query.from);
    }

    if (isValidDate(req.query.to)) {
      const end = localDayStart(req.query.to);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.$lt = end;
    }

    if (Object.keys(createdAt).length > 0) {
      filter.createdAt = createdAt;
    }

    const [logs, total, actions] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
      AuditLog.distinct("action"),
    ]);

    res.json({
      logs,
      total,
      page,
      pages: Math.max(Math.ceil(total / limit), 1),
      actions: actions.sort(),
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch audit log",
      error: error.message,
    });
  }
};
