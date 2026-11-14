const express = require("express");
const router = express.Router();

const {
  timeIn,
  timeOut,
  requestTimeIn,
  requestTimeOut,
  getPendingRequests,
  approvePending,
  rejectPending,
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
const { requireBoundDevice } = require("../middleware/deviceGuard");

// EMPLOYEE
// Time in / out only from the employee's registered phone (device binding)
// and the shop network (when the admin turns those on).
// Viewing records below is allowed from anywhere.
router.post("/time-in", protect, employeeOnly, requireBoundDevice("time in"), requireShopNetwork("time in"), timeIn);
router.put("/time-out", protect, employeeOnly, requireBoundDevice("time out"), requireShopNetwork("time out"), timeOut);

// Shop Wi-Fi down: send a Time In / Time Out request for the admin to approve
router.post("/request-time-in", protect, employeeOnly, requireBoundDevice("request time in"), requestTimeIn);
router.put("/request-time-out", protect, employeeOnly, requireBoundDevice("request time out"), requestTimeOut);

router.get("/today", protect, employeeOnly, getMyToday);
router.get("/my-records", protect, employeeOnly, getMyAttendance);
router.get("/my-archives", protect, employeeOnly, getMyArchivedAttendance);

// ADMIN
router.get("/pending-requests", protect, adminOnly, getPendingRequests);
router.put("/:id/approve-request", protect, adminOnly, approvePending);
router.put("/:id/reject-request", protect, adminOnly, rejectPending);
router.get("/", protect, adminOnly, getAllAttendance);
router.post("/", protect, adminOnly, createAttendance);
router.put("/:id", protect, adminOnly, updateAttendance);
router.delete("/:id", protect, adminOnly, deleteAttendance);

module.exports = router;
