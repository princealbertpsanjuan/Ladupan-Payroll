const User = require("../models/User");
const Attendance = require("../models/Attendance");
const CorrectionRequest = require("../models/CorrectionRequest");
const bcrypt = require("bcryptjs");
const { generateEmployeeId } = require("../utils/employeeIdGenerator");
const { getBalance } = require("../utils/cashAdvanceUtils");
const { isValidTime } = require("../utils/timeUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyUser } = require("../utils/notify");

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const findEmailOwner = (email) =>
  User.findOne({
    email: { $in: [String(email).trim(), normalizeEmail(email)] },
  });

// GET ALL EMPLOYEES
exports.getEmployees = async (req, res) => {
  try {
    const employees = await User.find({
      role: "employee",
    })
      .select("-password -boundDevice.idHash")
      .sort({ employeeId: 1 });

    res.json(employees);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch employees",
      error: error.message,
    });
  }
};

// CREATE EMPLOYEE (Employee ID is generated automatically)
exports.createEmployee = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      hourlyRate,
      requiredTimeIn,
    } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "First name, last name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const rate = Number(hourlyRate);

    if (!Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({
        message: "Hourly rate must be a valid amount",
      });
    }

    const timeIn = requiredTimeIn || "08:00";

    if (!isValidTime(timeIn)) {
      return res.status(400).json({
        message: "Required time-in must be a valid time (HH:mm)",
      });
    }

    const existingEmployee = await findEmailOwner(email);

    if (existingEmployee) {
      return res.status(400).json({
        message: "An account with this email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = await generateEmployeeId();

    const employee = await User.create({
      employeeId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizeEmail(email),
      password: hashedPassword,
      role: "employee",
      hourlyRate: rate,
      requiredTimeIn: timeIn,
    });

    await logAudit(req, {
      action: "EMPLOYEE_CREATED",
      entityType: "Employee",
      entityId: employee._id,
      description: `Created employee ${employee.employeeId} - ${fullName(employee)}`,
      details: {
        employeeId: employee.employeeId,
        email: employee.email,
        hourlyRate: employee.hourlyRate,
        requiredTimeIn: employee.requiredTimeIn,
      },
    });

    const employeeData = employee.toObject();
    delete employeeData.password;

    res.status(201).json({
      message: "Employee created successfully",
      employee: employeeData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create employee",
      error: error.message,
    });
  }
};

// UPDATE EMPLOYEE
// Employee ID cannot be changed. A new password can optionally be set
// by the Admin (password reset).
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const before = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      hourlyRate: employee.hourlyRate,
      requiredTimeIn: employee.requiredTimeIn,
      isActive: employee.isActive,
    };

    const {
      firstName,
      lastName,
      email,
      hourlyRate,
      requiredTimeIn,
      isActive,
      newPassword,
    } = req.body;

    if (firstName !== undefined && firstName.trim()) {
      employee.firstName = firstName.trim();
    }

    if (lastName !== undefined && lastName.trim()) {
      employee.lastName = lastName.trim();
    }

    if (email !== undefined && email.trim()) {
      const owner = await findEmailOwner(email);

      if (owner && String(owner._id) !== String(employee._id)) {
        return res.status(400).json({
          message: "Another account already uses this email",
        });
      }

      employee.email = normalizeEmail(email);
    }

    if (hourlyRate !== undefined && hourlyRate !== "") {
      const rate = Number(hourlyRate);

      if (!Number.isFinite(rate) || rate < 0) {
        return res.status(400).json({
          message: "Hourly rate must be a valid amount",
        });
      }

      employee.hourlyRate = rate;
    }

    if (requiredTimeIn !== undefined && requiredTimeIn !== "") {
      if (!isValidTime(requiredTimeIn)) {
        return res.status(400).json({
          message: "Required time-in must be a valid time (HH:mm)",
        });
      }

      employee.requiredTimeIn = requiredTimeIn;
    }

    if (typeof isActive === "boolean") {
      employee.isActive = isActive;
    }

    let passwordReset = false;

    if (newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "New password must be at least 6 characters",
        });
      }

      employee.password = await bcrypt.hash(newPassword, 10);
      passwordReset = true;
    }

    await employee.save();

    const after = {
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      hourlyRate: employee.hourlyRate,
      requiredTimeIn: employee.requiredTimeIn,
      isActive: employee.isActive,
    };

    const changes = {};

    Object.keys(after).forEach((key) => {
      if (before[key] !== after[key]) {
        changes[key] = { from: before[key], to: after[key] };
      }
    });

    if (passwordReset) {
      changes.password = { from: "••••", to: "reset by admin" };
    }

    if (Object.keys(changes).length > 0) {
      let action = "EMPLOYEE_UPDATED";
      let description = `Updated employee ${employee.employeeId} - ${fullName(employee)}`;

      const changedKeys = Object.keys(changes);

      if (changedKeys.length === 1 && changedKeys[0] === "isActive") {
        action = employee.isActive ? "EMPLOYEE_ACTIVATED" : "EMPLOYEE_DEACTIVATED";
        description = `${employee.isActive ? "Activated" : "Deactivated"} employee ${employee.employeeId} - ${fullName(employee)}`;
      } else if (changedKeys.length === 1 && changedKeys[0] === "password") {
        action = "EMPLOYEE_PASSWORD_RESET";
        description = `Reset password of ${employee.employeeId} - ${fullName(employee)}`;
      }

      await logAudit(req, {
        action,
        entityType: "Employee",
        entityId: employee._id,
        description,
        details: { changes },
      });
    }

    const employeeData = employee.toObject();
    delete employeeData.password;

    res.json({
      message: "Employee updated successfully",
      employee: employeeData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update employee",
      error: error.message,
    });
  }
};

