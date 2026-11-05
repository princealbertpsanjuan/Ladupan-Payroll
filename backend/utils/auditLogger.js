const AuditLog = require("../models/AuditLog");

// Record an action in the audit log.
// Never throws: a logging failure must not break the action itself.
const logAudit = async (
  req,
  { action, entityType, entityId = null, description, details = {} }
) => {
  try {
    const actor = req?.user || null;

    await AuditLog.create({
      actor: actor?._id || null,
      actorName: actor
        ? `${actor.firstName || ""} ${actor.lastName || ""}`.trim()
        : "System",
      actorRole: actor?.role || "system",
      action,
      entityType,
      entityId,
      description,
      details,
    });
  } catch (error) {
    console.error("Audit log failed:", error.message);
  }
};

const fullName = (person) =>
  person ? `${person.firstName || ""} ${person.lastName || ""}`.trim() : "Unknown";

module.exports = { logAudit, fullName };
