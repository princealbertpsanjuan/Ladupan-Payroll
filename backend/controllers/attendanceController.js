const Attendance = require("../models/Attendance");
const User = require("../models/User");
const {
  applyAttendanceRules,
  timeToMinutes,
} = require("../utils/attendanceRules");
const {
  getToday,
  getCurrentTime,
  isValidDate,
  isValidTime,
} = require("../utils/timeUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyUser } = require("../utils/notify");

const snapshot = (record) => ({
  date: record.date,
  requiredTimeIn: record.requiredTimeIn,
  timeIn: record.timeIn,
  timeOut: record.timeOut,
  totalHours: record.totalHours,
  grossPay: record.grossPay,
  lateMinutes: record.lateMinutes,
  remarks: record.remarks,
});

const validateTimes = (timeIn, timeOut) => {
  if (!isValidTime(timeIn)) {
    return "Time in must be a valid time (HH:mm)";
  }

  if (timeOut) {
    if (!isValidTime(timeOut)) {
      return "Time out must be a valid time (HH:mm)";
    }

    if (timeToMinutes(timeOut) <= timeToMinutes(timeIn)) {
      return "Time out must be later than time in";
    }
  }

  return null;
};

// EMPLOYEE TIME IN (once per day)
exports.timeIn = async (req, res) => {
  try {
    const employee = req.user;
    const today = getToday();
    const currentTime = getCurrentTime();

    const existingAttendance = await Attendance.findOne({
      employee: employee._id,
      date: today,
    });

    if (existingAttendance) {
      return res.status(400).json({
        message: "You have already timed in today",
      });
    }

    const attendance = new Attendance({
      employee: employee._id,
      date: today,
      requiredTimeIn: employee.requiredTimeIn,
      timeIn: currentTime,
      hourlyRate: employee.hourlyRate,
    });

    // Remarks (Present / Late / Absent) are known as soon as the employee times in
    applyAttendanceRules(attendance);

    await attendance.save();

    res.status(201).json({
      message:
        attendance.remarks === "Absent"
          ? "Time in recorded. You are 90 minutes late or more, so today is marked Absent."
          : "Time in successful",
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "You have already timed in today",
      });
    }

    res.status(500).json({
      message: "Time in failed",
      error: error.message,
    });
  }
};

// EMPLOYEE TIME OUT (once per day, only after timing in)
exports.timeOut = async (req, res) => {
  try {
    const employee = req.user;
    const today = getToday();
    const currentTime = getCurrentTime();

    const attendance = await Attendance.findOne({
      employee: employee._id,
      date: today,
    });

    if (!attendance || !attendance.timeIn) {
      return res.status(400).json({
        message: "You must time in first before timing out",
      });
    }

    if (attendance.timeOut) {
      return res.status(400).json({
        message: "You have already timed out today",
      });
    }

    if (attendance.isArchived) {
      return res.status(400).json({
        message: "Today's record is already included in a payroll",
      });
    }

    attendance.timeOut = currentTime;
    applyAttendanceRules(attendance);

    await attendance.save();

    res.json({
      message: "Time out successful",
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Time out failed",
      error: error.message,
    });
  }
};

// GET MY ATTENDANCE FOR TODAY (local date)
exports.getMyToday = async (req, res) => {
  try {
    const today = getToday();

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date: today,
    });

    res.json({
      date: today,
      currentTime: getCurrentTime(),
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to get today's attendance",
      error: error.message,
    });
  }
};

// GET MY ACTIVE ATTENDANCE RECORDS
exports.getMyAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      employee: req.user._id,
      isArchived: false,
    }).sort({ date: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get attendance records",
      error: error.message,
    });
  }
};

// GET MY ARCHIVED ATTENDANCE RECORDS
exports.getMyArchivedAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      employee: req.user._id,
      isArchived: true,
    })
      .populate("payrollReport", "payrollPeriodStart payrollPeriodEnd")
      .sort({ date: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get archived attendance",
      error: error.message,
    });
  }
};

