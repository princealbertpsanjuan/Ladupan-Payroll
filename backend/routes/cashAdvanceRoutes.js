const express = require("express");
const router = express.Router();

const {
  getCashAdvanceSummary,
  getEmployeeLedger,
  createCashAdvance,
  deleteCashAdvance,
  getMyCashAdvances,
} = require("../controllers/cashAdvanceController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, employeeOnly } = require("../middleware/roleMiddleware");

// EMPLOYEE
router.get("/my", protect, employeeOnly, getMyCashAdvances);

// ADMIN
router.get("/", protect, adminOnly, getCashAdvanceSummary);
router.get("/employee/:employeeId", protect, adminOnly, getEmployeeLedger);
router.post("/", protect, adminOnly, createCashAdvance);
router.delete("/:id", protect, adminOnly, deleteCashAdvance);

module.exports = router;
