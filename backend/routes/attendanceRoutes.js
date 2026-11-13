const express = require("express");
const router = express.Router();

const {
  timeIn,
  timeOut,
  getMyToday,
  getMyAttendance,
  getMyArchivedAttendance,
  getAllAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} = require("../controllers/attendanceController");

const { protect, adminOnly } = require("../middleware/authMiddleware");
const { employeeOnly } = require("../middleware/roleMiddleware");
const { requireShopNetwork } = require("../middleware/networkGuard");

// EMPLOYEE
// Time in / out only from the shop network (when the admin turns it on).
// Viewing records below is allowed from anywhere.
router.post("/time-in", protect, employeeOnly, requireShopNetwork("time in"), timeIn);
router.put("/time-out", protect, employeeOnly, requireShopNetwork("time out"), timeOut);

router.get("/today", protect, employeeOnly, getMyToday);
router.get("/my-records", protect, employeeOnly, getMyAttendance);
router.get("/my-archives", protect, employeeOnly, getMyArchivedAttendance);

// ADMIN
router.get("/", protect, adminOnly, getAllAttendance);
router.post("/", protect, adminOnly, createAttendance);
router.put("/:id", protect, adminOnly, updateAttendance);
router.delete("/:id", protect, adminOnly, deleteAttendance);

module.exports = router;
