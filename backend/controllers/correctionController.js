const CorrectionRequest = require("../models/CorrectionRequest");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { applyAttendanceRules, timeToMinutes } = require("../utils/attendanceRules");
const { getToday, isValidDate, isValidTime } = require("../utils/timeUtils");
const { logAudit, fullName } = require("../utils/auditLogger");

const EMPLOYEE_FIELDS = "employeeId firstName lastName";

// EMPLOYEE: SUBMIT A CORRECTION REQUEST
exports.createCorrection = async (req, res) => {
  try {
    const { date, requestedTimeIn, requestedTimeOut, reason } = req.body;
    const today = getToday();

    if (!isValidDate(date)) {
      return res.status(400).json({ message: "Please select a valid date" });
    }

    if (date > today) {
      return res.status(400).json({
        message: "You cannot request a correction for a future date",
      });
    }

    if (!isValidTime(requestedTimeIn)) {
      return res.status(400).json({ message: "Please enter a valid time in" });
    }

    const timeOut = requestedTimeOut || null;

    if (!timeOut && date < today) {
      return res.status(400).json({
        message: "Please enter the time out for a past date",
      });
    }

    if (timeOut) {
      if (!isValidTime(timeOut)) {
        return res.status(400).json({ message: "Please enter a valid time out" });
      }

      if (timeToMinutes(timeOut) <= timeToMinutes(requestedTimeIn)) {
        return res.status(400).json({
          message: "Time out must be later than time in",
        });
      }
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        message: "Please explain the reason for the correction",
      });
    }

    const attendance = await Attendance.findOne({
      employee: req.user._id,
      date,
    });

    if (attendance?.isArchived) {
      return res.status(400).json({
        message: "This date is already included in a generated payroll and can no longer be corrected",
      });
    }

    if (
      attendance &&
      attendance.timeIn === requestedTimeIn &&
      (attendance.timeOut || null) === timeOut
    ) {
      return res.status(400).json({
        message: "The requested times are the same as your current record",
      });
    }

    const pending = await CorrectionRequest.findOne({
      employee: req.user._id,
      date,
      status: "pending",
    });

    if (pending) {
      return res.status(400).json({
        message: "You already have a pending correction request for this date",
      });
    }

    const correction = await CorrectionRequest.create({
      employee: req.user._id,
      attendance: attendance?._id || null,
      date,
      originalTimeIn: attendance?.timeIn || null,
      originalTimeOut: attendance?.timeOut || null,
      requestedTimeIn,
      requestedTimeOut: timeOut,
      reason: reason.trim(),
    });

    await logAudit(req, {
      action: "CORRECTION_SUBMITTED",
      entityType: "CorrectionRequest",
      entityId: correction._id,
      description: `${fullName(req.user)} requested a DTR correction for ${date}`,
      details: {
        original: { timeIn: correction.originalTimeIn, timeOut: correction.originalTimeOut },
        requested: { timeIn: requestedTimeIn, timeOut },
        reason: correction.reason,
      },
    });

    res.status(201).json({
      message: "Correction request submitted. The admin will review it.",
      correction,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to submit correction request",
      error: error.message,
    });
  }
};

// EMPLOYEE: MY CORRECTION REQUESTS
exports.getMyCorrections = async (req, res) => {
  try {
    const corrections = await CorrectionRequest.find({
      employee: req.user._id,
    })
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json(corrections);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch correction requests",
      error: error.message,
    });
  }
};

// EMPLOYEE: CANCEL A PENDING REQUEST
exports.cancelMyCorrection = async (req, res) => {
  try {
    const correction = await CorrectionRequest.findOne({
      _id: req.params.id,
      employee: req.user._id,
    });

    if (!correction) {
      return res.status(404).json({ message: "Correction request not found" });
    }

    if (correction.status !== "pending") {
      return res.status(400).json({
        message: "Only pending requests can be cancelled",
      });
    }

    await CorrectionRequest.findByIdAndDelete(correction._id);

    await logAudit(req, {
      action: "CORRECTION_CANCELLED",
      entityType: "CorrectionRequest",
      entityId: correction._id,
      description: `${fullName(req.user)} cancelled their correction request for ${correction.date}`,
    });

    res.json({ message: "Correction request cancelled" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to cancel correction request",
      error: error.message,
    });
  }
};

