const express = require("express");
const router = express.Router();

const {
  getAdminDashboard,
  getEmployeeDashboard,
} = require("../controllers/dashboardController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, employeeOnly } = require("../middleware/roleMiddleware");

router.get("/admin", protect, adminOnly, getAdminDashboard);
router.get("/employee", protect, employeeOnly, getEmployeeDashboard);

module.exports = router;
