const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { adminOnly, employeeOnly } = require("../middleware/roleMiddleware");
const {
  getMonthSchedule,
  setRestDay,
  fillWeekday,
  getMySchedule,
} = require("../controllers/scheduleController");

// EMPLOYEE
router.get("/mine", protect, employeeOnly, getMySchedule);

// ADMIN
router.get("/", protect, adminOnly, getMonthSchedule);
router.put("/rest-day", protect, adminOnly, setRestDay);
router.post("/fill", protect, adminOnly, fillWeekday);

module.exports = router;
