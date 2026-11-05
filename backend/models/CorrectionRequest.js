const mongoose = require("mongoose");

// DTR correction request submitted by an employee
// (e.g. forgot to time out, wrong time-in) and reviewed by the Admin.
const correctionRequestSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Existing DTR record for that date, if there is one
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attendance",
      default: null,
    },

    date: {
      type: String,
      required: true,
    },

    // Values on the DTR when the request was submitted
    originalTimeIn: {
      type: String,
      default: null,
    },

    originalTimeOut: {
      type: String,
      default: null,
    },

    requestedTimeIn: {
      type: String,
      required: true,
    },

    requestedTimeOut: {
      type: String,
      default: null,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    adminNote: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

correctionRequestSchema.index({ employee: 1, date: 1, status: 1 });

module.exports = mongoose.model("CorrectionRequest", correctionRequestSchema);
