const express = require("express");
const router = express.Router();

const {
  previewPayroll,
  generatePayroll,
} = require("../controllers/payrollController");

const { protect } = require("../middleware/authMiddleware");
const { adminOnly } = require("../middleware/roleMiddleware");

router.post(
  "/preview",
  protect,
  adminOnly,
  previewPayroll
);

router.post(
  "/generate",
  protect,
  adminOnly,
  generatePayroll
);

module.exports = router;
