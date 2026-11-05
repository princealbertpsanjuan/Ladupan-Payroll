const express = require("express");
const router = express.Router();

const {
  createCorrection,
  getMyCorrections,
  cancelMyCorrection,
  getCorrections,
  approveCorrection,
  rejectCorrection,
} = require("../controllers/correctionController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, employeeOnly } = require("../middleware/roleMiddleware");

// EMPLOYEE
router.post("/", protect, employeeOnly, createCorrection);
router.get("/my", protect, employeeOnly, getMyCorrections);
router.delete("/my/:id", protect, employeeOnly, cancelMyCorrection);

// ADMIN
router.get("/", protect, adminOnly, getCorrections);
router.put("/:id/approve", protect, adminOnly, approveCorrection);
router.put("/:id/reject", protect, adminOnly, rejectCorrection);

module.exports = router;
