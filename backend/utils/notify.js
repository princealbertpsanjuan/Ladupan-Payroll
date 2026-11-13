const Notification = require("../models/Notification");
const User = require("../models/User");

// Send a notification to one user. Never throws: a failed notification
// must not break the action that triggered it.
const notifyUser = async (userId, { type, level = "info", title, message = "", link = "" }) => {
  try {
    if (!userId) return;
    await Notification.create({ recipient: userId, type, level, title, message, link });
  } catch (error) {
    console.error("Notification failed:", error.message);
  }
};

// Send the same notification to every active admin
const notifyAdmins = async (payload) => {
  try {
    const admins = await User.find({ role: "admin", isActive: true }).select("_id");

    await Promise.all(admins.map((admin) => notifyUser(admin._id, payload)));
  } catch (error) {
    console.error("Admin notification failed:", error.message);
  }
};

// ₱1,234.50
const peso = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

module.exports = { notifyUser, notifyAdmins, peso };
