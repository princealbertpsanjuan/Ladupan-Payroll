const mongoose = require("mongoose");

// System settings (a single document with _id "app").
const settingSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: "app",
    },

    // Time in / time out only from the shop's network
    restrictAttendanceNetwork: {
      type: Boolean,
      default: false,
    },

    // Each employee may time in / out from one registered phone only
    deviceBinding: {
      type: Boolean,
      default: false,
    },

    allowedNetworks: [
      {
        address: { type: String, required: true }, // IP or IPv4 CIDR range
        label: { type: String, default: "" },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

settingSchema.statics.getSettings = async function () {
  let settings = await this.findById("app");

  if (!settings) {
    try {
      settings = await this.create({ _id: "app" });
    } catch (error) {
      // Created by another request at the same time
      if (error.code !== 11000) throw error;
      settings = await this.findById("app");
    }
  }

  return settings;
};

module.exports = mongoose.model("Setting", settingSchema);