// DELETE EMPLOYEE
// Blocked while the employee still has unpaid (active) DTR records,
// pending correction requests, or an unpaid cash advance balance, so no
// payroll data is lost. Deactivate the account instead in those cases.
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    const activeRecords = await Attendance.countDocuments({
      employee: employee._id,
      isArchived: false,
    });

    if (activeRecords > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${fullName(employee)} has ${activeRecords} active DTR record(s) not yet included in payroll. Generate payroll first, or deactivate the account instead.`,
      });
    }

    const pendingCorrections = await CorrectionRequest.countDocuments({
      employee: employee._id,
      status: "pending",
    });

    if (pendingCorrections > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${fullName(employee)} has ${pendingCorrections} pending DTR correction request(s). Review them first.`,
      });
    }

    const { balance } = await getBalance(employee._id);

    if (balance > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${fullName(employee)} still has an unpaid cash advance balance of ₱${balance.toFixed(2)}. Deactivate the account instead.`,
      });
    }

    await User.findByIdAndDelete(req.params.id);

    await logAudit(req, {
      action: "EMPLOYEE_DELETED",
      entityType: "Employee",
      entityId: employee._id,
      description: `Deleted employee ${employee.employeeId} - ${fullName(employee)}`,
      details: {
        employeeId: employee.employeeId,
        email: employee.email,
      },
    });

    res.json({
      message: "Employee deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete employee",
      error: error.message,
    });
  }
};

// RESET REGISTERED PHONE (device binding)
// The next phone the employee uses to time in / out becomes registered.
exports.resetDevice = async (req, res) => {
  try {
    const employee = await User.findById(req.params.id);

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ message: "Employee not found" });
    }

    if (!employee.boundDevice?.idHash) {
      return res.status(400).json({ message: "This employee has no registered phone yet" });
    }

    const oldLabel = employee.boundDevice.label;
    employee.boundDevice = { idHash: null, label: "", boundAt: null };
    await employee.save();

    await logAudit(req, {
      action: "DEVICE_RESET",
      entityType: "Employee",
      entityId: employee._id,
      description: `Reset the registered phone of ${fullName(employee)}${oldLabel ? ` (was ${oldLabel})` : ""}`,
    });

    await notifyUser(employee._id, {
      type: "device_reset",
      level: "info",
      title: "Your registered phone was reset",
      message: "The next phone you use to Time In or Time Out becomes your registered phone.",
      link: "/client/time",
    });

    res.json({ message: `${fullName(employee)} can now register a new phone` });
  } catch (error) {
    res.status(500).json({ message: "Failed to reset device", error: error.message });
  }
};
