const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: String,
      required: true,
    },

    requiredTimeIn: {
      type: String,
      required: true,
    },

    timeIn: {
      type: String,
      default: null,
    },

    timeOut: {
      type: String,
      default: null,
    },

    // True when the time-out happened the day after the shift started
    // (night shift, e.g. 18:00 -> 06:00). Calculated automatically.
    timeOutNextDay: {
      type: Boolean,
      default: false,
    },

    totalHours: {
      type: Number,
      default: 0,
    },

    hourlyRate: {
      type: Number,
      required: true,
    },

    grossPay: {
      type: Number,
      default: 0,
    },

    lateMinutes: {
      type: Number,
      default: 0,
    },

    lateDeduction: {
      type: Number,
      default: 0,
    },

    remarks: {
      type: String,
      enum: ["Present", "Late", "Absent"],
      default: "Present",
    },

    // Off-network requests (shop Wi-Fi down): the time is recorded by the
    // server but waits for admin approval. Pending records are left out of
    // payroll until approved.
    timeInPending: {
      type: Boolean,
      default: false,
    },

    timeOutPending: {
      type: Boolean,
      default: false,
    },

    requestInfo: {
      timeInIp: { type: String, default: "" },
      timeOutIp: { type: String, default: "" },
      note: { type: String, default: "" },
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    payrollReport: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollReport",
      default: null,
    },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);