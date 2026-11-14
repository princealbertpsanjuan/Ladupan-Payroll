const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const PayrollReport = require("../models/PayrollReport");
const CashAdvance = require("../models/CashAdvance");
const User = require("../models/User");
const { isIncomplete, roundMoney } = require("../utils/attendanceRules");
const { getBalances } = require("../utils/cashAdvanceUtils");
const { isValidDate, getToday } = require("../utils/timeUtils");
const { logAudit, fullName } = require("../utils/auditLogger");
const { notifyUser, peso } = require("../utils/notify");

// Validates the payroll request and returns an error message or null
const validateRequest = ({ startDate, endDate, employeeIds }) => {
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return "Please select a valid payroll start date and end date";
  }

  if (startDate > endDate) {
    return "Payroll start date must be on or before the end date";
  }

  if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
    return "Please select at least one employee";
  }

  if (!employeeIds.every((id) => mongoose.isValidObjectId(id))) {
    return "Invalid employee selection";
  }

  return null;
};

// Computes the payroll for the SELECTED employees only, using their
// active (not yet archived) DTR records within the period.
const buildPayroll = async ({ startDate, endDate, employeeIds }) => {
  const employees = await User.find({
    _id: { $in: employeeIds },
    role: "employee",
  }).sort({ lastName: 1, firstName: 1 });

  const balances = await getBalances(employees.map((emp) => emp._id));

  const rows = [];
  const skipped = [];
  const incompleteRecords = [];
  // Off-network Time In / Time Out requests not approved yet: left out of
  // this payroll (they stay active and count once approved)
  const pendingRecords = [];

  for (const employee of employees) {
    const allRecords = await Attendance.find({
      employee: employee._id,
      isArchived: false,
      date: {
        $gte: startDate,
        $lte: endDate,
      },
    }).sort({ date: 1 });

    const records = [];

    allRecords.forEach((record) => {
      if (record.timeInPending || record.timeOutPending) {
        pendingRecords.push({
          _id: record._id,
          employee: employee._id,
          employeeName: fullName(employee),
          date: record.date,
          timeIn: record.timeIn,
          timeOut: record.timeOut,
          timeInPending: record.timeInPending,
          timeOutPending: record.timeOutPending,
        });
      } else {
        records.push(record);
      }
    });

    if (records.length === 0) {
      skipped.push({
        employee: employee._id,
        employeeName: fullName(employee),
        reason:
          allRecords.length > 0
            ? "Only DTRs waiting for approval in this period"
            : "No active DTR records in this period",
      });
      continue;
    }

    let totalPresent = 0;
    let totalLate = 0;
    let totalAbsent = 0;
    let totalIncomplete = 0;
    let totalLateMinutes = 0;
    let totalHours = 0;
    let grossSalary = 0;

    records.forEach((record) => {
      if (isIncomplete(record)) {
        totalIncomplete++;
        incompleteRecords.push({
          _id: record._id,
          employee: employee._id,
          employeeName: fullName(employee),
          date: record.date,
          timeIn: record.timeIn,
        });
        // Counted as 0 hours until the Admin sets the time-out
      }

      totalHours += record.totalHours || 0;
      grossSalary += record.grossPay || 0;
      totalLateMinutes += record.lateMinutes || 0;

      if (record.remarks === "Present") totalPresent++;
      if (record.remarks === "Late") totalLate++;
      if (record.remarks === "Absent") totalAbsent++;
    });

    rows.push({
      employee: employee._id,
      employeeName: fullName(employee),
      employeeCode: employee.employeeId,
      hourlyRate: employee.hourlyRate,
      totalPresent,
      totalLate,
      totalAbsent,
      totalIncomplete,
      totalLateMinutes,
      totalHours: Number(totalHours.toFixed(2)),
      grossSalary: roundMoney(grossSalary),
      lateDeductions: 0,
      cashAdvanceBalance: balances[String(employee._id)]?.balance || 0,
      recordIds: records.map((record) => record._id),
      recordCount: records.length,
    });
  }

  return { rows, skipped, incompleteRecords, pendingRecords };
};

// PREVIEW PAYROLL (nothing is saved or archived)
exports.previewPayroll = async (req, res) => {
  try {
    const { startDate, endDate, employeeIds } = req.body;

    const validationError = validateRequest({ startDate, endDate, employeeIds });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { rows, skipped, incompleteRecords, pendingRecords } = await buildPayroll({
      startDate,
      endDate,
      employeeIds,
    });

    res.json({
      startDate,
      endDate,
      employees: rows.map(({ recordIds, ...row }) => row),
      skipped,
      incompleteRecords,
      pendingRecords,
    });
  } catch (error) {
    res.status(500).json({
      message: "Payroll preview failed",
      error: error.message,
    });
  }
};

