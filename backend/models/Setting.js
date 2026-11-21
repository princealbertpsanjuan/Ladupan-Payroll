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

    // First day no-show absences are counted (set once on deploy)
    absenceTrackingFrom: {
      type: String,
      default: null,
    },

    // One-time startup data updates already done (see utils/startupTasks)
    completedTasks: {
      type: [String],
      default: [],
    },

    // Off-network "Request Time In / Time Out" buttons (for when the shop
    // Wi-Fi is down). Off unless the admin turns it on.
    allowTimeRequests: {
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
        // Set when a paired shop device keeps this address up to date
        shopDevice: { type: mongoose.Schema.Types.ObjectId, ref: "ShopDevice", default: null },
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
