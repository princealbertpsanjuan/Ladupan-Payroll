const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },

    firstName: {
      type: String,
      required: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "employee"],
      default: "employee",
    },

    hourlyRate: {
      type: Number,
      default: 0,
    },

    requiredTimeIn: {
      type: String,
      default: "08:00",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Phone registered for Time In / Time Out (when device binding is on).
    // Only a hash of the device's random ID is stored.
    boundDevice: {
      idHash: { type: String, default: null },
      label: { type: String, default: "" },
      boundAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);