// GENERATE PAYROLL REPORT
// Body: { startDate, endDate, employeeIds, deductions, includeIncomplete }
// deductions: [{ employee, cashAdvance, otherDeductions, otherDeductionsNote }]
exports.generatePayroll = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      employeeIds,
      deductions = [],
      includeIncomplete = false,
    } = req.body;

    const validationError = validateRequest({ startDate, endDate, employeeIds });

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { rows, skipped, incompleteRecords } = await buildPayroll({
      startDate,
      endDate,
      employeeIds,
    });

    if (rows.length === 0) {
      return res.status(400).json({
        message:
          "None of the selected employees have active DTR records in this period",
        skipped,
      });
    }

    if (incompleteRecords.length > 0 && !includeIncomplete) {
      return res.status(409).json({
        message: `${incompleteRecords.length} DTR record(s) in this period have no time-out. Set their time-out in Attendance Management, or confirm to include them as 0 hours.`,
        incompleteRecords,
      });
    }

    const deductionMap = {};

    (Array.isArray(deductions) ? deductions : []).forEach((item) => {
      if (item && item.employee) {
        deductionMap[String(item.employee)] = item;
      }
    });

    // Validate deductions before saving anything
    const payrollEmployees = [];

    for (const row of rows) {
      const input = deductionMap[String(row.employee)] || {};

      const cashAdvance = roundMoney(input.cashAdvance || 0);
      const otherDeductions = roundMoney(input.otherDeductions || 0);

      if (cashAdvance < 0 || otherDeductions < 0) {
        return res.status(400).json({
          message: `Deductions for ${row.employeeName} cannot be negative`,
        });
      }

      if (cashAdvance > row.cashAdvanceBalance) {
        return res.status(400).json({
          message: `Cash advance deduction for ${row.employeeName} (₱${cashAdvance.toFixed(2)}) is more than their unpaid balance (₱${row.cashAdvanceBalance.toFixed(2)})`,
        });
      }

      const netSalary = roundMoney(
        row.grossSalary - row.lateDeductions - cashAdvance - otherDeductions
      );

      if (netSalary < 0) {
        return res.status(400).json({
          message: `Deductions for ${row.employeeName} are more than their gross pay (₱${row.grossSalary.toFixed(2)})`,
        });
      }

      payrollEmployees.push({
        employee: row.employee,
        employeeName: row.employeeName,
        employeeCode: row.employeeCode,
        hourlyRate: row.hourlyRate,
        totalPresent: row.totalPresent,
        totalLate: row.totalLate,
        totalAbsent: row.totalAbsent,
        totalIncomplete: row.totalIncomplete,
        totalLateMinutes: row.totalLateMinutes,
        totalHours: row.totalHours,
        grossSalary: row.grossSalary,
        lateDeductions: row.lateDeductions,
        cashAdvance,
        otherDeductions,
        otherDeductionsNote: String(input.otherDeductionsNote || "").trim(),
        netSalary,
        recordIds: row.recordIds,
      });
    }

    const payrollReport = await PayrollReport.create({
      payrollPeriodStart: startDate,
      payrollPeriodEnd: endDate,
      generatedBy: req.user._id,
      employees: payrollEmployees.map(({ recordIds, ...entry }) => entry),
      totalEmployees: payrollEmployees.length,
      totalGross: roundMoney(
        payrollEmployees.reduce((sum, emp) => sum + emp.grossSalary, 0)
      ),
      totalNet: roundMoney(
        payrollEmployees.reduce((sum, emp) => sum + emp.netSalary, 0)
      ),
    });

    // ARCHIVE ONLY the selected employees' DTR records used in this payroll
    const recordIds = payrollEmployees.flatMap((emp) => emp.recordIds);

    await Attendance.updateMany(
      {
        _id: { $in: recordIds },
        isArchived: false,
      },
      {
        isArchived: true,
        payrollReport: payrollReport._id,
      }
    );

    // RECORD CASH ADVANCE REPAYMENTS IN THE LEDGER
    const ledgerEntries = payrollEmployees
      .filter((emp) => emp.cashAdvance > 0)
      .map((emp) => ({
        employee: emp.employee,
        type: "deduction",
        amount: emp.cashAdvance,
        date: getToday(),
        note: `Payroll deduction (${startDate} to ${endDate})`,
        payrollReport: payrollReport._id,
        createdBy: req.user._id,
      }));

    if (ledgerEntries.length > 0) {
      await CashAdvance.insertMany(ledgerEntries);
    }

    await logAudit(req, {
      action: "PAYROLL_GENERATED",
      entityType: "PayrollReport",
      entityId: payrollReport._id,
      description: `Generated payroll for ${startDate} to ${endDate} (${payrollEmployees.length} employee(s), net ₱${payrollReport.totalNet.toFixed(2)})`,
      details: {
        employees: payrollEmployees.map((emp) => ({
          name: emp.employeeName,
          gross: emp.grossSalary,
          cashAdvance: emp.cashAdvance,
          otherDeductions: emp.otherDeductions,
          net: emp.netSalary,
        })),
        archivedRecords: recordIds.length,
        includedIncomplete: incompleteRecords.length,
        skipped: skipped.map((item) => item.employeeName),
      },
    });

    // Tell each paid employee their payslip is ready
    await Promise.all(
      payrollEmployees.map((emp) =>
        notifyUser(emp.employee, {
          type: "payslip_ready",
          level: "success",
          title: "Your payslip is ready",
          message: `Payroll ${startDate} to ${endDate}: net pay ${peso(emp.netSalary)}.`,
          link: `/client/payslips/${payrollReport._id}`,
        })
      )
    );

    res.status(201).json({
      message: "Payroll report generated successfully",
      payrollReport,
      skipped,
    });
  } catch (error) {
    res.status(500).json({
      message: "Payroll generation failed",
      error: error.message,
    });
  }
};
