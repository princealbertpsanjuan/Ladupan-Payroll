const express = require("express");
const router = express.Router();

const {
  getPayslip,
  getMyPayslips,
  getMyPayslip,
} = require("../controllers/payslipController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, employeeOnly } = require("../middleware/roleMiddleware");

// EMPLOYEE
router.get("/my", protect, employeeOnly, getMyPayslips);
router.get("/my/:reportId", protect, employeeOnly, getMyPayslip);

// ADMIN
router.get("/:reportId/:employeeId", protect, adminOnly, getPayslip);

module.exports = router;
