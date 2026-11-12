const mongoose = require("mongoose");

// In-app notification for one user (admins each get their own copy).
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // e.g. network_blocked, correction_submitted, correction_reviewed,
    // payslip_ready, attendance_updated, cash_advance
    type: {
      type: String,
      required: true,
    },

    // info | success | warning | alert (controls the icon color)
    level: {
      type: String,
      enum: ["info", "success", "warning", "alert"],
      default: "info",
    },

    title: {
      type: String,
      required: true,
    },

    message: {
      type: String,
      default: "",
    },

    // Page to open when clicked, e.g. /admin/corrections
    link: {
      type: String,
      default: "",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