// ADMIN: ALL CORRECTION REQUESTS (optional ?status=pending|approved|rejected)
exports.getCorrections = async (req, res) => {
  try {
    const filter = {};

    if (["pending", "approved", "rejected"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const corrections = await CorrectionRequest.find(filter)
      .populate("employee", EMPLOYEE_FIELDS)
      .populate("reviewedBy", "firstName lastName")
      .sort({ createdAt: -1 });

    res.json(corrections);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch correction requests",
      error: error.message,
    });
  }
};

// ADMIN: APPROVE (applies the requested times to the DTR)
exports.approveCorrection = async (req, res) => {
  try {
    const correction = await CorrectionRequest.findById(req.params.id).populate(
      "employee",
      `${EMPLOYEE_FIELDS} requiredTimeIn hourlyRate role`
    );

    if (!correction) {
      return res.status(404).json({ message: "Correction request not found" });
    }

    if (correction.status !== "pending") {
      return res.status(400).json({
        message: `This request was already ${correction.status}`,
      });
    }

    if (!correction.employee) {
      return res.status(400).json({
        message: "The employee for this request no longer exists",
      });
    }

    let attendance = await Attendance.findOne({
      employee: correction.employee._id,
      date: correction.date,
    });

    if (attendance?.isArchived) {
      return res.status(400).json({
        message: "This date is already included in a generated payroll. Reject the request instead.",
      });
    }

    const before = attendance
      ? { timeIn: attendance.timeIn, timeOut: attendance.timeOut, remarks: attendance.remarks }
      : null;

    if (!attendance) {
      attendance = new Attendance({
        employee: correction.employee._id,
        date: correction.date,
        requiredTimeIn: correction.employee.requiredTimeIn,
        hourlyRate: correction.employee.hourlyRate,
      });
    }

    attendance.timeIn = correction.requestedTimeIn;
    attendance.timeOut = correction.requestedTimeOut || null;
    applyAttendanceRules(attendance);
    await attendance.save();

    correction.status = "approved";
    correction.attendance = attendance._id;
    correction.reviewedBy = req.user._id;
    correction.reviewedAt = new Date();
    correction.adminNote = String(req.body.adminNote || "").trim();
    await correction.save();

    await logAudit(req, {
      action: "CORRECTION_APPROVED",
      entityType: "CorrectionRequest",
      entityId: correction._id,
      description: `Approved DTR correction of ${fullName(correction.employee)} for ${correction.date}`,
      details: {
        before,
        after: {
          timeIn: attendance.timeIn,
          timeOut: attendance.timeOut,
          remarks: attendance.remarks,
          totalHours: attendance.totalHours,
        },
        reason: correction.reason,
        adminNote: correction.adminNote,
      },
    });

    res.json({
      message: "Correction approved and DTR updated",
      correction,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to approve correction",
      error: error.message,
    });
  }
};

// ADMIN: REJECT
exports.rejectCorrection = async (req, res) => {
  try {
    const correction = await CorrectionRequest.findById(req.params.id).populate(
      "employee",
      EMPLOYEE_FIELDS
    );

    if (!correction) {
      return res.status(404).json({ message: "Correction request not found" });
    }

    if (correction.status !== "pending") {
      return res.status(400).json({
        message: `This request was already ${correction.status}`,
      });
    }

    correction.status = "rejected";
    correction.reviewedBy = req.user._id;
    correction.reviewedAt = new Date();
    correction.adminNote = String(req.body.adminNote || "").trim();
    await correction.save();

    await logAudit(req, {
      action: "CORRECTION_REJECTED",
      entityType: "CorrectionRequest",
      entityId: correction._id,
      description: `Rejected DTR correction of ${fullName(correction.employee)} for ${correction.date}`,
      details: {
        reason: correction.reason,
        adminNote: correction.adminNote,
      },
    });

    res.json({
      message: "Correction request rejected",
      correction,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to reject correction",
      error: error.message,
    });
  }
};
