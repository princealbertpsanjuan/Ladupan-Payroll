const mongoose = require("mongoose");
const CashAdvance = require("../models/CashAdvance");
const User = require("../models/User");
const { getBalances, getBalance } = require("../utils/cashAdvanceUtils");
const { roundMoney } = require("../utils/attendanceRules");
const { getToday, isValidDate } = require("../utils/timeUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyUser, peso } = require("../utils/notify");

// ADMIN: EVERY EMPLOYEE WITH THEIR CASH ADVANCE TOTALS
exports.getCashAdvanceSummary = async (req, res) => {
  try {
    const employees = await User.find({ role: "employee" })
      .select("employeeId firstName lastName isActive")
      .sort({ employeeId: 1 });

    const balances = await getBalances();

    const summary = employees.map((employee) => ({
      _id: employee._id,
      employeeId: employee.employeeId,
      firstName: employee.firstName,
      lastName: employee.lastName,
      isActive: employee.isActive,
      totalAdvances: balances[String(employee._id)]?.totalAdvances || 0,
      totalDeductions: balances[String(employee._id)]?.totalDeductions || 0,
      balance: balances[String(employee._id)]?.balance || 0,
    }));

    res.json(summary);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch cash advances",
      error: error.message,
    });
  }
};

// ADMIN: ONE EMPLOYEE'S LEDGER
exports.getEmployeeLedger = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.employeeId)) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const employee = await User.findById(req.params.employeeId).select(
      "employeeId firstName lastName"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const entries = await CashAdvance.find({ employee: employee._id })
      .populate("createdBy", "firstName lastName")
      .populate("payrollReport", "payrollPeriodStart payrollPeriodEnd")
      .sort({ date: -1, createdAt: -1 });

    const balance = await getBalance(employee._id);

    res.json({ employee, entries, ...balance });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch cash advance ledger",
      error: error.message,
    });
  }
};

// ADMIN: RECORD A NEW CASH ADVANCE GIVEN TO AN EMPLOYEE
exports.createCashAdvance = async (req, res) => {
  try {
    const { employee: employeeId, amount, date, note } = req.body;

    if (!mongoose.isValidObjectId(employeeId)) {
      return res.status(400).json({ message: "Please select an employee" });
    }

    const employee = await User.findById(employeeId);

    if (!employee || employee.role !== "employee") {
      return res.status(404).json({ message: "Employee not found" });
    }

    const value = roundMoney(amount);

    if (!Number.isFinite(value) || value <= 0) {
      return res.status(400).json({
        message: "Amount must be greater than zero",
      });
    }

    const advanceDate = date || getToday();

    if (!isValidDate(advanceDate) || advanceDate > getToday()) {
      return res.status(400).json({
        message: "Please enter a valid date (not in the future)",
      });
    }

    const entry = await CashAdvance.create({
      employee: employee._id,
      type: "advance",
      amount: value,
      date: advanceDate,
      note: String(note || "").trim(),
      createdBy: req.user._id,
    });

    const balance = await getBalance(employee._id);

    await logAudit(req, {
      action: "CASH_ADVANCE_ADDED",
      entityType: "CashAdvance",
      entityId: entry._id,
      description: `Recorded cash advance of ₱${value.toFixed(2)} for ${fullName(employee)}`,
      details: {
        amount: value,
        date: advanceDate,
        note: entry.note,
        newBalance: balance.balance,
      },
    });

    await notifyUser(employee._id, {
      type: "cash_advance",
      level: "info",
      title: `Cash advance of ${peso(value)} recorded`,
      message: `Your unpaid balance is now ${peso(balance.balance)}. It will be deducted through payroll.`,
      link: "/client/payslips",
    });

    res.status(201).json({
      message: "Cash advance recorded",
      entry,
      ...balance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to record cash advance",
      error: error.message,
    });
  }
};

// ADMIN: DELETE A CASH ADVANCE ENTRY (e.g. entered by mistake)
// Payroll deductions cannot be deleted, and an advance cannot be deleted
// if it has already been (partly) paid back through payroll.
exports.deleteCashAdvance = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: "Cash advance entry not found" });
    }

    const entry = await CashAdvance.findById(req.params.id).populate(
      "employee",
      "employeeId firstName lastName"
    );

    if (!entry) {
      return res.status(404).json({ message: "Cash advance entry not found" });
    }

    if (entry.type !== "advance") {
      return res.status(400).json({
        message: "Payroll deductions are part of a generated payroll and cannot be deleted",
      });
    }

    const { balance } = await getBalance(entry.employee._id);

    if (roundMoney(balance - entry.amount) < 0) {
      return res.status(400).json({
        message: "This advance has already been paid back through payroll and cannot be deleted",
      });
    }

    await CashAdvance.findByIdAndDelete(entry._id);

    await logAudit(req, {
      action: "CASH_ADVANCE_DELETED",
      entityType: "CashAdvance",
      entityId: entry._id,
      description: `Deleted cash advance of ₱${entry.amount.toFixed(2)} for ${fullName(entry.employee)}`,
      details: {
        amount: entry.amount,
        date: entry.date,
        note: entry.note,
        newBalance: roundMoney(balance - entry.amount),
      },
    });

    res.json({ message: "Cash advance entry deleted" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete cash advance",
      error: error.message,
    });
  }
};

// EMPLOYEE: MY CASH ADVANCE LEDGER
exports.getMyCashAdvances = async (req, res) => {
  try {
    const entries = await CashAdvance.find({ employee: req.user._id })
      .populate("payrollReport", "payrollPeriodStart payrollPeriodEnd")
      .select("-createdBy")
      .sort({ date: -1, createdAt: -1 });

    const balance = await getBalance(req.user._id);

    res.json({ entries, ...balance });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch cash advances",
      error: error.message,
    });
  }
};
