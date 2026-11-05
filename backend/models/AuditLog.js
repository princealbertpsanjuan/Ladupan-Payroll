const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Snapshot so the log stays readable even if the user is deleted later
    actorName: {
      type: String,
      default: "System",
    },

    actorRole: {
      type: String,
      default: "system",
    },

    // e.g. EMPLOYEE_CREATED, ATTENDANCE_UPDATED, PAYROLL_GENERATED
    action: {
      type: String,
      required: true,
    },

    // e.g. Employee, Attendance, PayrollReport, CashAdvance, CorrectionRequest
    entityType: {
      type: String,
      required: true,
    },

    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    description: {
      type: String,
      required: true,
    },

    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
