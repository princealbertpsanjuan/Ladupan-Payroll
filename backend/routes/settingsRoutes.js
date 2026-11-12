const express = require("express");
const router = express.Router();

const {
  getNetworkSettings,
  setRestriction,
  addNetwork,
  removeNetwork,
  getMyNetworkStatus,
} = require("../controllers/settingsController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

// EMPLOYEE (any signed-in user)
router.get("/network/status", protect, getMyNetworkStatus);

// ADMIN
router.get("/network", protect, adminOnly, getNetworkSettings);
router.put("/network/restriction", protect, adminOnly, setRestriction);
router.post("/network/allowed", protect, adminOnly, addNetwork);
router.delete("/network/allowed/:id", protect, adminOnly, removeNetwork);

module.exports = router;
