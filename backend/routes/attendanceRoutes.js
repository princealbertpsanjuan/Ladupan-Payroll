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

// EMPLOYEE
router.post("/time-in", protect, employeeOnly, timeIn);
router.put("/time-out", protect, employeeOnly, timeOut);

router.get("/today", protect, employeeOnly, getMyToday);
router.get("/my-records", protect, employeeOnly, getMyAttendance);
router.get("/my-archives", protect, employeeOnly, getMyArchivedAttendance);

// ADMIN
router.get("/", protect, adminOnly, getAllAttendance);
router.post("/", protect, adminOnly, createAttendance);
router.put("/:id", protect, adminOnly, updateAttendance);
router.delete("/:id", protect, adminOnly, deleteAttendance);

module.exports = router;