// ADMIN GET ALL ACTIVE ATTENDANCE
exports.getAllAttendance = async (req, res) => {
  try {
    const records = await Attendance.find({
      isArchived: false,
    })
      .populate(
        "employee",
        "employeeId firstName lastName requiredTimeIn hourlyRate"
      )
      .sort({ date: -1 });

    res.json(records);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};

// ADMIN ADD ATTENDANCE (e.g. employee could not time in)
// Required time-in and hourly rate always come from the employee's
// current settings, not from the request.
exports.createAttendance = async (req, res) => {
  try {
    const { employee: employeeId, date, timeIn, timeOut, requiredTimeIn } = req.body;

    const employee = await User.findById(employeeId);

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    if (!isValidDate(date)) {
      return res.status(400).json({
        message: "Date must be a valid date",
      });
    }

    if (date > getToday()) {
      return res.status(400).json({
        message: "Attendance cannot be added for a future date",
      });
    }

    const timeError = validateTimes(timeIn, timeOut || null);

    if (timeError) {
      return res.status(400).json({ message: timeError });
    }

    if (requiredTimeIn && !isValidTime(requiredTimeIn)) {
      return res.status(400).json({
        message: "Required time in must be a valid time (HH:mm)",
      });
    }

    const existing = await Attendance.findOne({
      employee: employee._id,
      date,
    });

    if (existing) {
      return res.status(400).json({
        message: existing.isArchived
          ? `${fullName(employee)} already has an archived DTR record on ${date}`
          : `${fullName(employee)} already has a DTR record on ${date}. Edit that record instead.`,
      });
    }

    // The employee's default schedule unless the admin set a different
    // required time-in for this day
    const attendance = new Attendance({
      employee: employee._id,
      date,
      requiredTimeIn: requiredTimeIn || employee.requiredTimeIn,
      timeIn,
      timeOut: timeOut || null,
      hourlyRate: employee.hourlyRate,
    });

    applyAttendanceRules(attendance);
    await attendance.save();

    await logAudit(req, {
      action: "ATTENDANCE_CREATED",
      entityType: "Attendance",
      entityId: attendance._id,
      description: `Added DTR for ${fullName(employee)} on ${date}`,
      details: { after: snapshot(attendance) },
    });

    await notifyUser(employee._id, {
      type: "attendance_updated",
      level: "info",
      title: "The admin added a DTR record for you",
      message: `${date}: ${timeIn} – ${timeOut || "no time-out"} (${attendance.remarks}).`,
      link: "/client/records",
    });

    await attendance.populate(
      "employee",
      "employeeId firstName lastName requiredTimeIn hourlyRate"
    );

    res.status(201).json({
      message: "Attendance record added",
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "This employee already has a DTR record on that date",
      });
    }

    res.status(500).json({
      message: "Failed to add attendance",
      error: error.message,
    });
  }
};

