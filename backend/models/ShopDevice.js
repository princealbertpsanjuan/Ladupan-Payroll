const mongoose = require("mongoose");

// A phone or tablet that stays at a branch on the shop Wi-Fi. It checks in
// every minute so the branch's allowed address follows the shop's current
// internet address (which changes after power interruptions).
const shopDeviceSchema = new mongoose.Schema(
  {
    // Branch name, e.g. "Main branch"
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // One-time pairing code (hashed) and its expiry
    pairCodeHash: { type: String, default: null },
    pairCodeExpires: { type: Date, default: null },

    // Secret kept on the device after pairing (hashed here)
    tokenHash: { type: String, default: null },
    pairedAt: { type: Date, default: null },

    lastSeenAt: { type: Date, default: null },
    lastAddresses: { type: [String], default: [] },
    deviceInfo: { type: String, default: "" },

    // An "offline" alert was sent and the device hasn't come back yet
    offlineAlerted: { type: Boolean, default: false },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

shopDeviceSchema.index({ tokenHash: 1 });

module.exports = mongoose.model("ShopDevice", shopDeviceSchema);