// ADMIN EDIT ATTENDANCE (e.g. set a missing time-out)
// Archived records are locked because they are part of a generated payroll.
exports.updateAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate(
      "employee",
      "employeeId firstName lastName requiredTimeIn hourlyRate"
    );

    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    if (attendance.isArchived) {
      return res.status(400).json({
        message: "Archived records are locked because they are part of a generated payroll",
      });
    }

    const before = snapshot(attendance);

    const { date, timeIn, timeOut, requiredTimeIn } = req.body;

    const nextDate = date || attendance.date;
    const nextRequiredTimeIn = requiredTimeIn || attendance.requiredTimeIn;

    if (!isValidTime(nextRequiredTimeIn)) {
      return res.status(400).json({
        message: "Required time in must be a valid time (HH:mm)",
      });
    }
    const nextTimeIn = timeIn || attendance.timeIn;
    const nextTimeOut =
      timeOut === undefined ? attendance.timeOut : timeOut || null;

    if (!isValidDate(nextDate)) {
      return res.status(400).json({
        message: "Date must be a valid date",
      });
    }

    if (nextDate > getToday()) {
      return res.status(400).json({
        message: "Attendance cannot be set to a future date",
      });
    }

    const timeError = validateTimes(nextTimeIn, nextTimeOut);

    if (timeError) {
      return res.status(400).json({ message: timeError });
    }

    if (nextDate !== attendance.date) {
      const duplicate = await Attendance.findOne({
        employee: attendance.employee?._id || attendance.employee,
        date: nextDate,
        _id: { $ne: attendance._id },
      });

      if (duplicate) {
        return res.status(400).json({
          message: `This employee already has a DTR record on ${nextDate}`,
        });
      }
    }

    // Changing the required time-in affects this day only; the employee's
    // default schedule in Employee Management stays the same
    attendance.requiredTimeIn = nextRequiredTimeIn;
    attendance.date = nextDate;
    attendance.timeIn = nextTimeIn;
    attendance.timeOut = nextTimeOut;

    applyAttendanceRules(attendance);
    await attendance.save();

    await logAudit(req, {
      action: "ATTENDANCE_UPDATED",
      entityType: "Attendance",
      entityId: attendance._id,
      description:
        before.requiredTimeIn !== attendance.requiredTimeIn
          ? `Edited DTR of ${fullName(attendance.employee)} on ${attendance.date} (required time-in ${before.requiredTimeIn} → ${attendance.requiredTimeIn})`
          : `Edited DTR of ${fullName(attendance.employee)} on ${attendance.date}`,
      details: { before, after: snapshot(attendance) },
    });

    const changes = [];
    if (before.requiredTimeIn !== attendance.requiredTimeIn) {
      changes.push(`required time-in ${before.requiredTimeIn} → ${attendance.requiredTimeIn}`);
    }
    if (before.timeIn !== attendance.timeIn) changes.push(`time in ${before.timeIn || "-"} → ${attendance.timeIn}`);
    if (before.timeOut !== attendance.timeOut) {
      changes.push(`time out ${before.timeOut || "-"} → ${attendance.timeOut || "-"}`);
    }
    if (before.date !== attendance.date) changes.push(`date ${before.date} → ${attendance.date}`);

    if (changes.length > 0) {
      await notifyUser(attendance.employee?._id || attendance.employee, {
        type: "attendance_updated",
        level: "info",
        title: `The admin updated your DTR for ${attendance.date}`,
        message: `${changes.join(", ")}. Now: ${attendance.remarks}, ${attendance.totalHours} hrs.`,
        link: "/client/records",
      });
    }

    res.json({
      message: "Attendance record updated",
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update attendance",
      error: error.message,
    });
  }
};

// ADMIN DELETE ATTENDANCE (active records only)
exports.deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id).populate(
      "employee",
      "employeeId firstName lastName"
    );

    if (!attendance) {
      return res.status(404).json({
        message: "Attendance record not found",
      });
    }

    if (attendance.isArchived) {
      return res.status(400).json({
        message: "Archived records are locked because they are part of a generated payroll",
      });
    }

    await Attendance.findByIdAndDelete(attendance._id);

    await logAudit(req, {
      action: "ATTENDANCE_DELETED",
      entityType: "Attendance",
      entityId: attendance._id,
      description: `Deleted DTR of ${fullName(attendance.employee)} on ${attendance.date}`,
      details: { before: snapshot(attendance) },
    });

    await notifyUser(attendance.employee?._id || attendance.employee, {
      type: "attendance_updated",
      level: "warning",
      title: `The admin deleted your DTR for ${attendance.date}`,
      message: `The record ${attendance.timeIn || "-"} – ${attendance.timeOut || "-"} was removed.`,
      link: "/client/records",
    });

    res.json({
      message: "Attendance record deleted",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete attendance",
      error: error.message,
    });
  }
};
